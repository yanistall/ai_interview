import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { Request, Response } from 'express';
import { ASSESSMENT_VERSION, DIMENSION_CODES } from '../src/services/candidateAssessment.js';
import { parseReportCreateInput } from '../src/services/reportPayload.js';

const fullTranscript = [
  { role: 'model', text: '請分享改善效能的案例。', timestamp: 1, relativeTime: 0, itemId: 'question-1' },
  { role: 'user', text: '我量測並改善載入速度。', timestamp: 2, relativeTime: 12, itemId: 'answer-1' },
];
const evidence = {
  transcriptItemId: 'answer-1', relativeTime: 12,
  quote: '我量測並改善載入速度。', rationale: '回答包含具體改善行動。',
};
const valid = {
  candidateName: '測試候選人',
  jobTitle: '前端工程師',
  fullTranscript,
  assessmentVersion: ASSESSMENT_VERSION,
  assessment: {
    summary: '能說明效能改善的做法。',
    dimensions: DIMENSION_CODES.map((code) => ({
      code, status: 'ASSESSED', level: 'BASIC', evidenceSufficiency: 'PARTIAL',
      evidence: [evidence], missingEvidence: ['尚缺量化成果。'], nextActions: ['補充改善前後指標。'],
    })),
    questionAnalyses: [],
    technicalQuality: { status: 'CLEAR', notes: [], affectedTranscriptRefs: [] },
  },
};

test('accepts and normalizes a B+ report without mutating the supplied payload', () => {
  const input = { ...valid, candidateName: ' 測試候選人 ', jobTitle: ' 前端工程師 ', jobProfileId: ' job-1 ', videoPath: 'video.webm' };
  const result = parseReportCreateInput(input);
  assert.deepEqual(result, { ...valid, jobProfileId: 'job-1', videoPath: 'video.webm' });
  assert.equal(input.candidateName, ' 測試候選人 ');
  assert.notEqual(result.assessment, input.assessment);
  assert.notEqual(result.fullTranscript, input.fullTranscript);
});

test('accepts an omitted or null optional job and video reference', () => {
  assert.deepEqual(parseReportCreateInput(valid), valid);
  assert.deepEqual(parseReportCreateInput({ ...valid, jobProfileId: null, videoPath: null }), {
    ...valid, jobProfileId: null, videoPath: null,
  });
});

for (const assessmentVersion of [undefined, null, 'legacy-v1']) {
  test(`rejects missing or unsupported assessment version: ${assessmentVersion}`, () => {
    assert.throws(() => parseReportCreateInput({ ...valid, assessmentVersion }), /assessmentVersion/);
  });
}

test('rejects malformed B+ assessments', () => {
  assert.throws(() => parseReportCreateInput({ ...valid, assessment: { summary: '缺少評估維度' } }), /assessment/);
});

for (const field of [
  'overallScore', 'hiringRecommendation', 'hiringReason', 'nonVerbalLog', 'strengths',
  'weaknesses', 'improvementPlan', 'dimensionScores', 'questionAnalysis', 'nonVerbalAnalysis',
  'candidateId', 'id', 'timestamp', 'recordingId',
]) {
  test(`rejects unknown decision or server-owned field: ${field}`, () => {
    assert.throws(() => parseReportCreateInput({ ...valid, [field]: field === 'overallScore' ? 80 : 'HIRE' }), /unknown.*field/i);
  });
}

test('validates evidence against the supplied transcript IDs and time range', () => {
  assert.throws(() => parseReportCreateInput({
    ...valid, fullTranscript: fullTranscript.map((turn) => ({ ...turn, itemId: 'different-id' })),
  }), /transcriptItemId/);
  assert.throws(() => parseReportCreateInput({
    ...valid, fullTranscript: fullTranscript.map((turn) => ({ ...turn, relativeTime: 100 })),
  }), /transcript range/);
});

