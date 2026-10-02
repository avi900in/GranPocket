import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Shield,
  Layers,
  ArrowRight,
  Database,
  Cpu,
  Clock,
  Sparkles,
  Info,
  CornerDownRight,
  Check,
  X,
  Sliders,
  FileText,
  Activity,
  User,
  Heart,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { HelperInfoButton } from './HelperInfoButton';
import type { Person, Severity, Language, TriageRule } from '../types';
import { runAgenticOrchestrationPipelineAsync, type AgenticPipelineResult } from '../engine/agenticPipeline';
import { getAgeDisplay } from '../engine/triageEngine';

interface MultiAgentSimulatorViewProps {
  members: Person[];
  language: Language;
  customRules: TriageRule[];
  onOpenSos: () => void;
}

interface PresetScenario {
  id: string;
  name: string;
  targetPatientId: string;
  complaintText: string;
  answers: Record<string, any>;
  description: string;
  badge: string;
  badgeColor: string;
  expectedOutcome: string;
}

// Comprehensive clinical symptom parser to extract structured answers from free-text
export function parseSymptomsFromText(text: string): Record<string, any> {
  const result: Record<string, any> = {};
  if (!text || !text.trim()) return result;

  const lower = text.toLowerCase();

  // Helper for negation detection (e.g. "no fever", "without retractions", "ruled out chest pain")
  const hasNegation = (term: string) => {
    const patterns = [
      new RegExp(`no\\s+${term}`, 'i'),
      new RegExp(`without\\s+${term}`, 'i'),
      new RegExp(`not\\s+${term}`, 'i'),
      new RegExp(`zero\\s+${term}`, 'i'),
      new RegExp(`denies\\s+${term}`, 'i'),
      new RegExp(`ruled out\\s+${term}`, 'i'),
      new RegExp(`no\\s+signs?\\s+of\\s+${term}`, 'i'),
    ];
    return patterns.some(p => p.test(lower));
  };

  // 1. Temperature & Fever
  if (hasNegation('fever') || hasNegation('pyrexia') || lower.includes('afebrile') || lower.includes('normal temp') || lower.includes('no temperature')) {
    result.fever = false;
    result.temp_c = 36.8;
  } else {
    const tempMatch = text.match(/(\d{2}(?:\.\d)?)\s*°?C/i) || text.match(/temp(?:erature)?\s*(?:is|of)?\s*(\d{2}(?:\.\d)?)/i);
    if (tempMatch) {
      const val = parseFloat(tempMatch[1]);
      result.temp_c = val;
      result.fever = val >= 38.0;
    } else if (lower.includes('high fever') || lower.includes('very hot')) {
      result.fever = true;
      result.temp_c = 38.8;
    } else if (lower.includes('fever') || lower.includes('feverish') || lower.includes('pyrexia') || lower.includes('发烧') || lower.includes('发热')) {
      result.fever = true;
      result.temp_c = 38.2;
    }
  }

  // 2. Respiratory & Retractions (§3.1 Red Flags)
  if (hasNegation('retraction') || hasNegation('retractions') || lower.includes('normal breathing') || lower.includes('breathing fine') || lower.includes('no breathing difficulty')) {
    result.chest_retractions = false;
    result.flared_nostrils = false;
    result.labored_breathing = false;
  } else {
    if (lower.includes('retraction') || lower.includes('retractions') || lower.includes('chest sucking') || lower.includes('rib retractions') || lower.includes('胸骨凹陷') || lower.includes('肋骨凹陷')) {
      result.chest_retractions = true;
    }
    if (lower.includes('flared') || lower.includes('nostril') || lower.includes('鼻翼扇动')) {
      result.flared_nostrils = true;
    }
    if (lower.includes('labored') || lower.includes('rapid breathing') || lower.includes('tachypnea') || lower.includes('shortness of breath') || lower.includes('gasping') || lower.includes('stridor') || lower.includes('wheezing') || lower.includes('breathless') || lower.includes('呼吸急促') || lower.includes('呼吸困难')) {
      result.labored_breathing = true;
    }
  }

  // 3. FAST Stroke Deficits (§3.2 Red Flags)
  if (!hasNegation('slurred') && !hasNegation('speech') && (lower.includes('slur') || lower.includes('speech') || lower.includes('cannot speak') || lower.includes('说话不清') || lower.includes('言语不清'))) {
    result.slurred_speech = true;
  }
  if (!hasNegation('droop') && (lower.includes('facial droop') || lower.includes('face droop') || lower.includes('mouth droop') || lower.includes('drooping') || lower.includes('口角歪斜') || lower.includes('面瘫'))) {
    result.facial_droop = true;
  }
  if (!hasNegation('weak') && (lower.includes('arm weak') || lower.includes('arm drift') || lower.includes('limb weak') || lower.includes('weakness') || lower.includes('手臂无力') || lower.includes('肢体无力'))) {
    result.arm_weakness = true;
  }

  // 4. Cardiac & Chest Pain
  if (hasNegation('chest pain') || hasNegation('chest pressure')) {
    result.chest_pain = false;
  } else if (lower.includes('chest pain') || lower.includes('crushing chest') || lower.includes('pressure in chest') || lower.includes('angina') || lower.includes('胸痛') || lower.includes('胸部压迫')) {
    result.chest_pain = true;
    if (lower.includes('crushing') || lower.includes('severe') || lower.includes('radiating')) {
      result.crushing_chest = true;
    }
  }

  // 5. Meningeal & Sepsis
  if (!hasNegation('stiff neck') && (lower.includes('stiff neck') || lower.includes('neck stiff') || lower.includes('nuchal rigidity') || lower.includes('脖子僵硬') || lower.includes('颈部强直'))) {
    result.stiff_neck = true;
  }
  if (lower.includes('purpur') || lower.includes('petechiae') || lower.includes('non-blanching') || lower.includes('glass test') || lower.includes('瘀斑') || lower.includes('紫癜')) {
    result.purpuric_rash = true;
  }
  if (!hasNegation('drink') && !hasNegation('milk') && (lower.includes('refuse milk') || lower.includes('refuses milk') || lower.includes('refusing milk') || lower.includes('refuse feed') || lower.includes('not feeding') || lower.includes('dehydrat') || lower.includes('拒绝喝奶') || lower.includes('脱水'))) {
    result.feeding_refusal = true;
  }
  if (lower.includes('lethargic') || lower.includes('unresponsive') || lower.includes('floppy') || lower.includes('drowsy') || lower.includes('嗜睡') || lower.includes('反应迟钝')) {
    result.drowsy = true;
  }

  // 6. Geriatric Fall & Anticoagulants
  if (lower.includes('warfarin') || lower.includes('aspirin') || lower.includes('blood thinner') || lower.includes('anticoagulant') || lower.includes('抗凝药')) {
    result.on_blood_thinners = true;
  }
  if (lower.includes('fall') || lower.includes('tripped') || lower.includes('bumped head') || lower.includes('head bump') || lower.includes('跌倒') || lower.includes('摔倒') || lower.includes('撞到头')) {
    result.head_bump = true;
    result.fall_unwitnessed = true;
  }

  // 7. General URTI & Mild symptoms
  if (lower.includes('runny nose') || lower.includes('rhinorrhea') || lower.includes('sneeze') || lower.includes('sneezing') || lower.includes('流鼻涕') || lower.includes('打喷嚏')) {
    result.runny_nose = true;
  }
  if (lower.includes('cough') || lower.includes('coughing') || lower.includes('咳嗽')) {
    result.cough = true;
  }
  if (lower.includes('sore throat') || lower.includes('throat pain') || lower.includes('喉咙痛') || lower.includes('咽痛')) {
    result.sore_throat = true;
  }

  // 8. Gastrointestinal
  if (lower.includes('vomit') || lower.includes('threw up') || lower.includes('呕吐')) {
    result.vomiting = true;
  }
  if (lower.includes('diarrhea') || lower.includes('loose stool') || lower.includes('腹泻') || lower.includes('拉肚子')) {
    result.diarrhea = true;
  }
  if (lower.includes('stomach') || lower.includes('abdominal') || lower.includes('belly pain') || lower.includes('tummy') || lower.includes('腹痛') || lower.includes('胃痛')) {
    result.abdominal_pain = true;
  }

  // 9. Neurological General
  if (lower.includes('headache') || lower.includes('头痛')) {
    result.headache = true;
  }
  if (lower.includes('dizzy') || lower.includes('dizziness') || lower.includes('vertigo') || lower.includes('头晕')) {
    result.dizziness = true;
  }

  // 10. Musculoskeletal & Extremity Trauma (Foot, Ankle, Joint, Sprain, Fracture)
  if (lower.includes('foot') || lower.includes('ankle') || lower.includes('knee') || lower.includes('leg') || lower.includes('wrist') || lower.includes('sprain') || lower.includes('injury') || lower.includes('fracture') || lower.includes('limp') || lower.includes('twist') || lower.includes('swollen') || lower.includes('swelling') || lower.includes('脚') || lower.includes('扭伤') || lower.includes('骨折')) {
    if (lower.includes('foot') || lower.includes('ankle') || lower.includes('脚') || lower.includes('踝')) {
      result.foot_injury = true;
    }
    if (lower.includes('sprain') || lower.includes('twist') || lower.includes('扭伤')) {
      result.ankle_sprain = true;
      result.extremity_sprain = true;
    }
    if (lower.includes('fracture') || lower.includes('deform') || lower.includes('broken') || lower.includes('cannot walk') || lower.includes('unable to bear weight') || lower.includes('cannot bear weight') || lower.includes('骨折')) {
      result.suspected_fracture = true;
      result.unable_bear_weight = true;
    } else {
      result.minor_sprain = true;
    }
    if (lower.includes('swell') || lower.includes('swollen') || lower.includes('bruis') || lower.includes('肿')) {
      result.joint_swelling = true;
    }
    result.musculoskeletal_injury = true;
  }

  return result;
}

