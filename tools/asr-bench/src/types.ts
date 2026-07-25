import type { ConditionId } from './config.ts';

/** Uniform adapter return. Batch and realtime must be interchangeable here. */
export type TranscribeResult = {
  text: string;
  /**
   * Batch: full request round-trip.
   * Realtime: time from first audio byte sent to the final transcript message —
   * NOT wall time of the session, which would include connection setup and the
   * trailing close handshake and would make realtime look artificially slow.
   */
  latencyMs: number;
  costUsd: number;
  /** Audio duration used for the cost calculation. */
  audioSeconds: number;
  /** Everything the API sent back, cached verbatim for later re-analysis. */
  raw: unknown;
  /** Set when the call failed after all retries; text will be ''. */
  error?: string;
  /** Realtime only: connection setup time, excluded from latencyMs. */
  connectMs?: number;
  /** Realtime only: how many partials arrived before the final. */
  partialCount?: number;
};

export type TranscribeOptions = {
  keyterms: string[] | null;
  noVerbatim: boolean;
  languageCode?: string;
};

/** One clip under one condition. The unit of work and of caching. */
export type Trial = {
  clipId: string;
  clipPath: string;
  conditionId: ConditionId;
  /** Ground truth: the card, not the string. */
  expectedCard: string;
  category: string;
  speaker: string;
  recordingCondition: string;
  take: string;
  /** The spokenForm the clip was recorded for, when known from the manifest. */
  spokenForm?: string;
};

export type TrialOutcome = Trial & {
  transcript: string;
  latencyMs: number;
  costUsd: number;
  audioSeconds: number;
  connectMs?: number;
  partialCount?: number;
  error?: string;
  /** Was this trial served from results/raw/ rather than the network? */
  cached: boolean;

  // Resolution layer — the scoring that actually matters.
  resolvedCard: string | null;
  resolvedScore: number;
  resolvedSignal: string;
  confidence: number;
  runnerUps: { name: string; score: number }[];
  top1Correct: boolean;
  top3Correct: boolean;
  /** confidence > threshold AND wrong. The number that decides auto-execute. */
  falseConfident: boolean;
  /** Did this card have a keyterm slot in this condition? */
  hadKeytermSlot: boolean;
};