test('rejects malformed identity and job reference fields', () => {
  for (const field of ['candidateName', 'jobTitle']) {
    for (const value of [undefined, null, '', '  ', 12, {}]) {
      assert.throws(() => parseReportCreateInput({ ...valid, [field]: value }), new RegExp(field));
    }
  }
  for (const jobProfileId of ['', '  ', 12, {}]) {
    assert.throws(() => parseReportCreateInput({ ...valid, jobProfileId }), /jobProfileId/);
  }
});

test('rejects malformed transcript turns before assessment validation', () => {
  for (const fullTranscript of [undefined, null, {}, [null], [{ ...valid.fullTranscript[0], role: 'admin' }]]) {
    assert.throws(() => parseReportCreateInput({ ...valid, fullTranscript }), /fullTranscript/);
  }
  for (const patch of [
    { text: 12 }, { timestamp: Number.NaN }, { timestamp: undefined },
    { relativeTime: -1 }, { relativeTime: Infinity }, { itemId: '' }, { overallScore: 80 },
  ]) {
    assert.throws(() => parseReportCreateInput({
      ...valid, fullTranscript: [{ ...fullTranscript[0], ...patch }, fullTranscript[1]],
    }), /fullTranscript/);
  }
});

test('rejects non-object request bodies', () => {
  for (const body of [undefined, null, [], 'report', 12]) {
    assert.throws(() => parseReportCreateInput(body), /report/);
  }
});

test('POST handler rejects invalid input before persistence and preserves the atomic video claim', async () => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key';
  process.env.JWT_SECRET ??= 'test-jwt-secret';
  const [{ default: router }, { default: prisma }] = await Promise.all([
    import('../src/routes/reports.js'), import('../src/db/client.js'),
  ]);
  const route = router.stack.find((layer) => layer.route?.path === '/' && layer.route?.methods.post)?.route;
  assert.ok(route);
  const handler = route.stack.at(-1)!.handle;
  let claimCount = 1;
  const creates: unknown[] = [];
  const claims: unknown[] = [];
  const tx = {
    interviewReport: {
      async create(input: { data: Record<string, unknown> }) {
        creates.push(input);
        return { id: 'report-1', ...input.data };
      },
    },
    videoUpload: {
      async updateMany(input: unknown) {
        claims.push(input);
        return { count: claimCount };
      },
    },
  };
  const originalTransaction = prisma.$transaction;
  const transaction = mock.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  prisma.$transaction = transaction as unknown as typeof prisma.$transaction;
  async function invoke(body: unknown) {
    let status = 200;
    let payload: unknown;
    const response = {
      status(code: number) { status = code; return this; },
      json(value: unknown) { payload = value; return this; },
    };
    await handler({ body, user: { userId: 'candidate-1', role: 'CANDIDATE' } } as Request, response as Response, () => {});
    return { status, payload };
  }
  try {
    for (const body of [
      null, { ...valid, assessmentVersion: undefined }, { ...valid, assessmentVersion: 'legacy-v1' },
      { ...valid, assessment: {} }, { ...valid, overallScore: 80 }, { ...valid, hiringRecommendation: 'HIRE' },
      { ...valid, videoPath: {} }, { ...valid, videoPath: '' },
    ]) {
      assert.equal((await invoke(body)).status, 400);
    }
    assert.equal(transaction.mock.callCount(), 0);

    const result = await invoke({ ...valid, videoPath: 'owned.webm', jobProfileId: 'job-1' });
    assert.equal(result.status, 201);
    assert.deepEqual(creates, [{ data: { ...valid, videoPath: 'owned.webm', jobProfileId: 'job-1', candidateId: 'candidate-1' } }]);
    assert.deepEqual(claims, [{
      where: { filename: 'owned.webm', uploaderId: 'candidate-1', reportId: null },
      data: { reportId: 'report-1' },
    }]);
    claimCount = 0;
    assert.deepEqual(await invoke({ ...valid, videoPath: 'unavailable.webm' }), {
      status: 403, payload: { error: '無權限使用此影片' },
    });
  } finally {
    prisma.$transaction = originalTransaction;
  }
});
