import type { Id } from "../_generated/dataModel";
import type { StandingsRow } from "./types";
import { MATCH_POINTS, TIEBREAKER_FLOOR } from "./rules";

/**
 * Pure tiebreaker math. No `ctx`, no database — plain data in, plain data out,
 * so the arithmetic is verifiable on its own (see tests/draft-engine.test.ts).
 *
 * The formulas follow MTR Appendix C exactly:
 * https://blogs.magicjudges.org/rules/mtr-appendix-c/
 *
 *   MW%  = matchPoints / (3 × roundsPlayed),  floored
 *   GW%  = gamePoints  / (3 × gamesPlayed),   floored
 *   OMW% = mean of each faced opponent's floored MW%
 *   OGW% = mean of each faced opponent's floored GW%
 *
 * Two rules about byes pull in opposite directions and are easy to conflate:
 * a bye DOES count toward the bye-holder's own MW%/GW% (it is a 2–0 win, so it
 * lands in both numerator and denominator), but it contributes NO opponent to
 * anyone's OMW%/OGW% average — the bye round is skipped entirely, shrinking the
 * divisor. MTR states both directly, and its two worked examples differ only in
 * that one player's eight rounds include a bye, giving a divisor of 7.
 */

/** Structural shape of a `draftMatches` row. A `Doc<"draftMatches">` satisfies it. */
export type MatchInput = {
  round: number;
  entrant1Id: Id<"draftEntrants">;
  entrant2Id: Id<"draftEntrants"> | null;
  entrant1GameWins: number;
  entrant2GameWins: number;
  reported: boolean;
};

/** Structural shape of a `draftEntrants` row. A `Doc<"draftEntrants">` satisfies it. */
export type EntrantInput = {
  _id: Id<"draftEntrants">;
  name: string;
  hadBye: boolean;
  dropped: boolean;
};

/** Game points, per MTR: 3 per game won. */
const GAME_POINTS_PER_WIN = 3;

/**
 * Float comparisons in the sort need slack: 10/21 and 0.476190476… are the same
 * number mathematically but not bitwise, and a hair of FP noise must not
 * out-rank a genuinely equal player before the next tiebreaker gets a say.
 */
const EPSILON = 1e-9;

type Tally = {
  entrant: EntrantInput;
  matchPoints: number;
  wins: number;
  losses: number;
  draws: number;
  roundsPlayed: number; // includes byes
  gamePoints: number;
  gamesPlayed: number; // includes the bye's 2–0
  opponentIds: Id<"draftEntrants">[]; // byes contribute nothing here
};

function floored(value: number): number {
  return value < TIEBREAKER_FLOOR ? TIEBREAKER_FLOOR : value;
}

/** MW% for a tally. A player with no rounds played sits at the floor. */
function matchWinPct(t: Tally): number {
  if (t.roundsPlayed === 0) return TIEBREAKER_FLOOR;
  return floored(t.matchPoints / (3 * t.roundsPlayed));
}

/** GW% for a tally. A player with no games played sits at the floor. */
function gameWinPct(t: Tally): number {
  if (t.gamesPlayed === 0) return TIEBREAKER_FLOOR;
  return floored(t.gamePoints / (3 * t.gamesPlayed));
}

/**
 * Average an opponent percentage over the opponents actually faced. An entrant
 * whose only round was a bye has faced nobody; there is no meaningful average,
 * so we return the floor rather than 0 or NaN. That keeps the sort total and
 * stops an all-bye record from either winning or losing the tiebreak outright.
 */
function averageOverOpponents(
  opponentIds: Id<"draftEntrants">[],
  pctOf: (id: Id<"draftEntrants">) => number | undefined,
): number {
  let sum = 0;
  let count = 0;
  for (const id of opponentIds) {
    const pct = pctOf(id);
    if (pct === undefined) continue; // opponent outside this pod; shouldn't happen
    sum += pct;
    count += 1;
  }
  if (count === 0) return TIEBREAKER_FLOOR;
  return sum / count;
}

/**
 * Compute live standings for one pod.
 *
 * Unreported matches are skipped wholesale. A generated-but-unplayed round is
 * stored 0–0, and 0–0 would otherwise read as a drawn match — handing both
 * players a match point and quietly reshuffling the table the moment pairings
 * go up. Standings reflect reported results only.
 *
 * Dropped entrants keep their row and their record: they still count as
 * opponents for everyone they already played, which is why their tallies are
 * computed the same as anyone else's.
 */
