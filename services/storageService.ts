import { InterviewReport } from '../types';
import { apiFetch } from './api';

export const saveReport = async (report: Omit<InterviewReport, 'id'> & { id?: string; videoPath?: string; jobProfileId?: string }): Promise<InterviewReport> => {
  const res = await apiFetch('/reports', {
    method: 'POST',
    body: JSON.stringify({
      candidateName: report.candidateName,
      jobTitle: report.jobTitle,
      videoPath: report.videoPath,
      fullTranscript: report.fullTranscript,
      assessmentVersion: report.assessmentVersion,
      assessment: report.assessment,
      jobProfileId: report.jobProfileId,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '儲存報告失敗');
  }

  return res.json();
};

export const getAllReports = async (): Promise<InterviewReport[]> => {
  const res = await apiFetch('/reports');

  if (!res.ok) {
    console.error('Failed to load reports');
    return [];
  }

  return res.json();
};

export const getReportById = async (id: string): Promise<InterviewReport | undefined> => {
  const res = await apiFetch(`/reports/${id}`);

  if (!res.ok) return undefined;

  return res.json();
};

export const deleteReport = async (id: string): Promise<void> => {
  const res = await apiFetch(`/reports/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '刪除報告失敗');
  }
};
