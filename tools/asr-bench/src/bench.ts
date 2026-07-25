/**
 * bench.ts — the runner. Every clip x every condition.
 *
 *   npm run bench            real clips, real API calls, cached
 *   npm run bench:dry        canned transcripts, zero API calls
 *   npm run bench -- --conditions v2-batch-keyterms,v2-realtime-packed
 *   npm run bench -- --keep-audio
 *
 * Resumability is a hard requirement: every response is cached under
 * results/raw/ keyed by hash(audio + condition + options), so a crash or a Ctrl-C
 * costs nothing on rerun and partial results still produce a report.
 */

import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO, CONDITIONS, KEYTERM_BUDGETS, AUTO_EXECUTE_THRESHOLD } from './config.ts';
import type { Condition, ConditionId } from './config.ts';
import { apiKey } from './env.ts';
import { loadRaw, parseClipPath } from './audio.ts';
import type { Clip } from './audio.ts';
import { Resolver, normalize } from './resolver.ts';
import type { PoolEntry } from './resolver.ts';
import { packBoth } from './keyterms.ts';
import type { PackResult } from './keyterms.ts';
import { transcribeBatch } from './scribe/batch.ts';
import { transcribeRealtime } from './scribe/realtime.ts';
import { cacheKey, readCache, writeCache } from './cache.ts';
import { cannedTranscript, cannedLatencyMs } from './dryrun.ts';
import { computeCost } from './scribe/cost.ts';
import { renderReport } from './report.ts';
import type { TrialOutcome, Trial } from './types.ts';

// ------------------------------------------------------------------------ args

type Args = {
  dryRun: boolean;
  keepAudio: boolean;
  conditions: ConditionId[];
  clipsDir: string;
  limit: number | null;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] ? argv[i + 1]! : null;
  };

  const requested = get('--conditions')?.split(',').map((s) => s.trim()).filter(Boolean);
  if (requested) {
    const valid = new Set(CONDITIONS.map((c) => c.id as string));
    for (const r of requested) {
      if (!valid.has(r)) {
        throw new Error(`Unknown condition "${r}". Valid: ${[...valid].join(', ')}`);
      }
    }
  }

  const limitRaw = get('--limit');

  return {
    dryRun: argv.includes('--dry-run'),
    keepAudio: argv.includes('--keep-audio'),
    conditions: (requested as ConditionId[]) ?? CONDITIONS.map((c) => c.id),
    clipsDir: get('--clips') ?? resolve(REPO, 'clips'),
    limit: limitRaw ? Number.parseInt(limitRaw, 10) : null,
  };
}

// ------------------------------------------------------------------- test data

type TestCard = {
  canonicalName: string;
  category: string;
  spokenForms: string[];
  collidesWith?: string;
};

function loadTestset(): TestCard[] {
  const raw = JSON.parse(readFileSync(resolve(REPO, 'data/testset.json'), 'utf8'));
  return raw.cards as TestCard[];
}

function loadDecoys(): string[] {
  const raw = JSON.parse(readFileSync(resolve(REPO, 'data/decoys.json'), 'utf8'));
  const out = new Set<string>();
  for (const list of Object.values(raw.confusableWith as Record<string, string[]>)) {
    for (const name of list) out.add(name);
  }
  for (const name of raw.generalPool as string[]) out.add(name);
  return [...out];
}

/**
 * The candidate pool the resolver searches.
 *
 * Test cards are `decklist` tier (weight 1.0) — they are the deck being played.
 * Decoys are `all` tier (0.90): present and competing, but correctly treated as
 * less likely than a card in your own deck. Without the decoys in the pool the
 * card-collision category would be untestable.
 */
function buildPool(testset: TestCard[], decoys: string[]): PoolEntry[] {
  const pool: PoolEntry[] = testset.map((c) => ({ name: c.canonicalName, tier: 'decklist' }));
  const inDeck = new Set(testset.map((c) => normalize(c.canonicalName).full));
  for (const name of decoys) {
    if (!inDeck.has(normalize(name).full)) pool.push({ name, tier: 'all' });
  }
  return pool;
}

