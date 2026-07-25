/**
 * resolver.ts — transcript text -> a card.
 *
 * This runs IDENTICALLY across every condition. That is the whole point: if the
 * resolver differed between batch and realtime we would be measuring resolver
 * variance and calling it ASR variance. Nothing in here may branch on model,
 * endpoint, or keyterm state.
 *
 * Zero external deps by constraint — the string matching is implemented here.
 */

// ---------------------------------------------------------------- normalization

/**
 * Words that carry no identifying signal in a card name. Stripped only for the
 * *content* form; the full form keeps them because "Path to Exile" vs "Path of
 * Ancestry" is distinguished partly by the preposition.
 */
const STOPWORDS = new Set(['the', 'of', 'a', 'an', 'and', 'to', 'in', 'on', 'with']);

/**
 * Spoken game commands and fillers. Players say "uh, cast, uh, Sol Ring" — the
 * card name is the payload and everything else is wrapper. Stripped from queries
 * only, never from card names (no real card starts with "cast").
 */
const COMMAND_WORDS = new Set([
  'cast', 'casting', 'play', 'playing', 'tap', 'tapping', 'activate', 'equip',
  'attack', 'attacking', 'sacrifice', 'sac', 'discard', 'exile', 'destroy',
  'target', 'targeting', 'overload', 'overloaded', 'kick', 'kicked', 'flash',
  'free', 'ill', 'im', 'i', 'we', 'my', 'your', 'that', 'this', 'it', 'for',
  'uh', 'um', 'er', 'ah', 'uhh', 'umm', 'like', 'okay', 'ok', 'so', 'then',
  'lets', 'gonna', 'wanna', 'going',
]);

export type Normalized = {
  /** Punctuation- and diacritic-free, lowercase, single-spaced. */
  full: string;
  /** Tokens of `full`. */
  tokens: string[];
  /** Tokens with stopwords removed — the token-comparison form. */
  contentTokens: string[];
  /** contentTokens rejoined. */
  content: string;
};

/**
 * Possessives are stripped rather than kept because ASR is wildly inconsistent
 * about them: "Gaea's Cradle" comes back as "Gaeas Cradle", "Gaea Cradle", and
 * "Gaias Cradle". Folding all of them to "gaea cradle" makes the possessive
 * category tractable. Note this collapses "Praetors'" and "Praetor's" too,
 * which is exactly what we want.
 */
/**
 * Built from escape strings rather than literal codepoints so the source stays
 * legible and survives any encoding round-trip.
 */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
/** ASCII hyphen, the Unicode dash block (U+2010–U+2015), and forward slash. */
const DASHES = new RegExp('[\\u2010-\\u2015\\-/]', 'g');
/** Straight and curly apostrophes. */
const APOSTROPHE = '[\\u0027\\u2019]';

export function normalize(input: string): Normalized {
  let s = input.normalize('NFD').replace(COMBINING_MARKS, '');
  s = s.toLowerCase();

  // Possessives before general punctuation removal, so we can still see the
  // apostrophe. Order matters: singular 's first, then plural trailing '.
  s = s.replace(new RegExp(`(\\w)${APOSTROPHE}s\\b`, 'g'), '$1');        // gaea's -> gaea
  s = s.replace(new RegExp(`(\\w)s${APOSTROPHE}(?=\\s|$)`, 'g'), '$1s'); // praetors' -> praetors
  s = s.replace(new RegExp(APOSTROPHE, 'g'), '');                        // any remainder

  // Hyphens and slashes become spaces so "Fae-Cursed" == "Fae Cursed" and
  // "Blade-Blossom" == "Blade Blossom". Everything else non-alphanumeric goes.
  s = s.replace(DASHES, ' ');
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  const tokens = s ? s.split(' ') : [];
  const contentTokens = tokens.filter((t) => !STOPWORDS.has(t));

  return {
    full: s,
    tokens,
    contentTokens,
    content: contentTokens.join(' '),
  };
}

