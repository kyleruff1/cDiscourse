# CDiscourse — Game Status Model

_Stage 6.1.0 — 2026-05-16_

## What Is Game Resting Status?

Resting status is a **game/conversational state** derived from:
- Child moves present
- Concessions and synthesis
- Quote anchors
- Receipts/evidence
- Flags (off_track, weak_topic)
- User marks
- Optional future: moderator decision, AI advisory

Resting status is **not** an objective truth verdict. It describes where the exchange currently rests in the game.

---

## GameRestingStatus Values

| Status | Label | Severity | Is Final |
|---|---|---|---|
| open | Open | neutral | no |
| awaiting_reply | Awaiting reply | attention | no |
| responded_to | Responded to | neutral | no |
| receipts_requested | Receipts requested | attention | no |
| receipts_dropped | Receipts dropped | positive | no |
| quote_requested | Quote the exact bit | attention | no |
| off_track | Off track | attention | no |
| branch_recommended | Branch this off | attention | no |
| point_conceded | Point conceded | playful | no |
| dispute_narrowed | Dispute narrowed | positive | no |
| mostly_settled | Mostly settled | positive | yes |
| unresolved | Still unresolved | neutral | no |
| stalemate | Stalemate | neutral | no |
| both_might_be_wrong | You might both be wrong | playful | no |
| one_side_more_supported | One side has more support | positive | no |
| claim_currently_ahead | Currently ahead | positive | no |
| surrendered | Surrendered | playful | yes |
| peace_treaty_ish | Peace treaty-ish | playful | yes |
| needs_judge_human_review | Needs human review | attention | no |

---

## GameStatusSource

| Source | Meaning |
|---|---|
| deterministic | Derived from child move types and flags only |
| user_mark | Driven by explicit user action (e.g. conceding_this mark) |
| moderator | Set by a human moderator |
| semantic_adapter | Advisory from AI layer (disabled by default) |
| mixed | Combination of deterministic + advisory |

---

## Derivation Logic (non-AI path)

Priority order:
1. Moderator `needs_review` → `needs_judge_human_review`
2. Off-track flag + 2+ children → `branch_recommended`
3. Off-track flag → `off_track`
4. Concession + synthesis → `peace_treaty_ish`
5. Concession + user mark `conceding_this` → `surrendered`
6. Concession → `point_conceded`
7. Synthesis (no concession) → `mostly_settled`
8. No children → `open`
9. Rebuttal without evidence → `receipts_requested`
10. Rebuttal + evidence + weak topic flag → `both_might_be_wrong`
11. Rebuttal + evidence + 3+ children → `stalemate`
12. Rebuttal + evidence → `unresolved`
13. Evidence, no rebuttal → `receipts_dropped`
14. Clarification without quote anchor → `quote_requested`
15. Default → `responded_to`

---

## Copy Rules

- Playful labels are optional secondary display.
- Never mock the other user in any label.
- Never use: liar, dishonest, bad faith, manipulative, winner, loser, truth (as verdict), ban, hide.
- "Winner/loser" may appear only as user-declared posture, never as system judgment.
- Prefer "currently ahead" or "more supported" over "winner."
- Prefer "conceded," "surrendered," or "mostly wrong" as self-directed user actions.

---

## Source File

`src/features/arguments/gameStatus.ts`
