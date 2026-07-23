# BoardState

A real-time companion app for Magic: The Gathering, built for the Commander table.
Phone-first — one player creates a game, everyone else joins with a
six-character code. Accounts are optional: sign in to save decks and a win/loss
record, or play as a guest and keep nothing.

Vue 3 (`<script setup>`) + Vite on the front, [Convex](https://convex.dev) for the
realtime backend, TailwindCSS v4 for styling, and `motion` for card and zone
transitions.

## Setup

```bash
npm install
npx convex dev      # links the deployment and pushes convex/ functions
npm run dev         # http://localhost:5173
```

`npx convex dev` writes `CONVEX_DEPLOYMENT` into `.env.local` and keeps functions
in sync as you edit them. `VITE_CONVEX_URL` must point at the same deployment:

```
CONVEX_DEPLOYMENT=dev:bright-trout-645
VITE_CONVEX_URL=https://bright-trout-645.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…
```

Run `npm run dev` and `npx convex dev` in two terminals during development.

### Clerk

Authentication is [Clerk](https://clerk.com). Two pieces of configuration are
easy to miss, and both produce the same symptom — sign-in appears to work, but
every account-scoped query keeps returning `null`:

1. **A JWT template named `convex`** must exist in the Clerk dashboard (Configure
   → JWT Templates → the Convex preset). Convex validates the token itself, so
   the default session token is not enough; `src/lib/auth.ts` explicitly asks for
   `getToken({ template: "convex" })`.
2. **`CLERK_JWT_ISSUER_DOMAIN` must be set on the Convex deployment**, not in
   `.env.local` — `convex/auth.config.ts` reads it at push time and Convex will
   reject the push if it's missing:

   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-instance>.clerk.accounts.dev
   ```

   The issuer is the domain encoded in the publishable key, and it differs
   between the dev and production Clerk instances — so set it separately on each
   Convex deployment.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run convex` | `convex dev` — push functions, watch for changes |
| `npm run seed` | Populate the Scryfall card cache (see below) |

## Deploying

The frontend and the Convex backend deploy separately.

**Backend** — `npx convex deploy` pushes functions, indexes and schema to the
project's production deployment (`fantastic-mink-68`).

**Frontend (Vercel)** — the default Vite preset works; the only required setting
is an environment variable:

```
VITE_CONVEX_URL=https://fantastic-mink-68.convex.cloud
```

Without it the build still succeeds, but the app throws
`VITE_CONVEX_URL is not set` on load. With it, the URL is inlined at build time —
verify with `grep fantastic-mink dist/assets/*.js`.

`convex/_generated/` is **committed on purpose**. `src/` imports it, so a clean
checkout can't build without it. Note that `npx convex deploy --cmd 'npm run
build'` does not solve this on its own: per its own help text it runs the command
(step 1) *before* regenerating code (step 3), so the build would still hit a
missing directory. If you do want Vercel to deploy the backend too, set
`CONVEX_DEPLOY_KEY` in Vercel and use:

```
npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL
```

which then also supplies `VITE_CONVEX_URL` automatically.

## Link previews

`index.html` carries the Open Graph / Twitter card tags. Because those need
absolute URLs, it uses a `%SITE_URL%` placeholder that `vite.config.ts` stamps at
build time — set `SITE_URL` to the deployed origin (no trailing slash) alongside
`VITE_CONVEX_URL`, or the fallback in `vite.config.ts` is used and previews will
point at the wrong host.

The share image is `public/og-image.png` (1200×630). Its source is
`design/og-image.svg`; regenerate after editing with:

```bash
rsvg-convert -w 1200 -h 630 design/og-image.svg -o public/og-image.png
```

## Seeding the card cache

```bash
npm run seed
# or: npx convex run scryfall:seedBulkCards '{"pagesPerRun":10}'
```

The call returns after its first batch and **continues in the background** — it
reschedules itself until the whole set (~33k cards) is cached. Expect it to take
several minutes. It's idempotent: `cardCache` is upserted by `scryfallId`, so
re-running never duplicates rows.

A note on why it isn't a bulk download: Scryfall's `oracle_cards` export is a
single ~150MB JSON document, which exceeds a Convex action's memory and time
budget. `seedBulkCards` walks the paginated search API instead, 175 cards per
page, hopping to a fresh action every `pagesPerRun` pages. That also keeps it
inside Scryfall's 50–100ms rate limit.

**The app works before the seed finishes.** Casting a card that isn't cached yet
creates it with a placeholder name and schedules `backfillCard`, which fetches
the single card from Scryfall and patches the name and art in place. The card
search box queries Scryfall live and warms the cache with whatever it returns.

Check status with `npx convex run cardCache:seedProgress '{}'` (add `--prod` for
production). It reports `processed`, `done`, and `hasCards` — the last one
distinguishes "a real seed ran" from "a few cards arrived via search or lazy
backfill". The count is self-reported by the seed rather than counted, because
`cardCache` rows are too large to `collect()` and Convex has no cheap `COUNT(*)`.

## How it fits together

### Anonymous sessions

Playing needs no account. On first load the client mints a token, stores it in
`localStorage`, and calls `getOrCreateSession` to upsert a `sessions` row.
`joinGame` links that session to a `players` row; on reconnect the same token
resolves through the `by_game_session` index to restore the right board and flip
`connected` back to true. The `games.hostSessionId` field marks whoever created
the table.

### Accounts on top of sessions

Clerk sits *beside* the session model rather than replacing it. `sessions.userId`
is optional: signing in claims the device for an account, signing out releases it
without disturbing the seat, so you can sign out mid-game and keep playing.

`src/lib/auth.ts` bridges the two. It hands Convex a token fetcher
(`convex.setAuth`) that mints a `convex`-template JWT from Clerk, and uses the
`onChange` callback — not the Clerk `isSignedIn` flag — to decide when the
backend will actually accept an authenticated write. Components gate
account-scoped queries on `convexAuthenticated` for that reason; gating on
`isSignedIn` races, because it flips before Convex has validated anything.

`players.userId` is **snapshotted at join time** rather than read live at the end
of the game. A result stays attributed to the account that actually played the
seat even if that player signs out, or the device is handed to someone else.

### Ending a game

Any seated player can call the game, which opens a vote (`games.votingStartedAt`).
Each seat casts one ballot into `winnerVotes`; recasting overwrites in place via
the `by_game_voter` index, so a pod can converge without anyone retracting first.
When a candidate reaches a strict majority of seated players —
`Math.floor(n / 2) + 1`, so 3 of 4 — `finalizeGame` writes the permanent record
and closes the table. Deliberately not host-only: the majority requirement is
what protects the result, so gating the trigger would only add friction.

Results are denormalized into one `gameParticipants` row per seat, so a user's
entire W/L history is a single indexed read with no need to load the games
themselves. Rows are written for anonymous players too — they land in the game's
own record, they just carry no `userId` and never roll up to an account.

### Decks

`decks` rows require an account. Archidekt import runs as a Convex **action**
because the browser can't call Archidekt directly (no CORS headers), so the fetch
has to happen server-side; re-importing the same deck refreshes it in place via
the `by_user_source` index instead of stacking duplicates.

Moxfield is link-only on purpose. Their API is gated behind an approved
partnership and blocks unapproved clients, so a Moxfield URL is saved as a named
link (`source: "link"`) rather than a parsed list. If that access ever changes,
the import path is the same shape as the Archidekt one.

Attaching a deck to a seat is what makes the per-deck win rate on the profile
work — `gameParticipants.deckId` is copied from `players.deckId` at finalize.

### State flow

All shared state lives in Convex and reaches components through reactive queries
(`src/lib/useConvex.ts` wraps `client.onUpdate` in a Vue composable). Nothing
mutates shared state locally. The only client-held state is which table this
device is sitting at (`src/lib/store.ts`).

### Undo

Every state-changing mutation appends a `gameLog` entry carrying an `inverse`
patch — the minimal change needed to revert it:

| Mutation | Inverse |
| --- | --- |
| `castCard` | `deleteCard` with the created id |
| `removeCard` | `restoreCard` with the card's fields (new id on restore) |
| `moveCard` | prior `zone`, `position`, `tapped` |
| `toggleTap` / `toggleFlip` | prior boolean |
| `setController` | prior `controllerId` |
| `updateCounters` | prior counter array |
| `updateLife` / `setPoison` | prior value |
| `setCommanderDmg` | prior `commanderDmg` array |

Events that can't be reverted (`player.joined`, `turn.passed`, `game.created`,
`commander.set`) store no inverse. `undoLastAction` walks back through the `by_game_active` index
to the newest entry that both is `undone: false` and carries an inverse, replays
it, and marks the entry undone. Because `getLog` reads only `undone: false`
entries, undone actions drop straight out of the live feed.

## Structure

```
convex/
  schema.ts       tables + indexes
  auth.config.ts  Clerk issuer Convex validates JWTs against
  sessions.ts     getOrCreateSession
  users.ts        syncUser, unlinkSession, me, myHistory, myDeckRecords
  decks.ts        listMyDecks, saveDeck, setPlayerDeck, importFromArchidekt
  results.ts      startVoting, castVote, cancelVoting, getVoteState
  games.ts        createGame, joinGame, startGame, nextTurn, undoLastAction, getGame
  players.ts      updateLife, setPoison, setCommanderDmg
  cards.ts        castCard, setCommander, moveCard, toggleTap, setController,
                  updateCounters, getPlayerBoard
  log.ts          getLog
  cardCache.ts    upsert + lookup
  scryfall.ts     seedBulkCards, fetchCard, backfillCard, searchCards  (actions — all external fetch lives here)
  undo.ts         inverse-patch types + applier
src/
  lib/            convex client, session token, auth bridge, store, query composables
  views/          LobbyView, GameView, ProfileView, MyBoard, TableView, Vitals
  components/     Card, PlayerPod, LifeCounter, CommanderDamageGrid, CardLog,
                  ShareGameCode, UndoButton, CardSearch, CommanderPicker,
                  AuthControls, EndGameSheet
```

### Zones and the battlefield

Cards live in one of `battlefield`, `graveyard`, `exile`, `command`, or
`library`. There's deliberately no hand zone — players hold physical cards, so
the app only tracks what's public at the table.

The battlefield is grouped into **Creatures, Planeswalkers, Artifacts,
Enchantments, Lands, Other**, derived from the Scryfall `type_line` stored on
each card (`src/lib/cardTypes.ts`). Order of the checks matters: an Artifact
Creature files under creatures, and an Artifact Land under lands. A card cast
before its Scryfall backfill lands sits in "Other" until the type arrives, then
moves on its own — the grouping is reactive.

### Commanders

Each player picks their commander from a search restricted to Scryfall's
`is:commander` (legendary creatures plus Backgrounds and the handful of
planeswalkers that can helm a deck). The commander is created as a real card in
the `command` zone, so it taps, moves and takes counters like anything else;
`players.commanderCardId` just points at it. Choosing again replaces the
previous card rather than stacking up a second one.

The picker appears at the top of **My Board** in Commander games only.

`GameView` hosts three sub-views behind a bottom tab bar: **My Board** (your
zones, cast new cards), **Table** (every player's pod), and **Vitals** (life,
commander damage grid, log feed).

## Interactions

- **Tap a card** — taps/untaps it, rotating 90°. The rotation is driven by Convex
  state rather than the local click, so every device at the table sees it.
- **Long-press a card** (450ms) — opens a sheet to move zones, adjust counters,
  or hand control to another player (Mind Control keeps `ownerId`, changes
  `controllerId`).
- **Tap life ±** — 1 at a time; tapping the total is −5, right-click/long-press is +5.
- **Commander damage grid** — tap a cell to add 1, long-press to subtract. 21 turns red.

Layout is mobile-first: single column on a phone, reflowing to multi-column card
grids and a two-up table on tablet and desktop.
