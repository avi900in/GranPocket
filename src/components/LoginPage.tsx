import React, { useState, useRef, useEffect } from 'react';
import { 
  AlertOctagon, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Moon, 
  Sun,
  ChevronDown,
  UserPlus,
  LogIn,
  User,
  HeartHandshake,
  Home
} from 'lucide-react';
import type { Language, Person, Household } from '../types';
import { GranPocketLogo } from './GranPocketLogo';
import { LanguageDropdown } from './LanguageDropdown';

interface CountryOption {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
];

interface LoginPageProps {
  onLoginSuccess: (userPerson: Person) => void;
  onRegisterUser?: (newPerson: Person) => void;
  members: Person[];
  onOpenSos: () => void;
  language: Language;
  onSelectLanguage: (lang: Language) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenCreateHousehold?: () => void;
  allHouseholds?: Household[];
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onRegisterUser,
  members,
  onOpenSos,
  language,
  onSelectLanguage,
  isDarkMode = false,
  onToggleDarkMode,
  onOpenCreateHousehold,
  allHouseholds,
}) => {
  // Mode: Sign In vs Sign Up
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Form Inputs
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRY_OPTIONS[0]); // Default Singapore +65
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  const [phone, setPhone] = useState('92345678');
  const [signUpName, setSignUpName] = useState('');
  const [signUpRole, setSignUpRole] = useState('Mother / Primary Caregiver');

  // Step: phone vs otp
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('123456');
  const [consentChecked, setConsentChecked] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Demo toggle switch state (default: false as requested)
  const [demoMode, setDemoMode] = useState<boolean>(false);

  // Close country dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    if (countryDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [countryDropdownOpen]);

  // Quick preset logins for demonstration
  const handleQuickLogin = (personId: string) => {
    const user = members.find(m => m.id === personId);
    if (user) {
      onLoginSuccess(user);
    }
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'signup' && !signUpName.trim()) {
      setLoginError('Please enter your full name to create an account');
      return;
    }
    if (phone.length < 7) {
      setLoginError('Please enter a valid phone number');
      return;
    }
    setLoginError(null);
    setStep('otp');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) {
      setLoginError('Please acknowledge the PDPA consent statement to proceed.');
      return;
    }

    if (authMode === 'signup') {
      // Create new registered Person profile
      const newPerson: Person = {
        id: `person-${Date.now()}`,
        householdId: 'household-tan',
        name: signUpName.trim() || 'Caregiver User',
        dob: '1990-01-01',
        sex: 'female',
        relationshipLabel: signUpRole.trim() || 'Caregiver',
        language: language,
        hasLogin: true,
        phone: `${selectedCountry.dialCode} ${phone}`,
        systemRole: 'CAREGIVER',
        avatar: '🧕',
        medicalProfile: {
          conditions: [],
          allergies: [],
          intolerances: [],
          medications: [],
          vaccinations: [],
        },
      };

      if (onRegisterUser) {
        onRegisterUser(newPerson);
      }
      onLoginSuccess(newPerson);
      return;
    }

    // Match member by phone or default to Sarah Tan
    const matched = members.find(m => m.phone?.replace(/[^0-9]/g, '').includes(phone.slice(-8))) ||
      members.find(m => m.systemRole === 'CAREGIVER') ||
      members[0];

    onLoginSuccess(matched);
  };

  return (
    <div className="min-h-screen bg-[#FAFBFA] dark:bg-[#091014] text-[#14212B] dark:text-[#F1F5F9] flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
      {/* Top Header with Emergency SOS reachable WITHOUT login (SRS AUTH-08) - Center-aligned, single row on mobile */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-center py-2.5 px-2 sm:px-4">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 flex-nowrap shrink-0">
          {/* Demo Toggle in Header */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-[#0F1A20] px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full border border-[#DDE5E9] dark:border-[#1E2D37] shadow-xs shrink-0">
            <span className="text-[11px] sm:text-xs font-bold text-[#52616B] dark:text-[#94A3B8]">Demo</span>
            <button
              type="button"
              role="switch"
              aria-checked={demoMode}
              onClick={() => setDemoMode(!demoMode)}
              className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0F766E] ${
                demoMode ? 'bg-[#0F766E]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
              title="Toggle Demonstration Personas"
              aria-label="Toggle Demonstration Personas"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  demoMode ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Dark Mode Toggle */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="p-2 sm:p-2.5 rounded-full border border-[#DDE5E9] dark:border-[#1E2D37] bg-white dark:bg-[#0F1A20] text-[#52616B] dark:text-[#94A3B8] hover:text-[#14212B] dark:hover:text-[#F1F5F9] transition-colors min-h-[40px] min-w-[40px] sm:min-h-[48px] sm:min-w-[48px] flex items-center justify-center shrink-0"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
            </button>
          )}

          {/* Language Dropdown */}
          <LanguageDropdown
            language={language}
            onSelectLanguage={onSelectLanguage}
            className="shrink-0"
          />

          {/* Persistent Emergency 995 Button reachable without authentication */}
          <button
            onClick={onOpenSos}
            className="flex items-center gap-1 sm:gap-1.5 bg-[#C62828] hover:bg-[#B71C1C] text-white font-bold text-xs sm:text-sm px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-full shadow-md shadow-red-900/20 active:scale-95 transition-all min-h-[40px] sm:min-h-[48px] shrink-0"
            title="Emergency access without login"
            aria-label="Call emergency 995 ambulance"
          >
            <AlertOctagon size={16} className="animate-pulse" />
            <span className="hidden sm:inline">EMERGENCY:</span>
            <span>995</span>
          </button>
        </div>
      </header>

      {/* Main Login Card - Generous whitespace, calm under stress */}
      <main className="max-w-lg w-full mx-auto my-auto py-8 px-2 sm:px-4">
        <div className="bg-white dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-3xl p-6 sm:p-10 shadow-soft-lg space-y-7">
          {/* Reassuring Enlarged Logo & Exact Brand Tagline */}
          <div className="text-center space-y-3.5">
            <div className="flex justify-center pb-1">
              <GranPocketLogo size="2xl" showTagline={false} />
            </div>
            <p className="text-[14px] text-[#52616B] dark:text-[#94A3B8] max-w-sm mx-auto leading-relaxed font-medium">
              "Your pocket-sized remedy for when you're feeling under the weather"
            </p>
          </div>

          {/* One-Click Demonstration Personas - Rendered ONLY if Demo Toggle is ENABLED */}
          {demoMode && (
            <div className="bg-[#F5E9DA]/60 dark:bg-[#16232B] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-2xl p-4 space-y-3 animate-fadeIn">
              <div className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF] flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                <span>Select a Demo Persona:</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('person-sarah')}
                  className="w-full text-left p-3.5 bg-white dark:bg-[#0F1A20] hover:bg-[#E6F4F1] dark:hover:bg-[#1E2D37] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-2xl text-sm font-semibold text-[#14212B] dark:text-[#F1F5F9] flex items-center justify-between transition-all min-h-[48px] shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-1 bg-[#E6F4F1] dark:bg-[#0F766E]/20 rounded-xl">👩</span>
                    <div>
                      <div className="font-bold text-base text-[#14212B] dark:text-[#F1F5F9]">Sarah Tan</div>
                      <div className="text-xs text-[#52616B] dark:text-[#94A3B8]">Mother & Caregiver • Baby Lucas (9m) & Grandpa</div>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-[#0F766E] dark:text-[#2DD4BF]" />
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('person-david')}
                  className="w-full text-left p-3.5 bg-white dark:bg-[#0F1A20] hover:bg-[#E6F4F1] dark:hover:bg-[#1E2D37] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-2xl text-sm font-semibold text-[#14212B] dark:text-[#F1F5F9] flex items-center justify-between transition-all min-h-[48px] shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-1 bg-[#E6F4F1] dark:bg-[#0F766E]/20 rounded-xl">👨</span>
                    <div>
                      <div className="font-bold text-base text-[#14212B] dark:text-[#F1F5F9]">David Tan</div>
                      <div className="text-xs text-[#52616B] dark:text-[#94A3B8]">Household Admin • AIA HealthShield Gold Max</div>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-[#0F766E] dark:text-[#2DD4BF]" />
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('person-siti')}
                  className="w-full text-left p-3.5 bg-white dark:bg-[#0F1A20] hover:bg-[#E6F4F1] dark:hover:bg-[#1E2D37] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-2xl text-sm font-semibold text-[#14212B] dark:text-[#F1F5F9] flex items-center justify-between transition-all min-h-[48px] shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-1 bg-[#E8F5E9] dark:bg-[#2E7D32]/20 rounded-xl">🧕</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base text-[#14212B] dark:text-[#F1F5F9]">Siti Rahmah</span>
                        <span className="bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#2E7D32]/20 dark:text-[#81C784] text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Co-Caregiver
                        </span>
                      </div>
                      <div className="text-xs text-[#52616B] dark:text-[#94A3B8]">
                        Caring for Baby Lucas & Ah Boon • Melayu / English
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-[#0F766E] dark:text-[#2DD4BF]" />
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('person-evelyn')}
                  className="w-full text-left p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl text-sm font-semibold flex items-center justify-between transition-all min-h-[48px] shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-1 bg-indigo-100 dark:bg-indigo-900/60 rounded-xl">👩🏻‍⚕️</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base text-indigo-950 dark:text-indigo-200">Dr. Evelyn Lim</span>
                        <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                          App Owner
                        </span>
                      </div>
                      <div className="text-xs text-indigo-700 dark:text-indigo-300">
                        Medical Director (SMC M12849J) • Clinical Governance Console
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-indigo-600 dark:text-indigo-300" />
                </button>

                {/* Custom households if created (deduplicated by household name) */}
                {(() => {
                  if (!allHouseholds) return null;
                  const customHouseholds = allHouseholds.filter(
                    h => h.id !== 'hh-singapore-tan-01' && h.id !== 'hh-app-owner-01'
                  );
                  const seen = new Set<string>();
                  const uniqueList: Household[] = [];
                  for (const h of customHouseholds) {
                    const norm = h.name.trim().toLowerCase();
                    if (!seen.has(norm)) {
                      seen.add(norm);
                      uniqueList.push(h);
                    }
                  }
                  return uniqueList.map(h => {
                    const houseCaregiver =
                      members.find(m => m.householdId === h.id && m.systemRole === 'CAREGIVER') ||
                      members.find(m => m.householdId === h.id);
                    if (!houseCaregiver) return null;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => onLoginSuccess(houseCaregiver)}
                        className="w-full text-left p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl text-sm font-semibold flex items-center justify-between transition-all min-h-[48px] shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl p-1 bg-emerald-100 dark:bg-emerald-900/60 rounded-xl">🏡</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-base text-emerald-950 dark:text-emerald-200">{houseCaregiver.name}</span>
                              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {h.name}
                              </span>
                            </div>
                            <div className="text-xs text-emerald-700 dark:text-emerald-300">
                              {h.addresses[0]?.text || 'Custom Household'}
                            </div>
                          </div>
                        </div>
                        <ArrowRight size={18} className="text-emerald-600 dark:text-emerald-300" />
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Divider when demo is active */}
              <div className="relative flex items-center justify-center pt-2">
                <div className="border-t border-[#DDE5E9] dark:border-[#1E2D37] w-full"></div>
                <span className="bg-[#F5E9DA]/60 dark:bg-[#16232B] px-3 text-[11px] uppercase font-bold text-[#52616B] dark:text-[#94A3B8] tracking-wider">
                  Or Sign In Below
                </span>
              </div>
            </div>
          )}

          {/* Mode Switcher Pills: Sign In vs Sign Up */}
          {step === 'phone' && (
            <div className="flex bg-[#E6F4F1]/60 dark:bg-[#16232B] p-1 rounded-2xl border border-[#DDE5E9] dark:border-[#1E2D37]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setLoginError(null);
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                  authMode === 'signin'
                    ? 'bg-white dark:bg-[#0F1A20] text-[#0F766E] dark:text-[#2DD4BF] shadow-xs'
                    : 'text-[#52616B] dark:text-[#94A3B8] hover:text-[#14212B] dark:hover:text-white'
                }`}
              >
                <LogIn size={16} />
                <span>{language === 'zh' ? '登录已有账号' : 'Sign In'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setLoginError(null);
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                  authMode === 'signup'
                    ? 'bg-white dark:bg-[#0F1A20] text-[#0F766E] dark:text-[#2DD4BF] shadow-xs'
                    : 'text-[#52616B] dark:text-[#94A3B8] hover:text-[#14212B] dark:hover:text-white'
                }`}
              >
                <UserPlus size={16} />
                <span>{language === 'zh' ? '新用户注册' : 'Sign Up'}</span>
              </button>
            </div>
          )}

          {/* Phone / OTP Form */}
          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {/* Sign Up Specific Fields */}
              {authMode === 'signup' && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div>
                    <label className="text-sm font-bold text-[#14212B] dark:text-[#F1F5F9] block mb-1.5">
                      {language === 'zh' ? '您的姓名 / 称呼' : 'Your Full Name'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={signUpName}
                        onChange={e => setSignUpName(e.target.value)}
                        placeholder="e.g. Rachel Lim"
                        className="w-full p-3.5 pl-10 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] bg-white dark:bg-[#16232B] font-medium text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 text-[#14212B] dark:text-[#F1F5F9] min-h-[48px]"
                      />
                      <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#52616B] dark:text-[#94A3B8]" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-[#14212B] dark:text-[#F1F5F9] block mb-1.5">
                      {language === 'zh' ? '家庭中的角色 / 身份' : 'Role in Household'}
                    </label>
                    <select
                      value={signUpRole}
                      onChange={e => setSignUpRole(e.target.value)}
                      className="w-full p-3.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] bg-white dark:bg-[#16232B] font-medium text-sm focus:border-[#0F766E] text-[#14212B] dark:text-[#F1F5F9] min-h-[48px]"
                    >
                      <option value="Mother / Primary Caregiver">Mother / Primary Caregiver</option>
                      <option value="Father / Household Admin">Father / Household Admin</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Domestic Helper / Caregiver">Domestic Helper / Caregiver</option>
                      <option value="Family Relative">Family Relative</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Mobile Number with Country Selection Dropdown */}
              <div>
                <label className="text-sm font-bold text-[#14212B] dark:text-[#F1F5F9] block mb-1.5">
                  {language === 'zh' ? '手机号码 (SMS 验证码)' : 'Mobile Phone Number (SMS OTP)'}
                </label>
                <div className="flex items-center gap-2">
                  {/* Country Selection Dropdown */}
                  <div className="relative" ref={countryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                      className="px-3.5 py-3 bg-[#FAFBFA] dark:bg-[#16232B] hover:bg-slate-100 dark:hover:bg-slate-800 border border-[#DDE5E9] dark:border-[#1E2D37] rounded-xl text-sm font-mono font-bold text-[#14212B] dark:text-[#F1F5F9] min-h-[48px] flex items-center gap-1.5 transition-colors focus:ring-2 focus:ring-[#0F766E]/20"
                      aria-label={`Country code selected: ${selectedCountry.name} ${selectedCountry.dialCode}`}
                      aria-expanded={countryDropdownOpen}
                    >
                      <span className="text-base">{selectedCountry.flag}</span>
                      <span>{selectedCountry.dialCode}</span>
                      <ChevronDown size={14} className="text-[#52616B] dark:text-[#94A3B8]" />
                    </button>

                    {countryDropdownOpen && (
                      <div className="absolute left-0 mt-1.5 w-64 max-h-64 overflow-y-auto bg-white dark:bg-[#0F1A20] rounded-2xl shadow-soft-lg border border-[#DDE5E9] dark:border-[#1E2D37] py-2 z-50 animate-fadeIn">
                        <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#52616B] dark:text-[#94A3B8] border-b border-[#DDE5E9]/60 dark:border-[#1E2D37]">
                          Select Country Code
                        </div>
                        {COUNTRY_OPTIONS.map(country => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => {
                              setSelectedCountry(country);
                              setCountryDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs sm:text-sm hover:bg-[#FAFBFA] dark:hover:bg-[#16232B] transition-colors min-h-[40px] ${
                              selectedCountry.code === country.code
                                ? 'bg-[#E6F4F1] dark:bg-[#0F766E]/20 font-bold text-[#0F766E] dark:text-[#5EEAD4]'
                                : 'text-[#14212B] dark:text-[#F1F5F9]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{country.flag}</span>
                              <span>{country.name}</span>
                            </div>
                            <span className="font-mono text-xs text-[#52616B] dark:text-[#94A3B8]">
                              {country.dialCode}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Phone Input */}
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={selectedCountry.code === 'SG' ? '9123 4567' : 'Enter mobile number'}
                    className="flex-1 p-3.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] bg-white dark:bg-[#16232B] font-mono font-bold text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 text-[#14212B] dark:text-[#F1F5F9] min-h-[48px]"
                  />
                </div>
              </div>

              {loginError && (
                <div className="text-sm text-[#C62828] dark:text-red-400 font-semibold p-2.5 bg-[#FDECEA] dark:bg-red-950/40 rounded-xl">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-6 bg-[#0F766E] hover:bg-[#0B5C56] text-white font-bold text-base rounded-full shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 min-h-[48px]"
              >
                <span>{authMode === 'signup' ? 'Create Account & Send OTP' : 'Send 6-Digit OTP'}</span>
                <ArrowRight size={18} />
              </button>

              {/* Toggle Between Sign In & Sign Up Link */}
              <div className="text-center pt-2 border-t border-[#DDE5E9]/70 dark:border-[#1E2D37]">
                {authMode === 'signin' ? (
                  <p className="text-xs text-[#52616B] dark:text-[#94A3B8]">
                    New to GranPocket?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setLoginError(null);
                      }}
                      className="font-bold text-[#0F766E] dark:text-[#2DD4BF] hover:underline"
                    >
                      Sign up as a new user →
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-[#52616B] dark:text-[#94A3B8]">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setLoginError(null);
                      }}
                      className="font-bold text-[#0F766E] dark:text-[#2DD4BF] hover:underline"
                    >
                      Sign in with mobile number →
                    </button>
                  </p>
                )}
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5 animate-fadeIn">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[#14212B] dark:text-[#F1F5F9]">
                    Enter 6-Digit SMS Passcode
                  </label>
                  <span className="text-xs font-mono font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                    {selectedCountry.dialCode} {phone}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className="w-full text-center text-3xl font-mono font-black tracking-widest p-3.5 rounded-xl border-2 border-[#0F766E] bg-white dark:bg-[#16232B] text-[#14212B] dark:text-[#F1F5F9] min-h-[52px]"
                />
                <p className="text-xs text-[#52616B] dark:text-[#94A3B8] text-center">
                  Default OTP passcode: <span className="font-bold text-[#0F766E] dark:text-[#2DD4BF] font-mono">123456</span>
                </p>
              </div>

              {/* PDPA Consent Statement (SRS PRIV-01) */}
              <div className="flex items-start gap-3 bg-[#E6F4F1]/60 dark:bg-[#16232B] p-3.5 rounded-2xl border border-[#DDE5E9] dark:border-[#1E2D37] text-xs text-[#52616B] dark:text-[#94A3B8] leading-relaxed">
                <input
                  type="checkbox"
                  id="consent-check"
                  checked={consentChecked}
                  onChange={e => setConsentChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-[#DDE5E9]"
                />
                <label htmlFor="consent-check" className="cursor-pointer select-none">
                  I consent to GranPocket storing health profiles, triage records, and location transiently
                  for family care navigation in accordance with the Singapore PDPA.
                </label>
              </div>

              {loginError && (
                <div className="text-sm text-[#C62828] dark:text-red-400 font-semibold p-2 bg-[#FDECEA] dark:bg-red-950/40 rounded-xl">
                  {loginError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-1/3 py-3 border border-[#DDE5E9] dark:border-[#1E2D37] text-[#52616B] dark:text-[#94A3B8] font-bold text-sm rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[48px]"
                >
                  Change No.
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-[#0F766E] hover:bg-[#0B5C56] text-white font-bold text-base rounded-full shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 min-h-[48px]"
                >
                  <ShieldCheck size={18} />
                  <span>{authMode === 'signup' ? 'Complete Sign Up' : 'Verify & Enter'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Setup New Family Household Action */}
          {onOpenCreateHousehold && (
            <div className="pt-2 border-t border-[#DDE5E9] dark:border-[#1E2D37]">
              <button
                type="button"
                onClick={onOpenCreateHousehold}
                className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-700/60 bg-teal-50/50 dark:bg-teal-950/20 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-800 dark:text-teal-300 transition-all flex items-center justify-between text-left group min-h-[48px]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Home size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">
                      {language === 'zh' ? '🏡 创建新家庭档案' : '🏡 Setup New Family Household'}
                    </div>
                    <div className="text-[11px] text-[#52616B] dark:text-[#94A3B8] leading-tight">
                      {language === 'zh' ? '录入新住址、照料人与全新健康数据' : 'Custom Singapore address, caregiver & clinical data'}
                    </div>
                  </div>
                </div>
                <ArrowRight size={16} className="text-teal-600 dark:text-teal-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Persistent Disclaimer Pattern */}
      <footer className="max-w-lg w-full mx-auto text-center space-y-1.5 py-4 text-xs text-[#52616B] dark:text-[#94A3B8]">
        <p className="font-medium">
          Granpocket is not a diagnosis or medical advice. In an emergency, call 995.
        </p>
        <p className="text-[11px] opacity-75">
          Singapore PDPA Compliant • MOH Clinical Governance Aligned • SCDF 995 Ambulance Integration
        </p>
      </footer>
    </div>
  );
};
