import React, { useState } from 'react';
import { 
  FileCheck, 
  ShieldCheck, 
  AlertTriangle, 
  ExternalLink, 
  Check, 
  X, 
  Sparkles, 
  Lock, 
  Sliders, 
  UserCheck,
  FileDiff,
  Filter,
  Loader2,
  CheckCircle2,
  Clock,
  Cpu,
  Shield,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  Brain,
  Binary,
  Database,
  FileText,
  Quote,
  Pill,
  RotateCcw
} from 'lucide-react';
import type { KBChangeProposal, Language, ContentStatus, HomeMedicationSuggestion } from '../types';
import { 
  fetchGuardrailsFromDb, 
  updateGuardrailsInDb, 
  fetchHomeMedicationsFromDb, 
  approveHomeMedicationInDb, 
  moveHomeMedicationToPendingInDb,
  deleteHomeMedicationInDb 
} from '../services/dbService';

interface ClinicalKbConsoleViewProps {
  proposals: KBChangeProposal[];
  onApproveProposal: (proposalId: string, doctorName: string, mcr: string) => void;
  onDeleteProposal: (proposalId: string) => void;
  onMoveToPendingProposal?: (proposalId: string) => void;
  onRefreshProposals?: () => Promise<void> | void;
  environmentMode: 'mvp' | 'production';
  onToggleEnvironmentMode: (mode: 'mvp' | 'production') => void;
  language: Language;
}

type FilterCategory = 'all' | 'infant' | 'senior' | 'cpg' | 'pending' | 'approved' | 'non_conforming';

