require('dotenv').config();

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);

const express = require('express');
const cors    = require('cors');
const pool    = require('./db');
const { LocationClient, SearchPlaceIndexForTextCommand } = require('@aws-sdk/client-location');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── AWS Location Client ───────────────────────────────────────
const locationClient = new LocationClient({
  region: process.env.AWS_REGION || 'ap-south-1'
});

async function geocodePincode(pincode) {
  try {
    const command = new SearchPlaceIndexForTextCommand({
      IndexName:       process.env.AWS_LOCATION_INDEX,
      Text:            `${pincode}, India`,
      MaxResults:      1,
      FilterCountries: ['IND'],
      Key:             process.env.AWS_LOCATION_API_KEY
    });

    const response = await locationClient.send(command);

    if (response.Results?.length > 0) {
      const [lng, lat] = response.Results[0].Place.Geometry.Point;
      console.log(`✅ AWS Location: ${pincode} → lat=${lat}, lng=${lng}`);
      return { lat, lng };
    }

    console.log(`⚠️  AWS Location: no results for ${pincode}`);
    return null;
  } catch (err) {
    console.error(`❌ AWS Location error for ${pincode}:`, err.message);
    return null;
  }
}

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());

// ── Severity Config ───────────────────────────────────────────
const SEVERITY_CONFIG = {
  mild: {
    careTypes: ['Dispensary/ Poly Clinic', 'Health Centre'],
    initialRadius: 3,
    level: 'Mild'
  },
  moderate: {
    careTypes: ['Hospital', 'Clinic'],
    initialRadius: 5,
    level: 'Moderate'
  },
  high: {
    careTypes: ['Hospital', 'Medical College / Institute/Hospital'],
    initialRadius: 10,
    level: 'High'
  },
  emergency: {
    emergencyOnly: true,
    initialRadius: 10,
    level: 'Emergency'
  }
};

const RADIUS_STEPS = [3, 5, 10, 20];

// ── Shared SELECT columns ─────────────────────────────────────
const HOSPITAL_SELECT = `
  id, hospital_name, hospital_category, hospital_care_type,
  discipline, discipline_clean, ayush,
  state, district, pincode, address,
  specialties_array, facilities_array,
  emergency_available, emergency_num, ambulance_phone, bloodbank_phone,
  telephone, mobile_number,
  total_beds, data_quality_norm,
  ST_X(location::geometry) AS longitude,
  ST_Y(location::geometry) AS latitude
`;

// ── Routes ────────────────────────────────────────────────────

