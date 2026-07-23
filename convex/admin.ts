import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Maintenance helpers. Everything here is `internal`, so none of it is reachable
 * from the browser — only via `npx convex run` or the dashboard.
 */

/** Summarize a game before deleting it, so a cleanup can be eyeballed first. */
export const inspectGame = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!game) return null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const log = await ctx.db
      .query("gameLog")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    return {
      code: game.code,
      status: game.status,
      createdAt: new Date(game.createdAt).toISOString(),
      players: players.map((p) => p.name),
      cards: cards.length,
      logEntries: log.length,
    };
  },
});

/**
 * Delete a game and everything hanging off it. Also removes any session left
 * with no players in any game, which is how test sessions get cleaned up
 * without touching a real device that simply hasn't joined a table yet.
 */
export const deleteGame = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!game) return { deleted: false, reason: "not found" };

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const log = await ctx.db
      .query("gameLog")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const votes = await ctx.db
      .query("winnerVotes")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const results = await ctx.db
      .query("gameResults")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    for (const card of cards) await ctx.db.delete(card._id);
    for (const entry of log) await ctx.db.delete(entry._id);
    for (const vote of votes) await ctx.db.delete(vote._id);
    // Dropping participants removes this game from every player's W/L record,
    // which is the point: a deleted game shouldn't still count against anyone.
    for (const row of participants) await ctx.db.delete(row._id);
    for (const row of results) await ctx.db.delete(row._id);

    const sessionIds = new Set(players.map((p) => p.sessionId));
    sessionIds.add(game.hostSessionId);
    for (const player of players) await ctx.db.delete(player._id);
    await ctx.db.delete(game._id);

    let sessionsRemoved = 0;
    for (const sessionId of sessionIds) {
      const stillSeated = await ctx.db
        .query("players")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .first();
      if (stillSeated) continue;
      const session = await ctx.db.get(sessionId);
      if (session) {
        await ctx.db.delete(sessionId);
        sessionsRemoved++;
      }
    }

    return {
      deleted: true,
      code: game.code,
      players: players.length,
      cards: cards.length,
      logEntries: log.length,
      votes: votes.length,
      participants: participants.length,
      results: results.length,
      sessionsRemoved,
    };
  },
});
