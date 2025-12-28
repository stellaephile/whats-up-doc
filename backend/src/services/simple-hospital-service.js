const fetch = require('node-fetch');

class SimpleHospitalService {
  constructor() {
    this.apiKey = process.env.DATA_GOV_IN_API_KEY;
    this.baseUrl = 'https://api.data.gov.in/resource/98fa254e-c5f8-4910-a19b-4828939b477d';
    
    this.availableCities = {
      'Mumbai': { state: 'Maharashtra', coordinates: { latitude: 19.0760, longitude: 72.8777 } },
      'Delhi': { state: 'Delhi', coordinates: { latitude: 28.6139, longitude: 77.2090 } },
      'Hyderabad': { state: 'Andhra Pradesh', coordinates: { latitude: 17.4274, longitude: 78.4311 } },
      'Bangalore': { state: 'Karnataka', coordinates: { latitude: 12.9716, longitude: 77.5946 } },
      'Chennai': { state: 'Tamil Nadu', coordinates: { latitude: 13.0827, longitude: 80.2707 } },
      'Lucknow': { state: 'Uttar Pradesh', coordinates: { latitude: 26.8467, longitude: 80.9462 } }
    };
  }

  getAvailableCities() {
    return Object.keys(this.availableCities).map(city => ({
      name: city,
      state: this.availableCities[city].state,
      coordinates: this.availableCities[city].coordinates
    }));
  }

  mapPincodeToCity(pincode) {
    if (pincode.startsWith('400') || pincode.startsWith('401') || pincode.startsWith('402') || pincode.startsWith('403') || pincode.startsWith('404')) return 'Mumbai';
    if (pincode.startsWith('110') || pincode.startsWith('111') || pincode.startsWith('112')) return 'Delhi';
    if (pincode.startsWith('500') || pincode.startsWith('501') || pincode.startsWith('502') || pincode.startsWith('503') || pincode.startsWith('504')) return 'Hyderabad';
    if (pincode.startsWith('560') || pincode.startsWith('561') || pincode.startsWith('562') || pincode.startsWith('563')) return 'Bangalore';
    if (pincode.startsWith('600') || pincode.startsWith('601') || pincode.startsWith('602') || pincode.startsWith('603') || pincode.startsWith('604')) return 'Chennai';
    if (pincode.startsWith('226') || pincode.startsWith('260') || pincode.startsWith('261')) return 'Lucknow';
    return null;
  }

  async findHospitalsByPincode(condition, pincode, location = null) {
    try {
      const city = this.mapPincodeToCity(pincode);
      
      if (!city) {
        return {
          hospitals: [],
          message: `Pincode ${pincode} is not currently supported. We support major cities like Mumbai (400xxx), Delhi (110xxx), Bangalore (560xxx), Hyderabad (500xxx), Chennai (600xxx), and Lucknow (226xxx, 260xxx, 261xxx).`
        };
      }

      // For now, return a simple response to test the API
      return {
        hospitals: [
          {
            id: 'test-1',
            name: `Test Hospital in ${city}`,
            address: `Test Address, ${city}`,
            phone: '1234567890',
            latitude: this.availableCities[city].coordinates.latitude,
            longitude: this.availableCities[city].coordinates.longitude,
            category: 'Government Hospital',
            isGovernment: true,
            emergencyServices: true
          }
        ],
        message: null
      };
      
    } catch (error) {
      console.error('Hospital search error:', error);
      return {
        hospitals: [],
        message: `Unable to fetch hospital data: ${error.message}. Please try again.`
      };
    }
  }

  async getEmergencyHospitalsByPincode(pincode, location = null) {
    try {
      const city = this.mapPincodeToCity(pincode);
      
      if (!city) {
        return {
          hospitals: [],
          message: `Emergency services not available for pincode ${pincode}. Call 102 for immediate ambulance service.`
        };
      }

      // For now, return a simple response to test the API
      return {
        hospitals: [
          {
            id: 'emergency-1',
            name: `Emergency Hospital in ${city}`,
            address: `Emergency Address, ${city}`,
            phone: '102',
            latitude: this.availableCities[city].coordinates.latitude,
            longitude: this.availableCities[city].coordinates.longitude,
            category: 'Government Hospital',
            isGovernment: true,
            emergencyServices: true
          }
        ],
        message: null
      };
      
    } catch (error) {
      console.error('Emergency hospital search error:', error);
      return {
        hospitals: [],
        message: `Emergency service error. Call 102 immediately for ambulance service.`
      };
    }
  }
}

module.exports = SimpleHospitalService;