# UX-FEEDBACK-001 — Restrained intellectual-progress feedback (display-only; the reward is clarity, not applause)

**Status:** Design draft
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate · P1 · effort **M** · lane **UI-copy**
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/690
**Base:** `8e360b3` · branch `feat/UX-FEEDBACK-001-feedback`
**Lane:** UI/copy (read-only projection of the once-derived mediator board + a new pure display helper) · GATE-C: **No** for the display slice (no deploy / migration / provider / backend mutation / classifier) · Any persisted clarity-annotation slice is **deferred + operator-gated**.
**Depends on (all merged on main):** UX-MEDIATOR-001 (`v4DisplayStateFor` + the 9 display states + per-point pathway) · UX-MEDIATOR-002 (one chip + chip-adjacent Inspect caret + `MediatorNodeInspectDetail`) · UX-MEDIATOR-003 (evidence-blocked copy) · UX-MEDIATOR-004 (definition/scope bridge copy) · UX-MEDIATOR-005 (Disagreement Points rail) · UX-SELECTED-NODE-001 (`SelectedNodeInspectDrawer` + its named sections) · UX-NEXT-MOVE-001 (`nextMovesForState` + `MediatorNextMovesCard`) · UX-IMPASSE-001 (dignified impasse copy). Extends #158 (MCP-008). Folds the intent of the deferred UX-CLARITY-RATING-001 (not filed). Does **not** subsume #504 (CARD-VIEW-DATA-001).

---

## ⚠️ §3 GATE — Per-moment STATIC-vs-TRANSITION verdict (read first; the load-bearing decision)

This card is the **most gamification-adjacent** card in the v4 slate. A feedback "moment" implies a **transition** (something *just happened* — a response anchored, a debt resolved, a clash narrowed). The hard, doctrine-shaping problem: **detecting a transition deterministically WITHOUT new persistence, a new event/rating table, an MCP/classifier signal, or any backend write.** The board (`MediatorBoardState`) is a stateless re-projection of *current* state — it does not carry "what changed since the last render." So for each candidate feedback moment we must decide:

- **SAFE-NOW (ship):** the moment is derivable from the **current** mediator state as **STATIC, state-reflective copy** (a node/point IS narrowed, IS at impasse, HAS a resolved debt now), OR it is a **purely-LOCAL EPHEMERAL UI cue** whose trigger is a deterministic local event already on the surface (e.g. the user tapped to anchor composition to a node) needing **NO persistence / event / backend**.
- **DEFER (do NOT invent a signal):** the moment needs **transition-event detection** (a true before→after diff), a **new persisted rating/score/event table**, a **classifier/MCP signal**, or any **backend write**. If no safe current signal exists, **DEFER** rather than synthesize one.

### The verdict table (operator §4 candidate moments)

