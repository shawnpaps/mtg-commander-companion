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

export const deckSourceValidator = v.union(
  v.literal("archidekt"),
  v.literal("manual"),
  v.literal("link"),
);

export default defineSchema({
  // A Clerk-backed account. Optional by design: the whole app works signed out,
  // and a users row only exists to hang durable data (decks, W/L) off of.
  users: defineTable({
    clerkUserId: v.string(),
    displayName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastSeen: v.number(),
  }).index("by_clerk_user", ["clerkUserId"]),

  // Anonymous device identity. A device mints a token on first load; the token maps
  // to a player row so refreshes and reconnects restore the right board.
  sessions: defineTable({
    token: v.string(),
    name: v.optional(v.string()),
    // Set when a signed-in user claims this device. Sign-out clears it, so the
    // device keeps playing anonymously without losing its seat.
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
    lastSeen: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

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
    // Set when someone calls the game; the vote sheet is open while this is
    // present and status is still "active". Cleared if voting is cancelled.
    votingStartedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
  }).index("by_code", ["code"]),

  players: defineTable({
    gameId: v.id("games"),
    sessionId: v.id("sessions"),
    name: v.string(),
    // Snapshotted at join time so a result stays attributed even if the player
    // signs out later, or the session is reused by a different account.
    userId: v.optional(v.id("users")),
    deckId: v.optional(v.id("decks")),
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
    .index("by_game_session", ["gameId", "sessionId"])
    .index("by_session", ["sessionId"]),

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

  // A saved decklist. Requires an account — this is the main reason to make one.
  // `cards` is the full list; a 100-card Commander deck is a few KB, far under
  // Convex's 1MB document limit.
  decks: defineTable({
    userId: v.id("users"),
    name: v.string(),
    source: deckSourceValidator,
    // Canonical URL the deck came from, kept so "open on Archidekt" works and
    // re-import can refresh in place.
    sourceUrl: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    commanderName: v.optional(v.string()),
    commanderScryfallId: v.optional(v.string()),
    colors: v.optional(v.array(v.string())),
    cardCount: v.optional(v.number()),
    cards: v.optional(
      v.array(
        v.object({
          name: v.string(),
          quantity: v.number(),
          scryfallId: v.optional(v.string()),
          category: v.optional(v.string()),
        }),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_source", ["userId", "source", "sourceId"]),

  // One row per finished game. Written once, when voting reaches a majority.
  gameResults: defineTable({
    gameId: v.id("games"),
    code: v.string(),
    format: formatValidator,
    winnerPlayerId: v.optional(v.id("players")),
    winnerName: v.optional(v.string()),
    turnCount: v.number(),
    playerCount: v.number(),
    finishedAt: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_finished", ["finishedAt"]),

  // Denormalized per-seat result rows. A user's whole W/L history is one indexed
  // scan here, with no need to load the games they played in.
  gameParticipants: defineTable({
    gameId: v.id("games"),
    resultId: v.id("gameResults"),
    playerId: v.id("players"),
    // Absent for players who were not signed in — their result is still recorded
    // for the game's own history, it just doesn't roll up to an account.
    userId: v.optional(v.id("users")),
    name: v.string(),
    won: v.boolean(),
    format: formatValidator,
    deckId: v.optional(v.id("decks")),
    commanderName: v.optional(v.string()),
    finishedAt: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_user", ["userId", "finishedAt"])
    .index("by_user_deck", ["userId", "deckId"]),

  // Live ballots for the end-of-game vote. One row per voter per game; recast
  // overwrites in place. Cleared when the game finalizes or voting is cancelled.
  winnerVotes: defineTable({
    gameId: v.id("games"),
    voterPlayerId: v.id("players"),
    candidatePlayerId: v.id("players"),
    ts: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_game_voter", ["gameId", "voterPlayerId"]),
});
