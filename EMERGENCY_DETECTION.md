# Emergency Detection and Response System

## Overview

The system now includes **automatic emergency keyword detection** that immediately flags life-threatening conditions, displays urgent warnings, and routes users to emergency facilities only.

## Emergency Keywords Detected

### Cardiac Emergencies
- chest pain
- heart attack
- cardiac arrest
- heart pain

### Breathing Emergencies
- breathlessness
- can't breathe / cannot breathe
- difficulty breathing
- shortness of breath
- gasping
- choking
- suffocating

### Bleeding Emergencies
- severe bleeding
- heavy bleeding
- bleeding heavily
- blood loss
- hemorrhage
- bleeding profusely

### Neurological Emergencies
- stroke
- paralysis
- face drooping
- arm weakness
- speech difficulty
- loss of consciousness
- unconscious
- passed out
- fainted
- collapsed
- seizure
- convulsion
- fitting

### Trauma Emergencies
- severe injury
- major accident
- head injury
- severe trauma
- broken bone
- fracture
- severe burn

### Other Critical Conditions
- poisoning
- overdose
- suicide attempt
- severe allergic reaction
- anaphylaxis
- severe pain
- unbearable pain

## Automatic Emergency Response Flow

```
User types condition text
   ↓
System scans for emergency keywords
   ↓
Emergency keyword detected?
   ↓ YES
┌──────────────────────────────────────┐
│  AUTOMATIC EMERGENCY RESPONSE        │
├──────────────────────────────────────┤
│ 1. Set severity = 10 (Emergency)    │
│ 2. Show life-threatening warning    │
│ 3. Display 108/102 call buttons     │
│ 4. Route to emergency facilities    │
│ 5. Skip non-critical questions      │
└──────────────────────────────────────┘
   ↓
Show emergency warning banner
   ↓
User can still search for facilities
   ↓
Results show ONLY emergency facilities
```

## User Experience

### Scenario 1: Emergency Keyword Detected on Landing Page

**User Input:**
```
Pincode: 560001
Condition: "chest pain and breathlessness"
```

**System Response:**
1. **Immediate Warning Banner** (Red, Pulsing)
   ```
   ⚠️ LIFE-THREATENING EMERGENCY DETECTED
   
   Emergency keywords detected: chest pain, breathlessness
   
   This appears to be a medical emergency. DO NOT WAIT.
   Call emergency services immediately.
   
   [CALL 108 NOW]  [Call 102 (Ambulance)]
   
   You can still search for nearby emergency facilities below,
   but calling emergency services should be your first priority.
   ```

2. **Auto-scroll** to warning banner
3. **Search still available** but with emergency routing
4. **Results show** only 24x7 emergency facilities

### Scenario 2: Emergency Keyword in Results Page

**After Search:**
```
┌─────────────────────────────────────────────┐
│ EMERGENCY AUTO-DETECTED                     │
│                                             │
│ Keywords: chest pain, breathlessness        │
│                                             │
│ Showing only 24x7 emergency facilities.     │
│ Call 108 immediately if needed.             │
│                                             │
│ [Call 108]  [Call 102]                      │
└─────────────────────────────────────────────┘

🔴 Emergency Priority

3 Emergency Facilities Found | Within 10km

1. Victoria Hospital Emergency & Trauma Center
   🔵 SARKARI | Emergency Centre | 2.1 km
   [Call]

2. Apollo Hospitals Emergency
   🔴 PRIVATE | Multi-specialty Hospital | 2.3 km
   [Call]
```

## Visual Indicators

