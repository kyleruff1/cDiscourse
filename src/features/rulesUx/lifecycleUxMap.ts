/**
 * RULE-003 — Lifecycle / manual-tag / auto-metadata UX doctrine map.
 *
 * Single source of truth that maps every LIFE-001 point-lifecycle state,
 * every META-001 manual tag, and every META-001 auto-derived metadata
 * code to a render-ready UX triple:
 *
 *   {
 *     code:               <typed union member>,
 *     label:              <plain-language label, READ from PLAIN_LANGUAGE_COPY
 *                          via the typed lifecycle/manual-tag/auto-metadata
 *                          getter — NEVER newly authored here>,
 *     helperLine:         <≤ 80-char single-line tooltip / a11y hint>,
 *     iconHint:           <semantic icon name; verdict glyphs excluded>,
 *     allowedDockActions: <advisory SC-004 dock actions; lifecycle only>,
 *   }
 *
 * Consumers (SC-003 cluster headers, SC-004 dock — already merged but
 * keeps its own helper copy table, ST-002 suggested-move chips, GAL-002
 * gallery cards, IX-002 keyboard hint surface, the upcoming RULE
 * reference card) read this map and stay doctrine-clean by construction.
 *
 * Doctrine constraints encoded here (from `cdiscourse-doctrine`,
 * `accessibility-targets`, `timeline-grammar`):
 *
 *   - No verdict tokens in any produced string (label or helperLine).
 *     Re-checked at test time by `_forbiddenLifecycleTokens()` and
 *     `_forbiddenMetadataTokens()`.
 *   - No person-attribution in any produced helperLine. The helper
 *     describes the *cluster* or the *move structure*, never the
 *     author. `ignored_by_negative` surfaces as "Negative did not
 *     respond" (cluster-level factual statement about a side), never
 *     as an accusation against a user.
 *   - No truth / popularity / heat language. `hot` is OK only in the
 *     legitimate `GALLERY_SECTIONS` carveout per doctrine §2; here
 *     it is forbidden because the helper would slip into truth /
 *     correctness territory.
 *   - No state derivation. RULE-003 is a constant-lookup module:
 *     pure data + three deterministic readers.
 *   - No allowed-action invention. Every `allowedDockActions[]` value
 *     is a member of SC-004's `TimelineNodeActionDockActionCode` union.
 *
 * Pure TypeScript. No React, no Supabase, no network, no AI, no
 * external dependency. The maps are frozen at module load.
 */

import type { PointLifecycleState } from '../lifecycle';
import type { ManualTagCode, AutoMetadataCode } from '../metadata';
import {
  getPointLifecyclePlainLabel,
} from '../lifecycle';
import {
  getManualTagPlainLabel,
  getAutoMetadataPlainLabel,
} from '../metadata';
import type {
  TimelineNodeActionDockActionCode,
} from '../arguments/timelineNodeActionDockModel';

// ── Icon hint vocabulary ──────────────────────────────────────

/**
 * Structural / positional / mood icon hints. NEVER a verdict glyph
 * (no `checkmark`, `x`, `crown`, `flame`, `thumbs_up`, `thumbs_down`,
 * `trophy`, `shield`, `warning`, `medal`, `gavel`, `star`).
 *
 * Consumers choose the actual icon implementation; this is the SEMANTIC
 * vocabulary RULE-003 commits to. Adding a new hint requires updating
 * `IconHint` + `ALL_ICON_HINTS` in the same commit; the ban-glyph test
 * refuses verdict-shaped additions.
 */
