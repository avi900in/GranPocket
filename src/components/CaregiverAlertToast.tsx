import React from 'react';
import { 
  Bell, 
  Clock, 
  Pill, 
  Activity, 
  Check, 
  X, 
  ChevronRight, 
  Smartphone, 
  Send,
  AlertTriangle,
  Volume2
} from 'lucide-react';
import type { CaregiverAlertEntry } from '../services/dbService';

interface CaregiverAlertToastProps {
  alert: CaregiverAlertEntry | null;
  onDismiss: () => void;
  onSnooze: (alertId: string) => void;
  onActionClick: (alert: CaregiverAlertEntry) => void;
  onOpenSchedulerModal: () => void;
}

export const CaregiverAlertToast: React.FC<CaregiverAlertToastProps> = ({
  alert,
  onDismiss,
  onSnooze,
  onActionClick,
  onOpenSchedulerModal,
}) => {
  if (!alert) return null;

  const isMedicine = alert.type === 'MEDICINE_DUE';

  return (
    <aside 
      aria-label="Caregiver Health Notification"
      className="fixed top-20 right-3 sm:right-6 z-50 max-w-lg w-[calc(100vw-24px)] animate-slideDown shadow-2xl rounded-3xl border-2 border-amber-500/60 bg-white/95 dark:bg-[#070D14]/95 backdrop-blur-xl p-4 sm:p-5 text-[#14212B] dark:text-[#F1F5F9] transition-all"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse">
            {isMedicine ? <Pill size={18} /> : <Activity size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Automated Caregiver Alert</span>
            </div>
            <h4 className="text-sm font-black leading-tight mt-0.5">{alert.title}</h4>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Dismiss alert"
          aria-label="Dismiss alert"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="py-3 space-y-2 text-xs sm:text-sm">
        <p className="font-medium text-slate-800 dark:text-slate-200 leading-snug">
          {alert.message}
        </p>

        {/* Caregiver Routing Details */}
        <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200">
            <Smartphone size={14} className="text-amber-600 dark:text-amber-400" />
            <span>Alert routed to: <strong>{alert.caregiverName}</strong> ({alert.caregiverRole})</span>
          </div>
          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
            {alert.caregiverPhone || '+65 9234-5678'} • SMS & WhatsApp
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800/80">
        <button
          onClick={onOpenSchedulerModal}
          className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
        >
          <span>Scheduler Details</span>
          <ChevronRight size={13} />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSnooze(alert.id)}
            className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[36px]"
          >
            Snooze 15m
          </button>

          <button
            onClick={() => onActionClick(alert)}
            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-black text-xs shadow-md shadow-amber-900/20 active:scale-95 transition-all flex items-center gap-1.5 min-h-[36px]"
          >
            <Check size={14} />
            <span>{isMedicine ? 'Log Medicine Now' : 'Fill Monitoring Update'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
