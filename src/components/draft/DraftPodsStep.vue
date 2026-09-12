<script setup lang="ts">
import { computed } from "vue";
import { assignToPods } from "@convex/draft/pods";
import type { DraftSetupState } from "../../lib/draftSetup";

const props = defineProps<{ setup: DraftSetupState }>();

// The same deal the mutation will do, so the names under each pod card are the
// names that end up in that pod.
const seating = computed(() =>
  assignToPods(props.setup.players.value, props.setup.podSizes.value),
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div v-if="!setup.isMultiPod.value" class="flex flex-col gap-3">
      <div class="rounded-xl border border-board-edge bg-board-panel px-4 py-5">
        <p class="text-sm font-medium text-fg-secondary">
          1 pod · {{ setup.playerCount.value }} players ·
          {{ setup.roundCount.value }} rounds
        </p>
        <p class="mt-1 text-xs text-fg-muted">
          Everyone drafts together. Nothing to split.
        </p>
      </div>
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="(player, index) in setup.players.value"
          :key="`${player}-${index}`"
          class="rounded-lg border border-board-edge bg-board-panel px-2.5 py-1 text-xs text-fg-tertiary"
        >
          {{ player }}
        </li>
      </ul>
    </div>

    <template v-else>
      <div class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between">
          <span class="text-xs font-medium uppercase tracking-wide text-fg-muted">
            Target pod size
          </span>
          <span class="text-sm font-semibold tabular-nums text-board-accent">
            {{ setup.targetPodSize.value }}
          </span>
        </div>
        <input
          v-model.number="setup.targetPodSize.value"
          type="range"
          :min="setup.MIN_POD_SIZE"
          :max="setup.MAX_POD_SIZE"
          step="1"
          class="w-full accent-[var(--color-board-accent)]"
        />
        <p class="text-xs text-fg-muted">
          Pods come out as even as possible rather than filling one at a time —
          {{ setup.playerCount.value }} players land as
          {{ setup.podSizes.value.join(" + ") }}.
        </p>
      </div>

      <div class="grid gap-2 sm:grid-cols-2">
        <div
          v-for="(size, index) in setup.podSizes.value"
          :key="index"
          class="rounded-xl border border-board-edge bg-board-panel px-4 py-3"
        >
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium text-fg-secondary">
              Pod {{ index + 1 }}
            </span>
            <span class="text-xs text-fg-muted">
              {{ size }} players · {{ setup.roundCount.value }} rounds
            </span>
          </div>
          <ul class="mt-2 flex flex-wrap gap-1">
            <li
              v-for="player in seating[index]"
              :key="player"
              class="rounded border border-board-edge px-2 py-0.5 text-[11px] text-fg-tertiary"
            >
              {{ player }}
            </li>
          </ul>
        </div>
      </div>

      <p class="text-xs text-fg-subtle">
        Each pod runs its own tournament and awards its own prizes. Seating is
        in roster order — it carries no advantage, since round 1 inside each pod
        is a random shuffle.
      </p>
    </template>
  </div>
</template>
