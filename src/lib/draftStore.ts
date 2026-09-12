import { ref, watch } from "vue";
import type { Id } from "@convex/_generated/dataModel";

const TOURNAMENT_KEY = "boardstate.draftTournamentId";

/**
 * Draft navigation, kept apart from the Commander store on purpose — the two
 * features share a shell and nothing else.
 */
export type DraftView = "none" | "setup" | "tournament";

export const draftView = ref<DraftView>("none");

/**
 * The event this device is running, persisted like the game code.
 *
 * Note what this does NOT do: `draftView` above is not persisted, so a refresh
 * resets to "none" and lands on the lobby, where this id surfaces a "Resume
 * your draft" entry. The tournament itself is never at risk — roster, pairings
 * and results all live in Convex — but getting back to it costs a tap.
 *
 * Three known gaps, deliberately left for a follow-up:
 *   - Setup-wizard state is not persisted at all. Refreshing mid-wizard loses
 *     the roster, because no tournament row exists until "Start tournament".
 *   - App.vue checks `gameCode` before the lobby, so an active Commander game
 *     hides the resume entry.
 *   - This id is the only route in. There is no join code, so the event is
 *     reachable from the host device and nowhere else.
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

export function openDraftTournament(id: Id<"draftTournaments">) {
  draftTournamentId.value = id;
  draftView.value = "tournament";
}

export function closeDraft() {
  draftView.value = "none";
}
