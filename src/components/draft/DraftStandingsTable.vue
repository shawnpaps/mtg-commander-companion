<script setup lang="ts">
import { ref } from "vue";
import { formatPercent, formatRecord } from "@convex/draft/results";
import type { StandingsRow } from "@convex/draft/types";

defineProps<{
  rows: StandingsRow[];
  /** Drives whether the game-based tiebreakers are worth showing at all. */
  trackGameScores: boolean;
}>();

// Collapsed by default: the table has to fit a phone first, and the
// tiebreakers are what you open when someone disputes the order.
const showTiebreakers = ref(false);
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-medium uppercase tracking-wide text-fg-muted">
        Standings
      </h2>
      <!-- Tiebreakers are deliberately exposed rather than hidden: players
           argue about them, and a visible number ends the argument faster
           than an explanation does. -->
      <button
        type="button"
        class="rounded-lg border border-board-edge px-2.5 py-1 text-xs text-fg-tertiary transition-colors hover:border-board-accent hover:text-board-accent"
        @click="showTiebreakers = !showTiebreakers"
      >
        {{ showTiebreakers ? "Hide" : "Show" }} tiebreakers
      </button>
    </div>

    <div class="overflow-x-auto rounded-xl border border-board-edge">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="bg-board-panel text-left text-[11px] uppercase tracking-wide text-fg-muted">
            <th class="px-3 py-2 font-medium">#</th>
            <th class="px-2 py-2 font-medium">Player</th>
            <th class="px-2 py-2 text-right font-medium">Record</th>
            <th class="px-2 py-2 text-right font-medium">Pts</th>
            <template v-if="showTiebreakers">
              <th class="px-2 py-2 text-right font-medium">OMW%</th>
              <th v-if="trackGameScores" class="px-2 py-2 text-right font-medium">
                GW%
              </th>
              <th v-if="trackGameScores" class="px-2 py-2 text-right font-medium">
                OGW%
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.entrantId"
            class="border-t border-board-edge bg-board-panel"
            :class="row.dropped ? 'opacity-50' : ''"
          >
            <td class="px-3 py-2 tabular-nums text-fg-subtle">{{ row.rank }}</td>
            <td class="px-2 py-2">
              <span class="text-fg-secondary">{{ row.name }}</span>
              <span v-if="row.dropped" class="ml-1.5 text-[10px] uppercase text-fg-subtle">
                dropped
              </span>
              <span v-else-if="row.hadBye" class="ml-1.5 text-[10px] uppercase text-fg-subtle">
                bye
              </span>
            </td>
            <td class="px-2 py-2 text-right tabular-nums text-fg-tertiary">
              {{ formatRecord(row.wins, row.losses, row.draws) }}
            </td>
            <td class="px-2 py-2 text-right font-medium tabular-nums">
              {{ row.matchPoints }}
            </td>
            <template v-if="showTiebreakers">
              <td class="px-2 py-2 text-right tabular-nums text-fg-muted">
                {{ formatPercent(row.omw) }}
              </td>
              <td
                v-if="trackGameScores"
                class="px-2 py-2 text-right tabular-nums text-fg-muted"
              >
                {{ formatPercent(row.gw) }}
              </td>
              <td
                v-if="trackGameScores"
                class="px-2 py-2 text-right tabular-nums text-fg-muted"
              >
                {{ formatPercent(row.ogw) }}
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="showTiebreakers" class="text-xs text-fg-subtle">
      Ranked by match points, then opponents' match-win %<template
        v-if="trackGameScores"
      >, then your own game-win %, then opponents' game-win %</template
      >. Opponent percentages are floored at 33% and exclude bye rounds, per the
      MTR.
    </p>
  </section>
</template>
