import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * The shapes an `inverse` patch can take. Every state-changing mutation records
 * one of these (or `null` when the action is not undoable), and undoLastAction
 * replays it verbatim.
 */
export type InversePatch =
  | { kind: "deleteCard"; cardId: Id<"cards"> }
  | { kind: "patchCard"; cardId: Id<"cards">; patch: Record<string, unknown> }
  | { kind: "patchPlayer"; playerId: Id<"players">; patch: Record<string, unknown> }
  // Undo of a removal. Convex can't resurrect a document id, so this re-inserts
  // the card's fields and gets a fresh id; `commanderOf` re-points the player at
  // it when the removed card was their commander.
  | {
      kind: "restoreCard";
      card: Record<string, unknown>;
      commanderOf?: Id<"players">;
    }
  | null;

export async function applyInverse(ctx: MutationCtx, inverse: InversePatch) {
  if (!inverse) return false;
  switch (inverse.kind) {
    case "deleteCard": {
      const existing = await ctx.db.get(inverse.cardId);
      if (existing) await ctx.db.delete(inverse.cardId);
      return true;
    }
    case "patchCard": {
      const existing = await ctx.db.get(inverse.cardId);
      if (!existing) return false;
      await ctx.db.patch(inverse.cardId, inverse.patch as never);
      return true;
    }
    case "patchPlayer": {
      const existing = await ctx.db.get(inverse.playerId);
      if (!existing) return false;
      await ctx.db.patch(inverse.playerId, inverse.patch as never);
      return true;
    }
    case "restoreCard": {
      const cardId = await ctx.db.insert("cards", inverse.card as never);
      if (inverse.commanderOf) {
        const player = await ctx.db.get(inverse.commanderOf);
        if (player) {
          await ctx.db.patch(inverse.commanderOf, { commanderCardId: cardId });
        }
      }
      return true;
    }
    default:
      return false;
  }
}

/** Append a log entry. Pass `inverse: null` for non-undoable events. */
export async function writeLog(
  ctx: MutationCtx,
  args: {
    gameId: Id<"games">;
    actorId?: Id<"players">;
    action: string;
    payload: unknown;
    inverse: InversePatch;
  },
) {
  return await ctx.db.insert("gameLog", {
    gameId: args.gameId,
    ts: Date.now(),
    actorId: args.actorId,
    action: args.action,
    payload: args.payload ?? {},
    inverse: args.inverse ?? undefined,
    undone: false,
  });
}
