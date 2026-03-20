import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { InterviewConfig, TranscriptItem, NonVerbalSnapshot } from '../types';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Loader2 } from 'lucide-react';
import { arrayBufferToBase64, base64ToUint8Array, decodeAudioData, float32ToInt16 } from '../services/audioUtils';

interface LiveSessionProps {
  config: InterviewConfig;
  onEndSession: (transcript: TranscriptItem[], nonVerbalSnapshots: NonVerbalSnapshot[], videoBlob: Blob | null) => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ config, onEndSession }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMicOnRef = useRef(true);
  const isCamOnRef = useRef(true);

  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isCamOnRef.current = isCamOn; }, [isCamOn]);

  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const turnStartTimeRef = useRef<number | null>(null);

  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const transcriptRef = useRef<TranscriptItem[]>([]);
  const nonVerbalSnapshotsRef = useRef<NonVerbalSnapshot[]>([]);
  const currentInputTransRef = useRef('');
  const currentOutputTransRef = useRef('');

  const activeSessionRef = useRef<any>(null);
  const isSessionActive = useRef(false);

  const getRelativeTime = () => {
    if (!recordingStartTimeRef.current) return 0;
    return (Date.now() - recordingStartTimeRef.current) / 1000;
  };

  // 1. Live Session Initialization
  useEffect(() => {
    let videoInterval: number;
    let mounted = true;

    const initSession = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

        if (videoRef.current && mounted) {
          videoRef.current.srcObject = stream;
        }

        try {
            const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
                ? 'video/webm; codecs=vp9'
                : 'video/webm';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            recordedChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            recorder.onstart = () => {
                recordingStartTimeRef.current = Date.now();
                console.log("Recording started at", recordingStartTimeRef.current);
            };

            recorder.start();
        } catch (e) {
            console.error("Recording failed to start", e);
        }

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

        const inputCtx = new AudioContextClass({ sampleRate: 16000 });
        inputAudioContextRef.current = inputCtx;

        inputSourceRef.current = inputCtx.createMediaStreamSource(stream);
        processorRef.current = inputCtx.createScriptProcessor(4096, 1, 1);

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

        const systemInstruction = `
          Role: You are an experienced, sharp, but fair HR Interviewer representing "${config.companyName}".
          Job Title: "${config.jobTitle}"
          Candidate: "${config.candidateName}"
          Persona: ${config.persona} (Adjust your tone accordingly).

          INTERVIEW STRATEGY (Active Inquiry):
          1. **Do NOT just ask the mandatory questions sequentially like a robot.**
          2. Treat the "Mandatory Themes" below as your checklist, but your goal is to assess DEPTH.
          3. **DEEP DIVE:** If the candidate gives a short, vague, or generic answer, you MUST ask a follow-up question.
             - Example: "Can you give me a specific example of when you did that?"
             - Example: "What was your specific role in that project?"
             - Example: "How did you measure the success of that?"
          4. Only move to the next topic when you are satisfied with the depth of the current answer.

          Mandatory Themes to Cover:
          ${config.mandatoryQuestions.map((q, i) => `- ${q}`).join('\n')}

          Job Description Context:
          ${config.jobDescription}

          VISUAL CUES (Real-time):
          - You can see the candidate. If they look nervous, be reassuring. If they look confused, clarify.

          RESUME:
          - If the candidate provided a resume, I will send it to you at the beginning of the session. Use it to ask relevant questions.

          Language: Traditional Chinese (Taiwan).
        `;

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemInstruction,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName || 'Kore' } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              console.log("Gemini Live Session Opened");
              isSessionActive.current = true;
              if (mounted) setIsConnecting(false);

              if (config.resume) {
                console.log("Sending resume to model...");
                sessionPromise.then(sess => {
                    if (isSessionActive.current && config.resume) {
                         sess.sendRealtimeInput({
                             media: {
                                 mimeType: config.resume.mimeType,
                                 data: config.resume.data
                             }
                         });
                         sess.sendRealtimeInput({
                             text: `Here is my resume (${config.resume.fileName}). Please review it and ask me questions about my experience relevant to the ${config.jobTitle} position.`
                         });
                    }
                });
              }

              if (processorRef.current && inputSourceRef.current) {
                inputSourceRef.current.connect(processorRef.current);
                processorRef.current.connect(inputCtx.destination);

                processorRef.current.onaudioprocess = (e) => {
                  if (!isMicOnRef.current || !mounted) return;

                  const inputData = e.inputBuffer.getChannelData(0);
                  const int16Data = float32ToInt16(inputData);
                  const uint8Data = new Uint8Array(int16Data.buffer);
                  const base64Data = arrayBufferToBase64(uint8Data.buffer);

                  sessionPromise.then(sess => {
                    if (mounted && isSessionActive.current) {
                        try {
                            sess.sendRealtimeInput({
                            media: {
                                mimeType: 'audio/pcm;rate=16000',
                                data: base64Data
                            }
                            });
                        } catch (err) {
                            console.error("Error sending audio input:", err);
                        }
                    }
                  });
                };
              }

              if (canvasRef.current && videoRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                videoInterval = window.setInterval(() => {
                  if (!isCamOnRef.current || !videoRef.current || !ctx || !mounted) return;
                  if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) return;

                  canvasRef.current.width = videoRef.current.videoWidth / 4;
                  canvasRef.current.height = videoRef.current.videoHeight / 4;
                  ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

                  const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];

                  sessionPromise.then(sess => {
                    if (mounted && isSessionActive.current) {
                        try {
                            sess.sendRealtimeInput({
                            media: {
                                mimeType: 'image/jpeg',
                                data: base64Image
                            }
                            });
                        } catch (err) {
                             console.error("Error sending video input:", err);
                        }
                    }
                  });
                }, 1000);
              }
            },
            onmessage: async (msg: LiveServerMessage) => {
              if (!mounted) return;

              const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData && audioContextRef.current) {
                setIsSpeaking(true);
                try {
                    const audioBuffer = await decodeAudioData(
                    base64ToUint8Array(audioData),
                    audioContextRef.current
                    );

                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioContextRef.current.destination);

                    const currentTime = audioContextRef.current.currentTime;
                    const startTime = Math.max(nextStartTimeRef.current, currentTime);
                    source.start(startTime);
                    nextStartTimeRef.current = startTime + audioBuffer.duration;

                    audioSourcesRef.current.add(source);
                    source.onended = () => {
                    audioSourcesRef.current.delete(source);
                    if (audioSourcesRef.current.size === 0) setIsSpeaking(false);
                    };
                } catch (e) {
                    console.error("Audio decoding error", e);
                }
              }

              if (msg.serverContent?.interrupted) {
                console.log("Interrupted");
                audioSourcesRef.current.forEach(s => s.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
              }

              if (msg.serverContent?.inputTranscription) {
                if (!currentInputTransRef.current) {
                    turnStartTimeRef.current = getRelativeTime();
                }
                currentInputTransRef.current += msg.serverContent.inputTranscription.text;
              }
              if (msg.serverContent?.outputTranscription) {
                if (!currentOutputTransRef.current) {
                    turnStartTimeRef.current = getRelativeTime();
                }
                currentOutputTransRef.current += msg.serverContent.outputTranscription.text;
              }

              if (msg.serverContent?.turnComplete) {
                const now = Date.now();
                const relTime = turnStartTimeRef.current !== null ? turnStartTimeRef.current : getRelativeTime();

                if (currentInputTransRef.current.trim()) {
                  transcriptRef.current.push({
                    role: 'user',
                    text: currentInputTransRef.current,
                    timestamp: now,
                    relativeTime: relTime
                  });
                  currentInputTransRef.current = '';
                }
                if (currentOutputTransRef.current.trim()) {
                  transcriptRef.current.push({
                    role: 'model',
                    text: currentOutputTransRef.current,
                    timestamp: now,
                    relativeTime: relTime
                  });
                  currentOutputTransRef.current = '';
                }
                turnStartTimeRef.current = null;
              }
            },
            onclose: () => {
              console.log("Session Closed");
              isSessionActive.current = false;
            },
            onerror: (e) => {
              console.error("Session Error", e);
              isSessionActive.current = false;
              if (mounted) setError("連線中斷 (Network Error)");
            }
          }
        });

        const session = await sessionPromise;

        if (!mounted) {
            console.log("Session connected after unmount, closing.");
            session.close();
            return;
        }

        activeSessionRef.current = session;

      } catch (err) {
        console.error("Initialization Error", err);
        if (mounted) {
            setError("無法建立連線。請確認網路狀況或 API Key 設定。");
            setIsConnecting(false);
        }
      }
    };

    initSession();

    return () => {
      mounted = false;
      isSessionActive.current = false;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
         mediaRecorderRef.current.stop();
      }
      clearInterval(videoInterval);
      if (processorRef.current) processorRef.current.disconnect();
      if (inputSourceRef.current) inputSourceRef.current.disconnect();
      if (inputAudioContextRef.current) inputAudioContextRef.current.close();
      if (audioContextRef.current) audioContextRef.current.close();
      audioSourcesRef.current.forEach(s => s.stop());

      if (activeSessionRef.current) {
        activeSessionRef.current.close();
        activeSessionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Expression Observer Loop
  useEffect(() => {
    let expressionInterval: number;
    let mounted = true;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

    const analyzeExpression = async () => {
      if (!isCamOnRef.current || !videoRef.current || !canvasRef.current || isAnalyzingFace || !mounted) return;

      if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        return;
      }

      setIsAnalyzingFace(true);
      try {
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);

        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        if (!dataUrl || dataUrl === 'data:,') return;

        const base64Image = dataUrl.split(',')[1];
        if (!base64Image) return;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: "Analyze the facial expression of the candidate in the image. Return a JSON with: 'expression' (e.g., Confident, Nervous, Neutral, Happy, Thinking - max 1 word) and 'feedback' (A short, 6-word actionable tip for an interview context, e.g., 'Good eye contact', 'Try to smile more')." }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        expression: { type: Type.STRING },
                        feedback: { type: Type.STRING }
                    },
                    required: ["expression", "feedback"]
                }
            }
        });

        if (response.text && mounted) {
            const data = JSON.parse(response.text);

            nonVerbalSnapshotsRef.current.push({
                timestamp: Date.now(),
                relativeTime: getRelativeTime(),
                expression: data.expression,
                feedback: data.feedback
            });
        }

      } catch (e) {
        console.error("Expression analysis failed", e);
      } finally {
        if (mounted) setIsAnalyzingFace(false);
      }
    };

    expressionInterval = window.setInterval(analyzeExpression, 4000);

    return () => {
        mounted = false;
        clearInterval(expressionInterval);
    };
  }, [isAnalyzingFace]);

  const handleEndSession = async () => {
    let finalBlob: Blob | null = null;
    if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== 'inactive') {
            const stopPromise = new Promise<void>((resolve) => {
                if (mediaRecorderRef.current) {
                   mediaRecorderRef.current.onstop = () => resolve();
                   mediaRecorderRef.current.stop();
                } else {
                   resolve();
                }
            });
            await stopPromise;
        }

        if (recordedChunksRef.current.length > 0) {
            finalBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        }
    }

    const now = Date.now();
    const relTime = turnStartTimeRef.current !== null ? turnStartTimeRef.current : getRelativeTime();

    if (currentInputTransRef.current.trim()) {
      transcriptRef.current.push({ role: 'user', text: currentInputTransRef.current, timestamp: now, relativeTime: relTime });
    }
    if (currentOutputTransRef.current.trim()) {
      transcriptRef.current.push({ role: 'model', text: currentOutputTransRef.current, timestamp: now, relativeTime: relTime });
    }

    if (activeSessionRef.current) {
        activeSessionRef.current.close();
        activeSessionRef.current = null;
    }
    isSessionActive.current = false;

    onEndSession(transcriptRef.current, nonVerbalSnapshotsRef.current, finalBlob);
  };

  const toggleMic = () => setIsMicOn(!isMicOn);
  const toggleCam = () => setIsCamOn(!isCamOn);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-noir-950 text-noir-100 p-8">
        <h2 className="font-display text-3xl font-bold mb-4 text-red-400">發生錯誤</h2>
        <p className="text-noir-400">連線發生錯誤。請確認您的網路連線並重新整理頁面。</p>
        <p className="text-sm text-noir-600 mt-2 font-mono">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 rounded-lg font-bold hover:from-amber-400 hover:to-amber-500 transition-all duration-300">重新載入</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-noir-950 relative">
      {/* Header Info */}
      <div className="absolute top-4 left-4 z-10 glass text-white p-4 rounded-xl">
        <div className="text-xs text-noir-500 tracking-widest uppercase">面試職位</div>
        <div className="font-bold text-noir-100 mt-0.5">{config.jobTitle}</div>
        <div className="text-xs text-noir-500">{config.companyName}</div>
        <div className={`text-xs mt-1.5 font-mono ${isConnecting ? 'text-amber-400' : 'text-emerald-400'}`}>
          {isConnecting ? '連線中...' : '通話中'}
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${isCamOn ? 'opacity-100' : 'opacity-0'}`}
        />
        {!isCamOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-noir-900 text-noir-600">
            <div className="flex flex-col items-center">
              <User size={64} strokeWidth={1} />
              <p className="mt-4 text-noir-500 text-sm">鏡頭已關閉</p>
            </div>
          </div>
        )}

        {/* AI Audio Visualizer Overlay */}
        <div className="absolute bottom-28 right-8 w-48 h-32 glass rounded-xl p-4 flex flex-col items-center justify-center shadow-2xl transition-all">
          <div className="text-noir-300 text-xs font-medium mb-3 tracking-widest uppercase">
            AI 面試官
          </div>
          <div className="flex gap-1.5 items-end h-8">
             {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-1.5 bg-amber-400 rounded-full transition-all duration-100"
                  style={{
                    height: isSpeaking ? `${Math.random() * 24 + 4}px` : '4px',
                    opacity: isSpeaking ? 1 : 0.3
                  }}
                />
             ))}
          </div>
          {isConnecting && <Loader2 className="animate-spin text-amber-400 mt-2" size={16} />}
        </div>

        {/* Recording Indicator */}
        <div className="absolute bottom-28 left-8 flex items-center gap-2 bg-red-500/20 backdrop-blur-md border border-red-500/30 px-3 py-1.5 rounded-full animate-pulse">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-red-300 text-xs font-mono font-bold">REC</span>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Control Bar */}
      <div className="h-20 bg-noir-950 border-t border-noir-800/50 flex items-center justify-center gap-6 px-8 z-20">
        <button
          onClick={toggleMic}
          className={`p-4 rounded-full transition-all duration-300 ${isMicOn ? 'bg-noir-800/50 text-noir-300 hover:bg-noir-700/50 border border-noir-700/50' : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}`}
        >
          {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
        </button>

        <button
          onClick={toggleCam}
          className={`p-4 rounded-full transition-all duration-300 ${isCamOn ? 'bg-noir-800/50 text-noir-300 hover:bg-noir-700/50 border border-noir-700/50' : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}`}
        >
          {isCamOn ? <Video size={22} /> : <VideoOff size={22} />}
        </button>

        <button
          onClick={handleEndSession}
          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all duration-300 hover:scale-105 ml-4"
        >
          <PhoneOff size={18} /> 結束面試
        </button>
      </div>
    </div>
  );
};

export default LiveSession;
