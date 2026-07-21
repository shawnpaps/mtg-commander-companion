import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Reverse-chronological live feed. Undone entries are filtered out at the index,
 * so an undo silently drops the action from the log UI.
 */
export const getLog = query({
  args: { gameId: v.id("games"), limit: v.optional(v.number()) },
  handler: async (ctx, { gameId, limit }) => {
    return await ctx.db
      .query("gameLog")
      .withIndex("by_game_active", (q) =>
        q.eq("gameId", gameId).eq("undone", false),
      )
      .order("desc")
      .take(limit ?? 50);
  },
});
