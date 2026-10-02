import React, { useState } from 'react';
import { 
  PhoneCall, 
  X, 
  MapPin, 
  Building2, 
  AlertOctagon, 
  HeartHandshake, 
  Copy, 
  Check, 
  ShieldAlert,
  FileText
} from 'lucide-react';
import type { Person, Address, EmergencyContact, Language } from '../types';
import { findNearestFacilities } from '../engine/singaporeData';
import { getAgeDisplay } from '../engine/triageEngine';

interface EmergencySosModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person;
  address: Address;
  emergencyContacts: EmergencyContact[];
  language: Language;
}

export const EmergencySosModal: React.FC<EmergencySosModalProps> = ({
  isOpen,
  onClose,
  person,
  address,
  emergencyContacts,
  language,
}) => {
  const [copied, setCopied] = useState(false);
  const [showParamedicCard, setShowParamedicCard] = useState(false);
  const [callInitiated, setCallInitiated] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPediatric = new Date().getFullYear() - new Date(person.dob).getFullYear() < 16;
  const nearestHospitals = findNearestFacilities(address.lat, address.lng, {
    edOnly: true,
    pediatricOnly: isPediatric,
  });
  const topHospital = nearestHospitals[0];

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulateCall = (number: string, label: string) => {
    setCallInitiated(`${label} (${number})`);
    setTimeout(() => setCallInitiated(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border-4 border-red-500 overflow-hidden">
        {/* Urgent Header */}
        <div className="bg-red-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <AlertOctagon size={26} className="animate-bounce" />
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                {language === 'zh' ? '紧急求助 (995 呼叫)' : language === 'ms' ? 'Kecemasan (Hubungi 995)' : 'EMERGENCY: Call 995'}
              </h2>
              <p className="text-xs text-red-100">
                {language === 'zh' ? '新加坡民防部队救护车直拨通道' : 'SCDF Singapore Emergency Ambulance Dispatch'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Call feedback notification */}
          {callInitiated && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-pulse">
              <PhoneCall size={16} />
              <span>Simulating telephone dial: Connecting to {callInitiated}...</span>
            </div>
          )}

          {/* Primary Action: Direct Dial 995 */}
          <div className="text-center space-y-2">
            <a
              href="tel:995"
              onClick={() => handleSimulateCall('995', 'SCDF Emergency Ambulance')}
              className="w-full flex items-center justify-center space-x-3 bg-red-600 hover:bg-red-700 active:scale-98 text-white font-extrabold text-xl sm:text-2xl py-4 px-6 rounded-2xl shadow-lg shadow-red-500/40 transition-all cursor-pointer"
            >
              <PhoneCall size={28} className="animate-pulse" />
              <span>CALL 995 NOW</span>
            </a>
            <p className="text-[11px] text-slate-500">
              {language === 'zh' ? '救护车将立即调派最近的急救团队。切勿自行驾车。' : 'Free emergency ambulance service for life-threatening conditions.'}
            </p>
          </div>

          {/* Read aloud to operator box (SRS ESC-01, FAM-01) */}
          <div className="bg-amber-50/80 border-2 border-amber-300 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
              <span className="flex items-center space-x-1.5">
                <MapPin size={15} className="text-amber-700" />
                <span>
                  {language === 'zh' ? '请念出此地址给 995 接线员：' : language === 'ms' ? 'Bacakan alamat ini kepada operator 995:' : 'Read this home address to the 995 operator:'}
                </span>
              </span>
              <button
                onClick={handleCopyAddress}
                className="text-amber-700 hover:text-amber-900 flex items-center space-x-1 text-[11px]"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="font-mono font-bold text-sm sm:text-base text-slate-900 bg-white p-2.5 rounded-lg border border-amber-200">
              {address.text}
            </p>
            <p className="text-[11px] text-amber-800">
              Postal Code: <span className="font-bold">{address.postalCode}</span> • Subject: <span className="font-bold">{person.name}</span> ({getAgeDisplay(person.dob, language)})
            </p>
          </div>

          {/* Nearest Hospital Highlight */}
          {topHospital && (
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase flex items-center space-x-1">
                  <Building2 size={13} />
                  <span>{isPediatric ? "Nearest Pediatric Emergency" : "Nearest A&E Hospital"}</span>
                </div>
                <div className="font-bold text-slate-900 text-sm">{topHospital.name}</div>
                <div className="text-xs text-slate-600">
                  {topHospital.distance} km away • Est. {topHospital.eta}
                </div>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(topHospital.name + ' ' + topHospital.address)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm"
              >
                Directions
              </a>
            </div>
          )}

          {/* Speed Dial Emergency Contacts */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
              <HeartHandshake size={14} className="text-rose-600" />
              <span>{language === 'zh' ? '一键呼叫紧急联系人' : 'Call Family / Emergency Contacts'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {emergencyContacts.slice(0, 2).map(contact => (
                <button
                  key={contact.id}
                  onClick={() => handleSimulateCall(contact.phone, contact.name)}
                  className="flex items-center justify-between bg-white hover:bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-left transition-all"
                >
                  <div>
                    <div className="font-semibold text-xs text-slate-900">{contact.name}</div>
                    <div className="text-[11px] text-slate-500">{contact.relationship}</div>
                  </div>
                  <span className="flex items-center space-x-1 text-xs font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-lg">
                    <PhoneCall size={12} />
                    <span>{contact.phone}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Paramedic Emergency Info Card Toggle (SRS ESC-01h) */}
          <div className="border-t border-slate-200 pt-3">
            <button
              onClick={() => setShowParamedicCard(!showParamedicCard)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
            >
              <span className="flex items-center space-x-1.5">
                <FileText size={14} className="text-teal-700" />
                <span>
                  {showParamedicCard ? 'Hide Paramedic Info Card' : 'Show Paramedic Info Card for SCDF'}
                </span>
              </span>
              <span className="text-[11px] text-teal-700 underline">
                {showParamedicCard ? 'Close' : 'View summary'}
              </span>
            </button>

            {showParamedicCard && (
              <div className="mt-2.5 p-3.5 bg-slate-900 text-white rounded-xl text-xs space-y-2 animate-fadeIn font-mono">
                <div className="border-b border-slate-700 pb-1 flex justify-between items-center text-red-400 font-bold">
                  <span>PARAMEDIC EMERGENCY CARD</span>
                  <span>{person.medicalProfile.bloodType ? `Blood: ${person.medicalProfile.bloodType}` : ''}</span>
                </div>
                <div>
                  <span className="text-slate-400">Patient: </span>
                  <span className="font-bold">{person.name}</span>, {getAgeDisplay(person.dob, language)} ({person.sex})
                </div>
                <div>
                  <span className="text-slate-400">Allergies: </span>
                  <span className="text-red-300 font-bold">
                    {person.medicalProfile.allergies.length > 0
                      ? person.medicalProfile.allergies.map(a => `${a.name} (${a.severity})`).join(', ')
                      : 'None known'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Pre-existing: </span>
                  <span>
                    {person.medicalProfile.conditions.length > 0
                      ? person.medicalProfile.conditions.map(c => c.name).join(', ')
                      : 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Current Medications: </span>
                  <span>
                    {person.medicalProfile.medications.length > 0
                      ? person.medicalProfile.medications.map(m => `${m.name} [${m.dose}]`).join(', ')
                      : 'None logged'}
                  </span>
                </div>
                {person.insurance && (
                  <div>
                    <span className="text-slate-400">Insurance: </span>
                    <span>{person.insurance.provider} - Policy #{person.insurance.policyId}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
          >
            {language === 'zh' ? '关闭' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
};
