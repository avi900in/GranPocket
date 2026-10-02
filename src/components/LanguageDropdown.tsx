import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import type { Language } from '../types';

interface LanguageDropdownProps {
  language: Language;
  onSelectLanguage: (lang: Language) => void;
  className?: string;
}

interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文', flag: '🇨🇳' },
  { code: 'ms', label: 'Malay', nativeLabel: 'Bahasa Melayu', flag: '🇲🇾' },
];

export const LanguageDropdown: React.FC<LanguageDropdownProps> = ({
  language,
  onSelectLanguage,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select language. Current language: ${currentOption.nativeLabel}`}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-[#0F1A20] hover:bg-[#FAFBFA] dark:hover:bg-[#16232B] text-[#14212B] dark:text-[#F1F5F9] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-all min-h-[40px] sm:min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30"
      >
        <Globe size={15} className="text-[#0F766E] dark:text-[#2DD4BF] shrink-0" />
        <span className="hidden md:inline font-medium">{currentOption.flag}</span>
        {/* Compact code on mobile (EN, 中, MS) */}
        <span className="sm:hidden font-bold">{currentOption.code === 'zh' ? '中文' : currentOption.code.toUpperCase()}</span>
        {/* Full label on tablet / desktop */}
        <span className="hidden sm:inline font-bold">{currentOption.nativeLabel}</span>
        <ChevronDown
          size={13}
          className={`text-[#52616B] dark:text-[#94A3B8] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-44 sm:w-48 bg-white dark:bg-[#0F1A20] rounded-2xl shadow-soft-lg border border-[#DDE5E9] dark:border-[#1E2D37] py-1.5 z-50 animate-fadeIn overflow-hidden"
        >
          <div className="px-3 py-1.5 border-b border-[#DDE5E9]/60 dark:border-[#1E2D37] text-[11px] font-bold uppercase tracking-wider text-[#52616B] dark:text-[#94A3B8]">
            Choose Language
          </div>
          {LANGUAGES.map(option => {
            const isSelected = option.code === language;
            return (
              <button
                key={option.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelectLanguage(option.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm text-left transition-colors min-h-[44px] ${
                  isSelected
                    ? 'bg-[#E6F4F1] dark:bg-[#0F766E]/20 text-[#0F766E] dark:text-[#5EEAD4] font-bold'
                    : 'text-[#14212B] dark:text-[#F1F5F9] hover:bg-[#FAFBFA] dark:hover:bg-[#16232B]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{option.flag}</span>
                  <div>
                    <div className="font-bold leading-tight">{option.nativeLabel}</div>
                    <div className="text-[11px] text-[#52616B] dark:text-[#94A3B8] font-normal">
                      {option.label}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <Check size={16} className="text-[#0F766E] dark:text-[#2DD4BF] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
