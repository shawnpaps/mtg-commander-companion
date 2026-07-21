"use node";

import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

const SCRYFALL = "https://api.scryfall.com";
// Scryfall asks for 50-100ms between requests and a descriptive UA.
const RATE_LIMIT_MS = 100;
const HEADERS = {
  "User-Agent": "BoardState/0.1 (MTG companion app)",
  Accept: "application/json",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ScryfallCard = {
  id: string;
  name: string;
  image_uris?: Record<string, string>;
  card_faces?: Array<{ image_uris?: Record<string, string> }>;
};

function imagesFor(card: ScryfallCard) {
  // Double-faced cards carry art on the faces rather than the top level.
  return card.image_uris ?? card.card_faces?.[0]?.image_uris ?? {};
}

function toCacheRow(card: ScryfallCard) {
  return {
    scryfallId: card.id,
    name: card.name,
    oracleData: card,
    imageUris: imagesFor(card),
  };
}

// One printing per distinct card — the oracle-level set an MTG companion needs,
// roughly 33k cards across ~190 pages of 175.
const SEED_QUERY = `${SCRYFALL}/cards/search?q=game%3Apaper&unique=cards&order=name`;

/**
 * Seed cardCache from Scryfall.
 * Run with: npx convex run scryfall:seedBulkCards
 *
 * Scryfall's bulk `oracle_cards` export is a single ~150MB JSON document, which
 * blows an action's memory and time budget in one shot. So this walks the
 * paginated search API instead and reschedules itself every `pagesPerRun` pages,
 * which also keeps it comfortably inside Scryfall's rate limit. Fire and forget:
 * the first call returns immediately and the rest continues in the background.
 */
export const seedBulkCards = action({
  args: {
    pageUrl: v.optional(v.string()),
    pagesPerRun: v.optional(v.number()),
    seenSoFar: v.optional(v.number()),
  },
  handler: async (ctx, { pageUrl, pagesPerRun, seenSoFar }) => {
    const budget = pagesPerRun ?? 10;
    let url: string | undefined = pageUrl ?? SEED_QUERY;
    let processed = seenSoFar ?? 0;
    let inserted = 0;
    let updated = 0;

    for (let page = 0; page < budget && url; page++) {
      await sleep(RATE_LIMIT_MS);
      const res: Response = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`Scryfall search: ${res.status}`);

      const body = (await res.json()) as {
        data?: ScryfallCard[];
        has_more?: boolean;
        next_page?: string;
      };

      // Dedupe within the page; upsertMany handles cross-page duplicates.
      const seen = new Set<string>();
      const rows = (body.data ?? [])
        .filter((c) => c.id && !seen.has(c.id) && seen.add(c.id))
        .map(toCacheRow);

      if (rows.length > 0) {
        const result = await ctx.runMutation(internal.cardCache.upsertMany, {
          cards: rows,
        });
        inserted += result.inserted;
        updated += result.updated;
        processed += rows.length;
      }

      url = body.has_more ? body.next_page : undefined;
    }

    if (url) {
      await ctx.scheduler.runAfter(0, internal.scryfall.continueSeed, {
        pageUrl: url,
        pagesPerRun: budget,
        seenSoFar: processed,
      });
    }

    return { processed, inserted, updated, done: !url };
  },
});

/** Continuation hop for seedBulkCards — same logic, scheduled rather than called. */
export const continueSeed = internalAction({
  args: {
    pageUrl: v.string(),
    pagesPerRun: v.number(),
    seenSoFar: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runAction(api.scryfall.seedBulkCards, args);
  },
});

/** Lazy single-card fetch for anything the bulk seed hasn't covered. */
export const fetchCard = action({
  args: { scryfallId: v.string() },
  handler: async (ctx, { scryfallId }) => {
    await sleep(RATE_LIMIT_MS);
    const res = await fetch(`${SCRYFALL}/cards/${scryfallId}`, {
      headers: HEADERS,
    });
    if (!res.ok) return null;

    const card = (await res.json()) as ScryfallCard;
    const row = toCacheRow(card);
    await ctx.runMutation(internal.cardCache.upsertMany, { cards: [row] });
    return {
      scryfallId: row.scryfallId,
      name: row.name,
      imageUrl: imagesFor(card).normal ?? imagesFor(card).large,
    };
  },
});

/**
 * Scheduled by castCard when a card is played before it exists in the cache:
 * caches the record and patches the placeholder card in place.
 */
export const backfillCard = internalAction({
  args: { scryfallId: v.string(), cardId: v.id("cards") },
  handler: async (ctx, { scryfallId, cardId }) => {
    await sleep(RATE_LIMIT_MS);
    const res = await fetch(`${SCRYFALL}/cards/${scryfallId}`, {
      headers: HEADERS,
    });
    if (!res.ok) return;

    const card = (await res.json()) as ScryfallCard;
    await ctx.runMutation(internal.cardCache.upsertMany, {
      cards: [toCacheRow(card)],
    });
    const images = imagesFor(card);
    await ctx.runMutation(internal.cards.applyCardData, {
      cardId,
      name: card.name,
      imageUrl: images.normal ?? images.large ?? images.small,
    });
  },
});

/**
 * Card picker search. Hits Scryfall directly so the picker works before the
 * bulk seed has finished, and warms the cache with whatever it returns.
 */
export const searchCards = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    if (query.trim().length < 2) return [];

    await sleep(RATE_LIMIT_MS);
    const res = await fetch(
      `${SCRYFALL}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name`,
      { headers: HEADERS },
    );
    if (!res.ok) return [];

    const body = (await res.json()) as { data?: ScryfallCard[] };
    const cards = (body.data ?? []).slice(0, 20);
    if (cards.length > 0) {
      await ctx.runMutation(internal.cardCache.upsertMany, {
        cards: cards.map(toCacheRow),
      });
    }

    return cards.map((c) => ({
      scryfallId: c.id,
      name: c.name,
      imageUrl: imagesFor(c).small ?? imagesFor(c).normal,
    }));
  },
});
