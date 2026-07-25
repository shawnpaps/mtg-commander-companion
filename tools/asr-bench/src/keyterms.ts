/**
 * keyterms.ts — decklist -> optimal keyterm list for a given budget.
 *
 * Batch (1000 x 50ch) is not really a packing problem: a 100-card Commander deck
 * fits with room for nicknames. Realtime (50 x 20ch) is the actual problem, and
 * it is the reason option (B) might lose. Two constraints bite at once:
 *
 *   1. Only 50 slots for a 100-card deck. Half the deck gets no help.
 *   2. 20 characters. "Atraxa, Praetors' Voice" is 23 and must be truncated to
 *      something the model can still bias toward.
 *
 * The strategy: extract the shortest form that still identifies the card, score
 * every card by how badly it needs a keyterm, and spend the 50 slots on the
 * hardest cards. Spending a slot on "Lightning Bolt" is waste — Scribe gets that
 * right cold, and the slot could have gone to "Kozilek".
 */

import { KEYTERM_BUDGETS, KEYTERM_RULES } from './config.ts';
import { frontForms, normalize } from './resolver.ts';

export type Budget = { count: number; maxChars: number };

export type KeytermPick = {
  /** The card this slot is spent on. */
  card: string;
  /** The string actually sent to the API. */
  term: string;
  /** 0..1 — how much this card needs help. Higher = packed first. */
  difficulty: number;
  /** How `term` was derived from `card`. */
  derivation: 'as-is' | 'front-half' | 'truncated' | 'alias';
  /** Why it scored the way it did — surfaced in the report for sanity checking. */
  reasons: string[];
};

export type PackResult = {
  budget: Budget;
  terms: string[];
  picks: KeytermPick[];
  /** Cards that got no slot, hardest-first — the coverage gap for this condition. */
  dropped: { card: string; difficulty: number; reason: string }[];
  stats: {
    deckSize: number;
    slotsAvailable: number;
    slotsUsed: number;
    /** % of the deck that got a keyterm. The number the report cares about. */
    coveragePct: number;
    /** % of cards we *judged* to need help that actually got a slot. */
    hardCardCoveragePct: number;
    truncatedCount: number;
    droppedAsEasyCount: number;
    droppedForSpaceCount: number;
  };
};

// ------------------------------------------------------------ phonetic difficulty

/**
 * Common English words. A card name built entirely from these is low-risk: the
 * language model already has a strong prior for the word sequence, so a keyterm
 * slot buys little. Anything outside this list is either invented or rare, which
 * is where keyterms earn their cost.
 *
 * Deliberately small and hand-picked from actual MTG vocabulary rather than a
 * general frequency list — "wrath", "crypt", and "ritual" are uncommon in English
 * but extremely common on cards, so the model has seen them plenty.
 */
const COMMON_MTG_WORDS = new Set([
  // articles / connectives (already stripped, listed for completeness)
  'the', 'of', 'a', 'an', 'and', 'to', 'in', 'on', 'with', 'from', 'for',
  // colours, types, zones
  'white', 'blue', 'black', 'red', 'green', 'artifact', 'creature', 'land',
  'enchantment', 'instant', 'sorcery', 'planeswalker', 'token', 'counter',
  // extremely common name words
  'lightning', 'bolt', 'growth', 'rampant', 'dark', 'ritual', 'brainstorm',
  'swan', 'song', 'beast', 'within', 'sword', 'swords', 'path', 'exile',
  'counterspell', 'wrath', 'god', 'mana', 'crypt', 'sol', 'ring', 'birds',
  'paradise', 'demonic', 'tutor', 'study', 'cultivate', 'fierce', 'tithe',
  'smothering', 'guardianship', 'plowshares', 'feast', 'famine', 'protection',
  'will', 'thumb', 'saga', 'cradle', 'voice', 'king', 'queen', 'lord',
  'shadow', 'blade', 'storm', 'fire', 'ice', 'light', 'war', 'peace', 'body',
  'mind', 'truth', 'justice', 'hearth', 'home', 'vengeance', 'oracle', 'rift',
  'cyclonic', 'behemoth', 'colossus', 'ibex', 'empath', 'reservoir', 'weaver',
  'gravetide', 'returned', 'forces', 'joiner', 'teller', 'tales', 'butcher',
  'hunger', 'ceaseless', 'vast', 'great', 'hearted', 'tiger', 'ravager',
  'dockside', 'extortionist', 'flux', 'good', 'evil', 'life', 'death',
]);

