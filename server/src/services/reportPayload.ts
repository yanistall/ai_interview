import {
  ASSESSMENT_VERSION,
  validateCandidateAssessment,
  type CandidateAssessmentV1,
  type TranscriptTurn,
} from './candidateAssessment.js';

export interface ReportCreateInput {
  candidateName: string;
  jobTitle: string;
  fullTranscript: TranscriptTurn[];
  assessmentVersion: typeof ASSESSMENT_VERSION;
  assessment: CandidateAssessmentV1;
  jobProfileId?: string | null;
  // The route validates this value before using it in its atomic ownership claim.
  videoPath?: unknown;
}

export class InvalidReportPayloadError extends Error {}

function record(value: unknown, location: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidReportPayloadError(`${location} must be an object`);
  }
  return value as Record<string, unknown>;
}

function allowedKeys(value: Record<string, unknown>, allowed: readonly string[], location: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new InvalidReportPayloadError(`${location} contains unknown field: ${key}`);
    }
  }
}

function nonEmptyString(value: unknown, location: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InvalidReportPayloadError(`${location} must be a non-empty string`);
  }
  return value.trim();
}

function nonNegativeNumber(value: unknown, location: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new InvalidReportPayloadError(`${location} must be a finite non-negative number`);
  }
  return value;
}

function parseTranscript(value: unknown): TranscriptTurn[] {
  if (!Array.isArray(value)) {
    throw new InvalidReportPayloadError('fullTranscript must be an array');
  }
  return value.map((item, index) => {
    const location = `fullTranscript[${index}]`;
    const turn = record(item, location);
    allowedKeys(turn, ['role', 'text', 'timestamp', 'relativeTime', 'itemId'], location);
    if (turn.role !== 'user' && turn.role !== 'model') {
      throw new InvalidReportPayloadError(`${location}.role must be user or model`);
    }
    if (typeof turn.text !== 'string') {
      throw new InvalidReportPayloadError(`${location}.text must be a string`);
    }
    return {
      role: turn.role,
      text: turn.text,
      timestamp: nonNegativeNumber(turn.timestamp, `${location}.timestamp`),
      relativeTime: nonNegativeNumber(turn.relativeTime, `${location}.relativeTime`),
      ...(turn.itemId === undefined ? {} : { itemId: nonEmptyString(turn.itemId, `${location}.itemId`) }),
    };
  });
}

export function parseReportCreateInput(body: unknown): ReportCreateInput {
  const input = record(body, 'report');
  allowedKeys(input, [
    'candidateName', 'jobTitle', 'videoPath', 'fullTranscript',
    'assessmentVersion', 'assessment', 'jobProfileId',
  ], 'report');
  if (input.assessmentVersion !== ASSESSMENT_VERSION) {
    throw new InvalidReportPayloadError(`assessmentVersion must be ${ASSESSMENT_VERSION}`);
  }

  const candidateName = nonEmptyString(input.candidateName, 'candidateName');
  const jobTitle = nonEmptyString(input.jobTitle, 'jobTitle');
  const fullTranscript = parseTranscript(input.fullTranscript);
  const jobProfileId = input.jobProfileId == null
    ? input.jobProfileId as null | undefined
    : nonEmptyString(input.jobProfileId, 'jobProfileId');

  let assessment: CandidateAssessmentV1;
  try {
    assessment = validateCandidateAssessment(input.assessment, fullTranscript);
  } catch (error) {
    throw new InvalidReportPayloadError(error instanceof Error
      ? error.message
      : 'assessment does not match the B+ report contract or fullTranscript');
  }

  return {
    candidateName,
    jobTitle,
    fullTranscript,
    assessmentVersion: ASSESSMENT_VERSION,
    assessment,
    ...(jobProfileId === undefined ? {} : { jobProfileId }),
    ...(input.videoPath === undefined ? {} : { videoPath: input.videoPath }),
  };
}
