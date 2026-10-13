import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  AlertTriangle,
  Volume2,
  VolumeX,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Radio,
  FileText,
  User,
  HeartPulse,
  Bot,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import type { Person, Language, TriageResult, QuestionStep, Ailment } from '../types';
import { getQuestionTree, runRuleBasedTriage, AILMENTS } from '../engine/ruleBasedEngine';
import { resolveAilmentVector } from '../engine/vectorSearch';

interface ConversationalTriageViewProps {
  person: Person;
  language: Language;
  onTriageComplete: (result: TriageResult, answers: Record<string, any>, ailment?: Ailment) => void;
  onOpenSos: () => void;
  onCancel: () => void;
  initialAilment?: Ailment;
}

interface TranscriptItem {
  speaker: 'doctor' | 'patient';
  text: string;
  time: string;
  isRedFlag?: boolean;
}

export const ConversationalTriageView: React.FC<ConversationalTriageViewProps> = ({
  person,
  language,
  onTriageComplete,
  onOpenSos,
  onCancel,
  initialAilment,
}) => {
  const [callStatus, setCallStatus] = useState<'connecting' | 'intake' | 'asking_questions' | 'analyzing' | 'ended'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [patientSpeaking, setPatientSpeaking] = useState(false);
  
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [interimUserSpeech, setInterimUserSpeech] = useState('');
  const [isSandbox, setIsSandbox] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Clinical Rule Engine State
  const [identifiedAilment, setIdentifiedAilment] = useState<Ailment | null>(initialAilment || null);
  const [questions, setQuestions] = useState<QuestionStep[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Mutable refs to prevent stale closures in SpeechRecognition callbacks
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const identifiedAilmentRef = useRef<Ailment | null>(initialAilment || null);
  const questionsRef = useRef<QuestionStep[]>([]);
  const currentQuestionIndexRef = useRef<number>(0);
  const answersRef = useRef<Record<string, any>>({});
  const callStatusRef = useRef<'connecting' | 'intake' | 'asking_questions' | 'analyzing' | 'ended'>('connecting');

  // Keep refs synchronized
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { identifiedAilmentRef.current = identifiedAilment; }, [identifiedAilment]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { currentQuestionIndexRef.current = currentQuestionIndex; }, [currentQuestionIndex]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);

  // Audio & SDK refs
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef<boolean>(false);
  const isRestartingRef = useRef<boolean>(false);
  const timerRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const trtcClientRef = useRef<any>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsSafetyTimeoutRef = useRef<any>(null);

  // Auto-scroll transcript container
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interimUserSpeech]);

  // Call duration timer
  useEffect(() => {
    if (callStatus === 'intake' || callStatus === 'asking_questions') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Cheerful Grandma voice synthesis with robust GC protection and guaranteed completion timer
  const speakText = (text: string, onEnd?: () => void) => {
    if (isSpeakerMuted || !synthRef.current) {
      if (onEnd) onEnd();
      return;
    }

    if (ttsSafetyTimeoutRef.current) {
      clearTimeout(ttsSafetyTimeoutRef.current);
      ttsSafetyTimeoutRef.current = null;
    }

    try {
      synthRef.current.cancel();

      // Ensure browser speech synthesis is unpaused (Chromium/Safari bug on production domains)
      if (synthRef.current.paused) {
        try { synthRef.current.resume(); } catch (e) {}
      }

      const utterance = new SpeechSynthesisUtterance(text);
      activeUtteranceRef.current = utterance;
      // Retain reference globally to prevent Chrome/Safari garbage collection from swallowing onend
      if (typeof window !== 'undefined') {
        (window as any).__activeUtterance = utterance;
      }

      // Select warmest female / grandma-like voice from system voices
      const voices = synthRef.current.getVoices ? synthRef.current.getVoices() : [];
      let selectedVoice: SpeechSynthesisVoice | null = null;

      if (language === 'zh') {
        utterance.lang = 'zh-CN';
        selectedVoice = voices.find(v => v.lang.startsWith('zh') && (v.name.includes('Mei-Jia') || v.name.includes('Xiaoxiao') || v.name.includes('Sinji') || v.name.includes('Ting-Ting') || v.name.includes('Female'))) || null;
      } else if (language === 'ms') {
        utterance.lang = 'ms-MY';
        selectedVoice = voices.find(v => v.lang.startsWith('ms') && v.name.includes('Female')) || null;
      } else {
        utterance.lang = 'en-SG';
        // Prefer warm, natural feminine English voices (e.g. Samantha, Karen, Victoria, Google UK English Female, Tessa)
        selectedVoice = voices.find(v => 
          (v.lang.startsWith('en') || v.lang.includes('SG') || v.lang.includes('GB') || v.lang.includes('US')) &&
          (v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Karen') || v.name.includes('Moira') || v.name.includes('Fiona') || v.name.includes('Female'))
        ) || null;
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Cheerful Grandma modulation: slightly elevated pitch (1.18 - 1.25) and calm, gentle pacing (0.92)
      utterance.pitch = 1.22;
      utterance.rate = 0.94;

      let hasFinished = false;
      const finishExecution = () => {
        if (hasFinished) return;
        hasFinished = true;
        if (ttsSafetyTimeoutRef.current) {
          clearTimeout(ttsSafetyTimeoutRef.current);
          ttsSafetyTimeoutRef.current = null;
        }
        setAgentSpeaking(false);
        activeUtteranceRef.current = null;
        if (typeof window !== 'undefined') {
          delete (window as any).__activeUtterance;
        }
        // Small buffer before listening for user response to prevent audio echo
        setTimeout(() => {
          if (onEnd) onEnd();
        }, 150);
      };

      utterance.onstart = () => {
        setAgentSpeaking(true);
      };

      utterance.onend = () => {
        finishExecution();
      };

      utterance.onerror = (err) => {
        console.warn('TTS utterance event error:', err);
        finishExecution();
      };

      // Guaranteed fallback timeout: in deployed environments, if browser never fires onend,
      // prevent the call from hanging indefinitely.
      const estimatedDurationMs = Math.max(3000, Math.min(18000, (text.length / 10) * 1200 + 1500));
      ttsSafetyTimeoutRef.current = setTimeout(() => {
        if (!hasFinished) {
          console.info('[TTS] Guaranteed timeout elapsed, advancing flow');
          finishExecution();
        }
      }, estimatedDurationMs);

      synthRef.current.speak(utterance);
    } catch (e) {
      console.warn('TTS playback error:', e);
      setAgentSpeaking(false);
      activeUtteranceRef.current = null;
      if (onEnd) onEnd();
    }
  };

  const addDoctorMessage = (text: string, isRedFlag = false) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const item: TranscriptItem = { speaker: 'doctor', text, time: now, isRedFlag };
    setTranscript(prev => [...prev, item]);
    return item;
  };

  const addPatientMessage = (text: string, isRedFlag = false) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const item: TranscriptItem = { speaker: 'patient', text, time: now, isRedFlag };
    setTranscript(prev => [...prev, item]);
    return item;
  };

  // Helper to extract question text by language
  const getQuestionText = (q: QuestionStep): string => {
    if (language === 'zh' && q.textZh) return q.textZh;
    if (language === 'ms' && q.textMs) return q.textMs;
    return q.text;
  };

  // Initial connection
  useEffect(() => {
    let active = true;

    const initCall = async () => {
      try {
        const roomId = Math.floor(100000 + Math.random() * 900000);
        const userId = `patient_${person.id.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now() % 10000}`;

        // 1. Fetch UserSig
        const sigRes = await fetch('/api/trtc/user-sig', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const sigData = await sigRes.json();
        if (sigData.isSandbox) setIsSandbox(true);

        // 2. Start TRTC AI Conversation Task
        const birthYear = person.dob ? new Date(person.dob).getFullYear() : 1970;
        const currentYear = new Date().getFullYear();
        const calculatedAge = Math.max(0, currentYear - birthYear);

        await fetch('/api/trtc/ai-agent/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            userId,
            patientContext: {
              name: person.name,
              age: calculatedAge,
              chronicConditions: person.medicalProfile?.conditions?.map(c => c.name) || [],
              medications: person.medicalProfile?.medications?.map(m => m.name) || [],
            },
            language,
          }),
        });

        // Initialize TRTC Web SDK if available (non-blocking so Web Speech Recognition is not disrupted)
        try {
          const TRTCModule = await import('trtc-sdk-v5');
          const TRTC = TRTCModule.default || TRTCModule;
          if (TRTC && typeof TRTC.create === 'function' && !sigData.isSandbox) {
            const trtc = TRTC.create();
            trtcClientRef.current = trtc;
            await trtc.enterRoom({
              roomId,
              userId,
              userSig: sigData.userSig,
              sdkAppId: sigData.sdkAppId,
            });
            // Try publishing audio, but if it fails or conflicts with SpeechRecognition, fail softly
            trtc.startLocalAudio().catch((audioErr: any) => {
              console.warn('[TRTC] startLocalAudio non-fatal notice:', audioErr);
            });
          }
        } catch (webrtcErr) {
          console.info('[TRTC] Standard browser audio fallback active');
        }

        if (!active) return;

        // If ailment was already picked (e.g., from chips), jump directly to rule question tree
        if (initialAilment) {
          const tree = getQuestionTree(initialAilment.code, person);
          setQuestions(tree);
          questionsRef.current = tree;
          setCallStatus('asking_questions');
          callStatusRef.current = 'asking_questions';

          const greeting = language === 'zh'
            ? `您好 ${person.name}，我是您的分诊医生 Dr. GranPocket。我们开始针对【${initialAilment.nameZh || initialAilment.name}】的临床评估。`
            : language === 'ms'
            ? `Halo ${person.name}, saya Dr. GranPocket. Mari kita mulakan penilaian klinikal untuk ${initialAilment.nameMs || initialAilment.name}.`
            : `Hello ${person.name}, I am Dr. GranPocket. Let us begin our clinical triage evaluation for ${initialAilment.name}.`;

          addDoctorMessage(greeting);
          speakText(greeting, () => {
            if (tree.length > 0) {
              const firstQ = tree[0];
              const qText = getQuestionText(firstQ);
              addDoctorMessage(qText);
              speakText(qText);
            }
          });
        } else {
          // Intake mode: Ask for symptoms
          setCallStatus('intake');
          callStatusRef.current = 'intake';

          const intakeGreeting = language === 'zh'
            ? `您好 ${person.name}！我是 Dr. GranPocket。请问您今天感觉哪里不舒服？`
            : language === 'ms'
            ? `Halo ${person.name}! Saya Dr. GranPocket. Apakah gejala yang anda alami hari ini?`
            : `Hello ${person.name}! I am Dr. GranPocket. Please describe what symptoms or discomfort you are experiencing today.`;

          addDoctorMessage(intakeGreeting);
          speakText(intakeGreeting);
        }

        startSpeechRecognition();

      } catch (err: any) {
        if (!active) return;
        console.error('TRTC AI Call init error:', err);
        setCallStatus('intake');
        callStatusRef.current = 'intake';
        startSpeechRecognition();
      }
    };

    initCall();

    return () => {
      active = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (trtcClientRef.current) {
        try {
          trtcClientRef.current.stopLocalAudio();
          trtcClientRef.current.exitRoom();
        } catch (e) {}
      }
    };
  }, []);

  // Web Speech recognition listener for patient voice with resilient auto-restart and echo protection
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'zh' ? 'zh-CN' : language === 'ms' ? 'ms-MY' : 'en-SG';

      recognition.onstart = () => {
        isRecognitionActiveRef.current = true;
        isRestartingRef.current = false;
        setPatientSpeaking(false);
      };

      recognition.onresult = (event: any) => {
        // Echo filter: ignore microphone pickup if Dr. GranPocket voice is currently actively playing
        if (agentSpeaking) {
          return;
        }

        let interim = '';
        let finalTxt = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTxt += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setInterimUserSpeech(interim);
          setPatientSpeaking(true);
        }

        if (finalTxt.trim()) {
          setInterimUserSpeech('');
          setPatientSpeaking(false);
          handlePatientVoiceInput(finalTxt.trim());
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn('Speech recog event warning:', e.error);
        }
        setPatientSpeaking(false);
        // If not allowed, do not spam restart
        if (e.error === 'not-allowed') {
          isRecognitionActiveRef.current = false;
        }
      };

      recognition.onend = () => {
        isRecognitionActiveRef.current = false;
        setPatientSpeaking(false);

        // Resilient restart: if call is still active and not muted, cleanly restart with backoff
        if (callStatusRef.current !== 'analyzing' && callStatusRef.current !== 'ended' && !isMuted) {
          if (!isRestartingRef.current) {
            isRestartingRef.current = true;
            setTimeout(() => {
              if (callStatusRef.current !== 'analyzing' && callStatusRef.current !== 'ended' && !isMuted && !isRecognitionActiveRef.current) {
                try {
                  recognition.start();
                } catch (err: any) {
                  // If start threw (e.g. invalid state), re-instantiate cleanly
                  if (err.name !== 'InvalidStateError') {
                    console.info('[Speech] Rebuilding recognition instance...');
                    startSpeechRecognition();
                  }
                }
              }
              isRestartingRef.current = false;
            }, 300);
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('SpeechRecognition start failed:', err);
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) {}
      }
    } else {
      setIsMuted(true);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    }
  };

  // Process incoming patient speech using mutable refs
  const handlePatientVoiceInput = async (spokenText: string) => {
    const lower = spokenText.toLowerCase();

    // 1. Red Flag check across all turns
    const criticalFlags = ['chest pain', 'cannot breathe', 'heart attack', 'stroke', 'bleeding heavily', 'passed out', 'unconscious', 'pengsan', '胸痛', '无法呼吸'];
    const isDanger = criticalFlags.some(kw => lower.includes(kw));

    addPatientMessage(spokenText, isDanger);

    if (isDanger) {
      const emergencyReply = language === 'zh'
        ? `检测到危急症状！这属于紧急情况，我正在为您连接紧急呼叫。请立即坐下保持冷静。`
        : language === 'ms'
        ? `Gejala kecemasan dikesan! Saya sedang menghubungi perkhidmatan kecemasan sekarang. Sila duduk dan bertenang.`
        : `Critical red-flag symptom detected. I am triggering emergency services immediately. Please sit down and stay calm.`;

      addDoctorMessage(emergencyReply, true);
      speakText(emergencyReply, () => {
        onOpenSos();
      });
      return;
    }

    // 2. Dispatch based on current conversation stage
    if (callStatusRef.current === 'intake') {
      await processIntakeSpeech(spokenText);
    } else if (callStatusRef.current === 'asking_questions') {
      await processQuestionAnswer(spokenText);
    }
  };

  // Stage 1: Identify Ailment from initial symptom description
  const processIntakeSpeech = async (spokenText: string) => {
    try {
      setAgentSpeaking(true);

      // Match ailment via Vector/Semantic resolver
      let matchedAilment: Ailment | null = null;
      try {
        const vectorMatch = resolveAilmentVector(spokenText, 0.20);
        if (vectorMatch && vectorMatch.code !== 'general') {
          const found = AILMENTS.find(a => a.code === vectorMatch.code);
          if (found) matchedAilment = found;
        }
      } catch (e) {
        console.warn('Vector match fallback:', e);
      }

      // Keyword fallback match if needed
      if (!matchedAilment) {
        const lower = spokenText.toLowerCase();
        for (const a of AILMENTS) {
          if (lower.includes(a.name.toLowerCase()) || (a.code && lower.includes(a.code))) {
            matchedAilment = a;
            break;
          }
        }
      }

      const finalAilment: Ailment = matchedAilment || AILMENTS.find(a => a.code === 'general') || {
        code: 'general',
        name: 'General Symptoms',
        description: 'General health review triage',
        icon: 'HelpCircle',
        redFlagThemes: ['General weakness', 'Persistent discomfort']
      };

      setIdentifiedAilment(finalAilment);
      identifiedAilmentRef.current = finalAilment;

      // Fetch rule questions for this specific condition
      const tree = getQuestionTree(finalAilment.code, person);
      setQuestions(tree);
      questionsRef.current = tree;
      setCurrentQuestionIndex(0);
      currentQuestionIndexRef.current = 0;

      setCallStatus('asking_questions');
      callStatusRef.current = 'asking_questions';

      const doctorAck = language === 'zh'
        ? `我了解了，我们将评估【${finalAilment.nameZh || finalAilment.name}】的情况。`
        : language === 'ms'
        ? `Baiklah, mari kita semak gejala berkaitan ${finalAilment.nameMs || finalAilment.name}.`
        : `Understood. Let's evaluate your symptoms for ${finalAilment.name}.`;

      addDoctorMessage(doctorAck);

      speakText(doctorAck, () => {
        if (tree.length > 0) {
          const firstQ = tree[0];
          const qText = getQuestionText(firstQ);
          addDoctorMessage(qText);
          speakText(qText);
        } else {
          // No questions in tree, proceed to evaluation
          concludeRuleTriage();
        }
      });

    } catch (err) {
      console.error('Error during intake processing:', err);
      setAgentSpeaking(false);
    }
  };

  // Stage 2: Parse spoken answer into rule answer and advance tree
  const processQuestionAnswer = async (spokenText: string) => {
    const currentQList = questionsRef.current;
    const currentIdx = currentQuestionIndexRef.current;
    const currentQ = currentQList[currentIdx];

    if (!currentQ) {
      concludeRuleTriage();
      return;
    }

    // Determine normalized answer value
    let parsedAnswer: any = spokenText;
    const lower = spokenText.toLowerCase().trim();

    if (currentQ.answerType === 'yes_no') {
      const isYes = lower.includes('yes') || lower.includes('ya') || lower.includes('yea') || lower.includes('yep') || lower.includes('有') || lower.includes('是') || lower.includes('对') || lower.includes('betul');
      const isNo = lower.includes('no') || lower.includes('not') || lower.includes('tidak') || lower.includes('tak') || lower.includes('没有') || lower.includes('不是');
      if (isYes) parsedAnswer = 'yes';
      else if (isNo) parsedAnswer = 'no';
      else parsedAnswer = isYes ? 'yes' : 'no';
    } else if (currentQ.answerType === 'number') {
      const match = lower.match(/\d+(\.\d+)?/);
      if (match) parsedAnswer = parseFloat(match[0]);
    }

    // Update answers dictionary
    const updatedAnswers = {
      ...answersRef.current,
      [currentQ.id]: parsedAnswer
    };
    setAnswers(updatedAnswers);
    answersRef.current = updatedAnswers;

    const nextIdx = currentIdx + 1;
    if (nextIdx < currentQList.length) {
      setCurrentQuestionIndex(nextIdx);
      currentQuestionIndexRef.current = nextIdx;

      const nextQ = currentQList[nextIdx];
      const nextQText = getQuestionText(nextQ);
      
      const transitionWord = language === 'zh' ? '好的。' : language === 'ms' ? 'Baiklah.' : 'Got it.';
      const spokenPrompt = `${transitionWord} ${nextQText}`;

      addDoctorMessage(spokenPrompt);
      speakText(spokenPrompt);
    } else {
      // All questions completed! Prompt user cheerfully to click button to complete triage
      const completedPrompt = language === 'zh'
        ? '所有问题已经完成啦！请点击按钮完成分诊。'
        : language === 'ms'
        ? 'Semua soalan telah selesai! Sila klik butang untuk melengkapkan triage.'
        : 'All questions are completed! Please click on the button below to complete triage.';

      addDoctorMessage(completedPrompt);
      speakText(completedPrompt);
    }
  };

  // Manual button click alternative for answers
  const handleManualAnswerClick = (value: any) => {
    const displayLabel = typeof value === 'string' ? value : String(value);
    addPatientMessage(displayLabel);
    processQuestionAnswer(displayLabel);
  };

  // Stage 3: Run Rule-Based Engine & Deliver Clinical Outcome
  const concludeRuleTriage = () => {
    setCallStatus('analyzing');
    callStatusRef.current = 'analyzing';

    if (synthRef.current) synthRef.current.cancel();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const currentAilment: Ailment = identifiedAilmentRef.current || {
      code: 'general',
      name: 'General Symptoms',
      icon: 'HelpCircle',
      redFlagThemes: ['General weakness', 'Persistent discomfort']
    };

    // EXECUTE RULE-BASED TRIAGE ENGINE (Authority over severity)
    const ruleResult: TriageResult = runRuleBasedTriage({
      ailmentCode: currentAilment.code,
      answers: answersRef.current,
      person,
      language,
    });

    // Provide verbal clinical synthesis to patient
    const conclusionText = language === 'zh'
      ? `临床评估已完成。分诊结果为：【${ruleResult.careTierText || ruleResult.action}】。${ruleResult.action}`
      : language === 'ms'
      ? `Penilaian klinikal selesai. Tahap triage: ${ruleResult.careTierText || ruleResult.action}. ${ruleResult.action}`
      : `Clinical triage evaluation complete. Assessment tier: ${ruleResult.careTierText || ruleResult.severity}. Action recommendation: ${ruleResult.action}`;

    addDoctorMessage(conclusionText);

    speakText(conclusionText, () => {
      // Pass final result and answers to GranPocket
      onTriageComplete(ruleResult, answersRef.current, currentAilment);
    });
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const personAge = person.dob ? Math.max(0, new Date().getFullYear() - new Date(person.dob).getFullYear()) : 0;
  const activeQuestion = questions[currentQuestionIndex];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                <Bot className="w-8 h-8 text-sky-200" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-indigo-900"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold tracking-tight">TRTC Rule-Based Voice Triage</h2>
                <span className="bg-sky-400/20 text-sky-200 text-xs px-2.5 py-0.5 rounded-full border border-sky-300/30 font-medium">
                  {identifiedAilment ? identifiedAilment.name : 'Intake'}
                </span>
              </div>
              <p className="text-sm text-sky-100/90 mt-1 flex items-center space-x-2">
                <span>Assessing <strong>{person.name}</strong> {personAge > 0 ? `(${personAge} y/o)` : ''}</span>
                <span>•</span>
                <span className="font-mono bg-black/20 px-2 py-0.5 rounded text-xs">{formatTimer(elapsedSeconds)}</span>
              </p>
            </div>
          </div>

          {/* Quick SOS Trigger */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenSos}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center space-x-2 shadow-lg hover:shadow-red-500/25 transition-all text-sm"
            >
              <ShieldAlert className="w-4 h-4 text-white animate-bounce" />
              <span>SOS Red Flag</span>
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all text-sm border border-white/20"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Status ticker */}
        <div className="mt-4 bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-sky-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>
              <strong>Rule Engine Active:</strong> Questions & outcome determined by GranPocket clinical rules.
            </span>
          </div>
          {questions.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded font-mono font-bold">
              Question {Math.min(currentQuestionIndex + 1, questions.length)} of {questions.length}
            </span>
          )}
        </div>
      </div>

      {/* Main Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Visual Clinician & Current Rule Question */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between items-center text-center">
          
          <div className="w-full">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-4">
              <span className="flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                VOICE TRIAGE ENGINE
              </span>
              <span className={`px-2 py-0.5 rounded-full ${agentSpeaking ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : patientSpeaking ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {agentSpeaking ? 'Dr. GranPocket Speaking' : patientSpeaking ? 'Patient Speaking' : 'Listening...'}
              </span>
            </div>

            {/* Pulsing Avatar */}
            <div className="my-6 relative flex items-center justify-center">
              <div className={`absolute w-44 h-44 rounded-full transition-all duration-700 ${agentSpeaking ? 'bg-indigo-500/20 animate-ping' : patientSpeaking ? 'bg-sky-500/20 animate-ping' : 'bg-slate-200/50 dark:bg-slate-800/50'}`} />
              <div className={`absolute w-32 h-32 rounded-full transition-all duration-500 ${agentSpeaking ? 'bg-indigo-500/30 scale-110' : patientSpeaking ? 'bg-sky-500/30 scale-110' : 'bg-slate-200 dark:bg-slate-800'}`} />
              
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl border-4 transition-all duration-300 ${
                agentSpeaking
                  ? 'bg-gradient-to-tr from-indigo-600 to-sky-400 border-indigo-300 text-white scale-105'
                  : patientSpeaking
                  ? 'bg-gradient-to-tr from-sky-500 to-emerald-400 border-sky-200 text-white scale-105'
                  : 'bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
              }`}>
                {agentSpeaking ? (
                  <Sparkles className="w-10 h-10 animate-spin text-white" style={{ animationDuration: '6s' }} />
                ) : patientSpeaking ? (
                  <Mic className="w-10 h-10 animate-pulse text-white" />
                ) : (
                  <Bot className="w-10 h-10 opacity-80" />
                )}
              </div>
            </div>

            {/* Current Active Rule Question Card */}
            {activeQuestion ? (
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-left">
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                  <span>Current Clinical Assessment</span>
                  <span>{currentQuestionIndex + 1}/{questions.length}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                  {getQuestionText(activeQuestion)}
                </p>

                {/* Quick Answer Chips */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeQuestion.answerType === 'yes_no' ? (
                    <>
                      <button
                        onClick={() => handleManualAnswerClick('yes')}
                        className="flex-1 py-2 px-3 bg-white dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handleManualAnswerClick('no')}
                        className="flex-1 py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        No
                      </button>
                    </>
                  ) : activeQuestion.options ? (
                    activeQuestion.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleManualAnswerClick(opt)}
                        className="py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium transition-all shadow-sm"
                      >
                        {opt}
                      </button>
                    ))
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                Listening for patient symptom description...
              </div>
            )}

            {/* Interim Speech Preview */}
            {interimUserSpeech && (
              <div className="mt-3 p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200 italic animate-pulse">
                "{interimUserSpeech}..."
              </div>
            )}
          </div>

          {/* Control Bar */}
          <div className="w-full pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center space-x-3">
            <button
              onClick={toggleMute}
              className={`p-3.5 rounded-2xl font-medium flex items-center justify-center transition-all shadow-md ${
                isMuted
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
              className={`p-3.5 rounded-2xl font-medium flex items-center justify-center transition-all shadow-md ${
                isSpeakerMuted
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
              title={isSpeakerMuted ? 'Turn on Speaker' : 'Mute Speaker'}
            >
              {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              onClick={concludeRuleTriage}
              disabled={callStatus === 'analyzing'}
              className={`flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 text-sm ${
                questions.length > 0 && currentQuestionIndex >= questions.length - 1 && Object.keys(answers).length >= questions.length
                  ? 'ring-4 ring-emerald-300 ring-offset-2 animate-bounce'
                  : ''
              }`}
            >
              {callStatus === 'analyzing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating Rules...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Triage</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Transcription Stream */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col h-[540px]">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Clinical Dialogue Transcript</h3>
            </div>
            <span className="text-xs text-slate-400">
              {transcript.length} turns recorded
            </span>
          </div>

          {/* Transcript Scroll Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
            {transcript.map((item, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${item.speaker === 'patient' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center space-x-1 text-[11px] text-slate-400 mb-1 px-1">
                  <span>{item.speaker === 'doctor' ? 'Dr. GranPocket' : person.name}</span>
                  <span>•</span>
                  <span>{item.time}</span>
                  {item.isRedFlag && (
                    <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded font-bold ml-1">
                      RED FLAG
                    </span>
                  )}
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    item.speaker === 'patient'
                      ? item.isRedFlag
                        ? 'bg-red-600 text-white rounded-br-none'
                        : 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  {item.text}
                </div>
              </div>
            ))}

            {agentSpeaking && (
              <div className="flex items-center space-x-2 text-xs text-indigo-600 dark:text-indigo-400 italic py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Dr. GranPocket is speaking...</span>
              </div>
            )}
          </div>

          {/* Quick Intake Suggestions (only during initial intake) */}
          {callStatus === 'intake' && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
              <p className="text-[11px] text-slate-400 mb-2 font-medium">Or speak/tap a common symptom to begin:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'I have a fever since yesterday',
                  'Persistent cough with phlegm',
                  'Sore throat and difficulty swallowing',
                  'Severe headache',
                  'Stomach pain and nausea'
                ].map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handlePatientVoiceInput(chip)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
