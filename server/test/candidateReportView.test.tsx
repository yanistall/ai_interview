import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReportView from '../../components/ReportView.tsx';
import * as ReportViewModule from '../../components/ReportView.tsx';
import AdminDashboard, { AdminReportsPanel } from '../../components/AdminDashboard.tsx';
import EnterpriseWorkspace, { EnterpriseReportsPanel } from '../../components/EnterpriseWorkspace.tsx';
import LandingPage from '../../components/LandingPage.tsx';
import CandidateWorkspace from '../../components/CandidateWorkspace.tsx';
import type { InterviewReport, EvidenceReference } from '../../types.ts';

const evidence: EvidenceReference = {
  transcriptItemId: 'answer-1', relativeTime: 12,
  quote: '我先量測瓶頸，再縮短載入時間。', rationale: '說明分析依據與具體行動。',
};
const report: InterviewReport = {
  id: 'report-1', timestamp: 1, candidateName: '測試候選人', jobTitle: '工程師',
  fullTranscript: [{ role: 'user', itemId: 'answer-1', relativeTime: 12, timestamp: 1, text: evidence.quote }],
  assessmentVersion: 'candidate-bplus-v1',
  assessment: {
    summary: '能描述分析方法，仍需補充成果。',
    // Deliberately shuffled to verify stable display order.
    dimensions: [
      { code: 'PROFESSIONAL_DEPTH', status: 'NOT_ASSESSABLE', level: null, evidenceSufficiency: 'INSUFFICIENT', evidence: [], missingEvidence: ['尚未詢問取捨。'], nextActions: ['補充替代方案。'] },
      { code: 'JOB_COMPETENCY_MATCH', status: 'ASSESSED', level: 'BASIC', evidenceSufficiency: 'PARTIAL', evidence: [evidence], missingEvidence: ['缺少職務成果。'], nextActions: ['補充職務案例。'] },
      { code: 'ANSWER_EVIDENCE', status: 'ASSESSED', level: 'PROFICIENT', evidenceSufficiency: 'SUFFICIENT', evidence: [evidence], missingEvidence: ['缺少量測數據。'], nextActions: ['補充前後數據。'] },
      { code: 'CONTENT_CLARITY', status: 'ASSESSED', level: 'DEVELOPING', evidenceSufficiency: 'PARTIAL', evidence: [evidence], missingEvidence: ['缺少前因後果。'], nextActions: ['依序描述決策。'] },
    ],
    questionAnalyses: [{ question: '如何改善效能？', answerSummary: '先量測再調整。', competencyTags: ['效能分析'], evidence: [evidence], nextAction: '加入成果數據與驗證方法。' }],
    technicalQuality: { status: 'PARTIAL', notes: ['部分內容疑似轉錄遺漏。'], affectedTranscriptRefs: [evidence] },
  },
};

test('renders B+ evidence, gaps, actions and unassessable status without scores or hiring advice', () => {
  const markup = renderToStaticMarkup(<ReportView report={report} onBack={() => {}} />);
  for (const label of ['本次練習摘要', '穩定展現', '無法判定', '證據充分度', '缺少內容', '下一步行動', evidence.rationale, '缺少量測數據。', '補充前後數據。']) assert.ok(markup.includes(label), label);
  assert.doesNotMatch(markup, /綜合評分|建議錄用|不予錄用|\/100|Radar/);
  const labels = ['回答具體度與證據', '內容組織與可理解性', '職務能力匹配', '專業深度與問題解決'];
  labels.forEach((label, index) => {
    assert.ok(markup.includes(label), label);
    if (index) assert.ok(markup.indexOf(labels[index - 1]) < markup.indexOf(label));
  });
  assert.match(markup, /如何改善效能？/);
  assert.match(markup, /效能分析/);
  assert.match(markup, /加入成果數據與驗證方法。/);
  assert.match(markup, /部分內容疑似轉錄遺漏。/);
  assert.ok(
    markup.indexOf('錄音與逐字稿品質提醒') < markup.indexOf('回答具體度與證據'),
    'technical-quality notice should appear before competency cards',
  );
  assert.match(markup, /無錄影檔案/);
  assert.match(markup, /查看逐字稿/);
});