/**
 * Letters and patterns that are rare in English and signal a fabricated name.
 * A hand-listed bigram set was too brittle — it missed "Kozilek" entirely — so
 * this scores classes of rarity instead of enumerating pairs.
 */
const RARE_LETTERS = /[zxqjk]/g;
/** Doubled vowels ("Zedruu", "Kaalia") almost never occur in common English. */
const DOUBLED_VOWEL = /(aa|ee|ii|oo|uu)/;
/** Three consonants in a row, which ASR reliably mangles. */
const CONSONANT_CLUSTER = /[bcdfghjklmnpqrstvwxz]{3}/;

/**
 * How badly does this card need a keyterm? 0 = Scribe will nail it cold,
 * 1 = hopeless without help.
 *
 * This is a heuristic, not a phonetic model. It is deliberately simple and
 * inspectable: the benchmark's job is to tell us whether the heuristic was good
 * enough, and `reasons` makes every score auditable.
 */
export function phoneticDifficulty(cardName: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  /**
   * Score the IDENTITY-BEARING part of the name, not the whole string.
   *
   * "Kozilek, Butcher of Truth" is three common words attached to one invented
   * one. Averaging over all four made it look easy (0.52, rank 33) when it is one
   * of the hardest names in the game. Players say "Kozilek", the keyterm we pack
   * is "Kozilek", so "Kozilek" is what difficulty should describe.
   */
  const identity = frontForms(cardName)[0] ?? normalize(cardName).full;
  const identityTokens = normalize(identity).contentTokens;
  const { contentTokens } = normalize(cardName);
  if (contentTokens.length === 0) return { score: 0, reasons: ['empty'] };

  const scoredTokens = identityTokens.length > 0 ? identityTokens : contentTokens;
  const head = scoredTokens[0]!;
  let score = 0;

  const unknownTokens = scoredTokens.filter((t) => !COMMON_MTG_WORDS.has(t));
  const unknownRatio = unknownTokens.length / scoredTokens.length;

  if (!COMMON_MTG_WORDS.has(head)) {
    score += 0.45;
    reasons.push(`head "${head}" is not common vocabulary`);
  }

  if (unknownRatio > 0) {
    score += 0.2 * unknownRatio;
    reasons.push(`${unknownTokens.length}/${scoredTokens.length} identity tokens uncommon`);
  }

  // Fabricated-name fingerprints, scored on the head token only.
  if (!COMMON_MTG_WORDS.has(head)) {
    const rareCount = head.match(RARE_LETTERS)?.length ?? 0;
    if (rareCount > 0) {
      score += Math.min(0.15, 0.08 * rareCount);
      reasons.push(`${rareCount} rare letter(s) in "${head}"`);
    }
    if (DOUBLED_VOWEL.test(head)) {
      score += 0.08;
      reasons.push('doubled vowel');
    }
    if (CONSONANT_CLUSTER.test(head)) {
      score += 0.07;
      reasons.push('consonant cluster');
    }
  }

  // Apostrophes are an ASR minefield — the possessive category exists because of
  // this. Worth a nudge even when the stem is a known word.
  if (/['’]/.test(cardName)) {
    score += 0.1;
    reasons.push('possessive form');
  }

  // Vowel-heavy or consonant-clustered heads mis-transcribe more often.
  const vowelRatio = (head.match(/[aeiou]/g)?.length ?? 0) / head.length;
  if (head.length >= 5 && (vowelRatio > 0.55 || vowelRatio < 0.28)) {
    score += 0.1;
    reasons.push(`unusual vowel ratio ${vowelRatio.toFixed(2)}`);
  }

  // Short common two-word names are the easiest case in the game. Judged on the
  // full name, not the identity: "Lightning Bolt" is easy end to end.
  if (unknownRatio === 0 && contentTokens.every((t) => COMMON_MTG_WORDS.has(t)) && contentTokens.length <= 3) {
    score -= 0.15;
    reasons.push('all-common short name');
  }

  const clamped = Math.max(0, Math.min(1, score));
  if (reasons.length === 0) reasons.push('no difficulty signals');
  return { score: clamped, reasons };
}

// ------------------------------------------------------------------ term fitting

/** Documented per-term validity. An invalid term can reject the whole request. */
export function isValidTerm(term: string, maxChars: number): boolean {
  if (!term || term.length > maxChars) return false;
  if (term.trim().split(/\s+/).length > KEYTERM_RULES.maxWords) return false;
  return !KEYTERM_RULES.forbiddenChars.some((c) => term.includes(c));
}

/**
 * The shortest form of this card that still identifies it, within maxChars.
 *
 * Preference order matters. A front-half is a *better* keyterm than a truncation
 * even when both fit, because "Atraxa" is a real word boundary the model can bias
 * toward, whereas "Atraxa, Praetors" is a fragment ending mid-name.
 */
export function fitTerm(
  cardName: string,
  maxChars: number,
): { term: string; derivation: KeytermPick['derivation'] } | null {
  // 1. Whole name fits.
  if (isValidTerm(cardName, maxChars)) return { term: cardName, derivation: 'as-is' };

  // 2. Front half — "Atraxa, Praetors' Voice" -> "Atraxa".
  for (const front of frontForms(cardName)) {
    // frontForms returns normalized text; recover the original casing/spelling
    // from the source name so the term matches how the word is actually written.
    const original = cardName.slice(0, front.length + countPunctuation(cardName, front.length)).trim()
      .replace(/[,:;]+$/, '');
    const candidate = isValidTerm(original, maxChars) ? original : front;
    if (isValidTerm(candidate, maxChars)) return { term: candidate, derivation: 'front-half' };
  }

  // 3. Truncate on a word boundary. Mid-word truncation is worse than useless —
  //    it biases toward a string no one will ever say.
  const words = cardName.replace(/[,]/g, '').split(/\s+/);
  for (let take = words.length - 1; take >= 1; take--) {
    const candidate = words.slice(0, take).join(' ');
    if (isValidTerm(candidate, maxChars)) return { term: candidate, derivation: 'truncated' };
  }

  // 4. Nothing usable. A single word longer than maxChars cannot be helped.
  return null;
}

/** How many extra chars (punctuation/space) sit within the first `n` normalized chars. */
function countPunctuation(original: string, normalizedLength: number): number {
  let seen = 0;
  let extra = 0;
  for (const ch of original) {
    if (seen >= normalizedLength) break;
    if (/[a-zA-Z0-9\s]/.test(ch)) seen++;
    else extra++;
  }
  return extra;
}

// ---------------------------------------------------------------------- packing

/**
 * Nickname keyterms. These are high-value in the realtime budget: "Thoracle" is
 * 8 characters and is what players actually say, so it earns its slot far more
 * than the 15-character "Thassa's Oracle" that nobody says out loud.
 */
export const NICKNAME_TERMS: Record<string, string[]> = {
  "Thassa's Oracle": ['Thoracle'],
  'Dockside Extortionist': ['Dockside'],
  'Cyclonic Rift': ['Cyc Rift'],
  'Craterhoof Behemoth': ['Craterhoof', 'Hoof'],
  'Demonic Tutor': ['Dem Tutor'],
  'Birds of Paradise': ['Birds'],
  "Teferi's Protection": ['Teferi'],
  'Fierce Guardianship': ['Fierce Guard'],
  'Smothering Tithe': ['Smothering'],
  'Cultivator Colossus': ['Cultivator'],
  'Pathbreaker Ibex': ['Pathbreaker'],
  'Aetherflux Reservoir': ['Aetherflux'],
};

/**
 * Pack a decklist into a keyterm budget.
 *
 * `alsoInclude` lets the caller force terms in (e.g. the commander, which is
 * spoken constantly). Forced terms are packed before the difficulty ranking.
 */
export function pack(
  decklist: string[],
  budget: Budget,
  options: { includeNicknames?: boolean; alsoInclude?: string[]; difficultyFloor?: number } = {},
): PackResult {
  const {
    includeNicknames = true,
    alsoInclude = [],
    // Below this, we judge Scribe gets it right cold and the slot is better spent
    // elsewhere. Only applied when slots are scarce (see below).
    difficultyFloor = 0.25,
  } = options;

  const deck = [...new Set(decklist)];

  const ranked = deck
    .map((card) => {
      const { score, reasons } = phoneticDifficulty(card);
      return { card, difficulty: score, reasons };
    })
    .sort((a, b) => b.difficulty - a.difficulty || a.card.localeCompare(b.card));

  const picks: KeytermPick[] = [];
  const dropped: PackResult['dropped'] = [];
  const usedTerms = new Set<string>();
  const coveredCards = new Set<string>();

  let truncatedCount = 0;
  let droppedAsEasyCount = 0;
  let droppedForSpaceCount = 0;

  const slotsFor = budget.count;

  // Demand is not just the deck: every nickname we want to bias toward needs its
  // own slot too. Comparing slots against deck size alone would call a 50-slot
  // budget "sufficient" for a 50-card deck and then have nothing left for the
  // nicknames — which are often the highest-value terms in the list, since
  // "Thoracle" is what players actually say.
  const nicknameDemand = deck.reduce((n, card) => n + (NICKNAME_TERMS[card]?.length ?? 0), 0);
  const totalDemand = deck.length + nicknameDemand;

  // Only withhold help from easy cards when demand genuinely exceeds supply.
  // With 1000 batch slots there is no reason to — the marginal cost is zero and
  // dropping cards would add a confound to the batch-vs-realtime comparison.
  const budgetIsScarce = slotsFor < totalDemand;

  const tryAdd = (
    card: string,
    term: string,
    derivation: KeytermPick['derivation'],
    difficulty: number,
    reasons: string[],
  ): boolean => {
    if (picks.length >= slotsFor) return false;
    const key = term.toLowerCase();
    if (usedTerms.has(key)) return false;
    if (!isValidTerm(term, budget.maxChars)) return false;

    usedTerms.add(key);
    coveredCards.add(card);
    picks.push({ card, term, difficulty, derivation, reasons });
    if (derivation === 'truncated') truncatedCount++;
    return true;
  };

  // Forced terms first — they are non-negotiable.
  for (const card of alsoInclude) {
    const fitted = fitTerm(card, budget.maxChars);
    const { score, reasons } = phoneticDifficulty(card);
    if (fitted) tryAdd(card, fitted.term, fitted.derivation, score, ['forced', ...reasons]);
  }

  /**
   * One ranked list of every term we could buy, canonical and nickname alike,
   * so the scarce realtime slots go to the highest-value terms overall.
   *
   * Nicknames carry a bonus because they are strictly better keyterms when they
   * apply: "Thoracle" is 8 characters, is what players actually say out loud, and
   * has no string relationship to "Thassa's Oracle" for the resolver to fall back
   * on. Ranking them behind every canonical name — as a leftover pass would —
   * spends slots on terms nobody utters.
   */
  const NICKNAME_BONUS = 0.08;

  type Cand = {
    card: string;
    term: string;
    derivation: KeytermPick['derivation'];
    difficulty: number;
    priority: number;
    reasons: string[];
  };

  const candidates: Cand[] = [];
  const unfittable: { card: string; difficulty: number }[] = [];
  /** Below the floor, but still worth a slot if one is going spare. */
  const deferred: { card: string; difficulty: number; reasons: string[] }[] = [];

  for (const { card, difficulty, reasons } of ranked) {
    if (budgetIsScarce && difficulty < difficultyFloor) {
      deferred.push({ card, difficulty, reasons });
      continue;
    }

    const fitted = fitTerm(card, budget.maxChars);
    if (fitted) {
      candidates.push({
        card,
        term: fitted.term,
        derivation: fitted.derivation,
        difficulty,
        priority: difficulty,
        reasons,
      });
    } else {
      unfittable.push({ card, difficulty });
    }

    if (includeNicknames) {
      for (const nick of NICKNAME_TERMS[card] ?? []) {
        if (!isValidTerm(nick, budget.maxChars)) continue;
        candidates.push({
          card,
          term: nick,
          derivation: 'alias',
          difficulty,
          priority: difficulty + NICKNAME_BONUS,
          reasons: ['player nickname', ...reasons],
        });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority || a.term.localeCompare(b.term));

  for (const c of candidates) {
    if (picks.length >= slotsFor) break;
    tryAdd(c.card, c.term, c.derivation, c.difficulty, c.reasons);
  }

  /**
   * Backfill. The difficulty floor decides *spending priority*, not eligibility —
   * an empty slot helps nobody, and a keyterm for an easy card is never worse than
   * no keyterm at all. Without this, a 50-card deck against 50 realtime slots left
   * 15 slots unused while 22 cards went uncovered.
   *
   * This matters for the benchmark's fairness too: if realtime leaves slots on the
   * table, option (B) loses on a self-inflicted wound rather than on the real
   * 50-slot constraint we are trying to measure.
   */
  for (const { card, difficulty, reasons } of deferred.sort((a, b) => b.difficulty - a.difficulty)) {
    if (picks.length >= slotsFor) {
      dropped.push({
        card,
        difficulty,
        reason: `below difficulty floor ${difficultyFloor} and no slots left over`,
      });
      droppedAsEasyCount++;
      continue;
    }
    const fitted = fitTerm(card, budget.maxChars);
    if (!fitted) {
      unfittable.push({ card, difficulty });
      continue;
    }
    tryAdd(card, fitted.term, fitted.derivation, difficulty, ['backfilled below floor', ...reasons]);
  }

  // Anything that never got a slot is a coverage gap, and the report needs to
  // know whether it lost to space or could not be expressed within maxChars.
  for (const { card, difficulty } of unfittable) {
    if (!coveredCards.has(card)) {
      dropped.push({ card, difficulty, reason: `cannot fit in ${budget.maxChars} chars` });
      droppedForSpaceCount++;
    }
  }
  for (const c of candidates) {
    if (!coveredCards.has(c.card) && !dropped.some((d) => d.card === c.card)) {
      dropped.push({ card: c.card, difficulty: c.difficulty, reason: 'no slots left' });
      droppedForSpaceCount++;
    }
  }

  const hardCards = ranked.filter((r) => r.difficulty >= difficultyFloor);
  const hardCovered = hardCards.filter((r) => coveredCards.has(r.card)).length;

  return {
    budget,
    terms: picks.map((p) => p.term),
    picks,
    dropped: dropped.sort((a, b) => b.difficulty - a.difficulty),
    stats: {
      deckSize: deck.length,
      slotsAvailable: slotsFor,
      slotsUsed: picks.length,
      coveragePct: deck.length ? (coveredCards.size / deck.length) * 100 : 0,
      hardCardCoveragePct: hardCards.length ? (hardCovered / hardCards.length) * 100 : 0,
      truncatedCount,
      droppedAsEasyCount,
      droppedForSpaceCount,
    },
  };
}

/** Both conditions' lists from one decklist, for the runner and the report. */
export function packBoth(
  decklist: string[],
  options?: Parameters<typeof pack>[2],
): { batch: PackResult; realtime: PackResult } {
  return {
    batch: pack(decklist, KEYTERM_BUDGETS.batch, options),
    realtime: pack(decklist, KEYTERM_BUDGETS.realtime, options),
  };
}
