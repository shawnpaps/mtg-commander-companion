<script setup lang="ts">
import { computed } from "vue";
import LifeCounter from "../components/LifeCounter.vue";
import CommanderDamageGrid from "../components/CommanderDamageGrid.vue";
import CardLog from "../components/CardLog.vue";
import { api } from "@convex/_generated/api";
import { useMutation } from "../lib/useConvex";
import { playerId } from "../lib/store";
import type { Doc } from "@convex/_generated/dataModel";

const props = defineProps<{
  game: Doc<"games">;
  players: Doc<"players">[];
}>();

const setPoison = useMutation(api.players.setPoison);

const me = computed(() => props.players.find((p) => p._id === playerId.value));
const others = computed(() =>
  props.players.filter((p) => p._id !== playerId.value),
);
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-3 py-4">
    <section
      v-if="me"
      class="mb-4 rounded-2xl border border-board-edge bg-board-panel/40 p-4"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-medium">{{ me.name }}</h2>
        <button
          class="rounded-lg border border-board-edge px-2.5 py-1 text-[11px] text-emerald-400"
          @click="setPoison({ playerId: me._id, amount: me.poison + 1 })"
          @contextmenu.prevent="
            setPoison({ playerId: me._id, amount: me.poison - 1 })
          "
        >
          ☠ poison {{ me.poison }}
        </button>
      </div>
      <LifeCounter :player="me" />
    </section>

    <section class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div
        v-for="player in others"
        :key="player._id"
        class="rounded-xl border border-board-edge/60 bg-board-panel/30 p-3"
      >
        <p class="mb-2 truncate text-xs text-zinc-400">{{ player.name }}</p>
        <LifeCounter :player="player" compact />
      </div>
    </section>

    <section v-if="game.format === 'commander'" class="mb-6">
      <h2 class="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Commander damage
      </h2>
      <CommanderDamageGrid :players="players" />
    </section>

    <section>
      <h2 class="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Game log
      </h2>
      <CardLog :game-id="game._id" :players="players" />
    </section>
  </div>
</template>
