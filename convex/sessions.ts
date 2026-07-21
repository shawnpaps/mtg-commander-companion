import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Upsert the anonymous device session. Called on every app load with the token
 * persisted in localStorage, so a refresh lands back on the same identity.
 */
export const getOrCreateSession = mutation({
  args: { token: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, { token, name }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: now,
        ...(name ? { name } : {}),
      });
      return { sessionId: existing._id, name: name ?? existing.name };
    }

    const sessionId = await ctx.db.insert("sessions", {
      token,
      name,
      createdAt: now,
      lastSeen: now,
    });
    return { sessionId, name };
  },
});
