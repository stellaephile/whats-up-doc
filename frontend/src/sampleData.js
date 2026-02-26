// Sample hospital data for local testing
export const sampleHospitals = [
  {
    name: "Apollo Hospitals",
    address: "123 MG Road, Bangalore, Karnataka 560001",
    phone: "080-12345678",
    latitude: 12.9716,
    longitude: 77.5946,
    isGovernment: false,
    category: "Private Multi-specialty",
    specialties: ["Cardiology", "Neurology", "Orthopedics", "Emergency Care"],
    distance: "2.3 km"
  },
  {
    name: "Government General Hospital",
    address: "456 Hospital Road, Bangalore, Karnataka 560002",
    phone: "080-23456789",
    latitude: 12.9822,
    longitude: 77.5985,
    isGovernment: true,
    category: "Government Hospital",
    specialties: ["General Medicine", "Surgery", "Pediatrics", "Emergency Care"],
    distance: "3.1 km"
  },
  {
    name: "Ayurvedic Wellness Center",
    address: "789 Wellness Street, Bangalore, Karnataka 560003",
    phone: "080-34567890",
    latitude: 12.9634,
    longitude: 77.6089,
    isGovernment: false,
    category: "AYUSH - Ayurveda",
    specialties: ["Ayurveda", "Panchakarma", "Yoga Therapy"],
    distance: "1.8 km"
  },
  {
    name: "Fortis Hospital",
    address: "321 Bannerghatta Road, Bangalore, Karnataka 560076",
    phone: "080-45678901",
    latitude: 12.9352,
    longitude: 77.6245,
    isGovernment: false,
    category: "Private Multi-specialty",
    specialties: ["Oncology", "Cardiology", "Nephrology", "Emergency Care"],
    distance: "4.5 km"
  },
  {
    name: "District Government Hospital",
    address: "555 Civil Lines, Bangalore, Karnataka 560001",
    phone: "080-56789012",
    latitude: 12.9698,
    longitude: 77.5802,
    isGovernment: true,
    category: "Government Hospital",
    specialties: ["General Medicine", "Gynecology", "Pediatrics", "Trauma Care"],
    distance: "2.7 km"
  },
  {
    name: "Homeopathy Clinic & Research Center",
    address: "888 Jayanagar, Bangalore, Karnataka 560041",
    phone: "080-67890123",
    latitude: 12.9250,
    longitude: 77.5838,
    isGovernment: false,
    category: "AYUSH - Homeopathy",
    specialties: ["Homeopathy", "Chronic Disease Management"],
    distance: "3.9 km"
  },
  {
    name: "Manipal Hospital",
    address: "98 HAL Airport Road, Bangalore, Karnataka 560017",
    phone: "080-78901234",
    latitude: 12.9539,
    longitude: 77.6650,
    isGovernment: false,
    category: "Private Multi-specialty",
    specialties: ["Neurosurgery", "Gastroenterology", "Urology", "Emergency Care"],
    distance: "5.2 km"
  },
  {
    name: "Primary Health Center - Indiranagar",
    address: "12 Indiranagar, Bangalore, Karnataka 560038",
    phone: "080-89012345",
    latitude: 12.9784,
    longitude: 77.6408,
    isGovernment: true,
    category: "Government PHC",
    specialties: ["Primary Care", "Vaccination", "Maternal Health"],
    distance: "1.5 km"
  }
];

// Sample emergency hospitals (24/7 trauma centers)
export const sampleEmergencyHospitals = [
  {
    name: "Victoria Hospital Emergency",
    address: "Fort Area, Bangalore, Karnataka 560002",
    phone: "080-26700301",
    latitude: 12.9698,
    longitude: 77.5965,
    isGovernment: true,
    category: "Government Trauma Center",
    specialties: ["Emergency Medicine", "Trauma Care", "Critical Care"],
    distance: "2.1 km"
  },
  {
    name: "St. John's Medical College Hospital",
    address: "Sarjapur Road, Bangalore, Karnataka 560034",
    phone: "080-49467000",
    latitude: 12.9279,
    longitude: 77.6271,
    isGovernment: false,
    category: "Private Emergency Center",
    specialties: ["Emergency Care", "Trauma Surgery", "ICU"],
    distance: "4.8 km"
  },
  {
    name: "Bangalore Baptist Hospital",
    address: "Bellary Road, Bangalore, Karnataka 560024",
    phone: "080-22251555",
    latitude: 13.0143,
    longitude: 77.5794,
    isGovernment: false,
    category: "Private Emergency Center",
    specialties: ["24/7 Emergency", "Trauma Care", "Ambulance Services"],
    distance: "3.4 km"
  }
];
