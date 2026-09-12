import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { maxRounds } from "./rules";
import { assignToPods, splitPods } from "./pods";
import { mintTournamentCode } from "./access";

/**
 * Tournament creation. One mutation writes the tournament, its pods, and every
 * entrant, so a half-built event cannot exist.
 */

export const scopeValidator = v.union(
  v.literal("single-pod"),
  v.literal("multi-pod-isolated"),
  v.literal("multi-pod-shared"),
);

export const prizeScopeValidator = v.union(
  v.literal("per-pod"),
  v.literal("global"),
);

export const createDraftTournament = mutation({
  args: {
    name: v.string(),
    hostSessionId: v.id("sessions"),
    scope: scopeValidator,
    trackGameScores: v.boolean(),
    prizeScope: prizeScopeValidator,
    totalPacks: v.float64(),
    prizeDistribution: v.array(v.float64()),
    players: v.array(v.string()),
    targetPodSize: v.float64(),
    roundCount: v.float64(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Give the tournament a name");

    // Blank entries are what an unfilled roster row looks like, not players.
    const players = args.players.map((p) => p.trim()).filter(Boolean);
    if (players.length === 0) throw new Error("Add at least one player");

    if (args.scope === "multi-pod-shared") {
      throw new Error(
        "Shared standings across pods is not available yet — use isolated pods",
      );
    }

    const distributed = args.prizeDistribution.reduce((sum, n) => sum + n, 0);
    if (distributed > args.totalPacks) {
      throw new Error(
        `Prize distribution hands out ${distributed} packs but only ${args.totalPacks} are available`,
      );
    }

    // The split is recomputed here from the roster the server was given. The
    // wizard ran the same function to draw its preview, but a client-supplied
    // split is not something to write to the database on trust.
    const podSizes = splitPods({
      playerCount: players.length,
      scope: args.scope,
      targetPodSize: args.targetPodSize,
    });

    // One round count across the event, so it has to fit the pod with the least
    // room for rounds.
    const smallestPod = Math.min(...podSizes);
    const roundLimit = maxRounds(smallestPod);
    const roundCount = Math.floor(args.roundCount);
    if (roundCount < 3 || roundCount > roundLimit) {
      throw new Error(
        `A pod of ${smallestPod} can play between 3 and ${roundLimit} rounds`,
      );
    }

    const code = await mintTournamentCode(ctx);

    const tournamentId = await ctx.db.insert("draftTournaments", {
      name,
      code,
      hostSessionId: args.hostSessionId,
      scope: args.scope,
      trackGameScores: args.trackGameScores,
      // A single-pod event has nothing to split a global pool across, so its
      // prizes are always that pod's prizes.
      prizeScope: args.scope === "single-pod" ? "per-pod" : args.prizeScope,
      totalPacks: args.totalPacks,
      prizeDistribution: args.prizeDistribution,
      // Created active. There is no separate "start" step later — the organizer
      // finished the wizard, the tournament is on.
      status: "active",
      createdAt: Date.now(),
    });

    const seating = assignToPods(players, podSizes);
    const podIds: Id<"draftPods">[] = [];

    for (let i = 0; i < seating.length; i++) {
      const podId = await ctx.db.insert("draftPods", {
        tournamentId,
        index: i + 1, // 1-based, because it is shown as "Pod 2"
        roundCount,
        currentRound: 0, // no round generated yet
        status: "active",
      });
      podIds.push(podId);

      for (const playerName of seating[i]) {
        await ctx.db.insert("draftEntrants", {
          tournamentId,
          podId,
          name: playerName,
          // The roster is names only, so there is nothing here to resolve a
          // player to a device or an account. Linking an entrant to a session
          // needs a join flow that does not exist yet.
          hadBye: false,
          dropped: false,
        });
      }
    }

    return { tournamentId, code, podIds, podSizes };
  },
});

/**
 * Everything needed to render one tournament: the tournament, its pods, and its
 * entrants. Reactive, so pods and rosters stay live as the event runs.
 */
export const getTournament = query({
  args: { tournamentId: v.id("draftTournaments") },
  handler: async (ctx, { tournamentId }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) return null;

    const [pods, entrants] = await Promise.all([
      ctx.db
        .query("draftPods")
        .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
        .collect(),
      ctx.db
        .query("draftEntrants")
        .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
        .collect(),
    ]);

    return {
      tournament,
      pods: pods.slice().sort((a, b) => a.index - b.index),
      entrants,
    };
  },
});

