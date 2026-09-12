import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { isLegalResult } from "./results";

/**
 * Reading and reporting matches. Standings are never written here — they are
 * derived on read by `computeStandings`, so recording a result is only ever
 * "store two integers and flip a flag".
 */

/**
 * Every match in a pod, newest round first, with entrant names resolved so the
 * round list does not have to join them client-side.
 */
export const listPodMatches = query({
  args: { podId: v.id("draftPods") },
  handler: async (ctx, { podId }) => {
    const [pod, matches] = await Promise.all([
      ctx.db.get(podId),
      ctx.db
        .query("draftMatches")
        .withIndex("by_pod_round", (q) => q.eq("podId", podId))
        .collect(),
    ]);
    if (!pod) return null;

    const entrants = await ctx.db
      .query("draftEntrants")
      .withIndex("by_pod", (q) => q.eq("podId", podId))
      .collect();
    const nameOf = new Map(entrants.map((e) => [e._id, e.name]));

    const rows = matches.map((match) => ({
      _id: match._id,
      round: match.round,
      entrant1Id: match.entrant1Id,
      entrant1Name: nameOf.get(match.entrant1Id) ?? "Unknown",
      entrant2Id: match.entrant2Id,
      entrant2Name:
        match.entrant2Id === null
          ? null
          : (nameOf.get(match.entrant2Id) ?? "Unknown"),
      entrant1GameWins: match.entrant1GameWins,
      entrant2GameWins: match.entrant2GameWins,
      reported: match.reported,
      isBye: match.entrant2Id === null,
    }));

    // Highest round first: the round being played is the one the organizer
    // needs, and past rounds are reference material below it.
    rows.sort((a, b) => b.round - a.round);

    const currentRoundMatches = rows.filter((r) => r.round === pod.currentRound);
    return {
      pod,
      matches: rows,
      // The gate on generating the next round. Byes arrive already reported, so
      // they never hold a round open.
      currentRoundComplete:
        currentRoundMatches.length > 0 &&
        currentRoundMatches.every((r) => r.reported),
      maxRound: rows.length > 0 ? Math.max(...rows.map((r) => r.round)) : 0,
    };
  },
});

/**
 * Record (or correct) a match result.
 *
 * Corrections are allowed right up until the next round is paired, because
 * misclicks are common and standings are derived — a fixed result simply
 * recomputes. Once a later round exists the edit is refused: those pairings
 * were built from the result being changed, and they cannot be un-played.
 */
export const reportMatchResult = mutation({
  args: {
    matchId: v.id("draftMatches"),
    entrant1GameWins: v.float64(),
    entrant2GameWins: v.float64(),
  },
  handler: async (ctx, { matchId, entrant1GameWins, entrant2GameWins }) => {
    const match = await ctx.db.get(matchId);
    if (!match) throw new Error("Match not found");

    if (match.entrant2Id === null) {
      throw new Error("A bye is scored automatically and cannot be edited");
    }

    const pod = await ctx.db.get(match.podId);
    if (!pod) throw new Error("Pod not found");
    if (pod.status !== "active") throw new Error("Pod is not active");

    const tournament = await ctx.db.get(pod.tournamentId);
    if (!tournament) throw new Error("Tournament not found");

    if (
      !isLegalResult(
        tournament.trackGameScores,
        entrant1GameWins,
        entrant2GameWins,
      )
    ) {
      throw new Error(
        tournament.trackGameScores
          ? `${entrant1GameWins}–${entrant2GameWins} is not a legal match result`
          : `This tournament records match wins only — ${entrant1GameWins}–${entrant2GameWins} is not one of them`,
      );
    }

    // Blocked rather than allowed-with-a-warning: the later round was paired
    // from this result, and no amount of recomputation un-plays it.
    if (pod.currentRound > match.round) {
      throw new Error(
        `Round ${match.round} is closed — round ${pod.currentRound} was already paired from its results`,
      );
    }

    await ctx.db.patch(matchId, {
      entrant1GameWins,
      entrant2GameWins,
      reported: true,
    });

    return { reported: true };
  },
});

/**
 * Take a result back to unreported. The round stops being complete, which
 * re-closes the gate on generating the next one.
 */
export const clearMatchResult = mutation({
  args: { matchId: v.id("draftMatches") },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get(matchId);
    if (!match) throw new Error("Match not found");
    if (match.entrant2Id === null) {
      throw new Error("A bye is scored automatically and cannot be edited");
    }

    const pod = await ctx.db.get(match.podId);
    if (!pod) throw new Error("Pod not found");
    if (pod.currentRound > match.round) {
      throw new Error(
        `Round ${match.round} is closed — round ${pod.currentRound} was already paired from its results`,
      );
    }

    await ctx.db.patch(matchId, {
      entrant1GameWins: 0,
      entrant2GameWins: 0,
      reported: false,
    });
    return { reported: false };
  },
});

/**
 * Drop an entrant. They keep every result they have already played — those
 * still count toward their past opponents' tiebreakers — but they are left out
 * of all future pairings.
 */
export const setEntrantDropped = mutation({
  args: { entrantId: v.id("draftEntrants"), dropped: v.boolean() },
  handler: async (ctx, { entrantId, dropped }) => {
    const entrant = await ctx.db.get(entrantId);
    if (!entrant) throw new Error("Entrant not found");
    await ctx.db.patch(entrantId, { dropped });
    return { dropped };
  },
});
