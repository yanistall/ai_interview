import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { parseResume, extractResumeContext } from '../src/services/resumeContext.js';
import { RealtimeTranscript } from '../../services/realtimeTranscript.ts';

test('resume validation accepts a PDF and rejects forged or oversized data', () => {
  const pdf = Buffer.from('%PDF-1.7\nexample');
  assert.deepEqual(parseResume({ mimeType: 'application/pdf', data: pdf.toString('base64') }), {
    mimeType: 'application/pdf', data: pdf.toString('base64'),
  });
  assert.equal(parseResume({ mimeType: 'image/png', data: pdf.toString('base64') }), null);
  assert.equal(parseResume({ mimeType: 'application/pdf', data: Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64') }), null);
});

test('resume extraction sends PDF as file input and returns text only', async () => {
  const originalFetch = globalThis.fetch;
  let body: any;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Python project experience' }] }] });
  };
  try {
    const text = await extractResumeContext({ mimeType: 'application/pdf', data: 'JVBERi0=' }, 'test-key');
    assert.equal(text, 'Python project experience');
    assert.equal(body.store, false);
    assert.equal(body.input[0].content[1].type, 'input_file');
    assert.equal(body.input[0].content[1].file_data, 'data:application/pdf;base64,JVBERi0=');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resume extraction sends images as image input', async () => {
  const originalFetch = globalThis.fetch;
  let body: any;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Portfolio' }] }] });
  };
  try {
    await extractResumeContext({ mimeType: 'image/png', data: 'iVBORw0KGgo=' }, 'test-key');
    assert.deepEqual(body.input[0].content[1], {
      type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo=',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('final transcript waits for the committed input to finish', async () => {
  const transcript = new RealtimeTranscript(() => 1);
  transcript.speechStarted();
  const settled = transcript.waitForFinalInput(500, 20);
  await delay(30);
  transcript.speechStopped();
  await delay(30);
  transcript.inputCommitted('last-answer');
  await delay(30);
  transcript.update('last-answer', 'user', '最後一段回答', true);
  assert.equal(await settled, true);
  assert.equal(transcript.snapshot()[0].text, '最後一段回答');
  assert.equal(transcript.snapshot()[0].itemId, 'last-answer');
});

test('final transcript wait is bounded if speech never commits', async () => {
  const transcript = new RealtimeTranscript(() => 1);
  transcript.speechStarted();
  assert.equal(await transcript.waitForFinalInput(30, 10), false);
});

test('manual transcript edits are preserved in the final snapshot', () => {
  const transcript = new RealtimeTranscript(() => 2);
  transcript.update('answer-1', 'user', '自動辨識內容', false);
  transcript.edit('answer-1', 'user', '手動修正內容');
  transcript.update('answer-1', 'user', '服務完成內容', true);

  assert.equal(transcript.editableSnapshot()[0].manuallyEdited, true);
  assert.equal(transcript.editableSnapshot()[0].complete, true);
  assert.equal(transcript.snapshot()[0].text, '手動修正內容');
});

test('clearing an edited transcript removes it from the final report', () => {
  const transcript = new RealtimeTranscript(() => 3);
  transcript.update('response-1', 'model', '需要移除的內容', true);
  transcript.edit('response-1', 'model', '   ');

  assert.equal(transcript.editableSnapshot()[0].text, '   ');
  assert.deepEqual(transcript.snapshot(), []);
});
