<script setup lang="ts">
import { ref } from "vue";
import { leaveGame } from "../lib/store";

const props = defineProps<{ code: string }>();
const copied = ref(false);

async function share() {
  const url = `${location.origin}?game=${props.code}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "BoardState", text: props.code, url });
      return;
    }
    await navigator.clipboard.writeText(props.code);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    // User dismissed the share sheet — nothing to recover from.
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      class="flex items-center gap-2 rounded-lg border border-board-edge bg-board-panel px-3 py-1.5"
      @click="share"
    >
      <span class="font-mono text-sm tracking-[0.2em] text-board-accent">
        {{ code }}
      </span>
      <span class="text-[10px] uppercase text-zinc-500">
        {{ copied ? 'copied' : 'share' }}
      </span>
    </button>
    <button
      class="text-xs text-zinc-600 hover:text-zinc-400"
      title="Leave game"
      @click="leaveGame()"
    >
      exit
    </button>
  </div>
</template>