| # | Candidate moment | Operator copy | What it *implies* | Deterministic signal available **today** | STATIC / EPHEMERAL / TRANSITION | **Verdict** |
|---|---|---|---|---|---|---|
| 1 | **Selected-node anchoring** | "Point anchored." | The response is now bound to a specific point (composition anchored to a node) | The **local selection event** — `setActiveMessageId` / the responding-to anchor in `TimelineSelectedReadoutPanel` (UX-SELECTED-NODE-001) already fires when a node is selected/anchored | **EPHEMERAL** (local UI event; no persistence) | **SAFE-NOW** (local ephemeral cue on the existing anchor) |
| 2 | **Evidence helper** | "Source path clarified." | A source/record obligation moved forward | `board.evidenceDebts[].status` + `evidenceDebtDisplay` (UX-MEDIATOR-003) carry the **current** debt status (`open` / `resolved` / `unresolved`). A debt that **is `resolved` now** is a static state. A debt that **just transitioned** open→resolved is NOT — that needs a diff. | **STATIC** ("source path is clarified" = a debt is resolved now) is safe; **TRANSITION** ("just resolved") is not | **SAFE-NOW for the STATIC framing** ("Source path clarified" rendered where a debt IS resolved); **DEFER the "just-happened" transition framing** |
| 3 | **Narrowing** | "Claim narrowed." | A concession/narrowing happened; a smaller clash remains | `point.state === 'narrowed'` (`v4DisplayStateFor` keeps `narrowed`) is a **current** structural state; `IMPASSE_SUBTYPE_COPY.narrowed` already dresses it ("The disagreement is smaller now.") | **STATIC** (the point IS narrowed now) | **SAFE-NOW** (state-reflective copy on a narrowed point) |
| 4 | **Definition / scope named** | "Definition named." / "Scope clarified." | A term was defined / a scope was bridged | `point.state === 'definition_not_shared'` / `'scope_mismatch'` are the **un-bridged** states; `definitionScopeBridgeDisplay` (UX-MEDIATOR-004) renders the bridge prompt. A *named/confirmed* definition has **no current state** that says "this WAS named" — `definition_not_shared` clearing is a transition with no persisted confirmation flag (`proposedButNotConfirmed` exists but no "confirmed" producer). | **TRANSITION** (the "named" past-tense needs before→after; current state only says "not shared yet") | **DEFER the past-tense "named/clarified" framing**; **SAFE-NOW only as the existing advisory bridge prompt** (which UX-MEDIATOR-004 already ships) |
| 5 | **Concession** | "Concession preserved." | A concession improved the board without being a defeat | `point.state === 'narrowed'` (concession lands as lifecycle `narrowed`/`conceded` → display `narrowed`, per UX-IMPASSE-001 §3 #4). The *dignified* framing — concession is progress, not a loss — is exactly the shipped `IMPASSE_SUBTYPE_COPY.narrowed` doctrine. | **STATIC** (folds into the narrowed point's current state) | **SAFE-NOW** (as a sub-line on the narrowed point; same signal as #3) |
| 6 | **Impasse** | "Disagreement preserved." | The point reached a dignified, complete impasse | `point.state === 'structured_impasse'` + `pathway.anyAvailable === false` are **current** structural states; `IMPASSE_SUBTYPE_COPY.structured_impasse` already ships the exact dignified wording ("The disagreement is preserved.") | **STATIC** (the point IS at impasse now) | **SAFE-NOW** (UX-IMPASSE-001 already renders this; this card adds nothing new here — cross-ref only) |
| 7 | **Inspect / rail detail** | "This moved the point forward." | The selected response advanced the shape | The active node's **current** display state + pathway already say what the point's shape is and what would help next. A claim that **a specific response moved it forward** needs a before→after comparison of the point's state across that response — **a transition the board does not carry.** | **TRANSITION** (per-response "moved it forward" = before→after diff) | **DEFER the per-response "this moved it forward" claim**; **SAFE-NOW only as the existing static "Move forward:" guidance** (UX-NEXT-MOVE-001, already shipped) |

### Summary verdict

- **SHIP NOW (safe, display-only):** **#1 anchoring** (local ephemeral cue on the existing anchor), **#3 narrowing** + **#5 concession** (state-reflective copy on a `narrowed` point), **#6 impasse** (already shipped by UX-IMPASSE-001 — cross-ref, no new render). **#2 evidence** ships only as the **STATIC** "a source path is clarified here" framing on a point whose debt **is resolved now** — never as "just resolved."
- **DEFER (do NOT invent a signal):** every **past-tense / "just happened" transition** framing — #4 "Definition named / Scope clarified," #7 "This moved the point forward," and the "just resolved" reading of #2. These need a true before→after diff (a turn-delta) or a persisted confirmation flag that **does not exist** in the board today. Synthesizing one would either lie about a transition or require the very persistence this card's UI slice forbids. They are deferred to a **transition-delta card** (`UX-FEEDBACK-DELTA-001`, see §17) and/or the **operator-gated clarity-annotation persistence slice** (GATE-C).

**This card therefore ships as a small, restrained, STATE-REFLECTIVE feedback layer + ONE local ephemeral anchoring cue — never a transition-event system, never a rating tally, never a score.** The reward is **clarity**, expressed as a calm one-line acknowledgement that the *board is now in a more-resolved shape*, not applause for the user.

**Crucial reframe vs the issue:** issue #690 (and design-package Screen 08) describe a **chip surface participants/observers TAP to rate** a response ("Answered the point / Helped clarify / Brought needed evidence / Narrowed the disagreement" + "flag what's missing"). A tap-to-rate chip set **IS a rating input** — even when worded as "clarity," a user-submitted per-response rating that is counted or persisted is a like/vote/popularity tally by another name, and the issue itself flags this as the high doctrine risk and splits persistence out + gates it. **This design does NOT ship the tap-to-rate chip set as a rating input.** It ships the *clarity payoff* the screen is reaching for — a restrained, mediator-marks-the-board acknowledgement of structural progress that is already true in the board — and **defers the interactive rating-chip surface to the operator-gated persistence slice** (the only honest home for a user-submitted rating). See §8 Open Questions Q1 — this is the central operator decision.

---

## §0 Scope-reality audit (POSTRUN-UX001 rule — orchestrator-authored card, audit BEFORE build)

This card's success depends on **what the board can express about the current state, what render homes already exist, and whether any transition signal is available** — so a pre-build reality audit was run against the shipped stack at base `8e360b3`. The audit reshapes the card from "build the Screen-08 tap-to-rate clarity-feedback surface" into a **restrained state-reflective acknowledgement layer + one local ephemeral cue**, because (a) the board carries no transition/delta data, (b) a tap-to-rate rating is a persisted input the UI slice forbids, and (c) most of the *structural-progress* states the screen wants to celebrate are **already rendered** by the mediator stack (impasse, narrowed, evidence-blocked) — this card adds a calm acknowledgement *framing*, not new derivation.

### Finding A — the board is STATELESS; it carries no transition / delta / "what just changed"

`MediatorBoardState` (`mediatorBoardTypes.ts`) is a pure re-projection of *current* room rows (lifecycle map + evidence debts + persisted observations). It has **no field for "previous state," "delta since last turn," or "this response caused X."** `inputHash` exists for memoization, not for diffing two snapshots. So **every "just happened" / past-tense feedback moment is a TRANSITION the board cannot express today.** This is the single fact that drives the entire §3 verdict: state-reflective ("is narrowed now") = safe; transition ("just narrowed") = deferred.

### Finding B — a tap-to-rate clarity chip set is a PERSISTED RATING INPUT — out of the UI slice by the issue's own boundary

Screen 08's "How did this response move the point?" chips + "Save feedback" are an **input the user submits about a response.** To be meaningful it must be **counted or persisted** (otherwise "Save feedback" saves nothing). A counted/persisted per-response user rating is — regardless of the "clarity" wording — a like/vote/popularity tally (doctrine §1/§2/§3; the issue's own Problem + Non-goals say exactly this). The issue **splits persistence out + operator-gates it** ("Any persistence is private clarity annotation, split out + operator-gated; the UI slice ships first"). **Audit conclusion:** the *interactive rating chip surface* cannot ship as a real feature in the UI slice (a chip set that saves to nothing is dead chrome; a chip set that saves is the gated persistence slice). What CAN ship is **restrained, board-derived acknowledgement** that needs no user input and no persistence. The tap-to-rate chips are **deferred to the operator-gated persistence slice** (Q1).

### Finding C — the structural-progress states the screen celebrates ARE ALREADY RENDERED

