import { ref, watch } from "vue";
import { useAuth } from "@clerk/vue";
import { convex } from "./convex";
import { api } from "@convex/_generated/api";
import { sessionId } from "./session";
import type { Id } from "@convex/_generated/dataModel";

/**
 * Module-level mirrors of Clerk state, so any component can read auth without
 * having to be inside a `setup()` that calls a Clerk composable.
 */
export const clerkLoaded = ref(false);
export const isSignedIn = ref(false);
export const accountUserId = ref<Id<"users"> | null>(null);

// True once Convex has accepted a Clerk token. Writes that need an account
// should wait for this rather than for `isSignedIn`, which flips first.
export const convexAuthenticated = ref(false);

let syncing = false;

/**
 * Upsert the users row and claim this device for the account. Runs whenever
 * both halves are ready — Convex has authenticated *and* the anonymous session
 * exists — because the two resolve independently and either can win the race.
 */
async function syncUser() {
  if (syncing || !convexAuthenticated.value || !sessionId.value) return;
  syncing = true;
  try {
    const result = await convex.mutation(api.users.syncUser, {
      sessionId: sessionId.value,
    });
    accountUserId.value = result?.userId ?? null;
  } finally {
    syncing = false;
  }
}

/**
 * Bridge Clerk's session into the Convex client. Call once, from the root
 * component's `setup`.
 *
 * Convex validates the JWT itself, so it needs a token minted from the Clerk
 * JWT template named "convex" rather than the default session token.
 */
export function useClerkConvexBridge() {
  const { isLoaded, isSignedIn: signedIn, getToken } = useAuth();

  watch(
    [isLoaded, signedIn],
    ([loaded, signed]) => {
      clerkLoaded.value = !!loaded;
      if (!loaded) return;

      if (signed) {
        isSignedIn.value = true;
        convex.setAuth(
          async ({ forceRefreshToken }) => {
            const token = await getToken.value?.({
              template: "convex",
              skipCache: forceRefreshToken,
            });
            return token ?? null;
          },
          (authenticated) => {
            convexAuthenticated.value = authenticated;
            if (authenticated) void syncUser();
          },
        );
        return;
      }

      // Signed out: drop the token, then release the device session so it goes
      // back to being anonymous. The session row and its seat survive, so
      // signing out mid-game doesn't eject the player from the table.
      //
      // `ConvexClient` has no `clearAuth`; a fetcher that resolves to null is
      // how you tell it the token is gone.
      isSignedIn.value = false;
      convexAuthenticated.value = false;
      convex.setAuth(async () => null);

      const previous = accountUserId.value;
      accountUserId.value = null;
      if (previous && sessionId.value) {
        void convex.mutation(api.users.unlinkSession, {
          sessionId: sessionId.value,
        });
      }
    },
    { immediate: true },
  );

  // The anonymous session is minted in parallel with Clerk loading, so re-run
  // the sync if it lands after authentication.
  watch(sessionId, () => void syncUser());
}
