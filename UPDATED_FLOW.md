# Updated User Flow - Pincode First with Geospatial Matching

## Overview

The UI has been updated to retain the original landing page design where users enter **pincode + symptoms together** on the first screen. The system then uses the pincode's geospatial centroid to find nearby hospitals based on symptom severity.

## User Flow

```
┌─────────────────────────────────────────────────────────┐
│                    PHASE 1: Landing Page                │
│                                                         │
│  User enters:                                          │
│  1. Pincode (6 digits)                                 │
│  2. Symptoms/Condition (text input)                    │
│  3. Emergency toggle (optional)                        │
│                                                         │
│  Click "Search" →                                      │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│              BACKEND PROCESSING (Automatic)             │
│                                                         │
│  Step 1: Assess symptoms                               │
│  ├─ Parse condition text                               │
│  ├─ Calculate severity (1-10)                          │
│  ├─ Determine severity level (mild/moderate/high/emerg)│
│  └─ Identify specialties needed                        │
│                                                         │
│  Step 2: Geospatial matching                           │
│  ├─ Lookup pincode → Get centroid coordinates          │
│  ├─ Use centroid as search center                      │
│  └─ Calculate distances from centroid                  │
│                                                         │
│  Step 3: Severity-based routing                        │
│  ├─ Filter by facility type (based on severity)        │
│  ├─ Filter by emergency 24x7 (if emergency)            │
│  ├─ Filter by distance (initial radius)                │
│  └─ Progressive expansion if needed (3→5→10→20km)      │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                 PHASE 2: Results Display                │
│                                                         │
│  Shows:                                                │
│  • Severity badge (color-coded)                        │
│  • Filtered facility list                              │
│  • Interactive map centered on pincode centroid        │
│  • Radius circle showing search area                   │
│  • Distance from pincode centroid                      │
│  • Emergency call button (if emergency)                │
└─────────────────────────────────────────────────────────┘
```

## Key Changes from Previous Version

### Before (3-Phase Flow)
```
Phase 0: Select symptoms from grid
   ↓
Phase 1: Enter pincode
   ↓
Phase 2: View results
```

### After (2-Phase Flow - Current)
```
Phase 1: Enter pincode + symptoms together
   ↓
Phase 2: View results
```

## Geospatial Pincode Matching

### Pincode Centroid Lookup

The system maintains a mapping of pincodes to their geographic centroids:

```javascript
const pincodeCoordinates = {
  '560001': { lat: 12.9716, lng: 77.5946, area: 'MG Road, Bangalore' },
  '560002': { lat: 12.9822, lng: 77.5985, area: 'Shivaji Nagar, Bangalore' },
  '560038': { lat: 12.9784, lng: 77.6408, area: 'Indiranagar, Bangalore' },
  // ... more pincodes
};
```

### Distance Calculation

All hospital distances are calculated from the **pincode centroid**, not from individual hospitals:

```javascript
// Get pincode centroid
const centerLat = pincodeCoordinates[pincode].lat;
const centerLng = pincodeCoordinates[pincode].lng;

// Calculate distances from centroid
hospitals.forEach(hospital => {
  hospital.distance_km = calculateDistance(
    centerLat, centerLng,
    hospital.latitude, hospital.longitude
  );
});

// Sort by distance from centroid
hospitals.sort((a, b) => a.distance_km - b.distance_km);
```

### Map Centering

The map is centered on the **pincode centroid**, with a radius circle showing the search area:

```javascript
// Center map on pincode centroid
map.setView([centerLat, centerLng], zoom);

// Draw radius circle around centroid
L.circle([centerLat, centerLng], {
  radius: searchRadius * 1000, // km to meters
  color: severityColor
}).addTo(map);
```

## Landing Page Features

### 1. Pincode Input
- Large, centered input field
- 6-digit numeric validation
- Location icon indicator
- Auto-formats as user types

### 2. Symptom/Condition Input
- Free-text search box
- Supports plain English/Hinglish
- Placeholder examples
- Quick-select symptom tags

