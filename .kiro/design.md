# Design Document: What's Up Doc Healthcare Navigation Platform

## Overview

What's Up Doc is an AI-powered healthcare navigation platform that helps patients in India find appropriate healthcare facilities based on symptom severity. The system uses a two-stage AI assessment (Claude Haiku for triage, Claude Sonnet for full assessment) combined with geospatial facility matching to provide rapid healthcare guidance without medical diagnosis.

The platform addresses critical healthcare navigation problems:
- Patients rushing to expensive private hospitals for minor issues
- Visiting facilities lacking required specialization
- Emergency response delays

By implementing conservative emergency detection and evidence-based facility routing, the system aims to achieve 95%+ emergency detection accuracy and 80%+ appropriate care routing.

## Architecture

The system follows a three-tier architecture with React frontend, Node.js backend, and Python assessment service.

### Current Implementation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (React)                     │
│  - Anonymous access (no login required)                     │
│  - Pincode + symptom input                                  │
│  - WhatsApp-style clarifying questions                      │
│  - Interactive Leaflet map with facility markers            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Node.js + Express)                │
│  - Facility search with PostGIS geospatial queries          │
│  - Progressive radius expansion (3→5→10→20km)               │
│  - AWS Location Service for pincode geocoding              │
│  - Proxy to Python assessment service                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ↓                         ↓
┌──────────────────┐    ┌──────────────────────┐
│ PostgreSQL +     │    │ Assessment Service   │
│ PostGIS          │    │ (Python + Bedrock)   │
│                  │    │                      │
│ - Hospital data  │    │ - Stage 1: Haiku     │
│ - Geospatial     │    │   (triage)           │
│   queries        │    │ - Stage 2: Sonnet    │
│ - Specialties    │    │   (full assessment)  │
└──────────────────┘    └──────────────────────┘
```

### Service Architecture Patterns

**Progressive Radius Expansion**: When no facilities found, automatically expand search radius (3km → 5km → 10km → 20km) with user notification.

**Two-Stage AI Assessment**: 
- Stage 1 (Haiku): Fast triage, emergency detection, clarifying question generation
- Stage 2 (Sonnet): Full severity assessment with contextual analysis

**Conservative Emergency Detection**: Prioritize false positives over false negatives for safety.

**Government Facility Prioritization**: For mild/moderate cases, rank government facilities higher to reduce patient costs.

## Core Components

### 1. Symptom Assessment Engine (Python + AWS Bedrock)

**Purpose**: Process natural language symptom input and generate severity scores (1-10) without medical diagnosis.

**Two-Stage Flow**:

**Stage 1 - Haiku Triage**:
```python
# Fast initial assessment
- Emergency keyword detection (chest pain, severe bleeding, breathlessness, etc.)
- Body system identification (Cardiology, Respiratory, etc.)
- Clarifying question generation (max 2 questions)
- Red flag identification
```

**Stage 2 - Sonnet Full Assessment**:
```python
# Detailed severity scoring
- Severity score (1-10)
- Severity level (mild/moderate/high/emergency)
- Recommended departments/specialties
- Recommended action for patient
- Clinical reasoning
```

**Interface**:
```typescript
interface AssessmentRequest {
  symptoms: string;
  clarifyingAnswers?: string[];
  stage1Cache?: object;
  age?: number;
  duration?: string;
}

