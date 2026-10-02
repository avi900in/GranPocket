import React, { useState } from 'react';
import { 
  Heart, 
  Clock, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Plus, 
  Thermometer, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Sparkles,
  ShieldAlert,
  PhoneCall,
  ExternalLink,
  Check
} from 'lucide-react';
import type { CheckBackPlan, Person, Language, Severity } from '../types';
import { runTriage } from '../engine/triageEngine';

interface HomeMonitoringViewProps {
  plans: CheckBackPlan[];
  members: Person[];
  selectedPerson: Person;
  onUpdatePlan: (updatedPlan: CheckBackPlan) => void;
  onTriggerReTriage: (person: Person, reason: string, newSeverity: Severity) => void;
  language: Language;
  onRemoveAilment?: (personId: string) => void;
}

export const HomeMonitoringView: React.FC<HomeMonitoringViewProps> = ({
  plans,
  members,
  selectedPerson,
  onUpdatePlan,
  onTriggerReTriage,
  language,
  onRemoveAilment,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || '');
  const currentPlan = plans.find(p => p.id === selectedPlanId) || plans[0];
  const [planResolvedMessage, setPlanResolvedMessage] = useState<string | null>(null);

  // Quick Check-in Response Form
  const [responseChoice, setResponseChoice] = useState<'better' | 'same' | 'worse'>('same');
  const [tempInput, setTempInput] = useState<number>(38.8);
  const [painInput, setPainInput] = useState<number>(4);
  const [checkInNotes, setCheckInNotes] = useState('');

  const targetPerson = members.find(m => m.id === currentPlan?.subjectId) || selectedPerson;
  const isOrangeCase = currentPlan?.initialSeverity === 'ORANGE' || currentPlan?.checkIns.some(ci => ci.escalatedToSeverity === 'ORANGE');

  const handleResolveAilment = () => {
    if (!currentPlan) return;
    const completedPlan: CheckBackPlan = {
      ...currentPlan,
      status: 'completed',
    };
    onUpdatePlan(completedPlan);
    onRemoveAilment?.(targetPerson.id);
    setPlanResolvedMessage(`Ailment resolved! Monitoring plan for ${targetPerson.name} has been closed and removed from active cases.`);
    setTimeout(() => setPlanResolvedMessage(null), 5000);
  };

  const handleRecordCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPlan) return;

    const targetPerson = members.find(m => m.id === currentPlan.subjectId) || selectedPerson;

    // Check for Deterioration Re-Triage (SRS HOME-03, HOME-05)
    let newSeverity: Severity = currentPlan.initialSeverity;
    let deteriorationDetected = false;

    if (responseChoice === 'worse' || tempInput >= 39.5) {
      deteriorationDetected = true;
      newSeverity = tempInput >= 40.0 ? 'RED' : 'ORANGE';
    }

    const updatedCheckIns = [
      {
        id: `ci-${Date.now()}`,
        planId: currentPlan.id,
        sentAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        responseAt: new Date().toISOString(),
        response: responseChoice,
        vitals: {
          temperature: tempInput,
          painLevel: painInput,
          progression: (responseChoice === 'better' ? 'improving' : responseChoice === 'worse' ? 'worsening' : 'stable') as 'improving' | 'stable' | 'worsening',
          notes: checkInNotes,
          timestamp: new Date().toISOString(),
        },
        escalatedToSeverity: deteriorationDetected ? newSeverity : undefined,
      },
      ...currentPlan.checkIns,
    ];

    const updatedPlan: CheckBackPlan = {
      ...currentPlan,
      checkIns: updatedCheckIns,
      status: deteriorationDetected ? 'escalated' : currentPlan.status,
    };

    onUpdatePlan(updatedPlan);

    if (deteriorationDetected) {
      onTriggerReTriage(
        targetPerson,
        `Deterioration detected during check-in: Condition marked as '${responseChoice}' with temperature ${tempInput}°C`,
        newSeverity
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <Heart className="text-rose-600" size={22} />
            <span>Home Monitoring & Dynamic Reassessment</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadence check-backs • "How is [Name] now?" • Automatic deterioration escalation
          </p>
        </div>

        {/* Plan Switcher */}
        {plans.length > 0 && (
          <select
            value={currentPlan?.id || ''}
            onChange={e => setSelectedPlanId(e.target.value)}
            className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
          >
            {plans.map(p => (
              <option key={p.id} value={p.id}>
                {p.subjectName} ({p.status.toUpperCase()})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Resolved Success Toast */}
      {planResolvedMessage && (
        <div className="p-4 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{planResolvedMessage}</span>
        </div>
      )}

      {/* Ongoing Ailment Resolution Card for Monitored Patient */}
      {currentPlan && currentPlan.status === 'active' && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xl shrink-0">
              🤒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-amber-800 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  Active Monitored Ailment
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{targetPerson.name}</span>
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                {targetPerson.activeComplaint || `Monitoring Episode: Initial Triage was ${currentPlan.initialSeverity}`}
              </p>
            </div>
          </div>

          <button
            onClick={handleResolveAilment}
            className="px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-900/20 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
            title="Mark this ailment as resolved and complete active monitoring plan"
          >
            <CheckCircle2 size={15} />
            <span>Resolve & Remove Ailment</span>
          </button>
        </div>
      )}

      {/* ORANGE ALERT: Singapore Teleconsultation Options in Monitoring */}
      {isOrangeCase && (
        <div className="rounded-3xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 sm:p-6 space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white">
                <PhoneCall size={20} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-200/90 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                    Orange Alert • Teleconsultation Recommended
                  </span>
                </div>
                <h3 className="font-heading font-black text-base sm:text-lg text-slate-900 dark:text-slate-100 mt-0.5">
                  Urgent Video Consult with Singapore Doctors
                </h3>
              </div>
            </div>
            <span className="text-xs text-amber-900 dark:text-amber-300 font-extrabold bg-amber-100 dark:bg-amber-900/50 px-3 py-1 rounded-full border border-amber-300 dark:border-amber-700">
              Doctor Queue &lt; 15 mins
            </span>
          </div>

          <p className="text-xs text-slate-700 dark:text-slate-300">
            Condition indicates elevated risk. Initiate an immediate telemedicine consultation with Singapore registered doctors:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#1E2D37] bg-white dark:bg-[#0F1A20] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900 dark:text-white">WhiteCoat</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">MOH Licensed</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">90-min medication delivery • Direct SCDF 995 escalation pathway</p>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href="https://whitecoat.global/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs text-center flex items-center justify-center gap-1 shadow-sm"
                >
                  <span>Connect WhiteCoat</span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href="tel:+6565559448"
                  className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  Call Clinic
                </a>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#1E2D37] bg-white dark:bg-[#0F1A20] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900 dark:text-white">Doctor Anywhere (Dr Anywhere)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">24/7 Standby</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Doorstep meds in 3h • Insurer direct billing (Great Eastern, AIA, Singlife)</p>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href="https://doctoranywhere.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs text-center flex items-center justify-center gap-1 shadow-sm"
                >
                  <span>Connect Dr Anywhere</span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href="tel:+6568175310"
                  className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  Call 24/7
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deterioration Test Callout */}
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2.5">
          <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          <div>
            <span className="font-bold text-rose-950">Deterioration Re-triage Test (HOME-03): </span>
            <span className="text-rose-800">
              Submit a check-in with status <span className="font-extrabold">"Worse"</span> or temperature <span className="font-extrabold">&ge; 39.5°C</span> to trigger auto-escalation!
            </span>
          </div>
        </div>
      </div>

      {currentPlan ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left 2 Cols: Check-in Form & Grandma prompt */}
          <div className="md:col-span-2 space-y-5">
            {/* Grandma Check-In Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-start space-x-3.5 bg-rose-50/60 border border-rose-100 rounded-2xl p-4">
                <div className="text-2xl">👵🏼</div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-500 uppercase">Grandma Check-in:</div>
                  <p className="text-sm font-semibold text-slate-900">
                    How is {currentPlan.subjectName} doing right now? Better, about the same, or worse? Be honest, dear.
                  </p>
                </div>
              </div>

              {/* Response Form */}
              <form onSubmit={handleRecordCheckIn} className="space-y-4 pt-2">
                {/* 3 Choice Buttons: Better / Same / Worse */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">
                    Current Condition:
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setResponseChoice('better')}
                      className={`p-3.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center space-y-1 ${
                        responseChoice === 'better'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <TrendingDown size={20} className="text-emerald-600" />
                      <span className="text-xs sm:text-sm">Better</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setResponseChoice('same')}
                      className={`p-3.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center space-y-1 ${
                        responseChoice === 'same'
                          ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Minus size={20} className="text-amber-600" />
                      <span className="text-xs sm:text-sm">About Same</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setResponseChoice('worse')}
                      className={`p-3.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center space-y-1 ${
                        responseChoice === 'worse'
                          ? 'border-rose-500 bg-rose-50 text-rose-900 font-bold shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <TrendingUp size={20} className="text-rose-600" />
                      <span className="text-xs sm:text-sm">Worse</span>
                    </button>
                  </div>
                </div>

                {/* Vitals: Temperature & Pain Level */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                      <Thermometer size={13} className="text-teal-600" />
                      <span>Temperature (°C)</span>
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      min={35}
                      max={43}
                      value={tempInput}
                      onChange={e => setTempInput(Number(e.target.value))}
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-teal-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Pain / Distress (1-10)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={painInput}
                      onChange={e => setPainInput(Number(e.target.value))}
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-teal-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Observations / Fluid Intake</label>
                  <input
                    type="text"
                    value={checkInNotes}
                    onChange={e => setCheckInNotes(e.target.value)}
                    placeholder="e.g. Took some milk, forehead still warm"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-500"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all"
                  >
                    Submit Check-in Log
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Col: Plan Info & Timeline */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Clock size={15} className="text-teal-700" />
                <span>Monitoring Cadence</span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>Interval: <span className="font-bold text-slate-900">{currentPlan.interval}</span></div>
                <div>Status: <span className="font-bold text-teal-700 uppercase">{currentPlan.status}</span></div>
                <div>Initial Triage: <span className="font-bold text-amber-700">{currentPlan.initialSeverity}</span></div>
              </div>
            </div>

            {/* Check-ins Timeline */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Check-in History ({currentPlan.checkIns.length})
              </div>
              <div className="space-y-2.5">
                {currentPlan.checkIns.map(ci => (
                  <div key={ci.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="capitalize">{ci.response || 'Pending'}</span>
                      <span className="font-mono text-slate-500">
                        {ci.vitals?.temperature ? `${ci.vitals.temperature}°C` : ''}
                      </span>
                    </div>
                    {ci.vitals?.notes && (
                      <div className="text-slate-600 text-[11px]">{ci.vitals.notes}</div>
                    )}
                    {ci.escalatedToSeverity && (
                      <div className="text-rose-700 font-bold text-[11px] flex items-center space-x-1 mt-1">
                        <ShieldAlert size={12} />
                        <span>Escalated to {ci.escalatedToSeverity}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-400">
          No active monitoring cases. Complete a triage assessment to initiate a check-back plan.
        </div>
      )}
    </div>
  );
};
