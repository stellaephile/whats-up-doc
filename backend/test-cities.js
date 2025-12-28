/**
 * Test for major Indian cities in the data.gov.in API
 */

require('dotenv').config();
const fetch = require('node-fetch');

async function testCities() {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  
  console.log('🔍 Testing for major Indian cities...');
  
  const citiesToTest = [
    'Bengaluru', 'Bangalore', 'Karnataka',
    'Hyderabad', 'Telangana',
    'Mumbai', 'Maharashtra', 
    'Chennai', 'Tamil Nadu',
    'Kolkata', 'West Bengal',
    'Pune', 'Ahmedabad', 'Gujarat',
    'Jaipur', 'Rajasthan',
    'Delhi', 'NCT of Delhi', 'New Delhi'
  ];
  
  try {
    // Get a larger sample to analyze
    console.log('📡 Fetching larger sample...');
    const url = `https://api.data.gov.in/resource/98fa254e-c5f8-4910-a19b-4828939b477d?api-key=${apiKey}&format=json&limit=1000`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`📊 Total records in API: ${data.total}`);
    console.log(`📋 Records fetched: ${data.records ? data.records.length : 0}`);
    
    if (data.records) {
      // Get all unique states and districts
      const states = [...new Set(data.records.map(r => r.state).filter(Boolean))];
      const districts = [...new Set(data.records.map(r => r.district).filter(Boolean))];
      
      console.log('\n🗺️ Available states in sample:');
      states.forEach(state => console.log(`  - ${state}`));
      
      console.log('\n🏙️ Available districts in sample:');
      districts.slice(0, 20).forEach(district => console.log(`  - ${district}`));
      if (districts.length > 20) {
        console.log(`  ... and ${districts.length - 20} more districts`);
      }
      
      // Test each city
      console.log('\n🔍 Testing for specific cities:');
      
      for (const city of citiesToTest) {
        const cityRecords = data.records.filter(record => {
          const state = (record.state || '').toLowerCase();
          const district = (record.district || '').toLowerCase();
          const name = (record.hospital_name || '').toLowerCase();
          const address = (record._address_original_first_line || '').toLowerCase();
          
          const searchTerm = city.toLowerCase();
          
          return state.includes(searchTerm) || 
                 district.includes(searchTerm) || 
                 name.includes(searchTerm) ||
                 address.includes(searchTerm);
        });
        
        console.log(`  ${city}: ${cityRecords.length} hospitals found`);
        
        if (cityRecords.length > 0) {
          console.log(`    Sample: ${cityRecords[0].hospital_name} - ${cityRecords[0].state}`);
        }
      }
      
      // Show some sample hospitals with their locations
      console.log('\n🏥 Sample hospitals from different states:');
      const sampleByState = {};
      
      data.records.forEach(record => {
        const state = record.state;
        if (state && !sampleByState[state]) {
          sampleByState[state] = record;
        }
      });
      
      Object.entries(sampleByState).slice(0, 10).forEach(([state, hospital]) => {
        console.log(`  ${state}: ${hospital.hospital_name}`);
        if (hospital._location_coordinates) {
          console.log(`    Coordinates: ${hospital._location_coordinates}`);
        }
      });
      
      // Check if we have any major metro cities
      const metroStates = ['Karnataka', 'Telangana', 'Maharashtra', 'Tamil Nadu', 'West Bengal'];
      const foundMetros = states.filter(state => 
        metroStates.some(metro => state.toLowerCase().includes(metro.toLowerCase()))
      );
      
      console.log('\n🌆 Metro states found:', foundMetros);
      
    }
    
  } catch (error) {
    console.error('❌ City test failed:', error.message);
  }
}

testCities();