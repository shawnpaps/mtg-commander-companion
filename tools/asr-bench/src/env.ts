/**
 * Minimal .env reader. No dotenv dependency — this is a spike, and the format
 * we need is ten lines of parsing.
 *
 * Precedence: real process env wins over the .env file, so `ELEVENLABS_API_KEY=x
 * npm run bench` works without editing anything.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO } from './config.ts';

let loaded = false;

function loadEnvFile(): void {
  if (loaded) return;
  loaded = true;

  for (const name of ['.env', '.env.local']) {
    const path = resolve(REPO, name);
    if (!existsSync(path)) continue;

    for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function apiKey(): string | undefined {
  loadEnvFile();
  return process.env.ELEVENLABS_API_KEY?.trim() || undefined;
}

export function requireApiKey(): string {
  const key = apiKey();
  if (!key) {
    throw new Error(
      'ELEVENLABS_API_KEY is not set.\n' +
        `  Add it to ${resolve(REPO, '.env')} (see .env.example), or export it in your shell.\n` +
        '  No key is needed for `npm run bench:dry` — the dry run makes zero API calls.',
    );
  }
  return key;
}
