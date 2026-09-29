export const ASSESSMENT_VERSION = 'candidate-bplus-v1' as const;

export const DIMENSION_CODES = [
  'ANSWER_EVIDENCE',
  'CONTENT_CLARITY',
  'JOB_COMPETENCY_MATCH',
  'PROFESSIONAL_DEPTH',
] as const;

export const ASSESSMENT_LEVELS = [
  'DEVELOPING',
  'BASIC',
  'PROFICIENT',
  'DISTINCT_STRENGTH',
] as const;

export type DimensionCode = (typeof DIMENSION_CODES)[number];
export type AssessmentLevel = (typeof ASSESSMENT_LEVELS)[number];
export type AssessmentStatus = 'ASSESSED' | 'NOT_ASSESSABLE';
export type EvidenceSufficiency = 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT';
export type TechnicalQualityStatus = 'CLEAR' | 'MINOR_ISSUES' | 'PARTIAL' | 'SEVERE';

export interface TranscriptTurn {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  relativeTime: number;
  itemId?: string;
}

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

export interface QuestionAnalysis {
  question: string;
  answerSummary: string;
  competencyTags: string[];
  evidence: EvidenceReference[];
  nextAction: string;
}

export interface CandidateAssessmentV1 {
  summary: string;
  dimensions: CompetencyAssessment[];
  questionAnalyses: QuestionAnalysis[];
  technicalQuality: {
    status: TechnicalQualityStatus;
    notes: string[];
    affectedTranscriptRefs: EvidenceReference[];
  };
}

type UnknownRecord = Record<string, unknown>;

const ASSESSMENT_STATUSES = ['ASSESSED', 'NOT_ASSESSABLE'] as const;
const EVIDENCE_SUFFICIENCIES = ['SUFFICIENT', 'PARTIAL', 'INSUFFICIENT'] as const;
const TECHNICAL_QUALITY_STATUSES = ['CLEAR', 'MINOR_ISSUES', 'PARTIAL', 'SEVERE'] as const;
const TRANSCRIPT_TOLERANCE_SECONDS = 1;

const PRESET_COMPETENCY_TAGS = {
  '請您先簡單自我介紹一下。': ['自我認知', '溝通表達', '經驗概述'],
  '為什麼想應徵我們公司？': ['求職動機', '組織認同', '職涯方向'],
  '分享一個您解決過最困難的技術問題。': ['問題分析', '解決方案', '專業知識'],
  '您認為自己最大的優點和缺點是什麼？': ['自我認知', '優勢表達', '發展意識'],
  '面對緊迫的期限，您通常如何處理？': ['時間管理', '壓力應對', '執行力'],
  '請分享一次團隊合作中發生衝突的經驗，以及您如何解決。': ['團隊合作', '衝突解決', '溝通協作'],
  '您對未來三到五年的職涯規劃是什麼？': ['職涯規劃', '目標設定', '發展動機'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export function getPresetCompetencyTags(question: string): string[] {
  return [...(PRESET_COMPETENCY_TAGS[question as keyof typeof PRESET_COMPETENCY_TAGS] ?? [])];
}

function assertRecord(value: unknown, location: string): asserts value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${location} must be an object`);
  }
}

function assertKeys(
  value: UnknownRecord,
  location: string,
  requiredKeys: readonly string[],
  allowedKeys: readonly string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`${location} contains unknown key: ${key}`);
    }
  }

  for (const key of requiredKeys) {
    if (!(key in value)) {
      throw new Error(`${location} is missing required key: ${key}`);
    }
  }
}

function nonEmptyString(value: unknown, location: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${location} must be a non-empty string`);
  }

  return value.trim();
}

function finiteNumber(value: unknown, location: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${location} must be a finite number`);
  }

  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], location: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${location} must be one of: ${allowed.join(', ')}`);
  }

  return value as T;
}

