/**
 * ST-002 — Suggested reply flags per bubble card.
 *
 * Pure TypeScript. No React. No Supabase. No network. No AI.
 *
 * Produces a small, ordered list of advisory "suggested next move" records
 * derived deterministically from upstream gameplay state — lifecycle
 * (LIFE-001), manual tag + auto-metadata (META-001), evidence source-chain
 * (EV-001), and the RULE-003 UX map.
 *
 * Doctrine constraints encoded here (from `cdiscourse-doctrine` + the
 * issue body):
 *
 *   1. Suggestions describe the MOVE SHAPE, never the author. No
 *      `you / your / they / their / the user / the author / the poster`
 *      tokens in any rationale.
 *   2. Score never blocks posting. ST-002 is advisory. An empty
 *      suggestion list is a valid output; the composer keeps its
 *      ordinary reply path open regardless.
 *   3. No popularity / engagement / heat input is consumed. The deriver
 *      reads lifecycle / manual tag / auto metadata / axis / source-chain
 *      risk / depth / branch state / latest move type / no-rebuttal /
 *      stopReason / standing. It NEVER reads engagement counts, view
 *      counts, virality, or anything from a temperature band.
 *   4. No new presets are introduced. Every `SuggestedMove.presetKey` is
 *      an existing entry in `QuickActionLabel`. The three gap codes
 *      (`challenge_mechanism`, `challenge_scope`, `branch_tangent`) map
 *      to the closest existing preset and emit a tracked `gap:<code>`
 *      diagnostic in `sourceSignals`.
 *   5. No live AI. Pure deterministic TS. Same inputs → same outputs.
 *   6. The dock owns execution. ST-002 produces data; the dock (SC-004)
 *      and composer (COMPOSER-001) execute. The view model exposes no
 *      `onPress`, no callback, no dispatch field.
 *
 * Boundary (test-enforced):
 *   - Type-only imports of SC-004's `TimelineNodeActionDockActionCode`.
 *   - No value-import or reference to `ArgumentComposer`,
 *     `buildPointLifecycleMap`, `deriveAutoMetadataForMessage`,
 *     `gradeChallenge`, `gradeRepair`, `applyAntiAmplification`,
 *     `supabase`, `fetch`, `anthropic`, `xai`.
 *   - No `onPress|onAction|dispatch|callback|handler` field name.
 */

import type {
  PointLifecycleState,
  PointLifecycleClusterSummary,
} from '../lifecycle';
import {
  _forbiddenLifecycleTokens,
} from '../lifecycle';
import type {
  ManualTagCode,
  AutoMetadataCode,
  ClusterMetadataSummary,
  MoveLinkageRecord,
} from '../metadata';
import {
  _forbiddenMetadataTokens,
} from '../metadata';
import type {
  TimelineNodeActionDockActionCode,
} from './timelineNodeActionDockModel';
import type {
  QuickActionLabel,
} from './quickActionPresets';
import {
  LIFECYCLE_UX_MAP,
  AUTO_METADATA_UX_MAP,
} from '../rulesUx/lifecycleUxMap';
import type {
  SourceChainStatus,
} from '../evidence/evidenceModel';

// ── Public types ──────────────────────────────────────────────

/**
 * ST-002 — the 9-code suggestion vocabulary. Each code maps to an existing
 * `QuickActionLabel` preset and, when one exists, a SC-004 dock action.
 */
export type SuggestedMoveCode =
  | 'ask_source'
  | 'ask_quote'
  | 'narrow'
  | 'concede'
  | 'confirm'
  | 'challenge_mechanism'
  | 'challenge_scope'
  | 'branch_tangent'
  | 'synthesize';

export const ALL_SUGGESTED_MOVE_CODES: ReadonlyArray<SuggestedMoveCode> = Object.freeze([
  'ask_source',
  'ask_quote',
  'narrow',
  'concede',
  'confirm',
  'challenge_mechanism',
  'challenge_scope',
  'branch_tangent',
  'synthesize',
]);

/**
 * Why a suggestion was emitted. Used for AN-003 diagnostics + tests. Never
 * rendered as raw text. The rationale STRING is what surfaces to the user;
 * signals are the structural evidence.
 *
 * Discriminated union — adding a new signal requires extending the
 * rationale builder's case table (compile-time enforced).
 */
