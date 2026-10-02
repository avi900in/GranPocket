import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  ExternalLink, 
  Check, 
  Copy, 
  Database, 
  ShieldCheck, 
  AlertTriangle, 
  Loader2, 
  Layers, 
  Terminal, 
  CheckCircle2, 
  Code2, 
  Clock, 
  Coins, 
  Edit3, 
  Trash2, 
  Plus, 
  RotateCcw, 
  Search, 
  Table, 
  LayoutGrid, 
  FileText,
  Save,
  CheckSquare,
  Square
} from 'lucide-react';

export interface AdpHarvestedRule {
  knowledge_id: string;
  title: string;
  rule_code_snippet: string;
  rationale: string;
  source_doc: string;
  verified_source: string;
  category: string;
  target_tier: string;
  age_band: string;
  originating_agent: string;
  confidence_score: number;
  status: string;
  original_text: string;
  review_decision?: string;
  review_rationale?: string;
  identified_risks?: string[];
  requires_clinician_review?: boolean;
  is_edited?: boolean;
}

export interface WorkflowNode {
  nodeId: string;
  nodeName: string;
  status: string;
  elapsedMs: number;
  tokens: number;
  content: string;
  outputRef?: string;
}

export interface AdpHarvestResult {
  success: boolean;
  requestId: string;
  conversationId: string;
  targetUrl: string;
  elapsedMs: number;
  parsedRules: AdpHarvestedRule[];
  workflowNodes: WorkflowNode[];
  messages: any[];
  finalReply?: string;
  rawOutput: string;
}

interface AdpHarvestResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  targetUrl: string;
  result: AdpHarvestResult | null;
  onIngestRules?: (rules: AdpHarvestedRule[]) => Promise<void>;
}

