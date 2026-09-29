export type InterviewReadinessSignal =
  | 'connection'
  | 'track-unmuted'
  | 'audio-playing'
  | 'warmup-stopped';

const REQUIRED_READINESS_SIGNALS: InterviewReadinessSignal[] = [
  'connection',
  'track-unmuted',
  'audio-playing',
  'warmup-stopped',
];

export class InterviewReadinessGate {
  private readonly signals = new Set<InterviewReadinessSignal>();

  get ready(): boolean {
    return REQUIRED_READINESS_SIGNALS.every((signal) => this.signals.has(signal));
  }

  mark(signal: InterviewReadinessSignal): boolean {
    this.signals.add(signal);
    return this.ready;
  }

  reset(): void {
    this.signals.clear();
  }
}

const normalizeTranscript = (value: string): string => value
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[\p{P}\p{S}\s]+/gu, '');

export class InterviewAutoEndGate {
  private pendingResponseId: string | null = null;
  private readonly normalizedPhrases: string[];

  constructor(phrases: string[]) {
    this.normalizedPhrases = phrases.map(normalizeTranscript).filter(Boolean);
  }

  observeTranscript(responseId: string, transcript: string): boolean {
    const normalized = normalizeTranscript(transcript);
    const isClosing = this.normalizedPhrases.some((phrase) => normalized.endsWith(phrase));
    if (!responseId || !isClosing) return false;
    this.pendingResponseId = responseId;
    return true;
  }

  cancel(): void {
    this.pendingResponseId = null;
  }

  audioStopped(responseId: string): boolean {
    if (!responseId || responseId !== this.pendingResponseId) return false;
    this.pendingResponseId = null;
    return true;
  }
}

export class InterviewTurnGate {
  private acceptingCandidate = false;
  private candidateSpeaking = false;
  private generation = 0;

  assistantResponseRequested(): void {
    this.acceptingCandidate = false;
    this.candidateSpeaking = false;
    this.generation += 1;
  }

  assistantAudioStopped(): void {
    this.acceptingCandidate = true;
    this.candidateSpeaking = false;
    this.generation += 1;
  }

  speechStarted(): boolean {
    this.generation += 1;
    this.candidateSpeaking = this.acceptingCandidate;
    return this.candidateSpeaking;
  }

  speechStopped(): number | null {
    if (!this.acceptingCandidate || !this.candidateSpeaking) {
      this.candidateSpeaking = false;
      return null;
    }
    this.candidateSpeaking = false;
    return this.generation;
  }

  mayRespond(token: number): boolean {
    return this.acceptingCandidate && !this.candidateSpeaking && token === this.generation;
  }
}

interface ToggleableAudioTrack {
  enabled: boolean;
}

export class InterviewMicrophoneGate {
  private userEnabled = true;
  private assistantActive = false;
  private activeResponseId: string | null = null;
  private audioStarted = false;

  setUserEnabled(enabled: boolean, track?: ToggleableAudioTrack): void {
    this.userEnabled = enabled;
    if (track) track.enabled = enabled && !this.assistantActive;
  }

  assistantResponseRequested(track?: ToggleableAudioTrack): void {
    this.assistantActive = true;
    this.activeResponseId = null;
    this.audioStarted = false;
    if (track) track.enabled = false;
  }

  assistantResponseCreated(responseId: string): boolean {
    if (!this.assistantActive || !responseId) return false;
    if (this.activeResponseId !== null) return this.activeResponseId === responseId;
    this.activeResponseId = responseId;
    return true;
  }

  assistantAudioStarted(responseId: string, track?: ToggleableAudioTrack): boolean {
    if (!this.assistantActive || responseId !== this.activeResponseId) return false;
    this.audioStarted = true;
    if (track) track.enabled = false;
    return true;
  }

  assistantResponseDone(responseId: string, track?: ToggleableAudioTrack): boolean {
    if (!this.assistantActive || responseId !== this.activeResponseId || this.audioStarted) return false;
    this.releaseMicrophone(track);
    return true;
  }

  assistantAudioStopped(responseId: string, track?: ToggleableAudioTrack): boolean {
    if (!this.assistantActive || responseId !== this.activeResponseId) return false;
    this.releaseMicrophone(track);
    return true;
  }

  private releaseMicrophone(track?: ToggleableAudioTrack): void {
    this.assistantActive = false;
    this.activeResponseId = null;
    this.audioStarted = false;
    if (track) track.enabled = this.userEnabled;
  }
}
