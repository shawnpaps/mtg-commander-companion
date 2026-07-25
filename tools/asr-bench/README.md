# BoardState ASR benchmark — ElevenLabs Scribe

A research spike. It exists to settle one product decision and is not production
code: nothing here is imported by the app or by Convex, and the whole directory
can be deleted or extracted later without touching anything else.

## The question

Not "which vendor" — we are ElevenLabs-only. The fork is:

| | Option | Keyterm budget | Latency | Maps to |
|---|---|---|---|---|
| **A** | Scribe v2 **batch** + full decklist as keyterms | 1000 x 50 chars | seconds | end-of-turn narration |
| **B** | Scribe v2 **realtime** (WebSocket) + packed keyterms | 50 x 20 chars | ~150 ms | per-action push-to-talk |
| **C** | `scribe_v1`, no keyterms | — | seconds | control group |

An entire 100-card Commander deck fits in A's budget with room to spare. B needs
a packing strategy and will cover roughly half a deck.

**Is B's accuracy loss worth its latency win?** That is the only thing this
benchmark is for.

The hard part is not general transcription quality. Card names are ~30,000
invented proper nouns, players say partial and nickname forms ("Thoracle",
"Cyc Rift", "Atraxa"), and many names collide in ways where a wrong match is a
real gameplay error — Cultivate vs Cultivator Colossus, Tithe vs Smothering
Tithe.

---

## Verified facts

The prompt for this spike flagged a documentation conflict, and it resolved. All
of this was checked against live ElevenLabs docs on **2026-07-25**.

### The keyterm conflict — resolved

**ElevenLabs is right; LiveKit's note describes their own plugin, not the API.**

- ElevenLabs' keyterm-prompting guide documents keyterms for **both** batch and
  realtime, with a `scribe_v2_realtime` code example.
