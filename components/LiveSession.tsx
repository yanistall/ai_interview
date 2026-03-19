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
  const [isSpeaking, setIsSpeaking] = useState(false); // AI Speaking
  const [error, setError] = useState<string | null>(null);
  
  // Use Refs for toggles to be accessible inside async closures/intervals
  const isMicOnRef = useRef(true);
  const isCamOnRef = useRef(true);
  
  // Sync state to refs
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isCamOnRef.current = isCamOn; }, [isCamOn]);
  
  // Non-verbal UI State (Hidden for candidate, logic kept for recording)
  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For video frame capture
  const audioContextRef = useRef<AudioContext | null>(null); // Output
  const inputAudioContextRef = useRef<AudioContext | null>(null); // Input
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Recording & Timing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null); // Tracks when recording actually started
  const turnStartTimeRef = useRef<number | null>(null); // Tracks start of current speech turn

  // Audio Playback
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Transcription & Data State
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const nonVerbalSnapshotsRef = useRef<NonVerbalSnapshot[]>([]);
  const currentInputTransRef = useRef('');
  const currentOutputTransRef = useRef('');
  
  // Session Reference for cleanup
  const activeSessionRef = useRef<any>(null);
  const isSessionActive = useRef(false);

  // Helper to get relative time in seconds
  const getRelativeTime = () => {
    if (!recordingStartTimeRef.current) return 0;
    return (Date.now() - recordingStartTimeRef.current) / 1000;
  };

  // 1. Live Session Initialization (Audio/Video Conversation)
  useEffect(() => {
    let videoInterval: number;
    let mounted = true;

    const initSession = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        
        if (videoRef.current && mounted) {
          videoRef.current.srcObject = stream;
        }

        // --- Start Recording Logic ---
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
        // -----------------------------

        // Initialize Audio Contexts
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        // Output Audio Context
        audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
        
        // Input Audio Context
        const inputCtx = new AudioContextClass({ sampleRate: 16000 }); 
        inputAudioContextRef.current = inputCtx;

        // Setup Audio Input Pipeline
        inputSourceRef.current = inputCtx.createMediaStreamSource(stream);
        processorRef.current = inputCtx.createScriptProcessor(4096, 1, 1);

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

        // --- UPDATED SYSTEM INSTRUCTION FOR ACTIVE INQUIRY ---
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
              
              // --- SEND RESUME IF AVAILABLE ---
              if (config.resume) {
                console.log("Sending resume to model...");
                sessionPromise.then(sess => {
                    if (isSessionActive.current && config.resume) {
                         // Send the file content
                         sess.sendRealtimeInput({
                             media: {
                                 mimeType: config.resume.mimeType,
                                 data: config.resume.data
                             }
                         });
                         // Send a prompt to contextualize it
                         sess.sendRealtimeInput({
                             text: `Here is my resume (${config.resume.fileName}). Please review it and ask me questions about my experience relevant to the ${config.jobTitle} position.`
                         });
                    }
                });
              }
              // --------------------------------

              // Start Audio Streaming
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
                    // Check mounted AND isSessionActive to prevent sending to closed session
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

              // Start Video Streaming
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

              // 1. Handle Audio Output
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

              // 2. Handle Interruption
              if (msg.serverContent?.interrupted) {
                console.log("Interrupted");
                audioSourcesRef.current.forEach(s => s.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
              }

              // 3. Handle Transcription with Relative Time
              // Capture the start time of the turn when we first receive text
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
                // Use the captured start time, or fallback to current time if something went wrong
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
                // Reset turn start time
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
        
        // Critical: Check if we are still mounted. If not, close immediately.
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
      
      // Critical: Close session to prevent network errors in React StrictMode
      if (activeSessionRef.current) {
        activeSessionRef.current.close();
        activeSessionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Separate Expression Observer Loop (Runs in parallel - Logic Only)
  useEffect(() => {
    let expressionInterval: number;
    let mounted = true;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

    const analyzeExpression = async () => {
      // Use Refs for toggle check
      if (!isCamOnRef.current || !videoRef.current || !canvasRef.current || isAnalyzingFace || !mounted) return;
      
      // Safety check: ensure video has valid dimensions before capturing
      if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        return;
      }

      setIsAnalyzingFace(true);
      try {
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Capture high quality frame for analysis
        canvasRef.current.width = videoRef.current.videoWidth; 
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        // Ensure dataUrl is valid
        if (!dataUrl || dataUrl === 'data:,') {
            // console.warn("Capture failed: Empty data URL");
            return;
        }

        const base64Image = dataUrl.split(',')[1];
        if (!base64Image) {
             // console.warn("Capture failed: No base64 data");
             return;
        }

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
            // setExpression(data.expression); // UI Hidden
            // setExpressionTip(data.feedback); // UI Hidden

            // Log snapshot with Relative Time
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

    // Run analysis every 4 seconds
    expressionInterval = window.setInterval(analyzeExpression, 4000);

    return () => {
        mounted = false;
        clearInterval(expressionInterval);
    };
  }, [isAnalyzingFace]); // Removed isCamOn from deps, using Ref instead

  const handleEndSession = async () => {
    // 1. Stop Recording and get Blob
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

    // 2. Push remaining text with relative time
    const now = Date.now();
    const relTime = turnStartTimeRef.current !== null ? turnStartTimeRef.current : getRelativeTime();
    
    if (currentInputTransRef.current.trim()) {
      transcriptRef.current.push({ role: 'user', text: currentInputTransRef.current, timestamp: now, relativeTime: relTime });
    }
    if (currentOutputTransRef.current.trim()) {
      transcriptRef.current.push({ role: 'model', text: currentOutputTransRef.current, timestamp: now, relativeTime: relTime });
    }

    // Close session before generating report to prevent any lingering connections
    if (activeSessionRef.current) {
        activeSessionRef.current.close();
        activeSessionRef.current = null;
    }
    isSessionActive.current = false;
    
    // 3. Callback
    onEndSession(transcriptRef.current, nonVerbalSnapshotsRef.current, finalBlob);
  };

  const toggleMic = () => setIsMicOn(!isMicOn);
  const toggleCam = () => setIsCamOn(!isCamOn);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-red-50 text-red-800 p-8">
        <h2 className="text-2xl font-bold mb-4">發生錯誤</h2>
        <p>連線發生錯誤。請確認您的網路連線並重新整理頁面。</p>
        <p className="text-sm text-slate-500 mt-2">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">重新載入</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      {/* Header Info */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md text-white p-3 rounded-lg border border-white/10">
        <div className="text-xs text-slate-300">面試職位</div>
        <div className="font-semibold">{config.jobTitle}</div>
        <div className="text-xs text-slate-300">{config.companyName}</div>
        <div className="text-xs text-blue-300 mt-1">{isConnecting ? '連線中...' : '通話中'}</div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* User Video (Mirrored) */}
        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${isCamOn ? 'opacity-100' : 'opacity-0'}`}
        />
        {!isCamOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-500">
            <div className="flex flex-col items-center">
              <User size={64} />
              <p className="mt-4">鏡頭已關閉</p>
            </div>
          </div>
        )}

        {/* AI Audio Visualizer Overlay (Bottom Right) */}
        <div className="absolute bottom-28 right-8 w-48 h-32 bg-black/60 backdrop-blur-lg rounded-xl border border-white/20 p-4 flex flex-col items-center justify-center shadow-2xl transition-all">
          <div className="text-white text-sm font-medium mb-2 opacity-80">
            AI 面試官
          </div>
          <div className="flex gap-1 items-end h-8">
             {[1, 2, 3, 4, 5].map((i) => (
                <div 
                  key={i} 
                  className={`w-1.5 bg-blue-400 rounded-full transition-all duration-100`}
                  style={{ 
                    height: isSpeaking ? `${Math.random() * 24 + 4}px` : '4px',
                    opacity: isSpeaking ? 1 : 0.5 
                  }}
                />
             ))}
          </div>
          {isConnecting && <Loader2 className="animate-spin text-white mt-2" size={16} />}
        </div>
        
        {/* Recording Indicator */}
        <div className="absolute bottom-28 left-8 flex items-center gap-2 bg-red-500/80 backdrop-blur px-3 py-1 rounded-full animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="text-white text-xs font-bold">REC</span>
        </div>

        {/* Hidden Canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Control Bar */}
      <div className="h-20 bg-slate-950 flex items-center justify-center gap-6 px-8 z-20">
        <button 
          onClick={toggleMic}
          className={`p-4 rounded-full transition-colors ${isMicOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
        >
          {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        <button 
          onClick={toggleCam}
          className={`p-4 rounded-full transition-colors ${isCamOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
        >
          {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
        </button>

        <button 
          onClick={handleEndSession}
          className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 ml-4"
        >
          <PhoneOff size={20} /> 結束面試
        </button>
      </div>
    </div>
  );
};

export default LiveSession;