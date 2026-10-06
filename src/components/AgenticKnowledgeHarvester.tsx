import React, { useState, useRef } from 'react';
import { BrainCircuit, UploadCloud, Link as LinkIcon, Database, Check, X, FileText, Activity, AlertCircle, FileUp } from 'lucide-react';
import type { KbProposal } from '../types';

interface AgenticKnowledgeHarvesterProps {
  onApproveProposal: (id: string, doctorNameOrOverrides?: any, mcr?: any) => void;
  onDeleteProposal: (id: string) => void;
}

export const AgenticKnowledgeHarvester: React.FC<AgenticKnowledgeHarvesterProps> = ({
  onApproveProposal,
  onDeleteProposal
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [proposals, setProposals] = useState<KbProposal[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    let combinedText = '';
    for (const file of files) {
      const text = await file.text();
      combinedText += `=== FILE: ${file.name} ===\n${text}\n\n`;
    }
    
    setInputText(prev => prev ? prev + '\n\n' + combinedText : combinedText);
  };

  const handleHarvest = async () => {
    if (!inputUrl && !inputText) return;
    
    setIsProcessing(true);
    setLogs([]);
    setProposals([]);

    try {
      const response = await fetch('/api/agentic/swarm-harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inputData: inputText || inputUrl,
          dataType: inputText ? (inputText.includes(',') ? 'csv' : 'text') : 'url',
          sourceName: inputUrl ? 'URL' : 'Manual Upload'
        })
      });

      if (!response.body) throw new Error('No stream available');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n').filter(Boolean);
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.log) {
              setLogs(prev => [...prev, data.log]);
            }
            if (data.proposals) {
              setProposals(data.proposals);
            }
            if (data.error) {
              setLogs(prev => [...prev, `[ERROR] ${data.error}`]);
            }
          }
        }
      }
    } catch (error: any) {
      setLogs(prev => [...prev, `[ERROR] ${error.message}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-indigo-400" />
            Agentic Knowledge Harvester
          </h2>
          <p className="text-slate-300 max-w-2xl text-sm leading-relaxed">
            Upload clinical guidelines (PDF/Text), triage datasets (CSV), or websites. The multi-agent swarm will automatically read, structure, and propose DB updates for ailments, emergency keywords, and triage rules.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: Ingestion Zone */}
        <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-500" />
            1. Data Ingestion
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Source URL
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://moh.gov.sg/guidelines..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-400 text-xs font-bold uppercase">
              <hr className="flex-1 border-slate-200 dark:border-slate-800" />
              <span>OR Upload / Paste CSV</span>
              <hr className="flex-1 border-slate-200 dark:border-slate-800" />
            </div>

            <div className="relative">
              <div className="absolute top-2 right-2 flex gap-2">
                <input 
                  type="file"
                  accept=".csv,.txt"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors"
                >
                  <FileUp className="w-3 h-3" /> UPLOAD CSV(s)
                </button>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste raw CSV data or clinical guidelines text here..."
                rows={6}
                className="w-full p-4 pt-10 bg-slate-50 dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono text-xs"
              />
            </div>

            <button
              onClick={handleHarvest}
              disabled={isProcessing || (!inputUrl && !inputText)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <><Activity className="w-5 h-5 animate-spin" /> Swarm is Processing...</>
              ) : (
                <><Database className="w-5 h-5" /> Synthesize Knowledge</>
              )}
            </button>
          </div>
        </div>

        {/* Right Col: Swarm Terminal */}
        <div className="bg-[#0A0F14] p-6 rounded-3xl shadow-sm border border-slate-800 space-y-4 flex flex-col h-full min-h-[400px]">
          <h3 className="font-bold text-slate-300 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Swarm Activity Terminal
          </h3>
          <div className="flex-1 bg-black/50 rounded-xl p-4 font-mono text-xs text-slate-400 overflow-y-auto space-y-2 border border-slate-800/50">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">Waiting for swarm execution...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                  <span className={log.includes('[ERROR]') ? 'text-red-400' : 'text-emerald-400'}>{log}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Phase 2: Approval Pipeline */}
      {proposals.length > 0 && (
        <div className="mt-8 space-y-4 animate-fadeIn">
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Check className="w-6 h-6 text-emerald-500" />
            2. Pending DB Mutations
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proposals.map(p => (
              <div key={p.id} className="bg-white dark:bg-[#14212B] border-2 border-emerald-500/20 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      {p.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">{p.rationale || p.proposedChanges}</p>
                  </div>
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-lg uppercase tracking-wider">
                    Pending
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-[#0F1A20] rounded-xl p-3 mb-4 max-h-40 overflow-y-auto font-mono text-[10px] text-slate-600 border border-slate-200 dark:border-slate-800">
                  <pre>{JSON.stringify(p, null, 2)}</pre>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onApproveProposal(p.id, 'Dr. Agentic', 'MCR-AGENT-01')}
                    className="flex-1 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-colors"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => onDeleteProposal(p.id)}
                    className="flex-1 py-2 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-colors"
                  >
                    <X className="w-4 h-4" /> Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
