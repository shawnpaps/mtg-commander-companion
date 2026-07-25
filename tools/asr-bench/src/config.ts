/**
 * Every fact in this file was verified against live ElevenLabs docs on
 * 2026-07-25. See README "Verified facts" for the citations and for the
 * ElevenLabs-vs-LiveKit keyterm conflict and how it resolved.
 *
 * If `npm run probe` contradicts anything here, the probe wins — update this
 * file and note the change in the README.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** tools/asr-bench — everything this harness reads or writes lives under here. */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const API = {
  restBase: 'https://api.elevenlabs.io',
  wsBase: 'wss://api.elevenlabs.io',
} as const;

export const MODELS = {
  /** Control group: no keyterm support at all. */
  v1: 'scribe_v1',
  /** Batch. Keyterms, no_verbatim, diarization, entity detection. */
  batch: 'scribe_v2',
  /** WebSocket, ~150ms. Keyterms + no_verbatim added in the 2026-05-04 release. */
  realtime: 'scribe_v2_realtime',
} as const;

/**
 * Keyterm budgets. The whole point of the (A)-vs-(B) fork: batch fits a full
 * 100-card Commander deck with room to spare; realtime forces a packing
 * strategy. See src/keyterms.ts.
 */
export const KEYTERM_BUDGETS = {
  batch: { count: 1000, maxChars: 50 },
  realtime: { count: 50, maxChars: 20 },
} as const;

/** Documented per-keyterm constraints, enforced locally so we never waste a call. */
export const KEYTERM_RULES = {
  maxWords: 5,
  /** Documented as unsupported by the batch API. */
  forbiddenChars: ['<', '>', '{', '}', '[', ']', '\\'],
} as const;

/**
 * USD per hour of audio, from elevenlabs.io/pricing/api (2026-07-25).
 *
 * The keyterm premium is published two ways that agree to within a point:
 * the pricing page lists a flat +$0.05/hr add-on, and the API reference
 * describes it as "an additional 20%" (0.05/0.22 = 22.7%). We model the flat
 * add-on because that is what the pricing page — the billing authority —
 * states. `v1` has no published rate any more; we assume parity with batch and
 * flag it in the report rather than silently inventing a number.
 */
export const PRICING = {
  perHourUsd: {
    scribe_v1: 0.22,
    scribe_v2: 0.22,
    scribe_v2_realtime: 0.39,
  } as Record<string, number>,
  keytermAddOnPerHourUsd: 0.05,
  /** Batch with 100+ keyterms bills a 20-second minimum per request. */
  keytermMinBillableSeconds: 20,
  v1RateIsAssumed: true,
} as const;

/** A 2-hour game, for the cost extrapolation in the report. */
export const GAME_MODEL = {
  hours: 2,
  /** Rough: a 4-player Commander game, one voice action per player per turn. */
  utterancesPerGame: 240,
  /** Card names are short. Push-to-talk clips run 1.5-3s. */
  avgUtteranceSeconds: 2.5,
} as const;

export const RUN = {
  concurrency: 4,
  maxRetries: 4,
  baseBackoffMs: 800,
  requestTimeoutMs: 60_000,
  realtimeTimeoutMs: 30_000,
} as const;

/** The conditions matrix. Order here is the column order in the report. */
export const CONDITIONS = [
  {
    id: 'v1-cold',
    model: MODELS.v1,
    endpoint: 'batch',
    keyterms: 'none',
    noVerbatim: false,
    label: 'Control. No keyterms, older model.',
  },
  {
    id: 'v2-batch-cold',
    model: MODELS.batch,
    endpoint: 'batch',
    keyterms: 'none',
    noVerbatim: false,
    label: 'Isolates the v1->v2 model gain from the keyterm gain.',
  },
  {
    id: 'v2-batch-keyterms',
    model: MODELS.batch,
    endpoint: 'batch',
    keyterms: 'batch',
    noVerbatim: false,
    label: 'Option (A). Full decklist as keyterms.',
  },
  {
    id: 'v2-realtime-cold',
    model: MODELS.realtime,
    endpoint: 'realtime',
    keyterms: 'none',
    noVerbatim: false,
    label: 'Realtime floor. What (B) costs us if keyterms turn out unusable.',
  },
  {
    id: 'v2-realtime-packed',
    model: MODELS.realtime,
    endpoint: 'realtime',
    keyterms: 'realtime',
    noVerbatim: false,
    label: 'Option (B). 50 slots x 20 chars, hardest cards first.',
  },
  {
    id: 'v2-batch-keyterms-noverbatim',
    model: MODELS.batch,
    endpoint: 'batch',
    keyterms: 'batch',
    noVerbatim: true,
    label: 'Does filler removal help disfluent game speech or eat card words?',
  },
] as const;

export type Condition = (typeof CONDITIONS)[number];
export type ConditionId = Condition['id'];

/** confidence > this AND wrong = a false-confident error. The headline number. */
export const AUTO_EXECUTE_THRESHOLD = 0.9;
