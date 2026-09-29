import { Role } from '@prisma/client';

export type VideoAccessRecord = {
  uploaderId: string;
  report: {
    candidateId: string | null;
    videoPath: string | null;
    jobProfile: { createdById: string } | null;
  } | null;
} | null;

export const canViewVideo = (
  role: Role,
  userId: string,
  filename: string,
  upload: VideoAccessRecord,
): boolean => {
  if (role === 'ADMIN') return true;
  if (!upload?.report || upload.report.videoPath !== filename ||
    upload.uploaderId !== upload.report.candidateId) return false;

  if (role === 'CANDIDATE') return upload.report.candidateId === userId;
  if (role === 'ENTERPRISE') return upload.report.jobProfile?.createdById === userId;
  return false;
};