test('admin report list replaces rankings with correct neutral report counts', () => {
  const complete = structuredClone(report);
  complete.id = 'complete';
  complete.assessment.dimensions = complete.assessment.dimensions.map(dimension => ({ ...dimension, status: 'ASSESSED', level: 'BASIC', evidenceSufficiency: 'SUFFICIENT' }));
  const partial = structuredClone(complete);
  partial.id = 'partial';
  partial.assessment.dimensions[0].evidenceSufficiency = 'PARTIAL';
  const markup = renderToStaticMarkup(<AdminReportsPanel reports={[report, complete, partial]} searchTerm="" setSearchTerm={() => {}} onViewReport={() => {}} handleDelete={() => {}} />);
  assert.doesNotMatch(markup, /平均得分|建議錄取率|AI 評分|Score|HIRE|NaN/);
  assert.match(markup, /完成四級評測<\/div><div[^>]*>3<\/div>/);
  assert.match(markup, /證據待補充<\/div><div[^>]*>2<\/div>/);
  assert.equal((markup.match(/四級能力報告/g) || []).length, 3);
  assert.match(markup, /測試候選人/);
});

test('enterprise report list presents a neutral report label and retains deletion', () => {
  const markup = renderToStaticMarkup(<EnterpriseReportsPanel reports={[report]} reportSearch="" setReportSearch={() => {}} onViewReport={() => {}} handleDeleteReport={() => {}} />);
  assert.doesNotMatch(markup, /平均得分|建議錄取率|AI 評分|Score|HIRE/);
  assert.match(markup, /四級能力報告/);
  assert.match(markup, /刪除紀錄/);
});

test('workspace shells retain job and report navigation', () => {
  const admin = renderToStaticMarkup(<AdminDashboard onViewReport={() => {}} onLogout={() => {}} />);
  const enterprise = renderToStaticMarkup(<EnterpriseWorkspace onViewReport={() => {}} />);
  assert.match(admin, /職缺管理/);
  assert.match(admin, /面試紀錄/);
  assert.match(enterprise, /發佈職缺/);
  assert.match(enterprise, /查看面試紀錄/);
  assert.doesNotMatch(admin + enterprise, /平均得分|建議錄取率|AI 評分|Score/);
});

test('evidence locates its stable turn before falling back to the nearest exact timestamp', () => {
  const findIndex = (ReportViewModule as Record<string, unknown>).findEvidenceTranscriptIndex;
  assert.equal(typeof findIndex, 'function');
  const locate = findIndex as (items: InterviewReport['fullTranscript'], time: number, itemId?: string) => number;
  const transcript: InterviewReport['fullTranscript'] = [
    { role: 'user', itemId: 'first', text: '相同文字', timestamp: 1, relativeTime: 2.2 },
    { role: 'user', itemId: 'second', text: '相同文字', timestamp: 2, relativeTime: 2.8 },
    { role: 'model', itemId: 'third', text: '追問', timestamp: 3, relativeTime: 8 },
  ];
  assert.equal(locate(transcript, 8, 'first'), 0);
  assert.equal(locate(transcript, 2.8), 1);
  assert.equal(locate(transcript, 2.7, 'missing'), 1);
  assert.equal(locate([], 2), -1);
});

test('landing copy describes evidence based coaching without unsupported ranking or emotion claims', () => {
  const markup = renderToStaticMarkup(<LandingPage onSelectRole={() => {}} />);
  assert.doesNotMatch(markup, /綜合評分|錄用決策|情感分析|情感辨識|視訊分析/);
  assert.match(markup, /四級能力報告/);
  assert.match(markup, /下一步/);
});

test('candidate history removes the retired score field while preserving history navigation', () => {
  // The history loads after mount; this contract guard supplements the SSR shell check.
  const source = readFileSync(new URL('../../components/CandidateWorkspace.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /overallScore|hiringRecommendation|分數/);
  assert.match(source, /四級能力報告/);
  const markup = renderToStaticMarkup(<CandidateWorkspace userName="測試候選人" onStartInterview={() => {}} onViewReport={() => {}} />);
  assert.match(markup, /歷史面試紀錄/);
  assert.match(markup, /點擊歷史紀錄可查看完整報告與錄影/);
});
