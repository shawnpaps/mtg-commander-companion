# BoardState

A real-time companion app for Magic: The Gathering, built for the Commander table.
Phone-first, no accounts — one player creates a game, everyone else joins with a
six-character code.

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
```

Run `npm run dev` and `npx convex dev` in two terminals during development.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run convex` | `convex dev` — push functions, watch for changes |
| `npm run seed` | Populate the Scryfall card cache (see below) |

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

Check status with `npx convex run cardCache:cacheSize '{}'`.

## How it fits together

### Anonymous sessions

There are no passwords or emails. On first load the client mints a token, stores
it in `localStorage`, and calls `getOrCreateSession` to upsert a `sessions` row.
`joinGame` links that session to a `players` row; on reconnect the same token
resolves through the `by_game_session` index to restore the right board and flip
`connected` back to true. The `games.hostSessionId` field marks whoever created
the table.

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
  sessions.ts     getOrCreateSession
  games.ts        createGame, joinGame, startGame, nextTurn, undoLastAction, getGame
  players.ts      updateLife, setPoison, setCommanderDmg
  cards.ts        castCard, setCommander, moveCard, toggleTap, setController,
                  updateCounters, getPlayerBoard
  log.ts          getLog
  cardCache.ts    upsert + lookup
  scryfall.ts     seedBulkCards, fetchCard, backfillCard, searchCards  (actions — all external fetch lives here)
  undo.ts         inverse-patch types + applier
src/
  lib/            convex client, session token, store, query composables
  views/          LobbyView, GameView, MyBoard, TableView, Vitals
  components/     Card, PlayerPod, LifeCounter, CommanderDamageGrid, CardLog,
                  ShareGameCode, UndoButton, CardSearch, CommanderPicker
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
