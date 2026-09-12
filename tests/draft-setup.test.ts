/**
 * Setup-wizard state tests (spec 02).
 *
 * `useDraftSetup` is a plain composable with no DOM in it, so the wizard's
 * gating rules — the scope auto-switch, the round clamp, the prize block — can
 * be driven directly with Vue's reactivity and asserted without a browser.
 *
 * Runs via `npm run test:setup`.
 */

import { nextTick } from "vue";
import {
  clearPersistedSetup,
  useDraftSetup,
  SINGLE_POD_LIMIT,
} from "../src/lib/draftSetup";

/**
 * The composable reads and writes localStorage when persistence is on. Node has
 * none, so stand one up before anything imports it.
 */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

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

function roster(setup: ReturnType<typeof useDraftSetup>, count: number) {
  for (let i = 0; i < count; i++) setup.addPlayer(`Player ${i + 1}`);
}

async function run() {
  section("Acceptance — 6 players, single pod");
  {
    const setup = useDraftSetup();
    setup.name.value = "Friday Night Draft";
    roster(setup, 6);
    await nextTick();

    eq("stays single-pod", setup.scope.value, "single-pod");
    eq("one pod", setup.podSizes.value.join(","), "6");
    eq("round count defaults to 3", setup.roundCount.value, 3);
    eq("basics are valid", setup.basicsValid.value, true);
    eq("prize scope forced to per-pod", setup.prizeScope.value, "per-pod");
  }

  section("Acceptance — 14 players, separate pods, target 8");
  {
    const setup = useDraftSetup();
    setup.name.value = "Store Championship";
    roster(setup, 14);
    await nextTick();

    eq("scope switched off single-pod", setup.scope.value, "multi-pod-isolated");
    setup.acknowledgeScopeSwitch();
    eq("target pod size defaults to 8", setup.targetPodSize.value, 8);
    eq("splits 7 and 7", setup.podSizes.value.join(","), "7,7");
    eq("smallest pod is 7", setup.smallestPod.value, 7);
    eq("basics valid once acknowledged", setup.basicsValid.value, true);
  }

  section("Acceptance — a 9th player flips scope and blocks Next");
  {
    const setup = useDraftSetup();
    setup.name.value = "Draft";
    roster(setup, SINGLE_POD_LIMIT);
    await nextTick();
    eq("8 players is still single-pod", setup.scope.value, "single-pod");
    eq("and Next is open", setup.basicsValid.value, true);

    setup.addPlayer("Player 9");
    await nextTick();

    eq("the 9th flips the scope", setup.scope.value, "multi-pod-isolated");
    eq("the switch is flagged", setup.scopeAutoSwitched.value, true);
    eq("Next is blocked until acknowledged", setup.basicsValid.value, false);

    setup.acknowledgeScopeSwitch();
    eq("acknowledging unblocks Next", setup.basicsValid.value, true);
    eq("9 players split 5 and 4", setup.podSizes.value.join(","), "5,4");
  }

  section("Scope — multi-pod-shared cannot be selected");
  {
    const setup = useDraftSetup();
    roster(setup, 4);
    await nextTick();
    setup.setScope("multi-pod-shared");
    await nextTick();
    eq("setScope refuses the v2 value", setup.scope.value === "multi-pod-shared", false);
    eq("scope is unchanged", setup.scope.value, "single-pod");
  }

  section("Rounds — bounds follow the smallest pod");
  {
    const setup = useDraftSetup();
    roster(setup, 8);
    await nextTick();
    eq("a pod of 8 recommends 3", setup.roundCount.value, 3);
    eq("and caps at 7", setup.roundMax.value, 7);

    setup.setRoundCount(7);
    await nextTick();
    eq("the cap is reachable", setup.roundCount.value, 7);
    eq("and reads as a round-robin", setup.roundNote.value.includes("round-robin"), true);

    setup.setRoundCount(99);
    eq("above the cap clamps down", setup.roundCount.value, 7);
    setup.setRoundCount(1);
    eq("below 3 clamps up", setup.roundCount.value, 3);

    // Shrinking the field must drag a touched round count back into range.
    setup.setRoundCount(7);
    setup.removePlayer(7);
    setup.removePlayer(6);
    setup.removePlayer(5);
    setup.removePlayer(4);
    await nextTick();
    eq("a pod of 4 caps at 3", setup.roundMax.value, 3);
    eq("the chosen count is clamped, not left stale", setup.roundCount.value, 3);
  }

  section("Rounds — an untouched count tracks the recommendation");
  {
    const setup = useDraftSetup();
    roster(setup, 4);
    await nextTick();
    eq("4 players recommends 3", setup.roundCount.value, 3);
    roster(setup, 12); // now 16
    await nextTick();
    setup.acknowledgeScopeSwitch();
    eq("16 players split into pods of 8", setup.podSizes.value.join(","), "8,8");
    eq("untouched count follows the recommendation", setup.roundCount.value, 3);
  }

  section("Prizes — over-allocation blocks the step");
  {
    const setup = useDraftSetup();
    roster(setup, 8);
    await nextTick();

    eq("defaults to 4 packs", setup.totalPacks.value, 4);
    eq("default distribution is 2/1/1", setup.prizeDistribution.value.join(","), "2,1,1");
    eq("which fits", setup.prizesValid.value, true);
    eq("with nothing left over", setup.packsRemaining.value, 0);

    setup.setPlacement(0, 5);
    eq("over-allocating is detected", setup.packsOverAllocated.value, true);
    eq("and blocks the step", setup.prizesValid.value, false);
    eq("overage is reported", setup.packsRemaining.value, -3);

    setup.setTotalPacks(8);
    eq("raising the pool clears the block", setup.prizesValid.value, true);
  }

  section("Prizes — presets always fit the pool");
  {
    const setup = useDraftSetup();
    roster(setup, 8);
    await nextTick();
    setup.setTotalPacks(9);

    setup.applyPreset("winner-take-all");
    eq("winner-take-all", setup.prizeDistribution.value.join(","), "9");
    eq("fits", setup.prizesValid.value, true);

    setup.applyPreset("top-heavy");
    eq("top-heavy over 9", setup.prizeDistribution.value.join(","), "5,3,1");
    eq("sums to the pool", setup.distributedPacks.value, 9);

    setup.applyPreset("flat-top-4");
    eq("flat top 4 over 9", setup.prizeDistribution.value.join(","), "3,2,2,2");
    eq("still fits", setup.prizesValid.value, true);

    // Changing the pool re-runs the active preset rather than leaving a
    // distribution that contradicts the label above it.
    setup.setTotalPacks(4);
    eq("preset rescales with the pool", setup.distributedPacks.value, 4);
    eq("and stays valid", setup.prizesValid.value, true);

    setup.setPlacement(0, 1);
    eq("a manual edit drops to custom", setup.prizePreset.value, "custom");
  }

  section("Prizes — more places than players warns but does not block");
  {
    const setup = useDraftSetup();
    roster(setup, 3);
    await nextTick();
    setup.setTotalPacks(8);
    setup.applyPreset("flat-top-4");
    eq("4 places in a pod of 3", setup.placementsExceedPod.value, true);
    eq("is only a warning", setup.prizesValid.value, true);
  }

  section("Roster — edits stay in sync");
  {
    const setup = useDraftSetup();
    setup.name.value = "X";
    roster(setup, 3);
    setup.renamePlayer(1, "Renamed");
    eq("rename lands", setup.players.value[1], "Renamed");
    setup.removePlayer(0);
    eq("removal shortens the roster", setup.players.value.join(","), "Renamed,Player 3");
    setup.addPlayer("   ");
    eq("blank names are ignored", setup.playerCount.value, 2);
    setup.removePlayer(0);
    await nextTick();
    eq("one player is not a tournament", setup.basicsValid.value, false);
  }

  section("Basics — a name is required");
  {
    const setup = useDraftSetup();
    roster(setup, 4);
    await nextTick();
    eq("no name blocks Next", setup.basicsValid.value, false);
    setup.name.value = "  ";
    eq("whitespace is not a name", setup.basicsValid.value, false);
    setup.name.value = "Draft Night";
    eq("a real name unblocks", setup.basicsValid.value, true);
  }

  section("Persistence — a refresh mid-wizard keeps the roster");
  {
    clearPersistedSetup();
    const first = useDraftSetup({ persist: true });
    first.name.value = "Saturday Draft";
    roster(first, 5);
    first.setRoundCount(4);
    first.setTotalPacks(9);
    first.applyPreset("top-heavy");
    await nextTick();

    eq("something was written", store.size > 0, true);

    // A second composable is what a fresh page load produces.
    const second = useDraftSetup({ persist: true });
    await nextTick();
    eq("name comes back", second.name.value, "Saturday Draft");
    eq("roster comes back", second.playerCount.value, 5);
    eq("round count comes back", second.roundCount.value, 4);
    eq("packs come back", second.totalPacks.value, 9);
    eq("distribution comes back", second.prizeDistribution.value.join(","), "5,3,1");
    eq("preset comes back", second.prizePreset.value, "top-heavy");
    eq("and it knows it was restored", second.restored.value, true);
  }

  section("Persistence — a touched round count is not overwritten on restore");
  {
    clearPersistedSetup();
    const first = useDraftSetup({ persist: true });
    first.name.value = "Rounds";
    roster(first, 8);
    first.setRoundCount(6);
    await nextTick();

    const second = useDraftSetup({ persist: true });
    await nextTick();
    eq("the chosen 6 survives the restore", second.roundCount.value, 6);
    eq("not reset to the recommendation", second.roundCount.value === 3, false);
  }

  section("Persistence — reset clears the saved copy");
  {
    clearPersistedSetup();
    const setup = useDraftSetup({ persist: true });
    setup.name.value = "Throwaway";
    roster(setup, 4);
    await nextTick();
    eq("saved", store.size > 0, true);

    setup.reset();
    await nextTick();
    eq("form is empty", setup.name.value, "");
    eq("roster is empty", setup.playerCount.value, 0);
    eq("scope is back to default", setup.scope.value, "single-pod");
    eq("packs back to default", setup.totalPacks.value, 4);

    // Note the watcher re-saves the now-empty form; what matters is that a
    // fresh wizard does not treat an empty blob as work worth restoring.
    const fresh = useDraftSetup({ persist: true });
    eq("nothing is restored", fresh.restored.value, false);
    eq("and it starts blank", fresh.playerCount.value, 0);
  }

  section("Persistence — off by default, and junk is ignored");
  {
    clearPersistedSetup();
    const saved = useDraftSetup({ persist: true });
    saved.name.value = "Persisted";
    roster(saved, 3);
    await nextTick();

    const transient = useDraftSetup();
    eq("a non-persisting wizard ignores the store", transient.name.value, "");
    eq("and restores nothing", transient.restored.value, false);

    store.set("boardstate.draftSetup", "{not json");
    const afterJunk = useDraftSetup({ persist: true });
    eq("corrupt storage starts clean", afterJunk.name.value, "");
    eq("rather than half-restored", afterJunk.restored.value, false);
    clearPersistedSetup();
  }

  console.log(
    `\n${passed} passed, ${failures.length} failed` +
      (failures.length ? `\n\n${failures.map((f) => `  - ${f}`).join("\n")}` : ""),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

void run();
