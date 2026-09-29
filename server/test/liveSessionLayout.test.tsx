import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LiveSession from '../../components/LiveSession.tsx';
import { Persona, type InterviewConfig } from '../../types.ts';

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

const renderSession = () => renderToStaticMarkup(
  <LiveSession config={config} onEndSession={() => {}} />,
);

test('開始面試前提醒候選人選擇面試語言', () => {
  const markup = renderSession();

  assert.match(markup, /請先在下方選擇面試語言；開始後仍可切換。/);
});

test('逐字稿使用獨立且具名的版面區域', () => {
  const markup = renderSession();

  assert.match(markup, /<aside[^>]+aria-label="逐字稿紀錄"/);
  assert.match(markup, /面試開始後，雙方逐字稿會顯示在這裡。/);
});

test('逐字稿面板依時間持續呈現雙方每一段對話', async () => {
  const module = await import('../../components/LiveSession.tsx');
  const TranscriptPanel = (module as Record<string, unknown>).TranscriptPanel;
  assert.equal(typeof TranscriptPanel, 'function');

  const turns = [
    { key: 'model:m1', itemId: 'm1', role: 'model', text: '您好，很高興認識你。', timestamp: 1, relativeTime: 0, complete: true, manuallyEdited: false },
    { key: 'user:u1', itemId: 'u1', role: 'user', text: '您好。', timestamp: 2, relativeTime: 1, complete: true, manuallyEdited: false },
    { key: 'model:m2', itemId: 'm2', role: 'model', text: '請先簡單自我介紹。', timestamp: 3, relativeTime: 3, complete: true, manuallyEdited: false },
    { key: 'user:u2', itemId: 'u2', role: 'user', text: '我最近負責前端架構改造。', timestamp: 4, relativeTime: 16, complete: false, manuallyEdited: false },
  ];
  const markup = renderToStaticMarkup(React.createElement(TranscriptPanel as React.ComponentType<any>, {
    turns,
    hasStarted: true,
    isSpeaking: false,
    onEdit: () => {},
  }));

  assert.equal((markup.match(/<article/g) || []).length, 4);
  assert.match(markup, /您好，很高興認識你。/);
  assert.match(markup, /我最近負責前端架構改造。/);
  assert.match(markup, />0:03</);
  assert.match(markup, />0:16</);
});

test('逐字稿更新時會平滑捲動到最新內容', async () => {
  const module = await import('../../components/LiveSession.tsx');
  const scrollTranscriptToLatest = (module as Record<string, unknown>).scrollTranscriptToLatest;
  assert.equal(typeof scrollTranscriptToLatest, 'function');

  const calls: ScrollToOptions[] = [];
  const container = {
    scrollHeight: 720,
    scrollTo: (options: ScrollToOptions) => calls.push(options),
  } as HTMLDivElement;

  (scrollTranscriptToLatest as (element: HTMLDivElement) => void)(container);
  assert.deepEqual(calls, [{ top: 720, behavior: 'smooth' }]);
});

test('音訊暖機完成前只能準備連線且不能開始面試', () => {
  const markup = renderSession();

  assert.match(markup, />準備面試</);
  assert.match(markup, /<button[^>]+disabled=""[^>]*>開始面試<\/button>/);
});

test('WebRTC 播放鏈路全部就緒後才允許開始面試', async () => {
  const flow = await import('../../services/interviewSessionFlow.ts').catch(() => ({}));
  const InterviewReadinessGate = (flow as Record<string, unknown>).InterviewReadinessGate;
  assert.equal(typeof InterviewReadinessGate, 'function');

  const gate = new (InterviewReadinessGate as new () => {
    mark: (signal: string) => boolean;
    reset: () => void;
    ready: boolean;
  })();

  assert.equal(gate.ready, false);
  assert.equal(gate.mark('connection'), false);
  assert.equal(gate.mark('track-unmuted'), false);
  assert.equal(gate.mark('audio-playing'), false);
  assert.equal(gate.mark('warmup-stopped'), true);
  gate.reset();
  assert.equal(gate.ready, false);
});

test('結束語播放完畢後才自動結束面試', async () => {
  const flow = await import('../../services/interviewSessionFlow.ts').catch(() => ({}));
  const InterviewAutoEndGate = (flow as Record<string, unknown>).InterviewAutoEndGate;
  assert.equal(typeof InterviewAutoEndGate, 'function');

  const gate = new (InterviewAutoEndGate as new (phrases: string[]) => {
    observeTranscript: (responseId: string, transcript: string) => boolean;
    audioStopped: (responseId: string) => boolean;
  })(['今天的面試到這裡，謝謝你的時間，祝你順利。']);

  assert.equal(gate.observeTranscript('response-normal', '謝謝你的回答，我還有一個問題。'), false);
  assert.equal(gate.audioStopped('response-normal'), false);
  assert.equal(gate.observeTranscript('response-final', '好的。今天的面試到這裡，謝謝你的時間，祝你順利。'), true);
  assert.equal(gate.audioStopped('response-other'), false);
  assert.equal(gate.audioStopped('response-final'), true);
});

