<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api } from "@convex/_generated/api";
import { useQuery } from "../lib/useConvex";
import { closeDraft, forgetDraft } from "../lib/draftStore";
import { sessionId } from "../lib/session";
import type { Id } from "@convex/_generated/dataModel";
import DraftPodPanel from "../components/draft/DraftPodPanel.vue";

const props = defineProps<{ tournamentId: Id<"draftTournaments"> }>();

const data = useQuery(api.draft.tournaments.getTournament, () => ({
  tournamentId: props.tournamentId,
}));

// Who this device is at this event: the organizer, a seated player, or a
// bystander who followed a link.
const seat = useQuery(api.draft.tournaments.mySeat, () =>
  sessionId.value
    ? { tournamentId: props.tournamentId, sessionId: sessionId.value }
    : null,
);

const isHost = computed(() => seat.value?.isHost ?? false);
const myEntrantId = computed(() => seat.value?.entrantId ?? null);
const copied = ref(false);

async function copyCode() {
  if (!data.value) return;
  try {
    await navigator.clipboard.writeText(data.value.tournament.code);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Clipboard access is routinely refused; the code is on screen regardless.
  }
}

const selectedPodId = ref<Id<"draftPods"> | null>(null);

// Land on the first pod, and don't strand the selection if the tournament
// being viewed changes underneath it.
watch(
  [data, seat],
  ([value, mine]) => {
    if (!value) return;
    const stillThere = value.pods.some((p) => p._id === selectedPodId.value);
    if (stillThere) return;
    // A player cares about one pod out of however many, so start them there.
    selectedPodId.value = mine?.podId ?? value.pods[0]?._id ?? null;
  },
  { immediate: true },
);

const selectedPod = computed(
  () => data.value?.pods.find((p) => p._id === selectedPodId.value) ?? null,
);

const entrantsForPod = computed(() =>
  (data.value?.entrants ?? []).filter((e) => e.podId === selectedPodId.value),
);

const scopeLabel = computed(() =>
  data.value?.tournament.scope === "single-pod" ? "Single pod" : "Separate pods",
);

function leave() {
  forgetDraft();
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8 sm:max-w-lg">
    <div v-if="data === undefined" class="flex flex-1 items-center justify-center">
      <p class="animate-pulse text-sm text-fg-muted">Loading tournament…</p>
    </div>

    <div
      v-else-if="data === null"
      class="flex flex-1 flex-col items-center justify-center gap-4 text-center"
    >
      <p class="text-sm text-fg-muted">That tournament no longer exists.</p>
      <button
        type="button"
        class="rounded-xl border border-board-edge bg-board-panel px-5 py-3 text-sm text-fg-tertiary"
        @click="leave()"
      >
        Back to the lobby
      </button>
    </div>

    <template v-else>
      <header class="mb-6">
        <div class="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            class="text-xs text-fg-muted transition-colors hover:text-fg"
            @click="closeDraft()"
          >
            ← Lobby
          </button>
          <span class="text-xs text-fg-subtle capitalize">
            {{ data.tournament.status }}
          </span>
        </div>

        <h1 class="text-2xl font-semibold tracking-tight">
          {{ data.tournament.name }}
        </h1>
        <p class="mt-1 text-xs text-fg-muted">
          {{ scopeLabel }} · {{ data.entrants.length }} players ·
          {{ data.tournament.trackGameScores ? "game scores" : "match results" }}
        </p>

        <!-- The way anyone else gets in. Shown to everyone, because a player
             who has the code can pass it to the person next to them. -->
        <button
          type="button"
          class="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-board-edge bg-board-panel px-4 py-3 text-left transition-colors hover:border-board-accent"
          @click="copyCode()"
        >
          <span>
            <span class="block text-[11px] uppercase tracking-wide text-fg-muted">
              Join code
            </span>
            <span
              class="font-mono text-xl tracking-[0.3em] text-board-accent"
            >
              {{ data.tournament.code }}
            </span>
          </span>
          <span class="shrink-0 text-xs text-fg-subtle">
            {{ copied ? "Copied" : "Tap to copy" }}
          </span>
        </button>

        <p class="mt-2 text-xs text-fg-subtle">
          <template v-if="isHost">
            You are running this event.
            <template v-if="seat?.name"> Seated as {{ seat.name }}.</template>
          </template>
          <template v-else-if="seat?.name">
            You are seated as {{ seat.name }}.
          </template>
          <template v-else>
            You are watching. Join with the code above to claim your seat.
          </template>
        </p>
      </header>

      <!-- Only worth a selector when there is more than one pod to choose. -->
      <div
        v-if="data.pods.length > 1"
        class="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-board-panel p-1"
      >
        <button
          v-for="pod in data.pods"
          :key="pod._id"
          type="button"
          class="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          :class="
            pod._id === selectedPodId
              ? 'bg-board-accent text-zinc-950'
              : 'text-fg-tertiary hover:text-fg'
          "
          @click="selectedPodId = pod._id"
        >
          Pod {{ pod.index }}
        </button>
      </div>

      <DraftPodPanel
        v-if="selectedPod"
        :key="selectedPod._id"
        :pod="selectedPod"
        :entrants="entrantsForPod"
        :track-game-scores="data.tournament.trackGameScores"
        :is-host="isHost"
        :my-entrant-id="myEntrantId"
      />
    </template>
  </div>
</template>