function nonEmptyStringArray(value: unknown, location: string, requireAtLeastOne = false): string[] {
  if (!Array.isArray(value) || (requireAtLeastOne && value.length === 0)) {
    throw new Error(`${location} must be${requireAtLeastOne ? ' a non-empty' : ' an'} array`);
  }

  return value.map((item, index) => nonEmptyString(item, `${location}[${index}]`));
}

function transcriptRange(transcript: readonly TranscriptTurn[]): { min: number; max: number } | undefined {
  if (transcript.length === 0) {
    return undefined;
  }

  const times = transcript.map((turn, index) => finiteNumber(turn.relativeTime, `transcript[${index}].relativeTime`));
  return { min: Math.min(...times), max: Math.max(...times) };
}

function validateEvidenceReference(
  value: unknown,
  location: string,
  transcript: readonly TranscriptTurn[],
  range: { min: number; max: number } | undefined,
): EvidenceReference {
  assertRecord(value, location);
  assertKeys(
    value,
    location,
    ['relativeTime', 'quote', 'rationale'],
    ['transcriptItemId', 'relativeTime', 'quote', 'rationale'],
  );

  const relativeTime = finiteNumber(value.relativeTime, `${location}.relativeTime`);
  if (
    range === undefined
    || relativeTime < range.min - TRANSCRIPT_TOLERANCE_SECONDS
    || relativeTime > range.max + TRANSCRIPT_TOLERANCE_SECONDS
  ) {
    throw new Error(`${location}.relativeTime must be within the transcript range`);
  }

  const evidence: EvidenceReference = {
    relativeTime,
    quote: nonEmptyString(value.quote, `${location}.quote`),
    rationale: nonEmptyString(value.rationale, `${location}.rationale`),
  };

  if ('transcriptItemId' in value && value.transcriptItemId !== undefined) {
    const transcriptItemId = nonEmptyString(value.transcriptItemId, `${location}.transcriptItemId`);
    if (!transcript.some((turn) => turn.itemId === transcriptItemId)) {
      throw new Error(`${location}.transcriptItemId must match a supplied transcript turn`);
    }
    evidence.transcriptItemId = transcriptItemId;
  }

  return evidence;
}

function validateEvidenceReferences(
  value: unknown,
  location: string,
  transcript: readonly TranscriptTurn[],
  range: { min: number; max: number } | undefined,
): EvidenceReference[] {
  if (!Array.isArray(value)) {
    throw new Error(`${location} must be an array`);
  }

  return value.map((item, index) => validateEvidenceReference(item, `${location}[${index}]`, transcript, range));
}

function validateDimension(
  value: unknown,
  transcript: readonly TranscriptTurn[],
  range: { min: number; max: number } | undefined,
): CompetencyAssessment {
  assertRecord(value, 'dimension');
  assertKeys(
    value,
    'dimension',
    ['code', 'status', 'level', 'evidenceSufficiency', 'evidence', 'missingEvidence', 'nextActions'],
    ['code', 'status', 'level', 'evidenceSufficiency', 'evidence', 'missingEvidence', 'nextActions'],
  );

  const status = enumValue(value.status, ASSESSMENT_STATUSES, 'dimension.status');
  const evidenceSufficiency = enumValue(
    value.evidenceSufficiency,
    EVIDENCE_SUFFICIENCIES,
    'dimension.evidenceSufficiency',
  );
  const evidence = validateEvidenceReferences(value.evidence, 'dimension.evidence', transcript, range);
  let level: AssessmentLevel | null;

  if (status === 'NOT_ASSESSABLE') {
    if (value.level !== null) {
      throw new Error('NOT_ASSESSABLE dimensions must use level: null');
    }
    if (evidenceSufficiency === 'SUFFICIENT') {
      throw new Error('NOT_ASSESSABLE dimensions cannot use SUFFICIENT evidence');
    }
    level = null;
  } else {
    level = enumValue(value.level, ASSESSMENT_LEVELS, 'dimension.level');
    if (evidence.length === 0) {
      throw new Error('ASSESSED dimensions must include evidence');
    }
    if (evidenceSufficiency === 'INSUFFICIENT') {
      throw new Error('ASSESSED dimensions cannot use INSUFFICIENT evidence');
    }
  }

  return {
    code: enumValue(value.code, DIMENSION_CODES, 'dimension.code'),
    status,
    level,
    evidenceSufficiency,
    evidence,
    missingEvidence: nonEmptyStringArray(value.missingEvidence, 'dimension.missingEvidence', true),
    nextActions: nonEmptyStringArray(value.nextActions, 'dimension.nextActions', true),
  };
}

