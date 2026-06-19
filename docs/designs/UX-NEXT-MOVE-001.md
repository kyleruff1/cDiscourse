# UX-NEXT-MOVE-001 — "What would move this forward?" selected-node guidance (display-only; pathways reused)

**Status:** Design draft
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/688
**Base:** `aa5cfd9` · branch `feat/UX-NEXT-MOVE-001-next-move`
**Lane:** pure-TS-UI (read-only projection of the once-derived board + shipped pathway derivation) · GATE-C: **No** (no deploy / migration / provider / backend mutation; deterministic, no runtime LLM/MCP) · effort: **M**
**Depends on (all merged on main):** UX-MEDIATOR-001 (`v4DisplayStateFor` + `V4_PRIMARY_STATE_PRIORITY` + the per-state pathway) · UX-MEDIATOR-002 (one chip + `MediatorNodeInspectDetail` + chip-adjacent Inspect caret) · UX-MEDIATOR-003 (evidence copy) · UX-MEDIATOR-004 (definition/scope copy) · UX-MEDIATOR-005 (rail "Move forward:" lead-in + `pathwaysByPointId` consumption) · UX-SELECTED-NODE-001 (the `SelectedNodeInspectDrawer` + its reserved `moveForward` slot). Extends #13 (ST-002), #31 (GAL-002), #587 (REF-004), #290 (UX-001.4). Does **not** subsume #504 (CARD-VIEW-DATA-001).

---

## §5 DETERMINATION — DISPLAY-ONLY vs PERSISTENCE (read first; the load-bearing gate)

**This card is PURELY DISPLAY-DERIVABLE and reuses the existing pathway derivation. It PROCEEDS as a local, safe, pure-TS-UI card. It does NOT need any deferred infrastructure.**

The determination, point by point:

1. **The state→next-move mapping already exists in code.** `deriveMediatorBoardState.pathwayForState(pointId, state)` (`src/features/mediator/deriveMediatorBoardState.ts:789-838`) is the deterministic switch that maps each `MediatorStateCode` to an ordered `ResolutionPathwayStep[]` (each step carries a `code`, a `plainLabel`, and an `available` boolean). The board already exposes this per point as `board.pathwaysByPointId[pointId]` (a frozen `Record`, JSON-serializable). **This card REUSES that derivation; it does not invent a new model.** The §3 operator-locked map is satisfied by (a) the steps `pathwayForState` already returns, plus (b) a small **pure DISPLAY helper** that expands the per-state move *list* to the operator's full alternate set as **copy/labels** — see "smallest-safe delta" — with zero change to `point.state`, `pathwaysByPointId`, or any persisted shape.

