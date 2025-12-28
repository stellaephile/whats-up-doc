# Delhi Health-Hacker Backend

Anonymous healthcare navigation system for Delhi using official government hospital data.

## Quick Start

### 1. Setup Environment
```bash
# Copy your API key to .env file
cp .env.example .env
# Edit .env and add your data.gov.in API key
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Test API Connection
```bash
npm run test-api
```

### 4. Start Development Server
```bash
npm run dev
```

## API Integration

This backend integrates with the **National Hospital Directory** from data.gov.in:
- **Resource ID**: `98fa254e-c5f8-4910-a19b-4828939b477d`
- **Data Source**: Ministry of Health and Family Welfare, Government of India
- **Coverage**: All hospitals in Delhi with geo-coordinates and specializations

## API Endpoints

### Hospital Recommendations
```
GET /api/hospitals/recommend?condition=chest%20pain&area=Central%20Delhi
```

### Emergency Hospitals
```
GET /api/hospitals/emergency?latitude=28.6139&longitude=77.2090
```

### Delhi Areas
```
GET /api/hospitals/areas
```

## Delhi Health-Hacker Features

### Specialty Routing
- **Cardiac conditions** → G.B. Pant Hospital (GIPMER)
- **Dog bites** → Ram Manohar Lohia Hospital (RML)
- **Emergency trauma** → AIIMS Trauma Center, Safdarjung Hospital
- **Minor issues** → Nearest Mohalla Clinic

### Privacy Protection
- No user data storage
- Anonymous location-based recommendations
- Session-only caching
- No tracking or identification required

### Local Knowledge
- Understands Hinglish terms ("Sarkari hospital", "Parchi line")
- Quality vs proximity recommendations
- Government vs private hospital guidance
- Real waiting time estimates

## Environment Variables

```bash
# Required
DATA_GOV_IN_API_KEY=your_api_key_here

# Optional
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
CACHE_EXPIRY_MINUTES=30
```

## Testing Your API Key

Run the test script to verify your data.gov.in API integration:

```bash
npm run test-api
```

This will:
- Test API connectivity
- Show available hospital data fields
- Test Delhi-specific queries
- Verify specialty-based filtering

## Development

```bash
# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Check code style
npm run lint

# Format code
npm run format
```

## Data Structure

The API returns hospital data with these key fields:
- `hospital_name` - Hospital name
- `address` - Full address
- `district` - Delhi district
- `category` - Government/Private classification
- `specialization` - Medical specialties available
- `contact_no` - Phone number
- `latitude/longitude` - GPS coordinates
- `pincode` - Area PIN code

## Error Handling

The system gracefully handles:
- API rate limits
- Network connectivity issues
- Invalid API keys
- Missing hospital data
- Location service failures

For emergency situations, always provides fallback contact numbers (102, 108).