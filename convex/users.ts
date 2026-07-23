import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Resolve the caller's users row, or null when signed out. Never throws — the
 * whole app is playable anonymously, so "no account" is an ordinary state and
 * not an error.
 */
export async function currentUserId(
  ctx: QueryCtx,
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  return user?._id ?? null;
}

/** Same as `currentUserId`, but for paths that genuinely require an account. */
export async function requireUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await currentUserId(ctx);
  if (!userId) throw new Error("Sign in to do that.");
  return userId;
}

/**
 * Upsert the caller's users row from their Clerk identity and claim the device
 * session for them. Called on every load while signed in, so a returning user
 * lands back on the same account and profile changes in Clerk propagate.
 */
export const syncUser = mutation({
  args: { sessionId: v.optional(v.id("sessions")) },
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const now = Date.now();
    const displayName =
      identity.name ?? identity.nickname ?? identity.email ?? undefined;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    let userId: Id<"users">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: now,
        ...(displayName ? { displayName } : {}),
        ...(identity.pictureUrl ? { imageUrl: identity.pictureUrl } : {}),
      });
      userId = existing._id;
    } else {
      userId = await ctx.db.insert("users", {
        clerkUserId: identity.subject,
        displayName,
        imageUrl: identity.pictureUrl,
        createdAt: now,
        lastSeen: now,
      });
    }

    if (sessionId) {
      const session = await ctx.db.get(sessionId);
      if (session && session.userId !== userId) {
        await ctx.db.patch(sessionId, { userId });
      }
    }

    return { userId, displayName };
  },
});

/**
 * Drop the account link from a device session on sign-out. The session row and
 * any seat it holds survive, so signing out mid-game doesn't eject the player.
 */
export const unlinkSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (session?.userId) await ctx.db.patch(sessionId, { userId: undefined });
  },
});

/** The signed-in user's profile plus their lifetime record. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const participations = await ctx.db
      .query("gameParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const wins = participations.filter((p) => p.won).length;
    return {
      user,
      record: {
        wins,
        losses: participations.length - wins,
        games: participations.length,
      },
    };
  },
});

/**
 * Most recent finished games for the signed-in user, newest first, plus a
 * per-deck breakdown for the profile screen.
 */
export const myHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await currentUserId(ctx);
    if (!userId) return null;

    const recent = await ctx.db
      .query("gameParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 25);

    const results = await Promise.all(
      recent.map(async (p) => {
        const result = await ctx.db.get(p.resultId);
        return {
          ...p,
          code: result?.code ?? null,
          winnerName: result?.winnerName ?? null,
          turnCount: result?.turnCount ?? null,
          opponentCount: (result?.playerCount ?? 1) - 1,
        };
      }),
    );

    return results;
  },
});

/** Win/loss split per saved deck, so a user can see which deck actually wins. */
export const myDeckRecords = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (!userId) return null;

    const participations = await ctx.db
      .query("gameParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const byDeck = new Map<string, { wins: number; losses: number }>();
    for (const p of participations) {
      if (!p.deckId) continue;
      const row = byDeck.get(p.deckId) ?? { wins: 0, losses: 0 };
      if (p.won) row.wins += 1;
      else row.losses += 1;
      byDeck.set(p.deckId, row);
    }

    return Object.fromEntries(byDeck);
  },
});
