/**
 * Test script for data.gov.in API integration
 * Run this to verify your API key works correctly
 */

require('dotenv').config();
const fetch = require('node-fetch');

async function testDataGovInAPI() {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  
  if (!apiKey) {
    console.error('❌ DATA_GOV_IN_API_KEY not found in .env file');
    console.log('Please add your API key to backend/.env file:');
    console.log('DATA_GOV_IN_API_KEY=your_actual_api_key_here');
    return;
  }

  console.log('🔍 Testing data.gov.in API connection...');
  console.log('API Key:', apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4));

  try {
    // Test basic API connectivity
    const testUrl = `https://api.data.gov.in/resource/98fa254e-c5f8-4910-a19b-4828939b477d?api-key=${apiKey}&format=json&limit=5&filters[state]=Delhi`;
    
    console.log('📡 Making test request...');
    const response = await fetch(testUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('✅ API Connection Successful!');
    console.log('📊 Response Summary:');
    console.log(`- Total records available: ${data.total || 'Unknown'}`);
    console.log(`- Records in this response: ${data.records ? data.records.length : 0}`);
    
    if (data.records && data.records.length > 0) {
      console.log('\n🏥 Sample Hospital Data:');
      const sample = data.records[0];
      
      // Display available fields
      console.log('Available fields in API response:');
      Object.keys(sample).forEach(key => {
        console.log(`  - ${key}: ${sample[key] ? 'Has data' : 'Empty'}`);
      });
      
      console.log('\n📋 First Hospital Example:');
      console.log(`Name: ${sample.hospital_name || sample.name || 'N/A'}`);
      console.log(`Address: ${sample.address || 'N/A'}`);
      console.log(`District: ${sample.district || 'N/A'}`);
      console.log(`Category: ${sample.category || 'N/A'}`);
      console.log(`Specialization: ${sample.specialization || 'N/A'}`);
      console.log(`Phone: ${sample.contact_no || sample.phone || 'N/A'}`);
      console.log(`Coordinates: ${sample.latitude || 'N/A'}, ${sample.longitude || 'N/A'}`);
    }

    // Test Delhi Health-Hacker specific queries
    console.log('\n🎯 Testing Delhi Health-Hacker Scenarios:');
    
    // Test cardiac hospitals
    await testSpecificQuery('Cardiology', 'cardiac emergencies');
    
    // Test emergency hospitals
    await testSpecificQuery('Emergency', 'emergency cases');
    
  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
    
    if (error.message.includes('401')) {
      console.log('🔑 This looks like an authentication error. Please check:');
      console.log('1. Your API key is correct');
      console.log('2. Your API key is active and not expired');
      console.log('3. You have permission to access this resource');
    } else if (error.message.includes('403')) {
      console.log('🚫 Access forbidden. Please check:');
      console.log('1. Your API key has permission for this resource');
      console.log('2. You haven\'t exceeded rate limits');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('🌐 Network error. Please check your internet connection');
    }
  }
}

async function testSpecificQuery(specialty, description) {
  try {
    const apiKey = process.env.DATA_GOV_IN_API_KEY;
    const url = `https://api.data.gov.in/resource/98fa254e-c5f8-4910-a19b-4828939b477d?api-key=${apiKey}&format=json&limit=3&filters[state]=Delhi&filters[specialization]=${specialty}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`  ${specialty} hospitals for ${description}: ${data.records ? data.records.length : 0} found`);
    
    if (data.records && data.records.length > 0) {
      data.records.forEach((hospital, index) => {
        console.log(`    ${index + 1}. ${hospital.hospital_name || hospital.name || 'Unknown'}`);
      });
    }
  } catch (error) {
    console.log(`  ${specialty} query failed: ${error.message}`);
  }
}

// Run the test
if (require.main === module) {
  testDataGovInAPI();
}

module.exports = { testDataGovInAPI };