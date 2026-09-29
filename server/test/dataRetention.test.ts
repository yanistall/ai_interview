import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { accountPurgeCutoff, isExpiredGeneratedVideo, unlinkVideo } from '../src/services/dataRetention.js';

test('closed candidate accounts become eligible after 30 days', () => {
  assert.equal(accountPurgeCutoff(new Date('2026-02-01T00:00:00.000Z')).toISOString(), '2026-01-02T00:00:00.000Z');
});

test('video retention uses the generated upload timestamp at the 90-day boundary', () => {
  const cutoff = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(isExpiredGeneratedVideo('1767225600000-abcdef.webm', cutoff), true);
  assert.equal(isExpiredGeneratedVideo('1767225600001-abcdef.webm', cutoff), false);
  assert.equal(isExpiredGeneratedVideo('unrelated-file.webm', cutoff), false);
});

test('video unlink deletes only a named upload and tolerates a missing file', async () => {
  const filename = `retention-test-${randomUUID()}.webm`;
  const filePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads', filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, 'test');
  try {
    await assert.rejects(unlinkVideo('../outside.webm'), /Invalid video filename/);
    await unlinkVideo(filename);
    await assert.rejects(fs.stat(filePath), { code: 'ENOENT' });
    await unlinkVideo(filename);
  } finally {
    await fs.rm(filePath, { force: true });
  }
});
