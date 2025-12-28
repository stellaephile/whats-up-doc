/**
 * Multi-City Hospital Data Service - Integrates with data.gov.in National Hospital Directory
 * Provides hospital data for multiple Indian cities
 */

const fetch = require('node-fetch');

class MultiCityHospitalService {
  constructor() {
    this.apiKey = process.env.DATA_GOV_IN_API_KEY;
    this.baseUrl = 'https://api.data.gov.in/resource/98fa254e-c5f8-4910-a19b-4828939b477d';
    this.cache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    
    // Available cities based on our API testing
    this.availableCities = {
      'Mumbai': {
        state: 'Maharashtra',
        coordinates: { latitude: 19.0760, longitude: 72.8777 },
        districts: ['Mumbai', 'Mumbai Suburban', 'Thane']
      },
      'Delhi': {
        state: 'Delhi',
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

  /**
   * Get list of available cities
   */
  getAvailableCities() {
    return Object.keys(this.availableCities).map(city => ({
      name: city,
      state: this.availableCities[city].state,
      coordinates: this.availableCities[city].coordinates
    }));
  }

  /**
   * Get hospitals for a specific city from API
   */
  async getHospitalsByCity(city) {
    const cacheKey = `hospitals_${city}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    try {
      const cityInfo = this.availableCities[city];
      const params = new URLSearchParams({
        'api-key': this.apiKey,
        format: 'json',
        limit: 1000,
        'filters[state]': cityInfo.state
      });

      const response = await fetch(`${this.baseUrl}?${params}`);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(`API returned ${data.records?.length || 0} records for ${city}`);
      
      let hospitals = this.processHospitalData(data.records || []);
      console.log(`Processed ${hospitals.length} hospitals for ${city}`);
      
      // Filter for the specific city with better logic
      hospitals = hospitals.filter(hospital => 
        this.isInCity(hospital, city)
      );
      
      console.log(`Filtered to ${hospitals.length} hospitals in ${city}`);
      
      // Cache results
      this.cache.set(cacheKey, {
        data: hospitals,
        timestamp: Date.now()
      });

      return hospitals;
      
    } catch (error) {
      console.error(`Error fetching hospitals for ${city}:`, error);
      return [];
    }
  }

  /**
   * Process raw hospital data from API
   */
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

  /**
   * Parse coordinates from location string
   */
  parseCoordinate(locationString, index) {
    if (!locationString) return null;
    const coords = locationString.split(',').map(c => parseFloat(c.trim()));
    return coords[index] || null;
  }

  /**
   * Determine if hospital is in the specified city
   */
  isInCity(hospital, city) {
    const cityInfo = this.availableCities[city];
    
    // Check by district first (most reliable)
    if (cityInfo.districts && cityInfo.districts.some(district => 
      hospital.district.toLowerCase().includes(district.toLowerCase())
    )) {
      return true;
    }
    
    // Check by pincode pattern for better accuracy
    if (hospital.pincode) {
      const pincode = hospital.pincode.toString();
      if (city === 'Mumbai' && pincode.startsWith('4')) return true;
      if (city === 'Delhi' && pincode.startsWith('11')) return true;
      if (city === 'Hyderabad' && pincode.startsWith('5')) return true;
      if (city === 'Bangalore' && pincode.startsWith('56')) return true;
      if (city === 'Chennai' && pincode.startsWith('6')) return true;
      if (city === 'Lucknow' && pincode.startsWith('226')) return true;
    }
    
    // Check by city name in address or hospital name
    const cityLower = city.toLowerCase();
    const address = (hospital.address || '').toLowerCase();
    const name = (hospital.name || '').toLowerCase();
    const town = (hospital.town || '').toLowerCase();
    
    return address.includes(cityLower) || name.includes(cityLower) || town.includes(cityLower);
  }

  /**
   * Filter hospitals by medical condition
   */
  filterByCondition(hospitals, condition) {
    const conditionLower = condition.toLowerCase();
    
    // Specialty mapping
    const specialtyKeywords = {
      'heart': ['cardiology', 'cardiac'],
      'chest pain': ['cardiology', 'cardiac', 'emergency'],
      'accident': ['emergency', 'trauma'],
      'emergency': ['emergency', 'trauma'],
      'pregnancy': ['obstetrics', 'gynaecology', 'maternity'],
      'child': ['pediatrics', 'paediatrics'],
      'eye': ['ophthalmology'],
      'bone': ['orthopedics', 'orthopaedics'],
      'skin': ['dermatology'],
      'mental': ['psychiatry', 'psychology']
    };
    
    // Find relevant keywords
    let relevantKeywords = [];
    for (const [condition_key, keywords] of Object.entries(specialtyKeywords)) {
      if (conditionLower.includes(condition_key)) {
        relevantKeywords = [...relevantKeywords, ...keywords];
      }
    }
    
    if (relevantKeywords.length === 0) {
      return hospitals; // Return all if no specific specialty
    }
    
    // Score hospitals based on specialty match
    return hospitals.map(hospital => ({
      ...hospital,
      specialtyScore: this.calculateSpecialtyScore(hospital, relevantKeywords)
    })).sort((a, b) => b.specialtyScore - a.specialtyScore);
  }

  /**
   * Calculate specialty match score
   */
  calculateSpecialtyScore(hospital, keywords) {
    let score = 0;
    const hospitalText = `${hospital.name} ${hospital.specialties}`.toLowerCase();
    
    keywords.forEach(keyword => {
      if (hospitalText.includes(keyword)) {
        score += 10;
      }
    });
    
    // Bonus for emergency services
    if (hospital.emergencyServices) score += 5;
    
    // Bonus for government hospitals (usually more comprehensive)
    if (hospital.isGovernment) score += 3;
    
    return score;
  }

  /**
   * Sort hospitals by distance
   */
  sortByDistance(hospitals, userLocation) {
    return hospitals.map(hospital => {
      const distance = this.calculateDistance(userLocation, {
        latitude: hospital.latitude,
        longitude: hospital.longitude
      });
      return { ...hospital, distance };
    }).sort((a, b) => a.distance - b.distance);
  }

  /**
   * Calculate distance using Haversine formula
   */
  calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Find hospitals by pincode and condition
   */
  async findHospitalsByPincode(condition, pincode, location = null) {
    try {
      // Map pincode to city
      const city = this.mapPincodeToCity(pincode);
      
      if (!city) {
        console.log(`No city mapping found for pincode: ${pincode}`);
        return [];
      }

      console.log(`Searching for hospitals in ${city} for pincode ${pincode}`);
      const hospitals = await this.getHospitalsByCity(city);
      
      if (!hospitals || hospitals.length === 0) {
        console.log(`No hospitals found from API for ${city}`);
        return [];
      }
      
      // Filter by pincode area (first 3 digits for broader matching)
      const pincodeArea = pincode.substring(0, 3);
      let pincodeFilteredHospitals = hospitals.filter(hospital => {
        if (!hospital.pincode) return false;
        const hospitalPincode = hospital.pincode.toString();
        // Match exact pincode or same area (first 3 digits)
        return hospitalPincode === pincode || hospitalPincode.startsWith(pincodeArea);
      });
      
      console.log(`Found ${pincodeFilteredHospitals.length} hospitals in pincode area ${pincodeArea}`);
      
      // If no hospitals in exact pincode area, use city-wide results
      if (pincodeFilteredHospitals.length === 0) {
        console.log(`No hospitals in pincode area, using city-wide results`);
        pincodeFilteredHospitals = hospitals;
      }
      
      // Apply condition-based filtering
      let filteredHospitals = this.filterByCondition(pincodeFilteredHospitals, condition);
      
      if (filteredHospitals.length === 0) {
        console.log(`No hospitals match condition: ${condition}`);
        return [];
      }
      
      // Sort by proximity if location provided
      if (location && location.latitude && location.longitude) {
        filteredHospitals = this.sortByDistance(filteredHospitals, location);
      } else {
        // Use city center as default location
        const cityInfo = this.availableCities[city];
        if (cityInfo) {
          filteredHospitals = this.sortByDistance(filteredHospitals, cityInfo.coordinates);
        }
      }
      
      return filteredHospitals.slice(0, 5);
      
    } catch (error) {
      console.error('Hospital search error:', error);
      return [];
    }
  }

  /**
   * Get emergency hospitals by pincode
   */
  async getEmergencyHospitalsByPincode(pincode, location = null) {
    try {
      const city = this.mapPincodeToCity(pincode);
      
      if (!city) {
        return [];
      }

      const hospitals = await this.getHospitalsByCity(city);
      let emergencyHospitals = hospitals.filter(h => h.emergencyServices);
      
      if (location && location.latitude && location.longitude) {
        emergencyHospitals = this.sortByDistance(emergencyHospitals, location);
      } else {
        const cityInfo = this.availableCities[city];
        if (cityInfo) {
          emergencyHospitals = this.sortByDistance(emergencyHospitals, cityInfo.coordinates);
        }
      }
      
      return emergencyHospitals.slice(0, 3);
      
    } catch (error) {
      console.error('Emergency hospital search error:', error);
      return [];
    }
  }

  /**
   * Map pincode to city
   */
  mapPincodeToCity(pincode) {
    // Basic pincode to city mapping
    if (pincode.startsWith('400')) return 'Mumbai';
    if (pincode.startsWith('110')) return 'Delhi';
    if (pincode.startsWith('500')) return 'Hyderabad';
    if (pincode.startsWith('560')) return 'Bangalore';
    if (pincode.startsWith('600')) return 'Chennai';
    if (pincode.startsWith('226')) return 'Lucknow';
    
    return null;
  }

  /**
   * Helper methods
   */
  determineCategory(record) {
    const category = (record.hospital_category || '').toString();
    const name = (record.hospital_name || '').toLowerCase();
    
    if (name.includes('government') || name.includes('govt') || 
        name.includes('district') || name.includes('general hospital')) {
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

module.exports = MultiCityHospitalService;