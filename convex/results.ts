import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeLog } from "./undo";

/**
 * Ballots needed to call the game: a strict majority of seated players. Four
 * players need three, three need two, two need two — so a pod can never end on
 * a single player's say-so.
 */
export function majorityThreshold(seatedCount: number) {
  return Math.floor(seatedCount / 2) + 1;
}

async function seatedPlayers(ctx: MutationCtx, gameId: Id<"games">) {
  return (
    await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect()
  ).sort((a, b) => a.seatIndex - b.seatIndex);
}

/**
 * Open the end-of-game vote. Any seated player can call the game — the majority
 * requirement is what actually protects the result, so gating this on the host
 * would only add friction.
 */
export const startVoting = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status === "finished") return { alreadyFinished: true };

    if (!game.votingStartedAt) {
      await ctx.db.patch(gameId, { votingStartedAt: Date.now() });
      await writeLog(ctx, {
        gameId,
        action: "game.voteOpened",
        payload: {},
        inverse: null,
      });
    }
    return { alreadyFinished: false };
  },
});

/** Back out of the vote and discard every ballot, returning the pod to play. */
export const cancelVoting = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status === "finished") return;

    const votes = await ctx.db
      .query("winnerVotes")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    for (const vote of votes) await ctx.db.delete(vote._id);

    await ctx.db.patch(gameId, { votingStartedAt: undefined });
    await writeLog(ctx, {
      gameId,
      action: "game.voteCancelled",
      payload: {},
      inverse: null,
    });
  },
});

/**
 * Cast or change a ballot, then finalize if it pushes a candidate over the
 * majority line. Recasting overwrites in place, so a pod can converge on a
 * winner without anyone having to retract first.
 */
export const castVote = mutation({
  args: {
    gameId: v.id("games"),
    voterPlayerId: v.id("players"),
    candidatePlayerId: v.id("players"),
  },
  handler: async (ctx, { gameId, voterPlayerId, candidatePlayerId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status === "finished") return { finished: true, winner: null };

    const players = await seatedPlayers(ctx, gameId);
    if (!players.some((p) => p._id === voterPlayerId)) {
      throw new Error("Only seated players can vote.");
    }
    if (!players.some((p) => p._id === candidatePlayerId)) {
      throw new Error("That player is not seated at this table.");
    }

    // Opening the vote by casting the first ballot is the common case at a real
    // table, so don't require a separate "call the game" tap first.
    if (!game.votingStartedAt) {
      await ctx.db.patch(gameId, { votingStartedAt: Date.now() });
    }

    const existing = await ctx.db
      .query("winnerVotes")
      .withIndex("by_game_voter", (q) =>
        q.eq("gameId", gameId).eq("voterPlayerId", voterPlayerId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { candidatePlayerId, ts: Date.now() });
    } else {
      await ctx.db.insert("winnerVotes", {
        gameId,
        voterPlayerId,
        candidatePlayerId,
        ts: Date.now(),
      });
    }

    const votes = await ctx.db
      .query("winnerVotes")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();

    const tally = new Map<string, number>();
    for (const vote of votes) {
      tally.set(
        vote.candidatePlayerId,
        (tally.get(vote.candidatePlayerId) ?? 0) + 1,
      );
    }

    const threshold = majorityThreshold(players.length);
    for (const [candidate, count] of tally) {
      if (count >= threshold) {
        await finalizeGame(ctx, game, players, candidate as Id<"players">);
        return { finished: true, winner: candidate };
      }
    }

    return { finished: false, winner: null };
  },
});

/**
 * Write the permanent record and close the game. Results are stored per seat so
 * a user's history is one indexed read, and anonymous players still land in the
 * game's own record — they just don't roll up to an account.
 */
async function finalizeGame(
  ctx: MutationCtx,
  game: Doc<"games">,
  players: Doc<"players">[],
  winnerPlayerId: Id<"players">,
) {
  const finishedAt = Date.now();
  const winner = players.find((p) => p._id === winnerPlayerId);

  const resultId = await ctx.db.insert("gameResults", {
    gameId: game._id,
    code: game.code,
    format: game.format,
    winnerPlayerId,
    winnerName: winner?.name,
    turnCount: game.turnNumber,
    playerCount: players.length,
    finishedAt,
  });

  for (const player of players) {
    // The commander is a card in the command zone; snapshot its name so the
    // history stays readable after the game's cards are gone.
    const commander = player.commanderCardId
      ? await ctx.db.get(player.commanderCardId)
      : null;

    await ctx.db.insert("gameParticipants", {
      gameId: game._id,
      resultId,
      playerId: player._id,
      userId: player.userId,
      name: player.name,
      won: player._id === winnerPlayerId,
      format: game.format,
      deckId: player.deckId,
      commanderName: commander?.name,
      finishedAt,
    });
  }

  const votes = await ctx.db
    .query("winnerVotes")
    .withIndex("by_game", (q) => q.eq("gameId", game._id))
    .collect();
  for (const vote of votes) await ctx.db.delete(vote._id);

  await ctx.db.patch(game._id, {
    status: "finished",
    endedAt: finishedAt,
    votingStartedAt: undefined,
  });

  await writeLog(ctx, {
    gameId: game._id,
    actorId: winnerPlayerId,
    action: "game.finished",
    payload: { winnerName: winner?.name, turnCount: game.turnNumber },
    inverse: null,
  });
}

/** Live tally for the vote sheet: every seat, its count, and who voted for it. */
export const getVoteState = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) return null;

    const players = (
      await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", gameId))
        .collect()
    ).sort((a, b) => a.seatIndex - b.seatIndex);

    const votes = await ctx.db
      .query("winnerVotes")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();

    const result = await ctx.db
      .query("gameResults")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .unique();

    return {
      open: !!game.votingStartedAt && game.status !== "finished",
      status: game.status,
      threshold: majorityThreshold(players.length),
      votesCast: votes.length,
      seatedCount: players.length,
      result,
      tally: players.map((player) => {
        const forPlayer = votes.filter(
          (vote) => vote.candidatePlayerId === player._id,
        );
        return {
          playerId: player._id,
          name: player.name,
          count: forPlayer.length,
          voterIds: forPlayer.map((vote) => vote.voterPlayerId),
        };
      }),
      myVoteByPlayer: Object.fromEntries(
        votes.map((vote) => [vote.voterPlayerId, vote.candidatePlayerId]),
      ),
    };
  },
});
