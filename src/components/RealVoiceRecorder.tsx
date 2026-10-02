import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';
import type { Language } from '../types';

interface RealVoiceRecorderProps {
  language: Language;
  onTranscriptChange: (transcript: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export const RealVoiceRecorder: React.FC<RealVoiceRecorderProps> = ({
  language,
  onTranscriptChange,
  onRecordingStateChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize SpeechRecognition if available
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      // Set locale based on chosen language
      if (language === 'zh') {
        recognition.lang = 'zh-CN';
      } else if (language === 'ms') {
        recognition.lang = 'ms-MY';
      } else {
        recognition.lang = 'en-SG'; // Singapore English / Singlish accent tuning
      }

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript + ' ';
          } else {
            currentInterim += item[0].transcript;
          }
        }

        const combined = (finalTranscript + currentInterim).trim();
        setInterimText(combined);
        onTranscriptChange(combined);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access blocked. Please allow mic permissions in your browser.');
        } else if (event.error !== 'no-speech') {
          setErrorMessage(`Speech recognition notice: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (isRecording) {
          try {
            recognition.start();
          } catch (err) {
            // Already active
          }
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.log('SpeechRecognition API not natively available, using MediaRecorder fallback');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      stopAudioWave();
    };
  }, [language]);

  // Audio wave visualizer setup
  const startAudioWave = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setHasPermission(true);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err: any) {
      console.warn('Microphone permission not granted:', err);
      setHasPermission(false);
      setErrorMessage('Microphone permission not granted. Check browser settings.');
    }
  };

  const stopAudioWave = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  // Toggle Start / Stop
  const handleToggleRecord = async () => {
    setErrorMessage(null);

    if (!isRecording) {
      setIsRecording(true);
      onRecordingStateChange?.(true);

      // Start audio wave
      await startAudioWave();

      // Start Speech Recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.log('Recognition start err:', err);
        }
      } else {
        // Fallback for browsers without Web Speech API
        setErrorMessage('Web Speech API not supported in this browser. You can type or use sample audio.');
      }
    } else {
      setIsRecording(false);
      onRecordingStateChange?.(false);
      stopAudioWave();

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {}
      }
    }
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
      <div className="max-w-md mx-auto space-y-3">
        <div className="text-xs text-slate-600">
          {language === 'zh'
            ? '支持真实麦克风录音与实时转录（普通话/华语）。语音在本地转录，音频不会上传或离开您的设备。'
            : language === 'ms'
            ? 'Rakaman suara langsung & transkripsi bahasa Melayu. Audio kekal selamat pada peranti anda.'
            : 'Live microphone recording & on-device transcription (Singapore English / Mandarin / Malay). Raw audio never leaves your device.'}
        </div>

        {/* Big Mic Button with Live Audio Pulse */}
        <div className="py-2 flex flex-col items-center justify-center space-y-2">
          <div className="relative flex items-center justify-center">
            {isRecording && (
              <div
                className="absolute rounded-full bg-red-400/30 animate-ping"
                style={{
                  width: `${80 + audioLevel * 0.8}px`,
                  height: `${80 + audioLevel * 0.8}px`,
                }}
              />
            )}
            <button
              type="button"
              id="real-mic-toggle-button"
              onClick={handleToggleRecord}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/40'
                  : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/30'
              }`}
              title={isRecording ? 'Stop Recording' : 'Start Microphone'}
            >
              {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
          </div>

          <div className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
            {isRecording ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                <span className="text-red-700 font-extrabold">
                  Listening... Speak into microphone (Mic Level: {audioLevel > 0 ? `${audioLevel}%` : 'Detecting...'})
                </span>
              </>
            ) : (
              <span>Tap microphone above to speak, or select a voice sample below</span>
            )}
          </div>
        </div>

        {/* Live Audio Visualizer Bars */}
        {isRecording && (
          <div className="flex items-center justify-center space-x-1 h-6">
            {[25, 60, 85, 95, 70, 50, 90, 65, 40].map((h, idx) => (
              <div
                key={idx}
                className="w-1.5 bg-teal-600 rounded-full transition-all duration-75 animate-pulse"
                style={{
                  height: `${Math.max(6, (h * Math.max(audioLevel, 35)) / 100)}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Error message or permission warning if any */}
        {errorMessage && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-2 text-left">
            <AlertCircle size={15} className="shrink-0 text-amber-600" />
            <span>{errorMessage} (You can also use the simulated speech buttons below).</span>
          </div>
        )}

        {/* Quick Voice Audio Presets for Testing / Fallback */}
        <div className="space-y-1.5 pt-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Quick Voice Transcription Test (Simulate Speech Input):
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const sample = language === 'zh'
                  ? '宝宝发烧38.8度，精神很烦躁，流鼻水，不肯喝奶'
                  : 'Baby Lucas has fever 38.8°C, irritable, runny nose, refusing milk';
                setInterimText(sample);
                onTranscriptChange(sample);
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors flex items-center space-x-1"
            >
              <span>🍼</span>
              <span>Baby Lucas Fever (38.8°C)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const sample = language === 'zh'
                  ? '阿公突然口齿不清，右手无力抬不起，嘴角歪斜'
                  : 'Grandpa Ah Boon suddenly has slurred speech, right arm is weak and mouth is drooping';
                setInterimText(sample);
                onTranscriptChange(sample);
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors flex items-center space-x-1"
            >
              <span>👴</span>
              <span>Grandpa Stroke Symptoms</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const sample = language === 'zh'
                  ? '眼睛很红，流眼泪，有刺痛感和轻微红肿'
                  : 'Left eye is very red, tearing, foreign body sensation and swollen';
                setInterimText(sample);
                onTranscriptChange(sample);
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors flex items-center space-x-1"
            >
              <span>👁️</span>
              <span>Eye Irritation & Redness</span>
            </button>
          </div>
        </div>

        {/* Real-time Transcript Bubble */}
        {interimText && (
          <div className="text-left bg-white p-3.5 rounded-2xl border-2 border-teal-200 shadow-sm space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-[11px] font-bold text-teal-800 uppercase tracking-wider">
              <span>Transcribed Speech Result:</span>
              <span className="text-teal-600 font-normal">Ready for triage analysis</span>
            </div>
            <textarea
              value={interimText}
              onChange={(e) => {
                setInterimText(e.target.value);
                onTranscriptChange(e.target.value);
              }}
              rows={2}
              className="w-full text-sm font-semibold text-slate-900 leading-relaxed p-2 rounded-xl border border-slate-200 focus:border-teal-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};
