import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../db/client.js';

const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
const day = 24 * 60 * 60 * 1000;
const videoLifetime = 90 * day;
const closedAccountLifetime = 30 * day;

export const accountPurgeCutoff = (now: Date): Date => new Date(now.getTime() - closedAccountLifetime);

export function isExpiredGeneratedVideo(filename: string, cutoff: Date): boolean {
  const match = /^(\d{13})-[a-z0-9]{6}\.[^/]+$/i.exec(filename);
  return !!match && Number(match[1]) <= cutoff.getTime();
}

export async function unlinkVideo(filename: string): Promise<void> {
  if (!filename || path.basename(filename) !== filename || filename === '.' || filename === '..') {
    throw new Error('Invalid video filename');
  }
  const filePath = path.resolve(uploadsDir, filename);
  if (!filePath.startsWith(uploadsDir + path.sep)) throw new Error('Invalid video path');
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

// A video can be referenced by more than one legacy report. Delete the file
// only after the last reference is removed.
export async function deleteReportAndVideo(reportId: string): Promise<boolean> {
  const report = await prisma.interviewReport.findUnique({ where: { id: reportId }, select: { videoPath: true } });
  if (!report) return false;
  let removeVideo = false;
  if (report.videoPath) {
    const otherReferences = await prisma.interviewReport.count({
      where: { videoPath: report.videoPath, id: { not: reportId } },
    });
    removeVideo = otherReferences === 0;
    if (removeVideo) await unlinkVideo(report.videoPath);
  }
  await prisma.interviewReport.delete({ where: { id: reportId } });
  if (removeVideo && report.videoPath) {
    await prisma.videoUpload.deleteMany({ where: { filename: report.videoPath, reportId: null } });
  }
  return true;
}

export async function eraseCandidateData(userId: string): Promise<void> {
  const reports = await prisma.interviewReport.findMany({
    where: { candidateId: userId }, select: { id: true },
  });
  for (const report of reports) await deleteReportAndVideo(report.id);

  // Include uploads where report generation failed or was abandoned.
  const uploads = await prisma.videoUpload.findMany({ where: { uploaderId: userId }, select: { filename: true } });
  for (const upload of uploads) await unlinkVideo(upload.filename);
  await prisma.videoUpload.deleteMany({ where: { uploaderId: userId } });
  await prisma.user.delete({ where: { id: userId } });
}

export async function runRetention(now = new Date()): Promise<void> {
  const expiredAt = new Date(now.getTime() - videoLifetime);
  const uploads = await prisma.videoUpload.findMany({
    where: { uploadedAt: { lte: expiredAt } }, select: { filename: true },
  });
  for (const upload of uploads) {
    try {
      await unlinkVideo(upload.filename);
      await prisma.interviewReport.updateMany({ where: { videoPath: upload.filename }, data: { videoPath: null } });
      await prisma.videoUpload.delete({ where: { filename: upload.filename } });
    } catch (error) {
      console.error('Expired video cleanup failed:', upload.filename, error);
    }
  }

  // Uploads from before the ownership table, including orphaned files, also expire.
  for (const entry of await fs.readdir(uploadsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!isExpiredGeneratedVideo(entry.name, expiredAt)) continue;
    try {
      await unlinkVideo(entry.name);
      await prisma.interviewReport.updateMany({ where: { videoPath: entry.name }, data: { videoPath: null } });
      await prisma.videoUpload.deleteMany({ where: { filename: entry.name } });
    } catch (error) {
      console.error('Legacy video cleanup failed:', entry.name, error);
    }
  }

  const closed = await prisma.user.findMany({
    where: { role: 'CANDIDATE', closedAt: { lte: accountPurgeCutoff(now) } },
    select: { id: true },
  });
  for (const user of closed) {
    try {
      await eraseCandidateData(user.id);
    } catch (error) {
      console.error('Closed account cleanup failed:', user.id, error);
    }
  }
}

export function startRetentionSchedule(): void {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runRetention();
    } catch (error) {
      console.error('Retention cleanup failed:', error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref();
}
