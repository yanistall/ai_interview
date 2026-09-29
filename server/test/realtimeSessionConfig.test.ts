import assert from 'node:assert/strict';
import { test } from 'node:test';

test('keeps semantic VAD events while preventing automatic interruption and replies', async () => {
  const module = await import('../src/services/realtimeSessionConfig.js').catch(() => ({}));
  const buildRealtimeSessionConfig = (module as Record<string, unknown>).buildRealtimeSessionConfig;
  assert.equal(typeof buildRealtimeSessionConfig, 'function');

  const session = (buildRealtimeSessionConfig as (input: {
    instructions: string;
    language: 'zh-TW' | 'en-US';
    voiceName: string;
  }) => any)({ instructions: 'test instructions', language: 'zh-TW', voiceName: 'marin' });

  assert.deepEqual(session.audio.input.turn_detection, {
    type: 'semantic_vad',
    eagerness: 'low',
    create_response: false,
    interrupt_response: false,
  });
});
