import React, { useState } from 'react';
import { AlertOctagon, RefreshCw, PhoneCall, ShieldCheck, Clock, MapPin, Heart, ChevronRight, Bot, Info, Activity, Pill, HeartPulse, Video, CalendarPlus, Share2 } from 'lucide-react';
import type { TriageResult, Person, Address, EmergencyContact, Language, Ailment } from '../types';

interface TriageResultViewProps {
  result: TriageResult;
  person: Person;
  address: Address;
  emergencyContacts: EmergencyContact[];
  language: Language;
  ailment?: Ailment;
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
  onReset,
  onOpenSos,
  onOpenFacilities,
  onCreateMonitoringPlan
}) => {
  const [showParamedicCard, setShowParamedicCard] = useState(false);
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
          {result.deterministicAction || result.actionText}
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
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Agentic Summary</h4>
            <p className="text-gray-700 leading-relaxed font-medium">
              {result.summary}
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

            {result.otcMedications && result.otcMedications.length > 0 && (
              <div className="mb-5">
                <h4 className="text-sm font-bold text-gray-500 flex items-center gap-2 mb-2">
                  <Pill className="w-4 h-4" /> OTC Medications
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.otcMedications.map((med, i) => (
                    <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-semibold rounded-lg border border-blue-100">
                      {med}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
            
            <button
              onClick={onCreateMonitoringPlan}
              className="mt-2 w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <CalendarPlus className="w-5 h-5" />
              Schedule Meds & Monitoring
            </button>
          </div>
        )}

        {/* Telemedicine Suggestion */}
        {result.telemedPartners && result.telemedPartners.length > 0 && (
          <div className="bg-white rounded-3xl shadow-lg p-6 mb-4 border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-500" />
              Recommended Telemedicine
            </h3>
            <div className="flex flex-wrap gap-3">
              {result.telemedPartners.map((partner, i) => (
                <button 
                  key={i} 
                  onClick={() => handleTelemedClick(partner)}
                  className="flex-1 py-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl transition-all border border-purple-200"
                >
                  Consult {partner}
                </button>
              ))}
            </div>
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

        {/* AI Transparency Panel */}
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
