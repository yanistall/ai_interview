import type { TranscriptItem } from '../types';

type Turn = TranscriptItem & { itemId: string; complete: boolean; manuallyEdited: boolean };

export type EditableTranscriptTurn = Turn & { key: string };

export class RealtimeTranscript {
  private turns = new Map<string, Turn>();
  private pendingInputStart: number | null = null;
  private inputStarts = new Map<string, number>();
  private activeSpeech = false;
  private pendingInputs = new Set<string>();
  private listeners = new Set<() => void>();

  constructor(private relativeTime: () => number) {}

  speechStarted(): void {
    this.pendingInputStart = this.relativeTime();
    this.activeSpeech = true;
    this.notify();
  }

  inputCommitted(itemId: string): void {
    this.inputStarts.set(itemId, this.pendingInputStart ?? this.relativeTime());
    this.pendingInputStart = null;
    this.activeSpeech = false;
    this.pendingInputs.add(itemId);
    this.notify();
  }

  speechStopped(): void {
    this.activeSpeech = false;
    this.notify();
  }

  inputTranscriptionFinished(itemId: string): void {
    this.pendingInputs.delete(itemId);
    this.notify();
  }

  connectionLost(): void {
    this.activeSpeech = false;
    this.pendingInputStart = null;
    this.pendingInputs.clear();
    this.notify();
  }

  update(itemId: string, role: 'user' | 'model', text: string, complete: boolean): Turn | null {
    if (role === 'user' && complete) this.inputTranscriptionFinished(itemId);
    if (!itemId || !text) return null;
    const key = `${role}:${itemId}`;
    const existing = this.turns.get(key);
    const now = Date.now();
    const turn: Turn = existing ? { ...existing } : {
      itemId,
      role,
      text: '',
      timestamp: now,
      relativeTime: role === 'user' ? this.inputStarts.get(itemId) ?? this.relativeTime() : this.relativeTime(),
      complete: false,
      manuallyEdited: false,
    };
    if (turn.manuallyEdited) {
      if (complete && !turn.complete) {
        turn.complete = true;
        this.turns.set(key, turn);
      }
      return turn;
    }
    if (turn.complete) return turn;
    turn.text = complete ? text : turn.text + text;
    turn.complete = complete;
    this.turns.set(key, turn);
    return turn;
  }

  edit(itemId: string, role: 'user' | 'model', text: string): Turn | null {
    const key = `${role}:${itemId}`;
    const existing = this.turns.get(key);
    if (!existing) return null;
    const turn = { ...existing, text, manuallyEdited: true };
    this.turns.set(key, turn);
    return turn;
  }

  editableSnapshot(): EditableTranscriptTurn[] {
    return this.orderedTurns().map((turn) => ({ ...turn, key: `${turn.role}:${turn.itemId}` }));
  }

  waitForFinalInput(maxWaitMs = 10_000, quietMs = 1200): Promise<boolean> {
    return new Promise((resolve) => {
      let quietTimer: ReturnType<typeof setTimeout> | null = null;
      const finish = (complete: boolean) => {
        clearTimeout(maxTimer);
        if (quietTimer !== null) clearTimeout(quietTimer);
        this.listeners.delete(check);
        resolve(complete);
      };
      const check = () => {
        if (quietTimer !== null) clearTimeout(quietTimer);
        quietTimer = null;
        if (!this.activeSpeech && this.pendingInputStart === null && this.pendingInputs.size === 0) {
          quietTimer = setTimeout(() => finish(true), quietMs);
        }
      };
      const maxTimer = setTimeout(() => finish(false), maxWaitMs);
      this.listeners.add(check);
      check();
    });
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  snapshot(): TranscriptItem[] {
    return this.orderedTurns()
      .filter((turn) => turn.text.trim())
      .map(({ itemId, role, text, timestamp, relativeTime }) => ({
        itemId,
        role,
        text: text.trim(),
        timestamp,
        relativeTime,
      }));
  }

  private orderedTurns(): Turn[] {
    return [...this.turns.values()]
      .sort((a, b) => a.relativeTime - b.relativeTime || a.timestamp - b.timestamp);
  }
}
