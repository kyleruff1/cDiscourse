# RULE-002 — Evidence symmetry between validation and visuals

**Status:** Design draft
**Epic:** rules-ux
**Release:** 6.6
**Wave:** 3 (Game constraints)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/33

---

## Goal

The constitution engine and the Stage 6.2 advisory checks already emit a clean set of `FlagCode`s describing what is structurally or semantically off about a draft (e.g. `off_topic`, `weak_topic_satisfaction`, `parent_nonresponsive`, `evidence_required`, `loaded_clarification`). Today those flags surface in `ComposerValidationPanel` as plain-text warning rows. Players read the warning and have to guess what to do next: open the composer, retype, attach a source, branch, etc.

RULE-002 ships the single-source-of-truth that bridges those validation flags into one-click gameplay affordances. For every `FlagCode` the engine emits (and every Stage 6.2 advisory code), it returns a render-ready `ValidationActionUx` tuple:

```
{ chipLabel, helperLine, suggestedMove, dockAction, presetKey }
```

`chipLabel` and `helperLine` are doctrine-clean plain English; `suggestedMove`, `dockAction`, and `presetKey` route into already-shipped UI machinery (`SuggestedMoveCode`, `TimelineNodeActionDockActionCode`, `QuickActionLabel`) so the new module **introduces no new execution paths** — it only routes data into existing presets.

Doctrine constraints that shape the design (from `cdiscourse-doctrine`, `evidence-doctrine`, `accessibility-targets`, `expo-rn-patterns`, `test-discipline`):

- **§5 Rules engine is sacred** — the engine emits `FlagCode`s and `EvaluationFlagDetail` records; this module is a pure-TS **UX-layer adapter** that imports the `FlagCode` type and never imports or mutates the engine. Engine purity is preserved by construction.
- **§1 Score never blocks posting** — RULE-002 adds an *affordance*, never a gate. The submit button continues to be gated by `evaluationResult.allowPost` exactly as today; the new chip is purely additive. Acceptance criterion "Ordinary replies remain postable" is encoded as a test.
- **§4 AI moderator hard limits** — RULE-002 is deterministic constant lookup. No AI call. No network. No fetch.
- **§9 Plain language for users** — every produced string is plain English; ban-list test rejects verdict tokens; every chipLabel passes `!looksLikeInternalCode()`.
- **Evidence-doctrine** — `evidence_required` (engine) and `missing_source` / `missing_quote` / `evidence_debt` (advisory codes already in `PLAIN_LANGUAGE_COPY`) route to **ask-the-author-for-X** affordances, never to "this is wrong" or "this is unsourced therefore false." The chip never makes a person-attribution.
- **§3 Popularity is not evidence** — `anti_amplification` and `platform_support_warning` route to "wait for evidence" / "ask for source," never to "this is popular therefore accept."
- **Accessibility-targets** — the rendered chip is a `Pressable` with `accessibilityRole="button"`, `accessibilityLabel` combining chipLabel + helperLine, 44×44 hit target via `hitSlop`. Tapping does not remove the warning text; both stay visible (affordance is *in addition to* the warning, never *instead of*).

The map is pure constants. No logic. No animation. No rendering. No persistence.

## Data model

### Module path

`src/features/rulesUx/validationActionMap.ts` — sibling to the existing `ruleToUiMap.ts` (RULE-001) and `lifecycleUxMap.ts` (RULE-003).

**Justification for separate file (not merged into either sibling):**

1. The three maps have **different input vocabularies**. RULE-001 keys off semantic axis codes (`source_chain`, `scope`, `logic`, …). RULE-003 keys off lifecycle / manual-tag / auto-metadata codes (`open`, `narrowed`, `needs_source`, …). RULE-002 keys off `FlagCode` from `src/domain/constitution/types.ts` + a few advisory codes from `PLAIN_LANGUAGE_COPY` (`source_chain`, `evidence_debt`, `anti_amplification`, `platform_support_warning`, `synthesis_ready`, `validation_failed_after_retries`, `max_depth_reached`).
2. Each map carries its own **ban-list test** with a focused contract — adding a new RULE-002 entry should not force re-running RULE-001 / RULE-003 invariants and vice-versa.
3. Sibling pattern is already established by `lifecycleUxMap.ts` + `ruleToUiMap.ts`. Same precedent.

The module is imported directly: `import { getValidationAction, VALIDATION_ACTION_MAP } from 'src/features/rulesUx/validationActionMap'`. No barrel file (matches the existing pattern — `src/features/rulesUx/` has no `index.ts`).

### Exported types

