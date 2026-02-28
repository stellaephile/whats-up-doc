// Symptom Assessment System
// Phase 1: Rule-based logic (current)
// Phase 2: Can be swapped with Amazon Bedrock/GenAI with zero frontend changes

// Emergency keywords that trigger automatic emergency routing
export const emergencyKeywords = [
  // Cardiac emergencies
  'chest pain', 'heart attack', 'cardiac arrest', 'heart pain',
  
  // Breathing emergencies
  'breathlessness', 'can\'t breathe', 'cannot breathe', 'difficulty breathing',
  'shortness of breath', 'gasping', 'choking', 'suffocating',
  
  // Bleeding emergencies
  'severe bleeding', 'heavy bleeding', 'bleeding heavily', 'blood loss',
  'hemorrhage', 'bleeding profusely',
  
  // Neurological emergencies
  'stroke', 'paralysis', 'face drooping', 'arm weakness', 'speech difficulty',
  'loss of consciousness', 'unconscious', 'passed out', 'fainted', 'collapsed',
  'seizure', 'convulsion', 'fitting',
  
  // Trauma emergencies
  'severe injury', 'major accident', 'head injury', 'severe trauma',
  'broken bone', 'fracture', 'severe burn',
  
  // Other critical conditions
  'poisoning', 'overdose', 'suicide attempt', 'severe allergic reaction',
  'anaphylaxis', 'severe pain', 'unbearable pain'
];

// Predefined symptom options with severity weights
export const symptomOptions = [
  // Mild symptoms (1-3)
  { id: 'cold', label: 'Common Cold', category: 'Respiratory', severity: 2 },
  { id: 'cough', label: 'Mild Cough', category: 'Respiratory', severity: 2 },
  { id: 'headache', label: 'Headache', category: 'General', severity: 2 },
  { id: 'fatigue', label: 'Fatigue', category: 'General', severity: 2 },
  { id: 'sore_throat', label: 'Sore Throat', category: 'Respiratory', severity: 2 },
  { id: 'skin_rash', label: 'Skin Rash (mild)', category: 'Dermatology', severity: 3 },
  { id: 'minor_cut', label: 'Minor Cut/Wound', category: 'General', severity: 2 },
  
  // Moderate symptoms (4-6)
  { id: 'fever_low', label: 'Fever (99-101°F)', category: 'General', severity: 4 },
  { id: 'stomach_pain', label: 'Stomach Pain', category: 'Gastroenterology', severity: 5 },
  { id: 'vomiting', label: 'Vomiting', category: 'Gastroenterology', severity: 5 },
  { id: 'diarrhea', label: 'Diarrhea', category: 'Gastroenterology', severity: 5 },
  { id: 'back_pain', label: 'Back Pain', category: 'Orthopedics', severity: 4 },
  { id: 'joint_pain', label: 'Joint Pain', category: 'Orthopedics', severity: 4 },
  { id: 'ear_pain', label: 'Ear Pain', category: 'ENT', severity: 5 },
  { id: 'tooth_pain', label: 'Toothache', category: 'Dental', severity: 5 },
  
  // High severity (7-8)
  { id: 'fever_high', label: 'High Fever (>102°F)', category: 'General', severity: 7 },
  { id: 'breathing_difficulty', label: 'Difficulty Breathing', category: 'Respiratory', severity: 8 },
  { id: 'severe_pain', label: 'Severe Pain', category: 'General', severity: 7 },
  { id: 'bleeding', label: 'Heavy Bleeding', category: 'General', severity: 8 },
  { id: 'fracture', label: 'Suspected Fracture', category: 'Orthopedics', severity: 7 },
  { id: 'burn', label: 'Burn (moderate to severe)', category: 'General', severity: 7 },
  
  // Emergency (9-10)
  { id: 'chest_pain', label: 'Chest Pain', category: 'Cardiology', severity: 10 },
  { id: 'unconscious', label: 'Loss of Consciousness', category: 'Emergency', severity: 10 },
  { id: 'seizure', label: 'Seizure', category: 'Neurology', severity: 10 },
  { id: 'stroke_symptoms', label: 'Stroke Symptoms (FAST)', category: 'Neurology', severity: 10 },
  { id: 'severe_injury', label: 'Severe Injury/Trauma', category: 'Emergency', severity: 10 },
  { id: 'poisoning', label: 'Poisoning/Overdose', category: 'Emergency', severity: 10 },
  { id: 'severe_allergic', label: 'Severe Allergic Reaction', category: 'Emergency', severity: 9 }
];

// Specialty mapping based on symptoms
const specialtyMap = {
  'Respiratory': ['General Medicine', 'Pulmonology', 'ENT'],
  'Cardiology': ['Cardiology', 'Emergency Medicine'],
  'Gastroenterology': ['Gastroenterology', 'General Medicine'],
  'Orthopedics': ['Orthopedics', 'General Surgery'],
  'Neurology': ['Neurology', 'Emergency Medicine'],
  'Dermatology': ['Dermatology', 'General Medicine'],
  'ENT': ['ENT', 'General Medicine'],
  'Dental': ['Dental'],
  'Emergency': ['Emergency Medicine', 'Trauma Care'],
  'General': ['General Medicine']
};

/**
 * Assessment Service Interface
 * This interface ensures any implementation (rule-based or AI) returns the same contract
 */
class AssessmentService {
  /**
   * Assess symptoms and return severity + specialty
   * @param {Array<string>} symptomIds - Selected symptom IDs
   * @param {string} additionalNotes - Free text notes from user
   * @returns {Promise<AssessmentResult>}
   */
  async assess(symptomIds, additionalNotes = '') {
    throw new Error('assess() must be implemented');
  }
}

