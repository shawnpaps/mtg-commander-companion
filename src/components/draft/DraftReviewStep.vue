<script setup lang="ts">
import { computed } from "vue";
import type { DraftSetupState } from "../../lib/draftSetup";

const props = defineProps<{ setup: DraftSetupState }>();

const scopeLabel = computed(() =>
  props.setup.isMultiPod.value ? "Separate pods" : "Single pod",
);

const tiebreakerLabel = computed(() =>
  props.setup.trackGameScores.value
    ? "Match points → opponents' match win % → game win % → opponents' game win %"
    : "Match points → opponents' match win %",
);

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
const payouts = computed(() =>
  props.setup.prizeDistribution.value
    .map((packs, i) => ({
      place: ORDINALS[i] ?? `${i + 1}th`,
      packs,
    }))
    .filter((row) => row.packs > 0),
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="rounded-xl border border-board-edge bg-board-panel px-4 py-4">
      <h3 class="text-lg font-semibold">{{ setup.name.value || "Untitled draft" }}</h3>
      <p class="mt-0.5 text-xs text-fg-muted">
        {{ scopeLabel }} · {{ setup.playerCount.value }} players ·
        {{ setup.podSizes.value.length }}
        {{ setup.podSizes.value.length === 1 ? "pod" : "pods" }}
      </p>
    </div>

    <dl class="flex flex-col gap-px overflow-hidden rounded-xl border border-board-edge">
      <div class="flex justify-between gap-4 bg-board-panel px-4 py-3">
        <dt class="text-xs text-fg-muted">Pods</dt>
        <dd class="text-right text-sm text-fg-secondary">
          <span v-for="(size, i) in setup.podSizes.value" :key="i" class="block">
            Pod {{ i + 1 }} — {{ size }} players, {{ setup.roundCount.value }} rounds
          </span>
        </dd>
      </div>
      <div class="flex justify-between gap-4 bg-board-panel px-4 py-3">
        <dt class="text-xs text-fg-muted">Tiebreakers</dt>
        <dd class="max-w-[60%] text-right text-xs text-fg-secondary">
          {{ tiebreakerLabel }}
        </dd>
      </div>
      <div class="flex justify-between gap-4 bg-board-panel px-4 py-3">
        <dt class="text-xs text-fg-muted">Prizes</dt>
        <dd class="text-right text-sm text-fg-secondary">
          <span class="block text-xs text-fg-muted">
            {{ setup.totalPacks.value }} packs
            {{
              setup.isMultiPod.value && setup.prizeScope.value === "per-pod"
                ? "per pod"
                : setup.isMultiPod.value
                  ? "across the event"
                  : ""
            }}
          </span>
          <span v-for="row in payouts" :key="row.place" class="block">
            {{ row.place }} — {{ row.packs }}
            {{ row.packs === 1 ? "pack" : "packs" }}
          </span>
          <span v-if="!payouts.length" class="block text-xs text-fg-subtle">
            No packs assigned
          </span>
        </dd>
      </div>
    </dl>

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
</template>
