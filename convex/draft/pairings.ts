import type { Id } from "../_generated/dataModel";
import type { Pairing, PairingResult, StandingsRow } from "./types";
import {
  buildPriorOpponents,
  computeStandingsPure,
  type EntrantInput,
  type MatchInput,
} from "./standings";

/**
 * Pure Swiss pairing. No `ctx`, no database — the caller supplies standings and
 * the prior-opponent graph, and gets back a proposed round.
 *
 * Round 1 is a seeded shuffle. Round 2+ walks the standings in rank order and
 * pairs each entrant with the nearest-ranked opponent they have not yet played.
 * Because the list is already sorted by match points, "nearest-ranked" IS
 * within-bracket pairing, and crossing a bracket boundary IS a pair-down — the
 * brackets never need to be materialized.
 *
 * Rematch avoidance is a depth-first search rather than a single greedy sweep:
 * the greedy choice at the top of the table can strand two players at the
 * bottom who have already met, and the fix is to back up and re-pair higher.
 * That is the "swap between adjacent pairings" rule, generalized so it also
 * handles the cases a single swap cannot.
 */

type PriorOpponents = Map<Id<"draftEntrants">, Set<Id<"draftEntrants">>>;

/**
 * Safety valve for the search. Real pods are small and the greedy-first
 * ordering means the first branch almost always succeeds, but a near-round-robin
 * pod can in principle blow up. Exhausting the budget is reported as
 * `isComplete: false`, which fails toward asking the organizer rather than
 * toward silently emitting a rematch.
 */
const MAX_SEARCH_STEPS = 500_000;

/** Deterministic PRNG so a given seed always produces the same round 1. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pair an ordered list so that no pairing is a rematch, or return null if no
 * such pairing exists. The list is consumed head-first: the top entrant is
 * matched against the earliest legal candidate, then the remainder is solved
 * recursively, backtracking to the next candidate on failure.
 */
function pairOrdered(
  order: StandingsRow[],
  prior: PriorOpponents,
  budget: { steps: number },
): Pairing[] | null {
  // States that already proved unpairable. The same remainder is reachable by
  // several different paths, and without this the search re-explores each one.
  const dead = new Set<string>();

  const search = (list: StandingsRow[]): Pairing[] | null => {
    if (list.length === 0) return [];
    if (budget.steps <= 0) return null;

    const key = list.map((r) => r.entrantId).join(",");
    if (dead.has(key)) return null;

    const first = list[0];
    const played = prior.get(first.entrantId);
    const rest = list.slice(1);

    for (let j = 0; j < rest.length; j++) {
      budget.steps -= 1;
      if (budget.steps <= 0) return null;

      const candidate = rest[j];
      if (played?.has(candidate.entrantId)) continue;

      const remainder = rest.slice(0, j).concat(rest.slice(j + 1));
      const sub = search(remainder);
      if (sub !== null) {
        return [
          {
            entrant1Id: first.entrantId,
            entrant2Id: candidate.entrantId,
          },
          ...sub,
        ];
      }
    }

    dead.add(key);
    return null;
  };

  return search(order);
}

/**
 * Choose bye candidates, lowest-standing first.
 *
 * The bye belongs to the bottom of the table, and nobody may take a second one
 * while a first-time candidate is available. When every remaining entrant has
 * already had a bye — only reachable in an odd pod played to near round-robin —
 * somebody still has to sit out, so eligibility relaxes and the lowest-standing
 * entrant takes a second. Returning the full ordered list rather than a single
 * pick lets the caller retry: the lowest-standing choice can occasionally leave
 * a remainder that cannot be paired, while the next candidate up can.
 */
function byeCandidates(order: StandingsRow[]): StandingsRow[] {
  const lowestFirst = order.slice().reverse();
  const fresh = lowestFirst.filter((r) => !r.hadBye);
  return fresh.length > 0 ? fresh : lowestFirst;
}