export const AdpHarvestResultModal: React.FC<AdpHarvestResultModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  targetUrl,
  result,
  onIngestRules
}) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'workflow' | 'raw'>('rules');
  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
  const [editableRules, setEditableRules] = useState<AdpHarvestedRule[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [committedIds, setCommittedIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  
  // Row detail editor modal state
  const [editingRule, setEditingRule] = useState<AdpHarvestedRule | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedNodeIndex, setExpandedNodeIndex] = useState<number | null>(0);

  // Initialize and clone rules when result changes
  useEffect(() => {
    if (result?.parsedRules && Array.isArray(result.parsedRules)) {
      const cloned = JSON.parse(JSON.stringify(result.parsedRules)) as AdpHarvestedRule[];
      setEditableRules(cloned);
      const initialSelected: Record<string, boolean> = {};
      cloned.forEach(r => {
        initialSelected[r.knowledge_id] = true;
      });
      setSelectedIds(initialSelected);
      setCommittedIds({});
      setNotification(null);
    } else {
      setEditableRules([]);
      setSelectedIds({});
      setCommittedIds({});
    }
  }, [result]);

  // Filter rules based on search
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return editableRules;
    const q = searchQuery.toLowerCase();
    return editableRules.filter(r => 
      (r.knowledge_id || '').toLowerCase().includes(q) ||
      (r.title || '').toLowerCase().includes(q) ||
      (r.rationale || '').toLowerCase().includes(q) ||
      (r.verified_source || '').toLowerCase().includes(q) ||
      (r.review_decision || '').toLowerCase().includes(q)
    );
  }, [editableRules, searchQuery]);

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const allSelected = editableRules.length > 0 && editableRules.every(r => selectedIds[r.knowledge_id]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds({});
    } else {
      const next: Record<string, boolean> = {};
      editableRules.forEach(r => {
        next[r.knowledge_id] = true;
      });
      setSelectedIds(next);
    }
  };

  const handleFieldChange = (index: number, field: keyof AdpHarvestedRule, value: any) => {
    setEditableRules(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
        is_edited: true
      };
      return next;
    });
  };

  const handleAddManualRule = () => {
    const newId = `CUSTOM_RULE_${Date.now().toString().slice(-4)}`;
    const newRule: AdpHarvestedRule = {
      knowledge_id: newId,
      title: 'New Clinical Guidance Rule',
      rule_code_snippet: `// Deterministic rule for ${newId}\nif (context.${newId.toLowerCase()}) return EMERGENCY_HALT('${newId}');`,
      rationale: 'Manually customized rule added by clinician during ADP harvesting review.',
      source_doc: targetUrl,
      verified_source: 'Clinician Override / ADP Harvester',
      category: 'Auto-Harvested',
      target_tier: 'Tier 1 Deterministic Red-Line',
      age_band: 'pediatric',
      originating_agent: '@clinician_override',
      confidence_score: 95,
      status: 'pending_review',
      original_text: 'Manual entry',
      review_decision: 'APPROVE',
      review_rationale: 'Clinician formulated prior to commit',
      identified_risks: [],
      is_edited: true
    };
    setEditableRules(prev => [newRule, ...prev]);
    setSelectedIds(prev => ({ ...prev, [newId]: true }));
    setEditingRule(newRule);
    setEditingIndex(0);
  };

  const handleDeleteRule = (index: number) => {
    const target = editableRules[index];
    if (!target) return;
    setEditableRules(prev => prev.filter((_, i) => i !== index));
    setSelectedIds(prev => {
      const next = { ...prev };
      delete next[target.knowledge_id];
      return next;
    });
  };

  const handleResetToOriginal = () => {
    if (!result?.parsedRules) return;
    const cloned = JSON.parse(JSON.stringify(result.parsedRules));
    setEditableRules(cloned);
    const initialSelected: Record<string, boolean> = {};
    cloned.forEach((r: AdpHarvestedRule) => {
      initialSelected[r.knowledge_id] = true;
    });
    setSelectedIds(initialSelected);
    setNotification({ type: 'info', message: 'Reset all rule records back to original Agent 4 output.' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleOpenRowEditor = (rule: AdpHarvestedRule, index: number) => {
    setEditingRule({ ...rule });
    setEditingIndex(index);
  };

  const handleSaveRowEditor = () => {
    if (editingRule && editingIndex !== null) {
      setEditableRules(prev => {
        const next = [...prev];
        next[editingIndex] = {
          ...editingRule,
          is_edited: true
        };
        return next;
      });
      setEditingRule(null);
      setEditingIndex(null);
      setNotification({ type: 'success', message: `Saved changes to ${editingRule.knowledge_id}.` });
      setTimeout(() => setNotification(null), 2500);
    }
  };

  // Commit selected rules to kb_proposals
  const handleCommitSelected = async () => {
    const rulesToCommit = editableRules.filter(r => selectedIds[r.knowledge_id]);
    if (rulesToCommit.length === 0) {
      setNotification({ type: 'error', message: 'Please select at least one rule to commit.' });
      return;
    }

    if (!onIngestRules) {
      alert('Commit handler not available.');
      return;
    }

    setIsCommitting(true);
    setNotification(null);
    try {
      await onIngestRules(rulesToCommit);
      const newCommitted = { ...committedIds };
      rulesToCommit.forEach(r => {
        newCommitted[r.knowledge_id] = true;
      });
      setCommittedIds(newCommitted);
      setNotification({
        type: 'success',
        message: `Successfully committed ${rulesToCommit.length} rule(s) directly to kb_proposals table for clinical review!`
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Commit failed: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsCommitting(false);
    }
  };

  // Commit single rule
  const handleCommitSingle = async (rule: AdpHarvestedRule) => {
    if (!onIngestRules) return;
    try {
      await onIngestRules([rule]);
      setCommittedIds(prev => ({ ...prev, [rule.knowledge_id]: true }));
      setNotification({
        type: 'success',
        message: `Committed "${rule.title}" to kb_proposals!`
      });
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to commit rule: ${err.message}`
      });
    }
  };

  const handleCopyRaw = () => {
    if (!result) return;
    const textToCopy = result.rawOutput || JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const getNodeTitle = (nodeName: string) => {
    switch (nodeName) {
      case 'Agent1':
        return 'Web Evidence Acquisition Agent (Firecrawl Scrape & Evidence Extraction)';
      case 'Agent2':
        return 'Clinical Rule Compiler (Deterministic CPG Constraints)';
      case 'Agent3':
        return 'Medical Knowledge Review Agent (Safety, Acuity & Risk Audit)';
      case 'Agent4':
        return 'Knowledge Database Agent (Production Schema Synthesis)';
      case 'Start':
        return 'Pipeline Initialization';
      case 'End':
        return 'Multi-Agent Completion & Terminal Response';
      default:
        return nodeName;
    }
  };

  const getDecisionBadge = (decision?: string) => {
    switch (decision) {
      case 'APPROVE':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'APPROVE_WITH_CONDITIONS':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'REQUEST_REVISION':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border-orange-300 dark:border-orange-800';
      case 'ESCALATE_TO_HUMAN_PHYSICIAN':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-6xl max-h-[95vh] flex flex-col bg-white dark:bg-[#0D151C] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#111C24]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Agentic ADP Harvester — Knowledge DB Review
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Agent 4 Output
                </span>
                {result?.elapsedMs && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    <Clock size={11} />
                    {(result.elapsedMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="font-mono text-[11px] truncate max-w-md" title={targetUrl}>
                  Source: {targetUrl}
                </span>
                <a 
                  href={targetUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-teal-600 hover:text-teal-700 dark:text-teal-400 inline-flex items-center"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between transition-all ${
            notification.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-900' 
              : notification.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-b border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-900'
              : 'bg-indigo-50 text-indigo-900 border-b border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-900'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' && <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />}
              {notification.type === 'error' && <AlertTriangle size={15} className="text-rose-600 dark:text-rose-400" />}
              {notification.type === 'info' && <ShieldCheck size={15} className="text-indigo-600 dark:text-indigo-400" />}
              <span>{notification.message}</span>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs font-normal"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="py-20 px-4 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <Sparkles size={28} className="animate-pulse" />
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  Executing Agentic ADP 4-Agent Pipeline
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Communicating with <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">https://wss.lke.tencentcloud.com/adp/v2/chat</code> to scrape target URL and coordinate clinical multi-agent synthesis.
                </p>
              </div>

              {/* Workflow Stepper */}
              <div className="w-full max-w-xl bg-slate-50 dark:bg-[#121E27] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-left space-y-3 shadow-inner">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Active Orchestration Chain
                </div>
                <div className="space-y-2.5">
                  {[
                    { title: '1. Web Evidence Acquisition Agent', desc: 'Scraping content via Firecrawl & parsing evidence statements' },
                    { title: '2. Clinical Rule Compiler', desc: 'Compiling deterministic triage acuity & constraints' },
                    { title: '3. Medical Reviewer Agent', desc: 'Evaluating safety boundaries & clinical risks' },
                    { title: '4. Knowledge Database Agent', desc: 'Synthesizing schema for production KB proposals grid' }
                  ].map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs">
                      <div className="mt-0.5 w-4 h-4 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{step.title}</div>
                        <div className="text-[11px] text-slate-500">{step.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Primary Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('rules')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                      activeTab === 'rules'
                        ? 'bg-teal-600 text-white shadow-md'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Table size={14} />
                    <span>Agent 4 Rules Grid ({editableRules.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('workflow')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                      activeTab === 'workflow'
                        ? 'bg-teal-600 text-white shadow-md'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Layers size={14} />
                    <span>4-Agent Workflow Steps ({result.workflowNodes?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('raw')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                      activeTab === 'raw'
                        ? 'bg-teal-600 text-white shadow-md'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Terminal size={14} />
                    <span>Raw SSE / JSON</span>
                  </button>
                </div>

                {activeTab === 'rules' && (
                  <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          viewMode === 'grid'
                            ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                        }`}
                        title="Interactive Table Grid"
                      >
                        <Table size={13} />
                        <span className="hidden md:inline">Grid</span>
                      </button>
                      <button
                        onClick={() => setViewMode('cards')}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          viewMode === 'cards'
                            ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                        }`}
                        title="Detailed Cards"
                      >
                        <LayoutGrid size={13} />
                        <span className="hidden md:inline">Cards</span>
                      </button>
                    </div>

                    <button
                      onClick={handleAddManualRule}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Plus size={13} />
                      <span className="hidden sm:inline">Add Rule</span>
                    </button>

                    <button
                      onClick={handleResetToOriginal}
                      className="px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all flex items-center gap-1"
                      title="Reset all edits to raw Agent 4 output"
                    >
                      <RotateCcw size={13} />
                      <span className="hidden lg:inline">Reset</span>
                    </button>

                    <button
                      onClick={handleCommitSelected}
                      disabled={isCommitting || selectedCount === 0}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCommitting ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />}
                      <span>Commit to kb_proposals ({selectedCount})</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tab 1: Rules Presentation (Grid / Cards) */}
              {activeTab === 'rules' && (
                <div className="space-y-3 animate-fadeIn">
                  {/* Grid Toolbar & Search */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#121E27] p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="relative flex-1 max-w-sm">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search harvested rules by ID, title, or terms..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D151C] text-xs focus:border-teal-500 text-slate-900 dark:text-white"
                        />
                      </div>
                      <span className="text-slate-500 text-[11px] whitespace-nowrap">
                        Showing <strong>{filteredRules.length}</strong> of <strong>{editableRules.length}</strong> rules
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <span>{selectedCount} selected for commit</span>
                      <span>•</span>
                      <button
                        onClick={toggleSelectAll}
                        className="text-teal-600 dark:text-teal-400 hover:underline font-bold"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>

                  {/* View 1: Data Table / Grid View */}
                  {viewMode === 'grid' && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-[#0C141B]">
                      <div className="overflow-x-auto max-h-[58vh]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#14222D] border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                            <tr>
                              <th className="p-3 w-10 text-center">
                                <button
                                  type="button"
                                  onClick={toggleSelectAll}
                                  className="text-slate-600 dark:text-slate-300"
                                >
                                  {allSelected ? <CheckSquare size={15} className="text-teal-600" /> : <Square size={15} />}
                                </button>
                              </th>
                              <th className="p-3 min-w-[130px]">Rule ID</th>
                              <th className="p-3 min-w-[220px]">Title (Editable)</th>
                              <th className="p-3 min-w-[130px]">Target Tier</th>
                              <th className="p-3 min-w-[100px]">Age Band</th>
                              <th className="p-3 min-w-[150px]">Medical Decision</th>
                              <th className="p-3 min-w-[80px]">Conf %</th>
                              <th className="p-3 min-w-[180px]">Clinical Rationale</th>
                              <th className="p-3 min-w-[140px] text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                            {filteredRules.length > 0 ? (
                              filteredRules.map((rule, idx) => {
                                const realIndex = editableRules.findIndex(r => r.knowledge_id === rule.knowledge_id);
                                const isSelected = Boolean(selectedIds[rule.knowledge_id]);
                                const isCommitted = Boolean(committedIds[rule.knowledge_id]);

                                return (
                                  <tr 
                                    key={rule.knowledge_id || idx}
                                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                                      isSelected ? 'bg-teal-50/30 dark:bg-teal-950/20' : ''
                                    }`}
                                  >
                                    {/* Selection Checkbox */}
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={e => {
                                          const checked = e.target.checked;
                                          setSelectedIds(prev => ({ ...prev, [rule.knowledge_id]: checked }));
                                        }}
                                        className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                                      />
                                    </td>

                                    {/* Knowledge ID */}
                                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                                      <div className="flex items-center gap-1.5">
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                          {rule.knowledge_id}
                                        </span>
                                        {rule.is_edited && (
                                          <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-1 py-0.2 rounded" title="Edited by user">
                                            EDITED
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Rule Title (Inline Editable) */}
                                    <td className="p-3">
                                      <input
                                        type="text"
                                        value={rule.title}
                                        onChange={e => handleFieldChange(realIndex, 'title', e.target.value)}
                                        className="w-full p-1.5 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-teal-500 bg-transparent focus:bg-white dark:focus:bg-[#0D151C] font-semibold text-slate-900 dark:text-white transition-all text-xs"
                                        placeholder="Rule Title"
                                      />
                                    </td>

                                    {/* Target Tier */}
                                    <td className="p-3">
                                      <select
                                        value={rule.target_tier}
                                        onChange={e => handleFieldChange(realIndex, 'target_tier', e.target.value)}
                                        className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111C24] text-[11px] font-medium text-slate-800 dark:text-slate-200 focus:border-teal-500"
                                      >
                                        <option value="Tier 1 Deterministic Red-Line">Tier 1 Red-Line</option>
                                        <option value="Tier 2 Safety Protocol">Tier 2 Safety</option>
                                        <option value="Tier 3 Clinical Advisory">Tier 3 Advisory</option>
                                      </select>
                                    </td>

                                    {/* Age Band */}
                                    <td className="p-3">
                                      <select
                                        value={rule.age_band}
                                        onChange={e => handleFieldChange(realIndex, 'age_band', e.target.value)}
                                        className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111C24] text-[11px] font-medium text-slate-800 dark:text-slate-200 focus:border-teal-500"
                                      >
                                        <option value="pediatric">pediatric</option>
                                        <option value="infant">infant</option>
                                        <option value="adult">adult</option>
                                        <option value="senior">senior</option>
                                        <option value="all">all</option>
                                      </select>
                                    </td>

                                    {/* Medical Decision */}
                                    <td className="p-3">
                                      <select
                                        value={rule.review_decision || 'APPROVE'}
                                        onChange={e => handleFieldChange(realIndex, 'review_decision', e.target.value)}
                                        className={`p-1 rounded-lg border text-[10px] font-bold focus:border-teal-500 ${getDecisionBadge(rule.review_decision)}`}
                                      >
                                        <option value="APPROVE">APPROVE</option>
                                        <option value="APPROVE_WITH_CONDITIONS">APPROVE_WITH_CONDITIONS</option>
                                        <option value="REQUEST_REVISION">REQUEST_REVISION</option>
                                        <option value="ESCALATE_TO_HUMAN_PHYSICIAN">ESCALATE_TO_PHYSICIAN</option>
                                      </select>
                                    </td>

                                    {/* Confidence Score */}
                                    <td className="p-3">
                                      <div className="flex items-center gap-1 font-mono text-[11px]">
                                        <input
                                          type="number"
                                          min={1}
                                          max={100}
                                          value={rule.confidence_score}
                                          onChange={e => handleFieldChange(realIndex, 'confidence_score', parseInt(e.target.value, 10) || 0)}
                                          className="w-12 p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111C24] text-center font-bold text-slate-800 dark:text-slate-200"
                                        />
                                        <span className="text-slate-400">%</span>
                                      </div>
                                    </td>

                                    {/* Clinical Rationale preview */}
                                    <td className="p-3 max-w-xs">
                                      <div 
                                        onClick={() => handleOpenRowEditor(rule, realIndex)}
                                        className="truncate cursor-pointer text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 text-[11px]" 
                                        title={rule.rationale}
                                      >
                                        {rule.rationale || 'Click to add clinical rationale...'}
                                      </div>
                                    </td>

                                    {/* Actions */}
                                    <td className="p-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {isCommitted ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800">
                                            <Check size={11} />
                                            Committed
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleCommitSingle(rule)}
                                            className="px-2 py-1 text-[11px] font-bold text-slate-900 bg-slate-100 hover:bg-teal-600 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-teal-600 rounded-lg transition-all"
                                            title="Commit single rule to kb_proposals"
                                          >
                                            Commit
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleOpenRowEditor(rule, realIndex)}
                                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                          title="Edit full details & code snippet"
                                        >
                                          <Edit3 size={13} />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDeleteRule(realIndex)}
                                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                          title="Discard row"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={9} className="p-8 text-center text-slate-400">
                                  No rules match your filter query.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* View 2: Detailed Cards View */}
                  {viewMode === 'cards' && (
                    <div className="grid grid-cols-1 gap-3.5 max-h-[58vh] overflow-y-auto pr-1">
                      {filteredRules.map((rule, idx) => {
                        const realIndex = editableRules.findIndex(r => r.knowledge_id === rule.knowledge_id);
                        const isSelected = Boolean(selectedIds[rule.knowledge_id]);
                        const isCommitted = Boolean(committedIds[rule.knowledge_id]);

                        return (
                          <div 
                            key={rule.knowledge_id || idx}
                            className={`p-4 rounded-2xl border transition-all space-y-3 ${
                              isSelected 
                                ? 'bg-white dark:bg-[#111D25] border-teal-500/60 shadow-sm'
                                : 'bg-slate-50/70 dark:bg-[#0E171E] border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800/80 pb-2.5">
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    setSelectedIds(prev => ({ ...prev, [rule.knowledge_id]: checked }));
                                  }}
                                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer mr-1"
                                />
                                <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                  {rule.knowledge_id}
                                </span>
                                <input
                                  type="text"
                                  value={rule.title}
                                  onChange={e => handleFieldChange(realIndex, 'title', e.target.value)}
                                  className="flex-1 font-bold text-sm text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 p-0.5"
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${getDecisionBadge(rule.review_decision)}`}>
                                  {rule.review_decision || 'REVIEW_PENDING'}
                                </span>

                                {isCommitted ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800">
                                    <Check size={11} />
                                    Committed
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleCommitSingle(rule)}
                                    className="px-3 py-1 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 rounded-xl"
                                  >
                                    Commit Rule
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenRowEditor(rule, realIndex)}
                                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
                                  title="Edit full rule"
                                >
                                  <Edit3 size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div>
                                <span className="font-bold text-slate-700 dark:text-slate-300">Clinical Rationale: </span>
                                <span className="text-slate-600 dark:text-slate-400">{rule.rationale}</span>
                              </div>

                              {rule.review_rationale && (
                                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px]">
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400">Medical Reviewer Assessment: </span>
                                  <span className="text-slate-600 dark:text-slate-300">{rule.review_rationale}</span>
                                </div>
                              )}

                              {rule.rule_code_snippet && (
                                <pre className="p-2.5 bg-slate-900 text-teal-300 text-[11px] font-mono rounded-xl overflow-x-auto">
                                  {rule.rule_code_snippet}
                                </pre>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Workflow Steps Timeline */}
              {activeTab === 'workflow' && (
                <div className="space-y-3 animate-fadeIn">
                  {result.workflowNodes?.map((node, index) => {
                    const isExpanded = expandedNodeIndex === index;
                    return (
                      <div 
                        key={node.nodeId || index}
                        className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/60 dark:bg-[#101B24]"
                      >
                        <div 
                          onClick={() => setExpandedNodeIndex(isExpanded ? null : index)}
                          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-xs font-black">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{node.nodeName}</span>
                                <span className="text-[10px] text-slate-500 font-normal">
                                  — {getNodeTitle(node.nodeName)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            {node.elapsedMs > 0 && (
                              <span className="flex items-center gap-1 font-mono">
                                <Clock size={11} />
                                {(node.elapsedMs / 1000).toFixed(1)}s
                              </span>
                            )}
                            {node.tokens > 0 && (
                              <span className="flex items-center gap-1 font-mono">
                                <Coins size={11} />
                                {node.tokens} tokens
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {node.status}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C141B] space-y-2">
                            {node.outputRef && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <span>COS Object Output:</span>
                                <a 
                                  href={node.outputRef} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-teal-600 hover:underline truncate max-w-lg"
                                >
                                  {node.outputRef}
                                </a>
                              </div>
                            )}
                            <pre className="p-3 bg-slate-900 text-slate-100 dark:bg-slate-950 text-xs font-mono rounded-xl overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                              {node.content || 'No text output available for this node.'}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab 3: Raw Output */}
              {activeTab === 'raw' && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Raw Server-Sent Events (SSE) Stream from ADP API</span>
                    <span>Bytes: {result.rawOutput?.length || 0}</span>
                  </div>
                  <pre className="p-4 bg-slate-900 text-emerald-400 dark:bg-slate-950 text-xs font-mono rounded-2xl overflow-x-auto max-h-[60vh] whitespace-pre-wrap leading-relaxed border border-slate-800">
                    {result.rawOutput || JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No results to display.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#111C24]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {editableRules.length > 0 ? (
              <span>
                <strong>{editableRules.length}</strong> rules in grid • <strong>{selectedCount}</strong> selected • <strong>{Object.keys(committedIds).length}</strong> committed
              </span>
            ) : (
              <span>Ready</span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Close
            </button>

            {result && (
              <button
                onClick={handleCopyRaw}
                className="px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
              >
                {copiedRaw ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copiedRaw ? 'Copied' : 'Copy Raw Output'}</span>
              </button>
            )}

            {editableRules.length > 0 && onIngestRules && (
              <button
                onClick={handleCommitSelected}
                disabled={isCommitting || selectedCount === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isCommitting ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                <span>Commit to kb_proposals ({selectedCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row Detail Editor Modal */}
      {editingRule && editingIndex !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/65 backdrop-blur-sm animate-fadeIn">
          <div 
            className="bg-white dark:bg-[#111C24] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-teal-600" />
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  Edit Clinical Rule Record: {editingRule.knowledge_id}
                </h4>
              </div>
              <button
                onClick={() => { setEditingRule(null); setEditingIndex(null); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Knowledge ID</label>
                  <input
                    type="text"
                    value={editingRule.knowledge_id}
                    onChange={e => setEditingRule({ ...editingRule, knowledge_id: e.target.value })}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0D151C] font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Target Tier</label>
                  <select
                    value={editingRule.target_tier}
                    onChange={e => setEditingRule({ ...editingRule, target_tier: e.target.value })}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0D151C] text-slate-900 dark:text-white font-medium"
                  >
                    <option value="Tier 1 Deterministic Red-Line">Tier 1 Deterministic Red-Line</option>
                    <option value="Tier 2 Safety Protocol">Tier 2 Safety Protocol</option>
                    <option value="Tier 3 Clinical Advisory">Tier 3 Clinical Advisory</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Rule Title</label>
                <input
                  type="text"
                  value={editingRule.title}
                  onChange={e => setEditingRule({ ...editingRule, title: e.target.value })}
                  className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0D151C] font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Age Band</label>
                  <select
                    value={editingRule.age_band}
                    onChange={e => setEditingRule({ ...editingRule, age_band: e.target.value })}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0D151C] text-slate-900 dark:text-white font-medium"
                  >
                    <option value="pediatric">pediatric</option>
                    <option value="infant">infant</option>
                    <option value="adult">adult</option>
                    <option value="senior">senior</option>
                    <option value="all">all</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Review Decision</label>
                  <select
                    value={editingRule.review_decision || 'APPROVE'}
                    onChange={e => setEditingRule({ ...editingRule, review_decision: e.target.value })}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0D151C] text-slate-900 dark:text-white font-bold"
                  >
                    <option value="APPROVE">APPROVE</option>
                    <option value="APPROVE_WITH_CONDITIONS">APPROVE_WITH_CONDITIONS</option>
                    <option value="REQUEST_REVISION">REQUEST_REVISION</option>
                    <option value="ESCALATE_TO_HUMAN_PHYSICIAN">ESCALATE_TO_HUMAN_PHYSICIAN</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Confidence Score (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={editingRule.confidence_score}
                    onChange={e => setEditingRule({ ...editingRule, confidence_score: parseInt(e.target.value, 10) || 0 })}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0D151C] font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Clinical Rationale</label>
                <textarea
                  rows={2}
                  value={editingRule.rationale}
                  onChange={e => setEditingRule({ ...editingRule, rationale: e.target.value })}
                  className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0D151C] text-slate-900 dark:text-white leading-relaxed"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Medical Reviewer Assessment</label>
                <textarea
                  rows={2}
                  value={editingRule.review_rationale || ''}
                  onChange={e => setEditingRule({ ...editingRule, review_rationale: e.target.value })}
                  className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0D151C] text-slate-900 dark:text-white leading-relaxed"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Executable TypeScript Snippet</label>
                <textarea
                  rows={3}
                  value={editingRule.rule_code_snippet}
                  onChange={e => setEditingRule({ ...editingRule, rule_code_snippet: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-700 bg-slate-950 font-mono text-teal-300 text-xs leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setEditingRule(null); setEditingIndex(null); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRowEditor}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>Save to Grid</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
