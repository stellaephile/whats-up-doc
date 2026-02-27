require('dotenv').config();

console.log('DB_HOST:', process.env.DB_HOST);  // should print your RDS endpoint
console.log('DB_NAME:', process.env.DB_NAME);  // should print postgres
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

// Severity configuration mapping to database columns
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

// Progressive radius expansion
const RADIUS_STEPS = [3, 5, 10, 20];

/**
 * GET /api/hospitals/stats
 * Returns database statistics for dashboard
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
        COUNT(*) FILTER (WHERE data_quality_norm >= 0.3)      AS quality_passed
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
 * Basic hospital search with PostGIS nearest query
 * Query params: lat, lng, radius (km), emergency (boolean), specialty
 */
app.get('/api/hospitals', async (req, res) => {
  try {
    const { lat, lng, radius = 10, emergency, specialty } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }
    
    // Convert radius from km to meters for ST_DWithin
    const radiusMetres = parseFloat(radius) * 1000;
    
    let query = `
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
      FROM map_hospitals
      WHERE ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3)
    `;
    
    const params = [parseFloat(lat), parseFloat(lng), radiusMetres];
    let paramIndex = 4;
    
    // Filter by emergency availability
    if (emergency === 'true') {
      query += ` AND emergency_available = TRUE`;
    }
    
    // Filter by specialty
    if (specialty) {
      query += ` AND specialties_array @> ARRAY[$${paramIndex}]`;
      params.push(specialty);
      paramIndex++;
    }
    
    // Order by distance and limit results
    query += ` ORDER BY location <-> ST_MakePoint($2, $1)::geography LIMIT 50`;
    
    const result = await pool.query(query, params);
    
    res.json({
      hospitals: result.rows,
      count: result.rows.length,
      radius: parseFloat(radius)
    });
  } catch (err) {
    console.error('Error fetching hospitals:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

/**
 * POST /api/hospitals/severity-based
 * Severity-based routing with progressive radius expansion
 * Body: { pincode, latitude, longitude, severity, severityLevel, specialties }
 */
app.post('/api/hospitals/severity-based', async (req, res) => {
  console.log('📍 Severity-based search request:', {
    pincode: req.body.pincode,
    lat: req.body.latitude,
    lng: req.body.longitude,
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
    
    // Progressive search with radius expansion
    const searchResult = await queryWithExpansion(
      parseFloat(latitude),
      parseFloat(longitude),
      config,
      specialties ? specialties[0] : null
    );
    
    console.log(`✅ Found ${searchResult.hospitals.length} hospitals within ${searchResult.radiusUsed}km`);
    
    res.json({
      facilities: searchResult.hospitals,
      radiusUsed: searchResult.radiusUsed,
      wasExpanded: searchResult.radiusUsed > config.initialRadius,
      severityLevel: severityLevel,
      config: {
        level: config.level,
        initialRadius: config.initialRadius
      }
    });
  } catch (err) {
    console.error('❌ Error in severity-based search:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

/**
 * Helper function: Progressive search with radius expansion
 */
async function queryWithExpansion(lat, lng, config, specialty) {
  // Get unique radius steps starting from initial radius
  const radii = RADIUS_STEPS.filter(r => r >= config.initialRadius);
  const uniqueRadii = [...new Set(radii)];
  
  for (const radius of uniqueRadii) {
    const radiusMetres = radius * 1000;
    let query, params;
    
    if (config.emergencyOnly) {
      // Emergency-only query
      query = `
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
          AND emergency_available = TRUE
          AND location IS NOT NULL
          AND data_quality_norm >= 0.3
        ${specialty ? 'AND specialties_array @> ARRAY[$4]' : ''}
        ORDER BY location <-> ST_MakePoint($2, $1)::geography
        LIMIT 20
      `;
      params = [lat, lng, radiusMetres];
      if (specialty) params.push(specialty);
    } else {
      // Regular query - include hospitals with NULL care_type OR matching care_type
      // This handles the data quality issue where most hospitals have NULL care_type
      query = `
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
          AND data_quality_norm >= 0.3
          AND (hospital_care_type = ANY($4) OR hospital_care_type IS NULL)
        ${specialty ? 'AND specialties_array @> ARRAY[$5]' : ''}
        ORDER BY location <-> ST_MakePoint($2, $1)::geography
        LIMIT 20
      `;
      params = [lat, lng, radiusMetres, config.careTypes];
      if (specialty) params.push(specialty);
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length > 0) {
      return {
        hospitals: result.rows,
        radiusUsed: radius
      };
    }
  }
  
  // No hospitals found even at 20km
  return {
    hospitals: [],
    radiusUsed: 20
  };
}

/**
 * GET /api/hospitals/search
 * Fuzzy name search for hospitals
 * Query params: q (search query), state (optional)
 */
app.get('/api/hospitals/search', async (req, res) => {
  try {
    const { q, state } = req.query;
    
    if (!q) {
      return res.json({ hospitals: [] });
    }
    
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
    
    res.json({
      hospitals: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Error searching hospitals:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

/**
 * GET /api/pincode/:pincode
 * Get approximate coordinates for a pincode
 * This queries hospitals in that pincode and returns centroid
 */
app.get('/api/pincode/:pincode', async (req, res) => {
  const { pincode } = req.params;
  console.log(`📍 Pincode lookup request: ${pincode}`);
  
  try {
    const result = await pool.query(`
      SELECT
        pincode,
        state,
        district,
        AVG(ST_Y(location::geometry)) AS latitude,
        AVG(ST_X(location::geometry)) AS longitude,
        COUNT(*) AS hospital_count
      FROM hospitals
      WHERE pincode = $1
        AND location IS NOT NULL
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
    
    console.log(`✅ Pincode ${pincode} found: ${result.rows[0].state}, ${result.rows[0].district}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error fetching pincode:', err.message);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: result.rows[0].now
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
  console.log(`🗄️  Database: ${process.env.DB_HOST}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});