- **Impasse** ("Disagreement preserved.") — fully shipped by UX-IMPASSE-001 (`IMPASSE_SUBTYPE_COPY.structured_impasse`, rail row, helper). This card adds **nothing** here; it cross-refs.
- **Narrowed / concession** ("The disagreement is smaller now.") — shipped by UX-IMPASSE-001 (`IMPASSE_SUBTYPE_COPY.narrowed` + `MEDIATOR_STATE_HELPER.narrowed`). This card adds at most a **calm acknowledgement sub-line** ("The board is cleaner now.") where the point IS narrowed — state-reflective, not a new state.
- **Evidence-blocked / needs-evidence** — shipped by UX-MEDIATOR-003. The "source path clarified" payoff is the **resolved** end of the same debt model (`evidenceDebtDisplay`), which is current state.
- **Next move** ("The next useful move is clearer.") — shipped by UX-NEXT-MOVE-001 (`MediatorNextMovesCard` in the Inspect drawer's "Move forward:" slot). This card adds at most a calm lead-in, not a new move surface.

**Audit conclusion:** the card's *real* delta is a tiny pure helper + a few calm acknowledgement lines rendered in **already-mounted** local surfaces (the selected-node readout anchor; the Inspect drawer; the rail row), plus one **local ephemeral anchoring cue.** No new screen, no new mount site, no topology change.

### Finding D — `feedbackForMediatorProgress` does not exist; net-new (issue GAP 7)

No `feedbackFor*`, `clarityFeedback*`, or `FeedbackChip*` symbol exists under `src/` or `__tests__/` (grep-confirmed). The pure helper this card introduces is net-new and collision-free.

**Effort re-estimate:** issue labels this **M**. Given Findings A–D, the *code* delta is **S–M**: one new pure display helper (`feedbackForMediatorProgress`, ~90–130 lines) + one new local presentational component (`MediatorProgressNote`, ~70–110 lines) + a small local ephemeral anchoring cue + ~10–20 lines of wiring across **already-mounted** surfaces + tests (ban-list-heavy, 9-state coverage, a11y, no-rating-affordance). Keep **M**; the work is doctrine-care + test-surface heavy, not derivation-heavy. **This is NOT a design-only-stop card** — a safe mount point exists for every safe-now element. But the *interactive rating surface* in the issue's headline **is** deferred (Q1) — that is the one genuine scope correction.

---

## Goal (one paragraph)

Make CivilDiscourse feel quietly satisfying when a disagreement's **structure improves** — without ever rewarding popularity, applause, or the person. When a point is anchored, a source path is clarified, a broad clash is narrowed, a concession improves the board, or a point reaches a dignified impasse, the surface offers a **restrained, one-line acknowledgement that the board is now in a more-resolved shape** — the reward is **clarity**, expressed the way a mediator marks the board cleanly, never the way an app praises a user. It does this by reading the board derived **once** in `ArgumentGameSurface` (single-derivation invariant; never re-derived) through a new **pure display helper** (`feedbackForMediatorProgress(state | point)`) that maps **current** structural state to a calm acknowledgement line, plus **one local ephemeral anchoring cue** on the existing responding-to anchor. It introduces **no rating, no like, no vote, no score, no streak, no count-as-popularity, no badge, no confetti, no winner/loser, no truth/correctness semantics, and no transition-event detection.** It stays a pure read-only projection (no derivation of persisted state, no network/AI, no mutation) and **never gates submission** — the deterministic Constitution engine (`src/domain/constitution/engine.ts`) remains the sole acceptance gate. Doctrine (`cdiscourse-doctrine` §1/§2/§3/§4/§9/§10a): structure-only, person-neutral language; no truth/verdict/winner/loser/score/heat/popularity/like/credibility/intent token; the engine is the sole gate; classifiers advisory; the past-tense "just happened" framings are deferred (no synthesized transition); insufficient signal → render nothing.

---

## Data model

**No new data model. No new persisted shape. No new type/field on `MediatorBoardState`. No migration. No table. No RLS.**

The card adds ONE new **pure presentation type** (display-only, never persisted, never on the board, never written):

```ts
// src/features/mediator/feedbackForMediatorProgress.ts (NEW — pure TS, no React)

import type { V4MediatorStateCode } from './mediatorBoardTypes';

/**
 * One restrained intellectual-progress acknowledgement. DISPLAY ONLY — never
 * persisted, never a field on the board, never a write, never counted. It
 * reflects the CURRENT structural state ("the board is now in a more-resolved
 * shape"), never a transition ("this just happened"), never a rating, never a
 * verdict. The reward is clarity, not applause.
 */
export interface MediatorProgressNote {
  /** Stable id for keys / testIDs (`progress-<code>`). */
  id: string;
  /** The current display state this note reflects. */
  state: V4MediatorStateCode;
  /** Ban-list-clean acknowledgement line (the visible text). */
  line: string;
  /**
   * The tone the renderer dresses it with (restrained):
   *   - 'dignified'  → restrained gold (BRAND.accent.gold) — structural
   *                    completion / impasse / a settled shape.
   *   - 'progress'   → indigo/purple (GLOW.activePath / focusRing) — an
   *                    active improvement (narrowed / clearer next move).
   *   - 'neutral'    → no accent — a plain calm note.
   * Color is NEVER the only signal (§accessibility); geometry/text carry it.
   */
  tone: 'dignified' | 'progress' | 'neutral';
}
```

The helper is a **pure total function over the nine `V4MediatorStateCode` display states** (so it is exhaustively testable for 100% branch coverage); a state with no safe-now acknowledgement returns `null` (render nothing). It reads **only** the display state (and, for the evidence sub-case, the point's current resolved-debt presence already on the board) — **no transition, no diff, no persisted flag.**

```ts
/** Returns the restrained progress note for a CURRENT display state, or null. */
export function feedbackForMediatorProgress(state: V4MediatorStateCode): MediatorProgressNote | null;
```

---

## File changes

All changes are **a new pure helper + a new local presentational component + small wiring in already-mounted surfaces + copy + tests.** No `src/` behavior change to derivation, no `app/` route change, no `supabase/` change.

**New:**
- `src/features/mediator/feedbackForMediatorProgress.ts` (~90–130 lines) — the pure display helper + `MediatorProgressNote` type + the frozen acknowledgement copy + the test-only ban-list re-export. Pure TS, no React, no I/O.
- `src/features/mediator/MediatorProgressNote.tsx` (~70–110 lines) — a small, pure, READ-ONLY presentational component that renders one `MediatorProgressNote` (restrained tone: gold for `dignified`, indigo for `progress`, none for `neutral`; geometry carries the signal in grayscale). RN primitives only; reuses existing tokens (`BRAND.accent.gold`, `GLOW.activePath`/`focusRing`, `SURFACE_TOKENS`, `TYPOGRAPHY`); **no new hex**, **no confetti/animation primitive**, **no Image/badge/trophy asset.** Renders `null` for a null note.
- `__tests__/uxFeedback001ProgressNote.test.tsx` (+ `__tests__/feedbackForMediatorProgress.test.ts`) — see Test plan.

**Modified (wiring only, all already-mounted surfaces — no topology change):**
- `src/features/mediator/SelectedNodeInspectDrawer.tsx` (~+6 lines, optional slot) — add an OPTIONAL `progressNote?: React.ReactNode` slot rendered as a calm note **inside the existing drawer** (no new section header by default; it sits under "Move forward:" or as a quiet lead). Backward-compatible (omitted when null). **Alternative (Q3):** render the note only in `MediatorProgressNote` mounted by the host, leaving the drawer untouched — recommended to minimize churn on the heavily-pinned wrapper.
- `src/features/arguments/ArgumentGameSurface.tsx` (~+10–15 lines, the mount site only) — compute `activeNodeProgressNote = feedbackForMediatorProgress(activeNodeDisplayState)` from the **already-derived** board (single-derivation invariant; never re-derived) and render `<MediatorProgressNote>` in (a) the selected-node readout area near the responding-to anchor (the **#1 anchoring** ephemeral cue + the state-reflective note), and (b) the Inspect drawer's existing "Move forward:" region. **No new mount site; no new gate; read-only.**
- `src/features/arguments/TimelineSelectedReadoutPanel.tsx` (~+3–6 lines, OPTIONAL — Q2) — the **#1 anchoring** ephemeral cue ("Point anchored.") on the existing responding-to anchor when a node is selected/anchored for composition. Local, ephemeral, no persistence. **Alternative:** render the cue from `MediatorProgressNote` in `ArgumentGameSurface` instead, leaving the panel untouched (recommended).

**Deleted:** none.

**Line-count estimate (major):** helper ~90–130; component ~70–110; wiring ~15–25; tests ~250–350. Net new ~150–250 production lines + tests. Small.

---

## API / interface contracts

```ts
// feedbackForMediatorProgress.ts
export interface MediatorProgressNote {
  id: string;
  state: V4MediatorStateCode;
  line: string;
  tone: 'dignified' | 'progress' | 'neutral';
}
export function feedbackForMediatorProgress(state: V4MediatorStateCode): MediatorProgressNote | null;
/** Test-only ban-list (re-exports `_forbiddenMediatorTokens` + the rating/applause guard). */
export function _forbiddenFeedbackTokens(): string[];

// MediatorProgressNote.tsx
export interface MediatorProgressNoteProps {
  note: MediatorProgressNote | null; // null → renders null
  testID?: string;
}
export function MediatorProgressNote(props: MediatorProgressNoteProps): React.ReactElement | null;

// SelectedNodeInspectDrawer.tsx (additive, backward-compatible)
export interface SelectedNodeInspectDrawerProps {
  // ...existing slots unchanged...
  progressNote?: React.ReactNode; // OPTIONAL; omitted when null (no dangling chrome)
}
```

**The safe-now acknowledgement copy (frozen, ban-list clean), keyed by current display state:**

| display state | safe-now note `line` | tone | source signal (current state) |
|---|---|---|---|
| `structured_impasse` | "The disagreement is preserved." | `dignified` | `IMPASSE_SUBTYPE_COPY.structured_impasse.lead` (UX-IMPASSE-001 — cross-ref, do not duplicate the render) |
| `narrowed` | "The board is cleaner now." | `progress` | `point.state === 'narrowed'` (current) |
| `needs_evidence` | (none — render nothing; "needs" is not progress) | — | — |
| `evidence_blocked` | (none by default — render nothing; blocked is not progress) | — | — |
| `definition_not_shared` | (none — "named" is deferred TRANSITION; bridge prompt already ships) | — | — |
| `scope_mismatch` | (none — "clarified" is deferred TRANSITION; bridge prompt already ships) | — | — |
| `missing_mechanism` | (none) | — | — |
| `accounts_differ` | (none — never synthesized in v1) | — | — |
| `open` | (none — open is not progress) | — | — |

Plus the operator-allowed neutral lines, rendered as **context**, not per-state acknowledgement:
- "The next useful move is clearer." — `progress` tone, rendered as a quiet lead-in to the existing `MediatorNextMovesCard` (UX-NEXT-MOVE-001) when a move set exists.
- "Nothing new is available to test this point right now." — `neutral` tone, the calm impasse-adjacent line (folds into UX-IMPASSE-001's "No available next move would test this point further yet." — cross-ref, prefer the shipped wording).

The **#1 anchoring** ephemeral cue ("Point anchored.") is rendered by the host on the local selection event, `progress` tone, never persisted.

**Note on restraint:** the helper deliberately returns `null` for the majority of states. Most of the board's life is "open / needs evidence / not yet bridged" — and *none of that is progress to celebrate.* The acknowledgement appears **only** where the board is genuinely in a more-resolved shape (narrowed, impasse) or where a useful next step is clear. This is the doctrine of restraint: a quiet note when structure improves, silence otherwise.

---

## §4 THE MAPPING TABLE (core deliverable)

Legend: **B-touched** = behavior touched (state/handlers); **D/API** = data/API touched; **default-vis** = default-visible vs Inspect-only; **safe** = safe-now vs deferred. All copy is ban-list clean, person-neutral, advisory (never a gate).

| # | Surface | Current implementation | Feedback opportunity | Current signal / source | Proposed copy | Visual treatment | Default-visible / Inspect-only | B-touched | D/API | Risk | Safe-now / deferred | Test coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Selected-node responding-to anchor** (`TimelineSelectedReadoutPanel`, UX-SELECTED-NODE-001) | Renders "Responding to this point" + parent excerpt; fires on node selection | Quiet acknowledgement that the response is bound to a point | **Local selection event** (`setActiveMessageId` / anchor render) — ephemeral, no persistence | "Point anchored." | indigo `progress` tone; tiny inline note by the anchor; geometry (left rule) + text | **default-visible** (compact) | n (render on existing event) | **n** | reads as applause if loud | **SAFE-NOW** (local ephemeral cue) | render-on-anchor; absent for root; ban-list |
| 2 | **Evidence (resolved debt)** | `evidenceDebtDisplay` (UX-MEDIATOR-003) renders debt status; resolved debts already drop off the live list | "A source path is clarified here" — STATIC framing only | `board.evidenceDebts[].status === 'resolved'` (current) | "Source path clarified." (only where a debt IS resolved on the point; **never** "just resolved") | gold `dignified` tone (a settled obligation) | **Inspect-only** (in the drawer) | n | **n** (reads current `status`) | "just resolved" temptation → transition | **SAFE-NOW (static framing only); DEFER the just-happened framing** | resolved-debt static note; assert NO "just"/past-tense transition copy |
| 3 | **Narrowing** | `point.state === 'narrowed'` already chip+rail+helper (UX-IMPASSE-001 `IMPASSE_SUBTYPE_COPY.narrowed`) | Acknowledge the board got cleaner | `point.state === 'narrowed'` (current) | "The board is cleaner now." (sub-line under the shipped "The disagreement is smaller now.") | indigo `progress` tone | **default-visible** (on the narrowed point) + Inspect | n | **n** | duplicate of shipped narrowed copy | **SAFE-NOW** | narrowed-point note; lockstep with shipped narrowed copy (no contradiction) |
| 4 | **Definition / scope named** | `definitionScopeBridgeDisplay` (UX-MEDIATOR-004) renders the bridge **prompt** (the un-bridged state) | "Definition named." / "Scope clarified." (past-tense success) | **None** — current state only says `definition_not_shared` / `scope_mismatch` (un-bridged); no "confirmed/named" producer | (deferred) — ship only the existing advisory bridge prompt | (n/a — deferred) | (deferred) | n | n | inventing a "named" transition | **DEFER** (transition; no signal — do not invent) | test asserts NO "Definition named"/"Scope clarified" past-tense copy renders today |
| 5 | **Concession** | folds into `narrowed` (UX-IMPASSE-001 §3 #4) | Concession is progress, not a loss | `point.state === 'narrowed'` (same as #3) | "Concession preserved." (reuse the narrowed note; concession framing) | indigo `progress` tone | **default-visible** + Inspect | n | **n** | reads as scoring a concession | **SAFE-NOW** (same signal as #3) | concession-on-narrowed note; assert no win/loss/score token |
| 6 | **Impasse** | UX-IMPASSE-001 renders "The disagreement is preserved." (chip/rail/helper/next-move) | Dignified, complete destination | `point.state === 'structured_impasse'` + `pathway.anyAvailable === false` (current) | "The disagreement is preserved." (CROSS-REF UX-IMPASSE-001 — do NOT add a second render) | gold `dignified` tone (already shipped via impasse left-rule geometry) | already-visible (rail/Inspect) | n | **n** | double-rendering the impasse line | **SAFE-NOW (cross-ref only; this card adds NO new impasse render)** | regression: impasse copy unchanged; no duplicate note |
| 7 | **Inspect / rail "Move forward:" lead-in** | `MediatorNextMovesCard` (UX-NEXT-MOVE-001) in the drawer's "Move forward:" slot | "The next useful move is clearer." | the existing per-point pathway / `nextMovesForState` (current) | "The next useful move is clearer." (quiet lead-in, only when a move set exists) | indigo `progress` tone | **Inspect-only** (in the drawer) | n | **n** | competes with the move card title | **SAFE-NOW** (static guidance lead-in) | lead-in renders only with a move set; ban-list |
| 8 | **Per-response "this moved the point forward"** | none | Claim a specific response advanced the shape | **None** — needs before→after diff across that response (transition the board lacks) | (deferred) | (deferred) | (deferred) | n | n | inventing a per-response transition | **DEFER** (transition; no signal) | test asserts NO per-response "moved it forward" claim renders |
| 9 | **Tap-to-rate clarity chip set** (Screen 08 headline: "Answered the point / Helped clarify / Brought needed evidence / Narrowed the disagreement" + "flag what's missing" + "Save feedback") | none (net-new) | User-submitted per-response clarity rating | **None safe** — a counted/persisted user rating is a like/vote/popularity tally (doctrine §1/§2/§3); the issue itself splits + gates persistence | (deferred to the operator-gated persistence slice) | (deferred) | (deferred) | y (if shipped) | **y** (persistence) | **the central doctrine risk** | **DEFER** (operator-gated persistence slice — Q1) | test asserts NO tap-to-rate rating affordance, NO "Save feedback" button, NO like/vote/score chip renders in the UI slice |

**Safe-now vs deferred summary:** rows **1, 2 (static), 3, 5, 6 (cross-ref), 7** are **safe-now** (state-reflective copy + one local ephemeral cue + cross-refs). Rows **4, 8, 9** are **deferred** — each needs a transition diff (4, 8) or a persisted rating input (9) that the board/UI slice does not and must not carry. None is invented.

---

## §5 WHERE each shipped feedback renders + its deterministic signal

All renders are **LOCAL** to already-mounted surfaces — **no global banner, no new notification system, no new screen, no topology change.**

| Feedback | Renders in (already-mounted) | Deterministic signal | Tone / treatment |
|---|---|---|---|
| **"Point anchored." (#1)** | the selected-node responding-to anchor area (`TimelineSelectedReadoutPanel` compact / the host near it) | the local node-selection event (`activeMessageId` set) | indigo, tiny inline note + left-rule geometry |
| **"The board is cleaner now." (#3) / "Concession preserved." (#5)** | the narrowed point's note line (default-visible, near the shipped narrowed helper) + the Inspect drawer | `v4DisplayStateFor(point.state) === 'narrowed'` | indigo `progress`; geometry left-rule |
| **"Source path clarified." (#2, static)** | the Inspect drawer (under "Move forward:" / structure notes) | `board.evidenceDebts` shows a `resolved` debt on the point | gold `dignified`; no animation |
| **"The next useful move is clearer." (#7)** | the Inspect drawer's "Move forward:" region, as a quiet lead-in to `MediatorNextMovesCard` | a non-empty `nextMovesForState(displayState)` | indigo `progress` |
| **"The disagreement is preserved." (#6)** | **already rendered by UX-IMPASSE-001** (rail row / Inspect / helper) — this card **does not re-render it** | `structured_impasse` + `pathway.anyAvailable === false` | gold/dignified (shipped impasse geometry) |

The board is read **once** (`ArgumentGameSurface` single-derivation site); `feedbackForMediatorProgress` is a pure consumer; `MediatorProgressNote` is a pure renderer. **It can stay entirely LOCAL UI/copy — it does NOT require HALT.** No board topology, no persistent rail, no timeline geometry, no rail relocation, no route/model/table change, no persistence/migration/RLS, no provider/MCP, no classifier, no submit-path change.

---

## §6 The smallest-safe delta (files / helpers) + what stays

### NEW — `src/features/mediator/feedbackForMediatorProgress.ts` (pure TS)
The pure helper + `MediatorProgressNote` type + frozen acknowledgement copy + `_forbiddenFeedbackTokens()`. Total over the nine display states; returns `null` for non-progress states. No I/O, no transition, no persisted read beyond the already-derived board's current state.

### NEW — `src/features/mediator/MediatorProgressNote.tsx` (pure presentational)
Renders one note with restrained tone. Gold for `dignified`, indigo for `progress`, none for `neutral`; **geometry (a left rule) carries the tone in grayscale** (color is never the only signal). No confetti, no badge, no trophy, no Image asset, no animation primitive beyond what reduce-motion already governs (prefer static). `null` note → `null` render. `accessibilityRole="text"`; the note is informational, not interactive (so no 44×44 target needed — it is not a Pressable).

### CHANGE — `src/features/arguments/ArgumentGameSurface.tsx` (mount-site wiring only, ~10–15 lines)
Compute `activeNodeProgressNote = feedbackForMediatorProgress(activeNodeDisplayState)` from the already-derived board; render `<MediatorProgressNote>` near the responding-to anchor (default-visible) and in the Inspect drawer region. The **#1 "Point anchored."** cue is rendered here on the existing selection event (or passed to the panel). No new gate, no new mount site, read-only.

### CHANGE (optional, Q3) — `src/features/mediator/SelectedNodeInspectDrawer.tsx` (~+6 lines)
Add an optional `progressNote` slot. **Recommended alternative:** skip this and render `MediatorProgressNote` from the host, leaving the pinned wrapper byte-stable.

### CHANGE (optional, Q2) — `src/features/arguments/TimelineSelectedReadoutPanel.tsx` (~+3–6 lines)
The "Point anchored." cue inline on the anchor. **Recommended alternative:** render from the host.

### UNTOUCHED (preserve byte-for-byte / behavior)
- `deriveMediatorBoardState.ts`, `mediatorBoardTypes.ts` (no new field/state/precedence), `mediatorPlainLanguage.ts` (impasse/narrowed copy unchanged — cross-ref, do not edit), `nextMovesForState.ts`, `MediatorNextMovesCard.tsx`, `MediatorNodeInspectDetail.tsx`, `MediatorNodeMarker.tsx`, `nodeMediatorMarkers.ts`, `DisagreementPointsRail.tsx`, `mediatorRailCopy.ts`, `evidenceDebtDisplay.ts`, `definitionScopeBridgeDisplay.ts`.
- The single-derivation site (`deriveRoomMediatorBoardState` in `ArgumentGameSurface`) — invariant preserved; board consumed, never re-derived.
- The engine (`src/domain/constitution/engine.ts`) — never imported; gate-independence is structural.

**Confirm:** NO score / like / vote / ranking / streak / count-as-popularity system; NO new primary state chip (the one-chip invariant from UX-MEDIATOR-002 holds — the progress note is a calm *note*, not a second chip); NO topology change; NO new persisted shape; NO transition-event detection.

---

## Edge cases (the implementer must handle)

- **Root node / no parent** — the "Point anchored." anchor cue is omitted cleanly (no empty chrome), exactly like the responding-to anchor it rides.
- **No active node** — `feedbackForMediatorProgress` is not called; nothing renders.
- **Non-progress state (open / needs_evidence / evidence_blocked / definition_not_shared / scope_mismatch / missing_mechanism / accounts_differ)** — the helper returns `null`; the note renders nothing. This is the common case (restraint by default).
- **Impasse point** — this card renders **no new note** (cross-ref UX-IMPASSE-001 to avoid double-rendering "The disagreement is preserved."). A test asserts the impasse line appears exactly once.
- **Resolved debt absent** — the "Source path clarified." note does not render unless a `resolved` debt exists on the point now.
- **Reduce-motion** — there is no animation to begin with (no confetti, no scale-on-appear); the note is static text + geometry. Confirm no new motion is introduced.
- **Grayscale / color-blind** — gold vs indigo tone is carried by a left-rule geometry + the line text, never by color alone (a grayscale snapshot must stay legible).
- **390px width** — the note is a single inline line; it wraps, never overflows.
- **Insufficient / unknown state** — collapse to `null` (render nothing), never to a stronger claim.
- **Duplicate-render guard** — the narrowed/impasse copy is shipped by UX-IMPASSE-001; this card's note must not contradict or duplicate it (the narrowed note is an *additive* "The board is cleaner now." sub-line, not a second "smaller now" line).

---

## Test plan

New files `__tests__/feedbackForMediatorProgress.test.ts` (pure helper) + `__tests__/uxFeedback001ProgressNote.test.tsx` (render + a11y) + targeted regression extensions.

- **Helper totality + 100% branch (pure).** For every `V4MediatorStateCode` in `ALL_V4_MEDIATOR_STATE_CODES`, assert `feedbackForMediatorProgress(state)` returns either a `MediatorProgressNote` (only for `narrowed` / progress states) or `null` (all non-progress states), and that the result is stable (same input → same output). Assert `structured_impasse` does NOT emit a new note here (cross-ref to UX-IMPASSE-001 is the render path).
- **Restraint assertion.** Assert the helper returns `null` for `open`, `needs_evidence`, `evidence_blocked`, `definition_not_shared`, `scope_mismatch`, `missing_mechanism`, `accounts_differ` (most of the board's life is not progress).
- **No-transition assertion.** Assert NO produced `line` contains a past-tense "just happened" transition token (`just`, `now resolved`, `just narrowed`, `just defined`, `moved it forward`, `you defined`, etc.) — the helper is state-reflective, never transition-claiming.
- **DOCTRINE ban-list (the load-bearing test).** Scan every produced `line` + the component's rendered strings against `_forbiddenFeedbackTokens()` = `_forbiddenMediatorTokens()` **plus** an applause/rating guard: `like`, `likes`, `upvote`, `vote`, `score`, `points`, `point earned`, `streak`, `rank`, `ranking`, `leaderboard`, `popular`, `popularity`, `applause`, `congrat`, `congratulations`, `great job`, `good job`, `nice`, `well done`, `trophy`, `badge`, `winner`, `loser`, `correct`, `wrong`, `truth`, `verdict`, `confetti`, plus the person-attribution tokens (`you`, `your`, `they`, `their`, `the user`, etc.). Assert NONE appears.
- **No-rating-affordance assertion (the issue's central doctrine test).** Render the feedback surface and assert there is **NO tap-to-rate chip set**, **NO "Save feedback" button**, **NO like/upvote/vote control**, **NO popularity/heat/score count**, **NO leaderboard** — `MediatorProgressNote` is informational `<Text>`, not a Pressable, and exposes no `onPress` rating handler.
- **No-write-to-standing assertion.** Assert the feedback helper/component import nothing from `pointStanding` / `argumentScoreModel` / the engine, and never call any write/mutation — the notes do not feed point-standing or any ranking.
- **State-reflective render (component).** Narrowed point → "The board is cleaner now." renders (indigo tone, left-rule geometry). Resolved-debt point → "Source path clarified." renders (gold tone). Non-progress point → nothing renders. Null note → null render.
- **Anchoring cue (#1).** With a non-root active node selected, "Point anchored." renders by the anchor; root node → omitted cleanly.
- **No-duplicate-impasse.** With a `structured_impasse` point, assert "The disagreement is preserved." renders exactly once (from UX-IMPASSE-001's surface), not twice.
- **A11y + 390px + reduce-motion + grayscale.** Note legible at 390px (wraps, no overflow); `accessibilityRole="text"`; no new animation (reduce-motion no-op); grayscale snapshot legible (geometry + text carry tone, not color).
- **Regression (full suite).** Re-run `__tests__/{uxImpasse001*,uxNextMove001*,uxMediator00*,uxSelectedNode001*,nodeMediatorMarkers,MediatorNodeMarker,MediatorNodeInspectDetail,MediatorNextMovesCard,SelectedNodeInspectDrawer,DisagreementPointsRail,timelineSelectedReadout*,uxOneOneTwoReadoutCompactMode}.test.*` — all green; impasse/narrowed/next-move/rail behaviors unchanged. Capture the explicit `Test Suites: … / Tests: …` line + exit 0 (test-discipline gate-timeout rule — no tailed run).
- **Gates:** `npm run typecheck`, `npm run lint`, `npm run test` all exit 0 (full suite); test count goes UP.

---

## Dependencies (cards / docs / files)

- **Depends on (merged):** UX-MEDIATOR-001 (`v4DisplayStateFor` + the 9 states), UX-MEDIATOR-002 (one chip + Inspect caret + `MediatorNodeInspectDetail`), UX-MEDIATOR-003 (evidence-blocked / debt model), UX-MEDIATOR-004 (definition/scope bridge), UX-MEDIATOR-005 (rail), UX-SELECTED-NODE-001 (`SelectedNodeInspectDrawer`, responding-to anchor), UX-NEXT-MOVE-001 (`nextMovesForState` + `MediatorNextMovesCard`), UX-IMPASSE-001 (dignified impasse + narrowed copy). `docs/designs/UX-MEDIATOR-001..005.md`, `UX-SELECTED-NODE-001.md`, `UX-NEXT-MOVE-001.md`, `UX-IMPASSE-001.md`.
- **Extends:** #158 (MCP-008) — builds the clarity-feedback *surface*; does NOT re-implement MCP feedback plumbing. **Folds:** UX-CLARITY-RATING-001 intent (the deferred, not-filed P2 card — its rating-scale intent is the deferred persistence slice here, not a new screen).
- **Reads existing (no re-derivation):** the once-derived `mediatorBoard`, `v4DisplayStateFor`, `IMPASSE_SUBTYPE_COPY` (cross-ref, do not edit), `nextMovesForState`, the responding-to anchor, the `BRAND.accent.gold` / `GLOW.activePath` / `focusRing` tokens.
- **Single-derivation invariant** (`memory: mediator-board-single-derivation`): the board is derived ONCE and shared; this card consumes it, never re-derives.
- **Engine path** (`memory: claude-md-engine-path-stale`): the live engine is `src/domain/constitution/engine.ts`; this card imports neither engine — gate-independence is structural.
- **Will block:** any future `UX-FEEDBACK-DELTA-001` (transition-delta moments #4/#8) and the operator-gated clarity-annotation persistence slice (#9) build on this card's helper + note component as the display layer.
- **Design source of truth:** `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md` (#690 row; GAP 7), `docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md` (Screen 08 L129), `docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md`.

---

## Risks

- **R1 — gamification drift (the defining risk).** A "feedback moment" naturally tempts applause/score/rating. **Mitigation:** the helper returns `null` for most states (restraint by default); the ban-list test (rating/applause guard) is the hard gate; the no-rating-affordance test forbids any tap-to-rate / Save / like control; the no-write-to-standing test forbids feeding standing.
- **R2 — transition temptation.** "Claim narrowed" / "Definition named" / "This moved it forward" read as transitions; the board has no delta (Finding A). **Mitigation:** §3 verdict ships only STATIC framings; the no-transition test forbids past-tense "just happened" copy; #4/#8 are deferred, not synthesized.
- **R3 — double-rendering impasse/narrowed.** UX-IMPASSE-001 already renders these. **Mitigation:** this card cross-refs (no new impasse render) and the narrowed note is an *additive* sub-line; a no-duplicate-impasse test guards it.
- **R4 — the issue's headline (tap-to-rate chip set) is deferred.** An implementer/operator may expect Screen 08's interactive chips. **Mitigation:** Finding B + Q1 make the deferral explicit and name the only honest home (operator-gated persistence). The display slice still delivers the *clarity payoff* the screen reaches for.
- **R5 — heavily-pinned mount file.** `ArgumentGameSurface.tsx` snapshots are sensitive. **Mitigation:** the delta is additive (one note component near an existing anchor + in the existing drawer region); recommend rendering from the host rather than editing the pinned `SelectedNodeInspectDrawer`/`TimelineSelectedReadoutPanel` (Q2/Q3); run the full suite, not a tailed run.
- **R6 — color-only signal.** Gold vs indigo could carry meaning by color alone. **Mitigation:** geometry (left rule) + the line text carry the tone; grayscale snapshot test.

---

## Out of scope (explicit non-goals)

- **NO likes, upvotes, votes, popularity/heat counts, leaderboard, ranking, streaks, status badges, score, points.** (Doctrine §1/§2/§3; the issue's Non-goals.)
- **NO tap-to-rate clarity chip set as a rating INPUT, NO "Save feedback" button** in the UI slice — deferred to the operator-gated persistence slice (Q1).
- **NO transition-event detection / before→after diff** — the "just happened" / past-tense moments (#4 Definition named, #8 per-response "moved it forward", and the "just resolved" reading of #2) are deferred; no signal is invented.
- **NO feeding point-standing or any ranking** from these notes — the notes are display-only and import nothing from standing.
- **NO new persisted rating/score/event table, NO migration, NO RLS, NO Supabase write, NO service-role.**
- **NO winner/loser, truth/verdict, correctness, red/green, AI-judged, person/intent/honesty/credibility labels, confetti, trophy, applause language.**
- **NO board topology, persistent rail/column, timeline geometry, rail relocation, new primary state chip, new screen, global banner, or new notification system.**
- **NO classifier/MCP/provider/Family J/K, NO submit-path change, NO room/seat/chime-in semantics change, NO route/model/table/type rename, NO package install, NO deployment, NO netlify-prod.**
- **NO impasse re-render** — cross-ref UX-IMPASSE-001.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the notes are structural acknowledgements ("the board is cleaner now," "the disagreement is preserved") — never who is right/won/true. The helper/component import nothing from the engine and gate nothing; the deterministic Constitution engine remains the sole acceptance gate. No score is produced or shown. PASS.
- **§2 (heat ≠ truth):** no heat/temperature/activity-count/hot token anywhere; the notes reflect *structure*, never activity or trending. PASS.
- **§3 (popularity is not evidence):** **no like/vote/upvote/popularity/engagement/view/follower token, no count-as-popularity, no rating tally.** The tap-to-rate chip set (a popularity input by another name) is deferred + gated. The notes never feed standing or any ranking (asserted by test). PASS.
- **§4 (AI moderator limits):** no AI call from the production app; the notes are deterministic projections of current state, advisory, never modify/hide/delete content, never assert truth. PASS.
- **§9 (plain language):** every line is plain English authored ban-list-clean; no internal code / snake_case reaches the UI (the helper keys off the typed display state, never echoes a code). PASS.
- **§10a (Observations vs Allegations):** the progress note is a machine-derived *Observation* of structure; it never implies a person made a claim, never collapses into "tags," and renders no sensitive composer-only Observation. PASS.
- **§10 (v1 scope):** no voting/winner, no search, no OAuth, no push, no public API, no realtime body editing. The deferred rating slice is explicitly NOT a vote. PASS.
- **accessibility-targets:** the note is informational `<Text>` (not a Pressable — no 44×44 needed); tone carried by geometry + text (grayscale-legible); no new animation (reduce-motion no-op); 390px-safe. PASS (plan).
- **expo-rn-patterns:** RN primitives only (`View`/`Text`); reuses `designTokens` (`BRAND.accent.gold`/`GLOW.activePath`/`focusRing`/`SURFACE_TOKENS`/`TYPOGRAPHY`); no new dependency, no new hex, no confetti/badge/Image asset. PASS.
- **test-discipline:** pure-helper tests (totality, 100% branch, restraint, no-transition, ban-list) + render/a11y tests (state-reflective render, no-rating-affordance, no-write-to-standing, anchoring cue, no-duplicate-impasse, 390px, reduce-motion, grayscale) + full regression; test count up; full-suite exit-0 gate. PASS (plan).

---

## §8 Open questions for the operator (each with a designer recommendation)

- **Q1 (THE central decision — which moments SHIP vs DEFER; and the tap-to-rate chip set).** This design ships the **state-reflective acknowledgement** moments (#1 anchoring, #3 narrowing, #5 concession, #2 evidence-static, #6 impasse-crossref, #7 next-move lead-in) and **defers** the transition moments (#4 definition/scope named, #8 per-response "moved it forward") and the **interactive tap-to-rate clarity chip set + "Save feedback"** (#9) to the operator-gated persistence slice. **Recommendation: ACCEPT this split.** The tap-to-rate chips cannot ship honestly in the UI slice — a chip set that saves to nothing is dead chrome; a chip set that saves is the gated persistence slice (a per-response user rating, which is the doctrine risk the issue itself flags). The display slice delivers the *clarity payoff* the screen reaches for without any rating input. If the operator wants the chip set sooner, it must come with the persistence slice's GATE-C review (private clarity annotation, RLS, no public tally — and even then, never counted as popularity).
- **Q2 (default-visible vs Inspect-only).** Recommendation: **#1 anchoring + #3/#5 narrowing/concession are default-visible** (calm, near the selected node — the user should feel the board got cleaner without opening Inspect); **#2 evidence-static + #7 next-move lead-in are Inspect-only** (they're context for a deeper read). This keeps the default view quiet (one chip + one optional calm note), not noisy. The operator may move #3/#5 to Inspect-only if even a calm default note feels too app-like.
- **Q3 (visual treatment + where the note mounts).** Recommendation: **restrained gold (`BRAND.accent.gold`) for `dignified` (impasse/settled), indigo (`GLOW.activePath`/`focusRing`) for `progress` (narrowed/clearer-move), no accent for `neutral`** — geometry (a thin left rule) carries the tone in grayscale. **Mount the note from the host (`ArgumentGameSurface`)** rather than editing the pinned `SelectedNodeInspectDrawer`/`TimelineSelectedReadoutPanel`, to minimize snapshot churn (Q3 alternative). **No confetti, no badge, no trophy, no animation** — the satisfaction is the clean mark, not a celebration.

---

## §17 Deferrals (named follow-up cards)

- **`UX-FEEDBACK-DELTA-001`** (transition moments) — the past-tense / "just happened" feedback (#4 "Definition named" / "Scope clarified," #8 per-response "This moved the point forward," and the "just resolved" framing of #2). Requires a deterministic turn-delta (a before→after board diff) or a persisted confirmation flag — neither exists today. Do NOT invent the signal.
- **Operator-gated clarity-annotation persistence slice** (GATE-C) — the interactive tap-to-rate clarity chip set + "Save feedback" (#9). Modeled as **private clarity annotation** (not a public tally, never counted as popularity, never fed to standing/ranking), with its own migration + RLS (insert-by-author / select-own) + Edge Function review. This is the only honest home for a user-submitted per-response rating. Folds the deferred UX-CLARITY-RATING-001 intent.
- **UX-IMPASSE-001 / UX-NEXT-MOVE-001 / UX-MEDIATOR-003/004** — own the impasse / next-move / evidence / definition-scope renders; this card cross-refs them and adds only calm acknowledgement lines, never re-rendering their surfaces.

---

## Operator steps (if any)

**None for the display slice — pure code change.** No `db push`, no `functions deploy`, no env var, no migration, no deploy, no netlify-prod. The display slice ships a UI/copy delta merged via the normal green-PR path; the single-derivation site picks it up with no operator action. The **deferred persistence slice (Q1)** would require operator steps (`npx supabase db push --linked` + an Edge Function deploy) — but that slice is NOT in this card.

---

## Orchestrator-authored brief ledger (POSTRUN-UX001 lesson)

This card's issue (#690) is orchestrator/roadmap-authored, not operator-authored. Where each design decision came from:

- **Prior-Phase framing (operator-validated source-of-truth chain):** the single-derivation invariant; the 9 display states + `v4DisplayStateFor`; the shipped impasse/narrowed/evidence/next-move copy and surfaces — all from the merged UX-MEDIATOR-001..005 + UX-SELECTED-NODE-001 + UX-NEXT-MOVE-001 + UX-IMPASSE-001 designs and the shipped code.
- **Epic framing:** Screen 08 ("Feedback · clarity, not popularity"), the component-inventory "Clarity ratings, never likes or popularity," and the doctrine strip "no likes/heat" from `CivilDiscourse v4.dc.html` (via the design-package inventory + index).
- **Operator-provided (this card's prompt):** the candidate moments (§4 #1–#7) + their copy, the visual direction (restrained gold / indigo / no confetti), the hard don'ts list, and the STATIC-vs-TRANSITION determination requirement (§3).
- **Pre-launch codebase survey (this §0 reality audit):** Finding A (board is stateless / no delta), Finding B (tap-to-rate = persisted rating input, out of the UI slice by the issue's own boundary), Finding C (impasse/narrowed/evidence/next-move already rendered), Finding D (`feedbackForMediatorProgress` net-new).
- **Resolved by orchestrator default (flagged for operator review):** the per-moment STATIC-vs-TRANSITION verdict (§3 table — which moments ship vs defer); the reframe of the tap-to-rate chip set into the deferred persistence slice (Q1); the acknowledgement copy values; the restraint default (`null` for most states); Q2 (default-visible vs Inspect-only); Q3 (visual treatment + host-mount).
- **Operator-deferred review:** Q1 (the ship/defer split + the tap-to-rate chip-set deferral — the central decision), Q2, Q3, and the named deferrals in §17. Post-ship revision (if any) should target these specific interpretations.
