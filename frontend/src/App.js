import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { sampleHospitals, sampleEmergencyHospitals } from './sampleData';

const API_BASE = 'https://whats-up-doc-c12s.onrender.com';

// ── Helpers ───────────────────────────────────────────────────
function getHospitalType(hospital) {
  const category = hospital.hospital_category?.toLowerCase() || '';
  const isGovernment =
    category.includes('gov') ||
    category.includes('public') ||
    category.includes('municipal') ||
    category.includes('esic') ||
    category.includes('railway');
  const isAyush =
    hospital.ayush === true ||
    hospital.discipline_clean?.some(d =>
      ['Ayurveda', 'Homeopathy', 'Unani', 'Siddha', 'Naturopathy', 'Yoga'].includes(d)
    );
  return { isGovernment, isAyush, isPrivate: !isGovernment && !isAyush };
}

function getHospitalPhone(h) {
  return h.telephone || h.mobile_number || h.emergency_num || null;
}

function getHospitalName(h) {
  return h.hospital_name || h.name || 'Unknown Hospital';
}

function getHospitalAddress(h) {
  return [h.address, h.district, h.state, h.pincode].filter(Boolean).join(', ');
}

function getMarkerStyle(hospital) {
  const { isGovernment, isAyush } = getHospitalType(hospital);
  if (isAyush)       return { color: '#10b981', icon: 'spa' };
  if (isGovernment)  return { color: '#2563eb', icon: 'local_hospital' };
  return               { color: '#ef4444', icon: 'local_hospital' };
}

function formatDistance(h) {
  if (h.distance_km != null) return `${Number(h.distance_km).toFixed(1)} km`;
  if (h.distance)             return h.distance;
  return '—';
}

