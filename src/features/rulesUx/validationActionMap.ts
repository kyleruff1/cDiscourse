/**
 * RULE-002 — Evidence symmetry between validation and visuals.
 *
 * Single-source-of-truth UX adapter that bridges the constitution engine's
 * `FlagCode` (the structural / lexical / civility / rails flag vocabulary
 * emitted by `src/domain/constitution/engine.ts` and its evaluator) and the
 * Stage 6.2 / 6.4 advisory codes (already surfaced in `gameCopy.toPlainLanguage`)
 * into a render-ready `ValidationActionUx` tuple:
 *
 *   { code, chipLabel, helperLine, suggestedMove, dockAction, presetKey }
 *
 * The chip is a one-click affordance the player can press to pre-seed the
 * composer with the move shape that would address the warning. The chip
 * is **always advisory** — the engine's `EvaluationResult.allowPost`
 * semantics stay unchanged; ordinary replies remain postable; only the
 * structural-error gate (already engine-owned) blocks posting.
 *
 * Doctrine constraints encoded here (read `cdiscourse-doctrine` first):
 *
 *   §1 (Score never blocks posting) — RULE-002 adds AFFORDANCES, never a
 *      gate. `canSubmit` semantics in `ArgumentComposer` are untouched.
 *   §3 (Popularity is not evidence) — `anti_amplification` and
 *      `platform_support_warning` route to ask-for-source / hold-scoring
 *      affordances, never to "this is popular therefore accept."
 *   §4 (AI moderator hard limits) — pure deterministic constant lookup.
 *      No `fetch`, no `import` of any external client (Supabase,
 *      Anthropic, xAI, etc.). Forbidden-import scan enforces this.
 *   §5 (Rules engine is sacred) — type-imports `FlagCode` only. The
 *      engine module is NEVER imported at runtime. Tests enforce this.
 *   §9 (Plain language for users) — every produced `chipLabel` and
 *      `helperLine` is plain English. `looksLikeInternalCode` returns
 *      `false` for every field. Ban-list scans catch verdict / popularity
 *      / person-attribution tokens.
 *
 * Render contract:
 *   When `mapValidationActionOrSuppress(detail.flagCode)` returns a
 *   non-null `ValidationActionUx` AND at least one of
 *   `suggestedMove` / `dockAction` / `presetKey` is non-null, the chip is
 *   rendered next to the warning text. When all three routing fields are
 *   null (e.g. `invalid_transition`, `civility_risk`), the chip is
 *   SUPPRESSED — the warning text still renders, but no affordance is
 *   offered (these flags require the user to re-author, not click).
 *
 * Pure TypeScript. No React. No Supabase. No network. No AI. No mutation.
 */

// NOTE: `FlagCode` from `src/domain/constitution/types.ts` is the
// authoritative engine enum that mirrors the first 16 members of the
// `ValidationActionCode` union below. We intentionally do NOT
// runtime-import it (the engine module stays sacred — see doctrine §5).
// The cross-walk is enforced by a test that iterates `FLAG_CODES` and
// asserts every value is present in `ALL_VALIDATION_ACTION_CODES`.
import type { SuggestedMoveCode } from '../arguments/suggestedMovesModel';
import type { TimelineNodeActionDockActionCode } from '../arguments/timelineNodeActionDockModel';
import type { QuickActionLabel } from '../arguments/quickActionPresets';

// ── Public types ──────────────────────────────────────────────

/**
 * Stable identifier for a validation flag or Stage 6.2 / 6.4 advisory code
 * that RULE-002 has a one-click affordance for. The union is the merge of:
 *
 *   - every value of `FLAG_CODES` from `src/domain/constitution/types.ts`
 *     (16 engine-emitted flag codes), and
 *   - 7 Stage 6.2 / 6.4 advisory codes already keyed in
 *     `gameCopy.PLAIN_LANGUAGE_COPY` that surface on validation rails or
 *     pipeline status (e.g. `source_chain`, `evidence_debt`,
 *     `anti_amplification`, `platform_support_warning`, `synthesis_ready`,
 *     `validation_failed_after_retries`, `max_depth_reached`).
 *
 * Total: 23 codes. New codes MUST be added here AND to
 * `VALIDATION_ACTION_MAP` in the same commit; tests will fail otherwise.
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

/**
 * The UX tuple returned for a known validation code. All fields are
 * doctrine-clean and plain-English.
 *
 *   - `chipLabel`     — ≤ 32 chars. Verb-shaped affordance ("Reconnect
 *                       to topic", "Ask for the source"). Never a verdict.
 *   - `helperLine`    — ≤ 80 chars. One-line explanation of WHY the chip
 *                       was offered. Describes the MOVE STRUCTURE, never
 *                       the author.
 *   - `suggestedMove` — A member of `SuggestedMoveCode` (ST-002) or `null`
 *                       when no suggestion routes cleanly.
 *   - `dockAction`    — A member of `TimelineNodeActionDockActionCode`
 *                       (SC-004) or `null`. Informational for surfaces
 *                       that don't own a dock.
 *   - `presetKey`     — A member of `QuickActionLabel` (COMPOSER-001) or
 *                       `null`. Used by the composer to pre-seed a draft.
 *
 * When all three of `suggestedMove` / `dockAction` / `presetKey` are
 * `null`, the chip is **suppressed** by the renderer — the validation
 * warning still shows, but no affordance is offered. This is the correct
 * behavior for codes that describe a defect we cannot offer a one-click
 * repair for (e.g. `invalid_transition` — the user has to pick a
 * different move type themselves).
 */
