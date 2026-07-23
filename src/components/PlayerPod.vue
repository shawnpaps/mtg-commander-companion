<script setup lang="ts">
import { computed } from "vue";
import Card from "./Card.vue";
import LifeCounter from "./LifeCounter.vue";
import { groupCards } from "../lib/cardTypes";
import type { Doc } from "@convex/_generated/dataModel";

const props = defineProps<{
  player: Doc<"players">;
  players: Doc<"players">[];
  cards: Doc<"cards">[];
  isMe?: boolean;
  isTurn?: boolean;
}>();

const sections = computed(() =>
  groupCards(
    props.cards.filter(
      (c) => c.controllerId === props.player._id && c.zone === "battlefield",
    ),
  ),
);

const battlefieldCount = computed(() =>
  sections.value.reduce((total, s) => total + s.cards.length, 0),
);

const commander = computed(
  () => props.cards.find((c) => c._id === props.player.commanderCardId) ?? null,
);

const counts = computed(() => {
  const mine = props.cards.filter((c) => c.controllerId === props.player._id);
  return {
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
        <span v-if="isMe" class="text-fg-subtle">(you)</span>
      </h3>
      <span v-if="player.poison" class="text-[10px] text-emerald-400">
        ☠ {{ player.poison }}
      </span>
      <span class="ml-auto shrink-0 text-2xl font-semibold tabular-nums">
        {{ player.life }}
      </span>
    </header>

    <LifeCounter v-if="isMe" :player="player" compact class="mb-3" />

    <p
      v-if="commander"
      class="mb-2 truncate text-[11px] text-fg-muted"
      :title="commander.name"
    >
      <span class="text-fg-subtle">⚔</span> {{ commander.name }}
    </p>

    <div class="mb-2 flex gap-3 text-[10px] uppercase tracking-wide text-fg-subtle">
      <span>gy {{ counts.graveyard }}</span>
      <span>exile {{ counts.exile }}</span>
    </div>

    <div v-if="battlefieldCount" class="flex flex-col gap-2.5">
      <div v-for="section in sections" :key="section.group">
        <h4 class="mb-1 text-[10px] uppercase tracking-wide text-fg-subtle">
          {{ section.group }}
        </h4>
        <div class="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
          <Card
            v-for="card in section.cards"
            :key="card._id"
            :card="card"
            :players="players"
            :interactive="isMe"
          />
        </div>
      </div>
    </div>
    <p v-else class="py-3 text-center text-[11px] text-fg-subtle">
      Empty battlefield
    </p>
  </section>
</template>