interface AssessmentResponse {
  severity: number; // 1-10
  severityLevel: 'mild' | 'moderate' | 'high' | 'emergency';
  specialties: string[];
  primaryDepartment: string;
  recommendedAction: string;
  reasoning: string;
  isAutoEmergency: boolean;
  detectedKeywords: string[];
  needsClarification: boolean;
  clarifyingQuestions: string[];
  stage1Cache: object | null;
  redFlags: string[];
  disclaimer: string;
  assessmentMode: string;
}
```

**AI Prompting Strategy**:
- Medical context for Indian healthcare system
- Conservative emergency detection instructions
- Explicit "never diagnose" instructions
- Severity scoring rubric based on clinical triage
- Multi-language support (Hindi/English/Hinglish)

### 2. Emergency Detection System

**Purpose**: Identify life-threatening symptoms requiring immediate medical attention.

**Detection Algorithm**:
1. **Keyword Matching**: Real-time scanning for emergency terms in multiple languages
2. **Contextual Analysis**: Claude Haiku evaluates symptom combinations
3. **Conservative Flagging**: Err on side of caution
4. **Multi-language Support**: Hindi, English, Hinglish

**Emergency Keywords**:
```python
EMERGENCY_KEYWORDS = {
  'chest pain', 'seena dard', 'heart attack', 'dil ka daura',
  'difficulty breathing', 'saans nahi', 'can not breathe',
  'unconscious', 'behosh', 'passed out',
  'seizure', 'fits', 'daura', 'convulsion',
  'stroke', 'paralysis', 'face drooping',
  'severe bleeding', 'tez khoon',
  'labour pain', 'prasav dard', 'water broke',
  'poisoning', 'overdose', 'snake bite'
}
```

**Response Protocol**:
- Immediate severity upgrade to 9-10
- Skip non-critical clarifying questions
- Display prominent warning banner
- Show ambulance numbers (108/102)
- Route only to emergency-capable facilities

### 3. Healthcare Facility Routing Engine (Node.js + PostGIS)

**Purpose**: Match patients to appropriate facilities based on severity, location, and capabilities.

**Severity-Based Routing Configuration**:
```javascript
const SEVERITY_CONFIG = {
  mild: {
    careTypes: ['Hospital', 'Dispensary/ Poly Clinic', 'Health Centre', 'Clinic'],
    initialRadius: 5,
    level: 'Mild'
  },
  moderate: {
    careTypes: ['Hospital', 'Clinic', 'Nursing Home', 'Medical College / Institute/Hospital'],
    initialRadius: 8,
    level: 'Moderate'
  },
  high: {
    careTypes: ['Hospital', 'Medical College / Institute/Hospital'],
    initialRadius: 12,
    level: 'High'
  },
  emergency: {
    emergencyOnly: true,
    careTypes: ['Hospital', 'Medical College / Institute/Hospital'],
    initialRadius: 12,
    level: 'Emergency'
  }
};
```

**Progressive Search Algorithm**:
```javascript
// Two-pass search strategy
Pass 1 (Strict): Filter by care type + specialty + distance
Pass 2 (Relaxed): Filter by care type + distance (ignore specialty)

// Radius expansion steps
[3km, 5km, 10km, 20km, 30km, 50km]

// If no facilities found at any radius:
- Display "No facilities found" message
- Show emergency contact numbers
```

**Geospatial Queries (PostGIS)**:
```sql
-- Distance-based search with facility type filtering
SELECT 
  id, hospital_name, hospital_care_type,
  ST_X(location::geometry) AS longitude,
  ST_Y(location::geometry) AS latitude,
  (ST_Distance(location, ST_MakePoint($lng, $lat)::geography) / 1000) AS distance_km
FROM hospitals
WHERE ST_DWithin(location, ST_MakePoint($lng, $lat)::geography, $radiusMetres)
  AND location IS NOT NULL
  AND hospital_care_type = ANY($careTypes)
ORDER BY location <-> ST_MakePoint($lng, $lat)::geography
LIMIT 20;
```

**Facility Prioritization**:
- **Mild/Moderate**: Government facilities ranked higher
- **High/Emergency**: Distance and emergency capability prioritized
- **AYUSH requests**: AYUSH facilities ranked first, then by distance

### 4. Location Services (AWS Location Service + PostGIS)

**Purpose**: Convert pincode to coordinates and calculate facility distances.

**Geocoding Strategy** (3-tier fallback):
```javascript
// Strategy 1: AWS Location Service (primary)
- Most accurate pincode center
- Uses Amazon Location Service API
- Returns lat/lng for pincode

// Strategy 2: Database exact pincode (fallback)
- Average coordinates of all hospitals in pincode
- Uses PostGIS AVG(ST_Y), AVG(ST_X)