export type IconHint =
  // Structural — describe the move/cluster shape.
  | 'open_circle'           // open / awaiting reply
  | 'speech_bubble'         // has a reply / answered
  | 'hexagon'               // sourced / source_attached / has_evidence
  | 'document'              // quote attached
  | 'dotted_hexagon'        // source_requested / needs_source
  | 'dotted_document'       // quote_requested / needs_quote
  | 'arrow_inward'          // narrowed / narrowed_claim (scope tightening)
  | 'arrow_handshake'       // conceded / concession_offered
  | 'arrow_merge'           // confirmed / synthesis convergence
  | 'arrow_branch'          // branch_recommended / branch_suggested / branch_created
  | 'question_mark'         // clarified / definition_issue / loaded_clarification
  | 'diamond'               // rebutted / has_rebuttal / challenge axis
  | 'double_diamond'        // has_counter_rebuttal
  | 'scope_brackets'        // scope_issue / scope axis
  | 'gear'                  // causal_mechanism / mechanism axis
  // Positional — describe board state.
  | 'pause_dots'            // moved_on / no_response / point_stalled
  | 'crossed_lines'         // ignored_by_both
  | 'fade'                  // ignored_by_*  (single side absence)
  | 'archive_box'           // archived_or_resolved
  | 'horizon'               // exhausted / point_exhausted
  | 'side_step'             // tangent / participant_skipped_node
  // Mood — neutral activity descriptors. NOT verdicts.
  | 'meter'                 // repeated_axis_pressure / evidence_debt
  | 'spark'                 // synthesis_candidate (positive activity, NOT "winner")
  | 'eye';                  // ready_for_synthesis / synthesis_ready

/** Frozen list — tests iterate this to assert no verdict glyph leaked in. */
export const ALL_ICON_HINTS: ReadonlyArray<IconHint> = Object.freeze([
  'open_circle',
  'speech_bubble',
  'hexagon',
  'document',
  'dotted_hexagon',
  'dotted_document',
  'arrow_inward',
  'arrow_handshake',
  'arrow_merge',
  'arrow_branch',
  'question_mark',
  'diamond',
  'double_diamond',
  'scope_brackets',
  'gear',
  'pause_dots',
  'crossed_lines',
  'fade',
  'archive_box',
  'horizon',
  'side_step',
  'meter',
  'spark',
  'eye',
]);

// ── Action vocabulary alias ───────────────────────────────────

/**
 * Action vocabulary is SC-004's, re-aliased here so consumers don't
 * import deep into `arguments/`. The alias is `import type`, not
 * re-export — the canonical type still lives in
 * `timelineNodeActionDockModel.ts`.
 */
export type DockAction = TimelineNodeActionDockActionCode;

// ── Entry shapes ──────────────────────────────────────────────

/**
 * Per-lifecycle-state UX triple. `label` is read through
 * `getPointLifecyclePlainLabel(code)` at module-load time; helper /
 * iconHint / allowedDockActions are committed here.
 */
export interface LifecycleUxEntry {
  code: PointLifecycleState;
  /** Read from getPointLifecyclePlainLabel(code). NEVER overridden here. */
  label: string;
  /** ≤ 80 chars. Single-line tooltip / helper hint. Plain English. */
  helperLine: string;
  iconHint: IconHint;
  /**
   * Advisory list of dock actions that "make sense" for a node/cluster
   * sitting in this lifecycle state. SC-004's role/own-bubble/observer
   * gates still apply on top — this list NEVER overrides actor rules.
   * MAY be empty for terminal states (e.g. `archived_or_resolved`).
   *
   * The three SC-004 codes `expand_branch` (collapsed-stub primitive),
   * `mark_moved_on`, and `mark_ignored` (v1-disabled for every actor)
   * are intentionally forbidden in this advisory list — recommending
   * them from RULE-003 would mislead.
   */
  allowedDockActions: ReadonlyArray<DockAction>;
}

/**
 * Per-manual-tag UX triple. No `allowedDockActions` — tags are
 * participant annotations, not state. SC-004's
 * `MANUAL_TAG_ACTION_PROMOTION` already maps tags to actions;
 * RULE-003 does NOT shadow that.
 */
export interface ManualTagUxEntry {
  code: ManualTagCode;
  label: string;
  helperLine: string;
  iconHint: IconHint;
}

