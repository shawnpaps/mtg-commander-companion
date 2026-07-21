<script setup lang="ts">
import { ref, watch } from "vue";
import { api } from "@convex/_generated/api";
import { useAction } from "../lib/useConvex";

export type SearchResult = {
  scryfallId: string;
  name: string;
  typeLine?: string;
  imageUrl?: string;
};

const props = withDefaults(
  defineProps<{
    label: string;
    placeholder?: string;
    commanderOnly?: boolean;
    disabled?: boolean;
    variant?: "dashed" | "solid";
  }>(),
  { variant: "dashed" },
);

const emit = defineEmits<{ select: [result: SearchResult] }>();

const searchCards = useAction(api.scryfall.searchCards);

const open = ref(false);
const term = ref("");
const results = ref<SearchResult[]>([]);
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
      const found = await searchCards({
        query: value.trim(),
        commanderOnly: props.commanderOnly,
      });
      if (mine === seq) results.value = found;
    } finally {
      if (mine === seq) loading.value = false;
    }
  }, 300);
});

function choose(result: SearchResult) {
  open.value = false;
  term.value = "";
  results.value = [];
  emit("select", result);
}
</script>

<template>
  <div>
    <button
      class="w-full rounded-xl py-3 text-sm transition-colors active:bg-board-panel"
      :class="
        variant === 'solid'
          ? 'bg-board-accent font-semibold text-zinc-950'
          : 'border border-dashed border-board-edge text-zinc-500'
      "
      :disabled="disabled"
      @click="open = true"
    >
      {{ label }}
    </button>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-50 flex flex-col bg-board-bg">
        <div class="flex items-center gap-2 border-b border-board-edge p-3">
          <input
            v-model="term"
            type="search"
            autofocus
            :placeholder="placeholder ?? 'Search Scryfall…'"
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
                @click="choose(result)"
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
                <span class="min-w-0">
                  <span class="block truncate text-sm">{{ result.name }}</span>
                  <span
                    v-if="result.typeLine"
                    class="block truncate text-[11px] text-zinc-600"
                  >
                    {{ result.typeLine }}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>