/** Normalization plus command/filler stripping. Queries only. */
export function normalizeQuery(input: string): Normalized {
  const base = normalize(input);
  const stripped = base.tokens.filter((t) => !COMMAND_WORDS.has(t));

  // If stripping removed everything the utterance was pure filler; keep the
  // original so we score a miss rather than crashing on an empty query.
  const tokens = stripped.length > 0 ? stripped : base.tokens;
  const contentTokens = tokens.filter((t) => !STOPWORDS.has(t));

  return {
    full: tokens.join(' '),
    tokens,
    contentTokens,
    content: contentTokens.join(' '),
  };
}

// ------------------------------------------------------------------ front halves

/**
 * The forms a player might say instead of the full name. "Atraxa, Praetors'
 * Voice" -> ["atraxa"]. "Nicol Bolas, the Ravager" -> ["nicol bolas"].
 * "Kaalia of the Vast" -> ["kaalia"]. "Zedruu the Greathearted" -> ["zedruu"].
 *
 * Ordered longest-first so the most specific prefix is preferred. Shared with
 * keyterms.ts, which uses the same extraction to fit names into 20 chars.
 */
export function frontForms(name: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const n = normalize(s).full;
    if (n && n !== normalize(name).full && !out.includes(n)) out.push(n);
  };

  // Comma is the strongest signal — it is how Wizards delimits legendary titles.
  const comma = name.indexOf(',');
  if (comma > 0) push(name.slice(0, comma));

  // " the X" / " of X" titles without a comma.
  const titleMatch = name.match(/^(.*?)\s+(?:the|of)\s+/i);
  if (titleMatch?.[1]) push(titleMatch[1]);

  return out;
}

// ------------------------------------------------------------- fuzzy primitives

/** Character trigrams, space-padded so word boundaries contribute. */
export function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Dice coefficient over trigram sets: 2|A∩B| / (|A|+|B|). */
export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;

  let shared = 0;
  for (const g of ta) if (tb.has(g)) shared++;
  return (2 * shared) / (ta.size + tb.size);
}

/**
 * Token-set ratio. Order-independent and length-forgiving, which is what we
 * need for "sword feast famine" vs "sword of feast and famine".
 *
 * Deliberately asymmetric-tolerant: divided by the smaller set so that a short
 * spoken form fully contained in a long card name scores high. That is the
 * common case ("dockside" inside "dockside extortionist") and the reason we do
 * not use plain Jaccard, which would punish it hard.
 */
export function tokenSetRatio(aTokens: string[], bTokens: string[]): number {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  if (shared === 0) return 0;

  const containment = shared / Math.min(a.size, b.size);
  const coverage = shared / Math.max(a.size, b.size);
  // Weighted toward containment but not blind to it: a one-token query matching
  // one token of a six-token name should not score 1.0.
  return 0.65 * containment + 0.35 * coverage;
}

// -------------------------------------------------------------------- aliases

/**
 * What players actually say. This is not a convenience — for the `nickname`
 * category it is the only path to a correct resolution, because "Thoracle" has
 * no string relationship to "Thassa's Oracle" at all.
 *
 * Keys are normalized on load, so entries can be written naturally.
 */
