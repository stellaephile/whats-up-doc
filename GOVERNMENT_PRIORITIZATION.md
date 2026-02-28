# Government Facility Prioritization Feature

## Overview

The system now includes **Government/Private/AYUSH filtering** and **automatic government facility prioritization** for mild to moderate severity cases.

## Features Implemented

### 1. Filter Checkboxes (Results Page)

Three filter checkboxes allow users to show/hide facility types:

- **🔵 Sarkari (Govt)** - Government hospitals, PHCs, dispensaries
- **🔴 Private** - Private hospitals, clinics, nursing homes
- **🟢 AYUSH** - Ayurveda, Homeopathy, Yoga facilities

**Location:** Results page sidebar header

**Behavior:**
- All filters enabled by default
- Real-time filtering (no page reload)
- Updates facility count dynamically
- Filters apply to both list and map

### 2. Government Facility Prioritization

**Rule:** For mild to moderate severity assessments, government facilities are ranked higher than private facilities in search results.

**When Applied:**
- ✅ Severity Level: Mild (1-3)
- ✅ Severity Level: Moderate (4-6)
- ❌ Severity Level: High (7-8) - Distance-based only
- ❌ Severity Level: Emergency (9-10) - Distance-based only

**Sorting Logic:**
```javascript
// For mild to moderate cases:
1. Government facilities (sorted by distance)
2. Private facilities (sorted by distance)
3. AYUSH facilities (sorted by distance)

// For high and emergency cases:
1. All facilities sorted by distance only (no government priority)
```

**Visual Indicators:**
- Government facilities show **⭐ Prioritized** badge
- Blue notice: "💡 Government facilities prioritized for cost-effective care"

### 3. Facility Type Badges

Each hospital card shows:
- **Facility Type Badge** (PHC, Clinic, Hospital, etc.) - Color-coded by severity
- **Govt/Private/AYUSH Indicator** - Color-coded dot + label
  - 🔵 Blue dot = Sarkari (Government)
  - 🔴 Red dot = Private
  - 🟢 Green dot = AYUSH
- **Priority Badge** (for government facilities in mild/moderate cases)

## User Experience

### Mild Severity Example

**Search:** "common cold and headache" in pincode 560001

**Results Display:**
```
💡 Government facilities prioritized for cost-effective care

[✓] Sarkari (Govt)  [✓] Private  [✓] AYUSH

4 Facilities Found | Within 3km

1. Primary Health Center - Indiranagar ⭐ Prioritized
   🔵 SARKARI | PHC | 1.5 km away

2. Government Dispensary - Koramangala ⭐ Prioritized
   🔵 SARKARI | Dispensary | 2.1 km away

3. City Care Clinic
   🔴 PRIVATE | Clinic | 1.8 km away

4. Ayurvedic Wellness Center
   🟢 AYUSH | Clinic | 2.3 km away
```

### Moderate Severity Example

**Search:** "fever and stomach pain" in pincode 560038

**Results Display:**
```
💡 Government facilities prioritized for cost-effective care

[✓] Sarkari (Govt)  [✓] Private  [✓] AYUSH

6 Facilities Found | Within 5km

1. District Government Hospital ⭐ Prioritized
   🔵 SARKARI | Hospital | 2.7 km away

2. Government General Hospital ⭐ Prioritized
   🔵 SARKARI | Hospital | 3.1 km away

3. Sunshine Nursing Home
   🔴 PRIVATE | Nursing Home | 2.5 km away

4. City Care Clinic
   🔴 PRIVATE | Clinic | 3.2 km away
```

### High Severity Example

**Search:** "high fever difficulty breathing" in pincode 560095

**Results Display:**
```
[✓] Sarkari (Govt)  [✓] Private  [✓] AYUSH

5 Facilities Found | Within 10km

(No government prioritization - sorted by distance only)

1. Apollo Hospitals
   🔴 PRIVATE | Multi-specialty Hospital | 4.5 km away

2. Fortis Hospital
   🔴 PRIVATE | Multi-specialty Hospital | 4.8 km away

3. Manipal Hospital
   🔴 PRIVATE | Multi-specialty Hospital | 5.2 km away
```

### Emergency Example

**Search:** "chest pain" in pincode 560002

**Results Display:**
```
🚨 Emergency Mode
Showing nearest 24x7 facilities only
[Call 108 Emergency]

[✓] Sarkari (Govt)  [✓] Private  [✓] AYUSH

3 Facilities Found | Within 10km

(No government prioritization - sorted by distance only)

1. Victoria Hospital Emergency & Trauma Center
   🔵 SARKARI | Emergency Centre | 2.1 km away

2. Apollo Hospitals Emergency
   🔴 PRIVATE | Multi-specialty Hospital | 2.3 km away
```

## Filter Interaction

### Scenario 1: Uncheck "Private"
- Private facilities hidden from list
- Government and AYUSH facilities remain
- Facility count updates
- Map markers update

### Scenario 2: Uncheck "Sarkari"
- Government facilities hidden
- Private and AYUSH facilities remain
- Government prioritization still applies to remaining facilities
- Facility count updates

