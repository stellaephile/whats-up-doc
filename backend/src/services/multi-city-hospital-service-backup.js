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
      'Lucknow': {
        state: 'Uttar Pradesh',
        coordinates: { latitude: 26.8467, longitude: 80.9462 },
        districts: ['Lucknow']
      },
        state: 'Tamil Nadu',
        coordinates: { latitude: 13.0827, longitude: 80.2707 },
        districts: ['Chennai', 'Kanchipuram', 'Tiruvallur']
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
   * Get hospitals by city and condition
   */
  async findHospitalsByCondition(condition, city, location = null) {
    try {
      if (!this.availableCities[city]) {
        throw new Error(`City ${city} not supported yet`);
      }

      const cityInfo = this.availableCities[city];
      const hospitals = await this.getHospitalsByCity(city);
      
      // Apply condition-based filtering
      let filteredHospitals = this.filterByCondition(hospitals, condition);
      
      // Sort by proximity if location provided
      if (location && location.latitude && location.longitude) {
        filteredHospitals = this.sortByDistance(filteredHospitals, location);
      } else {
        // Use city center as default location
        filteredHospitals = this.sortByDistance(filteredHospitals, cityInfo.coordinates);
      }
      
      return filteredHospitals.slice(0, 5);
      
    } catch (error) {
      console.error('Hospital search error:', error);
      return this.getFallbackHospitals(city, condition);
    }
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

  /**
   * Get fallback hospitals when API fails
   */
  getFallbackHospitals(city, condition) {
    const fallbackData = {
      'Hyderabad': [
        {
          name: 'Apollo Hospitals, Jubilee Hills',
          address: 'Road No. 72, Jubilee Hills, Hyderabad',
          phone: '040-23607777',
          category: 'Private',
          specialties: ['Cardiology', 'Emergency', 'Multi-specialty'],
          isGovernment: false,
          emergencyServices: true,
          waitTimeCategory: 'low'
        },
        {
          name: 'Gandhi Hospital',
          address: 'Secunderabad, Hyderabad',
          phone: '040-27560146',
          category: 'Government',
          specialties: ['General Medicine', 'Emergency'],
          isGovernment: true,
          emergencyServices: true,
          waitTimeCategory: 'high'
        }
      ]
    };

    return fallbackData[city] || [];
  }

  /**
   * Get emergency hospitals for a city
   */
  async getEmergencyHospitals(city, location = null) {
    const hospitals = await this.getHospitalsByCity(city);
    let emergencyHospitals = hospitals.filter(h => h.emergencyServices);
    
    if (location) {
      emergencyHospitals = this.sortByDistance(emergencyHospitals, location);
    }
    
    return emergencyHospitals.slice(0, 3);
  }

  /**
   * Find hospitals by pincode and condition
   * @param {string} condition - Medical condition or specialty
   * @param {string} pincode - 6-digit pincode
   * @param {Object} location - User's approximate location
   * @returns {Promise<Array>} Recommended hospitals
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
   * @param {string} pincode - 6-digit pincode
   * @param {Object} location - User's approximate location
   * @returns {Promise<Array>} Emergency hospitals
   */
  async getEmergencyHospitalsByPincode(pincode, location = null) {
    try {
      const city = this.mapPincodeToCity(pincode);
      
      if (!city) {
        return this.getFallbackEmergencyHospitals(pincode);
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
      return this.getFallbackEmergencyHospitals(pincode);
    }
  }

  /**
   * Map pincode to city (basic mapping for now)
   * @param {string} pincode - 6-digit pincode
   * @returns {string|null} City name
   */
  mapPincodeToCity(pincode) {
    const pincodeMap = {
      // Mumbai pincodes (400xxx)
      '400001': 'Mumbai', '400002': 'Mumbai', '400003': 'Mumbai',
      '400004': 'Mumbai', '400005': 'Mumbai', '400006': 'Mumbai',
      '400007': 'Mumbai', '400008': 'Mumbai', '400009': 'Mumbai',
      '400010': 'Mumbai', '400011': 'Mumbai', '400012': 'Mumbai',
      '400013': 'Mumbai', '400014': 'Mumbai', '400015': 'Mumbai',
      '400016': 'Mumbai', '400017': 'Mumbai', '400018': 'Mumbai',
      '400019': 'Mumbai', '400020': 'Mumbai', '400021': 'Mumbai',
      '400022': 'Mumbai', '400023': 'Mumbai', '400024': 'Mumbai',
      '400025': 'Mumbai', '400026': 'Mumbai', '400027': 'Mumbai',
      '400028': 'Mumbai', '400029': 'Mumbai', '400030': 'Mumbai',
      '400031': 'Mumbai', '400032': 'Mumbai', '400033': 'Mumbai',
      '400034': 'Mumbai', '400035': 'Mumbai', '400036': 'Mumbai',
      '400037': 'Mumbai', '400038': 'Mumbai', '400039': 'Mumbai',
      '400040': 'Mumbai', '400041': 'Mumbai', '400042': 'Mumbai',
      '400043': 'Mumbai', '400044': 'Mumbai', '400045': 'Mumbai',
      '400046': 'Mumbai', '400047': 'Mumbai', '400048': 'Mumbai',
      '400049': 'Mumbai', '400050': 'Mumbai', '400051': 'Mumbai',
      '400052': 'Mumbai', '400053': 'Mumbai', '400054': 'Mumbai',
      '400055': 'Mumbai', '400056': 'Mumbai', '400057': 'Mumbai',
      '400058': 'Mumbai', '400059': 'Mumbai', '400060': 'Mumbai',
      '400061': 'Mumbai', '400062': 'Mumbai', '400063': 'Mumbai',
      '400064': 'Mumbai', '400065': 'Mumbai', '400066': 'Mumbai',
      '400067': 'Mumbai', '400068': 'Mumbai', '400069': 'Mumbai',
      '400070': 'Mumbai', '400071': 'Mumbai', '400072': 'Mumbai',
      '400073': 'Mumbai', '400074': 'Mumbai', '400075': 'Mumbai',
      '400076': 'Mumbai', '400077': 'Mumbai', '400078': 'Mumbai',
      '400079': 'Mumbai', '400080': 'Mumbai', '400081': 'Mumbai',
      '400082': 'Mumbai', '400083': 'Mumbai', '400084': 'Mumbai',
      '400085': 'Mumbai', '400086': 'Mumbai', '400087': 'Mumbai',
      '400088': 'Mumbai', '400089': 'Mumbai', '400090': 'Mumbai',
      '400091': 'Mumbai', '400092': 'Mumbai', '400093': 'Mumbai',
      '400094': 'Mumbai', '400095': 'Mumbai', '400096': 'Mumbai',
      '400097': 'Mumbai', '400098': 'Mumbai', '400099': 'Mumbai',
      
      // Delhi pincodes (110xxx)
      '110001': 'Delhi', '110002': 'Delhi', '110003': 'Delhi',
      '110004': 'Delhi', '110005': 'Delhi', '110006': 'Delhi',
      '110007': 'Delhi', '110008': 'Delhi', '110009': 'Delhi',
      '110010': 'Delhi', '110011': 'Delhi', '110012': 'Delhi',
      '110013': 'Delhi', '110014': 'Delhi', '110015': 'Delhi',
      '110016': 'Delhi', '110017': 'Delhi', '110018': 'Delhi',
      '110019': 'Delhi', '110020': 'Delhi', '110021': 'Delhi',
      '110022': 'Delhi', '110023': 'Delhi', '110024': 'Delhi',
      '110025': 'Delhi', '110026': 'Delhi', '110027': 'Delhi',
      '110028': 'Delhi', '110029': 'Delhi', '110030': 'Delhi',
      '110031': 'Delhi', '110032': 'Delhi', '110033': 'Delhi',
      '110034': 'Delhi', '110035': 'Delhi', '110036': 'Delhi',
      '110037': 'Delhi', '110038': 'Delhi', '110039': 'Delhi',
      '110040': 'Delhi', '110041': 'Delhi', '110042': 'Delhi',
      '110043': 'Delhi', '110044': 'Delhi', '110045': 'Delhi',
      '110046': 'Delhi', '110047': 'Delhi', '110048': 'Delhi',
      '110049': 'Delhi', '110050': 'Delhi', '110051': 'Delhi',
      '110052': 'Delhi', '110053': 'Delhi', '110054': 'Delhi',
      '110055': 'Delhi', '110056': 'Delhi', '110057': 'Delhi',
      '110058': 'Delhi', '110059': 'Delhi', '110060': 'Delhi',
      '110061': 'Delhi', '110062': 'Delhi', '110063': 'Delhi',
      '110064': 'Delhi', '110065': 'Delhi', '110066': 'Delhi',
      '110067': 'Delhi', '110068': 'Delhi', '110069': 'Delhi',
      '110070': 'Delhi', '110071': 'Delhi', '110072': 'Delhi',
      '110073': 'Delhi', '110074': 'Delhi', '110075': 'Delhi',
      '110076': 'Delhi', '110077': 'Delhi', '110078': 'Delhi',
      '110079': 'Delhi', '110080': 'Delhi', '110081': 'Delhi',
      '110082': 'Delhi', '110083': 'Delhi', '110084': 'Delhi',
      '110085': 'Delhi', '110086': 'Delhi', '110087': 'Delhi',
      '110088': 'Delhi', '110089': 'Delhi', '110090': 'Delhi',
      '110091': 'Delhi', '110092': 'Delhi', '110093': 'Delhi',
      '110094': 'Delhi', '110095': 'Delhi', '110096': 'Delhi',
      '110097': 'Delhi', '110098': 'Delhi', '110099': 'Delhi',
      
      // Hyderabad pincodes (500xxx)
      '500001': 'Hyderabad', '500002': 'Hyderabad', '500003': 'Hyderabad',
      '500004': 'Hyderabad', '500005': 'Hyderabad', '500006': 'Hyderabad',
      '500007': 'Hyderabad', '500008': 'Hyderabad', '500009': 'Hyderabad',
      '500010': 'Hyderabad', '500011': 'Hyderabad', '500012': 'Hyderabad',
      '500013': 'Hyderabad', '500014': 'Hyderabad', '500015': 'Hyderabad',
      '500016': 'Hyderabad', '500017': 'Hyderabad', '500018': 'Hyderabad',
      '500019': 'Hyderabad', '500020': 'Hyderabad', '500021': 'Hyderabad',
      '500022': 'Hyderabad', '500023': 'Hyderabad', '500024': 'Hyderabad',
      '500025': 'Hyderabad', '500026': 'Hyderabad', '500027': 'Hyderabad',
      '500028': 'Hyderabad', '500029': 'Hyderabad', '500030': 'Hyderabad',
      '500031': 'Hyderabad', '500032': 'Hyderabad', '500033': 'Hyderabad',
      '500034': 'Hyderabad', '500035': 'Hyderabad', '500036': 'Hyderabad',
      '500037': 'Hyderabad', '500038': 'Hyderabad', '500039': 'Hyderabad',
      '500040': 'Hyderabad', '500041': 'Hyderabad', '500042': 'Hyderabad',
      '500043': 'Hyderabad', '500044': 'Hyderabad', '500045': 'Hyderabad',
      '500046': 'Hyderabad', '500047': 'Hyderabad', '500048': 'Hyderabad',
      '500049': 'Hyderabad', '500050': 'Hyderabad', '500051': 'Hyderabad',
      '500052': 'Hyderabad', '500053': 'Hyderabad', '500054': 'Hyderabad',
      '500055': 'Hyderabad', '500056': 'Hyderabad', '500057': 'Hyderabad',
      '500058': 'Hyderabad', '500059': 'Hyderabad', '500060': 'Hyderabad',
      '500061': 'Hyderabad', '500062': 'Hyderabad', '500063': 'Hyderabad',
      '500064': 'Hyderabad', '500065': 'Hyderabad', '500066': 'Hyderabad',
      '500067': 'Hyderabad', '500068': 'Hyderabad', '500069': 'Hyderabad',
      '500070': 'Hyderabad', '500071': 'Hyderabad', '500072': 'Hyderabad',
      '500073': 'Hyderabad', '500074': 'Hyderabad', '500075': 'Hyderabad',
      '500076': 'Hyderabad', '500077': 'Hyderabad', '500078': 'Hyderabad',
      '500079': 'Hyderabad', '500080': 'Hyderabad', '500081': 'Hyderabad',
      '500082': 'Hyderabad', '500083': 'Hyderabad', '500084': 'Hyderabad',
      '500085': 'Hyderabad', '500086': 'Hyderabad', '500087': 'Hyderabad',
      '500088': 'Hyderabad', '500089': 'Hyderabad', '500090': 'Hyderabad',
      '500091': 'Hyderabad', '500092': 'Hyderabad', '500093': 'Hyderabad',
      '500094': 'Hyderabad', '500095': 'Hyderabad', '500096': 'Hyderabad',
      '500097': 'Hyderabad', '500098': 'Hyderabad', '500099': 'Hyderabad',
      
      // Bangalore pincodes (560xxx)
      '560001': 'Bangalore', '560002': 'Bangalore', '560003': 'Bangalore',
      '560004': 'Bangalore', '560005': 'Bangalore', '560006': 'Bangalore',
      '560007': 'Bangalore', '560008': 'Bangalore', '560009': 'Bangalore',
      '560010': 'Bangalore', '560011': 'Bangalore', '560012': 'Bangalore',
      '560013': 'Bangalore', '560014': 'Bangalore', '560015': 'Bangalore',
      '560016': 'Bangalore', '560017': 'Bangalore', '560018': 'Bangalore',
      '560019': 'Bangalore', '560020': 'Bangalore', '560021': 'Bangalore',
      '560022': 'Bangalore', '560023': 'Bangalore', '560024': 'Bangalore',
      '560025': 'Bangalore', '560026': 'Bangalore', '560027': 'Bangalore',
      '560028': 'Bangalore', '560029': 'Bangalore', '560030': 'Bangalore',
      '560031': 'Bangalore', '560032': 'Bangalore', '560033': 'Bangalore',
      '560034': 'Bangalore', '560035': 'Bangalore', '560036': 'Bangalore',
      '560037': 'Bangalore', '560038': 'Bangalore', '560039': 'Bangalore',
      '560040': 'Bangalore', '560041': 'Bangalore', '560042': 'Bangalore',
      '560043': 'Bangalore', '560044': 'Bangalore', '560045': 'Bangalore',
      '560046': 'Bangalore', '560047': 'Bangalore', '560048': 'Bangalore',
      '560049': 'Bangalore', '560050': 'Bangalore', '560051': 'Bangalore',
      '560052': 'Bangalore', '560053': 'Bangalore', '560054': 'Bangalore',
      '560055': 'Bangalore', '560056': 'Bangalore', '560057': 'Bangalore',
      '560058': 'Bangalore', '560059': 'Bangalore', '560060': 'Bangalore',
      '560061': 'Bangalore', '560062': 'Bangalore', '560063': 'Bangalore',
      '560064': 'Bangalore', '560065': 'Bangalore', '560066': 'Bangalore',
      '560067': 'Bangalore', '560068': 'Bangalore', '560069': 'Bangalore',
      '560070': 'Bangalore', '560071': 'Bangalore', '560072': 'Bangalore',
      '560073': 'Bangalore', '560074': 'Bangalore', '560075': 'Bangalore',
      '560076': 'Bangalore', '560077': 'Bangalore', '560078': 'Bangalore',
      '560079': 'Bangalore', '560080': 'Bangalore', '560081': 'Bangalore',
      '560082': 'Bangalore', '560083': 'Bangalore', '560084': 'Bangalore',
      '560085': 'Bangalore', '560086': 'Bangalore', '560087': 'Bangalore',
      '560088': 'Bangalore', '560089': 'Bangalore', '560090': 'Bangalore',
      '560091': 'Bangalore', '560092': 'Bangalore', '560093': 'Bangalore',
      '560094': 'Bangalore', '560095': 'Bangalore', '560096': 'Bangalore',
      '560097': 'Bangalore', '560098': 'Bangalore', '560099': 'Bangalore',
      '560100': 'Bangalore', '560101': 'Bangalore', '560102': 'Bangalore',
      '560103': 'Bangalore', '560104': 'Bangalore', '560105': 'Bangalore',
      '560106': 'Bangalore', '560107': 'Bangalore', '560108': 'Bangalore',
      '560109': 'Bangalore', '560110': 'Bangalore', '560111': 'Bangalore',
      '560112': 'Bangalore', '560113': 'Bangalore', '560114': 'Bangalore',
      '560115': 'Bangalore', '560116': 'Bangalore', '560117': 'Bangalore',
      '560118': 'Bangalore', '560119': 'Bangalore', '560120': 'Bangalore',
      // Lucknow pincodes (226xxx)
      '226001': 'Lucknow', '226002': 'Lucknow', '226003': 'Lucknow',
      '226004': 'Lucknow', '226005': 'Lucknow', '226006': 'Lucknow',
      '226007': 'Lucknow', '226008': 'Lucknow', '226009': 'Lucknow',
      '226010': 'Lucknow', '226011': 'Lucknow', '226012': 'Lucknow',
      '226013': 'Lucknow', '226014': 'Lucknow', '226015': 'Lucknow',
      '226016': 'Lucknow', '226017': 'Lucknow', '226018': 'Lucknow',
      '226019': 'Lucknow', '226020': 'Lucknow', '226021': 'Lucknow',
      '226022': 'Lucknow', '226023': 'Lucknow', '226024': 'Lucknow',
      '226025': 'Lucknow', '226026': 'Lucknow', '226027': 'Lucknow',
      '226028': 'Lucknow', '226029': 'Lucknow', '226030': 'Lucknow',
      '600001': 'Chennai', '600002': 'Chennai', '600003': 'Chennai',
      '600004': 'Chennai', '600005': 'Chennai', '600006': 'Chennai',
      '600007': 'Chennai', '600008': 'Chennai', '600009': 'Chennai',
      '600010': 'Chennai', '600011': 'Chennai', '600012': 'Chennai',
      '600013': 'Chennai', '600014': 'Chennai', '600015': 'Chennai',
      '600016': 'Chennai', '600017': 'Chennai', '600018': 'Chennai',
      '600019': 'Chennai', '600020': 'Chennai', '600021': 'Chennai',
      '600022': 'Chennai', '600023': 'Chennai', '600024': 'Chennai',
      '600025': 'Chennai', '600026': 'Chennai', '600027': 'Chennai',
      '600028': 'Chennai', '600029': 'Chennai', '600030': 'Chennai',
      '600031': 'Chennai', '600032': 'Chennai', '600033': 'Chennai',
      '600034': 'Chennai', '600035': 'Chennai', '600036': 'Chennai',
      '600037': 'Chennai', '600038': 'Chennai', '600039': 'Chennai',
      '600040': 'Chennai', '600041': 'Chennai', '600042': 'Chennai',
      '600043': 'Chennai', '600044': 'Chennai', '600045': 'Chennai',
      '600046': 'Chennai', '600047': 'Chennai', '600048': 'Chennai',
      '600049': 'Chennai', '600050': 'Chennai', '600051': 'Chennai',
      '600052': 'Chennai', '600053': 'Chennai', '600054': 'Chennai',
      '600055': 'Chennai', '600056': 'Chennai', '600057': 'Chennai',
      '600058': 'Chennai', '600059': 'Chennai', '600060': 'Chennai',
      '600061': 'Chennai', '600062': 'Chennai', '600063': 'Chennai',
      '600064': 'Chennai', '600065': 'Chennai', '600066': 'Chennai',
      '600067': 'Chennai', '600068': 'Chennai', '600069': 'Chennai',
      '600070': 'Chennai', '600071': 'Chennai', '600072': 'Chennai',
      '600073': 'Chennai', '600074': 'Chennai', '600075': 'Chennai',
      '600076': 'Chennai', '600077': 'Chennai', '600078': 'Chennai',
      '600079': 'Chennai', '600080': 'Chennai', '600081': 'Chennai',
      '600082': 'Chennai', '600083': 'Chennai', '600084': 'Chennai',
      '600085': 'Chennai', '600086': 'Chennai', '600087': 'Chennai',
      '600088': 'Chennai', '600089': 'Chennai', '600090': 'Chennai',
      '600091': 'Chennai', '600092': 'Chennai', '600093': 'Chennai',
      '600094': 'Chennai', '600095': 'Chennai', '600096': 'Chennai',
      '600097': 'Chennai', '600098': 'Chennai', '600099': 'Chennai',
      '600100': 'Chennai', '600101': 'Chennai', '600102': 'Chennai',
      '600103': 'Chennai', '600104': 'Chennai', '600105': 'Chennai',
      '600106': 'Chennai', '600107': 'Chennai', '600108': 'Chennai',
      '600109': 'Chennai', '600110': 'Chennai', '600111': 'Chennai',
      '600112': 'Chennai', '600113': 'Chennai', '600114': 'Chennai',
      '600115': 'Chennai', '600116': 'Chennai', '600117': 'Chennai',
      '600118': 'Chennai', '600119': 'Chennai', '600120': 'Chennai'
    };

    return pincodeMap[pincode] || null;
  }

  /**
   * Get fallback hospitals when API fails or pincode not found
   */
  getFallbackHospitalsByPincode(pincode, condition) {
    // Determine likely city based on pincode pattern
    let cityName = 'Unknown';
    if (pincode.startsWith('4')) cityName = 'Mumbai';
    else if (pincode.startsWith('11')) cityName = 'Delhi';
    else if (pincode.startsWith('5')) cityName = 'Hyderabad';
    else if (pincode.startsWith('56')) cityName = 'Bangalore';
    else if (pincode.startsWith('6')) cityName = 'Chennai';

    const fallbackData = {
      'Mumbai': [
        {
          name: 'King Edward Memorial Hospital (KEM)',
          address: 'Acharya Donde Marg, Parel, Mumbai',
          phone: '022-24129884',
          category: 'Government',
          specialties: ['General Medicine', 'Emergency', 'Multi-specialty'],
          isGovernment: true,
          emergencyServices: true,
          waitTimeCategory: 'high'
        },
        {
          name: 'Tata Memorial Hospital',
          address: 'Dr E Borges Road, Parel, Mumbai',
          phone: '022-24177000',
          category: 'Government',
          specialties: ['Oncology', 'Cancer Treatment', 'Emergency'],
          isGovernment: true,
          emergencyServices: true,
          waitTimeCategory: 'high'
        },
        {
          name: 'Lilavati Hospital',
          address: 'A-791, Bandra Reclamation, Bandra West, Mumbai',
          phone: '022-26567777',
          category: 'Private',
          specialties: ['Cardiology', 'Emergency', 'Multi-specialty'],
          isGovernment: false,
          emergencyServices: true,
          waitTimeCategory: 'low'
        },
        {
          name: 'Hinduja Hospital',
          address: 'Veer Savarkar Marg, Mahim, Mumbai',
          phone: '022-24447000',
          category: 'Private',
          specialties: ['Cardiology', 'Emergency', 'Multi-specialty'],
          isGovernment: false,
          emergencyServices: true,
          waitTimeCategory: 'low'
        }
      ],
      'Delhi': [
        {
          name: 'AIIMS, New Delhi',
          address: 'Ansari Nagar, New Delhi',
          phone: '011-26588500',
          category: 'Government',
          specialties: ['Cardiology', 'Emergency', 'Multi-specialty', 'Trauma'],
          isGovernment: true,
          emergencyServices: true,
          waitTimeCategory: 'high'
        },
        {
          name: 'G.B. Pant Hospital (GIPMER)',
          address: 'Jawahar Lal Nehru Marg, New Delhi',
          phone: '011-23234242',
          category: 'Government',
          specialties: ['Cardiology', 'Emergency', 'General Medicine'],
          isGovernment: true,
          emergencyServices: true,
          waitTimeCategory: 'high'
        },
        {
          name: 'Ram Manohar Lohia Hospital',
          address: 'Baba Kharak Singh Marg, New Delhi',
          phone: '011-23365525',
          category: 'Government',
          specialties: ['Emergency', 'General Medicine', 'Anti-rabies'],
          isGovernment: true,
          emergencyServices: true,
          waitTimeCategory: 'high'
        },
        {
          name: 'Max Super Speciality Hospital, Saket',
          address: 'Press Enclave Road, Saket, New Delhi',
          phone: '011-26515050',
          category: 'Private',
          specialties: ['Cardiology', 'Emergency', 'Multi-specialty'],
          isGovernment: false,
          emergencyServices: true,
          waitTimeCategory: 'low'
        }
      ],
      'Hyderabad': [
        {
          name: 'Apollo Hospitals, Jubilee Hills',
          address: 'Road No. 72, Jubilee Hills, Hyderabad',
          phone: '040-23607777',
          category: 'Private',
          specialties: ['Cardiology', 'Emergency', 'Multi-specialty'],
          isGovernment: false,
          emergencyServices: true,
          waitTimeCategory: 'low'
        },
        {
          name: 'Gandhi Hospital',
          address: 'Secunderabad, Hyderabad',
          phone: '040-27560146',
          category: 'Government',
          specialties: ['General Medicine', 'Emergency'],
          isGovernment: true,
          emergencyServices: true,
          waitTimeCategory: 'high'
        }
      ],
      'Bangalore': [
        {
          name: 'Manipal Hospital, HAL Airport Road',
          address: 'HAL Airport Road, Bangalore',
          phone: '080-25024444',
          category: 'Private',
          specialties: ['Cardiology', 'Emergency', 'Multi-specialty'],
          isGovernment: false,
          emergencyServices: true,
          waitTimeCategory: 'low'
        },
        {
          name: 'Victoria Hospital',
          address: 'Fort, Bangalore',
          phone: '080-26700447',
          category: 'Government',
          specialties: ['General Medicine', 'Emergency'],
          isGovernment: true,
          emergencyServices: true,
          waitTimeCategory: 'high'
        }
      ],
      'Chennai': [
        {
          name: 'Apollo Hospitals, Greams Road',
          address: 'Greams Road, Chennai',
          phone: '044-28290200',
          category: 'Private',
          specialties: ['Cardiology', 'Emergency', 'Multi-specialty'],
          isGovernment: false,
          emergencyServices: true,
          waitTimeCategory: 'low'
        },
        {
          name: 'Government General Hospital',
          address: 'Park Town, Chennai',
          phone: '044-25305000',
          category: 'Government',
          specialties: ['General Medicine', 'Emergency'],
          isGovernment: true,
          emergencyServices: true,
          waitTimeCategory: 'high'
        }
      ]
    };

    return fallbackData[cityName] || fallbackData['Delhi'];
  }

  /**
   * Get fallback emergency hospitals
   */
  getFallbackEmergencyHospitals(pincode) {
    const hospitals = this.getFallbackHospitalsByPincode(pincode, 'emergency');
    return hospitals.filter(h => h.emergencyServices);
  }
}

module.exports = MultiCityHospitalService;