import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Who is allowed to change a tournament.
 *
 * Before join codes existed, an event was reachable only from the device that
 * created it, and "the caller is the host" was true by construction. Now that
 * anyone with six characters can open it, running the event has to be checked
 * rather than assumed: pairing rounds, reporting results and dropping players
 * stay with the organizer.
 */

export async function requireTournament(
  ctx: QueryCtx,
  tournamentId: Id<"draftTournaments">,
): Promise<Doc<"draftTournaments">> {
  const tournament = await ctx.db.get(tournamentId);
  if (!tournament) throw new Error("Tournament not found");
  return tournament;
}

/** Resolve a pod to the tournament it belongs to. */
export async function podTournament(
  ctx: QueryCtx,
  podId: Id<"draftPods">,
): Promise<{ pod: Doc<"draftPods">; tournament: Doc<"draftTournaments"> }> {
  const pod = await ctx.db.get(podId);
  if (!pod) throw new Error("Pod not found");
  const tournament = await requireTournament(ctx, pod.tournamentId);
  return { pod, tournament };
}

/**
 * Refuse anyone but the organizer. The message is deliberately plain rather
 * than an access-denied: a player tapping a control they can see needs to know
 * whose job it is, not that they did something wrong.
 */
export function assertHost(
  tournament: Doc<"draftTournaments">,
  sessionId: Id<"sessions">,
): void {
  if (tournament.hostSessionId !== sessionId) {
    throw new Error("Only the organizer can run the rounds for this event");
  }
}

export async function assertHostOfPod(
  ctx: MutationCtx,
  podId: Id<"draftPods">,
  sessionId: Id<"sessions">,
): Promise<{ pod: Doc<"draftPods">; tournament: Doc<"draftTournaments"> }> {
  const resolved = await podTournament(ctx, podId);
  assertHost(resolved.tournament, sessionId);
  return resolved;
}

/**
 * Ambiguity-free alphabet, matching games.ts: no 0/O/1/I, because these get
 * read aloud across a table and written on a whiteboard.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Mint a code no live tournament is already using. */
export async function mintTournamentCode(ctx: MutationCtx): Promise<string> {
  let code = randomCode();
  for (let attempt = 0; attempt < 10; attempt++) {
    const taken = await ctx.db
      .query("draftTournaments")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!taken) break;
    code = randomCode();
  }
  return code;
}
