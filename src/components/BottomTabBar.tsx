import React, { useState } from 'react';
import { 
  Home, 
  Stethoscope, 
  Users, 
  Pill, 
  MoreHorizontal, 
  Activity, 
  Building2, 
  FileCheck, 
  ShieldCheck, 
  X,
  Clock,
  MessageSquareHeart
} from 'lucide-react';
import type { Person, Language, ScreenKey } from '../types';

interface BottomTabBarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  language: Language;
  currentUser?: Person | null;
  onOpenWhoIsUnwell?: () => void;
  allowedScreens?: ScreenKey[];
  onOpenScheduler?: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onSelectTab,
  language,
  currentUser,
  onOpenWhoIsUnwell,
  allowedScreens,
  onOpenScheduler,
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const isAppOwner = currentUser?.systemRole === 'APP_OWNER';

  const appOwnerMainTabs = [
    {
      id: 'owner_admin',
      label: language === 'zh' ? '管理工作台' : language === 'ms' ? 'Portal' : 'Owner Portal',
      icon: ShieldCheck,
      action: () => {
        setMoreMenuOpen(false);
        onSelectTab('owner_admin');
      },
      isActive: activeTab === 'owner_admin',
    },
    {
      id: 'clinical_kb',
      label: language === 'zh' ? '临床审核' : language === 'ms' ? 'Klinikal' : 'Review',
      icon: FileCheck,
      action: () => {
        setMoreMenuOpen(false);
        onSelectTab('clinical_kb');
      },
      isActive: activeTab === 'clinical_kb',
    },
    {
      id: 'facilities',
      label: language === 'zh' ? '急诊与诊所' : language === 'ms' ? 'Hospital' : 'Hospitals',
      icon: Building2,
      action: () => {
        setMoreMenuOpen(false);
        onSelectTab('facilities');
      },
      isActive: activeTab === 'facilities',
    },
    {
      id: 'pdpa_audit',
      label: language === 'zh' ? '审计与隐私' : language === 'ms' ? 'Audit' : 'Audit/PDPA',
      icon: ShieldCheck,
      action: () => {
        setMoreMenuOpen(false);
        onSelectTab('pdpa_audit');
      },
      isActive: activeTab === 'pdpa_audit',
    },
  ];

  const standardMainTabs = [
    {
      id: 'home',
      label: language === 'zh' ? '首页' : language === 'ms' ? 'Utama' : 'Home',
      icon: Home,
      action: () => {
        setMoreMenuOpen(false);
        if (onOpenWhoIsUnwell) {
          onOpenWhoIsUnwell();
        } else {
          onSelectTab('triage');
        }
      },
      isActive: false,
    },
    {
      id: 'triage',
      label: language === 'zh' ? '分诊检查' : language === 'ms' ? 'Periksa' : 'Check',
      icon: Stethoscope,
      action: () => {
        setMoreMenuOpen(false);
        onSelectTab('triage');
      },
      isActive: activeTab === 'triage',
    },
    {
      id: 'family',
      label: language === 'zh' ? '家庭成员' : language === 'ms' ? 'Keluarga' : 'Family',
      icon: Users,
      action: () => {
        setMoreMenuOpen(false);
        onSelectTab('family');
      },
      isActive: activeTab === 'family',
    },
    {
      id: 'medications',
      label: language === 'zh' ? '用药记录' : language === 'ms' ? 'Ubat' : 'Medicines',
      icon: Pill,
      action: () => {
        setMoreMenuOpen(false);
        onSelectTab('medications');
      },
      isActive: activeTab === 'medications',
    },
    {
      id: 'more',
      label: language === 'zh' ? '更多' : language === 'ms' ? 'Lagi' : 'More',
      icon: MoreHorizontal,
      action: () => setMoreMenuOpen(!moreMenuOpen),
      isActive: ['monitoring', 'facilities', 'clinical_kb', 'pdpa_audit'].includes(activeTab) || moreMenuOpen,
    },
  ];

  const baseMainTabs = isAppOwner ? appOwnerMainTabs : standardMainTabs;
  const mainTabs = allowedScreens && allowedScreens.length > 0
    ? baseMainTabs.filter(t => t.id === 'home' || t.id === 'more' || allowedScreens.includes(t.id as ScreenKey))
    : baseMainTabs;

  const allMoreItems = [
    {
      id: 'monitoring',
      label: language === 'zh' ? '随访监测' : language === 'ms' ? 'Pemantauan' : 'Health Monitoring',
      sub: 'Vital sign alerts & symptom tracking',
      icon: Activity,
    },
    {
      id: 'facilities',
      label: language === 'zh' ? '急诊与诊所' : language === 'ms' ? 'Hospital & Klinik' : 'Hospitals & A&E',
      sub: 'Real-time wait times & GPS',
      icon: Building2,
    },
    {
      id: 'clinical_kb',
      label: language === 'zh' ? '临床知识审核' : language === 'ms' ? 'Semakan Klinikal' : 'Clinical Governance',
      sub: 'Protocols & Medical Officer sign-off',
      icon: FileCheck,
    },
    {
      id: 'pdpa_audit',
      label: language === 'zh' ? '隐私与审计' : language === 'ms' ? 'Audit PDPA' : 'Audit & PDPA Privacy',
      sub: 'Immutable trail & consent logs',
      icon: ShieldCheck,
    },
    {
      id: 'feedback',
      label: language === 'zh' ? '反馈' : language === 'ms' ? 'Maklum Balas' : 'Customer Feedback',
      sub: 'Share your experience',
      icon: MessageSquareHeart,
    },
    {
      id: 'schedules',
      label: language === 'zh' ? '日程表' : language === 'ms' ? 'Jadual' : 'Schedules',
      sub: 'View caregiver alerts',
      icon: Clock,
      action: () => {
         if (onOpenScheduler) onOpenScheduler();
      }
    },
  ];

  const moreItems = allowedScreens && allowedScreens.length > 0
    ? allMoreItems.filter(item => item.id === 'schedules' || allowedScreens.includes(item.id as ScreenKey))
    : allMoreItems.filter(item => isAppOwner ? true : item.id !== 'clinical_kb');

  return (
    <>
      {/* "More" Bottom Sheet Overlay */}
      {moreMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity flex flex-col justify-end md:hidden"
          onClick={() => setMoreMenuOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#0F1A20] rounded-t-3xl border-t border-[#DDE5E9] dark:border-[#1E2D37] p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#DDE5E9] dark:border-[#1E2D37]">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-lg text-[#14212B] dark:text-[#F1F5F9]">
                  {language === 'zh' ? '更多服务与功能' : 'More Services'}
                </span>
              </div>
              <button 
                onClick={() => setMoreMenuOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {moreItems.map(item => {
                const Icon = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if ((item as any).action) {
                         (item as any).action();
                      } else {
                         onSelectTab(item.id);
                      }
                      setMoreMenuOpen(false);
                    }}
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all min-h-[52px] ${
                      isSelected
                        ? 'bg-[#0F766E] text-white shadow-md'
                        : 'bg-[#FAFBFA] dark:bg-[#16232B] hover:bg-[#E6F4F1] dark:hover:bg-[#1E2D37] text-[#14212B] dark:text-[#F1F5F9] border border-[#DDE5E9]/70 dark:border-[#1E2D37]'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-white/20 text-white' : 'bg-[#E6F4F1] dark:bg-[#0F766E]/20 text-[#0F766E] dark:text-[#2DD4BF]'}`}>
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{item.label}</div>
                      <div className={`text-xs ${isSelected ? 'text-white/80' : 'text-[#52616B] dark:text-[#94A3B8]'}`}>
                        {item.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Tab Bar (Mobile / Compact) */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#0F1A20]/95 backdrop-blur-md border-t border-[#DDE5E9] dark:border-[#1E2D37] px-2 py-1.5 shadow-lg safe-area-bottom"
        aria-label="Bottom Navigation"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {mainTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={tab.action}
                aria-label={tab.label}
                className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl min-h-[48px] min-w-[56px] transition-all ${
                  tab.isActive
                    ? 'text-[#0F766E] dark:text-[#2DD4BF] font-bold'
                    : 'text-[#52616B] dark:text-[#94A3B8] hover:text-[#14212B] dark:hover:text-[#F1F5F9]'
                }`}
              >
                <div className={`p-1 rounded-xl transition-transform ${tab.isActive ? 'scale-110 bg-[#E6F4F1] dark:bg-[#0F766E]/20' : ''}`}>
                  <Icon size={20} strokeWidth={tab.isActive ? 2.5 : 2} />
                </div>
                <span className="text-[11px] leading-none tracking-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
