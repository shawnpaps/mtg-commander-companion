import { ref, watch } from "vue";
import type { Id } from "@convex/_generated/dataModel";

const TOURNAMENT_KEY = "boardstate.draftTournamentId";
const VIEW_KEY = "boardstate.draftView";

/**
 * Draft navigation, kept apart from the Commander store on purpose — the two
 * features share a shell and nothing else.
 *
 * Both refs persist, so closing the tab mid-event is a non-event: the view you
 * were on and the tournament you were running both come back. The tournament
 * itself was never at risk — roster, pairings and results live in Convex — but
 * landing back on the lobby every refresh made it feel like it was.
 */
export type DraftView = "none" | "setup" | "join" | "tournament";

const VIEWS: DraftView[] = ["none", "setup", "join", "tournament"];

function storedView(): DraftView {
  const raw = localStorage.getItem(VIEW_KEY);
  return VIEWS.includes(raw as DraftView) ? (raw as DraftView) : "none";
}

export const draftView = ref<DraftView>(storedView());

/** The event this device is running or watching. */
export const draftTournamentId = ref<Id<"draftTournaments"> | null>(
  localStorage.getItem(TOURNAMENT_KEY) as Id<"draftTournaments"> | null,
);

watch(draftView, (value) => {
  if (value === "none") localStorage.removeItem(VIEW_KEY);
  else localStorage.setItem(VIEW_KEY, value);
});

watch(draftTournamentId, (value) => {
  if (value) localStorage.setItem(TOURNAMENT_KEY, value);
  else localStorage.removeItem(TOURNAMENT_KEY);
});

// A persisted "tournament" view with no tournament to show would strand the
// app on a blank screen, so reconcile the two on load.
if (draftView.value === "tournament" && !draftTournamentId.value) {
  draftView.value = "none";
}

export function openDraftSetup() {
  draftView.value = "setup";
}

export function openDraftJoin() {
  draftView.value = "join";
}

export function openDraftTournament(id: Id<"draftTournaments">) {
  draftTournamentId.value = id;
  draftView.value = "tournament";
}

export function closeDraft() {
  draftView.value = "none";
}

export function forgetDraft() {
  draftTournamentId.value = null;
  draftView.value = "none";
}
