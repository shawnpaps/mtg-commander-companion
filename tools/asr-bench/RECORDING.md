# Recording protocol

The benchmark is only as good as the clips. Transcription accuracy on clean
desktop-mic audio tells us nothing about four people around a table with a phone
on it, which is the only environment BoardState will ever run in.

Read this whole file before recording. A mis-recorded set is worse than no set,
because it produces confident numbers about the wrong thing.

---

## What we need

| | |
|---|---|
| Speakers | **4 minimum.** More is better. |
| Takes | **2 per spoken form per speaker.** |
| Environments | **Both** quiet and simulated table noise, for every speaker. |
| Device | **Phones.** Not desktop mics, not headsets, not AirPods. |
| Format | `.webm` (Opus) preferred. `.m4a` and `.wav` also work. |

### Why phones specifically

Players will use the phone that is already on the table, lying flat, two to four
feet away, pointed at the ceiling. That is a completely different acoustic
problem from a headset mic six inches from your mouth. A desktop mic will make
every condition look good and will not discriminate between them — which defeats
the point of running the benchmark at all.

Record with the phone **flat on a table, screen up, 2–4 feet away.** Do not hold
it. Do not bring it to your mouth.

### Speaker diversity

Card names are invented proper nouns, and how people pronounce them varies more
than ordinary English. Recruit speakers who differ in:

- accent and first language
- pitch (get both higher and lower voices)
- MTG experience — an experienced player says "Thoracle" fluently; a newer player
  says "Thassa's Oracle" carefully. **Both are real users.** Do not coach people
  toward the "correct" pronunciation. A mispronunciation is data, not a mistake.

---

## The two environments

### `quiet`

A normal room. No music, no TV, no fan. Not a recording booth — just quiet.

### `noise`

Simulated table noise, which is what an actual Commander game sounds like. Set up
**all** of these:

1. **Background conversation** — two people talking at conversational volume 6–10
   feet away, or a podcast/talk radio playing at that level. Not music; speech
   masks speech in a way music does not.
2. **Card and dice handling** — shuffling, riffling, sleeves, dice. Intermittent,
   near the phone.
3. **Room tone** — a fan or air conditioning running.

Aim for a level where you can still hold a conversation but have to pay a little
attention. If you have a meter, roughly 55–65 dB.

**Record the same take in both environments.** The comparison is only meaningful
if the same speaker says the same words in both.

---

## How to say the lines

Say them the way you would in a game — **not** the way you would read an
audiobook.

- Normal speed. Do not enunciate carefully.
- Do not pause before the card name.
- Where a line has "uh" or "um" in it, **say the disfluency.** That is the point
  of the `no_verbatim` column.
- If you fumble a word and recover naturally, **keep the take.** That is real.
- If you laugh, restart, or stop entirely, discard and redo.

Between takes, pause about a second. Leave roughly half a second of silence at
the start and end of each clip — the API needs at least 100ms of audio, and a
hard cut at the start can clip the first phoneme, which is exactly the part that
distinguishes "Cultivate" from "Cultivator Colossus".

---

## Filenames

```
{speaker}__{cardSlug}__{condition}__{take}.webm
```

Double underscores between fields. Single underscores are not a separator.

- `speaker` — a stable pseudonym, lowercase, no underscores. `alex`, `sam`, `jo`.
  Do not use real full names; these files may be shared with reviewers.
- `cardSlug` — exactly the slug listed next to each card in the read script
  below. It must match, or the runner skips the clip with a warning.
- `condition` — `quiet` or `noise`.
- `take` — `1` or `2`.

Examples:

```
alex__sol-ring__quiet__1.webm
alex__sol-ring__noise__2.webm
sam__kozilek-butcher-of-truth__noise__1.webm
```

A clip whose name does not parse is skipped and reported at the start of the run.
Check that warning list before trusting a report.

### Multiple spoken forms per card

Most cards have several spoken forms. Record every form, and let the take number
run across them — form 1 take 1 and form 2 take 1 both exist, so number them
sequentially per card: `1`, `2`, `3`, `4`… The runner treats each file as an
independent trial and does not need to know which form it was.

---

## Where files go

Put everything in `clips/`:

```
clips/
  samples/     committed to git — a few clips so the harness runs on a fresh checkout
  <yours>/     gitignored — the full set
```

**The full set is gitignored on purpose.** It is large, and it contains
recordings of people's voices. Keep it local or in shared storage the
participants have agreed to. Get explicit consent before recording anyone, and
tell them the audio goes to ElevenLabs for transcription.

