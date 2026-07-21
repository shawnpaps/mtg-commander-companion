<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import { animate } from "motion";
import { api } from "@convex/_generated/api";
import { useMutation } from "../lib/useConvex";
import { imageVariant } from "../lib/scryfallImage";
import type { Doc, Id } from "@convex/_generated/dataModel";

const props = defineProps<{
  card: Doc<"cards">;
  players: Doc<"players">[];
  interactive?: boolean;
}>();

const ZONES = [
  { id: "battlefield", label: "Battlefield" },
  { id: "graveyard", label: "Graveyard" },
  { id: "exile", label: "Exile" },
  { id: "command", label: "Command Zone" },
  { id: "library", label: "Library" },
] as const;

const toggleTap = useMutation(api.cards.toggleTap);
const moveCard = useMutation(api.cards.moveCard);
const setController = useMutation(api.cards.setController);
const updateCounters = useMutation(api.cards.updateCounters);
const removeCard = useMutation(api.cards.removeCard);

const root = ref<HTMLElement | null>(null);
const menuOpen = ref(false);
const confirmingRemove = ref(false);
const zoomed = ref(false);
const zoomEl = ref<HTMLElement | null>(null);
let pressTimer: ReturnType<typeof setTimeout> | undefined;
let longPressed = false;

// Board thumbnails use the stored "normal" art; the reader wants the sharper
// "large" variant. `highResFailed` drops back to the stored URL if the derived
// one 404s for any reason.
const highResFailed = ref(false);
const readableImage = computed(() =>
  highResFailed.value
    ? props.card.imageUrl
    : imageVariant(props.card.imageUrl, "large"),
);

async function openZoom() {
  // Nothing to read on a card still waiting for its Scryfall backfill.
  if (!props.card.imageUrl) return;
  zoomed.value = true;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  if (zoomEl.value) {
    animate(
      zoomEl.value,
      { opacity: [0, 1], scale: [0.9, 1] },
      { duration: 0.2 },
    );
  }
}

const spring = { type: "spring", stiffness: 420, damping: 32 } as const;

onMounted(() => {
  if (!root.value) return;
  // Enter transition — cast cards pop onto the board.
  animate(
    root.value,
    { opacity: [0, 1], scale: [0.8, 1], rotate: props.card.tapped ? 90 : 0 },
    { duration: 0.28 },
  );
});

// Never leave the remove button armed for the next time the sheet opens.
watch(menuOpen, (open) => {
  if (!open) confirmingRemove.value = false;
});

// The rotation follows Convex state, not the local click, so every device at
// the table sees the same tap animation.
watch(
  () => props.card.tapped,
  (tapped) => {
    if (root.value) animate(root.value, { rotate: tapped ? 90 : 0 }, spring);
  },
);

function onTap() {
  if (longPressed) {
    longPressed = false;
    return;
  }
  // `interactive` governs control, not visibility. An opponent's card can't be
  // tapped or moved, so a plain tap goes straight to the reader — you still
  // need to see what they're playing.
  if (!props.interactive) {
    openZoom();
    return;
  }
  toggleTap({ cardId: props.card._id });
}

function startPress() {
  if (!props.interactive) return;
  longPressed = false;
  pressTimer = setTimeout(() => {
    longPressed = true;
    menuOpen.value = true;
    if ("vibrate" in navigator) navigator.vibrate?.(10);
  }, 450);
}

function endPress() {
  if (pressTimer) clearTimeout(pressTimer);
}

async function moveTo(zone: (typeof ZONES)[number]["id"]) {
  menuOpen.value = false;
  if (zone === props.card.zone) return;
  if (root.value) {
    // Exit transition before the card reappears in its new zone.
    await animate(root.value, { opacity: 0, scale: 0.85 }, { duration: 0.18 });
  }
  await moveCard({ cardId: props.card._id, zone });
}

function giveControl(to: Id<"players">) {
  menuOpen.value = false;
  setController({ cardId: props.card._id, controllerId: to });
}

async function confirmRemove() {
  // Two taps: a destructive action shouldn't be reachable by the same mistap
  // it exists to correct.
  if (!confirmingRemove.value) {
    confirmingRemove.value = true;
    return;
  }
  menuOpen.value = false;
  confirmingRemove.value = false;
  if (root.value) {
    await animate(root.value, { opacity: 0, scale: 0.85 }, { duration: 0.18 });
  }
  await removeCard({ cardId: props.card._id });
}

function bumpCounter(type: string, delta: number) {
  const current = props.card.counters;
  const existing = current.find((c) => c.type === type);
  const next = existing
    ? current.map((c) =>
        c.type === type ? { ...c, count: c.count + delta } : c,
      )
    : [...current, { type, count: delta }];
  updateCounters({ cardId: props.card._id, counters: next });
}
</script>

