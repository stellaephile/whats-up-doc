/**
 * API Configuration for data.gov.in integration
 */

const config = {
  dataGovIn: {
    baseUrl: 'https://api.data.gov.in/resource/98fa254e-c5f8-4910-a19b-4828939b477d',
    apiKey: process.env.DATA_GOV_IN_API_KEY,
    defaultParams: {
      format: 'json',
      limit: 1000,
      offset: 0
    },
    // Rate limiting to respect API limits
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    }
  },
  
  // Delhi-specific filters for the API
  delhiFilters: {
    state: 'Delhi',
    // Additional filters can be added based on API documentation
    districts: [
      'Central Delhi',
      'East Delhi', 
      'New Delhi',
      'North Delhi',
      'North East Delhi',
      'North West Delhi',
      'Shahdara',
      'South Delhi',
      'South East Delhi',
      'South West Delhi',
      'West Delhi'
    ]
  },

  // Field mappings from API response to our internal structure
  fieldMappings: {
    hospitalName: ['hospital_name', 'name', 'facility_name'],
    address: ['address', 'full_address', 'location'],
    district: ['district', 'district_name'],
    pincode: ['pincode', 'pin_code', 'postal_code'],
    phone: ['contact_no', 'phone', 'mobile', 'telephone'],
    email: ['email', 'email_id'],
    website: ['website', 'web_site', 'url'],
    category: ['category', 'hospital_category', 'facility_type'],
    specialization: ['specialization', 'specialty', 'specialities'],
    latitude: ['latitude', 'lat'],
    longitude: ['longitude', 'lng', 'long'],
    systemOfMedicine: ['system_of_medicine', 'medicine_system']
  }
};

module.exports = config;