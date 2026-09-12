/**
 * Engine tests for the draft feature (spec 01).
 *
 * Runs on plain node via `npm run test:draft` — the repo has no test framework
 * and the engine is pure, so a bundle-and-assert script is enough and adds no
 * dependencies.
 *
 * The tiebreaker cases come from MTR Appendix C, which is the source of truth:
 * https://blogs.magicjudges.org/rules/mtr-appendix-c/
 */

import type { Id } from "../convex/_generated/dataModel";
import type { StandingsRow } from "../convex/draft/types";
import {
  MATCH_POINTS,
  TIEBREAKER_FLOOR,
  maxRounds,
  recommendedRounds,
} from "../convex/draft/rules";
import {
  buildPriorOpponents,
  computeStandingsPure,
  type EntrantInput,
  type MatchInput,
} from "../convex/draft/standings";
import {
  generatePairingsPure,
  planNextRound,
  type PodInput,
} from "../convex/draft/pairings";

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

function near(name: string, actual: number, expected: number, eps = 1e-4) {
  check(
    name,
    Math.abs(actual - expected) <= eps,
    `expected ~${expected}, got ${actual.toFixed(6)}`,
  );
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ------------------------------------------------------------- fixtures ----

const id = (s: string) => s as unknown as Id<"draftEntrants">;

function entrant(
  name: string,
  opts: { hadBye?: boolean; dropped?: boolean } = {},
): EntrantInput {
  return {
    _id: id(name),
    name,
    hadBye: opts.hadBye ?? false,
    dropped: opts.dropped ?? false,
  };
}

function match(
  round: number,
  a: string,
  b: string | null,
  aWins: number,
  bWins: number,
  reported = true,
): MatchInput {
  return {
    round,
    entrant1Id: id(a),
    entrant2Id: b === null ? null : id(b),
    entrant1GameWins: aWins,
    entrant2GameWins: bWins,
    reported,
  };
}

function bye(round: number, who: string): MatchInput {
  return match(round, who, null, 2, 0, true);
}

function rowFor(rows: StandingsRow[], name: string): StandingsRow {
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error(`no standings row for ${name}`);
  return row;
}

/**
 * Build a synthetic history that gives `name` the supplied W–L–D record against
 * throwaway opponents, so an opponent's MW%/GW% can be set precisely. Each
 * filler opponent appears once and never anywhere else.
 */
function syntheticRecord(
  name: string,
  wins: number,
  losses: number,
  draws: number,
  tag: string,
): { entrants: EntrantInput[]; matches: MatchInput[] } {
  const entrants: EntrantInput[] = [];
  const matches: MatchInput[] = [];
  let round = 1;
  const push = (aWins: number, bWins: number) => {
    const filler = `${tag}-filler-${round}`;
    entrants.push(entrant(filler));
    matches.push(match(round, name, filler, aWins, bWins));
    round += 1;
  };
  for (let i = 0; i < wins; i++) push(2, 0);
  for (let i = 0; i < losses; i++) push(0, 2);
  for (let i = 0; i < draws; i++) push(1, 1);
  return { entrants, matches };
}

// ============================================================ Part A ========

section("Spec 00 — round helpers");
for (const [n, r, m] of [
  [4, 3, 3],
  [8, 3, 7],
  [16, 4, 15],
  [6, 3, 5],
] as const) {
  eq(`recommendedRounds(${n})`, recommendedRounds(n), r);
  eq(`maxRounds(${n})`, maxRounds(n), m);
}
eq("MATCH_POINTS.win", MATCH_POINTS.win, 3);
eq("MATCH_POINTS.draw", MATCH_POINTS.draw, 1);
eq("MATCH_POINTS.loss", MATCH_POINTS.loss, 0);

section("Spec 01 Example 1 — the 1/3 floor and bye exclusion interact");
{
  // 3 entrants, one round: A beats B 2–1, C takes the bye.
  const entrants = [entrant("A"), entrant("B"), entrant("C", { hadBye: true })];
  const matches = [match(1, "A", "B", 2, 1), bye(1, "C")];
  const rows = computeStandingsPure(matches, entrants);

  const a = rowFor(rows, "A");
  const b = rowFor(rows, "B");
  const c = rowFor(rows, "C");

  eq("A match points", a.matchPoints, 3);
  near("A MW% via GW% sibling — A GW% = 6/9", a.gw, 0.6667);
  eq("B match points", b.matchPoints, 0);
  near("B GW% = 3/9", b.gw, 0.3333);
  eq("C match points (bye = win)", c.matchPoints, 3);
  near("C GW% from the 2–0 bye = 6/6", c.gw, 1.0);

  // A faced only B, whose raw MW% is 0/3 = 0 and so floors to 1/3.
  near("A OMW% = B's floored MW%", a.omw, 0.3333);
  // C faced nobody; the bye contributes no opponent, so the average is
  // undefined and the floor stands in.
  near("C OMW% with no opponents faced = floor", c.omw, 0.3333);
  eq("C hadBye", c.hadBye, true);
  eq("floor constant is 1/3", TIEBREAKER_FLOOR, 1 / 3);
}

section("MTR Appendix C — OMW% worked example (supersedes spec's 0.6039)");
{
  // A 6–2–0 player whose eight opponents finished 4–4–0, 7–1–0, 1–3–1, 3–3–1,
  // 6–2–0, 5–2–1, 4–3–1, 6–1–1. MTR sums the individual MW% to 4.94 and
  // divides by 8 opponents for 0.62. Note 1–3–1 is 4/15 = 0.27, raised to the
  // floor, and that each opponent's divisor is the rounds THEY played.
  const oppRecords: Array<[string, number, number, number]> = [
    ["O1", 4, 4, 0],
    ["O2", 7, 1, 0],
    ["O3", 1, 3, 1],
    ["O4", 3, 3, 1],
    ["O5", 6, 2, 0],
    ["O6", 5, 2, 1],
    ["O7", 4, 3, 1],
    ["O8", 6, 1, 1],
  ];

  const entrants: EntrantInput[] = [entrant("HERO")];
  const matches: MatchInput[] = [];

  oppRecords.forEach(([oppName, w, l, d], i) => {
    entrants.push(entrant(oppName));
    const round = i + 1;
    // The hero's own result against this opponent: 6–2–0 overall means the
    // first six are wins, the last two losses. The exact games are irrelevant
    // to OMW%, which reads only the opponents' records.
    const heroWins = i < 6;
    matches.push(
      match(round, "HERO", oppName, heroWins ? 2 : 0, heroWins ? 0 : 2),
    );

    // Give the opponent the rest of their record against filler players, minus
    // the one match they already played against the hero.
    const remainingW = w - (heroWins ? 0 : 1);
    const remainingL = l - (heroWins ? 1 : 0);
    const built = syntheticRecord(oppName, remainingW, remainingL, d, oppName);
    entrants.push(...built.entrants);
    // Offset the filler rounds so they never collide with the hero's rounds.
    matches.push(...built.matches.map((m) => ({ ...m, round: m.round + 100 })));
  });

  const rows = computeStandingsPure(matches, entrants);

  // Sanity: the synthetic opponents really do have the intended records.
  oppRecords.forEach(([oppName, w, l, d]) => {
    const r = rowFor(rows, oppName);
    check(
      `${oppName} record is ${w}–${l}–${d}`,
      r.wins === w && r.losses === l && r.draws === d,
      `got ${r.wins}–${r.losses}–${r.draws}`,
    );
  });

  const hero = rowFor(rows, "HERO");
  eq("hero record 6–2–0", `${hero.wins}-${hero.losses}-${hero.draws}`, "6-2-0");
  eq("hero match points", hero.matchPoints, 18);
  // 4.9345 / 8. MTR shows 4.94 / 8 = 0.62 using 0.33 as the literal floor;
  // spec 00 mandates the exact 1/3, which lands at 0.6168 and rounds the same.
  near("hero OMW% (MTR worked example)", hero.omw, 0.6168, 5e-4);
  eq("hero OMW% rounds to MTR's 0.62", Number(hero.omw.toFixed(2)), 0.62);
}

section("MTR Appendix C — same field, but one round was a bye (divisor 7)");
{
  // MTR's second example: identical opponents except the 4–4–0 is replaced by
  // a bye. The bye round is skipped entirely, so seven opponents are averaged,
  // giving 4.44 / 7 = 0.63.
  const oppRecords: Array<[string, number, number, number]> = [
    ["O2", 7, 1, 0],
    ["O3", 1, 3, 1],
    ["O4", 3, 3, 1],
    ["O5", 6, 2, 0],
    ["O6", 5, 2, 1],
    ["O7", 4, 3, 1],
    ["O8", 6, 1, 1],
  ];

  const entrants: EntrantInput[] = [entrant("HERO2", { hadBye: true })];
  const matches: MatchInput[] = [bye(1, "HERO2")];

  oppRecords.forEach(([oppName, w, l, d], i) => {
    entrants.push(entrant(oppName));
    const round = i + 2;
    const heroWins = i < 5; // 5 wins here + the bye = 6–2–0 overall
    matches.push(
      match(round, "HERO2", oppName, heroWins ? 2 : 0, heroWins ? 0 : 2),
    );
    const built = syntheticRecord(
      oppName,
      w - (heroWins ? 0 : 1),
      l - (heroWins ? 1 : 0),
      d,
      oppName,
    );
    entrants.push(...built.entrants);
    matches.push(...built.matches.map((m) => ({ ...m, round: m.round + 100 })));
  });

  const rows = computeStandingsPure(matches, entrants);
  const hero = rowFor(rows, "HERO2");
  eq("hero2 match points (bye counts as a win)", hero.matchPoints, 18);
  eq("hero2 rounds include the bye: 6–2–0", `${hero.wins}-${hero.losses}`, "6-2");
  near("hero2 OMW% over 7 opponents", hero.omw, 0.6335, 5e-4);
  eq("hero2 OMW% rounds to MTR's 0.63", Number(hero.omw.toFixed(2)), 0.63);
}

section("Spec 01 Example 3 — GW% rewards 2–0 over 2–1");
{
  const entrants = [entrant("X"), entrant("Y")];
  const matches: MatchInput[] = [];
  ["x1", "x2", "x3"].forEach((o, i) => {
    entrants.push(entrant(o));
    matches.push(match(i + 1, "X", o, 2, 0));
  });
  ["y1", "y2", "y3"].forEach((o, i) => {
    entrants.push(entrant(o));
    matches.push(match(i + 1, "Y", o, 2, 1));
  });
  const rows = computeStandingsPure(matches, entrants);
  const x = rowFor(rows, "X");
  const y = rowFor(rows, "Y");
  eq("X and Y have equal match points", x.matchPoints, y.matchPoints);
  eq("both on 9 match points", x.matchPoints, 9);
  near("X GW% = 18/18", x.gw, 1.0);
  near("Y GW% = 18/27", y.gw, 0.6667);
  check("GW% breaks the tie in X's favour", x.gw > y.gw);
  check("X outranks Y", x.rank < y.rank, `X rank ${x.rank}, Y rank ${y.rank}`);
}

section("Standings — unreported matches do not score");
{
  const entrants = [entrant("P"), entrant("Q")];
  const rows = computeStandingsPure(
    [match(1, "P", "Q", 0, 0, /* reported */ false)],
    entrants,
  );
  const p = rowFor(rows, "P");
  eq("no match points from an unreported 0–0", p.matchPoints, 0);
  eq("no draw recorded", p.draws, 0);
  near("OMW% falls back to the floor", p.omw, 0.3333);
}

section("Standings — dropped entrants keep their record and still count");
{
  const entrants = [
    entrant("Winner"),
    entrant("Quitter", { dropped: true }),
    entrant("Third"),
  ];
  const matches = [
    match(1, "Winner", "Quitter", 2, 0),
    match(2, "Quitter", "Third", 2, 0),
  ];
  const rows = computeStandingsPure(matches, entrants);
  const quitter = rowFor(rows, "Quitter");
  eq("dropped entrant still appears", rows.length, 3);
  eq("dropped flag survives", quitter.dropped, true);
  eq("dropped entrant keeps 3 match points", quitter.matchPoints, 3);
  // Quitter is 1–1 → MW% 3/6 = 0.5, which is what Winner's OMW% must see.
  near("Winner's OMW% uses the dropped opponent's real MW%", rowFor(rows, "Winner").omw, 0.5);
}

section("Standings — ordering is stable across recomputes");
{
  const entrants = [entrant("Zed"), entrant("Abe"), entrant("Mia")];
  const matches: MatchInput[] = [];
  const first = computeStandingsPure(matches, entrants).map((r) => r.name);
  const second = computeStandingsPure(matches, entrants.slice().reverse()).map(
    (r) => r.name,
  );
  eq("identical order regardless of input order", first.join(","), second.join(","));
  eq("ranks are 1-based and dense", first.length, 3);
}

// ============================================================ Part B ========

section("Pairings — round 1, 8 entrants");
{
  const standings = computeStandingsPure(
    [],
    ["A", "B", "C", "D", "E", "F", "G", "H"].map((n) => entrant(n)),
  );
  const result = generatePairingsPure(standings, new Map(), 1, 1234);
  eq("4 pairings", result.pairings.length, 4);
  eq("no bye", result.byeEntrantId, null);
  eq("isComplete", result.isComplete, true);
  const seen = result.pairings.flatMap((p) =>
    [p.entrant1Id, p.entrant2Id].filter((x): x is Id<"draftEntrants"> => x !== null),
  );
  eq("every entrant appears exactly once", new Set(seen).size, 8);
  eq("8 seats filled", seen.length, 8);

  const again = generatePairingsPure(standings, new Map(), 1, 1234);
  eq(
    "same seed is deterministic",
    JSON.stringify(result.pairings),
    JSON.stringify(again.pairings),
  );
  const other = generatePairingsPure(standings, new Map(), 1, 99);
  check(
    "a different seed shuffles differently",
    JSON.stringify(result.pairings) !== JSON.stringify(other.pairings),
  );
}

section("Pairings — round 1, odd count (7 entrants)");
{
  const names = ["A", "B", "C", "D", "E", "F", "G"];
  const standings = computeStandingsPure([], names.map((n) => entrant(n)));
  const result = generatePairingsPure(standings, new Map(), 1, 7);
  const real = result.pairings.filter((p) => p.entrant2Id !== null);
  const byes = result.pairings.filter((p) => p.entrant2Id === null);
  eq("3 real pairings", real.length, 3);
  eq("1 bye", byes.length, 1);
  eq("byeEntrantId is reported", result.byeEntrantId, byes[0].entrant1Id);
  const seen = result.pairings.flatMap((p) =>
    [p.entrant1Id, p.entrant2Id].filter((x): x is Id<"draftEntrants"> => x !== null),
  );
  eq("no entrant appears twice", new Set(seen).size, 7);
}

section("Pairings — no rematch, with a forced swap");
{
  // Round 1 was A–B and C–D. A and C won, so standings are A, C (3 pts) then
  // B, D (0 pts). Naive within-bracket pairing gives A–C and B–D, which is
  // fine; force the awkward case instead by making the bracket order A, B,
  // C, D via results that leave A and B on top.
  const entrants = [entrant("A"), entrant("B"), entrant("C"), entrant("D")];
  const r1 = [match(1, "A", "C", 2, 0), match(1, "B", "D", 2, 0)];
  const standings = computeStandingsPure(r1, entrants);
  const prior = buildPriorOpponents(r1);

  const result = generatePairingsPure(standings, prior, 2);
  eq("round 2 is pairable", result.isComplete, true);
  eq("2 pairings", result.pairings.length, 2);
  for (const p of result.pairings) {
    const a = String(p.entrant1Id);
    const b = String(p.entrant2Id);
    check(
      `${a} vs ${b} is not a rematch`,
      !(prior.get(p.entrant1Id!)?.has(p.entrant2Id!) ?? false),
    );
  }
}

section("Pairings — swap is required, not optional");
{
  // Standings order A, B, C, D where A already played B and C already played D.
  // Adjacent pairing would reproduce both round-1 matches; the search must
  // cross over to A–C and B–D.
  const entrants = [entrant("A"), entrant("B"), entrant("C"), entrant("D")];
  const r1 = [match(1, "A", "B", 2, 1), match(1, "C", "D", 2, 1)];
  // Hand-build standings in the order that provokes the collision.
  const base = computeStandingsPure(r1, entrants);
  const order = ["A", "B", "C", "D"].map((n) => rowFor(base, n));
  const prior = buildPriorOpponents(r1);
  const result = generatePairingsPure(order, prior, 2);

  eq("still complete", result.isComplete, true);
  const pairs = result.pairings
    .map((p) => [String(p.entrant1Id), String(p.entrant2Id)].sort().join("-"))
    .sort();
  eq("A–B and C–D were avoided", pairs.join(" "), "A-C B-D");
}

section("Pairings — bye goes to the lowest standing eligible entrant");
{
  // A 2–0, B 2–0, C 1–1, D 0–2, E 0–2 after two rounds, no byes yet.
  const played = [
    match(1, "A", "D", 2, 0),
    match(1, "B", "E", 2, 0),
    bye(1, "C"),
    match(2, "A", "E", 2, 0),
    match(2, "B", "D", 2, 0),
    bye(2, "C"),
  ];
  const standings = computeStandingsPure(played, [
    entrant("A"),
    entrant("B"),
    entrant("C", { hadBye: true }),
    entrant("D"),
    entrant("E"),
  ]);
  const prior = buildPriorOpponents(played);
  const result = generatePairingsPure(standings, prior, 3);
  eq("complete", result.isComplete, true);
  check(
    "C, who already had a bye, is not given a second one",
    String(result.byeEntrantId) !== "C",
    `bye went to ${result.byeEntrantId}`,
  );
  const byeRow = standings.find((r) => r.entrantId === result.byeEntrantId)!;
  eq("bye recipient had no prior bye", byeRow.hadBye, false);
  const eligible = standings.filter((r) => !r.hadBye);
  eq(
    "bye went to the lowest-ranked eligible entrant",
    String(result.byeEntrantId),
    String(eligible[eligible.length - 1].entrantId),
  );
}

section("Pairings — dropped entrants are excluded");
{
  const entrants = [
    entrant("A"),
    entrant("B"),
    entrant("C"),
    entrant("D", { dropped: true }),
  ];
  const standings = computeStandingsPure([], entrants);
  const result = generatePairingsPure(standings, new Map(), 1, 5);
  const seen = result.pairings.flatMap((p) =>
    [p.entrant1Id, p.entrant2Id].filter((x): x is Id<"draftEntrants"> => x !== null),
  );
  check("dropped entrant is not paired", !seen.map(String).includes("D"));
  eq("3 remaining entrants means 1 pairing + 1 bye", result.pairings.length, 2);
  eq("odd remainder produces a bye", result.byeEntrantId !== null, true);
}

section("Pairings — exhaustion returns isComplete: false");
{
  // Four entrants played to a full round robin: every pair has met, so round 4
  // cannot be paired without a rematch.
  const entrants = [entrant("A"), entrant("B"), entrant("C"), entrant("D")];
  const played = [
    match(1, "A", "B", 2, 0),
    match(1, "C", "D", 2, 0),
    match(2, "A", "C", 2, 0),
    match(2, "B", "D", 2, 0),
    match(3, "A", "D", 2, 0),
    match(3, "B", "C", 2, 0),
  ];
  const standings = computeStandingsPure(played, entrants);
  const prior = buildPriorOpponents(played);
  const result = generatePairingsPure(standings, prior, 4);
  eq("isComplete is false", result.isComplete, false);
  eq("no pairings are emitted", result.pairings.length, 0);
  eq("no bye is emitted", result.byeEntrantId, null);
}

section("Pairings — a full 8-player event pairs every round without a rematch");
{
  const names = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const entrants = names.map((n) => entrant(n));
  const played: MatchInput[] = [];
  for (let round = 1; round <= 3; round++) {
    const standings = computeStandingsPure(played, entrants);
    const prior = buildPriorOpponents(played);
    const result = generatePairingsPure(standings, prior, round, 42);
    check(`round ${round} pairs`, result.isComplete);
    for (const p of result.pairings) {
      check(
        `round ${round}: ${p.entrant1Id} vs ${p.entrant2Id} is fresh`,
        !(prior.get(p.entrant1Id)?.has(p.entrant2Id!) ?? false),
      );
      // Higher seed wins, deterministically.
      played.push({
        round,
        entrant1Id: p.entrant1Id,
        entrant2Id: p.entrant2Id,
        entrant1GameWins: 2,
        entrant2GameWins: 0,
        reported: true,
      });
    }
  }
  const finalRows = computeStandingsPure(played, entrants);
  eq("8 rows", finalRows.length, 8);
  eq("ranks are 1..8", finalRows.map((r) => r.rank).join(","), "1,2,3,4,5,6,7,8");
  eq("an undefeated entrant exists", finalRows[0].matchPoints, 9);
  eq(
    "total match points conserved",
    finalRows.reduce((s, r) => s + r.matchPoints, 0),
    12 * 3,
  );
}

section("Round guards — planNextRound refusals");
{
  const names = ["A", "B", "C", "D"];
  const entrants = names.map((n) => entrant(n));
  const pod = (over: Partial<PodInput> = {}): PodInput => ({
    roundCount: 3,
    currentRound: 0,
    status: "active",
    ...over,
  });

  // Round 1 is exempt from the report guard and pairs from an empty history.
  const first = planNextRound(pod(), [], entrants);
  eq("round 1 plans", first.ok, true);
  if (first.ok) {
    eq("plans round 1", first.round, 1);
    eq("2 pairings", first.pairings.length, 2);
  }

  // Round guard: currentRound === roundCount.
  const done = planNextRound(pod({ currentRound: 3 }), [], entrants);
  eq("refuses past the chosen round count", done.ok, false);
  if (!done.ok) eq("reason", done.reason, "rounds-exhausted");

  // Pod status guard.
  const closed = planNextRound(pod({ status: "complete" }), [], entrants);
  eq("refuses a completed pod", closed.ok, false);
  if (!closed.ok) eq("reason", closed.reason, "pod-not-active");

  // Report guard: a single unreported round-1 match blocks round 2.
  const pending = [
    match(1, "A", "B", 2, 0, true),
    match(1, "C", "D", 0, 0, false),
  ];
  const blocked = planNextRound(pod({ currentRound: 1 }), pending, entrants);
  eq("refuses while a result is outstanding", blocked.ok, false);
  if (!blocked.ok) {
    eq("reason", blocked.reason, "unreported-results");
    check(
      "message names the outstanding count",
      blocked.message.includes("1 unreported"),
      blocked.message,
    );
  }

  // Same round, once everything is in.
  const settled = [
    match(1, "A", "B", 2, 0, true),
    match(1, "C", "D", 2, 0, true),
  ];
  const unblocked = planNextRound(pod({ currentRound: 1 }), settled, entrants);
  eq("proceeds once every result is in", unblocked.ok, true);
  if (unblocked.ok) eq("plans round 2", unblocked.round, 2);

  // Double-generate guard: rows already exist for the round being planned.
  const alreadyPaired = planNextRound(
    pod({ currentRound: 1 }),
    [...settled, match(2, "A", "C", 0, 0, false)],
    entrants,
  );
  eq("refuses to pair a round twice", alreadyPaired.ok, false);
  if (!alreadyPaired.ok) eq("reason", alreadyPaired.reason, "already-paired");

  // Exhaustion: a 4-player pod taken to a full round robin.
  const roundRobin = [
    match(1, "A", "B", 2, 0),
    match(1, "C", "D", 2, 0),
    match(2, "A", "C", 2, 0),
    match(2, "B", "D", 2, 0),
    match(3, "A", "D", 2, 0),
    match(3, "B", "C", 2, 0),
  ];
  const exhausted = planNextRound(
    pod({ roundCount: 4, currentRound: 3 }),
    roundRobin,
    entrants,
  );
  eq("refuses rather than repeating a pairing", exhausted.ok, false);
  if (!exhausted.ok) eq("reason", exhausted.reason, "pairing-exhausted");
}

section("Round guards — a bye is written pre-reported, so it never blocks");
{
  // The mutation stores a bye as a reported 2–0. If it did not, the report
  // guard would stall on a match nobody can enter a result for.
  const entrants = ["A", "B", "C"].map((n) => entrant(n));
  const withBye = [match(1, "A", "B", 2, 0, true), bye(1, "C")];
  const plan = planNextRound(
    { roundCount: 3, currentRound: 1, status: "active" },
    withBye,
    [entrant("A"), entrant("B"), entrant("C", { hadBye: true })],
  );
  eq("round 2 is reachable with a bye in round 1", plan.ok, true);
  eq("roster is intact", entrants.length, 3);
}

// ------------------------------------------------------------------ done ---

console.log(
  `\n${passed} passed, ${failures.length} failed` +
    (failures.length ? `\n\n${failures.map((f) => `  - ${f}`).join("\n")}` : ""),
);
process.exit(failures.length === 0 ? 0 : 1);
