# Testing Guide - Symptom Assessment & Severity Routing

## Quick Start

1. **Start the dev server:**
   ```bash
   cd frontend
   npm start
   ```

2. **Open browser:** http://localhost:3001

3. **Enable Sample Data Mode:** Toggle is ON by default (blue toggle in header)

## Test Scenarios

### Scenario 1: Mild Symptoms → PHC/Dispensary (3km)

**Steps:**
1. Select symptoms:
   - ✅ Common Cold
   - ✅ Headache
2. Click "Find Appropriate Facilities"
3. Enter pincode: `560001`
4. Click "Find Facilities"

**Expected Results:**
- 🟢 Severity Badge: "Mild Priority"
- Facility types shown: PHC, Dispensary, Health Centre
- Search radius: 3km (green circle on map)
- 4 facilities found:
  - Primary Health Center - Indiranagar
  - Government Dispensary - Koramangala
  - Community Health Centre - Whitefield
  - Urban Health Center - Jayanagar

---

### Scenario 2: Moderate Symptoms → Clinics/Hospitals (5km)

**Steps:**
1. Select symptoms:
   - ✅ Fever (99-101°F)
   - ✅ Stomach Pain
   - ✅ Vomiting
2. Add notes: "Started yesterday, getting worse"
3. Click "Find Appropriate Facilities"
4. Enter pincode: `560001`
5. Click "Find Facilities"

**Expected Results:**
- 🟡 Severity Badge: "Moderate Priority"
- Facility types: Clinic, Nursing Home, Hospital
- Search radius: 5km (yellow/orange circle)
- Facilities include:
  - City Care Clinic
  - Sunshine Nursing Home
  - District Government Hospital
  - Government General Hospital

---

### Scenario 3: High Severity → Hospitals (10km)

**Steps:**
1. Select symptoms:
   - ✅ High Fever (>102°F)
   - ✅ Difficulty Breathing
   - ✅ Severe Pain
2. Click "Find Appropriate Facilities"
3. Enter pincode: `560001`
4. Click "Find Facilities"

**Expected Results:**
- 🟠 Severity Badge: "High Priority"
- Facility types: Hospital, Multi-specialty Hospital
- Search radius: 10km (orange circle)
- Facilities include:
  - Apollo Hospitals
  - Fortis Hospital
  - Manipal Hospital
  - St. Mary's Hospital

---

### Scenario 4: Emergency → 24x7 Emergency Only (10km)

**Steps:**
1. Select symptoms:
   - ✅ Chest Pain
   OR
   - ✅ Loss of Consciousness
   OR
   - ✅ Stroke Symptoms (FAST)
2. Click "Find Appropriate Facilities"
3. **Notice:** Red emergency banner appears
4. Enter pincode: `560001`
5. Click "Find Facilities"

**Expected Results:**
- 🔴 Severity Badge: "Emergency Priority"
- Red emergency banner: "🚨 Emergency — Showing nearest 24x7 facilities only"
- Large "Call 108 Emergency" button visible
- Facility types: Emergency Centre, Multi-specialty Hospital (24x7 only)
- Search radius: 10km (red circle)
- Only facilities with `emergency_24x7: true`:
  - Victoria Hospital Emergency & Trauma Center
  - Bangalore Emergency Medical Center
  - Apollo Hospitals Emergency
  - Fortis Hospital Emergency

---

### Scenario 5: Progressive Radius Expansion

**To simulate this, you would need to:**
1. Modify sample data to have fewer facilities
2. Or test with a pincode that has no nearby facilities

**Expected Behavior:**
- Initial search at configured radius (e.g., 3km for mild)
- If no results: "No facilities found nearby. Searching a wider area (5km)..."
- Expands to 5km, then 10km, then 20km
- If still no results at 20km: "No facilities found within 20km. Please call 108 for emergency assistance."

---

### Scenario 6: Multiple Symptoms (Severity Adjustment)

**Steps:**
1. Select 3+ symptoms from different categories:
   - ✅ Fever (99-101°F) [severity: 4]
   - ✅ Cough [severity: 2]
   - ✅ Breathing Difficulty [severity: 8]
2. Click "Find Appropriate Facilities"

**Expected Results:**
- System uses HIGHEST severity among selected symptoms
- In this case: severity 8 (from Breathing Difficulty)
- May adjust +1 for multiple symptoms
- Result: "High Priority" routing

---

### Scenario 7: Additional Notes with Emergency Keywords

**Steps:**
1. Select mild symptom:
   - ✅ Headache [severity: 2]
2. Add notes: "can't breathe properly, chest pain"
3. Click "Find Appropriate Facilities"

**Expected Results:**
- System detects emergency keywords in notes
- Severity elevated to at least 9 (emergency)
- Routes to emergency facilities

---

## UI Elements to Verify

