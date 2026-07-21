import { ref } from "vue";
import { convex } from "./convex";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const TOKEN_KEY = "boardstate.token";
const NAME_KEY = "boardstate.name";

export const sessionId = ref<Id<"sessions"> | null>(null);
export const displayName = ref<string>(localStorage.getItem(NAME_KEY) ?? "");

/** Mint (or read back) this device's anonymous identity token. */
function getToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing) return existing;

  const token =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

let pending: Promise<Id<"sessions">> | null = null;

/**
 * Resolve this device to a sessions row. Safe to call from anywhere — concurrent
 * callers share one in-flight upsert.
 */
export function ensureSession(): Promise<Id<"sessions">> {
  if (sessionId.value) return Promise.resolve(sessionId.value);
  if (pending) return pending;

  pending = convex
    .mutation(api.sessions.getOrCreateSession, {
      token: getToken(),
      name: displayName.value || undefined,
    })
    .then((result) => {
      sessionId.value = result.sessionId;
      if (result.name) displayName.value = result.name;
      return result.sessionId;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}

export function setDisplayName(name: string) {
  displayName.value = name;
  localStorage.setItem(NAME_KEY, name);
}