```ts
// Re-imported types (NOT re-defined):
import type { FlagCode } from '../../domain/constitution/types';
import type { SuggestedMoveCode } from '../arguments/suggestedMovesModel';
import type { TimelineNodeActionDockActionCode } from '../arguments/timelineNodeActionDockModel';
import type { QuickActionLabel } from '../arguments/quickActionPresets';

/**
 * Stable identifier for a validation flag or Stage 6.2 advisory code that
 * RULE-002 has a one-click affordance for. This is the UNION of:
 *
 *   - every value of `FLAG_CODES` (the engine's enum), and
 *   - a small additive set of Stage 6.2 / Stage 6.4 advisory codes that
 *     surface in `PLAIN_LANGUAGE_COPY` but are not (yet) emitted as
 *     `EvaluationFlagDetail` records by the engine (e.g.
 *     `synthesis_ready`, `evidence_debt`, `anti_amplification`).
 *
 * New codes MUST be added here AND to `VALIDATION_ACTION_MAP` in the same
 * commit; tests will fail otherwise (Object.keys parity + exhaustiveness).
 */
export type ValidationActionCode =
  // FlagCode values (mirrored from FLAG_CODES in domain/constitution/types.ts):
  | 'off_topic'
  | 'weak_topic_satisfaction'
  | 'missing_parent'
  | 'invalid_transition'
  | 'evidence_required'
  | 'civility_risk'
  | 'ad_hominem_possible'
  | 'duplicate_argument_possible'
  | 'excessive_length'
  | 'unclear_claim'
  | 'needs_moderator_review'
  | 'parent_nonresponsive'
  | 'tangent_shift_possible'
  | 'concession_evasion_possible'
  | 'loaded_clarification_possible'
  | 'fact_confusion_possible'
  // Stage 6.2 / 6.4 advisory codes (already in PLAIN_LANGUAGE_COPY):
  | 'source_chain'
  | 'evidence_debt'
  | 'anti_amplification'
  | 'platform_support_warning'
  | 'synthesis_ready'
  | 'validation_failed_after_retries'
  | 'max_depth_reached';

/** Frozen array of every code. Tests iterate this. */
export const ALL_VALIDATION_ACTION_CODES: ReadonlyArray<ValidationActionCode>;

/**
 * The UX tuple returned for a known validation code. All five fields are
 * doctrine-clean and plain-English.
 *
 *   - `chipLabel`     — ≤ 32 chars. Verb-shaped affordance ("Reconnect
 *                       to parent", "Ask for the source"). NEVER a verdict.
 *   - `helperLine`    — ≤ 80 chars. One-line explanation of WHY the chip
 *                       was offered. Describes the MOVE STRUCTURE, never
 *                       the author.
 *   - `suggestedMove` — A member of `SuggestedMoveCode` (ST-002) or `null`
 *                       when no suggestion routes cleanly. NEVER invented.
 *   - `dockAction`    — A member of `TimelineNodeActionDockActionCode`
 *                       (SC-004) or `null`. Used by surfaces that already
 *                       own a dock; informational for surfaces that don't.
 *   - `presetKey`     — A member of `QuickActionLabel` (COMPOSER-001) or
 *                       `null`. Used by the composer to pre-seed a draft.
 *
 * When all three of `suggestedMove` / `dockAction` / `presetKey` are
 * `null`, the chip is **suppressed** by the renderer — the validation
 * warning still shows, but no affordance is offered. This is the correct
 * behavior for codes that describe a structural defect we cannot offer a
 * one-click repair for (e.g. `invalid_transition` — the user has to
 * change the move type themselves).
 */
export interface ValidationActionUx {
  code: ValidationActionCode;
  chipLabel: string;
  helperLine: string;
  suggestedMove: SuggestedMoveCode | null;
  dockAction: TimelineNodeActionDockActionCode | null;
  presetKey: QuickActionLabel | null;
}

/**
 * The full table — `Record<ValidationActionCode, ValidationActionUx>`.
 * Frozen at module load time. Direct typed lookup is total — the type
 * system guarantees a `code` value is a map key, so the reader returns
 * `ValidationActionUx`, never `undefined`.
 */
export const VALIDATION_ACTION_MAP: Readonly<Record<ValidationActionCode, ValidationActionUx>>;

/**
 * Direct typed reader. Compile-time exhaustive — adding a new code to the
 * union without adding a map entry is a TypeScript error.
 */
export function getValidationAction(code: ValidationActionCode): ValidationActionUx;

/**
 * Free-form reader for callers that receive a string from an upstream
 * source (e.g. an `EvaluationFlagDetail.flagCode`, a server-rules JSON,
 * or a Stage 6.4 `stopReason`). Normalises whitespace / case / hyphens.
 * Returns `null` for unknown codes — callers MUST suppress unknowns
 * (never render the raw token).
 */
export function mapValidationActionOrSuppress(code: string | null | undefined): ValidationActionUx | null;
```

### Reader behaviour

- `getValidationAction(code)` is **total** by type — never throws, never returns null. Adding a new union member without adding a map entry is a compile error.
- `mapValidationActionOrSuppress(code)` is **defensive** for run-time strings. It runs the same `normalise()` regex as `gameCopy.toPlainLanguage` (`String(code).trim().toLowerCase().replace(/[\s-]+/g, '_')`) so external surfaces that emit `off-topic` / `OFF_TOPIC` / `off topic` all resolve to the same entry.
- Unknown code → `null`. Caller suppresses the chip. **Never** renders the raw token. (Tests assert this for known + unknown codes.)

### No new data model in the domain layer

Nothing changes in `src/domain/constitution/*` or `supabase/migrations/*`. RULE-002 is a UX-layer adapter that *reads* engine output. The engine continues to emit `EvaluationFlagDetail.flagCode` exactly as today.

## File changes

### New files

- `src/features/rulesUx/validationActionMap.ts` — the constant map + readers + types. **~280 lines** (23 entries × ~10 lines per entry + headers + readers).
- `__tests__/validationActionMap.test.ts` — exhaustive coverage. **~340 lines** (~55 tests).

### Modified files