/**
 * AssessmentResult interface
 * @typedef {Object} AssessmentResult
 * @property {number} severity - Severity score 1-10
 * @property {string} severityLevel - 'mild' | 'moderate' | 'high' | 'emergency'
 * @property {Array<string>} specialties - Recommended specialties
 * @property {string} recommendation - Human-readable recommendation
 * @property {Object} metadata - Additional metadata (for debugging/logging)
 */

/**
 * Phase 1: Rule-Based Assessment (Current Implementation)
 */
class RuleBasedAssessment extends AssessmentService {
  async assess(symptomIds, additionalNotes = '') {
    // Simulate slight delay (like an API call)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // CRITICAL: Check for emergency keywords first
    const emergencyDetected = this._detectEmergencyKeywords(additionalNotes);
    
    if (emergencyDetected.isEmergency) {
      // Automatic emergency routing
      return {
        severity: 10,
        severityLevel: 'emergency',
        specialties: ['Emergency Medicine', 'Trauma Care'],
        recommendation: '🚨 LIFE-THREATENING EMERGENCY DETECTED: Seek immediate medical attention. Call 108 NOW.',
        isAutoEmergency: true,
        detectedKeywords: emergencyDetected.keywords,
        metadata: { 
          method: 'rule-based', 
          version: '1.0',
          emergencyAutoDetected: true,
          trigger: 'keyword_detection'
        }
      };
    }
    
    if (!symptomIds || symptomIds.length === 0) {
      return {
        severity: 2,
        severityLevel: 'mild',
        specialties: ['General Medicine'],
        recommendation: 'Please select symptoms for better assessment',
        metadata: { method: 'rule-based', version: '1.0' }
      };
    }

    // Get selected symptoms
    const selectedSymptoms = symptomOptions.filter(s => symptomIds.includes(s.id));
    
    // Calculate severity (use highest severity among selected symptoms)
    const maxSeverity = Math.max(...selectedSymptoms.map(s => s.severity));
    
    // Adjust severity based on number of symptoms (multiple symptoms = higher severity)
    let adjustedSeverity = maxSeverity;
    if (selectedSymptoms.length >= 3) {
      adjustedSeverity = Math.min(10, maxSeverity + 1);
    }
    
    // Determine severity level
    const severityLevel = this._getSeverityLevel(adjustedSeverity);
    
    // Get specialties from selected symptoms
    const categories = [...new Set(selectedSymptoms.map(s => s.category))];
    const specialties = [...new Set(
      categories.flatMap(cat => specialtyMap[cat] || ['General Medicine'])
    )];
    
    // Generate recommendation
    const recommendation = this._generateRecommendation(adjustedSeverity, specialties);
    
    return {
      severity: adjustedSeverity,
      severityLevel,
      specialties,
      recommendation,
      metadata: {
        method: 'rule-based',
        version: '1.0',
        selectedSymptoms: selectedSymptoms.map(s => s.label),
        categories
      }
    };
  }
  
  _detectEmergencyKeywords(text) {
    if (!text) return { isEmergency: false, keywords: [] };
    
    const lowerText = text.toLowerCase();
    const detectedKeywords = emergencyKeywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
    
    return {
      isEmergency: detectedKeywords.length > 0,
      keywords: detectedKeywords
    };
  }
  
  _getSeverityLevel(severity) {
    if (severity >= 9) return 'emergency';
    if (severity >= 7) return 'high';
    if (severity >= 4) return 'moderate';
    return 'mild';
  }
  
  _generateRecommendation(severity, specialties) {
    if (severity >= 9) {
      return '🚨 EMERGENCY: Seek immediate medical attention. Call 108 if needed.';
    }
    if (severity >= 7) {
      return `⚠️ HIGH PRIORITY: Visit a hospital with ${specialties[0]} department soon.`;
    }
    if (severity >= 4) {
      return `🟡 MODERATE: Schedule an appointment with ${specialties[0]} within 24-48 hours.`;
    }
    return `🟢 MILD: Visit a nearby clinic or health center when convenient.`;
  }
}

/**
 * Phase 2: AI-Based Assessment (Future Implementation)
 * This class shows how GenAI/Bedrock can be integrated without changing frontend
 */
class AIBasedAssessment extends AssessmentService {
  constructor(apiEndpoint) {
    super();
    this.apiEndpoint = apiEndpoint;
  }
  
  async assess(symptomIds, additionalNotes = '') {
    // Future implementation: Call Amazon Bedrock/Claude API
    // The frontend will never know the difference!
    
    const selectedSymptoms = symptomOptions.filter(s => symptomIds.includes(s.id));
    
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symptoms: selectedSymptoms.map(s => s.label),
        additionalNotes,
        timestamp: new Date().toISOString()
      })
    });
    
    const result = await response.json();
    
    // AI response must conform to the same AssessmentResult interface
    return {
      severity: result.severity,
      severityLevel: result.severityLevel,
      specialties: result.specialties,
      recommendation: result.recommendation,
      metadata: {
        method: 'ai-based',
        model: result.model || 'bedrock-claude',
        confidence: result.confidence
      }
    };
  }
}

/**
 * Assessment Factory
 * Switch between implementations via environment variable or config
 */
export function createAssessmentService() {
  // Check environment or config to determine which service to use
  const useAI = process.env.REACT_APP_USE_AI_ASSESSMENT === 'true';
  const aiEndpoint = process.env.REACT_APP_AI_ASSESSMENT_ENDPOINT;
  
  if (useAI && aiEndpoint) {
    console.log('Using AI-based assessment service');
    return new AIBasedAssessment(aiEndpoint);
  }
  
  console.log('Using rule-based assessment service');
  return new RuleBasedAssessment();
}

// Export the service instance
export const assessmentService = createAssessmentService();
