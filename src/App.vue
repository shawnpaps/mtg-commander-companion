<script setup lang="ts">
import { onMounted, ref } from "vue";
import LobbyView from "./views/LobbyView.vue";
import GameView from "./views/GameView.vue";
import { ensureSession, sessionId } from "./lib/session";
import { gameCode } from "./lib/store";

const error = ref<string | null>(null);

onMounted(async () => {
  try {
    await ensureSession();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <main class="min-h-full bg-board-bg text-zinc-100">
    <div
      v-if="error"
      class="flex min-h-screen items-center justify-center p-6 text-center"
    >
      <p class="max-w-sm text-sm text-red-400">
        Couldn't reach the backend: {{ error }}
      </p>
    </div>

    <div
      v-else-if="!sessionId"
      class="flex min-h-screen items-center justify-center"
    >
      <p class="animate-pulse text-sm text-zinc-500">Connecting…</p>
    </div>

    <GameView v-else-if="gameCode" :code="gameCode" />
    <LobbyView v-else />
  </main>
</template>
