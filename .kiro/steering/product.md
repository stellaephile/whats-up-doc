# What's Up Doc: Anonymous Healthcare Navigation

## Product Overview
What's Up Doc is a privacy-first healthcare navigation system that helps users find appropriate medical facilities across Indian cities based on their pincode and medical condition, without requiring any personal information.

## Core Features

### Multi-City Support
- **Hyderabad** (500xxx pincodes) - Live API integration with data.gov.in
- **Bangalore** (560xxx pincodes) - Live API integration  
- **Chennai** (600xxx pincodes) - Live API integration
- **Mumbai** (400xxx pincodes) - Live API integration with data.gov.in
- **Delhi** (110xxx pincodes) - Live API integration with data.gov.in

### Two-Phase User Experience
1. **Phase 1**: Clean entry interface for pincode and symptom input
2. **Phase 2**: Interactive map discovery with hospital details and filtering

### Privacy-First Design
- **Zero data collection**: No names, IDs, or personal information required
- **Pincode-based location**: No GPS tracking or exact addresses
- **Anonymous sessions**: No user tracking or registration
- **Local processing**: Location data handled in memory only

## Specialty Mapping Intelligence
The system intelligently maps user symptoms to medical specialties:
- **"fever", "child fever"** → Pediatrics, General Medicine
- **"heart pain", "chest pain"** → Cardiology  
- **"accident", "emergency"** → Emergency Medicine, Trauma
- **"pregnancy", "maternity"** → Obstetrics & Gynecology
- **"eye problem"** → Ophthalmology
- **"skin rash"** → Dermatology

## Hospital Categorization
- **Government/Sarkari** (Blue markers): Free/subsidized treatment
- **Private** (Red markers): Paid services, faster access
- **AYUSH** (Green markers): Ayurveda, Homeopathy, Unani systems

## Emergency Mode
Special emergency toggle that:
- Prioritizes 24/7 trauma centers
- Bypasses specialty filtering
- Shows nearest emergency hospitals immediately
- Provides direct calling functionality