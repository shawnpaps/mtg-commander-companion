<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api } from "@convex/_generated/api";
import { useQuery } from "../lib/useConvex";
import { closeDraft, draftTournamentId } from "../lib/draftStore";
import type { Id } from "@convex/_generated/dataModel";
import DraftPodPanel from "../components/draft/DraftPodPanel.vue";

const props = defineProps<{ tournamentId: Id<"draftTournaments"> }>();

const data = useQuery(api.draft.tournaments.getTournament, () => ({
  tournamentId: props.tournamentId,
}));

const selectedPodId = ref<Id<"draftPods"> | null>(null);

// Land on the first pod, and don't strand the selection if the tournament
// being viewed changes underneath it.
watch(
  data,
  (value) => {
    if (!value) return;
    const stillThere = value.pods.some((p) => p._id === selectedPodId.value);
    if (!stillThere) selectedPodId.value = value.pods[0]?._id ?? null;
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
  draftTournamentId.value = null;
  closeDraft();
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
      />
    </template>
  </div>
</template>