/** The host's tournaments, newest first, for picking an event back up. */
export const listMyTournaments = query({
  args: { hostSessionId: v.id("sessions") },
  handler: async (ctx, { hostSessionId }) => {
    const tournaments = await ctx.db
      .query("draftTournaments")
      .withIndex("by_host_session", (q) =>
        q.eq("hostSessionId", hostSessionId),
      )
      .collect();
    return tournaments.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Look an event up by its join code. Returns only what a prospective player
 * needs to decide they are in the right place and pick their name — no
 * pairings, no standings, and no way to tell which seats belong to whom beyond
 * whether each is already taken.
 */
export const lookupByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) return null;

    const tournament = await ctx.db
      .query("draftTournaments")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .first();
    if (!tournament) return null;

    const [pods, entrants] = await Promise.all([
      ctx.db
        .query("draftPods")
        .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
        .collect(),
      ctx.db
        .query("draftEntrants")
        .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
        .collect(),
    ]);

    const podIndex = new Map(pods.map((p) => [p._id, p.index]));

    return {
      tournamentId: tournament._id,
      name: tournament.name,
      status: tournament.status,
      podCount: pods.length,
      seats: entrants
        .map((entrant) => ({
          entrantId: entrant._id,
          name: entrant.name,
          podIndex: podIndex.get(entrant.podId) ?? 0,
          claimed: entrant.sessionId !== undefined,
          dropped: entrant.dropped,
        }))
        .sort((a, b) => a.podIndex - b.podIndex || a.name.localeCompare(b.name)),
    };
  },
});

/**
 * Attach a device (and account, if signed in) to a seat on the roster.
 *
 * Seats are claimed rather than created: the organizer already typed everyone
 * in, so joining is recognising yourself in a list, not adding a fifteenth
 * player to a fourteen-person event.
 *
 * Claiming a second seat moves the device rather than refusing, because the
 * overwhelmingly likely reason is tapping the wrong name first. A seat someone
 * else holds is never taken this way — that needs the organizer.
 */
export const claimSeat = mutation({
  args: {
    entrantId: v.id("draftEntrants"),
    sessionId: v.id("sessions"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { entrantId, sessionId, userId }) => {
    const entrant = await ctx.db.get(entrantId);
    if (!entrant) throw new Error("That seat is no longer on the roster");

    if (entrant.sessionId !== undefined && entrant.sessionId !== sessionId) {
      throw new Error(
        `${entrant.name} has already been claimed on another device`,
      );
    }

    // Release whatever else this device holds in the same event first, so a
    // mis-tap does not silently leave the player holding two seats.
    const held = await ctx.db
      .query("draftEntrants")
      .withIndex("by_tournament", (q) =>
        q.eq("tournamentId", entrant.tournamentId),
      )
      .collect();
    for (const other of held) {
      if (other._id !== entrantId && other.sessionId === sessionId) {
        await ctx.db.patch(other._id, {
          sessionId: undefined,
          userId: undefined,
        });
      }
    }

    await ctx.db.patch(entrantId, { sessionId, userId });
    return { entrantId, tournamentId: entrant.tournamentId };
  },
});

/** Give a seat back, so another device can take it. */
export const releaseSeat = mutation({
  args: { entrantId: v.id("draftEntrants"), sessionId: v.id("sessions") },
  handler: async (ctx, { entrantId, sessionId }) => {
    const entrant = await ctx.db.get(entrantId);
    if (!entrant) throw new Error("That seat is no longer on the roster");
    if (entrant.sessionId !== sessionId) {
      throw new Error("That seat belongs to another device");
    }
    await ctx.db.patch(entrantId, {
      sessionId: undefined,
      userId: undefined,
    });
    return { released: true };
  },
});

/**
 * Which seat this device holds, if any. Drives "you" highlighting and tells the
 * tournament view whether to show organizer controls.
 */
export const mySeat = query({
  args: {
    tournamentId: v.id("draftTournaments"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, { tournamentId, sessionId }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) return null;

    const entrants = await ctx.db
      .query("draftEntrants")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    const mine = entrants.find((e) => e.sessionId === sessionId) ?? null;

    return {
      isHost: tournament.hostSessionId === sessionId,
      entrantId: mine?._id ?? null,
      name: mine?.name ?? null,
      podId: mine?.podId ?? null,
    };
  },
});
