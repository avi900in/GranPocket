import React from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import type { Person, Language } from '../types';
import { getAgeDisplay } from '../engine/triageEngine';

interface WhoIsUnwellStepProps {
  currentUser: Person;
  members: Person[];
  onSelectSubject: (subject: Person) => void;
  onAddNewMember: () => void;
  onOpenSos?: () => void;
  language: Language;
  onRemoveAilment?: (personId: string) => void;
}

export const WhoIsUnwellStep: React.FC<WhoIsUnwellStepProps> = ({
  currentUser,
  members,
  onSelectSubject,
  onAddNewMember,
  onOpenSos,
  language,
  onRemoveAilment,
}) => {
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12
      ? (language === 'zh' ? '早上好' : language === 'ms' ? 'Selamat pagi' : 'Good morning')
      : hour < 18
      ? (language === 'zh' ? '下午好' : language === 'ms' ? 'Selamat petang' : 'Good afternoon')
      : (language === 'zh' ? '晚上好' : language === 'ms' ? 'Selamat malam' : 'Good evening');

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-8 animate-fadeIn py-2 sm:py-4 px-1 sm:px-4">
      {/* Warm Doctor's Receptionist Greeting Header */}
      <div className="bg-white dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-soft">
        <div className="space-y-1.5 sm:space-y-2">
          <h1 className="text-xl sm:text-3xl font-heading font-extrabold text-[#14212B] dark:text-[#F1F5F9] tracking-tight">
            {timeGreeting}, {currentUser.name}.
          </h1>
          <p className="text-sm sm:text-lg text-[#52616B] dark:text-[#94A3B8] leading-relaxed max-w-2xl">
            {language === 'zh'
              ? '请深呼吸，放宽心。今天是谁身体不适？点击下方选择要照看的家人，开始清晰温和的分诊。'
              : language === 'ms'
              ? 'Tarik nafas dengan tenang. Siapa yang kurang sihat hari ini? Sila pilih ahli keluarga di bawah.'
              : 'Take a steady breath. We are here with you. Who is feeling unwell today? Select a family member below to begin.'}
          </p>
        </div>
      </div>

      {/* Family Member Cards Grid - Warm Sand surface, 48px tap targets, high contrast */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#52616B] dark:text-[#94A3B8]">
            {language === 'zh' ? '选择家庭成员：' : 'Select family member to assess:'}
          </span>
          <span className="text-xs text-[#0F766E] dark:text-[#2DD4BF] font-semibold">
            {members.length} Household Members Registered
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {members.map(member => (
            <button
              key={member.id}
              onClick={() => onSelectSubject(member)}
              className="bg-white dark:bg-[#0F1A20] hover:bg-[#E6F4F1]/50 dark:hover:bg-[#16232B] border-2 border-[#DDE5E9] dark:border-[#1E2D37] hover:border-[#0F766E] dark:hover:border-[#2DD4BF] p-4 sm:p-5 rounded-2xl text-left transition-all shadow-soft hover:shadow-soft-lg group relative flex flex-col justify-between space-y-3 min-h-[110px] sm:min-h-[150px]"
              aria-label={`Select ${member.name}, ${member.relationshipLabel}, ${getAgeDisplay(member.dob, language)}`}
            >
              <div className="flex items-start justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="text-2xl sm:text-3xl p-2 sm:p-2.5 bg-[#F5E9DA] dark:bg-[#16232B] rounded-xl sm:rounded-2xl group-hover:scale-105 transition-transform shrink-0">
                    {member.avatar || '👤'}
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-[#14212B] dark:text-[#F1F5F9] text-base sm:text-lg group-hover:text-[#0F766E] dark:group-hover:text-[#2DD4BF] transition-colors">
                      {member.name}
                    </h3>
                    <div className="text-xs sm:text-sm text-[#52616B] dark:text-[#94A3B8]">
                      {member.relationshipLabel} • {getAgeDisplay(member.dob, language)}
                    </div>
                  </div>
                </div>

                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#E6F4F1] dark:bg-[#0F766E]/20 group-hover:bg-[#0F766E] text-[#0F766E] dark:text-[#5EEAD4] group-hover:text-white flex items-center justify-center transition-all shrink-0">
                  <ArrowRight size={16} />
                </div>
              </div>

              {/* Active Complaint or Conditions Pill */}
              <div className="w-full pt-2 border-t border-[#DDE5E9] dark:border-[#1E2D37] text-xs">
                {member.activeComplaint ? (
                  <div className="flex items-center justify-between gap-1.5 w-full">
                    <div className="text-[#E65100] dark:text-orange-300 bg-[#FFF1E5] dark:bg-orange-950/40 font-bold px-3 py-1 rounded-full border border-orange-200 dark:border-orange-900/40 flex items-center gap-1.5 text-[11px] sm:text-xs truncate flex-1">
                      <span>🤒</span>
                      <span className="truncate">{member.activeComplaint}</span>
                    </div>
                    {onRemoveAilment && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveAilment(member.id);
                        }}
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60 bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 transition-colors shrink-0"
                        title="Remove ongoing ailment"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                ) : member.medicalProfile.conditions.length > 0 ? (
                  <div className="text-[#52616B] dark:text-[#94A3B8] bg-[#FAFBFA] dark:bg-[#16232B] px-3 py-1 rounded-full border border-[#DDE5E9] dark:border-[#1E2D37] truncate text-[11px] sm:text-xs">
                    Conditions: {member.medicalProfile.conditions.map(c => c.name).join(', ')}
                  </div>
                ) : (
                  <div className="text-[#52616B] dark:text-[#94A3B8] italic px-1 text-[11px]">
                    No active complaint logged
                  </div>
                )}
              </div>
            </button>
          ))}

          {/* Add Member Tile */}
          <button
            onClick={onAddNewMember}
            className="border-2 border-dashed border-[#DDE5E9] dark:border-[#1E2D37] hover:border-[#0F766E] hover:bg-[#E6F4F1]/30 dark:hover:bg-[#16232B] p-4 sm:p-5 rounded-2xl text-center transition-all flex flex-col items-center justify-center space-y-1.5 sm:space-y-2 text-[#52616B] dark:text-[#94A3B8] hover:text-[#0F766E] dark:hover:text-[#2DD4BF] min-h-[110px] sm:min-h-[150px]"
            aria-label="Add new household member"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#E6F4F1] dark:bg-[#0F766E]/20 text-[#0F766E] dark:text-[#2DD4BF] flex items-center justify-center">
              <Plus size={20} />
            </div>
            <div className="font-bold text-sm sm:text-base">Add Family Member</div>
            <p className="text-[11px] sm:text-xs text-[#52616B] dark:text-[#94A3B8]">Up to 10 profiles in household</p>
          </button>
        </div>
      </div>
    </div>
  );
};
