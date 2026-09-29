import type { InterviewConfig, InterviewReport, TranscriptItem } from '../types';

type ReportToSave = Omit<InterviewReport, 'id' | 'videoPath'> & {
  id?: string;
  videoPath?: string;
  jobProfileId?: string;
};

export interface InterviewCompletionInput {
  transcript: TranscriptItem[];
  videoBlob: Blob | null;
  config: InterviewConfig;
}

export interface InterviewCompletionDependencies {
  saveVideo: (blob: Blob) => Promise<string>;
  generateReport: (
    transcript: TranscriptItem[],
    jobTitle: string,
    candidateName: string,
    jobDescription: string,
  ) => Promise<InterviewReport>;
  saveReport: (report: ReportToSave) => Promise<InterviewReport>;
}

export interface InterviewCompletionCallbacks {
  onStarted: () => void;
  onSuccess: (report: InterviewReport) => void;
  onError: (error: unknown) => void;
}

interface BeforeUnloadEventTarget {
  addEventListener: (type: 'beforeunload', listener: (event: BeforeUnloadEvent) => void) => void;
  removeEventListener: (type: 'beforeunload', listener: (event: BeforeUnloadEvent) => void) => void;
}

export const installInterviewCompletionGuard = (
  target: BeforeUnloadEventTarget,
): (() => void) => {
  const warnBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = 'true';
  };

  target.addEventListener('beforeunload', warnBeforeUnload);
  return () => target.removeEventListener('beforeunload', warnBeforeUnload);
};

export const startInterviewCompletion = (
  input: InterviewCompletionInput,
  dependencies: InterviewCompletionDependencies,
  callbacks: InterviewCompletionCallbacks,
): Promise<void> => {
  callbacks.onStarted();

  const videoPathPromise = input.videoBlob
    ? dependencies.saveVideo(input.videoBlob)
    : Promise.resolve(undefined);
  const reportPromise = dependencies.generateReport(
    input.transcript,
    input.config.jobTitle,
    input.config.candidateName,
    input.config.jobDescription,
  );

  return Promise.all([videoPathPromise, reportPromise])
    .then(([videoPath, generatedReport]) => dependencies.saveReport({
      ...generatedReport,
      videoPath,
      jobProfileId: input.config.jobId,
    }))
    .then((savedReport) => {
      callbacks.onSuccess(savedReport);
    })
    .catch((error: unknown) => {
      callbacks.onError(error);
    });
};
