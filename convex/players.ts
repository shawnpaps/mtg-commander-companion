import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { writeLog } from "./undo";

export const updateLife = mutation({
  args: { playerId: v.id("players"), delta: v.number() },
  handler: async (ctx, { playerId, delta }) => {
    const player = await ctx.db.get(playerId);
    if (!player) throw new Error("Player not found");

    await ctx.db.patch(playerId, { life: player.life + delta });
    await writeLog(ctx, {
      gameId: player.gameId,
      actorId: playerId,
      action: "life.changed",
      payload: { delta, to: player.life + delta, name: player.name },
      inverse: { kind: "patchPlayer", playerId, patch: { life: player.life } },
    });
  },
});

export const setPoison = mutation({
  args: { playerId: v.id("players"), amount: v.number() },
  handler: async (ctx, { playerId, amount }) => {
    const player = await ctx.db.get(playerId);
    if (!player) throw new Error("Player not found");

    await ctx.db.patch(playerId, { poison: Math.max(0, amount) });
    await writeLog(ctx, {
      gameId: player.gameId,
      actorId: playerId,
      action: "poison.changed",
      payload: { to: Math.max(0, amount), name: player.name },
      inverse: {
        kind: "patchPlayer",
        playerId,
        patch: { poison: player.poison },
      },
    });
  },
});

/**
 * Set the running commander damage `fromPlayerId` has dealt to `playerId`.
 * Life is not deducted here — the life counter stays the single source of truth
 * for totals, so the two can't double-count.
 */
export const setCommanderDmg = mutation({
  args: {
    playerId: v.id("players"),
    fromPlayerId: v.id("players"),
    amount: v.number(),
  },
  handler: async (ctx, { playerId, fromPlayerId, amount }) => {
    const player = await ctx.db.get(playerId);
    if (!player) throw new Error("Player not found");

    const prior = player.commanderDmg;
    const next = prior.some((e) => e.fromPlayerId === fromPlayerId)
      ? prior.map((e) =>
          e.fromPlayerId === fromPlayerId
            ? { ...e, amount: Math.max(0, amount) }
            : e,
        )
      : [...prior, { fromPlayerId, amount: Math.max(0, amount) }];

    await ctx.db.patch(playerId, { commanderDmg: next });
    await writeLog(ctx, {
      gameId: player.gameId,
      actorId: fromPlayerId,
      action: "commanderDmg.set",
      payload: { playerId, fromPlayerId, amount: Math.max(0, amount) },
      inverse: {
        kind: "patchPlayer",
        playerId,
        patch: { commanderDmg: prior },
      },
    });
  },
});

export const setConnected = mutation({
  args: { playerId: v.id("players"), connected: v.boolean() },
  handler: async (ctx, { playerId, connected }) => {
    await ctx.db.patch(playerId, { connected });
  },
});