function validateQuestionAnalysis(
  value: unknown,
  index: number,
  transcript: readonly TranscriptTurn[],
  range: { min: number; max: number } | undefined,
): QuestionAnalysis {
  const location = `questionAnalyses[${index}]`;
  assertRecord(value, location);
  assertKeys(
    value,
    location,
    ['question', 'answerSummary', 'competencyTags', 'evidence', 'nextAction'],
    ['question', 'answerSummary', 'competencyTags', 'evidence', 'nextAction'],
  );

  return {
    question: nonEmptyString(value.question, `${location}.question`),
    answerSummary: nonEmptyString(value.answerSummary, `${location}.answerSummary`),
    competencyTags: nonEmptyStringArray(value.competencyTags, `${location}.competencyTags`),
    evidence: validateEvidenceReferences(value.evidence, `${location}.evidence`, transcript, range),
    nextAction: nonEmptyString(value.nextAction, `${location}.nextAction`),
  };
}

export function validateCandidateAssessment(
  value: unknown,
  transcript: readonly TranscriptTurn[],
): CandidateAssessmentV1 {
  assertRecord(value, 'assessment');
  assertKeys(
    value,
    'assessment',
    ['summary', 'dimensions', 'questionAnalyses', 'technicalQuality'],
    ['summary', 'dimensions', 'questionAnalyses', 'technicalQuality'],
  );

  if (!Array.isArray(value.dimensions)) {
    throw new Error('assessment.dimensions must be an array');
  }

  const range = transcriptRange(transcript);
  const dimensions = value.dimensions.map((dimension) => validateDimension(dimension, transcript, range));
  const dimensionCodes = dimensions.map((dimension) => dimension.code);
  if (
    dimensions.length !== DIMENSION_CODES.length
    || new Set(dimensionCodes).size !== DIMENSION_CODES.length
    || !DIMENSION_CODES.every((code) => dimensionCodes.includes(code))
  ) {
    throw new Error('assessment must contain four unique dimensions');
  }

  if (!Array.isArray(value.questionAnalyses)) {
    throw new Error('assessment.questionAnalyses must be an array');
  }

  assertRecord(value.technicalQuality, 'assessment.technicalQuality');
  assertKeys(
    value.technicalQuality,
    'assessment.technicalQuality',
    ['status', 'notes', 'affectedTranscriptRefs'],
    ['status', 'notes', 'affectedTranscriptRefs'],
  );

  return {
    summary: nonEmptyString(value.summary, 'assessment.summary'),
    dimensions: DIMENSION_CODES.map((code) => dimensions.find((dimension) => dimension.code === code)!),
    questionAnalyses: value.questionAnalyses.map((analysis, index) => validateQuestionAnalysis(analysis, index, transcript, range)),
    technicalQuality: {
      status: enumValue(value.technicalQuality.status, TECHNICAL_QUALITY_STATUSES, 'assessment.technicalQuality.status'),
      notes: nonEmptyStringArray(value.technicalQuality.notes, 'assessment.technicalQuality.notes'),
      affectedTranscriptRefs: validateEvidenceReferences(
        value.technicalQuality.affectedTranscriptRefs,
        'assessment.technicalQuality.affectedTranscriptRefs',
        transcript,
        range,
      ),
    },
  };
}
