<script setup lang="ts">
import { PRIZE_PRESETS } from "../../lib/draftSetup";
import type { DraftSetupState } from "../../lib/draftSetup";

defineProps<{ setup: DraftSetupState }>();

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

function placeLabel(index: number): string {
  return ORDINALS[index] ?? `${index + 1}th`;
}
</script>

<template>
  <div class="flex flex-col gap-7">
    <div v-if="setup.isMultiPod.value" class="flex flex-col gap-2">
      <span class="text-xs font-medium uppercase tracking-wide text-fg-muted">
        Prize scope
      </span>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="option in ([
            { id: 'per-pod', label: 'Per pod', detail: 'Each pod pays out' },
            { id: 'global', label: 'Global pool', detail: 'One pool, whole event' },
          ] as const)"
          :key="option.id"
          type="button"
          class="rounded-xl border px-3 py-3 text-left transition-colors"
          :class="
            setup.prizeScope.value === option.id
              ? 'border-board-accent bg-board-accent/10 text-board-accent'
              : 'border-board-edge bg-board-panel text-fg-tertiary'
          "
          @click="setup.prizeScope.value = option.id"
        >
          <span class="block text-sm font-medium">{{ option.label }}</span>
          <span class="mt-0.5 block text-xs text-fg-muted">
            {{ option.detail }}
          </span>
        </button>
      </div>
    </div>

    <label class="flex flex-col gap-2">
      <span class="text-xs font-medium uppercase tracking-wide text-fg-muted">
        Packs available
        <span v-if="setup.prizeScope.value === 'per-pod'" class="normal-case text-fg-subtle">
          (per pod)
        </span>
      </span>
      <input
        :value="setup.totalPacks.value"
        type="number"
        inputmode="numeric"
        min="0"
        class="rounded-xl border border-board-edge-strong bg-board-panel px-4 py-3 text-base outline-none focus:border-board-accent"
        @input="
          setup.setTotalPacks(
            Number(($event.target as HTMLInputElement).value) || 0,
          )
        "
      />
    </label>

    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium uppercase tracking-wide text-fg-muted">
        Presets
      </span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="preset in PRIZE_PRESETS"
          :key="preset.id"
          type="button"
          class="rounded-lg border px-3 py-2 text-xs transition-colors"
          :class="
            setup.prizePreset.value === preset.id
              ? 'border-board-accent bg-board-accent/10 text-board-accent'
              : 'border-board-edge bg-board-panel text-fg-tertiary'
          "
          @click="setup.applyPreset(preset.id)"
        >
          {{ preset.label }}
        </button>
        <span
          v-if="setup.prizePreset.value === 'custom'"
          class="rounded-lg border border-board-edge-strong px-3 py-2 text-xs text-fg-subtle"
        >
          Custom
        </span>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-baseline justify-between">
        <span class="text-xs font-medium uppercase tracking-wide text-fg-muted">
          Distribution
        </span>
        <span
          class="text-xs tabular-nums"
          :class="setup.packsOverAllocated.value ? 'text-danger' : 'text-fg-muted'"
        >
          {{ setup.distributedPacks.value }} of {{ setup.totalPacks.value }} assigned
        </span>
      </div>

      <ul class="flex flex-col gap-1.5">
        <li
          v-for="(packs, index) in setup.prizeDistribution.value"
          :key="index"
          class="flex items-center gap-2 rounded-lg border border-board-edge bg-board-panel px-3 py-2"
        >
          <span class="w-10 shrink-0 text-xs font-medium text-fg-tertiary">
            {{ placeLabel(index) }}
          </span>
          <button
            type="button"
            :aria-label="`One fewer pack for ${placeLabel(index)}`"
            :disabled="packs <= 0"
            class="h-8 w-8 shrink-0 rounded-lg border border-board-edge text-fg-secondary transition-opacity disabled:opacity-30"
            @click="setup.setPlacement(index, packs - 1)"
          >
            −
          </button>
          <span class="w-10 text-center text-sm tabular-nums">{{ packs }}</span>
          <button
            type="button"
            :aria-label="`One more pack for ${placeLabel(index)}`"
            class="h-8 w-8 shrink-0 rounded-lg border border-board-edge text-fg-secondary"
            @click="setup.setPlacement(index, packs + 1)"
          >
            +
          </button>
          <span class="flex-1 text-xs text-fg-subtle">
            {{ packs === 1 ? "pack" : "packs" }}
          </span>
          <button
            type="button"
            :aria-label="`Remove ${placeLabel(index)} place`"
            class="shrink-0 rounded-md px-2 py-1 text-xs text-fg-subtle transition-colors hover:text-danger"
            @click="setup.removePlacement(index)"
          >
            ✕
          </button>
        </li>
      </ul>

      <button
        type="button"
        class="self-start rounded-lg border border-board-edge px-3 py-2 text-xs text-fg-tertiary transition-colors hover:border-board-accent hover:text-board-accent"
        @click="setup.addPlacement()"
      >
        + Add placement
      </button>
    </div>

    <!-- Over-allocation is the only thing here that stops the wizard. -->
    <p v-if="setup.packsOverAllocated.value" class="text-sm text-danger">
      That hands out {{ -setup.packsRemaining.value }} more
      {{ -setup.packsRemaining.value === 1 ? "pack" : "packs" }} than you have.
      Raise the packs available, or take some back.
    </p>
    <p v-else-if="setup.packsRemaining.value > 0" class="text-xs text-fg-muted">
      {{ setup.packsRemaining.value }}
      {{ setup.packsRemaining.value === 1 ? "pack" : "packs" }} unassigned.
    </p>

    <!-- A warning, not a block: the roster may still be filling up. -->
    <p v-if="setup.placementsExceedPod.value" class="text-xs text-fg-muted">
      Heads up — you are paying out
      {{ setup.prizeDistribution.value.length }} places, but the smallest pod
      only has {{ setup.smallestPod.value }} players.
    </p>
  </div>
</template>
