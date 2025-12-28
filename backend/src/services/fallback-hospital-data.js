/**
 * Fallback hospital data for Delhi Health-Hacker
 * Used when API data is not available or incomplete
 */

const delhiHospitals = [
  // Cardiac/Heart Specialists
  {
    id: 'gb-pant-hospital',
    name: 'G.B. Pant Hospital (GIPMER)',
    category: 'Government',
    specialty: 'Cardiology',
    address: 'Jawahar Lal Nehru Marg, New Delhi',
    district: 'Central Delhi',
    pincode: '110002',
    phone: '011-23234242',
    latitude: 28.6289,
    longitude: 77.2065,
    isGovernment: true,
    emergencyServices: true,
    waitTimeCategory: 'high',
    specialties: ['Cardiology', 'Emergency Medicine', 'General Medicine'],
    recommendation: 'Best for cardiac emergencies in Delhi'
  },
  
  // Emergency/Anti-rabies
  {
    id: 'rml-hospital',
    name: 'Ram Manohar Lohia Hospital',
    category: 'Government',
    specialty: 'Emergency Medicine',
    address: 'Baba Kharak Singh Marg, New Delhi',
    district: 'Central Delhi',
    pincode: '110001',
    phone: '011-23365525',
    latitude: 28.6358,
    longitude: 77.2085,
    isGovernment: true,
    emergencyServices: true,
    waitTimeCategory: 'high',
    specialties: ['Emergency Medicine', 'Anti-rabies', 'General Medicine'],
    recommendation: 'Primary anti-rabies center for dog bites'
  },
  
  // Major Government Hospitals
  {
    id: 'aiims-delhi',
    name: 'All India Institute of Medical Sciences (AIIMS)',
    category: 'Government',
    specialty: 'Multi-specialty',
    address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi',
    district: 'South Delhi',
    pincode: '110029',
    phone: '011-26588500',
    latitude: 28.5672,
    longitude: 77.2100,
    isGovernment: true,
    emergencyServices: true,
    waitTimeCategory: 'high',
    specialties: ['Cardiology', 'Trauma Surgery', 'Pediatrics', 'All Specialties'],
    recommendation: 'Premier medical institute but expect long waits'
  },
  
  {
    id: 'safdarjung-hospital',
    name: 'Safdarjung Hospital',
    category: 'Government',
    specialty: 'Multi-specialty',
    address: 'Ring Road, Safdarjung Enclave, New Delhi',
    district: 'South Delhi',
    pincode: '110029',
    phone: '011-26165060',
    latitude: 28.5706,
    longitude: 77.2066,
    isGovernment: true,
    emergencyServices: true,
    waitTimeCategory: 'high',
    specialties: ['Trauma Surgery', 'Burns Unit', 'Emergency Medicine'],
    recommendation: 'Major trauma center with burns unit'
  },
  
  // Maternity Hospitals
  {
    id: 'lady-hardinge',
    name: 'Lady Hardinge Medical College & Hospital',
    category: 'Government',
    specialty: 'Obstetrics and Gynaecology',
    address: 'Shaheed Bhagat Singh Marg, New Delhi',
    district: 'Central Delhi',
    pincode: '110001',
    phone: '011-23365525',
    latitude: 28.6304,
    longitude: 77.2177,
    isGovernment: true,
    emergencyServices: true,
    waitTimeCategory: 'high',
    specialties: ['Obstetrics and Gynaecology', 'Pediatrics'],
    recommendation: 'Premier maternity hospital'
  },
  
  {
    id: 'lok-nayak-hospital',
    name: 'Lok Nayak Hospital',
    category: 'Government',
    specialty: 'General Medicine',
    address: 'Jawahar Lal Nehru Marg, New Delhi',
    district: 'Central Delhi',
    pincode: '110002',
    phone: '011-23234242',
    latitude: 28.6289,
    longitude: 77.2065,
    isGovernment: true,
    emergencyServices: true,
    waitTimeCategory: 'high',
    specialties: ['General Medicine', 'Obstetrics and Gynaecology'],
    recommendation: 'Good for general medical care and maternity'
  },
  
  // Pediatric
  {
    id: 'kalawati-saran',
    name: 'Kalawati Saran Children\'s Hospital',
    category: 'Government',
    specialty: 'Paediatrics',
    address: 'Femina Hospital Campus, New Delhi',
    district: 'Central Delhi',
    pincode: '110001',
    phone: '011-23365525',
    latitude: 28.6304,
    longitude: 77.2177,
    isGovernment: true,
    emergencyServices: true,
    waitTimeCategory: 'medium',
    specialties: ['Paediatrics', 'Neonatology'],
    recommendation: 'Specialized children\'s hospital'
  },
  
  // Private Hospitals (for comparison)
  {
    id: 'max-saket',
    name: 'Max Super Speciality Hospital, Saket',
    category: 'Private',
    specialty: 'Multi-specialty',
    address: '1, 2, Press Enclave Road, Saket, New Delhi',
    district: 'South Delhi',
    pincode: '110017',
    phone: '011-26515050',
    latitude: 28.5245,
    longitude: 77.2066,
    isGovernment: false,
    emergencyServices: true,
    waitTimeCategory: 'low',
    specialties: ['Cardiology', 'Emergency Medicine', 'All Specialties'],
    recommendation: 'Premium private hospital with minimal wait'
  },
  
  {
    id: 'apollo-delhi',
    name: 'Indraprastha Apollo Hospitals',
    category: 'Private',
    specialty: 'Multi-specialty',
    address: 'Sarita Vihar, Delhi Mathura Road, New Delhi',
    district: 'South Delhi',
    pincode: '110076',
    phone: '011-26925858',
    latitude: 28.5355,
    longitude: 77.2910,
    isGovernment: false,
    emergencyServices: true,
    waitTimeCategory: 'low',
    specialties: ['Cardiology', 'Emergency Medicine', 'All Specialties'],
    recommendation: 'Premium private hospital with advanced facilities'
  }
];

// Mohalla Clinics data
const mohallaClinics = [
  {
    id: 'mohalla-cp',
    name: 'Mohalla Clinic - Connaught Place',
    category: 'Government',
    specialty: 'General Medicine',
    address: 'Near Connaught Place Metro Station',
    district: 'Central Delhi',
    pincode: '110001',
    phone: '011-1234567',
    latitude: 28.6315,
    longitude: 77.2167,
    isGovernment: true,
    emergencyServices: false,
    waitTimeCategory: 'low',
    specialties: ['General Medicine', 'Basic Health Check'],
    recommendation: 'Quick consultation for minor health issues'
  }
];

module.exports = {
  delhiHospitals,
  mohallaClinics,
  
  // Helper functions
  getHospitalsBySpecialty: (specialty) => {
    return delhiHospitals.filter(hospital => 
      hospital.specialties.some(s => 
        s.toLowerCase().includes(specialty.toLowerCase())
      )
    );
  },
  
  getHospitalsByCategory: (category) => {
    return delhiHospitals.filter(hospital => 
      hospital.category.toLowerCase() === category.toLowerCase()
    );
  },
  
  getEmergencyHospitals: () => {
    return delhiHospitals.filter(hospital => hospital.emergencyServices);
  },
  
  getAllHospitals: () => {
    return [...delhiHospitals, ...mohallaClinics];
  }
};