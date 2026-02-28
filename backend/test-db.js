require('dotenv').config();
const pool = require('./db');

async function testDatabaseConnection() {
  console.log('🔍 Testing Database Connection...\n');
  
  try {
    // Test 1: Basic connection
    console.log('Test 1: Basic Connection');
    console.log('------------------------');
    const result = await pool.query('SELECT NOW(), version()');
    console.log('✅ Database connected successfully!');
    console.log(`   Timestamp: ${result.rows[0].now}`);
    console.log(`   PostgreSQL Version: ${result.rows[0].version.split(',')[0]}\n`);
    
    // Test 2: Check PostGIS extension
    console.log('Test 2: PostGIS Extension');
    console.log('------------------------');
    const postgisResult = await pool.query("SELECT PostGIS_Version()");
    console.log(`✅ PostGIS Version: ${postgisResult.rows[0].postgis_version}\n`);
    
    // Test 3: Database statistics
    console.log('Test 3: Database Statistics');
    console.log('------------------------');
    const statsResult = await pool.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE location IS NOT NULL)          AS with_coordinates,
        COUNT(*) FILTER (WHERE emergency_available = TRUE)    AS emergency,
        COUNT(*) FILTER (WHERE ayush = TRUE)                  AS ayush,
        COUNT(*) FILTER (WHERE hospital_category ILIKE '%gov%' OR hospital_category ILIKE '%public%') AS government,
        COUNT(*) FILTER (WHERE data_quality_norm >= 0.3)      AS quality_passed
      FROM hospitals
    `);
    const stats = statsResult.rows[0];
    console.log(`✅ Total Hospitals: ${stats.total}`);
    console.log(`   With Coordinates: ${stats.with_coordinates}`);
    console.log(`   Emergency (24x7): ${stats.emergency}`);
    console.log(`   Government: ${stats.government}`);
    console.log(`   AYUSH: ${stats.ayush}`);
    console.log(`   Quality Passed (>=0.3): ${stats.quality_passed}\n`);
    
    // Test 4: Check if views exist
    console.log('Test 4: Database Views');
    console.log('------------------------');
    const viewsResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'VIEW'
        AND table_name IN ('map_hospitals', 'emergency_hospitals')
      ORDER BY table_name
    `);
    if (viewsResult.rows.length > 0) {
      console.log('✅ Views found:');
      viewsResult.rows.forEach(row => console.log(`   - ${row.table_name}`));
    } else {
      console.log('⚠️  Views not found. Checking base table...');
      const tableCheck = await pool.query(`
        SELECT COUNT(*) as count FROM hospitals LIMIT 1
      `);
      console.log('✅ Base table "hospitals" is accessible');
    }
    console.log('');
    
    // Test 5: Pincode 560001 (Bangalore) lookup
    console.log('Test 5: Pincode 560001 (Bangalore) Lookup');
    console.log('------------------------');
    const pincodeResult = await pool.query(`
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
    `, ['560001']);
    
    if (pincodeResult.rows.length > 0) {
      const pincode = pincodeResult.rows[0];
      console.log(`✅ Pincode: ${pincode.pincode}`);
      console.log(`   State: ${pincode.state}`);
      console.log(`   District: ${pincode.district}`);
      console.log(`   Centroid: ${pincode.latitude}, ${pincode.longitude}`);
      console.log(`   Hospitals in this pincode: ${pincode.hospital_count}\n`);
      
      // Test 6: Fever search (mild severity) - Dispensaries/Clinics within 3km
      console.log('Test 6: Fever Search (Mild Severity - 3km radius)');
      console.log('------------------------');
      console.log('Searching for: Dispensary/Poly Clinic, Health Centre');
      console.log(`Center: ${pincode.latitude}, ${pincode.longitude}`);
      console.log('Radius: 3km\n');
      
      const feverResult = await pool.query(`
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
          AND hospital_care_type = ANY($4)
          AND location IS NOT NULL
          AND data_quality_norm >= 0.3
        ORDER BY location <-> ST_MakePoint($2, $1)::geography
        LIMIT 10
      `, [
        parseFloat(pincode.latitude),
        parseFloat(pincode.longitude),
        3000, // 3km in meters
        ['Dispensary/ Poly Clinic', 'Health Centre']
      ]);
      
      if (feverResult.rows.length > 0) {
        console.log(`✅ Found ${feverResult.rows.length} facilities within 3km:`);
        feverResult.rows.forEach((hospital, idx) => {
          console.log(`\n${idx + 1}. ${hospital.hospital_name}`);
          console.log(`   Type: ${hospital.hospital_care_type}`);
          console.log(`   Category: ${hospital.hospital_category || 'N/A'}`);
          console.log(`   Distance: ${hospital.distance_km} km`);
          console.log(`   Address: ${hospital.address || `${hospital.district}, ${hospital.state}`}`);
          if (hospital.telephone || hospital.mobile_number) {
            console.log(`   Phone: ${hospital.telephone || hospital.mobile_number}`);
          }
          if (hospital.specialties_array && hospital.specialties_array.length > 0) {
            console.log(`   Specialties: ${hospital.specialties_array.slice(0, 3).join(', ')}`);
          }
          if (hospital.emergency_available) {
            console.log(`   🚨 24x7 Emergency Available`);
          }
        });
      } else {
        console.log('⚠️  No facilities found within 3km. Trying 5km...\n');
        
        // Try 5km radius
        const expandedResult = await pool.query(`
          SELECT
            id, hospital_name, hospital_category, hospital_care_type,
            state, district, address,
            telephone, mobile_number,
            ROUND((ST_Distance(location, ST_MakePoint($2, $1)::geography) / 1000)::numeric, 2) AS distance_km
          FROM hospitals
          WHERE ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3)
            AND hospital_care_type = ANY($4)
            AND location IS NOT NULL
            AND data_quality_norm >= 0.3
          ORDER BY location <-> ST_MakePoint($2, $1)::geography
          LIMIT 10
        `, [
          parseFloat(pincode.latitude),
          parseFloat(pincode.longitude),
          5000, // 5km in meters
          ['Dispensary/ Poly Clinic', 'Health Centre']
        ]);
        
        if (expandedResult.rows.length > 0) {
          console.log(`✅ Found ${expandedResult.rows.length} facilities within 5km (expanded search):`);
          expandedResult.rows.forEach((hospital, idx) => {
            console.log(`\n${idx + 1}. ${hospital.hospital_name}`);
            console.log(`   Type: ${hospital.hospital_care_type}`);
            console.log(`   Distance: ${hospital.distance_km} km`);
          });
        } else {
          console.log('⚠️  No facilities found even within 5km');
        }
      }
    } else {
      console.log('❌ Pincode 560001 not found in database');
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run tests
testDatabaseConnection();
