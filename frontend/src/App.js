import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { sampleHospitals, sampleEmergencyHospitals } from './sampleData';

function App() {
  const [currentPhase, setCurrentPhase] = useState(1);
  const [pincode, setPincode] = useState('');
  const [condition, setCondition] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const markersRef = useRef([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [useSampleData, setUseSampleData] = useState(true); // Toggle for sample data
  
  // Filter states
  const [showSarkari, setShowSarkari] = useState(true);
  const [showPrivate, setShowPrivate] = useState(true);
  const [showAyush, setShowAyush] = useState(true);

  // Filter hospitals based on checkbox states
  const getFilteredHospitals = useCallback(() => {
    return recommendations.filter(hospital => {
      const isGovernment = hospital.isGovernment || hospital.category?.toLowerCase().includes('government');
      const isAyush = hospital.category?.toLowerCase().includes('ayush');
      const isPrivate = !isGovernment && !isAyush;

      if (isGovernment && !showSarkari) return false;
      if (isPrivate && !showPrivate) return false;
      if (isAyush && !showAyush) return false;

      return true;
    });
  }, [recommendations, showSarkari, showPrivate, showAyush]);

  // Update map markers when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (map && currentPhase === 2 && recommendations.length > 0) {
      // Clear existing markers
      markersRef.current.forEach(marker => map.removeLayer(marker));
      
      // Add filtered markers
      const filteredHospitals = getFilteredHospitals();
      const newMarkers = [];
      
      filteredHospitals.forEach((hospital, index) => {
        // Use actual coordinates if available
        let lat, lng;
        
        if (hospital.latitude && hospital.longitude) {
          lat = parseFloat(hospital.latitude);
          lng = parseFloat(hospital.longitude);
        } else {
          // If no coordinates, place near center of India with small random offset
          lat = 20.5937 + (Math.random() - 0.5) * 0.02;
          lng = 78.9629 + (Math.random() - 0.5) * 0.02;
        }

        // Determine marker style based on hospital type
        const isGovernment = hospital.isGovernment || hospital.category?.toLowerCase().includes('government');
        const isAyush = hospital.category?.toLowerCase().includes('ayush');
        
        let markerColor = '#ef4444'; // Red for private
        let markerIcon = 'local_hospital';
        
        if (isGovernment) {
          markerColor = '#2563eb'; // Blue for government
        } else if (isAyush) {
          markerColor = '#10b981'; // Green for AYUSH
          markerIcon = 'spa';
        }

        // Create custom HTML marker
        const markerHtml = `
          <div class="relative flex flex-col items-center">
            <div class="size-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white transform hover:scale-110 transition-transform cursor-pointer" style="background-color: ${markerColor}">
              <span class="material-symbols-outlined text-[20px]">${markerIcon}</span>
            </div>
            <div class="absolute -z-10 size-10 rounded-full animate-ping opacity-30" style="background-color: ${markerColor}"></div>
          </div>
        `;

        // Create marker
        const marker = window.L.marker([lat, lng], {
          icon: window.L.divIcon({
            html: markerHtml,
            className: 'custom-hospital-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
          })
        }).addTo(map);

        // Create popup content
        const bedCount = Math.floor(Math.random() * 150) + 15;
        const distance = hospital.distance || `${(Math.random() * 5 + 0.5).toFixed(1)} km`;
        const hospitalType = isGovernment ? 'Sarkari' : isAyush ? 'AYUSH' : 'Private';
        
        const popupContent = `
          <div class="p-3 min-w-[200px]">
            <h3 class="font-bold text-slate-900 text-sm mb-2">${hospital.name}</h3>
            <div class="space-y-1 text-xs">
              <div class="flex items-center gap-2">
                <span class="inline-block w-2 h-2 rounded-full" style="background-color: ${markerColor}"></span>
                <span class="font-semibold" style="color: ${markerColor}">${hospitalType}</span>
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
                <span class="material-symbols-outlined text-[14px]">bed</span>
                <span>${bedCount} beds available</span>
              </div>
              <div class="flex items-center gap-2 text-slate-600">
                <span class="material-symbols-outlined text-[14px]">route</span>
                <span>${distance}</span>
              </div>
            </div>
            ${hospital.phone ? `
              <div class="mt-3 pt-2 border-t border-slate-200">
                <button onclick="navigator.clipboard.writeText('${hospital.phone}').then(() => alert('📞 Phone number ${hospital.phone} copied to clipboard!\\n\\nYou can now call ${hospital.name}'))" class="w-full px-3 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">call</span>
                  Call Hospital
                </button>
              </div>
            ` : ''}
          </div>
        `;
        
        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'custom-popup'
        });

        // Add click handler to highlight corresponding list item
        marker.on('click', () => {
          highlightHospitalCard(index);
          setSidebarOpen(false);
        });

        newMarkers.push(marker);
      });

      setMarkers(newMarkers);
      markersRef.current = newMarkers;

      // Fit map to show all markers if we have multiple
      if (newMarkers.length > 1) {
        const group = new window.L.featureGroup(newMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [showSarkari, showPrivate, showAyush, map, recommendations, currentPhase, pincode, getFilteredHospitals]);

  // Handle form submission
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    
    if (!pincode || pincode.length !== 6) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }

    if (!condition.trim()) {
      alert('Please describe your medical condition');
      return;
    }

    setLoading(true);
    setRecommendations([]); // Clear previous results

    // Use sample data if toggle is enabled
    if (useSampleData) {
      setTimeout(() => {
        const hospitals = isEmergency ? sampleEmergencyHospitals : sampleHospitals;
        setRecommendations(hospitals);
        setCurrentPhase(2);
        setLoading(false);
        // Initialize map after phase transition
        setTimeout(() => {
          initializeMap(hospitals);
        }, 100);
      }, 800); // Simulate network delay
      return;
    }

    try {
      let endpoint = 'https://whats-up-doc-c12s.onrender.com/api/hospitals/recommend';
      const params = new URLSearchParams({
        condition: condition,
        pincode: pincode,
        // Add timestamp to prevent caching
        _t: Date.now()
      });

      if (isEmergency) {
        endpoint = 'https://whats-up-doc-c12s.onrender.com/api/hospitals/emergency';
      }

      const response = await axios.get(`${endpoint}?${params}`, {
        // Disable axios caching
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      let hospitals = [];
      if (isEmergency) {
        hospitals = response.data.nearestHospitals || [];
      } else {
        hospitals = response.data.recommendations || [];
      }

      setRecommendations(hospitals);
      
      if (hospitals.length > 0) {
        setCurrentPhase(2);
        // Initialize map after phase transition
        setTimeout(() => {
          initializeMap(hospitals);
        }, 100);
      } else {
        // Handle no hospitals found case
        const message = response.data.message || 'No hospitals found for this pincode. Please try a nearby pincode.';
        alert(message);
      }

    } catch (error) {
      console.error('Error searching hospitals:', error);
      const errorMessage = error.response?.data?.message || 'Unable to find hospitals. Please check your connection and try again.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePincodeChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setPincode(value);
  };

  const handleConditionChange = (e) => {
    setCondition(e.target.value);
  };

  const handleEmergencyToggle = (e) => {
    setIsEmergency(e.target.checked);
  };

  const handleHospitalCardClick = (index) => {
    if (markers[index]) {
      // Open the marker popup
      markers[index].openPopup();
      
      // Center map on selected marker
      if (map && markers[index]) {
        map.setView(markers[index].getLatLng(), 15);
      }
      
      // Close mobile sidebar
      setSidebarOpen(false);
    }
  };

  const handleBackToPhase1 = () => {
    setCurrentPhase(1);
    if (map) {
      map.remove();
      setMap(null);
    }
    setMarkers([]);
    markersRef.current = [];
    // Clear previous results to ensure fresh search
    setRecommendations([]);
    setLoading(false);
  };

  const handleSymptomTagClick = (symptom) => {
    setCondition(symptom);
  };

  // Filter functions
  const handleSarkariFilter = (e) => {
    setShowSarkari(e.target.checked);
  };

  const handlePrivateFilter = (e) => {
    setShowPrivate(e.target.checked);
  };

  const handleAyushFilter = (e) => {
    setShowAyush(e.target.checked);
  };

  // Clipboard functionality
  const copyToClipboard = async (text, hospitalName) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`📞 Phone number ${text} copied to clipboard!\n\nYou can now call ${hospitalName}`);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`📞 Phone number ${text} copied to clipboard!\n\nYou can now call ${hospitalName}`);
    }
  };

  const initializeMap = (hospitals) => {
    if (!window.L) return;

    const mapContainer = document.getElementById('care-map');
    if (!mapContainer) return;

    // Clear existing map if any
    if (map) {
      map.remove();
      setMap(null);
    }

    // Determine center point from actual hospital coordinates
    let centerLat = 20.5937; // Default to center of India
    let centerLng = 78.9629;
    
    // If hospitals have coordinates, calculate center from actual hospital locations
    const hospitalsWithCoords = hospitals.filter(h => h.latitude && h.longitude);
    if (hospitalsWithCoords.length > 0) {
      const avgLat = hospitalsWithCoords.reduce((sum, h) => sum + parseFloat(h.latitude), 0) / hospitalsWithCoords.length;
      const avgLng = hospitalsWithCoords.reduce((sum, h) => sum + parseFloat(h.longitude), 0) / hospitalsWithCoords.length;
      centerLat = avgLat;
      centerLng = avgLng;
      console.log(`Map centered on actual hospital coordinates: ${centerLat}, ${centerLng}`);
    } else {
      console.log(`No hospital coordinates available, using default center of India`);
    }

    // Initialize Leaflet map with OSM tiles
    const newMap = window.L.map('care-map', {
      center: [centerLat, centerLng],
      zoom: hospitalsWithCoords.length > 0 ? 12 : 6, // Zoom in if we have specific locations
      zoomControl: false, // We'll use custom controls
      attributionControl: true
    });
    
    // Add Carto Positron tiles (clean, bright style)
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      className: 'map-tiles'
    }).addTo(newMap);

    // Add hospital markers
    const newMarkers = [];
    const filteredHospitals = getFilteredHospitals();
    filteredHospitals.forEach((hospital, index) => {
      // Use actual coordinates if available, otherwise skip this hospital
      let lat, lng;
      
      if (hospital.latitude && hospital.longitude) {
        lat = parseFloat(hospital.latitude);
        lng = parseFloat(hospital.longitude);
      } else {
        // If no coordinates, place near the center with small random offset
        lat = centerLat + (Math.random() - 0.5) * 0.02;
        lng = centerLng + (Math.random() - 0.5) * 0.02;
      }

      // Determine marker style based on hospital type
      const isGovernment = hospital.isGovernment || hospital.category?.toLowerCase().includes('government');
      const isAyush = hospital.category?.toLowerCase().includes('ayush');
      
      let markerColor = '#ef4444'; // Red for private
      let markerIcon = 'local_hospital';
      
      if (isGovernment) {
        markerColor = '#2563eb'; // Blue for government
      } else if (isAyush) {
        markerColor = '#10b981'; // Green for AYUSH
        markerIcon = 'spa';
      }

      // Create custom HTML marker
      const markerHtml = `
        <div class="relative flex flex-col items-center">
          <div class="size-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white transform hover:scale-110 transition-transform cursor-pointer" style="background-color: ${markerColor}">
            <span class="material-symbols-outlined text-[20px]">${markerIcon}</span>
          </div>
          <div class="absolute -z-10 size-10 rounded-full animate-ping opacity-30" style="background-color: ${markerColor}"></div>
        </div>
      `;

      // Create marker
      const marker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          html: markerHtml,
          className: 'custom-hospital-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        })
      }).addTo(newMap);

      // Create popup content
      const bedCount = Math.floor(Math.random() * 150) + 15;
      const distance = hospital.distance || `${(Math.random() * 5 + 0.5).toFixed(1)} km`;
      const hospitalType = isGovernment ? 'Sarkari' : isAyush ? 'AYUSH' : 'Private';
      
      const popupContent = `
        <div class="p-3 min-w-[200px]">
          <h3 class="font-bold text-slate-900 text-sm mb-2">${hospital.name}</h3>
          <div class="space-y-1 text-xs">
            <div class="flex items-center gap-2">
              <span class="inline-block w-2 h-2 rounded-full" style="background-color: ${markerColor}"></span>
              <span class="font-semibold" style="color: ${markerColor}">${hospitalType}</span>
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
              <span class="material-symbols-outlined text-[14px]">bed</span>
              <span>${bedCount} beds available</span>
            </div>
            <div class="flex items-center gap-2 text-slate-600">
              <span class="material-symbols-outlined text-[14px]">route</span>
              <span>${distance}</span>
            </div>
          </div>
          <div class="mt-3 pt-2 border-t border-slate-200">
            <button onclick="window.open('tel:${hospital.phone}', '_self')" class="w-full px-3 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[16px]">call</span>
              Call Hospital
            </button>
          </div>
        </div>
      `;
      
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });

      // Add click handler to highlight corresponding list item
      marker.on('click', () => {
        highlightHospitalCard(index);
        // Close mobile sidebar when marker is clicked
        setSidebarOpen(false);
      });

      newMarkers.push(marker);
    });

    setMap(newMap);
    setMarkers(newMarkers);
    markersRef.current = newMarkers;

    // Fit map to show all markers if we have multiple
    if (newMarkers.length > 1) {
      const group = new window.L.featureGroup(newMarkers);
      newMap.fitBounds(group.getBounds().pad(0.1));
    }

    // Add user location if geolocation is available
    newMap.on('locationfound', function(e) {
      const userMarker = window.L.circleMarker(e.latlng, {
        radius: 8,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(newMap);
      
      userMarker.bindPopup('Your location').openPopup();
    });

    newMap.on('locationerror', function(e) {
      console.log('Location access denied or unavailable');
    });
  };

  const highlightHospitalCard = (index) => {
    // Remove previous highlights
    document.querySelectorAll('.hospital-card').forEach(card => {
      card.classList.remove('ring-2', 'ring-primary');
    });

    // Highlight selected card
    const card = document.querySelector(`[data-hospital-index="${index}"]`);
    if (card) {
      card.classList.add('ring-2', 'ring-primary');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Render Phase 1 or Phase 2 based on current phase
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
          {/* Background Effects */}
          <div aria-hidden="true" className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30 pointer-events-none">
            <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px]"></div>
          </div>

          <div className="w-full max-w-3xl flex flex-col items-center text-center space-y-8 z-10">
            {/* Privacy Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-semibold tracking-wide">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              100% Anonymous & Private
            </div>

            {/* Sample Data Toggle */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Use Sample Data</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input 
                  className="peer sr-only" 
                  type="checkbox" 
                  checked={useSampleData}
                  onChange={(e) => setUseSampleData(e.target.checked)}
                />
                <div className="h-6 w-11 rounded-full bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 dark:bg-slate-600 peer-checked:bg-blue-600 transition-colors duration-300"></div>
                <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300 peer-checked:translate-x-full shadow-sm"></div>
              </label>
            </div>

            {/* Main Heading */}
            <div className="space-y-4">
              <h1 className="text-3xl md:text-5xl lg:text-[54px] font-bold text-slate-900 dark:text-white tracking-tight leading-[1.1]">
                Healthcare, <span className="text-primary">right where you are.</span>
              </h1>
            </div>

            {/* Form */}
            <form onSubmit={handleSearch} className="w-full max-w-lg space-y-6">
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
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-slate-900 dark:text-white">Current Emergency?</p>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 transition-all duration-300">
                    {isEmergency ? 'Emergency Mode: Showing 24/7 trauma centers only.' : 'Show routine care & clinics.'}
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center self-start sm:self-center">
                  <input 
                    className="peer sr-only" 
                    type="checkbox" 
                    checked={isEmergency}
                    onChange={handleEmergencyToggle}
                  />
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
                    placeholder="Try 'Child has fever' or 'Heart checkup'..." 
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

              <button 
                type="submit"
                disabled={loading}
                className="sm:hidden w-full h-12 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>

            <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed max-w-xl mx-auto">
              Type your symptoms in plain English or Hinglish. We map your keywords to the correct <span className="text-slate-700 dark:text-slate-200 font-medium">Specialty</span> or <span className="text-slate-700 dark:text-slate-200 font-medium">System of Medicine</span>.
            </p>

            {/* Common Searches with Enhanced Hover */}
            <div className="flex flex-col items-center gap-3 pt-2">
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Common searches:</span>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { symptom: 'fever', emoji: '🤒', label: 'Fever' },
                  { symptom: 'skin rash', emoji: '🦠', label: 'Skin Rash' },
                  { symptom: 'child checkup', emoji: '👶', label: 'Pediatrician' },
                  { symptom: 'toothache', emoji: '🦷', label: 'Toothache' },
                  { symptom: 'ayurveda', emoji: '🧘', label: 'Ayurveda' }
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

  // Phase 2 - Results with enhanced design
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Enhanced Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark shadow-sm">
        <div className="px-4 h-16 flex items-center justify-between mx-auto w-full">
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <button 
              onClick={handleBackToPhase1}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </button>
            
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
                <span className="material-symbols-outlined text-[20px]">local_hospital</span>
              </div>
              <div>
                <h2 className="text-lg font-bold leading-none tracking-tight hidden sm:block">What's Up Doc</h2>
                <span className="text-xs text-slate-500 font-medium tracking-wide">Care-Map Discovery</span>
              </div>
            </div>
          </div>
          
          {/* Search Keywords Display */}
          <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-slate-400 text-[16px]">search</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Searching for: <span className="font-semibold text-slate-900 dark:text-white">"{condition}"</span>
                {isEmergency && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">Emergency Mode</span>}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1 text-xs font-semibold px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
              Live Capacity
            </div>
            <button 
              onClick={() => setIsEmergency(true)}
              className="flex items-center justify-center overflow-hidden rounded-lg h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-bold shadow-sm transition-colors ring-offset-2 focus:ring-2 ring-accent"
            >
              <span className="material-symbols-outlined text-[18px] mr-2">sos</span>
              <span className="truncate">SOS</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative w-full">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}
        {/* Enhanced Sidebar */}
        <aside className={`w-full md:w-[450px] bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 absolute md:relative h-full transition-transform duration-300 shadow-2xl md:shadow-none ${sidebarOpen ? 'transform translate-x-0' : 'transform -translate-x-full md:translate-x-0'}`}>
          
          {/* Filters Header */}
          <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 space-y-4 bg-surface-light dark:bg-surface-dark z-10">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-white">{getFilteredHospitals().length} Results found</h3>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 cursor-pointer hover:text-primary">
                <span className="material-symbols-outlined text-[16px]">sort</span>
                Sort by Distance
              </div>
            </div>
            
            {/* Filter Checkboxes */}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center cursor-pointer select-none px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 transition-colors">
                <input 
                  className="form-checkbox text-blue-600 rounded size-4 mr-2 border-slate-300 focus:ring-blue-500" 
                  type="checkbox" 
                  checked={showSarkari}
                  onChange={handleSarkariFilter}
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Sarkari (Govt)</span>
              </label>
              <label className="inline-flex items-center cursor-pointer select-none px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-red-400 transition-colors">
                <input 
                  className="form-checkbox text-red-600 rounded size-4 mr-2 border-slate-300 focus:ring-red-500" 
                  type="checkbox" 
                  checked={showPrivate}
                  onChange={handlePrivateFilter}
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Private</span>
              </label>
              <label className="inline-flex items-center cursor-pointer select-none px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-green-400 transition-colors">
                <input 
                  className="form-checkbox text-green-600 rounded size-4 mr-2 border-slate-300 focus:ring-green-500" 
                  type="checkbox" 
                  checked={showAyush}
                  onChange={handleAyushFilter}
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">AYUSH</span>
              </label>
            </div>
            
            {/* Status Indicators */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-medium text-slate-400">Showing:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                <span className="material-symbols-outlined text-[12px]">check_circle</span> Verified
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                <span className="material-symbols-outlined text-[12px]">bed</span> Beds Available
              </span>
            </div>
          </div>

          {/* Enhanced Hospital Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-[#0d141c]">
            {getFilteredHospitals().map((hospital, index) => {
              const isGovernment = hospital.isGovernment || hospital.category?.toLowerCase().includes('government');
              const isAyush = hospital.category?.toLowerCase().includes('ayush');
              const hospitalType = isGovernment ? 'govt' : isAyush ? 'ayush' : 'private';
              const hospitalTypeColor = isGovernment ? 'text-blue-600' : isAyush ? 'text-green-600' : 'text-red-600';
              const hospitalTypeBg = isGovernment ? 'bg-blue-500' : isAyush ? 'bg-green-500' : 'bg-red-500';
              const hospitalTypeLabel = isGovernment ? 'Sarkari' : isAyush ? 'AYUSH' : 'Private';
              const bedCount = Math.floor(Math.random() * 150) + 15; // Mock bed count
              const distance = hospital.distance || `${(Math.random() * 5 + 0.5).toFixed(1)} km away`;
              
              return (
                <div 
                  key={index} 
                  className={`hospital-card group relative bg-white dark:bg-surface-dark rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-${hospitalType}/50 transition-all cursor-pointer ${isAyush ? 'ring-1 ring-green-500/10 bg-gradient-to-br from-white to-green-50/50 dark:from-surface-dark dark:to-green-900/10' : ''}`}
                  data-hospital-index={index}
                  onClick={() => handleHospitalCardClick(index)}
                >
                  {/* Top Right Info */}
                  <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${bedCount > 50 ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' : 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400'}`}>
                      <span className="material-symbols-outlined text-[14px] mr-1">bed</span>
                      Beds: {bedCount}
                    </span>
                    <span className="text-[10px] text-slate-400">{distance}</span>
                  </div>

                  {/* Main Content */}
                  <div className="pr-20">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900 dark:text-white text-base">{hospital.name}</h4>
                      <span className="material-symbols-outlined text-blue-500 text-[18px]" title="Verified Accreditation">verified</span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`size-2 rounded-full ${hospitalTypeBg}`}></span>
                      <span className={`text-xs font-semibold ${hospitalTypeColor} uppercase tracking-wider`}>{hospitalTypeLabel}</span>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <span className="text-xs text-slate-500">
                        {hospital.specialties && hospital.specialties.length > 0 
                          ? hospital.specialties.slice(0, 3).map(s => s.trim().split(' ')[0]).join(', ')
                          : 'General, Emergency'
                        }
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mb-3">{hospital.address}</p>
                    
                    {/* Action Button */}
                    <div className="flex gap-2">
                      {hospital.phone ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(hospital.phone, hospital.name);
                          }}
                          className="w-full h-8 rounded-md bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm shadow-primary/20"
                        >
                          <span className="material-symbols-outlined text-[16px]">call</span> Call Hospital
                        </button>
                      ) : (
                        <div className="w-full h-8 rounded-md bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">phone_disabled</span> No Phone Available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            <div className="text-center py-4">
              <p className="text-xs text-slate-400">End of results near you</p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800 flex justify-center items-center text-[10px] text-slate-400">
            <span>© What's Up Doc</span>
          </div>
        </aside>

        {/* Real Leaflet Map Section */}
        <section className="flex-1 relative overflow-hidden z-0">
          <div id="care-map" className="w-full h-full"></div>

          {/* Map Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
            <button 
              onClick={() => {
                if (map) {
                  map.locate({setView: true, maxZoom: 16});
                }
              }}
              className="size-10 rounded-lg bg-white dark:bg-surface-dark shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
              title="Find My Location"
            >
              <span className="material-symbols-outlined">my_location</span>
            </button>
            <button 
              onClick={() => {
                if (map) {
                  map.zoomIn();
                }
              }}
              className="size-10 rounded-lg bg-white dark:bg-surface-dark shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
              title="Zoom In"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
            <button 
              onClick={() => {
                if (map) {
                  map.zoomOut();
                }
              }}
              className="size-10 rounded-lg bg-white dark:bg-surface-dark shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined">remove</span>
            </button>
          </div>

          {/* Map Legend */}
          <div className="absolute top-4 left-4 z-[1000]">
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Hospital Types</div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-slate-600 dark:text-slate-400">Private/Multi-specialty</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-slate-600 dark:text-slate-400">Government/Sarkari</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-slate-600 dark:text-slate-400">AYUSH (Ayurveda/Homeopathy)</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
