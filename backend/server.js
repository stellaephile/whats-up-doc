require('dotenv').config();

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());

// ── Severity configuration ────────────────────────────────────
// KEY FIX: careTypes now includes 'Hospital' at every level
// because that's what the DB actually contains for most records.
const SEVERITY_CONFIG = {
  mild: {
    careTypes: ['Hospital', 'Dispensary/ Poly Clinic', 'Health Centre', 'Clinic'],
    initialRadius: 5,
    level: 'Mild'
  },
  moderate: {
    careTypes: ['Hospital', 'Clinic', 'Nursing Home', 'Medical College / Institute/Hospital'],
    initialRadius: 8,
    level: 'Moderate'
  },
  high: {
    careTypes: ['Hospital', 'Medical College / Institute/Hospital'],
    initialRadius: 12,
    level: 'High'
  },
  emergency: {
    emergencyOnly: true,
    careTypes: ['Hospital', 'Medical College / Institute/Hospital'],
    initialRadius: 12,
    level: 'Emergency'
  }
};

// Progressive radius expansion
const RADIUS_STEPS = [5, 8, 12, 20];

// Minimum results before we drop specialty filter
const MIN_RESULTS = 3;

/**
 * GET /api/hospitals/stats
 */
app.get('/api/hospitals/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE location IS NOT NULL)          AS with_coordinates,
        COUNT(*) FILTER (WHERE emergency_available = TRUE)    AS emergency,
        COUNT(*) FILTER (WHERE ayush = TRUE)                  AS ayush,
        COUNT(*) FILTER (WHERE hospital_category ILIKE '%gov%') AS government,
        COUNT(*) FILTER (WHERE data_quality_norm >= 0)      AS quality_passed
      FROM hospitals
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

/**
 * GET /api/hospitals
 */
app.get('/api/hospitals', async (req, res) => {
  try {
    const { lat, lng, radius = 10, emergency, specialty } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const radiusMetres = parseFloat(radius) * 1000;

    let query = `
      SELECT
        id, hospital_name, hospital_category, hospital_care_type,
        discipline, ayush,
        state, district, pincode, address,
        specialties_array, facilities_array,
        emergency_available, emergency_num, ambulance_phone, bloodbank_phone,
        telephone, mobile_n sumber,
        total_beds, data_quality_norm,
        ST_X(location::geometry) AS longitude,
        ST_Y(location::geometry) AS latitude,
        ROUND((ST_Distance(location, ST_MakePoint($2, $1)::geography) / 1000)::numeric, 2) AS distance_km
      FROM hospitals
      WHERE ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3)
    `;

    const params = [parseFloat(lat), parseFloat(lng), radiusMetres];
    let paramIndex = 4;

    if (emergency === 'true') {
      query += ` AND emergency_available = TRUE`;
    }

    if (specialty) {
      query += ` AND specialties_array @> ARRAY[$${paramIndex}]`;
      params.push(specialty);
      paramIndex++;
    }

    query += ` ORDER BY location <-> ST_MakePoint($2, $1)::geography LIMIT 50`;

    const result = await pool.query(query, params);
    res.json({ hospitals: result.rows, count: result.rows.length, radius: parseFloat(radius) });
  } catch (err) {
    console.error('Error fetching hospitals:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

/**
 * POST /api/hospitals/severity-based
 */
app.post('/api/hospitals/severity-based', async (req, res) => {
  console.log('📍 Severity-based search:', {
    pincode: req.body.pincode,
    lat: req.body.latitude,
    lng: req.body.longitude,
    severity: req.body.severityLevel,
    specialties: req.body.specialties
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
      specialties || []
    );

    console.log(`✅ Found ${searchResult.hospitals.length} hospitals within ${searchResult.radiusUsed}km (specialty filtered: ${searchResult.specialtyFiltered})`);

    res.json({
      facilities:       searchResult.hospitals,
      radiusUsed:       searchResult.radiusUsed,
      wasExpanded:      searchResult.radiusUsed > config.initialRadius,
      specialtyFiltered: searchResult.specialtyFiltered,
      severityLevel,
      config: { level: config.level, initialRadius: config.initialRadius }
    });
  } catch (err) {
    console.error('❌ Error in severity-based search:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

/**
 * Core query builder — returns rows for given radius + optional specialty
 */
async function queryHospitals(lat, lng, radiusMetres, config, specialty) {
  const SELECT = `
    SELECT
      id, hospital_name, hospital_category, hospital_care_type,
      discipline, ayush,
      state, district, pincode, address,
      specialties_array, facilities_array,
      emergency_available, emergency_num, ambulance_phone, bloodbank_phone,
      telephone, mobile_number,
      total_beds, data_quality_norm,
      ST_X(location::geometry) AS longitude,
      ST_Y(location::geometry) AS latitude,
      ROUND((ST_Distance(location, ST_MakePoint($2, $1)::geography) / 1000)::numeric, 2) AS distance_km
    FROM hospitals
    WHERE ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3)
      AND location IS NOT NULL
      AND data_quality_norm >= 0
  `;

  if (config.emergencyOnly) {
    // Try with emergency_available = TRUE first
    const emergencyParams = [lat, lng, radiusMetres];
    let emergencyQuery = SELECT + ` AND emergency_available = TRUE`;
    if (specialty) {
      emergencyQuery += ` AND specialties_array @> ARRAY[$4]`;
      emergencyParams.push(specialty);
    }
    emergencyQuery += ` ORDER BY location <-> ST_MakePoint($2, $1)::geography LIMIT 20`;
    
    const r = await pool.query(emergencyQuery, emergencyParams);
    if (r.rows.length >= MIN_RESULTS) return r;

    // Fallback: drop emergency_available requirement, sort emergency-first
    console.log('⚠️  Emergency fallback: dropping emergency_available filter');
    const fallbackParams = [lat, lng, radiusMetres];
    let fallbackQuery = SELECT;
    if (specialty) {
      fallbackQuery += ` AND specialties_array @> ARRAY[$4]`;
      fallbackParams.push(specialty);
    }
    // Sort: emergency hospitals first, then by distance
    const orderParam = fallbackParams.length + 1; // not used, inline CASE is safe
    fallbackQuery += `
      ORDER BY
        CASE WHEN emergency_available = TRUE THEN 0 ELSE 1 END,
        location <-> ST_MakePoint($2, $1)::geography
      LIMIT 20`;
    return pool.query(fallbackQuery, fallbackParams);
  }else {
    // Regular: filter by care type (allow NULL care_type too)
    let q = SELECT + ` AND (hospital_care_type = ANY($4) OR hospital_care_type IS NULL)`;
    let params = [lat, lng, radiusMetres, config.careTypes];
    if (specialty) {
      q += ` AND specialties_array @> ARRAY[$5]`;
      params.push(specialty);
    }
    q += ` ORDER BY location <-> ST_MakePoint($2, $1)::geography LIMIT 20`;
    return pool.query(q, params);
  }
}

/**
 * Progressive search with radius expansion + specialty fallback
 *
 * Strategy:
 *   1. Try with specialty filter at each radius step
 *   2. If MIN_RESULTS never reached, retry WITHOUT specialty (nearest hospitals)
 *   3. Always return something if hospitals exist within 20km
 */
async function queryWithExpansion(lat, lng, config, specialties) {
  const radii = RADIUS_STEPS.filter(r => r >= config.initialRadius);
  const specialty = specialties?.[0] || null; // use primary specialty

  // ── Pass 1: with specialty filter ──────────────────────────
  if (specialty) {
    for (const radius of radii) {
      const result = await queryHospitals(lat, lng, radius * 1000, config, specialty);
      if (result.rows.length >= MIN_RESULTS) {
        return { hospitals: result.rows, radiusUsed: radius, specialtyFiltered: true };
      }
    }
    console.log(`⚠️  Not enough "${specialty}" hospitals — falling back to general search`);
  }

  // ── Pass 2: without specialty filter (show nearest hospitals) ──
  for (const radius of radii) {
    const result = await queryHospitals(lat, lng, radius * 1000, config, null);
    if (result.rows.length > 0) {
      return { hospitals: result.rows, radiusUsed: radius, specialtyFiltered: false };
    }
  }

  return { hospitals: [], radiusUsed: 20, specialtyFiltered: false };
}

/**
 * GET /api/hospitals/search
 */
app.get('/api/hospitals/search', async (req, res) => {
  try {
    const { q, state } = req.query;
    if (!q) return res.json({ hospitals: [] });

    const query = `
      SELECT
        id, hospital_name, hospital_category, hospital_care_type,
        state, district, pincode, address,
        specialties_array, emergency_available,
        telephone, mobile_number,
        ST_X(location::geometry) AS longitude,
        ST_Y(location::geometry) AS latitude
      FROM hospitals
      WHERE hospital_name ILIKE $1
        ${state ? "AND state ILIKE $2" : ''}
        AND location IS NOT NULL
      ORDER BY
        CASE
          WHEN hospital_name ILIKE $1 THEN 1
          WHEN hospital_name ILIKE $1 || '%' THEN 2
          ELSE 3
        END,
        hospital_name
      LIMIT 20
    `;

    const searchPattern = `%${q}%`;
    const params = state ? [searchPattern, `%${state}%`] : [searchPattern];
    const result = await pool.query(query, params);
    res.json({ hospitals: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Error searching hospitals:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

/**
 * GET /api/pincode/:pincode
 */
app.get('/api/pincode/:pincode', async (req, res) => {
  const { pincode } = req.params;
  console.log(`📍 Pincode lookup: ${pincode}`);

  try {
  
    const result = await pool.query(`
      SELECT
        pincode, state, district,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ST_Y(location::geometry)) AS latitude,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ST_X(location::geometry)) AS longitude,
        COUNT(*) AS hospital_count
      FROM hospitals
      WHERE pincode = $1
        AND location IS NOT NULL
        AND ST_Y(location::geometry) BETWEEN 6.0 AND 37.5
        AND ST_X(location::geometry) BETWEEN 68.0 AND 97.5
      GROUP BY pincode, state, district
      LIMIT 1
    `, [pincode]);

    if (result.rows.length === 0) {
      console.log(`❌ Pincode ${pincode} not found`);
      return res.status(404).json({
        error: 'Pincode not found',
        message: 'No hospitals found for this pincode in our database'
      });
    }

    console.log(`✅ Pincode ${pincode}: ${result.rows[0].state}, ${result.rows[0].district}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error fetching pincode:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

/**
 * POST /api/symptoms/classify — proxy to Python FastAPI
 */
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

app.post('/api/symptoms/classify', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/symptoms/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Python backend error:', response.status, errBody);
      return res.status(response.status).json({ error: 'Symptom classification failed', message: errBody });
    }

    res.json(await response.json());
  } catch (err) {
    console.error('Error proxying to Python backend:', err.message);
    res.status(502).json({ error: 'Python backend unavailable', message: err.message });
  }
});

/**
 * Health check
 */
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'healthy', database: 'connected', timestamp: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
  console.log(`🗄️  Database: ${process.env.DB_HOST}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received: closing HTTP server');
  pool.end(() => { console.log('Database pool closed'); process.exit(0); });
});