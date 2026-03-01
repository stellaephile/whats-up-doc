import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { assessmentService } from './symptomAssessment';
import { 
  routingConfig, 
  getSeverityBadge,
  getExpansionMessage 
} from './facilityRouting';

// API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function AppWithSymptoms() {
  // Phase management: 1 = landing page with pincode + symptoms, 2 = results
  const [currentPhase, setCurrentPhase] = useState(1);
  const [pincode, setPincode] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [condition, setCondition] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [map, setMap] = useState(null);
  const [searchRadius, setSearchRadius] = useState(null);
  const markersRef = useRef([]);
  const [useSampleData, setUseSampleData] = useState(false);
  const [expansionMessage, setExpansionMessage] = useState(null);
  
  // Filter states
  const [showSarkari, setShowSarkari] = useState(true);
  const [showPrivate, setShowPrivate] = useState(true);
  const [showAyush, setShowAyush] = useState(true);
  
  // Emergency detection state
  const [showEmergencyWarning, setShowEmergencyWarning] = useState(false);
  const [emergencyKeywordsDetected, setEmergencyKeywordsDetected] = useState([]);
  
  // ── NEW: Clarifying questions state ──────────────────────────
  const [clarifyingQuestions, setClarifyingQuestions] = useState([]);
  const [clarifyingAnswers, setClarifyingAnswers]     = useState([]);
  const [stage1Cache, setStage1Cache]                 = useState(null);
  const [waitingForAnswers, setWaitingForAnswers]     = useState(false);
  const [loadingStep, setLoadingStep]                 = useState('');
  // ─────────────────────────────────────────────────────────────

  // Database stats
  const [dbStats, setDbStats] = useState(null);

  // Fetch database stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/hospitals/stats`);
        setDbStats(response.data);
      } catch (error) {
        console.error('Error fetching database stats:', error.message);
      }
    };
    fetchStats();
  }, []);

  // Filter and prioritize hospitals
  const getFilteredAndPrioritizedHospitals = (hospitals, severityLevel) => {
    let filtered = hospitals.filter(hospital => {
      const isGovernment = hospital.isGovernment || hospital.category?.toLowerCase().includes('government');
      const isAyush = hospital.category?.toLowerCase().includes('ayush');
      const isPrivate = !isGovernment && !isAyush;
      if (isGovernment && !showSarkari) return false;
      if (isPrivate && !showPrivate) return false;
      if (isAyush && !showAyush) return false;
      return true;
    });

    if (severityLevel === 'mild' || severityLevel === 'moderate') {
      filtered = filtered.sort((a, b) => {
        const aIsGov = a.isGovernment || a.category?.toLowerCase().includes('government');
        const bIsGov = b.isGovernment || b.category?.toLowerCase().includes('government');
        if (aIsGov && !bIsGov) return -1;
        if (!aIsGov && bIsGov) return 1;
        return (a.distance_km || 0) - (b.distance_km || 0);
      });
    }
    return filtered;
  };

  // ── Shared: fetch hospitals after assessment ──────────────────
  const fetchHospitals = async (assessment) => {
    setLoadingStep('locating');
    
    const pincodeResponse = await axios.get(`${API_BASE_URL}/api/pincode/${pincode}`);

    if (!pincodeResponse.data?.latitude) {
      alert('Pincode not found in our database. Please try a different pincode.');
      return;
    }

    const centerLat = parseFloat(pincodeResponse.data.latitude);
    const centerLng = parseFloat(pincodeResponse.data.longitude);

    setLoadingStep('searching');
    console.log('📡 Calling:', `${API_BASE_URL}/api/hospitals/severity-based`, {
      pincode,
      latitude: centerLat,
      longitude: centerLng,
      severity: assessment.severity,
      severityLevel: assessment.severityLevel,
      specialties: assessment.specialties
    });
    const response = await axios.post(`${API_BASE_URL}/api/hospitals/severity-based`, {
      pincode,
      latitude:      centerLat,
      longitude:     centerLng,
      severity:      assessment.severity,
      severityLevel: assessment.severityLevel,
      specialties:   assessment.specialties
    });

    console.log('🔍 Raw facilities:', response.data.facilities?.length, response.data.facilities?.[0]);

    const transformedFacilities = (response.data.facilities || [])
      .filter(h => h.latitude && h.longitude)  
      .map(hospital => {
        try {
          return {
            id:                  hospital.id,
            name:                hospital.hospital_name,
            facility_type:       hospital.hospital_care_type || 'Hospital',
            category:            hospital.hospital_category  || '',
            isGovernment:        (hospital.hospital_category || '').toLowerCase().includes('gov') ||
                                (hospital.hospital_category || '').toLowerCase().includes('public'),
            isAyush:             hospital.ayush || 
                                (hospital.discipline || '').toLowerCase().includes('ayush'),
            address:             hospital.address || `${hospital.district}, ${hospital.state}`,
            phone:               hospital.emergency_num || hospital.telephone || hospital.mobile_number,
            emergency_num:       hospital.emergency_num,
            ambulance_phone:     hospital.ambulance_phone,
            bloodbank_phone:     hospital.bloodbank_phone,
            telephone:           hospital.telephone,
            mobile_number:       hospital.mobile_number,
            latitude:            hospital.latitude,
            longitude:           hospital.longitude,
            distance_km:         parseFloat(hospital.distance_km || 0),
            specialties:         hospital.specialties_array || [],
            facilities:          hospital.facilities_array  || [],
            total_beds:          hospital.total_beds,
            emergency_available: hospital.emergency_available,
            data_quality:        hospital.data_quality_norm
          };
        } catch(e) {
          console.error('❌ Failed to transform hospital:', hospital, e);
          return null;
        }
      })
      .filter(Boolean); // remove any nulls from failed transforms

    console.log('✅ transformedFacilities count:', transformedFacilities.length);

    setRecommendations(transformedFacilities);
    setSearchRadius(response.data.radiusUsed);

    if (response.data.wasExpanded) {
      const config = routingConfig[assessment.severityLevel];
      setExpansionMessage(getExpansionMessage(config?.initialRadius, response.data.radiusUsed));
    } else {
      setExpansionMessage(null);
    }

    if (transformedFacilities.length === 0) {
      setExpansionMessage(getExpansionMessage(20, null));
      setCurrentPhase(2);
      return;
    }

    setCurrentPhase(2);
    setTimeout(() => {
      initializeMap(transformedFacilities, response.data.radiusUsed, centerLat, centerLng, assessment);
    }, 100);
  };

  // ── Round 1: initial search ───────────────────────────────────
  const handleSearch = async (e) => {
    if (e) e.preventDefault();

    if (!pincode || pincode.length !== 6) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }
    if (selectedSymptoms.length === 0 && !condition.trim()) {
      alert('Please select symptoms or describe your condition');
      return;
    }

    setLoading(true);
    setRecommendations([]);
    setExpansionMessage(null);
    setWaitingForAnswers(false);
    setLoadingStep('assessing');

    try {
      // Round 1 — no clarifying answers yet
      const assessment = await assessmentService.assess(
        selectedSymptoms,
        condition,
        { stage1Cache: null, clarifyingAnswers: [] }
      );

      setAssessmentResult(assessment);

      // Show emergency warning immediately
      if (assessment.isAutoEmergency) {
        setShowEmergencyWarning(true);
        setEmergencyKeywordsDetected(assessment.detectedKeywords || []);
        setTimeout(() => {
          document.getElementById('emergency-warning')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }

      // AI wants clarification — pause and show questions
      if (assessment.needsClarification && assessment.clarifyingQuestions?.length > 0) {
        setClarifyingQuestions(assessment.clarifyingQuestions);
        setClarifyingAnswers(new Array(assessment.clarifyingQuestions.length).fill(''));
        setStage1Cache(assessment.stage1Cache);
        setWaitingForAnswers(true);
        setLoading(false);
        setLoadingStep('');
        return;
      }

      // No clarification needed — go straight to hospitals
      await fetchHospitals(assessment);

    } catch (error) {
      console.error('Search error:', error);
      if (error.response?.status === 404) {
        alert('Pincode not found. Please try a different pincode.');
      } else if (error.response?.status === 500) {
        alert('Database connection error. Please ensure the backend server is running.');
      } else {
        alert('Unable to find hospitals. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // ── Round 2: submit clarifying answers ───────────────────────
  const handleClarifyingSubmit = async (skip = false) => {
    setLoading(true);
    setWaitingForAnswers(false);
    setLoadingStep('assessing');

    try {
      const answers = skip
        ? new Array(clarifyingQuestions.length).fill('Not provided')
        : clarifyingAnswers;

      const assessment = await assessmentService.assess(
        selectedSymptoms,
        condition,
        { clarifyingAnswers: answers, stage1Cache }
      );

      setAssessmentResult(assessment);
      setClarifyingQuestions([]);
      setStage1Cache(null);

      await fetchHospitals(assessment);

    } catch (err) {
      console.error('Clarifying submit error:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const initializeMap = (hospitals, radius, centerLat, centerLng, assessment) => {
    if (!window.L) return;

    const mapContainer = document.getElementById('care-map');
    if (!mapContainer) return;

    if (map) {
      map.remove();
      setMap(null);
    }

    const newMap = window.L.map('care-map', {
      center: [centerLat, centerLng],
      zoom: radius <= 3 ? 14 : radius <= 5 ? 13 : radius <= 10 ? 12 : 11,
      zoomControl: false,
      attributionControl: true
    });
    
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
      className: 'map-tiles'
    }).addTo(newMap);

    const config = routingConfig[assessment.severityLevel];
    window.L.circle([centerLat, centerLng], {
      radius: radius * 1000,
      color: config.color,
      fillColor: config.color,
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '5, 10'
    }).addTo(newMap);

    const newMarkers = [];
    hospitals.forEach((hospital) => {
      const lat = parseFloat(hospital.latitude);
      const lng = parseFloat(hospital.longitude);

      const markerHtml = `
        <div class="relative flex flex-col items-center">
          <div class="size-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white transform hover:scale-110 transition-transform cursor-pointer" style="background-color: ${config.color}">
            <span class="material-symbols-outlined text-[20px]">local_hospital</span>
          </div>
          <div class="absolute -z-10 size-10 rounded-full animate-ping opacity-30" style="background-color: ${config.color}"></div>
        </div>
      `;

      const marker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          html: markerHtml,
          className: 'custom-hospital-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        })
      }).addTo(newMap);

      const popupContent = `
        <div class="p-3 min-w-[200px]">
          <h3 class="font-bold text-slate-900 text-sm mb-2">${hospital.name}</h3>
          <div class="space-y-1 text-xs">
            <div class="flex items-center gap-2">
              <span class="inline-block w-2 h-2 rounded-full" style="background-color: ${config.color}"></span>
              <span class="font-semibold">${hospital.facility_type}</span>
            </div>
            <div class="flex items-center gap-2 text-slate-600">
              <span class="material-symbols-outlined text-[14px]">location_on</span>
              <span>${hospital.address}</span>
            </div>
            ${hospital.phone ? `
              <div class="flex items-center gap-2 text-slate-600">
                <span class="material-symbols-outlined text-[14px]">call</span>
                <a href="tel:${hospital.phone}" class="text-blue-600 hover:text-blue-800">${hospital.phone}</a>
              </div>
            ` : ''}
            <div class="flex items-center gap-2 text-slate-600">
              <span class="material-symbols-outlined text-[14px]">route</span>
              <span>${hospital.distance_km ? parseFloat(hospital.distance_km).toFixed(1) : '?'} km</span>
            </div>
          </div>
        </div>
      `;
      
      marker.bindPopup(popupContent, { maxWidth: 300, className: 'custom-popup' });
      newMarkers.push(marker);
    });

    setMap(newMap);
    markersRef.current = newMarkers;

    if (newMarkers.length > 0) {
      const group = new window.L.featureGroup(newMarkers);
      newMap.fitBounds(group.getBounds().pad(0.2));
    }
  };

  const handleBackToPhase1 = () => {
    setCurrentPhase(1);
    if (map) { map.remove(); setMap(null); }
    markersRef.current = [];
    setRecommendations([]);
    setExpansionMessage(null);
    setAssessmentResult(null);
    setWaitingForAnswers(false);
    setClarifyingQuestions([]);
    setStage1Cache(null);
  };

  const handleSymptomTagClick = (symptom) => setCondition(symptom);

  const handlePincodeChange = (e) => {
    setPincode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
  };

  const handleConditionChange = (e) => setCondition(e.target.value);

  const handleEmergencyToggle = (e) => {
    setIsEmergency(e.target.checked);
    if (e.target.checked) {
      setSelectedSymptoms(['chest_pain']);
      setCondition('Emergency situation');
    }
  };

  // ── Phase 1: Landing Page ─────────────────────────────────────
  if (currentPhase === 1) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-md">
          <div className="px-4 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3 text-slate-900 dark:text-white hover:opacity-80 transition-opacity cursor-pointer">
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20">
                <span className="material-symbols-outlined text-[20px]">local_hospital</span>
              </div>
              <h2 className="text-lg font-bold leading-tight tracking-tight hidden sm:block">What's Up Doc</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Sample Data</span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input 
                    className="peer sr-only" 
                    type="checkbox" 
                    checked={useSampleData}
                    onChange={(e) => setUseSampleData(e.target.checked)}
                  />
                  <div className="h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-blue-600 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-all peer-checked:translate-x-full shadow-sm"></div>
                </label>
              </div>
              <button 
                onClick={() => setIsEmergency(true)}
                className="flex items-center justify-center overflow-hidden rounded-lg h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-bold shadow-sm transition-colors ring-offset-2 focus:ring-2 ring-accent"
              >
                <span className="material-symbols-outlined text-[18px] mr-2">sos</span>
                <span className="truncate">Emergency SOS</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow flex flex-col items-center justify-center px-4 py-12 md:py-20 relative overflow-hidden">
          <div aria-hidden="true" className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30 pointer-events-none">
            <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px]"></div>
          </div>

          <div className="w-full max-w-3xl flex flex-col items-center text-center space-y-8 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-semibold tracking-wide">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              100% Anonymous & Private
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl md:text-5xl lg:text-[54px] font-bold text-slate-900 dark:text-white tracking-tight leading-[1.1]">
                Healthcare, <span className="text-primary">right where you are.</span>
              </h1>
              
              {dbStats ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 text-sm">
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">database</span>
                  <span className="text-slate-700 font-medium">
                    Searching across <span className="font-bold text-blue-600">{dbStats.total?.toLocaleString()}</span> verified hospitals
                    {dbStats.government > 0 && <span className="text-slate-600"> • {dbStats.government?.toLocaleString()} Govt</span>}
                    {dbStats.emergency > 0 && <span className="text-slate-600"> • {dbStats.emergency?.toLocaleString()} Emergency</span>}
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-50 border border-yellow-200 text-sm">
                  <span className="text-yellow-700 font-medium">⚠️ Connecting to API: {API_BASE_URL}</span>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSearch} className="w-full max-w-lg space-y-6">

              {/* Emergency Warning Banner */}
              {showEmergencyWarning && (
                <div 
                  id="emergency-warning"
                  className="bg-red-600 text-white rounded-2xl p-6 shadow-2xl border-4 border-red-700 animate-pulse"
                >
                  <div className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-[48px] flex-shrink-0">emergency</span>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black mb-2">⚠️ LIFE-THREATENING EMERGENCY DETECTED</h3>
                      <p className="text-lg font-bold mb-3">
                        Detected: {emergencyKeywordsDetected.join(', ')}
                      </p>
                      <p className="text-base mb-4">
                        This appears to be a medical emergency. Call emergency services immediately.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <a href="tel:108" className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white text-red-600 font-black text-lg rounded-xl hover:bg-red-50 transition-colors shadow-lg">
                          <span className="material-symbols-outlined text-[28px]">call</span>
                          CALL 108 NOW
                        </a>
                        <a href="tel:102" className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-800 text-white font-bold text-lg rounded-xl hover:bg-red-900 transition-colors">
                          <span className="material-symbols-outlined text-[24px]">local_hospital</span>
                          Call 102 (Ambulance)
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pincode Input */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-200"></div>
                <div className="relative">
                  <input 
                    value={pincode}
                    onChange={handlePincodeChange}
                    className="w-full h-24 bg-surface-light dark:bg-surface-dark rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-center text-5xl font-black tracking-[0.5em] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 shadow-xl transition-all duration-300" 
                    inputMode="numeric" 
                    maxLength="6" 
                    pattern="[0-9]*" 
                    placeholder="______" 
                    type="text"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400">
                    <span className="material-symbols-outlined text-3xl">location_on</span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-semibold">Enter 6-digit Pincode</p>
              </div>

              {/* Emergency Toggle */}
              <div className={`flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between rounded-2xl p-5 border border-transparent transition-colors duration-300 ${isEmergency ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                <div className="text-left space-y-1">
                  <p className="text-base font-bold text-slate-900 dark:text-white">Current Emergency?</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 transition-all duration-300">
                    {isEmergency ? 'Emergency Mode: Showing 24/7 trauma centers only.' : 'Show routine care & clinics.'}
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center self-start sm:self-center">
                  <input className="peer sr-only" type="checkbox" checked={isEmergency} onChange={handleEmergencyToggle} />
                  <div className="h-8 w-14 rounded-full bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent/20 dark:bg-slate-600 peer-checked:bg-accent transition-colors duration-300"></div>
                  <div className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-all duration-300 peer-checked:translate-x-full shadow-sm"></div>
                </label>
              </div>

              {/* Symptom Input */}
              <div className="w-full relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-200"></div>
                <div className="relative w-full bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center p-2">
                  <div className="pl-4 pr-3 text-slate-400">
                    <span className="material-symbols-outlined text-[28px]">search</span>
                  </div>
                  <input 
                    value={condition}
                    onChange={handleConditionChange}
                    className="w-full h-14 bg-transparent border-none outline-none focus:ring-0 text-lg text-slate-900 dark:text-white placeholder:text-slate-400" 
                    placeholder="Try 'Child has fever' or 'prasav dard'..." 
                    type="text"
                  />
                  <button 
                    type="submit"
                    disabled={loading}
                    className="hidden sm:flex h-12 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg px-6 items-center justify-center transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              {/* ── Clarifying Questions Card ──────────────────── */}
              {waitingForAnswers && clarifyingQuestions.length > 0 && (
                <div className="w-full bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 space-y-4 text-left">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🤔</span>
                    <div>
                      <h3 className="font-bold text-blue-900 text-base">Just a couple of quick questions</h3>
                      <p className="text-xs text-blue-600 mt-0.5">Helps us find the most relevant hospitals for you</p>
                    </div>
                  </div>

                  {clarifyingQuestions.map((question, index) => (
                    <div key={index} className="space-y-1.5">
                      <p className="text-sm font-semibold text-slate-800">{index + 1}. {question}</p>
                      <input
                        type="text"
                        className="w-full h-10 px-3 rounded-lg border border-blue-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400"
                        placeholder="Type your answer..."
                        value={clarifyingAnswers[index] || ''}
                        autoFocus={index === 0}
                        onChange={(e) => {
                          const updated = [...clarifyingAnswers];
                          updated[index] = e.target.value;
                          setClarifyingAnswers(updated);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault(); // ← ADD THIS — stops form submission
                              if (index === clarifyingQuestions.length - 1) {
                                handleClarifyingSubmit(false);
                                            }
                                    }
                        }}
                      />
                    </div>
                  ))}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleClarifyingSubmit(false)}
                      disabled={loading}
                      className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Finding hospitals...
                        </>
                      ) : 'Find Hospitals →'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClarifyingSubmit(true)}
                      disabled={loading}
                      className="px-4 h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {/* Loading step messages */}
              {loading && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  <span className="text-slate-600 text-sm font-medium">
                    {loadingStep === 'assessing' && '🩺 AI is analyzing your symptoms...'}
                    {loadingStep === 'locating'  && '📍 Locating your area...'}
                    {loadingStep === 'searching' && '🏥 Finding the best hospitals...'}
                    {!loadingStep                && 'Loading...'}
                  </span>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading || waitingForAnswers}
                className="sm:hidden w-full h-12 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>

            <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed max-w-xl mx-auto">
              Type your symptoms in plain English or Hinglish. We map your keywords to the correct <span className="text-slate-700 dark:text-slate-200 font-medium">Specialty</span> or <span className="text-slate-700 dark:text-slate-200 font-medium">System of Medicine</span>.
            </p>

            <div className="flex flex-col items-center gap-3 pt-2">
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Common searches:</span>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { symptom: 'fever',       emoji: '🤒', label: 'Fever' },
                  { symptom: 'skin rash',   emoji: '🦠', label: 'Skin Rash' },
                  { symptom: 'child checkup', emoji: '👶', label: 'Pediatrician' },
                  { symptom: 'toothache',   emoji: '🦷', label: 'Toothache' },
                  { symptom: 'ayurveda',    emoji: '🧘', label: 'Ayurveda' },
                  { symptom: 'prasav dard', emoji: '🤰', label: 'Maternity' },
                ].map((item) => (
                  <button 
                    key={item.symptom}
                    onClick={() => handleSymptomTagClick(item.symptom)}
                    className="group px-4 py-2 rounded-full text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary hover:bg-primary/5 transition-all duration-200 transform hover:scale-105"
                  >
                    <span className="group-hover:animate-bounce inline-block mr-1">{item.emoji}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Phase 2: Results ──────────────────────────────────────────
  const badge  = getSeverityBadge(assessmentResult.severityLevel);
  const config = routingConfig[assessmentResult.severityLevel];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white shadow-sm">
        <div className="px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={handleBackToPhase1}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary flex items-center justify-center text-white shadow-md">
                <span className="material-symbols-outlined text-[20px]">local_hospital</span>
              </div>
              <div>
                <h2 className="text-lg font-bold">What's Up Doc</h2>
                <span className="text-xs text-slate-500">Severity-Based Results</span>
              </div>
            </div>
          </div>
          <div 
            className="px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2"
            style={{ backgroundColor: badge.bgColor, color: badge.color, border: `2px solid ${badge.borderColor}` }}
          >
            <span>{badge.icon}</span>
            <span>{badge.label} Priority</span>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-full md:w-[450px] bg-white border-r flex flex-col">
          <div className="px-4 py-4 border-b space-y-4">

            {/* AI Reasoning Card */}
            {assessmentResult?.reasoning && assessmentResult.assessmentMode !== 'fallback' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">🧠</span>
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">AI Assessment</span>
                  {assessmentResult.primaryDepartment && (
                    <span className="ml-auto text-xs font-bold text-primary">{assessmentResult.primaryDepartment}</span>
                  )}
                </div>
                <p className="text-xs text-slate-700">{assessmentResult.reasoning}</p>
                {assessmentResult.recommendedAction && (
                  <p className="text-xs text-slate-500 mt-1 italic">{assessmentResult.recommendedAction}</p>
                )}
              </div>
            )}

            {/* Emergency Auto-Detection Banner */}
            {assessmentResult.isAutoEmergency && (
              <div className="bg-red-600 text-white rounded-lg p-4 shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[32px] flex-shrink-0">emergency</span>
                  <div className="flex-1">
                    <h4 className="font-black text-lg mb-1">EMERGENCY AUTO-DETECTED</h4>
                    <p className="text-sm mb-2">Keywords: {assessmentResult.detectedKeywords?.join(', ')}</p>
                    <p className="text-xs mb-3">Showing only 24x7 emergency facilities. Call 108 immediately.</p>
                    <div className="flex gap-2">
                      <a href="tel:108" className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-white text-red-600 font-bold text-sm rounded-lg hover:bg-red-50 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">call</span>Call 108
                      </a>
                      <a href="tel:102" className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-800 text-white font-bold text-sm rounded-lg hover:bg-red-900 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">local_hospital</span>Call 102
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Maternity/NICU notice */}
            {assessmentResult.requiresMaternityWard && (
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-sm text-pink-800 flex items-center gap-2">
                <span className="text-lg">🤰</span>
                <span className="font-semibold">Showing hospitals with Maternity/Labour wards</span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">
                {getFilteredAndPrioritizedHospitals(recommendations, assessmentResult.severityLevel).length} Facilities Found
              </h3>
              <div className="text-xs text-slate-500">Within {searchRadius}km</div>
            </div>
            
            {/* Filter Checkboxes */}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center cursor-pointer select-none px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 hover:border-blue-400 transition-colors">
                <input className="form-checkbox text-blue-600 rounded size-4 mr-2 border-slate-300 focus:ring-blue-500" type="checkbox" checked={showSarkari} onChange={(e) => setShowSarkari(e.target.checked)} />
                <span className="text-xs font-semibold text-slate-700">Sarkari (Govt)</span>
              </label>
              <label className="inline-flex items-center cursor-pointer select-none px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 hover:border-red-400 transition-colors">
                <input className="form-checkbox text-red-600 rounded size-4 mr-2 border-slate-300 focus:ring-red-500" type="checkbox" checked={showPrivate} onChange={(e) => setShowPrivate(e.target.checked)} />
                <span className="text-xs font-semibold text-slate-700">Private</span>
              </label>
              <label className="inline-flex items-center cursor-pointer select-none px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 hover:border-green-400 transition-colors">
                <input className="form-checkbox text-green-600 rounded size-4 mr-2 border-slate-300 focus:ring-green-500" type="checkbox" checked={showAyush} onChange={(e) => setShowAyush(e.target.checked)} />
                <span className="text-xs font-semibold text-slate-700">AYUSH</span>
              </label>
            </div>
            
            {(assessmentResult.severityLevel === 'mild' || assessmentResult.severityLevel === 'moderate') && recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-800">
                <span className="font-semibold">💡 Government facilities prioritized</span> for cost-effective care
              </div>
            )}
            
            {expansionMessage && recommendations.length > 0 && !expansionMessage.includes('No facilities found') && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                ⚠️ {expansionMessage}
              </div>
            )}
            
            {recommendations.length === 0 && expansionMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                ⚠️ {expansionMessage}
              </div>
            )}
            
            {assessmentResult.severityLevel === 'emergency' && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-red-600">emergency</span>
                  <span className="font-bold text-red-900">Emergency Mode</span>
                </div>
                <p className="text-xs text-red-700 mb-2">Showing nearest 24x7 facilities only</p>
                <a href="tel:108" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors w-full justify-center">
                  <span className="material-symbols-outlined text-[18px]">call</span>
                  Call 108 Emergency
                </a>
              </div>
            )}
          </div>

          {/* Hospital List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {getFilteredAndPrioritizedHospitals(recommendations, assessmentResult.severityLevel).length === 0 ? (
              <div className="text-center py-12 px-4">
                <span className="material-symbols-outlined text-slate-400 text-[64px]">search_off</span>
                <p className="text-slate-900 font-bold text-lg mt-4 mb-2">
                  {recommendations.length === 0 ? 'No facilities found within 20km' : 'No facilities match your filters'}
                </p>
                <p className="text-slate-600 text-sm mb-4">
                  {recommendations.length === 0 
                    ? "We searched up to 20km from your pincode but couldn't find matching facilities."
                    : 'Try adjusting your filters to see more results.'
                  }
                </p>
                {recommendations.length === 0 && (
                  <a href="tel:108" className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg mt-2 transition-colors">
                    <span className="material-symbols-outlined">call</span>
                    Call 108 for Assistance
                  </a>
                )}
              </div>
            ) : (
              getFilteredAndPrioritizedHospitals(recommendations, assessmentResult.severityLevel).map((hospital, index) => {
                const isGovernment = hospital.isGovernment || hospital.category?.toLowerCase().includes('government');
                const isAyush = hospital.isAyush || hospital.category?.toLowerCase().includes('ayush');
                const hospitalTypeColor = isGovernment ? 'text-blue-600' : isAyush ? 'text-green-600' : 'text-red-600';
                const hospitalTypeBg   = isGovernment ? 'bg-blue-500' : isAyush ? 'bg-green-500' : 'bg-red-500';
                const hospitalTypeLabel = isGovernment ? 'Sarkari' : isAyush ? 'AYUSH' : 'Private';
                
                return (
                  <div key={hospital.id || index} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">{hospital.name}</h4>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-1 rounded text-xs font-bold whitespace-nowrap" style={{ backgroundColor: badge.bgColor, color: badge.color }}>
                          {hospital.facility_type}
                        </span>
                        {isGovernment && (assessmentResult.severityLevel === 'mild' || assessmentResult.severityLevel === 'moderate') && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">⭐ Prioritized</span>
                        )}
                        {hospital.emergency_available && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">🚨 24x7 Emergency</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`size-2 rounded-full ${hospitalTypeBg}`}></span>
                      <span className={`text-xs font-semibold ${hospitalTypeColor} uppercase tracking-wider`}>{hospitalTypeLabel}</span>
                      {hospital.total_beds && <span className="text-xs text-slate-500 ml-auto">🛏️ {hospital.total_beds} beds</span>}
                    </div>
                    
                    <p className="text-sm text-slate-600 mb-3">{hospital.address}</p>
                    
                    {hospital.specialties?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {hospital.specialties.slice(0, 3).map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded-full">{s}</span>
                        ))}
                        {hospital.specialties.length > 3 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded-full">+{hospital.specialties.length - 3} more</span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">
                        📍 {hospital.distance_km ? parseFloat(hospital.distance_km).toFixed(1) : '?'} km away
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {hospital.emergency_num && (
                        <a href={`tel:${hospital.emergency_num}`} className="flex-1 min-w-[100px] px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">emergency</span>Emergency
                        </a>
                      )}
                      {hospital.ambulance_phone && (
                        <a href={`tel:${hospital.ambulance_phone}`} className="flex-1 min-w-[100px] px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1">
                          🚑 Ambulance
                        </a>
                      )}
                      {hospital.telephone && !hospital.emergency_num && (
                        <a href={`tel:${hospital.telephone}`} className="flex-1 min-w-[100px] px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">call</span>Call
                        </a>
                      )}
                      {hospital.bloodbank_phone && (
                        <a href={`tel:${hospital.bloodbank_phone}`} className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1">
                          🩸 Blood Bank
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Map */}
        <section className="flex-1 relative">
          <div id="care-map" className="w-full h-full"></div>
          <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3 border">
            <div className="text-sm font-semibold text-slate-900 mb-2">Search Radius</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: config.color }}></div>
              <span className="text-sm text-slate-600">{searchRadius}km radius</span>
            </div>
            <div className="text-xs text-slate-500 mt-2">{config.level} priority facilities</div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default AppWithSymptoms;