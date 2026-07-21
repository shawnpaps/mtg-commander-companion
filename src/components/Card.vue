<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { animate } from "motion";
import { api } from "@convex/_generated/api";
import { useMutation } from "../lib/useConvex";
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

const root = ref<HTMLElement | null>(null);
const menuOpen = ref(false);
let pressTimer: ReturnType<typeof setTimeout> | undefined;
let longPressed = false;

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
  if (!props.interactive) return;
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
          <p class="mb-4 truncate text-sm font-semibold">{{ card.name }}</p>

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

          <button
            class="mt-5 w-full rounded-xl border border-board-edge py-3 text-sm text-zinc-400"
            @click="menuOpen = false"
          >
            Close
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
