import React, { useState } from 'react';
import { Home, Users, MapPin, Phone, Heart, Check, X, Sparkles, Plus, AlertCircle } from 'lucide-react';
import type { Language } from '../types';
import { lookupSingaporePostalCode } from '../engine/singaporeData';

interface CreateHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateHousehold: (data: {
    name: string;
    addressText: string;
    postalCode: string;
    caregiverName: string;
    caregiverRelationship: string;
    caregiverPhone: string;
    seedSampleData: boolean;
  }) => void;
  language: Language;
  initialPhone?: string;
}

export const CreateHouseholdModal: React.FC<CreateHouseholdModalProps> = ({
  isOpen,
  onClose,
  onCreateHousehold,
  language,
  initialPhone,
}) => {
  const [name, setName] = useState('');
  const [postalCode, setPostalCode] = useState('640456');
  const [addressText, setAddressText] = useState('Block 456 Jurong West St 41, #06-123, Singapore 640456');
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverRole, setCaregiverRole] = useState('Mother / Primary Caregiver');
  const [caregiverPhone, setCaregiverPhone] = useState(initialPhone || '9876-5432');
  const [seedSampleData, setSeedSampleData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && initialPhone) {
      setCaregiverPhone(initialPhone);
    }
  }, [isOpen, initialPhone]);

  if (!isOpen) return null;

  const handlePostalLookup = async () => {
    if (!postalCode.trim()) return;
    const cleanDigits = postalCode.trim().replace(/[^0-9]/g, '');
    if (cleanDigits.length === 6) {
      try {
        const resp = await fetch(
          `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${cleanDigits}&returnGeom=Y&getAddrDetails=Y`
        );
        if (resp.ok) {
          const json = await resp.json();
          if (json.results && json.results.length > 0) {
            setAddressText(json.results[0].ADDRESS || json.results[0].BUILDING);
            return;
          }
        }
      } catch {}
    }
    const res = lookupSingaporePostalCode(postalCode);
    if (res) {
      setAddressText(res.address);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a family or household name.');
      return;
    }
    if (!caregiverName.trim()) {
      setError('Please enter the primary caregiver or family admin name.');
      return;
    }

    setError(null);
    onCreateHousehold({
      name: name.trim(),
      addressText: addressText.trim() || `Singapore Postal Sector ${postalCode}`,
      postalCode: postalCode.trim() || '310123',
      caregiverName: caregiverName.trim(),
      caregiverRelationship: caregiverRole.trim() || 'Caregiver',
      caregiverPhone: caregiverPhone.trim() ? `+65 ${caregiverPhone.trim().replace(/^\+65\s*/, '')}` : '+65 9123-4567',
      seedSampleData,
    });
    onClose();
  };

  // Quick preset templates for rapid testing
  const applyPreset = (preset: 'lim' | 'rahman' | 'kumar') => {
    setError(null);
    const preservedPhone = initialPhone?.trim() || (caregiverPhone.trim() && !['9876-5432', '9123-8899', '9876-1122', '9555-4321'].includes(caregiverPhone.trim()) ? caregiverPhone : null);

    if (preset === 'lim') {
      setName('The Lim Family');
      setPostalCode('640456');
      setAddressText('Block 456 Jurong West St 41, #06-123, Singapore 640456');
      setCaregiverName('Marilyn Lim');
      setCaregiverRole('Mother');
      setCaregiverPhone(preservedPhone || '9123-8899');
      setSeedSampleData(true);
    } else if (preset === 'rahman') {
      setName('Rahman Household');
      setPostalCode('520123');
      setAddressText('Block 123 Tampines Street 11, #04-789, Singapore 520123');
      setCaregiverName('Nurul Rahman');
      setCaregiverRole('Eldest Daughter');
      setCaregiverPhone(preservedPhone || '9876-1122');
      setSeedSampleData(true);
    } else {
      setName('Kumar Family');
      setPostalCode('160001');
      setAddressText('Block 1 Outram Park, #09-45, Singapore 160001');
      setCaregiverName('Priya Kumar');
      setCaregiverRole('Mother & Primary Carer');
      setCaregiverPhone(preservedPhone || '9555-4321');
      setSeedSampleData(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#0F1A20] w-full max-w-xl rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-soft-lg overflow-hidden my-6 transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#E6F4F1] to-[#F5E9DA] dark:from-[#0F2D29] dark:to-[#16232B] px-6 py-5 border-b border-[#DDE5E9] dark:border-[#1E2D37] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F766E] text-white flex items-center justify-center shadow-sm">
              <Home size={20} />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#14212B] dark:text-[#F1F5F9]">
                {language === 'zh' ? '创建新家庭档案' : 'Create New Family'}
              </h2>
              <p className="text-xs text-[#52616B] dark:text-[#94A3B8]">
                {language === 'zh' ? '添加新的家庭空间，录入健康档案与新数据' : 'Setup a new household, caregiver, and clinical records'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/80 dark:bg-white/10 hover:bg-white text-[#52616B] dark:text-[#F1F5F9] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Quick presets for rapid demo testing */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#52616B] dark:text-[#94A3B8]">
              <span className="flex items-center gap-1">
                <Sparkles size={14} className="text-amber-500" />
                <span>Quick Demonstration Templates:</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('lim')}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 hover:bg-teal-100 transition-colors"
              >
                Jurong West: The Lim Family
              </button>
              <button
                type="button"
                onClick={() => applyPreset('rahman')}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors"
              >
                Tampines: Rahman Household
              </button>
              <button
                type="button"
                onClick={() => applyPreset('kumar')}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
              >
                Outram Park: Kumar Family (Fresh)
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs font-bold text-[#C62828] dark:text-red-300 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Household Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF] flex items-center gap-1.5">
              <Home size={15} />
              <span>Household Details</span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-[#14212B] dark:text-[#F1F5F9] mb-1">
                Family / Household Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., The Lim Family, Rahman Household"
                className="w-full px-3.5 py-2.5 bg-[#FAFBFA] dark:bg-[#16232B] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-xl text-sm font-semibold focus:border-[#0F766E] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#14212B] dark:text-[#F1F5F9] mb-1 flex items-center gap-1">
                  <MapPin size={13} className="text-slate-400" />
                  <span>Singapore Postal Code</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    onBlur={handlePostalLookup}
                    placeholder="e.g. 640456"
                    className="w-full px-3 py-2 bg-[#FAFBFA] dark:bg-[#16232B] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-xl text-xs font-mono font-bold focus:border-[#0F766E] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handlePostalLookup}
                    className="px-2.5 py-2 bg-[#FAFBFA] dark:bg-[#16232B] hover:bg-[#E6F4F1] dark:hover:bg-[#1E2D37] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-xl text-[11px] font-bold text-[#0F766E] dark:text-[#2DD4BF] shrink-0"
                  >
                    Lookup
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#14212B] dark:text-[#F1F5F9] mb-1">
                  Residential Street Address
                </label>
                <input
                  type="text"
                  value={addressText}
                  onChange={e => setAddressText(e.target.value)}
                  placeholder="Block 456 Jurong West St 41, #06-123"
                  className="w-full px-3.5 py-2 bg-[#FAFBFA] dark:bg-[#16232B] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-xl text-xs focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Primary Caregiver Information */}
          <div className="space-y-3 pt-2 border-t border-[#DDE5E9] dark:border-[#1E2D37]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF] flex items-center gap-1.5">
              <Users size={15} />
              <span>Primary Caregiver / Account Admin</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#14212B] dark:text-[#F1F5F9] mb-1">
                  Caregiver Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={caregiverName}
                  onChange={e => setCaregiverName(e.target.value)}
                  placeholder="e.g. Marilyn Lim"
                  className="w-full px-3.5 py-2 bg-[#FAFBFA] dark:bg-[#16232B] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-xl text-xs font-semibold focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14212B] dark:text-[#F1F5F9] mb-1">
                  Family Role
                </label>
                <input
                  type="text"
                  value={caregiverRole}
                  onChange={e => setCaregiverRole(e.target.value)}
                  placeholder="Mother / Father / Guardian / Daughter"
                  className="w-full px-3.5 py-2 bg-[#FAFBFA] dark:bg-[#16232B] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-xl text-xs font-semibold focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14212B] dark:text-[#F1F5F9] mb-1 flex items-center gap-1">
                <Phone size={13} className="text-slate-400" />
                <span>Mobile Phone (Emergency & OTP)</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 border border-[#DDE5E9] dark:border-[#1E2D37]">
                  🇸🇬 +65
                </span>
                <input
                  type="tel"
                  value={caregiverPhone}
                  onChange={e => setCaregiverPhone(e.target.value)}
                  placeholder="9876-5432"
                  className="w-full px-3.5 py-2 bg-[#FAFBFA] dark:bg-[#16232B] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-xl text-xs font-mono font-bold focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* New Data & Pre-population Options */}
          <div className="p-3.5 rounded-2xl bg-[#E6F4F1] dark:bg-[#0F766E]/20 border border-[#0F766E]/30 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={seedSampleData}
                onChange={e => setSeedSampleData(e.target.checked)}
                className="mt-0.5 rounded text-[#0F766E] focus:ring-[#0F766E] h-4 w-4"
              />
              <div>
                <span className="text-xs font-bold text-[#0F766E] dark:text-[#5EEAD4] block">
                  Seed with new sample health data (Recommended for demonstration)
                </span>
                <span className="text-[11px] text-[#52616B] dark:text-[#94A3B8] leading-tight block mt-0.5">
                  Pre-populates a child profile (Chloe with fever complaint & asthma record), an elderly grandmother (with diabetes/hypertension), and initial paracetamol dose log so you can immediately test triage, duplicate-dose warnings, and monitoring.
                </span>
              </div>
            </label>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DDE5E9] dark:border-[#1E2D37]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-xs font-bold text-[#52616B] dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#0B5C56] text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Plus size={16} />
              <span>Create Family & Switch Space</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