// Strategy 3: District centroid (last resort)
- Average coordinates of all hospitals in district
- Used when pincode has no hospitals
```

**Distance Calculation**:
- PostGIS `ST_Distance` for accurate geodesic distance
- Results in kilometers with 1 decimal precision
- Sorted by proximity using PostGIS `<->` operator

### 5. Interactive Map Visualization (Leaflet)

**Purpose**: Display facilities on interactive map with color-coded markers.

**Map Features**:
- OpenStreetMap tiles via CartoDB
- Color-coded radius circle based on severity
- Custom hospital markers with severity color
- Popup cards with facility details
- Auto-zoom to fit all markers + radius circle
- Scale control and zoom controls

**Severity Color Coding**:
```javascript
const SEVERITY_COLORS = {
  mild: '#10b981',      // Green
  moderate: '#f59e0b',  // Orange
  high: '#f97316',      // Dark Orange
  emergency: '#ef4444'  // Red
};
```

## Data Models

### Current Database Schema (PostgreSQL + PostGIS)

```sql
CREATE TABLE hospitals (
  id SERIAL PRIMARY KEY,
  hospital_name VARCHAR(255),
  hospital_category VARCHAR(100),
  hospital_care_type VARCHAR(100),
  discipline TEXT,
  discipline_clean TEXT[],
  ayush BOOLEAN,
  state VARCHAR(100),
  district VARCHAR(100),
  pincode VARCHAR(10),
  address TEXT,
  specialties_array TEXT[],
  facilities_array TEXT[],
  emergency_available BOOLEAN,
  emergency_num VARCHAR(20),
  ambulance_phone VARCHAR(20),
  bloodbank_phone VARCHAR(20),
  telephone VARCHAR(20),
  mobile_number VARCHAR(20),
  total_beds INTEGER,
  data_quality_norm INTEGER,
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Geospatial indexes
CREATE INDEX idx_hospitals_location ON hospitals USING GIST (location);
CREATE INDEX idx_hospitals_pincode ON hospitals (pincode);
CREATE INDEX idx_hospitals_care_type ON hospitals (hospital_care_type);
CREATE INDEX idx_hospitals_emergency ON hospitals (emergency_available);
```

### Frontend State Management

```typescript
// AppWithSymptoms.js state
interface AppState {
  currentPhase: 1 | 2 | 'chat';  // 1=landing, 2=results, chat=clarifying
  pincode: string;
  condition: string;
  isEmergency: boolean;
  assessmentResult: AssessmentResponse | null;
  recommendations: Hospital[];
  searchRadius: number | null;
  expansionMessage: string | null;
  
  // Clarifying questions flow
  clarifyingQuestions: string[];
  clarifyingAnswers: string[];
  stage1Cache: object | null;
  waitingForAnswers: boolean;
  
  // WhatsApp-style chat
  chatLog: ChatMessage[];
  chatQIndex: number;
  chatInput: string;
  chatTyping: boolean;
  
  // Filters
  showSarkari: boolean;
  showPrivate: boolean;
  showAyush: boolean;
  
  // Emergency state
  showEmergencyWarning: boolean;
  emergencyKeywordsDetected: string[];
  
  // Map
  map: Leaflet.Map | null;
  markersRef: Leaflet.Marker[];
}
```

## User Experience Flow

### Phase 1: Landing Page
1. User enters 6-digit pincode
2. User describes symptoms in natural language (Hindi/English/Hinglish)
3. Optional: Toggle emergency mode for immediate emergency routing
4. Click "Search" to begin assessment

### Phase 2: Clarifying Questions (if needed)
1. WhatsApp-style chat interface appears
2. AI asks 1-2 clarifying questions in same language as input
3. User answers each question
4. System proceeds to full assessment

### Phase 3: Results Display
1. Severity badge displayed (Mild/Moderate/High/Emergency)
2. List of facilities sorted by relevance
3. Interactive map with color-coded markers
4. Facility cards show:
   - Name, type, category (Government/Private/AYUSH)
   - Distance in km
   - Contact numbers
   - Emergency availability
5. Filters for Government/Private/AYUSH facilities
6. Emergency banner if emergency detected

## Error Handling

### Assessment Service Failures

**Retry Strategy with Exponential Backoff + Jitter**:

The system implements different retry strategies based on urgency:

#### 🔴 Emergency AI Assessment (isEmergency = true)
- **Max Retries**: 2 attempts
- **Base Delay**: 500ms
- **Jitter**: ±100ms (20%)
- **Max Total Wait**: ~1.5 seconds
- **Fallback**: Show all nearby emergency facilities immediately

```javascript
// Emergency retry logic
const emergencyRetry = {
  maxAttempts: 2,
  baseDelay: 500,
  jitter: 0.2,
  timeout: 5000,
  fallback: 'show_emergency_facilities'
};

// Delay calculation: baseDelay * (2^attempt) * (1 + random(-jitter, +jitter))
// Attempt 1: 500ms * 1 * (0.8-1.2) = 400-600ms
// Attempt 2: 500ms * 2 * (0.8-1.2) = 800-1200ms
```

#### 🟢 Non-Emergency AI Assessment (isEmergency = false)
- **Max Retries**: 3-4 attempts
- **Base Delay**: 1000ms
- **Jitter**: ±200ms (20%)
- **Max Total Wait**: ~15 seconds
- **Fallback**: Show all nearby hospitals with warning

```javascript
// Non-emergency retry logic
const nonEmergencyRetry = {
  maxAttempts: 4,
  baseDelay: 1000,
  jitter: 0.2,
  timeout: 10000,
  fallback: 'show_all_nearby_facilities'
};

// Delay calculation: baseDelay * (2^attempt) * (1 + random(-jitter, +jitter))
// Attempt 1: 1000ms * 1 * (0.8-1.2) = 800-1200ms
// Attempt 2: 1000ms * 2 * (0.8-1.2) = 1600-2400ms
// Attempt 3: 1000ms * 4 * (0.8-1.2) = 3200-4800ms
// Attempt 4: 1000ms * 8 * (0.8-1.2) = 6400-9600ms
```

**Jitter Benefits**:
- Prevents thundering herd problem when multiple users retry simultaneously
- Distributes load more evenly across time
- Reduces likelihood of synchronized retry storms

**Implementation Example**:
```javascript
async function assessWithRetry(symptoms, isEmergency) {
  const config = isEmergency ? emergencyRetry : nonEmergencyRetry;
  
  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      const result = await assessmentService.assess(symptoms, {
        timeout: config.timeout
      });
      return result;
    } catch (error) {
      if (attempt === config.maxAttempts - 1) {
        // Final attempt failed, use fallback
        return handleFallback(config.fallback, isEmergency);
      }
      
      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
      const jitterRange = exponentialDelay * config.jitter;
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      const delay = exponentialDelay + jitter;
      
      console.log(`Retry attempt ${attempt + 1} after ${delay.toFixed(0)}ms`);
      await sleep(delay);
    }
  }
}

