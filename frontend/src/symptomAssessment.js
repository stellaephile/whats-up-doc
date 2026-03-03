/**
 * symptomAssessment.js (FRONTEND)
 *
 * Calls backend /api/assess which runs two-stage Bedrock assessment.
 * Preserves the exact same assessmentService.assess() interface
 * so AppWithSymptoms.js needs zero changes.
 *
 * Two-round flow:
 *   Round 1: assess(symptoms) → may return needsClarification=true + questions
 *   Round 2: assess(symptoms, { clarifyingAnswers, stage1Cache }) → full result
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
const ASSESS_URL   = process.env.REACT_APP_ASSESS_URL || 'http://localhost:8001';

// ── Instant client-side emergency check ──────────────────────
// Fires BEFORE the API call so the red banner appears immediately
// for obvious emergencies like "chest pain"
const INSTANT_EMERGENCY_TERMS = [
  'chest pain', 'heart attack', 'cardiac arrest',
  'not breathing', 'cannot breathe', "can't breathe", 'saans nahi',
  'unconscious', 'behosh', 'passed out',
  'seizure', 'convulsion', 'fits', 'daura',
  'stroke', 'paralysis', 'face drooping',
  'severe bleeding', 'bleeding heavily', 'tez khoon',
  'labour pain', 'water broke', 'pani toot gaya', 'prasav dard',
  'baby not moving', 'newborn not breathing',
  'poisoning', 'overdose', 'suicidal',
  'snake bite', 'anaphylaxis', 'throat swelling',
  'seena dard', 'dil ka daura'
];

function instantEmergencyCheck(text) {
  const lower = text.toLowerCase();
  const found = INSTANT_EMERGENCY_TERMS.filter(k => lower.includes(k));
  return { isEmergency: found.length > 0, keywords: found };
}

// ── Assessment Service ────────────────────────────────────────

class AssessmentService {
  /**
   * Assess symptoms via Bedrock (through backend).
   *
   * @param {string[]} symptomIds       - Legacy selected symptom IDs (may be empty)
   * @param {string}   condition        - Free text from input box
   * @param {object}   options
   * @param {string[]} options.clarifyingAnswers - Answers from user (empty on first call)
   * @param {object}   options.stage1Cache       - Cache from first call (null on first call)
   * @param {string}   options.age               - Patient age
   * @param {string}   options.duration          - How long symptoms present
   */
  async assess(symptomIds = [], condition = '', options = {}) {
    // Build combined symptom text
    const parts = [];
    if (symptomIds.length > 0) parts.push(symptomIds.join(', '));
    if (condition.trim())       parts.push(condition.trim());
    const symptomText = parts.join('. ');

    if (!symptomText.trim()) {
      return this._fallback('Please describe your symptoms.');
    }

    // Instant emergency check — no API wait
    const instant = instantEmergencyCheck(symptomText);

    try {
      const response = await fetch(`${ASSESS_URL}/api/assess`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms:          symptomText,
          clarifyingAnswers: options.clarifyingAnswers || [],
          stage1Cache:       options.stage1Cache       || null,
          age:               options.age               || null,
          duration:          options.duration          || null,
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `API error ${response.status}`);
      }

      const data = await response.json();

      // Map backend response → shape AppWithSymptoms.js expects
      return {
        // ── Core routing (used by severity-based hospital search) ──
        severity:      data.severity,
        severityLevel: data.severityLevel,
        specialties:   data.specialties || ['General Medicine'],

        // ── Emergency flags (used by warning banner) ──────────────
        isAutoEmergency:  data.isAutoEmergency || instant.isEmergency,
        detectedKeywords: data.detectedKeywords?.length > 0
                            ? data.detectedKeywords
                            : instant.keywords,
        requiresTrauma:         data.requiresTrauma         || false,
        requiresMaternityWard:  data.requiresMaternityWard  || false,
        requiresNICU:           data.requiresNICU           || false,

        // ── Clarifying questions flow ──────────────────────────────
        needsClarification:  data.needsClarification  || false,
        clarifyingQuestions: data.clarifyingQuestions || [],
        stage1Cache:         data.stage1Cache         || null,

        // ── Display fields ─────────────────────────────────────────
        primaryDepartment:  data.primaryDepartment,
        recommendation:     data.recommendedAction,
        reasoning:          data.reasoning,
        recommendedAction:  data.recommendedAction,
        redFlags:           data.redFlags    || [],
        disclaimer:         data.disclaimer  || 'This is not a medical diagnosis.',
        assessmentMode:     data.assessmentMode,

        // Legacy field — keeps existing recommendation display working
        metadata: {
          method:     data.assessmentMode,
          department: data.primaryDepartment,
        }
      };

    } catch (err) {
      console.error('❌ Assessment API failed:', err.message);

      // If API is completely down, use instant check + safe defaults
      return this._clientFallback(symptomText, instant);
    }
  }

  // ── Client-side fallback (API unreachable) ──────────────────
  _clientFallback(symptomText, instant) {
    console.warn('⚠️ Using client-side fallback assessment');

    if (instant.isEmergency) {
      const isObstetric = ['labour','prasav','water broke','baby not moving']
        .some(t => symptomText.toLowerCase().includes(t));

      return {
        severity:             9,
        severityLevel:        'emergency',
        specialties:          isObstetric ? ['Obstetrics', 'Emergency'] : ['Emergency'],
        isAutoEmergency:      true,
        detectedKeywords:     instant.keywords,
        requiresTrauma:       ['accident','injury','trauma'].some(t => symptomText.toLowerCase().includes(t)),
        requiresMaternityWard: isObstetric,
        requiresNICU:         false,
        needsClarification:   false,
        clarifyingQuestions:  [],
        stage1Cache:          null,
        primaryDepartment:    isObstetric ? 'Obstetrics' : 'Emergency',
        recommendation:       isObstetric
                                ? 'Go to nearest hospital with maternity ward immediately.'
                                : 'Call 108 immediately or go to nearest emergency dept.',
        recommendedAction:    isObstetric
                                ? 'Go to nearest hospital with maternity ward immediately.'
                                : 'Call 108 immediately.',
        reasoning:            'Emergency symptoms detected (offline assessment).',
        redFlags:             instant.keywords,
        disclaimer:           'This is not a medical diagnosis.',
        assessmentMode:       'client-fallback',
        metadata:             { method: 'client-fallback' }
      };
    }

    // Basic dept detection for non-emergency offline fallback
    const lower     = symptomText.toLowerCase();
    const deptMap   = {
      'chest': 'Cardiology',    'heart': 'Cardiology',
      'breathing': 'Pulmonology', 'cough': 'Pulmonology',
      'stomach': 'Gastroenterology', 'abdomen': 'Gastroenterology',
      'headache': 'Neurology',  'head': 'Neurology',
      'skin': 'Dermatology',    'rash': 'Dermatology',
      'eye': 'Ophthalmology',   'ear': 'ENT', 'throat': 'ENT',
      'joint': 'Orthopedics',   'bone': 'Orthopedics', 'back': 'Orthopedics',
      'child': 'Pediatrics',    'baby': 'Pediatrics', 'bachha': 'Pediatrics',
      'pregnant': 'Obstetrics', 'pregnancy': 'Obstetrics', 'labour': 'Obstetrics',
      'period': 'Gynecology',   'tooth': 'Dental',
      'urine': 'Urology',       'mental': 'Psychiatry', 'anxiety': 'Psychiatry',
    };
    let dept = 'General Medicine';
    for (const [kw, d] of Object.entries(deptMap)) {
      if (lower.includes(kw)) { dept = d; break; }
    }

    const isHigh = ['severe','high fever','tez bukhar','blood','confusion','dengue'].some(t => lower.includes(t));

    return {
      severity:            isHigh ? 7 : 3,
      severityLevel:       isHigh ? 'high' : 'mild',
      specialties:         [dept],
      isAutoEmergency:     false,
      detectedKeywords:    [],
      requiresTrauma:      false,
      requiresMaternityWard: false,
      requiresNICU:        false,
      needsClarification:  false,
      clarifyingQuestions: [],
      stage1Cache:         null,
      primaryDepartment:   dept,
      recommendation:      isHigh ? 'Visit a hospital soon.' : 'Visit a nearby clinic.',
      recommendedAction:   isHigh ? 'Visit a hospital soon.' : 'Visit a nearby clinic.',
      reasoning:           'AI assessment unavailable. Showing nearby hospitals.',
      redFlags:            [],
      disclaimer:          'This is not a medical diagnosis.',
      assessmentMode:      'client-fallback',
      metadata:            { method: 'client-fallback' }
    };
  }

  // ── Empty input fallback ────────────────────────────────────
  _fallback(message) {
    return {
      severity:            3,
      severityLevel:       'mild',
      specialties:         ['General Medicine'],
      isAutoEmergency:     false,
      detectedKeywords:    [],
      requiresTrauma:      false,
      requiresMaternityWard: false,
      requiresNICU:        false,
      needsClarification:  false,
      clarifyingQuestions: [],
      stage1Cache:         null,
      primaryDepartment:   'General Medicine',
      recommendation:      message,
      recommendedAction:   message,
      reasoning:           message,
      redFlags:            [],
      disclaimer:          'This is not a medical diagnosis.',
      assessmentMode:      'fallback',
      metadata:            { method: 'fallback' }
    };
  }
}