### Phase 0: Symptom Selection
- ✅ Symptom grid with color-coded severity
- ✅ Category filter buttons (All, Respiratory, Cardiology, etc.)
- ✅ Selected symptoms show checkmark
- ✅ Selected count badge
- ✅ Additional notes textarea
- ✅ Emergency notice box with 108 call button
- ✅ Sample data toggle in header

### Phase 1: Pincode Entry
- ✅ Back button to return to symptoms
- ✅ Assessment result banner (color-coded by severity)
- ✅ Severity icon and level
- ✅ Recommendation text
- ✅ Specialty tags
- ✅ Facility type info box
- ✅ Initial radius display
- ✅ Pincode input (6 digits, numeric only)
- ✅ Emergency call button (for emergency cases)

### Phase 2: Results
- ✅ Back button to pincode entry
- ✅ Severity badge in header
- ✅ Facility count
- ✅ Radius indicator
- ✅ Expansion message (if applicable)
- ✅ Emergency banner (for emergency cases)
- ✅ Hospital cards with:
  - Facility type badge
  - Distance
  - Call button
- ✅ Map with:
  - Radius circle (color-coded)
  - Hospital markers
  - Legend showing radius and priority
- ✅ Empty state (if no facilities found)

---

## Map Interactions

### Verify Map Features:
1. **Radius Circle:**
   - Color matches severity level
   - Size matches search radius
   - Semi-transparent fill

2. **Hospital Markers:**
   - Color matches severity level
   - Animated ping effect
   - Click to show popup

3. **Popup Content:**
   - Hospital name
   - Facility type
   - Address
   - Phone (clickable)
   - Distance

4. **Map Legend:**
   - Shows current search radius
   - Shows priority level
   - Color indicator

---

## Edge Cases to Test

### 1. No Symptoms Selected
- Try clicking "Find Appropriate Facilities" without selecting symptoms
- Should show alert: "Please select at least one symptom or describe your condition"

### 2. Invalid Pincode
- Enter less than 6 digits
- Should show alert: "Please enter a valid 6-digit pincode"

### 3. Only Additional Notes (No Symptoms)
- Don't select symptoms, only add notes
- Should still work if notes contain meaningful information

### 4. Back Navigation
- Test back button at each phase
- Verify state is preserved/cleared appropriately

### 5. Sample Data Toggle
- Toggle OFF during symptom selection
- Should switch to API mode (will fail without backend)
- Toggle back ON to continue testing

---

## Browser Console Checks

Open browser console (F12) and verify:

1. **No errors** during symptom selection
2. **Assessment log:** "Using rule-based assessment service"
3. **Routing log:** Check severity level and facility filtering
4. **Map initialization:** Leaflet map loads successfully
5. **No 404 errors** for assets

---

## Performance Checks

- ✅ Symptom selection is instant
- ✅ Assessment completes in <500ms
- ✅ Pincode search with sample data: <1 second
- ✅ Map renders smoothly
- ✅ No lag when selecting multiple symptoms

---

## Mobile Testing

Test on mobile viewport (or use browser dev tools):

1. **Responsive Layout:**
   - Symptom grid adapts to single column
   - Pincode input remains centered
   - Results sidebar becomes full-width

2. **Touch Interactions:**
   - Symptom buttons are tappable
   - Map markers are tappable
   - Call buttons work (tel: links)

3. **Emergency Call:**
   - 108 button should trigger phone dialer

---

## Accessibility Checks

- ✅ All interactive elements are keyboard accessible
- ✅ Color contrast meets WCAG standards
- ✅ Emergency information is clearly visible
- ✅ Form inputs have proper labels
- ✅ Error messages are clear and actionable

---

## Known Limitations (Sample Data Mode)

1. **Fixed Location:** All distances calculated from Bangalore center (12.9716, 77.5946)
2. **Mock Data:** Bed counts and some details are randomized
3. **No Real-Time:** Availability is not real-time
4. **Limited Facilities:** Only 17 sample facilities
5. **Single City:** All facilities are in Bangalore

---

## Troubleshooting

### Map Not Showing
- Check browser console for Leaflet errors
- Verify internet connection (Leaflet tiles load from CDN)
- Check if `window.L` is defined

### Symptoms Not Selectable
- Check browser console for React errors
- Verify symptomAssessment.js is loaded

### No Facilities Found
- Verify sampleData.js has facilities with correct `facility_type`
- Check severity level matches available facility types
- Try different symptom combinations

### Assessment Fails
- Check browser console for errors
- Verify assessmentService is initialized
- Check symptom IDs match symptomOptions

---

## Next Steps After Testing

1. ✅ Verify all scenarios work as expected
2. ✅ Document any bugs or issues
3. ✅ Test on different browsers (Chrome, Firefox, Safari)
4. ✅ Test on mobile devices
5. ✅ Prepare for backend API integration
6. ✅ Plan AI assessment service deployment

---

## Feedback & Issues

When reporting issues, include:
- Scenario being tested
- Steps to reproduce
- Expected vs. actual behavior
- Browser and device info
- Console errors (if any)
- Screenshots (if applicable)
