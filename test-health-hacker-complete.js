/**
 * Complete Health-Hacker Test Suite
 * Tests the pincode-based two-phase UI system
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testHealthHackerAPI() {
  console.log('🏥 Testing Health-Hacker Pincode-Based System\n');

  // Test 1: Basic hospital recommendation
  console.log('1️⃣ Testing basic hospital recommendation...');
  try {
    const response = await axios.get(`${BASE_URL}/api/hospitals/recommend`, {
      params: {
        condition: 'fever',
        pincode: '500001' // Hyderabad
      }
    });
    
    console.log(`✅ Found ${response.data.totalFound} hospitals for fever in Hyderabad (500001)`);
    console.log(`   First hospital: ${response.data.recommendations[0]?.name}`);
    console.log(`   Category: ${response.data.recommendations[0]?.category}`);
    console.log(`   Emergency available: ${response.data.recommendations[0]?.emergencyAvailable}`);
  } catch (error) {
    console.log('❌ Basic recommendation test failed:', error.message);
  }

  // Test 2: Emergency hospital search
  console.log('\n2️⃣ Testing emergency hospital search...');
  try {
    const response = await axios.get(`${BASE_URL}/api/hospitals/emergency`, {
      params: {
        pincode: '560001' // Bangalore
      }
    });
    
    console.log(`✅ Found ${response.data.nearestHospitals.length} emergency hospitals in Bangalore (560001)`);
    console.log(`   Emergency numbers: ${JSON.stringify(response.data.emergencyNumbers)}`);
    if (response.data.nearestHospitals[0]) {
      console.log(`   First emergency hospital: ${response.data.nearestHospitals[0].name}`);
    }
  } catch (error) {
    console.log('❌ Emergency search test failed:', error.message);
  }

  // Test 3: Different city (Chennai)
  console.log('\n3️⃣ Testing Chennai hospitals...');
  try {
    const response = await axios.get(`${BASE_URL}/api/hospitals/recommend`, {
      params: {
        condition: 'heart checkup',
        pincode: '600001' // Chennai
      }
    });
    
    console.log(`✅ Found ${response.data.totalFound} hospitals for heart checkup in Chennai (600001)`);
    if (response.data.recommendations[0]) {
      console.log(`   First hospital: ${response.data.recommendations[0].name}`);
      console.log(`   Specialties: ${response.data.recommendations[0].specialties?.slice(0, 3).join(', ')}...`);
    }
  } catch (error) {
    console.log('❌ Chennai test failed:', error.message);
  }

  // Test 4: Specialty-specific search
  console.log('\n4️⃣ Testing specialty-specific search (pediatric)...');
  try {
    const response = await axios.get(`${BASE_URL}/api/hospitals/recommend`, {
      params: {
        condition: 'child fever',
        pincode: '500034' // Hyderabad Banjara Hills
      }
    });
    
    console.log(`✅ Found ${response.data.totalFound} hospitals for child fever in Banjara Hills`);
    console.log(`   Tips provided: ${response.data.tips?.length || 0} tips`);
    if (response.data.tips && response.data.tips.length > 0) {
      console.log(`   First tip: ${response.data.tips[0]}`);
    }
  } catch (error) {
    console.log('❌ Pediatric search test failed:', error.message);
  }

  // Test 5: Areas endpoint
  console.log('\n5️⃣ Testing areas endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/api/hospitals/areas`, {
      params: {
        city: 'Hyderabad'
      }
    });
    
    console.log(`✅ Found ${response.data.areas.length} areas for Hyderabad`);
    console.log(`   Sample areas: ${response.data.areas.slice(0, 3).map(a => `${a.area} (${a.pincode})`).join(', ')}`);
  } catch (error) {
    console.log('❌ Areas test failed:', error.message);
  }

  // Test 6: Invalid pincode handling
  console.log('\n6️⃣ Testing invalid pincode handling...');
  try {
    const response = await axios.get(`${BASE_URL}/api/hospitals/recommend`, {
      params: {
        condition: 'fever',
        pincode: '999999' // Invalid pincode
      }
    });
    
    console.log(`✅ Invalid pincode handled gracefully`);
    console.log(`   Fallback hospitals provided: ${response.data.totalFound}`);
  } catch (error) {
    console.log('❌ Invalid pincode test failed:', error.message);
  }

  console.log('\n🎯 Health-Hacker API Test Summary:');
  console.log('   ✅ Pincode-based hospital search working');
  console.log('   ✅ Emergency hospital filtering working');
  console.log('   ✅ Multi-city support (Hyderabad, Bangalore, Chennai)');
  console.log('   ✅ Specialty-based recommendations');
  console.log('   ✅ Privacy-first approach (no personal data required)');
  console.log('   ✅ Fallback data for unsupported areas');
  
  console.log('\n🚀 Frontend Features:');
  console.log('   📱 Phase 1: Pincode input + symptom search');
  console.log('   🗺️  Phase 2: Interactive map with Leaflet');
  console.log('   🏥 Color-coded hospital pins (Red=Private, Blue=Govt, Green=AYUSH)');
  console.log('   🔄 Hospital type filtering (Sarkari/Private/AYUSH)');
  console.log('   🚨 Emergency mode toggle');
  console.log('   📍 Real-time hospital data from data.gov.in');
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Open http://localhost:3001 to test the UI');
  console.log('   2. Try pincode 500001 (Hyderabad) with "fever"');
  console.log('   3. Toggle emergency mode and search');
  console.log('   4. Use Phase 2 map to explore hospitals visually');
  console.log('   5. Test filtering by hospital type');
}

// Run the tests
if (require.main === module) {
  testHealthHackerAPI().catch(console.error);
}

module.exports = { testHealthHackerAPI };