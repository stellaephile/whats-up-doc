/**
 * Hospital Data Service - Integrates with data.gov.in National Hospital Directory
 * Provides filtered Delhi hospital data with specialty mapping
 */

const fallbackData = require('./fallback-hospital-data');

class HospitalDataService {
  constructor() {
    this.apiKey = process.env.DATA_GOV_IN_API_KEY;
    this.baseUrl = 'https://api.data.gov.in/resource/98fa254e-c5f8-4910-a19b-4828939b477d';
    this.cache = new Map(); // In-memory cache for session data
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    this.useFallback = false; // Use live API data from data.gov.in
  }

  /**
   * Find hospitals by medical specialty/condition
   * @param {string} condition - Medical condition or specialty
   * @param {Object} location - User's approximate location
   * @returns {Promise<Array>} Recommended hospitals
   */
  async findHospitalsByCondition(condition, location = null) {
    // For now, use fallback data with Delhi Health-Hacker logic
    if (this.useFallback) {
      return this.findHospitalsFromFallback(condition, location);
    }

    // Future: API integration when Delhi data is available
    try {
      const specialty = this.mapConditionToSpecialty(condition);
      const hospitals = await this.getDelhiHospitals({ specialty });
      return this.applyLocalRecommendationLogic(hospitals, condition, location);
    } catch (error) {
      console.log('API failed, using fallback data:', error.message);
      return this.findHospitalsFromFallback(condition, location);
    }
  }

  /**
   * Find hospitals using fallback data with Delhi Health-Hacker logic
   */
  findHospitalsFromFallback(condition, location) {
    let hospitals = [...fallbackData.getAllHospitals()];
    
    // Apply Delhi Health-Hacker specialty routing
    hospitals = this.applyDelhiSpecialtyLogic(hospitals, condition);
    
    // Sort by proximity if location provided
    if (location && location.latitude && location.longitude) {
      hospitals = this.sortByDistance(hospitals, location);
    }
    
    // Apply recommendation scoring
    hospitals = this.rankHospitals(hospitals, condition);
    
    return hospitals.slice(0, 5); // Return top 5 recommendations
  }

  /**
   * Apply Delhi Health-Hacker specialty routing logic
   */
  applyDelhiSpecialtyLogic(hospitals, condition) {
    const lowerCondition = condition.toLowerCase();
    
    // Cardiac conditions → G.B. Pant Hospital priority
    if (lowerCondition.includes('chest pain') || lowerCondition.includes('heart') || lowerCondition.includes('cardiac')) {
      hospitals = this.prioritizeHospital(hospitals, 'G.B. Pant');
    }
    
    // Dog bites → RML Hospital priority
    if (lowerCondition.includes('dog bite') || lowerCondition.includes('animal bite') || lowerCondition.includes('rabies')) {
      hospitals = this.prioritizeHospital(hospitals, 'Ram Manohar Lohia');
    }
    
    // Emergency/Accident → AIIMS Trauma, Safdarjung
    if (lowerCondition.includes('accident') || lowerCondition.includes('trauma') || lowerCondition.includes('emergency')) {
      hospitals = this.prioritizeHospital(hospitals, 'AIIMS');
      hospitals = this.prioritizeHospital(hospitals, 'Safdarjung');
    }
    
    // Burns → Safdarjung Burns Unit
    if (lowerCondition.includes('burn') || lowerCondition.includes('fire')) {
      hospitals = this.prioritizeHospital(hospitals, 'Safdarjung');
    }
    
    // Maternity → Lady Hardinge, Lok Nayak
    if (lowerCondition.includes('pregnancy') || lowerCondition.includes('maternity') || lowerCondition.includes('delivery')) {
      hospitals = this.prioritizeHospital(hospitals, 'Lady Hardinge');
      hospitals = this.prioritizeHospital(hospitals, 'Lok Nayak');
    }
    
    // Pediatric → Kalawati Saran
    if (lowerCondition.includes('child') || lowerCondition.includes('baby') || lowerCondition.includes('pediatric')) {
      hospitals = this.prioritizeHospital(hospitals, 'Kalawati Saran');
    }
    
    // Minor issues → Mohalla Clinics first
    if (lowerCondition.includes('fever') || lowerCondition.includes('cold') || lowerCondition.includes('minor')) {
      hospitals = this.prioritizeCategory(hospitals, 'Mohalla Clinic');
    }
    
    return hospitals;
  }