> The clips currently in `clips/samples/` are **macOS `say` text-to-speech**, not
> human recordings. They exist only so `npm run bench` runs end to end on a fresh
> checkout. They are not valid benchmark data — synthetic speech is cleaner than
> any real recording and will flatter every condition. Replace them with real
> clips before drawing any conclusion. Speaker fields are `tts-a` / `tts-b` so
> they are easy to spot and exclude.

---

## Read script

Each card lists its slug and every form to record. Work down the list, and record
the whole list twice per environment.

Estimated time: roughly 158 forms x 2 takes = ~316 clips per speaker per
environment. At ~5 seconds each that is around 30 minutes of recording per
environment, so budget about 1.5 hours per speaker including setup and breaks.

If that is too much, **cut whole categories rather than sampling within them** —
a category with three clips produces a per-category number too noisy to read, and
the per-category breakdown is one of the main outputs. Cutting `baseline` first
is reasonable; it is the control and the least informative.

### baseline

**Lightning Bolt** — slug `lightning-bolt`
  - "Lightning Bolt"
  - "cast Lightning Bolt"
  - "bolt"
  - "uh, Lightning Bolt"

**Rampant Growth** — slug `rampant-growth`
  - "Rampant Growth"
  - "cast Rampant Growth"
  - "Rampant Growth for a Forest"

**Dark Ritual** — slug `dark-ritual`
  - "Dark Ritual"
  - "cast Dark Ritual"
  - "Dark Ritual into it"

**Brainstorm** — slug `brainstorm`
  - "Brainstorm"
  - "cast Brainstorm"
  - "I'll Brainstorm"

**Swan Song** — slug `swan-song`
  - "Swan Song"
  - "Swan Song that"
  - "cast Swan Song"

**Beast Within** — slug `beast-within`
  - "Beast Within"
  - "Beast Within your land"
  - "cast Beast Within"


### invented-noun

**Kozilek, Butcher of Truth** — slug `kozilek-butcher-of-truth`
  - "Kozilek"
  - "cast Kozilek"
  - "Kozilek Butcher of Truth"
  - "Ko-zi-lek"

**Prossh, Skyraider of Kher** — slug `prossh-skyraider-of-kher`
  - "Prossh"
  - "cast Prossh"
  - "Prossh Skyraider of Kher"

**Zedruu the Greathearted** — slug `zedruu-the-greathearted`
  - "Zedruu"
  - "cast Zedruu"
  - "Zedruu the Greathearted"

**Najeela, the Blade-Blossom** — slug `najeela-the-blade-blossom`
  - "Najeela"
  - "cast Najeela"
  - "Najeela the Blade Blossom"

**Chulane, Teller of Tales** — slug `chulane-teller-of-tales`
  - "Chulane"
  - "cast Chulane"
  - "Chulane Teller of Tales"

**Kaalia of the Vast** — slug `kaalia-of-the-vast`
  - "Kaalia"
  - "cast Kaalia"
  - "Kaalia of the Vast"

**Yuriko, the Tiger's Shadow** — slug `yuriko-the-tiger-shadow`
  - "Yuriko"
  - "cast Yuriko"
  - "Yuriko the Tiger's Shadow"

**Ulamog, the Ceaseless Hunger** — slug `ulamog-the-ceaseless-hunger`
  - "Ulamog"
  - "cast Ulamog"
  - "Ulamog the Ceaseless Hunger"


### homophone

**Sol Ring** — slug `sol-ring`
  - "Sol Ring"
  - "soul ring"
  - "cast Sol Ring"
  - "uh, cast, uh, Sol Ring"

**Mana Crypt** — slug `mana-crypt`
  - "Mana Crypt"
  - "manor crypt"
  - "cast Mana Crypt"

**Wrath of God** — slug `wrath-of-god`
  - "Wrath of God"
  - "rath of god"
  - "cast Wrath of God"

**Nicol Bolas, the Ravager** — slug `nicol-bolas-the-ravager`
  - "Nicol Bolas"
  - "nickel bowlus"
  - "Nicol Bolas the Ravager"
  - "Nickel Bolas"

**Rhystic Study** — slug `rhystic-study`
  - "Rhystic Study"
  - "ristic study"
  - "mystic study"
  - "do you pay the one"

**Aetherflux Reservoir** — slug `aetherflux-reservoir`
  - "Aetherflux Reservoir"
  - "ether flux reservoir"
  - "Aetherflux"


### card-collision

**Cultivate** — slug `cultivate`
  - "Cultivate"
  - "cast Cultivate"
  - "Cultivate for a Forest"

**Cultivator Colossus** — slug `cultivator-colossus`
  - "Cultivator Colossus"
  - "cast Cultivator Colossus"
  - "Cultivator"

