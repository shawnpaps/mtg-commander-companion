<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "../../lib/useConvex";
import { sessionId } from "../../lib/session";
import { maxRounds } from "@convex/draft/rules";
import type { Doc, Id } from "@convex/_generated/dataModel";
import DraftMatchCard from "./DraftMatchCard.vue";
import DraftStandingsTable from "./DraftStandingsTable.vue";

const props = defineProps<{
  pod: Doc<"draftPods">;
  entrants: Doc<"draftEntrants">[];
  trackGameScores: boolean;
  /** Organizer controls are hidden entirely rather than shown disabled — a
      player has no use for a button they will never be allowed to press. */
  isHost: boolean;
  myEntrantId: Id<"draftEntrants"> | null;
}>();

const generatePairings = useMutation(api.draft.engine.generatePairings);
const extendPodRounds = useMutation(api.draft.engine.extendPodRounds);

const podMatches = useQuery(api.draft.matches.listPodMatches, () => ({
  podId: props.pod._id,
}));
const standings = useQuery(api.draft.engine.computeStandings, () => ({
  podId: props.pod._id,
}));

const busy = ref(false);
const error = ref<string | null>(null);

const activeEntrants = computed(
  () => props.entrants.filter((e) => !e.dropped).length,
);

const rounds = computed(() => {
  const rows = podMatches.value?.matches ?? [];
  const byRound = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byRound.get(row.round) ?? [];
    list.push(row);
    byRound.set(row.round, list);
  }
  return [...byRound.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([round, matches]) => ({ round, matches }));
});

const currentRoundComplete = computed(
  () => podMatches.value?.currentRoundComplete ?? false,
);

const notStarted = computed(() => props.pod.currentRound === 0);
const atFinalRound = computed(
  () => props.pod.currentRound >= props.pod.roundCount,
);

/** Can another round be added without forcing a rematch? */
const canExtend = computed(
  () => props.pod.roundCount < maxRounds(activeEntrants.value),
);

const primaryAction = computed(() => {
  if (props.pod.status === "complete") return "done";
  if (notStarted.value) return "start";
  if (!currentRoundComplete.value) return "waiting";
  if (!atFinalRound.value) return "next";
  return "finish";
});

const outstanding = computed(() => {
  const current = (podMatches.value?.matches ?? []).filter(
    (m) => m.round === props.pod.currentRound,
  );
  return current.filter((m) => !m.reported).length;
});

async function pairNextRound() {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    if (!sessionId.value) return;
    await generatePairings({ podId: props.pod._id, sessionId: sessionId.value });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    error.value = friendlyError(raw);
  } finally {
    busy.value = false;
  }
}

