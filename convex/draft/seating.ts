import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { assertHostOfPod } from "./access";

/**
 * Draft seating: where the pod physically sits for the draft, decided once
 * before round 1 and never touched by pairings or standings. A seat has no
 * bearing on who plays whom — it only records the order around the table.
 *
 * Seats are an ordered circle, not a set of labels, because pack passing
 * alternates direction: packs 1 and 3 move to each player's left, pack 2 to
 * their right, so left and right neighbors are not interchangeable. The pass
 * convention itself is fixed for every draft, so it is a display-time constant
 * here rather than a column on any table.
 *
 * Like the engine, the decisions live in pure planners (`planRandomSeating`,
 * `planSeatSwap`) and the mutations are I/O plus guards, so the rules are
 * testable without a database (tests/draft-seating.test.ts).
 */

/**
 * Which way each pack moves around the circle. Left means toward the
 * `(i + 1) % n` neighbor — see `seatNeighbors`. Derived onto the chart at
 * display time; never persisted.
 */
export const PACK_PASS_DIRECTIONS = ["left", "right", "left"] as const;

/** Structural shape of a `draftEntrants` row, as much as seating needs. */
export type SeatingEntrantInput = {
  _id: Id<"draftEntrants">;
  dropped: boolean;
  seatIndex?: number;
};

export type SeatAssignment = {
  entrantId: Id<"draftEntrants">;
  seatIndex: number;
};

export type SeatingRefusal = "seating-locked" | "not-seated" | "not-swappable";

export type RandomSeatingPlan =
  | {
      ok: true;
      assignments: SeatAssignment[];
      /** Dropped entrants still carrying a stale seat, to be unseated. */
      cleared: Id<"draftEntrants">[];
    }
  | { ok: false; reason: SeatingRefusal; message: string };

export type SwapSeatingPlan =
  | { ok: true; a: SeatAssignment; b: SeatAssignment }
  | { ok: false; reason: SeatingRefusal; message: string };

const SEATING_LOCKED = {
  ok: false as const,
  reason: "seating-locked" as const,
  message:
    "Round 1 has already been paired — the draft is underway and seating is locked",
};

/**
 * The neighbors a pack moves to, in seat-index space. Left is the next seat
 * around the circle, right is the previous one; the chart numbers seats
 * clockwise, so left reads clockwise as drawn. The mapping only has to be
 * internally consistent — what matters is that the two directions differ.
 */
export function seatNeighbors(
  seatIndex: number,
  count: number,
): { left: number; right: number } {
  return {
    left: (seatIndex + 1) % count,
    right: (seatIndex - 1 + count) % count,
  };
}

/** Fisher–Yates over 0..n-1. Round 1 pairings keep their own copy in
 *  pairings.ts; seating is independent of that code path by design. */
function shuffledSeats(n: number, rng: () => number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Plan a fresh random seating for a pod: a permutation of 0..n-1 over the
 * active entrants. This is also the re-randomize path, so it overwrites any
 * existing assignment, and it unseats dropped entrants still holding a stale
 * index — after it runs, "a dropped entrant is not seated" holds again and the
 * active seats are contiguous.
 */
export function planRandomSeating(
  pod: { currentRound: number },
  entrants: SeatingEntrantInput[],
  rng: () => number = Math.random,
): RandomSeatingPlan {
  if (pod.currentRound >= 1) return SEATING_LOCKED;

  const active = entrants.filter((e) => !e.dropped);
  const seats = shuffledSeats(active.length, rng);
  return {
    ok: true,
    assignments: active.map((entrant, i) => ({
      entrantId: entrant._id,
      seatIndex: seats[i],
    })),
    cleared: entrants
      .filter((e) => e.dropped && e.seatIndex !== undefined)
      .map((e) => e._id),
  };
}

/**
 * Plan a manual seat swap — the organizer's override primitive. Exchanges
 * exactly two active entrants' seats; everyone else is untouched, so the set
 * of seat indices is preserved by construction.
 */
export function planSeatSwap(
  pod: { currentRound: number },
  entrants: SeatingEntrantInput[],
  aId: Id<"draftEntrants">,
  bId: Id<"draftEntrants">,
): SwapSeatingPlan {
  if (pod.currentRound >= 1) return SEATING_LOCKED;
  if (aId === bId) {
    return {
      ok: false,
      reason: "not-swappable",
      message: "Pick two different players to swap",
    };
  }

  const a = entrants.find((e) => e._id === aId);
  const b = entrants.find((e) => e._id === bId);
  if (!a || !b) {
    return {
      ok: false,
      reason: "not-swappable",
      message: "Both players must be entrants in this pod",
    };
  }
  if (a.dropped || b.dropped) {
    return {
      ok: false,
      reason: "not-swappable",
      message: "A dropped player has no seat to swap",
    };
  }
  if (a.seatIndex === undefined || b.seatIndex === undefined) {
    return {
      ok: false,
      reason: "not-seated",
      message: "Assign seats before adjusting them",
    };
  }

  return {
    ok: true,
    a: { entrantId: aId, seatIndex: b.seatIndex },
    b: { entrantId: bId, seatIndex: a.seatIndex },
  };
}

/**
 * The official rule: players seat at random. Also the re-randomize action —
 * every call deals a fresh permutation, and only ever writes `seatIndex`.
 * Host-only, like every other control that runs the event.
 */
export const assignSeatsRandom = mutation({
  args: { podId: v.id("draftPods"), sessionId: v.id("sessions") },
  handler: async (ctx, { podId, sessionId }) => {
    const { pod } = await assertHostOfPod(ctx, podId, sessionId);

    const entrants = await ctx.db
      .query("draftEntrants")
      .withIndex("by_pod", (q) => q.eq("podId", podId))
      .collect();

    const plan = planRandomSeating(pod, entrants);
    if (!plan.ok) {
      // Prefixed like the engine's refusals so the pod view can match on it.
      throw new Error(`draft/${plan.reason}: ${plan.message}`);
    }

    for (const assignment of plan.assignments) {
      await ctx.db.patch(assignment.entrantId, {
        seatIndex: assignment.seatIndex,
      });
    }
    for (const entrantId of plan.cleared) {
      await ctx.db.patch(entrantId, { seatIndex: undefined });
    }

    return { seated: plan.assignments.length };
  },
});

/**
 * Swap two seated entrants. The manual-override primitive the chart's
 * tap-two-seats adjust mode is built on.
 */
export const swapSeats = mutation({
  args: {
    podId: v.id("draftPods"),
    sessionId: v.id("sessions"),
    entrantAId: v.id("draftEntrants"),
    entrantBId: v.id("draftEntrants"),
  },
  handler: async (ctx, { podId, sessionId, entrantAId, entrantBId }) => {
    const { pod } = await assertHostOfPod(ctx, podId, sessionId);

    const entrants = await ctx.db
      .query("draftEntrants")
      .withIndex("by_pod", (q) => q.eq("podId", podId))
      .collect();

    const plan = planSeatSwap(pod, entrants, entrantAId, entrantBId);
    if (!plan.ok) {
      throw new Error(`draft/${plan.reason}: ${plan.message}`);
    }

    await ctx.db.patch(plan.a.entrantId, { seatIndex: plan.a.seatIndex });
    await ctx.db.patch(plan.b.entrantId, { seatIndex: plan.b.seatIndex });

    return { swapped: [plan.a.entrantId, plan.b.entrantId] };
  },
});
