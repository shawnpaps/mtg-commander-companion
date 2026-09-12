/**
 * Shared draft constants and formulas. Defined once — inline copies drift, and
 * the tiebreaker floor in particular has to match everywhere or standings
 * disagree between the engine and the UI.
 */

/** MTG match points: a bye is scored as a win. */
export const MATCH_POINTS = { win: 3, draw: 1, loss: 0 } as const;

/**
 * Every opponent percentage is floored at 1/3 before averaging, per the MTG
 * tournament rules — a 0-3 opponent still contributes 33%, so beating them is
 * not a tiebreaker penalty.
 */
export const TIEBREAKER_FLOOR = 1 / 3;

/** Default seats per pod when splitting a field. */
export const DEFAULT_POD_SIZE = 8;

/** Recommended Swiss rounds for n players: ceil(log2(n)), never fewer than 3. */
export function recommendedRounds(n: number): number {
  return Math.max(3, Math.ceil(Math.log2(Math.max(2, n))));
}

/**
 * Hard maximum rounds: n-1. Past that the field is a full round robin and
 * no-rematch pairing becomes impossible.
 */
export function maxRounds(n: number): number {
  return Math.max(3, n - 1);
}
