import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildLegacyPurgeInventory,
  purgeLegacyReportFiles,
} from '../src/scripts/purgeLegacyReports.js';

test('buildLegacyPurgeInventory deduplicates valid basenames while retaining report counts', () => {
  const inventory = buildLegacyPurgeInventory([
    { id: 'report-1', videoPath: 'first.webm' },
    { id: 'report-2', videoPath: null },
    { id: 'report-3', videoPath: 'first.webm' },
    { id: 'report-4', videoPath: 'second.webm' },
  ]);

  assert.deepEqual(inventory, {
    reportCount: 4,
    reportsWithVideo: 3,
    distinctVideoCount: 2,
    videoFilenames: ['first.webm', 'second.webm'],
  });
});

test('buildLegacyPurgeInventory rejects every inventory when one non-null path is unsafe', () => {
  assert.throws(
    () => buildLegacyPurgeInventory([
      { id: 'report-1', videoPath: 'safe.webm' },
      { id: 'report-2', videoPath: '../outside.webm' },
    ]),
    /Invalid video filename/,
  );
});

test('buildLegacyPurgeInventory rejects unsafe basenames, paths, and non-string values', () => {
  for (const videoPath of ['.', '..', '/absolute.webm', 'nested/file.webm', 'nested\\file.webm', 'C:\\temp\\file.webm', '', undefined, 7, {}]) {
    assert.throws(
      () => buildLegacyPurgeInventory([{ id: 'report-1', videoPath }]),
      /Invalid video filename/,
    );
  }
});

test('purgeLegacyReportFiles dry run never invokes the file unlink dependency', async () => {
  let unlinkCalls = 0;
  const inventory = await purgeLegacyReportFiles(
    [{ id: 'report-1', videoPath: 'safe.webm' }],
    {
      executeFiles: false,
      unlinkVideo: async () => { unlinkCalls += 1; },
    },
  );

  assert.deepEqual(inventory, {
    reportCount: 1,
    reportsWithVideo: 1,
    distinctVideoCount: 1,
    videoFilenames: ['safe.webm'],
  });
  assert.equal(unlinkCalls, 0);
});

test('purgeLegacyReportFiles reports each handled file in inventory order', async () => {
  const progress: unknown[] = [];

  await purgeLegacyReportFiles(
    [
      { id: 'report-1', videoPath: 'first.webm' },
      { id: 'report-2', videoPath: 'second.webm' },
    ],
    {
      executeFiles: true,
      unlinkVideo: async () => {},
      onProgress: (record) => { progress.push(record); },
    },
  );

  assert.deepEqual(progress, [
    { filename: 'first.webm', status: 'handled', handledCount: 1 },
    { filename: 'second.webm', status: 'handled', handledCount: 2 },
  ]);
});

test('purgeLegacyReportFiles reports a failed second file and stops before the third', async () => {
  const progress: unknown[] = [];
  const attempted: string[] = [];

  await assert.rejects(
    purgeLegacyReportFiles(
      [
        { id: 'report-1', videoPath: 'first.webm' },
        { id: 'report-2', videoPath: 'second.webm' },
        { id: 'report-3', videoPath: 'third.webm' },
      ],
      {
        executeFiles: true,
        unlinkVideo: async (filename) => {
          attempted.push(filename);
          if (filename === 'second.webm') throw new Error('unavailable');
        },
        onProgress: (record) => { progress.push(record); },
      },
    ),
    /unavailable/,
  );

  assert.deepEqual(progress, [
    { filename: 'first.webm', status: 'handled', handledCount: 1 },
    { filename: 'second.webm', status: 'failed', handledCount: 1 },
  ]);
  assert.deepEqual(attempted, ['first.webm', 'second.webm']);
});

test('purgeLegacyReportFiles validates every path before any file can be unlinked', async () => {
  const unlinked: string[] = [];
  const progress: unknown[] = [];

  await assert.rejects(
    purgeLegacyReportFiles(
      [
        { id: 'report-1', videoPath: 'safe.webm' },
        { id: 'report-2', videoPath: '../outside.webm' },
      ],
      {
        executeFiles: true,
        unlinkVideo: async (filename) => { unlinked.push(filename); },
        onProgress: (record) => { progress.push(record); },
      },
    ),
    /Invalid video filename/,
  );

  assert.deepEqual(unlinked, []);
  assert.deepEqual(progress, []);
});
