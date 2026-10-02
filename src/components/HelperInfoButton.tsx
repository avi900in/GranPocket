import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Info } from 'lucide-react';

interface HelperInfoButtonProps {
  title?: string;
  content: React.ReactNode | string;
  placement?: 'bottom' | 'top' | 'right' | 'left';
  align?: 'start' | 'end';
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

export const HelperInfoButton: React.FC<HelperInfoButtonProps> = ({
  title,
  content,
  placement = 'bottom',
  align = 'start',
  className = '',
  size = 'sm'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  const buttonSize = size === 'xs' ? 'w-4 h-4 text-[10px]' : size === 'md' ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-[11px]';

  return (
    <div className={`relative inline-flex items-center align-middle ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`${buttonSize} rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-teal-50 hover:border-teal-500 hover:text-teal-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:border-teal-400 text-slate-500 dark:text-slate-400 font-bold inline-flex items-center justify-center transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer`}
        title="Click for helper details"
        aria-label={title || "Helper info"}
      >
        ?
      </button>

      {isOpen && (
        <div 
          className={`absolute z-50 w-80 sm:w-96 p-4 rounded-2xl bg-white dark:bg-[#0E1720] border border-slate-200 dark:border-slate-800 shadow-2xl text-left animate-fadeIn ${
            placement === 'top' 
              ? `bottom-full mb-2 ${align === 'end' ? 'right-0' : 'left-0'}` 
              : placement === 'right'
              ? 'left-full ml-2 top-1/2 -translate-y-1/2'
              : placement === 'left'
              ? 'right-full mr-2 top-1/2 -translate-y-1/2'
              : `top-full mt-2 ${align === 'end' ? 'right-0' : 'left-0'}`
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-2">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
              <Info size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span>{title || 'Helper Guidance'}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal space-y-1.5">
            {typeof content === 'string' ? (
              <p>{content}</p>
            ) : (
              content
            )}
          </div>
        </div>
      )}
    </div>
  );
};
