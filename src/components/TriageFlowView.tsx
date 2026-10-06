import React, { useState, useEffect, useRef } from 'react';
import { Activity, Camera, Mic, Send, AlertOctagon, CheckCircle2, ArrowRight, Loader2, Sparkles, Thermometer, Wind, Eye, Brain, Zap, Bandage } from 'lucide-react';
import type { Person, Language, TriageResult, Ailment, QuestionStep } from '../types';
import { getQuestionTree, runTriage } from '../engine/triageEngine';
import { runRuleBasedTriage, getQuestionTree as getRuleBasedQuestionTree } from '../engine/ruleBasedEngine';
import { RealVoiceRecorder } from './RealVoiceRecorder';
import { RealPhotoUploader } from './RealPhotoUploader';
import { fetchTriageDecisionFromDb } from '../services/dbService';

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
  const [step, setStep] = useState<'intake' | 'questions' | 'processing'>('intake');
  const [intakeMode, setIntakeMode] = useState<'chips' | 'text' | 'voice' | 'photo'>('chips');
  
  // State for different modalities
  const [textInput, setTextInput] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoDescriptors, setPhotoDescriptors] = useState<string[]>([]);
  
  const [ailments, setAilments] = useState<Ailment[]>([]);
  const [isLoadingAilments, setIsLoadingAilments] = useState(true);
  const [selectedAilment, setSelectedAilment] = useState<Ailment | null>(null);
  
  const [questions, setQuestions] = useState<QuestionStep[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isFetchingQuestions, setIsFetchingQuestions] = useState(false);
  const [answerInput, setAnswerInput] = useState<string>('');

  const [emergencyKeywords, setEmergencyKeywords] = useState<string[]>([]);
  const [emergencyWarning, setEmergencyWarning] = useState<string | null>(null);

  // Fetch ailments and keywords on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingAilments(true);
      try {
        const [ailmentsRes, keywordsRes] = await Promise.all([
          fetch('/api/db/ailments'),
          fetch(`/api/db/keywords?lang=${language}`)
        ]);
        
        if (ailmentsRes.ok) {
          const data = await ailmentsRes.json();
          setAilments(data);
        }
        
        if (keywordsRes.ok) {
          const data = await keywordsRes.json();
          setEmergencyKeywords(data);
        }
      } catch (err) {
        console.error("Failed to fetch initial triage data", err);
      } finally {
        setIsLoadingAilments(false);
      }
    };
    loadData();
  }, [language]);

  // Real-time emergency keyword detection
  useEffect(() => {
    if (!textInput || emergencyKeywords.length === 0) {
      setEmergencyWarning(null);
      return;
    }
    
    const lowerInput = textInput.toLowerCase();
    
    // Check for crisis keywords first
    const crisisKeywords = ['suicide', 'kill myself', 'end my life', 'self harm', 'hurt myself', 'want to die', '自杀', '想死', '自残', 'bunuh diri', 'mahu mati'];
    const hasCrisis = crisisKeywords.some(cw => lowerInput.includes(cw));
    if (hasCrisis) {
      onOpenCrisis();
      setEmergencyWarning('Red Flag Detected: Mental Health Crisis. Please seek immediate support.');
      return;
    }

    const detected = emergencyKeywords.find(kw => lowerInput.includes(kw.toLowerCase()));
    
    if (detected) {
      setEmergencyWarning(`Red Flag Detected: "${detected}". If this is a life-threatening emergency, please seek immediate medical attention or call 995.`);
    } else {
      setEmergencyWarning(null);
    }
  }, [textInput, emergencyKeywords]);

  const [visionMetaState, setVisionMetaState] = useState<any>(null);

  // NLP matcher to guess ailment from text/voice
  const detectAilmentFromText = (text: string): Ailment => {
    const lower = text.toLowerCase();
    
    // Check specific high-priority ocular keywords first (conjunctivitis / red eye / sclera / vision)
    if (
      lower.includes('eye') || 
      lower.includes('vision') || 
      lower.includes('conjunctiv') || 
      lower.includes('hyperemia') || 
      lower.includes('sclera') || 
      lower.includes('cornea') || 
      lower.includes('pink eye') ||
      lower.includes('red eye')
    ) {
      const eyeAilment = ailments.find(a => a.code === 'eye_symptoms');
      if (eyeAilment) return eyeAilment;
    }

    for (const a of ailments) {
      if (lower.includes(a.code.replace('_', ' '))) return a;
      if (lower.includes(a.name.toLowerCase())) return a;
    }
    if (lower.includes('cut') || lower.includes('bleed') || lower.includes('fall') || lower.includes('wound')) {
      return ailments.find(a => a.code === 'injury_wound') || ailments[0];
    }
    if (lower.includes('rash') || lower.includes('skin') || lower.includes('itch')) {
      return ailments.find(a => a.code === 'skin_rash') || ailments[0];
    }
    if (lower.includes('fever') || lower.includes('temp') || lower.includes('hot')) {
      return ailments.find(a => a.code === 'fever') || ailments[0];
    }
    return ailments.find(a => a.code === 'eye_symptoms') || ailments[0]; // fallback
  };

  // AbortController for cancelling triage
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancelTriage = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStep('initial');
    setAnswerInput('');
  };

  const startAssessment = async (detectedAilment: Ailment, customQuestions?: QuestionStep[]) => {
    if (emergencyWarning) {
      setStep('processing');
      abortControllerRef.current = new AbortController();
      let result;
      if (triageMode === 'agentic') {
        result = await runTriage({ 
          ailment: detectedAilment, 
          answers: { emergency_bypass: true }, 
          person,
          text: textInput,
          imageDescriptors: photoDescriptors,
          abortSignal: abortControllerRef.current.signal
        });
      } else {
        result = runRuleBasedTriage({
          ailmentCode: detectedAilment.code,
          answers: { emergency_bypass: true },
          person,
          text: textInput,
          imageDescriptors: photoDescriptors,
          language
        });
        // Enrich with triage_decisions from SQLite table via backend API
        try {
          const decision = await fetchTriageDecisionFromDb(detectedAilment.code, result.severity);
          if (decision) {
            result.deterministicAction = decision.action;
            result.otcMedications = decision.otcMedications;
            result.homeCare = decision.homeCare;
            result.telemedPartners = decision.telemedPartners;
            result.medicationDoseByAge = decision.doses;
            result.medicationFrequency = decision.frequency;
          }
        } catch (decErr) {
          console.warn('[TriageFlowView] Error fetching decision from DB:', decErr);
        }
      }
      onTriageComplete(result, { emergency_bypass: true }, detectedAilment);
      return;
    }

    setSelectedAilment(detectedAilment);
    setStep('questions');
    setIsFetchingQuestions(true);
    
    let fetchedQuestions: QuestionStep[] = [];
    if (customQuestions && customQuestions.length > 0) {
      fetchedQuestions = customQuestions;
    } else if (triageMode === 'agentic') {
      fetchedQuestions = await getQuestionTree(detectedAilment.code, person);
    } else {
      fetchedQuestions = getRuleBasedQuestionTree(detectedAilment.code, person);
    }
    
    const mockQuestions: QuestionStep[] = fetchedQuestions.length ? fetchedQuestions : [
      { id: 'q1', text: 'How long have you had this symptom?', answerType: 'choice', options: ['Less than a day', '1-3 days', 'More than 3 days'] },
      { id: 'q2', text: 'Are you experiencing any severe pain?', answerType: 'yes_no' }
    ];
    
    setQuestions(mockQuestions);
    setIsFetchingQuestions(false);
  };

  const handleAnswer = async (answer: any) => {
    const currentQ = questions[currentQuestionIndex];
    const newAnswers = { ...answers, [currentQ.id]: answer };
    setAnswers(newAnswers);
    setAnswerInput(''); // Reset text box

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Finished questions, run triage
      setStep('processing');
      abortControllerRef.current = new AbortController();
      
      let result;
      if (triageMode === 'agentic') {
        result = await runTriage({ 
          ailment: selectedAilment, 
          answers: newAnswers, 
          person,
          text: textInput,
          imageDescriptors: photoDescriptors,
          abortSignal: abortControllerRef.current.signal
        });
      } else {
        result = runRuleBasedTriage({
          ailmentCode: selectedAilment?.code,
          answers: newAnswers,
          person,
          text: textInput,
          imageDescriptors: photoDescriptors,
          language
        });
        // Enrich with triage_decisions from SQLite table via backend API
        if (selectedAilment?.code) {
          try {
            const decision = await fetchTriageDecisionFromDb(selectedAilment.code, result.severity);
            if (decision) {
              result.deterministicAction = decision.action;
              result.otcMedications = decision.otcMedications;
              result.homeCare = decision.homeCare;
              result.telemedPartners = decision.telemedPartners;
              result.medicationDoseByAge = decision.doses;
              result.medicationFrequency = decision.frequency;
            }
          } catch (decErr) {
            console.warn('[TriageFlowView] Error fetching decision from DB:', decErr);
          }
        }
      }
      
      onTriageComplete(result, newAnswers, selectedAilment!);
    }
  };

  const t = {
    en: {
      analyzing: "Analyzing Symptoms",
      analyzingDesc: triageMode === 'agentic' ? "Our Agentic AI is consulting clinical rules..." : "Evaluating against clinical rules...",
      generating: triageMode === 'agentic' ? "Generating tailored questions..." : "Loading assessment questions...",
      questionOf: (curr: number, tot: number) => `Question ${curr} of ${tot}`,
      yes: "Yes",
      no: "No",
      continue: "Continue",
      howCanHelp: (name: string) => `How can we help ${name}?`,
      selectInput: "Select an input method below to describe the symptoms.",
      typePlaceholder: "Type your answer...",
      numberPlaceholder: "Enter number...",
      categories: "Categories",
      typeText: "Type Text",
      microphone: "Microphone",
      cameraPhoto: "Camera / Photo",
      emergencyInd: "Potential Emergency Indicator",
      callSos: "Call SOS",
      loadingAilments: "Loading clinical database...",
      startTriage: triageMode === 'agentic' ? "Start Agentic Triage" : "Start Triage",
      describeSymptomsPlaceholder: "e.g. He fell down and has a cut on his knee...",
      startAnalysis: "Start Analysis",
      orChooseCommon: "Or choose a common ailment below:",
      analyzeText: "Analyze Text",
      assessVoice: "Assess Voice Transcript",
      assessImage: "Assess Image Cues",
    },
    ms: {
      analyzing: "Menganalisis Gejala",
      analyzingDesc: triageMode === 'agentic' ? "AI Ejen kami sedang merujuk peraturan klinikal..." : "Menilai dengan peraturan klinikal...",
      generating: triageMode === 'agentic' ? "Menjana soalan khusus..." : "Memuatkan soalan...",
      questionOf: (curr: number, tot: number) => `Soalan ${curr} daripada ${tot}`,
      yes: "Ya",
      no: "Tidak",
      continue: "Teruskan",
      howCanHelp: (name: string) => `Bagaimana kami boleh bantu ${name}?`,
      selectInput: "Pilih kaedah input di bawah untuk menerangkan gejala.",
      typePlaceholder: "Taip jawapan anda...",
      numberPlaceholder: "Masukkan nombor...",
      categories: "Kategori",
      typeText: "Taip Teks",
      microphone: "Mikrofon",
      cameraPhoto: "Kamera / Foto",
      emergencyInd: "Penunjuk Kecemasan Potensi",
      callSos: "Panggil SOS",
      loadingAilments: "Memuatkan pangkalan data klinikal...",
      startTriage: triageMode === 'agentic' ? "Mula Triage Ejen" : "Mula Triage",
      describeSymptomsPlaceholder: "cth. Dia jatuh dan luka di lutut...",
      startAnalysis: "Mula Analisis",
      orChooseCommon: "Atau pilih penyakit biasa di bawah:",
      analyzeText: "Analisis Teks",
      assessVoice: "Nilai Transkrip Suara",
      assessImage: "Nilai Petunjuk Imej",
    },
    zh: {
      analyzing: "正在分析症状",
      analyzingDesc: triageMode === 'agentic' ? "我们的智能AI正在查阅临床规则..." : "正在查阅临床规则...",
      generating: triageMode === 'agentic' ? "正在生成定制问题..." : "正在加载评估问题...",
      questionOf: (curr: number, tot: number) => `第 ${curr} 个问题，共 ${tot} 个`,
      yes: "是",
      no: "否",
      continue: "继续",
      howCanHelp: (name: string) => `我们可以如何帮助 ${name}？`,
      selectInput: "请在下方选择输入方法以描述症状。",
      typePlaceholder: "输入您的答案...",
      numberPlaceholder: "输入数字...",
      categories: "类别",
      typeText: "文本描述",
      microphone: "麦克风",
      cameraPhoto: "相机 / 照片",
      emergencyInd: "潜在紧急情况指示",
      callSos: "呼叫SOS",
      loadingAilments: "正在加载临床数据库...",
      startTriage: triageMode === 'agentic' ? "开始智能分诊" : "开始分诊",
      describeSymptomsPlaceholder: "例如：他摔倒了，膝盖有伤口...",
      startAnalysis: "开始分析",
      orChooseCommon: "或在下方选择常见病症：",
      analyzeText: "分析文本",
      assessVoice: "评估语音记录",
      assessImage: "评估图像线索",
    }
  }[language];

  const grandmaLoadingMessages = [
    "Granny is checking the latest MOH medical guidelines...",
    "Reviewing your local Dengue and Haze maps...",
    "Asking the virtual doctor to double-check the symptoms...",
    "Putting on my reading glasses to read the medication safety rules...",
    "Hold on dear, Granny is finalizing the best advice for you...",
    "Making sure we haven't missed any red flags..."
  ];
  
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  useEffect(() => {
    if (step === 'processing') {
      const interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % grandmaLoadingMessages.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [step]);

  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/60 backdrop-blur-xl rounded-3xl shadow-sm border border-white/40 min-h-[400px]">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
          <Activity className="w-16 h-16 text-blue-600 animate-bounce relative z-10" />
        </div>
        <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">{t.analyzing}</h3>
        <p className="text-gray-500 animate-pulse text-center max-w-md">{grandmaLoadingMessages[loadingMsgIdx]}</p>
        <button 
          onClick={handleCancelTriage}
          className="mt-8 px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-sm font-semibold transition-all border border-slate-200"
        >
          Stop Analysis
        </button>
      </div>
    );
  }

  if (step === 'questions') {
    if (isFetchingQuestions) {
      return (
        <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">{t.generating}</p>
        </div>
      );
    }

    const q = questions[currentQuestionIndex];
    if (!q) return null;

    return (
      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-white/40 max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full">
            {t.questionOf(currentQuestionIndex + 1, questions.length)}
          </span>
          <span className="text-sm font-medium text-gray-400">{selectedAilment?.name}</span>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 leading-snug">{q.text}</h3>

        <div className="space-y-3 mt-8">
          {q.answerType === 'yes_no' && (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handleAnswer('yes')} className="py-4 px-6 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 font-bold text-gray-700 transition-all">{t.yes}</button>
              <button onClick={() => handleAnswer('no')} className="py-4 px-6 rounded-2xl border-2 border-gray-100 hover:border-gray-400 hover:bg-gray-50 font-bold text-gray-700 transition-all">{t.no}</button>
            </div>
          )}
          {q.answerType === 'choice' && q.options?.map((opt, i) => (
            <button key={i} onClick={() => handleAnswer(opt)} className="w-full text-left py-4 px-6 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 font-bold text-gray-700 transition-all">
              {opt}
            </button>
          ))}
          {(q.answerType === 'number' || q.answerType === 'text') && (
            <div className="flex flex-col gap-3">
              <input
                type={q.answerType === 'number' ? 'number' : 'text'}
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder={q.answerType === 'number' ? t.numberPlaceholder : t.typePlaceholder}
                className="w-full py-4 px-6 rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:ring-0 font-bold text-gray-900 transition-all bg-white shadow-inner text-lg"
                min={q.min}
                max={q.max}
              />
              <button 
                disabled={!answerInput.trim()}
                onClick={() => handleAnswer(answerInput)} 
                className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-white transition-all shadow-md"
              >
                {t.continue}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // INTAKE STEP (Ailments, Text, Voice, Photo)
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Premium Glass Header */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">{t.howCanHelp(person.name)}</h2>
          <p className="text-gray-500 text-sm mt-1">{t.selectInput}</p>
        </div>
        <div className="text-4xl bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center border border-blue-100">
          {person.avatar || '👤'}
        </div>
      </div>

      {/* Input Mode Selector */}
      <div className="flex p-1.5 bg-gray-100/80 backdrop-blur-md rounded-2xl overflow-hidden shadow-inner">
        {[
          { id: 'chips', icon: <Activity size={16} />, label: t.categories },
          { id: 'text', icon: <Send size={16} />, label: t.typeText },
          { id: 'voice', icon: <Mic size={16} />, label: t.microphone },
          { id: 'photo', icon: <Camera size={16} />, label: t.cameraPhoto }
        ].map(mode => (
          <button
            key={mode.id}
            onClick={() => setIntakeMode(mode.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              intakeMode === mode.id 
                ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50 scale-[1.02]' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            {mode.icon}
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        ))}
      </div>

      {/* Main Input Area */}
      <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-sm min-h-[300px]">
        
        {/* Emergency Warning Banner */}
        {emergencyWarning && (
          <div className="mb-4 animate-in fade-in p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3">
            <AlertOctagon className="text-red-500 mt-0.5 shrink-0" size={20} />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-800">{t.emergencyInd}</h4>
              <p className="text-xs text-red-700 mt-1">{emergencyWarning}</p>
            </div>
            <button onClick={onOpenSos} className="shrink-0 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors">
              {t.callSos}
            </button>
          </div>
        )}

        {intakeMode === 'chips' && (
          <div className="animate-in fade-in">
            {isLoadingAilments ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {ailments.map(a => (
                  <button
                    key={a.code}
                    onClick={() => startAssessment(a)}
                    title={a.description}
                    className="p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-blue-400 hover:bg-blue-50/50 transition-all flex flex-col items-start gap-3 group text-left"
                  >
                    <div className="p-2.5 bg-gray-50 rounded-xl text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                      {a.icon === 'Thermometer' ? <Thermometer size={20} /> :
                       a.icon === 'Wind' ? <Wind size={20} /> :
                       a.icon === 'Bandage' ? <Bandage size={20} /> :
                       <Eye size={20} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 leading-tight">{a.name}</h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1 group-hover:line-clamp-none transition-all">{a.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {intakeMode === 'text' && (
          <div className="animate-in fade-in space-y-4">
            <textarea
              rows={4}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={t.describeSymptomsPlaceholder}
              className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:bg-white focus:ring-0 text-gray-900 transition-all resize-none font-medium"
            />
            <div className="flex justify-end">
              <button 
                disabled={!textInput.trim()}
                onClick={() => startAssessment(detectAilmentFromText(textInput))}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <span>{t.analyzeText}</span>
                <Sparkles size={16} />
              </button>
            </div>
          </div>
        )}

        {intakeMode === 'voice' && (
          <div className="animate-in fade-in">
            <RealVoiceRecorder 
              language={language}
              onTranscriptChange={setTextInput}
            />
            {textInput && (
              <div className="flex justify-end mt-4">
                <button 
                  onClick={() => startAssessment(detectAilmentFromText(textInput))}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <span>{t.assessVoice}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {intakeMode === 'photo' && (
          <div className="animate-in fade-in">
            <RealPhotoUploader 
              language={language}
              initialPhotoUrl={photoUrl}
              onPhotoAnalyzed={(url, desc, qualityOk, meta) => {
                setPhotoUrl(url);
                setPhotoDescriptors(desc);
                if (meta) {
                  setVisionMetaState(meta);
                }
                const firstDesc = desc && desc.length > 0 ? desc[0] : 'Visual inspection uploaded';
                setTextInput(prev => prev || `Visual inspection: ${firstDesc}`);
              }}
            />
            {(photoUrl || textInput) && (
              <div className="flex justify-end mt-4">
                <button 
                  onClick={() => {
                    const detectedCode = visionMetaState?.detectedAilmentCode || 'eye_symptoms';
                    const targetAilment = ailments.find(a => a.code === detectedCode) || 
                                          detectAilmentFromText(textInput || 'conjunctivitis red eye');
                    startAssessment(targetAilment, visionMetaState?.leadingQuestions);
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <span>{t.assessImage}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
