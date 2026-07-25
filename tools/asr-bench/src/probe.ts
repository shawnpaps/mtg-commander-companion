/**
 * probe.ts — VERIFY BEFORE BUILDING.
 *
 * ElevenLabs docs and LiveKit docs disagree about whether keyterms work on the
 * realtime endpoint. This script settles it with real calls instead of reading.
 *
 * It makes the smallest possible number of billable requests (4 short clips'
 * worth, ~1s each) and prints exactly what each endpoint accepted or rejected:
 *
 *   1. batch  scribe_v2          + keyterms      -> expect 200
 *   2. batch  scribe_v1          + keyterms      -> expect rejection or silent ignore
 *   3. rt     scribe_v2_realtime + keyterms      -> THE CONTESTED CASE
 *   4. rt     scribe_v2_realtime + 51 keyterms   -> probe the actual count ceiling
 *   5. rt     scribe_v2_realtime + 21-char term  -> probe the actual char ceiling
 *
 * Run:  npm run probe
 * Needs ELEVENLABS_API_KEY. Writes results/probe.json for the record.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO, API, MODELS, KEYTERM_BUDGETS } from './config.ts';
import { requireApiKey } from './env.ts';
import { silentWavBase64, silentWavBuffer } from './audio.ts';

type ProbeResult = {
  name: string;
  endpoint: 'batch' | 'realtime';
  model: string;
  keytermCount: number;
  maxTermChars: number;
  ok: boolean;
  httpStatus?: number;
  /** Did the endpoint acknowledge the keyterms, reject them, or stay silent? */
  keytermVerdict: 'accepted' | 'rejected' | 'ignored-silently' | 'unknown';
  transcript?: string;
  errorType?: string;
  errorBody?: string;
  notes: string;
};

const results: ProbeResult[] = [];

function record(r: ProbeResult) {
  results.push(r);
  const mark = r.ok ? '  ok  ' : ' FAIL ';
  console.log(`[${mark}] ${r.name}`);
  console.log(`         model=${r.model} keyterms=${r.keytermCount} maxChars=${r.maxTermChars}`);
  console.log(`         keyterms: ${r.keytermVerdict}`);
  if (r.httpStatus) console.log(`         http: ${r.httpStatus}`);
  if (r.transcript !== undefined) console.log(`         transcript: ${JSON.stringify(r.transcript)}`);
  if (r.errorType) console.log(`         errorType: ${r.errorType}`);
  if (r.errorBody) console.log(`         body: ${r.errorBody.slice(0, 400)}`);
  console.log(`         -> ${r.notes}\n`);
}

/** A handful of real card names, so a success is at least weakly meaningful. */
const SAMPLE_KEYTERMS = ['Kozilek', 'Prossh', 'Zedruu', 'Najeela', 'Thoracle'];

function padTerms(n: number, chars: number): string[] {
  // Distinct, alphabetic, exactly `chars` long. Avoids the documented
  // unsupported characters (< > { } [ ] \) entirely.
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const tag = `T${i}`;
    out.push((tag + 'x'.repeat(Math.max(0, chars - tag.length))).slice(0, chars));
  }
  return out;
}

// ---------------------------------------------------------------- batch probe

async function probeBatch(
  name: string,
  model: string,
  keyterms: string[] | null,
  extra: Record<string, string> = {},
): Promise<void> {
  const form = new FormData();
  form.append('model_id', model);
  form.append('file', new Blob([new Uint8Array(silentWavBuffer())], { type: 'audio/wav' }), 'probe.wav');
  form.append('language_code', 'en');
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  // Batch takes keyterms as repeated multipart fields.
  if (keyterms) for (const t of keyterms) form.append('keyterms', t);

  const maxChars = keyterms?.reduce((m, t) => Math.max(m, t.length), 0) ?? 0;

  try {
    const res = await fetch(`${API.restBase}/v1/speech-to-text`, {
      method: 'POST',
      headers: { 'xi-api-key': requireApiKey() },
      body: form,
    });
    const raw = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { /* non-JSON error page */ }

    record({
      name,
      endpoint: 'batch',
      model,
      keytermCount: keyterms?.length ?? 0,
      maxTermChars: maxChars,
      ok: res.ok,
      httpStatus: res.status,
      keytermVerdict: !keyterms
        ? 'unknown'
        : res.ok
          ? 'accepted'
          : /keyterm/i.test(raw) ? 'rejected' : 'unknown',
      transcript: res.ok ? (parsed?.text ?? '') : undefined,
      errorBody: res.ok ? undefined : raw,
      notes: res.ok
        ? `HTTP 200 with ${keyterms?.length ?? 0} keyterms — endpoint accepts this combination.`
        : `Rejected. If the body names "keyterms", the parameter is unsupported for ${model}.`,
    });
  } catch (err) {
    record({
      name, endpoint: 'batch', model,
      keytermCount: keyterms?.length ?? 0, maxTermChars: maxChars,
      ok: false, keytermVerdict: 'unknown',
      errorType: (err as Error).name,
      errorBody: (err as Error).message,
      notes: 'Transport-level failure — not an API verdict. Check network/key.',
    });
  }
}

// ------------------------------------------------------------- realtime probe

/**
 * Opens the WebSocket, sends ~1s of silence, commits, and waits for a terminal
 * message. The point is not the transcript — it is whether the server accepts
 * the connection at all with keyterms in the query string.
 */
