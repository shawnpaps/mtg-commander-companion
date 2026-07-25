/**
 * dryrun.ts — the zero-API-call path.
 *
 * Exercises the resolver and the keyterm packer against canned transcripts so we
 * can iterate on both without spending money or waiting on the network, and so CI
 * can run the harness at all.
 *
 * What a dry run DOES prove: the pipeline runs end to end, the packer's spending
 * decisions are sane, the resolver handles every category, and the report renders.
 *
 * What it does NOT prove: anything about Scribe. The transcripts are authored, so
 * the accuracy numbers measure our own fixtures. See data/canned.json.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO } from './config.ts';
import type { Condition } from './config.ts';

type Canned = {
  cold: Record<string, string>;
  v1Extra: Record<string, string>;
  noVerbatimEats: Record<string, string>;
};

let canned: Canned | null = null;

function load(): Canned {
  canned ??= JSON.parse(readFileSync(resolve(REPO, 'data/canned.json'), 'utf8')) as Canned;
  return canned;
}

/** Fillers a real disfluent utterance carries and no_verbatim would remove. */
const FILLERS = /\b(uh|um|uhh|umm|er|ah|like)\b[,]?\s*/gi;

/**
 * Simulate one condition's transcript for one card.
 *
 * `hadKeytermSlot` is supplied by the caller from the actual pack result, which
 * is what makes the dry run a real test of the packer: if the packer spends its
 * 50 realtime slots badly, dry-run accuracy drops accordingly.
 */
export function cannedTranscript(
  card: string,
  spokenForm: string,
  condition: Condition,
  hadKeytermSlot: boolean,
): string {
  const c = load();

  const cold = c.cold[card] ?? spokenForm;
  const usesKeyterms = condition.keyterms !== 'none';

  // With a keyterm slot the model is biased toward the right string, so it
  // recovers the canonical name. Without one it falls back to the cold error.
  let text = usesKeyterms && hadKeytermSlot ? card : cold;

  // scribe_v1 is the weaker model: degrade further where we have an entry.
  if (condition.model === 'scribe_v1') {
    text = c.v1Extra[card] ?? text;
  }

  // Carry the disfluency from the spoken form through, so the no_verbatim column
  // has something to actually remove.
  if (/\b(uh|um|er)\b/i.test(spokenForm) && !condition.noVerbatim) {
    text = `uh, ${text}`;
  }

  if (condition.noVerbatim) {
    text = text.replace(FILLERS, '').trim();
    // Model the downside: the filter occasionally eats a real leading word.
    const eaten = c.noVerbatimEats[card];
    if (eaten) text = eaten;
  }

  return text;
}

/** Plausible latency per condition, so the report's latency section renders. */
export function cannedLatencyMs(condition: Condition): number {
  // Deliberately coarse and clearly synthetic. Batch is seconds, realtime is
  // sub-second, and the keyterm conditions cost a little more on top.
  const base = condition.endpoint === 'realtime' ? 180 : 1400;
  const keytermPenalty = condition.keyterms !== 'none' ? (condition.endpoint === 'realtime' ? 40 : 350) : 0;
  const jitter = Math.random() * (condition.endpoint === 'realtime' ? 60 : 500);
  return base + keytermPenalty + jitter;
}