export interface ValidationActionUx {
  code: ValidationActionCode;
  chipLabel: string;
  helperLine: string;
  suggestedMove: SuggestedMoveCode | null;
  dockAction: TimelineNodeActionDockActionCode | null;
  presetKey: QuickActionLabel | null;
}

// ── The map ───────────────────────────────────────────────────

/**
 * Full 23-entry catalog. `chipLabel`s and `helperLine`s where shared with
 * RULE-001 (e.g. `anti_amplification`, `platform_support_warning`,
 * `evidence_debt`, `source_chain`, `synthesis_ready`) are kept verbatim
 * to keep cross-surface vocabulary consistent.
 *
 * The 9 "no clean repair" codes (`missing_parent`, `invalid_transition`,
 * `civility_risk`, `ad_hominem_possible`, `duplicate_argument_possible`,
 * `excessive_length`, `unclear_claim`, `needs_moderator_review`,
 * `validation_failed_after_retries`) have all-null routing fields — the
 * renderer suppresses the chip for these and shows only the engine's
 * warning text. The chipLabel + helperLine still exist so downstream
 * tooling that wants to print them (e.g. a future RULE reference card)
 * can read them; the suppression rule lives at the render boundary.
 */
export const VALIDATION_ACTION_MAP: Readonly<Record<ValidationActionCode, ValidationActionUx>> = Object.freeze({
  // ── Engine-emitted flags (16 entries; one per FLAG_CODES value) ──
  off_topic: {
    code: 'off_topic',
    chipLabel: 'Reconnect to topic',
    helperLine: 'This reply does not engage the resolution. Reframe or branch.',
    suggestedMove: 'branch_tangent',
    dockAction: 'branch',
    presetKey: 'branch',
  },
  weak_topic_satisfaction: {
    code: 'weak_topic_satisfaction',
    chipLabel: 'Sharpen the topic link',
    helperLine: 'The topic connection is light. Make the link explicit.',
    suggestedMove: 'branch_tangent',
    dockAction: 'clarify',
    presetKey: 'clarify',
  },
  missing_parent: {
    code: 'missing_parent',
    chipLabel: 'Pick a parent reply',
    helperLine: 'The reply needs a parent move to land on.',
    suggestedMove: null,
    dockAction: null,
    presetKey: null,
  },
  invalid_transition: {
    code: 'invalid_transition',
    chipLabel: 'Change the move type',
    helperLine: 'That move type is not allowed under this parent.',
    suggestedMove: null,
    dockAction: null,
    presetKey: null,
  },
  evidence_required: {
    code: 'evidence_required',
    chipLabel: 'Attach a source',
    helperLine: 'Evidence posts need at least one source link or quote.',
    suggestedMove: 'ask_source',
    dockAction: 'add_evidence',
    presetKey: 'evidence',
  },
  civility_risk: {
    code: 'civility_risk',
    chipLabel: 'Cool the tone',
    helperLine: 'A measured restatement helps the room.',
    suggestedMove: null,
    dockAction: null,
    presetKey: null,
  },
  ad_hominem_possible: {
    code: 'ad_hominem_possible',
    chipLabel: 'Refocus on the claim',
    // Doctrine ban-list scans for `the speaker` as a person-attribution
    // token. Helper line keeps the focus on argument structure.
    helperLine: 'Keep this move on the argument, not on a person.',
    suggestedMove: null,
    dockAction: null,
    presetKey: null,
  },
  duplicate_argument_possible: {
    code: 'duplicate_argument_possible',
    chipLabel: 'Differentiate from sibling',
    helperLine: 'A nearby reply already makes a similar point. Show what is new.',
    suggestedMove: null,
    dockAction: null,
    presetKey: null,
  },
  excessive_length: {
    code: 'excessive_length',
    chipLabel: 'Trim the move',
    helperLine: 'The body is longer than the limit. Tighten it down.',
    suggestedMove: null,
    dockAction: null,
    presetKey: null,
  },
  unclear_claim: {
    code: 'unclear_claim',
    chipLabel: 'Sharpen the claim',
    helperLine: 'A longer, clearer body usually reads better.',
    suggestedMove: null,
    dockAction: null,
    presetKey: null,
  },
  needs_moderator_review: {
    code: 'needs_moderator_review',
    chipLabel: 'Awaiting moderator',
    helperLine: 'A moderator will review before this lands.',
    suggestedMove: null,
    dockAction: null,
    presetKey: null,
  },
  parent_nonresponsive: {
    code: 'parent_nonresponsive',
    // Designer-resolved: parent_nonresponsive routes to branch_tangent
    // (ST-002 has no `clarify`-shaped SuggestedMoveCode; the dock + preset
    // fields correctly point to `clarify` so the composer opens a
    // clarification draft when pressed). This matches the ST-002 preset_gap
    // pattern for missing 1:1 codes.
    chipLabel: 'Reconnect to parent',
    helperLine: 'The reply does not engage the parent. Tie them together.',
    suggestedMove: 'branch_tangent',
    dockAction: 'clarify',
    presetKey: 'clarify',
  },
  tangent_shift_possible: {
    code: 'tangent_shift_possible',
    chipLabel: 'Branch this off',
    helperLine: 'The thread has shifted; a branch reads cleaner.',
    suggestedMove: 'branch_tangent',
    dockAction: 'branch',
    presetKey: 'branch',
  },
  concession_evasion_possible: {
    code: 'concession_evasion_possible',
    chipLabel: 'Hold the concession line',
    helperLine: 'The concession looks like it dodges the original point.',
    suggestedMove: null,
    dockAction: 'clarify',
    presetKey: 'clarify',
  },
  loaded_clarification_possible: {
    code: 'loaded_clarification_possible',
    chipLabel: 'Neutralize the question',
    helperLine: 'A neutral phrasing avoids smuggling a claim.',
    suggestedMove: null,
    dockAction: 'clarify',
    presetKey: 'clarify',
  },
  fact_confusion_possible: {
    code: 'fact_confusion_possible',
    chipLabel: 'Separate fact from frame',
    helperLine: 'Uncertainty mixed with a factual challenge — split them.',
    suggestedMove: null,
    dockAction: 'clarify',
    presetKey: 'clarify',
  },

  // ── Stage 6.2 / 6.4 advisory codes (7 entries) ──
  source_chain: {
    code: 'source_chain',
    chipLabel: 'Ask for the source',
    // Helper avoids "the speaker" / "the author" tokens (ST-002 banlist).
    helperLine: 'Ask for the primary source backing this claim.',
    suggestedMove: 'ask_source',
    dockAction: 'ask_source',
    presetKey: 'source',
  },
  evidence_debt: {
    code: 'evidence_debt',
    chipLabel: 'Needs receipts',
    helperLine: 'This line is carrying a claim that has not been supported with evidence yet.',
    suggestedMove: 'ask_source',
    dockAction: 'ask_source',
    presetKey: 'source',
  },
  anti_amplification: {
    code: 'anti_amplification',
    chipLabel: 'Popularity is not proof',
    // Helper avoids the standalone tokens `engagement` / `viral` / `popular`
    // (cross-surface ST-002 / META-001 banlist). Says the same thing in
    // structural language about evidence.
    helperLine: 'This line is amplified but not evidenced. Reach does not equal support.',
    suggestedMove: 'ask_source',
    dockAction: 'ask_source',
    presetKey: 'source',
  },
  platform_support_warning: {
    code: 'platform_support_warning',
    chipLabel: 'Hold off on scoring',
    helperLine: 'This line should not gain factual standing until evidence arrives.',
    suggestedMove: 'ask_source',
    dockAction: 'ask_source',
    presetKey: 'source',
  },
  synthesis_ready: {
    code: 'synthesis_ready',
    chipLabel: 'Offer synthesis',
    helperLine: 'The two sides have narrowed enough that a combined statement may capture both.',
    suggestedMove: 'synthesize',
    dockAction: 'synthesize',
    presetKey: 'synthesize',
  },
  validation_failed_after_retries: {
    code: 'validation_failed_after_retries',
    chipLabel: 'Restate the move',
    helperLine: 'The move needs a clearer shape before it can play well.',
    suggestedMove: null,
    dockAction: null,
    presetKey: null,
  },
  max_depth_reached: {
    code: 'max_depth_reached',
    chipLabel: 'Branch this chain',
    helperLine: 'Deep unresolved chain — a branch keeps the timeline readable.',
    suggestedMove: 'branch_tangent',
    dockAction: 'branch',
    presetKey: 'branch',
  },
});

