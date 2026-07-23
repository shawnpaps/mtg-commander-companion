<script setup lang="ts">
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/vue";

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
</script>

<template>
  <div class="flex items-center gap-2">
    <Show when="signed-out">
      <SignInButton mode="modal">
        <button
          class="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100"
        >
          Sign in
        </button>
      </SignInButton>
      <SignUpButton v-if="!compact" mode="modal">
        <button
          class="rounded-lg border border-board-edge bg-board-panel px-3 py-1.5 text-xs font-medium text-board-accent transition-colors hover:border-board-accent"
        >
          Create account
        </button>
      </SignUpButton>
    </Show>

    <Show when="signed-in">
      <UserButton />
    </Show>
  </div>
</template>
