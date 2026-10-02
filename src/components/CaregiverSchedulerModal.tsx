import React, { useState } from 'react';
import { 
  Clock, 
  Pill, 
  Activity, 
  Smartphone, 
  Bell, 
  CheckCircle2, 
  Zap, 
  RefreshCw, 
  X, 
  Send, 
  ShieldCheck, 
  UserCheck,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import type { Person, CheckBackPlan, MedicationLogEntry } from '../types';
import type { CaregiverAlertEntry } from '../services/dbService';
import { ScheduledJob } from '../services/schedulerService';

interface CaregiverSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: ScheduledJob[];
  alerts: CaregiverAlertEntry[];
  members: Person[];
  onTriggerSimulatedAlert: (job: ScheduledJob) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onNavigateToMedication: () => void;
  onNavigateToMonitoring: () => void;
}

export const CaregiverSchedulerModal: React.FC<CaregiverSchedulerModalProps> = ({
  isOpen,
  onClose,
  jobs,
  alerts,
  members,
  onTriggerSimulatedAlert,
  onAcknowledgeAlert,
  onNavigateToMedication,
  onNavigateToMonitoring,
}) => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'matrix' | 'history'>('jobs');
  const [testTriggerSuccess, setTestTriggerSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulate = (job: ScheduledJob) => {
    onTriggerSimulatedAlert(job);
    setTestTriggerSuccess(`Simulated alert successfully dispatched to ${job.caregiverName} via SMS & In-app!`);
    setTimeout(() => setTestTriggerSuccess(null), 4000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="caregiver-scheduler-title"
    >
      <div className="bg-white dark:bg-[#070D14] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#DDE5E9] dark:border-[#1E2D37] flex items-center justify-between bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-900/20">
              <Clock size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400 bg-teal-100/70 dark:bg-teal-950/60 px-2 py-0.5 rounded-md">
                  Automated Engine Active
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Polling: Every 30s</span>
                </span>
              </div>
              <h3 id="caregiver-scheduler-title" className="text-xl sm:text-2xl font-heading font-black text-[#14212B] dark:text-[#F1F5F9] mt-0.5">
                Caregiver Scheduler & Alert Workflow
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close scheduler"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success Banner */}
        {testTriggerSuccess && (
          <div className="px-6 py-2.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{testTriggerSuccess}</span>
          </div>
        )}

        {/* Sub-Tabs */}
        <div className="px-6 pt-3 border-b border-[#DDE5E9] dark:border-[#1E2D37] flex items-center gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'jobs'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Clock size={15} />
            <span>Active Scheduled Jobs ({jobs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserCheck size={15} />
            <span>Caregiver Routing Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Bell size={15} />
            <span>Alerts Delivery Log ({alerts.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-[#14212B] dark:text-[#F1F5F9]">
          
          {/* TAB 1: Scheduled Jobs */}
          {activeTab === 'jobs' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Real-time monitored tasks for medication doses and check-in updates.
                </span>
                <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-900/40">
                  Channels: SMS + WhatsApp + In-App Push
                </span>
              </div>

              <div className="space-y-3">
                {jobs.map(job => {
                  const isDue = job.status === 'DUE_NOW';
                  const isMed = job.type === 'MEDICINE_DUE';
                  return (
                    <div
                      key={job.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        isDue 
                          ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/20 shadow-md'
                          : 'border-slate-200 dark:border-[#1E2D37] bg-white dark:bg-[#0F1A20]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-2xl shrink-0 ${
                            isMed ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {isMed ? <Pill size={20} /> : <Activity size={20} />}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base">{job.patientAvatar}</span>
                              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                                {job.patientName}
                              </span>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isDue
                                  ? 'bg-amber-500 text-white animate-pulse'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}>
                                {isDue ? 'DUE NOW' : 'SCHEDULED'}
                              </span>
                            </div>

                            <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {job.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                              <span className="flex items-center gap-1 font-medium">
                                <Smartphone size={13} className="text-teal-600 dark:text-teal-400" />
                                <span>Designated Caregiver: <strong>{job.caregiverName}</strong> ({job.caregiverRole})</span>
                              </span>
                              <span>•</span>
                              <span className="font-mono">{job.caregiverPhone}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            onClick={() => handleSimulate(job)}
                            className="px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                            title="Trigger simulated alert now"
                          >
                            <Zap size={14} className="text-amber-600" />
                            <span>Test Alert</span>
                          </button>

                          {isMed ? (
                            <button
                              onClick={() => {
                                onClose();
                                onNavigateToMedication();
                              }}
                              className="px-3.5 py-1.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all"
                            >
                              Log Dose →
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                onClose();
                                onNavigateToMonitoring();
                              }}
                              className="px-3.5 py-1.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all"
                            >
                              Check-In →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Routing Matrix */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                The scheduler dynamically routes medicine and monitoring alerts to the verified caregiver according to RBAC §3 & CareLink relationships.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {members.map(member => {
                  const isDependent = member.systemRole === 'DEPENDENT' || member.dob.startsWith('2025') || member.dob.startsWith('1948');
                  return (
                    <div
                      key={member.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-[#1E2D37] bg-white dark:bg-[#0F1A20] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{member.avatar || '👤'}</span>
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{member.name}</h4>
                            <span className="text-xs text-slate-500">{member.relationshipLabel} • {member.systemRole}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDependent ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300'
                        }`}>
                          {isDependent ? 'Care Recipient' : 'Active Caregiver'}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-[#16232B] rounded-xl text-xs space-y-1.5 font-medium">
                        <div className="text-slate-500 dark:text-slate-400 text-[11px] uppercase font-bold">Designated Notification Path:</div>
                        {member.careLinks && member.careLinks.length > 0 ? (
                          member.careLinks.map((cl, i) => (
                            <div key={i} className="flex items-center justify-between text-slate-700 dark:text-slate-200 font-semibold">
                              <span>Caregiver ID: {cl.caregiverPersonId.replace('person-', '').toUpperCase()}</span>
                              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold">{cl.type.replace('_', ' ')}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-600 dark:text-slate-300">
                            Household Admin Notification Desk (+65 9234-5678)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Delivery History Log */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Persisted in SQLite database (`caregiver_alerts` table) with audit trail.</span>
                <span className="font-mono font-bold text-teal-600">{alerts.length} Total Dispatched</span>
              </div>

              <div className="space-y-2.5">
                {alerts.map(a => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#1E2D37] bg-white dark:bg-[#0F1A20] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{a.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900/40 font-bold">
                          {a.status}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{a.message}</p>
                      <div className="text-[11px] text-slate-400">
                        Recipient: <strong>{a.caregiverName}</strong> ({a.caregiverPhone}) • {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {a.status !== 'ACKNOWLEDGED' && (
                      <button
                        onClick={() => onAcknowledgeAlert(a.id)}
                        className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#DDE5E9] dark:border-[#1E2D37] bg-slate-50 dark:bg-[#0B1319] flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            GranPocket Scheduler Engine v2.4 • PDPA & MOH Safe Delivery Compliant
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
