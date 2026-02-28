# Quick Reference Card

## 🚀 Start Application
```bash
cd frontend
npm start
# Opens at http://localhost:3001
```

## 🧪 Test Scenarios (30 seconds each)

### 1️⃣ Mild → PHC (3km)
- Pincode: 560001
- Condition: "common cold and headache"
- Expect: 🟢 Green badge, PHC/Dispensaries, 3km radius
- Map: Centered on MG Road area

### 2️⃣ Moderate → Clinics (5km)
- Pincode: 560038
- Condition: "fever and stomach pain"
- Expect: 🟡 Yellow badge, Clinics/Hospitals, 5km radius
- Map: Centered on Indiranagar area

### 3️⃣ High → Hospitals (10km)
- Pincode: 560095
- Condition: "high fever difficulty breathing"
- Expect: 🟠 Orange badge, Multi-specialty Hospitals, 10km radius
- Map: Centered on Koramangala area

### 4️⃣ Emergency → 24x7 Only (10km)
- Pincode: 560002
- Condition: "chest pain"
- Expect: 🔴 Red badge, Emergency Centers + 108 button, 10km radius
- Map: Centered on Shivaji Nagar area

### 5️⃣ Emergency Toggle
- Pincode: 560066
- Toggle "Current Emergency?" ON
- Condition: "severe injury"
- Expect: Emergency mode, red theme, 24x7 facilities only
- Map: Centered on Whitefield area

## 📊 Severity Levels

| Score | Level | Color | Facilities | Radius |
|-------|-------|-------|------------|--------|
| 1-3 | Mild | 🟢 Green | PHC, Dispensary | 3km |
| 4-6 | Moderate | 🟡 Yellow | Clinic, Hospital | 5km |
| 7-8 | High | 🟠 Orange | Multi-specialty | 10km |
| 9-10 | Emergency | 🔴 Red | Emergency 24x7 | 10km |

## 🔄 User Flow (Updated)
```
Landing Page (Pincode + Symptoms) → Results
(Phase 1)                          (Phase 2)
```

**What happens automatically:**
1. Symptom assessment (severity calculation)
2. Pincode → Centroid lookup
3. Distance calculation from centroid
4. Severity-based facility filtering
5. Progressive radius expansion if needed

## 📍 Sample Pincodes

| Pincode | Area | Coordinates |
|---------|------|-------------|
| 560001 | MG Road | 12.9716, 77.5946 |
| 560002 | Shivaji Nagar | 12.9822, 77.5985 |
| 560003 | Ulsoor | 12.9634, 77.6089 |
| 560038 | Indiranagar | 12.9784, 77.6408 |
| 560095 | Koramangala | 12.9352, 77.6245 |
| 560076 | Bannerghatta | 12.9100, 77.5950 |
| 560066 | Whitefield | 12.9698, 77.7499 |
| 560041 | Jayanagar | 12.9250, 77.5838 |

## 🎯 Key Features

✅ Pincode + symptoms on same page (original design)
✅ Automatic symptom assessment
✅ Geospatial pincode centroid matching
✅ Severity-based facility routing
✅ Progressive radius expansion (3→5→10→20km)
✅ Map centered on pincode area
✅ Distance from pincode centroid
✅ Emergency 108 call button
✅ Sample data mode (toggle in UI)
✅ Future AI-ready (zero frontend changes)

## 🏗️ Architecture

```
Landing Page Input
  ↓
symptomAssessment.js  → Assess severity (rule-based)
  ↓
pincodeCoordinates    → Get centroid (lat, lng)
  ↓
facilityRouting.js    → Filter by severity + distance
  ↓
Results Display       → Map centered on centroid
```

## 🔧 Configuration

```bash
# Sample Data Mode (default: true)
Toggle in UI header

# AI Assessment (future)
REACT_APP_USE_AI_ASSESSMENT=true
REACT_APP_AI_ASSESSMENT_ENDPOINT=https://api.example.com/assess
```

## 📱 Landing Page Elements

**Inputs:**
- Pincode (6 digits, numeric)
- Symptoms/Condition (free text)
- Emergency toggle

**Quick Actions:**
- Common symptom tags (fever, rash, etc.)
- Emergency SOS button
- Sample data toggle

## 🗺️ Map Features

- **Centered:** On pincode centroid (not hospitals)
- **Radius Circle:** Shows search area (color-coded)
- **Hospital Markers:** Color matches severity
- **Popups:** Facility details + distance from centroid
- **Legend:** Radius and priority level

## 🐛 Troubleshooting

**Map not showing?**
- Check internet (Leaflet tiles from CDN)
- Check console for errors

**No facilities found?**
- Try different pincode
- Check symptom keywords
- Verify sample data toggle is ON

**Wrong severity?**
- Use more specific keywords
- Try emergency toggle for urgent cases

## 📚 Documentation

- **Updated Flow:** `UPDATED_FLOW.md`
- **Changes:** `CHANGES_SUMMARY.md`
- **Full System:** `frontend/SYMPTOM_SYSTEM_README.md`
- **Testing:** `frontend/TESTING_GUIDE.md`
- **This Card:** `QUICK_REFERENCE.md`

## 🎨 Color Codes

- **Mild:** #10b981 (Green)
- **Moderate:** #f59e0b (Yellow/Orange)
- **High:** #f97316 (Orange)
- **Emergency:** #ef4444 (Red)

## 📞 Emergency

All emergency cases show:
- 🔴 Red severity badge
- 🚨 Emergency banner
- 📞 "Call 108" button (prominent)
- Only 24x7 facilities
- 10km radius

## ✨ Geospatial Matching

**How it works:**
1. User enters pincode (e.g., 560001)
2. System looks up centroid (12.9716, 77.5946)
3. Calculates all distances from centroid
4. Sorts hospitals by distance from centroid
5. Centers map on centroid
6. Draws radius circle around centroid

**Why centroid?**
- Consistent reference point
- Represents center of pincode area
- Fair distance calculation for all hospitals
- Accurate map positioning

## 🚦 Status

**Dev Server:** ✅ Running (http://localhost:3001)
**Compilation:** ✅ Successful
**Landing Page:** ✅ Pincode + symptoms together
**Geospatial:** ✅ Centroid-based matching
**Routing:** ✅ Severity-based filtering
**Ready for:** ✅ Testing

---

**Last Updated:** Pincode-first flow with geospatial centroid matching
**Version:** 2.0.0
**Status:** Ready for Testing
