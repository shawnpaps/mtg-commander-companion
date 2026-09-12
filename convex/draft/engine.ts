import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { StandingsRow } from "./types";
import { maxRounds } from "./rules";
import { computeStandingsPure } from "./standings";
import { planNextRound } from "./pairings";

/**
 * Thin Convex wrappers over the pure engine. Everything here is I/O and guards;
 * the arithmetic lives in standings.ts and pairings.ts so it can be tested
 * without a database.
 */

/**
 * `generatePairings` throws `draft/<reason>: <message>` for every refusal, where
 * reason is a `RoundPlanRefusal`. The prefixes are part of the contract: the
 * round view matches on them to offer the organizer the right next step —
 * notably `draft/pairing-exhausted`, where the only ways forward are allowing a
 * rematch or closing the pod.
 */
export const ROUND_ERROR_PREFIX = "draft/";

/**
 * Every match in a pod, all rounds. `by_pod_round` is a compound index, so
 * constraining only `podId` walks the whole pod in round order — one query
 * instead of the per-entrant `by_entrant1`/`by_entrant2` merge, and complete
 * for the same reason: an entrant only ever plays inside their own pod.
 */
async function podMatches(
  ctx: QueryCtx,
  podId: Id<"draftPods">,
): Promise<Doc<"draftMatches">[]> {
  return await ctx.db
    .query("draftMatches")
    .withIndex("by_pod_round", (q) => q.eq("podId", podId))
    .collect();
}

async function podEntrants(
  ctx: QueryCtx,
  podId: Id<"draftPods">,
): Promise<Doc<"draftEntrants">[]> {
  return await ctx.db
    .query("draftEntrants")
    .withIndex("by_pod", (q) => q.eq("podId", podId))
    .collect();
}

/**
 * Live standings for a pod. A query, not an action, so it recomputes and pushes
 * to every connected client the moment a result is reported — which is the
 * whole reason nothing here is cached.
 */
export const computeStandings = query({
  args: { podId: v.id("draftPods") },
  handler: async (ctx, { podId }): Promise<StandingsRow[]> => {
    const [matches, entrants] = await Promise.all([
      podMatches(ctx, podId),
      podEntrants(ctx, podId),
    ]);
    return computeStandingsPure(matches, entrants);
  },
});

/**
 * Generate the pod's next round. All of a round's writes happen here, in one
 * mutation, so a round either exists in full or not at all.
 */
export const generatePairings = mutation({
  args: { podId: v.id("draftPods") },
  handler: async (ctx, { podId }) => {
    const pod = await ctx.db.get(podId);
    if (!pod) throw new Error("Pod not found");

    const [matches, entrants] = await Promise.all([
      podMatches(ctx, podId),
      podEntrants(ctx, podId),
    ]);

    const plan = planNextRound(pod, matches, entrants);
    if (!plan.ok) {
      // Nothing has been written at this point, and nothing will be. The reason
      // code is prefixed so the round view can tell "still waiting on results"
      // apart from "this pod can no longer be paired".
      throw new Error(`draft/${plan.reason}: ${plan.message}`);
    }

    for (const pairing of plan.pairings) {
      const isBye = pairing.entrant2Id === null;
      await ctx.db.insert("draftMatches", {
        podId,
        round: plan.round,
        entrant1Id: pairing.entrant1Id,
        entrant2Id: pairing.entrant2Id,
        // A bye is scored 2–0 on the spot and marked reported: there is nothing
        // for anyone to enter, and leaving it open would stall the report guard
        // in planNextRound forever.
        entrant1GameWins: isBye ? 2 : 0,
        entrant2GameWins: 0,
        reported: isBye,
      });
    }

    if (plan.byeEntrantId !== null) {
      await ctx.db.patch(plan.byeEntrantId, { hadBye: true });
    }

    await ctx.db.patch(podId, { currentRound: plan.round });

    return {
      round: plan.round,
      pairingCount: plan.pairings.length,
      byeEntrantId: plan.byeEntrantId,
    };
  },
});

/**
 * Add a round to a pod mid-event. Nothing else needs to change: the next
 * `generatePairings` call picks up the new count on its own. The only real work
 * is refusing to push past n-1 rounds, where a rematch-free pairing stops
 * existing because the pod has become a full round robin.
 */
export const extendPodRounds = mutation({
  args: { podId: v.id("draftPods") },
  handler: async (ctx, { podId }) => {
    const pod = await ctx.db.get(podId);
    if (!pod) throw new Error("Pod not found");
    if (pod.status !== "active") throw new Error("Pod is not active");

    const entrants = await podEntrants(ctx, podId);
    const activeCount = entrants.filter((e) => !e.dropped).length;
    const nextCount = pod.roundCount + 1;
    const limit = maxRounds(activeCount);
    if (nextCount > limit) {
      throw new Error(
        `A pod of ${activeCount} can play at most ${limit} rounds without a rematch`,
      );
    }

    await ctx.db.patch(podId, { roundCount: nextCount });
    return { roundCount: nextCount };
  },
});