async function extend() {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    if (!sessionId.value) return;
    await extendPodRounds({ podId: props.pod._id, sessionId: sessionId.value });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

/**
 * The engine throws `draft/<reason>: <message>`. Exhaustion is the one worth
 * rewriting — it is not a failure so much as the pod having run out of fresh
 * pairings, and the organizer needs to know that is the situation.
 */
function friendlyError(raw: string): string {
  const match = raw.match(/draft\/([a-z-]+): (.*)/);
  if (!match) return raw;
  const [, reason, message] = match;
  if (reason === "pairing-exhausted") {
    return `Everyone in this pod has already played everyone they can. ${message}. Finish the pod here.`;
  }
  return message;
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex items-baseline justify-between gap-3">
      <h2 class="text-lg font-semibold">Pod {{ pod.index }}</h2>
      <span class="text-xs text-fg-muted">
        <template v-if="pod.status === 'complete'">Complete</template>
        <template v-else-if="notStarted">
          {{ activeEntrants }} players · {{ pod.roundCount }} rounds
        </template>
        <template v-else>
          Round {{ pod.currentRound }} of {{ pod.roundCount }}
        </template>
      </span>
    </header>

    <!-- Primary action, driven entirely by where the pod is. -->
    <div v-if="isHost" class="flex flex-col gap-2">
      <button
        v-if="primaryAction === 'start'"
        type="button"
        :disabled="busy"
        class="rounded-xl bg-board-accent py-4 text-base font-semibold text-zinc-950 transition-opacity disabled:opacity-30"
        @click="pairNextRound()"
      >
        {{ busy ? "Pairing…" : "Start round 1" }}
      </button>

      <button
        v-else-if="primaryAction === 'next'"
        type="button"
        :disabled="busy"
        class="rounded-xl bg-board-accent py-4 text-base font-semibold text-zinc-950 transition-opacity disabled:opacity-30"
        @click="pairNextRound()"
      >
        {{ busy ? "Pairing…" : `Generate round ${pod.currentRound + 1}` }}
      </button>

      <!-- Disabled, not hidden: the organizer should see the next step and why
           it is not available yet. -->
      <button
        v-else-if="primaryAction === 'waiting'"
        type="button"
        disabled
        class="rounded-xl bg-board-accent py-4 text-base font-semibold text-zinc-950 opacity-30"
      >
        {{
          atFinalRound
            ? "Complete pod"
            : `Generate round ${pod.currentRound + 1}`
        }}
      </button>

      <p v-if="primaryAction === 'waiting'" class="text-center text-xs text-fg-muted">
        {{ outstanding }}
        {{ outstanding === 1 ? "result" : "results" }} still to come in.
      </p>

      <template v-if="primaryAction === 'finish'">
        <button
          type="button"
          disabled
          class="rounded-xl bg-board-accent py-4 text-base font-semibold text-zinc-950 opacity-30"
        >
          Complete pod
        </button>
        <p class="text-center text-xs text-fg-muted">
          Every round is in. Final standings and prize payout arrive in the next
          release.
        </p>
      </template>

      <button
        v-if="canExtend && pod.status === 'active' && !notStarted"
        type="button"
        :disabled="busy"
        class="rounded-xl border border-board-edge bg-board-panel py-3 text-sm font-medium text-fg-tertiary transition-colors hover:border-board-accent hover:text-board-accent disabled:opacity-40"
        @click="extend()"
      >
        Extend — add round {{ pod.roundCount + 1 }}
      </button>

      <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    </div>

    <!-- What a player sees in place of the organizer's controls. -->
    <div
      v-else
      class="rounded-xl border border-board-edge bg-board-panel px-4 py-3"
    >
      <p class="text-sm text-fg-secondary">
        <template v-if="pod.status === 'complete'">This pod is finished.</template>
        <template v-else-if="notStarted">
          Waiting for the organizer to start round 1.
        </template>
        <template v-else-if="!currentRoundComplete">
          Round {{ pod.currentRound }} is underway — {{ outstanding }}
          {{ outstanding === 1 ? "result" : "results" }} still to come in.
        </template>
        <template v-else-if="!atFinalRound">
          Round {{ pod.currentRound }} is done. Waiting on round
          {{ pod.currentRound + 1 }}.
        </template>
        <template v-else>Every round is in.</template>
      </p>
    </div>

    <DraftStandingsTable
      v-if="standings?.length"
      :rows="standings"
      :track-game-scores="trackGameScores"
    />

    <section v-if="rounds.length" class="flex flex-col gap-4">
      <div v-for="group in rounds" :key="group.round" class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between">
          <h3 class="text-xs font-medium uppercase tracking-wide text-fg-muted">
            Round {{ group.round }}
          </h3>
          <span
            v-if="group.round === pod.currentRound && !currentRoundComplete"
            class="text-xs text-fg-subtle"
          >
            in progress
          </span>
        </div>
        <DraftMatchCard
          v-for="match in group.matches"
          :key="match._id"
          :match="match"
          :track-game-scores="trackGameScores"
          :editable="pod.status === 'active' && group.round >= pod.currentRound"
          :can-report="isHost"
          :my-entrant-id="myEntrantId"
        />
      </div>
    </section>

    <p v-else-if="notStarted" class="text-sm text-fg-muted">
      Round 1 pairs at random. Every round after that pairs on record, and
      nobody plays the same opponent twice.
    </p>
  </div>
</template>