/**
 * Per-auto-metadata UX triple. No `allowedDockActions` — auto-derived
 * observations are surfaced as chips, not as state.
 */
export interface AutoMetadataUxEntry {
  code: AutoMetadataCode;
  label: string;
  helperLine: string;
  iconHint: IconHint;
}

// ── LIFECYCLE_UX_MAP ──────────────────────────────────────────

/**
 * 19 entries — every value in `ALL_POINT_LIFECYCLE_STATES`.
 *
 * `label` is read at module-load time from
 * `getPointLifecyclePlainLabel(code)`. The map is frozen, so consumers
 * cannot mutate entries at runtime.
 */
export const LIFECYCLE_UX_MAP: Readonly<Record<PointLifecycleState, LifecycleUxEntry>> = Object.freeze({
  open: Object.freeze({
    code: 'open',
    label: getPointLifecyclePlainLabel('open'),
    helperLine: 'Nobody has replied to this yet.',
    iconHint: 'open_circle',
    allowedDockActions: ['reply', 'challenge', 'ask_source', 'clarify', 'flag'] as const,
  }),
  answered: Object.freeze({
    code: 'answered',
    label: getPointLifecyclePlainLabel('answered'),
    helperLine: 'At least one reply landed on this cluster.',
    iconHint: 'speech_bubble',
    allowedDockActions: ['challenge', 'clarify', 'ask_source', 'reply', 'flag'] as const,
  }),
  rebutted: Object.freeze({
    code: 'rebutted',
    label: getPointLifecyclePlainLabel('rebutted'),
    helperLine: 'A same-axis rebuttal is in play and has not been answered.',
    iconHint: 'diamond',
    allowedDockActions: ['challenge', 'clarify', 'add_evidence', 'ask_source', 'flag'] as const,
  }),
  clarified: Object.freeze({
    code: 'clarified',
    label: getPointLifecyclePlainLabel('clarified'),
    helperLine: 'A clarification has narrowed the question.',
    iconHint: 'question_mark',
    allowedDockActions: ['reply', 'challenge', 'add_evidence', 'flag'] as const,
  }),
  sourced: Object.freeze({
    code: 'sourced',
    label: getPointLifecyclePlainLabel('sourced'),
    helperLine: 'A primary source is attached to a move in this cluster.',
    iconHint: 'hexagon',
    allowedDockActions: ['challenge', 'ask_quote', 'add_evidence', 'reply', 'flag'] as const,
  }),
  quote_requested: Object.freeze({
    code: 'quote_requested',
    label: getPointLifecyclePlainLabel('quote_requested'),
    helperLine: 'Someone asked for the exact passage.',
    iconHint: 'dotted_document',
    allowedDockActions: ['ask_quote', 'clarify', 'add_evidence', 'reply', 'flag'] as const,
  }),
  source_requested: Object.freeze({
    code: 'source_requested',
    label: getPointLifecyclePlainLabel('source_requested'),
    helperLine: 'Someone asked for a primary source.',
    iconHint: 'dotted_hexagon',
    allowedDockActions: ['ask_source', 'clarify', 'add_evidence', 'reply', 'flag'] as const,
  }),
  narrowed: Object.freeze({
    code: 'narrowed',
    label: getPointLifecyclePlainLabel('narrowed'),
    helperLine: 'The claim was narrowed to a tighter scope.',
    iconHint: 'arrow_inward',
    allowedDockActions: ['confirm', 'challenge', 'reply', 'flag'] as const,
  }),
  conceded: Object.freeze({
    code: 'conceded',
    label: getPointLifecyclePlainLabel('conceded'),
    helperLine: 'The broad point was conceded on this cluster.',
    iconHint: 'arrow_handshake',
    allowedDockActions: ['confirm', 'synthesize', 'reply', 'flag'] as const,
  }),
  confirmed: Object.freeze({
    code: 'confirmed',
    label: getPointLifecyclePlainLabel('confirmed'),
    helperLine: 'The other side confirmed the repaired claim.',
    iconHint: 'arrow_merge',
    allowedDockActions: ['synthesize', 'reply', 'flag'] as const,
  }),
  synthesis_ready: Object.freeze({
    code: 'synthesis_ready',
    label: getPointLifecyclePlainLabel('synthesis_ready'),
    helperLine: 'The two sides have converged enough to summarise.',
    iconHint: 'eye',
    allowedDockActions: ['synthesize', 'confirm', 'reply', 'flag'] as const,
  }),
  moved_on_by_affirmative: Object.freeze({
    code: 'moved_on_by_affirmative',
    label: getPointLifecyclePlainLabel('moved_on_by_affirmative'),
    helperLine: 'Affirmative has not posted to this cluster in a while.',
    iconHint: 'pause_dots',
    allowedDockActions: ['confirm', 'reply', 'synthesize', 'flag'] as const,
  }),
  moved_on_by_negative: Object.freeze({
    code: 'moved_on_by_negative',
    label: getPointLifecyclePlainLabel('moved_on_by_negative'),
    helperLine: 'Negative has not posted to this cluster in a while.',
    iconHint: 'pause_dots',
    allowedDockActions: ['confirm', 'reply', 'synthesize', 'flag'] as const,
  }),
  ignored_by_affirmative: Object.freeze({
    code: 'ignored_by_affirmative',
    label: getPointLifecyclePlainLabel('ignored_by_affirmative'),
    helperLine: 'Affirmative has an open request unanswered.',
    iconHint: 'fade',
    allowedDockActions: ['reply', 'synthesize', 'flag'] as const,
  }),
  ignored_by_negative: Object.freeze({
    code: 'ignored_by_negative',
    label: getPointLifecyclePlainLabel('ignored_by_negative'),
    helperLine: 'Negative has an open request unanswered.',
    iconHint: 'fade',
    allowedDockActions: ['reply', 'synthesize', 'flag'] as const,
  }),
  ignored_by_both: Object.freeze({
    code: 'ignored_by_both',
    label: getPointLifecyclePlainLabel('ignored_by_both'),
    helperLine: 'Both sides have stalled on the same open request.',
    iconHint: 'crossed_lines',
    allowedDockActions: ['reply', 'synthesize', 'flag'] as const,
  }),
  exhausted: Object.freeze({
    code: 'exhausted',
    label: getPointLifecyclePlainLabel('exhausted'),
    helperLine: 'Same-axis pressure has repeated without new information.',
    iconHint: 'horizon',
    allowedDockActions: ['narrow', 'branch', 'synthesize', 'flag'] as const,
  }),
  branch_recommended: Object.freeze({
    code: 'branch_recommended',
    label: getPointLifecyclePlainLabel('branch_recommended'),
    helperLine: 'Off-axis pressure has built up; a branch reads cleaner.',
    iconHint: 'arrow_branch',
    allowedDockActions: ['branch', 'narrow', 'reply', 'flag'] as const,
  }),
  archived_or_resolved: Object.freeze({
    code: 'archived_or_resolved',
    label: getPointLifecyclePlainLabel('archived_or_resolved'),
    helperLine: 'An admin or synthesis closed this cluster.',
    iconHint: 'archive_box',
    allowedDockActions: [] as const,
  }),
});

