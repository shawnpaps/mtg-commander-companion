/**
 * Seating tests for the draft feature (spec 06 — pod seating chart).
 *
 * The planners in convex/draft/seating.ts are pure, so the guard rails — the
 * round-1 lock, dropped-entrant exclusion, contiguous seats, exact-two swap —
 * are driven directly here. Runs on plain node via `npm run test:seating`.
 */

import type { Id } from "../convex/_generated/dataModel";
import {
  PACK_PASS_DIRECTIONS,
  planRandomSeating,
  planSeatSwap,
  seatNeighbors,
  type SeatAssignment,
  type SeatingEntrantInput,
} from "../convex/draft/seating";

// ---------------------------------------------------------------- harness ---

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  check(name, Object.is(actual, expected), `expected ${expected}, got ${actual}`);
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ------------------------------------------------------------- fixtures ----

const id = (s: string) => s as unknown as Id<"draftEntrants">;

function entrant(
  name: string,
  opts: { dropped?: boolean; seatIndex?: number } = {},
): SeatingEntrantInput {
  return { _id: id(name), dropped: opts.dropped ?? false, seatIndex: opts.seatIndex };
}

function pod(currentRound: number) {
  return { currentRound };
}

function roster(n: number): SeatingEntrantInput[] {
  return Array.from({ length: n }, (_, i) => entrant(`p${i}`));
}

