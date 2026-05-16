# CDiscourse — Gamified Argument Product Skin

_Stage 6.1.0 — 2026-05-16_

## Product Framing

CDiscourse is a **game-like argument room**. Users are not entering a formal debate; they are entering an **argument game**.

The product should feel like:
- A lightweight argument game.
- A timeline of moves.
- A DAW-style track view where argument branches are easy to follow.
- A place where winning is satisfying and conceding is still playful.
- A structured way to avoid wandering tangents.
- A fun way to say "you got me," "receipts please," "wrong scope," or "peace treaty-ish."

**Product promise:** "Turn any argument into a playable, traceable, winnable-but-still-fun exchange."

---

## Primary User-Facing Language

| Concept | User-facing term | Internal code |
|---|---|---|
| Room | Argument Room | debates |
| Participant move | Move | argument |
| Reply to a point | Reply / Counter | rebuttal / counter_rebuttal |
| Supporting source | Receipts | evidence |
| Quoting a prior point | Quote the exact bit | targetExcerpt |
| Giving up a point | Concede / Surrender | concession |
| Wrapping up a thread | Synthesis / Peace treaty-ish | synthesis |
| Thread that drifted | Tangent lane | off_track flag |
| Thread outcome | Resting status | GameRestingStatus |
| Where claim stands | Claim standing | ClaimStanding |
| Argument branches | Tracks | argumentTimeline lanes |

---

## Language to Use

```
Argument Room
Argument Thread
Move
Reply
Counter
Receipts
Basis
Quote the exact bit
Be specific
Dig something up
Branch this off
Resting status
Claim standing
Track
Core lane
Tangent lane
Receipt lane
Concession
Surrender completely
Mostly wrong
Peace treaty-ish
```

---

## Language to Avoid as Primary UI Labels

| Avoid | Reason |
|---|---|
| "Debate" | Feels formal, intimidating |
| "Formal debate" | Wrong product feel |
| "Resolution" as primary label | Use "Claim" instead |
| "Compose" as a separate destination | Composer is inline |
| "Argument type" as the first UI choice | Lead with move, not type |

Note: Internal tables are still `debates`, `arguments`, and `debate_participants`. Database column names are not changed.

---

## UX Goals

1. **Start quickly.** User can open an argument room and make a move in seconds.
2. **Make one clear move at a time.** Composer leads with move selection, then qualifier, then body.
3. **Keep every response attached to a prior point.** Reply links to parent; quote anchor optional.
4. **Let users quote exact text when needed.** Quote-the-exact-bit field for target excerpt.
5. **Make receipts/evidence feel satisfying.** "Drop receipts" is rewarding, not bureaucratic.
6. **Make concessions socially safe and even funny.** "Surrender completely" / "I'm only MOSTLY wrong."
7. **Let tangents branch instead of derailing the main lane.** Branch-this-off button.
8. **Show how the room currently rests without claiming eternal truth.** Resting status is game state.

---

## What Resting Status Is (and Is Not)

**Resting status is game state.** A room can show:
- This point is currently conceded.
- One side is more supported.
- This thread needs receipts.
- This is off track.
- Peace treaty-ish.

**Resting status is NOT:**
- An objective truth verdict.
- A declaration of who is right.
- A permanent record of who won.
- A moderator decision unless explicitly flagged as `needs_judge_human_review`.

The system may show "currently ahead" or "more supported" but must never say "proven correct," "winner," or "loser."

---

## Playful Labels in Use

| Code | Playful label |
|---|---|
| surrendered | Surrender completely |
| point_conceded | Point surrendered |
| dispute_narrowed | Argument got smaller |
| receipts_dropped | Receipts dropped |
| receipts_requested | Receipts, please |
| quote_requested | Pin it to the exact words |
| branch_recommended | This tangent wants its own room |
| peace_treaty_ish | Peace treaty-ish |
| both_might_be_wrong | Everybody might be eating gravel here |

---

## Forbidden Copy Rules

The following must never appear as system labels or status verdicts:
- liar, dishonest
- bad faith
- manipulation / manipulative
- winner, loser (as system judgment — may appear as user self-declaration)
- truth (as absolute system verdict)
- ban, hide (as actions taken on users by the system)

---

## Internal Architecture Note

- DB tables: `debates`, `arguments`, `debate_participants` — unchanged.
- Constitution rules: unchanged. All transitions remain deterministic.
- `submit-argument` Edge Function: unchanged. All submits go through it.
- `submitArgumentDraft` client function: unchanged.
- AI calls: disabled. This stage adds zero Anthropic calls.