export type SuggestionSignal =
  | { kind: 'unresolved_source_request' }
  | { kind: 'unresolved_quote_request' }
  | { kind: 'manual_tag_present'; tag: ManualTagCode }
  | { kind: 'auto_metadata_present'; code: AutoMetadataCode }
  | { kind: 'lifecycle_state_match'; state: PointLifecycleState }
  | { kind: 'narrow_concession_opportunity' }
  | { kind: 'synthesis_ready' }
  | { kind: 'point_exhausted_same_axis' }
  | { kind: 'branch_recommended_off_axis' }
  | { kind: 'broken_source_chain'; status: SourceChainStatus }
  | { kind: 'no_response_after_n_turns' }
  | { kind: 'preset_gap'; code: SuggestedMoveCode };

/**
 * One suggestion record. Returned in deterministic priority order.
 *
 * - `presetKey` MUST be a member of `QuickActionLabel`.
 * - `dockAction` is the closest matching SC-004 action when one exists.
 * - `rationale` is built by `buildRationale(signals)`. Cap 80 chars.
 */
export interface SuggestedMove {
  code: SuggestedMoveCode;
  /** Plain-language, ≤ 24 chars. Reused from the RULE-003 helper layer. */
  label: string;
  /** Plain-language, ≤ 80 chars. */
  rationale: string;
  presetKey: QuickActionLabel;
  dockAction: TimelineNodeActionDockActionCode | null;
  sourceSignals: ReadonlyArray<SuggestionSignal>;
}

/**
 * Input bundle. All optional fields are gracefully handled (missing →
 * suggestion is suppressed; not thrown). The deriver is total.
 */
export interface SuggestionDerivationInput {
  /** Cluster lifecycle summary. Null → only minimal suggestions emitted. */
  clusterSummary: PointLifecycleClusterSummary | null;
  /** Cluster metadata aggregate. Null → only lifecycle-driven suggestions. */
  clusterMetadata: ClusterMetadataSummary | null;
  /** Per-move linkage for the *selected* move. Null when no move is selected. */
  moveLinkage: MoveLinkageRecord | null;
  /** Source-chain status of the selected move. Null when no contract. */
  sourceChainStatus: SourceChainStatus | null;
  /** EV-001 evidentiary-risk label, plain-language. Reserved; null in v1. */
  evidentiaryRisk: 'low' | 'medium' | 'high' | 'unknown' | null;
  /** Latest move's argument type. Null when undetectable. Reserved for
   *  future heuristics; the deriver does not branch on it in v1. */
  latestMoveType:
    | 'rebuttal'
    | 'counter_rebuttal'
    | 'clarification_request'
    | 'evidence'
    | 'concession'
    | 'synthesis'
    | 'claim'
    | null;
  /** Active path depth (0 = root). Reserved for future heuristics. */
  activePathDepth: number;
  /** True when the selected move has been outstanding without rebuttal for
   *  longer than threshold. */
  isNoRebuttal: boolean;
  /** Last validation stopReason from `submit-argument` (gameCopy code).
   *  Reserved; null in v1. */
  stopReason: string | null;
  /** True when the selected move is on a side branch. */
  isOnSideBranch: boolean;
  /** True when the selected move is flagged as a tangent (manual tag /
   *  auto metadata). */
  isTangent: boolean;
  /** Standing band, plain-language. Reserved; doctrine: never used to
   *  add or remove a suggestion (standing is play state, not truth). */
  standingBand: string | null;
  /** Caller-side cap on suggestions returned. Default 3. Values ≤ 0 →
   *  default. */
  maxSuggestions?: number;
}

/**
 * The public type that widens SC-003's stub. ST-002's deriver returns
 * arrays of `SuggestedMove`; the SC-003 sidecar slot becomes
 * `SuggestedMove | null` after widening.
 */
export type SuggestedNextMove = SuggestedMove;

// ── Constants ─────────────────────────────────────────────────

const DEFAULT_MAX_SUGGESTIONS = 3;
const RATIONALE_CAP = 80;
const LABEL_CAP = 24;
const ELLIPSIS = '…';

/**
 * COPY-001 person-attribution token list (case-insensitive, whole-word).
 * The rationale must NOT contain any of these.
 */
const PERSON_ATTRIBUTION_TOKENS: ReadonlyArray<string> = Object.freeze([
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
  'the speaker',
  'the participant',
  'this person',
  'this user',
]);

