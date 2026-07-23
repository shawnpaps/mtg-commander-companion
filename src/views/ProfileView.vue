<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "@convex/_generated/api";
import { useQuery, useMutation, useAction } from "../lib/useConvex";
import { convexAuthenticated } from "../lib/auth";
import AuthControls from "../components/AuthControls.vue";

const emit = defineEmits<{ close: [] }>();

// Every query here is account-scoped, so hold them until Convex has actually
// accepted the Clerk token — otherwise the first read returns null and the page
// flashes the signed-out state.
const me = useQuery(api.users.me, () => (convexAuthenticated.value ? {} : null));
const decks = useQuery(api.decks.listMyDecks, () =>
  convexAuthenticated.value ? {} : null,
);
const deckRecords = useQuery(api.users.myDeckRecords, () =>
  convexAuthenticated.value ? {} : null,
);
const history = useQuery(api.users.myHistory, () =>
  convexAuthenticated.value ? { limit: 20 } : null,
);

const importDeck = useAction(api.decks.importFromArchidekt);
const saveDeck = useMutation(api.decks.saveDeck);
const deleteDeck = useMutation(api.decks.deleteDeck);

const deckUrl = ref("");
const busy = ref(false);
const error = ref<string | null>(null);
const manualName = ref("");
const showManual = ref(false);

const record = computed(() => me.value?.record ?? null);
const winRate = computed(() => {
  const r = record.value;
  if (!r || r.games === 0) return null;
  return Math.round((r.wins / r.games) * 100);
});

const isMoxfield = computed(() => /moxfield\.com/i.test(deckUrl.value));

