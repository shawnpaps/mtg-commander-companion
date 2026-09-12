import { ref, watch } from "vue";
import type { Id } from "@convex/_generated/dataModel";

const TOURNAMENT_KEY = "boardstate.draftTournamentId";

/**
 * Draft navigation, kept apart from the Commander store on purpose — the two
 * features share a shell and nothing else.
 */
export type DraftView = "none" | "setup";

export const draftView = ref<DraftView>("none");

/**
 * The event this device is running. Persisted like the game code so a refresh
 * lands back on the tournament instead of the lobby.
 */
export const draftTournamentId = ref<Id<"draftTournaments"> | null>(
  localStorage.getItem(TOURNAMENT_KEY) as Id<"draftTournaments"> | null,
);

watch(draftTournamentId, (value) => {
  if (value) localStorage.setItem(TOURNAMENT_KEY, value);
  else localStorage.removeItem(TOURNAMENT_KEY);
});

export function openDraftSetup() {
  draftView.value = "setup";
}

export function closeDraft() {
  draftView.value = "none";
}