app.get('/api/hospitals/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)                                                AS total,
        COUNT(*) FILTER (WHERE location IS NOT NULL)            AS with_coordinates,
        COUNT(*) FILTER (WHERE emergency_available = TRUE)      AS emergency,
        COUNT(*) FILTER (WHERE ayush = TRUE)                    AS ayush,
        COUNT(*) FILTER (WHERE hospital_category ILIKE '%gov%') AS government,
        COUNT(*) FILTER (WHERE data_quality_norm >= 0)          AS quality_passed
      FROM hospitals
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

app.get('/api/hospitals', async (req, res) => {
  try {
    const { lat, lng, radius = 10, emergency, specialty, ayush } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const radiusMetres = parseFloat(radius) * 1000;
    const params = [parseFloat(lat), parseFloat(lng), radiusMetres];
    let paramIndex = 4;

    let whereClause = `ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3) AND location IS NOT NULL`;

    if (emergency === 'true') {
      whereClause += ` AND emergency_available = TRUE`;
    }

    if (ayush === 'true') {
      whereClause += ` AND (ayush = TRUE OR 'Ayurveda' = ANY(discipline_clean) OR 'Homeopathy' = ANY(discipline_clean))`;
    }

    if (specialty) {
      whereClause += ` AND specialties_array @> ARRAY[$${paramIndex}]`;
      params.push(specialty);
      paramIndex++;
    }

    const query = `
      SELECT
        ${HOSPITAL_SELECT},
        (ST_Distance(location, ST_MakePoint($2, $1)::geography) / 1000)::float AS distance_km
      FROM hospitals
      WHERE ${whereClause}
      ORDER BY location <-> ST_MakePoint($2, $1)::geography
      LIMIT 50
    `;

    const result = await pool.query(query, params);
    res.json({ hospitals: result.rows, count: result.rows.length, radius: parseFloat(radius) });
  } catch (err) {
    console.error('Hospital search error:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

app.post('/api/hospitals/severity-based', async (req, res) => {
  console.log('📍 Severity-based search request:', {
    pincode:  req.body.pincode,
    lat:      req.body.latitude,
    lng:      req.body.longitude,
    severity: req.body.severityLevel
  });

  try {
    const { latitude, longitude, severityLevel, specialties } = req.body;

    if (!latitude || !longitude || !severityLevel) {
      return res.status(400).json({
        error: 'latitude, longitude, and severityLevel are required'
      });
    }

    const config = SEVERITY_CONFIG[severityLevel];
    if (!config) {
      return res.status(400).json({ error: 'Invalid severity level' });
    }

    const searchResult = await queryWithExpansion(
      parseFloat(latitude),
      parseFloat(longitude),
      config,
      specialties ? specialties[0] : null
    );

    console.log(`✅ Found ${searchResult.hospitals.length} hospitals within ${searchResult.radiusUsed}km`);

    res.json({
      facilities:    searchResult.hospitals,
      radiusUsed:    searchResult.radiusUsed,
      wasExpanded:   searchResult.radiusUsed > config.initialRadius,
      severityLevel: severityLevel,
      config: {
        level:         config.level,
        initialRadius: config.initialRadius
      }
    });
  } catch (err) {
    console.error('❌ Severity-based search error:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

async function queryWithExpansion(lat, lng, config, specialty) {
  const uniqueRadii = [...new Set([
    config.initialRadius,
    ...RADIUS_STEPS.filter(r => r >= config.initialRadius),
    30, 50
  ])];

  for (const radius of uniqueRadii) {
    const radiusMetres = radius * 1000;

    // Pass 1: strict (care type filter)
    let hospitals = await runQuery(lat, lng, radiusMetres, config, specialty, true);
    if (hospitals.length > 0) {
      console.log(`✅ Pass1 (strict) found ${hospitals.length} hospitals within ${radius}km`);
      return { hospitals, radiusUsed: radius };
    }

    // Pass 2: relaxed (no care type filter)
    hospitals = await runQuery(lat, lng, radiusMetres, config, specialty, false);
    if (hospitals.length > 0) {
      console.log(`✅ Pass2 (relaxed) found ${hospitals.length} hospitals within ${radius}km`);
      return { hospitals, radiusUsed: radius };
    }

    console.log(`⚠️  No hospitals within ${radius}km, expanding...`);
  }

  return { hospitals: [], radiusUsed: 50 };
}

async function runQuery(lat, lng, radiusMetres, config, specialty, strict) {
  try {
    let whereClause = `
      ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3)
      AND location IS NOT NULL
    `;
    let params = [lat, lng, radiusMetres];
    let paramIndex = 4;

    if (config.emergencyOnly) {
      whereClause += ` AND emergency_available = TRUE`;
    } else if (strict && config.careTypes) {
      whereClause += ` AND hospital_care_type = ANY($${paramIndex})`;
      params.push(config.careTypes);
      paramIndex++;
    }

    if (specialty) {
      whereClause += ` AND specialties_array @> ARRAY[$${paramIndex}]`;
      params.push(specialty);
      paramIndex++;
    }

    const query = `
      SELECT
        ${HOSPITAL_SELECT},
        (ST_Distance(location, ST_MakePoint($2, $1)::geography) / 1000)::float AS distance_km
      FROM hospitals
      WHERE ${whereClause}
      ORDER BY location <-> ST_MakePoint($2, $1)::geography
      LIMIT 20
    `;

    const result = await pool.query(query, params);
    return result.rows;

  } catch (err) {
    console.error('❌ runQuery error:', err.message);
    return [];
  }
}

app.get('/api/hospitals/search', async (req, res) => {
  try {
    const { q, state } = req.query;
    if (!q) return res.json({ hospitals: [] });

    const searchPattern = `%${q}%`;
    const params = state ? [searchPattern, `%${state}%`] : [searchPattern];

    const result = await pool.query(`
      SELECT
        ${HOSPITAL_SELECT}
      FROM hospitals
      WHERE hospital_name ILIKE $1
        ${state ? 'AND state ILIKE $2' : ''}
        AND location IS NOT NULL
      ORDER BY hospital_name
      LIMIT 20
    `, params);

    res.json({ hospitals: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

/**
 * GET /api/pincode/:pincode
 * Strategy 1: AWS Location Service  → accurate PIN centre
 * Strategy 2: DB exact pincode      → fallback
 * Strategy 3: DB district centroid  → last resort
 */
app.get('/api/pincode/:pincode', async (req, res) => {
  const { pincode } = req.params;
  console.log(`📍 Pincode lookup: ${pincode}`);

  if (!/^\d{6}$/.test(pincode)) {
    return res.status(400).json({ error: 'Invalid pincode. Must be 6 digits.' });
  }

  try {
    // Strategy 1: AWS Location Service
    const geo = await geocodePincode(pincode);

    if (geo) {
      const meta = await pool.query(`
        SELECT state, district, COUNT(*) AS hospital_count
        FROM hospitals
        WHERE pincode = $1
        GROUP BY state, district
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `, [pincode]);

      return res.json({
        pincode,
        latitude:       geo.lat,
        longitude:      geo.lng,
        state:          meta.rows[0]?.state          || null,
        district:       meta.rows[0]?.district       || null,
        hospital_count: meta.rows[0]?.hospital_count || 0,
        source:         'aws-location'
      });
    }

    // Strategy 2: DB exact pincode
    console.log(`⚠️  AWS Location failed, trying DB exact for ${pincode}`);
    const exact = await pool.query(`
      SELECT
        pincode, state, district,
        AVG(ST_Y(location::geometry)) AS latitude,
        AVG(ST_X(location::geometry)) AS longitude,
        COUNT(*) AS hospital_count
      FROM hospitals
      WHERE pincode = $1 AND location IS NOT NULL
      GROUP BY pincode, state, district
      LIMIT 1
    `, [pincode]);

    if (exact.rows.length > 0) {
      console.log(`✅ DB exact: ${exact.rows[0].latitude}, ${exact.rows[0].longitude}`);
      return res.json({ ...exact.rows[0], source: 'db_exact' });
    }

    // Strategy 3: District centroid
    const distMeta = await pool.query(
      `SELECT state, district FROM hospitals WHERE pincode = $1 LIMIT 1`,
      [pincode]
    );

    if (distMeta.rows.length > 0) {
      const { state, district } = distMeta.rows[0];
      const dist = await pool.query(`
        SELECT
          $1 AS pincode, state, district,
          AVG(ST_Y(location::geometry)) AS latitude,
          AVG(ST_X(location::geometry)) AS longitude,
          COUNT(*) AS hospital_count
        FROM hospitals
        WHERE district = $2 AND state = $3 AND location IS NOT NULL
        GROUP BY state, district
        LIMIT 1
      `, [pincode, district, state]);

      if (dist.rows.length > 0) {
        console.log(`✅ District fallback: ${state}, ${district}`);
        return res.json({ ...dist.rows[0], source: 'db_district' });
      }
    }

    console.log(`❌ All strategies failed for ${pincode}`);
    return res.status(404).json({
      error:   'Pincode not found',
      message: 'Could not locate this PIN code. Please check and try again.'
    });

  } catch (err) {
    console.error('❌ Pincode error:', err.message);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'healthy', database: 'connected', timestamp: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error:   'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
  console.log(`🗄️  Database: ${process.env.DB_HOST}`);
  console.log(`🗺️  AWS Location Index: ${process.env.AWS_LOCATION_INDEX}`);
});

process.on('SIGTERM', () => {
  pool.end(() => process.exit(0));
});