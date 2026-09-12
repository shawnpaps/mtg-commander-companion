import type { PodSplitInput } from "./types";
import { MIN_POD_SIZE } from "./rules";

/**
 * Pure pod splitting. Imported by both the create mutation (authoritative) and
 * the wizard's live preview, so the pod cards the organizer approves are the
 * pods they actually get — the client never ships a split up to be trusted, it
 * just runs the same function to show the same answer.
 */

/** Hand out `total` seats across `podCount` pods, largest pods first. */
function distribute(total: number, podCount: number): number[] {
  const base = Math.floor(total / podCount);
  const remainder = total % podCount;
  return Array.from(
    { length: podCount },
    (_, i) => base + (i < remainder ? 1 : 0),
  );
}

/**
 * Split a field into pod sizes.
 *
 * Sizes come out as even as possible rather than filling each pod to the target
 * before starting the next: 14 players at a target of 8 is two pods of 7, not
 * an 8 and a 6. Two even pods play a better tournament than one full one and
 * one short one, and the target reads as "about this big", not a quota.
 */
export function splitPods(input: PodSplitInput): number[] {
  const playerCount = Math.max(0, Math.floor(input.playerCount));
  if (playerCount === 0) return [];

  // Single-pod is one pod whatever the size. The wizard stops the organizer
  // choosing it above 8; the function itself stays honest about what it was
  // asked for.
  if (input.scope === "single-pod") return [playerCount];

  const target = Math.max(1, Math.floor(input.targetPodSize));
  let podCount = Math.max(1, Math.ceil(playerCount / target));

  // Never strand a handful of players in a pod too small to draft. Dropping a
  // pod and redistributing beats leaving a [8, 1].
  while (podCount > 1 && Math.floor(playerCount / podCount) < MIN_POD_SIZE) {
    podCount -= 1;
  }

  return distribute(playerCount, podCount);
}

/**
 * Deal the roster into the pods `splitPods` described, in order. Player 1 takes
 * the first seat of pod 1. Seating has no competitive meaning — round 1 is a
 * random shuffle inside each pod — so in-order is the least surprising rule.
 */
export function assignToPods<T>(players: T[], podSizes: number[]): T[][] {
  const pods: T[][] = [];
  let cursor = 0;
  for (const size of podSizes) {
    pods.push(players.slice(cursor, cursor + size));
    cursor += size;
  }
  return pods;
}

/**
 * Split packs across placements by relative weight, largest remainder first.
 *
 * Used by the wizard's distribution presets. Allocating by weight rather than
 * by fixed counts means a preset always hands out exactly the packs available —
 * "top-heavy" over 4 packs and over 12 packs are both valid, and neither can
 * over-allocate and trip the step's own validation.
 */
export function allocateByWeights(total: number, weights: number[]): number[] {
  const packs = Math.max(0, Math.floor(total));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (packs === 0 || weights.length === 0 || weightSum === 0) {
    return weights.map(() => 0);
  }

  const exact = weights.map((w) => (w / weightSum) * packs);
  const allocation = exact.map((value) => Math.floor(value));
  let leftover = packs - allocation.reduce((sum, n) => sum + n, 0);

  // Hand the rounding leftovers to the largest fractional parts, breaking ties
  // toward the higher placement so first place is never shorted by rounding.
  const byRemainder = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const { index } of byRemainder) {
    if (leftover <= 0) break;
    allocation[index] += 1;
    leftover -= 1;
  }

  return allocation;
}
