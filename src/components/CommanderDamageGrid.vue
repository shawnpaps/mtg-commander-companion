<script setup lang="ts">
import { api } from "@convex/_generated/api";
import { useMutation } from "../lib/useConvex";
import type { Doc, Id } from "@convex/_generated/dataModel";

const props = defineProps<{ players: Doc<"players">[] }>();

const setCommanderDmg = useMutation(api.players.setCommanderDmg);

/** Damage dealt to `to` by `from`. */
function damage(to: Doc<"players">, from: Id<"players">) {
  return to.commanderDmg.find((d) => d.fromPlayerId === from)?.amount ?? 0;
}

function bump(to: Doc<"players">, from: Id<"players">, delta: number) {
  setCommanderDmg({
    playerId: to._id,
    fromPlayerId: from,
    amount: Math.max(0, damage(to, from) + delta),
  });
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-max border-separate border-spacing-1 text-center">
      <thead>
        <tr>
          <th class="px-2 text-left text-[10px] uppercase text-zinc-600">
            dealt to ↓ / by →
          </th>
          <th
            v-for="from in players"
            :key="from._id"
            class="max-w-16 truncate px-2 text-[11px] font-medium text-zinc-400"
          >
            {{ from.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="to in players" :key="to._id">
          <th
            class="max-w-20 truncate px-2 text-left text-[11px] font-medium text-zinc-400"
          >
            {{ to.name }}
          </th>
          <td v-for="from in players" :key="from._id">
            <!-- A commander deals no damage to its own controller. -->
            <span
              v-if="from._id === to._id"
              class="block rounded-lg bg-board-panel/50 py-2 text-zinc-700"
              >—</span
            >
            <button
              v-else
              class="block w-full rounded-lg border py-2 text-sm tabular-nums transition-colors"
              :class="
                damage(to, from._id) >= 21
                  ? 'border-red-500/60 bg-red-500/10 text-red-400'
                  : damage(to, from._id) > 0
                    ? 'border-board-edge bg-board-panel text-zinc-200'
                    : 'border-board-edge/60 bg-board-panel/40 text-zinc-600'
              "
              @click="bump(to, from._id, 1)"
              @contextmenu.prevent="bump(to, from._id, -1)"
            >
              {{ damage(to, from._id) }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="mt-2 px-1 text-[10px] text-zinc-600">
      Tap to add 1, long-press / right-click to subtract. 21 turns red.
    </p>
  </div>
</template>