  /**
   * Get emergency hospitals
   */
  async getEmergencyHospitals(location = null) {
    let hospitals = fallbackData.getEmergencyHospitals();
    
    if (location && location.latitude && location.longitude) {
      hospitals = this.sortByDistance(hospitals, location);
    }
    
    return hospitals.slice(0, 3);
  }

  /**
   * Map medical conditions to specialties
   */
  mapConditionToSpecialty(condition) {
    const conditionMap = {
      'chest pain': 'Cardiology',
      'heart': 'Cardiology',
      'cardiac': 'Cardiology',
      'dog bite': 'Emergency Medicine',
      'animal bite': 'Emergency Medicine',
      'accident': 'Trauma Surgery',
      'burns': 'Plastic Surgery',
      'fever': 'General Medicine',
      'surgery': 'General Surgery',
      'maternity': 'Obstetrics and Gynaecology',
      'pregnancy': 'Obstetrics and Gynaecology',
      'child': 'Paediatrics',
      'pediatric': 'Paediatrics'
    };

    const lowerCondition = condition.toLowerCase();
    for (const [key, specialty] of Object.entries(conditionMap)) {
      if (lowerCondition.includes(key)) {
        return specialty;
      }
    }
    
    return 'General Medicine';
  }

  /**
   * Prioritize hospitals by name pattern
   */
  prioritizeHospital(hospitals, namePattern) {
    return hospitals.sort((a, b) => {
      const aMatch = a.name.toLowerCase().includes(namePattern.toLowerCase());
      const bMatch = b.name.toLowerCase().includes(namePattern.toLowerCase());
      
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }

  /**
   * Prioritize hospitals by category
   */
  prioritizeCategory(hospitals, category) {
    return hospitals.sort((a, b) => {
      const aMatch = a.category.toLowerCase().includes(category.toLowerCase());
      const bMatch = b.category.toLowerCase().includes(category.toLowerCase());
      
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }

  /**
   * Sort hospitals by distance from user location
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
   * Calculate distance between two points using Haversine formula
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
   * Rank hospitals based on Delhi Health-Hacker criteria
   */
  rankHospitals(hospitals, condition) {
    return hospitals.map(hospital => ({
      ...hospital,
      recommendationScore: this.calculateRecommendationScore(hospital, condition)
    })).sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  /**
   * Calculate recommendation score for a hospital
   */
  calculateRecommendationScore(hospital, condition) {
    let score = 0;
    
    // Base score for government hospitals (free treatment)
    if (hospital.isGovernment) score += 30;
    
    // Emergency services availability
    if (hospital.emergencyServices) score += 20;
    
    // Specialty match bonus
    if (hospital.specialties) {
      const specialty = this.mapConditionToSpecialty(condition);
      if (hospital.specialties.some(s => s.toLowerCase().includes(specialty.toLowerCase()))) {
        score += 40;
      }
    }
    
    // Wait time consideration
    if (hospital.waitTimeCategory === 'low') score += 15;
    if (hospital.waitTimeCategory === 'high') score -= 10;
    
    // Distance bonus (if available)
    if (hospital.distance) {
      if (hospital.distance < 5) score += 10;
      if (hospital.distance > 15) score -= 5;
    }
    
    return score;
  }

  /**
   * Get Delhi areas for location selection
   */
  getDelhiAreas() {
    return [
      'Central Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi',
      'New Delhi', 'Connaught Place', 'Karol Bagh', 'Lajpat Nagar', 'Saket',
      'Dwarka', 'Rohini', 'Janakpuri', 'Vasant Kunj', 'Greater Kailash',
      'Defence Colony', 'Khan Market', 'Nehru Place', 'Chandni Chowk',
      'Rajouri Garden', 'Pitampura', 'Mayur Vihar', 'Laxmi Nagar'
    ].sort();
  }

  // Future API integration methods (when Delhi data becomes available)
  async getDelhiHospitals(filters = {}) {
    // Implementation for when API data is available
    throw new Error('API integration pending - using fallback data');
  }
}

module.exports = HospitalDataService;