/**
 * Pod-splitting and prize-allocation tests (spec 02).
 * Runs on plain node via `npm run test:pods`.
 */

import type { PodSplitInput } from "../convex/draft/types";
import {
  DEFAULT_POD_SIZE,
  MIN_POD_SIZE,
  maxRounds,
  recommendedRounds,
} from "../convex/draft/rules";
import {
  allocateByWeights,
  assignToPods,
  splitPods,
} from "../convex/draft/pods";

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

const split = (
  playerCount: number,
  scope: PodSplitInput["scope"],
  targetPodSize = DEFAULT_POD_SIZE,
) => splitPods({ playerCount, scope, targetPodSize }).join(",");

section("splitPods — spec 02 acceptance cases");
eq("14 isolated, target 8 → [7,7]", split(14, "multi-pod-isolated", 8), "7,7");
eq("20 isolated, target 8 → [7,7,6]", split(20, "multi-pod-isolated", 8), "7,7,6");
eq("9 isolated, target 8 → [5,4]", split(9, "multi-pod-isolated", 8), "5,4");
eq("6 single-pod, target 8 → [6]", split(6, "single-pod", 8), "6");

section("splitPods — even split, never fill-then-spill");
eq("14 is not [8,6]", split(14, "multi-pod-isolated", 8) !== "8,6", true);
eq("16 → [8,8]", split(16, "multi-pod-isolated", 8), "8,8");
eq("17 → [6,6,5]", split(17, "multi-pod-isolated", 8), "6,6,5");
eq("24 → [8,8,8]", split(24, "multi-pod-isolated", 8), "8,8,8");
eq("larger pods come first", split(20, "multi-pod-isolated", 8), "7,7,6");

section("splitPods — no pod below the minimum");
{
  // 9 at a target of 8 would naively be [8,1]; the even split gives [5,4].
  eq("9 never produces a pod of 1", split(9, "multi-pod-isolated", 8), "5,4");
  // At a target of 4 the even split still strands a 3, so a pod is dropped.
  eq("7 at target 4 collapses to one pod", split(7, "multi-pod-isolated", 4), "7");
  eq("11 at target 4 → [6,5], not [4,4,3]", split(11, "multi-pod-isolated", 4), "6,5");
  eq("5 at target 4 stays one pod", split(5, "multi-pod-isolated", 4), "5");

  for (let n = MIN_POD_SIZE; n <= 60; n++) {
    for (let target = MIN_POD_SIZE; target <= 8; target++) {
      const sizes = splitPods({
        playerCount: n,
        scope: "multi-pod-isolated",
        targetPodSize: target,
      });
      const total = sizes.reduce((s, x) => s + x, 0);
      const smallest = Math.min(...sizes);
      const largest = Math.max(...sizes);
      if (total !== n || (sizes.length > 1 && smallest < MIN_POD_SIZE)) {
        check(`n=${n} target=${target} is well-formed`, false, sizes.join(","));
        break;
      }
      if (largest - smallest > 1) {
        check(`n=${n} target=${target} pods differ by at most 1`, false, sizes.join(","));
        break;
      }
    }
  }
  check("every field 4–60 at every target 4–8 splits cleanly", true);
}

section("splitPods — single-pod never splits");
eq("single-pod ignores the target", split(30, "single-pod", 4), "30");
eq("empty roster → no pods", split(0, "multi-pod-isolated", 8), "");

section("assignToPods — the roster is dealt in split order");
{
  const players = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  const sizes = splitPods({
    playerCount: 9,
    scope: "multi-pod-isolated",
    targetPodSize: 8,
  });
  const pods = assignToPods(players, sizes);
  eq("2 pods", pods.length, 2);
  eq("pod 1 takes the first 5", pods[0].join(""), "abcde");
  eq("pod 2 takes the rest", pods[1].join(""), "fghi");
  eq(
    "every player is seated exactly once",
    pods.flat().length,
    new Set(pods.flat()).size,
  );
}

section("Round bounds follow the smallest pod");
{
  const sizes = splitPods({
    playerCount: 9,
    scope: "multi-pod-isolated",
    targetPodSize: 8,
  });
  const smallest = Math.min(...sizes);
  eq("smallest pod of [5,4] is 4", smallest, 4);
  eq("a pod of 4 caps at 3 rounds", maxRounds(smallest), 3);
  eq("and recommends 3", recommendedRounds(smallest), 3);
  eq("a pod of 8 caps at 7", maxRounds(8), 7);
  eq("a pod of 8 recommends 3", recommendedRounds(8), 3);
}

section("allocateByWeights — presets always fit the packs available");
{
  eq("winner-take-all over 4", allocateByWeights(4, [1]).join(","), "4");
  eq("flat top-4 over 8", allocateByWeights(8, [1, 1, 1, 1]).join(","), "2,2,2,2");
  eq("top-heavy over 6", allocateByWeights(6, [3, 2, 1]).join(","), "3,2,1");

  for (let total = 0; total <= 40; total++) {
    for (const weights of [[1], [3, 2, 1], [1, 1, 1, 1], [5, 3, 2, 1, 1]]) {
      const out = allocateByWeights(total, weights);
      const sum = out.reduce((s, n) => s + n, 0);
      if (sum !== total || out.some((n) => n < 0)) {
        check(`allocate(${total}, [${weights}]) sums to ${total}`, false, out.join(","));
        break;
      }
      // Rounding must never leave a higher placement behind a lower one when
      // the weights themselves are descending.
      const descending = weights.every((w, i) => i === 0 || w <= weights[i - 1]);
      if (descending && out.some((n, i) => i > 0 && n > out[i - 1])) {
        check(`allocate(${total}, [${weights}]) stays descending`, false, out.join(","));
        break;
      }
    }
  }
  check("presets sum exactly and never invert placements", true);
  eq("zero packs allocates nothing", allocateByWeights(0, [3, 2, 1]).join(","), "0,0,0");
}

console.log(
  `\n${passed} passed, ${failures.length} failed` +
    (failures.length ? `\n\n${failures.map((f) => `  - ${f}`).join("\n")}` : ""),
);
process.exit(failures.length === 0 ? 0 : 1);
