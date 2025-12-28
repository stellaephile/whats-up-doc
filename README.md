# What's Up Doc: Anonymous Healthcare Navigation

A privacy-first healthcare navigation system that helps users find the right medical facility based on their pincode and medical condition, without requiring any personal information.

## 🚀 Features

### Phase 1: Entry & Anonymized Intent
- **Pincode-based search** - Enter 6-digit pincode for location
- **Plain language symptoms** - Type conditions in English/Hinglish
- **Emergency toggle** - Priority mode for 24/7 trauma centers
- **Privacy-first** - No names, IDs, or personal data required

### Phase 2: Discovery & Spatial Mapping
- **Interactive map** with Leaflet.js showing hospital locations
- **Color-coded pins**: Red (Private), Blue (Government), Green (AYUSH)
- **Hospital filtering** - Toggle between Sarkari/Private/AYUSH
- **Detailed hospital cards** with specialties, contact info, and costs

## 🏥 Supported Cities

Currently integrated with **data.gov.in National Hospital Directory**:

- **Hyderabad** (500xxx pincodes) - Live API data
- **Bangalore** (560xxx pincodes) - Live API data  
- **Chennai** (600xxx pincodes) - Live API data

## 🛠️ Technology Stack

### Backend
- **Node.js + Express.js** - API server
- **data.gov.in API** - Real hospital data from Government of India
- **Multi-city service** - Pincode-to-city mapping with fallback data

### Frontend
- **React** - Component-based UI
- **Tailwind CSS** - Modern styling with glass morphism effects
- **Leaflet.js** - Interactive maps with OpenStreetMap
- **Material Icons** - Consistent iconography

## 🚦 Getting Started

### Prerequisites
- Node.js (v14+)
- data.gov.in API key

### Installation

1. **Clone and setup backend:**
```bash
cd backend
npm install
```

2. **Configure API key:**
```bash
# Create .env file in backend/
echo "DATA_GOV_IN_API_KEY=your_api_key_here" > .env
```

3. **Setup frontend:**
```bash
cd frontend
npm install
```

### Running the Application

1. **Start backend server:**
```bash
cd backend
npm start
# Server runs on http://localhost:3000
```

2. **Start frontend server:**
```bash
cd frontend  
npm start
# Frontend runs on http://localhost:3001
```

## 🧪 Testing

### API Endpoints

```bash
# Basic hospital search
curl "http://localhost:3000/api/hospitals/recommend?condition=fever&pincode=500001"

# Emergency hospitals
curl "http://localhost:3000/api/hospitals/emergency?pincode=500001"

# Available areas
curl "http://localhost:3000/api/hospitals/areas?city=Hyderabad"
```

### Frontend Testing

1. Open http://localhost:3001
2. **Test Phase 1:**
   - Enter pincode: `500001` (Hyderabad)
   - Enter condition: `fever` or `heart checkup`
   - Toggle emergency mode
   - Click Search

3. **Test Phase 2:**
   - View hospitals on interactive map
   - Click hospital pins for details
   - Use filter buttons (Sarkari/Private/AYUSH)
   - Click hospital cards to highlight on map

## 📱 User Experience Flow

### Normal Flow
1. User enters 6-digit pincode
2. Describes symptoms in plain language
3. System maps to medical specialties
4. Shows nearby hospitals on map
5. User selects hospital and gets directions

### Emergency Flow  
1. User toggles emergency mode
2. System prioritizes 24/7 trauma centers
3. Bypasses specialty filtering
4. Shows nearest emergency hospitals immediately

## 🔒 Privacy Features

- **No personal data collection** - Only pincode and symptoms
- **Anonymous sessions** - No user tracking or registration
- **Local processing** - Location data handled in memory only
- **No cookies** - Stateless operation

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │  data.gov.in    │
│   (React)       │◄──►│   (Express.js)   │◄──►│   Hospital API  │
│                 │    │                  │    │                 │
│ • Phase 1 UI    │    │ • Pincode mapping│    │ • Real hospital │
│ • Phase 2 Map   │    │ • Specialty logic│    │   data          │
│ • Leaflet.js    │    │ • Fallback data  │    │ • Government    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🎯 Specialty Mapping

The system intelligently maps user input to medical specialties:

- **"fever", "child fever"** → Pediatrics, General Medicine
- **"heart pain", "chest pain"** → Cardiology
- **"accident", "emergency"** → Emergency Medicine, Trauma
- **"pregnancy", "maternity"** → Obstetrics & Gynecology
- **"eye problem"** → Ophthalmology
- **"skin rash"** → Dermatology

## 🌟 Key Innovations

1. **Pincode-first approach** - No GPS required, works offline for location
2. **Two-phase UI** - Clean entry → Rich discovery experience  
3. **Government data integration** - Real, verified hospital information
4. **Multi-language support** - English and Hinglish symptom recognition
5. **Emergency prioritization** - Life-saving features for critical situations

## 🚀 Future Enhancements

- **More cities** - Delhi, Mumbai, Pune, Kolkata
- **Real-time capacity** - Bed availability and wait times
- **Telemedicine integration** - Connect with online consultations
- **Offline mode** - Cached hospital data for network issues
- **Voice input** - Speak symptoms instead of typing

## 📞 Emergency Numbers

- **Ambulance**: 102
- **Emergency Response**: 108  
- **Police**: 100

## 🤝 Contributing

This is a healthcare utility focused on helping people find medical care anonymously. Contributions welcome for:

- Additional city support
- Better symptom-to-specialty mapping
- UI/UX improvements
- Performance optimizations

## 📄 License

Open source healthcare utility - built for public benefit.

---

**Disclaimer**: This service is for informational purposes only and does not constitute medical advice. In life-threatening emergencies, call 102 immediately.