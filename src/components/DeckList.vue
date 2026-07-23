<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api } from "@convex/_generated/api";
import { useQuery } from "../lib/useConvex";
import type { SearchResult } from "./CardSearch.vue";
import type { Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  deckId: Id<"decks">;
  deckName?: string;
  // Scryfall ids this player already has on the table, in any zone. Used to
  // mark what's been cast so you don't play a second copy of a singleton.
  inPlayIds: string[];
}>();

const emit = defineEmits<{ select: [result: SearchResult] }>();

const open = ref(false);
const term = ref("");

// Only subscribed while the sheet is open — no reason to hold a deck list in
// memory for a player who never opens it.
const cards = useQuery(api.decks.getDeckCards, () =>
  open.value ? { deckId: props.deckId } : null,
);

const loading = computed(() => open.value && cards.value === undefined);

const playedCount = computed(() => {
  const counts = new Map<string, number>();
  for (const id of props.inPlayIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
});

const filtered = computed(() => {
  const needle = term.value.trim().toLowerCase();
  return (cards.value ?? [])
    // Nothing to cast without a Scryfall id, so don't offer it.
    .filter((card) => card.scryfallId)
    .filter((card) => !needle || card.name.toLowerCase().includes(needle));
});

// Archidekt's own categories are the grouping players already recognise from
// the deckbuilder, so reuse them rather than inventing a scheme.
const sections = computed(() => {
  const groups = new Map<string, typeof filtered.value>();
  for (const card of filtered.value) {
    const key = card.category ?? "Other";
    const list = groups.get(key) ?? [];
    list.push(card);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([name, list]) => ({
      name,
      cards: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      // The commander is the card you look for first.
      if (a.name === "Commander") return -1;
      if (b.name === "Commander") return 1;
      if (a.name === "Other") return 1;
      if (b.name === "Other") return -1;
      return a.name.localeCompare(b.name);
    });
});

// Both counts sum quantities rather than rows, so "37 of 100" compares like
// with like when a deck runs multiples.
const total = computed(() =>
  (cards.value ?? []).reduce((sum, card) => sum + card.quantity, 0),
);
const shownTotal = computed(() =>
  filtered.value.reduce((sum, card) => sum + card.quantity, 0),
);

watch(open, (isOpen) => {
  if (!isOpen) term.value = "";
});

function cast(card: (typeof filtered.value)[number]) {
  // Stays open: casting is usually a run of several cards in a turn, and
  // reopening the list between each one is a chore.
  emit("select", {
    scryfallId: card.scryfallId,
    name: card.name,
    typeLine: card.typeLine,
    imageUrl: card.imageUrl,
  });
}
</script>

<template>
  <div>
    <button
      class="flex w-full items-center justify-center gap-2 rounded-xl border border-board-edge py-3 text-sm text-zinc-400 transition-colors active:bg-board-panel"
      @click="open = true"
    >
      <span class="text-zinc-600">▤</span>
      {{ deckName ? `Play from ${deckName}` : 'Play from your deck' }}
    </button>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-50 flex flex-col bg-board-bg">
        <div class="flex items-center gap-2 border-b border-board-edge p-3">
          <input
            v-model="term"
            type="search"
            autofocus
            placeholder="Filter your deck…"
            class="flex-1 rounded-xl border border-board-edge bg-board-panel px-4 py-3 text-base outline-none focus:border-board-accent"
          />
          <button class="px-3 text-sm text-zinc-400" @click="open = false">
            Done
          </button>
        </div>

        <div
          class="flex items-center justify-between border-b border-board-edge px-4 py-2"
        >
          <span class="truncate text-[11px] text-zinc-500">
            {{ deckName ?? 'Your deck' }}
          </span>
          <span class="shrink-0 text-[11px] tabular-nums text-zinc-600">
            {{ shownTotal }} of {{ total }}
          </span>
        </div>

        <div class="flex-1 overflow-y-auto p-3">
          <p v-if="loading" class="py-6 text-center text-xs text-zinc-600">
            Loading your deck…
          </p>
          <p
            v-else-if="!cards?.length"
            class="py-6 text-center text-xs text-zinc-600"
          >
            This deck has no card list saved. Import it from Archidekt to play
            from it.
          </p>
          <p
            v-else-if="!filtered.length"
            class="py-6 text-center text-xs text-zinc-600"
          >
            Nothing in your deck matched.
          </p>

          <section v-for="section in sections" :key="section.name" class="mb-5">
            <h3
              class="mb-2 flex items-baseline gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500"
            >
              {{ section.name }}
              <span class="text-zinc-700">{{ section.cards.length }}</span>
            </h3>
            <ul class="flex flex-col gap-1">
              <li v-for="card in section.cards" :key="card.scryfallId">
                <button
                  class="flex w-full items-center gap-3 rounded-xl p-2 text-left active:bg-board-panel"
                  @click="cast(card)"
                >
                  <img
                    v-if="card.imageUrl"
                    :src="card.imageUrl"
                    :alt="card.name"
                    class="h-16 w-12 shrink-0 rounded object-cover"
                    :class="playedCount.get(card.scryfallId) ? 'opacity-40' : ''"
                  />
                  <span
                    v-else
                    class="h-16 w-12 shrink-0 rounded bg-board-panel"
                  ></span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm">{{ card.name }}</span>
                    <span
                      v-if="card.typeLine"
                      class="block truncate text-[11px] text-zinc-600"
                    >
                      {{ card.typeLine }}
                    </span>
                  </span>
                  <span class="flex shrink-0 flex-col items-end gap-0.5">
                    <span
                      v-if="card.quantity > 1"
                      class="text-[11px] tabular-nums text-zinc-600"
                    >
                      ×{{ card.quantity }}
                    </span>
                    <span
                      v-if="playedCount.get(card.scryfallId)"
                      class="rounded bg-board-accent/15 px-1.5 py-0.5 text-[10px] text-board-accent"
                    >
                      {{ playedCount.get(card.scryfallId) }} out
                    </span>
                  </span>
                </button>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </Teleport>
  </div>
</template>
