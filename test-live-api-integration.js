#!/usr/bin/env node

/**
 * Test Live API Integration for Multiple Cities
 * Verifies that the system is using data.gov.in API instead of fallback data
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test cases for different cities and pincodes
const testCases = [
  // Mumbai pincodes
  { city: 'Mumbai', pincode: '400001', condition: 'heart pain', expected: 'live_api' },
  { city: 'Mumbai', pincode: '400050', condition: 'fever', expected: 'live_api' },
  { city: 'Mumbai', pincode: '400076', condition: 'emergency', expected: 'live_api' },
  
  // Bangalore pincodes
  { city: 'Bangalore', pincode: '560001', condition: 'heart checkup', expected: 'live_api' },
  { city: 'Bangalore', pincode: '560034', condition: 'child fever', expected: 'live_api' },
  { city: 'Bangalore', pincode: '560066', condition: 'eye problem', expected: 'live_api' },
  
  // Hyderabad pincodes
  { city: 'Hyderabad', pincode: '500001', condition: 'chest pain', expected: 'live_api' },
  { city: 'Hyderabad', pincode: '500034', condition: 'pregnancy', expected: 'live_api' },
  
  // Chennai pincodes
  { city: 'Chennai', pincode: '600001', condition: 'skin rash', expected: 'live_api' },
  { city: 'Chennai', pincode: '600017', condition: 'accident', expected: 'live_api' },
  
  // Delhi pincodes
  { city: 'Delhi', pincode: '110001', condition: 'heart pain', expected: 'live_api' },
  { city: 'Delhi', pincode: '110017', condition: 'emergency', expected: 'live_api' }
];

// Known fallback hospital names to detect if fallback data is being used
const fallbackHospitalNames = [
  'AIIMS, New Delhi',
  'G.B. Pant Hospital (GIPMER)',
  'Ram Manohar Lohia Hospital',
  'Max Super Speciality Hospital, Saket',
  'Apollo Hospitals, Jubilee Hills',
  'Gandhi Hospital',
  'King Edward Memorial Hospital (KEM)',
  'Tata Memorial Hospital',
  'Lilavati Hospital',
  'Hinduja Hospital',
  'Manipal Hospital, HAL Airport Road',
  'Victoria Hospital',
  'Apollo Hospitals, Greams Road',
  'Government General Hospital'
];

async function testApiEndpoint(testCase) {
  try {
    const response = await axios.get(`${BASE_URL}/api/hospitals/recommend`, {
      params: {
        condition: testCase.condition,
        pincode: testCase.pincode
      },
      timeout: 10000
    });

    const data = response.data;
    
    if (!data.recommendations || data.recommendations.length === 0) {
      return {
        ...testCase,
        status: 'FAIL',
        error: 'No recommendations returned',
        hospitalCount: 0,
        usingLiveAPI: false
      };
    }

    // Check if any returned hospital names match fallback data
    const hospitalNames = data.recommendations.map(h => h.name);
    const usingFallback = hospitalNames.some(name => 
      fallbackHospitalNames.some(fallbackName => 
        name.includes(fallbackName) || fallbackName.includes(name)
      )
    );

    return {
      ...testCase,
      status: usingFallback ? 'FALLBACK' : 'SUCCESS',
      hospitalCount: data.recommendations.length,
      hospitalNames: hospitalNames.slice(0, 2), // First 2 hospital names
      usingLiveAPI: !usingFallback,
      totalFound: data.totalFound
    };

  } catch (error) {
    return {
      ...testCase,
      status: 'ERROR',
      error: error.message,
      hospitalCount: 0,
      usingLiveAPI: false
    };
  }
}

async function runTests() {
  console.log('🏥 Testing Live API Integration for Health-Hacker');
  console.log('=' .repeat(60));
  console.log();

  const results = [];
  
  for (const testCase of testCases) {
    process.stdout.write(`Testing ${testCase.city} (${testCase.pincode}) - ${testCase.condition}... `);
    
    const result = await testApiEndpoint(testCase);
    results.push(result);
    
    // Status indicator
    if (result.status === 'SUCCESS') {
      console.log('✅ LIVE API');
    } else if (result.status === 'FALLBACK') {
      console.log('⚠️  FALLBACK');
    } else {
      console.log('❌ ERROR');
    }
    
    // Show sample hospital names for successful API calls
    if (result.status === 'SUCCESS' && result.hospitalNames) {
      console.log(`   📍 Sample hospitals: ${result.hospitalNames.join(', ')}`);
    }
    
    if (result.error) {
      console.log(`   ❗ Error: ${result.error}`);
    }
    
    console.log();
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('=' .repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(60));
  
  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  const fallbackCount = results.filter(r => r.status === 'FALLBACK').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ Live API Success: ${successCount}/${testCases.length}`);
  console.log(`⚠️  Fallback Used: ${fallbackCount}/${testCases.length}`);
  console.log(`❌ Errors: ${errorCount}/${testCases.length}`);
  console.log();
  
  // City-wise breakdown
  const cityStats = {};
  results.forEach(result => {
    if (!cityStats[result.city]) {
      cityStats[result.city] = { success: 0, fallback: 0, error: 0, total: 0 };
    }
    cityStats[result.city].total++;
    if (result.status === 'SUCCESS') cityStats[result.city].success++;
    else if (result.status === 'FALLBACK') cityStats[result.city].fallback++;
    else cityStats[result.city].error++;
  });
  
  console.log('🏙️  CITY-WISE RESULTS:');
  Object.entries(cityStats).forEach(([city, stats]) => {
    const successRate = ((stats.success / stats.total) * 100).toFixed(1);
    console.log(`   ${city}: ${stats.success}/${stats.total} live API (${successRate}%)`);
  });
  
  console.log();
  
  if (successCount === testCases.length) {
    console.log('🎉 ALL TESTS PASSED - Live API integration working perfectly!');
  } else if (successCount > testCases.length * 0.8) {
    console.log('✅ MOSTLY SUCCESSFUL - Live API working for most cities');
  } else {
    console.log('⚠️  NEEDS ATTENTION - Some cities still using fallback data');
  }
  
  // Emergency test
  console.log();
  console.log('🚨 Testing Emergency Mode...');
  try {
    const emergencyResponse = await axios.get(`${BASE_URL}/api/hospitals/emergency`, {
      params: { pincode: '400001' },
      timeout: 5000
    });
    
    if (emergencyResponse.data.nearestHospitals && emergencyResponse.data.nearestHospitals.length > 0) {
      console.log('✅ Emergency mode working');
      console.log(`   Found ${emergencyResponse.data.nearestHospitals.length} emergency hospitals`);
    } else {
      console.log('⚠️  Emergency mode returned no results');
    }
  } catch (error) {
    console.log(`❌ Emergency mode error: ${error.message}`);
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testApiEndpoint };