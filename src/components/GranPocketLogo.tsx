import React from 'react';

interface GranPocketLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  showTagline?: boolean;
  className?: string;
}

export const GranPocketLogo: React.FC<GranPocketLogoProps> = ({
  size = 'md',
  showText = true,
  showTagline = false,
  className = '',
}) => {
  const sizeMap = {
    sm: {
      img: 'w-8 h-8',
      text: 'text-lg',
      sub: 'text-[11px]',
    },
    md: {
      img: 'w-10 h-10',
      text: 'text-xl',
      sub: 'text-xs',
    },
    lg: {
      img: 'w-14 h-14',
      text: 'text-2xl',
      sub: 'text-sm',
    },
    xl: {
      img: 'w-20 h-20',
      text: 'text-3xl',
      sub: 'text-base',
    },
    '2xl': {
      img: 'w-24 h-24 sm:w-28 sm:h-28',
      text: 'text-3xl sm:text-4xl',
      sub: 'text-[14px]',
    },
  };

  const { img, text, sub } = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`} aria-label="GranPocket">
      {/* Visual Logo Emblem */}
      <div className={`relative flex items-center justify-center shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-[#E6F4F1] to-[#F5E9DA] dark:from-[#0F1A20] dark:to-[#16232B] p-1 shadow-sm border border-[#DDE5E9]/60 dark:border-[#1E2D37] ${img}`}>
        <img
          src="/granpocket-logo.png"
          alt="GranPocket Heart and Shield Logo"
          className="w-full h-full object-contain filter drop-shadow-sm transition-transform duration-300 hover:scale-105"
          onError={(e) => {
            // Fallback graceful SVG if image path ever fails
            const target = e.currentTarget;
            target.style.display = 'none';
            if (target.parentElement) {
              target.parentElement.innerHTML = `
                <svg viewBox="0 0 40 40" class="w-full h-full text-[#0F766E]" fill="currentColor">
                  <path d="M20 36s-14-8.8-14-20a8 8 0 0 1 14-5.3A8 8 0 0 1 34 16c0 11.2-14 20-14 20z" fill="#0F766E"/>
                  <path d="M20 28s-9-5.7-9-13a5.1 5.1 0 0 1 9-3.4A5.1 5.1 0 0 1 29 15c0 7.3-9 13-9 13z" fill="#F28C6B"/>
                </svg>
              `;
            }
          }}
        />
      </div>

      {/* Brand Wordmark */}
      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center leading-tight">
            <span className={`font-black font-heading tracking-tight text-[#14212B] dark:text-[#F1F5F9] ${text}`}>
              Gran<span className="text-[#0F766E] dark:text-[#2DD4BF]">Pocket</span>
            </span>
          </div>
          {showTagline && (
            <span className={`font-medium text-[#52616B] dark:text-[#94A3B8] leading-tight ${sub}`}>
              Your pocket-sized remedy for when you're feeling under the weather
            </span>
          )}
        </div>
      )}
    </div>
  );
};
