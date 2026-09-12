<script setup lang="ts">
import { computed, ref } from "vue";
import type { DraftScope, DraftSetupState } from "../../lib/draftSetup";

const props = defineProps<{ setup: DraftSetupState }>();

const newPlayer = ref("");

const SCOPES: Array<{
  id: DraftScope;
  label: string;
  detail: string;
  disabled?: boolean;
}> = [
  {
    id: "single-pod",
    label: "Single pod",
    detail: "One draft, up to 8 players.",
  },
  {
    id: "multi-pod-isolated",
    label: "Separate pods",
    detail: "9+ players. Each pod is its own tournament and its own prizes.",
  },
  {
    id: "multi-pod-shared",
    label: "Shared standings",
    detail: "One table across every pod. Coming in a later release.",
    disabled: true,
  },
];

function submitPlayer() {
  props.setup.addPlayer(newPlayer.value);
  newPlayer.value = "";
}

const roundStepperMin = 3;
const canDecrement = computed(() => props.setup.roundCount.value > roundStepperMin);
const canIncrement = computed(
  () => props.setup.roundCount.value < props.setup.roundMax.value,
);
</script>

<template>
  <div class="flex flex-col gap-7">
    <label class="flex flex-col gap-2">
      <span class="text-xs font-medium uppercase tracking-wide text-fg-muted">
        Tournament name
      </span>
      <input
        v-model="setup.name.value"
        type="text"
        placeholder="Friday Night Draft"
        class="rounded-xl border border-board-edge-strong bg-board-panel px-4 py-3 text-base outline-none focus:border-board-accent"
      />
    </label>

    <div class="flex flex-col gap-2">
      <div class="flex items-baseline justify-between">
        <span class="text-xs font-medium uppercase tracking-wide text-fg-muted">
          Players
        </span>
        <span class="text-xs text-fg-subtle">{{ setup.playerCount.value }} added</span>
      </div>

      <form class="flex gap-2" @submit.prevent="submitPlayer">
        <input
          v-model="newPlayer"
          type="text"
          placeholder="Add a player"
          class="min-w-0 flex-1 rounded-xl border border-board-edge-strong bg-board-panel px-4 py-3 text-base outline-none focus:border-board-accent"
        />
        <button
          type="submit"
          :disabled="!newPlayer.trim()"
          class="shrink-0 rounded-xl border border-board-accent bg-board-accent/10 px-4 text-sm font-medium text-board-accent transition-opacity disabled:opacity-30"
        >
          Add
        </button>
      </form>

      <ul v-if="setup.playerCount.value" class="flex flex-col gap-1.5">
        <li
          v-for="(player, index) in setup.players.value"
          :key="`${player}-${index}`"
          class="flex items-center gap-2 rounded-lg border border-board-edge bg-board-panel px-3 py-2"
        >
          <span class="w-5 shrink-0 text-xs tabular-nums text-fg-subtle">
            {{ index + 1 }}
          </span>
          <input
            :value="player"
            class="min-w-0 flex-1 bg-transparent text-sm outline-none"
            @input="
              setup.renamePlayer(
                index,
                ($event.target as HTMLInputElement).value,
              )
            "
          />
          <button
            type="button"
            aria-label="Remove player"
            class="shrink-0 rounded-md px-2 py-1 text-xs text-fg-subtle transition-colors hover:text-danger"
            @click="setup.removePlayer(index)"
          >
            ✕
          </button>
        </li>
      </ul>
      <p v-else class="text-xs text-fg-subtle">
        Add everyone drafting. You can edit names later from the round view.
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium uppercase tracking-wide text-fg-muted">
        Event scope
      </span>
      <div class="grid gap-2">
        <button
          v-for="option in SCOPES"
          :key="option.id"
          type="button"
          :disabled="option.disabled"
          class="rounded-xl border px-4 py-3 text-left transition-colors"
          :class="[
            setup.scope.value === option.id
              ? 'border-board-accent bg-board-accent/10'
              : 'border-board-edge bg-board-panel',
            option.disabled ? 'cursor-not-allowed opacity-45' : '',
          ]"
          @click="setup.setScope(option.id)"
        >
          <span
            class="flex items-center gap-2 text-sm font-medium"
            :class="
              setup.scope.value === option.id
                ? 'text-board-accent'
                : 'text-fg-secondary'
            "
          >
            {{ option.label }}
            <span
              v-if="option.disabled"
              class="rounded border border-board-edge-strong px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fg-subtle"
            >
              v2
            </span>
          </span>
          <span class="mt-0.5 block text-xs text-fg-muted">
            {{ option.detail }}
          </span>
        </button>
      </div>

      <!-- The roster outgrew a single pod and the scope moved on its own. Say
           so, and hold "Next" until it has been read. -->
      <div
        v-if="setup.scopeAutoSwitched.value"
        class="flex flex-col gap-2 rounded-xl border border-board-accent/50 bg-board-accent/10 px-4 py-3"
      >
        <p class="text-xs leading-relaxed text-fg-secondary">
          {{ setup.SINGLE_POD_LIMIT + 1 }}+ players needs a multi-pod scope, so
          this switched to <strong class="text-board-accent">separate pods</strong>.
          Your players will be split across
          {{ setup.podSizes.value.length }} pods.
        </p>
        <button
          type="button"
          class="self-start rounded-lg border border-board-accent px-3 py-1.5 text-xs font-medium text-board-accent"
          @click="setup.acknowledgeScopeSwitch()"
        >
          Got it
        </button>
      </div>

      <p v-else-if="setup.singlePodOverflow.value" class="text-xs text-danger">
        {{ setup.SINGLE_POD_LIMIT + 1 }}+ players needs a multi-pod scope.
      </p>
    </div>

    <div v-if="setup.playerCount.value >= 2" class="flex flex-col gap-2">
      <span class="text-xs font-medium uppercase tracking-wide text-fg-muted">
        Rounds per pod
      </span>
      <div class="flex items-center gap-3">
        <button
          type="button"
          aria-label="One fewer round"
          :disabled="!canDecrement"
          class="h-11 w-11 shrink-0 rounded-xl border border-board-edge bg-board-panel text-lg text-fg-secondary transition-opacity disabled:opacity-30"
          @click="setup.setRoundCount(setup.roundCount.value - 1)"
        >
          −
        </button>
        <div
          class="flex flex-1 flex-col items-center rounded-xl border border-board-edge bg-board-panel py-2"
        >
          <span class="text-2xl font-semibold tabular-nums">
            {{ setup.roundCount.value }}
          </span>
          <span class="text-[11px] text-fg-subtle">
            3–{{ setup.roundMax.value }} for a pod of {{ setup.smallestPod.value }}
          </span>
        </div>
        <button
          type="button"
          aria-label="One more round"
          :disabled="!canIncrement"
          class="h-11 w-11 shrink-0 rounded-xl border border-board-edge bg-board-panel text-lg text-fg-secondary transition-opacity disabled:opacity-30"
          @click="setup.setRoundCount(setup.roundCount.value + 1)"
        >
          +
        </button>
      </div>
      <p class="text-xs text-fg-muted">{{ setup.roundNote.value }}</p>
    </div>

    <button
      type="button"
      class="flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
      :class="
        setup.trackGameScores.value
          ? 'border-board-accent bg-board-accent/10'
          : 'border-board-edge bg-board-panel'
      "
      @click="setup.trackGameScores.value = !setup.trackGameScores.value"
    >
      <span
        class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs"
        :class="
          setup.trackGameScores.value
            ? 'border-board-accent bg-board-accent text-zinc-950'
            : 'border-board-edge-strong text-transparent'
        "
      >
        ✓
      </span>
      <span>
        <span class="block text-sm font-medium text-fg-secondary">
          Track game scores
        </span>
        <span class="mt-0.5 block text-xs text-fg-muted">
          Record each match 2–1 rather than just a winner. Enables game-win
          tiebreakers when match points and opponents' records are level.
        </span>
      </span>
    </button>
  </div>
</template>