// ---------------------------------------------------------------------- clips

/** Clips discovered on disk, or synthesized rows for the dry run. */
function discoverClips(dir: string): Clip[] {
  if (!existsSync(dir)) return [];

  const out: Clip[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = resolve(d, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!['.webm', '.wav', '.mp3', '.m4a', '.ogg'].includes(extname(entry.name))) continue;

      const clip = parseClipPath(p);
      if (clip) out.push(clip);
      else console.warn(`  ! skipping ${entry.name} — does not match {speaker}__{cardSlug}__{condition}__{take}`);
    }
  };
  walk(dir);
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function slugify(name: string): string {
  return normalize(name).full.replace(/\s+/g, '-');
}

// ------------------------------------------------------------------ concurrency

/** Bounded parallelism. Keeps us under rate limits without a dependency. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  });

  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------- runner

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const testset = loadTestset();
  const decoys = loadDecoys();
  const pool = buildPool(testset, decoys);
  const resolver = new Resolver(pool);

  // The "decklist" we pack keyterms for is the test set. In production this would
  // be the player's actual 100-card deck; here it is the 50 cards we measure.
  const decklist = testset.map((c) => c.canonicalName);
  const packs = packBoth(decklist);

  const keytermSlots: Record<'batch' | 'realtime', Set<string>> = {
    batch: new Set(packs.batch.picks.map((p) => p.card)),
    realtime: new Set(packs.realtime.picks.map((p) => p.card)),
  };

  const activeConditions = CONDITIONS.filter((c) => args.conditions.includes(c.id));

  console.log('\nBoardState ASR benchmark');
  console.log('========================');
  console.log(`mode:        ${args.dryRun ? 'DRY RUN (no API calls)' : 'LIVE'}`);
  console.log(`pool:        ${resolver.size} cards (${testset.length} in deck, ${decoys.length} decoys)`);
  console.log(`conditions:  ${activeConditions.map((c) => c.id).join(', ')}`);
  console.log(
    `keyterms:    batch ${packs.batch.stats.slotsUsed}/${KEYTERM_BUDGETS.batch.count} ` +
      `(${packs.batch.stats.coveragePct.toFixed(0)}% of deck), ` +
      `realtime ${packs.realtime.stats.slotsUsed}/${KEYTERM_BUDGETS.realtime.count} ` +
      `(${packs.realtime.stats.coveragePct.toFixed(0)}% of deck)`,
  );

  // ---------------------------------------------------------------- build trials

  const bySlug = new Map<string, TestCard>();
  for (const card of testset) bySlug.set(slugify(card.canonicalName), card);

  let trials: Trial[] = [];

  if (args.dryRun) {
    // One trial per spoken form — no audio needed.
    for (const card of testset) {
      for (const [i, form] of card.spokenForms.entries()) {
        trials.push({
          clipId: `dry__${slugify(card.canonicalName)}__quiet__${i + 1}`,
          clipPath: '(dry-run)',
          conditionId: 'v1-cold',
          expectedCard: card.canonicalName,
          category: card.category,
          speaker: 'dry',
          recordingCondition: 'quiet',
          take: String(i + 1),
          spokenForm: form,
        });
      }
    }
  } else {
    const clips = discoverClips(args.clipsDir);
    if (clips.length === 0) {
      console.error(
        `\nNo clips found under ${args.clipsDir}.\n` +
          '  Record some per RECORDING.md, or run `npm run bench:dry` for the zero-cost path.',
      );
      process.exit(1);
    }
    console.log(`clips:       ${clips.length}`);

    for (const clip of clips) {
      const card = bySlug.get(clip.cardSlug);
      if (!card) {
        console.warn(`  ! ${clip.id}: cardSlug "${clip.cardSlug}" is not in testset.json — skipping`);
        continue;
      }
      trials.push({
        clipId: clip.id,
        clipPath: clip.path,
        conditionId: 'v1-cold',
        expectedCard: card.canonicalName,
        category: card.category,
        speaker: clip.speaker,
        recordingCondition: clip.recordingCondition,
        take: clip.take,
      });
    }

    if (!apiKey()) {
      console.error('\nELEVENLABS_API_KEY is not set. Set it, or use `npm run bench:dry`.');
      process.exit(1);
    }
  }

  if (args.limit) trials = trials.slice(0, args.limit);

  // Cross with conditions.
  const work: Trial[] = [];
  for (const trial of trials) {
    for (const condition of activeConditions) {
      work.push({ ...trial, conditionId: condition.id });
    }
  }

  console.log(`trials:      ${work.length} (${trials.length} clips x ${activeConditions.length} conditions)\n`);

  // -------------------------------------------------------------------- execute

  let done = 0;
  let failed = 0;
  let cacheHits = 0;

  const outcomes = await mapLimit(work, args.dryRun ? 16 : 4, async (trial) => {
    const condition = CONDITIONS.find((c) => c.id === trial.conditionId)!;
    const budgetKey = condition.keyterms === 'none' ? null : condition.keyterms;
    const hadKeytermSlot = budgetKey ? keytermSlots[budgetKey].has(trial.expectedCard) : false;

    let outcome: TrialOutcome;
    try {
      outcome = await runTrial(trial, condition, {
        dryRun: args.dryRun,
        keepAudio: args.keepAudio,
        packs,
        hadKeytermSlot,
        resolver,
      });
      if (outcome.cached) cacheHits++;
      if (outcome.error) failed++;
    } catch (err) {
      // Graceful partial results: one bad trial must not void the run.
      failed++;
      outcome = {
        ...trial,
        transcript: '',
        latencyMs: 0,
        costUsd: 0,
        audioSeconds: 0,
        cached: false,
        error: (err as Error).message,
        resolvedCard: null,
        resolvedScore: 0,
        resolvedSignal: 'error',
        confidence: 0,
        runnerUps: [],
        top1Correct: false,
        top3Correct: false,
        falseConfident: false,
        hadKeytermSlot,
      };
    }

    done++;
    if (done % 25 === 0 || done === work.length) {
      process.stdout.write(`  ${done}/${work.length} trials (${cacheHits} cached, ${failed} failed)\r`);
    }
    return outcome;
  });

  console.log(`\n  ${done} trials complete — ${cacheHits} from cache, ${failed} failed\n`);

  // --------------------------------------------------------------------- output

  mkdirSync(resolve(REPO, 'results'), { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    poolSize: resolver.size,
    conditions: activeConditions.map((c) => ({ ...c })),
    keytermPacks: {
      batch: summarizePack(packs.batch),
      realtime: summarizePack(packs.realtime),
    },
    outcomes,
  };

  writeFileSync(resolve(REPO, 'results/raw.json'), JSON.stringify(payload, null, 2));

  const markdown = renderReport({
    outcomes,
    conditions: activeConditions,
    packs,
    dryRun: args.dryRun,
    poolSize: resolver.size,
    testset,
  });

  writeFileSync(resolve(REPO, 'results/report.md'), markdown);
  console.log(markdown);
  console.log('\nWrote results/report.md and results/raw.json');

  if (args.dryRun) {
    console.log(
      '\nDRY RUN — the accuracy numbers above come from data/canned.json, not from\n' +
        'Scribe. They validate the pipeline, resolver, and packer. Do not quote them\n' +
        'as vendor results.',
    );
  }
}

function summarizePack(p: PackResult) {
  return {
    budget: p.budget,
    stats: p.stats,
    terms: p.terms,
    picks: p.picks,
    droppedTop20: p.dropped.slice(0, 20),
  };
}

// ------------------------------------------------------------------- one trial

async function runTrial(
  trial: Trial,
  condition: Condition,
  ctx: {
    dryRun: boolean;
    keepAudio: boolean;
    packs: { batch: PackResult; realtime: PackResult };
    hadKeytermSlot: boolean;
    resolver: Resolver;
  },
): Promise<TrialOutcome> {
  const keyterms =
    condition.keyterms === 'none' ? null : ctx.packs[condition.keyterms].terms;

  let transcript: string;
  let latencyMs: number;
  let costUsd: number;
  let audioSeconds: number;
  let cached = false;
  let connectMs: number | undefined;
  let partialCount: number | undefined;
  let error: string | undefined;

  if (ctx.dryRun) {
    transcript = cannedTranscript(
      trial.expectedCard,
      trial.spokenForm ?? trial.expectedCard,
      condition,
      ctx.hadKeytermSlot,
    );
    latencyMs = cannedLatencyMs(condition);
    audioSeconds = 2.5;
    costUsd = computeCost(condition.model, audioSeconds, keyterms?.length ?? 0).costUsd;
  } else {
    let audio: Buffer | null = await loadRaw(trial.clipPath);
    const key = cacheKey(audio, condition.id, { keyterms, noVerbatim: condition.noVerbatim });

    const hit = readCache(key);
    if (hit) {
      cached = true;
      transcript = hit.text;
      latencyMs = hit.latencyMs;
      costUsd = hit.costUsd;
      audioSeconds = hit.audioSeconds;
      connectMs = hit.connectMs;
      partialCount = hit.partialCount;
    } else {
      try {
        const result =
          condition.endpoint === 'realtime'
            ? await transcribeRealtime(audio, trial.clipPath, condition.model, {
                keyterms,
                noVerbatim: condition.noVerbatim,
              })
            : await transcribeBatch(audio, trial.clipPath, condition.model, {
                keyterms,
                noVerbatim: condition.noVerbatim,
              });

        transcript = result.text;
        latencyMs = result.latencyMs;
        costUsd = result.costUsd;
        audioSeconds = result.audioSeconds;
        connectMs = result.connectMs;
        partialCount = result.partialCount;

        writeCache(key, result, {
          clipId: trial.clipId,
          conditionId: condition.id,
          model: condition.model,
          keytermCount: keyterms?.length ?? 0,
          noVerbatim: condition.noVerbatim,
          expectedCard: trial.expectedCard,
        });
      } catch (err) {
        error = (err as Error).message;
        transcript = '';
        latencyMs = 0;
        costUsd = 0;
        audioSeconds = 0;
      }
    }

    // Audio is discarded after transcription unless --keep-audio, per constraints.
    // The clip file on disk is the user's own recording and is never touched; this
    // drops our in-memory copy so long runs do not accumulate buffers.
    if (!ctx.keepAudio) audio = null;
    void audio;
  }

  // ---- resolution layer: identical for every condition ----
  const resolution = ctx.resolver.resolve(transcript);
  const expected = normalize(trial.expectedCard).full;

  const top1Correct = resolution.top ? normalize(resolution.top.name).full === expected : false;
  const top3 = [resolution.top, ...resolution.runners].filter(Boolean).slice(0, 3);
  const top3Correct = top3.some((c) => normalize(c!.name).full === expected);

  return {
    ...trial,
    conditionId: condition.id,
    transcript,
    latencyMs,
    costUsd,
    audioSeconds,
    connectMs,
    partialCount,
    error,
    cached,
    resolvedCard: resolution.top?.name ?? null,
    resolvedScore: resolution.top?.score ?? 0,
    resolvedSignal: resolution.top?.signal ?? 'none',
    confidence: resolution.confidence,
    runnerUps: resolution.runners.map((r) => ({ name: r.name, score: r.score })),
    top1Correct,
    top3Correct,
    falseConfident: resolution.confidence > AUTO_EXECUTE_THRESHOLD && !top1Correct,
    hadKeytermSlot: ctx.hadKeytermSlot,
  };
}

await main();