2. **The render slot already exists.** UX-SELECTED-NODE-001 shipped `SelectedNodeInspectDrawer.tsx` with a reserved **`moveForward?: React.ReactNode`** slot and a **"Move forward:"** section header (`src/features/mediator/SelectedNodeInspectDrawer.tsx:48-54, 127-135`). Today that slot is intentionally left unset (O-5 default; the single move lives inline in `MediatorNodeInspectDetail`'s "What would help next:" line). **UX-NEXT-MOVE-001 fills that slot** with the new multi-move guidance card. This is exactly the deferral UX-SELECTED-NODE-001 §17 named ("the richer multi-chip 'what would move it forward' move-suggestion set → UX-NEXT-MOVE-001 … render slot").

3. **No new persisted next-move state.** The card reads the already-derived board (the once-derived `mediatorBoard` in `ArgumentGameSurface`, single-derivation invariant) and renders. It writes nothing, persists nothing, adds no table/column/RLS, runs no migration.

4. **No new action semantics.** The next-move suggestions are **COPY + affordances that route to EXISTING actions only** (the shipped Act-dock / `ActPopout` / side-action-rail verbs, reached via the already-wired handlers). This card may render them as **guidance/labels** and *optionally reorder the EXISTING Act-dock suggestions* — but it does NOT add any action that changes existing submit behavior, and it does NOT introduce a discrete tappable chooser with new routing/submit semantics. **A discrete tappable next-move chooser that requires NEW action semantics is DEFERRED to UX-NEXT-MOVE-002** (§ Deferrals). The doctrine line holds: the deterministic Constitution engine (`src/domain/constitution/engine.ts`) is the sole acceptance gate; this card gates nothing.

5. **No classifier / MCP / provider; deterministic.** The move set is a pure function of `v4DisplayStateFor(point.state)` (the display state) + the per-point pathway. No runtime LLM/MCP call chooses the move (issue non-goal). Same input → same output.

**Conclusion: proceed (local, safe, display-only, existing-pathway reuse).** None of the DEFER triggers in the brief §5 apply: no new persisted state, no new classifier/MCP/provider, no route/model/table/type rename, no board-topology / rail-placement change, no room/seat/chime-in semantics, no new submit-changing action, no AI-generated conclusion framed as authority.

---

## §0 Scope-reality audit (POSTRUN-UX001 rule — orchestrator-authored card, audit BEFORE build)

This card's success depends on **current source placement (where the move derivation lives) and current render placement (where the card mounts)**, so a pre-build reality audit was run against the shipped stack at base `aa5cfd9`. The audit confirms the card is a thin reconciliation delta, not a build-from-scratch.

### Finding A — the per-state move derivation ALREADY EXISTS (`pathwayForState` + `pathwaysByPointId`)

The issue says "the repo has the `MediatorNextAction` type but no UI for it (GAP)." **Accurate for the UI; the DERIVATION is richer than the issue implies.** Beyond the single `board.nextAction` (one dominant move), the board already carries **`board.pathwaysByPointId[pointId]`** — an ordered, per-point `ResolutionPathway` with `steps: ResolutionPathwayStep[]` (each `{ code, plainLabel, available }`) and an `anyAvailable` flag. `pathwayForState` (the internal switch, `deriveMediatorBoardState.ts:789-838`) is the deterministic state→steps map. So the "ordered primary moves (one dominant + alternates)" the issue asks for is **already a derived, board-level artifact** — the card consumes it; it does not re-implement the action type (issue: "builds the suggestion UI + the pure move-ranking on top; it does not re-implement the action type").

### Finding B — the render home ALREADY EXISTS (the `moveForward` slot)

`SelectedNodeInspectDrawer` (UX-SELECTED-NODE-001) already mounts under `inspectVisible && activeMessageId` in `ArgumentGameSurface.tsx:2569-2616`, with a **"Move forward:"** section and an unset `moveForward` slot. The card's home is that slot — no new mount site, no topology change.

### Finding C — the existing pathway returns FEWER alternates than the §3 operator map (the only real gap)

`pathwayForState` returns a *minimal* pathway (1-2 steps) per state — e.g. `evidence_blocked` → `[await_record (unavailable), narrow_or_branch (available)]`. The §3 operator-locked map asks for a *richer* alternate set per state — e.g. evidence_blocked → "Mark evidence unavailable" / "Branch the provable part" / "Name what kind of record would test this point." **Critically, that richer copy already exists** as the `MEDIATOR_STATE_HELPER.evidence_blocked` sentence ("Mark evidence unavailable, branch the provable part, or ask what kind of record would test this") and `MEDIATOR_STATE_HELPER.scope_mismatch`. The gap is purely a **DISPLAY-shaping** one: turn the per-state move set into the operator's full ordered alternate list as labels. This is delivered by a new **pure display helper** that maps `V4MediatorStateCode → ordered NextMove[]` (copy + a routing hint to an existing action), consuming `pathwayForState`'s codes/availability and the operator's copy — without touching `point.state` or `pathwaysByPointId`.

### Finding D — a SEPARATE composer-suggestion model exists (`suggestedMovesModel.ts`, ST-002) — do NOT conflate

`src/features/arguments/suggestedMovesModel.ts` (ST-002, the card "Extends #13") is a **lifecycle/metadata-driven composer model** (`deriveSuggestedMoves`) that routes to dock presets/actions for the *reply composer*. It is keyed off `PointLifecycleState` + manual tags + auto-metadata + source-chain, NOT off the mediator display state. UX-NEXT-MOVE-001's move set is keyed off the **9 mediator display states** (`v4DisplayStateFor`) per the §3 operator map. These are different sources and different framings (composer reply suggestions vs. "what would move *this disagreement* forward"). **This card does NOT modify or re-key ST-002**; it builds its own pure helper over the mediator pathway. The "extends #13" relationship is acknowledged (both are advisory move surfaces, both person-neutral, both route to existing actions) but the models stay separate. ST-002's `_forbiddenSuggestionTokens()` pattern is reused as a copy-test reference.

**Effort re-estimate:** issue labels this **M**. Given Findings A-D, the *code* delta is **S-M**: one new pure display helper (`nextMovesForState`, ~80-110 lines) + one new local presentational card (`MediatorNextMovesCard.tsx`, ~90-130 lines) + a ~5-line wiring change in `ArgumentGameSurface` to fill the `moveForward` slot + tests. Keep **M**; the work is copy-care + test-surface heavy (9-state map coverage, ban-list, a11y, no-chip-soup), not derivation-heavy. **This is NOT a design-only-stop card** — a safe mount point + a reusable derivation both exist.

---

## Goal (one paragraph)

For the active selected node, show a small, ordered set of **structural next moves** that could improve the *shape* of the disagreement — converting the already-derived mediator state into next moves, never into conclusions. The visible title is **"What would move this forward?"** It must NOT decide who is right / won / true / credible, and must NOT infer what anyone intended. The card consumes the board derived **once** in `ArgumentGameSurface` (single-derivation invariant; never re-derived) and the existing per-point pathway (`board.pathwaysByPointId` + `v4DisplayStateFor`), stays a **pure read-only display** (no derivation of new state, no network/AI, no mutation), and **never gates submission** — the deterministic Constitution engine remains the sole acceptance gate. The suggestions are advisory copy/affordances that route to **existing** actions; a discrete tappable chooser with new action semantics is deferred to UX-NEXT-MOVE-002. Doctrine (`cdiscourse-doctrine` §1/§2/§3/§4/§9/§10a): structural language only; no truth/verdict/winner/loser/score/heat/popularity/credibility/intent token; the engine is the sole gate; classifiers/LLM never choose or gate the move; insufficient signal → the neutral Open fallback.

---

## §3 The deterministic state → next-move map (operator-locked; the core data deliverable)

The card renders, per the active node's **v4 display state** (`v4DisplayStateFor(point.state)`), an **ordered** list: the **dominant** move first, then alternates. Each move is `{ code, label, routesTo }` where `code` is an existing `ResolutionPathwayStepCode` (or a copy-variant tagged to one), `label` is ban-list-clean operator copy, and `routesTo` is the existing action the affordance routes to (no new action). The map is a **pure total function over the nine display states**; insufficient signal collapses to `open`.

| v4 display state | Dominant move (copy) | Alternate moves (copy, ordered) | Underlying pathway step code(s) | Routes to (existing action) |
|---|---|---|---|---|
| `needs_evidence` | "Ask for a source" | "Add evidence" | `provide_source` | Act → ask source / add source (`ActPopout` / side-rail "Ask source") |
| `evidence_blocked` | "Mark evidence unavailable" | "Branch the provable part" · "Name what kind of record would test this point" | `narrow_or_branch` (available) · `await_record` (advisory copy) | Act → branch / narrow; "Mark evidence unavailable" + "Name what record" render as **guidance copy only** (no write — the persisted "mark unavailable" action is a GATE-C deferral, see Deferrals) |
| `definition_not_shared` | "Define the key term" | — | `define_term` | Act → define / clarify |
| `scope_mismatch` | "Narrow the claim" | "Branch the provable part" · "Respond to the exact point" · "Accept the narrower scope" | `narrow_or_branch` · `respond_to_point` | Act → narrow / branch / respond; "Accept the narrower scope" routes to the existing concede/narrow affordance |
| `missing_mechanism` | "Add the missing link" | "Ask for the mechanism" | `supply_mechanism` | Act → supply step / ask mechanism (challenge) |
| `narrowed` | "Continue on the smaller point" | "Concede the resolved part" | `respond_to_point` | Act → respond; "Concede the resolved part" routes to the existing concede affordance |
| `accounts_differ` | "Separate memory from records" | "Name what could verify it" | `await_record` (advisory) | guidance copy only (the recollection detector is deferred; in v1 this state is never synthesized — see §4 uncertainty) |
| `structured_impasse` | "Preserve the disagreement" | "Reopen with a source, definition, or narrower claim" | `await_record` (advisory) | guidance copy only — no available pathway by construction (impasse = no actionable step); "Reopen with…" points back at the other states' actions |
| `open` (incl. the `value_tradeoff` collapse + the insufficient-signal fallback) | "Respond to the exact point" | "Ask a clarifying question" | `respond_to_point` | Act → respond / ask clarification |

**Notes on the map (load-bearing):**

- **`value_tradeoff` collapses to `open` for display** (per the shipped `V4_DISPLAY_STATE_BY_CODE`), so a value/priorities point shows the Open moves ("Respond to the exact point" / "Ask a clarifying question"). The internal `value_tradeoff` code + its `name_tradeoff` pathway stay intact in `point.state`/`pathwaysByPointId` for Inspect; the *display card* uses the Open set. (Consistent with UX-MEDIATOR-001 O-2.)
- **`key_detail_unavailable` collapses to `evidence_blocked` for display** (shipped mapping), so it shows the evidence-blocked move set. **`off_point` collapses to `scope_mismatch`**, so it shows the scope move set. The card therefore only ever switches on the **nine** display states (`ALL_V4_MEDIATOR_STATE_CODES`) — never the 13 internal codes — making the switch total and tractable for 100% branch coverage.
- **Availability honesty.** Moves that are not actionable now (`await_record` for evidence_blocked / accounts_differ / impasse) render as **structural guidance copy**, visually distinguished from the actionable dominant move, and do NOT route to a submit-changing action. This mirrors `pathwayForState`'s `available: false` flag — the card reads that flag and renders unavailable steps as advisory text, never as a live action.
- **Determinism.** For the same `(displayState)` the helper returns the same ordered list. No randomness, no clock, no engagement/heat input. Insufficient signal (no node, no marker, or a state the map cannot resolve) → the `open` fallback list.

---

## §2 / Goal restated against doctrine — how the design satisfies the contract

The card converts the **mediator state** into **moves**, never into a conclusion:

- It reads `v4DisplayStateFor(point.state)` (already derived) → the §3 ordered move list. It never asserts who is right, who won, what is true, who is credible, or what anyone intended.
- The title is exactly **"What would move this forward?"** (matches the design export Screen 07; ban-list clean).
- Each move carries a one-line, **structure-only** rationale (e.g. "A shared definition makes this point easier to test") sourced from the shipped `MEDIATOR_STATE_HELPER` / pathway copy — never a verdict or a who's-right recommendation.
- The same move set powers Act (via routing to existing actions) and the Inspect "what would move it forward" content — by **shared source** (both read `nextMovesForState(displayState)` / the same board pathway), satisfying the issue acceptance "the same move set powers Act and the Inspect 'move forward' chips."

---

## Data model

**No new data model. No new persisted shape. No type rename.**

The card adds ONE new **pure presentation type** (display-only, never persisted, never on `MediatorBoardState`):

```ts
// src/features/mediator/nextMovesForState.ts (NEW — pure TS, no React)

import type {
  V4MediatorStateCode,
  ResolutionPathwayStepCode,
} from './mediatorBoardTypes';

/**
 * One advisory next move shown in the "What would move this forward?" card.
 * DISPLAY ONLY — never persisted, never a field on the board, never a write.
 * `routesTo` is an EXISTING action affordance the move points at (no new
 * action semantics). `available` honors the underlying pathway's `available`
 * flag: false → rendered as structural guidance copy, never a live action.
 */
export interface NextMove {
  /** Stable id for keys/testIDs; derived from the step code + an index suffix. */
  id: string;
  /** Ban-list-clean operator copy (the visible label). */
  label: string;
  /** Structure-only one-line rationale (from the shipped helper/pathway copy). */
  rationale: string;
  /** The underlying pathway step code this move corresponds to (existing union). */
  stepCode: ResolutionPathwayStepCode;
  /** True only when the underlying pathway step is actionable now. */
  available: boolean;
  /** True for the single dominant move (rendered first / emphasized). */
  isDominant: boolean;
}

/** The ordered move list for a v4 display state. Dominant first. Total. */
export function nextMovesForState(state: V4MediatorStateCode): ReadonlyArray<NextMove>;
```

`nextMovesForState` is a frozen, exhaustive switch over `ALL_V4_MEDIATOR_STATE_CODES` (the nine). Its copy is sourced from `mediatorPlainLanguage.ts` (`PATHWAY_STEP_COPY`, `MEDIATOR_STATE_HELPER`) plus a small frozen `NEXT_MOVE_COPY` const for the operator's alternate labels (e.g. "Branch the provable part", "Accept the narrower scope", "Name what kind of record would test this point", "Separate memory from records", "Preserve the disagreement") — all ban-list clean. **No new state code, no change to `MediatorStateCode` / `V4MediatorStateCode` / `ResolutionPathwayStepCode`.**

---

## File changes

### NEW

- `src/features/mediator/nextMovesForState.ts` (~90-120 lines) — the pure `nextMovesForState(state)` helper + the `NextMove` type + a frozen `NEXT_MOVE_COPY` const for the operator alternate labels + a `_forbiddenNextMoveTokens()` test export (re-exports `_forbiddenMediatorTokens()` plus the person-attribution tokens, mirroring ST-002's `_forbiddenSuggestionTokens`). Pure TS — no React, no Supabase, no fetch, no clock, no randomness.
- `src/features/mediator/MediatorNextMovesCard.tsx` (~90-130 lines) — a small, pure, **read-only** presentational card. Title **"What would move this forward?"** + a one-line lead ("The mediator suggests an action — never a belief, winner, or truth.") + the ordered move rows (dominant first, each with label + rationale). Each actionable row is a `Pressable` (role=button, label, 44×44 via hitSlop) that calls an **optional `onSelectMove(stepCode)` prop routed by the host to an EXISTING action** (default: no-op / undefined → rows render as guidance labels only, the safest default). Unavailable rows render as `<Text>` guidance (not pressable). RN primitives only; reuses `designTokens` (no new hex). Renders `null` when there is no marker (mirrors the chip suppression).
- `__tests__/uxNextMove001SuggestMyNextMove.test.tsx` (NEW) — pure-model + render + a11y tests (see Test plan).

### MODIFIED

- `src/features/mediator/index.ts` (+3 lines) — export `nextMovesForState`, the `NextMove` type, and `_forbiddenNextMoveTokens`.
- `src/features/arguments/ArgumentGameSurface.tsx` (~6-10 lines net) — fill the previously-unset `moveForward` slot of the already-mounted `SelectedNodeInspectDrawer` (`:2570`) with `<MediatorNextMovesCard …>`, fed by `nextMovesForState(v4DisplayStateFor(activeNodeMediatorMarker.code))` (the marker code is already in scope at `:720-740`). Pass `onSelectMove` wired to the **existing** Act-dock routing if and only if the operator chooses the "route to existing actions" option (O-1); the safe default leaves it undefined (guidance-only). **No mount-site topology change** — the slot already exists; this only supplies its child. The shipped inline "What would help next:" line in `MediatorNodeInspectDetail` under "Why this state" stays (single dominant move there); the new card is the **richer alternate set** under the "Move forward:" section. (O-3 decides whether to keep both or suppress the inline line to avoid duplication — recommendation: keep both; they read as "the move" vs "the full set.")

### DELETED

- None.

### UNTOUCHED (preserve byte-for-byte / behavior)

- `deriveMediatorBoardState.ts`, `mediatorBoardTypes.ts` (no precedence/mapping/type change), `mediatorPlainLanguage.ts` (consumed, not edited — no new state copy authored there; the alternate labels live in the new file's `NEXT_MOVE_COPY`), `MediatorNodeMarker.tsx`, `nodeMediatorMarkers.ts`, `MediatorNodeInspectDetail.tsx` (kept; the inline single move stays unless O-3 suppresses it), `SelectedNodeInspectDrawer.tsx` (the slot is already there — consumed, not modified), `DisagreementPointsRail.tsx`, `mediatorRailCopy.ts`, `mediatorDistribution.ts`, `suggestedMovesModel.ts` (ST-002 — separate model, untouched).
- The single-derivation site (`deriveRoomMediatorBoardState`, `ArgumentGameSurface.tsx:703-713`) — invariant preserved; board consumed, never re-derived.
- The Act-dock / `ActPopout` / side-action-rail routing and submit path — unchanged (the card routes to them at most; it adds no action).

### Net file count

- **New:** 2 source (`nextMovesForState.ts`, `MediatorNextMovesCard.tsx`) + 1 test file.
- **Modified:** 2 (`index.ts`, `ArgumentGameSurface.tsx`).
- **Deleted:** 0.

---

## API / interface contracts

```ts
// nextMovesForState.ts
export interface NextMove { id: string; label: string; rationale: string; stepCode: ResolutionPathwayStepCode; available: boolean; isDominant: boolean; }
export function nextMovesForState(state: V4MediatorStateCode): ReadonlyArray<NextMove>;  // pure, total, deterministic, dominant-first
export function _forbiddenNextMoveTokens(): string[];                                     // test-only ban-list

// MediatorNextMovesCard.tsx
export interface MediatorNextMovesCardProps {
  moves: ReadonlyArray<NextMove>;          // from nextMovesForState(displayState); [] → render null
  /** Optional. Host routes the stepCode to an EXISTING action. Undefined → guidance-only (safe default). */
  onSelectMove?: (stepCode: ResolutionPathwayStepCode) => void;
  testID?: string;
}
export function MediatorNextMovesCard(props: MediatorNextMovesCardProps): React.ReactElement | null;
```

- `nextMovesForState` reads NOTHING but the display state; it has no I/O. The host computes the display state from the already-derived marker: `v4DisplayStateFor(marker.code)`.
- `MediatorNextMovesCard` renders nothing (`null`) for an empty move list — mirroring the one-chip suppression contract. It NEVER returns a posting decision; `onSelectMove` (when supplied) routes to the host's existing action handler only.

---

## Edge cases

- **No active node / no marker.** `activeNodeMediatorMarker` is null for ordinary open/resolved nodes → the card gets `[]` (or the host passes `null` moves) → renders `null`. No empty chrome.
- **`resolved_or_settled` node.** `v4DisplayStateFor` returns `'resolved_or_settled'` (terminal, NOT one of the nine). The host treats this exactly like "no marker" (the chip already suppresses it) → card renders `null`. `nextMovesForState` is typed only over the nine, so this never reaches it.
- **`structured_impasse`.** No actionable pathway by construction → all moves render as **guidance copy** ("Preserve the disagreement" / "Reopen with a source, definition, or narrower claim"), none pressable, none routing to a submit-changing action.
- **`accounts_differ`.** Never synthesized in v1 (UX-MEDIATOR-001 §4 — the recollection detector is deferred; the key set is empty). The map includes it for totality, but in practice the state never appears; if it ever does, it renders guidance only ("Separate memory from records" / "Name what could verify it"). Insufficient signal must never *promote* a point to this state — that boundary is owned by the derivation, not this card.
- **`value_tradeoff` / `key_detail_unavailable` / `off_point` (the four superset codes).** They collapse via the shipped `V4_DISPLAY_STATE_BY_CODE` before reaching `nextMovesForState`, so the card switches only on the nine display states (value_tradeoff→open, key_detail_unavailable→evidence_blocked, off_point→scope_mismatch). The internal codes stay in `point.state` for Inspect.
- **Insufficient / unknown signal.** Falls to `open` → "Respond to the exact point" / "Ask a clarifying question" (the neutral fallback). Never an accusatory or verdict-shaped state.
- **`onSelectMove` undefined (default).** Rows render as guidance labels (or pressables that no-op) — the card is fully functional as pure guidance without any routing wired, the safest ship posture.
- **Reduce motion.** No animation introduced; nothing to disable. (The card is static text + optional pressables.)
- **390px width.** The move rows wrap/stack vertically; long labels truncate or wrap; no horizontal overflow (verified by a 390px render test).
- **Concurrent edits / offline / permission-denied.** Not applicable — the card is read-only display over already-derived local state; it makes no network call and no write. If `onSelectMove` routes to an existing action that itself fails, that failure is the existing action's concern, untouched by this card.

---

## Test plan

New file `__tests__/uxNextMove001SuggestMyNextMove.test.tsx`:

- **State→move map coverage (acceptance core).** For each of the nine `ALL_V4_MEDIATOR_STATE_CODES`, assert `nextMovesForState(state)` returns the §3 ordered list: the correct **dominant** move first, the correct alternates in order. 100% branch on the switch.
- **Dominant-first + exactly one dominant.** Every non-empty list has exactly one `isDominant: true`, and it is index 0.
- **Determinism.** `nextMovesForState(s)` deep-equals a second call for every `s` (same input → same output; no clock/randomness).
- **The four superset codes are handled by the host collapse.** Assert (via the host wiring test) that `v4DisplayStateFor('value_tradeoff') === 'open'`, `'key_detail_unavailable' → 'evidence_blocked'`, `'off_point' → 'scope_mismatch'`, so the card shows the collapsed-state move set. (Re-asserts the shipped mapping; guards against drift.)
- **Insufficient → Open fallback.** With a null/absent marker the card renders `null`; a state that resolves to `open` (incl. the value_tradeoff collapse) shows "Respond to the exact point" dominant.
- **Copy ban-list (doctrine).** Scan every `label` + `rationale` across all nine states for `_forbiddenNextMoveTokens()` + a snake_case check → none. Explicitly assert the §4 ban tokens are absent: "decide for me", "AI thinks", "truth", "verdict", "winner", "loser", "score", "fallacy", "wrong", "dishonest", "bad faith", "manipulative", "credibility", "intent", "emotion"/"tone"/"anger". Assert the title is exactly "What would move this forward?" and the lead contains "never a belief, winner, or truth." reads (matching the design export) and is itself ban-list clean (note: the lead deliberately *names* "winner"/"truth" inside a negation — handle by asserting the lead is the one allowed exception string, or phrase the lead to avoid the tokens; see Open questions O-2).
- **No-chip-soup / no-conclusion.** The card renders moves (actions), not states/verdicts; assert it renders no second state chip and no who's-right string.
- **Render: dominant emphasis + unavailable-as-guidance.** Render `MediatorNextMovesCard` for `needs_evidence` (dominant pressable) and `structured_impasse` (all guidance, no pressable); assert the actionable rows are `accessibilityRole="button"` with labels + 44×44 (hitSlop), and the unavailable rows are non-pressable `<Text>`.
- **Routing reuse (shared source).** Assert the dominant move's `stepCode` for a state equals the first **available** step of that state's `pathwayForState`/`board.pathwaysByPointId` — proving the card and the Act target share one source (acceptance: "the same move set powers Act and the Inspect chips").
- **`onSelectMove` wiring.** With `onSelectMove` supplied, pressing an actionable row calls it with the row's `stepCode`; with it undefined, pressing no-ops (no throw).
- **390px + a11y.** Render at width 390 — no horizontal overflow; all interactive rows meet 44×44; the title is `accessibilityRole="header"`.
- **Host wiring (extend `ArgumentGameSurface` surface test).** With `inspectVisible` + an active node carrying a mediator state, assert the `moveForward` slot now renders the `MediatorNextMovesCard` (testID present) and the four shipped drawer sections still mount. Run the **full suite** (not a tailed run; exit-0 per test-discipline gate-timeout rule).
- **Regression (full suite).** Re-run `__tests__/{uxMediator00*,uxSelectedNode001*,nodeMediatorMarkers,MediatorNodeMarker,MediatorNodeInspectDetail,NodeLabelInspectGroups,MetadataDiffInspector,DisagreementPointsRail,disagreementPointsRail*,mediatorBoardState,mediatorPrecedence,suggestedMovesModel}.test.*` — all green; no shipped fixture flips (the card is additive; `MediatorNodeInspectDetail`'s inline line is untouched unless O-3 suppresses it, in which case its assertion is updated in lockstep).
- **Gates:** `npm run typecheck`, `npm run lint`, `npm run test` all exit 0 (full suite, captured exit code); test count goes UP.

Coverage target: 100% branch on `nextMovesForState` (engine-adjacent pure logic — the engine bar applies); render coverage for dominant/guidance rows + the title + the 390px path.

---

## Dependencies (cards / docs / files)

- **Depends on (merged):** UX-MEDIATOR-001 (`v4DisplayStateFor`, `V4_PRIMARY_STATE_PRIORITY`, `pathwayForState`, the `ResolutionPathwayStepCode` union, the per-state pathway), UX-MEDIATOR-002 (`getNodeMediatorMarker`, `MediatorNodeInspectDetail`, the one-chip + chip-adjacent Inspect caret), UX-MEDIATOR-003/004 (the evidence + definition/scope helper copy reused for rationales), UX-MEDIATOR-005 (`pathwaysByPointId` consumption pattern, "Move forward:" vocabulary), **UX-SELECTED-NODE-001 (the `SelectedNodeInspectDrawer` + its reserved `moveForward` slot — this card's render home)**.
- **Extends:** #13 (ST-002 `suggestedMovesModel` — sibling advisory move surface, NOT modified, NOT re-keyed), #31 (GAL-002), #587 (REF-004), #290 (UX-001.4).
- **Does NOT subsume:** #504 (CARD-VIEW-DATA-001) — consumes the card-view data path, never re-derives the board.
- **Reads existing (no re-derivation):** the once-derived `mediatorBoard` (`ArgumentGameSurface.tsx:703`), `activeNodeMediatorMarker` (`:720`), `v4DisplayStateFor`, `board.pathwaysByPointId`, `PATHWAY_STEP_COPY` / `MEDIATOR_STATE_HELPER`.
- **Single-derivation invariant** (`memory: mediator-board-single-derivation`): board derived ONCE, shared by rail + node markup + this card — never re-derived. `nextMovesForState` derives nothing from the board; it maps a display state to copy.
- **Engine path note** (`memory: claude-md-engine-path-stale`): live engine is `src/domain/constitution/engine.ts`; this card imports neither engine — gate-independence is structural.
- **Blocks / feeds:** UX-NEXT-MOVE-002 (the discrete tappable chooser with new action semantics consumes this card's `nextMovesForState` + `NextMove` type), UX-IMPASSE-001 (impasse-specific treatment), UX-ROOM-1V1-CHIMEIN-001 (chime-in data unrelated to this card).
- **Design source of truth:** issue #688; `docs/designs/UX-SELECTED-NODE-001.md` §17 (the reserved slot + the explicit deferral to this card); `docs/designs/UX-MEDIATOR-001.md` §3 (per-state pathway + `v4DisplayStateFor`); `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-CARDS.md` (Screen 07 / precedence "Primary move" column); `docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md`.

---

## Risks

- **R1 — Move copy that drifts toward a verdict.** "Accept the narrower scope" / "Concede the resolved part" could read as "you lost." **Mitigation:** all copy is structural and person-neutral ("the resolved part", not "your point"); the ban-list test scans every label + rationale; "concession is a repair, not a defeat" is the encoded framing (point-standing doctrine). Person-attribution tokens are banned (ST-002 `PERSON_ATTRIBUTION_TOKENS` reused).
- **R2 — The lead line names "winner"/"truth" inside a negation.** The design export's "never a belief, winner, or truth" contains ban-list tokens. **Mitigation:** O-2 — either whitelist that exact lead string in the ban-list test (it is the one allowed negation), or rephrase to "shows an action, not a conclusion" to avoid the tokens entirely. Recommendation: rephrase (cleaner; no test exception).
- **R3 — Duplication with the inline "What would help next:" line.** `MediatorNodeInspectDetail` already renders the single dominant move under "Why this state"; the new card renders the full set under "Move forward:". **Mitigation:** O-3 — keep both (single move as the "headline" in Why-this-state; full set in the dedicated section) OR suppress the inline line. Recommendation: keep both; they serve different reads and the inline line is heavily pinned by tests.
- **R4 — Scope creep into a real chooser.** An implementer might wire `onSelectMove` to a NEW action. **Mitigation:** the safe default is `onSelectMove` undefined (guidance-only); any routing must target an EXISTING handler; a discrete chooser with new semantics is explicitly UX-NEXT-MOVE-002 (§ Deferrals). The §6 forbidden list pins this.
- **R5 — `ArgumentGameSurface` is large and heavily-pinned.** Filling the slot risks an unrelated snapshot. **Mitigation:** the delta is one child in an already-existing slot; run the full suite, not a tailed run.
- **R6 — ST-002 conflation.** An implementer might re-use `deriveSuggestedMoves` (lifecycle-keyed) instead of the mediator pathway. **Mitigation:** Finding D + the §3 map pin the source to `v4DisplayStateFor`; the two models stay separate.

---

## §6 Out of scope / non-goals (explicit)

- **NO discrete tappable next-move CHOOSER with new action semantics** → **UX-NEXT-MOVE-002**. This card renders guidance/labels that route to EXISTING actions only; it may optionally reorder the existing Act-dock suggestions, but adds no routing/submit semantics.
- **NO new persisted next-move state, NO GATE-C persistence** (e.g. a real "mark evidence unavailable" write) → deferred GATE-C card. "Mark evidence unavailable" / "Name what record" render as guidance COPY here.
- **NO runtime LLM/MCP/provider call to choose the move** — deterministic from state (issue non-goal). No new classifier / Family K / Family J.
- **NO global board/timeline layout change; NO persistent rail / left-right column; NO `DisagreementPointsRail` / `ArgumentSideActionRail` relocation; NO timeline flex/width/scroll/virtual-list change** → board topology is UX-BOARD-RAIL-002, not this card.
- **NO room/seat/chime-in semantics; NO submit-path change; NO change to ST-002 (`suggestedMovesModel`).**
- **NO backend/schema/RLS/auth; NO persistence/migration/Supabase write/service-role; NO package install; NO deployment/netlify-prod.**
- **NO board re-derivation** (single-derivation invariant); **NO `#504` subsumption.**
- **NO truth/score/winner/loser/verdict/credibility/intent framing; NO AI-generated conclusion framed as authority.**
- **NO impasse-specific treatment beyond the §3 guidance copy** → UX-IMPASSE-001.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the card shows structural *moves*, never a verdict/person/truth label; it returns no posting decision and imports nothing from the engine — it gates nothing. The engine remains the sole acceptance gate. PASS.
- **§2 (heat ≠ truth) / §3 (popularity is not evidence):** `nextMovesForState` reads only the display state — never `standingBand` / `toneBand` / `temperatureBand` / engagement / likes / views. No amplification token in any label (ban-list test). PASS.
- **§4 (AI moderator limits):** no LLM/MCP/provider chooses or gates the move (deterministic); nothing runs on a network; the card asserts no truth, modifies/hides/deletes nothing, returns no authoritative flag. PASS.
- **§9 (plain language):** every label/rationale flows through the shipped plain-language maps + the ban-list-clean `NEXT_MOVE_COPY`; no raw classifier key / snake_case reaches the UI (re-asserted by test). PASS.
- **§10a (Observations vs Allegations):** the card surfaces structural machine **Observations** (the mediator display state) as *moves*; it renders no user Allegation as a move and no sensitive composer-only observation. PASS.
- **§10 (v1 scope):** no voting/winner, no search, no OAuth, no push, no public API, no realtime body editing. PASS.
- **accessibility-targets:** actionable rows are `accessibilityRole="button"` + label + 44×44 (hitSlop); the title is `accessibilityRole="header"`; color is never the only signal (dominant vs guidance carried by weight/position + text); no animation (reduce-motion N/A); 390px verified inline. PASS (plan).
- **expo-rn-patterns:** RN primitives only (`View`/`Text`/`Pressable`); reuses `designTokens` (no new hex); no new dependency. PASS.
- **test-discipline:** pure-model coverage of the nine-state map (100% branch) + render + a11y + ban-list + host-wiring + full regression; test count up; full-suite exit-0 gate. PASS (plan).

---

## Operator steps (if any)

**None — pure code change.** No `db push`, no `functions deploy`, no env var, no migration, no deploy, no netlify-prod. The implement step ships a pure-TS-UI delta (one helper + one card + one slot fill) merged via the normal green-PR path; the single-derivation site picks it up with no operator action.

---

## Open questions for the operator (each with a designer recommendation)

- **O-1 (guidance-only vs route-to-existing-actions for v1):** Ship the card as **guidance labels only** (`onSelectMove` undefined — zero routing risk), or wire each actionable move to the **existing** Act-dock / side-rail handler now (still no new action semantics)? **Recommendation: ship guidance-only in v1** (safest, fully satisfies the issue's "action — never a belief", and the routing is the natural first slice of UX-NEXT-MOVE-002). Wire to existing actions only if the operator wants the moves tappable immediately AND confirms each target handler already exists.
- **O-2 (the lead line wording):** Use the design export's exact lead "The mediator suggests an action — never a belief, winner, or truth." (which names ban-list tokens inside a negation, requiring a whitelisted-string test exception), or rephrase to a token-free equivalent like "These are actions that could move the shape of the disagreement forward — not conclusions."? **Recommendation: rephrase** (token-free, no ban-list exception, same intent). The title stays the exact "What would move this forward?".
- **O-3 (inline single move vs the new full set — duplication):** Keep BOTH the shipped inline "What would help next: <dominant>" line in `MediatorNodeInspectDetail` (under "Why this state") AND the new full-set card (under "Move forward:"), or suppress the inline line now that the card carries the moves? **Recommendation: keep both** — the inline line is the one-glance headline; the card is the considered set; keeping both is zero test churn on the heavily-pinned `MediatorNodeInspectDetail.test.tsx`. Suppress only if the operator finds the duplication noisy (then update that test in lockstep).
- **O-4 (alternate-move depth):** The §3 map gives 1-3 alternates per state. Cap the rendered alternates (e.g. dominant + up to 2) for compactness, or render all? **Recommendation: render all from the §3 map** (the lists are already short and operator-locked); a cap is a later tuning, not a v1 need.

---

## Deferrals (named follow-up cards)

- **UX-NEXT-MOVE-002** — the discrete tappable next-move **chooser** with NEW action semantics (a move that changes/initiates submit behavior). Consumes this card's `nextMovesForState` + `NextMove` type. Also the natural home for wiring `onSelectMove` to dedicated flows if O-1 ships guidance-only.
- **GATE-C persistence card** — the persisted "Mark evidence unavailable" action (a real write). This card renders that move as guidance copy only.
- **UX-BOARD-RAIL-002** — any board topology / rail placement / persistent column change (explicitly out of this card's domain).
- **UX-IMPASSE-001** — impasse-specific selected-node treatment beyond the §3 guidance copy.

---

## Orchestrator-authored brief ledger (POSTRUN-UX001 lesson)

This card's issue (#688) is orchestrator/roadmap-authored, not operator-authored. Where each design decision came from:

- **Prior-Phase framing (operator-validated source-of-truth chain):** the single-derivation invariant; `v4DisplayStateFor` + the per-state `pathwayForState`; the `SelectedNodeInspectDrawer` reserved `moveForward` slot (UX-SELECTED-NODE-001 §17 explicitly deferred the richer multi-chip set to THIS card) — all from the merged UX-MEDIATOR-001..005 + UX-SELECTED-NODE-001 designs + the shipped code.
- **Epic framing:** the title "What would move this forward?", the "action — never a belief, winner, or truth" frame, and Screen 07's move set from `CIVILDISCOURSE-V4-UX-OVERHAUL-CARDS.md` + issue #688.
- **Operator-locked input:** the §3 state→next-move map (provided verbatim in the brief §3) and the §4 copy ban-list.
- **Pre-launch codebase survey (this §0 reality audit):** Finding A (`pathwayForState` + `pathwaysByPointId` already derive the move set), Finding B (the `moveForward` slot already exists), Finding C (the existing pathway returns fewer alternates than the §3 map → a pure display-shaping helper closes the gap), Finding D (ST-002 is a separate lifecycle-keyed model — do not conflate).
- **Resolved by orchestrator default (flagged for operator review):** the §5 determination (display-only, proceed), O-1 (guidance-only v1 recommendation), O-2 (rephrase the lead to avoid ban tokens), O-3 (keep both the inline line and the card), O-4 (render all alternates), and the routing-to-existing-actions-only boundary.
- **Operator-deferred review:** the four O-decisions above; the named deferrals (UX-NEXT-MOVE-002 chooser, GATE-C persistence, UX-BOARD-RAIL-002, UX-IMPASSE-001). Post-ship revision (if any) should target these specific interpretations.

---

## Recommended implement-step scope

Touch **2 new files + 2 modified files + 1 new test**:

1. `src/features/mediator/nextMovesForState.ts` (new) — `nextMovesForState(state)` + `NextMove` + `NEXT_MOVE_COPY` + `_forbiddenNextMoveTokens`.
2. `src/features/mediator/MediatorNextMovesCard.tsx` (new) — the read-only "What would move this forward?" card (title + lead + dominant-first move rows; guidance-only default).
3. `src/features/mediator/index.ts` — export the helper + type + ban-list export.
4. `src/features/arguments/ArgumentGameSurface.tsx` — fill the existing `SelectedNodeInspectDrawer` `moveForward` slot with `MediatorNextMovesCard`, fed by `nextMovesForState(v4DisplayStateFor(activeNodeMediatorMarker.code))`.
5. `__tests__/uxNextMove001SuggestMyNextMove.test.tsx` (new) + extend the `ArgumentGameSurface` surface test.

Run `npm run typecheck && npm run lint && npm run test` (full suite, exit-0); confirm the mediator + selected-node + rail suites are green and the test count goes UP. No backend, no migration, no deploy, no new dependency.
