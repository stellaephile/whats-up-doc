// Sample hospital data for local testing with facility types and severity routing
export const sampleHospitals = [
  // PHC and Dispensaries (Mild - 1-3km)
  {
    name: "Primary Health Center - Indiranagar",
    address: "12 Indiranagar, Bangalore, Karnataka 560038",
    phone: "080-89012345",
    latitude: 12.9784,
    longitude: 77.6408,
    isGovernment: true,
    category: "Government PHC",
    facility_type: "PHC",
    emergency_24x7: false,
    specialties: ["Primary Care", "Vaccination", "Maternal Health"],
    severity_tags: ["mild"]
  },
  {
    name: "Government Dispensary - Koramangala",
    address: "45 Koramangala 5th Block, Bangalore, Karnataka 560095",
    phone: "080-25553344",
    latitude: 12.9352,
    longitude: 77.6245,
    isGovernment: true,
    category: "Government Dispensary",
    facility_type: "Dispensary",
    emergency_24x7: false,
    specialties: ["Primary Care", "Basic Medicine"],
    severity_tags: ["mild"]
  },
  {
    name: "Community Health Centre - Whitefield",
    address: "78 Whitefield Main Road, Bangalore, Karnataka 560066",
    phone: "080-28445566",
    latitude: 12.9698,
    longitude: 77.7499,
    isGovernment: true,
    category: "Government Health Centre",
    facility_type: "Health Centre",
    emergency_24x7: false,
    specialties: ["Primary Care", "Pediatrics", "Gynecology"],
    severity_tags: ["mild", "moderate"]
  },
  {
    name: "Urban Health Center - Jayanagar",
    address: "23 Jayanagar 4th Block, Bangalore, Karnataka 560041",
    phone: "080-26657788",
    latitude: 12.9250,
    longitude: 77.5838,
    isGovernment: true,
    category: "Government Health Centre",
    facility_type: "Health Centre",
    emergency_24x7: false,
    specialties: ["Primary Care", "Immunization", "Family Planning"],
    severity_tags: ["mild"]
  },
  
  // Clinics and Nursing Homes (Moderate - 5km)
  {
    name: "City Care Clinic",
    address: "156 MG Road, Bangalore, Karnataka 560001",
    phone: "080-22334455",
    latitude: 12.9716,
    longitude: 77.5946,
    isGovernment: false,
    category: "Private Clinic",
    facility_type: "Clinic",
    emergency_24x7: false,
    specialties: ["General Medicine", "Pediatrics"],
    severity_tags: ["mild", "moderate"]
  },
  {
    name: "Sunshine Nursing Home",
    address: "89 Richmond Road, Bangalore, Karnataka 560025",
    phone: "080-22556677",
    latitude: 12.9698,
    longitude: 77.6089,
    isGovernment: false,
    category: "Private Nursing Home",
    facility_type: "Nursing Home",
    emergency_24x7: false,
    specialties: ["General Medicine", "Minor Surgery", "Maternity"],
    severity_tags: ["moderate"]
  },
  {
    name: "Lakeside Clinic & Diagnostics",
    address: "234 Bannerghatta Road, Bangalore, Karnataka 560076",
    phone: "080-26778899",
    latitude: 12.9100,
    longitude: 77.5950,
    isGovernment: false,
    category: "Private Clinic",
    facility_type: "Clinic",
    emergency_24x7: false,
    specialties: ["General Medicine", "Diagnostics", "Pathology"],
    severity_tags: ["mild", "moderate"]
  },
  
  // Hospitals (Moderate to High - 5-10km)
  {
    name: "District Government Hospital",
    address: "555 Civil Lines, Bangalore, Karnataka 560001",
    phone: "080-56789012",
    latitude: 12.9698,
    longitude: 77.5802,
    isGovernment: true,
    category: "Government Hospital",
    facility_type: "Hospital",
    emergency_24x7: true,
    specialties: ["General Medicine", "Gynecology", "Pediatrics", "Trauma Care"],
    severity_tags: ["moderate", "high", "emergency"]
  },
  {
    name: "Government General Hospital",
    address: "456 Hospital Road, Bangalore, Karnataka 560002",
    phone: "080-23456789",
    latitude: 12.9822,
    longitude: 77.5985,
    isGovernment: true,
    category: "Government Hospital",
    facility_type: "Hospital",
    emergency_24x7: true,
    specialties: ["General Medicine", "Surgery", "Pediatrics", "Emergency Care"],
    severity_tags: ["moderate", "high", "emergency"]
  },
  {
    name: "St. Mary's Hospital",
    address: "67 Cunningham Road, Bangalore, Karnataka 560052",
    phone: "080-22889900",
    latitude: 12.9950,
    longitude: 77.5937,
    isGovernment: false,
    category: "Private Hospital",
    facility_type: "Hospital",
    emergency_24x7: true,
    specialties: ["General Medicine", "Surgery", "Orthopedics", "Emergency Care"],
    severity_tags: ["moderate", "high", "emergency"]
  },
  
  // Multi-specialty Hospitals (High to Emergency - 10km)
  {
    name: "Apollo Hospitals",
    address: "123 MG Road, Bangalore, Karnataka 560001",
    phone: "080-12345678",
    latitude: 12.9716,
    longitude: 77.5946,
    isGovernment: false,
    category: "Private Multi-specialty",
    facility_type: "Multi-specialty Hospital",
    emergency_24x7: true,
    specialties: ["Cardiology", "Neurology", "Orthopedics", "Emergency Care", "ICU"],
    severity_tags: ["high", "emergency"]
  },
  {
    name: "Fortis Hospital",
    address: "321 Bannerghatta Road, Bangalore, Karnataka 560076",
    phone: "080-45678901",
    latitude: 12.9352,
    longitude: 77.6245,
    isGovernment: false,
    category: "Private Multi-specialty",
    facility_type: "Multi-specialty Hospital",
    emergency_24x7: true,
    specialties: ["Oncology", "Cardiology", "Nephrology", "Emergency Care", "ICU"],
    severity_tags: ["high", "emergency"]
  },
  {
    name: "Manipal Hospital",
    address: "98 HAL Airport Road, Bangalore, Karnataka 560017",
    phone: "080-78901234",
    latitude: 12.9539,
    longitude: 77.6650,
    isGovernment: false,
    category: "Private Multi-specialty",
    facility_type: "Multi-specialty Hospital",
    emergency_24x7: true,
    specialties: ["Neurosurgery", "Gastroenterology", "Urology", "Emergency Care", "Trauma"],
    severity_tags: ["high", "emergency"]
  },
  
  // Emergency Centers (Emergency only - 10km)
  {
    name: "Victoria Hospital Emergency & Trauma Center",
    address: "Fort Area, Bangalore, Karnataka 560002",
    phone: "080-26700301",
    latitude: 12.9698,
    longitude: 77.5965,
    isGovernment: true,
    category: "Government Trauma Center",
    facility_type: "Emergency Centre",
    emergency_24x7: true,
    specialties: ["Emergency Medicine", "Trauma Care", "Critical Care", "ICU"],
    severity_tags: ["emergency"]
  },
  {
    name: "Bangalore Emergency Medical Center",
    address: "234 Outer Ring Road, Bangalore, Karnataka 560037",
    phone: "080-49467000",
    latitude: 12.9279,
    longitude: 77.6271,
    isGovernment: false,
    category: "Private Emergency Center",
    facility_type: "Emergency Centre",
    emergency_24x7: true,
    specialties: ["Emergency Care", "Trauma Surgery", "ICU", "Ambulance Services"],
    severity_tags: ["emergency"]
  },
  
  // AYUSH facilities (for specific conditions)
  {
    name: "Ayurvedic Wellness Center",
    address: "789 Wellness Street, Bangalore, Karnataka 560003",
    phone: "080-34567890",
    latitude: 12.9634,
    longitude: 77.6089,
    isGovernment: false,
    category: "AYUSH - Ayurveda",
    facility_type: "Clinic",
    emergency_24x7: false,
    specialties: ["Ayurveda", "Panchakarma", "Yoga Therapy"],
    severity_tags: ["mild", "moderate"]
  },
  {
    name: "Homeopathy Clinic & Research Center",
    address: "888 Jayanagar, Bangalore, Karnataka 560041",
    phone: "080-67890123",
    latitude: 12.9250,
    longitude: 77.5838,
    isGovernment: false,
    category: "AYUSH - Homeopathy",
    facility_type: "Clinic",
    emergency_24x7: false,
    specialties: ["Homeopathy", "Chronic Disease Management"],
    severity_tags: ["mild", "moderate"]
  }
];

