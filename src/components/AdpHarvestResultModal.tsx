import React, { useState } from 'react';
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
  FileCode2, 
  Terminal, 
  CheckCircle2, 
  ArrowRight,
  Stethoscope,
  Code2,
  Clock,
  Coins,
  Cpu
} from 'lucide-react';

interface AdpHarvestedRule {
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
}

interface WorkflowNode {
  nodeId: string;
  nodeName: string;
  status: string;
  elapsedMs: number;
  tokens: number;
  content: string;
  outputRef?: string;
}

interface AdpHarvestResult {
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
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [ingestedIds, setIngestedIds] = useState<Record<string, boolean>>({});
  const [isIngestingAll, setIsIngestingAll] = useState(false);
  const [expandedNodeIndex, setExpandedNodeIndex] = useState<number | null>(0);

  if (!isOpen) return null;

  const handleCopyRaw = () => {
    if (!result) return;
    const textToCopy = result.rawOutput || JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const handleIngestSingle = async (rule: AdpHarvestedRule) => {
    if (onIngestRules) {
      await onIngestRules([rule]);
      setIngestedIds(prev => ({ ...prev, [rule.knowledge_id]: true }));
    }
  };

  const handleIngestAll = async () => {
    if (!result?.parsedRules?.length || !onIngestRules) return;
    setIsIngestingAll(true);
    try {
      await onIngestRules(result.parsedRules);
      const allIds: Record<string, boolean> = {};
      result.parsedRules.forEach(r => {
        allIds[r.knowledge_id] = true;
      });
      setIngestedIds(allIds);
    } finally {
      setIsIngestingAll(false);
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0D151C] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#111C24]/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Agentic ADP Multi-Agent Output
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Tencent Cloud ADP v2
                </span>
                {result?.elapsedMs && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    <Clock size={11} />
                    {(result.elapsedMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="font-mono text-[11px] truncate max-w-sm" title={targetUrl}>
                  {targetUrl}
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="py-16 px-4 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <Sparkles size={28} className="animate-pulse" />
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  Executing Agentic ADP 4-Agent Workflow
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Calling <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">https://wss.lke.tencentcloud.com/adp/v2/chat</code> to scrape target URL and coordinate clinical multi-agent synthesis.
                </p>
              </div>

              {/* Workflow Stepper */}
              <div className="w-full max-w-xl bg-slate-50 dark:bg-[#121E27] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-left space-y-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Active Multi-Agent Orchestration Chain
                </div>
                <div className="space-y-2.5">
                  {[
                    { title: '1. Web Evidence Acquisition Agent', desc: 'Scraping content via Firecrawl & parsing evidence statements' },
                    { title: '2. Clinical Rule Compiler', desc: 'Compiling deterministic triage acuity & constraints' },
                    { title: '3. Medical Reviewer Agent', desc: 'Evaluating safety boundaries & clinical risks' },
                    { title: '4. Knowledge Database Agent', desc: 'Mapping schema for production KB proposals table' }
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
              {/* Top Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('rules')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                      activeTab === 'rules'
                        ? 'bg-teal-600 text-white shadow-md'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <ShieldCheck size={14} />
                    <span>Harvested Rules ({result.parsedRules?.length || 0})</span>
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
                    <span>Raw SSE / JSON Output</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyRaw}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    {copiedRaw ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copiedRaw ? 'Copied' : 'Copy Raw Output'}</span>
                  </button>

                  {result.parsedRules?.length > 0 && onIngestRules && (
                    <button
                      onClick={handleIngestAll}
                      disabled={isIngestingAll}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isIngestingAll ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />}
                      <span>Ingest All to KB Proposals</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tab 1: Harvested Rules Cards */}
              {activeTab === 'rules' && (
                <div className="space-y-4 animate-fadeIn">
                  {result.parsedRules?.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {result.parsedRules.map((rule, idx) => {
                        const isIngested = ingestedIds[rule.knowledge_id];
                        const isApproved = rule.review_decision === 'APPROVE';
                        const isCondition = rule.review_decision === 'APPROVE_WITH_CONDITIONS';
                        const isEscalate = rule.review_decision === 'ESCALATE_TO_HUMAN_PHYSICIAN';
                        const isRevision = rule.review_decision === 'REQUEST_REVISION';

                        return (
                          <div 
                            key={rule.knowledge_id || idx}
                            className="bg-slate-50/80 dark:bg-[#111D25] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-3 hover:border-teal-500/50 transition-all shadow-sm"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800/80 pb-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                    {rule.knowledge_id}
                                  </span>
                                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                    {rule.title}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                                  <span>Domain: <strong>{rule.verified_source}</strong></span>
                                  <span>•</span>
                                  <span>Tier: <strong>{rule.target_tier}</strong></span>
                                  <span>•</span>
                                  <span>Age: <strong>{rule.age_band}</strong></span>
                                  <span>•</span>
                                  <span>Confidence: <strong>{rule.confidence_score}%</strong></span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                                  isApproved 
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                    : isCondition
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                    : isEscalate
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                    : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                                }`}>
                                  {rule.review_decision || 'REVIEW_PENDING'}
                                </span>

                                {onIngestRules && (
                                  <button
                                    onClick={() => handleIngestSingle(rule)}
                                    disabled={isIngested}
                                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                      isIngested
                                        ? 'bg-emerald-500 text-white cursor-default'
                                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
                                    }`}
                                  >
                                    {isIngested ? (
                                      <>
                                        <Check size={12} />
                                        <span>Ingested</span>
                                      </>
                                    ) : (
                                      <>
                                        <Database size={12} />
                                        <span>Save to Proposals</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Rationale & Reviewer Assessment */}
                            <div className="space-y-2 text-xs">
                              <div>
                                <span className="font-bold text-slate-700 dark:text-slate-300">Clinical Rationale: </span>
                                <span className="text-slate-600 dark:text-slate-400">{rule.rationale}</span>
                              </div>

                              {rule.review_rationale && (
                                <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400">Medical Reviewer Note: </span>
                                  <span className="text-slate-600 dark:text-slate-300">{rule.review_rationale}</span>
                                </div>
                              )}

                              {rule.identified_risks && rule.identified_risks.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    <span>Identified Safety & Clinical Risks:</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {rule.identified_risks.map((risk, rIdx) => (
                                      <span 
                                        key={rIdx}
                                        className="text-[10px] bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-900/60 px-2 py-0.5 rounded-md"
                                      >
                                        • {risk}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Rule Code Snippet */}
                              {rule.rule_code_snippet && (
                                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                                  <div className="bg-slate-200/70 dark:bg-slate-800/80 px-3 py-1 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                                    <span>Deterministic TypeScript Snippet</span>
                                    <Code2 size={12} />
                                  </div>
                                  <pre className="p-2.5 bg-slate-900 text-teal-300 text-[11px] font-mono overflow-x-auto">
                                    {rule.rule_code_snippet}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 dark:bg-[#121E27] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <AlertTriangle size={24} className="text-amber-500 mx-auto" />
                      <div className="text-sm font-bold text-slate-800 dark:text-white">
                        No Structured Rules Extracted
                      </div>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        The ADP multi-agent workflow completed, but did not return standard rule records in the final step. Review the "4-Agent Workflow Steps" or "Raw SSE" tab to inspect the raw agent thoughts.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Workflow Nodes Timeline */}
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
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#111C24]/80 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {result?.parsedRules?.length ? (
              <span>
                <strong>{result.parsedRules.length}</strong> clinical red-line candidate rule(s) harvested
              </span>
            ) : (
              <span>Ready</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Close
            </button>
            {result && (
              <button
                onClick={handleCopyRaw}
                className="px-4 py-2 text-xs font-bold text-slate-900 dark:text-white bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
              >
                {copiedRaw ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copiedRaw ? 'Copied' : 'Copy Output'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
