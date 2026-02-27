# Symptom Assessment & Severity-Based Routing System

## Overview

This system implements a **future-proof symptom assessment architecture** that works with predefined options NOW but is designed so a GenAI/Bedrock component can be dropped in later with **zero frontend changes**.

## Architecture

### Phase 1: Current Implementation (Rule-Based)
- User selects symptoms from predefined options
- Rule-based logic calculates severity score (1-10) + specialty
- Feeds into severity-based facility routing
- **100% functional without any AI/cloud dependencies**

### Phase 2: Future Implementation (AI-Based)
- Same frontend, same API contract
- Only the backend assessment function gets swapped
- Amazon Bedrock/Claude integration
- **Frontend never changes**

## System Components

### 1. Symptom Assessment (`symptomAssessment.js`)

**Key Features:**
- Predefined symptom options with severity weights
- Category-based organization (Respiratory, Cardiology, etc.)
- Specialty mapping for each symptom category
- **Service Interface Pattern** - ensures any implementation returns the same contract

**Assessment Result Interface:**
```javascript
{
  severity: number,           // 1-10 score
  severityLevel: string,      // 'mild' | 'moderate' | 'high' | 'emergency'
  specialties: Array<string>, // Recommended specialties
  recommendation: string,     // Human-readable recommendation
  metadata: Object           // Implementation-specific data
}
```

**Switching Between Implementations:**
```javascript
// Environment variable controls which service to use
REACT_APP_USE_AI_ASSESSMENT=false  // Rule-based (default)
REACT_APP_USE_AI_ASSESSMENT=true   // AI-based (future)
REACT_APP_AI_ASSESSMENT_ENDPOINT=https://api.example.com/assess
```

### 2. Facility Routing (`facilityRouting.js`)

**Severity-Based Routing Rules:**

| Severity Score | Level | Facility Types | Initial Radius |
|---|---|---|---|
| 1-3 | Mild | PHC, Dispensary, Health Centre | 3km |
| 4-6 | Moderate | Clinic, Nursing Home, Hospital | 5km |
| 7-8 | High | Hospital, Multi-specialty Hospital | 10km |
| 9-10 | Emergency | Emergency facilities (24x7 only) | 10km |

**Progressive Radius Expansion:**
- If no facilities found, expands: 3km → 5km → 10km → 20km
- User-friendly messages at each expansion
- Final fallback: "Call 108 for emergency assistance"

### 3. Sample Data (`sampleData.js`)

**Enhanced Hospital Records:**
```javascript
{
  name: string,
  address: string,
  phone: string,
  latitude: number,
  longitude: number,
  isGovernment: boolean,
  category: string,
  facility_type: string,        // NEW: PHC, Clinic, Hospital, etc.
  emergency_24x7: boolean,       // NEW: 24/7 emergency availability
  specialties: Array<string>,
  severity_tags: Array<string>   // NEW: ['mild', 'moderate', 'high', 'emergency']
}
```

**17 Sample Facilities Across Types:**
- 4 PHC/Dispensaries (Mild)
- 3 Clinics/Nursing Homes (Moderate)
- 3 Hospitals (Moderate to High)
- 3 Multi-specialty Hospitals (High to Emergency)
- 2 Emergency Centers (Emergency only)
- 2 AYUSH facilities (Mild to Moderate)

### 4. UI Components

#### SymptomSelector Component
- Multi-select symptom grid
- Category filtering
- Additional notes textarea
- Visual severity indicators (color-coded)
- Emergency call-to-action

#### AppWithSymptoms Component
- **Phase 0:** Symptom selection
- **Phase 1:** Pincode entry with assessment summary
- **Phase 2:** Results with severity-based filtering

## User Flow

```
1. User selects symptoms
   ↓
2. System assesses severity (rule-based or AI)
   ↓
3. User enters pincode
   ↓
4. System applies severity-based routing
   ↓
5. Progressive radius expansion if needed
   ↓
6. Display results with map + radius circle
```

## UI Enhancements

### Results Panel
- **Severity Badge:** Color-coded badge showing priority level
- **Radius Indicator:** "Searching within Xkm"
- **Expansion Banner:** Shows when radius was expanded
- **Emergency Mode:** Red banner + 108 call button for emergencies

### Map Features
- **Radius Circle:** Visual representation of search area
- **Color-Coded:** Matches severity level (green/yellow/orange/red)
- **Animated Expansion:** Circle grows when radius expands
- **Facility Markers:** Color matches severity level

### Edge Cases
- **No facilities at 20km:** Full-screen alert with 108 call button
- **Emergency situations:** Persistent emergency call button
- **Multiple symptoms:** Severity adjustment based on count

## Testing the System

### Local Testing (Sample Data Mode)
1. Toggle "Use Sample Data" ON in the UI
2. Select symptoms (try different severity levels)
3. Enter any 6-digit pincode (e.g., 560001)
4. Observe severity-based routing in action

