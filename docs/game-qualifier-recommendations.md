# Game Qualifier Recommendations

_Stage 6.1.5.1 — 2026-05-17. Derived from the live AI corpus, the synthetic engagement epidemiology, and the point-standing doctrine._

## Source artifacts

- `docs/testing-runs/2026-05-17-ai-driven-bot-corpus.md` — **live AI corpus** (3 rooms, 38 / 38 moves posted, run id `2026-05-17T05-33-03-863Z-fc5b47a8`). Decision-intent distribution: `plant_claim`×7, `drop_receipts`×6, `quote_exact_bit`×3, `branch_tangent`×3, `challenge_evidence`×3, `synthesize_thread`×3, `challenge_scope`×3, `challenge_fact`×2, `concede_small_point`×2, `challenge_causal`×2, `narrow_dispute`×1, `challenge_logic`×1.
- `docs/testing-runs/2026-05-17-ai-driven-bot-corpus-dry.md` — dry placeholder run (3 rooms × ~13 placeholder bodies).
- `docs/testing-runs/2026-05-17-engagement-epidemiology-synthetic.md` — 24 synthetic reply pairs covering every primary stance.
- `docs/point-standing-economy.md` — the doctrine ("concession is a scoring repair, not a scoring defeat").
- `docs/ai-driven-bot-rooms.md` — what the AI fixture does and does not do.

## Observation summary

The AI corpus posted at 100% success and exercised every move type. The room scores cluster tightly between **4.1 and 4.3** — engagement scores are strong but not differentiated. The decision-intent distribution shows good axis coverage (fact / scope / evidence / causal / logic all present), with `concede_small_point` already appearing twice in 38 moves. The corpus reads more lifelike than the deterministic stress runs, but most challenges still fire on a single axis and few rooms show a clean "broad accept, narrow decline" exchange end-to-end.

The synthetic epidemiology has 24 pairs with all 10 primary stances present. The `mixed_agree_disagree` stance shows up in 9 of 24 pairs — the most common single stance — confirming that the **mixed-agreement state is the most playable state** for the game.

## Recommendations

Each recommendation cites the source observation.

### 1. Add mixed-agreement badges in the argument room composer

**Why:** Mixed agreement is the most common stance in the synthetic epidemiology (9 / 24 ≈ 38 %) and the explicit goal of `point_standing_economy.md`'s doctrine. The AI corpus shows the bots produce these states; the app currently has no UI affordance for them.

**Badges to surface (already wired in `messageQualifiers.ts`):**

- "Agrees broadly, disputes narrowly" (`broad_accept_narrow_decline`)
- "Accepts a sub-point, rejects the frame" (`narrow_accept_broad_decline`)
- "Mixed: agree-and-disagree" (`mixed_agree_disagree`)
- "Tiny concession, big save" (`concede_small_point`)

**Where:** `ArgumentNodeSummary` + `ArgumentTimelineNode`, next to the existing argument-type badge. Non-blocking.

### 2. Add prompt nudges in the composer (non-blocking)

**Why:** The corpus shows the bots reach for receipts (`drop_receipts`×6) and quote anchors (`quote_exact_bit`×3) often. Human users would do this less reliably; a nudge surfaces the right move at the right time.

**Nudges (already wired in `messageQualifiers.ts → getQualifierUiNudge`):**

- "Drop the receipts in the next move." (when the parent's qualifier is `ask_receipts`)
- "Quote the parent verbatim and respond to that phrase." (when parent is `quote_exact_bit` or a target excerpt is set)
- "Pin the definition in the next move." (when parent qualifier is `define_term`)
- "Narrow the claim — clarify the case it covers." (when parent qualifier is `narrow_scope`)
- "Branch this tangent into its own room." (when the move is a tangent / branch candidate)
- "A tiny concession preserves the broader point." (when the responder is about to accept a narrow defect)
- "Synthesize what changed and close the thread." (when concession has landed)

**Where:** `ComposerValidationPanel` already shows blocking errors; add a non-blocking nudge slot below it.

### 3. Add point-standing statuses to the argument-room resting status

**Why:** Stage 6.1.4 defined the ledger but didn't wire it into the UI. The corpus has 8 "drop_receipts" moves with no visible response signal. Surfacing "receipt debt open" alongside the resting status tells the next mover the move is needed.

**Statuses to surface (derived from `pointStanding/types.ts → OpenIssueDebt` axes):**

- "Pressure created" (a new debt opened)
- "Receipt debt open" (axis = evidence, no repair yet)
- "Quote debt open" (axis = quote, no repair yet)
- "Definition debt open" (axis = definition)
- "Scope debt open" (axis = scope)
- "Repaired by concession" (debt closed via explicit-narrow-preserve)
- "Unresolved pressure" (debt aged + still open)
- "Tangent branch recommended" (`tangent_or_joke` class)

**Where:** `GameStatus` or `TopicSatisfactionBadge`-adjacent area. **Do not wire the live ledger this stage** — Stage 6.1.4 is intentionally not auto-wired; this remains a recommendation.

### 4. Add scoring affordances (advisory only)

**Why:** Stage 6.1.4 computes deltas. The app can surface a compact summary without making the score authoritative.

**Affordances (already computed by `gradeChallenge` / `gradeRepair`):**

- `challengerPressureGain` — small "+" pill next to the challenger's name when their move opens a debt.
- `responderRecoveryGain` — small "+" pill next to the responder when a narrow concession repairs the broad point.
- `concessionIntegrityGain` — honesty credit when an explicit broad concession lands.
- `unresolvedDebtPenalty` — small "−" pill on the original speaker when a debt is being evaded.
- `exploitRiskScore` — internal audit signal; never user-facing.

**Critical:** these are advisory; the production app never **declares a winner**, never **labels a user**, never **blocks a move** based on these. Tests in `__tests__/pointStandingEngine.test.ts` already lock this contract.

### 5. Playful UI labels

**Why:** The AI corpus reads more alive when bots use playful phrasing. Mirroring that in user-facing UI keeps the game cooperative.

**Labels (already wired in `messageQualifiers.ts → QUALIFIER_LABELS`):**

- "Receipts, please"
- "Quote the exact bit"
- "Scope got wobbly"
- "Tiny concession, big save"
- "This tangent wants its own room"
- "Peace treaty-ish"
- "Point survived pressure"
- "Point needs repair"

## What this doc is NOT

- Not a launch plan. None of these change ship on this commit; this stage adds the taxonomy and the Admin Arguments visibility surface only.
- Not a verdict scheme. Every label avoids `winner` / `loser` / `truth` / `liar` / `dishonest` / `bad faith` / `manipulative` / `extremist` / `propagandist`. The qualifier module's tests assert their absence.
- Not auto-wired. The point-standing engine remains pure-TS and not connected to the argument room — Stage 6.1.5.2 (or later) would wire it after a design review.

## Next safe stage

If the live AI corpus reads well after browsing the new Admin Arguments tab → **Stage 6.1.5.2 — point-standing persistence + UI nudges in the composer**.

If the Admin / argument-room UX feels confusing on first browser walk → **Stage 6.1.6 — argument-room UX cleanup** informed by what was visible in the AI corpus + the Admin Arguments tab.

If the AI corpus needs more variety before the UX work → **Stage 6.1.5.3 — `bot:fixture:ai:50` live run** (~$10–$30 spend), then re-derive recommendations from the wider sample.
