<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "@convex/_generated/api";
import { useMutation } from "../lib/useConvex";
import { sessionId } from "../lib/session";
import { closeDraft, openDraftTournament } from "../lib/draftStore";
import { useDraftSetup } from "../lib/draftSetup";
import type { Id } from "@convex/_generated/dataModel";
import DraftBasicsStep from "../components/draft/DraftBasicsStep.vue";
import DraftPodsStep from "../components/draft/DraftPodsStep.vue";
import DraftPrizesStep from "../components/draft/DraftPrizesStep.vue";
import DraftReviewStep from "../components/draft/DraftReviewStep.vue";

const setup = useDraftSetup();
const createTournament = useMutation(api.draft.tournaments.createDraftTournament);

const STEPS = ["Basics", "Pods", "Prizes", "Review"] as const;
const step = ref(0);

const busy = ref(false);
const error = ref<string | null>(null);
const created = ref<{
  podSizes: number[];
  tournamentId: Id<"draftTournaments">;
} | null>(null);

// Each step gates the one after it; the shape of the wizard never changes, so
// the single-pod path still walks through a (trivial) pods step.
const stepValid = computed(() => {
  switch (step.value) {
    case 0:
      return setup.basicsValid.value;
    case 1:
      return setup.podsValid.value;
    case 2:
      return setup.prizesValid.value;
    default:
      return true;
  }
});

const isLastStep = computed(() => step.value === STEPS.length - 1);

function next() {
  if (!stepValid.value || isLastStep.value) return;
  step.value += 1;
}

function back() {
  if (step.value === 0) {
    closeDraft();
    return;
  }
  step.value -= 1;
}

async function start() {
  if (busy.value || !sessionId.value) return;
  busy.value = true;
  error.value = null;
  try {
    const result = await createTournament({
      name: setup.name.value.trim(),
      hostSessionId: sessionId.value,
      scope: setup.scope.value,
      trackGameScores: setup.trackGameScores.value,
      prizeScope: setup.prizeScope.value,
      totalPacks: setup.totalPacks.value,
      prizeDistribution: setup.prizeDistribution.value,
      players: setup.players.value,
      targetPodSize: setup.targetPodSize.value,
      roundCount: setup.roundCount.value,
    });
    created.value = { podSizes: result.podSizes, tournamentId: result.tournamentId };
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8 sm:max-w-lg">
    <!-- Created. Confirm what landed before handing over to the round view,
         so the organizer can catch a wrong roster before pairings exist. -->
    <template v-if="created">
      <div class="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-full border border-board-accent bg-board-accent/10 text-2xl text-board-accent"
        >
          ✓
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ setup.name.value }} is live
          </h1>
          <p class="mt-2 text-sm text-fg-muted">
            {{ setup.playerCount.value }} players across
            {{ created.podSizes.length }}
            {{ created.podSizes.length === 1 ? "pod" : "pods" }}
            ({{ created.podSizes.join(" + ") }}), {{ setup.roundCount.value }}
            rounds each.
          </p>
        </div>
        <button
          type="button"
          class="rounded-xl bg-board-accent px-6 py-3 text-sm font-semibold text-zinc-950"
          @click="openDraftTournament(created.tournamentId)"
        >
          Start round 1
        </button>
      </div>
    </template>

    <template v-else>
      <header class="mb-6">
        <div class="mb-5 flex items-center justify-between">
          <button
            type="button"
            class="text-xs text-fg-muted transition-colors hover:text-fg"
            @click="closeDraft()"
          >
            ← Cancel
          </button>
          <span class="text-xs text-fg-subtle">
            Step {{ step + 1 }} of {{ STEPS.length }}
          </span>
        </div>

        <h1 class="text-2xl font-semibold tracking-tight">
          {{ STEPS[step] }}
        </h1>

        <!-- Progress doubles as backward navigation; forward stays gated on
             each step's own validity. -->
        <div class="mt-4 grid grid-cols-4 gap-1.5">
          <button
            v-for="(label, index) in STEPS"
            :key="label"
            type="button"
            :aria-label="label"
            :disabled="index > step"
            class="h-1 rounded-full transition-colors"
            :class="index <= step ? 'bg-board-accent' : 'bg-board-edge'"
            @click="step = index"
          />
        </div>
      </header>

      <div class="flex-1">
        <DraftBasicsStep v-if="step === 0" :setup="setup" />
        <DraftPodsStep v-else-if="step === 1" :setup="setup" />
        <DraftPrizesStep v-else-if="step === 2" :setup="setup" />
        <DraftReviewStep v-else :setup="setup" />
      </div>

      <p v-if="error" class="mt-5 text-sm text-danger">{{ error }}</p>

      <div class="mt-7 flex gap-2">
        <button
          type="button"
          class="rounded-xl border border-board-edge bg-board-panel px-5 py-4 text-sm font-medium text-fg-tertiary"
          @click="back()"
        >
          {{ step === 0 ? "Cancel" : "Back" }}
        </button>
        <button
          v-if="!isLastStep"
          type="button"
          :disabled="!stepValid"
          class="flex-1 rounded-xl bg-board-accent py-4 text-base font-semibold text-zinc-950 transition-opacity disabled:opacity-30"
          @click="next()"
        >
          Next
        </button>
        <button
          v-else
          type="button"
          :disabled="busy || !setup.basicsValid.value || !setup.prizesValid.value"
          class="flex-1 rounded-xl bg-board-accent py-4 text-base font-semibold text-zinc-950 transition-opacity disabled:opacity-30"
          @click="start()"
        >
          {{ busy ? "Starting…" : "Start tournament" }}
        </button>
      </div>
    </template>
  </div>
</template>
