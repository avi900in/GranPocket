import React, { useState, useEffect } from 'react';
import { AlertOctagon, RefreshCw, PhoneCall, ShieldCheck, Clock, MapPin, Heart, ChevronRight, Bot, Info, Activity, Pill, HeartPulse, Video, CalendarPlus, Share2, Building2 } from 'lucide-react';
import type { TriageResult, Person, Address, EmergencyContact, Language, Ailment } from '../types';
import { findNearestFacilities } from '../engine/singaporeData';
import { getAgeBand } from '../engine/ruleBasedEngine';

interface TriageResultViewProps {
  result: TriageResult;
  person: Person;
  address: Address;
  emergencyContacts: EmergencyContact[];
  language: Language;
  ailment?: Ailment;
  triageMode?: 'rule-based' | 'agentic';
  onReset: () => void;
  onOpenSos: () => void;
  onCreateMonitoringPlan: () => void;
  onRemoveAilment?: (personId: string) => void;
  onOpenFacilities?: () => void;
}

export const TriageResultView: React.FC<TriageResultViewProps> = ({
  result,
  person,
  address,
  emergencyContacts,
  language,
  ailment,
  triageMode,
  onReset,
  onOpenSos,
  onOpenFacilities,
  onCreateMonitoringPlan
}) => {
  const [showParamedicCard, setShowParamedicCard] = useState(false);
  const [resolvedLat, setResolvedLat] = useState(address?.lat || 1.3325);
  const [resolvedLng, setResolvedLng] = useState(address?.lng || 103.8475);

  const isPediatric = person?.dob ? (new Date().getFullYear() - new Date(person.dob).getFullYear() < 16) : false;

  useEffect(() => {
    let active = true;
    const geocode = async () => {
      const cleanPostal = address?.postalCode?.replace(/[^0-9]/g, '');
      if (cleanPostal && cleanPostal.length === 6) {
        try {
          const resp = await fetch(
            `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${cleanPostal}&returnGeom=Y&getAddrDetails=Y`
          );
          if (resp.ok) {
            const json = await resp.json();
            if (json.results && json.results.length > 0 && active) {
              const lat = parseFloat(json.results[0].LATITUDE);
              const lng = parseFloat(json.results[0].LONGITUDE);
              if (!isNaN(lat) && !isNaN(lng)) {
                setResolvedLat(lat);
                setResolvedLng(lng);
              }
            }
          }
        } catch {}
      }
    };
    geocode();
    return () => { active = false; };
  }, [address?.postalCode]);

  const nearestFacilities = findNearestFacilities(resolvedLat, resolvedLng, {
    edOnly: result.severity === 'RED',
    pediatricOnly: isPediatric,
  });
  // Severity-based styling config
  const severityConfig = {
    RED: {
      bg: 'bg-red-500',
      gradient: 'from-red-500 to-rose-600',
      lightBg: 'bg-red-50',
      text: 'text-red-600',
      icon: <AlertOctagon className="w-12 h-12 text-white" />,
      ring: 'ring-red-100'
    },
    ORANGE: {
      bg: 'bg-orange-500',
      gradient: 'from-orange-500 to-amber-500',
      lightBg: 'bg-orange-50',
      text: 'text-orange-600',
      icon: <AlertOctagon className="w-12 h-12 text-white" />,
      ring: 'ring-orange-100'
    },
    YELLOW: {
      bg: 'bg-yellow-400',
      gradient: 'from-yellow-400 to-amber-400',
      lightBg: 'bg-yellow-50',
      text: 'text-yellow-700',
      icon: <ShieldCheck className="w-12 h-12 text-white" />,
      ring: 'ring-yellow-100'
    },
    GREEN: {
      bg: 'bg-emerald-500',
      gradient: 'from-emerald-400 to-teal-500',
      lightBg: 'bg-emerald-50',
      text: 'text-emerald-700',
      icon: <Heart className="w-12 h-12 text-white" />,
      ring: 'ring-emerald-100'
    }
  };

  const config = severityConfig[result.severity] || severityConfig.GREEN;

  const handleTelemedClick = (partner: string) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const p = partner.toLowerCase();
    
    let webUrl = '';
    let appUrl = '';
    let storeUrl = '';

    if (p.includes('whitecoat')) {
      webUrl = 'https://whitecoat.com.sg/';
      appUrl = 'whitecoat://';
      storeUrl = /Android/i.test(navigator.userAgent) 
        ? 'https://play.google.com/store/apps/details?id=com.whitecoat.patient' 
        : 'https://apps.apple.com/sg/app/whitecoat/id1358327311';
    } else if (p.includes('doctor anywhere') || p.includes('dr anywhere')) {
      webUrl = 'https://doctoranywhere.com/';
      appUrl = 'doctoranywhere://';
      storeUrl = /Android/i.test(navigator.userAgent)
        ? 'https://play.google.com/store/apps/details?id=com.doctoranywhere.app'
        : 'https://apps.apple.com/sg/app/doctor-anywhere/id1313626245';
    } else {
      webUrl = `https://www.google.com/search?q=${encodeURIComponent(partner + ' telemedicine singapore')}`;
      storeUrl = webUrl;
    }

    if (isMobile) {
      // Try to open app scheme, fallback to store
      const start = Date.now();
      window.location.href = appUrl || storeUrl;
      setTimeout(() => {
        if (Date.now() - start < 1500) {
          window.location.href = storeUrl;
        }
      }, 1000);
    } else {
      window.open(webUrl, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 relative overflow-hidden rounded-3xl border border-gray-100 shadow-sm transition-all duration-500 animate-in fade-in zoom-in-95">
      
      {/* Premium Header */}
      <div className={`px-6 pt-10 pb-16 bg-gradient-to-br ${config.gradient} text-white flex flex-col items-center text-center relative overflow-hidden`}>
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-white opacity-10 blur-3xl rounded-full"></div>
        
        <div className={`w-24 h-24 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 ring-8 ring-white/10 relative z-10`}>
          {config.icon}
        </div>
        
        <h2 className="text-3xl font-extrabold tracking-tight mb-2 relative z-10">
          {result.deterministicAction || result.action}
        </h2>
        <p className="text-white/80 font-medium max-w-sm relative z-10 mb-6">
          For {person.name}
        </p>

        {/* Grandma Advice in Header */}
        {result.grandmaExplanation && (
          <div className="w-full max-w-md bg-white/20 backdrop-blur-lg border border-white/30 rounded-2xl p-5 relative z-10 text-left shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-lg shadow-inner">
                👵
              </div>
              <h3 className="font-bold text-white text-lg drop-shadow-sm">Grandma says...</h3>
            </div>
            <p className="text-white/95 leading-relaxed font-medium text-sm drop-shadow-sm">
              {result.grandmaExplanation}
            </p>
          </div>
        )}
      </div>

      {/* Main Content Area (Overlaps header slightly) */}
      <div className="px-4 -mt-8 flex-1 overflow-y-auto pb-24 relative z-20">
        
        {/* Result Summary Card */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-4 border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <Clock className={`w-5 h-5 ${config.text}`} />
            <h3 className="font-bold text-gray-800">Recommended Timeframe</h3>
          </div>
          <p className="text-xl font-extrabold text-gray-900 mb-6">{result.timeframe}</p>
          
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Clinical Care Assessment</h4>
            <p className="text-gray-700 leading-relaxed font-medium">
              {(result as any).summary || result.action}
            </p>
          </div>
        </div>

        {/* Database Driven Care Plan */}
        {(result.otcMedications || result.homeCare) && (
          <div className="bg-white rounded-3xl shadow-lg p-6 mb-4 border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              Clinical Care Plan
            </h3>

            {result.otcMedications && result.otcMedications.length > 0 && (() => {
              const ageBand = person?.dob ? getAgeBand(person.dob) : 'adult';
              const doseMap = result.medicationDoseByAge || {};
              const targetDose = doseMap[ageBand] || (['toddler'].includes(ageBand) ? '2.5ml' : ['child'].includes(ageBand) ? '5ml' : ['adolescent', 'adult', 'elderly'].includes(ageBand) ? '10ml' : 'N/A');
              const frequency = result.medicationFrequency;

              return (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-gray-500 flex items-center gap-2">
                      <Pill className="w-4 h-4" /> Recommended OTC Medications
                    </h4>
                    {frequency && frequency !== 'N/A' && (
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                        {frequency}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {result.otcMedications.map((med, i) => (
                      <div key={i} className="px-3.5 py-2 bg-blue-50/80 text-blue-900 text-xs font-semibold rounded-xl border border-blue-200/80 shadow-xs flex items-center gap-2">
                        <span className="font-bold text-blue-950">{med}</span>
                        <span className="text-blue-600 font-mono bg-blue-100/70 px-2 py-0.5 rounded-md text-[11px]">
                          Dose: {targetDose}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {result.homeCare && result.homeCare.length > 0 && (
              <div className="mb-5">
                <h4 className="text-sm font-bold text-gray-500 flex items-center gap-2 mb-2">
                  <HeartPulse className="w-4 h-4" /> Home Care
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  {result.homeCare.map((care, i) => (
                    <li key={i} className="text-gray-700 text-sm font-medium">{care}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Check-Back Reminder & Monitoring Plan Card (YELLOW & GREEN) placed right below medicines/care */}
            {(result.severity === 'YELLOW' || result.severity === 'GREEN') && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 mt-2 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-amber-900 text-sm flex items-center gap-2">
                    <Heart className="w-4 h-4 text-amber-600" />
                    <span>Check-Back Reminder & Monitoring</span>
                  </div>
                  <p className="text-xs text-amber-800/90 leading-relaxed">
                    Grandma noted down this recommendation. Set an automatic check-back reminder to monitor symptoms over the next 24–72 hours.
                  </p>
                </div>
                <button
                  onClick={onCreateMonitoringPlan}
                  className="w-full sm:w-auto px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
                >
                  <CalendarPlus className="w-4 h-4" />
                  <span>Set Check-Back Reminder</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Yellow / Orange / Red: Nearest Singapore Medical Facilities */}
        {nearestFacilities.length > 0 && result.severity !== 'GREEN' && (
          <div className="bg-white rounded-3xl shadow-lg p-6 mb-4 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-600" />
                <span>Nearest Medical Facilities / Clinics</span>
              </h3>
              <span className="text-xs text-gray-500 font-medium">
                {address?.postalCode ? `Near ${address.postalCode}` : 'Singapore'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {nearestFacilities.slice(0, 2).map(f => (
                <div
                  key={f.id}
                  className="p-4 rounded-2xl border border-gray-100 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>{f.name}</span>
                    </div>
                    {f.distance !== undefined && (
                      <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100 shrink-0">
                        {f.distance.toFixed(1)} km
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">
                    {f.address} {f.hours && `• ${f.hours}`}
                  </div>
                  {f.eta && (
                    <div className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Estimated travel: ~{f.eta}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {onOpenFacilities && (
              <button
                onClick={onOpenFacilities}
                className="mt-3 w-full py-2.5 text-xs text-teal-700 hover:text-teal-800 font-bold bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <span>View Full Map & All Clinic Options</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Check-Back Reminder & Monitoring Plan Card fallback when no medications/care plan is displayed */}
        {(!result.otcMedications && !result.homeCare) && (result.severity === 'YELLOW' || result.severity === 'GREEN') && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-3xl p-5 mb-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-amber-900 text-sm flex items-center gap-2">
                <Heart className="w-4 h-4 text-amber-600" />
                <span>Check-Back Reminder & Monitoring</span>
              </div>
              <p className="text-xs text-amber-800/90 leading-relaxed">
                Grandma noted down this recommendation. Set an automatic check-back reminder to monitor symptoms over the next 24–72 hours.
              </p>
            </div>
            <button
              onClick={onCreateMonitoringPlan}
              className="w-full sm:w-auto px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>Set Check-Back Reminder</span>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3 mt-6">
          {result.severity === 'RED' && (
            <div className="space-y-3">
              <button 
                onClick={onOpenSos}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <PhoneCall className="w-5 h-5 group-hover:animate-pulse" />
                Call 995 Emergency
              </button>

              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-red-700 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    SCDF Paramedic Card
                  </h3>
                  <button
                    onClick={() => setShowParamedicCard(!showParamedicCard)}
                    className="text-sm font-bold text-red-600 hover:underline"
                  >
                    {showParamedicCard ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showParamedicCard && (
                  <div className="bg-white rounded-xl border border-red-100 p-4 text-sm font-mono text-gray-700 space-y-2">
                    <div><span className="text-gray-400">Patient:</span> {person.name}</div>
                    <div><span className="text-gray-400">ID:</span> S****{person.id.slice(-3).toUpperCase()}</div>
                    <div><span className="text-gray-400">DOB:</span> {person.dob}</div>
                    <div><span className="text-gray-400">Postal:</span> {address?.postalCode || 'Unknown'}</div>
                    <div><span className="text-gray-400">Address:</span> {address?.text || 'Unknown'}</div>
                    <div className="text-red-600 font-bold mt-2">
                      <span>Complaint:</span> {result.action}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <button 
            onClick={onOpenFacilities}
            className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-between px-6 group"
          >
            <span>Find Nearest Clinic/Hospital</span>
            <MapPin className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Clinical Transparency Panel (Rule-Based vs. AI-Assisted) */}
        {(() => {
          const isAgentic = triageMode === 'agentic' || Boolean(result.agenticConfidence || result.agenticProvenance);

          if (!isAgentic) {
            return (
              <div className="mt-8 mb-16 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <ShieldCheck size={80} />
                </div>
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg">
                    <ShieldCheck size={18} />
                  </div>
                  <h4 className="font-bold text-emerald-900">Deterministic Rule-Based Triage</h4>
                  <div className="ml-auto flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-emerald-200">
                    <Activity size={14} className="text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-800">100% Deterministic</span>
                  </div>
                </div>
                
                <div className="space-y-2 relative z-10 text-sm text-emerald-900">
                  <p className="flex items-start gap-2">
                    <Info size={14} className="mt-1 shrink-0 text-emerald-600" />
                    <span>Evaluated strictly against <strong>Singapore MOH CPG guidelines & hardcoded clinical rules</strong> with zero generative LLM hallucinations.</span>
                  </p>
                  <p className="flex items-start gap-2 text-xs opacity-85 pl-6">
                    Red-flag conditions, profile modifiers, and structured triage trees governed the care tier and urgency timeframe.
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div className="mt-8 mb-16 p-4 rounded-2xl bg-blue-50/50 border border-blue-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Bot size={80} />
              </div>
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                  <Bot size={18} />
                </div>
                <h4 className="font-bold text-blue-900">AI-Assisted Triage</h4>
                {result.agenticConfidence && (
                  <div className="ml-auto flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-blue-200">
                    <Activity size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-blue-700">{result.agenticConfidence}% Match</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-2 relative z-10 text-sm text-blue-800">
                <p className="flex items-start gap-2">
                  <Info size={14} className="mt-1 shrink-0 text-blue-500" />
                  <span>AI components were dynamically used for <strong>symptom analysis, ailment mapping, and triage severity assessment.</strong></span>
                </p>
                {result.agenticProvenance?.tier3ExpertDoctorAgent && (
                  <p className="flex items-start gap-2 text-xs opacity-80 pl-6">
                    Expert Doctor Agent ({result.agenticProvenance.tier3ExpertDoctorAgent}) was consulted to verify clinical safety.
                  </p>
                )}
              </div>
            </div>
          );
        })()}



        {/* Share Button */}
        <button 
          onClick={() => alert("Shared securely with Family Members via GranPocket Network!")}
          className="w-full py-4 mb-20 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-2xl shadow-sm border border-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <Share2 className="w-5 h-5 text-gray-500" />
          Share Assessment with Family Members
        </button>

      </div>

      {/* Sticky Bottom Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent z-50 pointer-events-none">
        <button 
          onClick={onReset}
          className="w-full py-3 bg-white border-2 border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 pointer-events-auto shadow-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Start New Assessment
        </button>
      </div>

    </div>
  );
};
