// Severity-Based Facility Routing System

/**
 * All care types that actually exist in India's hospital DB.
 * Most facilities are typed "Hospital" — the severity difference
 * is expressed via initialRadius, bed count, and emergency_available,
 * NOT by trying to find "Dispensary" or "PHC" which rarely appear.
 */
const ALL_FACILITY_TYPES = [
  'Hospital',
  'Multi Speciality',
  'Multi-specialty Hospital',
  'Clinic',
  'Nursing Home',
  'Health Centre',
  'PHC',
  'CHC',
  'Dispensary',
  'Emergency Centre',
  'Trauma Centre',
  'Maternity Home',
  'Eye Hospital',
  'Dental Clinic',
  'Ayurvedic Hospital',
  'Homeopathic Hospital',
  'Unani Hospital',
  'Yoga and Naturopathy',
];

/**
 * Routing configuration based on severity levels.
 *
 * KEY CHANGE: facilityTypes now includes "Hospital" at every level
 * because that's what the DB actually contains. Differentiation is
 * done by radius size and (for emergency) emergency_available flag.
 */
export const routingConfig = {
  mild: {
    level: 'Mild',
    facilityTypes: ALL_FACILITY_TYPES, // accept everything — just keep radius small
    initialRadius: 5,
    color: '#10b981',
    icon: '🟢'
  },
  moderate: {
    level: 'Moderate',
    facilityTypes: ALL_FACILITY_TYPES,
    initialRadius: 8,
    color: '#f59e0b',
    icon: '🟡'
  },
  high: {
    level: 'High',
    facilityTypes: ALL_FACILITY_TYPES,
    initialRadius: 12,
    color: '#f97316',
    icon: '🟠'
  },
  emergency: {
    level: 'Emergency',
    facilityTypes: ALL_FACILITY_TYPES,
    initialRadius: 12,
    requiresEmergency24x7: false, // ← don't hard-block on this; most DBs leave it null
    color: '#ef4444',
    icon: '🔴'
  }
};

/**
 * Progressive radius expansion steps (km)
 */
export const radiusExpansionSteps = [3, 5, 10, 20];

/**
 * Get expansion message for UI
 */
export function getExpansionMessage(fromRadius, toRadius) {
  const messages = {
    '3-5':   'No facilities found nearby. Searching a wider area (5km)...',
    '5-10':  'Still searching... expanding to 10km radius',
    '10-20': 'Expanding to 20km — showing best available options',
    'none':  'No facilities found within 20km. Please call 108 for emergency assistance.'
  };
  const key = `${fromRadius}-${toRadius}`;
  return messages[key] || messages['none'];
}

/**
 * Filter facilities based on severity and radius.
 *
 * For emergency severity: prefer hospitals with emergency_available=true
 * but DO NOT exclude others — fall back to all hospitals if none have it.
 */
export function filterFacilitiesBySeverity(facilities, severityLevel, radius) {
  const config = routingConfig[severityLevel];

  if (!config) {
    console.warn(`Unknown severity level: ${severityLevel}`);
    return facilities;
  }

  // Filter by radius only (facility type is now permissive)
  const withinRadius = facilities.filter(facility => {
    const dist = parseFloat(facility.distance_km);
    return isNaN(dist) || dist <= radius;
  });

  // For emergency: try to return emergency-capable hospitals first
  if (severityLevel === 'emergency') {
    const emergencyFacilities = withinRadius.filter(f => f.emergency_available);
    // Only use emergency filter if we actually found some; otherwise show all
    if (emergencyFacilities.length > 0) return emergencyFacilities;
  }

  return withinRadius;
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

  for (const radius of radiusExpansionSteps) {
    if (radius < config.initialRadius) continue;

    const filtered = filterFacilitiesBySeverity(allFacilities, severityLevel, radius);

    if (filtered.length > 0) {
      results.facilities = filtered;
      results.radiusUsed = radius;
      results.wasExpanded = radius > config.initialRadius;
      break;
    }

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
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
        userLat, userLon,
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
  if (!config) return { icon: '⚪', label: 'Unknown', color: '#94a3b8', bgColor: '#94a3b820', borderColor: '#94a3b8' };
  return {
    icon:        config.icon,
    label:       config.level,
    color:       config.color,
    bgColor:     `${config.color}20`,
    borderColor: config.color
  };
}