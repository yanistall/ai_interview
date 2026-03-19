import { JobProfile } from '../types';

const JOB_STORAGE_KEY = 'enterprise_jobs';

export const saveJob = (job: JobProfile): void => {
  try {
    const jobs = getJobs();
    // Check if update or new
    const index = jobs.findIndex(j => j.id === job.id);
    if (index >= 0) {
      jobs[index] = job;
    } else {
      jobs.push(job);
    }
    localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobs));
  } catch (e) {
    console.error("Failed to save job", e);
  }
};

export const getJobs = (): JobProfile[] => {
  try {
    const existingData = localStorage.getItem(JOB_STORAGE_KEY);
    return existingData ? JSON.parse(existingData) : [];
  } catch (e) {
    console.error("Failed to load jobs", e);
    return [];
  }
};

export const deleteJob = (id: string): void => {
  try {
    const jobs = getJobs();
    const newJobs = jobs.filter(j => j.id !== id);
    localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(newJobs));
  } catch (e) {
    console.error("Failed to delete job", e);
  }
};

export const getJobById = (id: string): JobProfile | undefined => {
  const jobs = getJobs();
  return jobs.find(j => j.id === id);
};