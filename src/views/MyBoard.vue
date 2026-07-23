<script setup lang="ts">
import { computed, ref } from "vue";
import Card from "../components/Card.vue";
import CardSearch, { type SearchResult } from "../components/CardSearch.vue";
import CommanderPicker from "../components/CommanderPicker.vue";
import DeckList from "../components/DeckList.vue";
import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "../lib/useConvex";
import { convexAuthenticated } from "../lib/auth";
import { playerId } from "../lib/store";
import { groupCards } from "../lib/cardTypes";
import type { Doc, Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  gameId: Id<"games">;
  format: string;
  players: Doc<"players">[];
  cards: Doc<"cards">[];
}>();

const ZONES = [
  { id: "battlefield", label: "Battlefield" },
  { id: "graveyard", label: "Graveyard" },
  { id: "exile", label: "Exile" },
  { id: "command", label: "Command" },
] as const;

const castCard = useMutation(api.cards.castCard);
const zone = ref<(typeof ZONES)[number]["id"]>("battlefield");

const me = computed(
  () => props.players.find((p) => p._id === playerId.value) ?? null,
);

const mine = computed(() =>
  props.cards.filter((c) => c.controllerId === playerId.value),
);

const visible = computed(() =>
  mine.value
    .filter((c) => c.zone === zone.value)
    .sort((a, b) => a.position - b.position),
);

// The battlefield reads better split by card type; the other zones are just piles.
const sections = computed(() =>
  zone.value === "battlefield"
    ? groupCards(visible.value)
    : [{ group: null, cards: visible.value }],
);

const countIn = (id: string) => mine.value.filter((c) => c.zone === id).length;

// The deck attached to this seat at join time. Only its owner can read the list,
// so this resolves to null for a guest or another player's seat.
const deckId = computed(() => me.value?.deckId ?? null);
const deck = useQuery(api.decks.getDeck, () =>
  deckId.value && convexAuthenticated.value ? { deckId: deckId.value } : null,
);

// Everything already on the table, so the deck list can mark what's been cast.
const inPlayIds = computed(() => mine.value.map((c) => c.scryfallId));

function cast(result: SearchResult) {
  if (!playerId.value) return;
  castCard({
    gameId: props.gameId,
    playerId: playerId.value,
    scryfallId: result.scryfallId,
  });
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl px-3 py-4">
    <CommanderPicker
      v-if="me && format === 'commander'"
      :game-id="gameId"
      :player="me"
      :cards="cards"
    />

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

    <div v-if="visible.length" class="flex flex-col gap-5">
      <section v-for="section in sections" :key="section.group ?? 'all'">
        <h3
          v-if="section.group"
          class="mb-2 flex items-baseline gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500"
        >
          {{ section.group }}
          <span class="text-zinc-700">{{ section.cards.length }}</span>
        </h3>
        <TransitionGroup
          tag="div"
          name="cards"
          class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7"
        >
          <Card
            v-for="card in section.cards"
            :key="card._id"
            :card="card"
            :players="players"
            interactive
          />
        </TransitionGroup>
      </section>
    </div>

    <p v-else class="py-12 text-center text-sm text-zinc-600">
      Nothing in your {{ zone }}.
    </p>

    <div class="mt-6 flex flex-col gap-2">
      <CardSearch
        label="+ Cast a card"
        :disabled="!playerId"
        @select="cast"
      />
      <DeckList
        v-if="deckId && deck"
        :deck-id="deckId"
        :deck-name="deck.name"
        :in-play-ids="inPlayIds"
        @select="cast"
      />
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
