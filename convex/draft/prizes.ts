import type { Id } from "../_generated/dataModel";
import type { StandingsRow } from "./types";
import { formatRecord } from "./results";

/**
 * Mapping final standings onto packs. Pure, so the payout can be previewed
 * before it is frozen and asserted without a database afterwards.
 */

export type PrizeAward = {
  entrantId: Id<"draftEntrants">;
  name: string;
  rank: number;
  packsAwarded: number;
};

export type PrizeAllocation = {
  awards: PrizeAward[];
  /** Packs the distribution offered to places that nobody finished in. */
  unawarded: number;
};

/**
 * `prizeDistribution` is positional: [2, 1, 1] pays 2 packs to rank 1 and 1
 * each to ranks 2 and 3. Everyone below gets nothing.
 *
 * Awards go strictly by resolved rank. The tiebreaker chain has already put the
 * field in a total order — including a deterministic fallback when all four
 * levels tie — so there is no boundary case where two entrants genuinely share
 * a rank, and no packs to split.
 *
 * Dropping is not treated as forfeiting. A player who wins three rounds and
 * leaves before the last is still ranked where their results put them, and
 * paying by rank is the rule the organizer configured. An organizer who wants
 * otherwise can drop them from the standings by other means.
 */
export function awardPacks(
  standings: StandingsRow[],
  prizeDistribution: number[],
): PrizeAllocation {
  const awards: PrizeAward[] = standings.map((row) => ({
    entrantId: row.entrantId,
    name: row.name,
    rank: row.rank,
    packsAwarded: prizeDistribution[row.rank - 1] ?? 0,
  }));

  // A distribution paying four places in a three-player pod leaves a pack in
  // the box. Say so rather than quietly rounding it away.
  const unawarded = prizeDistribution
    .slice(standings.length)
    .reduce((sum, packs) => sum + packs, 0);

  return { awards, unawarded };
}

/**
 * A plain-text final standing, for the screenshot at the end of the night.
 * Deliberately not a table: this gets pasted into a group chat.
 */
export function formatResultsSummary(
  tournamentName: string,
  podLabel: string | null,
  rows: Array<StandingsRow & { packsAwarded: number }>,
): string {
  const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
  const header = podLabel
    ? `${tournamentName} — ${podLabel}`
    : tournamentName;

  const lines = rows.map((row) => {
    const place = ORDINALS[row.rank - 1] ?? `${row.rank}th`;
    const record = formatRecord(row.wins, row.losses, row.draws);
    const packs =
      row.packsAwarded > 0
        ? ` — ${row.packsAwarded} ${row.packsAwarded === 1 ? "pack" : "packs"}`
        : "";
    return `${place}: ${row.name} (${record})${packs}`;
  });

  return [header, ...lines].join("\n");
}
