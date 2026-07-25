/**
 * selftest.ts — assertions over the resolver and packer. No network, no deps.
 *
 *   npm test
 *
 * These are the behaviours the benchmark's validity depends on. If normalization
 * or the confidence margin regresses, every accuracy number silently shifts and
 * we would not otherwise notice.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO, KEYTERM_BUDGETS } from './config.ts';
import { Resolver, normalize, normalizeQuery, confidenceOf, frontForms, tokenSetRatio, diceCoefficient } from './resolver.ts';
import type { PoolEntry } from './resolver.ts';
import { pack, phoneticDifficulty, fitTerm, isValidTerm } from './keyterms.ts';
import { computeCost } from './scribe/cost.ts';
import { wordErrorRate } from './report.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = '') {
  if (condition) { passed++; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function eq<T>(name: string, actual: T, expected: T) {
  check(name, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ------------------------------------------------------------- normalization

eq('normalize lowercases', normalize('Sol Ring').full, 'sol ring');
eq("normalize strips singular possessive", normalize("Gaea's Cradle").full, 'gaea cradle');
eq('normalize strips plural possessive', normalize("Praetors' Voice").full, 'praetors voice');
eq('normalize strips commas', normalize('Atraxa, Praetors\' Voice').full, 'atraxa praetors voice');
eq('normalize splits hyphens', normalize('Najeela, the Blade-Blossom').full, 'najeela the blade blossom');
eq('normalize collapses whitespace', normalize('  Sol    Ring  ').full, 'sol ring');
eq('normalize strips diacritics', normalize('Lim-Dûl').full, 'lim dul');
eq('content form drops stopwords', normalize('Path to Exile').content, 'path exile');

eq('query strips cast', normalizeQuery('cast Lightning Bolt').full, 'lightning bolt');
eq('query strips fillers', normalizeQuery('uh, cast, uh, Sol Ring').full, 'sol ring');
eq('query strips trailing that', normalizeQuery('Counterspell that').full, 'counterspell');
check('pure filler does not empty the query', normalizeQuery('uh um').full.length > 0);

// ---------------------------------------------------------------- front halves

check('front half of comma name', frontForms("Atraxa, Praetors' Voice").includes('atraxa'));
check('front half of Nicol Bolas', frontForms('Nicol Bolas, the Ravager').includes('nicol bolas'));
check('front half of "of the" name', frontForms('Kaalia of the Vast').includes('kaalia'));
check('front half of "the" name', frontForms('Zedruu the Greathearted').includes('zedruu'));

// ------------------------------------------------------------------- primitives

check('dice identical is 1', diceCoefficient('sol ring', 'sol ring') === 1);
check('dice catches phonetic drift', diceCoefficient('ristic study', 'rhystic study') > 0.6);
check('dice separates unrelated', diceCoefficient('sol ring', 'craterhoof') < 0.2);
check('token set rewards containment', tokenSetRatio(['dockside'], ['dockside', 'extortionist']) > 0.5);
check('token set is not blind to coverage', tokenSetRatio(['dockside'], ['dockside', 'extortionist']) < 1);
check('token set zero on disjoint', tokenSetRatio(['a'], ['b']) === 0);

// ------------------------------------------------------------------ confidence

check('confidence is 0 for no match', confidenceOf(0, 0) === 0);
check(
  'a large margin yields full confidence',
  Math.abs(confidenceOf(1.0, 0.5) - 1.0) < 1e-9,
  String(confidenceOf(1.0, 0.5)),
);
{
  // The requirement: 0.90 vs 0.89 must read as LOW confidence.
  const tight = confidenceOf(0.90, 0.89);
  const clear = confidenceOf(0.90, 0.60);
  check('tight margin is penalised', tight < 0.65, `got ${tight.toFixed(3)}`);
  check('clear margin is not penalised', clear > 0.89, `got ${clear.toFixed(3)}`);
  check('margin changes confidence a lot', clear - tight > 0.2, `${clear.toFixed(3)} vs ${tight.toFixed(3)}`);
  check(
    'tight margin falls below the auto-execute bar',
    tight <= 0.9,
    'otherwise a coin-flip would auto-execute',
  );
}

// -------------------------------------------------------------------- resolver

const testset = JSON.parse(readFileSync(resolve(REPO, 'data/testset.json'), 'utf8'))
  .cards as { canonicalName: string; category: string; spokenForms: string[] }[];
const decoyRaw = JSON.parse(readFileSync(resolve(REPO, 'data/decoys.json'), 'utf8'));
const decoyNames = [
  ...new Set([
    ...Object.values(decoyRaw.confusableWith as Record<string, string[]>).flat(),
    ...(decoyRaw.generalPool as string[]),
  ]),
];

const inDeck = new Set(testset.map((c) => normalize(c.canonicalName).full));
const pool: PoolEntry[] = [
  ...testset.map((c) => ({ name: c.canonicalName, tier: 'decklist' as const })),
  ...decoyNames
    .filter((n) => !inDeck.has(normalize(n).full))
    .map((n) => ({ name: n, tier: 'all' as const })),
];
const resolver = new Resolver(pool);

check('pool is large enough to be adversarial', resolver.size > 200, `size ${resolver.size}`);

function resolvesTo(query: string, expected: string) {
  const r = resolver.resolve(query);
  eq(`resolve("${query}")`, r.top?.name ?? null, expected);
}

resolvesTo('Lightning Bolt', 'Lightning Bolt');
resolvesTo('cast Sol Ring', 'Sol Ring');
resolvesTo('soul ring', 'Sol Ring');
resolvesTo('manor crypt', 'Mana Crypt');
resolvesTo('Thoracle', "Thassa's Oracle");
resolvesTo('cyc rift', 'Cyclonic Rift');
resolvesTo('Atraxa', "Atraxa, Praetors' Voice");
resolvesTo('Kozilek', 'Kozilek, Butcher of Truth');
resolvesTo('gaeas cradle', "Gaea's Cradle");
resolvesTo('Muldrotha', 'Muldrotha, the Gravetide');

// Collisions must resolve to the *specific* card, with decoys present.
resolvesTo('Cultivator Colossus', 'Cultivator Colossus');
resolvesTo('Counterflux', 'Counterflux');
resolvesTo('Smothering Tithe', 'Smothering Tithe');
resolvesTo('Sword of Feast and Famine', 'Sword of Feast and Famine');

// The decoys really are in the pool and reachable — otherwise collisions are fake.
resolvesTo('Kozilek the Great Distortion', 'Kozilek, the Great Distortion');
resolvesTo('Ulamog the Infinite Gyre', 'Ulamog, the Infinite Gyre');
resolvesTo('Atraxa Grand Unifier', 'Atraxa, Grand Unifier');

// Ambiguity must be reported as low confidence rather than a confident guess.
{
  const r = resolver.resolve('Cultivat');
  check(
    'genuinely ambiguous input is low confidence',
    r.confidence < 0.9,
    `confidence ${r.confidence.toFixed(3)} for top=${r.top?.name}`,
  );
}
{
  const r = resolver.resolve('Sol Ring');
  check('unambiguous input is high confidence', r.confidence > 0.9, `got ${r.confidence.toFixed(3)}`);
}
{
  const r = resolver.resolve('');
  check('empty query resolves to nothing', r.top === null && r.confidence === 0);
}
{
  const r = resolver.resolve('Dockside');
  check('runners are populated for the confirm chips', r.runners.length > 0);
}

// Tier weighting: a deck card should beat an equally-matching non-deck card.
{
  const tiered = new Resolver([
    { name: 'Sol Ring', tier: 'all' },
    { name: 'Sol Ring', tier: 'decklist' },
  ]);
  eq('higher tier wins on duplicate names', tiered.size, 1);
}

// ----------------------------------------------------------------- keyterms

{
  const deck = testset.map((c) => c.canonicalName);
  const rt = pack(deck, KEYTERM_BUDGETS.realtime);
  const batch = pack(deck, KEYTERM_BUDGETS.batch);

  check('realtime respects the slot budget', rt.terms.length <= KEYTERM_BUDGETS.realtime.count,
    `got ${rt.terms.length}`);
  check(
    'every realtime term fits 20 chars',
    rt.terms.every((t) => t.length <= KEYTERM_BUDGETS.realtime.maxChars),
    rt.terms.filter((t) => t.length > 20).join(', '),
  );
  check(
    'every batch term fits 50 chars',
    batch.terms.every((t) => t.length <= KEYTERM_BUDGETS.batch.maxChars),
  );
  check('realtime terms are unique', new Set(rt.terms).size === rt.terms.length);
  check('batch covers more of the deck than realtime',
    batch.stats.coveragePct >= rt.stats.coveragePct,
    `batch ${batch.stats.coveragePct} vs rt ${rt.stats.coveragePct}`);
  check('batch fits the whole deck', batch.stats.coveragePct === 100,
    `got ${batch.stats.coveragePct}`);

  const picked = new Set(rt.picks.map((p) => p.card));
  check('Kozilek gets a realtime slot', picked.has('Kozilek, Butcher of Truth'));
  check('Prossh gets a realtime slot', picked.has('Prossh, Skyraider of Kher'));
  check('nicknames make it in where they fit',
    rt.picks.some((p) => p.term === 'Thoracle'));

  // No slot may be left unused while a card goes uncovered — an empty slot helps
  // nobody, and leaving one would make option (B) lose on a self-inflicted wound.
  check(
    'no slot is wasted while cards are uncovered',
    rt.stats.slotsUsed === rt.stats.slotsAvailable || rt.stats.coveragePct === 100,
    `used ${rt.stats.slotsUsed}/${rt.stats.slotsAvailable} at ${rt.stats.coveragePct.toFixed(0)}% coverage`,
  );

  // The real production case: a 100-card Commander deck against 50 slots. This is
  // where the floor has to actually do its job.
  const deck100 = [...new Set([...deck, ...decoyNames])].slice(0, 100);
  eq('built a 100-card deck for the scarcity test', deck100.length, 100);
  const rt100 = pack(deck100, KEYTERM_BUDGETS.realtime);
  const batch100 = pack(deck100, KEYTERM_BUDGETS.batch);

  check('100-card deck fully fits the batch budget', batch100.stats.coveragePct === 100,
    `got ${batch100.stats.coveragePct}`);
  check('100-card deck cannot fully fit realtime', rt100.stats.coveragePct < 100,
    `got ${rt100.stats.coveragePct}`);
  check('realtime spends every slot on a 100-card deck',
    rt100.stats.slotsUsed === KEYTERM_BUDGETS.realtime.count,
    `used ${rt100.stats.slotsUsed}`);
  check('cards are genuinely dropped at 100 cards', rt100.dropped.length > 0);

  // Priority claim: with real scarcity, hard cards beat easy ones for slots.
  const picked100 = new Set(rt100.picks.map((p) => p.card));
  const hardIn = ['Kozilek, Butcher of Truth', 'Prossh, Skyraider of Kher', 'Zedruu the Greathearted']
    .filter((c) => deck100.includes(c) && picked100.has(c)).length;
  const hardTotal = ['Kozilek, Butcher of Truth', 'Prossh, Skyraider of Kher', 'Zedruu the Greathearted']
    .filter((c) => deck100.includes(c)).length;
  check('hard cards win slots under real scarcity', hardIn === hardTotal,
    `${hardIn}/${hardTotal} covered`);

  const meanPickedDifficulty =
    rt100.picks.reduce((s, p) => s + p.difficulty, 0) / (rt100.picks.length || 1);
  const meanDroppedDifficulty =
    rt100.dropped.reduce((s, d) => s + d.difficulty, 0) / (rt100.dropped.length || 1);
  check(
    'picked cards are harder on average than dropped ones',
    meanPickedDifficulty > meanDroppedDifficulty,
    `picked ${meanPickedDifficulty.toFixed(2)} vs dropped ${meanDroppedDifficulty.toFixed(2)}`,
  );
}

// Difficulty ordering — the heuristic's central claim.
{
  const hard = phoneticDifficulty('Kozilek, Butcher of Truth').score;
  const easy = phoneticDifficulty('Lightning Bolt').score;
  check('invented nouns outrank common word pairs', hard > easy, `${hard.toFixed(2)} vs ${easy.toFixed(2)}`);
  check('possessives score above trivial', phoneticDifficulty("Gaea's Cradle").score > easy);
}

// Term fitting.
eq('short name is used as-is', fitTerm('Sol Ring', 20)?.derivation, 'as-is');
{
  const fitted = fitTerm("Atraxa, Praetors' Voice", 20);
  check('long legendary is front-halved', fitted?.derivation === 'front-half', JSON.stringify(fitted));
  check('front half fits the budget', (fitted?.term.length ?? 99) <= 20, fitted?.term);
}
{
  const fitted = fitTerm('Sword of Feast and Famine', 20);
  check('no-comma long name truncates on a word boundary',
    fitted !== null && fitted.term.length <= 20 && !fitted.term.endsWith(' '),
    JSON.stringify(fitted));
}
check('over-long single word is rejected', isValidTerm('x'.repeat(21), 20) === false);
check('too many words is rejected', isValidTerm('a b c d e f', 50) === false);
check('forbidden character is rejected', isValidTerm('Sol [Ring]', 50) === false);

// --------------------------------------------------------------------- cost

{
  const noKt = computeCost('scribe_v2', 2.5, 0);
  const withKt = computeCost('scribe_v2', 2.5, 50);
  const bigKt = computeCost('scribe_v2', 2.5, 500);

  check('keyterms cost more than none', withKt.costUsd > noKt.costUsd);
  check('under 100 keyterms has no minimum', withKt.minimumApplied === false);
  check('100+ keyterms triggers the 20s minimum', bigKt.minimumApplied === true);
  check('the minimum dominates short clips', bigKt.costUsd > withKt.costUsd * 5,
    `${bigKt.costUsd} vs ${withKt.costUsd}`);
  check('realtime base rate exceeds batch',
    computeCost('scribe_v2_realtime', 60, 0).costUsd > computeCost('scribe_v2', 60, 0).costUsd);
}

// ---------------------------------------------------------------------- WER

eq('WER is 0 for identical', wordErrorRate('sol ring', 'Sol Ring'), 0);
check('WER is 1 for one-word total miss', wordErrorRate('bolt', 'crypt') === 1);
check('WER counts one substitution of two', Math.abs(wordErrorRate('sol ring', 'soul ring') - 0.5) < 1e-9);

// -------------------------------------------------------------------- report

console.log('');
if (failures.length === 0) {
  console.log(`selftest: ${passed} checks passed`);
  process.exit(0);
}
console.log(`selftest: ${passed} passed, ${failures.length} FAILED\n`);
for (const f of failures) console.log(`  x ${f}`);
console.log('');
process.exit(1);