/** Deterministic rng so permutations are reproducible in assertions. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function seatSet(assignments: SeatAssignment[]): string {
  return assignments
    .map((a) => a.seatIndex)
    .sort((a, b) => a - b)
    .join(",");
}

function applySeats(
  entrants: SeatingEntrantInput[],
  assignments: SeatAssignment[],
): SeatingEntrantInput[] {
  return entrants.map((e) => {
    const a = assignments.find((x) => x.entrantId === e._id);
    return a ? { ...e, seatIndex: a.seatIndex } : e;
  });
}

// ----------------------------------------------------------------- tests ---

section("planRandomSeating — a fresh pod gets 0..n-1, each entrant once");
{
  const entrants = roster(8);
  const plan = planRandomSeating(pod(0), entrants, lcg(42));
  check("plan ok", plan.ok);
  if (plan.ok) {
    eq("8 seats handed out", plan.assignments.length, 8);
    eq("seats are exactly 0..7", seatSet(plan.assignments), "0,1,2,3,4,5,6,7");
    eq(
      "every entrant seated exactly once",
      new Set(plan.assignments.map((a) => a.entrantId)).size,
      8,
    );
    eq("nobody to clear on a fresh seating", plan.cleared.length, 0);
  }
}

section("planRandomSeating — rng drives the order");
{
  const entrants = roster(8);
  const a = planRandomSeating(pod(0), entrants, lcg(7));
  const b = planRandomSeating(pod(0), entrants, lcg(7));
  const c = planRandomSeating(pod(0), entrants, lcg(8));
  const orderOf = (p: typeof a) =>
    p.ok ? p.assignments.map((x) => x.seatIndex).join(",") : "";
  eq("same seed, same permutation", orderOf(a), orderOf(b));
  check(
    "different seeds, different orders",
    orderOf(a) !== orderOf(c),
    `${orderOf(a)} vs ${orderOf(c)}`,
  );
}

section("planRandomSeating — re-running overwrites the prior seating");
{
  // A pod already seated in roster order; the new plan must still be a clean
  // permutation rather than unioning with what was there.
  const seated = roster(8).map((e, i) => ({ ...e, seatIndex: i }));
  const plan = planRandomSeating(pod(0), seated, lcg(99));
  check("plan ok", plan.ok);
  if (plan.ok) {
    eq("still exactly 0..7", seatSet(plan.assignments), "0,1,2,3,4,5,6,7");
    eq("everyone reseated", plan.assignments.length, 8);
  }
}

section("planRandomSeating — dropped entrants are excluded and unseated");
{
  const entrants = [
    ...roster(7),
    entrant("gone", { dropped: true, seatIndex: 3 }), // stale seat from before the drop
  ];
  const plan = planRandomSeating(pod(0), entrants, lcg(1));
  check("plan ok", plan.ok);
  if (plan.ok) {
    eq("7 active seats", plan.assignments.length, 7);
    eq("contiguous 0..6", seatSet(plan.assignments), "0,1,2,3,4,5,6");
    check(
      "dropped entrant not seated",
      plan.assignments.every((a) => a.entrantId !== id("gone")),
    );
    eq("stale seat cleared", plan.cleared.join(","), "gone");
  }
}

section("planRandomSeating — locked once round 1 exists");
{
  const entrants = roster(8);
  for (const round of [1, 2, 3]) {
    const plan = planRandomSeating(pod(round), entrants, lcg(1));
    eq(`currentRound ${round} refused`, plan.ok, false);
    if (!plan.ok) eq("reason", plan.reason, "seating-locked");
  }
  check("currentRound 0 allowed", planRandomSeating(pod(0), entrants, lcg(1)).ok);
}

section("planRandomSeating — empty and singleton pods");
{
  const empty = planRandomSeating(pod(0), [], lcg(1));
  check("empty pod is ok", empty.ok);
  if (empty.ok) eq("no assignments", empty.assignments.length, 0);
  const solo = planRandomSeating(pod(0), roster(1), lcg(1));
  if (solo.ok) eq("one entrant takes seat 0", seatSet(solo.assignments), "0");
}

section("planSeatSwap — exchanges exactly two seats");
{
  const entrants = applySeats(
    roster(8),
    (planRandomSeating(pod(0), roster(8), lcg(5)) as { assignments: SeatAssignment[] })
      .assignments,
  );
  const seatOf = (name: string) =>
    entrants.find((e) => e._id === id(name))?.seatIndex;

  const plan = planSeatSwap(pod(0), entrants, id("p2"), id("p5"));
  check("plan ok", plan.ok);
  if (plan.ok) {
    eq("a takes b's seat", plan.a.seatIndex, seatOf("p5"));
    eq("b takes a's seat", plan.b.seatIndex, seatOf("p2"));

    const swapped = entrants.map((e) => {
      if (e._id === id("p2")) return { ...e, seatIndex: plan.ok ? plan.a.seatIndex : -1 };
      if (e._id === id("p5")) return { ...e, seatIndex: plan.ok ? plan.b.seatIndex : -1 };
      return e;
    });
    eq(
      "seat set is still exactly 0..7",
      seatSet(
        swapped.map((e) => ({ entrantId: e._id, seatIndex: e.seatIndex ?? -1 })),
      ),
      "0,1,2,3,4,5,6,7",
    );
    check(
      "no third entrant moved",
      swapped.every(
        (e, i) =>
          e._id === id("p2") ||
          e._id === id("p5") ||
          e.seatIndex === entrants[i].seatIndex,
      ),
    );
  }
}

section("planSeatSwap — refusals");
{
  const seated = roster(6).map((e, i) => ({ ...e, seatIndex: i }));

  const locked = planSeatSwap(pod(1), seated, id("p0"), id("p1"));
  eq("locked pod refused", locked.ok, false);
  if (!locked.ok) eq("reason", locked.reason, "seating-locked");

  const same = planSeatSwap(pod(0), seated, id("p0"), id("p0"));
  eq("same entrant refused", same.ok, false);
  if (!same.ok) eq("reason", same.reason, "not-swappable");

  const unseated = [...seated, entrant("late")];
  const noSeat = planSeatSwap(pod(0), unseated, id("p0"), id("late"));
  eq("unseated entrant refused", noSeat.ok, false);
  if (!noSeat.ok) eq("reason", noSeat.reason, "not-seated");

  const withDrop = seated.map((e) =>
    e._id === id("p3") ? { ...e, dropped: true } : e,
  );
  const dropped = planSeatSwap(pod(0), withDrop, id("p0"), id("p3"));
  eq("dropped entrant refused", dropped.ok, false);
  if (!dropped.ok) eq("reason", dropped.reason, "not-swappable");

  const outsider = planSeatSwap(pod(0), seated, id("p0"), id("other-pod"));
  eq("entrant from another pod refused", outsider.ok, false);
  if (!outsider.ok) eq("reason", outsider.reason, "not-swappable");
}

section("Drop before the draft, then re-seat — acceptance path");
{
  // Seat 8, one drops before round 1, organizer re-randomizes: the remaining
  // 7 must land on a contiguous 0..6 and the dropped entrant ends unseated.
  const first = planRandomSeating(pod(0), roster(8), lcg(11));
  if (!first.ok) throw new Error("setup failed");
  const after = applySeats(roster(8), first.assignments).map((e) =>
    e._id === id("p4") ? { ...e, dropped: true } : e,
  );

  // Swaps never touch the dropped player, even with their stale seat.
  const swap = planSeatSwap(pod(0), after, id("p0"), id("p4"));
  eq("swapping with the dropped entrant refused", swap.ok, false);

  const reseat = planRandomSeating(pod(0), after, lcg(12));
  check("reseat ok", reseat.ok);
  if (reseat.ok) {
    eq("contiguous over the remaining 7", seatSet(reseat.assignments), "0,1,2,3,4,5,6");
    check(
      "dropped entrant not seated",
      reseat.assignments.every((a) => a.entrantId !== id("p4")),
    );
    eq("dropped entrant's stale seat cleared", reseat.cleared.join(","), "p4");
  }
}

section("seatNeighbors — the circle wraps both ways");
{
  eq("seat 0 of 8", seatNeighbors(0, 8).left, 1);
  eq("seat 0 of 8 right", seatNeighbors(0, 8).right, 7);
  eq("seat 7 of 8 wraps left", seatNeighbors(7, 8).left, 0);
  eq("seat 7 of 8 right", seatNeighbors(7, 8).right, 6);
  eq("middle seat", seatNeighbors(3, 8).left, 4);
  eq("middle seat right", seatNeighbors(3, 8).right, 2);
  // In a two-seat pod the same player sits on both sides.
  eq("two-seat left", seatNeighbors(0, 2).left, 1);
  eq("two-seat right", seatNeighbors(0, 2).right, 1);
}

section("Pass convention — fixed, derived, never stored");
{
  eq("packs pass left, right, left", PACK_PASS_DIRECTIONS.join(","), "left,right,left");
}

console.log(
  `\n${passed} passed, ${failures.length} failed` +
    (failures.length ? `\n\n${failures.map((f) => `  - ${f}`).join("\n")}` : ""),
);
process.exit(failures.length === 0 ? 0 : 1);
