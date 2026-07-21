<script setup lang="ts">
import PlayerPod from "../components/PlayerPod.vue";
import { playerId } from "../lib/store";
import type { Doc } from "@convex/_generated/dataModel";

defineProps<{
  game: Doc<"games">;
  players: Doc<"players">[];
  cards: Doc<"cards">[];
}>();
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-3 py-4">
    <!-- One column on a phone; the extra screen gets a real table layout. -->
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <PlayerPod
        v-for="player in players"
        :key="player._id"
        :player="player"
        :players="players"
        :cards="cards"
        :is-me="player._id === playerId"
        :is-turn="player._id === game.turnPlayerId"
      />
    </div>

    <p v-if="!players.length" class="py-12 text-center text-sm text-zinc-600">
      Waiting for players to join.
    </p>
  </div>
</template>
