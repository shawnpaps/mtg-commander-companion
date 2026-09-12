/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as cardCache from "../cardCache.js";
import type * as cards from "../cards.js";
import type * as decks from "../decks.js";
import type * as draft_access from "../draft/access.js";
import type * as draft_engine from "../draft/engine.js";
import type * as draft_matches from "../draft/matches.js";
import type * as draft_pairings from "../draft/pairings.js";
import type * as draft_pods from "../draft/pods.js";
import type * as draft_results from "../draft/results.js";
import type * as draft_rules from "../draft/rules.js";
import type * as draft_standings from "../draft/standings.js";
import type * as draft_tournaments from "../draft/tournaments.js";
import type * as draft_types from "../draft/types.js";
import type * as games from "../games.js";
import type * as log from "../log.js";
import type * as players from "../players.js";
import type * as results from "../results.js";
import type * as scryfall from "../scryfall.js";
import type * as sessions from "../sessions.js";
import type * as undo from "../undo.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  cardCache: typeof cardCache;
  cards: typeof cards;
  decks: typeof decks;
  "draft/access": typeof draft_access;
  "draft/engine": typeof draft_engine;
  "draft/matches": typeof draft_matches;
  "draft/pairings": typeof draft_pairings;
  "draft/pods": typeof draft_pods;
  "draft/results": typeof draft_results;
  "draft/rules": typeof draft_rules;
  "draft/standings": typeof draft_standings;
  "draft/tournaments": typeof draft_tournaments;
  "draft/types": typeof draft_types;
  games: typeof games;
  log: typeof log;
  players: typeof players;
  results: typeof results;
  scryfall: typeof scryfall;
  sessions: typeof sessions;
  undo: typeof undo;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
