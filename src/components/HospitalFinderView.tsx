import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Building2, 
  MapPin, 
  PhoneCall, 
  Search, 
  Filter, 
  ShieldCheck, 
  Clock, 
  Navigation, 
  Crosshair, 
  Loader2, 
  AlertTriangle, 
  LocateFixed, 
  Layers, 
  CheckCircle2, 
  ExternalLink, 
  ChevronRight, 
  Sparkles, 
  Baby 
} from 'lucide-react';
import { HelperInfoButton } from './HelperInfoButton';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HospitalFacility, Language } from '../types';
import { 
  SINGAPORE_HOSPITALS, 
  lookupSingaporePostalCode, 
  calculateDistance, 
  estimateDriveEta, 
  isPanelHospital 
} from '../engine/singaporeData';

interface HospitalFinderViewProps {
  userAddressText: string;
  defaultPostal: string;
  defaultLat: number;
  defaultLng: number;
  language: Language;
  facilities?: HospitalFacility[];
}

export const HospitalFinderView: React.FC<HospitalFinderViewProps> = ({
  userAddressText,
  defaultPostal,
  defaultLat,
  defaultLng,
  language,
  facilities,
}) => {
  const [postalInput, setPostalInput] = useState(defaultPostal);
  const [activeLat, setActiveLat] = useState(defaultLat);
  const [activeLng, setActiveLng] = useState(defaultLng);
  const [resolvedAddress, setResolvedAddress] = useState(userAddressText);
  const [locationSource, setLocationSource] = useState<'default' | 'gps' | 'search'>('default');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'ed' | '24hr' | 'polyclinic' | 'pediatric'>('all');
  const [insurerFilter, setInsurerFilter] = useState<string>('all');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');

  // Leaflet Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);

  // Read Current GPS Location using Browser Geolocation API
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(language === 'zh' ? '您的浏览器不支持地理定位' : 'Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);

        setActiveLat(lat);
        setActiveLng(lng);
        setAccuracyMeters(accuracy);
        setLocationSource('gps');
        setIsLocating(false);

        // Real Reverse Geocoding via OpenStreetMap Nominatim API
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
              headers: {
                'Accept-Language': language === 'zh' ? 'zh-CN,en' : 'en',
              },
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            const addr = data.address;
            const road = addr?.road || addr?.neighbourhood || addr?.suburb || '';
            const postcode = addr?.postcode || '';
            const city = addr?.suburb || addr?.city || 'Singapore';
            const formatted = `${road ? road + ', ' : ''}${city}${postcode ? ' ' + postcode : ''}`;
            setResolvedAddress(formatted || data.display_name || `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            if (postcode) setPostalInput(postcode);
          } else {
            setResolvedAddress(`GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)} (±${accuracy}m)`);
          }
        } catch {
          setResolvedAddress(`GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)} (±${accuracy}m)`);
        }

        // Pan map to new location
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 14, { animate: true });
        }
      },
      (err) => {
        setIsLocating(false);
        let msg = language === 'zh' ? '无法获取当前位置' : 'Unable to retrieve location';
        if (err.code === err.PERMISSION_DENIED) {
          msg = language === 'zh' ? '位置权限已被禁用，请在浏览器中允许位置访问' : 'Location access was denied. Please allow location in browser settings.';
        } else if (err.code === err.TIMEOUT) {
          msg = language === 'zh' ? '获取位置超时，请重试' : 'Location request timed out. Please try again.';
        }
        setLocationError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  // Real Search via Geocoding API (Postal Code, Landmark, Road)
  const handleSearchLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postalInput.trim()) return;

    // First try fast offline Singapore postal code lookup
    const localResult = lookupSingaporePostalCode(postalInput);
    if (localResult) {
      setActiveLat(localResult.lat);
      setActiveLng(localResult.lng);
      setResolvedAddress(localResult.address);
      setLocationSource('search');
      setLocationError(null);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([localResult.lat, localResult.lng], 14, { animate: true });
      }
      return;
    }

    // Try real Nominatim search API restricted to Singapore
    try {
      setIsLocating(true);
      const query = postalInput.trim().toLowerCase().includes('singapore') 
        ? postalInput.trim() 
        : `${postalInput.trim()}, Singapore`;

      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=sg&limit=1&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );

      if (resp.ok) {
        const results = await resp.json();
        if (results && results.length > 0) {
          const item = results[0];
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          setActiveLat(lat);
          setActiveLng(lng);
          setResolvedAddress(item.display_name.split(',').slice(0, 3).join(', '));
          setLocationSource('search');
          setLocationError(null);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([lat, lng], 14, { animate: true });
          }
        } else {
          setLocationError(language === 'zh' ? '未找到该地址或邮编，请核对后重试' : 'Location or postal code not found. Please verify.');
        }
      }
    } catch {
      setLocationError(language === 'zh' ? '搜索网络异常，请重试' : 'Search request failed. Please try again.');
    } finally {
      setIsLocating(false);
    }
  };

  // Compute live distance and ETA to each facility
  const facilitiesWithDistance = useMemo(() => {
    const sourceFacilities = facilities && facilities.length > 0 ? facilities : SINGAPORE_HOSPITALS;
    return sourceFacilities.map(f => {
      const dist = calculateDistance(activeLat, activeLng, f.lat, f.lng);
      return {
        ...f,
        hours: (f as any).hours || (f.hasED ? '24 Hours Emergency' : 'Standard Clinic Hours'),
        distance: dist,
        eta: estimateDriveEta(dist),
      };
    }).sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }, [activeLat, activeLng, facilities]);

  // Filter facilities
  const filteredFacilities = useMemo(() => {
    return facilitiesWithDistance.filter(f => {
      if (typeFilter === 'ed' && !f.hasED) return false;
      if (typeFilter === '24hr' && !f.hours.toLowerCase().includes('24')) return false;
      if (typeFilter === 'polyclinic' && f.type !== 'polyclinic') return false;
      if (typeFilter === 'pediatric' && !f.specialtyNotes?.toLowerCase().includes('pediatric') && f.id !== 'hosp-kkh' && f.id !== 'hosp-nuh') return false;
      if (insurerFilter !== 'all' && !isPanelHospital(f, insurerFilter)) return false;
      return true;
    });
  }, [facilitiesWithDistance, typeFilter, insurerFilter]);

  // Identify Nearest Emergency Hospital & Nearest Urgent Clinic
  const nearestEmergencyHospital = useMemo(() => {
    return facilitiesWithDistance.find(f => f.hasED);
  }, [facilitiesWithDistance]);

  const nearestUrgentClinic = useMemo(() => {
    return facilitiesWithDistance.find(f => !f.hasED && f.hours.toLowerCase().includes('24')) 
      || facilitiesWithDistance.find(f => f.type === 'polyclinic' || f.type === '24hr_clinic');
  }, [facilitiesWithDistance]);

  // Initialize and Update Leaflet Real Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create map instance if not already created
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [activeLat, activeLng],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      // Real OpenStreetMap Tile Layer
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Update User Location Marker
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
    }
    if (userAccuracyCircleRef.current) {
      map.removeLayer(userAccuracyCircleRef.current);
    }

    const userIconHtml = `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: rgba(14, 165, 233, 0.4); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 16px; height: 16px; border-radius: 50%; background: #0284c7; border: 2.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.35); z-index: 2;"></div>
      </div>
    `;

    const userIcon = L.divIcon({
      className: 'user-gps-marker',
      html: userIconHtml,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const userMarker = L.marker([activeLat, activeLng], { icon: userIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(`
        <div style="padding: 4px; font-family: sans-serif;">
          <div style="font-weight: 800; font-size: 13px; color: #0284c7;">📍 ${language === 'zh' ? '您的当前位置' : 'Your Current Location'}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">${resolvedAddress}</div>
          ${accuracyMeters ? `<div style="font-size: 10px; color: #0f766e; margin-top: 3px;">GPS Accuracy: ±${accuracyMeters}m</div>` : ''}
        </div>
      `);

    userMarkerRef.current = userMarker;

    // Accuracy Circle
    if (accuracyMeters && accuracyMeters > 20 && accuracyMeters < 1000) {
      const circle = L.circle([activeLat, activeLng], {
        radius: accuracyMeters,
        color: '#0284c7',
        fillColor: '#38bdf8',
        fillOpacity: 0.12,
        weight: 1.5,
      }).addTo(map);
      userAccuracyCircleRef.current = circle;
    }

    // Clear old facility markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    // Add Markers for Filtered Facilities
    filteredFacilities.forEach(facility => {
      const isHospital = facility.hasED;
      const isPediatric = facility.id === 'hosp-kkh';
      const is24hr = facility.hours.toLowerCase().includes('24');

      let bgColor = '#0f766e';
      let iconEmoji = '🩺';
      if (isPediatric) {
        bgColor = '#e11d48';
        iconEmoji = '👶';
      } else if (isHospital) {
        bgColor = '#dc2626';
        iconEmoji = '🏥';
      } else if (is24hr) {
        bgColor = '#d97706';
        iconEmoji = '🚨';
      }

      const isSelected = selectedFacilityId === facility.id;

      const markerHtml = `
        <div style="
          width: ${isSelected ? '38px' : '32px'}; 
          height: ${isSelected ? '38px' : '32px'}; 
          background: ${bgColor}; 
          color: white; 
          border-radius: 10px; 
          border: ${isSelected ? '3px solid #facc15' : '2px solid white'}; 
          box-shadow: 0 3px 8px rgba(0,0,0,0.3); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: ${isSelected ? '17px' : '15px'};
          cursor: pointer;
          transition: transform 0.2s;
        ">
          ${iconEmoji}
        </div>
      `;

      const facilityIcon = L.divIcon({
        className: `facility-marker-${facility.id}`,
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const popupHtml = `
        <div style="font-family: sans-serif; min-width: 220px; max-width: 280px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 4px;">
            <span style="font-weight: 800; font-size: 13px; color: #0f172a; line-height: 1.2;">${facility.name}</span>
          </div>
          ${facility.hasED ? '<span style="background: #fee2e2; color: #991b1b; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase;">24H A&E</span>' : ''}
          <div style="font-size: 11px; color: #475569; margin: 4px 0 6px 0;">${facility.address}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 4px 8px; border-radius: 6px; font-size: 11px; margin-bottom: 6px;">
            <span style="color: #0f766e; font-weight: 700;">📍 ${facility.distance} km</span>
            <span style="color: #64748b; font-weight: 600;">🚗 ${facility.eta}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <a href="tel:${facility.phone.replace(/[^0-9]/g, '')}" style="flex: 1; text-align: center; background: #f1f5f9; color: #0f172a; padding: 6px; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: 700;">
              📞 Call
            </a>
            <a href="https://www.google.com/maps/dir/?api=1&origin=${activeLat},${activeLng}&destination=${facility.lat},${facility.lng}" target="_blank" rel="noreferrer" style="flex: 1; text-align: center; background: #0f766e; color: white; padding: 6px; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: 700;">
              🗺️ Navigate
            </a>
          </div>
        </div>
      `;

      const marker = L.marker([facility.lat, facility.lng], { icon: facilityIcon })
        .addTo(map)
        .bindPopup(popupHtml);

      marker.on('click', () => {
        setSelectedFacilityId(facility.id);
      });

      markersRef.current[facility.id] = marker;
    });

    // Auto-fit bounds if we have facilities
    if (filteredFacilities.length > 0) {
      const bounds = L.latLngBounds([[activeLat, activeLng]]);
      // Add nearest 4 facilities to bounds
      filteredFacilities.slice(0, 4).forEach(f => bounds.extend([f.lat, f.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    // Resize invalidate trigger
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

  }, [activeLat, activeLng, filteredFacilities, selectedFacilityId, language, resolvedAddress, accuracyMeters]);

  // Pan to facility when clicked from list
  const handleSelectFacilityFromList = (facility: HospitalFacility) => {
    setSelectedFacilityId(facility.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([facility.lat, facility.lng], 15, { animate: true });
      const marker = markersRef.current[facility.id];
      if (marker) {
        marker.openPopup();
      }
    }
  };

  // Re-center on user
  const handleRecenterOnUser = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([activeLat, activeLng], 14, { animate: true });
      if (userMarkerRef.current) {
        userMarkerRef.current.openPopup();
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fadeIn pb-14">
      {/* Top Section: Location Bar & GPS Button */}
      <div className="bg-white dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Building2 className="text-[#0F766E] dark:text-[#2DD4BF] shrink-0" size={24} />
              <span>Singapore Hospitals, A&E & Urgent Care</span>
              <HelperInfoButton
                title="Singapore Healthcare Facilities & Navigation"
                content="Locates nearby 24-hour A&E departments, urgent care centers, and polyclinics. Includes live GPS reverse geocoding, driving ETA estimates, and MediShield Life/integrated shield plan panel indicators."
              />
            </h2>
          </div>

          {/* Location Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Real Geolocation Button */}
            <button
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                locationSource === 'gps'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-[#0F766E] hover:bg-[#0D655E] text-white'
              }`}
              title="Read Current Location via Browser GPS"
            >
              {isLocating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : locationSource === 'gps' ? (
                <LocateFixed size={15} />
              ) : (
                <Crosshair size={15} />
              )}
              <span>
                {isLocating
                  ? (language === 'zh' ? '正在获取定位...' : 'Reading GPS...')
                  : locationSource === 'gps'
                  ? (language === 'zh' ? '已定位 (GPS Active)' : 'Live GPS Active')
                  : (language === 'zh' ? '使用当前位置' : 'Locate Me')}
              </span>
            </button>

            {/* Recenter Map Button */}
            <button
              onClick={handleRecenterOnUser}
              className="p-2 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              title="Center map on my location"
              aria-label="Center map"
            >
              <Navigation size={15} className="text-teal-600 dark:text-teal-400" />
            </button>
          </div>
        </div>

        {/* Address Search Bar & Location Banner */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center pt-1 border-t border-[#DDE5E9]/60 dark:border-[#1E2D37]/60">
          <div className="md:col-span-8 flex items-center gap-2 bg-[#FAFBFA] dark:bg-[#16232B] px-3.5 py-2 rounded-2xl border border-[#DDE5E9] dark:border-[#1E2D37] text-xs">
            <MapPin size={16} className={locationSource === 'gps' ? 'text-emerald-500 shrink-0' : 'text-[#0F766E] shrink-0'} />
            <div className="truncate flex-1">
              <span className="text-[#52616B] dark:text-[#94A3B8] font-normal mr-1.5">
                {locationSource === 'gps' ? 'GPS Detected:' : 'Active Location:'}
              </span>
              <strong className="text-slate-900 dark:text-white">{resolvedAddress}</strong>
              {accuracyMeters && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 ml-2 font-mono">
                  (±{accuracyMeters}m)
                </span>
              )}
            </div>
          </div>

          {/* Search Form for Custom Postal / Address */}
          <form onSubmit={handleSearchLookup} className="md:col-span-4 flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={postalInput}
                onChange={e => setPostalInput(e.target.value)}
                placeholder={language === 'zh' ? '输入邮编或地区 (如 310123)' : 'Postal code or area (e.g. 310123)'}
                className="w-full pl-8 pr-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white focus:border-teal-500 min-h-[38px]"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all shrink-0 min-h-[38px]"
            >
              {language === 'zh' ? '搜索' : 'Search'}
            </button>
          </form>
        </div>

        {/* Location Error Warning if any */}
        {locationError && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle size={15} className="shrink-0 text-amber-600" />
            <span>{locationError}</span>
          </div>
        )}

        {/* Quick Spotlight: Nearest Emergency Hospital & Urgent Clinic */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Nearest A&E Hospital */}
          {nearestEmergencyHospital && (
            <div className="bg-gradient-to-br from-red-50 to-rose-50/60 dark:from-red-950/30 dark:to-rose-950/20 border border-red-200 dark:border-red-900/60 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-600 text-white uppercase tracking-wider">
                    🚨 Nearest A&E
                  </span>
                  <span className="text-xs font-black text-red-700 dark:text-red-400">
                    {nearestEmergencyHospital.distance} km • Est. {nearestEmergencyHospital.eta}
                  </span>
                </div>
                <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {nearestEmergencyHospital.name}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  {nearestEmergencyHospital.address}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                <a
                  href={`tel:${nearestEmergencyHospital.phone.replace(/[^0-9]/g, '')}`}
                  className="flex items-center justify-center gap-1 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-white border border-red-200 dark:border-red-800/60 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <PhoneCall size={12} className="text-red-600" />
                  <span>Call</span>
                </a>
                <button
                  onClick={() => handleSelectFacilityFromList(nearestEmergencyHospital)}
                  className="flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <Navigation size={12} />
                  <span>View</span>
                </button>
              </div>
            </div>
          )}

          {/* Nearest Urgent Clinic / Polyclinic */}
          {nearestUrgentClinic && (
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50/60 dark:from-teal-950/30 dark:to-emerald-950/20 border border-teal-200 dark:border-teal-900/60 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-teal-600 text-white uppercase tracking-wider">
                    🩺 Nearest Clinic / UCC
                  </span>
                  <span className="text-xs font-black text-teal-700 dark:text-teal-400">
                    {nearestUrgentClinic.distance} km • Est. {nearestUrgentClinic.eta}
                  </span>
                </div>
                <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {nearestUrgentClinic.name}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  {nearestUrgentClinic.hours}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                <a
                  href={`tel:${nearestUrgentClinic.phone.replace(/[^0-9]/g, '')}`}
                  className="flex items-center justify-center gap-1 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-white border border-teal-200 dark:border-teal-800/60 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <PhoneCall size={12} className="text-teal-600" />
                  <span>Call</span>
                </a>
                <button
                  onClick={() => handleSelectFacilityFromList(nearestUrgentClinic)}
                  className="flex items-center justify-center gap-1 bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <Navigation size={12} />
                  <span>View</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-[#DDE5E9]/60 dark:border-[#1E2D37]/60">
          {/* Facility Type Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 transition-all ${
                typeFilter === 'all'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#16232B] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All Facilities ({facilitiesWithDistance.length})
            </button>
            <button
              onClick={() => setTypeFilter('ed')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 transition-all ${
                typeFilter === 'ed'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#16232B] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              🚨 24h A&E Only
            </button>
            <button
              onClick={() => setTypeFilter('24hr')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 transition-all ${
                typeFilter === '24hr'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#16232B] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              🕒 24-Hour Urgent
            </button>
            <button
              onClick={() => setTypeFilter('polyclinic')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 transition-all ${
                typeFilter === 'polyclinic'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#16232B] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              🏥 Polyclinics / GP
            </button>
            <button
              onClick={() => setTypeFilter('pediatric')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 transition-all ${
                typeFilter === 'pediatric'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#16232B] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              👶 Pediatric Emergency (KKH)
            </button>
          </div>

          {/* Insurance Panel & View Mode */}
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Insurance:</span>
              <select
                value={insurerFilter}
                onChange={e => setInsurerFilter(e.target.value)}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] font-semibold text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="all">All Insurers</option>
                <option value="Great Eastern">Great Eastern Panel</option>
                <option value="AIA">AIA Panel</option>
                <option value="Prudential">Prudential Panel</option>
                <option value="Singlife">Singlife Panel</option>
                <option value="NTUC Income">NTUC Income Panel</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* REAL MAP CONTAINER & FACILITIES LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Real Interactive Leaflet Map (Left / Top) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-3xl p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Interactive Real Map (Singapore SLA / OpenStreetMap)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span> A&E</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block"></span> Clinic</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span> You</span>
            </div>
          </div>

          {/* Map View Canvas */}
          <div 
            ref={mapContainerRef} 
            className="w-full h-[360px] sm:h-[440px] rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 relative z-0"
            style={{ minHeight: '360px' }}
          />

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 pt-1">
            <span>💡 Click any marker to view distance, hours, and direct navigation</span>
            <button
              onClick={handleRecenterOnUser}
              className="text-[#0F766E] dark:text-[#2DD4BF] font-bold hover:underline flex items-center gap-1"
            >
              <Navigation size={12} />
              <span>Center on Me</span>
            </button>
          </div>
        </div>

        {/* Facilities List (Right / Bottom) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Nearest Facilities ({filteredFacilities.length})
            </h3>
            <span className="text-xs text-slate-500">Sorted by distance</span>
          </div>

          <div className="space-y-3 max-h-[500px] sm:max-h-[520px] overflow-y-auto pr-1">
            {filteredFacilities.map(f => {
              const isSelected = selectedFacilityId === f.id;
              const isNearest = f.id === nearestEmergencyHospital?.id;

              return (
                <div
                  key={f.id}
                  onClick={() => handleSelectFacilityFromList(f)}
                  className={`bg-white dark:bg-[#0F1A20] border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer space-y-2.5 ${
                    isSelected
                      ? 'border-teal-500 ring-2 ring-teal-500/20 dark:ring-teal-500/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                          {f.name}
                        </h4>
                        {f.hasED && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60">
                            A&E
                          </span>
                        )}
                        {f.id === 'hosp-kkh' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200">
                            Pediatric 24h
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center space-x-1">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{f.address}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-lg border border-teal-200 dark:border-teal-800">
                        {f.distance} km
                      </span>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {f.eta}
                      </div>
                    </div>
                  </div>

                  {f.specialtyNotes && (
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50">
                      ⭐ {f.specialtyNotes}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center space-x-1.5">
                    <Clock size={12} className="text-slate-400 shrink-0" />
                    <span>{f.hours}</span>
                  </div>

                  {/* Insurance panel badges */}
                  {(() => {
                    const panelsList = f.insurerPanel || f.panels || [];
                    if (panelsList.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {panelsList.slice(0, 4).map((ins, i) => (
                          <span
                            key={i}
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                              insurerFilter.toLowerCase() === ins.toLowerCase()
                                ? 'bg-teal-600 text-white font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {ins}
                          </span>
                        ))}
                        {panelsList.length > 4 && (
                          <span className="text-[9px] text-slate-400 px-1">
                            +{panelsList.length - 4} more
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Actions: Call & Real Maps Navigation */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    <a
                      href={`tel:${f.phone.replace(/[^0-9]/g, '')}`}
                      onClick={e => e.stopPropagation()}
                      className="flex items-center space-x-1 text-slate-800 dark:text-slate-200 hover:text-teal-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition-colors font-bold text-[11px]"
                    >
                      <PhoneCall size={12} />
                      <span>{f.phone}</span>
                    </a>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${activeLat},${activeLng}&destination=${encodeURIComponent(f.name + ' ' + f.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center space-x-1 text-teal-700 dark:text-teal-300 hover:text-teal-900 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 px-2.5 py-1 rounded-xl transition-colors font-bold text-[11px]"
                    >
                      <Navigation size={12} />
                      <span>Directions</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

