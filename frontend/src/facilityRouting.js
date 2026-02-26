// Severity-Based Facility Routing System

/**
 * Routing configuration based on severity levels
 */
export const routingConfig = {
  mild: {
    level: 'Mild',
    facilityTypes: ['PHC', 'Dispensary', 'Health Centre'],
    initialRadius: 3,
    color: '#10b981', // green
    icon: '🟢'
  },
  moderate: {
    level: 'Moderate',
    facilityTypes: ['Clinic', 'Nursing Home', 'Hospital'],
    initialRadius: 5,
    color: '#f59e0b', // yellow/orange
    icon: '🟡'
  },
  high: {
    level: 'High',
    facilityTypes: ['Hospital', 'Multi-specialty Hospital'],
    initialRadius: 10,
    color: '#f97316', // orange
    icon: '🟠'
  },
  emergency: {
    level: 'Emergency',
    facilityTypes: ['Emergency Centre', 'Hospital', 'Multi-specialty Hospital'],
    initialRadius: 10,
    requiresEmergency24x7: true,
    color: '#ef4444', // red
    icon: '🔴'
  }
};

/**
 * Progressive radius expansion steps
 */
export const radiusExpansionSteps = [3, 5, 10, 20];

/**
 * Get expansion message for UI
 */
export function getExpansionMessage(fromRadius, toRadius) {
  const messages = {
    '3-5': 'No facilities found nearby. Searching a wider area (5km)...',
    '5-10': 'Still searching... expanding to 10km radius',
    '10-20': 'Expanding to 20km — showing best available options',
    'none': 'No facilities found within 20km. Please call 108 for emergency assistance.'
  };
  
  const key = `${fromRadius}-${toRadius}`;
  return messages[key] || messages['none'];
}

/**
 * Filter facilities based on severity and radius
 */
export function filterFacilitiesBySeverity(facilities, severityLevel, radius) {
  const config = routingConfig[severityLevel];
  
  if (!config) {
    console.warn(`Unknown severity level: ${severityLevel}`);
    return facilities;
  }
  
  return facilities.filter(facility => {
    // Check facility type
    const matchesFacilityType = config.facilityTypes.includes(facility.facility_type);
    
    // Check emergency requirement
    if (config.requiresEmergency24x7 && !facility.emergency_24x7) {
      return false;
    }
    
    // Check radius (if distance is available)
    if (facility.distance_km && facility.distance_km > radius) {
      return false;
    }
    
    return matchesFacilityType;
  });
}

/**
 * Progressive search with radius expansion
 */
export function progressiveSearch(allFacilities, severityLevel) {
  const config = routingConfig[severityLevel];
  const results = {
    facilities: [],
    radiusUsed: config.initialRadius,
    wasExpanded: false,
    expansionSteps: []
  };
  
  // Try each radius step
  for (const radius of radiusExpansionSteps) {
    if (radius < config.initialRadius) continue;
    
    const filtered = filterFacilitiesBySeverity(allFacilities, severityLevel, radius);
    
    if (filtered.length > 0) {
      results.facilities = filtered;
      results.radiusUsed = radius;
      results.wasExpanded = radius > config.initialRadius;
      break;
    }
    
    // Track expansion attempts
    if (radius > config.initialRadius) {
      results.expansionSteps.push(radius);
    }
  }
  
  return results;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Enrich facilities with distance and sort by distance
 */
export function enrichAndSortFacilities(facilities, userLat, userLon) {
  return facilities
    .map(facility => ({
      ...facility,
      distance_km: calculateDistance(
        userLat,
        userLon,
        parseFloat(facility.latitude),
        parseFloat(facility.longitude)
      )
    }))
    .sort((a, b) => a.distance_km - b.distance_km);
}

/**
 * Get severity badge configuration
 */
export function getSeverityBadge(severityLevel) {
  const config = routingConfig[severityLevel];
  return {
    icon: config.icon,
    label: config.level,
    color: config.color,
    bgColor: `${config.color}20`, // 20% opacity
    borderColor: config.color
  };
}
