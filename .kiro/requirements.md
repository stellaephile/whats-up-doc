# Requirements Document

## Introduction

What's Up Doc is an intelligent healthcare navigation platform that helps patients in India find the appropriate healthcare facility for their specific medical needs. The system provides AI-powered symptom assessment that routes patients to appropriate care levels (PHC vs Hospital vs Emergency) without diagnosing medical conditions. The platform addresses the critical problem where patients either go to expensive private hospitals for minor issues or unsuitable facilities lacking required specialization.

## Glossary

- **System**: The What's Up Doc healthcare navigation platform
- **Patient**: A person seeking healthcare guidance through the platform
- **Care_Level**: The appropriate level of healthcare (PHC, Clinic, Hospital, Emergency)
- **Emergency_Symptoms**: Life-threatening symptoms requiring immediate medical attention
- **Facility**: A healthcare provider (PHC, clinic, hospital, emergency center)
- **Assessment**: The process of evaluating symptoms to determine appropriate care level
- **Routing**: The process of matching patients to appropriate healthcare facilities
- **Red_Flags**: Critical symptoms that indicate emergency conditions
- **PHC**: Primary Health Centre - government facility for basic healthcare
- **CGHS**: Central Government Health Scheme
- **Symptom_Severity**: A numerical score (1-10) indicating the urgency of medical attention needed
- **User_Account**: A registered patient profile with authentication credentials
- **Medical_Report**: Digital documents including lab results, prescriptions, diagnostic images, and clinical notes
- **Report_Analysis**: AI-powered interpretation of medical reports to extract key findings and recommendations

## Functional Requirements

### Requirement 1: Intelligent Symptom Assessment

**User Story:** As a patient experiencing health symptoms, I want to describe my symptoms in natural language, so that the system can assess the severity and guide me to appropriate care.

#### Acceptance Criteria

1. WHEN a patient inputs symptoms in natural language (Hindi/English/Hinglish), THE System SHALL process the input within 3 seconds
2. WHEN symptoms are processed, THE System SHALL generate clarifying questions (2-5 questions maximum) based on the initial input
3. WHEN emergency keywords are detected in symptom input, THE System SHALL automatically upgrade the severity assessment to emergency level
4. WHEN the assessment is complete, THE System SHALL assign a severity score (1-10) without providing medical diagnosis
5. THE System SHALL support voice input transcription in Hindi and English languages

### Requirement 2: Emergency Detection and Response

**User Story:** As a patient experiencing emergency symptoms, I want the system to immediately identify life-threatening conditions, so that I can be directed to emergency care without delay.

#### Acceptance Criteria

1. WHEN emergency keywords are detected (chest pain, severe bleeding, breathlessness, stroke signs, loss of consciousness), THE System SHALL flag the case as emergency within 5 seconds
2. WHEN an emergency is detected, THE System SHALL display prominent warning message stating "These symptoms may be life-threatening"
3. WHEN emergency mode is activated, THE System SHALL skip non-critical clarifying questions and proceed directly to facility routing
4. WHEN in emergency mode, THE System SHALL display ambulance contact numbers (108/102) prominently
5. IF a patient manually overrides emergency detection, THE System SHALL maintain persistent warning banner and continue showing emergency facilities

### Requirement 3: Healthcare Facility Routing

**User Story:** As a patient needing medical care, I want to be directed to appropriate healthcare facilities based on my symptom severity and location, so that I receive suitable care without unnecessary cost or delay.

#### Acceptance Criteria

1. WHEN symptoms indicate mild severity (score ≤3), THE System SHALL prioritize PHC and dispensaries within 3km radius
2. WHEN symptoms indicate moderate severity (score 4-6), THE System SHALL show clinics and hospitals within 5km radius
3. WHEN symptoms indicate high severity (score 7-8), THE System SHALL show hospitals within 10km radius
4. WHEN emergency symptoms are detected (score 9-10), THE System SHALL show only emergency facilities within 10km radius
5. WHEN no appropriate facilities are found within the specified radius, THE System SHALL expand search to 20km and display explanatory message
6. THE System SHALL rank facilities using composite scoring: facility capabilities (50%) + distance (30%) + insurance schemes (20%)

### Requirement 4: Specialty Department Matching

**User Story:** As a patient with specific symptoms requiring specialized care, I want to be directed to facilities with relevant departments, so that I reach the right specialist quickly.

#### Acceptance Criteria

1. WHEN pregnancy-related symptoms are detected, THE System SHALL filter results to show only facilities with Obstetrics & Gynecology departments
2. WHEN chest pain symptoms are detected, THE System SHALL prioritize facilities with Cardiology departments for non-emergency cases
3. WHEN respiratory symptoms are detected, THE System SHALL show facilities with Pulmonology or ENT departments
4. WHEN neurological symptoms are detected, THE System SHALL show facilities with Neurology departments
5. THE System SHALL display department availability information on facility result cards

### Requirement 5: Government Scheme Integration

**User Story:** As a cost-conscious patient with government insurance, I want to be shown facilities that accept my insurance scheme, so that I can access affordable healthcare.

#### Acceptance Criteria

