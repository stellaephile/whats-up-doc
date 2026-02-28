# Database Integration Complete

## Overview
Successfully integrated PostgreSQL/PostGIS database with ~30,273 hospitals, replacing hardcoded sample data.

## Backend Setup ✅

### Files Created
1. **backend/db.js** - PostgreSQL connection pool with PostGIS support
2. **backend/server.js** - Express API with 6 endpoints
3. **backend/package.json** - Dependencies (pg, express, cors, dotenv)
4. **backend/.env.example** - Environment variable template

### API Endpoints
- `GET /api/hospitals/stats` - Database statistics (total, govt, emergency, etc.)
- `GET /api/hospitals` - Basic search with PostGIS nearest query
- `POST /api/hospitals/severity-based` - Severity-based routing with progressive expansion
- `GET /api/hospitals/search` - Fuzzy name search
- `GET /api/pincode/:pincode` - Get coordinates for pincode from hospital data
- `GET /health` - Health check

### Database Views Used
- `map_hospitals` - Quality-gated hospitals (data_quality_norm >= 0.3)
- `emergency_hospitals` - Only emergency-available hospitals

## Frontend Integration ✅

### Changes Made to `frontend/src/AppWithSymptoms.js`

1. **Added useEffect hook** to fetch database stats on mount
2. **Updated handleSearch()** function:
   - Calls `/api/pincode/:pincode` to get coordinates
   - Calls `/api/hospitals/severity-based` for hospital search
   - Transforms DB results to match frontend format
   - Better error handling for 404 and 500 errors

3. **Enhanced hospital cards** with real DB fields:
   - Hospital name, category, care type
   - Emergency/ambulance/blood bank phone numbers
   - Specialties (first 3 shown)
   - Total beds count
   - 24x7 emergency badge
   - Multiple call buttons (Emergency, Ambulance, Blood Bank, General)

4. **Added database stats banner** on landing page:
   - Shows total hospitals, govt count, emergency count
   - Fetched from `/api/hospitals/stats`

5. **Updated .env** to point to correct backend port (5000)

### Field Mapping (DB → Frontend)
```javascript
{
  id: hospital.id,
  name: hospital.hospital_name,
  facility_type: hospital.hospital_care_type,
  category: hospital.hospital_category,
  isGovernment: hospital_category includes 'gov' or 'public',
  isAyush: hospital.ayush or discipline includes 'ayush',
  address: hospital.address,
  phone: emergency_num || telephone || mobile_number,
  emergency_num: hospital.emergency_num,
  ambulance_phone: hospital.ambulance_phone,
  bloodbank_phone: hospital.bloodbank_phone,
  latitude: hospital.latitude,
  longitude: hospital.longitude,
  distance_km: hospital.distance_km,
  specialties: hospital.specialties_array,
  facilities: hospital.facilities_array,
  total_beds: hospital.total_beds,
  emergency_available: hospital.emergency_available
}
```

## Next Steps

### 1. Create Backend .env File
```bash
cd backend
cp .env.example .env
```

Then edit `backend/.env` with your RDS credentials:
```env
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
FRONTEND_URL=http://localhost:3001
PORT=5000
NODE_ENV=development
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Start Backend Server
```bash
cd backend
npm start
```

Expected output:
```
🚀 Server running on port 5000
📍 Frontend URL: http://localhost:3001
🗄️  Database: your-rds-endpoint.rds.amazonaws.com
```

### 4. Start Frontend
```bash
cd frontend
npm start
```

### 5. Test Integration

#### Test 1: Database Connection
```bash
curl http://localhost:5000/health
```
Expected: `{"status":"healthy","database":"connected",...}`

#### Test 2: Database Stats
```bash
curl http://localhost:5000/api/hospitals/stats
```
Expected: `{"total":"30273","with_coordinates":"...","emergency":"...",...}`

#### Test 3: Pincode Lookup
```bash
curl http://localhost:5000/api/pincode/110001
```
Expected: `{"pincode":"110001","state":"Delhi","latitude":...,"longitude":...}`

#### Test 4: Severity-Based Search
```bash
curl -X POST http://localhost:5000/api/hospitals/severity-based \
  -H "Content-Type: application/json" \
  -d '{
    "pincode": "110001",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "severity": 5,
    "severityLevel": "moderate"
  }'
```

#### Test 5: Frontend Integration
1. Open http://localhost:3001
2. Should see database stats banner: "Searching across 30,273 verified hospitals"
3. Enter pincode: 110001 (Delhi) or 400001 (Mumbai)
4. Enter symptoms: "fever" or "chest pain"
5. Click Search
6. Should see real hospitals from database with:
   - Hospital names
   - Govt/Private/AYUSH badges
   - Distance from pincode
   - Multiple phone numbers
   - Specialties
   - Emergency badges

## Features Preserved

✅ Emergency keyword detection (auto-routes to 24x7 facilities)
✅ Severity-based routing (mild/moderate/high/emergency)
✅ Progressive radius expansion (3km → 5km → 10km → 20km)
✅ Government facility prioritization (mild/moderate only)
✅ Govt/Private/AYUSH filtering
✅ "No facilities found within 20km" message (only when truly no results)
✅ Emergency warning banners with 108/102 call buttons
✅ Map visualization with severity-colored markers

## Database Query Performance

- Uses PostGIS `ST_DWithin` for efficient radius queries
- Uses `ST_Distance` for accurate distance calculations
- Uses `<->` operator for nearest-neighbor sorting
- Indexes on `location` column for fast geospatial queries
- Quality gate (data_quality_norm >= 0.3) filters low-quality data

## Error Handling

- 404: Pincode not found in database
- 500: Database connection error
- Network errors: "Check your internet connection"
- Graceful fallback messages for users

## Files Modified
- ✅ `frontend/src/AppWithSymptoms.js` - Complete database integration
- ✅ `frontend/.env` - Updated API URL to port 5000
- ✅ `backend/db.js` - Created
- ✅ `backend/server.js` - Created
- ✅ `backend/package.json` - Created
- ✅ `backend/.env.example` - Created

## Files to Deprecate (Optional)
- `frontend/src/sampleData.js` - No longer used (kept for reference)
- `backend/hospitals.json` - Delete if exists

## Production Deployment Notes

1. Update `frontend/.env` with production API URL
2. Update `backend/.env` with production RDS credentials
3. Enable SSL for database connection (already configured in db.js)
4. Set `NODE_ENV=production` in backend
5. Use environment variables for all secrets
6. Consider connection pooling limits based on RDS instance size
7. Add rate limiting to API endpoints
8. Add request logging and monitoring
9. Set up CORS whitelist for production domains
