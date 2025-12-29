/**
 * What's Up Doc Backend Application
 * Anonymous healthcare navigation system for India
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import routes
const hospitalRoutes = require('./api/hospitals');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(compression());

// The "Final Boss" CORS Config
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://whatsup-doc.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // This line is the fix for the "Pragma" and "Cache-Control" errors
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma'],
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests',
    message: 'Bahut zyada requests aa rahe hain. Thoda wait karo.'
  }
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: "What's Up Doc",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Welcome endpoint with Delhi Health-Hacker info
app.get('/', (req, res) => {
  res.json({
    message: "What's Up Doc API - Anonymous Healthcare Navigation",
    description: 'Find the right hospital in India without sharing personal information',
    endpoints: {
      cities: '/api/hospitals/cities',
      recommendations: '/api/hospitals/recommend?condition=chest%20pain&city=Hyderabad&pincode=500001',
      emergency: '/api/hospitals/emergency?city=Hyderabad&latitude=17.4274&longitude=78.4311',
      areas: '/api/hospitals/areas?city=Hyderabad'
    },
    languages: ['English', 'Hinglish'],
    privacy: 'No personal data collected or stored',
    emergencyNumbers: {
      ambulance: '102',
      emergency: '108',
      police: '100'
    }
  });
});

// API routes
app.use('/api/hospitals', hospitalRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'Ye URL nahi mila. Check karo ki sahi endpoint use kar rahe ho.',
    availableEndpoints: [
      '/api/hospitals/recommend',
      '/api/hospitals/emergency',
      '/api/hospitals/areas'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Application Error:', error);
  
  res.status(error.status || 500).json({
    error: 'Internal server error',
    message: 'System mein problem hai. Emergency ke liye 102 call karo.',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log("🏥 What's Up Doc Backend Started");
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 API Key configured: ${process.env.DATA_GOV_IN_API_KEY ? 'Yes' : 'No'}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  Health check: http://localhost:${PORT}/health`);
  console.log(`  API info: http://localhost:${PORT}/`);
  console.log(`  Recommendations: http://localhost:${PORT}/api/hospitals/recommend`);
  console.log(`  Emergency: http://localhost:${PORT}/api/hospitals/emergency`);
  console.log('');
  console.log('🚀 Ready to help India find healthcare anonymously!');
});

module.exports = app;
