# Quick Start Guide - Database Integration

## Prerequisites
- Node.js installed
- PostgreSQL/PostGIS database with hospital data (RDS)
- Database credentials

## Setup Steps

### 1. Backend Setup (5 minutes)

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Edit .env with your RDS credentials
# DB_HOST=your-rds-endpoint.rds.amazonaws.com
# DB_PORT=5432
# DB_NAME=your_database_name
# DB_USER=your_username
# DB_PASSWORD=your_password
```

### 2. Start Backend Server

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

### 3. Test Backend (New Terminal)

```bash
# Health check
curl http://localhost:5000/health

# Database stats
curl http://localhost:5000/api/hospitals/stats

# Pincode lookup (Delhi)
curl http://localhost:5000/api/pincode/110001
```

### 4. Start Frontend

```bash
# New terminal
cd frontend
npm start
```

Browser opens at http://localhost:3001

### 5. Test Complete Flow

1. **See database stats banner**: "Searching across 30,273 verified hospitals"
2. **Enter pincode**: Try 110001 (Delhi), 400001 (Mumbai), or 560001 (Bangalore)
3. **Enter symptoms**: 
   - "fever" → Mild severity
   - "chest pain" → Emergency auto-detected
   - "child checkup" → Moderate severity
4. **Click Search**
5. **View results**:
   - Real hospitals from database
   - Govt/Private/AYUSH badges
   - Distance from pincode
   - Multiple phone numbers
   - Specialties shown
   - Emergency badges for 24x7 facilities

## Test Pincodes

| Pincode | City | Expected Results |
|---------|------|------------------|
| 110001 | Delhi | Government hospitals, AIIMS, etc. |
| 400001 | Mumbai | Mix of govt and private hospitals |
| 560001 | Bangalore | Tech city hospitals |
| 600001 | Chennai | South India hospitals |
| 700001 | Kolkata | East India hospitals |

## Test Symptoms

| Symptom | Expected Behavior |
|---------|-------------------|
| "fever" | Mild severity → Dispensaries/Clinics within 3km |
| "severe headache" | Moderate → Hospitals within 5km |
| "chest pain" | Emergency auto-detected → 24x7 facilities only |
| "breathlessness" | Emergency auto-detected → Red warning banner |
| "child checkup" | Moderate → Pediatric facilities |

## Troubleshooting

### Backend won't start
- Check if port 5000 is available: `lsof -i :5000`
- Verify .env file exists and has correct credentials
- Check database connection: `psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME>`

### Frontend shows "Pincode not found"
- Ensure backend is running on port 5000
- Check browser console for API errors
- Verify pincode exists in database: `curl http://localhost:5000/api/pincode/110001`

### No hospitals returned
- Check if database has data: `curl http://localhost:5000/api/hospitals/stats`
- Verify PostGIS extension is enabled in database
- Check backend logs for SQL errors

### CORS errors
- Verify `FRONTEND_URL` in backend/.env matches frontend URL
- Check browser console for specific CORS error
- Ensure backend CORS middleware is configured correctly

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  (React App)    │
│  Port 3001      │
└────────┬────────┘
         │ HTTP/Axios
         ▼
┌─────────────────┐
│   Backend       │
│  (Express API)  │
│  Port 5000      │
└────────┬────────┘
         │ PostgreSQL
         ▼
┌─────────────────┐
│   Database      │
│  (PostGIS RDS)  │
│  ~30K hospitals │
└─────────────────┘
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Health check |
| GET | `/api/hospitals/stats` | Database statistics |
| GET | `/api/pincode/:pincode` | Get pincode coordinates |
| POST | `/api/hospitals/severity-based` | Severity-based search |
| GET | `/api/hospitals` | Basic hospital search |
| GET | `/api/hospitals/search` | Fuzzy name search |

## Next Steps

1. ✅ Backend running
2. ✅ Frontend running
3. ✅ Database connected
4. ✅ Test complete flow
5. 🔄 Deploy to production (see DATABASE_INTEGRATION.md)

## Support

For issues, check:
- `DATABASE_INTEGRATION.md` - Complete integration details
- Backend logs - `cd backend && npm start`
- Frontend console - Browser DevTools
- Database logs - RDS CloudWatch
