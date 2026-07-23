<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "../lib/useConvex";
import { sessionId, displayName, setDisplayName } from "../lib/session";
import { enterGame, showProfile } from "../lib/store";
import { convexAuthenticated } from "../lib/auth";
import AuthControls from "../components/AuthControls.vue";
import type { Id } from "@convex/_generated/dataModel";

type Format = "commander" | "standard" | "modern" | "draft";

const FORMATS: Array<{ id: Format; label: string; life: number }> = [
  { id: "commander", label: "Commander", life: 40 },
  { id: "standard", label: "Standard", life: 20 },
  { id: "modern", label: "Modern", life: 20 },
  { id: "draft", label: "Draft", life: 20 },
];

const createGame = useMutation(api.games.createGame);
const joinGame = useMutation(api.games.joinGame);

const mode = ref<"create" | "join">("create");
const name = ref(displayName.value);
const format = ref<Format>("commander");
const playerCount = ref(4);
const joinCode = ref("");
const busy = ref(false);
const error = ref<string | null>(null);
const deckId = ref<Id<"decks"> | null>(null);

const decks = useQuery(api.decks.listMyDecks, () =>
  convexAuthenticated.value ? {} : null,
);

// A signed-in user's account name is a better default than whatever this device
// last typed, but never clobber a name the user is actively editing.
const me = useQuery(api.users.me, () =>
  convexAuthenticated.value ? {} : null,
);
watch(me, (value) => {
  if (value?.user.displayName && !name.value.trim()) {
    name.value = value.user.displayName;
  }
});

const canSubmit = computed(
  () =>
    name.value.trim().length > 0 &&
    !busy.value &&
    (mode.value === "create" || joinCode.value.trim().length === 6),
);

const startingLife = computed(
  () => FORMATS.find((f) => f.id === format.value)?.life ?? 20,
);

async function submit() {
  if (!canSubmit.value || !sessionId.value) return;
  busy.value = true;
  error.value = null;
  setDisplayName(name.value.trim());

  try {
    if (mode.value === "create") {
      const created = await createGame({
        format: format.value,
        playerCount: playerCount.value,
        sessionId: sessionId.value,
      });
      // The host takes a seat immediately so they land in the game, not the void.
      const joined = await joinGame({
        code: created.code,
        name: name.value.trim(),
        sessionId: sessionId.value,
        deckId: deckId.value ?? undefined,
      });
      enterGame(created.code, joined.playerId);
    } else {
      const joined = await joinGame({
        code: joinCode.value.trim().toUpperCase(),
        name: name.value.trim(),
        sessionId: sessionId.value,
        deckId: deckId.value ?? undefined,
      });
      enterGame(joinCode.value.trim().toUpperCase(), joined.playerId);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10 sm:max-w-lg">
    <header class="mb-8">
      <div class="mb-6 flex items-center justify-between">
        <button
          v-if="convexAuthenticated"
          class="text-xs text-zinc-500 hover:text-zinc-300"
          @click="showProfile = true"
        >
          Decks &amp; record
        </button>
        <span v-else />
        <AuthControls />
      </div>

      <h1 class="text-3xl font-semibold tracking-tight">
        Board<span class="text-board-accent">State</span>
      </h1>
      <p class="mt-1 text-sm text-zinc-500">
        Shared board for the table. Jump in with a code — no account needed.
      </p>
    </header>

    <!-- The account pitch, stated once and not repeated in the form below. -->
    <div
      v-if="!convexAuthenticated"
      class="mb-6 rounded-xl border border-board-edge bg-board-panel px-4 py-3"
    >
      <p class="text-xs leading-relaxed text-zinc-400">
        <span class="text-board-accent">Sign in for the full experience.</span>
        Accounts save your decks and keep a running win/loss record across pods.
        Guests can play everything — nothing gets saved.
      </p>
    </div>

    <div class="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-board-panel p-1">
      <button
        v-for="option in (['create', 'join'] as const)"
        :key="option"
        class="rounded-lg py-2.5 text-sm font-medium capitalize transition-colors"
        :class="
          mode === option
            ? 'bg-board-accent text-zinc-950'
            : 'text-zinc-400 hover:text-zinc-200'
        "
        @click="mode = option"
      >
        {{ option === 'create' ? 'New game' : 'Join game' }}
      </button>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <label class="flex flex-col gap-2">
        <span class="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Your name
        </span>
        <input
          v-model="name"
          type="text"
          autocomplete="nickname"
          placeholder="Nicol Bolas Enjoyer"
          class="rounded-xl border border-board-edge bg-board-panel px-4 py-3 text-base outline-none focus:border-board-accent"
        />
      </label>

      <template v-if="mode === 'create'">
        <div class="flex flex-col gap-2">
          <span class="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Format
          </span>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              v-for="f in FORMATS"
              :key="f.id"
              type="button"
              class="rounded-xl border px-3 py-3 text-sm transition-colors"
              :class="
                format === f.id
                  ? 'border-board-accent bg-board-accent/10 text-board-accent'
                  : 'border-board-edge bg-board-panel text-zinc-400'
              "
              @click="format = f.id"
            >
              {{ f.label }}
            </button>
          </div>
          <p class="text-xs text-zinc-600">
            Players start at {{ startingLife }} life.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Players
          </span>
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="n in [2, 3, 4, 5, 6]"
              :key="n"
              type="button"
              class="rounded-xl border py-3 text-sm transition-colors"
              :class="
                playerCount === n
                  ? 'border-board-accent bg-board-accent/10 text-board-accent'
                  : 'border-board-edge bg-board-panel text-zinc-400'
              "
              @click="playerCount = n"
            >
              {{ n }}
            </button>
          </div>
        </div>
      </template>

      <!-- Deck choice is what makes the per-deck win rate on the profile work. -->
      <div v-if="decks?.length" class="flex flex-col gap-2">
        <span class="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Deck <span class="normal-case text-zinc-600">(optional)</span>
        </span>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border px-3 py-2 text-xs transition-colors"
            :class="
              deckId === null
                ? 'border-board-accent bg-board-accent/10 text-board-accent'
                : 'border-board-edge bg-board-panel text-zinc-400'
            "
            @click="deckId = null"
          >
            None
          </button>
          <button
            v-for="deck in decks"
            :key="deck._id"
            type="button"
            class="max-w-full truncate rounded-lg border px-3 py-2 text-xs transition-colors"
            :class="
              deckId === deck._id
                ? 'border-board-accent bg-board-accent/10 text-board-accent'
                : 'border-board-edge bg-board-panel text-zinc-400'
            "
            @click="deckId = deck._id"
          >
            {{ deck.name }}
          </button>
        </div>
      </div>

      <label v-if="mode === 'join'" class="flex flex-col gap-2">
        <span class="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Game code
        </span>
        <input
          v-model="joinCode"
          type="text"
          inputmode="text"
          autocapitalize="characters"
          maxlength="6"
          placeholder="A1B2C3"
          class="rounded-xl border border-board-edge bg-board-panel px-4 py-3 text-center font-mono text-2xl uppercase tracking-[0.35em] outline-none focus:border-board-accent"
        />
      </label>

      <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

      <button
        type="submit"
        :disabled="!canSubmit"
        class="rounded-xl bg-board-accent py-4 text-base font-semibold text-zinc-950 transition-opacity disabled:opacity-30"
      >
        {{ busy ? 'Working…' : mode === 'create' ? 'Create game' : 'Join game' }}
      </button>
    </form>
  </div>
</template>