test('候選人在結束語期間插話會取消自動掛斷', async () => {
  const flow = await import('../../services/interviewSessionFlow.ts').catch(() => ({}));
  const InterviewAutoEndGate = (flow as Record<string, unknown>).InterviewAutoEndGate;
  assert.equal(typeof InterviewAutoEndGate, 'function');

  const gate = new (InterviewAutoEndGate as new (phrases: string[]) => {
    observeTranscript: (responseId: string, transcript: string) => boolean;
    cancel: () => void;
    audioStopped: (responseId: string) => boolean;
  })(['This concludes our interview. Thank you for your time, and best of luck.']);

  gate.observeTranscript('response-final', 'This concludes our interview. Thank you for your time, and best of luck.');
  gate.cancel();
  assert.equal(gate.audioStopped('response-final'), false);
});

test('AI 播放期間不接受回音觸發下一輪，候選人停頓後保留回覆緩衝', async () => {
  const flow = await import('../../services/interviewSessionFlow.ts').catch(() => ({}));
  const InterviewTurnGate = (flow as Record<string, unknown>).InterviewTurnGate;
  assert.equal(typeof InterviewTurnGate, 'function');

  const gate = new (InterviewTurnGate as new () => {
    assistantResponseRequested: () => void;
    assistantAudioStopped: () => void;
    speechStarted: () => boolean;
    speechStopped: () => number | null;
    mayRespond: (token: number) => boolean;
  })();

  gate.assistantResponseRequested();
  assert.equal(gate.speechStarted(), false);
  assert.equal(gate.speechStopped(), null);

  gate.assistantAudioStopped();
  assert.equal(gate.speechStarted(), true);
  const firstPause = gate.speechStopped();
  assert.equal(typeof firstPause, 'number');
  assert.equal(gate.mayRespond(firstPause!), true);

  assert.equal(gate.speechStarted(), true);
  assert.equal(gate.mayRespond(firstPause!), false);
  const completedAnswer = gate.speechStopped();
  assert.equal(gate.mayRespond(completedAnswer!), true);
});

test('AI 語音播放期間關閉上行麥克風，播完後只恢復使用者原本的設定', async () => {
  const flow = await import('../../services/interviewSessionFlow.ts').catch(() => ({}));
  const InterviewMicrophoneGate = (flow as Record<string, unknown>).InterviewMicrophoneGate;
  assert.equal(typeof InterviewMicrophoneGate, 'function');

  const gate = new (InterviewMicrophoneGate as new () => {
    setUserEnabled: (enabled: boolean, track: { enabled: boolean }) => void;
    assistantResponseRequested: (track: { enabled: boolean }) => void;
    assistantResponseCreated: (responseId: string) => boolean;
    assistantAudioStarted: (responseId: string, track: { enabled: boolean }) => boolean;
    assistantResponseDone: (responseId: string, track: { enabled: boolean }) => boolean;
    assistantAudioStopped: (responseId: string, track: { enabled: boolean }) => boolean;
  })();
  const track = { enabled: true };

  gate.assistantResponseRequested(track);
  assert.equal(track.enabled, false);
  assert.equal(gate.assistantResponseCreated('response-a'), true);
  assert.equal(gate.assistantAudioStarted('response-a', track), true);
  gate.setUserEnabled(false, track);
  gate.setUserEnabled(true, track);
  assert.equal(track.enabled, false);
  assert.equal(gate.assistantResponseDone('response-a', track), false);
  assert.equal(track.enabled, false);
  assert.equal(gate.assistantAudioStopped('response-a', track), true);
  assert.equal(track.enabled, true);

  gate.setUserEnabled(false, track);
  gate.assistantResponseRequested(track);
  assert.equal(gate.assistantResponseCreated('response-b'), true);
  assert.equal(gate.assistantAudioStarted('response-b', track), true);
  assert.equal(gate.assistantAudioStopped('response-b', track), true);
  assert.equal(track.enabled, false);
});

test('無音訊回覆會恢復收音，舊 response 的播放結束事件不得解鎖新回覆', async () => {
  const flow = await import('../../services/interviewSessionFlow.ts').catch(() => ({}));
  const InterviewMicrophoneGate = (flow as Record<string, unknown>).InterviewMicrophoneGate;
  assert.equal(typeof InterviewMicrophoneGate, 'function');

  const gate = new (InterviewMicrophoneGate as new () => {
    assistantResponseRequested: (track: { enabled: boolean }) => void;
    assistantResponseCreated: (responseId: string) => boolean;
    assistantResponseDone: (responseId: string, track: { enabled: boolean }) => boolean;
    assistantAudioStopped: (responseId: string, track: { enabled: boolean }) => boolean;
  })();
  const track = { enabled: true };

  gate.assistantResponseRequested(track);
  gate.assistantResponseCreated('response-no-audio');
  assert.equal(gate.assistantResponseDone('response-no-audio', track), true);
  assert.equal(track.enabled, true);

  gate.assistantResponseRequested(track);
  gate.assistantResponseCreated('response-current');
  assert.equal(gate.assistantAudioStopped('response-no-audio', track), false);
  assert.equal(track.enabled, false);
  assert.equal(gate.assistantResponseDone('response-current', track), true);
  assert.equal(track.enabled, true);
});
