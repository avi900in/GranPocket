import React, { useState, useRef, useEffect } from 'react';
import { 
  AlertOctagon, 
  Users, 
  Pill, 
  Activity, 
  Building2, 
  FileCheck, 
  ShieldCheck, 
  ChevronDown,
  LogOut,
  UserCheck,
  Moon,
  Sun,
  Stethoscope,
  Home,
  Check,
  Clock,
  Bell,
  MessageSquareHeart
} from 'lucide-react';
import type { Person, Language, Household, ScreenKey } from '../types';
import { getAgeDisplay } from '../engine/triageEngine';
import { GranPocketLogo } from './GranPocketLogo';
import { LanguageDropdown } from './LanguageDropdown';

interface NavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  selectedPerson: Person;
  members: Person[];
  onSelectPerson: (person: Person) => void;
  currentUser?: Person | null;
  onLogout?: () => void;
  onOpenWhoIsUnwell?: () => void;
  language: Language;
  onSelectLanguage: (lang: Language) => void;
  onOpenSos: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  showPatientSwitcher?: boolean;
  household?: Household;
  allHouseholds?: Household[];
  onSwitchHousehold?: (householdId: string) => void;
  allowedScreens?: ScreenKey[];
  onOpenScheduler?: () => void;
  dueAlertCount?: number;
  triageMode?: 'rule-based' | 'agentic';
  onToggleTriageMode?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  selectedPerson,
  members,
  onSelectPerson,
  currentUser,
  onLogout,
  onOpenWhoIsUnwell,
  language,
  onSelectLanguage,
  onOpenSos,
  isDarkMode = false,
  onToggleDarkMode,
  showPatientSwitcher = true,
  household,
  allHouseholds,
  onSwitchHousehold,
  allowedScreens,
  onOpenScheduler,
  dueAlertCount,
  triageMode,
  onToggleTriageMode,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAppOwner = currentUser?.systemRole === 'APP_OWNER';

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const ALL_TABS: Array<{ id: ScreenKey; label: string; icon: any }> = [
    { id: 'triage', label: language === 'zh' ? '分诊评估' : language === 'ms' ? 'Penilaian Triaj' : 'Triage Assessment', icon: Stethoscope },
    { id: 'family', label: language === 'zh' ? '家庭档案' : language === 'ms' ? 'Profil Keluarga' : 'Family Profiles', icon: Users },
    { id: 'medications', label: language === 'zh' ? '用药记录' : language === 'ms' ? 'Log Ubat' : 'Medication Log', icon: Pill },
    { id: 'monitoring', label: language === 'zh' ? '随访监测' : language === 'ms' ? 'Pemantauan' : 'Monitoring', icon: Activity },
    { id: 'facilities', label: language === 'zh' ? '急诊与诊所' : language === 'ms' ? 'Hospital & Klinik' : 'Hospitals & A&E', icon: Building2 },
    { id: 'pdpa_audit', label: language === 'zh' ? '隐私与审计' : language === 'ms' ? 'Audit PDPA' : 'Audit & PDPA', icon: ShieldCheck },
    { id: 'feedback', label: language === 'zh' ? '反馈' : language === 'ms' ? 'Maklum Balas' : 'Customer Feedback', icon: MessageSquareHeart },
    { id: 'owner_admin', label: language === 'zh' ? '临床实验室' : language === 'ms' ? 'Makmal Klinikal' : 'App Owner Clinical Lab', icon: FileCheck },
    { id: 'app_workspace', label: language === 'zh' ? '应用工作区' : language === 'ms' ? 'Ruang Kerja Aplikasi' : 'App Workspace', icon: ShieldCheck },
  ];

  // Dynamically filter tabs according to database-backed allowedScreens for active login persona
  const tabs = allowedScreens && allowedScreens.length > 0
    ? ALL_TABS.filter(t => allowedScreens.includes(t.id) && !['family', 'pdpa_audit', 'feedback'].includes(t.id))
    : (isAppOwner 
        ? ALL_TABS.filter(t => ['owner_admin', 'app_workspace', 'facilities', 'pdpa_audit'].includes(t.id))
        : ALL_TABS.filter(t => ['triage'].includes(t.id))
      );

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0F1A20]/95 backdrop-blur-md border-b border-[#DDE5E9] dark:border-[#1E2D37] shadow-soft">
      {/* Top Banner: Emergency & Brand & Patient & Language */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2 sm:py-2.5">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Brand with Official Logo Component */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block">
              <GranPocketLogo size="md" showTagline={true} />
            </div>
            <div className="sm:hidden">
              <GranPocketLogo size="sm" showTagline={false} />
            </div>
          </div>

          {/* Desktop User Badge */}
          {currentUser && (
            <div className="hidden md:flex items-center gap-2">
              {isAppOwner ? (
                <div className="flex items-center gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-full font-bold shadow-sm">
                  <span className="text-base">👩🏻‍⚕️</span>
                  <span>{currentUser.name}</span>
                  <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    App Owner
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs bg-[#E6F4F1] dark:bg-[#0F766E]/20 text-[#0F766E] dark:text-[#5EEAD4] border border-[#0F766E]/20 px-3 py-1.5 rounded-full font-semibold">
                  <UserCheck size={14} />
                  <span>{currentUser.name} ({currentUser.relationshipLabel || currentUser.systemRole})</span>
                </div>
              )}
            </div>
          )}

          {/* Right actions: Dark Mode, Language, Switch to, Logout & SOS 995 Button */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">

            {/* Language Dropdown */}
            <LanguageDropdown
              language={language}
              onSelectLanguage={onSelectLanguage}
            />

            {/* Caregiver Scheduler Workflow Button */}
            {onOpenScheduler && !isAppOwner && (
              <button
                onClick={onOpenScheduler}
                className="flex items-center gap-1.5 bg-[#FAFBFA] dark:bg-[#16232B] hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-amber-300/60 dark:border-amber-700/60 text-xs font-bold transition-all min-h-[36px] sm:min-h-[42px] shadow-sm active:scale-95 shrink-0"
                title="Open Caregiver Scheduler & Alert Workflow"
                aria-label="Caregiver Scheduler"
              >
                <Clock size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="hidden sm:inline font-bold">Scheduler</span>
                {dueAlertCount !== undefined && dueAlertCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                    {dueAlertCount}
                  </span>
                )}
              </button>
            )}

            {/* Settings Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1 sm:gap-1.5 bg-[#FAFBFA] dark:bg-[#16232B] hover:bg-slate-100 dark:hover:bg-slate-800 text-[#52616B] dark:text-[#94A3B8] hover:text-[#14212B] dark:hover:text-[#F1F5F9] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-[#DDE5E9] dark:border-[#1E2D37] text-xs font-semibold transition-all min-h-[36px] sm:min-h-[42px] shadow-sm active:scale-95"
                  title="Settings"
                  aria-label="Settings Menu"
                >
                  <span className="text-base">⚙️</span>
                  <span className="hidden sm:inline font-semibold whitespace-nowrap">
                    {language === 'zh' ? '设置' : language === 'ms' ? 'Tetapan' : 'Settings'}
                  </span>
                  <ChevronDown 
                    size={13} 
                    className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} 
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#0F1A20] rounded-xl shadow-soft-lg border border-[#DDE5E9] dark:border-[#1E2D37] py-2 z-50 overflow-hidden animate-fadeIn">
                    <div className="px-3 py-1.5 border-b border-[#DDE5E9] dark:border-[#1E2D37] mb-1">
                      <span className="text-[10px] font-bold text-[#52616B] dark:text-[#94A3B8] uppercase tracking-wider">
                        Main Settings
                      </span>
                    </div>

                    <>
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            onSelectTab('family');
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-[#14212B] dark:text-[#F1F5F9] hover:bg-slate-50 dark:hover:bg-[#16232B] flex items-center gap-2"
                        >
                          <Users size={15} className="text-[#0F766E] dark:text-[#2DD4BF]" />
                          Family Profiles
                        </button>

                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            onSelectTab('pdpa_audit');
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-[#14212B] dark:text-[#F1F5F9] hover:bg-slate-50 dark:hover:bg-[#16232B] flex items-center gap-2"
                        >
                          <ShieldCheck size={15} className="text-[#0F766E] dark:text-[#2DD4BF]" />
                          Audit & PDPA
                        </button>

                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            onSelectTab('feedback');
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-[#14212B] dark:text-[#F1F5F9] hover:bg-slate-50 dark:hover:bg-[#16232B] flex items-center gap-2"
                        >
                          <MessageSquareHeart size={15} className="text-[#0F766E] dark:text-[#2DD4BF]" />
                          Customer Feedback
                        </button>

                        <div className="my-1 border-b border-[#DDE5E9] dark:border-[#1E2D37]" />
                      </>

                    {onOpenWhoIsUnwell && (
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onOpenWhoIsUnwell();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#14212B] dark:text-[#F1F5F9] hover:bg-slate-50 dark:hover:bg-[#16232B] flex items-center gap-2"
                      >
                        <UserCheck size={15} className="text-indigo-600 dark:text-indigo-400" />
                        Switch Assessing Subject
                      </button>
                    )}

                    {onToggleTriageMode && (
                      <div className="w-full text-left px-4 py-2 text-sm text-[#14212B] dark:text-[#F1F5F9] hover:bg-slate-50 dark:hover:bg-[#16232B] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Activity size={15} className="text-amber-600 dark:text-amber-400" />
                          <span>Triage Mode</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Rule-Based</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={triageMode === 'agentic'}
                            onClick={onToggleTriageMode}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                              triageMode === 'agentic' ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                triageMode === 'agentic' ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Agentic</span>
                        </div>
                      </div>
                    )}

                    {onToggleDarkMode && (
                      <button
                        onClick={onToggleDarkMode}
                        className="w-full text-left px-4 py-2 text-sm text-[#14212B] dark:text-[#F1F5F9] hover:bg-slate-50 dark:hover:bg-[#16232B] flex items-center gap-2"
                      >
                        {isDarkMode ? <Sun size={15} className="text-amber-500" /> : <Moon size={15} className="text-[#52616B]" />}
                        {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                      </button>
                    )}

                    <div className="my-1 border-b border-[#DDE5E9] dark:border-[#1E2D37]" />

                    {onLogout && (
                      <button
                        onClick={onLogout}
                        className="w-full text-left px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 font-semibold"
                      >
                        <LogOut size={15} />
                        Logout
                      </button>
                    )}
                  </div>
                )}
            </div>

            {/* Persistent EMERGENCY 995 Button (Hidden for App Owner View) */}
            {!isAppOwner && (
              <button
                onClick={onOpenSos}
                className="flex items-center gap-1 sm:gap-1.5 bg-[#C62828] hover:bg-[#B71C1C] text-white font-bold text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-full shadow-md shadow-red-900/20 active:scale-95 transition-all min-h-[36px] sm:min-h-[42px] shrink-0"
                title="Immediate emergency access"
                aria-label="Emergency ambulance 995"
              >
                <AlertOctagon size={15} className="animate-pulse shrink-0" />
                <span className="hidden xs:inline sm:inline">995 EMERGENCY</span>
                <span className="xs:hidden sm:hidden">995</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Desktop & Tablet) - Hidden for App Owner who has dedicated Command Menu */}
      {!isAppOwner && tabs.length > 0 && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 hidden md:flex items-center space-x-1.5 overflow-x-auto no-scrollbar border-t border-[#DDE5E9] dark:border-[#1E2D37] py-1.5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all min-h-[40px] ${
                  isActive
                    ? 'bg-[#0F766E] text-white shadow-sm'
                    : 'text-[#52616B] dark:text-[#94A3B8] hover:text-[#14212B] dark:hover:text-[#F1F5F9] hover:bg-[#FAFBFA] dark:hover:bg-[#16232B]'
                }`}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