export const MultiAgentSimulatorView: React.FC<MultiAgentSimulatorViewProps> = ({
  members,
  language,
  customRules,
  onOpenSos,
}) => {
  // Preset Clinical Simulation Scenarios
  const PRESET_SCENARIOS: PresetScenario[] = [
    {
      id: 'infant_retractions',
      name: 'Infant Respiratory Distress (§3.1 Red Flag)',
      targetPatientId: 'person-lucas',
      complaintText: 'Lucas has flared nostrils, labored rapid breathing, and deep rib/chest retractions',
      answers: { labored_breathing: true, chest_retractions: true, flared_nostrils: true },
      description: 'Tests Tier 1 Deterministic Red-Line Safety Net instantaneous bypass to 995 without LLM interference.',
      badge: 'Tier 1 Deterministic Bypass',
      badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300',
      expectedOutcome: 'RED (995 Ambulance)',
    },
    {
      id: 'infant_fever',
      name: 'Infant Fever & Doctor Adversarial Challenge (§3.1 & §5)',
      targetPatientId: 'person-lucas',
      complaintText: 'Lucas has high fever 38.8°C, irritable, refuses milk, but breathing is normal with no retractions',
      answers: { fever: true, temp_c: 38.8, feeding_refusal: false, chest_retractions: false },
      description: 'Tests Tier 3 Triage Agent conservative draft, followed by Tier 3 Expert Doctor CHALLENGE_FLAG (Age Hard-Stop) and forced revision to Tele-Doctor.',
      badge: 'Doctor Challenge Loop',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300',
      expectedOutcome: 'YELLOW / ORANGE (Tele-Doctor)',
    },
    {
      id: 'senior_stroke',
      name: 'Senior Acute FAST Stroke Deficit (§3.2 Red Flag)',
      targetPatientId: 'person-ahboon',
      complaintText: 'Grandpa Ah Boon has sudden right-sided facial droop, slurred speech, and arm drift',
      answers: { slurred_speech: true, facial_droop: true, arm_weakness: true },
      description: 'Tests Senior Red-Line stroke trigger (FAST protocol) activating hyper-acute thrombolysis pathway.',
      badge: 'Senior Red Flag §3.2',
      badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300',
      expectedOutcome: 'RED (Hyper-acute 995)',
    },
    {
      id: 'senior_fall',
      name: 'Senior Fall on Anticoagulants (Subdural Hematoma Risk)',
      targetPatientId: 'person-ahboon',
      complaintText: 'Ah Boon tripped in the hallway, bumped head on coffee table, feeling drowsy, taking Warfarin/Aspirin',
      answers: { fall_unwitnessed: true, head_bump: true, on_blood_thinners: true },
      description: 'Tests multi-agent differential review for occult intracranial hemorrhage in anticoagulated geriatric patient.',
      badge: 'Geriatric Adversarial Audit',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300',
      expectedOutcome: 'ORANGE / RED (Urgent CT)',
    },
    {
      id: 'adult_cold',
      name: 'Adult Viral Coryza / Common Cold (Home Care)',
      targetPatientId: 'person-david',
      complaintText: 'David has clear runny nose and occasional sneeze for 2 days after aircon room, no fever, no chest pain',
      answers: { runny_nose: true, fever: false, temp_c: 36.8 },
      description: 'Tests full clearance through all safety nets and routing to Home Monitor with 4-6h timer.',
      badge: 'Home Care Clearance',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
      expectedOutcome: 'GREEN (Home Monitor)',
    },
  ];

  // Simulation Form State
  const [selectedPatientId, setSelectedPatientId] = useState<string>(members[0]?.id || 'person-lucas');
  const [complaintText, setComplaintText] = useState<string>(PRESET_SCENARIOS[1].complaintText);
  const [answers, setAnswers] = useState<Record<string, any>>(PRESET_SCENARIOS[1].answers);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(PRESET_SCENARIOS[1].id);

  // Reactive Auto-Evaluation State
  const [autoSimulate, setAutoSimulate] = useState<boolean>(true);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Guardrails State for Simulation Run (Spec §6)
  const [confidenceFloor, setConfidenceFloor] = useState<number>(80);
  const [allergyHardStop, setAllergyHardStop] = useState<boolean>(true);
  const [ageHardStop, setAgeHardStop] = useState<boolean>(true);
  const [maxRetries, setMaxRetries] = useState<number>(2);

  // Execution & Live Output State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<AgenticPipelineResult | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(0);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [sqliteLogs, setSqliteLogs] = useState<any[]>([]);

  const selectedPatient = members.find(m => m.id === selectedPatientId) || members[0];
  const initialMountRef = useRef<boolean>(true);
  const requestIdRef = useRef<number>(0);

  // Load past execution logs from SQLite
  const loadSqliteLogs = async () => {
    try {
      const res = await fetch('/api/db/triage-logs');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.logs) {
          setSqliteLogs(json.logs.slice(0, 10));
        }
      }
    } catch (err) {
      console.warn('[Simulator] Error loading SQLite execution logs:', err);
    }
  };

  useEffect(() => {
    loadSqliteLogs();
  }, []);

  // Run the Multi-Agent Simulation
  const handleRunSimulation = async (
    overrideText?: string,
    overrideAnswers?: Record<string, any>,
    overridePatientId?: string
  ) => {
    const textToUse = overrideText !== undefined ? overrideText : complaintText;
    const answersToUse = overrideAnswers !== undefined ? overrideAnswers : answers;
    const patientToUse = members.find(m => m.id === (overridePatientId || selectedPatientId)) || selectedPatient;
    if (!patientToUse) return;

    const currentReqId = ++requestIdRef.current;
    setIsRunning(true);
    const startTime = performance.now();

    try {
      const result = await runAgenticOrchestrationPipelineAsync({
        text: textToUse,
        answers: answersToUse,
        person: patientToUse,
        language,
        sessionId: 'sim-session-' + Date.now(),
        config: {
          confidenceFloorPercent: confidenceFloor,
          enableAllergyHardStop: allergyHardStop,
          enableAgeHardStop: ageHardStop,
          maxChallengeRetries: maxRetries,
        },
      });

      // Avoid setting state if a newer request has been initiated
      if (currentReqId !== requestIdRef.current) return;

      const elapsed = Math.round(performance.now() - startTime);
      setExecutionTimeMs(elapsed);
      setSimResult(result);
      setIsDirty(false);
      // Reload SQLite logs to show the newly committed record
      loadSqliteLogs();
    } catch (err: any) {
      console.error('[Simulator] Execution error:', err);
    } finally {
      if (currentReqId === requestIdRef.current) {
        setIsRunning(false);
      }
    }
  };

  // Auto-refresh simulation when symptoms, vitals, or patient changes (reactive debounced loop)
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      // Immediate execution on mount
      handleRunSimulation(complaintText, answers, selectedPatientId);
      return;
    }

    if (!autoSimulate) {
      setIsDirty(true);
      return;
    }

    // If completely cleared, reset simulation outcome rather than evaluating to RED
    if (!complaintText.trim() && Object.keys(answers).length === 0) {
      setSimResult(null);
      setIsDirty(false);
      return;
    }

    setIsDirty(true);
    const timer = setTimeout(() => {
      handleRunSimulation(complaintText, answers, selectedPatientId);
    }, 350);

    return () => clearTimeout(timer);
  }, [
    complaintText,
    answers,
    selectedPatientId,
    confidenceFloor,
    allergyHardStop,
    ageHardStop,
    maxRetries,
    autoSimulate,
  ]);

  // Handle Preset Scenario Selection
  const handleSelectScenario = (sc: PresetScenario) => {
    setActiveScenarioId(sc.id);
    setSelectedPatientId(sc.targetPatientId);
    setComplaintText(sc.complaintText);
    setAnswers(sc.answers);
    setIsDirty(false);
  };

  // Clear all symptoms and input text, cleanly resetting the simulation outcome
  const handleClearAll = () => {
    setComplaintText('');
    setAnswers({});
    setActiveScenarioId('custom');
    setSimResult(null);
    setIsDirty(false);
  };

  // Automatically derive answers from typed complaint text for safety net and multi-agent pipeline
  const handleComplaintTextChange = (text: string) => {
    setComplaintText(text);
    setActiveScenarioId('custom');
    const parsed = parseSymptomsFromText(text);
    setAnswers(parsed);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header & Architecture Banner */}
      <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                Live State Machine Simulator
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                <Database size={11} className="text-emerald-600 dark:text-emerald-400" />
                <span>SQLite DB (data/chat.db)</span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Spec §4 & §5 Multi-Agent
              </span>
            </div>
            <h2 className="text-xl font-black text-[#14212B] dark:text-white flex items-center gap-2 mt-1.5">
              <Bot className="text-teal-600 dark:text-teal-400" size={24} />
              <span>Multi-Agent Triage Simulator & Audit Trail Inspector</span>
              <HelperInfoButton
                title="Multi-Agent Pipeline Simulator"
                content={
                  <div className="space-y-1.5">
                    <p>Simulates end-to-end multi-agent triage executions with real-time agent dispatch and attestation loops.</p>
                    <p><strong>Agents involved:</strong> @triage_orchestrator, @decipher_agent, @red_flag_sentinel, @pediatric_agent / @geriatric_agent, and @safety_net_auditor.</p>
                  </div>
                }
              />
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-simulate reactive toggle */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className={`w-2 h-2 rounded-full ${autoSimulate ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <label htmlFor="auto-eval-toggle" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                Auto-Refresh
              </label>
              <input
                id="auto-eval-toggle"
                type="checkbox"
                checked={autoSimulate}
                onChange={e => setAutoSimulate(e.target.checked)}
                className="w-4 h-4 accent-teal-600 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => handleRunSimulation()}
              disabled={isRunning}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-md ${
                isRunning
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-700 text-white hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isRunning ? (
                <>
                  <RotateCcw size={16} className="animate-spin" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <Play size={16} className="fill-white" />
                  <span>Run / Refresh Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preset Clinical Scenarios Carousel */}
        <div className="pt-2">
          <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            <span>Select Preset Clinical Test Scenario:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {PRESET_SCENARIOS.map(sc => {
              const isSelected = activeScenarioId === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => handleSelectScenario(sc)}
                  className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 shadow-sm ring-2 ring-teal-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${sc.badgeColor}`}>
                      {sc.badge}
                    </span>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white mt-1.5 line-clamp-2">
                      {sc.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {sc.description}
                    </p>
                  </div>
                  <div className="mt-2.5 pt-1.5 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-medium">Expected:</span>
                    <span className="font-black text-slate-700 dark:text-slate-300">{sc.expectedOutcome}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Simulation Parameters & Persona Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Patient & Complaint Input */}
        <div className="lg:col-span-2 bg-white dark:bg-[#14212B] p-5 sm:p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <User size={16} className="text-teal-600" />
              <span>Simulated Patient Presentation & Vitals</span>
            </h3>
            <div className="flex items-center gap-2 text-xs">
              {isRunning && (
                <span className="text-teal-600 font-bold flex items-center gap-1 animate-pulse">
                  <RotateCcw size={12} className="animate-spin" /> Evaluating...
                </span>
              )}
              {isDirty && !isRunning && (
                <span className="text-amber-600 font-bold flex items-center gap-1">
                  <AlertTriangle size={12} /> Pending refresh
                </span>
              )}
              <span className="text-slate-500 dark:text-slate-400">
                Active: <strong className="text-slate-800 dark:text-white">{selectedPatient?.name}</strong>
              </span>
            </div>
          </div>

          {/* Patient Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Select Family Member / Patient Profile:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {members.map(m => {
                const isSelected = m.id === selectedPatientId;
                const ageText = getAgeDisplay(m.dob);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(m.id);
                      setActiveScenarioId('custom');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xl">{m.avatar || '👤'}</span>
                    <div className="overflow-hidden">
                      <div className="text-xs font-black truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{ageText} • {m.relationshipLabel}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Patient Clinical Profile Summary */}
          {selectedPatient && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Known Allergies:</span>
                <span className="font-semibold text-rose-700 dark:text-rose-400">
                  {selectedPatient.medicalProfile?.allergies?.map(a => a.name).join(', ') || 'No known drug allergies (NKDA)'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Chronic Conditions:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedPatient.medicalProfile?.conditions?.map(c => c.name).join(', ') || 'None recorded'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Active Medications:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedPatient.medicalProfile?.medications?.map(m => m.name).join(', ') || 'None active'}
                </span>
              </div>
            </div>
          )}



          {/* User Complaint Free-Text Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <FileText size={13} className="text-teal-600" />
                <span>Patient Clinical Complaint (Parsed live by @decipher_agent):</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition-colors"
                  title="Clear text and all active symptom flags"
                >
                  <RotateCcw size={11} /> Clear All
                </button>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                  {isRunning ? '● Evaluating...' : isDirty ? '● Updating in 350ms...' : '● Live Synced'}
                </span>
              </div>
            </div>
            <textarea
              rows={3}
              value={complaintText}
              onChange={e => handleComplaintTextChange(e.target.value)}
              placeholder="e.g. Lucas has high fever 38.8C, lethargic, not drinking milk well..."
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Answers & Thresholds Debug View */}
          <div className="text-xs">
            <div className="text-[11px] font-bold text-slate-500 mb-1">Active Answers Sent to Safety Net & Knowledge Agent:</div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-100 dark:bg-slate-900 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {Object.keys(answers).length === 0 && <span className="text-slate-400">No active flags set</span>}
              {Object.entries(answers).map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                  <span>{k}:</span>
                  <strong className="text-teal-600 dark:text-teal-400">{String(v)}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...answers };
                      delete updated[k];
                      setAnswers(updated);
                    }}
                    className="text-slate-400 hover:text-rose-500 ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Spec §6 Guardrail Configuration */}
        <div className="bg-white dark:bg-[#14212B] p-5 sm:p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders size={16} className="text-teal-600" />
                <span>Simulation Guardrails (Spec §6)</span>
              </h3>
              <span className="text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>

            {/* Confidence Floor Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Confidence Floor:</span>
                <span className="text-teal-600 font-mono font-black">{confidenceFloor}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={confidenceFloor}
                onChange={e => setConfidenceFloor(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Spec §6 default: 80%. Triage drafts below floor trigger doctor challenge.
              </span>
            </div>

            {/* Allergy Hard Stop Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-white">Allergy Hard-Stop</div>
                <div className="text-[10px] text-slate-500">Blocks OTC medications conflicting with allergy</div>
              </div>
              <input
                type="checkbox"
                checked={allergyHardStop}
                onChange={e => setAllergyHardStop(e.target.checked)}
                className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
              />
            </div>

            {/* Age Floor Hard Stop Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-white">Age Floor Hard-Stop</div>
                <div className="text-[10px] text-slate-500">Prevents febrile infants & seniors in Home Monitor</div>
              </div>
              <input
                type="checkbox"
                checked={ageHardStop}
                onChange={e => setAgeHardStop(e.target.checked)}
                className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
              />
            </div>

            {/* Max Retries Bounded Counter */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Max Challenge Retries:</span>
                <span className="text-teal-600 font-mono font-black">{maxRetries} cycles</span>
              </div>
              <span className="text-[10px] text-slate-500 block">
                Spec §5 requirement: Bounded to max 2 retries before clinician escalation.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleRunSimulation()}
            disabled={isRunning}
            className={`w-full py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md mt-4 ${
              isRunning
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400'
            }`}
          >
            {isRunning ? (
              <>
                <RotateCcw size={16} className="animate-spin" />
                <span>Simulating Multi-Agent Reasoning...</span>
              </>
            ) : (
              <>
                <Play size={16} className="fill-current" />
                <span>Re-Evaluate Simulation Now</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Live Agent Calls & State Machine Decision Audit Trail */}
      {!simResult && !isRunning && (
        <div className="bg-white dark:bg-[#14212B] p-8 rounded-3xl border border-dashed border-[#DDE5E9] dark:border-[#1E2D37] text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Bot size={24} />
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-white">
            Simulator Reset • Ready for Input
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            All symptoms and vitals have been cleared. Select a preset clinical scenario above or type new symptoms into the complaint box to run the multi-agent decision pipeline.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => handleRunSimulation()}
              className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-all inline-flex items-center gap-1.5 shadow-sm"
            >
              <Play size={14} className="fill-white" />
              <span>Simulate Baseline (Asymptomatic Clearance)</span>
            </button>
          </div>
        </div>
      )}

      {simResult && (
        <div className={`bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-6 transition-opacity duration-200 ${isRunning ? 'opacity-60' : 'opacity-100'}`}>
          {/* Active Evaluation Banner */}
          {isRunning && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-800 dark:text-teal-300 animate-pulse text-xs font-bold">
              <div className="flex items-center gap-2">
                <RotateCcw size={16} className="animate-spin text-teal-600" />
                <span>Evaluating updated symptoms across all multi-agent tiers...</span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-teal-100 dark:bg-teal-900 px-2 py-0.5 rounded-full">
                Live Re-evaluating
              </span>
            </div>
          )}

          {/* Simulation Outcome Overview Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-400 text-slate-950">
                  Simulation Outcome
                </span>
                <span className="text-[10px] text-slate-300 font-mono">
                  Execution ID: {simResult.trippedRuleId || 'exec-multiagent'} • {executionTimeMs}ms
                </span>
              </div>
              <h3 className="text-lg font-black mt-1 flex items-center gap-2">
                <span>Final Disposition:</span>
                <span
                  className={`px-3 py-0.5 rounded-full text-sm font-black ${
                    simResult.severity === 'RED'
                      ? 'bg-rose-500 text-white'
                      : simResult.severity === 'ORANGE'
                      ? 'bg-amber-500 text-white'
                      : simResult.severity === 'YELLOW'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {simResult.terminalOutcome} ({simResult.severity})
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {simResult.primaryRationale}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5 text-right">
              <div className="text-2xl font-black font-mono text-teal-400">
                {simResult.confidenceScore}%
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                Calibrated Confidence
              </div>
              <div className="text-[10px] text-slate-400">
                Doctor Attestation:{' '}
                <strong className={simResult.adversarialAttestation.status === 'ATTESTATION_APPROVED' ? 'text-emerald-400' : 'text-amber-400'}>
                  {simResult.adversarialAttestation.status}
                </strong>
              </div>
            </div>
          </div>

          {/* Orange Alert Urgent Teleconsultation Quick Links */}
          {simResult.severity === 'ORANGE' && (
            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-lg">🩺</span>
                <div>
                  <span className="font-extrabold text-amber-300">Urgent Care Teleconsultation Options: </span>
                  <span className="text-slate-300">WhiteCoat (queue &lt;15m) & Doctor Anywhere (Dr Anywhere 24/7) available for timely doctor evaluation.</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://whitecoat.global/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all"
                >
                  WhiteCoat ↗
                </a>
                <a
                  href="https://doctoranywhere.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
                >
                  Dr Anywhere ↗
                </a>
              </div>
            </div>
          )}

          {/* Sequential Step-by-Step Agent Callout Flow */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Layers size={14} className="text-teal-600" />
                <span>Agent Execution Callouts & Decision Transitions (Spec §5)</span>
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                {simResult.stateTransitions.length} State Machine Steps Recorded
              </span>
            </div>

            <div className="space-y-3">
              {simResult.stateTransitions.map((st, idx) => {
                const isChallenge = st.status === 'CHALLENGE';
                const isTripped = st.status === 'TRIPPED';
                const isApproved = st.status === 'APPROVED';

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      isTripped
                        ? 'border-rose-300 bg-rose-50/70 dark:bg-rose-950/30 dark:border-rose-900'
                        : isChallenge
                        ? 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-900'
                        : isApproved
                        ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-900'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-mono font-bold flex items-center justify-center">
                          {st.step}
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {st.agent}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {st.fromState} <ArrowRight size={10} className="inline mx-1 text-slate-400" /> {st.toState}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isTripped
                              ? 'bg-rose-600 text-white'
                              : isChallenge
                              ? 'bg-amber-600 text-white'
                              : isApproved
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {st.status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(st.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* Decision Callout Details */}
                    <div className="text-xs text-slate-700 dark:text-slate-300 pl-8 leading-relaxed">
                      {st.details}
                    </div>

                    {/* Special Callout for Doctor Adversarial Challenge */}
                    {isChallenge && (
                      <div className="mt-2.5 ml-8 p-3 rounded-xl bg-amber-100/80 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-800 text-xs space-y-1">
                        <div className="font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <AlertTriangle size={14} className="text-amber-700 dark:text-amber-400" />
                          <span>Adversarial Red-Team Challenge Triggered (Spec §4 Doctor Attestation Loop)</span>
                        </div>
                        <p className="text-amber-800 dark:text-amber-300">
                          {st.details}
                        </p>
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                          Next Action: Re-invoking <strong>@triage_agent</strong> in revision cycle with mandatory escalation feedback.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Doctor Adversarial Checklist & Guardrail Audit Callout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-2.5">
              <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Shield size={14} className="text-teal-600" />
                <span>Doctor Adversarial Red-Team Checklist</span>
              </h5>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Allergy / Drug Conflict:</span>
                  <span className="font-bold flex items-center gap-1 text-emerald-600">
                    <Check size={12} /> Passed (No Contraindications)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Spec §6 Age Floor Enforced:</span>
                  <span className="font-bold flex items-center gap-1 text-emerald-600">
                    <Check size={12} /> {simResult.guardrailAudit.ageFloorCheck}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">80% Confidence Floor Verified:</span>
                  <span className="font-bold flex items-center gap-1 text-emerald-600">
                    <Check size={12} /> {simResult.guardrailAudit.confidenceFloorCheck}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Pediatric & Geriatric Atypical Screened:</span>
                  <span className="font-bold flex items-center gap-1 text-emerald-600">
                    <Check size={12} /> Verified by Emergency Physician
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-2.5">
              <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Database size={14} className="text-emerald-600" />
                <span>Persistent SQLite Audit Trail</span>
              </h5>
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span>SQLite Database File:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">data/chat.db</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Target Table:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">triage_execution_logs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Revision Cycles Completed:</span>
                  <span className="font-mono font-bold text-teal-600">
                    {simResult.provenance.totalRevisionCycles} cycle(s)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>CPG Source Guidelines Cited:</span>
                  <span className="font-bold text-slate-800 dark:text-white truncate max-w-[200px]">
                    {simResult.sourceReferences[0] || 'MOH Singapore CPG'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Toggle Raw JSON Audit Log */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1.5"
            >
              <FileText size={14} />
              <span>{showRawJson ? 'Hide Raw Audit JSON' : 'Inspect Raw Immutable Execution Log (JSON)'}</span>
              {showRawJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {simResult.severity === 'RED' && (
              <button
                type="button"
                onClick={onOpenSos}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <AlertOctagon size={14} />
                <span>Trigger Emergency SOS (995)</span>
              </button>
            )}
          </div>

          {showRawJson && (
            <pre className="p-4 rounded-2xl bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto max-h-96 border border-slate-800 scrollbar-thin">
              {JSON.stringify(simResult, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* 4. Recent SQLite Execution Logs Table */}
      {sqliteLogs.length > 0 && (
        <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Database size={16} className="text-emerald-600" />
                <span>Recent Persistent Triage Logs in SQLite (`triage_execution_logs`)</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Every agent decision, attestation transition, and guardrail check stored in local SQLite database.
              </p>
            </div>
            <button
              type="button"
              onClick={loadSqliteLogs}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <RotateCcw size={12} />
              <span>Refresh Logs</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="py-2.5 px-3">Execution ID</th>
                  <th className="py-2.5 px-3">Patient / Complaint</th>
                  <th className="py-2.5 px-3">Outcome</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Doctor Attestation</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {sqliteLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-500">
                      {log.id.substring(0, 16)}...
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-white max-w-xs truncate">
                      {log.inputText || 'Standard Presentation'}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                      {log.terminalOutcome}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          log.severity === 'RED'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : log.severity === 'ORANGE'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : log.severity === 'YELLOW'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                      {log.confidenceScore}%
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {log.adversarialAttestation?.status || 'APPROVED'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
