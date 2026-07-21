import {
  mutation,
  internalMutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { zoneValidator } from "./schema";
import { writeLog } from "./undo";

const counterValidator = v.array(
  v.object({ type: v.string(), count: v.number() }),
);

/** Pull the best available art for a cached Scryfall record. */
function pickImage(imageUris: unknown): string | undefined {
  if (!imageUris || typeof imageUris !== "object") return undefined;
  const uris = imageUris as Record<string, string>;
  return uris.normal ?? uris.large ?? uris.small ?? uris.png ?? undefined;
}

type CardFacts = { name: string; imageUrl?: string; typeLine?: string };

/**
 * Resolve display data for a Scryfall id from the cache. Returns placeholders on
 * a miss — the caller schedules a backfill rather than blocking the game on it.
 */
async function factsFor(
  ctx: { db: MutationCtx["db"] },
  scryfallId: string,
): Promise<{ facts: CardFacts; cached: boolean }> {
  const row = await ctx.db
    .query("cardCache")
    .withIndex("by_scryfall", (q) => q.eq("scryfallId", scryfallId))
    .unique();

  if (!row) return { facts: { name: "Unknown Card" }, cached: false };

  const oracle = (row.oracleData ?? {}) as { type_line?: string };
  return {
    facts: {
      name: row.name,
      imageUrl: pickImage(row.imageUris),
      typeLine: oracle.type_line,
    },
    cached: true,
  };
}

/**
 * Put a card onto the battlefield. If the cache hasn't been seeded yet we still
 * create the card with placeholder text and schedule a lazy Scryfall fetch to
 * fill in the name, art and type — the game never blocks on the cache.
 */
export const castCard = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    scryfallId: v.string(),
  },
  handler: async (ctx, { gameId, playerId, scryfallId }) => {
    const { facts, cached } = await factsFor(ctx, scryfallId);

    const siblings = await ctx.db
      .query("cards")
      .withIndex("by_game_controller", (q) =>
        q.eq("gameId", gameId).eq("controllerId", playerId),
      )
      .collect();

    const cardId = await ctx.db.insert("cards", {
      gameId,
      ownerId: playerId,
      controllerId: playerId,
      scryfallId,
      name: facts.name,
      imageUrl: facts.imageUrl,
      typeLine: facts.typeLine,
      zone: "battlefield",
      tapped: false,
      flipped: false,
      counters: [],
      position: siblings.length,
    });

    if (!cached) {
      await ctx.scheduler.runAfter(0, internal.scryfall.backfillCard, {
        scryfallId,
        cardId,
      });
    }

    await writeLog(ctx, {
      gameId,
      actorId: playerId,
      action: "card.cast",
      payload: { cardId, name: facts.name },
      inverse: { kind: "deleteCard", cardId },
    });

    return cardId;
  },
});

/**
 * Assign this player's commander. The commander lives as a real card in the
 * command zone so it can be cast, tapped and moved like anything else; the
 * player row just keeps a pointer to it. Re-assigning replaces the previous
 * commander card outright.
 */
export const setCommander = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    scryfallId: v.string(),
  },
  handler: async (ctx, { gameId, playerId, scryfallId }) => {
    const player = await ctx.db.get(playerId);
    if (!player) throw new Error("Player not found");

    if (player.commanderCardId) {
      const previous = await ctx.db.get(player.commanderCardId);
      if (previous) await ctx.db.delete(player.commanderCardId);
    }

    const { facts, cached } = await factsFor(ctx, scryfallId);

    const cardId = await ctx.db.insert("cards", {
      gameId,
      ownerId: playerId,
      controllerId: playerId,
      scryfallId,
      name: facts.name,
      imageUrl: facts.imageUrl,
      typeLine: facts.typeLine,
      zone: "command",
      tapped: false,
      flipped: false,
      counters: [],
      position: 0,
    });
    await ctx.db.patch(playerId, { commanderCardId: cardId });

    if (!cached) {
      await ctx.scheduler.runAfter(0, internal.scryfall.backfillCard, {
        scryfallId,
        cardId,
      });
    }

    await writeLog(ctx, {
      gameId,
      actorId: playerId,
      action: "commander.set",
      payload: { cardId, name: facts.name },
      // Undoing a commander choice would strand the pointer; pick again instead.
      inverse: null,
    });

    return cardId;
  },
});

