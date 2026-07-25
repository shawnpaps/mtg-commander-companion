/**
 * Audio loading and conversion.
 *
 * Batch takes the container file as-is (webm/opus is fine). Realtime wants raw
 * PCM frames, so we decode via ffmpeg. That is the only external binary this
 * harness needs, and only for the realtime conditions.
 *
 * Per the constraints, decoded audio is held in memory and dropped after
 * transcription unless --keep-audio is passed. Nothing is written to disk by
 * this module.
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const REALTIME_SAMPLE_RATE = 16000;

export type Clip = {
  path: string;
  /** Basename without extension — the cache key component and report label. */
  id: string;
  speaker: string;
  cardSlug: string;
  /** "quiet" | "noise" from the filename. */
  recordingCondition: string;
  take: string;
};

/**
 * Filenames follow RECORDING.md: {speaker}__{cardSlug}__{condition}__{take}.webm
 * A clip that does not parse is skipped loudly rather than silently mis-attributed.
 */
export function parseClipPath(path: string): Clip | null {
  const id = basename(path).replace(/\.[^.]+$/, '');
  const parts = id.split('__');
  if (parts.length !== 4) return null;

  const [speaker, cardSlug, recordingCondition, take] = parts;
  if (!speaker || !cardSlug || !recordingCondition || !take) return null;

  return { path, id, speaker, cardSlug, recordingCondition, take };
}

/** Raw container bytes, for the batch endpoint. */
export async function loadRaw(path: string): Promise<Buffer> {
  return readFile(path);
}

/**
 * Decode to signed 16-bit little-endian mono PCM at 16kHz, for realtime.
 * `-` writes to stdout; we set maxBuffer high because a 30s clip is ~1MB and
 * the default 1MB ceiling would truncate it.
 */
export async function decodeToPcm16(path: string): Promise<Buffer> {
  try {
    const { stdout } = await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner', '-loglevel', 'error',
        '-i', path,
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ac', '1',
        '-ar', String(REALTIME_SAMPLE_RATE),
        '-',
      ],
      { maxBuffer: 64 * 1024 * 1024, encoding: 'buffer' },
    );
    if (!stdout.length) throw new Error('ffmpeg produced no audio');
    return stdout;
  } catch (err) {
    const msg = (err as any).stderr?.toString?.() ?? (err as Error).message;
    throw new Error(
      `ffmpeg failed to decode ${basename(path)}: ${msg}\n` +
        '  Realtime conditions need ffmpeg on PATH (brew install ffmpeg).',
    );
  }
}

/**
 * Split PCM into ~duration-sized chunks so realtime streaming approximates a
 * live microphone rather than one giant dump. Chunk size matters for the
 * latency measurement: a single blob would understate time-to-final.
 */
export function chunkPcm(pcm: Buffer, msPerChunk = 100): Buffer[] {
  const bytesPerChunk = Math.floor((REALTIME_SAMPLE_RATE * 2 * msPerChunk) / 1000);
  const chunks: Buffer[] = [];
  for (let off = 0; off < pcm.length; off += bytesPerChunk) {
    chunks.push(pcm.subarray(off, Math.min(off + bytesPerChunk, pcm.length)));
  }
  return chunks;
}

/** Duration in seconds, used for cost math. */
export function pcmDurationSeconds(pcm: Buffer): number {
  return pcm.length / (REALTIME_SAMPLE_RATE * 2);
}

/** Duration of any container, via ffprobe. Falls back to 0 if unavailable. */
export async function probeDurationSeconds(path: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      path,
    ]);
    const n = Number.parseFloat(stdout.trim());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

// ------------------------------------------------------- synthetic probe audio

/**
 * ~1 second of silence as a valid WAV. Used only by probe.ts: it needs the
 * cheapest possible payload that clears the documented 100ms minimum, because
 * it is testing parameter acceptance, not transcription.
 */
export function silentWavBuffer(seconds = 1): Buffer {
  const sampleRate = REALTIME_SAMPLE_RATE;
  const samples = sampleRate * seconds;
  const dataBytes = samples * 2;
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);          // fmt chunk size
  buf.writeUInt16LE(1, 20);           // PCM
  buf.writeUInt16LE(1, 22);           // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);           // block align
  buf.writeUInt16LE(16, 34);          // bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  // Sample data stays zeroed — silence.
  return buf;
}

/** Raw PCM silence, base64'd, for the realtime probe (no WAV header wanted). */
export function silentWavBase64(seconds = 1): string {
  return Buffer.alloc(REALTIME_SAMPLE_RATE * 2 * seconds).toString('base64');
}
