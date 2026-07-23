import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { deckSourceValidator } from "./schema";
import { currentUserId, requireUserId } from "./users";
import type { Id } from "./_generated/dataModel";

const deckCardValidator = v.array(
  v.object({
    name: v.string(),
    quantity: v.number(),
    scryfallId: v.optional(v.string()),
    category: v.optional(v.string()),
  }),
);

/**
 * Pull the numeric deck id out of any Archidekt URL shape:
 * `archidekt.com/decks/123456/some-slug`, `/decks/123456`, or a bare id.
 */
export function parseArchidektId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/archidekt\.com\/(?:api\/)?decks\/(\d+)/i);
  return match ? match[1] : null;
}

export const listMyDecks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("decks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getDeck = query({
  args: { deckId: v.id("decks") },
  handler: async (ctx, { deckId }) => {
    const userId = await currentUserId(ctx);
    if (!userId) return null;

    const deck = await ctx.db.get(deckId);
    // Decks are private to their owner — there's no sharing surface yet, so a
    // mismatched owner is treated as "not found" rather than an error.
    return deck && deck.userId === userId ? deck : null;
  },
});

/**
 * Save a deck the user typed in, or a link to a deck on a site we can't import
 * from. Moxfield lands here: their API requires an approved partnership, so we
 * keep the URL and let the user name the deck and its commander.
 */
export const saveDeck = mutation({
  args: {
    name: v.string(),
    source: deckSourceValidator,
    sourceUrl: v.optional(v.string()),
    commanderName: v.optional(v.string()),
    cards: v.optional(deckCardValidator),
  },
  handler: async (ctx, { name, source, sourceUrl, commanderName, cards }) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    return await ctx.db.insert("decks", {
      userId,
      name: name.trim(),
      source,
      sourceUrl,
      commanderName: commanderName?.trim() || undefined,
      cards,
      cardCount: cards?.reduce((sum, card) => sum + card.quantity, 0),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteDeck = mutation({
  args: { deckId: v.id("decks") },
  handler: async (ctx, { deckId }) => {
    const userId = await requireUserId(ctx);
    const deck = await ctx.db.get(deckId);
    if (!deck || deck.userId !== userId) throw new Error("Deck not found.");
    await ctx.db.delete(deckId);
  },
});

/**
 * Attach one of the signed-in user's decks to their seat, so the result written
 * at end of game records which deck actually played.
 */
export const setPlayerDeck = mutation({
  args: {
    playerId: v.id("players"),
    deckId: v.optional(v.id("decks")),
  },
  handler: async (ctx, { playerId, deckId }) => {
    const userId = await requireUserId(ctx);
    const player = await ctx.db.get(playerId);
    if (!player) throw new Error("Seat not found.");

    if (deckId) {
      const deck = await ctx.db.get(deckId);
      if (!deck || deck.userId !== userId) throw new Error("Deck not found.");
    }
    await ctx.db.patch(playerId, { deckId });
  },
});

type ArchidektCard = {
  quantity?: number;
  categories?: string[];
  card?: {
    uid?: string;
    oracleCard?: { name?: string; colorIdentity?: string[] };
  };
};

/**
 * Import a deck from Archidekt. Runs as an action because it reaches the public
 * internet; the browser can't call Archidekt directly (no CORS headers), so the
 * fetch has to happen server-side.
 */
export const importFromArchidekt = action({
  args: { url: v.string() },
  handler: async (ctx, { url }): Promise<{ deckId: Id<"decks"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in to import a deck.");

    const deckId = parseArchidektId(url);
    if (!deckId) {
      throw new Error(
        "That doesn't look like an Archidekt deck URL. Expected something like archidekt.com/decks/123456.",
      );
    }

    const response = await fetch(
      `https://archidekt.com/api/decks/${deckId}/`,
      {
        headers: {
          "User-Agent": "BoardState/0.1 (MTG companion app)",
          Accept: "application/json",
        },
      },
    );

    if (response.status === 404) {
      throw new Error("No Archidekt deck with that id, or it's private.");
    }
    if (!response.ok) {
      throw new Error(`Archidekt returned ${response.status}.`);
    }

    const data = (await response.json()) as {
      name?: string;
      cards?: ArchidektCard[];
    };

    const cards = (data.cards ?? [])
      .map((entry) => ({
        name: entry.card?.oracleCard?.name ?? "",
        quantity: entry.quantity ?? 1,
        scryfallId: entry.card?.uid,
        // Archidekt allows many categories per card; the first is the one shown
        // in its UI, and it's what tells us the commander.
        category: entry.categories?.[0],
      }))
      .filter((card) => card.name.length > 0);

    if (cards.length === 0) {
      throw new Error("That Archidekt deck came back empty.");
    }

    const commanderEntry = (data.cards ?? []).find((entry) =>
      entry.categories?.some((c) => c.toLowerCase() === "commander"),
    );

    // Colour identity comes off the commander in Commander; for other formats
    // it's the union across the deck, which is close enough for a badge.
    const colors = Array.from(
      new Set(
        (commanderEntry
          ? [commanderEntry]
          : (data.cards ?? [])
        ).flatMap((entry) => entry.card?.oracleCard?.colorIdentity ?? []),
      ),
    );

    return await ctx.runMutation(internal.decks.storeImportedDeck, {
      clerkUserId: identity.subject,
      name: data.name?.trim() || `Archidekt deck ${deckId}`,
      sourceId: deckId,
      sourceUrl: `https://archidekt.com/decks/${deckId}`,
      commanderName: commanderEntry?.card?.oracleCard?.name,
      commanderScryfallId: commanderEntry?.card?.uid,
      colors,
      cards,
    });
  },
});

/**
 * Persist an imported deck. Internal because the action has already checked the
 * caller's identity — internal mutations carry no auth context of their own, so
 * the Clerk subject is passed explicitly and re-resolved here.
 */
export const storeImportedDeck = internalMutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    sourceId: v.string(),
    sourceUrl: v.string(),
    commanderName: v.optional(v.string()),
    commanderScryfallId: v.optional(v.string()),
    colors: v.array(v.string()),
    cards: deckCardValidator,
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) throw new Error("No account for this session.");

    const now = Date.now();
    const fields = {
      name: args.name,
      source: "archidekt" as const,
      sourceId: args.sourceId,
      sourceUrl: args.sourceUrl,
      commanderName: args.commanderName,
      commanderScryfallId: args.commanderScryfallId,
      colors: args.colors,
      cards: args.cards,
      cardCount: args.cards.reduce((sum, card) => sum + card.quantity, 0),
      updatedAt: now,
    };

    // Re-importing the same Archidekt deck refreshes it in place rather than
    // stacking duplicates, so the user's deck history stays stable.
    const existing = await ctx.db
      .query("decks")
      .withIndex("by_user_source", (q) =>
        q
          .eq("userId", user._id)
          .eq("source", "archidekt")
          .eq("sourceId", args.sourceId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return { deckId: existing._id };
    }

    const deckId = await ctx.db.insert("decks", {
      userId: user._id,
      createdAt: now,
      ...fields,
    });
    return { deckId };
  },
});
