import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { InterviewConfig, TranscriptItem, NonVerbalSnapshot } from '../types';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Loader2 } from 'lucide-react';
import { arrayBufferToBase64, base64ToUint8Array, decodeAudioData, float32ToInt16 } from '../services/audioUtils';
import { PERSONA_GUIDELINES } from '../services/personaPrompts';

interface LiveSessionProps {
  config: InterviewConfig;
  onEndSession: (transcript: TranscriptItem[], nonVerbalSnapshots: NonVerbalSnapshot[], videoBlob: Blob | null) => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ config, onEndSession }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMicOnRef = useRef(true);
  const isCamOnRef = useRef(true);
  const isSpeakingRef = useRef(false);

  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isCamOnRef.current = isCamOn; }, [isCamOn]);

  const isAnalyzingFaceRef = useRef(false);

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
  const hasReceivedAudioRef = useRef(false);
  const hasReceivedTurnAudioRef = useRef(false);
  const GEMINI_API_KEY = (process.env.API_KEY || process.env.GEMINI_API_KEY || '').trim();

  const getRelativeTime = () => {
    if (!recordingStartTimeRef.current) return 0;
    return (Date.now() - recordingStartTimeRef.current) / 1000;
  };

  const parsePcmSampleRate = (mimeType?: string): number => {
    if (!mimeType) return 24000;
    const match = mimeType.match(/rate=(\d+)/);
    return match ? Number(match[1]) : 24000;
  };

  const pickRecordingMimeType = (): string | undefined => {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return undefined;
    }

    const candidates = [
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    return candidates.find((t) => MediaRecorder.isTypeSupported(t));
  };

  const speakFallback = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!text.trim()) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onstart = () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("[Audio Fallback] speechSynthesis failed:", e);
    }
  };

  const waitForSessionReady = (timeoutMs: number = 4000): Promise<boolean> => {
    if (activeSessionRef.current && isSessionActive.current) return Promise.resolve(true);

    return new Promise((resolve) => {
      const start = Date.now();
      const timer = window.setInterval(() => {
        if (activeSessionRef.current && isSessionActive.current) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(timer);
          resolve(false);
        }
      }, 100);
    });
  };

  // 1. Live Session Initialization
  useEffect(() => {
    let videoInterval: number;
    let mounted = true;

    const initSession = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: true,
        });

        // Bail out early if component was unmounted (React Strict Mode double-mount)
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        try {
            const mimeType = pickRecordingMimeType();
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            recordedChunksRef.current = [];
            console.log("[Recording] MediaRecorder mimeType:", recorder.mimeType || mimeType || 'default');

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

        if (!GEMINI_API_KEY) {
          throw new Error("Missing Gemini API key. Please set GEMINI_API_KEY in .env.local.");
        }
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        const personaGuidelines = PERSONA_GUIDELINES[config.persona];

        const systemInstruction = `
          Role: You are an experienced, sharp, but fair HR Interviewer representing "${config.companyName}".
          Job Title: "${config.jobTitle}"
          Candidate: "${config.candidateName}"

          ${personaGuidelines}

          OPENING PROTOCOL (MANDATORY):
          - When the session begins, DO NOT start the interview immediately.
          - First, greet the candidate warmly and introduce yourself briefly.
          - Then ask: "請問您準備好開始面試了嗎？" and WAIT for their confirmation.
          - Only after the candidate says they are ready (e.g., "準備好了", "好的", "可以"), proceed with the interview.
          - If they are not ready, reassure them and wait patiently.

          INTERVIEW STRATEGY (Active Inquiry):
          1. **Do NOT just ask the mandatory questions sequentially like a robot.**
          2. Treat the "Mandatory Themes" below as your checklist, but your goal is to assess DEPTH.
          3. **DEEP DIVE:** If the candidate gives a short, vague, or generic answer, you MUST ask a follow-up question.
             - Example: "可以給我一個具體的例子嗎？"
             - Example: "你在那個專案中負責哪個部分？"
             - Example: "你如何衡量這件事的成效？"
          4. Only move to the next topic when you are satisfied with the depth of the current answer.

          Mandatory Themes to Cover:
          ${config.mandatoryQuestions.map((q) => `- ${q}`).join('\n')}

          Job Description Context:
          ${config.jobDescription}

          VISUAL CUES (Real-time):
          - You can see the candidate. React to visible cues (e.g., if they look nervous or confused) according to your persona guidelines.

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
              console.log("[Gemini] Session Opened");
              console.log("[Audio] Output ctx state:", audioContextRef.current?.state, "| Input ctx state:", inputAudioContextRef.current?.state);
              isSessionActive.current = true;

              if (processorRef.current && inputSourceRef.current) {
                inputSourceRef.current.connect(processorRef.current);
                processorRef.current.connect(inputCtx.destination);

                processorRef.current.onaudioprocess = (e) => {
                  if (!isMicOnRef.current || !mounted || isSpeakingRef.current) return;

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

              // Iterate ALL parts for audio (not just parts[0])
              const parts = msg.serverContent?.modelTurn?.parts || [];
              if (parts.length > 0) {
                console.log("[Gemini] Received modelTurn with", parts.length, "parts");
              }

              for (const part of parts) {
                const audioData = part.inlineData?.data;
                const audioMimeType = part.inlineData?.mimeType || '';
                if (!audioData || !audioContextRef.current) continue;
                if (audioMimeType && !audioMimeType.startsWith('audio/')) continue;

                hasReceivedAudioRef.current = true;
                hasReceivedTurnAudioRef.current = true;
                setIsSpeaking(true);
                isSpeakingRef.current = true;
                try {
                    if (audioContextRef.current.state === 'suspended') {
                      console.warn("[Audio] Output AudioContext was suspended, resuming...");
                      await audioContextRef.current.resume();
                    }

                    const audioBytes = base64ToUint8Array(audioData);
                    let audioBuffer: AudioBuffer | null = null;
                    const ratesToTry = Array.from(new Set([parsePcmSampleRate(audioMimeType), 24000, 16000]));
                    for (const rate of ratesToTry) {
                      try {
                        audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current, rate);
                        break;
                      } catch {
                        audioBuffer = null;
                      }
                    }
                    if (!audioBuffer) {
                      throw new Error(`Unable to decode audio chunk. mimeType=${audioMimeType || 'unknown'}`);
                    }

                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioContextRef.current.destination);

                    const currentTime = audioContextRef.current.currentTime;
                    if (nextStartTimeRef.current < currentTime) {
                      nextStartTimeRef.current = currentTime;
                    }
                    const startTime = nextStartTimeRef.current;
                    source.start(startTime);
                    nextStartTimeRef.current = startTime + audioBuffer.duration;

                    audioSourcesRef.current.add(source);
                    source.onended = () => {
                      audioSourcesRef.current.delete(source);
                      if (audioSourcesRef.current.size === 0) {
                        setIsSpeaking(false);
                        isSpeakingRef.current = false;
                      }
                    };
                } catch (e) {
                    console.error("[Audio] Decoding error", e);
                    // Reset speaking state so mic doesn't stay permanently muted
                    setIsSpeaking(false);
                    isSpeakingRef.current = false;
                }
              }

              if (msg.serverContent?.interrupted) {
                console.log("[Gemini] Interrupted");
                audioSourcesRef.current.forEach(s => s.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
                isSpeakingRef.current = false;
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
                const text = msg.serverContent.outputTranscription.text;
                currentOutputTransRef.current += text;
                console.log("[Gemini] AI says:", text);
              }

              if (msg.serverContent?.turnComplete) {
                nextStartTimeRef.current = 0;
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
                  if (!hasReceivedTurnAudioRef.current) {
                    // Fallback: if model returned transcript but audio stream is absent, read it with browser TTS.
                    speakFallback(currentOutputTransRef.current);
                  }
                  transcriptRef.current.push({
                    role: 'model',
                    text: currentOutputTransRef.current,
                    timestamp: now,
                    relativeTime: relTime
                  });
                  currentOutputTransRef.current = '';
                }
                turnStartTimeRef.current = null;
                hasReceivedTurnAudioRef.current = false;
              }
            },
            onclose: (event: any) => {
              console.log("Session Closed", event);
              isSessionActive.current = false;
            },
            onerror: (e) => {
              console.error("[Gemini] Session Error:", e);
              isSessionActive.current = false;
              if (mounted) setError(`連線中斷: ${e?.message || 'Network Error'}`);
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
        if (mounted) setIsConnecting(false);

        // Note: AudioContext resume and greeting are deferred to handleStartInterview()
        // which is triggered by user click — this guarantees the user gesture needed
        // for browsers to allow AudioContext to run.

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

      // Stop all media tracks to release camera/mic
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }

      if (activeSessionRef.current) {
        activeSessionRef.current.close();
        activeSessionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Expression Observer Loop
  useEffect(() => {
    let expressionInterval: number | null = null;
    let mounted = true;

    if (!GEMINI_API_KEY) {
      console.warn('[Face] GEMINI_API_KEY missing, skip realtime expression analysis.');
      return;
    }
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const parseFaceJson = (raw: string): { expression: string; feedback: string } | null => {
      try {
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const expression = String(parsed?.expression || '').trim();
        const feedback = String(parsed?.feedback || '').trim();
        if (!expression && !feedback) return null;
        return {
          expression: expression || 'Neutral',
          feedback: feedback || '請維持自然眼神與穩定表情',
        };
      } catch {
        return null;
      }
    };

    const pushFaceSnapshot = (expression: string, feedback: string) => {
      nonVerbalSnapshotsRef.current.push({
        timestamp: Date.now(),
        relativeTime: getRelativeTime(),
        expression,
        feedback,
      });
    };

    const analyzeExpression = async () => {
      if (!mounted || !hasStarted || !isCamOnRef.current || !videoRef.current || !canvasRef.current) return;
      if (isAnalyzingFaceRef.current) return;

      if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        return;
      }

      isAnalyzingFaceRef.current = true;
      try {
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);

        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.75);
        if (!dataUrl || dataUrl === 'data:,') return;

        const base64Image = dataUrl.split(',')[1];
        if (!base64Image) return;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
              {
                text:
                  "你是面試肢體語言分析助手。請只回傳 JSON：{\"expression\":\"...\",\"feedback\":\"...\"}。expression 請用一個詞（如 Confident/Nervous/Neutral/Happy/Thinking）；feedback 請給一句 6-12 字的繁中面試建議。",
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
          },
        });

        const parsed = response.text ? parseFaceJson(response.text) : null;
        if (parsed) {
          pushFaceSnapshot(parsed.expression, parsed.feedback);
          console.log('[Face] Snapshot:', parsed.expression, parsed.feedback);
        } else {
          // If model output is malformed, still keep a neutral sample so final scoring has data.
          pushFaceSnapshot('Neutral', '維持自然眼神與穩定語速');
          console.warn('[Face] Malformed response, fallback snapshot used.');
        }
      } catch (e) {
        console.error('Expression analysis failed', e);
        // Keep pipeline alive even if transient API call fails.
        pushFaceSnapshot('Neutral', '系統暫時無法辨識，採用預設觀察');
      } finally {
        isAnalyzingFaceRef.current = false;
      }
    };

    // Run once shortly after start, then continue every 4s.
    const warmupTimer = window.setTimeout(() => {
      if (mounted) analyzeExpression();
    }, 1200);
    expressionInterval = window.setInterval(analyzeExpression, 4000);

    return () => {
      mounted = false;
      isAnalyzingFaceRef.current = false;
      window.clearTimeout(warmupTimer);
      if (expressionInterval !== null) clearInterval(expressionInterval);
    };
  }, [hasStarted, GEMINI_API_KEY]);

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
            const recordedType = recordedChunksRef.current[0]?.type || mediaRecorderRef.current.mimeType || 'video/webm';
            finalBlob = new Blob(recordedChunksRef.current, { type: recordedType });
            console.log("[Recording] Final blob type:", finalBlob.type, "size:", finalBlob.size);
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

  // Resume both AudioContexts on any user interaction (browser autoplay policy fallback)
  const resumeAudioContext = () => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    if (inputAudioContextRef.current?.state === 'suspended') {
      inputAudioContextRef.current.resume();
    }
  };

  // Send initial greeting to trigger AI to start speaking
  const sendGreeting = () => {
    const session = activeSessionRef.current;
    if (!session || !isSessionActive.current) {
      console.warn("[Greeting] Cannot send: session=", !!session, "active=", isSessionActive.current);
      return;
    }
    console.log("[Greeting] Sending greeting trigger...");
    if (config.resume) {
      // NOTE: Sending PDF/image binary through Live realtime media can cause session close
      // on some model/runtime combinations. Keep the session stable by sending text only.
      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: `我有上傳履歷檔（${config.resume.fileName}，${config.resume.mimeType}）。目前請先進行口頭面試：先打招呼並自我介紹，然後詢問我是否準備好開始面試。` }] }],
        turnComplete: true
      });
    } else {
      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: '面試開始了，請先打招呼並自我介紹，然後詢問我是否準備好開始面試。' }] }],
        turnComplete: true
      });
    }
  };

  // Called by user click — guarantees user gesture for AudioContext
  const handleStartInterview = async () => {
    // Resume both AudioContexts (requires user gesture to succeed)
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    if (inputAudioContextRef.current?.state === 'suspended') {
      await inputAudioContextRef.current.resume();
    }
    console.log("[Start] AudioContext output:", audioContextRef.current?.state, "| input:", inputAudioContextRef.current?.state);
    console.log("[Start] Session active:", isSessionActive.current, "| Session ref:", !!activeSessionRef.current);

    const ready = await waitForSessionReady();
    if (!ready) {
      console.warn("[Start] Session not ready yet, please try once more in 1-2s.");
      return;
    }

    setHasStarted(true);
    hasReceivedAudioRef.current = false;
    sendGreeting();

    // Retry once if no audio response within 5 seconds
    setTimeout(() => {
      if (!hasReceivedAudioRef.current && isSessionActive.current) {
        console.warn("[Start] No AI audio received after 5s, retrying greeting...");
        sendGreeting();
      }
    }, 5000);

    // Second retry at 10s — if still silent, send a short silent audio to trigger VAD
    setTimeout(() => {
      if (!hasReceivedAudioRef.current && isSessionActive.current && activeSessionRef.current) {
        console.warn("[Start] Still no audio at 10s, sending silent audio to trigger VAD...");
        // Send 0.5s of silence (16kHz, 16-bit PCM = 16000 bytes)
        const silentPcm = new Uint8Array(16000);
        const silentBase64 = arrayBufferToBase64(silentPcm.buffer);
        activeSessionRef.current.sendRealtimeInput({
          media: { mimeType: 'audio/pcm;rate=16000', data: silentBase64 }
        });
        // Then re-send the greeting text
        sendGreeting();
      }
    }, 10000);
  };

  const toggleMic = () => { resumeAudioContext(); setIsMicOn(!isMicOn); };
  const toggleCam = () => { resumeAudioContext(); setIsCamOn(!isCamOn); };

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
    <div className="flex flex-col h-full bg-noir-950 relative" onClick={resumeAudioContext}>
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
        {hasStarted && (
        <div className="absolute bottom-28 left-8 flex items-center gap-2 bg-red-500/20 backdrop-blur-md border border-red-500/30 px-3 py-1.5 rounded-full animate-pulse">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-red-300 text-xs font-mono font-bold">REC</span>
        </div>
        )}

        {/* Start Interview Overlay — requires user click to enable audio */}
        {!isConnecting && !hasStarted && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-noir-950/70 backdrop-blur-sm">
            <div className="text-noir-300 text-sm mb-4 tracking-wide">連線已建立，準備就緒</div>
            <button
              onClick={handleStartInterview}
              className="px-10 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 rounded-2xl font-bold text-lg hover:from-amber-400 hover:to-amber-500 transition-all duration-300 hover:scale-105 shadow-2xl shadow-amber-500/20"
            >
              開始面試
            </button>
            <div className="text-noir-500 text-xs mt-3">點擊以啟用麥克風與音訊</div>
          </div>
        )}

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
