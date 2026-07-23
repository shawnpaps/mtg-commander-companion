<script setup lang="ts">
import { ref, watch } from "vue";
import { animate } from "motion";
import { api } from "@convex/_generated/api";
import { useMutation } from "../lib/useConvex";
import type { Doc } from "@convex/_generated/dataModel";

const props = defineProps<{ player: Doc<"players">; compact?: boolean }>();

const updateLife = useMutation(api.players.updateLife);
const total = ref<HTMLElement | null>(null);

watch(
  () => props.player.life,
  () => {
    if (total.value) {
      animate(total.value, { scale: [1.18, 1] }, { duration: 0.24 });
    }
  },
);

function change(delta: number) {
  updateLife({ playerId: props.player._id, delta });
}
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <button
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-board-edge text-xl text-fg-tertiary active:bg-board-edge"
      @click="change(-1)"
    >
      −
    </button>

    <button
      class="flex flex-col items-center px-2"
      @click="change(-5)"
      @contextmenu.prevent="change(5)"
    >
      <span
        ref="total"
        class="tabular-nums font-semibold leading-none"
        :class="[
          compact ? 'text-3xl' : 'text-5xl',
          player.life <= 0
            ? 'text-red-500'
            : player.life <= 5
              ? 'text-amber-400'
              : 'text-fg',
        ]"
      >
        {{ player.life }}
      </span>
      <span v-if="!compact" class="mt-1 text-[10px] uppercase text-fg-subtle">
        tap for −5
      </span>
    </button>

    <button
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-board-edge text-xl text-fg-tertiary active:bg-board-edge"
      @click="change(1)"
    >
      +
    </button>
  </div>
</template>