// ── Exports ───────────────────────────────────────────────────

export const assessmentService = new AssessmentService();

// Keep these exports so nothing else in your app breaks
export const emergencyKeywords = INSTANT_EMERGENCY_TERMS;

export const symptomOptions = [
  { id: 'fever',      label: 'Fever',           category: 'General',        severity: 4 },
  { id: 'cough',      label: 'Cough',            category: 'Respiratory',    severity: 2 },
  { id: 'headache',   label: 'Headache',         category: 'General',        severity: 2 },
  { id: 'stomach',    label: 'Stomach Pain',     category: 'Gastroenterology', severity: 5 },
  { id: 'chest_pain', label: 'Chest Pain',       category: 'Cardiology',     severity: 10 },
  { id: 'back_pain',  label: 'Back Pain',        category: 'Orthopedics',    severity: 4 },
  { id: 'skin_rash',  label: 'Skin Rash',        category: 'Dermatology',    severity: 3 },
  { id: 'child_fever',label: 'Child Fever',      category: 'Pediatrics',     severity: 6 },
  { id: 'pregnancy',  label: 'Pregnancy Issue',  category: 'Obstetrics',     severity: 6 },
  { id: 'eye',        label: 'Eye Problem',      category: 'Ophthalmology',  severity: 4 },
  { id: 'tooth',      label: 'Toothache',        category: 'Dental',         severity: 3 },
  { id: 'breathing',  label: 'Breathing Problem',category: 'Respiratory',    severity: 8 },
  { id: 'seizure',    label: 'Seizure / Fits',   category: 'Emergency',      severity: 10 },
  { id: 'unconscious',label: 'Unconscious',      category: 'Emergency',      severity: 10 },
];

export function createAssessmentService() {
  return new AssessmentService();
}