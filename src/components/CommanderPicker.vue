<script setup lang="ts">
import { computed } from "vue";
import { api } from "@convex/_generated/api";
import { useMutation } from "../lib/useConvex";
import CardSearch, { type SearchResult } from "./CardSearch.vue";
import type { Doc, Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  gameId: Id<"games">;
  player: Doc<"players">;
  cards: Doc<"cards">[];
}>();

const setCommander = useMutation(api.cards.setCommander);

const commander = computed(
  () => props.cards.find((c) => c._id === props.player.commanderCardId) ?? null,
);

function pick(result: SearchResult) {
  setCommander({
    gameId: props.gameId,
    playerId: props.player._id,
    scryfallId: result.scryfallId,
  });
}
</script>

<template>
  <section
    class="mb-4 rounded-2xl border p-3"
    :class="
      commander
        ? 'border-board-edge bg-board-panel/40'
        : 'border-board-accent/40 bg-board-accent/5'
    "
  >
    <div class="flex items-center gap-3">
      <div
        class="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-board-edge bg-board-panel"
      >
        <img
          v-if="commander?.imageUrl"
          :src="commander.imageUrl"
          :alt="commander.name"
          class="h-full w-full object-cover"
        />
        <span
          v-else
          class="flex h-full w-full items-center justify-center text-[10px] text-zinc-600"
        >
          ?
        </span>
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-[10px] uppercase tracking-wide text-zinc-500">
          Commander
        </p>
        <p v-if="commander" class="truncate text-sm font-medium">
          {{ commander.name }}
        </p>
        <p v-else class="text-sm text-zinc-500">Not set yet</p>
        <p
          v-if="commander?.typeLine"
          class="truncate text-[11px] text-zinc-600"
        >
          {{ commander.typeLine }}
        </p>
      </div>
    </div>

    <div class="mt-3">
      <CardSearch
        :label="commander ? 'Change commander' : 'Set your commander'"
        :variant="commander ? 'dashed' : 'solid'"
        placeholder="Search legendary creatures…"
        commander-only
        @select="pick"
      />
    </div>
  </section>
</template>
