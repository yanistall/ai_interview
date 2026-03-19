import { InterviewReport } from '../types';

const STORAGE_KEY = 'ai_interview_reports';

export const saveReport = (report: InterviewReport): void => {
  try {
    const existingData = localStorage.getItem(STORAGE_KEY);
    const reports: InterviewReport[] = existingData ? JSON.parse(existingData) : [];
    reports.push(report);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (e) {
    console.error("Failed to save report", e);
  }
};

export const getAllReports = (): InterviewReport[] => {
  try {
    const existingData = localStorage.getItem(STORAGE_KEY);
    return existingData ? JSON.parse(existingData) : [];
  } catch (e) {
    console.error("Failed to load reports", e);
    return [];
  }
};

export const getReportById = (id: string): InterviewReport | undefined => {
  const reports = getAllReports();
  return reports.find(r => r.id === id);
};

export const deleteReport = (id: string): void => {
  const reports = getAllReports();
  const newReports = reports.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newReports));
};