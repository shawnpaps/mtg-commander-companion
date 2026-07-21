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

/** Called by the seed after each batch of pages. */
export const recordSeedProgress = internalMutation({
  args: { processed: v.number(), done: v.boolean() },
  handler: async (ctx, { processed, done }) => {
    const existing = await ctx.db.query("seedState").first();
    const patch = { processed, done, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("seedState", patch);
  },
});

/**
 * Seed status. `processed` is reported by the seed itself rather than counted —
 * cardCache rows are too large to collect() and Convex has no cheap count.
 */
export const seedProgress = query({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db.query("seedState").first();
    // A non-empty cache with no marker means cards arrived via lazy backfill or
    // search rather than a full seed run.
    const sample = await ctx.db.query("cardCache").take(1);
    return {
      hasCards: sample.length > 0,
      processed: state?.processed ?? 0,
      done: state?.done ?? false,
      updatedAt: state?.updatedAt ?? null,
    };
  },
});
