<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "../lib/useConvex";
import { sessionId } from "../lib/session";
import { closeDraft, openDraftTournament } from "../lib/draftStore";
import { accountUserId } from "../lib/auth";
import type { Id } from "@convex/_generated/dataModel";

const code = ref("");
const busy = ref(false);
const error = ref<string | null>(null);

const claimSeat = useMutation(api.draft.tournaments.claimSeat);

// Only looks anything up once six characters are in, so the field does not
// flash "no event" at every keystroke.
const normalized = computed(() => code.value.trim().toUpperCase());
const lookup = useQuery(api.draft.tournaments.lookupByCode, () =>
  normalized.value.length === 6 ? { code: normalized.value } : null,
);

const searching = computed(
  () => normalized.value.length === 6 && lookup.value === undefined,
);
const notFound = computed(
  () => normalized.value.length === 6 && lookup.value === null,
);

/** Seats grouped by pod, so a 24-player event is still scannable. */
const seatsByPod = computed(() => {
  const seats = lookup.value?.seats ?? [];
  const groups = new Map<number, typeof seats>();
  for (const seat of seats) {
    const list = groups.get(seat.podIndex) ?? [];
    list.push(seat);
    groups.set(seat.podIndex, list);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
});

async function claim(entrantId: Id<"draftEntrants">) {
  if (busy.value || !sessionId.value || !lookup.value) return;
  busy.value = true;
  error.value = null;
  try {
    await claimSeat({
      entrantId,
      sessionId: sessionId.value,
      userId: accountUserId.value ?? undefined,
    });
    openDraftTournament(lookup.value.tournamentId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

/** Follow along without taking a seat — for a judge, or a spectator. */
function watchOnly() {
  if (!lookup.value) return;
  openDraftTournament(lookup.value.tournamentId);
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8 sm:max-w-lg">
    <header class="mb-6">
      <button
        type="button"
        class="mb-5 block text-xs text-fg-muted transition-colors hover:text-fg"
        @click="closeDraft()"
      >
        ← Lobby
      </button>
      <h1 class="text-2xl font-semibold tracking-tight">Join a draft</h1>
      <p class="mt-1 text-sm text-fg-muted">
        Enter the six-character code from the organizer, then pick your name.
      </p>
    </header>

    <label class="flex flex-col gap-2">
      <span class="text-xs font-medium uppercase tracking-wide text-fg-muted">
        Join code
      </span>
      <input
        v-model="code"
        type="text"
        inputmode="text"
        autocapitalize="characters"
        autocomplete="off"
        maxlength="6"
        placeholder="A1B2C3"
        class="rounded-xl border border-board-edge-strong bg-board-panel px-4 py-3 text-center font-mono text-2xl uppercase tracking-[0.35em] outline-none focus:border-board-accent"
      />
    </label>

    <p v-if="searching" class="mt-4 animate-pulse text-sm text-fg-muted">
      Looking for that event…
    </p>
    <p v-else-if="notFound" class="mt-4 text-sm text-danger">
      No event with that code. Check it with the organizer.
    </p>

    <template v-if="lookup">
      <div class="mt-6 rounded-xl border border-board-edge bg-board-panel px-4 py-3">
        <p class="text-sm font-medium text-fg-secondary">{{ lookup.name }}</p>
        <p class="mt-0.5 text-xs text-fg-muted">
          {{ lookup.seats.length }} players ·
          {{ lookup.podCount }} {{ lookup.podCount === 1 ? "pod" : "pods" }} ·
          {{ lookup.status }}
        </p>
      </div>

      <div class="mt-5 flex flex-col gap-4">
        <div v-for="[podIndex, seats] in seatsByPod" :key="podIndex" class="flex flex-col gap-2">
          <h2
            v-if="lookup.podCount > 1"
            class="text-xs font-medium uppercase tracking-wide text-fg-muted"
          >
            Pod {{ podIndex }}
          </h2>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="seat in seats"
              :key="seat.entrantId"
              type="button"
              :disabled="busy || seat.claimed"
              class="rounded-xl border px-3 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed"
              :class="
                seat.claimed
                  ? 'border-board-edge bg-board-panel text-fg-subtle opacity-60'
                  : 'border-board-edge bg-board-panel text-fg-secondary hover:border-board-accent hover:text-board-accent'
              "
              @click="claim(seat.entrantId)"
            >
              <span class="block truncate">{{ seat.name }}</span>
              <span v-if="seat.claimed" class="mt-0.5 block text-[11px]">
                already claimed
              </span>
              <span v-else-if="seat.dropped" class="mt-0.5 block text-[11px] text-fg-subtle">
                dropped
              </span>
            </button>
          </div>
        </div>
      </div>

      <p v-if="error" class="mt-4 text-sm text-danger">{{ error }}</p>

      <button
        type="button"
        class="mt-5 rounded-xl border border-board-edge bg-board-panel py-3 text-sm text-fg-tertiary transition-colors hover:border-board-accent hover:text-board-accent"
        @click="watchOnly()"
      >
        Just watch — don't claim a seat
      </button>

      <p class="mt-3 text-xs text-fg-subtle">
        Claiming a seat only marks which player you are, so your pairings stand
        out. The organizer still enters every result.
      </p>
    </template>
  </div>
</template>
