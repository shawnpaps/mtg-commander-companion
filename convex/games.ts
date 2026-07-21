import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { formatValidator } from "./schema";
import { applyInverse, writeLog, type InversePatch } from "./undo";

// Ambiguity-free alphabet: no 0/O/1/I.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode() {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function startingLife(format: string) {
  return format === "commander" ? 40 : 20;
}

export const createGame = mutation({
  args: {
    format: formatValidator,
    playerCount: v.number(),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, { format, playerCount, sessionId }) => {
    // Codes are short enough to collide; retry until we find a free one.
    let code = randomCode();
    for (let attempt = 0; attempt < 10; attempt++) {
      const taken = await ctx.db
        .query("games")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!taken) break;
      code = randomCode();
    }

    const gameId = await ctx.db.insert("games", {
      code,
      format,
      status: "lobby",
      playerCount,
      hostSessionId: sessionId,
      turnNumber: 0,
      createdAt: Date.now(),
    });

    await writeLog(ctx, {
      gameId,
      action: "game.created",
      payload: { format, playerCount, code },
      inverse: null,
    });

    return { gameId, code };
  },
});

export const joinGame = mutation({
  args: { code: v.string(), name: v.string(), sessionId: v.id("sessions") },
  handler: async (ctx, { code, name, sessionId }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!game) throw new Error(`No game with code ${code}`);

    // Reconnect path: this device already has a seat at this table.
    const existing = await ctx.db
      .query("players")
      .withIndex("by_game_session", (q) =>
        q.eq("gameId", game._id).eq("sessionId", sessionId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { connected: true, name });
      await writeLog(ctx, {
        gameId: game._id,
        actorId: existing._id,
        action: "player.reconnected",
        payload: { name },
        inverse: null,
      });
      return { gameId: game._id, playerId: existing._id, rejoined: true };
    }

    const seated = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    const playerId = await ctx.db.insert("players", {
      gameId: game._id,
      sessionId,
      name,
      seatIndex: seated.length,
      life: startingLife(game.format),
      poison: 0,
      commanderDmg: [],
      connected: true,
    });

    await writeLog(ctx, {
      gameId: game._id,
      actorId: playerId,
      action: "player.joined",
      payload: { name, seatIndex: seated.length },
      inverse: null,
    });

    return { gameId: game._id, playerId, rejoined: false };
  },
});

export const startGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    const first = players.sort((a, b) => a.seatIndex - b.seatIndex)[0];
    await ctx.db.patch(gameId, {
      status: "active",
      turnNumber: 1,
      turnPlayerId: first?._id,
    });
    await writeLog(ctx, {
      gameId,
      action: "game.started",
      payload: {},
      inverse: null,
    });
  },
});

export const nextTurn = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    const players = (
      await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", gameId))
        .collect()
    ).sort((a, b) => a.seatIndex - b.seatIndex);
    if (players.length === 0) return;

    const current = players.findIndex((p) => p._id === game.turnPlayerId);
    const next = players[(current + 1) % players.length];
    await ctx.db.patch(gameId, {
      turnPlayerId: next._id,
      turnNumber: game.turnNumber + 1,
    });
    await writeLog(ctx, {
      gameId,
      actorId: next._id,
      action: "turn.passed",
      payload: { turnNumber: game.turnNumber + 1 },
      inverse: null,
    });
  },
});

/**
 * Walk back to the newest entry that is still `undone: false` and carries an
 * inverse patch, replay it, and retire the entry. Entries with no inverse
 * (joins, chat, turn passes) are skipped rather than blocking undo.
 */
export const undoLastAction = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const candidates = await ctx.db
      .query("gameLog")
      .withIndex("by_game_active", (q) =>
        q.eq("gameId", gameId).eq("undone", false),
      )
      .order("desc")
      .take(50);

    for (const entry of candidates) {
      const inverse = (entry.inverse ?? null) as InversePatch;
      if (!inverse) continue;
      const applied = await applyInverse(ctx, inverse);
      await ctx.db.patch(entry._id, { undone: true });
      if (applied) return { undone: entry.action };
    }
    return { undone: null };
  },
});

/** Reactive read of the whole table: game + players + cards. */
export const getGame = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!game) return null;

    const players = (
      await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect()
    ).sort((a, b) => a.seatIndex - b.seatIndex);

    const cards = await ctx.db
      .query("cards")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    return { game, players, cards };
  },
});

/** Resolve this device's seat at a table, for restoring state after a refresh. */
export const getMyPlayer = query({
  args: { gameId: v.id("games"), sessionId: v.id("sessions") },
  handler: async (ctx, { gameId, sessionId }) => {
    return await ctx.db
      .query("players")
      .withIndex("by_game_session", (q) =>
        q.eq("gameId", gameId).eq("sessionId", sessionId),
      )
      .unique();
  },
});
