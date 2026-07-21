<script setup lang="ts">
import { computed, ref } from "vue";
import Card from "../components/Card.vue";
import CardSearch from "../components/CardSearch.vue";
import { playerId } from "../lib/store";
import type { Doc, Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  gameId: Id<"games">;
  players: Doc<"players">[];
  cards: Doc<"cards">[];
}>();

const ZONES = [
  { id: "battlefield", label: "Battlefield" },
  { id: "hand", label: "Hand" },
  { id: "graveyard", label: "Graveyard" },
  { id: "exile", label: "Exile" },
  { id: "command", label: "Command" },
] as const;

const zone = ref<(typeof ZONES)[number]["id"]>("battlefield");

const mine = computed(() =>
  props.cards.filter((c) => c.controllerId === playerId.value),
);

const visible = computed(() =>
  mine.value
    .filter((c) => c.zone === zone.value)
    .sort((a, b) => a.position - b.position),
);

const countIn = (id: string) => mine.value.filter((c) => c.zone === id).length;
</script>

<template>
  <div class="mx-auto w-full max-w-4xl px-3 py-4">
    <div class="mb-4 flex gap-1.5 overflow-x-auto pb-1">
      <button
        v-for="z in ZONES"
        :key="z.id"
        class="shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors"
        :class="
          zone === z.id
            ? 'border-board-accent bg-board-accent/10 text-board-accent'
            : 'border-board-edge text-zinc-500'
        "
        @click="zone = z.id"
      >
        {{ z.label }}
        <span class="ml-1 text-zinc-600">{{ countIn(z.id) }}</span>
      </button>
    </div>

    <TransitionGroup
      v-if="visible.length"
      tag="div"
      name="cards"
      class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7"
    >
      <Card
        v-for="card in visible"
        :key="card._id"
        :card="card"
        :players="players"
        interactive
      />
    </TransitionGroup>

    <p v-else class="py-12 text-center text-sm text-zinc-600">
      Nothing in your {{ zone }}.
    </p>

    <div class="mt-6">
      <CardSearch :game-id="gameId" :player-id="playerId" />
    </div>
  </div>
</template>

<style scoped>
/* Layout shifts when cards move between zones; motion handles enter/exit
   inside Card itself, this just keeps the reflow from snapping. */
.cards-move {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
</style>
