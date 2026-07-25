/**
 * Realtime adapter — WebSocket /v1/speech-to-text/realtime.
 *
 * Maps to BoardState's per-action push-to-talk design: the player holds a button,
 * says "Sol Ring", and the card should be on the battlefield before they let go.
 *
 * LATENCY MEASUREMENT — the important part of this file.
 *
 * We report time from the FIRST AUDIO BYTE SENT to the FINAL TRANSCRIPT message.
 * Not wall time of the session. Wall time would fold in TLS + WebSocket upgrade
 * (tens to hundreds of ms) and the trailing close handshake, neither of which a
 * real client pays per utterance — a live app holds one socket open across the
 * whole game. Charging setup to every utterance would understate realtime's
 * advantage and bias the headline comparison toward batch.
 *
 * connectMs is reported separately so the cost of setup is visible, not hidden.
 *
 * Audio is streamed in ~100ms chunks in real time rather than dumped at once,
 * because a single blob lets the server transcribe faster than a live microphone
 * ever could and would produce a latency number we cannot ship against.
 */

import { API, RUN, KEYTERM_BUDGETS, KEYTERM_RULES } from '../config.ts';
import { requireApiKey } from '../env.ts';
import { chunkPcm, decodeToPcm16, pcmDurationSeconds, REALTIME_SAMPLE_RATE } from '../audio.ts';
import { computeCost } from './cost.ts';
import type { TranscribeResult, TranscribeOptions } from '../types.ts';

function assertBudget(keyterms: string[]): void {
  const { count, maxChars } = KEYTERM_BUDGETS.realtime;
  if (keyterms.length > count) {
    throw new Error(
      `Realtime accepts at most ${count} keyterms; got ${keyterms.length}. ` +
        'Pack them with keyterms.pack() before calling.',
    );
  }
  for (const t of keyterms) {
    if (t.length > maxChars) {
      throw new Error(`Keyterm "${t}" is ${t.length} chars; realtime limit is ${maxChars}.`);
    }
    if (t.trim().split(/\s+/).length > KEYTERM_RULES.maxWords) {
      throw new Error(`Keyterm "${t}" exceeds ${KEYTERM_RULES.maxWords} words.`);
    }
    for (const c of KEYTERM_RULES.forbiddenChars) {
      if (t.includes(c)) throw new Error(`Keyterm "${t}" contains unsupported character "${c}".`);
    }
  }
}

/** Chunk pacing. Real time, so the server sees a plausible live stream. */
const CHUNK_MS = 100;

export async function transcribeRealtime(
  _audio: Buffer,
  clipPath: string,
  model: string,
  options: TranscribeOptions,
): Promise<TranscribeResult> {
  const keyterms = options.keyterms ?? [];
  if (keyterms.length) assertBudget(keyterms);

  // Realtime wants raw PCM frames, not a webm container.
  const pcm = await decodeToPcm16(clipPath);
  const audioSeconds = pcmDurationSeconds(pcm);
  const chunks = chunkPcm(pcm, CHUNK_MS);

  const qs = new URLSearchParams({
    model_id: model,
    audio_format: `pcm_${REALTIME_SAMPLE_RATE}`,
    language_code: options.languageCode ?? 'en',
    // Manual commit: we know exactly where the utterance ends, so we should not
    // let VAD silence-detection add its own delay to our latency measurement.
    commit_strategy: 'manual',
  });
  if (options.noVerbatim) qs.set('no_verbatim', 'true');
  for (const t of keyterms) qs.append('keyterms', t);

  const url = `${API.wsBase}/v1/speech-to-text/realtime?${qs.toString()}`;

  return await new Promise<TranscribeResult>((resolvePromise, rejectPromise) => {
    const openedAt = performance.now();
    let connectMs = 0;
    let firstAudioSentAt = 0;
    let partialCount = 0;
    let latestPartial = '';
    let settled = false;
    const messages: unknown[] = [];

    const ws = new WebSocket(url, { headers: { 'xi-api-key': requireApiKey() } } as any);

    const timer = setTimeout(() => {
      // Partial-results-are-better-than-nothing: if we never saw a final but did
      // see partials, return the last partial and flag it. Graceful degradation
      // matters here because a hung socket should not void the whole run.
      finish(
        latestPartial
          ? { text: latestPartial, note: 'timeout — returning last partial' }
          : null,
        latestPartial ? undefined : new Error('Realtime timed out with no transcript'),
      );
    }, RUN.realtimeTimeoutMs);

    function finish(result: { text: string; note?: string } | null, err?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closing */ }

      if (err || !result) {
        rejectPromise(err ?? new Error('Realtime produced no transcript'));
        return;
      }

      const latencyMs = performance.now() - firstAudioSentAt;
      const cost = computeCost(model, audioSeconds, keyterms.length);

      resolvePromise({
        text: result.text.trim(),
        latencyMs,
        costUsd: cost.costUsd,
        audioSeconds,
        connectMs,
        partialCount,
        raw: { messages, note: result.note },
      });
    }

    ws.addEventListener('open', () => {
      connectMs = performance.now() - openedAt;
      void streamAudio();
    });

    async function streamAudio() {
      try {
        for (let i = 0; i < chunks.length; i++) {
          if (settled) return;
          const isLast = i === chunks.length - 1;

          if (i === 0) firstAudioSentAt = performance.now();

          ws.send(JSON.stringify({
            message_type: 'input_audio_chunk',
            audio_base_64: chunks[i]!.toString('base64'),
            sample_rate: REALTIME_SAMPLE_RATE,
            // Commit on the final chunk to force a final transcript immediately.
            commit: isLast,
          }));

          if (!isLast) await sleep(CHUNK_MS);
        }
      } catch (err) {
        finish(null, err as Error);
      }
    }

    ws.addEventListener('message', (ev: any) => {
      let msg: any;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      messages.push(msg);

      const type = msg.message_type ?? msg.type;
      const text = msg.text ?? msg.transcript ?? '';

      switch (type) {
        case 'partial_transcript':
          partialCount++;
          if (text) latestPartial = text;
          break;

        // Any of these is a committed result. `final_transcript` is the one we
        // expect from a manual commit; the others are accepted so a server-side
        // naming change degrades to a correct answer instead of a timeout.
        case 'final_transcript':
        case 'final_transcript_with_timestamps':
        case 'committed_transcript':
        case 'committed_transcript_with_timestamps':
          finish({ text: text || latestPartial });
          break;

        case 'error':
        case 'auth_error':
        case 'input_error':
        case 'quota_exceeded':
        case 'rate_limited':
          finish(null, new Error(`Realtime ${type}: ${JSON.stringify(msg).slice(0, 300)}`));
          break;
      }
    });

    ws.addEventListener('error', () => {
      finish(null, new Error('Realtime WebSocket error — check key and query params'));
    });

    ws.addEventListener('close', (ev: any) => {
      if (settled) return;
      finish(
        latestPartial ? { text: latestPartial, note: `closed ${ev.code}, using last partial` } : null,
        latestPartial ? undefined : new Error(`Realtime closed ${ev.code}: ${ev.reason || 'no reason'}`),
      );
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