export function computeStandingsPure(
  matches: MatchInput[],
  entrants: EntrantInput[],
): StandingsRow[] {
  const tallies = new Map<Id<"draftEntrants">, Tally>();
  for (const entrant of entrants) {
    tallies.set(entrant._id, {
      entrant,
      matchPoints: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      roundsPlayed: 0,
      gamePoints: 0,
      gamesPlayed: 0,
      opponentIds: [],
    });
  }

  for (const match of matches) {
    if (!match.reported) continue;

    const t1 = tallies.get(match.entrant1Id);
    if (!t1) continue; // entrant not in this pod's roster

    if (match.entrant2Id === null) {
      // A bye: scored 2–0, no opponent recorded.
      t1.matchPoints += MATCH_POINTS.win;
      t1.wins += 1;
      t1.roundsPlayed += 1;
      t1.gamePoints += match.entrant1GameWins * GAME_POINTS_PER_WIN;
      t1.gamesPlayed += match.entrant1GameWins + match.entrant2GameWins;
      continue;
    }

    const t2 = tallies.get(match.entrant2Id);
    if (!t2) continue;

    const g1 = match.entrant1GameWins;
    const g2 = match.entrant2GameWins;
    const games = g1 + g2;

    for (const [self, own, opp, oppId] of [
      [t1, g1, g2, match.entrant2Id],
      [t2, g2, g1, match.entrant1Id],
    ] as const) {
      self.roundsPlayed += 1;
      self.gamePoints += own * GAME_POINTS_PER_WIN;
      self.gamesPlayed += games;
      self.opponentIds.push(oppId);
      if (own > opp) {
        self.wins += 1;
        self.matchPoints += MATCH_POINTS.win;
      } else if (own < opp) {
        self.losses += 1;
        self.matchPoints += MATCH_POINTS.loss;
      } else {
        self.draws += 1;
        self.matchPoints += MATCH_POINTS.draw;
      }
    }
  }

  // Every opponent percentage is floored before it is averaged, so precompute
  // the floored values once and read them back when building each average.
  const mwByEntrant = new Map<Id<"draftEntrants">, number>();
  const gwByEntrant = new Map<Id<"draftEntrants">, number>();
  for (const [id, tally] of tallies) {
    mwByEntrant.set(id, matchWinPct(tally));
    gwByEntrant.set(id, gameWinPct(tally));
  }

  const rows: StandingsRow[] = [];
  for (const [id, tally] of tallies) {
    rows.push({
      entrantId: id,
      name: tally.entrant.name,
      rank: 0, // assigned after sorting
      matchPoints: tally.matchPoints,
      wins: tally.wins,
      losses: tally.losses,
      draws: tally.draws,
      omw: averageOverOpponents(tally.opponentIds, (o) => mwByEntrant.get(o)),
      gw: gwByEntrant.get(id) ?? TIEBREAKER_FLOOR,
      ogw: averageOverOpponents(tally.opponentIds, (o) => gwByEntrant.get(o)),
      hadBye: tally.entrant.hadBye,
      dropped: tally.entrant.dropped,
    });
  }

  rows.sort((a, b) => {
    if (a.matchPoints !== b.matchPoints) return b.matchPoints - a.matchPoints;
    if (Math.abs(a.omw - b.omw) > EPSILON) return b.omw - a.omw;
    if (Math.abs(a.gw - b.gw) > EPSILON) return b.gw - a.gw;
    if (Math.abs(a.ogw - b.ogw) > EPSILON) return b.ogw - a.ogw;
    // Nothing separates them on the tiebreaker chain. Fall through to name and
    // then id so the order is identical on every recompute — this query is
    // reactive, and a table that reshuffles on unrelated edits looks broken.
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.entrantId < b.entrantId ? -1 : a.entrantId > b.entrantId ? 1 : 0;
  });

  rows.forEach((row, i) => {
    row.rank = i + 1;
  });
  return rows;
}

/**
 * Who has already played whom, built from ALL matches — not just reported ones.
 * A pairing that exists but has not been played still forbids a rematch; the
 * filter here is deliberately looser than the one in `computeStandingsPure`.
 */
export function buildPriorOpponents(
  matches: MatchInput[],
): Map<Id<"draftEntrants">, Set<Id<"draftEntrants">>> {
  const map = new Map<Id<"draftEntrants">, Set<Id<"draftEntrants">>>();
  const add = (a: Id<"draftEntrants">, b: Id<"draftEntrants">) => {
    let set = map.get(a);
    if (!set) {
      set = new Set();
      map.set(a, set);
    }
    set.add(b);
  };
  for (const match of matches) {
    if (match.entrant2Id === null) continue;
    add(match.entrant1Id, match.entrant2Id);
    add(match.entrant2Id, match.entrant1Id);
  }
  return map;
}
