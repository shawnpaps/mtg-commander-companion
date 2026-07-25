/**
 * Response cache. Every network call is cached and every run is resumable, per
 * the constraints — reruns of `npm run bench` cost nothing and a crash halfway
 * through loses no billable work.
 *
 * Key = hash(clip content + condition + the options that change the response).
 * Hashing the audio *bytes* rather than the path means re-recording a clip under
 * the same filename correctly invalidates its cache entry.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO } from './config.ts';
import type { TranscribeResult } from './types.ts';

const RAW_DIR = resolve(REPO, 'results/raw');

export function cacheKey(
  audio: Buffer,
  conditionId: string,
  options: { keyterms: string[] | null; noVerbatim: boolean },
): string {
  const h = createHash('sha256');
  h.update(audio);
  h.update('\0');
  h.update(conditionId);
  h.update('\0');
  h.update(String(options.noVerbatim));
  h.update('\0');
  // Sorted so an unrelated reordering of the keyterm list is a cache hit, but a
  // genuine change to which terms were sent is a miss.
  h.update(JSON.stringify([...(options.keyterms ?? [])].sort()));
  return h.digest('hex').slice(0, 32);
}

function pathFor(key: string): string {
  return resolve(RAW_DIR, `${key}.json`);
}

export function readCache(key: string): TranscribeResult | null {
  const p = pathFor(key);
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8'));
    // Never serve a cached failure — a transient 429 should not poison a rerun.
    if (parsed?.error) return null;
    return parsed as TranscribeResult;
  } catch {
    return null; // Corrupt entry: treat as a miss and let it be overwritten.
  }
}

export function writeCache(key: string, value: TranscribeResult, meta: Record<string, unknown>): void {
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(pathFor(key), JSON.stringify({ ...value, _meta: meta }, null, 2));
}
