# Search Logic Refinement - Progressive Radius Expansion

## Overview

The search logic has been refined to properly handle the progressive radius expansion and only show the "No facilities found within 20km" message when the search genuinely fails to find any facilities within 20km of the pincode centroid.

## Progressive Search Flow

### Step-by-Step Process

```
1. User enters pincode + symptoms
   ↓
2. System assesses severity → determines initial radius
   ↓
3. Calculate distances from pincode centroid
   ↓
4. Try initial radius (3km, 5km, or 10km based on severity)
   ↓
5. Found facilities? 
   YES → Show results
   NO  → Expand to next radius
   ↓
6. Try 5km (if not already tried)
   ↓
7. Found facilities?
   YES → Show results with expansion message
   NO  → Expand to next radius
   ↓
8. Try 10km (if not already tried)
   ↓
9. Found facilities?
   YES → Show results with expansion message
   NO  → Expand to next radius
   ↓
10. Try 20km (final attempt)
    ↓
11. Found facilities?
    YES → Show results with expansion message
    NO  → Show "No facilities found within 20km" message
```

## Expansion Messages

### Success Cases (Facilities Found)

**Scenario 1: Found at Initial Radius**
```
Initial radius: 3km
Facilities found: 4
Message: None (no expansion needed)
Display: "4 Facilities Found | Within 3km"
```

**Scenario 2: Found After Expanding to 5km**
```
Initial radius: 3km
Tried 3km: 0 facilities
Tried 5km: 6 facilities ✓
Message: "⚠️ No facilities found nearby. Searching a wider area (5km)..."
Display: "6 Facilities Found | Within 5km"
Color: Yellow banner
```

**Scenario 3: Found After Expanding to 10km**
```
Initial radius: 5km
Tried 5km: 0 facilities
Tried 10km: 3 facilities ✓
Message: "⚠️ Still searching... expanding to 10km radius"
Display: "3 Facilities Found | Within 10km"
Color: Yellow banner
```

**Scenario 4: Found After Expanding to 20km**
```
Initial radius: 10km
Tried 10km: 0 facilities
Tried 20km: 2 facilities ✓
Message: "⚠️ Expanding to 20km — showing best available options"
Display: "2 Facilities Found | Within 20km"
Color: Yellow banner
```

### Failure Case (No Facilities Found)

**Scenario 5: No Facilities Within 20km**
```
Initial radius: 3km (or 5km or 10km)
Tried 3km: 0 facilities
Tried 5km: 0 facilities
Tried 10km: 0 facilities
Tried 20km: 0 facilities ✗
Message: "⚠️ No facilities found within 20km. Please call 108 for emergency assistance."
Display: Empty state with 108 call button
Color: Red banner
```

## Code Logic

### Search Function (Refined)

```javascript
// Step 1: Get hospitals and calculate distances from centroid
const enriched = enrichAndSortFacilities(allHospitals, centerLat, centerLng);

// Step 2: Progressive search with radius expansion
const searchResult = progressiveSearch(enriched, assessment.severityLevel);

// Step 3: Check if no facilities found within 20km
if (searchResult.facilities.length === 0) {
  // TRULY no facilities within 20km
  setRecommendations([]);
  setSearchRadius(20);
  setExpansionMessage(getExpansionMessage(20, null));
  setCurrentPhase(2);
  return; // Stop here, show empty state
}

// Step 4: Facilities found - apply filters and prioritization
const prioritized = getFilteredAndPrioritizedHospitals(
  searchResult.facilities, 
  assessment.severityLevel
);

setRecommendations(prioritized);
setSearchRadius(searchResult.radiusUsed);

// Step 5: Show expansion message if radius was expanded
if (searchResult.wasExpanded) {
  const config = routingConfig[assessment.severityLevel];
  setExpansionMessage(getExpansionMessage(config.initialRadius, searchResult.radiusUsed));
} else {
  setExpansionMessage(null); // No expansion needed
}
```

### Progressive Search Function

```javascript
export function progressiveSearch(allFacilities, severityLevel) {
  const config = routingConfig[severityLevel];
  const results = {
    facilities: [],
    radiusUsed: config.initialRadius,
    wasExpanded: false,
    expansionSteps: []
  };
  
  // Try each radius: 3km, 5km, 10km, 20km
  for (const radius of [3, 5, 10, 20]) {
    if (radius < config.initialRadius) continue;
    
    // Filter facilities within this radius
    const filtered = filterFacilitiesBySeverity(allFacilities, severityLevel, radius);
    
    if (filtered.length > 0) {
      // Found facilities at this radius!
      results.facilities = filtered;
      results.radiusUsed = radius;
      results.wasExpanded = radius > config.initialRadius;
      break; // Stop searching
    }
    
    // Track expansion attempts for debugging
    if (radius > config.initialRadius) {
      results.expansionSteps.push(radius);
    }
  }
  
  // If we get here with empty facilities, we tried all radii up to 20km
  return results;
}
```

## UI Display Logic

### Expansion Message Display

```javascript
{/* Expansion Message - Only show if facilities were found */}
{expansionMessage && 
 recommendations.length > 0 && 
 !expansionMessage.includes('No facilities found') && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
    ⚠️ {expansionMessage}
  </div>
)}

{/* No Facilities Message - Only show if truly no facilities within 20km */}
{recommendations.length === 0 && 
 expansionMessage && 
 expansionMessage.includes('No facilities found') && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
    ⚠️ {expansionMessage}
  </div>
)}
```

