<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "@convex/_generated/api";
import { useQuery, useMutation, useAction } from "../lib/useConvex";
import { convexAuthenticated, isSignedIn } from "../lib/auth";
import AuthControls from "../components/AuthControls.vue";
import type { Id } from "@convex/_generated/dataModel";

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

// Removing a deck is one tap away from "open" on a phone, and an import can be
// 100 cards, so it takes a second tap to confirm. Reverts on its own rather than
// leaving a live destructive control sitting in the row.
const pendingRemove = ref<Id<"decks"> | null>(null);
let revertTimer: ReturnType<typeof setTimeout> | undefined;

function askRemove(deckId: Id<"decks">) {
  clearTimeout(revertTimer);
  pendingRemove.value = deckId;
  revertTimer = setTimeout(() => (pendingRemove.value = null), 5000);
}

function cancelRemove() {
  clearTimeout(revertTimer);
  pendingRemove.value = null;
}

async function confirmRemove(deckId: Id<"decks">) {
  cancelRemove();
  try {
    await deleteDeck({ deckId });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6 sm:max-w-lg">
    <header class="mb-6 flex items-center justify-between">
      <button
        class="text-sm text-fg-muted hover:text-fg-secondary"
        @click="emit('close')"
      >
        ← Back
      </button>
      <AuthControls />
    </header>

    <!-- Signed out: this whole screen is the pitch for making an account. -->
    <div v-if="!isSignedIn" class="mt-10 text-center">
      <h1 class="text-2xl font-semibold">Track your pod</h1>
      <p class="mx-auto mt-3 max-w-xs text-sm text-fg-muted">
        Save your decks, keep a running win/loss record, and see which commander
        actually closes games. Playing stays free without an account — you just
        won't keep any of it.
      </p>
      <div class="mt-6 flex justify-center">
        <AuthControls />
      </div>
    </div>

    <!-- Signed in with Clerk, but Convex hasn't accepted the token yet. Every
         query below is account-scoped and would read as empty, so say we're
         still connecting rather than show an empty record. -->
    <div v-else-if="!convexAuthenticated" class="mt-16 text-center">
      <p class="animate-pulse text-sm text-fg-muted">Loading your decks…</p>
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
          <p class="text-[10px] uppercase tracking-wide text-fg-muted">Wins</p>
        </div>
        <div class="rounded-xl border border-board-edge bg-board-panel p-3 text-center">
          <p class="text-2xl font-semibold tabular-nums text-fg-secondary">
            {{ record?.losses ?? 0 }}
          </p>
          <p class="text-[10px] uppercase tracking-wide text-fg-muted">Losses</p>
        </div>
        <div class="rounded-xl border border-board-edge bg-board-panel p-3 text-center">
          <p class="text-2xl font-semibold tabular-nums text-fg-secondary">
            {{ winRate === null ? '—' : `${winRate}%` }}
          </p>
          <p class="text-[10px] uppercase tracking-wide text-fg-muted">Win rate</p>
        </div>
      </div>

      <!-- Decks -->
      <section class="mt-8">
        <h2 class="text-xs font-medium uppercase tracking-wide text-fg-muted">
          Decks
        </h2>

        <form class="mt-3 flex flex-col gap-2" @submit.prevent="submitImport">
          <input
            v-model="deckUrl"
            type="url"
            inputmode="url"
            placeholder="archidekt.com/decks/123456"
            class="rounded-xl border border-board-edge-strong bg-board-panel px-4 py-3 text-sm outline-none focus:border-board-accent"
          />
          <input
            v-if="showManual || isMoxfield"
            v-model="manualName"
            type="text"
            placeholder="Deck name"
            class="rounded-xl border border-board-edge-strong bg-board-panel px-4 py-3 text-sm outline-none focus:border-board-accent"
          />
          <p v-if="isMoxfield" class="text-xs text-fg-subtle">
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
          <p v-if="error" class="text-xs text-danger">{{ error }}</p>
        </form>

        <ul v-if="decks?.length" class="mt-4 flex flex-col gap-2">
          <li
            v-for="deck in decks"
            :key="deck._id"
            class="flex items-center gap-3 rounded-xl border border-board-edge bg-board-panel px-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ deck.name }}</p>
              <p class="truncate text-xs text-fg-muted">
                {{ deck.commanderName ?? deck.source }}
                <template v-if="deck.cardCount"> · {{ deck.cardCount }} cards</template>
                <template v-if="recordFor(deck._id)">
                  · {{ recordFor(deck._id)!.wins }}W
                  {{ recordFor(deck._id)!.losses }}L
                </template>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <template v-if="pendingRemove === deck._id">
                <span class="text-xs text-fg-muted">
                  {{
                    recordFor(deck._id)
                      ? 'Remove? Its game history stays on your record.'
                      : 'Remove?'
                  }}
                </span>
                <button
                  class="text-xs font-medium text-danger"
                  @click="confirmRemove(deck._id)"
                >
                  Remove
                </button>
                <button
                  class="text-xs text-fg-tertiary"
                  @click="cancelRemove()"
                >
                  Cancel
                </button>
              </template>

              <template v-else>
                <a
                  v-if="deck.sourceUrl"
                  :href="deck.sourceUrl"
                  target="_blank"
                  rel="noreferrer noopener"
                  class="text-xs text-fg-subtle hover:text-board-accent"
                >
                  open
                </a>
                <button
                  class="text-xs text-fg-subtle hover:text-danger"
                  @click="askRemove(deck._id)"
                >
                  remove
                </button>
              </template>
            </div>
          </li>
        </ul>
        <p v-else class="mt-4 text-xs text-fg-subtle">
          No decks yet. Paste an Archidekt URL above.
        </p>
      </section>

      <!-- History -->
      <section class="mt-8 pb-10">
        <h2 class="text-xs font-medium uppercase tracking-wide text-fg-muted">
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
              :class="game.won ? 'text-board-accent' : 'text-fg-subtle'"
            >
              {{ game.won ? 'W' : 'L' }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm">
                {{ game.won ? 'Won' : `Lost to ${game.winnerName ?? '—'}` }}
              </p>
              <p class="truncate text-xs text-fg-subtle">
                {{ game.format }} · {{ game.opponentCount }} opponents
                <template v-if="game.commanderName">
                  · {{ game.commanderName }}
                </template>
              </p>
            </div>
            <span class="font-mono text-[10px] text-fg-subtle">
              {{ game.code }}
            </span>
          </li>
        </ul>
        <p v-else class="mt-3 text-xs text-fg-subtle">
          No finished games yet. Your record fills in as your pod votes on
          winners.
        </p>
      </section>
    </template>
  </div>
</template>