- `src/features/arguments/ComposerValidationPanel.tsx` — renders a `ValidationActionChip` next to each warning row. **Net delta ~+50 lines** (existing 147 lines → ~197 lines):
  - import `mapValidationActionOrSuppress` from `src/features/rulesUx/validationActionMap`.
  - new optional prop `onSuggestedMove?: (action: ValidationActionUx) => void`. Default behavior when the prop is absent is to render the chip as **non-pressable info** (it still meets the a11y bar, just becomes a `View` with the same label). This preserves the panel's pure-display contract for tests / Storybook.
  - for each warning row, derive `action = mapValidationActionOrSuppress(w.flagCode)`. If `action` is non-null AND has at least one of `suggestedMove` / `dockAction` / `presetKey` populated, render the chip beneath the warning text.
  - **never** wraps the warning text itself in the Pressable — the warning copy stays exactly as `EvaluationFlagDetail.message` (the engine still owns that string). The chip is a *sibling*, not a replacement.
  - the new chip subcomponent is co-located (`function ValidationActionChip(...)` inside the same file). 44×44 tap target via `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` since the visual chip is ~24px high. `accessibilityRole="button"` (when pressable) or `"text"` (when not). `accessibilityLabel = ${chipLabel}. ${helperLine}`.
- `src/features/arguments/ArgumentComposer.tsx` — adds the `onSuggestedMove` handler. **Net delta ~+25 lines** (existing 580 lines → ~605 lines):
  - new `handleValidationAction = useCallback((action: ValidationActionUx) => { ... }, [...])` that:
    - if `action.presetKey` is non-null, call `quickActionToPreset(action.presetKey, draft.parentArgument?.argumentType ?? null)` and feed the result through the existing `handleMovePatch(patch)` path. (Re-uses the COMPOSER-001 routing — no new code paths.)
    - if `action.presetKey` is null but `action.suggestedMove` is non-null and a higher-level surface (e.g. the timeline dock) is mounted, forward to the dock via an existing callback prop (left as an optional pass-through; the composer's own behavior is preset-only).
  - pass `onSuggestedMove={handleValidationAction}` to `<ComposerValidationPanel ... />`.
  - **the submit button is unchanged.** `canSubmit` still uses `evaluationResult?.allowPost ?? false` exactly as today. The chip changes *what the user can do next*, not *whether the user can post*.
- `docs/core/current-status.md` — append a one-paragraph section "RULE-002 — Validation-action map (status)" noting design draft is in `docs/designs/RULE-002.md`. **Net delta ~+15 lines.**

### Deleted files

- None.

### Files explicitly NOT touched

- `src/domain/constitution/engine.ts` — sacred. Untouched.
- `src/domain/constitution/evaluateArgumentDraft.ts` — untouched. The flag codes it emits are inputs to RULE-002, not outputs.
- `src/domain/constitution/types.ts` — untouched. RULE-002 type-imports `FlagCode` and mirrors the values; no edits to the source.
- `src/features/rulesUx/ruleToUiMap.ts` — untouched. RULE-001's semantic-axis map remains the source of truth for axis codes (`source_chain`, `scope`, …); RULE-002 reuses those entries' tool labels where the codes overlap (see "Coordination with RULE-001" below).
- `src/features/rulesUx/lifecycleUxMap.ts` — untouched. RULE-003's lifecycle map is a different vocabulary.
- `src/features/arguments/suggestedMovesModel.ts` / `quickActionPresets.ts` / `timelineNodeActionDockModel.ts` — untouched. RULE-002 *reads* their unions and routes into their already-shipped data; it never adds new presets or new actions.
- `supabase/**` — untouched. No migration. No Edge Function.

## API / interface contracts

### Public exports from `validationActionMap.ts`

```ts
export type ValidationActionCode = /* see above */;
export interface ValidationActionUx { /* see above */ }
export const ALL_VALIDATION_ACTION_CODES: ReadonlyArray<ValidationActionCode>;
export const VALIDATION_ACTION_MAP: Readonly<Record<ValidationActionCode, ValidationActionUx>>;
export function getValidationAction(code: ValidationActionCode): ValidationActionUx;
export function mapValidationActionOrSuppress(code: string | null | undefined): ValidationActionUx | null;
/** Test-only helper — the merged ban-list from gameCopy + RULE-001 banned-verdict + COPY-001 person-attribution tokens. */
export function _forbiddenValidationActionTokens(): string[];
```

### Mapping table — the full 23-entry catalog

Each row lists `code → { chipLabel, helperLine, suggestedMove, dockAction, presetKey }`. All `chipLabel`s ≤ 32 chars; all `helperLine`s ≤ 80 chars; all are doctrine-clean.

**Engine-emitted flags (16 entries — every value in `FLAG_CODES`):**

| Code | chipLabel | helperLine | suggestedMove | dockAction | presetKey |
|---|---|---|---|---|---|
| `off_topic` | Reconnect to topic | This reply does not engage the resolution. Reframe or branch. | `branch_tangent` | `branch` | `branch` |
| `weak_topic_satisfaction` | Sharpen the topic link | The topic connection is light. Make the link explicit. | `branch_tangent` | `clarify` | `clarify` |
| `missing_parent` | Pick a parent reply | The reply needs a parent move to land on. | null | null | null |
| `invalid_transition` | Change the move type | That move type is not allowed under this parent. | null | null | null |
| `evidence_required` | Attach a source | Evidence posts need at least one source link or quote. | `ask_source` | `add_evidence` | `evidence` |
| `civility_risk` | Cool the tone | A measured restatement helps the room. | null | null | null |
| `ad_hominem_possible` | Refocus on the claim | Keep the move on the argument, not the speaker. | null | null | null |
| `duplicate_argument_possible` | Differentiate from sibling | A nearby reply already makes a similar point. Show what is new. | null | null | null |
| `excessive_length` | Trim the move | The body is longer than the limit. Tighten it down. | null | null | null |
| `unclear_claim` | Sharpen the claim | A longer, clearer body usually reads better. | null | null | null |
| `needs_moderator_review` | Awaiting moderator | A moderator will review before this lands. | null | null | null |
| `parent_nonresponsive` | Reconnect to parent | The reply does not engage the parent. Tie them together. | `branch_tangent` | `clarify` | `clarify` |
| `tangent_shift_possible` | Branch this off | The thread has shifted; a branch reads cleaner. | `branch_tangent` | `branch` | `branch` |
| `concession_evasion_possible` | Hold the concession line | The concession looks like it dodges the original point. | null | `clarify` | `clarify` |
| `loaded_clarification_possible` | Neutralize the question | A neutral phrasing avoids smuggling a claim. | null | `clarify` | `clarify` |
| `fact_confusion_possible` | Separate fact from frame | Uncertainty mixed with a factual challenge — split them. | null | `clarify` | `clarify` |

**Stage 6.2 / 6.4 advisory codes (7 entries):**

| Code | chipLabel | helperLine | suggestedMove | dockAction | presetKey |
|---|---|---|---|---|---|
| `source_chain` | Ask for the source | Ask the speaker to name the primary source for this claim. | `ask_source` | `ask_source` | `source` |
| `evidence_debt` | Ask for receipts | This line is carrying a claim that has not been supported with evidence yet. | `ask_source` | `ask_source` | `source` |
| `anti_amplification` | Popularity is not proof | This line is amplified but not evidenced. Engagement does not equal support. | `ask_source` | `ask_source` | `source` |
| `platform_support_warning` | Hold off on scoring | This line should not gain factual standing until evidence arrives. | `ask_source` | `ask_source` | `source` |
| `synthesis_ready` | Offer synthesis | The two sides have narrowed enough that a combined statement may capture both. | `synthesize` | `synthesize` | `synthesize` |
| `validation_failed_after_retries` | Restate the move | The move needs a clearer shape before it can play well. | null | null | null |
| `max_depth_reached` | Branch this chain | Deep unresolved chain — a branch keeps the timeline readable. | `branch_tangent` | `branch` | `branch` |

**Issue-mentioned mappings — concrete one-click affordances:**

- Weak topic → "Sharpen the topic link" chip (`weak_topic_satisfaction`).
- Parent nonresponsive → "Reconnect to parent" suggestion (`parent_nonresponsive`).
- Missing source → "Ask for the source" / `ask_source` action (`source_chain` advisory + `evidence_required` engine flag).
- Missing quote → covered by `ask_quote` already via lifecycle; not a separate validation flag in v1. The validation surface routes a quote-related warning through `evidence_required` → `ask_source` chip; the **lifecycle** path (RULE-003 `quote_requested`) handles the explicit `ask_quote`. Out-of-scope to introduce a new `missing_quote` flag — that's an engine change, off-limits per "rules engine is sacred."
- Scope risk → "Sharpen the topic link" / "Branch this off" (covered by `weak_topic_satisfaction` + `tangent_shift_possible`). Scope challenges live in RULE-001 (`scope` axis); RULE-002's job is to map *engine-emitted* warnings, not the semantic axis vocabulary.
- Definition ambiguity → covered by `loaded_clarification_possible` + the existing `clarify` dock action; the explicit "define the term" tool lives in RULE-001 (`definition` axis).

This is the clean separation: **RULE-002 routes engine flags into suggested-moves**; **RULE-001 routes semantic axis labels (used by the timeline, gallery, source-chain popover) into composer tools**. The two maps share `chipLabel` text intentionally where they overlap on doctrine (e.g. both "Ask for the source") so the user sees consistent vocabulary across surfaces.

### Coordination with RULE-001

Where a `ValidationActionCode` overlaps semantically with a `RuleCode` from RULE-001 (e.g. `evidence_debt`, `anti_amplification`, `source_chain`, `synthesis_ready`), the `chipLabel` in RULE-002 is set **identical to the corresponding `toolLabel` in RULE-001** (the eight issue-mentioned canonical labels). This is enforced by a test (`expect(RULE_002.evidence_debt.chipLabel).toBe(RULE_001.evidence_debt.toolLabel)`).

This prevents drift: if RULE-001's label moves, RULE-002 must move in the same commit, and the test will catch any oversight.

### Render contract (consumer surface — `ComposerValidationPanel`)

For each warning row, after deriving `action = mapValidationActionOrSuppress(detail.flagCode)`:

```tsx
{action && (action.suggestedMove || action.dockAction || action.presetKey) ? (
  <Pressable
    onPress={onSuggestedMove ? () => onSuggestedMove(action) : undefined}
    accessibilityRole={onSuggestedMove ? 'button' : 'text'}
    accessibilityLabel={`${action.chipLabel}. ${action.helperLine}`}
    accessibilityHint={onSuggestedMove ? 'Opens this move shape in the composer.' : undefined}
    accessibilityState={{ disabled: !onSuggestedMove }}
    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    style={styles.actionChip}
    testID={`validation-action-chip-${action.code}`}
  >
    <Text style={styles.actionChipText}>{action.chipLabel}</Text>
  </Pressable>
) : null}
```

When the chip is pressable and tapped, the composer:

1. resolves `action.presetKey` through `quickActionToPreset(presetKey, parentType)` (existing function — no new path);
2. dispatches the resulting `MoveDraftPatch` through `handleMovePatch` (existing function — no new path);
3. the validation warning text stays visible, the chip stays visible, the submit button retains its current `canSubmit` semantics.

The chip never closes the panel, never removes the warning, never modifies the engine output, and never disables the submit button.

## Edge cases

- **Empty validation result** — `evaluationResult.warnings.length === 0` and `blockingErrors.length === 0`. Panel renders the existing "Ready to post." path; no chips. (Existing behavior preserved.)
- **Unknown flag code from server** — `EvaluationFlagDetail.flagCode` arrives as a string the union doesn't cover (e.g. server adds a new code before the client is updated). `mapValidationActionOrSuppress` returns `null`. Renderer suppresses the chip but **still renders the warning row** (the server still owns the message text). No raw token leaks to the UI. Tests assert this.
- **All five UX fields would point to a no-op** — `missing_parent`, `invalid_transition`, `civility_risk`, `ad_hominem_possible`, `duplicate_argument_possible`, `excessive_length`, `unclear_claim`, `needs_moderator_review`, `validation_failed_after_retries` are deliberately mapped to `(suggestedMove: null, dockAction: null, presetKey: null)`. The chip is suppressed; only the warning text shows. Test asserts these specific codes are suppressed (no false-positive chip).
- **Multiple warnings on one draft** — render one chip per warning. Two warnings that both map to `ask_source` produce two visually-stacked chips. Acceptable in v1 — duplicate-chip dedup is a v2 concern (would need to land at the panel level, not the map level). Tracked as a v2 follow-up note in the design doc.
- **Blocking errors** — `blockingErrors` are still rendered (existing behavior). RULE-002 chips can appear on blocking errors too — e.g. `evidence_required` is blocking, and the chip "Attach a source" routes to the `evidence` preset. The chip makes the structural fix more discoverable; it does NOT bypass the block. The submit button stays disabled until the user actually attaches evidence (current behavior).
- **Concurrent edits** — RULE-002 is a pure lookup. There is no shared state. Concurrent draft edits triggering rapid re-evaluation simply re-derive the chip on every render — same input → same output. No race conditions possible.
- **Offline / network failure** — the entire flow is local (engine runs on-device). No network involved. Offline is the happy path.
- **Permission denied** — N/A, no auth path is touched.
- **Doctrine edge cases:**
  - **What if `evidence_required` chip routes to `evidence` preset but the parent type forbids an evidence child?** — `quickActionToPreset('evidence', parentType)` returns `{ argumentType: 'evidence' }`. The composer applies the patch; the engine re-evaluates; if the transition is forbidden, the user sees an `invalid_transition` warning. Self-correcting. We do NOT pre-check transitions in RULE-002 — that would re-import the engine and break purity.
  - **What if heat tries to influence which chip surfaces?** — it doesn't. RULE-002 reads `FlagCode` only. Heat / popularity / engagement are not inputs.
  - **What if a flag carries `authoritative: true`?** — the engine never sets `authoritative: true` for AI-sourced flags (doctrine §4); for deterministic flags it doesn't change RULE-002 routing — the chip is still advisory. Authoritative-ness is a *display* concern (the panel may render the warning more prominently); it does NOT change which chip RULE-002 emits.
  - **What if a `weak_topic_satisfaction` chip routes to `branch`, but the user is at depth 0 (root)?** — `quickActionToPreset('branch', null)` returns `null` (existing behavior). Composer receives no patch. Chip becomes a no-op visually but the warning text remains. Acceptable — better to be inert than to crash. A v2 enhancement could disable the chip when the preset returns `null`; tracked but not blocking.

## Test plan

All tests in `__tests__/validationActionMap.test.ts`. Aim for **~55 tests, +50 net** after accounting for cross-suite imports.

### 1. Coverage & exhaustiveness (8 tests)

- `ALL_VALIDATION_ACTION_CODES` length equals `Object.keys(VALIDATION_ACTION_MAP).length`.
- Every member of `ALL_VALIDATION_ACTION_CODES` is a key in `VALIDATION_ACTION_MAP`.
- Every value of `FLAG_CODES` (from `src/domain/constitution/types.ts`) appears in `ALL_VALIDATION_ACTION_CODES`. (Engine-flag completeness gate — adding a new `FlagCode` without a RULE-002 entry will fail this test.)
- The seven Stage 6.2 / 6.4 advisory codes (`source_chain`, `evidence_debt`, `anti_amplification`, `platform_support_warning`, `synthesis_ready`, `validation_failed_after_retries`, `max_depth_reached`) appear in `ALL_VALIDATION_ACTION_CODES`.
- Each entry's `code` field matches its key.
- `getValidationAction(code)` returns the same object as `VALIDATION_ACTION_MAP[code]` for every code.
- `mapValidationActionOrSuppress` returns the same value as `getValidationAction` for known codes.
- `mapValidationActionOrSuppress` returns `null` for unknown codes / `null` / `undefined` / `''`.

### 2. Field-shape & length caps (5 tests)

- Every `chipLabel` is `≤ 32` chars and `> 0` chars.
- Every `helperLine` is `≤ 80` chars and `> 0` chars.
- Every `chipLabel` and `helperLine` is plain English: `looksLikeInternalCode(field) === false` (uses the existing `gameCopy.looksLikeInternalCode` helper).
- No `chipLabel` or `helperLine` contains the snake_case form of any `ValidationActionCode` (no "off_topic" substring leaking through).
- Every entry's `suggestedMove` is either `null` or a member of `ALL_SUGGESTED_MOVE_CODES` (imported from `suggestedMovesModel`); every `dockAction` is either `null` or a member of `ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES`; every `presetKey` is either `null` or a `QuickActionLabel`.

### 3. Ban-list (8 tests)

- No `chipLabel` or `helperLine` contains a verdict token: `winner|loser|liar|dishonest|bad faith|manipulative|extremist|propagandist|stupid|idiot|astroturfer|troll|right|wrong|true|false|proven|verdict|correct`.
- No `chipLabel` or `helperLine` contains a person-attribution token: `you|your|they|their|the user|the author|the poster|the speaker|the participant|this person|this user`. (Same list as `suggestedMovesModel.PERSON_ATTRIBUTION_TOKENS`.)
- No `chipLabel` or `helperLine` contains an amplification-shaped token: `viral|trending|popular|engagement is|likes mean|retweets|follower count`. ("Popularity is not proof" is the only allowed amplification *negation* — a positive test asserts that exact string survives.)
- `_forbiddenValidationActionTokens()` returns a merged deduped list that includes every banned token above.
- Cross-check: every `chipLabel` and `helperLine` is also clean against `_forbiddenSuggestionTokens()` (from `suggestedMovesModel`) so cross-surface vocabulary stays unified.
- Cross-check: every `chipLabel` is plain-language by passing through `looksLikeInternalCode` returning `false`.
- The `anti_amplification` entry's `chipLabel` is literally `"Popularity is not proof"` (the doctrine-canonical phrasing from RULE-001).
- The `platform_support_warning` entry's `chipLabel` is literally `"Hold off on scoring"` (matches RULE-001).

### 4. Issue acceptance criteria (5 tests)

- `weak_topic_satisfaction → "Sharpen the topic link"` chip exists (acceptance "weak topic → May be drifting chip"); helper covers the topic link.
- `parent_nonresponsive → "Reconnect to parent"` chip exists (acceptance "Reconnect to parent suggestion"); `suggestedMove` is `branch_tangent` (closest existing ST-002 code; rationale documented inline since `clarify` is not in the 9-code union).
- `evidence_required → "Attach a source"` AND `source_chain → "Ask for the source"` chips both exist (acceptance "missing source → source-chain action"); both have `dockAction='ask_source'`-or-`'add_evidence'` and a non-null `presetKey`.
- `tangent_shift_possible → branch_tangent` and `loaded_clarification_possible → clarify` exist (acceptance "scope risk → narrow action" + "definition ambiguity → clarify/define"); the scope path also routes through `weak_topic_satisfaction`.
- **"Ordinary replies remain postable" acceptance test:** a synthetic `EvaluationResult` with `allowPost: true` and a single `weak_topic_satisfaction` warning is passed through a mock-renderer assertion that:
  - `canSubmit`-equivalent (`allowPost === true`) is unaffected by the presence of a RULE-002 chip;
  - the chip does NOT mutate the EvaluationResult (deep-equal before/after);
  - the renderer returns both the warning text and the chip (no replacement).

### 5. Normalisation (5 tests)

- `mapValidationActionOrSuppress('OFF_TOPIC')` returns the same entry as `'off_topic'`.
- `mapValidationActionOrSuppress('off-topic')` returns the same entry as `'off_topic'`.
- `mapValidationActionOrSuppress('  off_topic  ')` returns the same entry as `'off_topic'`.
- `mapValidationActionOrSuppress('Off Topic')` returns the same entry as `'off_topic'`.
- `mapValidationActionOrSuppress(null)` / `undefined` / `''` returns `null`.

### 6. Coordination with RULE-001 (4 tests)

- For codes present in BOTH `ALL_RULE_CODES` (RULE-001) and `ALL_VALIDATION_ACTION_CODES` (RULE-002) — that is, `source_chain`, `evidence_debt`, `anti_amplification`, `synthesis_ready`, `platform_support_warning` — assert `RULE_002.chipLabel === RULE_001.toolLabel` for each.
- For codes ONLY in RULE-002 (engine `FlagCode`s like `off_topic`, `invalid_transition`, …) assert RULE-001 returns `null` (`mapRuleToUiAffordance(code) === null`) — i.e. they don't accidentally collide.
- For codes ONLY in RULE-001 (e.g. `scope`, `definition`, `logic`, `causal`) assert RULE-002 returns `null` from `mapValidationActionOrSuppress(code)` — they're axis codes, not engine flags.
- The shared codes (5 above) have `suggestedMove`, `dockAction`, `presetKey` consistent between the two maps where the unions overlap (the test reads RULE-001's `suggestedMove` and checks it routes to the same shape).

### 7. Render contract (8 tests, with mock-shape assertions, no actual `@testing-library/react-native` interaction needed)

These assert the **data contract** the `ComposerValidationPanel` consumes; they don't actually mount RN components (kept light per `test-discipline` "pure-TS models test in isolation"):

- For every `code`, derive the chip data: `{ chipLabel, helperLine, suggestedMove, dockAction, presetKey }` — assert every field has the documented type.
- For codes with `presetKey === null` AND `suggestedMove === null` AND `dockAction === null`, assert the renderer would suppress the chip (test asserts the `(!action.suggestedMove && !action.dockAction && !action.presetKey)` guard returns `true` for these codes specifically — `missing_parent`, `invalid_transition`, `civility_risk`, `ad_hominem_possible`, `duplicate_argument_possible`, `excessive_length`, `unclear_claim`, `needs_moderator_review`, `validation_failed_after_retries`).
- For codes with any non-null UX field, assert the chip would render and the `accessibilityLabel` shape is `${chipLabel}. ${helperLine}`.
- For each chip-emitting code, assert `presetKey` is a valid `QuickActionLabel` AND `quickActionToPreset(presetKey, null)` returns either `null` or a `MoveDraftPatch` (never throws). This catches typos at test time.
- For each chip-emitting code, assert `dockAction` is a valid `TimelineNodeActionDockActionCode`.
- For each chip-emitting code, assert `suggestedMove` is a valid `SuggestedMoveCode`.
- Mock test: a fresh `EvaluationResult` with `allowPost: true` and one warning gets a chip; `allowPost` stays `true` (post-able).
- Mock test: a fresh `EvaluationResult` with `allowPost: false` and one blocking error gets a chip; `allowPost` stays `false` (still blocked — chip is advisory only).

### 8. Snake_case & SemVer hygiene (3 tests)

- Every `ValidationActionCode` matches `/^[a-z][a-z0-9_]*$/`.
- Every key of `VALIDATION_ACTION_MAP` equals its entry's `code`.
- The exported `ALL_VALIDATION_ACTION_CODES` is deeply frozen (`Object.isFrozen()` returns `true`).

### 9. Doctrine self-check (3 tests)

- Snapshot test on `VALIDATION_ACTION_MAP` — if any value changes, the snapshot diff is reviewed for doctrine drift. (Snapshot file committed alongside.)
- `_forbiddenValidationActionTokens()` returned list is non-empty and a strict superset of the verdict + person-attribution + amplification token lists.
- Zero entries have `presetKey` set to a value not in the actual `QuickActionLabel` union (compile-time enforced; this test catches runtime drift if the union ever expands).

### 10. Regression / integration spot (1 test)

- For each Stage 6.4 `gameCopy.PLAIN_LANGUAGE_COPY` key that corresponds to a `ValidationActionCode`, assert `toPlainLanguage(code)` returns a non-null string (i.e. the plain-language layer is still wired for these codes — RULE-002 doesn't replace it, it supplements it).

**Test count target: ~55.** Net new tests added to the suite: **~50** (5 of the cross-checks reuse existing test helpers but add new `it()` cases).

## Dependencies (cards / docs / files)

- **Reads (must already exist; all confirmed):**
  - `FLAG_CODES` + `FlagCode` from `src/domain/constitution/types.ts`.
  - `SuggestedMoveCode` + `ALL_SUGGESTED_MOVE_CODES` + `_forbiddenSuggestionTokens` from `src/features/arguments/suggestedMovesModel.ts`.
  - `TimelineNodeActionDockActionCode` + `ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES` from `src/features/arguments/timelineNodeActionDockModel.ts`.
  - `QuickActionLabel` + `quickActionToPreset` from `src/features/arguments/quickActionPresets.ts`.
  - `RULE_TO_UI_AFFORDANCE` + `ALL_RULE_CODES` + `mapRuleToUiAffordance` from `src/features/rulesUx/ruleToUiMap.ts` (RULE-001).
  - `toPlainLanguage`, `looksLikeInternalCode`, `PLAIN_LANGUAGE_COPY` from `src/features/arguments/gameCopy.ts`.
  - `EvaluationResult`, `EvaluationFlagDetail` from `src/domain/constitution/types.ts`.
- **Assumes shipped:** RULE-001 (PR #merged); RULE-003 (PR #98, commit 97dbbf3); ST-002 (`suggestedMovesModel`); SC-004 (`timelineNodeActionDockModel`); COMPOSER-001 (`quickActionPresets`).
- **Will unblock:** any future card that asks "tell the user how to fix a validation warning in one click" — the gallery hover-card (GAL-002 follow-up), the source-chain popover (EV-002 follow-up), the keyboard-nav action surface (IX-002), the rules reference card.
- **Does NOT block:** any other in-flight card.

## Risks

- **Engine purity** — the highest risk is that an implementer reaches into `src/domain/constitution/engine.ts` to add a new flag code "while we're already touching this area." Mitigation: the engine is sacred (`CLAUDE.md` §"Rules Engine is Sacred"); the design says "untouched"; the test suite type-imports `FlagCode` from the engine but never runtime-imports the engine itself. A code-review check (`grep -r "from.*constitution/engine" src/features/rulesUx`) must return zero matches.
- **`SuggestedMoveCode` gaps** — RULE-002 routes `parent_nonresponsive` to `branch_tangent` even though "reconnect to parent" is arguably closer to a `clarify` shape. The 9-code `SuggestedMoveCode` union doesn't have a `clarify`-flavored member (ST-002 explicitly deferred this — search `suggestedMovesModel.ts` for "definition_issue is deferred"). The design accepts this gap: the `dockAction` and `presetKey` correctly point to `clarify`, and a `preset_gap` diagnostic signal is emitted (matching ST-002's existing pattern for `challenge_mechanism` / `challenge_scope`). A future ST-002 extension that adds a `reconnect_to_parent` or `clarify` member should update RULE-002 in the same commit.
- **Renderer regression on `ComposerValidationPanel`** — the new chip is rendered next to the warning row. Existing screenshot tests (if any) may diff. Mitigation: implementer runs `npm run test` and updates any snapshot files in the same commit; the test plan explicitly includes a "warning text remains visible" assertion to catch accidental replacement.
- **Submit-button regression** — biggest doctrinal risk is that an implementer "helpfully" pre-disables the submit button while a RULE-002 chip is showing. The design says: submit gating is unchanged. The test plan encodes this with a specific test asserting `allowPost` is unaffected.
- **Bot fixtures might emit a new `flagCode` value** — the `bot-fixtures/` runners read advisory codes that are not strictly `FlagCode`. The `mapValidationActionOrSuppress` defensive reader handles this (unknown → `null`), but the live JSONL pipeline may pass through tokens like `three_in_a_row_failures` that don't have a RULE-002 entry. **By design** these surface as plain text only (no chip); not a regression.
- **Translation / i18n** — none of the chip labels are i18n-keyed in v1. Same constraint as the rest of the app. Out of scope.

## Out of scope

- Adding a new `FlagCode` to the engine (e.g. `missing_quote`, `scope_overreach`). Engine is sacred. Future engine-extension cards will land separately and add a RULE-002 entry in the same commit.
- Server-side validation routing — the Edge Function `submit-argument` emits its own `blockingErrors`; RULE-002 does not change the server's behavior. Future work could expose the same chip on server errors but it's a separate card.
- AI-driven flag generation — explicitly forbidden by doctrine §4. The map is deterministic.
- Translation / i18n / RTL — out of scope for v1; matches existing app constraints.
- Duplicate-chip dedup when two warnings route to the same `presetKey` — v2 enhancement.
- Disabling the chip when `quickActionToPreset` would return `null` — v2 enhancement; v1 lets the chip be inert (no crash, just a no-op press). Acceptable.
- A keyboard-nav shortcut to focus the first chip — left to IX-003.
- Wiring the chip into the timeline dock (vs. the composer panel) — the dock already has its own primary-action recommendation via `LIFECYCLE_PROMOTION` and `MANUAL_TAG_ACTION_PROMOTION`. RULE-002's chip lives on the *composer validation surface* and routes to the *composer* preset path; it does NOT compete with the dock's own action selection. A future card may surface RULE-002 chips on the timeline node popover; tracked as separate work.

## Doctrine self-check

- **cdiscourse-doctrine §1** — score never blocks posting: confirmed. The chip is purely additive; `canSubmit` semantics in `ArgumentComposer` are unchanged. Test plan §4 ("Ordinary replies remain postable") encodes this.
- **cdiscourse-doctrine §3** — popularity is not evidence: confirmed. `anti_amplification` and `platform_support_warning` chips route to `ask_source` and "hold off on scoring," never to "this is popular therefore accept."
- **cdiscourse-doctrine §4** — AI moderator hard limits: confirmed. Pure deterministic constant lookup. No `fetch`, no `import` of any client (Supabase, Anthropic, xAI). The module's source file passes `grep -E "(fetch|supabase|anthropic|xai)" src/features/rulesUx/validationActionMap.ts` with zero matches (test enforces this on source file as a sanity check).
- **cdiscourse-doctrine §5** — rules engine is sacred: confirmed. No edits to `src/domain/constitution/*`. RULE-002 type-imports `FlagCode` and runtime-imports nothing from the engine.
- **cdiscourse-doctrine §6** — secrets policy: not applicable; no env / secrets are read.
- **cdiscourse-doctrine §7** — no AI calls from the production app: confirmed; module is pure constants.
- **cdiscourse-doctrine §8** — Supabase conventions: not applicable; no DB / migration / RLS touched.
- **cdiscourse-doctrine §9** — plain language for users: every produced string is plain English; ban-list test enforces this; `looksLikeInternalCode(field) === false` for every field.
- **evidence-doctrine — "what counts as evidence"** — RULE-002 routes evidence-related warnings (`evidence_required`, `source_chain`, `evidence_debt`, `anti_amplification`, `platform_support_warning`) to **ask-for-it** affordances, never to "this is false." Tests assert the verdict-token ban list catches any drift.
- **evidence-doctrine — "amplification can earn engagement credit but not factual standing"** — the `anti_amplification` chip routes to `ask_source` so a viral-but-unsourced move gets a source-request affordance. It does not route to a "discredit" or "flag user" action.
- **accessibility-targets** — chip is `Pressable` with `accessibilityRole="button"`, `accessibilityLabel`, 44×44 hit via `hitSlop`. Reduce-motion: no animations are added. Color: the chip uses a neutral surface color; the chip label carries the meaning (color is not the only signal).
- **expo-rn-patterns** — pure RN primitives (`View`, `Text`, `Pressable`). No new deps. No Bootstrap. No icon library.
- **test-discipline** — pure-TS model file with isolated tests; +50 new tests; tests live in `__tests__/`; ban-list assertions in place; no skipped/commented tests.

## Operator steps (if any)

None — pure code change. No migration, no Edge Function deploy, no env var. The implementer commits, runs `npm run test && npm run typecheck && npm run lint`, opens a PR.
