export interface User {
  id: string;
  email: string;
  name: string;
  companyName?: string | null;
  role: 'CANDIDATE' | 'ENTERPRISE' | 'ADMIN';
  resumeFileName?: string | null;
  resumeMimeType?: string | null;
  resumeData?: string | null;
}

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
  voiceName: string;
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
  itemId?: string;
}

export type AssessmentLevel = 'DEVELOPING' | 'BASIC' | 'PROFICIENT' | 'DISTINCT_STRENGTH';
export type AssessmentStatus = 'ASSESSED' | 'NOT_ASSESSABLE';
export type EvidenceSufficiency = 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT';
export type TechnicalQualityStatus = 'CLEAR' | 'MINOR_ISSUES' | 'PARTIAL' | 'SEVERE';
export type DimensionCode =
  | 'ANSWER_EVIDENCE'
  | 'CONTENT_CLARITY'
  | 'JOB_COMPETENCY_MATCH'
  | 'PROFESSIONAL_DEPTH';

export interface EvidenceReference {
  transcriptItemId?: string;
  relativeTime: number;
  quote: string;
  rationale: string;
}

export interface CompetencyAssessment {
  code: DimensionCode;
  status: AssessmentStatus;
  level: AssessmentLevel | null;
  evidenceSufficiency: EvidenceSufficiency;
  evidence: EvidenceReference[];
  missingEvidence: string[];
  nextActions: string[];
}

export interface CandidateAssessmentV1 {
  summary: string;
  dimensions: CompetencyAssessment[];
  questionAnalyses: Array<{
    question: string;
    answerSummary: string;
    competencyTags: string[];
    evidence: EvidenceReference[];
    nextAction: string;
  }>;
  technicalQuality: {
    status: TechnicalQualityStatus;
    notes: string[];
    affectedTranscriptRefs: EvidenceReference[];
  };
}

export interface InterviewReport {
  id: string;        // UUID for database
  timestamp: number; // Creation time
  candidateName: string;
  jobTitle: string;
  recordingId?: string; // Legacy: ID referencing the video in IndexedDB
  videoPath?: string;   // Server-side video file path

  // Raw data for playback sync
  fullTranscript: TranscriptItem[];

  assessmentVersion: 'candidate-bplus-v1';
  assessment: CandidateAssessmentV1;
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

// Voices available in GPT Realtime
export const AVAILABLE_VOICES = [
  { id: 'cedar', name: '男聲', gender: 'Male' },
  { id: 'marin', name: '女聲', gender: 'Female' },
];

export const DEFAULT_MANDATORY_QUESTIONS = [
  PRESET_QUESTIONS[0],
  PRESET_QUESTIONS[1],
  PRESET_QUESTIONS[2]
];
