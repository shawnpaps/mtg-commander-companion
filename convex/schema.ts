import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const formatValidator = v.union(
  v.literal("standard"),
  v.literal("modern"),
  v.literal("draft"),
  v.literal("commander"),
);

export const zoneValidator = v.union(
  v.literal("battlefield"),
  v.literal("graveyard"),
  v.literal("exile"),
  v.literal("command"),
  v.literal("library"),
);

export default defineSchema({
  // Anonymous device identity. A device mints a token on first load; the token maps
  // to a player row so refreshes and reconnects restore the right board.
  sessions: defineTable({
    token: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
    lastSeen: v.number(),
  }).index("by_token", ["token"]),

  games: defineTable({
    code: v.string(),
    format: formatValidator,
    status: v.union(
      v.literal("lobby"),
      v.literal("active"),
      v.literal("finished"),
    ),
    playerCount: v.number(),
    hostSessionId: v.id("sessions"),
    turnPlayerId: v.optional(v.id("players")),
    turnNumber: v.number(),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  players: defineTable({
    gameId: v.id("games"),
    sessionId: v.id("sessions"),
    name: v.string(),
    seatIndex: v.number(),
    life: v.number(),
    poison: v.number(),
    commanderDmg: v.array(
      v.object({ fromPlayerId: v.id("players"), amount: v.number() }),
    ),
    // Points at this player's commander, which lives as a card in the command zone.
    commanderCardId: v.optional(v.id("cards")),
    connected: v.boolean(),
  })
    .index("by_game", ["gameId"])
    .index("by_game_session", ["gameId", "sessionId"]),

  cards: defineTable({
    gameId: v.id("games"),
    // ownerId never changes; controllerId moves with Mind Control effects.
    ownerId: v.id("players"),
    controllerId: v.id("players"),
    scryfallId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    // Scryfall type_line, e.g. "Legendary Artifact Creature — Golem". Drives the
    // battlefield grouping; optional because a card can be cast before the
    // Scryfall backfill resolves.
    typeLine: v.optional(v.string()),
    zone: zoneValidator,
    tapped: v.boolean(),
    flipped: v.boolean(),
    counters: v.array(v.object({ type: v.string(), count: v.number() })),
    attachedTo: v.optional(v.id("cards")),
    position: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_game_controller", ["gameId", "controllerId"]),

  // Append-only. `inverse` is the minimal patch that reverts the action, or null
  // for events that cannot be undone.
  gameLog: defineTable({
    gameId: v.id("games"),
    ts: v.number(),
    actorId: v.optional(v.id("players")),
    action: v.string(),
    payload: v.any(),
    inverse: v.optional(v.any()),
    undone: v.boolean(),
  })
    .index("by_game", ["gameId"])
    .index("by_game_active", ["gameId", "undone"]),

  // Single-row progress marker for the paginated Scryfall seed. Convex has no
  // cheap COUNT(*) and cardCache rows are far too large to collect(), so the
  // seed reports its own progress here.
  seedState: defineTable({
    processed: v.number(),
    done: v.boolean(),
    updatedAt: v.number(),
  }),

  cardCache: defineTable({
    scryfallId: v.string(),
    name: v.string(),
    oracleData: v.any(),
    imageUris: v.any(),
    updatedAt: v.number(),
  }).index("by_scryfall", ["scryfallId"]),
});
