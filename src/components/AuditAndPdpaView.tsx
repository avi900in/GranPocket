import React, { useState } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  Download, 
  Trash2, 
  FileText, 
  Clock, 
  Check, 
  AlertTriangle,
  Mail,
  ExternalLink
} from 'lucide-react';
import type { AuditEvent, Household, Person, Language } from '../types';

interface AuditAndPdpaViewProps {
  auditLogs: AuditEvent[];
  household: Household;
  members: Person[];
  language: Language;
}

export const AuditAndPdpaView: React.FC<AuditAndPdpaViewProps> = ({
  auditLogs,
  household,
  members,
  language,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [deletedSuccess, setDeletedSuccess] = useState(false);

  const handleExportData = () => {
    const dataToExport = {
      exportDate: new Date().toISOString(),
      regime: 'Singapore Personal Data Protection Act (PDPA 2012)',
      household,
      members,
      auditLogs,
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GranPocket-Health-Export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleDeleteDataSimulation = () => {
    if (window.confirm('Simulate right-to-be-forgotten deletion? All temporary logs will be purged from memory.')) {
      setDeletedSuccess(true);
      setTimeout(() => setDeletedSuccess(false), 3000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
              <Lock className="text-teal-600" size={22} />
              <span>Singapore PDPA Compliance & Immutable Audit Log</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Personal Data Protection Act 2012 compliance • Purpose limitation • Right-to-access & export
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportData}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow transition-all"
            >
              <Download size={14} />
              <span>{downloadSuccess ? 'Exported JSON' : 'Export Records (JSON)'}</span>
            </button>
            <button
              onClick={handleDeleteDataSimulation}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all"
            >
              <Trash2 size={14} />
              <span>{deletedSuccess ? 'Purged' : 'Right to be Forgotten'}</span>
            </button>
          </div>
        </div>

        {/* PDPA Principles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-3.5 space-y-1">
            <div className="font-bold text-teal-900 text-xs flex items-center space-x-1.5">
              <ShieldCheck size={14} />
              <span>Data Minimisation (PRIV-09)</span>
            </div>
            <p className="text-[11px] text-teal-800">
              No NRIC/FIN numbers collected. Coarse location used only transiently during inquiries.
            </p>
          </div>

          <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-3.5 space-y-1">
            <div className="font-bold text-teal-900 text-xs flex items-center space-x-1.5">
              <Lock size={14} />
              <span>On-Device Storage (PRIV-02)</span>
            </div>
            <p className="text-[11px] text-teal-800">
              Health records, allergies, and vitals logs live encrypted on-device. Audio discarded post-STT.
            </p>
          </div>

          <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-3.5 space-y-1">
            <div className="font-bold text-teal-900 text-xs flex items-center space-x-1.5">
              <FileText size={14} />
              <span>Audit Accountability (PRIV-04)</span>
            </div>
            <p className="text-[11px] text-teal-800">
              Every triage inquiry records rule IDs and decisions for clinician retrospective audit.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
          <Clock size={16} className="text-teal-700" />
          <span>Immutable System Audit Trail ({auditLogs.length} Events)</span>
        </h3>

        <div className="space-y-2.5">
          {auditLogs.map(log => (
            <div
              key={log.id}
              className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded text-[10px]">
                    {log.action}
                  </span>
                  <span className="font-bold text-slate-900">{log.resource}</span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  Actor: <span className="font-semibold text-slate-700">{log.actor}</span>
                  {log.details ? ` • ${log.details}` : ''}
                </div>
              </div>

              <div className="text-right text-[11px] text-slate-400 font-mono">
                {new Date(log.timestamp).toLocaleString()} • v{log.version}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DPO Contact Card (SRS PRIV-07) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="font-bold text-slate-900 flex items-center space-x-1.5">
            <Mail size={14} className="text-teal-600" />
            <span>Designated Data Protection Officer (DPO)</span>
          </div>
          <p className="text-slate-500">
            For personal data inquiries, corrections, or withdrawal of consent under the Singapore PDPA:
          </p>
        </div>
        <div className="font-mono font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
          dpo@granpocket.sg • +65 6789-0123
        </div>
      </div>
    </div>
  );
};
