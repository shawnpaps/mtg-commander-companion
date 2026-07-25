/**
 * report.ts — scoring and markdown output.
 *
 * The ordering of sections is the argument this benchmark is making. WER is last
 * and labelled a diagnostic, because a transcript can be word-perfect and still
 * resolve to the wrong card, and a transcript can be garbage and still resolve
 * correctly. The decision we are making lives at the resolution layer.
 *
 * FALSE-CONFIDENT RATE is first, because it is the one number that decides
 * whether voice-casting can auto-execute or must always show a confirm step.
 */

import { AUTO_EXECUTE_THRESHOLD, GAME_MODEL, PRICING } from './config.ts';
import type { Condition } from './config.ts';
import type { PackResult } from './keyterms.ts';
import { normalize } from './resolver.ts';
import { computeCost } from './scribe/cost.ts';
import type { TrialOutcome } from './types.ts';

/** Would the documented keyterm minimum inflate a clip of this length? */
function computeCostMinimumApplies(keytermCount: number, seconds: number): boolean {
  return computeCost('scribe_v2', seconds, keytermCount).minimumApplied;
}

type ReportInput = {
  outcomes: TrialOutcome[];
  conditions: readonly Condition[];
  packs: { batch: PackResult; realtime: PackResult };
  dryRun: boolean;
  poolSize: number;
  testset: { canonicalName: string; category: string; spokenForms: string[] }[];
};

// ------------------------------------------------------------------ statistics

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`;
}

function usd(n: number): string {
  return n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(4)}`;
}

/**
 * Word error rate via token-level Levenshtein. Secondary diagnostic only —
 * useful for spotting a condition that is mangling audio wholesale, useless for
 * deciding between conditions that both resolve correctly.
 */
export function wordErrorRate(reference: string, hypothesis: string): number {
  const ref = normalize(reference).tokens;
  const hyp = normalize(hypothesis).tokens;
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;

  let prev = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i++) {
    const curr = [i];
    for (let j = 1; j <= hyp.length; j++) {
      curr[j] = Math.min(
        prev[j]! + 1,                                        // deletion
        curr[j - 1]! + 1,                                    // insertion
        prev[j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1),   // substitution
      );
    }
    prev = curr;
  }
  return prev[hyp.length]! / ref.length;
}

type ConditionStats = {
  condition: Condition;
  n: number;
  errors: number;
  top1: number;
  top3: number;
  falseConfident: number;
  /** Trials that cleared the auto-execute bar at all — the denominator that matters. */
  highConfidence: number;
  meanConfidence: number;
  wer: number;
  latencyP50: number;
  latencyP95: number;
  meanCostUsd: number;
  keytermCoveredTrials: number;
  connectP50: number;
};

