/**
 * What a match result is allowed to be.
 *
 * Pure, so the picker the organizer taps and the guard the mutation runs are
 * built from the same list — a button that cannot be stored should not exist,
 * and a result the UI can produce should never be rejected.
 */

export type ResultOption = {
  entrant1GameWins: number;
  entrant2GameWins: number;
  /** Shown on the button when game scores are being tracked. */
  label: string;
  /** Who this result favours; drives the button's colour and the terse label. */
  outcome: "entrant1" | "draw" | "entrant2";
};

/**
 * Match-only reporting. A win is stored as 2–0 and a draw as 1–1 so that the
 * game-point arithmetic downstream has something consistent to read even when
 * nobody recorded individual games.
 */
const MATCH_ONLY_OPTIONS: ResultOption[] = [
  { entrant1GameWins: 2, entrant2GameWins: 0, label: "2–0", outcome: "entrant1" },
  { entrant1GameWins: 1, entrant2GameWins: 1, label: "1–1", outcome: "draw" },
  { entrant1GameWins: 0, entrant2GameWins: 2, label: "0–2", outcome: "entrant2" },
];

/**
 * Full game scores. Ordered by how well entrant 1 did rather than by the order
 * the spec lists them, so the picker reads as one gradient from left to right.
 */
const GAME_SCORE_OPTIONS: ResultOption[] = [
  { entrant1GameWins: 2, entrant2GameWins: 0, label: "2–0", outcome: "entrant1" },
  { entrant1GameWins: 2, entrant2GameWins: 1, label: "2–1", outcome: "entrant1" },
  { entrant1GameWins: 1, entrant2GameWins: 1, label: "1–1", outcome: "draw" },
  { entrant1GameWins: 1, entrant2GameWins: 2, label: "1–2", outcome: "entrant2" },
  { entrant1GameWins: 0, entrant2GameWins: 2, label: "0–2", outcome: "entrant2" },
];

export function resultOptions(trackGameScores: boolean): ResultOption[] {
  return trackGameScores ? GAME_SCORE_OPTIONS : MATCH_ONLY_OPTIONS;
}

/**
 * Is this pair of game-win counts a result this tournament can store?
 *
 * Deliberately strict: with score tracking off, a 2–1 is not "close enough" to
 * a win, it is a number nobody entered. Rejecting it keeps the stored data
 * honest about how much the organizer actually recorded.
 */
export function isLegalResult(
  trackGameScores: boolean,
  entrant1GameWins: number,
  entrant2GameWins: number,
): boolean {
  return resultOptions(trackGameScores).some(
    (option) =>
      option.entrant1GameWins === entrant1GameWins &&
      option.entrant2GameWins === entrant2GameWins,
  );
}

/** The stored result as a win/draw/loss from entrant 1's side. */
export function outcomeOf(
  entrant1GameWins: number,
  entrant2GameWins: number,
): ResultOption["outcome"] {
  if (entrant1GameWins > entrant2GameWins) return "entrant1";
  if (entrant1GameWins < entrant2GameWins) return "entrant2";
  return "draw";
}

/** Percentages are shown to 2 decimals — never a raw float artifact. */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** A W–L–D record as one string. */
export function formatRecord(
  wins: number,
  losses: number,
  draws: number,
): string {
  return `${wins}–${losses}–${draws}`;
}