### Scenario 3: Only "AYUSH" checked
- Only AYUSH facilities shown
- All other facilities hidden
- Useful for users specifically seeking alternative medicine

## Implementation Details

### Filter Function
```javascript
getFilteredAndPrioritizedHospitals(hospitals, severityLevel) {
  // Step 1: Filter by checkboxes
  let filtered = hospitals.filter(hospital => {
    const isGovernment = hospital.isGovernment || 
                        hospital.category?.includes('government');
    const isAyush = hospital.category?.includes('ayush');
    const isPrivate = !isGovernment && !isAyush;

    if (isGovernment && !showSarkari) return false;
    if (isPrivate && !showPrivate) return false;
    if (isAyush && !showAyush) return false;

    return true;
  });

  // Step 2: Prioritize government for mild/moderate
  if (severityLevel === 'mild' || severityLevel === 'moderate') {
    filtered = filtered.sort((a, b) => {
      const aIsGov = a.isGovernment || a.category?.includes('government');
      const bIsGov = b.isGovernment || b.category?.includes('government');
      
      // Government facilities come first
      if (aIsGov && !bIsGov) return -1;
      if (!aIsGov && bIsGov) return 1;
      
      // If both same type, sort by distance
      return (a.distance_km || 0) - (b.distance_km || 0);
    });
  }

  return filtered;
}
```

### State Management
```javascript
const [showSarkari, setShowSarkari] = useState(true);
const [showPrivate, setShowPrivate] = useState(true);
const [showAyush, setShowAyush] = useState(true);
```

### Visual Indicators
```javascript
// Government Priority Badge (mild/moderate only)
{isGovernment && (severityLevel === 'mild' || severityLevel === 'moderate') && (
  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
    ⭐ Prioritized
  </span>
)}

// Facility Type Indicator
<span className={`size-2 rounded-full ${hospitalTypeBg}`}></span>
<span className={`text-xs font-semibold ${hospitalTypeColor}`}>
  {hospitalTypeLabel}
</span>
```

## Benefits

### For Users
1. **Cost Savings** - Government facilities prioritized for routine care
2. **Transparency** - Clear indication of facility type
3. **Choice** - Can filter by preference
4. **Informed Decisions** - Visual indicators help quick identification

### For Healthcare System
1. **Load Distribution** - Directs routine cases to government facilities
2. **Resource Optimization** - Reserves private facilities for complex cases
3. **Accessibility** - Promotes use of public healthcare infrastructure
4. **Equity** - Ensures government facilities are visible and accessible

## Testing

### Test Case 1: Mild Severity with Government Priority
```
1. Enter pincode: 560001
2. Type: "common cold"
3. Click Search
4. Expected:
   - Government facilities listed first
   - ⭐ Prioritized badge shown
   - Blue notice about government priority
   - All filters enabled by default
```

### Test Case 2: Filter Interaction
```
1. Complete Test Case 1
2. Uncheck "Private" filter
3. Expected:
   - Private facilities hidden
   - Only government and AYUSH shown
   - Facility count updates
   - Government facilities still prioritized
```

### Test Case 3: High Severity (No Priority)
```
1. Enter pincode: 560095
2. Type: "high fever difficulty breathing"
3. Click Search
4. Expected:
   - No government priority notice
   - No ⭐ Prioritized badges
   - Facilities sorted by distance only
   - All facility types shown
```

### Test Case 4: Emergency (No Priority)
```
1. Enter pincode: 560002
2. Type: "chest pain"
3. Click Search
4. Expected:
   - Emergency mode banner
   - No government priority
   - Only 24x7 facilities shown
   - Sorted by distance only
```

## Configuration

### Severity Levels with Government Priority
```javascript
const prioritizationConfig = {
  mild: { prioritizeGovernment: true },
  moderate: { prioritizeGovernment: true },
  high: { prioritizeGovernment: false },
  emergency: { prioritizeGovernment: false }
};
```

### Facility Type Colors
```javascript
const facilityColors = {
  government: {
    dot: 'bg-blue-500',
    text: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700'
  },
  private: {
    dot: 'bg-red-500',
    text: 'text-red-600',
    badge: 'bg-red-100 text-red-700'
  },
  ayush: {
    dot: 'bg-green-500',
    text: 'text-green-600',
    badge: 'bg-green-100 text-green-700'
  }
};
```

## Future Enhancements

### Short-Term
- Add filter count badges (e.g., "Sarkari (4)")
- Add "Clear all filters" button
- Remember filter preferences in localStorage

### Long-Term
- Add cost comparison indicators
- Show average wait times
- Add user ratings/reviews
- Insurance acceptance indicators
- Real-time bed availability

## Status

✅ **Implemented:** Government/Private/AYUSH filters
✅ **Implemented:** Government prioritization for mild/moderate
✅ **Implemented:** Visual indicators and badges
✅ **Implemented:** Real-time filtering
✅ **Tested:** All severity levels
✅ **Ready for:** User testing and feedback

---

**Summary:** The system now intelligently prioritizes government facilities for routine care (mild to moderate cases) while maintaining distance-based sorting for urgent cases (high and emergency). Users can filter by facility type and see clear visual indicators for informed decision-making.
