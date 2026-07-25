/**
 * Batch adapter — POST /v1/speech-to-text.
 *
 * Maps to BoardState's "end-of-turn narration" design: the player talks, we
 * transcribe the whole turn at once, latency is allowed to be seconds.
 *
 * Keyterms go in as repeated multipart fields. Up to 1000 x 50 chars, which fits
 * an entire Commander deck plus nicknames.
 */

import { API, RUN, KEYTERM_BUDGETS, KEYTERM_RULES } from '../config.ts';
import { requireApiKey } from '../env.ts';
import { probeDurationSeconds } from '../audio.ts';
import { computeCost } from './cost.ts';
import type { TranscribeResult, TranscribeOptions } from '../types.ts';

/** Fail loudly on a budget violation rather than paying for a rejected request. */
function assertBudget(keyterms: string[]): void {
  const { count, maxChars } = KEYTERM_BUDGETS.batch;
  if (keyterms.length > count) {
    throw new Error(`Batch accepts at most ${count} keyterms; got ${keyterms.length}.`);
  }
  for (const t of keyterms) {
    if (t.length > maxChars) {
      throw new Error(`Keyterm "${t}" is ${t.length} chars; batch limit is ${maxChars}.`);
    }
    if (t.trim().split(/\s+/).length > KEYTERM_RULES.maxWords) {
      throw new Error(`Keyterm "${t}" exceeds ${KEYTERM_RULES.maxWords} words.`);
    }
    for (const c of KEYTERM_RULES.forbiddenChars) {
      if (t.includes(c)) throw new Error(`Keyterm "${t}" contains unsupported character "${c}".`);
    }
  }
}

export async function transcribeBatch(
  audio: Buffer,
  clipPath: string,
  model: string,
  options: TranscribeOptions,
): Promise<TranscribeResult> {
  const keyterms = options.keyterms ?? [];
  if (keyterms.length) assertBudget(keyterms);

  const audioSeconds = await probeDurationSeconds(clipPath);

  const form = new FormData();
  form.append('model_id', model);
  form.append(
    'file',
    new Blob([new Uint8Array(audio)], { type: 'application/octet-stream' }),
    clipPath.split('/').pop() ?? 'clip.webm',
  );
  form.append('language_code', options.languageCode ?? 'en');
  // Off: audio-event tags like "(laughter)" are noise we would have to strip
  // before resolving, and they are not part of what we are measuring.
  form.append('tag_audio_events', 'false');
  form.append('diarize', 'false');

  // scribe_v1 supports neither no_verbatim nor keyterms. Sending them would make
  // the control condition fail rather than act as a control.
  const isV2 = model !== 'scribe_v1';
  if (isV2 && options.noVerbatim) form.append('no_verbatim', 'true');
  if (isV2) for (const t of keyterms) form.append('keyterms', t);

  const started = performance.now();

  const res = await fetchWithRetry(`${API.restBase}/v1/speech-to-text`, {
    method: 'POST',
    headers: { 'xi-api-key': requireApiKey() },
    body: form,
  });

  const latencyMs = performance.now() - started;
  const raw = await res.json();

  const cost = computeCost(model, audioSeconds, keyterms.length);

  return {
    text: String(raw?.text ?? '').trim(),
    latencyMs,
    costUsd: cost.costUsd,
    audioSeconds,
    raw,
  };
}

/** Marks an error the caller must not retry, so the catch below can re-throw it. */
class PermanentError extends Error {}

/**
 * Retry with exponential backoff and jitter. Retries 429 and 5xx; a 4xx other
 * than 429 is a request bug (bad key, malformed keyterm) and retrying it just
 * burns quota and wall time, so it fails fast.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RUN.maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = RUN.baseBackoffMs * 2 ** (attempt - 1);
      await sleep(backoff + Math.random() * 250);
    }

    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(RUN.requestTimeoutMs),
      });

      if (res.ok) return res;

      const body = await res.text();
      const message = `HTTP ${res.status}: ${body.slice(0, 300)}`;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable) throw new PermanentError(message);
      lastError = new Error(message);
    } catch (err) {
      // A permanent failure must escape the retry loop rather than be swallowed
      // by this catch and tried again.
      if (err instanceof PermanentError) throw err;
      lastError = err as Error;
      // AbortError and network failures are worth another attempt.
      if (attempt === RUN.maxRetries) break;
    }
  }

  throw lastError ?? new Error('Request failed with no error recorded');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
