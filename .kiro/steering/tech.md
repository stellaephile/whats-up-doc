# Technology Stack

## Frontend

- React 18.2.0 (functional components with hooks)
- Tailwind CSS (utility-first styling, dark mode support)
- Leaflet 1.9.4 (interactive maps with custom markers)
- Axios 1.6.2 (HTTP client)
- Material Symbols (icon library)

## Backend

- Node.js with Express 4.18.2
- PostgreSQL with PostGIS (geospatial queries)
- pg 8.19.0 (PostgreSQL client)
- AWS Location Service (pincode geocoding)
- CORS enabled for cross-origin requests

## Assessment Service

- Python 3.x with AWS Lambda
- boto3 (AWS SDK)
- Amazon Bedrock (Claude AI models)
  - Haiku: Fast triage and emergency detection
  - Sonnet: Full severity assessment
- Two-stage assessment flow with clarifying questions

## Common Commands

### Frontend
```bash
cd frontend
npm install              # Install dependencies
npm start               # Development server (port 3001)
npm run build           # Production build
```

### Backend
```bash
cd backend
npm install              # Install dependencies
npm start               # Production server (port 5000)
npm run dev             # Development with nodemon
```

### Assessment Service
```bash
cd assess-service
pip install -r requirements.txt    # Install dependencies
./run_local.sh                     # Local test server
./test_local.sh                    # Test endpoint
```

## Environment Variables

### Frontend (.env.local)
- `REACT_APP_API_URL` - Backend API URL

### Backend (.env)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL connection
- `AWS_REGION`, `AWS_LOCATION_INDEX`, `AWS_LOCATION_API_KEY` - AWS Location Service
- `PYTHON_BACKEND_URL` - Assessment service endpoint
- `FRONTEND_URL` - CORS origin

### Assessment Service (.env)
- `AWS_REGION` - AWS region for Bedrock

## Database

- PostgreSQL with PostGIS extension
- Geospatial queries using `ST_DWithin`, `ST_Distance`, `ST_MakePoint`
- Hospital data includes coordinates, specialties, emergency availability
- SSL connection with `rejectUnauthorized: false`
