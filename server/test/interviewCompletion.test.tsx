import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import InterviewCompletionNotice from '../../components/InterviewCompletionNotice.tsx';
import { startInterviewCompletion } from '../../services/interviewCompletion.ts';
import { Persona, type InterviewConfig, type InterviewReport, type TranscriptItem } from '../../types.ts';

const config: InterviewConfig = {
  jobId: 'job-1',
  jobTitle: '前端工程師',
  jobDescription: '建立穩定且易用的產品介面',
  durationMinutes: 30,
  persona: Persona.FRIENDLY_HR,
  voiceName: 'marin',
  mandatoryQuestions: ['請介紹最近完成的專案。'],
  candidateName: '測試候選人',
  companyName: '示範科技',
};

const transcript: TranscriptItem[] = [
  { role: 'user', text: '我負責前端架構。', timestamp: 1, relativeTime: 0 },
];

const generatedReport: InterviewReport = {
  id: 'report-1',
  timestamp: 123,
  candidateName: '測試候選人',
  jobTitle: '前端工程師',
  fullTranscript: transcript,
  assessmentVersion: 'candidate-bplus-v1',
  assessment: {
    summary: '回答展現前端架構經驗，仍可補充可量化成果。',
    dimensions: [
      {
        code: 'ANSWER_EVIDENCE',
        status: 'ASSESSED',
        level: 'BASIC',
        evidenceSufficiency: 'SUFFICIENT',
        evidence: [{
          relativeTime: 0,
          quote: '我負責前端架構。',
          rationale: '直接說明負責範圍。',
        }],
        missingEvidence: ['缺少具體成果數據。'],
        nextActions: ['補充架構決策與量化結果。'],
      },
      {
        code: 'CONTENT_CLARITY',
        status: 'ASSESSED',
        level: 'BASIC',
        evidenceSufficiency: 'PARTIAL',
        evidence: [{
          relativeTime: 0,
          quote: '我負責前端架構。',
          rationale: '回答主旨清楚但細節有限。',
        }],
        missingEvidence: ['缺少做法與脈絡。'],
        nextActions: ['使用情境、做法、結果順序說明。'],
      },
      {
        code: 'JOB_COMPETENCY_MATCH',
        status: 'ASSESSED',
        level: 'BASIC',
        evidenceSufficiency: 'PARTIAL',
        evidence: [{
          relativeTime: 0,
          quote: '我負責前端架構。',
          rationale: '內容與前端職務相關。',
        }],
        missingEvidence: ['尚未驗證穩定性與易用性成果。'],
        nextActions: ['補充與職務需求對應的實例。'],
      },
      {
        code: 'PROFESSIONAL_DEPTH',
        status: 'ASSESSED',
        level: 'DEVELOPING',
        evidenceSufficiency: 'PARTIAL',
        evidence: [{
          relativeTime: 0,
          quote: '我負責前端架構。',
          rationale: '提及專業範圍，但尚無問題解決細節。',
        }],
        missingEvidence: ['缺少權衡與問題解決過程。'],
        nextActions: ['分享一次架構取捨與結果。'],
      },
    ],
    questionAnalyses: [],
    technicalQuality: {
      status: 'CLEAR',
      notes: [],
      affectedTranscriptRefs: [],
    },
  },
};

test('returns to the job list before slow interview storage finishes', async () => {
  let finishUpload!: (path: string) => void;
  const upload = new Promise<string>((resolve) => { finishUpload = resolve; });
  const events: string[] = [];
  let savedReport: Record<string, unknown> | undefined;

  const task = startInterviewCompletion(
    { transcript, videoBlob: new Blob(['video'], { type: 'video/webm' }), config },
    {
      saveVideo: async () => {
        events.push('upload-started');
        return upload;
      },
      generateReport: async () => {
        events.push('analysis-started');
        return generatedReport;
      },
      saveReport: async (report) => {
        savedReport = report as unknown as Record<string, unknown>;
        events.push('report-saved');
        return generatedReport;
      },
    },
    {
      onStarted: () => events.push('portal-shown'),
      onSuccess: () => events.push('completed'),
      onError: () => events.push('failed'),
    },
  );

  assert.deepEqual(events, ['portal-shown', 'upload-started', 'analysis-started']);
  assert.equal(savedReport, undefined);

  finishUpload('interview.webm');
  await task;

  assert.equal(savedReport?.videoPath, 'interview.webm');
  assert.equal(savedReport?.jobProfileId, 'job-1');
  assert.ok(savedReport?.assessment);
  assert.equal('overallScore' in (savedReport ?? {}), false);
  assert.equal('hiringRecommendation' in (savedReport ?? {}), false);
  assert.deepEqual(events, [
    'portal-shown',
    'upload-started',
    'analysis-started',
    'report-saved',
    'completed',
  ]);
});

test('reports a background failure without rejecting an unobserved task', async () => {
  const errors: unknown[] = [];

  await startInterviewCompletion(
    { transcript, videoBlob: null, config },
    {
      saveVideo: async () => 'unused.webm',
      generateReport: async () => { throw new Error('provider unavailable'); },
      saveReport: async () => generatedReport,
    },
    {
      onStarted: () => {},
      onSuccess: () => assert.fail('unexpected success'),
      onError: (error) => errors.push(error),
    },
  );

  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /provider unavailable/);
});

test('renders clear non-blocking saving and failure notices', () => {
  const saving = renderToStaticMarkup(<InterviewCompletionNotice status="SAVING" />);
  const failed = renderToStaticMarkup(<InterviewCompletionNotice status="ERROR" />);

  assert.match(saving, /面試資料正在背景儲存/);
  assert.match(saving, /完成前請勿關閉或重新整理此頁面/);
  assert.match(saving, /仍可繼續瀏覽職缺/);
  assert.match(failed, /面試資料儲存失敗/);
  assert.match(failed, /role="alert"/);
});

test('warns before refresh only while the background save guard is installed', async () => {
  const module = await import('../../services/interviewCompletion.ts');
  const installGuard = (module as Record<string, unknown>).installInterviewCompletionGuard;
  assert.equal(typeof installGuard, 'function');

  type Listener = (event: BeforeUnloadEvent) => void;
  const listeners = new Set<Listener>();
  const target = {
    addEventListener: (type: string, listener: Listener) => {
      if (type === 'beforeunload') listeners.add(listener);
    },
    removeEventListener: (type: string, listener: Listener) => {
      if (type === 'beforeunload') listeners.delete(listener);
    },
  };

  let prevented = false;
  const event = {
    preventDefault: () => { prevented = true; },
    returnValue: 'unchanged',
  } as unknown as BeforeUnloadEvent;

  const cleanup = (installGuard as (target: typeof window) => () => void)(target as unknown as typeof window);
  listeners.forEach((listener) => listener(event));

  assert.equal(prevented, true);
  assert.equal(event.returnValue, 'true');

  cleanup();
  prevented = false;
  listeners.forEach((listener) => listener(event));
  assert.equal(prevented, false);
});