// ── MANUAL_TAG_UX_MAP ─────────────────────────────────────────

/**
 * 10 entries — every value in `ALL_MANUAL_TAG_CODES`.
 *
 * Manual tags are participant annotations. Helper lines deliberately
 * phrase the observation as a participant action ("A participant
 * flagged…", "The author offered…"), describing the move-level event,
 * never the author's character.
 */
export const MANUAL_TAG_UX_MAP: Readonly<Record<ManualTagCode, ManualTagUxEntry>> = Object.freeze({
  needs_source: Object.freeze({
    code: 'needs_source',
    label: getManualTagPlainLabel('needs_source'),
    helperLine: 'A participant flagged this move as needing a primary source.',
    iconHint: 'dotted_hexagon',
  }),
  needs_quote: Object.freeze({
    code: 'needs_quote',
    label: getManualTagPlainLabel('needs_quote'),
    helperLine: 'A participant asked for the exact quoted passage.',
    iconHint: 'dotted_document',
  }),
  definition_issue: Object.freeze({
    code: 'definition_issue',
    label: getManualTagPlainLabel('definition_issue'),
    helperLine: 'A participant flagged a key term as undefined or contested.',
    iconHint: 'question_mark',
  }),
  scope_issue: Object.freeze({
    code: 'scope_issue',
    label: getManualTagPlainLabel('scope_issue'),
    helperLine: 'A participant flagged the claim scope as too broad.',
    iconHint: 'scope_brackets',
  }),
  causal_mechanism: Object.freeze({
    code: 'causal_mechanism',
    label: getManualTagPlainLabel('causal_mechanism'),
    helperLine: 'A participant asked for the cause-and-effect mechanism.',
    iconHint: 'gear',
  }),
  evidence_debt: Object.freeze({
    code: 'evidence_debt',
    label: getManualTagPlainLabel('evidence_debt'),
    helperLine: 'A participant flagged unresolved evidence on this move.',
    iconHint: 'meter',
  }),
  concession_offered: Object.freeze({
    code: 'concession_offered',
    label: getManualTagPlainLabel('concession_offered'),
    helperLine: 'A concession was offered on this move.',
    iconHint: 'arrow_handshake',
  }),
  narrowed_claim: Object.freeze({
    code: 'narrowed_claim',
    label: getManualTagPlainLabel('narrowed_claim'),
    helperLine: 'The claim was narrowed on this move.',
    iconHint: 'arrow_inward',
  }),
  tangent: Object.freeze({
    code: 'tangent',
    label: getManualTagPlainLabel('tangent'),
    helperLine: 'A participant flagged this move as off-axis.',
    iconHint: 'side_step',
  }),
  ready_for_synthesis: Object.freeze({
    code: 'ready_for_synthesis',
    label: getManualTagPlainLabel('ready_for_synthesis'),
    helperLine: 'A participant signalled the cluster is ready to summarise.',
    iconHint: 'eye',
  }),
});

