import React, { useState } from 'react';
import { 
  Send, 
  Mic, 
  Camera, 
  AlertOctagon, 
  ArrowRight, 
  RotateCcw, 
  Sparkles,
  Info,
  CheckCircle2,
  Activity,
  ArrowLeft,
  Wind,
  Thermometer,
  Bandage,
  Eye,
  Zap,
  Brain,
  MoreHorizontal,
  RotateCw,
  Layers
} from 'lucide-react';
import type { Person, Ailment, Language, TriageResult, QuestionStep } from '../types';
import { AILMENTS, detectEmergencyKeywords, getQuestionTree, runTriage, getAgeDisplay } from '../engine/triageEngine';
import { runAgenticTriage } from '../engine/agenticPipeline';
import { getGreeting, getSymptomPrompt } from '../engine/grandmaVoice';
import { RealVoiceRecorder } from './RealVoiceRecorder';
import { RealPhotoUploader } from './RealPhotoUploader';

interface TriageFlowViewProps {
  person: Person;
  language: Language;
  onTriageComplete: (result: TriageResult, answers: Record<string, any>, ailment?: Ailment) => void;
  onOpenSos: () => void;
  onOpenCrisis: () => void;
  onChangeSubject?: () => void;
  onRemoveAilment?: (personId: string) => void;
  triageMode?: 'rule-based' | 'agentic';
}

