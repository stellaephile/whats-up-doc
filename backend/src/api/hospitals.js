/**
 * Hospital API Routes - Anonymous hospital recommendations
 */

const express = require('express');
const MCPHospitalService = require('../services/mcp-hospital-service');

const router = express.Router();
const hospitalService = new MCPHospitalService();

/**
 * GET /api/hospitals/cities
 * Get list of available cities
 */
router.get('/cities', (req, res) => {
  try {
    const cities = hospitalService.getAvailableCities();
    
    res.json({
      cities: cities,
      message: 'Available cities for hospital search',
      note: 'More cities will be added as data becomes available'
    });
  } catch (error) {
    console.error('Cities fetch error:', error);
    res.status(500).json({
      error: 'Unable to fetch cities',
      cities: [
        { name: 'Hyderabad', state: 'Andhra Pradesh' },
        { name: 'Bangalore', state: 'Karnataka' },
        { name: 'Chennai', state: 'Tamil Nadu' }
      ]
    });
  }
});

/**
 * GET /api/hospitals/recommend
 * Get hospital recommendations based on condition, city and location
 */
/**
 * GET /api/hospitals/recommend
 * Get hospital recommendations based on condition and pincode
 */
router.get('/recommend', async (req, res) => {
  try {
    const { condition, pincode, latitude, longitude } = req.query;
    
    if (!condition) {
      return res.status(400).json({
        error: 'Medical condition is required',
        message: 'Please describe your medical need.',
        example: '/api/hospitals/recommend?condition=chest%20pain&pincode=500001'
      });
    }

    if (!pincode) {
      return res.status(400).json({
        error: 'Pincode is required',
        message: 'Please enter your 6-digit pincode.',
        example: '/api/hospitals/recommend?condition=chest%20pain&pincode=500001'
      });
    }

    // Build location object if provided
    const location = {};
    if (latitude && longitude) {
      location.latitude = parseFloat(latitude);
      location.longitude = parseFloat(longitude);
    }

    const result = await hospitalService.findHospitalsByPincode(condition, pincode, location, true); // Always bust cache
    
    // Handle no hospitals found
    if (!result.hospitals || result.hospitals.length === 0) {
      return res.json({
        condition: condition,
        pincode: pincode,
        totalFound: 0,
        recommendations: [],
        message: result.message || `No hospitals found for "${condition}" near pincode ${pincode}`,
        suggestions: [
          'Try a broader search term like "general medicine" or "emergency"',
          'Check if the pincode is correct',
          'Consider nearby pincodes or areas',
          'For emergencies, call 102 (ambulance) or 108 (emergency services)'
        ],
        emergencyNumbers: {
          ambulance: '102',
          emergency: '108',
          police: '100'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Format response
    const recommendations = result.hospitals.map(hospital => ({
      name: hospital.name,
      address: hospital.address,
      category: hospital.isGovernment ? 'Government Hospital' : 'Private Hospital',
      specialties: hospital.specialties,
      phone: hospital.phone,
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      distance: hospital.distance ? `${hospital.distance.toFixed(1)} km` : null,
      waitTime: hospital.waitTimeCategory,
      emergencyAvailable: hospital.emergencyServices,
      cost: hospital.isGovernment ? 'Free/Subsidized' : 'Paid',
      tips: generateHospitalTips(hospital, condition, pincode),
      lastUpdated: hospital.lastUpdated
    }));

    res.json({
      condition: condition,
      pincode: pincode,
      totalFound: result.hospitals.length,
      recommendations: recommendations,
      emergencyNumbers: {
        ambulance: '102',
        emergency: '108',
        police: '100'
      },
      tips: generateConditionTips(condition, pincode, recommendations),
      timestamp: new Date().toISOString(),
      dataSource: 'data.gov.in National Hospital Directory'
    });

  } catch (error) {
    console.error('Hospital recommendation error:', error);
    res.status(500).json({
      error: 'Unable to fetch recommendations',
      message: 'System error occurred. Please try again or call 102 for emergency.'
    });
  }
});

/**
 * GET /api/hospitals/emergency
 * Get nearest emergency hospitals using live API data only
 */
router.get('/emergency', async (req, res) => {
  try {
    const { pincode, latitude, longitude } = req.query;
    
    if (!pincode) {
      return res.status(400).json({
        error: 'Pincode is required',
        message: 'Please specify your pincode for emergency hospitals.',
        emergencyNumbers: {
          ambulance: '102',
          emergency: '108',
          police: '100'
        }
      });
    }
    
    const location = {};
    if (latitude && longitude) {
      location.latitude = parseFloat(latitude);
      location.longitude = parseFloat(longitude);
    }

    const result = await hospitalService.getEmergencyHospitalsByPincode(pincode, location);
    
    // Handle no emergency hospitals found
    if (!result.hospitals || result.hospitals.length === 0) {
      return res.json({
        emergency: true,
        pincode: pincode,
        totalFound: 0,
        nearestHospitals: [],
        message: result.message || `No emergency hospitals found near pincode ${pincode}`,
        emergencyNumbers: {
          ambulance: '102',
          emergency: '108',
          police: '100'
        },
        tips: [
          'Call 102 immediately for ambulance service',
          'Call 108 for emergency medical response',
          'Go to the nearest hospital if possible',
          'Keep patient calm and stable during transport'
        ],
        timestamp: new Date().toISOString()
      });
    }
    
    const emergencyHospitals = result.hospitals.map(hospital => ({
      name: hospital.name,
      address: hospital.address,
      phone: hospital.phone,
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      distance: hospital.distance ? `${hospital.distance.toFixed(1)} km` : null,
      category: hospital.isGovernment ? 'Government' : 'Private',
      directions: `Call ${hospital.phone || '102'} before going`,
      waitTime: hospital.waitTimeCategory,
      cost: hospital.isGovernment ? 'Free/Subsidized' : 'Paid',
      emergencyAvailable: true,
      lastUpdated: hospital.lastUpdated
    }));

    res.json({
      emergency: true,
      pincode: pincode,
      totalFound: result.hospitals.length,
      nearestHospitals: emergencyHospitals,
      emergencyNumbers: {
        ambulance: '102',
        emergency: '108',
        police: '100'
      },
      message: `${result.hospitals.length} emergency hospitals found near pincode ${pincode}`,
      tips: [
        'Call hospital before going to confirm availability',
        'Keep patient calm and stable during transport',
        'Carry ID proof and any medical history if available',
        'For life-threatening emergencies, call 102 immediately'
      ],
      timestamp: new Date().toISOString(),
      dataSource: 'data.gov.in National Hospital Directory'
    });

  } catch (error) {
    console.error('Emergency hospital error:', error);
    res.status(500).json({
      error: 'Emergency service unavailable',
      message: 'Emergency service error occurred. Call 102 immediately for ambulance service.',
      emergencyNumbers: {
        ambulance: '102',
        emergency: '108',
        police: '100'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/hospitals/areas
 * Get list of areas/pincodes for a specific city
 */
router.get('/areas', (req, res) => {
  try {
    const { city } = req.query;
    
    if (!city) {
      return res.status(400).json({
        error: 'City parameter is required',
        message: 'Please specify which city you want areas for.'
      });
    }

    // Sample pincode data for supported cities
    const cityAreas = {
      'Mumbai': [
        { area: 'Colaba', pincode: '400001' },
        { area: 'Fort', pincode: '400002' },
        { area: 'Churchgate', pincode: '400020' },
        { area: 'Marine Drive', pincode: '400021' },
        { area: 'Bandra West', pincode: '400050' },
        { area: 'Andheri West', pincode: '400058' },
        { area: 'Juhu', pincode: '400049' },
        { area: 'Powai', pincode: '400076' },
        { area: 'Borivali', pincode: '400092' },
        { area: 'Thane', pincode: '400601' }
      ],
      'Delhi': [
        { area: 'Connaught Place', pincode: '110001' },
        { area: 'India Gate', pincode: '110003' },
        { area: 'Karol Bagh', pincode: '110005' },
        { area: 'Lajpat Nagar', pincode: '110024' },
        { area: 'South Extension', pincode: '110049' },
        { area: 'Saket', pincode: '110017' },
        { area: 'Vasant Kunj', pincode: '110070' },
        { area: 'Dwarka', pincode: '110075' },
        { area: 'Rohini', pincode: '110085' },
        { area: 'Janakpuri', pincode: '110058' }
      ],
      'Hyderabad': [
        { area: 'Banjara Hills', pincode: '500034' },
        { area: 'Jubilee Hills', pincode: '500033' },
        { area: 'Secunderabad', pincode: '500003' },
        { area: 'Hitech City', pincode: '500081' },
        { area: 'Gachibowli', pincode: '500032' },
        { area: 'Kukatpally', pincode: '500072' },
        { area: 'Madhapur', pincode: '500081' },
        { area: 'Begumpet', pincode: '500016' }
      ],
      'Bangalore': [
        { area: 'Koramangala', pincode: '560034' },
        { area: 'Indiranagar', pincode: '560038' },
        { area: 'Whitefield', pincode: '560066' },
        { area: 'Electronic City', pincode: '560100' },
        { area: 'Jayanagar', pincode: '560011' },
        { area: 'Malleshwaram', pincode: '560003' },
        { area: 'BTM Layout', pincode: '560029' },
        { area: 'HSR Layout', pincode: '560102' }
      ],
      'Chennai': [
        { area: 'T. Nagar', pincode: '600017' },
        { area: 'Anna Nagar', pincode: '600040' },
        { area: 'Adyar', pincode: '600020' },
        { area: 'Velachery', pincode: '600042' },
        { area: 'OMR', pincode: '600119' },
        { area: 'Nungambakkam', pincode: '600034' },
        { area: 'Mylapore', pincode: '600004' },
        { area: 'Guindy', pincode: '600032' }
      ]
    };

    const areas = cityAreas[city] || [];

    res.json({
      city: city,
      areas: areas,
      message: `Available areas and pincodes for ${city}`,
      note: 'Select your area for more accurate hospital recommendations'
    });
  } catch (error) {
    console.error('Areas fetch error:', error);
    res.status(500).json({
      error: 'Unable to fetch areas',
      areas: []
    });
  }
});

/**
 * Generate hospital-specific tips
 */
function generateHospitalTips(hospital, condition, pincode) {
  const tips = [];
  
  if (hospital.isGovernment) {
    tips.push('Government hospital - treatment is free or heavily subsidized');
    tips.push('Carry ID proof for registration');
    tips.push('Visit early morning for shorter queues');
  } else {
    tips.push('Private hospital - call ahead to check fees');
    tips.push('Confirm doctor availability before visit');
  }
  
  if (hospital.waitTimeCategory === 'high') {
    tips.push('Expect longer waiting time - carry essentials');
  }
  
  return tips;
}

/**
 * Generate condition-specific tips
 */
function generateConditionTips(condition, pincode, recommendations) {
  const tips = [];
  const lowerCondition = condition.toLowerCase();
  
  if (lowerCondition.includes('emergency') || lowerCondition.includes('accident')) {
    tips.push('Call hospital before going to confirm availability');
    tips.push('Keep patient stable during transport');
  }
  
  if (lowerCondition.includes('heart') || lowerCondition.includes('chest pain')) {
    tips.push('Seek immediate medical attention for chest pain');
    tips.push('Avoid physical exertion while traveling to hospital');
  }
  
  if (recommendations.some(r => r.category === 'Government Hospital')) {
    tips.push('Government hospitals provide affordable treatment');
    tips.push('Bring any medical documents if available');
  }
  
  // Area-specific traffic tips based on pincode
  const currentHour = new Date().getHours();
  if (currentHour >= 17 && currentHour <= 21) {
    if (pincode.startsWith('5')) {
      tips.push('Evening traffic in Hyderabad - allow extra travel time');
    } else if (pincode.startsWith('56')) {
      tips.push('Evening traffic in Bangalore - allow extra travel time');
    } else if (pincode.startsWith('6')) {
      tips.push('Evening traffic in Chennai - allow extra travel time');
    }
  }
  
  return tips;
}

module.exports = router;