/**
 * Plain-language labels, each ≤ 24 chars. These mirror the human-readable
 * surface a chip would render. Read from the RULE-003 helper layer where
 * possible; not freshly authored per call.
 *
 * - `ask_source` / `ask_quote` reuse the RULE-003 lifecycle labels
 *   verbatim.
 * - `narrow` / `concede` / `confirm` / `synthesize` reuse the lifecycle
 *   labels.
 * - The three gap codes (`challenge_mechanism`, `challenge_scope`,
 *   `branch_tangent`) carry a short label drawn from the existing
 *   META-001 manual-tag / lifecycle label surface — they are NOT freshly
 *   authored, they are composed from already-banlist-scanned tokens.
 */
const SUGGESTED_MOVE_LABELS: Readonly<Record<SuggestedMoveCode, string>> = Object.freeze({
  ask_source: LIFECYCLE_UX_MAP.source_requested.label,
  ask_quote: LIFECYCLE_UX_MAP.quote_requested.label,
  narrow: LIFECYCLE_UX_MAP.narrowed.label,
  concede: LIFECYCLE_UX_MAP.conceded.label,
  confirm: LIFECYCLE_UX_MAP.confirmed.label,
  challenge_mechanism: 'Challenge mechanism',
  challenge_scope: 'Challenge scope',
  branch_tangent: 'Branch tangent',
  synthesize: LIFECYCLE_UX_MAP.synthesis_ready.label,
});

/**
 * Suggestion → preset mapping. Every value is a member of
 * `QuickActionLabel`. The three gap codes route to the closest existing
 * preset.
 */
const SUGGESTED_MOVE_PRESET: Readonly<Record<SuggestedMoveCode, QuickActionLabel>> = Object.freeze({
  ask_source: 'source',
  ask_quote: 'quote',
  narrow: 'narrow',
  concede: 'concede',
  confirm: 'confirm',
  challenge_mechanism: 'challenge',
  challenge_scope: 'narrow',
  branch_tangent: 'branch',
  synthesize: 'synthesize',
});

/**
 * Suggestion → dock action mapping. `null` is permitted when no dock
 * action lines up cleanly. v1 covers every code with a non-null mapping.
 */
const SUGGESTED_MOVE_DOCK_ACTION: Readonly<Record<SuggestedMoveCode, TimelineNodeActionDockActionCode | null>> = Object.freeze({
  ask_source: 'ask_source',
  ask_quote: 'ask_quote',
  narrow: 'narrow',
  concede: 'concede',
  confirm: 'confirm',
  challenge_mechanism: 'challenge',
  challenge_scope: 'narrow',
  branch_tangent: 'branch',
  synthesize: 'synthesize',
});

/**
 * Gap codes — `SuggestedMoveCode` values whose `presetKey` is a documented
 * fallback (not a 1:1). The deriver appends a `preset_gap` signal so
 * AN-003 can track them.
 */
const PRESET_GAP_CODES: ReadonlyArray<SuggestedMoveCode> = Object.freeze([
  'challenge_mechanism',
  'challenge_scope',
  'branch_tangent',
]);

/**
 * Fixed rationale phrase table. Each phrase is either a verbatim reuse of
 * a RULE-003 helper line or a derived phrase drawn from the same plain-
 * language vocabulary. NEVER freshly authored per call.
 *
 * Doctrine self-check: every phrase passes
 * `_forbiddenLifecycleTokens()` + `_forbiddenMetadataTokens()` +
 * `PERSON_ATTRIBUTION_TOKENS`. A test enforces this.
 */
const RATIONALE_PHRASES: Readonly<Record<string, string>> = Object.freeze({
  unresolved_source_request: LIFECYCLE_UX_MAP.source_requested.helperLine,
  unresolved_quote_request: LIFECYCLE_UX_MAP.quote_requested.helperLine,
  narrow_concession_opportunity: LIFECYCLE_UX_MAP.narrowed.helperLine,
  synthesis_ready: LIFECYCLE_UX_MAP.synthesis_ready.helperLine,
  point_exhausted_same_axis: LIFECYCLE_UX_MAP.exhausted.helperLine,
  branch_recommended_off_axis: LIFECYCLE_UX_MAP.branch_recommended.helperLine,
  no_response_after_n_turns: AUTO_METADATA_UX_MAP.no_response_after_n_turns.helperLine,
  broken_source_chain_no_source: LIFECYCLE_UX_MAP.source_requested.helperLine,
  broken_source_chain_unverified: LIFECYCLE_UX_MAP.source_requested.helperLine,
  broken_source_chain_broken: LIFECYCLE_UX_MAP.source_requested.helperLine,
  broken_source_chain_source_no_quote: LIFECYCLE_UX_MAP.quote_requested.helperLine,
  // For signals that lack a 1:1 helper line, derive from existing RULE-003
  // helpers — never freshly author.
  lifecycle_state_match_default: LIFECYCLE_UX_MAP.open.helperLine,
});