export const ALIASES: Record<string, string> = {
  // nickname category
  'thoracle': "Thassa's Oracle",
  'thorackle': "Thassa's Oracle",
  'dockside': 'Dockside Extortionist',
  'cyc rift': 'Cyclonic Rift',
  'sick rift': 'Cyclonic Rift',
  'sike rift': 'Cyclonic Rift',
  'cyclonic': 'Cyclonic Rift',
  'hoof': 'Craterhoof Behemoth',
  'craterhoof': 'Craterhoof Behemoth',
  'dem tutor': 'Demonic Tutor',
  'demo tutor': 'Demonic Tutor',
  'birds': 'Birds of Paradise',
  'bird': 'Birds of Paradise',

  // common shorthand that is not strictly a nickname
  'bolt': 'Lightning Bolt',
  'swords': 'Swords to Plowshares',
  'path': 'Path to Exile',
  'crypt': 'Mana Crypt',
  'vault': 'Mana Vault',
  't pro': "Teferi's Protection",
  'tef pro': "Teferi's Protection",
  'cradle': "Gaea's Cradle",
  'saga': "Urza's Saga",
  'fierce g': 'Fierce Guardianship',
  'fierce guard': 'Fierce Guardianship',
  'rhystic': 'Rhystic Study',
  'do you pay the one': 'Rhystic Study',
  'aetherflux': 'Aetherflux Reservoir',
  'smothering': 'Smothering Tithe',
  'cultivator': 'Cultivator Colossus',
  'pathbreaker': 'Pathbreaker Ibex',

  // homophones players and ASR both produce
  'soul ring': 'Sol Ring',
  'sole ring': 'Sol Ring',
  'manor crypt': 'Mana Crypt',
  'rath of god': 'Wrath of God',
  'nickel bolas': 'Nicol Bolas, the Ravager',
  'nickel bowlus': 'Nicol Bolas, the Ravager',
  'nicol bowlus': 'Nicol Bolas, the Ravager',
  'ristic study': 'Rhystic Study',
  'mystic study': 'Rhystic Study',
  'ether flux reservoir': 'Aetherflux Reservoir',
  'gias cradle': "Gaea's Cradle",
};

const NORMALIZED_ALIASES = new Map<string, string>(
  Object.entries(ALIASES).map(([k, v]) => [normalize(k).full, v]),
);

// ------------------------------------------------------------------ candidates

/**
 * Tie-break weights. A card in your deck is far likelier to be the intended
 * target than some random card in the format, so identical string evidence
 * should resolve toward the deck. These multiply the final score.
 */
export const TIER_WEIGHTS = {
  decklist: 1.0,
  battlefield: 1.0,
  'format-legal': 0.95,
  all: 0.9,
} as const;

export type Tier = keyof typeof TIER_WEIGHTS;

export type PoolEntry = { name: string; tier: Tier };

export type Candidate = {
  name: string;
  tier: Tier;
  /** Tier-weighted final score. This is what ranks and what feeds confidence. */
  score: number;
  /** Pre-weight score, for debugging why a match won. */
  rawScore: number;
  /** Which signal produced rawScore. */
  signal: string;
};

export type Resolution = {
  top: Candidate | null;
  runners: Candidate[];
  confidence: number;
};

/** Precomputed per-card forms. Built once; reused for every utterance. */
type IndexedCard = {
  name: string;
  tier: Tier;
  norm: Normalized;
  fronts: string[];
};

export class Resolver {
  #index: IndexedCard[] = [];