### 3. Emergency Toggle
- Prominent toggle switch
- Changes UI to red theme when active
- Auto-filters to 24x7 emergency facilities
- Shows emergency messaging

### 4. Sample Data Toggle
- Located in header
- Allows testing without backend
- Uses local sample data
- Can be toggled on/off anytime

### 5. Common Symptom Tags
- Quick-select buttons
- Pre-populated common searches:
  - 🤒 Fever
  - 🦠 Skin Rash
  - 👶 Pediatrician
  - 🦷 Toothache
  - 🧘 Ayurveda

## Symptom Assessment (Behind the Scenes)

When user submits the form, the system:

1. **Parses the condition text** for keywords
2. **Calculates severity** based on:
   - Keyword matching (e.g., "chest pain" = emergency)
   - Emergency toggle state
   - Multiple symptom indicators
3. **Determines severity level:**
   - Mild (1-3): Common cold, headache, minor issues
   - Moderate (4-6): Fever, stomach pain, infections
   - High (7-8): High fever, breathing difficulty, severe pain
   - Emergency (9-10): Chest pain, unconsciousness, stroke symptoms
4. **Maps to specialties:**
   - Respiratory → Pulmonology, ENT
   - Cardiology → Cardiology, Emergency Medicine
   - General → General Medicine
   - etc.

## Severity-Based Routing (Automatic)

Based on the assessed severity, the system:

### Mild (1-3) 🟢
- **Facilities:** PHC, Dispensary, Health Centre
- **Initial Radius:** 3km from pincode centroid
- **Color:** Green (#10b981)
- **Message:** "Visit a nearby clinic when convenient"

### Moderate (4-6) 🟡
- **Facilities:** Clinic, Nursing Home, Hospital
- **Initial Radius:** 5km from pincode centroid
- **Color:** Yellow/Orange (#f59e0b)
- **Message:** "Schedule appointment within 24-48 hours"

### High (7-8) 🟠
- **Facilities:** Hospital, Multi-specialty Hospital
- **Initial Radius:** 10km from pincode centroid
- **Color:** Orange (#f97316)
- **Message:** "Visit hospital soon"

### Emergency (9-10) 🔴
- **Facilities:** Emergency Centre, 24x7 Hospitals only
- **Initial Radius:** 10km from pincode centroid
- **Color:** Red (#ef4444)
- **Message:** "EMERGENCY: Seek immediate attention. Call 108"
- **Special:** Shows persistent 108 call button

## Progressive Radius Expansion

If no facilities found at initial radius:

```
Initial Radius (based on severity)
   ↓ No results
Expand to 5km
   ↓ No results
Expand to 10km
   ↓ No results
Expand to 20km
   ↓ No results
Show "Call 108" message
```

User sees messages like:
- "No facilities found nearby. Searching a wider area (5km)..."
- "Still searching... expanding to 10km radius"
- "Expanding to 20km — showing best available options"
- "No facilities found within 20km. Please call 108 for emergency assistance."

## Results Display

### Sidebar
- **Severity Badge:** Color-coded priority indicator
- **Facility Count:** Number of facilities found
- **Radius Indicator:** "Within Xkm"
- **Expansion Message:** If radius was expanded
- **Emergency Banner:** For emergency cases with 108 button
- **Hospital Cards:**
  - Facility name
  - Facility type badge
  - Address
  - Distance from pincode centroid
  - Call button

### Map
- **Centered on pincode centroid**
- **Radius circle** showing search area (color-coded)
- **Hospital markers** (color matches severity)
- **Popups** with facility details
- **Legend** showing radius and priority level

## Testing the Updated Flow

### Test Scenario 1: Mild Symptoms
1. Enter pincode: `560001`
2. Type condition: `common cold and headache`
3. Click "Search"
4. **Expected:**
   - 🟢 Green severity badge
   - PHC/Dispensaries shown
   - 3km radius circle (green)
   - Map centered on MG Road area (560001 centroid)

### Test Scenario 2: Emergency
1. Enter pincode: `560038`
2. Type condition: `chest pain`
3. Click "Search"
4. **Expected:**
   - 🔴 Red severity badge
   - Emergency banner with 108 button
   - Only 24x7 emergency facilities
   - 10km radius circle (red)
   - Map centered on Indiranagar area (560038 centroid)

### Test Scenario 3: Emergency Toggle
1. Enter pincode: `560095`
2. Toggle "Current Emergency?" ON
3. Type condition: `severe injury`
4. Click "Search"
5. **Expected:**
   - Emergency mode activated
   - Red theme
   - Only emergency facilities
   - Map centered on Koramangala area (560095 centroid)

## Sample Pincodes for Testing

| Pincode | Area | Centroid Coordinates |
|---------|------|---------------------|
| 560001 | MG Road | 12.9716, 77.5946 |
| 560002 | Shivaji Nagar | 12.9822, 77.5985 |
| 560003 | Ulsoor | 12.9634, 77.6089 |
| 560038 | Indiranagar | 12.9784, 77.6408 |
| 560095 | Koramangala | 12.9352, 77.6245 |
| 560076 | Bannerghatta | 12.9100, 77.5950 |
| 560066 | Whitefield | 12.9698, 77.7499 |
| 560041 | Jayanagar | 12.9250, 77.5838 |

## Backend Integration (Future)

When integrating with a real backend:

### API Endpoint: POST /api/hospitals/search

**Request:**
```json
{
  "pincode": "560001",
  "condition": "fever and cough",
  "isEmergency": false
}
```

**Backend Processing:**
1. Lookup pincode → Get centroid coordinates
2. Assess condition text → Get severity + specialties
3. Query hospitals near centroid
4. Filter by facility type (based on severity)
5. Filter by emergency 24x7 (if emergency)
6. Calculate distances from centroid
7. Sort by distance
8. Apply progressive radius expansion if needed

**Response:**
```json
{
  "assessment": {
    "severity": 5,
    "severityLevel": "moderate",
    "specialties": ["General Medicine", "Pulmonology"],
    "recommendation": "Schedule appointment within 24-48 hours"
  },
  "location": {
    "pincode": "560001",
    "centroid": { "lat": 12.9716, "lng": 77.5946 },
    "area": "MG Road, Bangalore"
  },
  "facilities": [...],
  "radiusUsed": 5,
  "wasExpanded": false
}
```

## Advantages of This Approach

1. **Familiar UX:** Users enter pincode + symptoms together (like original design)
2. **Geospatially Accurate:** Uses pincode centroid for consistent distance calculations
3. **Intelligent Routing:** Automatically routes to appropriate facility types
4. **Progressive Search:** Expands radius if needed
5. **Emergency Ready:** Special handling for emergency situations
6. **Future-Proof:** Backend can be enhanced without frontend changes

## Files Modified

- `frontend/src/AppWithSymptoms.js` - Updated to 2-phase flow with pincode centroid logic
- Added `pincodeCoordinates` mapping for geospatial lookup

## Current Status

✅ **Working:** Landing page with pincode + symptoms
✅ **Working:** Symptom assessment (rule-based)
✅ **Working:** Pincode centroid lookup
✅ **Working:** Severity-based routing
✅ **Working:** Progressive radius expansion
✅ **Working:** Map centered on pincode centroid
✅ **Working:** Distance calculation from centroid
✅ **Working:** Emergency mode
✅ **Working:** Sample data mode

🔮 **Future:** AI-based symptom assessment (drop-in replacement)
🔮 **Future:** Real pincode database with all India coverage
🔮 **Future:** Live hospital database

## Quick Start

```bash
# Start dev server
cd frontend
npm start

# Open browser
http://localhost:3001

# Test flow:
1. Enter pincode: 560001
2. Type: "fever and headache"
3. Click Search
4. See results with map centered on MG Road area
```

---

**Updated:** Flow now matches original design with pincode + symptoms on landing page
**Geospatial:** All distances calculated from pincode centroid
**Status:** ✅ Ready for testing