export function generatePairingsPure(
  standings: StandingsRow[],
  priorOpponents: PriorOpponents,
  round: number,
  rngSeed?: number,
): PairingResult {
  // Dropped entrants are out of the pairing pool from this round on. They keep
  // their existing results — that is a standings concern, not a pairing one.
  const active = standings.filter((r) => !r.dropped);

  const empty: PairingResult = {
    pairings: [],
    isComplete: true,
    byeEntrantId: null,
  };
  if (active.length === 0) return empty;
  if (active.length === 1) {
    // A one-entrant pod is degenerate, but the single entrant still gets a bye
    // rather than an empty round.
    return {
      pairings: [{ entrant1Id: active[0].entrantId, entrant2Id: null }],
      isComplete: true,
      byeEntrantId: active[0].entrantId,
    };
  }

  // Round 1 has no standings to speak of, so seat order is random. Later rounds
  // arrive already sorted by the tiebreaker chain.
  const order =
    round <= 1
      ? shuffled(
          active,
          rngSeed === undefined ? Math.random : mulberry32(rngSeed),
        )
      : active;

  const budget = { steps: MAX_SEARCH_STEPS };

  if (order.length % 2 === 0) {
    const pairings = pairOrdered(order, priorOpponents, budget);
    if (pairings === null) {
      return { pairings: [], isComplete: false, byeEntrantId: null };
    }
    return { pairings, isComplete: true, byeEntrantId: null };
  }

  for (const candidate of byeCandidates(order)) {
    const remainder = order.filter((r) => r.entrantId !== candidate.entrantId);
    const pairings = pairOrdered(remainder, priorOpponents, budget);
    if (pairings !== null) {
      return {
        pairings: [
          ...pairings,
          { entrant1Id: candidate.entrantId, entrant2Id: null },
        ],
        isComplete: true,
        byeEntrantId: candidate.entrantId,
      };
    }
    if (budget.steps <= 0) break;
  }

  return { pairings: [], isComplete: false, byeEntrantId: null };
}

// ---------------------------------------------------------- round planning ---

/**
 * Everything the next round depends on, decided without touching the database.
 *
 * The guards live here rather than in the mutation so that "can this pod pair
 * round 4?" is answerable — and testable — from plain data. The mutation's job
 * shrinks to reading, calling this once, and writing the result.
 */

/** Structural shape of a `draftPods` row. A `Doc<"draftPods">` satisfies it. */
export type PodInput = {
  roundCount: number;
  currentRound: number;
  status: "active" | "complete";
};

export type RoundPlanRefusal =
  | "pod-not-active"
  | "rounds-exhausted"
  | "unreported-results"
  | "already-paired"
  | "pairing-exhausted";

export type RoundPlan =
  | {
      ok: true;
      round: number;
      pairings: Pairing[];
      byeEntrantId: Id<"draftEntrants"> | null;
    }
  | { ok: false; reason: RoundPlanRefusal; message: string };

/**
 * Decide the pod's next round, or explain why there isn't one.
 *
 * Refusals are values rather than exceptions because most of them are ordinary
 * states the UI needs to render — "two results still outstanding" is a prompt,
 * not a crash. Only the caller decides which ones become thrown errors.
 */
export function planNextRound(
  pod: PodInput,
  matches: MatchInput[],
  entrants: EntrantInput[],
): RoundPlan {
  if (pod.status !== "active") {
    return { ok: false, reason: "pod-not-active", message: "Pod is not active" };
  }

  if (pod.currentRound >= pod.roundCount) {
    return {
      ok: false,
      reason: "rounds-exhausted",
      message: `Pod has already played all ${pod.roundCount} rounds; extend the pod to add another`,
    };
  }

  const nextRound = pod.currentRound + 1;

  // Round 1 is exempt — there is no previous round to report.
  if (pod.currentRound >= 1) {
    const unreported = matches.filter(
      (m) => m.round === pod.currentRound && !m.reported,
    ).length;
    if (unreported > 0) {
      return {
        ok: false,
        reason: "unreported-results",
        message: `Round ${pod.currentRound} has ${unreported} unreported match(es); report them before pairing round ${nextRound}`,
      };
    }
  }

  // `currentRound` and the match rows are written in the same mutation, so a row
  // for the round we are about to generate means something already ran.
  if (matches.some((m) => m.round === nextRound)) {
    return {
      ok: false,
      reason: "already-paired",
      message: `Round ${nextRound} has already been paired`,
    };
  }

  const standings = computeStandingsPure(matches, entrants);
  const result = generatePairingsPure(
    standings,
    buildPriorOpponents(matches),
    nextRound,
  );

  if (!result.isComplete) {
    return {
      ok: false,
      reason: "pairing-exhausted",
      message: `Round ${nextRound} cannot be paired without a rematch`,
    };
  }

  return {
    ok: true,
    round: nextRound,
    pairings: result.pairings,
    byeEntrantId: result.byeEntrantId,
  };
}
