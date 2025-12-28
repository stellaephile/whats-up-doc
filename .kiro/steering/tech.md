# Technology Stack

## Current Implementation

### Backend Stack
- **Runtime**: Node.js (v16+)
- **Framework**: Express.js with middleware stack
- **API Integration**: data.gov.in National Hospital Directory
- **Security**: Helmet, CORS, rate limiting, compression
- **Environment**: dotenv for configuration management

### Frontend Stack  
- **Framework**: React 18 with functional components and hooks
- **HTTP Client**: Axios for API communication
- **Maps**: Leaflet.js with OpenStreetMap tiles (Carto Positron style)
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Material Symbols Outlined
- **Build Tool**: Create React App (react-scripts)

### Development Tools
- **Backend Dev**: nodemon for hot reloading
- **Testing**: Jest framework
- **Code Quality**: ESLint, Prettier
- **Package Management**: npm with package-lock.json

## Architecture Patterns

### Backend Architecture
- **Service Layer Pattern**: Business logic separated in services/
- **API Route Handlers**: Clean separation in api/ directory
- **Multi-City Service**: Centralized city detection and routing
- **Fallback Data Strategy**: Graceful degradation when API unavailable
- **In-Memory Caching**: Session-based caching with expiry

### Frontend Architecture
- **Two-Phase UI**: Clean entry → Rich discovery experience
- **State Management**: React hooks (useState, useEffect)
- **Component Structure**: Single-file App component with phase switching
- **Map Integration**: Dynamic Leaflet initialization with custom markers
- **Responsive Design**: Mobile-first with sidebar/overlay patterns

## Development Commands

### Backend Commands
```bash
cd backend
npm install          # Install dependencies
npm start           # Start production server
npm run dev         # Start with nodemon (development)
npm test            # Run Jest tests
npm run test-api    # Test API endpoints
npm run lint        # ESLint code checking
npm run format      # Prettier code formatting
```

### Frontend Commands
```bash
cd frontend
npm install         # Install dependencies  
npm start          # Start development server (port 3001)
npm run build      # Build for production
npm test           # Run React tests
```

### Testing Commands
```bash
# Test API endpoints
bash test-api-endpoints.sh

# Test complete application
node test-health-hacker-complete.js

# Test specific cities
node backend/test-cities.js
```

## Environment Configuration

### Backend Environment (.env)
```bash
PORT=3000
NODE_ENV=development
DATA_GOV_IN_API_KEY=your_api_key_here
CORS_ORIGIN=http://localhost:3001
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend Environment (.env)
```bash
REACT_APP_API_URL=http://localhost:3000
```

## API Integration
- **Primary**: data.gov.in National Hospital Directory API
- **Fallback**: Local hospital data for graceful degradation
- **Rate Limiting**: Respects API limits with built-in throttling
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Security & Privacy Implementation
- **No Data Persistence**: All user data handled in memory only
- **Rate Limiting**: Express rate limiter to prevent abuse
- **CORS Protection**: Configured for specific origins
- **Helmet Security**: Security headers for production
- **Input Validation**: Query parameter validation and sanitization