**Counterspell** — slug `counterspell`
  - "Counterspell"
  - "Counterspell that"
  - "cast Counterspell"

**Counterflux** — slug `counterflux`
  - "Counterflux"
  - "cast Counterflux"
  - "Counterflux, overloaded"

**Swords to Plowshares** — slug `swords-to-plowshares`
  - "Swords to Plowshares"
  - "Swords"
  - "cast Swords to Plowshares"

**Sword of Feast and Famine** — slug `sword-of-feast-and-famine`
  - "Sword of Feast and Famine"
  - "Sword of Feast"
  - "equip Sword of Feast and Famine"

**Path to Exile** — slug `path-to-exile`
  - "Path to Exile"
  - "Path"
  - "cast Path to Exile"

**Pathbreaker Ibex** — slug `pathbreaker-ibex`
  - "Pathbreaker Ibex"
  - "Pathbreaker"
  - "cast Pathbreaker Ibex"

**Fierce Guardianship** — slug `fierce-guardianship`
  - "Fierce Guardianship"
  - "free Fierce Guardianship"
  - "cast Fierce Guardianship"

**Fierce Empath** — slug `fierce-empath`
  - "Fierce Empath"
  - "cast Fierce Empath"

**Tithe** — slug `tithe`
  - "Tithe"
  - "cast Tithe"

**Smothering Tithe** — slug `smothering-tithe`
  - "Smothering Tithe"
  - "cast Smothering Tithe"
  - "Smothering"


### possessive

**Atraxa, Praetors' Voice** — slug `atraxa-praetors-voice`
  - "Atraxa"
  - "Atraxa Praetors' Voice"
  - "cast Atraxa"
  - "Atraxa, Praetors Voice"

**Gaea's Cradle** — slug `gaea-cradle`
  - "Gaea's Cradle"
  - "Gaeas Cradle"
  - "tap Gaea's Cradle"
  - "Gias Cradle"

**Urza's Saga** — slug `urza-saga`
  - "Urza's Saga"
  - "Urzas Saga"
  - "play Urza's Saga"

**Jeska's Will** — slug `jeska-will`
  - "Jeska's Will"
  - "Jeskas Will"
  - "cast Jeska's Will"

**Krark's Thumb** — slug `krark-thumb`
  - "Krark's Thumb"
  - "Krarks Thumb"
  - "cast Krark's Thumb"

**Teferi's Protection** — slug `teferi-protection`
  - "Teferi's Protection"
  - "Teferis Protection"
  - "cast Teferi's Protection"
  - "T Pro"


### nickname

**Thassa's Oracle** — slug `thassa-oracle`
  - "Thoracle"
  - "Thassa's Oracle"
  - "cast Thoracle"

**Dockside Extortionist** — slug `dockside-extortionist`
  - "Dockside"
  - "Dockside Extortionist"
  - "cast Dockside"

**Cyclonic Rift** — slug `cyclonic-rift`
  - "Cyc Rift"
  - "Cyclonic Rift"
  - "overloaded Cyc Rift"
  - "Sike Rift"

**Craterhoof Behemoth** — slug `craterhoof-behemoth`
  - "Hoof"
  - "Craterhoof"
  - "Craterhoof Behemoth"
  - "cast Hoof"

**Demonic Tutor** — slug `demonic-tutor`
  - "Dem Tutor"
  - "Demonic Tutor"
  - "cast Dem Tutor"

**Birds of Paradise** — slug `birds-of-paradise`
  - "Birds"
  - "Birds of Paradise"
  - "cast Birds"


### partial-legendary

**Korvold, Fae-Cursed King** — slug `korvold-fae-cursed-king`
  - "Korvold"
  - "cast Korvold"
  - "Korvold Fae Cursed King"

**Edgar Markov** — slug `edgar-markov`
  - "Edgar"
  - "Edgar Markov"
  - "cast Edgar"

**Muldrotha, the Gravetide** — slug `muldrotha-the-gravetide`
  - "Muldrotha"
  - "cast Muldrotha"
  - "Muldrotha the Gravetide"

**Kenrith, the Returned King** — slug `kenrith-the-returned-king`
  - "Kenrith"
  - "cast Kenrith"
  - "Kenrith the Returned King"

**Tymna the Weaver** — slug `tymna-the-weaver`
  - "Tymna"
  - "cast Tymna"
  - "Tymna the Weaver"

**Winota, Joiner of Forces** — slug `winota-joiner-of-forces`
  - "Winota"
  - "cast Winota"
  - "Winota Joiner of Forces"

