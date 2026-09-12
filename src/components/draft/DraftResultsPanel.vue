<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "@convex/_generated/api";
import { useQuery } from "../../lib/useConvex";
import { formatRecord } from "@convex/draft/results";
import { formatResultsSummary } from "@convex/draft/prizes";
import type { Doc, Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  pod: Doc<"draftPods">;
  multiPod: boolean;
  myEntrantId: Id<"draftEntrants"> | null;
}>();

const final = useQuery(api.draft.completion.getFinalStandings, () => ({
  podId: props.pod._id,
}));

const copied = ref(false);

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
function place(rank: number) {
  return ORDINALS[rank - 1] ?? `${rank}th`;
}

const winners = computed(
  () => final.value?.rows.filter((r) => r.packsAwarded > 0) ?? [],
);

const summary = computed(() => {
  if (!final.value) return "";
  return formatResultsSummary(
    final.value.tournamentName,
    props.multiPod ? `Pod ${final.value.podIndex}` : null,
    // The frozen rows carry everything the formatter reads; the tiebreaker
    // fields it ignores are filled in to satisfy the shared row shape.
    final.value.rows.map((r) => ({
      ...r,
      omw: 0,
      gw: 0,
      ogw: 0,
      hadBye: false,
    })),
  );
});

async function copySummary() {
  try {
    await navigator.clipboard.writeText(summary.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Clipboard access is routinely refused; the text is on screen anyway.
  }
}
</script>

<template>
  <section v-if="final" class="flex flex-col gap-4">
    <div
      class="rounded-xl border border-board-accent/40 bg-board-accent/10 px-4 py-4 text-center"
    >
      <p class="text-[11px] uppercase tracking-wide text-fg-muted">
        {{ multiPod ? `Pod ${final.podIndex}` : "Final" }} standings
      </p>
      <p class="mt-1 text-lg font-semibold text-board-accent">
        {{ winners.length ? `${winners[0].name} takes it` : "Pod complete" }}
      </p>
    </div>

    <ol class="flex flex-col gap-1.5">
      <li
        v-for="row in final.rows"
        :key="row.entrantId"
        class="flex items-center gap-3 rounded-xl border px-4 py-3"
        :class="[
          row.packsAwarded > 0
            ? 'border-board-accent/40 bg-board-panel'
            : 'border-board-edge bg-board-panel',
          row.dropped ? 'opacity-60' : '',
        ]"
      >
        <span class="w-9 shrink-0 text-xs font-medium text-fg-subtle">
          {{ place(row.rank) }}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm text-fg-secondary">
            {{ row.name }}
            <span v-if="row.entrantId === myEntrantId" class="text-fg-subtle">
              (you)
            </span>
            <span v-if="row.dropped" class="text-[10px] uppercase text-fg-subtle">
              dropped
            </span>
          </span>
          <span class="block text-xs tabular-nums text-fg-muted">
            {{ formatRecord(row.wins, row.losses, row.draws) }} ·
            {{ row.matchPoints }} pts
          </span>
        </span>
        <span
          v-if="row.packsAwarded > 0"
          class="shrink-0 rounded-lg border border-board-accent px-2.5 py-1 text-xs font-medium text-board-accent"
        >
          {{ row.packsAwarded }} {{ row.packsAwarded === 1 ? "pack" : "packs" }}
        </span>
      </li>
    </ol>

    <!-- The payoff screen: this is what gets pasted into the group chat. -->
    <button
      type="button"
      class="rounded-xl border border-board-edge bg-board-panel py-3 text-sm font-medium text-fg-tertiary transition-colors hover:border-board-accent hover:text-board-accent"
      @click="copySummary()"
    >
      {{ copied ? "Copied" : "Copy results" }}
    </button>

    <p class="text-xs text-fg-subtle">
      These standings are frozen. Results can no longer be edited for this pod.
    </p>
  </section>
</template>
