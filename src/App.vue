<script setup lang="ts">
import { onMounted, ref } from "vue";
import LobbyView from "./views/LobbyView.vue";
import GameView from "./views/GameView.vue";
import ProfileView from "./views/ProfileView.vue";
import DraftSetupView from "./views/DraftSetupView.vue";
import DraftTournamentView from "./views/DraftTournamentView.vue";
import { ensureSession, sessionId } from "./lib/session";
import { useClerkConvexBridge } from "./lib/auth";
import { gameCode, showProfile } from "./lib/store";
import { draftView, draftTournamentId } from "./lib/draftStore";

const error = ref<string | null>(null);

// Feeds Clerk's token into the Convex client. Must run in setup, once, above
// anything that reads account state.
useClerkConvexBridge();

onMounted(async () => {
  try {
    await ensureSession();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <main class="min-h-full bg-board-bg text-fg">
    <div
      v-if="error"
      class="flex min-h-screen items-center justify-center p-6 text-center"
    >
      <p class="max-w-sm text-sm text-danger">
        Couldn't reach the backend: {{ error }}
      </p>
    </div>

    <div
      v-else-if="!sessionId"
      class="flex min-h-screen items-center justify-center"
    >
      <p class="animate-pulse text-sm text-fg-muted">Connecting…</p>
    </div>

    <ProfileView v-else-if="showProfile" @close="showProfile = false" />
    <!-- The draft is its own feature, not a game mode: it sits beside the
         table rather than inside it. -->
    <DraftSetupView v-else-if="draftView === 'setup'" />
    <DraftTournamentView
      v-else-if="draftView === 'tournament' && draftTournamentId"
      :tournament-id="draftTournamentId"
    />
    <GameView v-else-if="gameCode" :code="gameCode" />
    <LobbyView v-else />
  </main>
</template>
