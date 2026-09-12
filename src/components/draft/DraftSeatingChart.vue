<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "@convex/_generated/api";
import { useMutation } from "../../lib/useConvex";
import { sessionId } from "../../lib/session";
import type { Doc, Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  pod: Doc<"draftPods">;
  entrants: Doc<"draftEntrants">[];
  /** Organizer controls are hidden entirely rather than shown disabled. */
  isHost: boolean;
  myEntrantId: Id<"draftEntrants"> | null;
}>();

const assignSeatsRandom = useMutation(api.draft.seating.assignSeatsRandom);
const swapSeats = useMutation(api.draft.seating.swapSeats);

const busy = ref(false);
const error = ref<string | null>(null);
/** Host's manual-override mode: tap two seats to swap them. */
const adjusting = ref(false);
const pendingId = ref<Id<"draftEntrants"> | null>(null);
/** Seat whose neighbor caption is shown. Defaults to this device's own seat. */
const selectedId = ref<Id<"draftEntrants"> | null>(props.myEntrantId);

const active = computed(() => props.entrants.filter((e) => !e.dropped));

/** Seated active entrants, in seat order around the circle. */
const seated = computed(() =>
  active.value
    .filter(
      (e): e is Doc<"draftEntrants"> & { seatIndex: number } =>
        e.seatIndex !== undefined,
    )
    .sort((a, b) => a.seatIndex - b.seatIndex),
);

const hasSeats = computed(() => seated.value.length > 0);
/** Once round 1 exists the draft is underway and the chart goes read-only. */
const locked = computed(() => props.pod.currentRound >= 1);
const canAdjust = computed(() => props.isHost && !locked.value);
const adjustMode = computed(() => adjusting.value && canAdjust.value);

/** A post-seat drop leaves a hole in the numbering until the next randomize. */
const hasGap = computed(() =>
  seated.value.some((e, i) => e.seatIndex !== i),
);

// Nothing to reference once the draft has started without seats ever being
// assigned, and nothing to seat in an empty pod.
const show = computed(
  () => (hasSeats.value || !locked.value) && active.value.length > 0,
);

/**
 * The circle is drawn clockwise in seat order: seat 0 at the top, each next
 * seat one step clockwise. That makes the `(i + 1) % n` neighbor the one on a
 * player's left (checked against the drawn orientation), so packs 1 & 3 — the
 * leftward passes — flow clockwise as drawn.
 */
const ORBIT_RADIUS = 38; // % of the square container, center to chip center

function seatStyle(position: number, count: number): Record<string, string> {
  const angle = (-90 + (360 / count) * position) * (Math.PI / 180);
  return {
    left: `${50 + ORBIT_RADIUS * Math.cos(angle)}%`,
    top: `${50 + ORBIT_RADIUS * Math.sin(angle)}%`,
  };
}

/**
 * Who the selected seat feeds. Derived from list position rather than raw
 * seatIndex math so a gap left by a dropped player can't point at an empty
 * chair; identical to `(i ± 1) % n` whenever seats are contiguous.
 */
const selectedSeat = computed(() => {
  const list = seated.value;
  const index = list.findIndex((e) => e._id === selectedId.value);
  if (index === -1 || list.length < 2) return null;
  return {
    self: list[index],
    left: list[(index + 1) % list.length],
    right: list[(index - 1 + list.length) % list.length],
  };
});

function chipClass(seat: Doc<"draftEntrants">): string {
  if (adjustMode.value && pendingId.value === seat._id) {
    return "border-board-accent bg-board-accent text-zinc-950";
  }
  if (seat._id === props.myEntrantId) return "border-board-accent text-fg";
  if (seat._id === selectedId.value) return "border-fg text-fg";
  return "border-board-edge-strong text-fg-secondary";
}

async function randomize() {
  if (busy.value || !sessionId.value) return;
  busy.value = true;
  error.value = null;
  try {
    await assignSeatsRandom({
      podId: props.pod._id,
      sessionId: sessionId.value,
    });
  } catch (e) {
    error.value = friendly(e);
  } finally {
    busy.value = false;
  }
}

async function onSeatTap(seat: Doc<"draftEntrants">) {
  if (!adjustMode.value) {
    selectedId.value = seat._id;
    return;
  }
  if (busy.value || !sessionId.value) return;
  if (pendingId.value === null) {
    pendingId.value = seat._id;
    return;
  }
  if (pendingId.value === seat._id) {
    pendingId.value = null;
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    await swapSeats({
      podId: props.pod._id,
      sessionId: sessionId.value,
      entrantAId: pendingId.value,
      entrantBId: seat._id,
    });
    pendingId.value = null;
  } catch (e) {
    error.value = friendly(e);
    pendingId.value = null;
  } finally {
    busy.value = false;
  }
}

function stopAdjusting() {
  adjusting.value = false;
  pendingId.value = null;
}

/** Seat errors arrive with the engine's `draft/<reason>:` prefix; strip it. */
function friendly(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const match = raw.match(/draft\/[a-z-]+: (.*)/);
  return match ? match[1] : raw;
}
</script>