1. WHEN a patient has CGHS coverage, THE System SHALL prioritize CGHS-empaneled facilities in search results
2. WHEN displaying facility results, THE System SHALL show accepted insurance schemes (CGHS, ESI, PMJAY) for each facility
3. WHEN government facilities are available, THE System SHALL rank them higher than private facilities for mild to moderate symptoms
4. THE System SHALL display estimated cost ranges for government vs private facilities
5. WHERE cost transparency is enabled, THE System SHALL show "Government (₹100-1000)" vs "Private (₹500-5000)" cost indicators

### Requirement 6: Multi-Language Support

**User Story:** As a Hindi-speaking patient, I want to interact with the system in my preferred language, so that I can describe symptoms comfortably and understand the guidance.

#### Acceptance Criteria

1. THE System SHALL accept symptom input in Hindi, English, and Hinglish (mixed Hindi-English)
2. WHEN language is detected from user input, THE System SHALL generate follow-up questions in the same language
3. THE System SHALL provide user interface labels in the selected language (Hindi/English)
4. WHEN voice input is used, THE System SHALL transcribe speech in Hindi and English with >85% accuracy
5. THE System SHALL maintain language consistency throughout the user session

### Requirement 7: Location-Based Services

**User Story:** As a patient seeking nearby healthcare, I want the system to use my location to find the closest appropriate facilities, so that I can minimize travel time during illness.

#### Acceptance Criteria

1. WHEN a patient provides pincode, THE System SHALL geocode the location within 1 second
2. THE System SHALL calculate distances to healthcare facilities with ±100 meter accuracy
3. WHEN displaying results, THE System SHALL show estimated travel time by road for each facility
4. THE System SHALL provide map visualization with color-coded facility markers (PHC-green,AAYUSH-green leaf icon, Government-blue, CGHS-yellow, Private-red)
5. THE System SHALL generate turn-by-turn directions to selected facilities

### Requirement 8: Data Privacy and Compliance

**User Story:** As a patient sharing sensitive health information, I want my data to be protected and handled according to Indian privacy laws, so that my medical privacy is maintained.

#### Acceptance Criteria

1. THE System SHALL encrypt all symptom data at rest using AES-256 encryption
2. THE System SHALL store data only in Indian data centers (Mumbai region) for DPDPA 2023 compliance
3. WHEN storing patient data, THE System SHALL require explicit consent before processing
4. THE System SHALL automatically delete symptom history after 90 days unless patient opts for retention
5. THE System SHALL provide data deletion capability within 30 days of user request

### Requirement 9: System Performance and Reliability

**User Story:** As a patient in a medical emergency, I want the system to respond quickly and be available 24/7, so that I can get help when I need it most.

#### Acceptance Criteria

1. THE System SHALL process symptom assessment requests within 3 seconds under normal load
2. THE System SHALL maintain 99.5% uptime for emergency detection functionality
3. WHEN AI services are unavailable, THE System SHALL gracefully degrade by showing all nearby hospitals
4. THE System SHALL support 10,000 concurrent users without performance degradation
5. THE System SHALL cache facility data locally to enable offline emergency facility lookup

### Requirement 10: Medical Disclaimer and Safety

**User Story:** As a healthcare platform, I want to ensure users understand the system's limitations, so that they seek appropriate medical care and don't rely solely on automated assessment.

#### Acceptance Criteria

1. THE System SHALL display "Not a medical diagnosis" disclaimer on all assessment results
2. THE System SHALL never state "You have [disease]" but only "Symptoms suggest need for [care level]"
3. WHEN providing facility recommendations, THE System SHALL include disclaimer "Consult healthcare provider for medical advice"
4. THE System SHALL maintain emergency contact numbers (108/102) visible throughout emergency flows
5. THE System SHALL require user acknowledgment of disclaimers before proceeding with assessment

### Requirement 11: User Authentication and Account Management

**User Story:** As a patient using the healthcare platform, I want to create and manage my account securely, so that I can access personalized healthcare guidance and maintain my medical history.

#### Acceptance Criteria

1. WHEN a new user registers, THE System SHALL require phone number verification via OTP within 2 minutes
2. WHEN a user logs in, THE System SHALL authenticate using phone number and OTP.
3. THE System SHALL allow users to create and update their profile including age, gender, chronic conditions, and insurance information
4. WHEN a user logs in, THE System SHALL restore their previous session data and assessment history
5. THE System SHALL provide secure logout functionality that clears all session data
6. THE System SHALL support guest mode for emergency situations without requiring registration
7. WHEN account creation fails, THE System SHALL provide clear error messages and alternative registration methods

### Requirement 12: Medical Report Analysis and Integration

**User Story:** As a patient with existing medical reports, I want to upload and analyze my lab results, prescriptions, and diagnostic reports, so that I can get personalized healthcare recommendations based on my medical history.

#### Acceptance Criteria

1. WHEN a user uploads a medical report (PDF, image, or document), THE System SHALL process and extract key medical information within 10 seconds
2. THE System SHALL support analysis of lab reports, prescription documents, diagnostic images (X-rays, CT scans), and clinical notes
3. WHEN analyzing reports, THE System SHALL identify abnormal values, critical findings, and medication interactions
4. THE System SHALL integrate report findings with symptom assessment to provide more accurate facility routing
5. THE System SHALL maintain a secure digital health record for each user with uploaded reports and analysis history
6. THE System SHALL provide report summaries in the user's preferred language (Hindi/English)
7. THE System SHALL encrypt all medical reports using AES-256 encryption and store in DPDPA 2023 compliant data centers
8. THE System SHALL allow users to share specific report analyses with healthcare providers through secure links.