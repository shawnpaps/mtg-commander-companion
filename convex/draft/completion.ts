import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { assertHostOfPod, podTournament } from "./access";
import { computeStandingsPure } from "./standings";
import { awardPacks } from "./prizes";

/**
 * Finishing a pod. This is the one place in the draft feature where computed
 * standings are written down.
 *
 * Everywhere else they are derived on read, because a player's tiebreakers keep
 * moving as their past opponents play on. Once the event is over there is
 * nothing left to move, and the snapshot exists so a later correction to some
 * match cannot silently rewrite who won the night.
 */

async function podEntrants(ctx: QueryCtx, podId: Id<"draftPods">) {
  return await ctx.db
    .query("draftEntrants")
    .withIndex("by_pod", (q) => q.eq("podId", podId))
    .collect();
}

async function podMatches(ctx: QueryCtx, podId: Id<"draftPods">) {
  return await ctx.db
    .query("draftMatches")
    .withIndex("by_pod_round", (q) => q.eq("podId", podId))
    .collect();
}

export const completePod = mutation({
  args: { podId: v.id("draftPods"), sessionId: v.id("sessions") },
  handler: async (ctx, { podId, sessionId }) => {
    const { pod, tournament } = await assertHostOfPod(ctx, podId, sessionId);

    if (pod.status !== "active") throw new Error("This pod is already finished");
    if (pod.currentRound < pod.roundCount) {
      throw new Error(
        `Round ${pod.currentRound} of ${pod.roundCount} — play the remaining rounds, or shorten the pod, before finishing`,
      );
    }

    const [matches, entrants] = await Promise.all([
      podMatches(ctx, podId),
      podEntrants(ctx, podId),
    ]);

    const unreported = matches.filter(
      (m) => m.round === pod.currentRound && !m.reported,
    ).length;
    if (unreported > 0) {
      throw new Error(
        `Round ${pod.currentRound} has ${unreported} unreported match(es); the final standings would be wrong`,
      );
    }

    const standings = computeStandingsPure(matches, entrants);
    const { awards } = awardPacks(standings, tournament.prizeDistribution);

    // In an isolated event every pod pays out of its own prize pool, so
    // "global" and "per-pod" resolve to the same thing here: the distribution
    // applied to this pod's own standings. True cross-pod ranking belongs with
    // the multi-pod-shared stub.
    for (const award of awards) {
      await ctx.db.insert("draftFinalStandings", {
        tournamentId: pod.tournamentId,
        podId,
        entrantId: award.entrantId,
        rank: award.rank,
        packsAwarded: award.packsAwarded,
      });
    }

    await ctx.db.patch(podId, { status: "complete" });

    // The tournament is over when its last pod is.
    const pods = await ctx.db
      .query("draftPods")
      .withIndex("by_tournament", (q) =>
        q.eq("tournamentId", pod.tournamentId),
      )
      .collect();
    const allDone = pods.every(
      (p) => p._id === podId || p.status === "complete",
    );
    if (allDone) {
      await ctx.db.patch(pod.tournamentId, {
        status: "complete",
        endedAt: Date.now(),
      });
    }

    return {
      podId,
      awarded: awards.filter((a) => a.packsAwarded > 0).length,
      tournamentComplete: allDone,
    };
  },
});

/**
 * The frozen result for a pod, joined back to entrant names.
 *
 * Returns null while the pod is still running — before the freeze there is no
 * snapshot, and the live standings query is the right thing to read instead.
 */
export const getFinalStandings = query({
  args: { podId: v.id("draftPods") },
  handler: async (ctx, { podId }) => {
    const { pod, tournament } = await podTournament(ctx, podId);

    const frozen = await ctx.db
      .query("draftFinalStandings")
      .withIndex("by_pod", (q) => q.eq("podId", podId))
      .collect();
    if (frozen.length === 0) return null;

    const [entrants, matches] = await Promise.all([
      podEntrants(ctx, podId),
      podMatches(ctx, podId),
    ]);
    const entrantById = new Map<Id<"draftEntrants">, Doc<"draftEntrants">>(
      entrants.map((e) => [e._id, e]),
    );

    // Rank and packs come from the snapshot. The W–L–D alongside them is
    // recomputed, which is only safe because a completed pod refuses every
    // mutation that could change a match — see the status guards in matches.ts.
    const live = computeStandingsPure(matches, entrants);
    const liveById = new Map(live.map((row) => [row.entrantId, row]));

    const rows = frozen
      .map((row) => {
        const entrant = entrantById.get(row.entrantId);
        const record = liveById.get(row.entrantId);
        return {
          entrantId: row.entrantId,
          name: entrant?.name ?? "Unknown",
          rank: row.rank,
          packsAwarded: row.packsAwarded,
          wins: record?.wins ?? 0,
          losses: record?.losses ?? 0,
          draws: record?.draws ?? 0,
          matchPoints: record?.matchPoints ?? 0,
          dropped: entrant?.dropped ?? false,
        };
      })
      .sort((a, b) => a.rank - b.rank);

    return {
      podIndex: pod.index,
      tournamentName: tournament.name,
      rows,
    };
  },
});