- The [2026-05-04 changelog](https://elevenlabs.io/docs/changelog/2026/5/4)
  records `keyterms` and `no_verbatim` being **added** to the Scribe realtime API
  (Python SDK v2.46.0, JS client v1.4.0).
- [LiveKit's plugin docs](https://docs.livekit.io/agents/models/stt/elevenlabs/)
  say keyterms are "only supported with Scribe v2 batch recognition" and cap them
  at 100. That is a limitation of their plugin, which predates the realtime
  keyterm release. We call the API directly, so it does not bind us.

**This is a documentation finding, not an empirical one.** `npm run probe` makes
one real call to each endpoint and settles it against live responses. Run it
before trusting the rest of the harness — and if it contradicts anything here,
the probe wins.

### Models, parameters, limits

| Model ID | Endpoint | Keyterms | `no_verbatim` |
|---|---|---|---|
| `scribe_v1` | batch | no | no |
| `scribe_v2` | batch | 1000 x 50 chars | yes |
| `scribe_v2_realtime` | WebSocket | 50 x 20 chars | yes |

- Batch: `POST /v1/speech-to-text`, keyterms as repeated multipart fields.
- Realtime: `wss://api.elevenlabs.io/v1/speech-to-text/realtime`, keyterms as
  repeated **query parameters**. Audio in as
  `{message_type: "input_audio_chunk", audio_base_64, sample_rate, commit}`;
  finals arrive as `final_transcript` / `committed_transcript`.
- Per-term rules: max 5 words, and `< > { } [ ] \` are unsupported.

### Pricing, including the keyterm premium

From [elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api):

| Item | USD/hour |
|---|---|
| Scribe v2 (batch) | $0.22 |
| Scribe v2 Realtime | $0.39 |
| **Keyterm prompting add-on** | **+$0.05** |
| Entity detection add-on | +$0.07 |

Two things the per-hour rates hide, both modelled in `src/scribe/cost.ts`:

1. **The 20-second minimum.** Batch requests with **100+ keyterms** bill a
   20-second minimum. Card-name utterances are ~2.5s, so option (A) with a real
   100-card decklist bills roughly **8x** its actual duration. Realtime's 50-term
   cap keeps it under the threshold by construction. This, not the per-hour rate,
   is what decides cost — and it inverts the naive comparison.
2. The API reference describes the premium as "an additional 20%", the pricing
   page as a flat +$0.05/hr. They agree to within a point ($0.05/$0.22 = 22.7%).
   We model the flat add-on, since the pricing page is the billing authority.

`scribe_v1` no longer has a separately published rate; it is modelled at parity
with `scribe_v2` and flagged as assumed in the report rather than silently
invented.

---

## Setup

Requires **Node 22.6+** (uses `--experimental-strip-types`; tested on Node 24)
and **ffmpeg** on `PATH` for the realtime conditions, which need raw PCM.

```bash
brew install ffmpeg          # only needed for realtime
cd tools/asr-bench
cp .env.example .env         # then add your key
```

`.env`:

```
ELEVENLABS_API_KEY=sk_...
```

There are no npm dependencies. Nothing to install.

## Running

```bash
npm run bench:dry     # zero API calls — start here
npm run probe         # settles the keyterm conflict against live endpoints
npm run bench         # the real thing
npm test              # resolver + packer assertions, no network
npm run keyterms      # inspect what the packer decided, no network
```

Useful flags:

```bash
npm run bench -- --conditions v2-batch-keyterms,v2-realtime-packed
npm run bench -- --clips clips/my-session
npm run bench -- --limit 20          # first N clips, for a smoke test
npm run bench -- --keep-audio        # retain decoded audio in memory
npm run keyterms -- --deck mydeck.txt
```

Audio is discarded after transcription unless `--keep-audio` is passed. Your clip
files on disk are never modified.

### Cost control

Every response is cached to `results/raw/`, keyed by
`hash(audio bytes + condition + options)`. Reruns are free, a crash costs
nothing, and failures are never cached so a transient 429 does not poison a
rerun. To force a refetch, delete the relevant files in `results/raw/`.

Start with `--limit` and one or two conditions before running the full matrix.

---

## Reading the report

`npm run bench` writes `results/report.md` and `results/raw.json`, and prints the
markdown to stdout. Sections are ordered by how much they should influence the
decision.

**§1 False-confident rate — read this first.** The share of trials where
confidence > 0.9 **and** the top-1 card is wrong: how often voice-casting would
silently put the wrong card on the battlefield. The third column — false-confident
as a share of *high-confidence* trials — is the probability that an auto-executed
cast is wrong given we decided it was safe. **If that number is not near zero,
the feature must always confirm, whichever option we pick.**

**§2 Resolution accuracy.** top-1 is primary. top-3 answers "does the right card
reach the confirm chips" — a condition with mediocre top-1 but strong top-3 is
still shippable behind a confirm step; weak top-3 is not shippable at all.

**§3 Latency.** The headline A-vs-B comparison, with the trade stated explicitly
in ms and percentage points. Realtime is measured as **first audio byte to final
transcript**, excluding WebSocket setup, because a live client holds one socket
open across a game rather than reconnecting per utterance. Setup is reported
separately rather than hidden.

**§4 Calibration by decile.** Accuracy should track confidence. A high-confidence
decile with low accuracy (flagged ⚠️) is where false-confident errors live.

**§5 Per-category.** Which categories break which condition, plus a table of the
actual wrong-card resolutions in `card-collision` — the row that matters most for
safety.

**§6 Cost.** Per utterance and per 2-hour game, including the keyterm premium and
the 20-second-minimum threshold effect described above.

**§7 Keyterm coverage.** What % of the deck each budget covered, exactly which 50
terms realtime bought, and which cards it could not help. If a card resolves
poorly under `v2-realtime-packed` but well under `v2-batch-keyterms` and appears
in the dropped list, the packer's difficulty heuristic mis-ranked it.

**§8 WER — a diagnostic, not a ranking.** Useful only for spotting a condition
mangling audio wholesale. A word-perfect transcript can resolve to the wrong card,
and a garbled one can resolve correctly; for nickname clips the reference text is
not even the card name. **Do not rank conditions by WER.**

---

## How it works

```
data/testset.json     50 cards x 7 categories, with what players actually say
data/decoys.json      ~200 confusable real cards, so collisions are exercised
data/canned.json      hand-authored transcripts for --dry-run

src/probe.ts          settles the keyterm conflict with real calls
src/keyterms.ts       decklist -> optimal keyterm list for a budget
src/resolver.ts       transcript -> card. Identical across all conditions
src/scribe/batch.ts   POST adapter
src/scribe/realtime.ts WebSocket adapter
src/bench.ts          conditions matrix, caching, concurrency, retries
src/report.ts         scoring and markdown
src/selftest.ts       assertions over the resolver and packer
```

### Ground truth is the card, not the string

A trial is correct when the resolver returns the right **card**, whatever the
transcript said. "Thoracle" resolving to Thassa's Oracle is a hit even though the
strings share almost nothing.

### The resolver is identical across conditions — deliberately

If it differed between batch and realtime we would be measuring resolver variance
and calling it ASR variance. Nothing in `resolver.ts` branches on model, endpoint,
or keyterm state. It has zero dependencies; the string matching is implemented
directly.

Signals: exact match, front-half match ("Atraxa" -> "Atraxa, Praetors' Voice"),
alias hit, prefix containment, trigram Dice coefficient, token-set ratio. Score is
`max(discrete signals, blended fuzzy)`, then weighted by candidate tier —
decklist and battlefield 1.0, format-legal 0.95, all cards 0.90.

### Confidence accounts for margin, not just top score

```ts
confidence = top1 * (0.65 + 0.35 * min((top1 - top2) / 0.12, 1))
```

A 0.90 top score against a 0.89 runner-up means two nearly indistinguishable
candidates and one phoneme away from a wrong cast. Scoring on `top1` alone would
call that 0.90 and auto-execute it; the margin term drops it below 0.60. This is
what makes the false-confident number meaningful.

### The keyterm packer

Batch is not really a packing problem — a 100-card deck fits in 1000 slots. The
50 x 20 realtime budget is the actual constraint, and it is where option (B) can
lose. The packer:

- **Extracts front halves** — "Atraxa, Praetors' Voice" -> "Atraxa" (fits 20
  chars), "Nicol Bolas, the Ravager" -> "Nicol Bolas". A front half is preferred
  over a truncation even when both fit, because it is a real word boundary.
- **Scores phonetic difficulty** on the *identity-bearing* part of the name, not
  the whole string. "Kozilek, Butcher of Truth" is one invented word plus three
  common ones; averaging over all four made it look easy and ranked it 33rd.
  Scoring "Kozilek" alone puts it 8th, which is where it belongs.
- **Drops cards that don't need help** when demand exceeds supply. Scribe
  transcribes "Lightning Bolt" cold; spending a scarce slot on it is waste. But
  the floor is a *priority* device, not an eligibility gate — leftover slots are
  backfilled, because an empty slot helps nobody and would make option (B) lose
  on a self-inflicted wound.
- **Includes nicknames** where they fit, ranked slightly *above* canonical names.
  "Thoracle" is 8 characters, is what players say, and has no string relationship
  to "Thassa's Oracle" for the resolver to fall back on.

`npm run keyterms` shows every decision and the reasons behind each score.

### `--dry-run`

Uses hand-authored transcripts from `data/canned.json` and makes zero API calls.
Keyterm conditions return the correct text **only if the packer actually gave that
card a slot**, so a dry run genuinely tests the packer's spending decisions rather
than assuming they were right.

**Dry-run numbers are not measurements.** They validate the pipeline, resolver,
and packer. The report banners this at the top of every dry run.

---

## Status

- [x] Docs verified; keyterm conflict resolved (documentation-level)
- [x] Test set, decoys, resolver, packer, adapters, runner, report
- [x] `npm test` — 85 assertions passing
- [x] `npm run bench:dry` produces a populated `results/report.md`
- [ ] **`npm run probe` against live endpoints** — needs an API key
- [ ] **Real clips recorded** per `RECORDING.md` — samples are TTS placeholders
- [ ] `npm run bench` against real clips
- [ ] RESULTS filled in below

> The clips in `clips/samples/` are macOS `say` TTS, committed only so the harness
> runs end to end on a fresh checkout. Synthetic speech is cleaner than any real
> recording and will flatter every condition. **Do not draw conclusions from a run
> against them.**

---

## RESULTS

*To be filled in after `npm run probe` and a real `npm run bench`.*

### Probe findings

<!-- Did realtime accept keyterms? What were the actual count/char ceilings?
     Anything that contradicts the Verified Facts section above? -->

### Headline numbers

| | v2-batch-keyterms (A) | v2-realtime-packed (B) |
|---|---|---|
| top-1 accuracy | | |
| top-3 recall | | |
| false-confident rate | | |
| latency p50 / p95 | | |
| cost per 2-hour game | | |
| keyterm coverage | | |

### Which categories broke which condition

<!-- card-collision is the one that matters for safety. -->

### Decision

<!-- A or B, and why. If B, note which cards the 50-slot budget could not cover
     and whether that is acceptable. -->

### Auto-execute or always confirm?

<!-- Driven by the false-confident rate. State the threshold chosen and the
     measured rate above it. -->

### Follow-ups

<!-- e.g. does a battlefield-scoped candidate tier close the collision gap?
     Is a hybrid viable — realtime for push-to-talk, batch for end-of-turn? -->