<template>
  <div class="relative">
    <button
      ref="root"
      type="button"
      class="no-touch-callout relative block w-full origin-center overflow-hidden rounded-lg border border-board-edge bg-board-panel shadow-lg"
      style="aspect-ratio: 63 / 88"
      @click="onTap"
      @pointerdown="startPress"
      @pointerup="endPress"
      @pointerleave="endPress"
      @contextmenu.prevent
    >
      <img
        v-if="card.imageUrl"
        :src="card.imageUrl"
        :alt="card.name"
        class="h-full w-full object-cover"
        draggable="false"
      />
      <!-- Placeholder until the Scryfall backfill lands. -->
      <span
        v-else
        class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 p-2 text-center text-[10px] leading-tight text-zinc-400"
      >
        {{ card.name }}
      </span>

      <span
        v-if="card.counters.length"
        class="absolute bottom-1 left-1 right-1 flex flex-wrap gap-1"
      >
        <span
          v-for="counter in card.counters"
          :key="counter.type"
          class="rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-board-accent"
        >
          {{ counter.type }} {{ counter.count > 0 ? '+' : '' }}{{ counter.count }}
        </span>
      </span>
    </button>

    <!-- Long-press menu -->
    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="fixed inset-0 z-50 flex items-end bg-black/60"
        @click.self="menuOpen = false"
      >
        <div
          class="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl border-t border-board-edge bg-board-panel p-4 pb-8 sm:mx-auto sm:mb-8 sm:max-w-md sm:rounded-2xl sm:border"
        >
          <!-- Readable preview: big enough to read rules text in the sheet,
               tappable for a full-screen look. -->
          <div class="mb-4 flex gap-3">
            <button
              type="button"
              class="relative w-28 shrink-0 overflow-hidden rounded-lg border border-board-edge bg-board-bg sm:w-32"
              style="aspect-ratio: 63 / 88"
              :disabled="!card.imageUrl"
              @click="openZoom"
            >
              <img
                v-if="readableImage"
                :src="readableImage"
                :alt="card.name"
                class="h-full w-full object-cover"
                @error="highResFailed = true"
              />
              <span
                v-else
                class="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-zinc-500"
              >
                {{ card.name }}
              </span>
              <span
                v-if="card.imageUrl"
                class="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-[10px] text-zinc-300"
              >
                ⤢ Tap to enlarge
              </span>
            </button>

            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold leading-snug">{{ card.name }}</p>
              <p v-if="card.typeLine" class="mt-1 text-[11px] text-zinc-500">
                {{ card.typeLine }}
              </p>
              <p class="mt-2 text-[11px] text-zinc-600">
                {{ card.tapped ? 'Tapped' : 'Untapped' }} · {{ card.zone }}
              </p>
            </div>
          </div>

          <p class="mb-2 text-xs uppercase tracking-wide text-zinc-500">
            Move to
          </p>
          <div class="mb-5 grid grid-cols-3 gap-2">
            <button
              v-for="zone in ZONES"
              :key="zone.id"
              class="rounded-lg border px-2 py-2.5 text-xs transition-colors"
              :class="
                card.zone === zone.id
                  ? 'border-board-accent text-board-accent'
                  : 'border-board-edge text-zinc-400'
              "
              @click="moveTo(zone.id)"
            >
              {{ zone.label }}
            </button>
          </div>

          <p class="mb-2 text-xs uppercase tracking-wide text-zinc-500">
            Counters
          </p>
          <div class="mb-5 flex flex-wrap gap-2">
            <button
              v-for="type in ['+1/+1', '-1/-1', 'loyalty', 'charge']"
              :key="type"
              class="flex items-center gap-2 rounded-lg border border-board-edge px-3 py-2 text-xs text-zinc-300"
            >
              <span
                class="px-1 text-base leading-none text-zinc-500"
                @click.stop="bumpCounter(type, -1)"
                >−</span
              >
              {{ type }}
              <span
                class="px-1 text-base leading-none text-board-accent"
                @click.stop="bumpCounter(type, 1)"
                >+</span
              >
            </button>
          </div>

          <p class="mb-2 text-xs uppercase tracking-wide text-zinc-500">
            Give control to
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="player in players"
              :key="player._id"
              class="rounded-lg border px-3 py-2.5 text-xs transition-colors"
              :class="
                card.controllerId === player._id
                  ? 'border-board-accent text-board-accent'
                  : 'border-board-edge text-zinc-400'
              "
              @click="giveControl(player._id)"
            >
              {{ player.name }}
            </button>
          </div>

          <div class="mt-5 border-t border-board-edge pt-4">
            <button
              class="w-full rounded-xl border py-3 text-sm transition-colors"
              :class="
                confirmingRemove
                  ? 'border-red-500 bg-red-500/15 text-red-300'
                  : 'border-red-500/40 text-red-400/90'
              "
              @click="confirmRemove"
            >
              {{
                confirmingRemove
                  ? 'Tap again to remove permanently'
                  : 'Remove card from game'
              }}
            </button>
            <p v-if="confirmingRemove" class="mt-2 text-center text-[11px] text-zinc-500">
              Undo will bring it back.
            </p>
          </div>

          <button
            class="mt-3 w-full rounded-xl border border-board-edge py-3 text-sm text-zinc-400"
            @click="menuOpen = false"
          >
            Close
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Full-screen reader. Sits above the action sheet so dismissing it
         returns you to the menu rather than the board. -->
    <Teleport to="body">
      <div
        v-if="zoomed"
        class="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4"
        @click="zoomed = false"
      >
        <img
          ref="zoomEl"
          :src="readableImage"
          :alt="card.name"
          class="max-h-full w-auto max-w-full rounded-xl object-contain shadow-2xl"
          @error="highResFailed = true"
        />

        <!-- State the art can't show: counters and whether it's tapped. -->
        <div
          class="absolute inset-x-0 bottom-5 flex flex-wrap items-center justify-center gap-2 px-4"
        >
          <span
            v-if="card.tapped"
            class="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] text-amber-300"
          >
            Tapped
          </span>
          <span
            v-for="counter in card.counters"
            :key="counter.type"
            class="rounded-full bg-board-accent/15 px-2.5 py-1 text-[11px] text-board-accent"
          >
            {{ counter.type }} {{ counter.count > 0 ? '+' : '' }}{{ counter.count }}
          </span>
          <span class="w-full text-center text-[11px] text-zinc-500">
            Tap anywhere to close
          </span>
        </div>
      </div>
    </Teleport>
  </div>
</template>
