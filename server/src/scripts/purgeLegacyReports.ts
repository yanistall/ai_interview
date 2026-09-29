import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type LegacyReportRow = {
  id: string;
  videoPath: unknown;
};

export type LegacyPurgeInventory = {
  reportCount: number;
  reportsWithVideo: number;
  distinctVideoCount: number;
  videoFilenames: string[];
};

export type LegacyPurgeProgress = {
  filename: string;
  status: 'handled' | 'failed';
  handledCount: number;
};

type UnlinkVideo = (filename: string) => Promise<void>;
type PurgeOptions = {
  executeFiles?: boolean;
  unlinkVideo?: UnlinkVideo;
  onProgress?: (record: LegacyPurgeProgress) => void;
};

export function buildLegacyPurgeInventory(rows: readonly LegacyReportRow[]): LegacyPurgeInventory {
  const videoFilenames = new Set<string>();
  let reportsWithVideo = 0;

  for (const row of rows) {
    if (row.videoPath === null) continue;
    if (!isSafeVideoFilename(row.videoPath)) throw new Error('Invalid video filename');
    reportsWithVideo += 1;
    videoFilenames.add(row.videoPath);
  }

  return {
    reportCount: rows.length,
    reportsWithVideo,
    distinctVideoCount: videoFilenames.size,
    videoFilenames: [...videoFilenames],
  };
}

export async function purgeLegacyReportFiles(
  rows: readonly LegacyReportRow[],
  options: PurgeOptions = {},
): Promise<LegacyPurgeInventory> {
  const inventory = buildLegacyPurgeInventory(rows);
  if (!options.executeFiles) return inventory;
  if (!options.unlinkVideo) throw new Error('File purge dependency is required');

  let handledCount = 0;
  for (const filename of inventory.videoFilenames) {
    try {
      await options.unlinkVideo(filename);
    } catch (error) {
      options.onProgress?.({ filename, status: 'failed', handledCount });
      throw error;
    }
    handledCount += 1;
    options.onProgress?.({ filename, status: 'handled', handledCount });
  }
  return inventory;
}

function isSafeVideoFilename(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value === '.' || value === '..' || value.includes('\0')) return false;
  if (value.includes('/') || value.includes('\\')) return false;
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  return path.basename(value) === value;
}

async function main(): Promise<void> {
  const { default: prisma } = await import('../db/client.js');
  try {
    const rows = await prisma.interviewReport.findMany({ select: { id: true, videoPath: true } });
    const executeFiles = process.argv.includes('--execute-files');
    const inventory = executeFiles
      ? await purgeLegacyReportFiles(rows, {
        executeFiles: true,
        unlinkVideo: (await import('../services/dataRetention.js')).unlinkVideo,
        onProgress: (record) => process.stdout.write(`${JSON.stringify(record)}\n`),
      })
      : await purgeLegacyReportFiles(rows);

    process.stdout.write(`${JSON.stringify(inventory, null, executeFiles ? 0 : 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedFile === fileURLToPath(import.meta.url)) {
  void main().catch(() => {
    process.stderr.write('Legacy report file purge failed.\n');
    process.exitCode = 1;
  });
}
