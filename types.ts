export enum Persona {
  FRIENDLY_HR = 'FRIENDLY_HR',
  STRICT_MANAGER = 'STRICT_MANAGER',
  TECHNICAL_LEAD = 'TECHNICAL_LEAD',
  EXECUTIVE = 'EXECUTIVE'
}

export interface JobProfile {
  id: string;
  companyName: string;
  title: string;
  description: string;
  persona: Persona;
  voiceName: string; // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'
  questions: string[];
  createdAt: number;
}

export interface InterviewConfig {
  jobId: string;
  jobTitle: string;
  jobDescription: string;
  durationMinutes: number;
  persona: Persona;
  voiceName: string;
  mandatoryQuestions: string[];
  candidateName: string;
  companyName: string;
  resume?: {
    mimeType: string;
    data: string; // Base64 string
    fileName: string;
  };
}

export interface TranscriptItem {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  relativeTime: number; // Seconds from start of recording
}

export interface NonVerbalSnapshot {
  timestamp: number;
  relativeTime: number; // Seconds from start of recording
  expression: string;
  feedback: string;
}

export interface QuestionAnalysis {
  question: string;
  answerSummary: string;
  score: number; // 1-100
  feedback: string;
  suggestedAnswer: string;
}

export interface DimensionScores {
  answerQuality: number;       // 回答品質 0-100
  communicationSkill: number;  // 溝通流暢 0-100
  jobFit: number;              // 職位匹配 0-100
  professionalDepth: number;   // 專業深度 0-100
  nonVerbalPresence: number;   // 非語言表現 0-100
}

export interface InterviewReport {
  id: string;        // UUID for database
  timestamp: number; // Creation time
  candidateName: string;
  jobTitle: string;
  recordingId?: string; // ID referencing the video in IndexedDB

  // Raw Data for Playback Sync
  fullTranscript: TranscriptItem[];
  nonVerbalLog: NonVerbalSnapshot[];

  // AI Analysis
  overallScore: number;
  hiringRecommendation: 'HIRE' | 'CONSIDER' | 'NO_HIRE';
  hiringReason: string;
  strengths: string[];
  weaknesses: string[];
  improvementPlan: string;
  dimensionScores: DimensionScores;
  questionAnalysis: QuestionAnalysis[];
  nonVerbalAnalysis: {
    averageExpression: string;
    bodyLanguageScore: number; // 0-100
    observations: string[];
    tips: string[];
  };
}

// Preset questions pool
export const PRESET_QUESTIONS = [
  "請您先簡單自我介紹一下。",
  "為什麼想應徵我們公司？",
  "分享一個您解決過最困難的技術問題。",
  "您認為自己最大的優點和缺點是什麼？",
  "面對緊迫的期限，您通常如何處理？",
  "請分享一次團隊合作中發生衝突的經驗，以及您如何解決。",
  "您對未來三到五年的職涯規劃是什麼？"
];

// Voices available in Gemini Live
export const AVAILABLE_VOICES = [
  { id: 'Puck', name: 'Puck (男聲 - 活潑)', gender: 'Male' },
  { id: 'Charon', name: 'Charon (男聲 - 深沉)', gender: 'Male' },
  { id: 'Kore', name: 'Kore (女聲 - 清晰)', gender: 'Female' },
  { id: 'Fenrir', name: 'Fenrir (女聲 - 專業)', gender: 'Female' },
  { id: 'Aoede', name: 'Aoede (女聲 - 溫柔)', gender: 'Female' },
];

export const DEFAULT_MANDATORY_QUESTIONS = [
  PRESET_QUESTIONS[0],
  PRESET_QUESTIONS[1],
  PRESET_QUESTIONS[2]
];