// ── AUTO_METADATA_UX_MAP ──────────────────────────────────────

/**
 * 16 entries — every value in `ALL_AUTO_METADATA_CODES`.
 *
 * Auto-derived observations describe the move structure ("A reply was
 * posted", "Source attached") and never engagement ("Lots of replies",
 * "Trending challenge").
 */
export const AUTO_METADATA_UX_MAP: Readonly<Record<AutoMetadataCode, AutoMetadataUxEntry>> = Object.freeze({
  has_reply: Object.freeze({
    code: 'has_reply',
    label: getAutoMetadataPlainLabel('has_reply'),
    helperLine: 'A reply was posted under this move.',
    iconHint: 'speech_bubble',
  }),
  has_rebuttal: Object.freeze({
    code: 'has_rebuttal',
    label: getAutoMetadataPlainLabel('has_rebuttal'),
    helperLine: 'A same-axis challenge was posted under this move.',
    iconHint: 'diamond',
  }),
  has_counter_rebuttal: Object.freeze({
    code: 'has_counter_rebuttal',
    label: getAutoMetadataPlainLabel('has_counter_rebuttal'),
    helperLine: 'A counter-challenge was posted under this move.',
    iconHint: 'double_diamond',
  }),
  has_evidence: Object.freeze({
    code: 'has_evidence',
    label: getAutoMetadataPlainLabel('has_evidence'),
    helperLine: 'This move has an evidence artifact attached.',
    iconHint: 'hexagon',
  }),
  source_requested: Object.freeze({
    code: 'source_requested',
    label: getAutoMetadataPlainLabel('source_requested'),
    helperLine: 'This move asked for a primary source.',
    iconHint: 'dotted_hexagon',
  }),
  quote_requested: Object.freeze({
    code: 'quote_requested',
    label: getAutoMetadataPlainLabel('quote_requested'),
    helperLine: 'This move asked for the exact passage.',
    iconHint: 'dotted_document',
  }),
  source_attached: Object.freeze({
    code: 'source_attached',
    label: getAutoMetadataPlainLabel('source_attached'),
    helperLine: 'This move has a primary source attached.',
    iconHint: 'hexagon',
  }),
  quote_attached: Object.freeze({
    code: 'quote_attached',
    label: getAutoMetadataPlainLabel('quote_attached'),
    helperLine: 'This move has an exact quote attached.',
    iconHint: 'document',
  }),
  participant_skipped_node: Object.freeze({
    code: 'participant_skipped_node',
    label: getAutoMetadataPlainLabel('participant_skipped_node'),
    helperLine: 'The same side moved past this node without replying.',
    iconHint: 'side_step',
  }),
  no_response_after_n_turns: Object.freeze({
    code: 'no_response_after_n_turns',
    label: getAutoMetadataPlainLabel('no_response_after_n_turns'),
    helperLine: 'No reply landed after the configured turn threshold.',
    iconHint: 'pause_dots',
  }),
  repeated_axis_pressure: Object.freeze({
    code: 'repeated_axis_pressure',
    label: getAutoMetadataPlainLabel('repeated_axis_pressure'),
    helperLine: 'The same axis was challenged again with no new information.',
    iconHint: 'meter',
  }),
  branch_suggested: Object.freeze({
    code: 'branch_suggested',
    label: getAutoMetadataPlainLabel('branch_suggested'),
    helperLine: 'Off-axis pressure suggests a branch would read cleaner.',
    iconHint: 'arrow_branch',
  }),
  branch_created: Object.freeze({
    code: 'branch_created',
    label: getAutoMetadataPlainLabel('branch_created'),
    helperLine: 'A branch was opened from this move.',
    iconHint: 'arrow_branch',
  }),
  point_stalled: Object.freeze({
    code: 'point_stalled',
    label: getAutoMetadataPlainLabel('point_stalled'),
    helperLine: 'This move has had no further activity for a while.',
    iconHint: 'pause_dots',
  }),
  point_exhausted: Object.freeze({
    code: 'point_exhausted',
    label: getAutoMetadataPlainLabel('point_exhausted'),
    helperLine: 'This move has no remaining direct moves available.',
    iconHint: 'horizon',
  }),
  synthesis_candidate: Object.freeze({
    code: 'synthesis_candidate',
    label: getAutoMetadataPlainLabel('synthesis_candidate'),
    helperLine: 'This move sits at a point where a summary would land.',
    iconHint: 'spark',
  }),
});

// ── Readers ───────────────────────────────────────────────────

/**
 * Direct typed lookup. The type system guarantees `code` is a member of
 * `PointLifecycleState`; the map is keyed by
 * `Record<PointLifecycleState, LifecycleUxEntry>` so the lookup is
 * total — NO fallback string, NO runtime branch for unknown codes.
 * Adding a new state to the union without adding a map entry is a
 * compile error.
 */
export function getLifecycleUx(code: PointLifecycleState): LifecycleUxEntry {
  return LIFECYCLE_UX_MAP[code];
}

/** Same totality contract as `getLifecycleUx`. */
export function getManualTagUx(code: ManualTagCode): ManualTagUxEntry {
  return MANUAL_TAG_UX_MAP[code];
}

/** Same totality contract as `getLifecycleUx`. */
export function getAutoMetadataUx(code: AutoMetadataCode): AutoMetadataUxEntry {
  return AUTO_METADATA_UX_MAP[code];
}