function handleFallback(fallbackType, isEmergency) {
  if (fallbackType === 'show_emergency_facilities') {
    return {
      severity: 10,
      severityLevel: 'emergency',
      specialties: ['Emergency'],
      recommendedAction: 'AI service unavailable. Showing all emergency facilities.',
      fallbackMode: true
    };
  } else {
    return {
      severity: 5,
      severityLevel: 'moderate',
      specialties: ['General Medicine'],
      recommendedAction: 'AI service unavailable. Showing all nearby facilities.',
      fallbackMode: true
    };
  }
}
```

**User Experience During Retries**:
- Display loading indicator with retry count
- Show message: "Assessing symptoms... (Attempt 2 of 4)"
- For emergency: Fast failure with immediate fallback
- For non-emergency: Patient retry with progress indication

**Other Assessment Failures**:
- **Invalid Input**: Request user to provide symptom description
- **Timeout**: Included in retry logic above
- **Rate Limiting**: Show error message, suggest waiting 1 minute

### Facility Search Failures
- **No Facilities Found**: Progressive radius expansion with notification
- **Pincode Not Found**: Display error, suggest checking pincode
- **Database Connection Error**: Show error message with retry option (max 2 retries, 2s delay)

### Emergency Detection
- **False Negative Risk**: Multiple detection layers (keyword + AI context)
- **Language Processing Errors**: Default to showing all nearby hospitals

## Performance Considerations

### Response Time Targets
- Symptom assessment: < 3 seconds (Stage 1), < 5 seconds (Stage 2)
- Pincode geocoding: < 1 second
- Facility search: < 2 seconds
- Map rendering: < 1 second

### Optimization Strategies
- PostGIS spatial indexes for fast geospatial queries
- AWS Location Service caching for common pincodes
- Limit facility results to 20 per search
- Progressive radius expansion to minimize query time
- Leaflet map lazy loading

## Security & Privacy

### Current Implementation
- **Anonymous Access**: No user authentication required
- **No Data Persistence**: Symptom data not stored in database
- **HTTPS**: All API communication encrypted in transit
- **CORS**: Restricted to frontend domain
- **Input Validation**: Sanitize all user inputs

### Medical Disclaimers
- Displayed on all assessment results
- "Not a medical diagnosis. Consult a healthcare provider."
- Emergency contact numbers always visible
- Clear language about system limitations

## Testing Strategy

### Unit Tests
- Emergency keyword detection
- Severity level mapping
- Facility filtering logic
- Distance calculations
- Pincode validation

### Integration Tests
- End-to-end symptom assessment flow
- Facility search with various severity levels
- Progressive radius expansion
- Emergency detection and routing
- Multi-language input handling

### Performance Tests
- Concurrent user load testing
- Database query performance
- AI service response time
- Map rendering performance

### Property-Based Tests
See requirements.md for detailed correctness properties that should hold across all valid inputs.
