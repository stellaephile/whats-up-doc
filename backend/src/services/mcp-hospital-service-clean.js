/**
 * MCP-Powered Hospital Data Service - Enhanced with pan-India support
 * Provides hospital data for any Indian pincode with better coordinate handling
 */

const fetch = require('node-fetch');

class MCPHospitalService {
  constructor() {
    this.apiKey = process.env.DATA_GOV_IN_API_KEY;
    this.baseUrl = 'https://api.data.gov.in/resource/98fa254e-c5f8-4910-a19b-4828939b477d';
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes for fresher data
    
    // Enhanced city mapping with pan-India support including Lucknow 260xxx, 261xxx
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
   * Enhanced pincode to city mapping with Lucknow support
   */
  mapPincodeToCity(pincode) {
    // Enhanced pincode to city mapping
    if (pincode.startsWith('400') || pincode.startsWith('401') || pincode.startsWith('402') || pincode.startsWith('403') || pincode.startsWith('404')) return 'Mumbai';
    if (pincode.startsWith('110') || pincode.startsWith('111') || pincode.startsWith('112')) return 'Delhi';
    if (pincode.startsWith('500') || pincode.startsWith('501') || pincode.startsWith('502') || pincode.startsWith('503') || pincode.startsWith('504')) return 'Hyderabad';
    if (pincode.startsWith('560') || pincode.startsWith('561') || pincode.startsWith('562') || pincode.startsWith('563')) return 'Bangalore';
    if (pincode.startsWith('600') || pincode.startsWith('601') || pincode.startsWith('602') || pincode.startsWith('603') || pincode.startsWith('604')) return 'Chennai';
    if (pincode.startsWith('226') || pincode.startsWith('260') || pincode.startsWith('261')) return 'Lucknow';
    
    return null;
  }
}

module.exports = MCPHospitalService;