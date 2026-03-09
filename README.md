# 🩺 What's Up Doc

### AI-Powered Healthcare Navigation Platform for India

<img width="800" alt="What's Up Doc" src="https://github.com/user-attachments/assets/33168bfa-63cd-4d76-8599-e38018e7dbb9" />

Built with ❤️ using **Kiro** · **AWS Bedrock** · **Amazon Polly** · **PostGIS**

---

## 🌐 Live Demo

| | URL |
|---|---|
| **Frontend** | [https://main.d38hwexwvif5zl.amplifyapp.com](https://main.d38hwexwvif5zl.amplifyapp.com) |
| **Backend Health** | [https://whats-up-doc.ap-south-1.elasticbeanstalk.com/health](https://whats-up-doc.ap-south-1.elasticbeanstalk.com/health) |

---

## ✅ Try the Prototype

### Case 1 — Normal Symptoms
1. Open the frontend URL above
2. Enter pincode **`560001`** (Bengaluru)
3. Type symptoms: `high fever and joint pain for 3 days`
4. Answer the clarifying questions
5. See severity assessment → nearest hospitals on map
6. Listen to Polly read out the top result

### Case 2 — Emergency (Hindi)
1. Enter pincode **`400001`** (Mumbai)
2. Toggle **Emergency SOS** button ON
3. Type: `seena mein dard saans nahi aa raha`
4. See instant emergency routing — no AI delay
5. Red banner + Call 108 button + Polly speaks in Hindi

### Case 3 — AYUSH / Ayurveda
1. Enter any pincode
2. Type: `ayurveda treatment for back pain`
3. See 🌿 green AYUSH banner — AYUSH hospitals shown first

> **Note:** If you see an SSL warning on the API, open [https://whats-up-doc.ap-south-1.elasticbeanstalk.com/health](https://whats-up-doc.ap-south-1.elasticbeanstalk.com/health) in your browser first and click **Advanced → Proceed**. This is a known issue with the EB self-signed certificate — fix in progress.

---

## 🚀 Overview

**What's Up Doc** is an intelligent healthcare navigation platform that helps patients in India find the *right level of care* based on their symptoms — not just the nearest hospital.

Instead of diagnosing diseases, the system:

- Assesses symptom severity using two-stage AI (Claude Haiku → Claude 3.5 Haiku)
- Detects emergencies instantly — in Hindi, English, and Hinglish
- Routes users to the appropriate care level (PHC / Clinic / Hospital / Emergency)
- Speaks results aloud using Amazon Polly's Kajal Neural voice
- Searches across **30,272 verified hospitals** across India

**Our goal:**
- Reduce unnecessary visits to expensive private hospitals
- Improve emergency response time
- Enable smarter healthcare decisions for 1.4 billion people

---

## 🧠 Key Features

### 1️⃣ Two-Stage AI Assessment
- **Stage 1 — Claude Haiku:** triage, language detection, emergency check, clarifying questions
- **Stage 2 — Claude 3.5 Haiku:** severity scoring (1–10), department mapping, recommended action
- Supports Hindi / English / Hinglish natively
- Never provides medical diagnosis

### 2️⃣ Emergency Detection
- Real-time Hindi + English keyword detection (client-side, zero latency)
- 20+ hardcoded emergency terms: `seena dard`, `prasav dard`, `behosh`, `dil ka daura` and more
- Skips AI entirely for emergencies — saves 3–4 seconds
- Routes only to 24×7 emergency-capable facilities
- Displays ambulance number (108) prominently

### 3️⃣ Severity-Based Routing

| Severity | Care Types | Radius |
|---|---|---|
| Mild | Dispensary, PHC, Clinic | 3 km |
| Moderate | Hospital, Clinic, Nursing Home | 5 km |
| High | Hospital, Medical College | 10 km |
| Emergency | Emergency only (24×7) | 10–20 km |

Auto-expands radius if no results found — up to 20 km.

### 4️⃣ Amazon Polly Voice (Bilingual)
- Kajal Neural voice — sounds natural in both English and Hindi
- Auto-plays on results load — no button needed
- Emergency: *"Achintak sthiti. Sabse paas ka aspatal hai..."*
- Normal: *"We found the best match for you. [Hospital] is X km away."*

### 5️⃣ AYUSH Hospital Prioritization
- Detects Ayurveda, Homeopathy, Yoga, Unani, Siddha queries
- Shows 🌿 green banner and sorts AYUSH hospitals first
- Separate DB query using `WHERE ayush = TRUE`

### 6️⃣ Pincode Geocoding (4-layer fallback)
1. India Post API → district/state lookup
2. AWS Location Service → accurate lat/lng
3. DB centroid (bounds-validated within India)
4. District prefix fallback

### 7️⃣ Fail-Safe Design
- AI unavailable → client-side keyword engine (never fails)
- No facilities in radius → auto-expand to 20 km
- Specialty not found in DB → synonym map + drop specialty on pass 2
- Polly fails → silent fallback, UI still works fully

---

## 🏗 Architecture

```
React Frontend (AWS Amplify)
  ├── Symptom input → POST /api/assess → Python Lambda
  ├── Pincode → GET /api/pincode/:pin → AWS Location → RDS
  ├── Hospital search → POST /api/hospitals/severity-based → PostGIS
  └── Voice → POST /api/polly → Amazon Polly Kajal Neural

Node.js Backend (AWS Elastic Beanstalk)
  ├── /api/assess → proxy → Python Lambda
  ├── /api/polly → Amazon Polly
  ├── /api/hospitals/severity-based → RDS PostGIS
  └── /api/pincode/:pincode → AWS Location + RDS fallback

Python Lambda (assess-service)
  ├── Stage 1: Claude Haiku → triage + clarifying questions
  └── Stage 2: Claude 3.5 Haiku → severity + department mapping

AWS RDS PostgreSQL + PostGIS
  └── 30,272 hospitals · geospatial indexing · data quality scoring
```

---

## ☁️ AWS Services Used

| Service | Purpose |
|---|---|
| **AWS Amplify** | Frontend hosting + CI/CD |
| **AWS Elastic Beanstalk** | Node.js API server |
| **AWS Lambda** | Python symptom assessment service |
| **AWS Bedrock** | Claude Haiku + Claude 3.5 Haiku |
| **Amazon RDS** | PostgreSQL + PostGIS hospital database |
| **AWS Location Service** | Pincode geocoding |
| **Amazon Polly** | Bilingual neural text-to-speech |

---

## 🔐 Privacy & Safety

- No user accounts required — fully anonymous
- No symptom data stored after session
- Clear disclaimer on every result: *"Not a medical diagnosis. Consult a healthcare provider."*
- Emergency detection always errs on the side of caution

---

## 🛠 Local Development

```bash
# Backend
cd backend
cp .env.example .env   # fill in AWS + DB credentials
npm install
node server.js         # runs on :5001

# Assessment Lambda (local)
pip install flask
python assess_local.py  # runs on :8001

# Frontend
cd frontend
cp .env.example .env.local
# set REACT_APP_API_URL=http://localhost:5001
npm install
npm start              # runs on :3000
```

---

## 📊 Data

- **Source:** National Health Portal of India + state health directories
- **Total hospitals:** 30,272
- **With coordinates:** ~12,000+ (quality score ≥ 0.4)
- **Emergency 24×7:** ~600+
- **AYUSH:** ~4,000+
- **Quality scoring:** based on completeness of name, address, pincode, coordinates, specialties, and contact info

---

## 🌍 Problem We're Solving

In India:
- Patients visit expensive private hospitals for minor issues that a PHC could handle
- Facilities often lack required specialization for the actual condition
- Emergency response delays cost lives — especially when patients don't know which hospital to go to
- Language barrier — most health apps only work in English

**What's Up Doc bridges that gap — in the user's own language, instantly.**

---

## 👥 Team

Built for **AI Bharat Hackathon 2026**
Team: **The Prompt Coven**

| Name | GitHub |
|---|---|
| Akshay Pant | [@pantakshay41](https://github.com/pantakshay41) |
| Sonal Ganvir | [@stellaephile](https://github.com/stellaephile) |