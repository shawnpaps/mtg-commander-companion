import type { Id } from "../_generated/dataModel";

/**
 * The cross-spec interface for the draft feature. Every draft module imports
 * these shapes from here rather than redeclaring them, so independently built
 * pieces (engine, setup wizard, round view, prizes) fit together at merge time.
 */

/**
 * One row of computed standings. Produced by `computeStandings`, consumed by
 * the round/standings UI and by prize awarding. Always derived — never stored,
 * except in the frozen `draftFinalStandings` snapshot.
 */
export type StandingsRow = {
  entrantId: Id<"draftEntrants">;
  name: string;
  rank: number; // 1-based, ties broken by the tiebreaker chain
  matchPoints: number; // 3 win / 1 draw / 0 loss; bye counts as a win
  wins: number;
  losses: number;
  draws: number;
  omw: number; // opponents' match-win %, 0..1, 0.33 floor, byes excluded
  gw: number; // own game-win %, 0..1, 0.33 floor
  ogw: number; // opponents' game-win %, 0..1, 0.33 floor, byes excluded
  hadBye: boolean;
  dropped: boolean;
};

/**
 * One pairing produced by the pairing engine, consumed by the
 * `generatePairings` mutation which writes the `draftMatches` rows.
 */
export type Pairing = {
  entrant1Id: Id<"draftEntrants">;
  entrant2Id: Id<"draftEntrants"> | null; // null = this entrant receives the bye
};

/**
 * Result of a pairing attempt. `isComplete: false` means the round could not be
 * paired without a rematch — the caller decides how to handle exhaustion.
 */
export type PairingResult = {
  pairings: Pairing[];
  isComplete: boolean;
  byeEntrantId: Id<"draftEntrants"> | null;
};

/**
 * Input to the pure pod-splitting function. Shared so the setup wizard's live
 * preview and the server mutation compute the identical split.
 */
export type PodSplitInput = {
  playerCount: number;
  scope: "single-pod" | "multi-pod-isolated" | "multi-pod-shared";
  targetPodSize: number; // default 8
};
