const fetch = require('node-fetch');

class MCPHospitalService {
  constructor() {
    this.apiKey = process.env.DATA_GOV_IN_API_KEY;
    this.baseUrl = 'https://api.data.gov.in/resource/98fa254e-c5f8-4910-a19b-4828939b477d';
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000;
    
    this.availableCities = {
      'Mumbai': {
        state: 'Maharashtra',
        coordinates: { latitude: 19.0760, longitude: 72.8777 },
        districts: ['Mumbai', 'Mumbai Suburban', 'Thane']
      },
      'Delhi': {
        state: 'NCT of Delhi',
        coordinates: { latitude: 28.6139, longitude: 77.2090 },
        districts: ['New Delhi', 'Central Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi']
      },
      'Hyderabad': {
        state: 'Andhra Pradesh',
        coordinates: { latitude: 17.4274, longitude: 78.4311 },
        districts: ['Hyderabad', 'Rangareddy', 'Medchal']
      },
      'Bangalore': {
        state: 'Karnataka',
        coordinates: { latitude: 12.9716, longitude: 77.5946 },
        districts: ['Bangalore Urban', 'Bangalore Rural']
      },
      'Chennai': {
        state: 'Tamil Nadu',
        coordinates: { latitude: 13.0827, longitude: 80.2707 },
        districts: ['Chennai', 'Kanchipuram', 'Tiruvallur']
      },
      'Lucknow': {
        state: 'Uttar Pradesh',
        coordinates: { latitude: 26.8467, longitude: 80.9462 },
        districts: ['Lucknow']
      }
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

      const hospitals = await this.getHospitalsByCity(city);
      
      if (!hospitals || hospitals.length === 0) {
        console.log(`No hospitals found from API for ${city}`);
        
        // Provide city-specific guidance when no data is available
        let cityGuidance = '';
        if (city === 'Delhi') {
          cityGuidance = ' Delhi hospitals may not be fully covered in the current government database. Try searching for nearby areas like Gurgaon (122xxx) or Noida (201xxx), or contact Delhi Health Department at 011-23921401.';
        } else if (city === 'Mumbai') {
          cityGuidance = ' Try nearby areas like Thane (400601) or contact Mumbai Municipal Corporation Health Department.';
        } else if (city === 'Bangalore') {
          cityGuidance = ' Try nearby areas or contact Karnataka Health Department.';
        } else if (city === 'Chennai') {
          cityGuidance = ' Try nearby areas or contact Tamil Nadu Health Department.';
        } else if (city === 'Lucknow') {
          cityGuidance = ' Try nearby areas or contact Uttar Pradesh Health Department.';
        }
        
        return {
          hospitals: [],
          message: `No hospitals found in our live database for ${city}.${cityGuidance} For emergencies, call 102 for ambulance service or 108 for emergency medical response.`
        };
      }
      
      const pincodeArea = pincode.substring(0, 3);
      let pincodeFilteredHospitals = hospitals.filter(hospital => {
        if (!hospital.pincode) return false;
        const hospitalPincode = hospital.pincode.toString();
        return hospitalPincode === pincode || hospitalPincode.startsWith(pincodeArea);
      });
      
      if (pincodeFilteredHospitals.length === 0) {
        pincodeFilteredHospitals = hospitals.slice(0, 20);
      }
      
      return {
        hospitals: pincodeFilteredHospitals.slice(0, 10),
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

      const hospitals = await this.getHospitalsByCity(city);
      
      if (!hospitals || hospitals.length === 0) {
        return {
          hospitals: [],
          message: `No emergency hospitals found. Call 102 immediately for ambulance service.`
        };
      }

      let emergencyHospitals = hospitals.filter(hospital => 
        hospital.emergencyServices || 
        hospital.name.toLowerCase().includes('emergency') ||
        hospital.name.toLowerCase().includes('trauma')
      );

      if (emergencyHospitals.length === 0) {
        emergencyHospitals = hospitals.slice(0, 10);
      }

      return {
        hospitals: emergencyHospitals.slice(0, 5),
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

  async getHospitalsByCity(city) {
    try {
      const cityInfo = this.availableCities[city];
      const params = new URLSearchParams({
        'api-key': this.apiKey,
        format: 'json',
        limit: 1000,
        'filters[state]': cityInfo.state,
        '_t': Date.now()
      });

      const response = await fetch(`${this.baseUrl}?${params}`);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(`API returned ${data.records?.length || 0} records for ${city}`);
      
      let hospitals = this.processHospitalData(data.records || []);
      hospitals = hospitals.filter(hospital => this.isInCity(hospital, city));
      
      return hospitals;
      
    } catch (error) {
      console.error(`Error fetching hospitals for ${city}:`, error);
      return [];
    }
  }

  processHospitalData(records) {
    return records.map(record => ({
      id: record._sr_no || record.id,
      name: record.hospital_name || record.name || 'Unknown Hospital',
      address: record._address_original_first_line || record.address || '',
      district: record.district || '',
      state: record.state || '',
      pincode: record._pincode || record.pincode || '',
      town: record._town || record.town || '',
      phone: record.telephone || record.mobile_number || '',
      latitude: this.parseCoordinate(record._location_coordinates, 0),
      longitude: this.parseCoordinate(record._location_coordinates, 1),
      category: this.determineCategory(record),
      specialties: this.parseSpecialties(record.specialties || ''),
      emergencyServices: this.hasEmergencyServices(record),
      isGovernment: this.isGovernmentHospital(record),
      waitTimeCategory: this.estimateWaitTime(record)
    })).filter(hospital => 
      hospital.name && 
      hospital.name !== 'Unknown Hospital' && 
      hospital.address &&
      hospital.pincode
    );
  }

  parseCoordinate(locationString, index) {
    if (!locationString) return null;
    const coords = locationString.split(',').map(c => parseFloat(c.trim()));
    return coords[index] || null;
  }

  isInCity(hospital, city) {
    const cityInfo = this.availableCities[city];
    
    if (cityInfo.districts && cityInfo.districts.some(district => 
      hospital.district.toLowerCase().includes(district.toLowerCase())
    )) {
      return true;
    }
    
    if (hospital.pincode) {
      const pincode = hospital.pincode.toString();
      if (city === 'Mumbai' && pincode.startsWith('4')) return true;
      if (city === 'Delhi' && pincode.startsWith('11')) return true;
      if (city === 'Hyderabad' && pincode.startsWith('5')) return true;
      if (city === 'Bangalore' && pincode.startsWith('56')) return true;
      if (city === 'Chennai' && pincode.startsWith('6')) return true;
      if (city === 'Lucknow' && (pincode.startsWith('226') || pincode.startsWith('260') || pincode.startsWith('261'))) return true;
    }
    
    const cityLower = city.toLowerCase();
    const address = (hospital.address || '').toLowerCase();
    const name = (hospital.name || '').toLowerCase();
    const town = (hospital.town || '').toLowerCase();
    
    return address.includes(cityLower) || name.includes(cityLower) || town.includes(cityLower);
  }

  determineCategory(record) {
    const name = (record.hospital_name || '').toLowerCase();
    if (name.includes('government') || name.includes('govt') || name.includes('district')) {
      return 'Government';
    }
    return 'Private';
  }

  parseSpecialties(specialtiesString) {
    if (!specialtiesString || specialtiesString === '0') return [];
    return specialtiesString.split(',').map(s => s.trim()).filter(s => s);
  }

  hasEmergencyServices(record) {
    const emergency = record._emergency_services || record.emergency_num || '';
    return emergency !== '0' && emergency !== '';
  }

  isGovernmentHospital(record) {
    const name = (record.hospital_name || '').toLowerCase();
    const govKeywords = ['government', 'govt', 'district', 'general hospital', 'medical college'];
    return govKeywords.some(keyword => name.includes(keyword));
  }

  estimateWaitTime(record) {
    if (this.isGovernmentHospital(record)) {
      return 'high';
    }
    return 'medium';
  }
}

module.exports = MCPHospitalService;