### Test Scenarios

**Mild Symptoms:**
- Select: "Common Cold" + "Headache"
- Expected: PHC/Dispensaries within 3km
- Facility types: PHC, Dispensary, Health Centre

**Moderate Symptoms:**
- Select: "Fever (99-101°F)" + "Stomach Pain"
- Expected: Clinics/Hospitals within 5km
- Facility types: Clinic, Nursing Home, Hospital

**High Severity:**
- Select: "High Fever (>102°F)" + "Difficulty Breathing"
- Expected: Hospitals within 10km
- Facility types: Hospital, Multi-specialty Hospital

**Emergency:**
- Select: "Chest Pain" or "Loss of Consciousness"
- Expected: Emergency facilities only, 24x7 filter applied
- Facility types: Emergency Centre, Multi-specialty Hospital (with 24x7)
- Red emergency banner + 108 call button

## Future AI Integration

### Backend API Contract (Phase 2)

**Endpoint:** `POST /api/assess-symptoms`

**Request:**
```json
{
  "symptoms": ["Chest Pain", "Difficulty Breathing"],
  "additionalNotes": "Started 30 minutes ago, getting worse",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response (must match AssessmentResult interface):**
```json
{
  "severity": 10,
  "severityLevel": "emergency",
  "specialties": ["Cardiology", "Emergency Medicine"],
  "recommendation": "🚨 EMERGENCY: Seek immediate medical attention. Call 108 if needed.",
  "metadata": {
    "method": "ai-based",
    "model": "bedrock-claude-v3",
    "confidence": 0.95
  }
}
```

### Integration Steps

1. **Deploy AI Assessment Service** (AWS Lambda + Bedrock)
2. **Set Environment Variables:**
   ```bash
   REACT_APP_USE_AI_ASSESSMENT=true
   REACT_APP_AI_ASSESSMENT_ENDPOINT=https://your-api.com/assess
   ```
3. **No Frontend Changes Required** - The service interface handles everything

### AI Implementation Example (Backend)

```python
# AWS Lambda function with Bedrock
import boto3
import json

bedrock = boto3.client('bedrock-runtime')

def assess_symptoms(symptoms, notes):
    prompt = f"""
    Assess the following medical symptoms and provide:
    1. Severity score (1-10)
    2. Severity level (mild/moderate/high/emergency)
    3. Recommended medical specialties
    4. Brief recommendation
    
    Symptoms: {', '.join(symptoms)}
    Additional notes: {notes}
    
    Respond in JSON format matching this structure:
    {{
      "severity": <number>,
      "severityLevel": "<string>",
      "specialties": [<strings>],
      "recommendation": "<string>"
    }}
    """
    
    response = bedrock.invoke_model(
        modelId='anthropic.claude-v3-sonnet',
        body=json.dumps({
            "prompt": prompt,
            "max_tokens": 500
        })
    )
    
    result = json.loads(response['body'].read())
    
    # Add metadata
    result['metadata'] = {
        'method': 'ai-based',
        'model': 'bedrock-claude-v3',
        'confidence': result.get('confidence', 0.9)
    }
    
    return result
```

## Configuration

### Environment Variables

```bash
# Assessment Service
REACT_APP_USE_AI_ASSESSMENT=false
REACT_APP_AI_ASSESSMENT_ENDPOINT=

# Sample Data Mode (for testing)
REACT_APP_USE_SAMPLE_DATA=true

# API Endpoints (production)
REACT_APP_API_BASE_URL=https://api.whats-up-doc.com
```

### Feature Flags

Toggle in UI:
- **Sample Data Mode:** Use local sample data vs. live API
- **AI Assessment:** Rule-based vs. AI-based (via env var)

## Benefits of This Architecture

1. **Zero Frontend Changes:** Swap implementations without touching UI code
2. **Testable:** Works 100% locally with sample data
3. **Gradual Migration:** Can run rule-based in production while testing AI
4. **Fallback Ready:** If AI service fails, can fallback to rule-based
5. **Cost Effective:** Only pay for AI when you're ready
6. **Type Safe:** Interface ensures consistency across implementations

## Files Structure

```
frontend/src/
├── symptomAssessment.js      # Assessment service (rule-based + AI interface)
├── facilityRouting.js         # Severity-based routing logic
├── sampleData.js              # Enhanced sample hospital data
├── SymptomSelector.js         # Symptom selection UI component
├── AppWithSymptoms.js         # Main app with 3-phase flow
└── SYMPTOM_SYSTEM_README.md   # This file
```

## Next Steps

1. **Test locally** with sample data
2. **Refine routing rules** based on real-world feedback
3. **Expand sample data** with more facilities
4. **Deploy backend API** for severity-based search
5. **Integrate AI assessment** when ready (Phase 2)

## Support

For questions or issues:
- Check the inline code comments
- Review the AssessmentService interface
- Test with different symptom combinations
- Verify sample data has correct facility_type values
