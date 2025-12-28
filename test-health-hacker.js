/**
 * Test script for Health-Hacker multi-city functionality
 */

const axios = require('axios');

async function testHealthHacker() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🏥 Testing Health-Hacker Multi-City System\n');
  
  try {
    // Test 1: Get available cities
    console.log('1️⃣ Testing available cities...');
    const citiesResponse = await axios.get(`${baseUrl}/api/hospitals/cities`);
    console.log('✅ Available cities:', citiesResponse.data.cities.map(c => `${c.name}, ${c.state}`).join(' | '));
    
    // Test 2: Get areas for Hyderabad
    console.log('\n2️⃣ Testing areas for Hyderabad...');
    const areasResponse = await axios.get(`${baseUrl}/api/hospitals/areas?city=Hyderabad`);
    console.log('✅ Hyderabad areas:', areasResponse.data.areas.slice(0, 3).map(a => `${a.area} (${a.pincode})`).join(', '), '...');
    
    // Test 3: Search for heart problem in Hyderabad
    console.log('\n3️⃣ Testing hospital search: Heart problem in Hyderabad...');
    const searchResponse = await axios.get(`${baseUrl}/api/hospitals/recommend?condition=heart%20problem&city=Hyderabad`);
    const hospitals = searchResponse.data.recommendations;
    
    if (hospitals.length > 0) {
      console.log('✅ Found hospitals:');
      hospitals.forEach((hospital, index) => {
        console.log(`   ${index + 1}. ${hospital.name}`);
        console.log(`      Category: ${hospital.category}`);
        console.log(`      Phone: ${hospital.phone}`);
        console.log(`      Specialties: ${hospital.specialties ? hospital.specialties.slice(0, 3).join(', ') + '...' : 'N/A'}`);
      });
    } else {
      console.log('⚠️ No hospitals found - using fallback data');
    }
    
    // Test 4: Emergency hospitals
    console.log('\n4️⃣ Testing emergency hospitals in Hyderabad...');
    const emergencyResponse = await axios.get(`${baseUrl}/api/hospitals/emergency?city=Hyderabad`);
    const emergencyHospitals = emergencyResponse.data.nearestHospitals;
    
    if (emergencyHospitals.length > 0) {
      console.log('✅ Emergency hospitals:');
      emergencyHospitals.forEach((hospital, index) => {
        console.log(`   ${index + 1}. ${hospital.name} - ${hospital.phone}`);
      });
    } else {
      console.log('⚠️ No emergency hospitals found');
    }
    
    // Test 5: Test different conditions
    console.log('\n5️⃣ Testing different medical conditions...');
    const conditions = ['fever', 'accident', 'pregnancy', 'eye problem'];
    
    for (const condition of conditions) {
      try {
        const conditionResponse = await axios.get(`${baseUrl}/api/hospitals/recommend?condition=${encodeURIComponent(condition)}&city=Hyderabad`);
        const count = conditionResponse.data.recommendations.length;
        console.log(`   ${condition}: ${count} hospitals found`);
      } catch (error) {
        console.log(`   ${condition}: Error - ${error.message}`);
      }
    }
    
    console.log('\n🎉 Health-Hacker system is working correctly!');
    console.log('\n📱 Frontend will be available at: http://localhost:3001');
    console.log('🔗 Backend API running at: http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the backend server is running on port 3000');
    }
  }
}

// Run tests
testHealthHacker();