// ── Public deriver ────────────────────────────────────────────

/**
 * Pure, total, deterministic. Returns `[]` when nothing applies.
 *
 * Order of resolution:
 *   1. Validate inputs.
 *   2. Source-chain status override (EV-001).
 *   3. Lifecycle-state primary (read from `LIFECYCLE_UX_MAP[state]`).
 *   4. Manual-tag override (promote tag-driven suggestions).
 *   5. Auto-metadata refinement.
 *   6. Truncate to `maxSuggestions` (default 3).
 *   7. Build rationale per suggestion from RULE-003 helper lines.
 */
export function deriveSuggestedMoves(input: SuggestionDerivationInput): SuggestedMove[] {
  const cap = resolveMaxSuggestions(input.maxSuggestions);
  if (cap <= 0) return [];

  // Each emit() call appends a `(code, signals[])` pair. Dedup by code,
  // keeping the highest-priority (earliest) emission and merging signals.
  const accum: Array<{ code: SuggestedMoveCode; signals: SuggestionSignal[] }> = [];

  function emit(code: SuggestedMoveCode, signals: SuggestionSignal[]): void {
    const existing = accum.find((s) => s.code === code);
    if (existing) {
      for (const sig of signals) existing.signals.push(sig);
      return;
    }
    accum.push({ code, signals: [...signals] });
  }

  // ── 1. Source-chain override (highest priority) ──
  const status = input.sourceChainStatus;
  if (status === 'no_source' || status === 'unverified' || status === 'broken') {
    emit('ask_source', [{ kind: 'broken_source_chain', status }]);
  } else if (status === 'source_no_quote') {
    emit('ask_quote', [{ kind: 'broken_source_chain', status }]);
  }

  // ── 2. Lifecycle primary ──
  if (input.clusterSummary) {
    const lifecycleCodes = lifecycleStateToSuggestions(input.clusterSummary.state);
    for (const code of lifecycleCodes) {
      emit(code, [
        ...lifecycleStateSignals(input.clusterSummary.state),
        { kind: 'lifecycle_state_match', state: input.clusterSummary.state },
      ]);
    }
  }

  // ── 3. Manual-tag override (promote to front; dedup) ──
  const manualPromotions: Array<{ code: SuggestedMoveCode; signal: SuggestionSignal }> = [];
  if (input.moveLinkage) {
    for (const entry of input.moveLinkage.userAppliedTags) {
      const promotion = manualTagPromotion(entry.code);
      if (promotion) {
        manualPromotions.push({
          code: promotion,
          signal: { kind: 'manual_tag_present', tag: entry.code },
        });
      }
    }
  }
  if (input.clusterMetadata) {
    for (const tag of input.clusterMetadata.manualTagCodes) {
      const promotion = manualTagPromotion(tag);
      if (promotion && !manualPromotions.find((m) => m.code === promotion)) {
        manualPromotions.push({
          code: promotion,
          signal: { kind: 'manual_tag_present', tag },
        });
      }
    }
  }
  // Promote: each manual-tag-driven suggestion moves to the front (in
  // promotion order), then the rest follow.
  if (manualPromotions.length > 0) {
    const promoted: Array<{ code: SuggestedMoveCode; signals: SuggestionSignal[] }> = [];
    for (const p of manualPromotions) {
      const existing = accum.find((s) => s.code === p.code);
      if (existing) {
        existing.signals.push(p.signal);
        promoted.push(existing);
      } else {
        promoted.push({ code: p.code, signals: [p.signal] });
      }
    }
    const rest = accum.filter((s) => !promoted.find((p) => p.code === s.code));
    accum.length = 0;
    accum.push(...promoted, ...rest);
  }

  // ── 4. Auto-metadata refinement (append; dedup; never override
  //       higher-priority position) ──
  if (input.clusterMetadata) {
    for (const code of input.clusterMetadata.autoMetadataCodes) {
      const promotions = autoMetadataPromotion(code);
      for (const promo of promotions) {
        emit(promo.code, [promo.signal]);
      }
    }
  }

  // ── 5. Compose final list ──
  const out: SuggestedMove[] = [];
  for (const entry of accum) {
    if (out.length >= cap) break;
    const signals = entry.signals;
    if (PRESET_GAP_CODES.includes(entry.code)) {
      signals.push({ kind: 'preset_gap', code: entry.code });
    }
    out.push(buildSuggestedMove(entry.code, signals));
  }
  return out;
}