async function probeRealtime(
  name: string,
  keyterms: string[] | null,
  expectFailure: boolean,
): Promise<void> {
  const maxChars = keyterms?.reduce((m, t) => Math.max(m, t.length), 0) ?? 0;
  const qs = new URLSearchParams({
    model_id: MODELS.realtime,
    audio_format: 'pcm_16000',
    language_code: 'en',
    commit_strategy: 'manual',
  });
  // Realtime takes keyterms as repeated query params.
  if (keyterms) for (const t of keyterms) qs.append('keyterms', t);

  const url = `${API.wsBase}/v1/speech-to-text/realtime?${qs.toString()}`;

  const outcome = await new Promise<Partial<ProbeResult>>((done) => {
    let settled = false;
    const finish = (p: Partial<ProbeResult>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      done(p);
    };

    const timer = setTimeout(() => finish({
      ok: false,
      keytermVerdict: 'unknown',
      errorType: 'timeout',
      notes: 'No terminal message within 20s. Inconclusive.',
    }), 20_000);

    const ws = new WebSocket(url, { headers: { 'xi-api-key': requireApiKey() } } as any);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: silentWavBase64(),
        sample_rate: 16000,
        commit: true,
      }));
    });

    ws.addEventListener('message', (ev: any) => {
      const msg = JSON.parse(String(ev.data));
      const t = msg.message_type ?? msg.type;

      if (t === 'session_started') {
        // Most valuable signal in the whole probe: the server echoes back the
        // config it actually applied. If keyterms survive the handshake, they
        // are real; if they are dropped here, they were silently ignored.
        const echoed =
          msg.keyterms ?? msg.config?.keyterms ?? msg.session_config?.keyterms ?? null;
        console.log(`         session_started echo: ${JSON.stringify(msg).slice(0, 600)}`);
        finish({
          ok: true,
          keytermVerdict: !keyterms
            ? 'unknown'
            : Array.isArray(echoed) && echoed.length > 0
              ? 'accepted'
              : echoed === null
                ? 'accepted'      // accepted the connection but does not echo config back
                : 'ignored-silently',
          notes: Array.isArray(echoed)
            ? `Handshake succeeded and server echoed ${echoed.length} keyterms.`
            : 'Handshake succeeded with keyterms in the query string; server does not echo config, so acceptance is inferred from the absence of an error.',
        });
      }

      if (t === 'error' || t === 'auth_error' || t === 'input_error') {
        finish({
          ok: false,
          errorType: t,
          errorBody: JSON.stringify(msg),
          keytermVerdict: /keyterm/i.test(JSON.stringify(msg)) ? 'rejected' : 'unknown',
          notes: expectFailure
            ? 'Rejected as hypothesised — this pins the real limit.'
            : 'Rejected. Read errorBody: if it names keyterms, realtime keyterms are unsupported.',
        });
      }
    });

    ws.addEventListener('error', () => finish({
      ok: false,
      keytermVerdict: 'unknown',
      errorType: 'ws-error',
      notes: 'WebSocket failed to open. A 4xx during upgrade usually means a rejected query param.',
    }));

    ws.addEventListener('close', (ev: any) => finish({
      ok: false,
      keytermVerdict: 'unknown',
      errorType: `close-${ev.code}`,
      errorBody: ev.reason,
      notes: `Closed before any transcript (code ${ev.code}). Close reason is the useful bit.`,
    }));
  });

  record({
    name,
    endpoint: 'realtime',
    model: MODELS.realtime,
    keytermCount: keyterms?.length ?? 0,
    maxTermChars: maxChars,
    ok: false,
    keytermVerdict: 'unknown',
    notes: '',
    ...outcome,
  } as ProbeResult);
}

// ---------------------------------------------------------------------- main

async function main() {
  requireApiKey();

  console.log('\nElevenLabs Scribe capability probe');
  console.log('==================================');
  console.log('Settles the ElevenLabs-vs-LiveKit keyterm conflict with real calls.');
  console.log(`Budgets under test: batch ${KEYTERM_BUDGETS.batch.count}/${KEYTERM_BUDGETS.batch.maxChars}ch, realtime ${KEYTERM_BUDGETS.realtime.count}/${KEYTERM_BUDGETS.realtime.maxChars}ch\n`);

  await probeBatch('1. batch scribe_v2 + 5 keyterms', MODELS.batch, SAMPLE_KEYTERMS);
  await probeBatch('2. batch scribe_v1 + 5 keyterms (expect unsupported)', MODELS.v1, SAMPLE_KEYTERMS);
  await probeRealtime('3. realtime scribe_v2_realtime + 5 keyterms  <-- THE CONTESTED CASE', SAMPLE_KEYTERMS, false);
  await probeRealtime('4. realtime + 51 keyterms (probe count ceiling)', padTerms(51, 10), true);
  await probeRealtime('5. realtime + one 21-char keyterm (probe char ceiling)', [...padTerms(1, 21)], true);

  mkdirSync(resolve(REPO, 'results'), { recursive: true });
  writeFileSync(
    resolve(REPO, 'results/probe.json'),
    JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2),
  );

  console.log('VERDICT');
  console.log('-------');
  const contested = results[2];
  if (contested?.ok) {
    console.log('Realtime ACCEPTED keyterms. ElevenLabs docs are right; LiveKit\'s');
    console.log('"batch-only" note describes their plugin, not the API. Condition');
    console.log('v2-realtime-packed is worth running.');
  } else {
    console.log('Realtime REJECTED keyterms. LiveKit is right and option (B) collapses');
    console.log('to v2-realtime-cold. Treat the packed realtime column as unavailable');
    console.log('and re-read errorBody above before drawing a conclusion.');
  }
  console.log('\nWrote results/probe.json');
}

await main();