### Landing Page Warning Banner
- **Color:** Red background (#ef4444)
- **Border:** 4px red border
- **Animation:** Pulsing effect
- **Icon:** Large emergency icon (48px)
- **Text:** Bold, large, urgent messaging
- **Buttons:** 
  - Primary: White background "CALL 108 NOW"
  - Secondary: Dark red "Call 102 (Ambulance)"

### Results Page Banner
- **Color:** Red background
- **Position:** Top of sidebar
- **Content:**
  - "EMERGENCY AUTO-DETECTED" heading
  - Detected keywords list
  - Explanation text
  - 108 and 102 call buttons

### Severity Badge
- **Icon:** 🔴 Red circle
- **Label:** "Emergency Priority"
- **Color:** Red theme throughout

## Emergency Routing Logic

### Automatic Overrides

When emergency is auto-detected:

1. **Severity Override**
   ```javascript
   severity: 10 (maximum)
   severityLevel: 'emergency'
   ```

2. **Facility Type Filter**
   ```javascript
   facilityTypes: ['Emergency Centre', 'Hospital', 'Multi-specialty Hospital']
   requiresEmergency24x7: true
   ```

3. **Specialty Override**
   ```javascript
   specialties: ['Emergency Medicine', 'Trauma Care']
   ```

4. **Recommendation Override**
   ```javascript
   recommendation: '🚨 LIFE-THREATENING EMERGENCY DETECTED: 
                    Seek immediate medical attention. Call 108 NOW.'
   ```

### Assessment Result Structure

```javascript
{
  severity: 10,
  severityLevel: 'emergency',
  specialties: ['Emergency Medicine', 'Trauma Care'],
  recommendation: '🚨 LIFE-THREATENING EMERGENCY DETECTED...',
  isAutoEmergency: true,  // NEW: Indicates auto-detection
  detectedKeywords: ['chest pain', 'breathlessness'],  // NEW: What triggered it
  metadata: {
    method: 'rule-based',
    version: '1.0',
    emergencyAutoDetected: true,  // NEW: Flag for logging
    trigger: 'keyword_detection'   // NEW: How it was detected
  }
}
```

## Implementation Details

### Emergency Keyword Detection

```javascript
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
```

### Assessment Logic (Priority Order)

```javascript
async assess(symptomIds, additionalNotes = '') {
  // STEP 1: Check for emergency keywords FIRST (highest priority)
  const emergencyDetected = this._detectEmergencyKeywords(additionalNotes);
  
  if (emergencyDetected.isEmergency) {
    // Immediate emergency response
    return {
      severity: 10,
      severityLevel: 'emergency',
      specialties: ['Emergency Medicine', 'Trauma Care'],
      recommendation: '🚨 LIFE-THREATENING EMERGENCY DETECTED...',
      isAutoEmergency: true,
      detectedKeywords: emergencyDetected.keywords,
      metadata: { emergencyAutoDetected: true }
    };
  }
  
  // STEP 2: Normal symptom assessment (if no emergency detected)
  // ... rest of assessment logic
}
```

### UI State Management

```javascript
// Emergency detection state
const [showEmergencyWarning, setShowEmergencyWarning] = useState(false);
const [emergencyKeywordsDetected, setEmergencyKeywordsDetected] = useState([]);

// On assessment complete
if (assessment.isAutoEmergency) {
  setShowEmergencyWarning(true);
  setEmergencyKeywordsDetected(assessment.detectedKeywords || []);
  
  // Auto-scroll to warning
  setTimeout(() => {
    document.getElementById('emergency-warning')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, 100);
}
```

## Testing Scenarios

### Test 1: Cardiac Emergency
```
Input: "chest pain and sweating"
Expected:
- ✅ Emergency warning banner appears
- ✅ Keywords shown: "chest pain"
- ✅ 108/102 buttons displayed
- ✅ Auto-scroll to warning
- ✅ Results show only emergency facilities
- ✅ Severity = 10 (Emergency)
```

### Test 2: Breathing Emergency
```
Input: "can't breathe properly"
Expected:
- ✅ Emergency warning banner appears
- ✅ Keywords shown: "can't breathe"
- ✅ Immediate call-to-action
- ✅ Emergency routing activated
```

### Test 3: Multiple Emergency Keywords
```
Input: "severe bleeding and unconscious"
Expected:
- ✅ Emergency warning banner appears
- ✅ Keywords shown: "severe bleeding, unconscious"
- ✅ Both keywords detected and displayed
- ✅ Emergency facilities only
```

### Test 4: Stroke Symptoms
```
Input: "face drooping and speech difficulty"
Expected:
- ✅ Emergency warning banner appears
- ✅ Keywords shown: "face drooping, speech difficulty"
- ✅ FAST stroke protocol implied
- ✅ Emergency routing
```

### Test 5: Non-Emergency (Control)
```
Input: "common cold and headache"
Expected:
- ❌ No emergency warning
- ✅ Normal severity assessment (Mild)
- ✅ PHC/Dispensary routing
- ✅ No 108 buttons on landing page
```

### Test 6: Emergency Toggle vs Auto-Detection
```
Scenario A: User toggles "Current Emergency?" ON
- Manual emergency mode
- No keyword detection needed

Scenario B: User types "chest pain"
- Auto-detected emergency
- Overrides any manual settings
- Shows detected keywords
```

## Emergency Numbers Displayed

### 108 - Emergency Ambulance
- **Primary emergency number** in India
- Free service
- 24x7 availability
- Handles all medical emergencies

### 102 - Ambulance Service
- **Secondary ambulance number**
- State-run service
- Alternative to 108
- Also 24x7

## Benefits

### For Users
1. **Immediate Recognition** - System identifies life-threatening conditions
2. **Clear Guidance** - Explicit instructions to call emergency services
3. **No Delays** - Skips unnecessary questions
4. **Direct Access** - One-tap calling to 108/102
5. **Backup Option** - Can still search for facilities if needed

### For Healthcare System
1. **Faster Response** - Users directed to call immediately
2. **Appropriate Routing** - Only emergency facilities shown
3. **Resource Optimization** - Emergency cases go to equipped facilities
4. **Documentation** - Keywords logged for analysis
5. **Liability Protection** - Clear warnings and guidance provided

## Edge Cases Handled

### Edge Case 1: Partial Keyword Match
```
Input: "chest discomfort"
Result: No emergency (requires exact keyword "chest pain")
Reason: Avoids false positives
```

### Edge Case 2: Keyword in Different Context
```
Input: "my father had chest pain last week"
Result: Emergency detected (keyword present)
Note: Better safe than sorry - system errs on caution
```

### Edge Case 3: Multiple Keywords
```
Input: "chest pain, breathlessness, and sweating"
Result: Emergency detected
Keywords: ["chest pain", "breathlessness"]
Note: All detected keywords shown
```

### Edge Case 4: Misspellings
```
Input: "chestpain" (no space)
Result: May not detect (depends on exact match)
Future: AI assessment will handle variations
```

## Future Enhancements

### Short-Term
- Add more emergency keywords
- Support common misspellings
- Multi-language support (Hindi, regional languages)
- Voice input for emergency situations

### Long-Term (AI Integration)
- Context-aware detection (past tense vs present)
- Severity gradation within emergencies
- Symptom combination analysis
- Real-time triage scoring
- Integration with emergency dispatch systems

## Configuration

### Adding New Emergency Keywords

```javascript
// In symptomAssessment.js
export const emergencyKeywords = [
  // Add new keywords here
  'new emergency keyword',
  'another critical symptom',
  // ...
];
```

### Customizing Warning Messages

```javascript
// In AppWithSymptoms.js
<h3>⚠️ LIFE-THREATENING EMERGENCY DETECTED</h3>
<p>Emergency keywords detected: {keywords}</p>
<p>This appears to be a medical emergency. DO NOT WAIT.</p>
```

### Emergency Numbers by Region

```javascript
// Future: Region-specific emergency numbers
const emergencyNumbers = {
  'IN': { primary: '108', secondary: '102' },
  'US': { primary: '911' },
  'UK': { primary: '999', secondary: '111' },
  // ...
};
```

## Compliance and Legal

### Disclaimers
- System provides guidance, not medical diagnosis
- Users should always call emergency services for life-threatening conditions
- Facility search is supplementary to emergency calls
- No liability for user decisions

### Logging
- Emergency detections logged for quality improvement
- Keywords tracked for pattern analysis
- No personal health information stored
- Compliant with data privacy regulations

## Status

✅ **Implemented:** Emergency keyword detection (40+ keywords)
✅ **Implemented:** Automatic emergency routing
✅ **Implemented:** Life-threatening warning banners
✅ **Implemented:** 108/102 call buttons
✅ **Implemented:** Auto-scroll to warnings
✅ **Implemented:** Emergency-only facility filtering
✅ **Tested:** Multiple emergency scenarios
✅ **Ready for:** Production deployment

---

**Summary:** The system now automatically detects emergency keywords in user input, immediately displays life-threatening warnings with prominent call-to-action buttons for 108/102, and routes users exclusively to 24x7 emergency facilities. This ensures critical cases receive immediate attention and appropriate care.