/**
 * Public rationale builder. Pure. ≤ 80 chars. Reuses RULE-003 helper
 * lines verbatim where possible; falls back to the fixed phrase table.
 * Empty `signals` returns ''.
 */
export function buildRationale(signals: ReadonlyArray<SuggestionSignal>): string {
  if (signals.length === 0) return '';
  const phrase = signalToPhrase(signals[0]);
  return capRationale(phrase);
}

/**
 * Test-only consumer. Concatenates the lifecycle + metadata + COPY-001
 * person-attribution token lists into a deduped array.
 */
export function _forbiddenSuggestionTokens(): string[] {
  const lifecycle = _forbiddenLifecycleTokens();
  const metadata = _forbiddenMetadataTokens();
  const merged = new Set<string>();
  for (const t of lifecycle) merged.add(t);
  for (const t of metadata) merged.add(t);
  for (const t of PERSON_ATTRIBUTION_TOKENS) merged.add(t);
  return Array.from(merged);
}

// ── Internal helpers ──────────────────────────────────────────

function resolveMaxSuggestions(max: number | undefined): number {
  if (max === undefined) return DEFAULT_MAX_SUGGESTIONS;
  if (!Number.isFinite(max)) return DEFAULT_MAX_SUGGESTIONS;
  if (max <= 0) return 0;
  return Math.floor(max);
}

/**
 * Per the design's "Derivation table — lifecycle × signal → suggestions".
 * Lifecycle state maps to 0–2 suggested codes; the deriver appends
 * source-chain / manual-tag / auto-metadata refinements on top.
 */
function lifecycleStateToSuggestions(state: PointLifecycleState): SuggestedMoveCode[] {
  switch (state) {
    case 'open':
    case 'answered':
    case 'rebutted':
    case 'clarified':
    case 'sourced':
      return [];
    case 'quote_requested':
      return ['ask_quote'];
    case 'source_requested':
      return ['ask_source'];
    case 'narrowed':
      return ['confirm'];
    case 'conceded':
      return ['confirm', 'synthesize'];
    case 'confirmed':
      return ['synthesize'];
    case 'synthesis_ready':
      return ['synthesize', 'confirm'];
    case 'moved_on_by_affirmative':
    case 'moved_on_by_negative':
      return ['confirm', 'synthesize'];
    case 'ignored_by_affirmative':
    case 'ignored_by_negative':
    case 'ignored_by_both':
      return ['synthesize'];
    case 'exhausted':
      return ['narrow', 'branch_tangent'];
    case 'branch_recommended':
      return ['branch_tangent', 'narrow'];
    case 'archived_or_resolved':
      return [];
    default: {
      // Exhaustiveness — adding a new state without updating this switch
      // is a compile error.
      const _exhaustive: never = state;
      void _exhaustive;
      return [];
    }
  }
}

/**
 * Returns the signal set the lifecycle state contributes to each emitted
 * suggestion. Mirrors the design's table.
 */
function lifecycleStateSignals(state: PointLifecycleState): SuggestionSignal[] {
  switch (state) {
    case 'quote_requested':
      return [{ kind: 'unresolved_quote_request' }];
    case 'source_requested':
      return [{ kind: 'unresolved_source_request' }];
    case 'narrowed':
      return [{ kind: 'narrow_concession_opportunity' }];
    case 'synthesis_ready':
      return [{ kind: 'synthesis_ready' }];
    case 'exhausted':
      return [{ kind: 'point_exhausted_same_axis' }];
    case 'branch_recommended':
      return [{ kind: 'branch_recommended_off_axis' }];
    case 'ignored_by_affirmative':
    case 'ignored_by_negative':
    case 'ignored_by_both':
      return [{ kind: 'no_response_after_n_turns' }];
    default:
      return [];
  }
}

