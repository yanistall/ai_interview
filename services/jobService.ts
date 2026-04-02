import { JobProfile } from '../types';
import { apiFetch } from './api';

export const saveJob = async (job: Partial<JobProfile> & { companyName: string; title: string; description: string }): Promise<JobProfile> => {
  const isUpdate = !!job.id;
  const res = await apiFetch(isUpdate ? `/jobs/${job.id}` : '/jobs', {
    method: isUpdate ? 'PUT' : 'POST',
    body: JSON.stringify(job),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '儲存職缺失敗');
  }

  return res.json();
};

export const getJobs = async (): Promise<JobProfile[]> => {
  const res = await apiFetch('/jobs');

  if (!res.ok) {
    console.error('Failed to load jobs');
    return [];
  }

  return res.json();
};

export const getMyJobs = async (): Promise<JobProfile[]> => {
  const res = await apiFetch('/jobs/my');
  if (!res.ok) return [];
  return res.json();
};

export const deleteJob = async (id: string): Promise<void> => {
  await apiFetch(`/jobs/${id}`, { method: 'DELETE' });
};

export const getJobById = async (id: string): Promise<JobProfile | undefined> => {
  const res = await apiFetch(`/jobs/${id}`);

  if (!res.ok) return undefined;

  return res.json();
};
