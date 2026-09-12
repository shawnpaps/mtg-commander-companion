<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "@convex/_generated/api";
import { useMutation } from "../../lib/useConvex";
import { outcomeOf, resultOptions } from "@convex/draft/results";
import type { Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  match: {
    _id: Id<"draftMatches">;
    round: number;
    entrant1Name: string;
    entrant2Name: string | null;
    entrant1GameWins: number;
    entrant2GameWins: number;
    reported: boolean;
    isBye: boolean;
  };
  trackGameScores: boolean;
  /** False once a later round has been paired from this round's results. */
  editable: boolean;
}>();

const report = useMutation(api.draft.matches.reportMatchResult);
const clear = useMutation(api.draft.matches.clearMatchResult);

const busy = ref(false);
const error = ref<string | null>(null);

const options = computed(() => resultOptions(props.trackGameScores));

const currentOutcome = computed(() =>
  props.match.reported
    ? outcomeOf(props.match.entrant1GameWins, props.match.entrant2GameWins)
    : null,
);

function isSelected(option: { entrant1GameWins: number; entrant2GameWins: number }) {
  return (
    props.match.reported &&
    props.match.entrant1GameWins === option.entrant1GameWins &&
    props.match.entrant2GameWins === option.entrant2GameWins
  );
}

async function choose(option: { entrant1GameWins: number; entrant2GameWins: number }) {
  if (busy.value || !props.editable) return;
  busy.value = true;
  error.value = null;
  try {
    await report({
      matchId: props.match._id,
      entrant1GameWins: option.entrant1GameWins,
      entrant2GameWins: option.entrant2GameWins,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function undo() {
  if (busy.value || !props.editable) return;
  busy.value = true;
  error.value = null;
  try {
    await clear({ matchId: props.match._id });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

/** Short label for the match-only picker, where "2–0" means less than "Win". */
function terseLabel(outcome: "entrant1" | "draw" | "entrant2") {
  if (outcome === "draw") return "Draw";
  return "Win";
}
</script>

<template>
  <div
    class="rounded-xl border bg-board-panel px-4 py-3"
    :class="match.reported ? 'border-board-edge' : 'border-board-edge-strong'"
  >
    <!-- A bye is already scored and has no opponent to report against. -->
    <template v-if="match.isBye">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-medium text-fg-secondary">
          {{ match.entrant1Name }}
        </span>
        <span
          class="rounded-lg border border-board-edge px-2.5 py-1 text-xs text-fg-muted"
        >
          Bye · 2–0
        </span>
      </div>
      <p class="mt-1 text-xs text-fg-subtle">
        Scored automatically as a win. Nothing to enter.
      </p>
    </template>

    <template v-else>
      <div class="flex items-center justify-between gap-3">
        <span
          class="flex-1 truncate text-sm font-medium"
          :class="
            currentOutcome === 'entrant1' ? 'text-board-accent' : 'text-fg-secondary'
          "
        >
          {{ match.entrant1Name }}
        </span>
        <span class="shrink-0 text-xs text-fg-subtle">vs</span>
        <span
          class="flex-1 truncate text-right text-sm font-medium"
          :class="
            currentOutcome === 'entrant2' ? 'text-board-accent' : 'text-fg-secondary'
          "
        >
          {{ match.entrant2Name }}
        </span>
      </div>

      <div class="mt-3 flex gap-1.5">
        <button
          v-for="option in options"
          :key="option.label"
          type="button"
          :disabled="busy || !editable"
          class="flex-1 rounded-lg border py-2 text-xs font-medium transition-colors disabled:opacity-40"
          :class="
            isSelected(option)
              ? 'border-board-accent bg-board-accent/15 text-board-accent'
              : 'border-board-edge text-fg-tertiary'
          "
          @click="choose(option)"
        >
          {{ trackGameScores ? option.label : terseLabel(option.outcome) }}
        </button>
      </div>

      <div class="mt-2 flex items-center justify-between gap-2">
        <span
          class="text-xs"
          :class="match.reported ? 'text-fg-subtle' : 'text-fg-muted'"
        >
          <template v-if="match.reported">
            Reported {{ match.entrant1GameWins }}–{{ match.entrant2GameWins }}
          </template>
          <template v-else> Waiting on a result </template>
        </span>
        <button
          v-if="match.reported && editable"
          type="button"
          :disabled="busy"
          class="rounded-md px-2 py-1 text-xs text-fg-subtle transition-colors hover:text-danger disabled:opacity-40"
          @click="undo()"
        >
          Clear
        </button>
      </div>

      <p v-if="!editable" class="mt-1 text-xs text-fg-subtle">
        Locked — a later round was paired from this result.
      </p>
      <p v-if="error" class="mt-2 text-xs text-danger">{{ error }}</p>
    </template>
  </div>
</template>
