/**
 * inspect-keyterms.ts — see what the packer decided, without running a benchmark.
 *
 *   npm run keyterms
 *   npm run keyterms -- --deck path/to/decklist.txt
 *
 * Useful when tuning phoneticDifficulty(): it shows exactly which cards won the
 * 50 realtime slots and which were dropped, so a bad heuristic is obvious before
 * you spend money finding out.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO } from './config.ts';
import { packBoth, phoneticDifficulty } from './keyterms.ts';

function loadDeck(): { name: string; source: string } {
  const i = process.argv.indexOf('--deck');
  if (i !== -1 && process.argv[i + 1]) {
    const path = resolve(process.argv[i + 1]!);
    if (!existsSync(path)) throw new Error(`No such decklist: ${path}`);
    return { name: path, source: readFileSync(path, 'utf8') };
  }
  const testset = JSON.parse(readFileSync(resolve(REPO, 'data/testset.json'), 'utf8'));
  return {
    name: 'data/testset.json',
    source: (testset.cards as { canonicalName: string }[]).map((c) => c.canonicalName).join('\n'),
  };
}

/** Accepts plain names or "1x Card Name" / "1 Card Name" lines. */
function parseDecklist(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'))
    .map((l) => l.replace(/^\d+\s*x?\s+/i, '').trim())
    .filter(Boolean);
}

const { name, source } = loadDeck();
const deck = parseDecklist(source);
const packs = packBoth(deck);

console.log(`\nDecklist: ${name} (${deck.length} cards)\n`);

for (const [label, p] of [['BATCH', packs.batch], ['REALTIME', packs.realtime]] as const) {
  console.log(`${label} — ${p.budget.count} terms x ${p.budget.maxChars} chars`);
  console.log(
    `  used ${p.stats.slotsUsed}/${p.stats.slotsAvailable} · deck coverage ${p.stats.coveragePct.toFixed(1)}% · ` +
      `hard-card coverage ${p.stats.hardCardCoveragePct.toFixed(1)}% · truncated ${p.stats.truncatedCount}`,
  );
  console.log(`  dropped: ${p.stats.droppedAsEasyCount} as easy, ${p.stats.droppedForSpaceCount} for space\n`);
}

console.log('REALTIME PICKS (what the 50 slots bought)');
console.log('  #  diff  chars  term                  <- card');
for (const [i, pick] of packs.realtime.picks.entries()) {
  console.log(
    `  ${String(i + 1).padStart(2)}  ${pick.difficulty.toFixed(2)}  ${String(pick.term.length).padStart(5)}  ` +
      `${pick.term.padEnd(21)} <- ${pick.card}`,
  );
}

if (packs.realtime.dropped.length > 0) {
  console.log('\nDROPPED (hardest first)');
  for (const d of packs.realtime.dropped.slice(0, 30)) {
    console.log(`  ${d.difficulty.toFixed(2)}  ${d.card.padEnd(34)} ${d.reason}`);
  }
}

console.log('\nDIFFICULTY SCORES (sorted, with reasons)');
for (const card of [...deck].sort(
  (a, b) => phoneticDifficulty(b).score - phoneticDifficulty(a).score,
)) {
  const { score, reasons } = phoneticDifficulty(card);
  console.log(`  ${score.toFixed(2)}  ${card.padEnd(34)} ${reasons.join('; ')}`);
}
console.log('');