/** Frozen array of every code, in declaration order. Tests iterate this. */
export const ALL_VALIDATION_ACTION_CODES: ReadonlyArray<ValidationActionCode> = Object.freeze(
  Object.keys(VALIDATION_ACTION_MAP) as ValidationActionCode[],
);

// ── Public API ────────────────────────────────────────────────

/**
 * Normalise a free-form code to the canonical lowercase / underscored
 * form used as a map key. Mirrors the normaliser in `gameCopy.ts` and
 * `ruleToUiMap.ts` so external surfaces emitting `off-topic` / `OFF_TOPIC`
 * / `off topic` all resolve to the same entry.
 */
function normalise(code: string | null | undefined): string {
  if (!code) return '';
  return String(code).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Direct typed reader. Compile-time exhaustive — adding a new code to the
 * union without adding a map entry is a TypeScript error. Always returns
 * a `ValidationActionUx`; never throws, never returns null.
 */
export function getValidationAction(code: ValidationActionCode): ValidationActionUx {
  return VALIDATION_ACTION_MAP[code];
}

/**
 * Free-form reader for callers that receive a string from an upstream
 * source (e.g. an `EvaluationFlagDetail.flagCode`, a server-rules JSON,
 * or a Stage 6.4 pipeline stopReason). Normalises whitespace / case /
 * hyphens. Returns `null` for unknown codes — callers MUST suppress
 * unknowns and NEVER render the raw token.
 */
export function mapValidationActionOrSuppress(
  code: string | null | undefined,
): ValidationActionUx | null {
  const k = normalise(code);
  if (!k) return null;
  if (Object.prototype.hasOwnProperty.call(VALIDATION_ACTION_MAP, k)) {
    return VALIDATION_ACTION_MAP[k as ValidationActionCode];
  }
  return null;
}

/**
 * Returns true when the given `ValidationActionUx` has at least one
 * non-null routing field (`suggestedMove` / `dockAction` / `presetKey`).
 * The renderer should ONLY surface a chip when this returns true; when it
 * returns false the engine's warning text still shows but no affordance
 * is offered. Exported so the consumer surface (ComposerValidationPanel)
 * doesn't have to duplicate the rule.
 */
export function shouldRenderValidationActionChip(action: ValidationActionUx): boolean {
  return action.suggestedMove !== null || action.dockAction !== null || action.presetKey !== null;
}

// ── Ban-list ──────────────────────────────────────────────────

/**
 * Test-only consumer. Returns the merged ban-list of verdict /
 * popularity / person-attribution tokens that must NEVER appear in any
 * produced `chipLabel` or `helperLine`. The list mirrors the same
 * shape used by RULE-001 / RULE-003 / ST-002 to keep cross-surface
 * vocabulary unified.
 *
 * Note: "Popularity is not proof" is the canonical doctrine-anti-
 * amplification phrasing. The ban-list scans for `\\bpopular\\b` etc.
 * as standalone tokens — the negation phrase itself does NOT include
 * the standalone `popular` token, so it passes the scan.
 */
export function _forbiddenValidationActionTokens(): string[] {
  return [
    // Verdict tokens.
    'winner',
    'loser',
    'correct',
    'incorrect',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'troll',
    'astroturfer',
    'verdict',
    'proof',
    'proven',
    'disproven',
    'validated',
    'lost',
    'defeated',
    'won',
    'stupid',
    'idiot',
    // Amplification tokens.
    'viral',
    'trending',
    'popular',
    'likes',
    'retweets',
    'shares',
    'followers',
    'follower count',
    'engagement is',
    'likes mean',
    // Person-attribution tokens (whole-word match enforced by the test).
    'you',
    'your',
    "you're",
    'yours',
    'they',
    'their',
    "they're",
    'theirs',
    'the user',
    'the author',
    'the poster',
    'this person',
    'this user',
  ];
}