  constructor(pool: PoolEntry[]) {
    // Highest tier wins if a card appears in more than one scope (a card on the
    // battlefield is also format-legal; we want the stronger weight).
    const best = new Map<string, PoolEntry>();
    for (const entry of pool) {
      const key = normalize(entry.name).full;
      const existing = best.get(key);
      if (!existing || TIER_WEIGHTS[entry.tier] > TIER_WEIGHTS[existing.tier]) {
        best.set(key, entry);
      }
    }

    for (const entry of best.values()) {
      this.#index.push({
        name: entry.name,
        tier: entry.tier,
        norm: normalize(entry.name),
        fronts: frontForms(entry.name),
      });
    }
  }

  get size(): number {
    return this.#index.length;
  }

  /**
   * Score one card against one query. Discrete signals are near-certainties;
   * the fuzzy blend is the fallback. Taking the max means a solid exact match is
   * never dragged down by mediocre trigram overlap.
   */
  #scoreCard(card: IndexedCard, q: Normalized, aliasTarget: string | null): { score: number; signal: string } {
    let best = 0;
    let signal = 'none';
    const consider = (s: number, name: string) => {
      if (s > best) { best = s; signal = name; }
    };

    // Alias resolved to this exact card — the strongest signal we have, because
    // it encodes human knowledge the string cannot.
    if (aliasTarget && normalize(aliasTarget).full === card.norm.full) {
      consider(0.98, 'alias');
    }

    if (q.full === card.norm.full) consider(1.0, 'exact');
    if (q.content && q.content === card.norm.content) consider(0.97, 'exact-content');

    // Front-half: the player said "Atraxa" and meant "Atraxa, Praetors' Voice".
    for (const front of card.fronts) {
      if (q.full === front) consider(0.94, 'front-half');
      else if (q.content === normalize(front).content) consider(0.92, 'front-half-content');
    }

    // Prefix containment: the query is a leading substring of the name, or vice
    // versa. Catches "sword of feast" -> "Sword of Feast and Famine".
    if (q.full.length >= 4 && card.norm.full.startsWith(q.full)) {
      consider(0.88, 'prefix');
    } else if (card.norm.full.length >= 4 && q.full.startsWith(card.norm.full)) {
      consider(0.86, 'prefix-reverse');
    }

    // Fuzzy blend. Dice catches phonetic drift within words ("ristic"/"rhystic");
    // token-set catches dropped and reordered words. Blending both is more
    // stable than either alone.
    const dice = Math.max(
      diceCoefficient(q.full, card.norm.full),
      diceCoefficient(q.content, card.norm.content),
    );
    const tokens = tokenSetRatio(q.contentTokens, card.norm.contentTokens);
    const blended = 0.55 * dice + 0.45 * tokens;
    consider(blended, 'fuzzy');

    return { score: best, signal };
  }

  resolve(transcript: string): Resolution {
    const q = normalizeQuery(transcript);
    if (!q.full) return { top: null, runners: [], confidence: 0 };

    // An alias may match the whole utterance or a trailing span of it, since
    // "cast Thoracle" normalizes to "thoracle" but "cyc rift overloaded" does not.
    const aliasTarget = this.#findAlias(q);

    const scored: Candidate[] = [];
    for (const card of this.#index) {
      const { score, signal } = this.#scoreCard(card, q, aliasTarget);
      if (score <= 0) continue;
      scored.push({
        name: card.name,
        tier: card.tier,
        rawScore: score,
        score: score * TIER_WEIGHTS[card.tier],
        signal,
      });
    }

    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    const top = scored[0] ?? null;
    const runners = scored.slice(1, 5);

    return { top, runners, confidence: confidenceOf(top?.score ?? 0, scored[1]?.score ?? 0) };
  }

  /** Longest matching alias over any contiguous token span. */
  #findAlias(q: Normalized): string | null {
    const { tokens } = q;
    for (let len = Math.min(tokens.length, 5); len >= 1; len--) {
      for (let i = 0; i + len <= tokens.length; i++) {
        const span = tokens.slice(i, i + len).join(' ');
        const hit = NORMALIZED_ALIASES.get(span);
        if (hit) return hit;
      }
    }
    return null;
  }
}

/**
 * Confidence must account for MARGIN, not just top score.
 *
 * A 0.90 top score with a 0.89 runner-up means the resolver has two nearly
 * indistinguishable candidates and is one phoneme away from a wrong cast — that
 * has to read as LOW confidence even though the absolute score is high. Scoring
 * on top1 alone would mark it 0.90 and auto-execute it.
 *
 * A margin of 0.12 or more is treated as fully decisive. Below that, confidence
 * is scaled down toward 0.65 * top1.
 */
export function confidenceOf(top1: number, top2: number): number {
  if (top1 <= 0) return 0;
  const margin = Math.max(0, top1 - top2);
  return top1 * (0.65 + 0.35 * Math.min(margin / 0.12, 1));
}