export const ClinicalKbConsoleView: React.FC<ClinicalKbConsoleViewProps> = ({
  proposals,
  onApproveProposal,
  onDeleteProposal,
  onMoveToPendingProposal,
  onRefreshProposals,
  environmentMode,
  onToggleEnvironmentMode,
  language,
}) => {
  const [selectedProposalId, setSelectedProposalId] = useState<string>(proposals[0]?.id || '');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [showGuardrailConfig, setShowGuardrailConfig] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState<boolean>(false);

  // Clinical Guardrail state (Spec §6)
  const [confidenceFloor, setConfidenceFloor] = useState<number>(80);
  const [allergyHardStop, setAllergyHardStop] = useState<boolean>(true);
  const [ageHardStop, setAgeHardStop] = useState<boolean>(true);
  const [stalenessWindowDays, setStalenessWindowDays] = useState<number>(90);
  const [maxRetryCount, setMaxRetryCount] = useState<number>(2);

  // Home Medications state (@home_medication_agent)
  const [activeConsoleTab, setActiveConsoleTab] = useState<'rules' | 'medications'>('rules');
  const [homeMedications, setHomeMedications] = useState<HomeMedicationSuggestion[]>([]);
  const [selectedMedId, setSelectedMedId] = useState<string>('');
  const [showMedSignOffModal, setShowMedSignOffModal] = useState<boolean>(false);

  // Load active clinical guardrails and home medications from SQLite database
  React.useEffect(() => {
    fetchGuardrailsFromDb().then(cfg => {
      if (cfg) {
        setConfidenceFloor(cfg.confidenceFloorPercent);
        setAllergyHardStop(cfg.enableAllergyHardStop);
        setAgeHardStop(cfg.enableAgeHardStop);
        setStalenessWindowDays(cfg.freshnessWindowDays);
        setMaxRetryCount(cfg.maxChallengeRetries);
      }
    });
    fetchHomeMedicationsFromDb().then(meds => {
      setHomeMedications(meds);
      if (meds.length > 0 && !selectedMedId) {
        setSelectedMedId(meds[0].id);
      }
    });
  }, []);

  // Filter proposals
  const filteredProposals = proposals.filter(p => {
    const isApp = p.status?.toLowerCase() === 'approved';
    if (activeFilter === 'pending') return !isApp;
    if (activeFilter === 'approved') return isApp;
    if (activeFilter === 'infant') return p.ageBand === 'infant' || p.id.includes('inf');
    if (activeFilter === 'senior') return p.ageBand === 'senior' || p.id.includes('snr');
    if (activeFilter === 'non_conforming') return Boolean(p.requiresClinicianReview);
    if (activeFilter === 'cpg') return p.id.startsWith('kb-prop-2026');
    return true;
  });

  const activeProposal = proposals.find(p => p.id === selectedProposalId) || filteredProposals[0] || proposals[0];

  // Doctor Sign-off modal state
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [doctorName, setDoctorName] = useState('Dr. Evelyn Lim');
  const [mcrNumber, setMcrNumber] = useState('M12849J');
  const [clinicalNotes, setClinicalNotes] = useState('Approved based on MOH Singapore 2026 pediatric and geriatric emergency clinical guidelines.');

  const handleSignOff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProposal) return;
    onApproveProposal(activeProposal.id, doctorName, mcrNumber);
    setShowSignOffModal(false);
  };

  const activeHomeMed = homeMedications.find(m => m.id === selectedMedId) || homeMedications[0];

  const handleApproveHomeMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHomeMed) return;
    const ok = await approveHomeMedicationInDb(activeHomeMed.id, doctorName, mcrNumber);
    if (ok) {
      setHomeMedications(prev => prev.map(m => m.id === activeHomeMed.id ? { ...m, status: 'approved', reviewedBy: doctorName, mcrNumber } : m));
      setShowMedSignOffModal(false);
    }
  };

  const handleDeleteHomeMed = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this home medication protocol?')) {
      const ok = await deleteHomeMedicationInDb(id);
      if (ok) {
        setHomeMedications(prev => prev.filter(m => m.id !== id));
      }
    }
  };

  const infantCount = proposals.filter(p => p.ageBand === 'infant' || p.id.includes('inf')).length;
  const seniorCount = proposals.filter(p => p.ageBand === 'senior' || p.id.includes('snr')).length;
  const nonConformingCount = proposals.filter(p => p.requiresClinicianReview).length;
  const pendingCount = proposals.filter(p => p.status?.toLowerCase() !== 'approved').length;
  const approvedCount = proposals.filter(p => p.status?.toLowerCase() === 'approved').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Console Header & Environment Release Gate */}
      <div className="bg-white dark:bg-[#14212B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300">
                Tier 4 Optimization & Governance
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
                Spec §3 Deterministic Net
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                <Database size={11} className="text-emerald-600 dark:text-emerald-400" />
                <span>SQLite DB: data/chat.db</span>
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center space-x-2 mt-1">
              <FileCheck className="text-teal-600 dark:text-teal-400" size={24} />
              <span>Override Rule Harvesting and Governance</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Deterministic red-flag safety net review • AI Rule Harvesting (@decipher_agent & @ml_agent) • SMC Clinician sign-off gate
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGuardrailConfig(!showGuardrailConfig)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                showGuardrailConfig 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950 dark:border-indigo-700 dark:text-indigo-200' 
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
              }`}
            >
              <Sliders size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>Guardrails Config</span>
              {showGuardrailConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Environment Release Gate Toggle (SRS CLIN-03) */}
            <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-right">
                <div className="text-xs font-black text-slate-900 dark:text-white">
                  {environmentMode === 'mvp' ? 'MVP Mode (Provisional Allowed)' : 'Production Gate (Strict)'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {environmentMode === 'mvp'
                    ? 'Displays "Pending clinical review" badge'
                    : 'Rejects all unapproved clinical rules'}
                </div>
              </div>
              <button
                onClick={() => onToggleEnvironmentMode(environmentMode === 'mvp' ? 'production' : 'mvp')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none ${
                  environmentMode === 'production' ? 'bg-teal-600' : 'bg-amber-500'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-out ${
                    environmentMode === 'production' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Clinical Guardrails Configuration Drawer (Spec §6) */}
        {showGuardrailConfig && (
          <div className="bg-slate-50 dark:bg-[#0F1A20] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-white">
                <Shield size={16} className="text-teal-600" />
                <span>Clinical Guardrails & Hard-Stops Settings (Spec §6)</span>
              </div>
              <span className="text-[10px] bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300 font-bold px-2 py-0.5 rounded-full">
                SMC Governance Guardrails Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {/* Confidence Floor */}
              <div className="bg-white dark:bg-[#14212B] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                  <span>Confidence Floor</span>
                  <span className="text-teal-700 dark:text-teal-300 font-black">{confidenceFloor}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="5"
                  value={confidenceFloor}
                  onChange={e => setConfidenceFloor(parseInt(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500">
                  Forces conservative escalation if confidence &lt; {confidenceFloor}%
                </div>
              </div>

              {/* Allergy Hard Stop */}
              <div className="bg-white dark:bg-[#14212B] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                  <span>Allergy Hard Stop</span>
                  <span className={`font-black ${allergyHardStop ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {allergyHardStop ? 'ENABLED' : 'OFF'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllergyHardStop(!allergyHardStop)}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all ${
                    allergyHardStop ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {allergyHardStop ? '✓ Active Pre-Output Gate' : 'Bypass Disabled'}
                </button>
                <div className="text-[10px] text-slate-500">
                  Blocks OTC conflicts pre-output
                </div>
              </div>

              {/* Age Hard Stop */}
              <div className="bg-white dark:bg-[#14212B] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                  <span>Age Escalation Gate</span>
                  <span className={`font-black ${ageHardStop ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {ageHardStop ? 'ENABLED' : 'OFF'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAgeHardStop(!ageHardStop)}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all ${
                    ageHardStop ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {ageHardStop ? '✓ Inf/Snr Gate Active' : 'Bypass Disabled'}
                </button>
                <div className="text-[10px] text-slate-500">
                  Blocks HOME_MONITOR for fever/falls
                </div>
              </div>

              {/* Freshness Window & State Machine */}
              <div className="bg-white dark:bg-[#14212B] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                  <span>Freshness Window</span>
                  <span className="text-teal-700 dark:text-teal-300 font-black">{stalenessWindowDays} Days</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                  <span>Max Agent Retries:</span>
                  <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {maxRetryCount} revisions
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Hard stop on unverified/stale rules
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Adhoc Rule Harvesting Screen */}
        <div className="bg-slate-50 dark:bg-[#0F1A20] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3 animate-fadeIn mt-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-white">
              <Brain size={16} className="text-teal-600" />
              <span>Adhoc Rule Harvesting Configuration</span>
            </div>
            <span className="text-[10px] bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
              Agentic Harvesting
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              id="harvest-websites"
              placeholder="Comma-separated websites (e.g. https://www.moh.gov.sg/guidelines)" 
              className="flex-1 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#14212B] text-xs focus:border-teal-500 font-mono text-slate-900 dark:text-white"
              defaultValue="https://www.healthhub.sg/health-conditions/children-emergencies, https://www.kkh.com.sg/conditions-treatments"
            />
            <button
              type="button"
              disabled={isHarvesting}
              onClick={async () => {
                const input = document.getElementById('harvest-websites') as HTMLInputElement;
                if (!input) return;
                const urls = input.value.split(',').map(s => s.trim()).filter(Boolean);
                if (urls.length === 0) return alert('Please enter at least one URL');
                
                setIsHarvesting(true);
                try {
                  const res = await fetch('/api/agentic/harvest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ websites: urls })
                  });
                  const data = await res.json();
                  if (data.success) {
                    if (data.harvestedCount === 0 && data.skipped?.length > 0) {
                      const skipDetails = data.skipped.map((s: any) => `• ${s.url}\n  Status: ${s.reason}`).join('\n\n');
                      alert(`@decipher_agent Harvesting Report:\n\nNo new rules were created:\n\n${skipDetails}`);
                    } else {
                      let msg = `Successfully harvested ${data.harvestedCount || data.proposals?.length || 0} valid rule(s) via @decipher_agent!`;
                      if (data.skipped?.length > 0) {
                        msg += `\n\nSkipped link(s):\n` + data.skipped.map((s: any) => `• ${s.url} (${s.reason})`).join('\n');
                      }
                      alert(msg);
                      if (onRefreshProposals) {
                        await onRefreshProposals();
                      }
                      fetchHomeMedicationsFromDb().then(setHomeMedications);
                      if (data.proposals && data.proposals.length > 0) {
                        setSelectedProposalId(data.proposals[0].id);
                      }
                    }
                  } else {
                    alert(`Error harvesting rules: ${data.error}`);
                  }
                } catch (err: any) {
                  alert(`Request failed: ${err.message}`);
                } finally {
                  setIsHarvesting(false);
                }
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isHarvesting ? (
                <>
                  <Loader2 size={14} className="animate-spin text-teal-400" />
                  <span>Validating & Harvesting...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Dispatch Agent to Harvest</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            Provide a list of websites to procure data from. A new agent will go to the provided sites to see if any new rules need to be harvested and inserted into kb_proposals.
          </p>
        </div>

        {/* HSA Regulatory Compliance Banner */}
        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-4 text-xs text-indigo-950 dark:text-indigo-200 flex items-start space-x-3">
          <ShieldCheck size={20} className="text-indigo-700 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-2">
              <span>HSA Software-as-a-Medical-Device (SaMD) & Deterministic Safety Net</span>
              <span className="text-[10px] bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 px-2 py-0.2 rounded-full font-bold">
                Spec §1: Deterministic Code Owns Emergencies
              </span>
            </div>
            <p className="text-indigo-900 dark:text-indigo-300 leading-relaxed text-[11px]">
              Red-flag conditions bypass LLM hallucination risks via deterministic evaluation. Proposed rule modifications harvested by <strong>@decipher_agent</strong> and home medications extracted by <strong>@home_medication_agent</strong> require explicit SMC clinician cryptographic sign-off before entering production.
            </p>
          </div>
        </div>
      </div>

      {/* Top Console Switcher: CPG Rules vs Home Medications */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveConsoleTab('rules')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeConsoleTab === 'rules'
              ? 'bg-teal-600 text-white shadow-md'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          <FileText size={15} />
          <span>CPG Deterministic Red-Lines ({proposals.length})</span>
        </button>

        <button
          onClick={() => setActiveConsoleTab('medications')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeConsoleTab === 'medications'
              ? 'bg-teal-600 text-white shadow-md'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          <Pill size={15} />
          <span>Home & First-Aid Medications (@home_medication_agent) ({homeMedications.length})</span>
          {homeMedications.filter(m => m.status !== 'approved').length > 0 && (
            <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {homeMedications.filter(m => m.status !== 'approved').length} Pending
            </span>
          )}
        </button>
      </div>

      {activeConsoleTab === 'rules' ? (
      /* Main Reviewer Layout for CPG Rules */
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Proposals Queue */}
        <div className="space-y-3">
          {/* Filter Pills */}
          <div className="bg-white dark:bg-[#14212B] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Queue ({filteredProposals.length} / {proposals.length})</span>
              <span className="text-teal-700 dark:text-teal-400 text-[10px] font-bold">Auto-Harvest Active</span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => setActiveFilter('all')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  activeFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                All ({proposals.length})
              </button>

              <button
                onClick={() => setActiveFilter('infant')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  activeFilter === 'infant'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                }`}
              >
                👶 Infants §3.1 ({infantCount})
              </button>

              <button
                onClick={() => setActiveFilter('senior')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  activeFilter === 'senior'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900'
                }`}
              >
                👴 Seniors §3.2 ({seniorCount})
              </button>

              <button
                onClick={() => setActiveFilter('pending')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  activeFilter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                Pending ({pendingCount})
              </button>

              <button
                onClick={() => setActiveFilter('approved')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  activeFilter === 'approved'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}
              >
                Approved ({approvedCount})
              </button>

              {nonConformingCount > 0 && (
                <button
                  onClick={() => setActiveFilter('non_conforming')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                    activeFilter === 'non_conforming'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                  }`}
                >
                  <AlertTriangle size={11} />
                  <span>Needs Review ({nonConformingCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Proposals List */}
          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {filteredProposals.map(prop => {
              const isSelected = prop.id === activeProposal?.id;
              const isApproved = prop.status?.toLowerCase() === 'approved';
              const isInfant = prop.ageBand === 'infant' || prop.id.includes('inf');
              const isSenior = prop.ageBand === 'senior' || prop.id.includes('snr');

              return (
                <button
                  key={prop.id}
                  onClick={() => setSelectedProposalId(prop.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all space-y-2 ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/80 dark:bg-teal-950/40 shadow-md ring-2 ring-teal-500/20 dark:border-teal-400'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#14212B] hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        isInfant
                          ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
                          : isSenior
                          ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {isInfant ? '👶 Infant §3.1' : isSenior ? '👴 Senior §3.2' : prop.affectedAilment}
                      </span>

                      {prop.category && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {prop.category}
                        </span>
                      )}

                      {prop.requiresClinicianReview && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5">
                          <AlertTriangle size={9} />
                          <span>Flagged</span>
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {isApproved ? 'APPROVED' : 'REVIEW'}
                    </span>
                  </div>

                  <div className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                    {prop.title}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono text-teal-700 dark:text-teal-400">
                      {prop.originatingAgent || '@decipher_agent'}
                    </span>
                    {prop.verifiedSource && (
                      <span className="font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-1.5 py-0.5 rounded">
                        {prop.verifiedSource}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Side-by-Side Review & Sign-Off Panel */}
        {activeProposal ? (
          <div className="md:col-span-2 bg-white dark:bg-[#14212B] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black text-teal-700 dark:text-teal-300 uppercase tracking-wider bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-900">
                    {activeProposal.targetTier || 'Tier 1 Deterministic Red-Line'}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                    Provenance: {activeProposal.originatingAgent || '@decipher_agent'}
                  </span>
                  {activeProposal.confidenceScore && (
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                      Calibration: {activeProposal.confidenceScore}%
                    </span>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1.5">
                  {activeProposal.title}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-4">
                  <span>Publisher: <strong className="text-slate-800 dark:text-slate-200">{activeProposal.publisher}</strong></span>
                  <span>Verified Source: <strong className="text-teal-700 dark:text-teal-400">{activeProposal.verifiedSource || 'Unverified'}</strong></span>
                  <span>Harvested: {new Date(activeProposal.retrievedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeProposal.status?.toLowerCase() === 'approved' ? (
                  <>
                    <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm">
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                      <span>Approved by {activeProposal.reviewedBy || activeProposal.signOffBy || 'SMC Clinician'}</span>
                    </div>

                    <button
                      onClick={() => {
                        if (window.confirm('Move this approved rule back to Pending Review status? It will no longer execute in production until re-approved.')) {
                          onMoveToPendingProposal?.(activeProposal.id);
                        }
                      }}
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 transform hover:-translate-y-0.5"
                      title="Move back to Pending Review status"
                    >
                      <RotateCcw size={14} className="text-amber-600 dark:text-amber-400" />
                      <span>Move to Pending</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowSignOffModal(true)}
                    className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 transform hover:-translate-y-0.5"
                  >
                    <UserCheck size={15} />
                    <span>SMC Clinician Sign-Off</span>
                  </button>
                )}
                
                <button
                  onClick={() => {
                    if (activeProposal.status?.toLowerCase() === 'approved') {
                      if (window.confirm('This rule is approved and may be active in the deterministic safety net. Are you sure you want to delete it?')) {
                        onDeleteProposal(activeProposal.id);
                        setSelectedProposalId('');
                      }
                    } else {
                      onDeleteProposal(activeProposal.id);
                      setSelectedProposalId('');
                    }
                  }}
                  className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center"
                  title="Delete Proposal"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Expert Clinician Review Mandatory Callout */}
            {activeProposal.requiresClinicianReview && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-sm">
                <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="space-y-1">
                  <div className="font-extrabold text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <span>Expert Clinician Review Mandatory (Non-Conforming Terminology)</span>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {activeProposal.clinicianReviewReason || 'The extracted medical text does not directly map 1-to-1 with standard ICD-10 / SNOMED-CT taxonomy. Formal review and threshold validation by an SMC-registered doctor are mandatory before this rule can be activated.'}
                  </p>
                </div>
              </div>
            )}

            {/* Connected Home Medication Protocol (@home_medication_agent) */}
            {(() => {
              const matchingMed = homeMedications.find(m =>
                (activeProposal.title && activeProposal.title.toLowerCase().includes('anaphyl') && m.medicationName.toLowerCase().includes('epipen')) ||
                (m.conditionCode && activeProposal.id && activeProposal.id.toLowerCase().includes(m.conditionCode.toLowerCase())) ||
                (m.conditionName && activeProposal.title && activeProposal.title.toLowerCase().includes(m.conditionName.toLowerCase()))
              );
              if (!matchingMed) return null;
              return (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-2xl p-4 text-emerald-900 dark:text-emerald-200 flex items-start gap-3 shadow-sm">
                  <Pill className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={20} />
                  <div className="space-y-1">
                    <div className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
                      <span>Harvested Home Medication Protocol (@home_medication_agent)</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${matchingMed.status === 'approved' ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}`}>
                        {matchingMed.status === 'approved' ? 'APPROVED' : 'PENDING CLINICIAN REVIEW'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {matchingMed.medicationName} ({matchingMed.route})
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {matchingMed.dosageInstruction}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Side-by-Side Diff Section */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <FileDiff size={15} className="text-teal-700 dark:text-teal-400" />
                <span>Deterministic Trigger Specification (Diff & Logic)</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0F1A20] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-2 text-slate-800 dark:text-slate-200">
                <div className="text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 pb-1 flex justify-between">
                  <span>// Proposed Deterministic Net Rule (Non-LLM):</span>
                  <span className="text-[10px] text-teal-600">Auditable 100%</span>
                </div>
                <p className="whitespace-pre-line text-emerald-900 dark:text-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  + {activeProposal.proposedChanges}
                </p>
                {activeProposal.ruleCodeSnippet && (
                  <div className="pt-1">
                    <div className="text-[10px] text-slate-500 pb-1">// Live Engine Code Snippet:</div>
                    <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-xl text-[11px] overflow-x-auto">
                      {activeProposal.ruleCodeSnippet}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Harvested Source Document Excerpt (Original Medical Guidance) */}
            {activeProposal.originalText && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-amber-600 dark:text-amber-400" />
                  <span>Harvested Source Document Excerpt (Original Medical Guidance):</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 bg-amber-50/70 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 leading-relaxed font-mono whitespace-pre-wrap shadow-inner border-l-4 border-l-amber-500">
                  <div className="flex items-start gap-2">
                    <Quote size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>{activeProposal.originalText}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Clinical Evidence & Rationale */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Info size={14} className="text-teal-600" />
                <span>Clinical Rationale & Evidence:</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#0F1A20] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 leading-relaxed">
                {activeProposal.rationale}
              </p>
            </div>

            {/* Authoritative Citation & Audit Trail */}
            <div className="flex flex-wrap items-center justify-between text-xs bg-slate-100/70 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 gap-2">
              <div className="space-y-0.5">
                <div>Source Reference: <strong className="text-slate-900 dark:text-white">{activeProposal.publisher}</strong></div>
                <div>Verified Source: <strong className="text-teal-700 dark:text-teal-400">{activeProposal.verifiedSource || 'Unverified'}</strong></div>
                <div className="text-[10px] text-slate-500">URL: {activeProposal.sourceUrl}</div>
              </div>
              <a
                href={activeProposal.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-teal-700 dark:text-teal-400 hover:text-teal-900 font-bold flex items-center space-x-1 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <span>View {activeProposal.verifiedSource || 'Source'}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ) : (
          <div className="md:col-span-2 bg-white dark:bg-[#14212B] border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500">
            No proposal selected.
          </div>
        )}
      </div>
      ) : (
      /* Main Reviewer Layout for Home Medications (@home_medication_agent) */
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Home Medications List */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-[#14212B] p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Home Medications ({homeMedications.length})</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">@home_medication_agent</span>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {homeMedications.map(med => {
              const isSelected = med.id === activeHomeMed?.id;
              const isApproved = med.status === 'approved';
              return (
                <button
                  key={med.id}
                  onClick={() => setSelectedMedId(med.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all space-y-1.5 ${
                    isSelected
                      ? 'bg-teal-50/50 border-teal-500 shadow-sm dark:bg-teal-950/20 dark:border-teal-400'
                      : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-[#14212B] dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                      {med.route || 'Oral'}
                    </span>
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {isApproved ? 'APPROVED' : 'PENDING REVIEW'}
                    </span>
                  </div>

                  <div className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                    {med.medicationName}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    For: <strong className="text-slate-700 dark:text-slate-300">{med.conditionName}</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Medication Detail Panel */}
        <div className="md:col-span-2">
          {activeHomeMed ? (
            <div className="bg-white dark:bg-[#14212B] p-5 sm:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900">
                      @home_medication_agent
                    </span>
                    {activeHomeMed.urgency && (
                      <span className="text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-full">
                        {activeHomeMed.urgency.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1.5">
                    {activeHomeMed.medicationName}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-4">
                    <span>Indication: <strong className="text-slate-800 dark:text-slate-200">{activeHomeMed.conditionName} ({activeHomeMed.conditionCode || 'CPG'})</strong></span>
                    <span>Route: <strong className="text-teal-700 dark:text-teal-400">{activeHomeMed.route}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeHomeMed.status?.toLowerCase() === 'approved' ? (
                    <>
                      <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm">
                        <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Approved by {activeHomeMed.reviewedBy}</span>
                      </div>

                      <button
                        onClick={async () => {
                          if (window.confirm('Move this approved home medication protocol back to Pending Review status?')) {
                            const ok = await moveHomeMedicationToPendingInDb(activeHomeMed.id);
                            if (ok) {
                              setHomeMedications(prev =>
                                prev.map(m =>
                                  m.id === activeHomeMed.id
                                    ? { ...m, status: 'pending_review', reviewedBy: undefined, mcrNumber: undefined, reviewedAt: undefined }
                                    : m
                                )
                              );
                            }
                          }
                        }}
                        className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 transform hover:-translate-y-0.5"
                        title="Move back to Pending Review status"
                      >
                        <RotateCcw size={14} className="text-amber-600 dark:text-amber-400" />
                        <span>Move to Pending</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowMedSignOffModal(true)}
                      className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5"
                    >
                      <UserCheck size={15} />
                      <span>Approve Medication Protocol</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteHomeMed(activeHomeMed.id)}
                    className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900 font-bold text-xs rounded-xl shadow-sm transition-all"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Dosage Instruction & Warnings */}
              <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-3">
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-2">
                  <Pill size={16} className="text-emerald-600" />
                  <span>Approved Administration & Dosage Instructions</span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {activeHomeMed.dosageInstruction}
                </div>
                {activeHomeMed.warnings && (
                  <div className="text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                    ⚠️ <strong>Clinical Warning / Precaution:</strong> {activeHomeMed.warnings}
                  </div>
                )}
              </div>

              {/* Harvested Source Document Excerpt */}
              {activeHomeMed.rawExcerpt && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Quote size={15} className="text-teal-700 dark:text-teal-400" />
                    <span>Harvested Source Document Excerpt (Original Medical Guidance)</span>
                  </div>
                  <div className="bg-amber-50/40 dark:bg-[#0F1A20] p-4 rounded-2xl border border-amber-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                    {activeHomeMed.rawExcerpt}
                  </div>
                </div>
              )}

              {/* Source Document Reference */}
              {activeHomeMed.sourceDoc && (
                <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 flex items-center gap-1.5">
                  <span>Source URL:</span>
                  <a
                    href={activeHomeMed.sourceDoc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 underline font-mono text-[11px] truncate max-w-md"
                  >
                    {activeHomeMed.sourceDoc}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#14212B] p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500">
              No home medications harvested yet. Run harvesting to procure new protocols.
            </div>
          )}
        </div>
      </div>
      )}

      {/* Clinician Sign-off Modal */}
      {showSignOffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#14212B] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <UserCheck className="text-teal-600 dark:text-teal-400" size={18} />
              <span>SMC Registered Doctor Approval (Spec §4 Gateway)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your clinical sign-off will commit this deterministic red-line rule directly to the active triage knowledge repository.
            </p>

            <form onSubmit={handleSignOff} className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Doctor Full Name</label>
                <input
                  type="text"
                  required
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0F1A20] text-sm focus:border-teal-500 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Singapore Medical Council (SMC) MCR Number</label>
                <input
                  type="text"
                  required
                  value={mcrNumber}
                  onChange={e => setMcrNumber(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0F1A20] text-sm focus:border-teal-500 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Clinical Attestation Notes</label>
                <textarea
                  rows={2}
                  value={clinicalNotes}
                  onChange={e => setClinicalNotes(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0F1A20] text-sm resize-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSignOffModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Confirm SMC Clinical Sign-Off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clinician Sign-off Modal for Home Medications */}
      {showMedSignOffModal && activeHomeMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#14212B] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Pill className="text-teal-600 dark:text-teal-400" size={18} />
              <span>Approve Home Medication Protocol (@home_medication_agent)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your clinical sign-off will approve this first-aid/home medication for automatic dispensing in family triage.
            </p>

            <form onSubmit={handleApproveHomeMed} className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Medication & Condition</label>
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {activeHomeMed.medicationName} — {activeHomeMed.conditionName}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Doctor Full Name</label>
                <input
                  type="text"
                  required
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0F1A20] text-sm focus:border-teal-500 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Singapore Medical Council (SMC) MCR Number</label>
                <input
                  type="text"
                  required
                  value={mcrNumber}
                  onChange={e => setMcrNumber(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0F1A20] text-sm focus:border-teal-500 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMedSignOffModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Confirm Medication Protocol Sign-Off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
