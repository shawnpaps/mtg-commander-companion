import { ref, watch } from "vue";
import type { Id } from "@convex/_generated/dataModel";

const CODE_KEY = "boardstate.gameCode";
const PLAYER_KEY = "boardstate.playerId";

/**
 * The only client-held state: which table this device is sitting at. Everything
 * else lives in Convex and arrives through reactive queries.
 */
export const gameCode = ref<string | null>(localStorage.getItem(CODE_KEY));
export const playerId = ref<Id<"players"> | null>(
  localStorage.getItem(PLAYER_KEY) as Id<"players"> | null,
);

export type SubView = "board" | "table" | "vitals";
export const subView = ref<SubView>("board");

// Profile is an overlay rather than a route: it can be opened from the lobby or
// mid-game without tearing down the table subscription underneath it.
export const showProfile = ref(false);

watch(gameCode, (value) => {
  if (value) localStorage.setItem(CODE_KEY, value);
  else localStorage.removeItem(CODE_KEY);
});

watch(playerId, (value) => {
  if (value) localStorage.setItem(PLAYER_KEY, value);
  else localStorage.removeItem(PLAYER_KEY);
});

export function enterGame(code: string, player: Id<"players">) {
  gameCode.value = code.toUpperCase();
  playerId.value = player;
  subView.value = "board";
}

export function leaveGame() {
  gameCode.value = null;
  playerId.value = null;
}
