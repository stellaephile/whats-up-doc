# 🩺 What’s Up Doc

### AI-Powered Healthcare Navigation Platform for India

<img width="800" height="533" alt="image" src="https://github.com/user-attachments/assets/33168bfa-63cd-4d76-8599-e38018e7dbb9" />

Built with ❤️ using **Kiro**

---

## 🚀 Overview

**What’s Up Doc** is an intelligent healthcare navigation platform that helps patients in India find the *right level of care* based on their symptoms.

Instead of diagnosing diseases, the system:

* Assesses symptom severity using AI
* Detects emergencies instantly
* Routes users to appropriate healthcare facilities (PHC / Clinic / Hospital / Emergency)
* Prioritizes affordability, distance, and specialization

Our goal:
👉 Reduce unnecessary hospital visits
👉 Improve emergency response
👉 Enable smarter healthcare decisions

---

## 🧠 Key Features

### 1️⃣ AI Symptom Assessment

* Accepts text or voice input
* Supports Hindi / English / Hinglish
* Generates severity score (1–10)
* Never provides medical diagnosis

### 2️⃣ Emergency Detection (High Priority)

* Real-time keyword & contextual analysis
* Instantly triggers emergency mode
* Displays ambulance numbers (108 / 102)
* Routes only to emergency-capable facilities

### 3️⃣ Smart Facility Routing

Facilities ranked using composite scoring:

* **Capabilities – 50%**
* **Distance – 30%**
* **Insurance Support – 20%**

Dynamic radius based on severity:

* Mild → 3 km
* Moderate → 5 km
* High → 10 km
* Emergency → Emergency hospitals only

### 4️⃣ Medical Report Integration (Optional)

* Upload PDF / images
* OCR + AI medical entity extraction
* Critical findings adjust severity scoring

### 5️⃣ Location Intelligence

* GPS or Pincode-based search
* Map-based visualization
* Turn-by-turn directions

### 6️⃣ Fail-Safe Design

* AI unavailable → Show nearby hospitals
* No facilities found → Expand radius to 20km
* Conservative emergency detection (prioritize safety)

---

## 🏗 Architecture Overview

**Frontend**

* Web / Mobile Interface

**Backend**

* AI Symptom Assessment Engine
* Emergency Detection Service
* Facility Routing Engine
* Medical Report Analysis Module

**Data**

* Secure encrypted storage (AES-256)
* India-based data residency

---

## 🔐 Privacy & Safety

* Explicit user consent required
* Data encrypted at rest
* Symptom history auto-deleted after retention window
* Clear disclaimer:

  > “Not a medical diagnosis. Consult a healthcare provider.”

---

## 📊 Process Flow

User Entry → Login / Guest → Symptom Input →
AI Assessment + Emergency Check →
Care Level Determination →
Location Capture →
Facility Filtering & Ranking →
Map + Directions →
Secure Storage + Disclaimer

---

## 🎯 Hackathon Scope

For this hackathon version, we focused on:

* Core symptom assessment
* Emergency routing
* Severity-based facility filtering
* Clean, scalable architecture
* Clear UI process flow

---

## 🌍 Problem We’re Solving

In India:

* Patients often go to expensive private hospitals for minor issues
* Or visit facilities lacking required specialization
* Emergency response delays cost lives

**What’s Up Doc bridges that gap.**

---

## 🛠 Built With

* Kiro
* AI-based NLP
* Geolocation services
* Cloud-native architecture

---

## 👥 Team

Built for AI Bharat 2026
Team Name: The Prompt Coven

Team Members:
Akshay Pant – @pantakshay41
Sonal Ganvir – @stellaephile

