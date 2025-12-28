# Project Structure

## Current Implementation Structure

```
whats-up-doc/
├── .kiro/
│   └── steering/              # AI assistant guidance files
├── .vscode/                   # VSCode configuration
├── backend/                   # Node.js Express API server
│   ├── src/
│   │   ├── api/
│   │   │   └── hospitals.js   # Hospital API routes
│   │   ├── config/
│   │   │   └── api-config.js  # data.gov.in API configuration
│   │   ├── services/
│   │   │   ├── hospital-data-service.js      # Core hospital data logic
│   │   │   ├── multi-city-hospital-service.js # Multi-city routing
│   │   │   ├── mcp-hospital-service.js       # MCP-powered service
│   │   │   └── fallback-hospital-data.js     # Fallback data provider
│   │   └── app.js             # Express application entry point
│   ├── .env                   # Environment variables
│   ├── .env.example           # Environment template
│   ├── package.json           # Backend dependencies
│   ├── test-api.js            # API testing script
│   └── test-cities.js         # City-specific testing
├── frontend/                  # React application
│   ├── src/
│   │   ├── App.js             # Main React component (two-phase UI)
│   │   ├── App.css            # Application styles
│   │   └── index.js           # React entry point
│   ├── public/
│   │   └── index.html         # HTML template with Leaflet/Tailwind CDN
│   └── package.json           # Frontend dependencies
├── README.md                  # Project documentation
├── product.md                 # Product specification
├── test-api-endpoints.sh      # API endpoint testing script
├── test-frontend.html         # Frontend testing page
├── test-fresh-data-system.js  # Fresh data testing
└── test-live-api-integration.js # API integration testing
```

## Architecture Patterns

### Backend Organization
- **Service Layer**: Business logic separated from API routes
- **Multi-City Support**: Centralized city detection and hospital routing
- **Fallback Strategy**: Graceful degradation when external APIs fail
- **Configuration Management**: Environment-based configuration
- **API Integration**: Clean abstraction for data.gov.in API

### Frontend Organization
- **Single Component Architecture**: App.js handles both phases
- **Phase-Based UI**: Clean separation between entry and discovery phases
- **Map Integration**: Dynamic Leaflet map initialization
- **Responsive Design**: Mobile-first with adaptive layouts
- **State Management**: React hooks for local state

### Data Flow Architecture
```
User Input (Pincode + Condition)
    ↓
Multi-City Service (City Detection)
    ↓
Hospital Data Service (Specialty Mapping)
    ↓
API Integration / Fallback Data
    ↓
Recommendation Engine (Scoring & Ranking)
    ↓
Frontend (Map + List Display)
```

## Key Conventions

### File Naming
- **Backend**: kebab-case for files and directories
- **Frontend**: PascalCase for React components, camelCase for utilities
- **Configuration**: lowercase with extensions (.env, .json)

### Code Organization
- **Separation of Concerns**: API routes, business logic, and data access separated
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Environment Configuration**: All environment-specific values in .env files
- **Testing**: Separate test files for different components

### API Design
- **RESTful Endpoints**: Clear, predictable API structure
- **Query Parameters**: Consistent parameter naming and validation
- **Response Format**: Standardized JSON response structure
- **Error Responses**: Consistent error format with helpful messages

### Privacy Implementation
- **No Persistence**: All user data handled in memory only
- **Anonymized Logging**: No personal information in logs
- **Session-Based**: No user tracking across sessions
- **Input Sanitization**: All user inputs validated and sanitized

## Development Workflow

### Local Development Setup
1. Clone repository
2. Setup backend: `cd backend && npm install`
3. Configure environment: Copy `.env.example` to `.env`
4. Setup frontend: `cd frontend && npm install`
5. Start backend: `npm run dev` (port 3000)
6. Start frontend: `npm start` (port 3001)

### Testing Strategy
- **API Testing**: Automated endpoint testing with curl scripts
- **Integration Testing**: Full application flow testing
- **City-Specific Testing**: Individual city data validation
- **Frontend Testing**: Manual testing with test HTML pages

### Deployment Considerations
- **Backend**: Express server with production middleware
- **Frontend**: Static build with React build process
- **Environment**: Production environment variables
- **Monitoring**: Health check endpoints for monitoring