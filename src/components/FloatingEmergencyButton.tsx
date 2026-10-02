import React from 'react';
import { AlertOctagon, PhoneCall } from 'lucide-react';

interface FloatingEmergencyButtonProps {
  onClick: () => void;
  className?: string;
}

export const FloatingEmergencyButton: React.FC<FloatingEmergencyButtonProps> = ({
  onClick,
  className = '',
}) => {
  return (
    <div
      className={`hidden md:block fixed bottom-6 right-6 z-40 ${className}`}
      role="region"
      aria-label="Emergency Assistance"
    >
      <button
        onClick={onClick}
        type="button"
        aria-label="Emergency 995. One-tap emergency ambulance assistance."
        className="group flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-[#C62828] hover:bg-[#B71C1C] text-white font-bold text-base shadow-xl shadow-red-900/30 active:scale-95 transition-all duration-200 border-2 border-white/30 focus:outline-none focus:ring-4 focus:ring-red-400 min-h-[48px] min-w-[48px]"
      >
        <span className="relative flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
        </span>
        <AlertOctagon className="w-5 h-5 text-white" strokeWidth={2.2} aria-hidden="true" />
        <span className="tracking-wide">Emergency 995</span>
        <span className="hidden sm:inline-flex items-center justify-center bg-white/20 text-xs px-2 py-0.5 rounded-full font-semibold">
          Ambulance
        </span>
      </button>
    </div>
  );
};
