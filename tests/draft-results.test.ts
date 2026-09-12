/**
 * Result-option tests (spec 03). Runs via `npm run test:results`.
 *
 * The picker and the mutation's guard are built from the same list, so these
 * assertions cover both at once.
 */

import {
  formatPercent,
  formatRecord,
  isLegalResult,
  outcomeOf,
  resultOptions,
} from "../convex/draft/results";

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

const asPairs = (track: boolean) =>
  resultOptions(track)
    .map((o) => `${o.entrant1GameWins}-${o.entrant2GameWins}`)
    .join(" ");

section("Score tracking OFF — win / draw / win only");
{
  eq("three options", resultOptions(false).length, 3);
  eq("stored as 2-0 / 1-1 / 0-2", asPairs(false), "2-0 1-1 0-2");
  eq("a win is 2–0", isLegalResult(false, 2, 0), true);
  eq("a draw is 1–1", isLegalResult(false, 1, 1), true);
  eq("a loss is 0–2", isLegalResult(false, 0, 2), true);
  eq("2–1 is refused", isLegalResult(false, 2, 1), false);
  eq("1–2 is refused", isLegalResult(false, 1, 2), false);
  eq("0–0 is refused", isLegalResult(false, 0, 0), false);
  eq("3–0 is refused", isLegalResult(false, 3, 0), false);
}

section("Score tracking ON — the 2–1 and 1–2 options appear");
{
  eq("five options", resultOptions(true).length, 5);
  eq("ordered by how entrant 1 did", asPairs(true), "2-0 2-1 1-1 1-2 0-2");
  eq("2–1 is legal", isLegalResult(true, 2, 1), true);
  eq("1–2 is legal", isLegalResult(true, 1, 2), true);
  eq("1–1 is still legal", isLegalResult(true, 1, 1), true);
  eq("2–2 is refused", isLegalResult(true, 2, 2), false);
  eq("0–1 is refused", isLegalResult(true, 0, 1), false);
  eq("0–0 is refused", isLegalResult(true, 0, 0), false);
  eq("negatives are refused", isLegalResult(true, -1, 2), false);
}

section("Every offered option is a storable one");
{
  for (const track of [false, true]) {
    const bad = resultOptions(track).filter(
      (o) => !isLegalResult(track, o.entrant1GameWins, o.entrant2GameWins),
    );
    eq(
      `trackGameScores=${track}: no button the guard would reject`,
      bad.length,
      0,
    );
  }
  // The looser setting must be a superset of the stricter one, so turning
  // tracking on never invalidates a result already recorded without it.
  const off = new Set(asPairs(false).split(" "));
  const on = new Set(asPairs(true).split(" "));
  eq(
    "match-only results stay legal when tracking is on",
    [...off].every((pair) => on.has(pair)),
    true,
  );
}

section("Outcome derivation");
{
  eq("2–0 favours entrant 1", outcomeOf(2, 0), "entrant1");
  eq("2–1 favours entrant 1", outcomeOf(2, 1), "entrant1");
  eq("1–1 is a draw", outcomeOf(1, 1), "draw");
  eq("1–2 favours entrant 2", outcomeOf(1, 2), "entrant2");
  eq("0–2 favours entrant 2", outcomeOf(0, 2), "entrant2");
  eq("0–0 reads as a draw", outcomeOf(0, 0), "draw");
  // Each option's declared outcome must match what the numbers actually say.
  for (const track of [false, true]) {
    const mismatched = resultOptions(track).filter(
      (o) => outcomeOf(o.entrant1GameWins, o.entrant2GameWins) !== o.outcome,
    );
    eq(`trackGameScores=${track}: labels agree with the scores`, mismatched.length, 0);
  }
}

section("Display formatting — no raw float artifacts");
{
  eq("one third", formatPercent(1 / 3), "33.3%");
  eq("the MTR worked example", formatPercent(0.6168154761904762), "61.7%");
  eq("a clean half", formatPercent(0.5), "50.0%");
  eq("a perfect score", formatPercent(1), "100.0%");
  eq("zero", formatPercent(0), "0.0%");
  check(
    "never leaks a long float",
    !formatPercent(10 / 21).includes("4761"),
    formatPercent(10 / 21),
  );
  eq("a record", formatRecord(3, 1, 0), "3–1–0");
  eq("a record with draws", formatRecord(2, 1, 1), "2–1–1");
}

console.log(
  `\n${passed} passed, ${failures.length} failed` +
    (failures.length ? `\n\n${failures.map((f) => `  - ${f}`).join("\n")}` : ""),
);
process.exit(failures.length === 0 ? 0 : 1);
