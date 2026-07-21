<script setup lang="ts">
import { ref } from "vue";
import { api } from "@convex/_generated/api";
import { useMutation } from "../lib/useConvex";
import type { Id } from "@convex/_generated/dataModel";

const props = defineProps<{ gameId: Id<"games"> }>();

const undoLastAction = useMutation(api.games.undoLastAction);
const busy = ref(false);
const toast = ref<string | null>(null);

async function undo() {
  if (busy.value) return;
  busy.value = true;
  try {
    const result = await undoLastAction({ gameId: props.gameId });
    toast.value = result.undone ? `Undid ${result.undone}` : "Nothing to undo";
    setTimeout(() => (toast.value = null), 1800);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="relative">
    <button
      class="rounded-lg border border-board-edge bg-board-panel px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-40"
      :disabled="busy"
      @click="undo"
    >
      ↶ Undo
    </button>
    <span
      v-if="toast"
      class="absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-300 shadow-lg"
    >
      {{ toast }}
    </span>
  </div>
</template>