// Sample emergency hospitals (24/7 trauma centers)
export const sampleEmergencyHospitals = [
  {
    name: "Victoria Hospital Emergency & Trauma Center",
    address: "Fort Area, Bangalore, Karnataka 560002",
    phone: "080-26700301",
    latitude: 12.9698,
    longitude: 77.5965,
    isGovernment: true,
    category: "Government Trauma Center",
    facility_type: "Emergency Centre",
    emergency_24x7: true,
    specialties: ["Emergency Medicine", "Trauma Care", "Critical Care", "ICU"],
    severity_tags: ["emergency"]
  },
  {
    name: "St. John's Medical College Hospital",
    address: "Sarjapur Road, Bangalore, Karnataka 560034",
    phone: "080-49467000",
    latitude: 12.9279,
    longitude: 77.6271,
    isGovernment: false,
    category: "Private Emergency Center",
    facility_type: "Emergency Centre",
    emergency_24x7: true,
    specialties: ["Emergency Care", "Trauma Surgery", "ICU"],
    severity_tags: ["emergency"]
  },
  {
    name: "Bangalore Baptist Hospital Emergency",
    address: "Bellary Road, Bangalore, Karnataka 560024",
    phone: "080-22251555",
    latitude: 13.0143,
    longitude: 77.5794,
    isGovernment: false,
    category: "Private Emergency Center",
    facility_type: "Emergency Centre",
    emergency_24x7: true,
    specialties: ["24/7 Emergency", "Trauma Care", "Ambulance Services"],
    severity_tags: ["emergency"]
  },
  {
    name: "Apollo Hospitals Emergency",
    address: "123 MG Road, Bangalore, Karnataka 560001",
    phone: "080-12345678",
    latitude: 12.9716,
    longitude: 77.5946,
    isGovernment: false,
    category: "Private Multi-specialty",
    facility_type: "Multi-specialty Hospital",
    emergency_24x7: true,
    specialties: ["Cardiology", "Neurology", "Orthopedics", "Emergency Care", "ICU"],
    severity_tags: ["high", "emergency"]
  },
  {
    name: "Fortis Hospital Emergency",
    address: "321 Bannerghatta Road, Bangalore, Karnataka 560076",
    phone: "080-45678901",
    latitude: 12.9352,
    longitude: 77.6245,
    isGovernment: false,
    category: "Private Multi-specialty",
    facility_type: "Multi-specialty Hospital",
    emergency_24x7: true,
    specialties: ["Oncology", "Cardiology", "Nephrology", "Emergency Care", "ICU"],
    severity_tags: ["high", "emergency"]
  }
];
