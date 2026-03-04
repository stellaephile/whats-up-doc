# Product Overview

What's Up Doc is an AI-powered healthcare navigation platform for India that helps patients find the right level of care based on their symptoms.

## Core Purpose

Route patients to appropriate healthcare facilities (PHC/Clinic/Hospital/Emergency) based on AI-assessed symptom severity, reducing unnecessary hospital visits and improving emergency response.

## Key Features

- AI symptom assessment (text/voice, Hindi/English/Hinglish support)
- Emergency detection with instant routing to 24x7 trauma centers
- Severity-based facility routing (mild/moderate/high/emergency)
- Progressive radius expansion (3km → 5km → 10km → 20km)
- Government facility prioritization for mild/moderate cases
- Location-based search via pincode or GPS
- Interactive map visualization with Leaflet

## User Flow

1. User enters pincode and describes symptoms
2. AI assesses severity (1-10 scale) and may ask clarifying questions
3. System routes to appropriate facilities within severity-based radius
4. Results displayed on map with distance, contact info, and directions
5. Emergency cases show ambulance numbers (108/102) prominently

## Privacy & Safety

- 100% anonymous (no login required)
- Explicit disclaimer: "Not a medical diagnosis. Consult a healthcare provider."
- Conservative emergency detection (prioritize safety)
- Data encrypted at rest (AES-256)
