/**
 * Prize-mapping tests (spec 04). Runs via `npm run test:prizes`.
 */

import type { Id } from "../convex/_generated/dataModel";
import type { StandingsRow } from "../convex/draft/types";
import { awardPacks, formatResultsSummary } from "../convex/draft/prizes";
import { computeStandingsPure } from "../convex/draft/standings";

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

const id = (s: string) => s as unknown as Id<"draftEntrants">;

/** A minimal standings row — only rank, name and record matter to prizes. */
function row(
  name: string,
  rank: number,
  wins = 0,
  losses = 0,
  draws = 0,
): StandingsRow {
  return {
    entrantId: id(name),
    name,
    rank,
    matchPoints: wins * 3 + draws,
    wins,
    losses,
    draws,
    omw: 1 / 3,
    gw: 1 / 3,
    ogw: 1 / 3,
    hadBye: false,
    dropped: false,
  };
}

section("Acceptance — [2,1,1] over a 4-player pod");
{
  const standings = [
    row("Ana", 1, 3, 0, 0),
    row("Ben", 2, 2, 1, 0),
    row("Cleo", 3, 1, 2, 0),
    row("Dev", 4, 0, 3, 0),
  ];
  const { awards, unawarded } = awardPacks(standings, [2, 1, 1]);

  eq("every entrant gets a row", awards.length, 4);
  eq("1st takes 2", awards[0].packsAwarded, 2);
  eq("2nd takes 1", awards[1].packsAwarded, 1);
  eq("3rd takes 1", awards[2].packsAwarded, 1);
  eq("4th takes nothing", awards[3].packsAwarded, 0);
  eq("the pool is fully paid out", unawarded, 0);
  eq(
    "packs sum to the distribution",
    awards.reduce((s, a) => s + a.packsAwarded, 0),
    4,
  );
  eq("names ride along", awards[0].name, "Ana");
  eq("ranks are preserved", awards.map((a) => a.rank).join(","), "1,2,3,4");
}

section("A distribution paying more places than the pod has players");
{
  const standings = [row("Ana", 1), row("Ben", 2), row("Cleo", 3)];
  const { awards, unawarded } = awardPacks(standings, [3, 2, 1, 1, 1]);
  eq("everyone present is paid", awards.map((a) => a.packsAwarded).join(","), "3,2,1");
  eq("the rest is reported, not lost", unawarded, 2);
}

section("Degenerate distributions");
{
  const standings = [row("Ana", 1), row("Ben", 2), row("Cleo", 3)];
  eq(
    "an empty distribution pays nobody",
    awardPacks(standings, []).awards.map((a) => a.packsAwarded).join(","),
    "0,0,0",
  );
  eq("and leaves nothing stranded", awardPacks(standings, []).unawarded, 0);
  eq(
    "winner-take-all",
    awardPacks(standings, [6]).awards.map((a) => a.packsAwarded).join(","),
    "6,0,0",
  );
  eq(
    "a zero in the middle is honoured",
    awardPacks(standings, [3, 0, 1]).awards.map((a) => a.packsAwarded).join(","),
    "3,0,1",
  );
  eq("an empty pod produces no awards", awardPacks([], [2, 1]).awards.length, 0);
  eq("and reports the whole pool unawarded", awardPacks([], [2, 1]).unawarded, 3);
}

section("Awards follow resolved rank, including for a dropped player");
{
  const standings = [row("Quitter", 1, 3, 0, 0), row("Stayer", 2, 2, 1, 0)];
  standings[0].dropped = true;
  const { awards } = awardPacks(standings, [2, 1]);
  eq("dropping does not forfeit the rank", awards[0].packsAwarded, 2);
  eq("nor promote the player behind", awards[1].packsAwarded, 1);
}

section("End to end — real standings feed the payout");
{
  // A 4-player round robin: Ana 3-0, Ben 2-1, Cleo 1-2, Dev 0-3.
  const entrants = ["Ana", "Ben", "Cleo", "Dev"].map((name) => ({
    _id: id(name),
    name,
    hadBye: false,
    dropped: false,
  }));
  const m = (r: number, a: string, b: string, x: number, y: number) => ({
    round: r,
    entrant1Id: id(a),
    entrant2Id: id(b),
    entrant1GameWins: x,
    entrant2GameWins: y,
    reported: true,
  });
  const matches = [
    m(1, "Ana", "Ben", 2, 0),
    m(1, "Cleo", "Dev", 2, 0),
    m(2, "Ana", "Cleo", 2, 0),
    m(2, "Ben", "Dev", 2, 0),
    m(3, "Ana", "Dev", 2, 0),
    m(3, "Ben", "Cleo", 2, 0),
  ];

  const standings = computeStandingsPure(matches, entrants);
  eq("Ana is undefeated", standings[0].name, "Ana");
  eq("and on 9 points", standings[0].matchPoints, 9);
  eq("Dev is last", standings[3].name, "Dev");

  const { awards } = awardPacks(standings, [2, 1, 1]);
  eq(
    "payout follows the table",
    awards.map((a) => `${a.name}:${a.packsAwarded}`).join(" "),
    "Ana:2 Ben:1 Cleo:1 Dev:0",
  );
}

section("Shareable summary");
{
  const rows = [
    { ...row("Ana", 1, 3, 0, 0), packsAwarded: 2 },
    { ...row("Ben", 2, 2, 1, 0), packsAwarded: 1 },
    { ...row("Cleo", 3, 1, 1, 1), packsAwarded: 1 },
    { ...row("Dev", 4, 0, 3, 0), packsAwarded: 0 },
  ];
  const text = formatResultsSummary("Friday Night Draft", "Pod 1", rows);
  const lines = text.split("\n");
  eq("header names the event and pod", lines[0], "Friday Night Draft — Pod 1");
  eq("winner line", lines[1], "1st: Ana (3–0–0) — 2 packs");
  eq("singular pack", lines[2], "2nd: Ben (2–1–0) — 1 pack");
  eq("draws appear in the record", lines[3], "3rd: Cleo (1–1–1) — 1 pack");
  eq("no packs means no suffix", lines[4], "4th: Dev (0–3–0)");
  eq("one line per entrant plus a header", lines.length, 5);

  const single = formatResultsSummary("Kitchen Table", null, rows.slice(0, 1));
  eq("a single-pod event drops the pod label", single.split("\n")[0], "Kitchen Table");
}

console.log(
  `\n${passed} passed, ${failures.length} failed` +
    (failures.length ? `\n\n${failures.map((f) => `  - ${f}`).join("\n")}` : ""),
);
process.exit(failures.length === 0 ? 0 : 1);