<template>
  <section v-if="show" class="flex flex-col gap-3">
    <h3 class="text-xs font-medium uppercase tracking-wide text-fg-muted">
      Draft seating
    </h3>

    <!-- Nobody seated yet: the prompt is the whole panel. -->
    <div
      v-if="!hasSeats"
      class="flex flex-col gap-3 rounded-xl border border-board-edge bg-board-panel px-4 py-4"
    >
      <p class="text-sm text-fg-secondary">
        Where everyone sits decides who passes to whom. Seating is random; the
        organizer can adjust it until round 1 starts.
      </p>
      <button
        v-if="canAdjust"
        type="button"
        :disabled="busy"
        class="rounded-xl bg-board-accent py-3 text-sm font-semibold text-zinc-950 transition-opacity disabled:opacity-30"
        @click="randomize()"
      >
        {{ busy ? "Assigning…" : "Assign seats randomly" }}
      </button>
      <p v-else class="text-xs text-fg-muted">
        The organizer assigns seats once everyone is at the table.
      </p>
    </div>

    <template v-else>
      <div class="no-touch-callout relative mx-auto aspect-square w-full max-w-72">
        <!-- The table itself. -->
        <div class="absolute inset-[12%] rounded-full border border-board-edge" />

        <!-- Pass directions, derived from position — never stored. Packs 1 & 3
             move one seat clockwise (to each player's left), pack 2 the other
             way. -->
        <svg
          v-if="seated.length > 1"
          viewBox="0 0 96 96"
          class="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="seat-arrow-accent"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--color-board-accent)" />
            </marker>
            <marker
              id="seat-arrow-muted"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--color-fg-muted)" />
            </marker>
          </defs>
          <path
            d="M10.6 41.4 A38 38 0 0 1 85.4 41.4"
            fill="none"
            stroke="var(--color-board-accent)"
            stroke-width="1.5"
            marker-end="url(#seat-arrow-accent)"
          />
          <path
            d="M25.4 56.2 A24 24 0 0 0 70.6 56.2"
            fill="none"
            stroke="var(--color-fg-muted)"
            stroke-width="1.5"
            marker-end="url(#seat-arrow-muted)"
          />
          <text
            x="48"
            y="30"
            text-anchor="middle"
            font-size="9"
            fill="var(--color-board-accent)"
          >
            1·3
          </text>
          <text
            x="48"
            y="67"
            text-anchor="middle"
            font-size="9"
            fill="var(--color-fg-muted)"
          >
            2
          </text>
        </svg>

        <!-- One chip per seated entrant, 1-based numbers for humans. -->
        <button
          v-for="(seat, i) in seated"
          :key="seat._id"
          type="button"
          :disabled="busy"
          class="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
          :style="seatStyle(i, seated.length)"
          @click="onSeatTap(seat)"
        >
          <span
            class="flex h-9 w-9 items-center justify-center rounded-full border bg-board-panel text-sm font-semibold tabular-nums transition-colors"
            :class="chipClass(seat)"
          >
            {{ seat.seatIndex + 1 }}
          </span>
          <span class="max-w-full truncate text-xs text-fg-secondary">
            {{ seat.name }}<template v-if="seat._id === myEntrantId"> (you)</template>
          </span>
        </button>
      </div>

      <p v-if="seated.length > 1" class="text-center text-xs text-fg-muted">
        Packs 1 &amp; 3 pass left (clockwise as drawn) · pack 2 passes right
      </p>

      <p v-if="selectedSeat" class="text-center text-xs text-fg-secondary">
        <span class="font-medium text-fg">{{ selectedSeat.self.name }}</span>
        feeds {{ selectedSeat.left.name }} on packs 1 &amp; 3, and
        {{ selectedSeat.right.name }} on pack 2.
      </p>

      <div v-if="canAdjust" class="flex flex-col gap-2">
        <div v-if="!adjustMode" class="flex gap-2">
          <button
            type="button"
            :disabled="busy"
            class="flex-1 rounded-xl border border-board-edge bg-board-panel py-3 text-sm font-medium text-fg-tertiary transition-colors hover:border-board-accent hover:text-board-accent disabled:opacity-40"
            @click="randomize()"
          >
            {{ busy ? "Shuffling…" : "Re-randomize" }}
          </button>
          <button
            type="button"
            :disabled="busy"
            class="flex-1 rounded-xl border border-board-edge bg-board-panel py-3 text-sm font-medium text-fg-tertiary transition-colors hover:border-board-accent hover:text-board-accent disabled:opacity-40"
            @click="adjusting = true"
          >
            Adjust seating
          </button>
        </div>
        <div v-else class="flex items-center gap-3">
          <p class="flex-1 text-xs text-fg-muted">
            Tap two seats to swap them.
          </p>
          <button
            type="button"
            class="rounded-xl border border-board-edge bg-board-panel px-4 py-2 text-sm font-medium text-fg-tertiary transition-colors hover:border-board-accent hover:text-board-accent"
            @click="stopAdjusting()"
          >
            Done
          </button>
        </div>
        <p v-if="hasGap" class="text-xs text-fg-subtle">
          A dropped player left a gap in the numbering — re-randomize to
          renumber the table.
        </p>
      </div>

      <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    </template>
  </section>
</template>