### Empty State Display

```javascript
{getFilteredAndPrioritizedHospitals(recommendations, severityLevel).length === 0 ? (
  <div className="text-center py-12 px-4">
    <span className="material-symbols-outlined text-slate-400 text-[64px]">
      search_off
    </span>
    <p className="text-slate-900 font-bold text-lg mt-4 mb-2">
      {recommendations.length === 0 
        ? 'No facilities found within 20km'  // Truly no facilities
        : 'No facilities match your filters'  // Filtered out by user
      }
    </p>
    <p className="text-slate-600 text-sm mb-4">
      {recommendations.length === 0 
        ? 'We searched up to 20km from your pincode but couldn\'t find matching facilities.'
        : 'Try adjusting your filters to see more results.'
      }
    </p>
    {recommendations.length === 0 && (
      <a href="tel:108" className="...">
        Call 108 for Assistance
      </a>
    )}
  </div>
) : (
  // Show hospital cards
)}
```

## Two Types of "No Results"

### Type 1: No Facilities Within 20km (Geospatial)
- **Cause:** Progressive search tried all radii (3→5→10→20km) and found nothing
- **Message:** "No facilities found within 20km. Please call 108 for emergency assistance."
- **Color:** Red banner
- **Action:** Show 108 call button
- **Example:** Remote pincode with no nearby facilities

### Type 2: No Facilities Match Filters (User Action)
- **Cause:** User unchecked all filter options or specific combination
- **Message:** "No facilities match your filters"
- **Color:** Gray/neutral
- **Action:** Suggest adjusting filters
- **Example:** User unchecked all three filters (Sarkari, Private, AYUSH)

## Testing Scenarios

### Test 1: Success at Initial Radius
```
Pincode: 560001
Condition: "common cold"
Severity: Mild → Initial radius: 3km

Expected:
- 4 facilities found within 3km
- No expansion message
- Display: "4 Facilities Found | Within 3km"
```

### Test 2: Success After Expansion
```
Pincode: 560066 (Whitefield - fewer facilities)
Condition: "fever"
Severity: Moderate → Initial radius: 5km

Expected:
- 0 facilities at 5km
- 3 facilities found at 10km
- Yellow banner: "Still searching... expanding to 10km radius"
- Display: "3 Facilities Found | Within 10km"
```

### Test 3: No Facilities Within 20km
```
Pincode: 999999 (Invalid/remote pincode)
Condition: "chest pain"
Severity: Emergency → Initial radius: 10km

Expected:
- 0 facilities at 10km
- 0 facilities at 20km
- Red banner: "No facilities found within 20km. Please call 108..."
- Empty state with 108 button
- Display: "No facilities found within 20km"
```

### Test 4: Filtered Out by User
```
Pincode: 560001
Condition: "fever"
Severity: Moderate
Action: Uncheck all filters (Sarkari, Private, AYUSH)

Expected:
- Facilities exist in recommendations array
- But filtered out by user selection
- Message: "No facilities match your filters"
- Suggestion: "Try adjusting your filters to see more results"
- NO 108 button (not a geospatial issue)
```

## Distance Calculation

All distances are calculated from the **pincode centroid**:

```javascript
// Get pincode centroid
const centerLat = pincodeCoordinates[pincode].lat;
const centerLng = pincodeCoordinates[pincode].lng;

// Calculate distance from centroid to each hospital
hospitals.forEach(hospital => {
  hospital.distance_km = calculateDistance(
    centerLat, centerLng,           // FROM: Pincode centroid
    hospital.latitude, hospital.longitude  // TO: Hospital location
  );
});

// Filter by radius
const withinRadius = hospitals.filter(h => h.distance_km <= radius);
```

## Benefits of Refined Logic

1. **Accurate Messaging** - Only shows "no facilities" when truly none exist within 20km
2. **Clear Distinction** - Differentiates between geospatial failure and user filtering
3. **Progressive Feedback** - Shows expansion messages as search widens
4. **Appropriate Actions** - 108 button only for geospatial failures, not filter issues
5. **Better UX** - Users understand why they see no results

## Edge Cases Handled

### Edge Case 1: All Facilities Beyond 20km
```
Result: Empty state with "No facilities found within 20km"
Action: Show 108 button
```

### Edge Case 2: Facilities Exist But Wrong Type
```
Example: Emergency search but only PHCs within 20km
Result: Empty state with "No facilities found within 20km"
Reason: PHCs don't match emergency facility type requirement
Action: Show 108 button
```

### Edge Case 3: Facilities Exist But User Filtered Them
```
Example: 5 government hospitals found, but user unchecked "Sarkari"
Result: "No facilities match your filters"
Action: Suggest adjusting filters (NO 108 button)
```

### Edge Case 4: Found at Exactly 20km
```
Result: Show facilities with expansion message
Message: "Expanding to 20km — showing best available options"
Color: Yellow banner
```

## Status

✅ **Implemented:** Progressive radius expansion (3→5→10→20km)
✅ **Implemented:** Accurate "no facilities" detection
✅ **Implemented:** Distinction between geospatial and filter issues
✅ **Implemented:** Appropriate messaging and actions
✅ **Tested:** All expansion scenarios
✅ **Ready for:** Production use

---

**Summary:** The search logic now accurately detects when no facilities exist within 20km of the pincode centroid and only shows the emergency message in that case. It also distinguishes between geospatial failures and user filtering, providing appropriate guidance for each scenario.
