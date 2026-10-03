import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  Eye, 
  Home, 
  PhoneCall, 
  MapPin, 
  Building2, 
  Send, 
  RotateCcw, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Heart,
  Share2,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Pill
} from 'lucide-react';
import { HelperInfoButton } from './HelperInfoButton';
import type { TriageResult, Person, Address, EmergencyContact, Language, Ailment } from '../types';
import { getSeverityDisplay } from '../engine/severityDisplay';
import { findNearestFacilities, isPanelHospital } from '../engine/singaporeData';
import { getAgeDisplay } from '../engine/triageEngine';

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
  onCreateMonitoringPlan,
  onRemoveAilment,
}) => {
  const [showWhyAccordion, setShowWhyAccordion] = useState(true);
  const [familyAlertSent, setFamilyAlertSent] = useState(false);
  const [showParamedicCard, setShowParamedicCard] = useState(result.severity === 'RED');
  const [copiedHandoff, setCopiedHandoff] = useState(false);
  const [ailmentRemoved, setAilmentRemoved] = useState(false);

  const severityDisplay = getSeverityDisplay(result.severity);
  const isPediatric = new Date().getFullYear() - new Date(person.dob).getFullYear() < 16;
  const [resolvedLat, setResolvedLat] = useState(address.lat);
  const [resolvedLng, setResolvedLng] = useState(address.lng);

  useEffect(() => {
    let active = true;
    const geocode = async () => {
      const cleanPostal = address.postalCode?.replace(/[^0-9]/g, '');
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
  }, [address.postalCode]);

  const nearestHospitals = findNearestFacilities(resolvedLat, resolvedLng, {
    edOnly: result.severity === 'RED',
    pediatricOnly: isPediatric,
  });

  const handleSendFamilyAlert = () => {
    setFamilyAlertSent(true);
    setTimeout(() => setFamilyAlertSent(false), 5000);
  };

  const handleCopyHandoffNote = () => {
    const text = [
      `[GranPocket Teleconsult Clinical Handoff Note]`,
      `Patient: ${person.name} (${getAgeDisplay(person.dob, language)})`,
      `Triage Level: ${result.severity} (${result.timeframe})`,
      `Recommended Care Tier: ${result.careTierText}`,
      `Clinical Complaint: ${result.action}`,
      `Triggered Reasons: ${result.reasons.join('; ')}`,
      `Red Flags Considered: ${result.whenToWorry?.join('; ') || 'None'}`,
      `Known Allergies: ${person.medicalProfile.allergies.map(a => a.name).join(', ') || 'No known drug allergies'}`,
      `Current Active Medications: ${person.medicalProfile.medications.map(m => `${m.name} (${m.dose})`).join(', ') || 'None'}`,
      `Postal Code / Location: ${address.postalCode} Singapore`,
      `Timestamp: ${new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`
    ].join('\n');

    navigator.clipboard?.writeText(text);
    setCopiedHandoff(true);
    setTimeout(() => setCopiedHandoff(false), 3500);
  };

  // Icon mapping according to Design Principle 3
  const renderSeverityIcon = () => {
    switch (result.severity) {
      case 'RED':
        return <AlertOctagon size={40} className="shrink-0 animate-pulse" strokeWidth={2.2} aria-hidden="true" />;
      case 'ORANGE':
        return <AlertTriangle size={40} className="shrink-0" strokeWidth={2.2} aria-hidden="true" />;
      case 'YELLOW':
        return <Eye size={40} className="shrink-0" strokeWidth={2.2} aria-hidden="true" />;
      case 'GREEN':
        return <Home size={40} className="shrink-0" strokeWidth={2.2} aria-hidden="true" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-16 px-2 sm:px-4">
      {/* Active Ongoing Ailment Banner with Remove Button */}
      {person.activeComplaint && !ailmentRemoved && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xl shrink-0">
              🤒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  Active Ongoing Ailment on File
                </span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {person.activeComplaint}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setAilmentRemoved(true);
              onRemoveAilment?.(person.id);
            }}
            className="px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-900/20 active:scale-95 transition-all flex items-center gap-1.5"
            title="Mark this ailment as resolved and remove from patient profile"
          >
            <CheckCircle size={14} />
            <span>Remove Ongoing Ailment</span>
          </button>
        </div>
      )}

      {ailmentRemoved && (
        <div className="p-4 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Ongoing ailment for {person.name} has been marked as resolved and removed.</span>
        </div>
      )}

      {/* Top Patient Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-bold px-3.5 py-1.5 rounded-full bg-white dark:bg-[#0F1A20] text-[#14212B] dark:text-[#F1F5F9] border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm">
            Patient: <span className="text-[#0F766E] dark:text-[#2DD4BF]">{person.name}</span> ({getAgeDisplay(person.dob, language)})
          </span>
          <span className="font-semibold px-3 py-1 rounded-full bg-[#FFF8E1] text-[#B58105] border border-amber-200 text-xs">
            {result.contentStatusLabel}
          </span>
        </div>
        <button
          onClick={onReset}
          className="text-[#52616B] dark:text-[#94A3B8] hover:text-[#14212B] dark:hover:text-[#F1F5F9] flex items-center gap-1.5 font-bold min-h-[44px] px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RotateCcw size={16} />
          <span>New Assessment</span>
        </button>
      </div>

      {/* Main Severity Outcome Card - Calm under stress, high contrast */}
      <div
        className="rounded-3xl border-2 shadow-soft-lg overflow-hidden transition-colors"
        style={{
          borderColor: severityDisplay.borderColor,
          backgroundColor: severityDisplay.bgColor,
        }}
      >
        {/* Severity Header Banner - Never rely on color alone: Color + Unique Icon + Explicit Text */}
        <div
          className="p-6 sm:p-8 flex flex-wrap items-center justify-between gap-5 transition-colors"
          style={{ 
            backgroundColor: severityDisplay.color,
            color: severityDisplay.textColor 
          }}
          role="region"
          aria-label={`Triage result: ${severityDisplay.label}`}
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-2xl bg-black/10">
              {renderSeverityIcon()}
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-widest opacity-95">
                {severityDisplay.label} • {result.timeframe}
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-black tracking-tight mt-0.5">
                {result.action}
              </h2>
            </div>
          </div>

          {result.severity === 'RED' && (
            <button
              onClick={onOpenSos}
              className="bg-white text-[#C62828] hover:bg-red-50 font-black text-base sm:text-lg px-6 py-3.5 rounded-full shadow-xl active:scale-95 transition-all flex items-center gap-2 min-h-[52px]"
              aria-label="Call 995 Ambulance Immediately"
            >
              <PhoneCall size={22} className="animate-pulse" />
              <span>CALL 995 NOW</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6 bg-white dark:bg-[#0F1A20]">
          {/* Empathetic Plain-English Voice Card ("Trusted family doctor's receptionist") */}
          <div className="flex items-start gap-4 bg-[#F5E9DA]/50 dark:bg-[#16232B] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-2xl p-5 shadow-sm">
            <div className="text-3xl mt-0.5 p-1 bg-white dark:bg-[#0F1A20] rounded-xl shadow-xs shrink-0">
              👵🏼
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase tracking-wider">
                Trusted Receptionist & Grandma Advice:
              </div>
              <p className="text-base font-medium text-[#14212B] dark:text-[#F1F5F9] leading-relaxed">
                {result.grandmaExplanation}
              </p>
            </div>
          </div>

          {/* Local Singapore Care-Tier Guidance */}
          <div className="border border-[#DDE5E9] dark:border-[#1E2D37] rounded-2xl p-5 bg-[#FAFBFA] dark:bg-[#16232B] space-y-2">
            <div className="text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF] uppercase tracking-wider flex items-center gap-2">
              <Building2 size={16} />
              <span>Singapore Healthcare Tier Direction:</span>
            </div>
            <p className="text-sm sm:text-base text-[#14212B] dark:text-[#F1F5F9] leading-relaxed font-semibold">
              {result.careTierText}
            </p>
          </div>

          {/* RED Emergency Panel Specific Features (SRS ESC-01) */}
          {result.severity === 'RED' && (
            <div className="space-y-4 border-t border-[#DDE5E9] dark:border-[#1E2D37] pt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-extrabold text-lg text-[#C62828] dark:text-red-400 flex items-center gap-2">
                  <AlertOctagon size={20} />
                  <span>SCDF 995 Paramedic Card Ready</span>
                </h3>
                <button
                  onClick={() => setShowParamedicCard(!showParamedicCard)}
                  className="text-xs text-[#0F766E] dark:text-[#2DD4BF] font-bold hover:underline min-h-[44px] flex items-center"
                >
                  {showParamedicCard ? 'Hide Card' : 'Show Card'}
                </button>
              </div>

              {showParamedicCard && (
                <div className="bg-[#FDECEA] dark:bg-red-950/40 border-2 border-[#C62828] rounded-2xl p-5 space-y-4 text-xs sm:text-sm text-[#14212B] dark:text-[#F1F5F9]">
                  <div className="font-bold text-sm text-[#C62828] dark:text-red-300">
                    Hand this screen directly to arriving SCDF Paramedics:
                  </div>
                  <div className="grid grid-cols-2 gap-3 font-mono bg-white dark:bg-[#0F1A20] p-4 rounded-xl border border-red-200 dark:border-red-900/40">
                    <div><span className="text-[#52616B] dark:text-[#94A3B8]">Patient:</span> {person.name}</div>
                    <div><span className="text-[#52616B] dark:text-[#94A3B8]">ID:</span> S****{person.id.slice(-3).toUpperCase()}</div>
                    <div><span className="text-[#52616B] dark:text-[#94A3B8]">DOB:</span> {person.dob} ({getAgeDisplay(person.dob, language)})</div>
                    <div><span className="text-[#52616B] dark:text-[#94A3B8]">Postal:</span> {address.postalCode}</div>
                    <div className="col-span-2"><span className="text-[#52616B] dark:text-[#94A3B8]">Address:</span> {address.text}</div>
                    <div className="col-span-2"><span className="text-[#52616B] dark:text-[#94A3B8]">Allergies:</span> {person.medicalProfile.allergies.map(a => a.name).join(', ') || 'None recorded'}</div>
                    <div className="col-span-2"><span className="text-[#52616B] dark:text-[#94A3B8]">Chronic:</span> {person.medicalProfile.conditions.map(c => c.name).join(', ') || 'None'}</div>
                    <div className="col-span-2 text-[#C62828] dark:text-red-400 font-bold">
                      <span>Complaint:</span> {result.action}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GREEN Home Care Monitoring Button */}
          {result.severity === 'GREEN' && (
            <div className="bg-[#E8F5E9] dark:bg-[#2E7D32]/20 border border-[#2E7D32]/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-heading font-extrabold text-[#2E7D32] dark:text-[#81C784] text-base flex items-center gap-2">
                  <Heart size={18} />
                  <span>Start At-Home Monitoring Schedule</span>
                  <HelperInfoButton
                    title="At-Home Monitoring Schedule"
                    content="Initiates proactive check-in cadences (every 4-6 hours) to track temperature, pain, and red flag symptoms automatically."
                  />
                </div>
              </div>
              <button
                onClick={onCreateMonitoringPlan}
                className="px-5 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-sm rounded-full shadow-md min-h-[48px] shrink-0"
              >
                Start Monitoring Plan
              </button>
            </div>
          )}

          {/* ORANGE ALERT: Singapore Teleconsultation Options (WhiteCoat & Dr Anywhere) */}
          {result.severity === 'ORANGE' && (
            <div className="rounded-3xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 sm:p-7 space-y-5 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-900/20">
                    <PhoneCall size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-200/90 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                        Orange Alert • Urgent Care Telemedicine
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                        MOH Licensed
                      </span>
                    </div>
                    <h3 className="font-heading font-black text-lg sm:text-xl text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-2">
                      <span>Singapore Teleconsultation Options</span>
                      <HelperInfoButton
                        title="Urgent Care Telemedicine"
                        content="For Orange alert conditions requiring timely physician review within hours, connect immediately with Singapore registered doctors via WhiteCoat or Doctor Anywhere with doorstep medication delivery."
                      />
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-amber-900 dark:text-amber-300 font-extrabold bg-amber-100 dark:bg-amber-900/50 px-3 py-1.5 rounded-full border border-amber-300 dark:border-amber-700 inline-block shadow-xs">
                    ⚡ Video Consult Queue: &lt; 15 mins
                  </span>
                </div>
              </div>

              {/* 2 Teleconsult Provider Options: WhiteCoat & Dr Anywhere */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. WhiteCoat */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#1E2D37] bg-white dark:bg-[#0F1A20] shadow-sm space-y-4 flex flex-col justify-between hover:border-teal-500/50 transition-all">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-300 flex items-center justify-center font-black text-sm border border-teal-200 dark:border-teal-800">
                          WC
                        </div>
                        <div>
                          <h4 className="font-black text-base text-slate-900 dark:text-white leading-tight">WhiteCoat</h4>
                          <span className="text-[10px] text-slate-500 font-semibold">Singapore MOH Telemedicine Sandbox</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                        In-App Queue
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Singapore's primary telemedicine provider. Urgent video consult within 15 minutes. 90-minute express medication delivery islandwide.
                    </p>

                    <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-medium bg-slate-50 dark:bg-[#16232B] p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>✓ Pediatric and general family GP coverage</div>
                      <div>✓ SCDF 995 escalation protocol if patient deteriorates</div>
                      <div>✓ Medisave and CHAS subsidy claimable</div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <a
                      href="https://whitecoat.global/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 shadow-md shadow-teal-900/20 active:scale-95 transition-all"
                    >
                      <span>Connect with WhiteCoat</span>
                      <ExternalLink size={13} />
                    </a>
                    <a
                      href="tel:+6565559448"
                      className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs text-center flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <PhoneCall size={12} className="text-teal-600" />
                      <span>Call WhiteCoat (+65 6555 9448)</span>
                    </a>
                  </div>
                </div>

                {/* 2. Doctor Anywhere (Dr Anywhere) */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#1E2D37] bg-white dark:bg-[#0F1A20] shadow-sm space-y-4 flex flex-col justify-between hover:border-blue-500/50 transition-all">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-black text-sm border border-blue-200 dark:border-blue-800">
                          DA
                        </div>
                        <div>
                          <h4 className="font-black text-base text-slate-900 dark:text-white leading-tight">Doctor Anywhere (Dr Anywhere)</h4>
                          <span className="text-[10px] text-slate-500 font-semibold">24/7 SMC Registered Doctors</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                        24/7 Standby
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      24/7 on-demand video consultation with Singapore GMC/SMC doctors. Medication delivered to your home within 3 hours.
                    </p>

                    <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-medium bg-slate-50 dark:bg-[#16232B] p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>✓ Dedicated pediatricians & elderly chronic care doctors</div>
                      <div>✓ Direct insurer cashless panel (Great Eastern, AIA, Singlife, NTUC)</div>
                      <div>✓ Electronic Medical Certificate (e-MC) & specialist referral</div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <a
                      href="https://doctoranywhere.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/20 active:scale-95 transition-all"
                    >
                      <span>Connect with Dr Anywhere</span>
                      <ExternalLink size={13} />
                    </a>
                    <a
                      href="tel:+6568175310"
                      className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs text-center flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <PhoneCall size={12} className="text-blue-600" />
                      <span>Call Dr Anywhere (+65 6817 5310)</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* One-Click Clinical Handoff Summary for Teleconsult Doctor */}
              <div className="p-4 rounded-2xl bg-white/90 dark:bg-[#0F1A20]/90 border border-amber-300 dark:border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    📋 Teleconsult Clinical Handoff Summary Ready
                  </span>
                  <HelperInfoButton
                    title="Teleconsult Clinical Handoff Note"
                    content="Copies vital signs, red flags, allergies, and symptom timeline ready to paste directly into WhiteCoat, Dr Anywhere, or Speedoc chat."
                  />
                </div>
                <button
                  onClick={handleCopyHandoffNote}
                  className="px-4 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-md flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
                >
                  {copiedHandoff ? <CheckCircle size={15} className="text-emerald-400 dark:text-emerald-600" /> : <FileText size={15} />}
                  <span>{copiedHandoff ? 'Copied to Clipboard!' : 'Copy Clinical Handoff Note'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Yellow / Orange / Red: Facilities List */}
          {nearestHospitals.length > 0 && result.severity !== 'GREEN' && (
            <div className="space-y-3 border-t border-[#DDE5E9] dark:border-[#1E2D37] pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-extrabold text-base text-[#14212B] dark:text-[#F1F5F9] flex items-center gap-2">
                    <MapPin size={18} className="text-[#0F766E]" />
                    <span>Nearest Singapore Medical Facilities</span>
                  </h3>
                  <HelperInfoButton
                    title="Singapore Medical Facilities"
                    content="Ranked by geodesic distance from registered Singapore postal code with realtime operating hours, ER capacity, and one-touch navigation."
                  />
                </div>
                <span className="text-xs text-[#52616B] dark:text-[#94A3B8]">
                  From postal {address.postalCode}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {nearestHospitals.slice(0, 2).map(f => (
                  <div
                    key={f.id}
                    className="p-4 rounded-2xl border border-[#DDE5E9] dark:border-[#1E2D37] bg-[#FAFBFA] dark:bg-[#16232B] space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="font-bold text-sm text-[#14212B] dark:text-[#F1F5F9]">
                        {f.name}
                      </div>
                      {f.distance !== undefined && (
                        <span className="text-xs font-mono font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                          {f.distance.toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#52616B] dark:text-[#94A3B8]">
                      {f.address} • {f.hours}
                    </div>
                    {f.eta && (
                      <div className="text-xs font-bold text-[#E65100]">
                        Estimated travel time: ~{f.eta}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinician-Approved Home & First-Aid Medication Protocol */}
          {result.homeMedicationAdvice && (
            <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700/60 rounded-3xl p-5 space-y-3 shadow-sm animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                    <Pill size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                      @home_medication_agent • Clinician Approved Protocol
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                      {result.homeMedicationAdvice.medicationName}
                    </h4>
                  </div>
                </div>
                {result.homeMedicationAdvice.urgency && (
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shrink-0">
                    {result.homeMedicationAdvice.urgency.replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              <div className="bg-white dark:bg-[#14212B] p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900 space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-start gap-2">
                  <span className="text-emerald-600 font-black">Instruction:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{result.homeMedicationAdvice.dosageInstruction}</span>
                </div>
                {result.homeMedicationAdvice.route && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="font-bold">Route: </span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400">{result.homeMedicationAdvice.route}</span>
                  </div>
                )}
                {result.homeMedicationAdvice.warnings && (
                  <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
                    ⚠️ <strong>Precaution:</strong> {result.homeMedicationAdvice.warnings}
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Governed by Singapore MOH / HSA Pediatric First-Aid Standards</span>
                {result.homeMedicationAdvice.approvedBy && (
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                    Sign-off: {result.homeMedicationAdvice.approvedBy}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Expandable "Why this assessment?" Accordion */}
          <div className="border border-[#DDE5E9] dark:border-[#1E2D37] rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowWhyAccordion(!showWhyAccordion)}
              className="w-full p-4 bg-[#FAFBFA] dark:bg-[#16232B] flex items-center justify-between text-left text-sm font-bold text-[#14212B] dark:text-[#F1F5F9] min-h-[48px]"
            >
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[#0F766E] dark:text-[#2DD4BF]" />
                <span>Clinical Reasoning & Red Flag Factors Considered</span>
              </div>
              {showWhyAccordion ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showWhyAccordion && (
              <div className="p-5 space-y-3 text-xs sm:text-sm text-[#52616B] dark:text-[#94A3B8] border-t border-[#DDE5E9] dark:border-[#1E2D37] bg-white dark:bg-[#0F1A20]">
                {result.triggeredRuleIds && result.triggeredRuleIds.length > 0 && (
                  <div>
                    <span className="font-bold text-[#14212B] dark:text-[#F1F5F9]">Triggered Rule IDs: </span>
                    <span className="font-mono text-xs text-[#0F766E] dark:text-[#2DD4BF]">
                      {result.triggeredRuleIds.join(', ')}
                    </span>
                  </div>
                )}
                <div>
                  <span className="font-bold text-[#14212B] dark:text-[#F1F5F9]">Clinical Reasons: </span>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {result.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
                {result.whenToWorry && result.whenToWorry.length > 0 && (
                  <div>
                    <span className="font-bold text-[#14212B] dark:text-[#F1F5F9]">When to Seek Urgent Care: </span>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[#E65100]">
                      {result.whenToWorry.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Share with Family Caregivers Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={handleSendFamilyAlert}
              className="w-full sm:w-auto px-5 py-3 rounded-full border border-[#DDE5E9] dark:border-[#1E2D37] hover:bg-slate-100 dark:hover:bg-slate-800 text-[#14212B] dark:text-[#F1F5F9] font-bold text-sm flex items-center justify-center gap-2 min-h-[48px] transition-colors"
            >
              <Share2 size={16} className="text-[#0F766E] dark:text-[#2DD4BF]" />
              <span>Share Assessment with Family Members</span>
            </button>

            {familyAlertSent && (
              <div className="text-xs text-[#2E7D32] dark:text-green-400 font-bold flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle size={14} />
                <span>Sent SMS & WhatsApp alert to registered family contacts!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persistent Disclaimer Pattern */}
      <div className="text-center text-xs text-[#52616B] dark:text-[#94A3B8] space-y-1">
        <p className="font-medium">
          Granpocket is not a diagnosis or medical advice. In an emergency, call 995.
        </p>
      </div>
    </div>
  );
};
