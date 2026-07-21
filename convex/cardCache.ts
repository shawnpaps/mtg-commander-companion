import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Idempotent upsert keyed on scryfallId — the bulk seed and the lazy single-card
 * fetch both land here, so re-running the seed never duplicates rows.
 */
export const upsertMany = internalMutation({
  args: {
    cards: v.array(
      v.object({
        scryfallId: v.string(),
        name: v.string(),
        oracleData: v.any(),
        imageUris: v.any(),
      }),
    ),
  },
  handler: async (ctx, { cards }) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;

    for (const card of cards) {
      const existing = await ctx.db
        .query("cardCache")
        .withIndex("by_scryfall", (q) => q.eq("scryfallId", card.scryfallId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { ...card, updatedAt: now });
        updated++;
      } else {
        await ctx.db.insert("cardCache", { ...card, updatedAt: now });
        inserted++;
      }
    }
    return { inserted, updated };
  },
});

export const getByScryfallId = query({
  args: { scryfallId: v.string() },
  handler: async (ctx, { scryfallId }) => {
    return await ctx.db
      .query("cardCache")
      .withIndex("by_scryfall", (q) => q.eq("scryfallId", scryfallId))
      .unique();
  },
});

export const cacheSize = query({
  args: {},
  handler: async (ctx) => {
    // Bounded probe — enough to tell the UI whether the seed has run at all.
    const sample = await ctx.db.query("cardCache").take(1);
    return { seeded: sample.length > 0 };
  },
});
