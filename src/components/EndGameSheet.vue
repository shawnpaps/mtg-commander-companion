<script setup lang="ts">
import { computed } from "vue";
import { api } from "@convex/_generated/api";
import { SignUpButton } from "@clerk/vue";
import { useQuery, useMutation } from "../lib/useConvex";
import { isSignedIn } from "../lib/auth";
import { leaveGame } from "../lib/store";
import type { Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  gameId: Id<"games">;
  myPlayerId: Id<"players"> | null;
}>();

const emit = defineEmits<{ close: [] }>();

const state = useQuery(api.results.getVoteState, () => ({
  gameId: props.gameId,
}));
const castVote = useMutation(api.results.castVote);
const cancelVoting = useMutation(api.results.cancelVoting);

const finished = computed(() => state.value?.status === "finished");
const tally = computed(() => state.value?.tally ?? []);
const threshold = computed(() => state.value?.threshold ?? 0);
const votesCast = computed(() => state.value?.votesCast ?? 0);
const seatedCount = computed(() => state.value?.seatedCount ?? 0);

// Which seat this device voted for, so the chosen row can read as selected.
const myVote = computed(() =>
  props.myPlayerId
    ? (state.value?.myVoteByPlayer?.[props.myPlayerId] ?? null)
    : null,
);

const winnerName = computed(() => state.value?.result?.winnerName ?? null);
const iWon = computed(
  () =>
    !!props.myPlayerId && state.value?.result?.winnerPlayerId === props.myPlayerId,
);

function vote(candidatePlayerId: Id<"players">) {
  if (!props.myPlayerId || finished.value) return;
  void castVote({
    gameId: props.gameId,
    voterPlayerId: props.myPlayerId,
    candidatePlayerId,
  });
}
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
    @click.self="finished ? null : emit('close')"
  >
    <div
      class="w-full max-w-md rounded-t-2xl border border-board-edge bg-board-panel p-5 pb-8 sm:rounded-2xl sm:pb-5"
      :style="{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }"
    >
      <!-- Result: the vote carried and the game is on the books. -->
      <template v-if="finished">
        <div class="text-center">
          <p class="text-xs uppercase tracking-wide text-zinc-500">
            {{ iWon ? 'Victory' : 'Game over' }}
          </p>
          <p class="mt-2 text-2xl font-semibold">
            {{ winnerName ?? 'Unknown' }} wins
          </p>
          <p class="mt-1 text-sm text-zinc-500">
            {{ state?.result?.turnCount ?? 0 }} turns ·
            {{ state?.result?.playerCount ?? 0 }} players
          </p>
        </div>

        <p
          v-if="isSignedIn"
          class="mt-5 rounded-xl border border-board-edge bg-board-bg px-4 py-3 text-center text-xs text-zinc-400"
        >
          Saved to your record.
        </p>
        <div
          v-else
          class="mt-5 rounded-xl border border-board-edge bg-board-bg px-4 py-3 text-center"
        >
          <p class="text-xs text-zinc-400">
            This game wasn't saved — you're playing as a guest.
          </p>
          <SignUpButton mode="modal">
            <button
              class="mt-2 text-xs font-semibold text-board-accent hover:underline"
            >
              Create an account to track wins
            </button>
          </SignUpButton>
        </div>

        <button
          class="mt-5 w-full rounded-xl bg-board-accent py-3.5 text-sm font-semibold text-zinc-950"
          @click="leaveGame()"
        >
          Back to lobby
        </button>
      </template>

      <!-- Voting is open. -->
      <template v-else>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-lg font-semibold">Who won?</h2>
          <span class="text-xs text-zinc-500">
            {{ votesCast }} of {{ seatedCount }} voted
          </span>
        </div>

        <ul class="flex flex-col gap-2">
          <li v-for="row in tally" :key="row.playerId">
            <button
              class="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
              :class="
                myVote === row.playerId
                  ? 'border-board-accent bg-board-accent/10'
                  : 'border-board-edge bg-board-bg hover:border-zinc-600'
              "
              :disabled="!myPlayerId"
              @click="vote(row.playerId)"
            >
              <span class="flex-1 truncate text-sm font-medium">
                {{ row.name }}
              </span>

              <!-- One dot per ballot: a glanceable tally from across the table. -->
              <span class="flex items-center gap-1">
                <span
                  v-for="n in row.count"
                  :key="n"
                  class="h-2 w-2 rounded-full bg-board-accent"
                />
              </span>
              <span
                class="w-14 text-right text-xs tabular-nums"
                :class="row.count ? 'text-zinc-400' : 'text-zinc-600'"
              >
                {{ row.count ? `${row.count} vote${row.count === 1 ? '' : 's'}` : '—' }}
              </span>
            </button>
          </li>
        </ul>

        <p class="mt-4 text-center text-xs text-zinc-500">
          Need {{ threshold }} of {{ seatedCount }} to confirm.
        </p>

        <div class="mt-4 flex gap-2">
          <button
            class="flex-1 rounded-xl border border-board-edge py-3 text-sm text-zinc-400"
            @click="cancelVoting({ gameId }).then(() => emit('close'))"
          >
            Keep playing
          </button>
          <button
            class="flex-1 rounded-xl border border-board-edge py-3 text-sm text-zinc-400"
            @click="emit('close')"
          >
            Hide
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