export const moveCard = mutation({
  args: { cardId: v.id("cards"), zone: zoneValidator },
  handler: async (ctx, { cardId, zone }) => {
    const card = await ctx.db.get(cardId);
    if (!card) throw new Error("Card not found");

    const destination = await ctx.db
      .query("cards")
      .withIndex("by_game_controller", (q) =>
        q.eq("gameId", card.gameId).eq("controllerId", card.controllerId),
      )
      .collect();
    const position = destination.filter((c) => c.zone === zone).length;

    await ctx.db.patch(cardId, {
      zone,
      position,
      // Leaving the battlefield resets board-only state.
      ...(zone === "battlefield" ? {} : { tapped: false }),
    });

    await writeLog(ctx, {
      gameId: card.gameId,
      actorId: card.controllerId,
      action: "card.moved",
      payload: { cardId, name: card.name, from: card.zone, to: zone },
      inverse: {
        kind: "patchCard",
        cardId,
        patch: {
          zone: card.zone,
          position: card.position,
          tapped: card.tapped,
        },
      },
    });
  },
});

export const toggleTap = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, { cardId }) => {
    const card = await ctx.db.get(cardId);
    if (!card) throw new Error("Card not found");

    await ctx.db.patch(cardId, { tapped: !card.tapped });
    await writeLog(ctx, {
      gameId: card.gameId,
      actorId: card.controllerId,
      action: card.tapped ? "card.untapped" : "card.tapped",
      payload: { cardId, name: card.name },
      inverse: { kind: "patchCard", cardId, patch: { tapped: card.tapped } },
    });
  },
});

export const toggleFlip = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, { cardId }) => {
    const card = await ctx.db.get(cardId);
    if (!card) throw new Error("Card not found");

    await ctx.db.patch(cardId, { flipped: !card.flipped });
    await writeLog(ctx, {
      gameId: card.gameId,
      actorId: card.controllerId,
      action: "card.flipped",
      payload: { cardId, name: card.name },
      inverse: { kind: "patchCard", cardId, patch: { flipped: card.flipped } },
    });
  },
});

/** Mind Control and friends: control moves, ownership does not. */
export const setController = mutation({
  args: { cardId: v.id("cards"), controllerId: v.id("players") },
  handler: async (ctx, { cardId, controllerId }) => {
    const card = await ctx.db.get(cardId);
    if (!card) throw new Error("Card not found");

    await ctx.db.patch(cardId, { controllerId });
    await writeLog(ctx, {
      gameId: card.gameId,
      actorId: controllerId,
      action: "card.controlChanged",
      payload: { cardId, name: card.name, from: card.controllerId, to: controllerId },
      inverse: {
        kind: "patchCard",
        cardId,
        patch: { controllerId: card.controllerId },
      },
    });
  },
});

export const updateCounters = mutation({
  args: { cardId: v.id("cards"), counters: counterValidator },
  handler: async (ctx, { cardId, counters }) => {
    const card = await ctx.db.get(cardId);
    if (!card) throw new Error("Card not found");

    const cleaned = counters.filter((c) => c.count !== 0);
    await ctx.db.patch(cardId, { counters: cleaned });
    await writeLog(ctx, {
      gameId: card.gameId,
      actorId: card.controllerId,
      action: "card.counters",
      payload: { cardId, name: card.name, counters: cleaned },
      inverse: {
        kind: "patchCard",
        cardId,
        patch: { counters: card.counters },
      },
    });
  },
});

/** Fills in name/art/type once a lazy Scryfall fetch resolves. */
export const applyCardData = internalMutation({
  args: {
    cardId: v.id("cards"),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    typeLine: v.optional(v.string()),
  },
  handler: async (ctx, { cardId, name, imageUrl, typeLine }) => {
    const card = await ctx.db.get(cardId);
    if (!card) return;
    await ctx.db.patch(cardId, { name, imageUrl, typeLine });
  },
});

export const getPlayerBoard = query({
  args: { gameId: v.id("games"), controllerId: v.id("players") },
  handler: async (ctx, { gameId, controllerId }) => {
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_game_controller", (q) =>
        q.eq("gameId", gameId).eq("controllerId", controllerId),
      )
      .collect();
    return cards.sort((a, b) => a.position - b.position);
  },
});
