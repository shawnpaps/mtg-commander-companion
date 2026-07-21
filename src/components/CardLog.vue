<script setup lang="ts">
import { computed } from "vue";
import { api } from "@convex/_generated/api";
import { useQuery } from "../lib/useConvex";
import type { Doc, Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  gameId: Id<"games">;
  players: Doc<"players">[];
}>();

// The query filters to undone=false, so undone actions vanish from the feed.
const entries = useQuery(api.log.getLog, () => ({
  gameId: props.gameId,
  limit: 60,
}));

const nameOf = (id?: Id<"players">) =>
  props.players.find((p) => p._id === id)?.name ?? "Someone";

function describe(entry: Doc<"gameLog">) {
  const who = nameOf(entry.actorId);
  const p = (entry.payload ?? {}) as Record<string, never>;

  switch (entry.action) {
    case "game.created":
      return "Game created";
    case "game.started":
      return "Game started";
    case "player.joined":
      return `${who} took a seat`;
    case "player.reconnected":
      return `${who} reconnected`;
    case "turn.passed":
      return `Turn ${p.turnNumber} — ${who}`;
    case "card.cast":
      return `${who} cast ${p.name}`;
    case "commander.set":
      return `${who} chose ${p.name} as commander`;
    case "card.moved":
      return `${who} moved ${p.name} to ${p.to}`;
    case "card.removed":
      return `${who} removed ${p.name}`;
    case "card.tapped":
      return `${who} tapped ${p.name}`;
    case "card.untapped":
      return `${who} untapped ${p.name}`;
    case "card.flipped":
      return `${who} flipped ${p.name}`;
    case "card.controlChanged":
      return `${p.name} → ${nameOf(p.to)}`;
    case "card.counters":
      return `${who} updated counters on ${p.name}`;
    case "life.changed":
      return `${p.name}: ${p.delta > 0 ? '+' : ''}${p.delta} life (${p.to})`;
    case "poison.changed":
      return `${p.name}: ${p.to} poison`;
    case "commanderDmg.set":
      return `${who} dealt ${p.amount} commander damage to ${nameOf(p.playerId)}`;
    default:
      return entry.action;
  }
}

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const list = computed(() => entries.value ?? []);
</script>

<template>
  <div class="flex flex-col gap-1">
    <p v-if="!list.length" class="py-6 text-center text-xs text-zinc-600">
      Nothing has happened yet.
    </p>
    <div
      v-for="entry in list"
      :key="entry._id"
      class="flex items-baseline gap-3 rounded-lg px-3 py-2 text-sm odd:bg-board-panel/50"
    >
      <span class="shrink-0 font-mono text-[10px] text-zinc-600">
        {{ time(entry.ts) }}
      </span>
      <span class="text-zinc-300">{{ describe(entry) }}</span>
    </div>
  </div>
</template>
