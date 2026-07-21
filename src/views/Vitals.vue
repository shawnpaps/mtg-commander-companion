<script setup lang="ts">
import { computed } from "vue";
import LifeCounter from "../components/LifeCounter.vue";
import CommanderDamageGrid from "../components/CommanderDamageGrid.vue";
import CardLog from "../components/CardLog.vue";
import { api } from "@convex/_generated/api";
import { useMutation } from "../lib/useConvex";
import { playerId } from "../lib/store";
import { imageVariant } from "../lib/scryfallImage";
import type { Doc } from "@convex/_generated/dataModel";

const props = defineProps<{
  game: Doc<"games">;
  players: Doc<"players">[];
  cards: Doc<"cards">[];
}>();

const setPoison = useMutation(api.players.setPoison);

const me = computed(() => props.players.find((p) => p._id === playerId.value));
const others = computed(() =>
  props.players.filter((p) => p._id !== playerId.value),
);

/**
 * Commander art and name per player, resolved once per update rather than on
 * every template read. `art_crop` is the landscape illustration with no frame
 * or text — the only variant that reads as a background rather than a squashed
 * card.
 */
const commanders = computed(() => {
  const byId = new Map(props.cards.map((c) => [c._id, c]));
  return new Map(
    props.players.map((player) => {
      const card = player.commanderCardId
        ? byId.get(player.commanderCardId)
        : undefined;
      return [
        player._id,
        { name: card?.name, art: imageVariant(card?.imageUrl, "art_crop") },
      ] as const;
    }),
  );
});

const commanderArt = (player: Doc<"players">) =>
  commanders.value.get(player._id)?.art;
const commanderName = (player: Doc<"players">) =>
  commanders.value.get(player._id)?.name;
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-3 py-4">
    <section
      v-if="me"
      class="relative mb-4 overflow-hidden rounded-2xl border border-board-edge"
    >
      <!-- Art sits behind a scrim so life totals stay legible over busy card
           illustrations. -->
      <div
        v-if="commanderArt(me)"
        class="absolute inset-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${commanderArt(me)})` }"
        aria-hidden="true"
      />
      <div
        class="absolute inset-0"
        :class="
          commanderArt(me)
            ? 'bg-gradient-to-br from-board-bg/92 via-board-bg/85 to-board-bg/75'
            : 'bg-board-panel/40'
        "
        aria-hidden="true"
      />

      <div class="relative p-4">
        <div class="mb-3 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <h2 class="truncate text-sm font-medium">{{ me.name }}</h2>
            <p
              v-if="commanderName(me)"
              class="truncate text-[11px] text-zinc-400"
            >
              {{ commanderName(me) }}
            </p>
          </div>
          <button
            class="shrink-0 rounded-lg border border-board-edge bg-board-bg/60 px-2.5 py-1 text-[11px] text-emerald-400"
            @click="setPoison({ playerId: me._id, amount: me.poison + 1 })"
            @contextmenu.prevent="
              setPoison({ playerId: me._id, amount: me.poison - 1 })
            "
          >
            ☠ poison {{ me.poison }}
          </button>
        </div>
        <LifeCounter :player="me" />
      </div>
    </section>

    <section class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div
        v-for="player in others"
        :key="player._id"
        class="relative overflow-hidden rounded-xl border border-board-edge/60"
      >
        <div
          v-if="commanderArt(player)"
          class="absolute inset-0 bg-cover bg-center"
          :style="{ backgroundImage: `url(${commanderArt(player)})` }"
          aria-hidden="true"
        />
        <div
          class="absolute inset-0"
          :class="
            commanderArt(player)
              ? 'bg-gradient-to-br from-board-bg/92 via-board-bg/85 to-board-bg/75'
              : 'bg-board-panel/30'
          "
          aria-hidden="true"
        />

        <div class="relative p-3">
          <p class="truncate text-xs text-zinc-300">{{ player.name }}</p>
          <p
            v-if="commanderName(player)"
            class="mb-2 truncate text-[10px] text-zinc-500"
          >
            {{ commanderName(player) }}
          </p>
          <p v-else class="mb-2 text-[10px] text-zinc-700">No commander</p>
          <LifeCounter :player="player" compact />
        </div>
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
