<script setup lang="ts">
import { computed } from "vue";
import Card from "./Card.vue";
import LifeCounter from "./LifeCounter.vue";
import type { Doc } from "@convex/_generated/dataModel";

const props = defineProps<{
  player: Doc<"players">;
  players: Doc<"players">[];
  cards: Doc<"cards">[];
  isMe?: boolean;
  isTurn?: boolean;
}>();

const battlefield = computed(() =>
  props.cards
    .filter((c) => c.controllerId === props.player._id && c.zone === "battlefield")
    .sort((a, b) => a.position - b.position),
);

const counts = computed(() => {
  const mine = props.cards.filter((c) => c.controllerId === props.player._id);
  return {
    hand: mine.filter((c) => c.zone === "hand").length,
    graveyard: mine.filter((c) => c.zone === "graveyard").length,
    exile: mine.filter((c) => c.zone === "exile").length,
  };
});
</script>

<template>
  <section
    class="rounded-2xl border bg-board-panel/40 p-3 transition-colors"
    :class="
      isTurn
        ? 'border-board-accent/70'
        : isMe
          ? 'border-board-edge'
          : 'border-board-edge/50'
    "
  >
    <header class="mb-3 flex items-center gap-2">
      <span
        class="h-2 w-2 shrink-0 rounded-full"
        :class="player.connected ? 'bg-emerald-400' : 'bg-zinc-600'"
      />
      <h3 class="truncate text-sm font-medium">
        {{ player.name }}
        <span v-if="isMe" class="text-zinc-600">(you)</span>
      </h3>
      <span v-if="player.poison" class="text-[10px] text-emerald-400">
        ☠ {{ player.poison }}
      </span>
      <span class="ml-auto shrink-0 text-2xl font-semibold tabular-nums">
        {{ player.life }}
      </span>
    </header>

    <LifeCounter v-if="isMe" :player="player" compact class="mb-3" />

    <div class="mb-2 flex gap-3 text-[10px] uppercase tracking-wide text-zinc-600">
      <span>hand {{ counts.hand }}</span>
      <span>gy {{ counts.graveyard }}</span>
      <span>exile {{ counts.exile }}</span>
    </div>

    <div
      v-if="battlefield.length"
      class="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8"
    >
      <Card
        v-for="card in battlefield"
        :key="card._id"
        :card="card"
        :players="players"
        :interactive="isMe"
      />
    </div>
    <p v-else class="py-3 text-center text-[11px] text-zinc-700">
      Empty battlefield
    </p>
  </section>
</template>
