import React from 'react';
import { Heart, PhoneCall, X, ShieldAlert, MessageCircle } from 'lucide-react';
import type { Language } from '../types';
import { getCrisisMessage } from '../engine/grandmaVoice';

interface CrisisModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const CrisisModal: React.FC<CrisisModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  if (!isOpen) return null;

  const hotlines = [
    { name: 'Samaritans of Singapore (SOS) 24h', number: '1-767', desc: 'Free, confidential 24-hour emotional support', action: 'tel:1767' },
    { name: 'SOS WhatsApp Support', number: '9151-1767', desc: 'Text-based crisis support via WhatsApp', action: 'https://wa.me/6591511767' },
    { name: 'Care Corner Helpline (Mandarin / English)', number: '1800-353-5800', desc: 'Counseling & emotional guidance', action: 'tel:18003535800' },
    { name: 'National Care Hotline', number: '1800-202-6844', desc: 'Government psychosocial support line', action: 'tel:18002026844' },
    { name: 'Emergency Ambulance / Police', number: '995 / 999', desc: 'For immediate life danger or physical injury', action: 'tel:995' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border-2 border-rose-300 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Heart size={24} className="animate-pulse" />
            <div>
              <h2 className="text-lg font-bold">
                {language === 'zh' ? '心理危机与关怀援助' : language === 'ms' ? 'Sokongan Krisis & Emosi' : 'Crisis & Mental Health Support'}
              </h2>
              <p className="text-xs text-rose-100">
                {language === 'zh' ? '你并不孤单，我们随时都在' : 'You are not alone. Kind help is available right now.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Grandma Empathetic Message */}
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs sm:text-sm text-rose-950 leading-relaxed whitespace-pre-line">
            {getCrisisMessage(language)}
          </div>

          {/* Hotlines */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {language === 'zh' ? '新加坡全天候免费援助热线' : 'Singapore 24/7 Toll-Free Support Lines'}
            </div>
            {hotlines.map((h, i) => (
              <a
                key={i}
                href={h.action}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 transition-all text-slate-800"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-900">{h.name}</div>
                  <div className="text-[11px] text-slate-500">{h.desc}</div>
                </div>
                <div className="flex items-center space-x-1.5 font-bold text-xs text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
                  <PhoneCall size={13} />
                  <span>{h.number}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            {language === 'zh' ? '返回' : 'Back to GranPocket'}
          </button>
        </div>
      </div>
    </div>
  );
};