/**
 * Manual-tag → promoted suggestion code, per the design's manual-tag
 * override table.
 *
 * `definition_issue` is deferred — no `clarify`-shaped `SuggestedMoveCode`
 * exists in v1; the design logs the gap and the override is a no-op.
 */
function manualTagPromotion(tag: ManualTagCode): SuggestedMoveCode | null {
  switch (tag) {
    case 'needs_source':
      return 'ask_source';
    case 'needs_quote':
      return 'ask_quote';
    case 'scope_issue':
      return 'challenge_scope';
    case 'causal_mechanism':
      return 'challenge_mechanism';
    case 'evidence_debt':
      return 'ask_source';
    case 'concession_offered':
      return 'confirm';
    case 'narrowed_claim':
      return 'confirm';
    case 'tangent':
      return 'branch_tangent';
    case 'ready_for_synthesis':
      return 'synthesize';
    case 'definition_issue':
      // Deferred — no 1:1 SuggestedMoveCode in v1.
      return null;
    default: {
      const _exhaustive: never = tag;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * Auto-metadata → promoted suggestion(s), per the design's
 * auto-metadata refinement table.
 */
function autoMetadataPromotion(code: AutoMetadataCode): Array<{ code: SuggestedMoveCode; signal: SuggestionSignal }> {
  const tag: SuggestionSignal = { kind: 'auto_metadata_present', code };
  switch (code) {
    case 'synthesis_candidate':
      return [{ code: 'synthesize', signal: tag }];
    case 'branch_suggested':
      return [{ code: 'branch_tangent', signal: tag }];
    case 'repeated_axis_pressure':
      return [
        { code: 'narrow', signal: tag },
        { code: 'branch_tangent', signal: tag },
      ];
    case 'point_exhausted':
      return [
        { code: 'narrow', signal: { kind: 'point_exhausted_same_axis' } },
        { code: 'branch_tangent', signal: { kind: 'point_exhausted_same_axis' } },
      ];
    case 'point_stalled':
      return [{ code: 'synthesize', signal: tag }];
    case 'no_response_after_n_turns':
      return [{ code: 'synthesize', signal: { kind: 'no_response_after_n_turns' } }];
    case 'source_requested':
      return [{ code: 'ask_source', signal: { kind: 'unresolved_source_request' } }];
    case 'quote_requested':
      return [{ code: 'ask_quote', signal: { kind: 'unresolved_quote_request' } }];
    case 'has_reply':
    case 'has_rebuttal':
    case 'has_counter_rebuttal':
    case 'has_evidence':
    case 'source_attached':
    case 'quote_attached':
    case 'participant_skipped_node':
    case 'branch_created':
      return [];
    default: {
      const _exhaustive: never = code;
      void _exhaustive;
      return [];
    }
  }
}

/**
 * Pick the highest-priority signal and look up the matching phrase. Order
 * mirrors the design's priority: source-chain > unresolved-request >
 * narrow/synthesis > exhaustion > branch > no-response > manual-tag >
 * auto-metadata > lifecycle-match-default.
 */
function signalToPhrase(signal: SuggestionSignal): string {
  switch (signal.kind) {
    case 'broken_source_chain':
      switch (signal.status) {
        case 'no_source':
          return RATIONALE_PHRASES.broken_source_chain_no_source;
        case 'unverified':
          return RATIONALE_PHRASES.broken_source_chain_unverified;
        case 'broken':
          return RATIONALE_PHRASES.broken_source_chain_broken;
        case 'source_no_quote':
          return RATIONALE_PHRASES.broken_source_chain_source_no_quote;
        case 'source_and_quote':
        case 'primary_present':
          return RATIONALE_PHRASES.lifecycle_state_match_default;
        default: {
          const _exhaustive: never = signal.status;
          void _exhaustive;
          return RATIONALE_PHRASES.lifecycle_state_match_default;
        }
      }
    case 'unresolved_source_request':
      return RATIONALE_PHRASES.unresolved_source_request;
    case 'unresolved_quote_request':
      return RATIONALE_PHRASES.unresolved_quote_request;
    case 'narrow_concession_opportunity':
      return RATIONALE_PHRASES.narrow_concession_opportunity;
    case 'synthesis_ready':
      return RATIONALE_PHRASES.synthesis_ready;
    case 'point_exhausted_same_axis':
      return RATIONALE_PHRASES.point_exhausted_same_axis;
    case 'branch_recommended_off_axis':
      return RATIONALE_PHRASES.branch_recommended_off_axis;
    case 'no_response_after_n_turns':
      return RATIONALE_PHRASES.no_response_after_n_turns;
    case 'manual_tag_present': {
      // Manual-tag rationale routes through the lifecycle helper line of
      // the closest matching state so we never freshly author copy.
      switch (signal.tag) {
        case 'needs_source':
        case 'evidence_debt':
          return RATIONALE_PHRASES.unresolved_source_request;
        case 'needs_quote':
          return RATIONALE_PHRASES.unresolved_quote_request;
        case 'scope_issue':
          return RATIONALE_PHRASES.narrow_concession_opportunity;
        case 'causal_mechanism':
          // Reuse the open-state helper as the closest neutral fallback.
          return RATIONALE_PHRASES.lifecycle_state_match_default;
        case 'concession_offered':
        case 'narrowed_claim':
          return RATIONALE_PHRASES.narrow_concession_opportunity;
        case 'tangent':
          return RATIONALE_PHRASES.branch_recommended_off_axis;
        case 'ready_for_synthesis':
          return RATIONALE_PHRASES.synthesis_ready;
        case 'definition_issue':
          return RATIONALE_PHRASES.lifecycle_state_match_default;
        default: {
          const _exhaustive: never = signal.tag;
          void _exhaustive;
          return RATIONALE_PHRASES.lifecycle_state_match_default;
        }
      }
    }
    case 'auto_metadata_present':
      // Auto-metadata rationale routes through the closest lifecycle
      // helper line — never freshly authored.
      switch (signal.code) {
        case 'synthesis_candidate':
          return RATIONALE_PHRASES.synthesis_ready;
        case 'branch_suggested':
          return RATIONALE_PHRASES.branch_recommended_off_axis;
        case 'repeated_axis_pressure':
        case 'point_exhausted':
          return RATIONALE_PHRASES.point_exhausted_same_axis;
        case 'point_stalled':
        case 'no_response_after_n_turns':
          return RATIONALE_PHRASES.no_response_after_n_turns;
        case 'source_requested':
          return RATIONALE_PHRASES.unresolved_source_request;
        case 'quote_requested':
          return RATIONALE_PHRASES.unresolved_quote_request;
        default:
          return RATIONALE_PHRASES.lifecycle_state_match_default;
      }
    case 'lifecycle_state_match': {
      // Read directly from the RULE-003 lifecycle helper for this state.
      const entry = LIFECYCLE_UX_MAP[signal.state];
      return entry ? entry.helperLine : RATIONALE_PHRASES.lifecycle_state_match_default;
    }
    case 'preset_gap':
      // A `preset_gap` is diagnostic only — the rationale always comes
      // from a higher-priority signal. If somehow it is the only signal
      // present, fall back to the neutral default.
      return RATIONALE_PHRASES.lifecycle_state_match_default;
    default: {
      const _exhaustive: never = signal;
      void _exhaustive;
      return RATIONALE_PHRASES.lifecycle_state_match_default;
    }
  }
}

function capRationale(s: string): string {
  if (s.length <= RATIONALE_CAP) return s;
  const sliceEnd = RATIONALE_CAP;
  const slice = s.slice(0, sliceEnd);
  const lastWs = Math.max(
    slice.lastIndexOf(' '),
    slice.lastIndexOf('\n'),
    slice.lastIndexOf('\t'),
  );
  if (lastWs > 0) {
    return slice.slice(0, lastWs).trimEnd() + ELLIPSIS;
  }
  return slice + ELLIPSIS;
}

function capLabel(s: string): string {
  if (s.length <= LABEL_CAP) return s;
  return s.slice(0, LABEL_CAP - 1).trimEnd() + ELLIPSIS;
}

function buildSuggestedMove(
  code: SuggestedMoveCode,
  signals: SuggestionSignal[],
): SuggestedMove {
  return {
    code,
    label: capLabel(SUGGESTED_MOVE_LABELS[code]),
    rationale: buildRationale(signals),
    presetKey: SUGGESTED_MOVE_PRESET[code],
    dockAction: SUGGESTED_MOVE_DOCK_ACTION[code],
    sourceSignals: Object.freeze([...signals]),
  };
}
