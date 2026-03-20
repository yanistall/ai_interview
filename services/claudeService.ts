import { InterviewReport, TranscriptItem, NonVerbalSnapshot } from '../types';
import { apiFetch } from './api';

export const generateInterviewReport = async (
  transcript: TranscriptItem[],
  nonVerbalSnapshots: NonVerbalSnapshot[],
  jobTitle: string,
  candidateName: string,
  jobDescription: string
): Promise<InterviewReport> => {
  const res = await apiFetch('/analysis/generate-report', {
    method: 'POST',
    body: JSON.stringify({
      transcript,
      nonVerbalSnapshots,
      jobTitle,
      candidateName,
      jobDescription,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '分析報告生成失敗');
  }

  const result = await res.json();

  return {
    ...result,
    id: result.id || crypto.randomUUID(),
    timestamp: result.timestamp ? new Date(result.timestamp).getTime() : Date.now(),
  } as InterviewReport;
};
