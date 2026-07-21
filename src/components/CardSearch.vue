<script setup lang="ts">
import { ref, watch } from "vue";
import { api } from "@convex/_generated/api";
import { useAction, useMutation } from "../lib/useConvex";
import type { Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  gameId: Id<"games">;
  playerId: Id<"players"> | null;
}>();

type Result = { scryfallId: string; name: string; imageUrl?: string };

const searchCards = useAction(api.scryfall.searchCards);
const castCard = useMutation(api.cards.castCard);

const open = ref(false);
const term = ref("");
const results = ref<Result[]>([]);
const loading = ref(false);

let debounce: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

watch(term, (value) => {
  clearTimeout(debounce);
  if (value.trim().length < 2) {
    results.value = [];
    return;
  }
  debounce = setTimeout(async () => {
    // Ignore responses that arrive after a newer keystroke.
    const mine = ++seq;
    loading.value = true;
    try {
      const found = await searchCards({ query: value.trim() });
      if (mine === seq) results.value = found;
    } finally {
      if (mine === seq) loading.value = false;
    }
  }, 300);
});

async function cast(result: Result) {
  if (!props.playerId) return;
  open.value = false;
  term.value = "";
  results.value = [];
  await castCard({
    gameId: props.gameId,
    playerId: props.playerId,
    scryfallId: result.scryfallId,
  });
}
</script>

<template>
  <div>
    <button
      class="w-full rounded-xl border border-dashed border-board-edge py-3 text-sm text-zinc-500 active:bg-board-panel"
      :disabled="!playerId"
      @click="open = true"
    >
      + Cast a card
    </button>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-50 flex flex-col bg-board-bg">
        <div class="flex items-center gap-2 border-b border-board-edge p-3">
          <input
            v-model="term"
            type="search"
            autofocus
            placeholder="Search Scryfall…"
            class="flex-1 rounded-xl border border-board-edge bg-board-panel px-4 py-3 text-base outline-none focus:border-board-accent"
          />
          <button class="px-3 text-sm text-zinc-400" @click="open = false">
            Cancel
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-3">
          <p v-if="loading" class="py-6 text-center text-xs text-zinc-600">
            Searching…
          </p>
          <p
            v-else-if="term.trim().length >= 2 && !results.length"
            class="py-6 text-center text-xs text-zinc-600"
          >
            No cards matched.
          </p>
          <ul class="flex flex-col gap-1">
            <li v-for="result in results" :key="result.scryfallId">
              <button
                class="flex w-full items-center gap-3 rounded-xl p-2 text-left active:bg-board-panel"
                @click="cast(result)"
              >
                <img
                  v-if="result.imageUrl"
                  :src="result.imageUrl"
                  :alt="result.name"
                  class="h-16 w-12 shrink-0 rounded object-cover"
                />
                <span
                  v-else
                  class="h-16 w-12 shrink-0 rounded bg-board-panel"
                ></span>
                <span class="text-sm">{{ result.name }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>
