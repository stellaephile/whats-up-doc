# Bug Fix Notes

## Issue: Runtime Error on Map Initialization

### Error Message
```
Cannot read properties of null (reading 'severityLevel')
TypeError: Cannot read properties of null (reading 'severityLevel')
    at initializeMap
```

### Root Cause
The `initializeMap` function was trying to access `assessmentResult.severityLevel` from the component state, but the state variable `assessmentResult` was still `null` when the function was called.

This happened because:
1. User submits search form
2. `handleSearch` function runs
3. Assessment is calculated locally: `const assessment = await assessmentService.assess(...)`
4. State is updated: `setAssessmentResult(assessment)`
5. Map initialization is called: `initializeMap(...)`
6. BUT: React state updates are asynchronous, so `assessmentResult` state is still `null`
7. `initializeMap` tries to access `assessmentResult.severityLevel` → ERROR

### Solution
Pass the assessment result directly as a parameter to `initializeMap` instead of relying on the state variable.

**Before:**
```javascript
const assessment = await assessmentService.assess(...);
setAssessmentResult(assessment);

// Later...
initializeMap(facilities, radius, lat, lng);

// Inside initializeMap:
const config = routingConfig[assessmentResult.severityLevel]; // ❌ assessmentResult is null
```

**After:**
```javascript
const assessment = await assessmentService.assess(...);
setAssessmentResult(assessment);

// Later...
initializeMap(facilities, radius, lat, lng, assessment); // ✅ Pass assessment directly

// Inside initializeMap:
const initializeMap = (hospitals, radius, centerLat, centerLng, assessment) => {
  const config = routingConfig[assessment.severityLevel]; // ✅ Use parameter
}
```

### Files Modified
- `frontend/src/AppWithSymptoms.js`
  - Updated `initializeMap` function signature to accept `assessment` parameter
  - Updated both calls to `initializeMap` to pass the assessment result

### Testing
After fix:
1. Enter pincode: 560001
2. Type condition: "fever"
3. Click Search
4. ✅ Map initializes correctly with severity-based color
5. ✅ No runtime errors

### Lesson Learned
When using React state in asynchronous operations, be careful about timing. If you need a value immediately after setting state, use the local variable instead of the state variable, since state updates are asynchronous.

### Status
✅ Fixed
✅ Tested
✅ Deployed to dev server