export const TriageFlowView: React.FC<TriageFlowViewProps> = ({
  person,
  language,
  onTriageComplete,
  onOpenSos,
  onOpenCrisis,
  onChangeSubject,
  onRemoveAilment,
  triageMode = 'rule-based',
}) => {
  // Intake mode
  const [intakeMode, setIntakeMode] = useState<'text' | 'voice' | 'photo' | 'chips'>('text');
  const [textInput, setTextInput] = useState('');
  const [selectedAilment, setSelectedAilment] = useState<Ailment | null>(null);
  const [removedAilment, setRemovedAilment] = useState(false);

  // Photo state
  const [photoDescriptors, setPhotoDescriptors] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Question Tree state
  const [inQuestionTree, setInQuestionTree] = useState(false);
  const [questions, setQuestions] = useState<QuestionStep[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Real-time emergency detection warning
  const keywordDetection = detectEmergencyKeywords(textInput, language);

  // Quick scenario triggers for easy testing
  const handleQuickScenarioLucas = () => {
    setIntakeMode('text');
    setTextInput(
      language === 'zh'
        ? '宝宝发烧38.8度，精神有点烦躁，流鼻涕，不肯喝奶'
        : 'Baby Lucas has fever 38.8°C, irritable, mild runny nose, and refusing feeding'
    );
    setSelectedAilment(AILMENTS.find(a => a.code === 'fever') || null);
  };

  const handleQuickScenarioAhBoonStroke = () => {
    setIntakeMode('text');
    setTextInput(
      language === 'zh'
        ? '爷爷突然说话大舌头含糊不清，右手抬不起来，嘴角有些歪斜'
        : 'Grandpa Ah Boon suddenly has slurred speech, right arm is weak, and mouth is drooping'
    );
    setSelectedAilment(AILMENTS.find(a => a.code === 'confusion_neuro') || null);
  };

  const handleQuickScenarioPhotoEye = () => {
    setIntakeMode('photo');
    setSelectedAilment(AILMENTS.find(a => a.code === 'eye_symptoms') || null);
    setTextInput('Red, irritated eye since this morning, tearing and mild itch');
  };

  // NLP matcher to avoid falling back to Fever all the time
  const detectAilmentFromText = (text: string, current: Ailment | null): Ailment => {
    const lower = text.toLowerCase();
    
    for (const a of AILMENTS) {
      if (lower.includes(a.code.replace('_', ' '))) return a;
      if (lower.includes(a.name.toLowerCase())) return a;
    }
    
    if (lower.includes('breath') || lower.includes('breathing')) return AILMENTS.find(a => a.code === 'breathing_difficulty') || AILMENTS[0];
    if (lower.includes('stomach') || lower.includes('tummy') || lower.includes('belly')) return AILMENTS.find(a => a.code === 'abdominal_pain') || AILMENTS[0];
    if (lower.includes('throw up') || lower.includes('puke')) return AILMENTS.find(a => a.code === 'vomiting') || AILMENTS[0];
    if (lower.includes('poop') || lower.includes('runny')) return AILMENTS.find(a => a.code === 'diarrhea') || AILMENTS[0];
    if (lower.includes('cut') || lower.includes('bleed') || lower.includes('fall') || lower.includes('hurt')) return AILMENTS.find(a => a.code === 'injury_wound') || AILMENTS[0];
    if (lower.includes('pee') || lower.includes('urine')) return AILMENTS.find(a => a.code === 'uti') || AILMENTS[0];
    if (lower.includes('burn') || lower.includes('scald')) return AILMENTS.find(a => a.code === 'minor_burn') || AILMENTS[0];
    if (lower.includes('eye') || lower.includes('vision')) return AILMENTS.find(a => a.code === 'eye_symptoms') || AILMENTS[0];

    return current || AILMENTS[0]; // fallback to fever
  };

  // Start question tree for an ailment
  const startAssessment = (ailment: Ailment, initialAnswers: Record<string, any> = {}) => {
    setSelectedAilment(ailment);

    // Emergency keywords check
    if (keywordDetection.triggered) {
      if (keywordDetection.isCrisis) {
        onOpenCrisis();
      }
      if (triageMode === 'agentic') {
        runAgenticTriage(textInput, initialAnswers, person, language).then(finalResult => {
          onTriageComplete(finalResult, initialAnswers, ailment);
        });
        return;
      }
      const immediateResult = runTriage({
        text: textInput,
        ailmentCode: ailment.code,
        answers: initialAnswers,
        person,
        language,
        imageDescriptors: photoDescriptors,
      });
      onTriageComplete(immediateResult, initialAnswers, ailment);
      return;
    }

    const tree = getQuestionTree(ailment.code, person);
    if (tree.length === 0) {
      if (triageMode === 'agentic') {
        runAgenticTriage(textInput, initialAnswers, person, language).then(finalResult => {
          onTriageComplete(finalResult, initialAnswers, ailment);
        });
      } else {
        const res = runTriage({
          text: textInput,
          ailmentCode: ailment.code,
          answers: initialAnswers,
          person,
          language,
          imageDescriptors: photoDescriptors,
        });
        onTriageComplete(res, initialAnswers, ailment);
      }
      return;
    }

    setQuestions(tree);
    setCurrentQuestionIndex(0);
    setAnswers(initialAnswers);
    setInQuestionTree(true);
  };

  // Answer question step
  const handleAnswerQuestion = (val: any) => {
    const currentQ = questions[currentQuestionIndex];
    const updatedAnswers = { ...answers, [currentQ.id]: val };
    setAnswers(updatedAnswers);

    // Record red flags if any, but continue assessment.
    const isRedFlag = currentQ.redFlagIf?.some(flagVal => {
      if (typeof flagVal === 'boolean') return Boolean(val) === flagVal;
      return String(val).toLowerCase() === String(flagVal).toLowerCase();
    });


    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      if (triageMode === 'agentic') {
        runAgenticTriage(textInput, updatedAnswers, person, language).then(finalResult => {
          setInQuestionTree(false);
          onTriageComplete(finalResult, updatedAnswers, selectedAilment || undefined);
        });
      } else {
        const finalResult = runTriage({
          text: textInput,
          ailmentCode: selectedAilment?.code,
          answers: updatedAnswers,
          person,
          language,
          imageDescriptors: photoDescriptors,
        });
        setInQuestionTree(false);
        onTriageComplete(finalResult, updatedAnswers, selectedAilment || undefined);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn pb-12">
      {/* Wrong-Subject Banner & Patient Lock (SRS TRI-16) */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {onChangeSubject && (
            <button
              onClick={onChangeSubject}
              className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-sm shrink-0"
              title="Change family member being assessed"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="text-2xl sm:text-3xl shrink-0">{person.avatar || '👤'}</div>
          <div>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-teal-800 bg-teal-100/70 px-1.5 py-0.5 rounded-md">
                {language === 'zh' ? '当前受评估人' : 'Assessing'}
              </span>
              <span className="font-bold text-slate-900 text-sm sm:text-base">{person.name}</span>
              <span className="text-xs text-slate-500 font-medium">
                ({getAgeDisplay(person.dob, language)} • {person.relationshipLabel})
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
              {person.medicalProfile.allergies.length > 0 && (
                <span className="text-rose-700 font-semibold mr-2">
                  ⚠️ Allergies: {person.medicalProfile.allergies.map(a => a.name).join(', ')}
                </span>
              )}
              {person.medicalProfile.medications.length > 0 && (
                <span className="text-slate-600">
                  💊 Active Meds: {person.medicalProfile.medications.map(m => m.name).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Persistent Emergency Button */}
        <button
          onClick={onOpenSos}
          className="self-start sm:self-auto flex items-center space-x-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-xl transition-all"
        >
          <AlertOctagon size={14} />
          <span>{language === 'zh' ? '此为紧急情况' : 'Emergency Assistance'}</span>
        </button>
      </div>

      {/* Ongoing Ailment Banner with Remove Button */}
      {person.activeComplaint && !removedAilment && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xl shrink-0">
              🤒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-amber-800 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  Active Ongoing Ailment on File
                </span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {person.activeComplaint}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setRemovedAilment(true);
              onRemoveAilment?.(person.id);
            }}
            className="px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-900/20 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
            title="Mark this ailment as resolved and remove from patient profile"
          >
            <CheckCircle2 size={15} />
            <span>Remove Ongoing Ailment</span>
          </button>
        </div>
      )}

      {removedAilment && (
        <div className="p-4 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Ongoing ailment for {person.name} has been marked as resolved and removed.</span>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 sm:p-7 space-y-6">
        {/* Grandma Warm Greeting & Prompt (PER-01) */}
        <div className="flex items-start space-x-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl p-4">
          <div className="text-2xl mt-0.5">👵🏼</div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              {getGreeting(person, language)}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              {getSymptomPrompt(person, language)}
            </p>
          </div>
        </div>

        {/* If in interactive question tree */}
        {inQuestionTree && questions.length > 0 ? (
          <div className="space-y-6 bg-slate-50 border border-slate-200 rounded-2xl p-5 animate-fadeIn">
            {/* Tree Progress */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
                  {currentQuestionIndex + 1}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  Question {currentQuestionIndex + 1} of {questions.length} • {selectedAilment?.name}
                </span>
              </div>
              <button
                onClick={() => setInQuestionTree(false)}
                className="text-xs text-slate-400 hover:text-slate-700 flex items-center space-x-1"
              >
                <RotateCcw size={12} />
                <span>Reset questions</span>
              </button>
            </div>

            {/* Current Question Display */}
            {(() => {
              const q = questions[currentQuestionIndex];
              const text =
                language === 'zh' && q.textZh
                  ? q.textZh
                  : language === 'ms' && q.textMs
                  ? q.textMs
                  : q.text;

              return (
                <div key={q.id} className="space-y-4 py-2">
                  <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {text}
                  </h4>
                  {q.helpText && (
                    <p className="text-xs text-slate-500 italic flex items-center space-x-1">
                      <Info size={13} />
                      <span>{q.helpText}</span>
                    </p>
                  )}

                  {/* Yes / No Question */}
                  {q.answerType === 'yes_no' && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => handleAnswerQuestion('yes')}
                        className="p-4 rounded-xl border-2 border-slate-200 hover:border-teal-500 hover:bg-teal-50 font-bold text-sm sm:text-base text-slate-800 transition-all flex items-center justify-center space-x-2"
                      >
                        <CheckCircle2 size={18} className="text-teal-600" />
                        <span>{language === 'zh' ? '是 (Yes)' : language === 'ms' ? 'Ya (Yes)' : 'Yes'}</span>
                      </button>
                      <button
                        onClick={() => handleAnswerQuestion('no')}
                        className="p-4 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-100 font-bold text-sm sm:text-base text-slate-800 transition-all flex items-center justify-center space-x-2"
                      >
                        <span>{language === 'zh' ? '否 (No)' : language === 'ms' ? 'Tidak (No)' : 'No'}</span>
                      </button>
                    </div>
                  )}

                  {/* Multiple Choice Question */}
                  {q.answerType === 'choice' && q.options && (
                    <div className="space-y-2 pt-2">
                      {q.options.map((opt, optIdx) => {
                        const optLabel =
                          language === 'zh' && q.optionsZh && q.optionsZh[optIdx]
                            ? q.optionsZh[optIdx]
                            : language === 'ms' && q.optionsMs && q.optionsMs[optIdx]
                            ? q.optionsMs[optIdx]
                            : opt;

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleAnswerQuestion(opt)}
                            className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/70 text-sm font-semibold text-slate-800 transition-all flex items-center justify-between"
                          >
                            <span>{optLabel}</span>
                            <ArrowRight size={15} className="text-slate-400" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Number Input (e.g. Temperature °C) */}
                  {q.answerType === 'number' && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center space-x-3">
                        <input
                          type="number"
                          step={q.step || 0.1}
                          min={q.min || 0}
                          max={q.max || 100}
                          defaultValue={0}
                          id={`number-input-${q.id}`}
                          className="text-2xl font-bold font-mono px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-teal-500 w-36 text-center"
                        />
                        <span className="text-lg font-bold text-slate-600">{q.unit || ''}</span>
                        <button
                          onClick={() => {
                            const val = (document.getElementById(`number-input-${q.id}`) as HTMLInputElement)?.value;
                            handleAnswerQuestion(val ? Number(val) : 0);
                          }}
                          className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition-all flex items-center space-x-1.5"
                        >
                          <span>Confirm</span>
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          /* Intake Input Controls */
          <div className="space-y-5">
            {/* Input Mode Selector Tabs */}
            <div className="flex items-center space-x-1 sm:space-x-2 border-b border-slate-200 overflow-x-auto no-scrollbar text-xs font-bold text-slate-600 pb-0.5">
              <button
                onClick={() => setIntakeMode('text')}
                className={`pb-2 px-2.5 sm:px-3.5 flex items-center space-x-1.5 border-b-2 whitespace-nowrap shrink-0 transition-all ${
                  intakeMode === 'text' ? 'border-teal-600 text-teal-700' : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Send size={14} />
                <span>{language === 'zh' ? '打字描述' : 'Describe in Words'}</span>
              </button>
              <button
                onClick={() => setIntakeMode('voice')}
                className={`pb-2 px-2.5 sm:px-3.5 flex items-center space-x-1.5 border-b-2 whitespace-nowrap shrink-0 transition-all ${
                  intakeMode === 'voice' ? 'border-teal-600 text-teal-700' : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Mic size={14} />
                <span>{language === 'zh' ? '语音麦克风' : 'Live Microphone'}</span>
              </button>
              <button
                onClick={() => setIntakeMode('photo')}
                className={`pb-2 px-2.5 sm:px-3.5 flex items-center space-x-1.5 border-b-2 whitespace-nowrap shrink-0 transition-all ${
                  intakeMode === 'photo' ? 'border-teal-600 text-teal-700' : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Camera size={14} />
                <span>{language === 'zh' ? '拍照 / 伤口' : 'Photo / Camera'}</span>
              </button>
              <button
                onClick={() => setIntakeMode('chips')}
                className={`pb-2 px-2.5 sm:px-3.5 flex items-center space-x-1.5 border-b-2 whitespace-nowrap shrink-0 transition-all ${
                  intakeMode === 'chips' ? 'border-teal-600 text-teal-700' : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Activity size={14} />
                <span>{language === 'zh' ? '部位点选' : 'Symptom Areas'}</span>
              </button>
            </div>

            {/* Real-time Emergency Keyword Alert Pill */}
            {keywordDetection.triggered && (
              <div className="p-3 bg-red-50 border-2 border-red-400 rounded-xl text-xs font-bold text-red-900 flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-2">
                  <AlertOctagon size={18} className="text-red-600 shrink-0" />
                  <span>
                    Emergency keyword detected: "{keywordDetection.matchedKeywords.join(', ')}"!
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (triageMode === 'agentic') {
                      runAgenticTriage(textInput, {}, person, language).then(finalResult => {
                        onTriageComplete(finalResult, {}, selectedAilment || undefined);
                      });
                      return;
                    }
                    const res = runTriage({
                      text: textInput,
                      ailmentCode: selectedAilment?.code,
                      person,
                      language,
                    });
                    onTriageComplete(res, {}, selectedAilment || undefined);
                  }}
                  className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-red-700"
                >
                  View Emergency Response →
                </button>
              </div>
            )}

            {/* Mode 1: Text Input with Inline Photo & Mic Shortcuts */}
            {intakeMode === 'text' && (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder={
                    language === 'zh'
                      ? '例如：宝宝发烧38.8度，精神差，不吃奶...'
                      : language === 'ms'
                      ? 'Cth: Bayi demam 38.8C, tidak minum susu...'
                      : 'E.g. Lucas has fever 38.8°C, irritable, not drinking milk...'
                  }
                  className="w-full p-3.5 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 text-sm text-slate-900 resize-none"
                />

                {/* Attached Photo Preview (if photo added) */}
                {photoUrl && (
                  <div className="flex items-center space-x-3 p-2.5 bg-teal-50/60 border border-teal-200 rounded-xl">
                    <img
                      src={photoUrl}
                      alt="Attached symptom"
                      className="w-12 h-12 rounded-lg object-cover border border-teal-300 shadow-sm"
                    />
                    <div className="flex-1 text-xs">
                      <div className="font-bold text-teal-900">Photo Attached for Clinical Review</div>
                      <div className="text-[11px] text-teal-700 line-clamp-1">
                        {photoDescriptors[0] || 'Visual inspection ready'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoUrl(null);
                        setPhotoDescriptors([]);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  {/* Action Shortcuts: Switch to Mic or Attach Photo */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIntakeMode('voice')}
                      className="flex-1 sm:flex-initial px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors min-h-[40px]"
                    >
                      <Mic size={14} className="text-teal-600" />
                      <span>Use Mic</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIntakeMode('photo')}
                      className="flex-1 sm:flex-initial px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors min-h-[40px]"
                    >
                      <Camera size={14} className="text-teal-600" />
                      <span>Attach Photo</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const detected = detectAilmentFromText(textInput, selectedAilment);
                      startAssessment(detected);
                    }}
                    disabled={!textInput.trim() && !photoUrl}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center space-x-1.5 min-h-[44px]"
                  >
                    <span>Assess Symptoms</span>
                    <ArrowRight size={15} />
                  </button>
                </div>

                {/* Quick Test Scenario Pills placed at the bottom of the Assess Symptoms button */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                  <span className="font-bold text-slate-500 flex items-center space-x-1 mr-1 shrink-0 text-[11px] uppercase tracking-wider">
                    <Sparkles size={13} className="text-amber-500" />
                    <span>Quick Scenarios:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleQuickScenarioLucas}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 text-xs"
                  >
                    👶 Baby Lucas Fever (38.8°C)
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickScenarioAhBoonStroke}
                    className="bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 text-xs"
                  >
                    👴 Grandpa Stroke FAST
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickScenarioPhotoEye}
                    className="bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 text-xs"
                  >
                    👁️ Red Eye Photo
                  </button>
                </div>
              </div>
            )}

            {/* Mode 2: Real Microphone Voice Input (SRS INT-06) */}
            {intakeMode === 'voice' && (
              <div className="space-y-3">
                <RealVoiceRecorder
                  language={language}
                  onTranscriptChange={(trans) => setTextInput(trans)}
                />

                {textInput && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        const detected = detectAilmentFromText(textInput, selectedAilment);
                        startAssessment(detected);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center space-x-1.5"
                    >
                      <span>Assess Voice Transcript</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Real Photo Uploader with Camera (SRS INT-07, INT-08) */}
            {intakeMode === 'photo' && (
              <div className="space-y-3">
                <RealPhotoUploader
                  language={language}
                  initialPhotoUrl={photoUrl}
                  onPhotoAnalyzed={(dataUrl, descriptors, qualityOk) => {
                    setPhotoUrl(dataUrl);
                    setPhotoDescriptors(descriptors);
                    if (!textInput) {
                      setTextInput(`Visual inspection uploaded: ${descriptors[0] || 'Image examination'}`);
                    }
                  }}
                />

                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-slate-500">
                    {photoDescriptors.length > 0
                      ? `${photoDescriptors.length} descriptive cues ready for rule engine`
                      : 'Upload photo or choose a preset sample above'}
                  </div>
                  <button
                    onClick={() => {
                      const detected = selectedAilment || AILMENTS.find(a => a.code === 'eye_symptoms') || AILMENTS[0];
                      startAssessment(detected);
                    }}
                    disabled={!photoUrl && !textInput}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center space-x-1.5"
                  >
                    <span>Assess Image Cues</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Mode 4: Symptom Area Chips (SRS INT-02) */}
            {intakeMode === 'chips' && (
              <div className="space-y-3 pt-1">
                <div className="text-xs font-bold text-[#52616B] dark:text-[#94A3B8] uppercase tracking-wider">
                  {language === 'zh' ? '点击选择身体部位 / 常见症状：' : 'Select a symptom category to begin:'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {AILMENTS.map(ailment => {
                    const isSelected = selectedAilment?.code === ailment.code;
                    const displayName =
                      language === 'zh' && ailment.nameZh
                        ? ailment.nameZh
                        : language === 'ms' && ailment.nameMs
                        ? ailment.nameMs
                        : ailment.name;

                    const getAilmentIcon = (code: string) => {
                      switch (code) {
                        case 'fever': return Thermometer;
                        case 'cough':
                        case 'shortness_of_breath': return Wind;
                        case 'dizziness': return RotateCw;
                        case 'abdominal_pain':
                        case 'vomiting':
                        case 'diarrhea': return Activity;
                        case 'rash':
                        case 'minor_wound':
                        case 'minor_burn': return Bandage;
                        case 'eye_symptoms': return Eye;
                        case 'headache':
                        case 'chest_pain':
                        case 'back_pain': return Zap;
                        case 'confusion_neuro':
                        case 'mental_health': return Brain;
                        default: return MoreHorizontal;
                      }
                    };

                    const Icon = getAilmentIcon(ailment.code);

                    return (
                      <button
                        key={ailment.code}
                        onClick={() => startAssessment(ailment)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[76px] ${
                          isSelected
                            ? 'border-[#0F766E] bg-[#E6F4F1] dark:bg-[#0F766E]/20 shadow-sm'
                            : 'border-[#DDE5E9] dark:border-[#1E2D37] hover:border-[#0F766E] hover:bg-[#FAFBFA] dark:hover:bg-[#16232B] bg-white dark:bg-[#0F1A20]'
                        }`}
                        aria-label={`Symptom category: ${displayName}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-xl ${isSelected ? 'bg-[#0F766E] text-white' : 'bg-[#E6F4F1] dark:bg-[#0F766E]/20 text-[#0F766E] dark:text-[#5EEAD4]'}`}>
                            <Icon size={18} strokeWidth={2} />
                          </div>
                          <div className="font-bold text-sm text-[#14212B] dark:text-[#F1F5F9] leading-tight">
                            {displayName}
                          </div>
                        </div>
                        <div className="text-[11px] text-[#52616B] dark:text-[#94A3B8] line-clamp-1 mt-2">
                          {ailment.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