// ── App ───────────────────────────────────────────────────────
function App() {
  const [currentPhase, setCurrentPhase]       = useState(1);
  const [pincode, setPincode]                 = useState('');
  const [condition, setCondition]             = useState('');
  const [isEmergency, setIsEmergency]         = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [map, setMap]                         = useState(null);
  const [markers, setMarkers]                 = useState([]);
  const markersRef                            = useRef([]);
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [useSampleData, setUseSampleData]     = useState(true);

  // Filters
  const [showSarkari, setShowSarkari] = useState(true);
  const [showPrivate, setShowPrivate] = useState(true);
  const [showAyush, setShowAyush]     = useState(true);

  // ── Filtered list ─────────────────────────────────────────
  const getFilteredHospitals = useCallback(() => {
    return recommendations.filter(h => {
      const { isGovernment, isAyush, isPrivate } = getHospitalType(h);
      if (isGovernment && !showSarkari) return false;
      if (isPrivate    && !showPrivate) return false;
      if (isAyush      && !showAyush)   return false;
      return true;
    });
  }, [recommendations, showSarkari, showPrivate, showAyush]);

  // ── Re-draw markers when filters change ──────────────────
  useEffect(() => {
    if (!map || currentPhase !== 2 || recommendations.length === 0) return;
    markersRef.current.forEach(m => map.removeLayer(m));
    const newMarkers = addMarkersToMap(map, getFilteredHospitals());
    setMarkers(newMarkers);
    markersRef.current = newMarkers;
    if (newMarkers.length > 1) {
      map.fitBounds(new window.L.featureGroup(newMarkers).getBounds().pad(0.1));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSarkari, showPrivate, showAyush, map, recommendations, currentPhase]);

  // ── Build & add markers ───────────────────────────────────
  function addMarkersToMap(mapInstance, hospitals) {
    const newMarkers = [];
    hospitals.forEach((hospital, index) => {
      const lat = hospital.latitude  ? parseFloat(hospital.latitude)  : 20.5937 + (Math.random() - 0.5) * 0.02;
      const lng = hospital.longitude ? parseFloat(hospital.longitude) : 78.9629 + (Math.random() - 0.5) * 0.02;

      const { isGovernment, isAyush } = getHospitalType(hospital);
      const { color, icon }           = getMarkerStyle(hospital);
      const label   = isGovernment ? 'Sarkari' : isAyush ? 'AYUSH' : 'Private';
      const name    = getHospitalName(hospital);
      const phone   = getHospitalPhone(hospital);
      const address = getHospitalAddress(hospital);
      const dist    = formatDistance(hospital);
      const disciplines = hospital.discipline_clean?.join(', ') || '';

      const marker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          html: `
            <div class="relative flex flex-col items-center">
              <div class="size-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white transform hover:scale-110 transition-transform cursor-pointer" style="background-color:${color}">
                <span class="material-symbols-outlined text-[20px]">${icon}</span>
              </div>
              <div class="absolute -z-10 size-10 rounded-full animate-ping opacity-30" style="background-color:${color}"></div>
            </div>`,
          className: 'custom-hospital-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        })
      }).addTo(mapInstance);

      marker.bindPopup(`
        <div class="p-3 min-w-[200px]">
          <h3 class="font-bold text-slate-900 text-sm mb-2">${name}</h3>
          <div class="space-y-1 text-xs">
            <div class="flex items-center gap-2">
              <span class="inline-block w-2 h-2 rounded-full" style="background-color:${color}"></span>
              <span class="font-semibold" style="color:${color}">${label}</span>
              ${disciplines ? `<span class="text-slate-400">· ${disciplines}</span>` : ''}
            </div>
            <div class="flex items-center gap-2 text-slate-600">
              <span class="material-symbols-outlined text-[14px]">location_on</span>
              <span>${address}</span>
            </div>
            ${phone ? `<div class="flex items-center gap-2 text-slate-600">
              <span class="material-symbols-outlined text-[14px]">call</span>
              <a href="tel:${phone}" class="text-blue-600 hover:text-blue-800">${phone}</a>
            </div>` : ''}
            ${hospital.total_beds ? `<div class="flex items-center gap-2 text-slate-600">
              <span class="material-symbols-outlined text-[14px]">bed</span>
              <span>${hospital.total_beds} beds</span>
            </div>` : ''}
            <div class="flex items-center gap-2 text-slate-600">
              <span class="material-symbols-outlined text-[14px]">route</span>
              <span>${dist}</span>
            </div>
            ${hospital.emergency_available ? `<div class="flex items-center gap-2 text-red-600 font-semibold">
              <span class="material-symbols-outlined text-[14px]">emergency</span>
              <span>Emergency Available</span>
            </div>` : ''}
          </div>
          ${phone ? `<div class="mt-3 pt-2 border-t border-slate-200">
            <button onclick="window.open('tel:${phone}','_self')" class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[16px]">call</span> Call Hospital
            </button>
          </div>` : ''}
        </div>`, { maxWidth: 300, className: 'custom-popup' });

      marker.on('click', () => { highlightHospitalCard(index); setSidebarOpen(false); });
      newMarkers.push(marker);
    });
    return newMarkers;
  }

  // ── Search ────────────────────────────────────────────────
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!pincode || pincode.length !== 6) { alert('Please enter a valid 6-digit pincode'); return; }
    if (!condition.trim())                 { alert('Please describe your medical condition'); return; }

    setLoading(true);
    setRecommendations([]);

    if (useSampleData) {
      setTimeout(() => {
        const hospitals = isEmergency ? sampleEmergencyHospitals : sampleHospitals;
        setRecommendations(hospitals);
        setCurrentPhase(2);
        setLoading(false);
        setTimeout(() => initializeMap(hospitals), 100);
      }, 800);
      return;
    }

    try {
      // Step 1: geocode pincode
      const geoRes = await axios.get(`${API_BASE}/api/pincode/${pincode}`);
      const { latitude, longitude } = geoRes.data;

      // Step 2: severity-based search
      const severityLevel = isEmergency ? 'emergency' : 'moderate';
      const sevRes = await axios.post(`${API_BASE}/api/hospitals/severity-based`, {
        latitude,
        longitude,
        pincode,
        severityLevel,
      });

      const hospitals = sevRes.data.facilities || [];
      setRecommendations(hospitals);

      if (hospitals.length > 0) {
        setCurrentPhase(2);
        setTimeout(() => initializeMap(hospitals), 100);
      } else {
        alert(`No hospitals found within ${sevRes.data.radiusUsed}km. Try a nearby pincode.`);
      }
    } catch (error) {
      console.error('Search error:', error);
      alert(error.response?.data?.message || 'Unable to find hospitals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Map init ──────────────────────────────────────────────
  const initializeMap = (hospitals) => {
    if (!window.L) return;
    const mapContainer = document.getElementById('care-map');
    if (!mapContainer) return;

    if (map) { map.remove(); setMap(null); }

    const withCoords = hospitals.filter(h => h.latitude && h.longitude);
    const centerLat  = withCoords.length > 0
      ? withCoords.reduce((s, h) => s + parseFloat(h.latitude), 0)  / withCoords.length
      : 20.5937;
    const centerLng  = withCoords.length > 0
      ? withCoords.reduce((s, h) => s + parseFloat(h.longitude), 0) / withCoords.length
      : 78.9629;

    const newMap = window.L.map('care-map', {
      center: [centerLat, centerLng],
      zoom: withCoords.length > 0 ? 12 : 6,
      zoomControl: false,
    });

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19,
    }).addTo(newMap);

    const filtered    = hospitals.filter(h => {
      const { isGovernment, isAyush, isPrivate } = getHospitalType(h);
      if (isGovernment && !showSarkari) return false;
      if (isPrivate    && !showPrivate) return false;
      if (isAyush      && !showAyush)   return false;
      return true;
    });
    const newMarkers  = addMarkersToMap(newMap, filtered);

    setMap(newMap);
    setMarkers(newMarkers);
    markersRef.current = newMarkers;

    if (newMarkers.length > 1) {
      newMap.fitBounds(new window.L.featureGroup(newMarkers).getBounds().pad(0.1));
    }
  };

  const highlightHospitalCard = (index) => {
    document.querySelectorAll('.hospital-card').forEach(c => c.classList.remove('ring-2', 'ring-primary'));
    const card = document.querySelector(`[data-hospital-index="${index}"]`);
    if (card) { card.classList.add('ring-2', 'ring-primary'); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  };

  const handleHospitalCardClick = (index) => {
    if (markers[index]) {
      markers[index].openPopup();
      if (map) map.setView(markers[index].getLatLng(), 15);
      setSidebarOpen(false);
    }
  };

  const handleBackToPhase1 = () => {
    setCurrentPhase(1);
    if (map) { map.remove(); setMap(null); }
    setMarkers([]); markersRef.current = []; setRecommendations([]); setLoading(false);
  };

  const copyToClipboard = async (text, name) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    alert(`📞 ${text} copied!\n\nYou can now call ${name}`);
  };

  // ── Phase 1 ───────────────────────────────────────────────
  if (currentPhase === 1) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-md">
          <div className="px-4 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3 text-slate-900 dark:text-white">
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20">
                <span className="material-symbols-outlined text-[20px]">local_hospital</span>
              </div>
              <h2 className="text-lg font-bold hidden sm:block">What's Up Doc</h2>
            </div>
            <button onClick={() => setIsEmergency(true)} className="flex items-center rounded-lg h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-bold shadow-sm transition-colors">
              <span className="material-symbols-outlined text-[18px] mr-2">sos</span> Emergency SOS
            </button>
          </div>
        </header>

        <main className="flex-grow flex flex-col items-center justify-center px-4 py-12 md:py-20 relative overflow-hidden">
          <div aria-hidden="true" className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30 pointer-events-none">
            <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px]"></div>
          </div>

          <div className="w-full max-w-3xl flex flex-col items-center text-center space-y-8 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold">
              <span className="material-symbols-outlined text-[14px]">lock</span> 100% Anonymous & Private
            </div>

            {/* Sample Data Toggle */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-50 border border-blue-100">
              <span className="text-xs font-medium text-blue-700">Use Sample Data</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input className="peer sr-only" type="checkbox" checked={useSampleData} onChange={e => setUseSampleData(e.target.checked)} />
                <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-blue-600 transition-colors duration-300"></div>
                <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300 peer-checked:translate-x-full shadow-sm"></div>
              </label>
            </div>

            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight leading-[1.1]">
              Healthcare, <span className="text-primary">right where you are.</span>
            </h1>

            <form onSubmit={handleSearch} className="w-full max-w-lg space-y-6">
              {/* Pincode */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-200"></div>
                <div className="relative">
                  <input
                    value={pincode}
                    onChange={e => setPincode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    className="w-full h-24 bg-surface-light dark:bg-surface-dark rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-center text-5xl font-black tracking-[0.5em] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 shadow-xl transition-all"
                    inputMode="numeric" maxLength="6" placeholder="______" type="text"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400">
                    <span className="material-symbols-outlined text-3xl">location_on</span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-500 font-semibold">Enter 6-digit Pincode</p>
              </div>

              {/* Emergency toggle */}
              <div className={`flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between rounded-2xl p-5 border transition-colors duration-300 ${isEmergency ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-transparent'}`}>
                <div className="text-left space-y-1">
                  <p className="text-base font-bold text-slate-900 dark:text-white">Current Emergency?</p>
                  <p className="text-sm text-slate-500">{isEmergency ? 'Emergency Mode: Showing 24/7 trauma centers only.' : 'Show routine care & clinics.'}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center self-start sm:self-center">
                  <input className="peer sr-only" type="checkbox" checked={isEmergency} onChange={e => setIsEmergency(e.target.checked)} />
                  <div className="h-8 w-14 rounded-full bg-slate-300 peer-checked:bg-accent transition-colors duration-300"></div>
                  <div className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-all duration-300 peer-checked:translate-x-full shadow-sm"></div>
                </label>
              </div>

              {/* Condition input */}
              <div className="w-full relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-200"></div>
                <div className="relative w-full bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center p-2">
                  <div className="pl-4 pr-3 text-slate-400">
                    <span className="material-symbols-outlined text-[28px]">search</span>
                  </div>
                  <input
                    value={condition}
                    onChange={e => setCondition(e.target.value)}
                    className="w-full h-14 bg-transparent border-none outline-none focus:ring-0 text-lg text-slate-900 dark:text-white placeholder:text-slate-400"
                    placeholder="Try 'Child has fever' or 'Heart checkup'..." type="text"
                  />
                  <button type="submit" disabled={loading} className="hidden sm:flex h-12 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg px-6 items-center justify-center transition-colors shadow-lg shadow-primary/20 disabled:opacity-50">
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="sm:hidden w-full h-12 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg flex items-center justify-center shadow-lg transition-colors disabled:opacity-50">
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>

            <p className="text-slate-500 text-lg leading-relaxed max-w-xl mx-auto">
              Type your symptoms in plain English or Hinglish. We map your keywords to the correct <span className="text-slate-700 font-medium">Specialty</span> or <span className="text-slate-700 font-medium">System of Medicine</span>.
            </p>

            <div className="flex flex-col items-center gap-3 pt-2">
              <span className="text-sm text-slate-500 font-medium">Common searches:</span>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { symptom: 'fever', emoji: '🤒', label: 'Fever' },
                  { symptom: 'skin rash', emoji: '🦠', label: 'Skin Rash' },
                  { symptom: 'child checkup', emoji: '👶', label: 'Pediatrician' },
                  { symptom: 'toothache', emoji: '🦷', label: 'Toothache' },
                  { symptom: 'ayurveda', emoji: '🧘', label: 'Ayurveda' },
                ].map(item => (
                  <button key={item.symptom} onClick={() => setCondition(item.symptom)}
                    className="group px-4 py-2 rounded-full text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all transform hover:scale-105">
                    <span className="group-hover:animate-bounce inline-block mr-1">{item.emoji}</span>{item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Phase 2 ───────────────────────────────────────────────
  const filteredHospitals = getFilteredHospitals();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark shadow-sm">
        <div className="px-4 h-16 flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <button onClick={handleBackToPhase1} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors p-2 rounded-lg hover:bg-slate-100">
              <span className="material-symbols-outlined">arrow_back</span>
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
                <span className="material-symbols-outlined text-[20px]">local_hospital</span>
              </div>
              <div>
                <h2 className="text-lg font-bold hidden sm:block">What's Up Doc</h2>
                <span className="text-xs text-slate-500 font-medium">Care-Map Discovery</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 w-full">
              <span className="material-symbols-outlined text-slate-400 text-[16px]">search</span>
              <span className="text-sm text-slate-600">
                Searching: <span className="font-semibold text-slate-900">"{condition}"</span>
                {isEmergency && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">Emergency</span>}
              </span>
            </div>
          </div>

          <button onClick={() => setIsEmergency(true)} className="flex items-center rounded-lg h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-bold shadow-sm transition-colors">
            <span className="material-symbols-outlined text-[18px] mr-2">sos</span> SOS
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative w-full">
        {sidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

        {/* Sidebar */}
        <aside className={`w-full md:w-[450px] bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 absolute md:relative h-full transition-transform duration-300 shadow-2xl md:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

          {/* Filters */}
          <div className="px-4 py-4 border-b border-slate-100 space-y-4 bg-surface-light dark:bg-surface-dark z-10">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-white">{filteredHospitals.length} Results found</h3>
              <span className="text-xs font-medium text-slate-500">Sort by Distance</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Sarkari (Govt)', color: 'blue',  checked: showSarkari, onChange: e => setShowSarkari(e.target.checked) },
                { label: 'Private',        color: 'red',   checked: showPrivate, onChange: e => setShowPrivate(e.target.checked) },
                { label: '🌿 AYUSH',       color: 'green', checked: showAyush,   onChange: e => setShowAyush(e.target.checked) },
              ].map(f => (
                <label key={f.label} className="inline-flex items-center cursor-pointer px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 hover:border-primary transition-colors">
                  <input className={`form-checkbox text-${f.color}-600 rounded size-4 mr-2`} type="checkbox" checked={f.checked} onChange={f.onChange} />
                  <span className="text-xs font-semibold text-slate-700">{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Hospital Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-[#0d141c]">
            {filteredHospitals.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                <p className="font-medium">No hospitals match your filters</p>
                <p className="text-sm mt-1">Try enabling more filter options above</p>
              </div>
            )}

            {filteredHospitals.map((hospital, index) => {
              const { isGovernment, isAyush } = getHospitalType(hospital);
              const { color }  = getMarkerStyle(hospital);
              const label      = isGovernment ? 'Sarkari' : isAyush ? 'AYUSH' : 'Private';
              const name       = getHospitalName(hospital);
              const phone      = getHospitalPhone(hospital);
              const address    = getHospitalAddress(hospital);
              const dist       = formatDistance(hospital);
              const disciplines = hospital.discipline_clean?.join(', ') || '';

              return (
                <div
                  key={hospital.id || index}
                  className={`hospital-card group relative bg-white dark:bg-surface-dark rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer ${isAyush ? 'ring-1 ring-green-500/20 bg-gradient-to-br from-white to-green-50/50' : ''}`}
                  data-hospital-index={index}
                  onClick={() => handleHospitalCardClick(index)}
                >
                  <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                    {hospital.total_beds && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        <span className="material-symbols-outlined text-[14px] mr-1">bed</span>
                        {hospital.total_beds} beds
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{dist}</span>
                  </div>

                  <div className="pr-20">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900 dark:text-white text-base">{name}</h4>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <span className="size-2 rounded-full" style={{ backgroundColor: color }}></span>
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
                      {disciplines && <>
                        <span className="text-slate-300">|</span>
                        <span className="text-xs text-slate-500">{disciplines}</span>
                      </>}
                    </div>

                    {hospital.emergency_available && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 mb-2">
                        <span className="material-symbols-outlined text-[12px]">emergency</span> 24/7 Emergency
                      </span>
                    )}

                    <p className="text-sm text-slate-500 line-clamp-1 mb-3">{address}</p>

                    {phone ? (
                      <button
                        onClick={e => { e.stopPropagation(); copyToClipboard(phone, name); }}
                        className="w-full h-8 rounded-md bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">call</span> Call Hospital
                      </button>
                    ) : (
                      <div className="w-full h-8 rounded-md bg-slate-100 text-slate-400 text-xs font-semibold flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">phone_disabled</span> No Phone Available
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="text-center py-4">
              <p className="text-xs text-slate-400">End of results near you</p>
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-surface-dark border-t border-slate-200 flex justify-center text-[10px] text-slate-400">
            © What's Up Doc
          </div>
        </aside>

        {/* Map */}
        <section className="flex-1 relative overflow-hidden z-0">
          <div id="care-map" className="w-full h-full"></div>

          {/* Map Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
            {[
              { icon: 'my_location', title: 'Find My Location', onClick: () => map?.locate({ setView: true, maxZoom: 16 }) },
              { icon: 'add',         title: 'Zoom In',          onClick: () => map?.zoomIn() },
              { icon: 'remove',      title: 'Zoom Out',         onClick: () => map?.zoomOut() },
            ].map(btn => (
              <button key={btn.icon} onClick={btn.onClick} title={btn.title}
                className="size-10 rounded-lg bg-white dark:bg-surface-dark shadow-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:text-primary transition-colors">
                <span className="material-symbols-outlined">{btn.icon}</span>
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="absolute top-4 left-4 z-[1000]">
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-lg p-3 border border-slate-200">
              <div className="text-sm font-semibold text-slate-900 mb-2">Hospital Types</div>
              <div className="space-y-1 text-xs">
                {[
                  { color: '#ef4444', label: 'Private' },
                  { color: '#2563eb', label: 'Government/Sarkari' },
                  { color: '#10b981', label: 'AYUSH (Ayurveda/Homeopathy)' },
                ].map(t => (
                  <div key={t.label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }}></div>
                    <span className="text-slate-600">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;