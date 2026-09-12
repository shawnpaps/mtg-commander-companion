import { computed, ref, watch } from "vue";
import {
  DEFAULT_POD_SIZE,
  MAX_POD_SIZE,
  MIN_POD_SIZE,
  maxRounds,
  recommendedRounds,
} from "@convex/draft/rules";
import { allocateByWeights, splitPods } from "@convex/draft/pods";
import type { PodSplitInput } from "@convex/draft/types";

/**
 * State for the tournament setup wizard.
 *
 * The pod preview here is not a client-side approximation of what the server
 * will do — it is literally the same `splitPods` the create mutation runs, so
 * the pod cards the organizer approves in step 2 are the pods they get. The
 * mutation still recomputes from the roster it receives; agreeing is the point,
 * trusting is not.
 */

export type DraftScope = PodSplitInput["scope"];
export type PrizeScope = "per-pod" | "global";
export type PrizePreset = "winner-take-all" | "top-heavy" | "flat-top-4" | "custom";

/** Above this, one pod stops being a draft and starts being a queue. */
export const SINGLE_POD_LIMIT = 8;

/** A tournament needs an opponent. */
export const MIN_PLAYERS = 2;

export const PRIZE_PRESETS: Array<{
  id: Exclude<PrizePreset, "custom">;
  label: string;
  weights: number[];
}> = [
  { id: "winner-take-all", label: "Winner takes all", weights: [1] },
  { id: "top-heavy", label: "Top-heavy", weights: [3, 2, 1] },
  { id: "flat-top-4", label: "Flat top 4", weights: [1, 1, 1, 1] },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const DRAFT_KEY = "boardstate.draftSetup";

/**
 * What gets written to localStorage between steps.
 *
 * No tournament row exists until "Start tournament", so until then the roster
 * lives only in this tab. Typing fourteen names into a phone and losing them to
 * an accidental refresh is the kind of thing that stops someone using the
 * feature at all.
 */
type PersistedSetup = {
  name: string;
  players: string[];
  scope: DraftScope;
  trackGameScores: boolean;
  targetPodSize: number;
  roundCount: number;
  roundCountTouched: boolean;
  prizeScope: PrizeScope;
  totalPacks: number;
  prizeDistribution: number[];
  prizePreset: PrizePreset;
};

/**
 * localStorage is absent in the node test runner and can throw in a locked-down
 * browser, so every touch goes through here rather than assuming it exists.
 */
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readPersisted(): Partial<PersistedSetup> | null {
  try {
    const raw = storage()?.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSetup>;
    // A stored blob with nothing in it is not worth restoring, and would show
    // the "picked up where you left off" hint over an empty form.
    if (!parsed.name?.trim() && !parsed.players?.length) return null;
    return parsed;
  } catch {
    // Corrupt or from an older shape — start clean rather than half-restored.
    return null;
  }
}

export function clearPersistedSetup() {
  storage()?.removeItem(DRAFT_KEY);
}

export function useDraftSetup(options: { persist?: boolean } = {}) {
  const saved = options.persist ? readPersisted() : null;

  const name = ref(saved?.name ?? "");
  const players = ref<string[]>(saved?.players ?? []);
  const scope = ref<DraftScope>(saved?.scope ?? "single-pod");
  const trackGameScores = ref(saved?.trackGameScores ?? false);
  const targetPodSize = ref(saved?.targetPodSize ?? DEFAULT_POD_SIZE);

  const roundCount = ref(saved?.roundCount ?? 3);
  // Once the organizer moves the stepper themselves, a changing roster clamps
  // their number into range instead of overwriting it.
  const roundCountTouched = ref(saved?.roundCountTouched ?? false);

  const prizeScope = ref<PrizeScope>(saved?.prizeScope ?? "per-pod");
  const totalPacks = ref(saved?.totalPacks ?? 4);
  const prizeDistribution = ref<number[]>(saved?.prizeDistribution ?? [2, 1, 1]);
  const prizePreset = ref<PrizePreset>(saved?.prizePreset ?? "custom");

  /** True when this wizard opened onto work someone had already started. */
  const restored = ref(saved !== null);

  // Set when the roster outgrows single-pod and the scope is switched for the
  // organizer. It gates "Next" until they have seen it happen — a silent switch
  // changes the shape of their event without telling them.
  const scopeAutoSwitched = ref(false);

  // ------------------------------------------------------------- roster ----

  function addPlayer(playerName: string) {
    const trimmed = playerName.trim();
    if (!trimmed) return;
    players.value = [...players.value, trimmed];
  }

  function removePlayer(index: number) {
    players.value = players.value.filter((_, i) => i !== index);
  }

  function renamePlayer(index: number, playerName: string) {
    players.value = players.value.map((p, i) =>
      i === index ? playerName : p,
    );
  }

  // --------------------------------------------------------------- pods ----

  const playerCount = computed(() => players.value.length);

  const podSizes = computed(() =>
    splitPods({
      playerCount: playerCount.value,
      scope: scope.value,
      targetPodSize: targetPodSize.value,
    }),
  );

  const smallestPod = computed(() =>
    podSizes.value.length > 0 ? Math.min(...podSizes.value) : 0,
  );

  const isMultiPod = computed(() => scope.value !== "single-pod");

  // ------------------------------------------------------------- rounds ----

  // The pod that limits everything. Guard against an empty roster so the round
  // helpers never see a zero.
  const roundBasis = computed(() => Math.max(2, smallestPod.value));
  const roundMax = computed(() => maxRounds(roundBasis.value));
  const roundRecommended = computed(() => recommendedRounds(roundBasis.value));

  watch(
    [roundMax, roundRecommended],
    () => {
      if (!roundCountTouched.value) {
        roundCount.value = roundRecommended.value;
        return;
      }
      roundCount.value = clamp(roundCount.value, 3, roundMax.value);
    },
    { immediate: true },
  );

  function setRoundCount(value: number) {
    roundCountTouched.value = true;
    roundCount.value = clamp(Math.round(value), 3, roundMax.value);
  }

  const roundNote = computed(() => {
    if (playerCount.value === 0) return "";
    // Checked first: for a pod of 4 the recommendation and the cap are both 3,
    // and "everyone plays everyone" is the more useful of the two things to say.
    if (roundCount.value >= roundMax.value) {
      return "Full round-robin — everyone plays everyone.";
    }
    if (roundCount.value < roundRecommended.value) {
      return "Fewer rounds than recommended — may end with several undefeated players.";
    }
    if (roundCount.value === roundRecommended.value) {
      return "Recommended — guarantees a single undefeated player.";
    }
    return "More rounds than needed to separate this field.";
  });

  // ------------------------------------------------------------- scope -----

  const singlePodOverflow = computed(
    () => scope.value === "single-pod" && playerCount.value > SINGLE_POD_LIMIT,
  );

  watch(playerCount, (count) => {
    if (count > SINGLE_POD_LIMIT && scope.value === "single-pod") {
      scope.value = "multi-pod-isolated";
      scopeAutoSwitched.value = true;
    }
  });

  function setScope(next: DraftScope) {
    // multi-pod-shared is schema-legal but has no build path; the picker shows
    // it disabled and this is the belt to that pair of braces.
    if (next === "multi-pod-shared") return;
    scope.value = next;
    scopeAutoSwitched.value = false;
    if (next === "single-pod") prizeScope.value = "per-pod";
  }

  function acknowledgeScopeSwitch() {
    scopeAutoSwitched.value = false;
  }

  // ------------------------------------------------------------ prizes ----

  const distributedPacks = computed(() =>
    prizeDistribution.value.reduce((sum, n) => sum + n, 0),
  );
  const packsRemaining = computed(
    () => totalPacks.value - distributedPacks.value,
  );
  const packsOverAllocated = computed(() => packsRemaining.value < 0);

  // A warning, never a block: an organizer may well be planning for a pod that
  // is still filling up.
  const placementsExceedPod = computed(
    () =>
      smallestPod.value > 0 &&
      prizeDistribution.value.length > smallestPod.value,
  );

  function applyPreset(preset: Exclude<PrizePreset, "custom">) {
    const found = PRIZE_PRESETS.find((p) => p.id === preset);
    if (!found) return;
    prizeDistribution.value = allocateByWeights(
      totalPacks.value,
      found.weights,
    );
    prizePreset.value = preset;
  }

  function setPlacement(index: number, packs: number) {
    prizeDistribution.value = prizeDistribution.value.map((n, i) =>
      i === index ? Math.max(0, Math.round(packs)) : n,
    );
    prizePreset.value = "custom";
  }

  function addPlacement() {
    prizeDistribution.value = [...prizeDistribution.value, 0];
    prizePreset.value = "custom";
  }

  function removePlacement(index: number) {
    prizeDistribution.value = prizeDistribution.value.filter(
      (_, i) => i !== index,
    );
    prizePreset.value = "custom";
  }

  function setTotalPacks(value: number) {
    totalPacks.value = Math.max(0, Math.round(value));
    // Keep a preset honest against its new pool rather than leaving a
    // distribution that no longer matches the label above it.
    if (prizePreset.value !== "custom") applyPreset(prizePreset.value);
  }

  // -------------------------------------------------------- step gating ----

  const basicsValid = computed(
    () =>
      name.value.trim().length > 0 &&
      playerCount.value >= MIN_PLAYERS &&
      !singlePodOverflow.value &&
      scope.value !== "multi-pod-shared" &&
      !scopeAutoSwitched.value,
  );

  const podsValid = computed(() => podSizes.value.length > 0);
  const prizesValid = computed(() => !packsOverAllocated.value);

  // -------------------------------------------------------- persistence ----

  if (options.persist) {
    watch(
      [
        name,
        players,
        scope,
        trackGameScores,
        targetPodSize,
        roundCount,
        roundCountTouched,
        prizeScope,
        totalPacks,
        prizeDistribution,
        prizePreset,
      ],
      () => {
        const blob: PersistedSetup = {
          name: name.value,
          players: players.value,
          scope: scope.value,
          trackGameScores: trackGameScores.value,
          targetPodSize: targetPodSize.value,
          roundCount: roundCount.value,
          roundCountTouched: roundCountTouched.value,
          prizeScope: prizeScope.value,
          totalPacks: totalPacks.value,
          prizeDistribution: prizeDistribution.value,
          prizePreset: prizePreset.value,
        };
        try {
          storage()?.setItem(DRAFT_KEY, JSON.stringify(blob));
        } catch {
          // A full or unavailable store is not worth interrupting setup over.
        }
      },
      { deep: true },
    );
  }

  /** Throw the whole form away, including anything persisted. */
  function reset() {
    name.value = "";
    players.value = [];
    scope.value = "single-pod";
    trackGameScores.value = false;
    targetPodSize.value = DEFAULT_POD_SIZE;
    roundCountTouched.value = false;
    roundCount.value = 3;
    prizeScope.value = "per-pod";
    totalPacks.value = 4;
    prizeDistribution.value = [2, 1, 1];
    prizePreset.value = "custom";
    scopeAutoSwitched.value = false;
    restored.value = false;
    clearPersistedSetup();
  }

  return {
    // fields
    name,
    players,
    scope,
    trackGameScores,
    targetPodSize,
    roundCount,
    prizeScope,
    totalPacks,
    prizeDistribution,
    prizePreset,
    scopeAutoSwitched,
    restored,
    // derived
    playerCount,
    podSizes,
    smallestPod,
    isMultiPod,
    roundMax,
    roundRecommended,
    roundNote,
    singlePodOverflow,
    distributedPacks,
    packsRemaining,
    packsOverAllocated,
    placementsExceedPod,
    basicsValid,
    podsValid,
    prizesValid,
    // actions
    addPlayer,
    removePlayer,
    renamePlayer,
    setScope,
    acknowledgeScopeSwitch,
    setRoundCount,
    applyPreset,
    setPlacement,
    addPlacement,
    removePlacement,
    setTotalPacks,
    reset,
    // constants re-exported for template use
    MIN_POD_SIZE,
    MAX_POD_SIZE,
    SINGLE_POD_LIMIT,
  };
}

export type DraftSetupState = ReturnType<typeof useDraftSetup>;
