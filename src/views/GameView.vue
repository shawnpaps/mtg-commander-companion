<script setup lang="ts">
import { computed, watch } from "vue";
import { api } from "@convex/_generated/api";
import { useQuery, useMutation } from "../lib/useConvex";
import { sessionId } from "../lib/session";
import { playerId, subView, leaveGame, type SubView } from "../lib/store";
import MyBoard from "./MyBoard.vue";
import TableView from "./TableView.vue";
import Vitals from "./Vitals.vue";
import ShareGameCode from "../components/ShareGameCode.vue";
import UndoButton from "../components/UndoButton.vue";

const props = defineProps<{ code: string }>();

const state = useQuery(api.games.getGame, () => ({ code: props.code }));
const startGame = useMutation(api.games.startGame);
const nextTurn = useMutation(api.games.nextTurn);

const game = computed(() => state.value?.game ?? null);
const players = computed(() => state.value?.players ?? []);
const cards = computed(() => state.value?.cards ?? []);

// Authoritative seat lookup — survives a refresh even if localStorage is stale.
const myPlayer = useQuery(api.games.getMyPlayer, () =>
  game.value && sessionId.value
    ? { gameId: game.value._id, sessionId: sessionId.value }
    : null,
);

watch(myPlayer, (player) => {
  if (player) playerId.value = player._id;
});

const isHost = computed(
  () => !!game.value && game.value.hostSessionId === sessionId.value,
);
const turnPlayer = computed(() =>
  players.value.find((p) => p._id === game.value?.turnPlayerId),
);

const TABS: Array<{ id: SubView; label: string; icon: string }> = [
  { id: "board", label: "My Board", icon: "▣" },
  { id: "table", label: "Table", icon: "◎" },
  { id: "vitals", label: "Vitals", icon: "♥" },
];
</script>

<template>
  <div v-if="state === undefined" class="flex min-h-screen items-center justify-center">
    <p class="animate-pulse text-sm text-zinc-500">Loading table…</p>
  </div>

  <div
    v-else-if="!game"
    class="flex min-h-screen flex-col items-center justify-center gap-4 p-6"
  >
    <p class="text-sm text-zinc-400">No game found for code {{ code }}.</p>
    <button
      class="rounded-xl border border-board-edge px-4 py-2 text-sm"
      @click="leaveGame()"
    >
      Back to lobby
    </button>
  </div>

  <div v-else class="flex min-h-screen flex-col">
    <header
      class="sticky top-0 z-20 flex items-center gap-3 border-b border-board-edge bg-board-bg/90 px-4 py-3 backdrop-blur"
    >
      <ShareGameCode :code="game.code" />
      <div class="ml-auto flex items-center gap-2">
        <span
          v-if="game.status === 'active'"
          class="hidden text-xs text-zinc-500 sm:inline"
        >
          T{{ game.turnNumber }} · {{ turnPlayer?.name ?? '—' }}
        </span>
        <UndoButton :game-id="game._id" />
      </div>
    </header>

    <div
      v-if="game.status === 'lobby'"
      class="border-b border-board-edge bg-board-panel px-4 py-3 text-sm"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="text-zinc-400">
          Lobby · {{ players.length }}/{{ game.playerCount }} seated
        </span>
        <button
          v-if="isHost"
          class="rounded-lg bg-board-accent px-3 py-1.5 text-xs font-semibold text-zinc-950"
          @click="startGame({ gameId: game._id })"
        >
          Start game
        </button>
      </div>
    </div>

    <div class="flex-1 pb-24">
      <MyBoard
        v-if="subView === 'board'"
        :game-id="game._id"
        :format="game.format"
        :players="players"
        :cards="cards"
      />
      <TableView
        v-else-if="subView === 'table'"
        :game="game"
        :players="players"
        :cards="cards"
      />
      <Vitals v-else :game="game" :players="players" :cards="cards" />
    </div>

    <nav
      class="fixed inset-x-0 bottom-0 z-20 border-t border-board-edge bg-board-bg/95 backdrop-blur"
      :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
    >
      <div class="mx-auto flex max-w-2xl">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          class="flex flex-1 flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition-colors"
          :class="subView === tab.id ? 'text-board-accent' : 'text-zinc-500'"
          @click="subView = tab.id"
        >
          <span class="text-base leading-none">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
        <button
          v-if="game.status === 'active'"
          class="flex flex-1 flex-col items-center gap-0.5 py-3 text-[11px] font-medium text-zinc-500"
          @click="nextTurn({ gameId: game._id })"
        >
          <span class="text-base leading-none">⏭</span>
          Pass
        </button>
      </div>
    </nav>
  </div>
</template>