async function submitImport() {
  const url = deckUrl.value.trim();
  if (!url || busy.value) return;
  busy.value = true;
  error.value = null;

  try {
    if (isMoxfield.value) {
      // Moxfield's API is gated behind an approved partnership, so we can't read
      // the list. Save the link and let the user name it themselves.
      if (!manualName.value.trim()) {
        showManual.value = true;
        error.value = "Give the deck a name and we'll save the Moxfield link.";
        return;
      }
      await saveDeck({
        name: manualName.value.trim(),
        source: "link",
        sourceUrl: url,
      });
    } else {
      await importDeck({ url });
    }
    deckUrl.value = "";
    manualName.value = "";
    showManual.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

function recordFor(deckId: string) {
  return deckRecords.value?.[deckId] ?? null;
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6 sm:max-w-lg">
    <header class="mb-6 flex items-center justify-between">
      <button
        class="text-sm text-zinc-500 hover:text-zinc-300"
        @click="emit('close')"
      >
        ← Back
      </button>
      <AuthControls />
    </header>

    <!-- Signed out: this whole screen is the pitch for making an account. -->
    <div v-if="!convexAuthenticated" class="mt-10 text-center">
      <h1 class="text-2xl font-semibold">Track your pod</h1>
      <p class="mx-auto mt-3 max-w-xs text-sm text-zinc-500">
        Save your decks, keep a running win/loss record, and see which commander
        actually closes games. Playing stays free without an account — you just
        won't keep any of it.
      </p>
      <div class="mt-6 flex justify-center">
        <AuthControls />
      </div>
    </div>

    <template v-else>
      <h1 class="text-2xl font-semibold">
        {{ me?.user.displayName ?? 'Your record' }}
      </h1>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <div class="rounded-xl border border-board-edge bg-board-panel p-3 text-center">
          <p class="text-2xl font-semibold tabular-nums text-board-accent">
            {{ record?.wins ?? 0 }}
          </p>
          <p class="text-[10px] uppercase tracking-wide text-zinc-500">Wins</p>
        </div>
        <div class="rounded-xl border border-board-edge bg-board-panel p-3 text-center">
          <p class="text-2xl font-semibold tabular-nums text-zinc-300">
            {{ record?.losses ?? 0 }}
          </p>
          <p class="text-[10px] uppercase tracking-wide text-zinc-500">Losses</p>
        </div>
        <div class="rounded-xl border border-board-edge bg-board-panel p-3 text-center">
          <p class="text-2xl font-semibold tabular-nums text-zinc-300">
            {{ winRate === null ? '—' : `${winRate}%` }}
          </p>
          <p class="text-[10px] uppercase tracking-wide text-zinc-500">Win rate</p>
        </div>
      </div>

      <!-- Decks -->
      <section class="mt-8">
        <h2 class="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Decks
        </h2>

        <form class="mt-3 flex flex-col gap-2" @submit.prevent="submitImport">
          <input
            v-model="deckUrl"
            type="url"
            inputmode="url"
            placeholder="archidekt.com/decks/123456"
            class="rounded-xl border border-board-edge bg-board-panel px-4 py-3 text-sm outline-none focus:border-board-accent"
          />
          <input
            v-if="showManual || isMoxfield"
            v-model="manualName"
            type="text"
            placeholder="Deck name"
            class="rounded-xl border border-board-edge bg-board-panel px-4 py-3 text-sm outline-none focus:border-board-accent"
          />
          <p v-if="isMoxfield" class="text-xs text-zinc-600">
            Moxfield doesn't offer a public API, so we'll save the link and the
            name rather than the full list.
          </p>
          <button
            type="submit"
            :disabled="busy || !deckUrl.trim()"
            class="rounded-xl bg-board-accent py-3 text-sm font-semibold text-zinc-950 disabled:opacity-30"
          >
            {{ busy ? 'Importing…' : 'Import deck' }}
          </button>
          <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
        </form>

        <ul v-if="decks?.length" class="mt-4 flex flex-col gap-2">
          <li
            v-for="deck in decks"
            :key="deck._id"
            class="flex items-center gap-3 rounded-xl border border-board-edge bg-board-panel px-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ deck.name }}</p>
              <p class="truncate text-xs text-zinc-500">
                {{ deck.commanderName ?? deck.source }}
                <template v-if="deck.cardCount"> · {{ deck.cardCount }} cards</template>
                <template v-if="recordFor(deck._id)">
                  · {{ recordFor(deck._id)!.wins }}W
                  {{ recordFor(deck._id)!.losses }}L
                </template>
              </p>
            </div>
            <a
              v-if="deck.sourceUrl"
              :href="deck.sourceUrl"
              target="_blank"
              rel="noreferrer noopener"
              class="text-xs text-zinc-600 hover:text-board-accent"
            >
              open
            </a>
            <button
              class="text-xs text-zinc-600 hover:text-red-400"
              @click="deleteDeck({ deckId: deck._id })"
            >
              remove
            </button>
          </li>
        </ul>
        <p v-else class="mt-4 text-xs text-zinc-600">
          No decks yet. Paste an Archidekt URL above.
        </p>
      </section>

      <!-- History -->
      <section class="mt-8 pb-10">
        <h2 class="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Recent games
        </h2>
        <ul v-if="history?.length" class="mt-3 flex flex-col gap-1.5">
          <li
            v-for="game in history"
            :key="game._id"
            class="flex items-center gap-3 rounded-lg border border-board-edge bg-board-panel px-3 py-2.5"
          >
            <span
              class="w-6 text-center text-xs font-bold"
              :class="game.won ? 'text-board-accent' : 'text-zinc-600'"
            >
              {{ game.won ? 'W' : 'L' }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm">
                {{ game.won ? 'Won' : `Lost to ${game.winnerName ?? '—'}` }}
              </p>
              <p class="truncate text-xs text-zinc-600">
                {{ game.format }} · {{ game.opponentCount }} opponents
                <template v-if="game.commanderName">
                  · {{ game.commanderName }}
                </template>
              </p>
            </div>
            <span class="font-mono text-[10px] text-zinc-700">
              {{ game.code }}
            </span>
          </li>
        </ul>
        <p v-else class="mt-3 text-xs text-zinc-600">
          No finished games yet. Your record fills in as your pod votes on
          winners.
        </p>
      </section>
    </template>
  </div>
</template>