function summarize(condition: Condition, rows: TrialOutcome[]): ConditionStats {
  const scored = rows.filter((r) => !r.error);
  const latencies = scored.map((r) => r.latencyMs).sort((a, b) => a - b);
  const connects = scored.map((r) => r.connectMs ?? 0).filter((n) => n > 0).sort((a, b) => a - b);

  const werValues = scored.map((r) => {
    // Reference is the spoken form when we know it, else the card name. This is
    // why WER is only a diagnostic: for nickname clips ("Thoracle") the reference
    // is not the card name, so a perfect resolution can still show high WER.
    const reference = r.spokenForm ?? r.expectedCard;
    return wordErrorRate(reference, r.transcript);
  });

  return {
    condition,
    n: scored.length,
    errors: rows.length - scored.length,
    top1: scored.filter((r) => r.top1Correct).length,
    top3: scored.filter((r) => r.top3Correct).length,
    falseConfident: scored.filter((r) => r.falseConfident).length,
    highConfidence: scored.filter((r) => r.confidence > AUTO_EXECUTE_THRESHOLD).length,
    meanConfidence: mean(scored.map((r) => r.confidence)),
    wer: mean(werValues),
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    meanCostUsd: mean(scored.map((r) => r.costUsd)),
    keytermCoveredTrials: scored.filter((r) => r.hadKeytermSlot).length,
    connectP50: percentile(connects, 50),
  };
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

// --------------------------------------------------------------------- render

export function renderReport(input: ReportInput): string {
  const { outcomes, conditions, packs, dryRun, poolSize, testset } = input;
  const L: string[] = [];

  const byCondition = new Map<string, TrialOutcome[]>();
  for (const c of conditions) byCondition.set(c.id, []);
  for (const o of outcomes) byCondition.get(o.conditionId)?.push(o);

  const stats = conditions.map((c) => summarize(c, byCondition.get(c.id) ?? []));

  L.push('# BoardState ASR Benchmark — Scribe');
  L.push('');
  L.push(`Generated ${new Date().toISOString()}`);
  L.push('');

  if (dryRun) {
    L.push('> **DRY RUN — NOT MEASUREMENTS.**');
    L.push('> Transcripts came from `data/canned.json`, not from ElevenLabs. This run');
    L.push('> validates the pipeline, the resolver, and the keyterm packer. Every accuracy,');
    L.push('> latency, and cost number below is synthetic. Do not use it to decide (A) vs (B).');
    L.push('');
  }

  const totalTrials = outcomes.length;
  const totalErrors = outcomes.filter((o) => o.error).length;
  L.push(`**Trials:** ${totalTrials} · **Candidate pool:** ${poolSize} cards · **Failed calls:** ${totalErrors}`);
  L.push('');

  if (totalErrors > 0) {
    L.push(`> ${totalErrors} trial(s) failed and are excluded from the per-condition statistics.`);
    L.push('> Partial results are reported rather than discarded; rerun to fill the gaps (cached calls are free).');
    L.push('');
  }

  // ------------------------------------------------------- 1. false-confident
  L.push('## 1. False-confident rate — the decision number');
  L.push('');
  L.push(`A trial is *false-confident* when confidence > ${AUTO_EXECUTE_THRESHOLD} **and** the top-1 card is wrong.`);
  L.push('This is the rate at which voice-casting would silently put the wrong card on the');
  L.push('battlefield. If it is not near zero, the feature must always confirm.');
  L.push('');
  L.push('| Condition | False-confident | of all trials | of high-conf trials |');
  L.push('|---|---:|---:|---:|');
  for (const s of stats) {
    L.push(
      `| \`${s.condition.id}\` | ${s.falseConfident} | ${pct(s.falseConfident, s.n)} | ${pct(s.falseConfident, s.highConfidence)} |`,
    );
  }
  L.push('');
  L.push('The third column is the one to read: it is the probability that an auto-executed');
  L.push('cast is wrong, given that we decided it was safe to auto-execute.');
  L.push('');

  const bestFc = [...stats].filter((s) => s.n > 0).sort((a, b) => a.falseConfident / (a.n || 1) - b.falseConfident / (b.n || 1))[0];
  if (bestFc) {
    L.push(`Lowest false-confident rate: \`${bestFc.condition.id}\` at ${pct(bestFc.falseConfident, bestFc.n)}.`);
    L.push('');
  }

  // ------------------------------------------------------------ 2. resolution
  L.push('## 2. Resolution accuracy (primary)');
  L.push('');
  L.push('Ground truth is the **card**, not the string.');
  L.push('');
  L.push('| Condition | n | top-1 | top-3 | mean conf | keyterm coverage |');
  L.push('|---|---:|---:|---:|---:|---:|');
  for (const s of stats) {
    const coverage = s.condition.keyterms === 'none' ? '—' : pct(s.keytermCoveredTrials, s.n);
    L.push(
      `| \`${s.condition.id}\` | ${s.n} | **${pct(s.top1, s.n)}** | ${pct(s.top3, s.n)} | ${s.meanConfidence.toFixed(3)} | ${coverage} |`,
    );
  }
  L.push('');
  L.push('top-3 is the "does the right card reach the confirm chips" number. A condition with');
  L.push('mediocre top-1 but high top-3 is still shippable behind a confirm UI; one with poor');
  L.push('top-3 is not shippable at all.');
  L.push('');

  // -------------------------------------------------------------- 3. latency
  L.push('## 3. Latency — the headline comparison');
  L.push('');
  L.push('Batch measures full request round-trip. Realtime measures **time from first audio');
  L.push('byte to final transcript**, excluding WebSocket setup, because a live client holds');
  L.push('one socket open across a game rather than reconnecting per utterance. Setup cost is');
  L.push('reported separately so it is visible, not hidden.');
  L.push('');
  L.push('| Condition | p50 | p95 | connect p50 |');
  L.push('|---|---:|---:|---:|');
  for (const s of stats) {
    L.push(
      `| \`${s.condition.id}\` | ${s.latencyP50.toFixed(0)} ms | ${s.latencyP95.toFixed(0)} ms | ${s.connectP50 ? `${s.connectP50.toFixed(0)} ms` : '—'} |`,
    );
  }
  L.push('');

  const batchKt = stats.find((s) => s.condition.id === 'v2-batch-keyterms');
  const rtPacked = stats.find((s) => s.condition.id === 'v2-realtime-packed');
  if (batchKt && rtPacked && batchKt.n > 0 && rtPacked.n > 0) {
    const accuracyLoss = (batchKt.top1 / batchKt.n - rtPacked.top1 / rtPacked.n) * 100;
    const latencyWin = batchKt.latencyP50 - rtPacked.latencyP50;
    L.push('### The (A) vs (B) trade, stated directly');
    L.push('');
    L.push(`- Realtime-packed is **${latencyWin.toFixed(0)} ms faster** at p50.`);
    L.push(
      `- Realtime-packed is **${accuracyLoss >= 0 ? `${accuracyLoss.toFixed(1)} pp less accurate` : `${Math.abs(accuracyLoss).toFixed(1)} pp MORE accurate`}** at top-1.`,
    );
    L.push(
      `- False-confident: batch ${pct(batchKt.falseConfident, batchKt.n)} vs realtime ${pct(rtPacked.falseConfident, rtPacked.n)}.`,
    );
    L.push('');
    L.push('Fill in the RESULTS section of README.md with the call and the reasoning.');
    L.push('');
  }

  // ---------------------------------------------------- 4. confidence calibration
  L.push('## 4. Confidence calibration by decile');
  L.push('');
  L.push('If confidence is well calibrated, accuracy in each decile should track the decile.');
  L.push('A high-confidence decile with low accuracy is where false-confident errors live.');
  L.push('');
  for (const s of stats) {
    const rows = (byCondition.get(s.condition.id) ?? []).filter((r) => !r.error);
    if (rows.length === 0) continue;

    L.push(`**\`${s.condition.id}\`**`);
    L.push('');
    L.push('| confidence | n | top-1 accuracy |');
    L.push('|---|---:|---:|');
    for (let d = 9; d >= 0; d--) {
      const lo = d / 10;
      const hi = (d + 1) / 10;
      const bucket = rows.filter((r) => r.confidence >= lo && (d === 9 ? r.confidence <= 1.0001 : r.confidence < hi));
      if (bucket.length === 0) continue;
      const correct = bucket.filter((r) => r.top1Correct).length;
      const flag = lo >= 0.9 && correct < bucket.length ? ' ⚠️' : '';
      L.push(`| ${lo.toFixed(1)}–${hi.toFixed(1)} | ${bucket.length} | ${pct(correct, bucket.length)}${flag} |`);
    }
    L.push('');
  }

  // ------------------------------------------------------------- 5. categories
  L.push('## 5. Per-category breakdown — which categories break which condition');
  L.push('');
  const categories = [...new Set(testset.map((c) => c.category))];
  L.push(`| Category | ${conditions.map((c) => `\`${c.id}\``).join(' | ')} |`);
  L.push(`|---|${conditions.map(() => '---:').join('|')}|`);
  for (const cat of categories) {
    const cells = conditions.map((c) => {
      const rows = (byCondition.get(c.id) ?? []).filter((r) => !r.error && r.category === cat);
      return rows.length === 0 ? '—' : pct(rows.filter((r) => r.top1Correct).length, rows.length);
    });
    L.push(`| ${cat} | ${cells.join(' | ')} |`);
  }
  L.push('');
  L.push('`card-collision` is the row that matters most for safety: a wrong match there is a');
  L.push('real gameplay error, not a cosmetic miss.');
  L.push('');

  // Worst offenders — concrete failures are more actionable than aggregates.
  const collisions = outcomes.filter(
    (o) => !o.error && o.category === 'card-collision' && !o.top1Correct && o.resolvedCard,
  );
  if (collisions.length > 0) {
    L.push('### Actual wrong-card resolutions in the collision category');
    L.push('');
    L.push('| Condition | Expected | Got | Transcript | conf |');
    L.push('|---|---|---|---|---:|');
    for (const c of collisions.slice(0, 20)) {
      L.push(
        `| \`${c.conditionId}\` | ${c.expectedCard} | **${c.resolvedCard}** | "${c.transcript}" | ${c.confidence.toFixed(2)} |`,
      );
    }
    L.push('');
  }

  // ------------------------------------------------------------------ 6. cost
  L.push('## 6. Cost');
  L.push('');
  L.push(
    `Rates: scribe_v2 $${PRICING.perHourUsd.scribe_v2}/hr, scribe_v2_realtime ` +
      `$${PRICING.perHourUsd.scribe_v2_realtime}/hr, keyterm add-on +$${PRICING.keytermAddOnPerHourUsd}/hr.`,
  );
  L.push('');
  const keytermCountFor = (c: Condition): number =>
    c.keyterms === 'none' ? 0 : packs[c.keyterms].terms.length;

  L.push('| Condition | keyterms sent | 20s minimum | per utterance | per 2-hour game |');
  L.push('|---|---:|---|---:|---:|');
  for (const s of stats) {
    const n = keytermCountFor(s.condition);
    const applied = computeCostMinimumApplies(n, GAME_MODEL.avgUtteranceSeconds);
    const perGame = s.meanCostUsd * GAME_MODEL.utterancesPerGame;
    L.push(
      `| \`${s.condition.id}\` | ${n || '—'} | ${applied ? '**yes**' : 'no'} | ${usd(s.meanCostUsd)} | ${usd(perGame)} |`,
    );
  }
  L.push('');
  L.push(
    `Extrapolation assumes ${GAME_MODEL.utterancesPerGame} utterances per ${GAME_MODEL.hours}-hour game ` +
      `(4 players, roughly one voice action each per turn).`,
  );
  L.push('');

  // The threshold effect is the real cost story, and it is easy to miss because
  // this test set is smaller than a Commander deck.
  const batchTerms = packs.batch.terms.length;
  L.push('> **The 20-second minimum is the cost story, and this table may not show it.**');
  L.push(`> Batch requests with 100+ keyterms bill a ${PRICING.keytermMinBillableSeconds}-second minimum regardless of clip`);
  L.push(`> length. This run sent **${batchTerms}** batch keyterms, so the minimum ${batchTerms >= 100 ? '**did** apply' : '**did not** apply'}.`);
  if (batchTerms < 100) {
    const withMin = computeCost('scribe_v2', GAME_MODEL.avgUtteranceSeconds, 150);
    const without = computeCost('scribe_v2', GAME_MODEL.avgUtteranceSeconds, batchTerms || 1);
    const ratio = without.costUsd > 0 ? withMin.costUsd / without.costUsd : 0;
    L.push('>');
    L.push(`> **A real 100-card Commander deck crosses that threshold.** The test set is only`);
    L.push(`> ${packs.batch.stats.deckSize} cards, which packs to ${batchTerms} terms. In production, option (A) sends 100+`);
    L.push(`> terms and every ~${GAME_MODEL.avgUtteranceSeconds}s utterance bills as ${PRICING.keytermMinBillableSeconds}s — about **${ratio.toFixed(1)}x** the cost shown`);
    L.push(`> above (${usd(without.costUsd)} -> ${usd(withMin.costUsd)} per utterance, ` +
      `${usd(without.costUsd * GAME_MODEL.utterancesPerGame)} -> ${usd(withMin.costUsd * GAME_MODEL.utterancesPerGame)} per game).`);
    L.push('>');
    L.push('> Realtime has no such floor, and its 50-term cap keeps it under the threshold by');
    L.push('> construction. On cost, that inverts the naive per-hour comparison.');
  }
  if (PRICING.v1RateIsAssumed) {
    L.push('');
    L.push('> `scribe_v1` has no separately published rate any more; it is modelled at parity with');
    L.push('> `scribe_v2`. Treat its cost column as indicative only.');
  }
  L.push('');

  // -------------------------------------------------------- 7. keyterm coverage
  L.push('## 7. Keyterm coverage');
  L.push('');
  for (const [name, p] of [['batch', packs.batch], ['realtime', packs.realtime]] as const) {
    L.push(`**${name}** — budget ${p.budget.count} terms x ${p.budget.maxChars} chars`);
    L.push('');
    L.push(`- slots used: ${p.stats.slotsUsed} / ${p.stats.slotsAvailable}`);
    L.push(`- deck coverage: **${p.stats.coveragePct.toFixed(1)}%** (${p.stats.deckSize} cards)`);
    L.push(`- hard-card coverage: **${p.stats.hardCardCoveragePct.toFixed(1)}%**`);
    L.push(`- truncated to fit: ${p.stats.truncatedCount}`);
    L.push(`- dropped as too easy to need help: ${p.stats.droppedAsEasyCount}`);
    L.push(`- dropped for lack of space: ${p.stats.droppedForSpaceCount}`);
    L.push('');
  }

  L.push('### Realtime packing — what the 50 slots bought');
  L.push('');
  L.push('| # | Card | Term | chars | difficulty | derivation |');
  L.push('|---:|---|---|---:|---:|---|');
  for (const [i, pick] of packs.realtime.picks.entries()) {
    L.push(
      `| ${i + 1} | ${pick.card} | \`${pick.term}\` | ${pick.term.length} | ${pick.difficulty.toFixed(2)} | ${pick.derivation} |`,
    );
  }
  L.push('');

  if (packs.realtime.dropped.length > 0) {
    L.push('### Cards the realtime budget could not help');
    L.push('');
    L.push('Hardest first. If a card here shows poor accuracy in `v2-realtime-packed` but good');
    L.push('accuracy in `v2-batch-keyterms`, the packer\'s difficulty heuristic mis-ranked it.');
    L.push('');
    L.push('| Card | difficulty | why |');
    L.push('|---|---:|---|');
    for (const d of packs.realtime.dropped.slice(0, 25)) {
      L.push(`| ${d.card} | ${d.difficulty.toFixed(2)} | ${d.reason} |`);
    }
    L.push('');
  }

  // -------------------------------------------------------------------- 8. WER
  L.push('## 8. WER (secondary diagnostic only)');
  L.push('');
  L.push('Included to catch a condition that is mangling audio wholesale. **Do not rank');
  L.push('conditions by this.** For nickname clips the reference text is not the card name, so');
  L.push('a correct resolution can score high WER — and a word-perfect transcript can still');
  L.push('resolve to the wrong card, which is the failure we actually care about.');
  L.push('');
  L.push('| Condition | mean WER |');
  L.push('|---|---:|');
  for (const s of stats) L.push(`| \`${s.condition.id}\` | ${s.wer.toFixed(3)} |`);
  L.push('');

  L.push('## Conditions tested');
  L.push('');
  L.push('| Condition | model | endpoint | keyterms | no_verbatim | rationale |');
  L.push('|---|---|---|---|---|---|');
  for (const c of conditions) {
    L.push(
      `| \`${c.id}\` | ${c.model} | ${c.endpoint} | ${c.keyterms} | ${c.noVerbatim ? 'yes' : 'no'} | ${c.label} |`,
    );
  }
  L.push('');

  return L.join('\n');
}
