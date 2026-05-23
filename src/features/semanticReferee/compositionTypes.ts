/**
 * COMP-001 — Deterministic composition layer types.
 *
 * Pure-TS type contract for the composition layer that sits between the
 * semantic referee's binary classifier output and the timeline / tree UI.
 *
 * The composition layer:
 *   - takes a `SemanticRefereePacket` + accumulated `CompositionState` +
 *     structural `MoveMetadata`,
 *   - returns zero-or-more `NodeVisualMutation` objects keyed by target
 *     `moveId` + the next-state accumulator.
 *
 * Every value here is structural (debt opened, point conceded, sub-axis
 * resolved). NO value carries a verdict token (winner / loser / truth /
 * correct / wrong / right / false / proven / defeated / won / lost) and NO
 * value carries a person-label token (liar / dishonest / bad faith /
 * manipulative / extremist / propagandist). The doctrine-scan test in
 * `__tests__/compositionLayerDoctrineScan.test.ts` enforces this property.
 *
 * Doctrine (cdiscourse-doctrine §1 / §2 / §3 / §4):
 *   - The layer makes NO truth claims (§1). It maps structural patterns to
 *     enum values; rendering downstream maps the enum to user copy via the
 *     existing `gameCopy.toPlainLanguage` pattern.
 *   - The layer respects the binary contract (§4 — AI mod hard rules). It
 *     reads 0/1 values from `SemanticBinarySample.value`. It does NOT
 *     interpret `reasonCode` strings.
 *   - The layer is pure TS — same purity rules as `engine.ts` (CLAUDE.md
 *     "Rules engine is sacred"): no Supabase, no React, no network, no
 *     async, no AI SDK imports. The purity test in
 *     `__tests__/compositionLayerPurity.test.ts` enforces this property.
 */

import type {
  SemanticClassifierId,
  SemanticConfidence,
  SemanticRefereePacket,
} from './semanticRefereeTypes';

// ── Per-item lifecycle types ───────────────────────────────────────

export interface EvidenceDebtState {
  /** The move that fired `asks_for_evidence` (opened the debt). */
  readonly openingMoveId: string;
  /** The parent move whose evidence was requested. */
  readonly targetMoveId: string;
  /** Who asked for the evidence. */
  readonly openingAuthorId: string;
  /** Lifecycle status — see COMP-001 §3.3. */
  readonly status: 'open' | 'resolved' | 'abandoned';
  /** Present iff `status === 'resolved'`. */
  readonly resolvingMoveId?: string;
}

export interface ClarificationDebtState {
  readonly openingMoveId: string;
  /** The move whose term / statement is unclear. */
  readonly targetMoveId: string;
  readonly status: 'open' | 'resolved' | 'abandoned';
  readonly resolvingMoveId?: string;
}

export interface SubAxisState {
  /** The move that introduced the sub-axis. */
  readonly openingMoveId: string;
  /** The move where the parent axis began. */
  readonly parentAxisRootMoveId: string;
  readonly status: 'open' | 'resolved' | 'abandoned';
  readonly resolvingMoveId?: string;
}

export interface ConcessionLinkState {
  readonly concedingMoveId: string;
  /** `disagreementAxis` when available. */
  readonly conceededOnAxis: string | null;
  /** Upstream challenge that elicited the concession; `null` when no clear originator. */
  readonly originatingChallengeMoveId: string | null;
  readonly atMoveId: string;
}

export interface SourceChainGapState {
  readonly openingMoveId: string;
  readonly status: 'open' | 'filled' | 'abandoned';
  readonly fillingMoveId?: string;
}

export interface NarrowingLinkState {
  readonly narrowingMoveId: string;
  /** `null` when no broader scope can be identified. */
  readonly broaderAncestorMoveId: string | null;
  readonly atMoveId: string;
}

export interface SynthesisReadinessState {
  readonly ready: boolean;
  /** Which sub-thread is ready (or the room root, when no sub-axis is active). */
  readonly subThreadRootMoveId: string | null;
  readonly openDebtCount: number;
  readonly sharedGroundMoveCount: number;
}

// ── Top-level CompositionState ─────────────────────────────────────

/**
 * The thread-level accumulator. The hook owns one instance per room session.
 * Every field is readonly; `composeVisualState` produces a fresh state object
 * on each call (purity / immutability requirement).
 */
export interface CompositionState {
  /** Evidence debts: keyed by the opening move id. */
  readonly evidenceDebts: ReadonlyMap<string, EvidenceDebtState>;
  /** Clarification debts: separate ledger from evidence (they resolve differently). */
  readonly clarificationDebts: ReadonlyMap<string, ClarificationDebtState>;
  /** Active sub-axes: keyed by the opening move id. */
  readonly activeSubAxes: ReadonlyMap<string, SubAxisState>;
  /** Concession chains: keyed by the conceding move id. */
  readonly concessionChains: ReadonlyMap<string, ConcessionLinkState>;
  /** Open source-chain gaps: keyed by the move that opened the gap. */
  readonly sourceChainGaps: ReadonlyMap<string, SourceChainGapState>;
  /** Narrowing lineage: keyed by the narrowing move id. */
  readonly narrowingLinks: ReadonlyMap<string, NarrowingLinkState>;
  /** Person-shift flags: which moves carry a person-shift warning. */
  readonly personShiftMoves: ReadonlySet<string>;
  /** Unplayable moves: which moves are marked as unengageable. */
  readonly unplayableMoves: ReadonlySet<string>;
  /** Derived synthesis readiness — stored so callers can read without recomputing. */
  readonly synthesisReadiness: SynthesisReadinessState;
}

/** The starting value the hook uses on room mount. */
export const EMPTY_COMPOSITION_STATE: CompositionState = Object.freeze({
  evidenceDebts: new Map<string, EvidenceDebtState>(),
  clarificationDebts: new Map<string, ClarificationDebtState>(),
  activeSubAxes: new Map<string, SubAxisState>(),
  concessionChains: new Map<string, ConcessionLinkState>(),
  sourceChainGaps: new Map<string, SourceChainGapState>(),
  narrowingLinks: new Map<string, NarrowingLinkState>(),
  personShiftMoves: new Set<string>(),
  unplayableMoves: new Set<string>(),
  synthesisReadiness: Object.freeze({
    ready: false,
    subThreadRootMoveId: null,
    openDebtCount: 0,
    sharedGroundMoveCount: 0,
  }) as SynthesisReadinessState,
});

// ── NodeVisualMutation ─────────────────────────────────────────────

/**
 * The closed enum of mutation values the composition layer can emit. The UI
 * rendering layer downstream maps each value to its visual treatment.
 *
 * COMP-001 §5.2 — every value here describes a STRUCTURAL state and contains
 * no verdict token and no person label. The doctrine-scan test enforces this.
 */
export type NodeVisualMutationType =
  // ── Evidence / source-chain (cross-node) ─────────────────────
  | 'evidence_debt_opened'
  | 'evidence_debt_resolved'
  | 'evidence_attached_supporting'
  | 'evidence_attached_unverified'
  | 'evidence_retracted'
  | 'source_chain_gap_flagged'
  | 'source_chain_gap_filled'
  // ── Constructive movement (cross-node) ────────────────────────
  | 'point_conceded'
  | 'concession_landed'
  | 'point_narrowed'
  | 'narrowing_landed'
  | 'sub_axis_opened'
  | 'sub_axis_resolved'
  | 'sub_axis_abandoned'
  | 'synthesis_ready'
  | 'synthesis_offered'
  // ── Parent continuity (cross-node) ────────────────────────────
  | 'parent_engaged_quoted'
  | 'new_issue_introduced'
  | 'clarification_requested'
  | 'clarification_resolved'
  | 'clarification_answered'
  // ── Friction / safety (per-move) ──────────────────────────────
  | 'popularity_amplification_warning'
  | 'satire_as_evidence_warning'
  | 'satire_marker'
  | 'retraction_cited'
  | 'person_shift_warning'
  | 'unplayable_move'
  | 'mode_mismatch_warning'
  | 'pre_send_pause_advised'
  | 'playable_hot_take'
  // ── Branch routing (per-move + edge) ──────────────────────────
  | 'side_branch_suggested'
  | 'diagonal_tangent_suggested'
  | 'branch_route_hint'
  | 'tangent_route_hint'
  | 'branch_suggested'
  // ── Exemption markers (per-move) ──────────────────────────────
  | 'opening_claim_marker'
  // ── MCP-CAT-001 (catalog v1) — per-move structural markers ────
  // Additive rules from MCP-CAT-001 surface these markers. Every value
  // is structural (the move attached corroborating evidence, the move
  // offered an alternate reading, the move proposed settlement terms);
  // none carries a verdict / person label. The doctrine-scan test
  // (`compositionLayerDoctrineScan.test.ts`) scans every value.
  | 'evidence_applicability_disputed'
  | 'prior_agreement_cited'
  | 'temporal_constraint_provided'
  | 'qualified_concession_with_caveat'
  | 'alternate_interpretation_offered'
  | 'corroborating_document_attached'
  | 'settlement_proposed'
  | 'settlement_accepted';

/**
 * The complete ordered list of `NodeVisualMutationType` values. The
 * doctrine-scan test iterates this array to assert no banned token appears
 * in any value.
 */
export const ALL_NODE_VISUAL_MUTATION_TYPES: readonly NodeVisualMutationType[] = [
  // Evidence / source-chain
  'evidence_debt_opened',
  'evidence_debt_resolved',
  'evidence_attached_supporting',
  'evidence_attached_unverified',
  'evidence_retracted',
  'source_chain_gap_flagged',
  'source_chain_gap_filled',
  // Constructive movement
  'point_conceded',
  'concession_landed',
  'point_narrowed',
  'narrowing_landed',
  'sub_axis_opened',
  'sub_axis_resolved',
  'sub_axis_abandoned',
  'synthesis_ready',
  'synthesis_offered',
  // Parent continuity
  'parent_engaged_quoted',
  'new_issue_introduced',
  'clarification_requested',
  'clarification_resolved',
  'clarification_answered',
  // Friction / safety
  'popularity_amplification_warning',
  'satire_as_evidence_warning',
  'satire_marker',
  'retraction_cited',
  'person_shift_warning',
  'unplayable_move',
  'mode_mismatch_warning',
  'pre_send_pause_advised',
  'playable_hot_take',
  // Branch routing
  'side_branch_suggested',
  'diagonal_tangent_suggested',
  'branch_route_hint',
  'tangent_route_hint',
  'branch_suggested',
  // Exemption markers
  'opening_claim_marker',
  // MCP-CAT-001 (catalog v1) — per-move structural markers
  'evidence_applicability_disputed',
  'prior_agreement_cited',
  'temporal_constraint_provided',
  'qualified_concession_with_caveat',
  'alternate_interpretation_offered',
  'corroborating_document_attached',
  'settlement_proposed',
  'settlement_accepted',
];

/**
 * Source-classifier marker for mutations that come from a structural
 * exemption (root, first-move) or a derived state transition (e.g. a sub-axis
 * resolution detected by walking the state rather than a single classifier).
 */
export type CompositionMutationSource =
  | SemanticClassifierId
  | 'exemption'
  | 'derived';

/**
 * One visual mutation. The UI consumer reads `targetMoveId` to know WHICH
 * node to mutate and reads `mutation` to know WHAT mutation to render.
 */
export interface NodeVisualMutation {
  /** The node this mutation targets. */
  readonly targetMoveId: string;
  /** The structural state this mutation expresses. */
  readonly mutation: NodeVisualMutationType;
  /** Which classifier (or exemption / derived marker) triggered this rule. */
  readonly sourceClassifier: CompositionMutationSource;
  /** Which move's composition call produced this mutation. */
  readonly sourceMoveId: string;
  /** Optional — for edge-attached mutations, the edge's other endpoint. */
  readonly edgeOtherEndpointMoveId?: string;
}

// ── Move metadata (the structural input to composeVisualState) ─────

/**
 * The structural metadata for the move whose packet is being composed. The
 * caller (the room hook or smoke-test orchestrator) supplies this from the
 * move row + the room's chronological author position.
 *
 * The composition layer does NOT receive bodies, quotes, or excerpts; only
 * structural fields. This is the layering boundary that keeps the layer
 * indifferent to content (see COMP-001 §3.4).
 */
export interface MoveMetadata {
  readonly moveId: string;
  /** `null` for the room root. */
  readonly parentId: string | null;
  /** Stable author id (the authoring user / bot). */
  readonly authorId: string;
  /** Constitution argument type, e.g. `'thesis' | 'rebuttal' | 'concession'`. */
  readonly argumentType?: string | null;
  /** `'affirmative' | 'negative' | 'observer' | 'moderator'` etc. */
  readonly side?: string | null;
  /** 0 for root, +1 per descent. */
  readonly depth?: number;
  /** Optional disagreement axis label (used by R-CM-02). */
  readonly disagreementAxis?: string | null;
  /**
   * The author's position in the room — `'first'` means this is the author's
   * FIRST move in the room (the R-EX-02 exemption applies). The caller is
   * responsible for computing this from the chronological move list.
   */
  readonly authorMovePosition?: 'first' | 'subsequent';
  /** Optional ISO timestamp — used for stable ordering only, never as proof. */
  readonly createdAt?: string;
}

// ── Per-move ancestry context (the upstream-search input) ──────────

/**
 * One ancestor move's structural metadata, as seen by the composition layer.
 * The caller threads the chain up from `parentId` so the layer can resolve
 * "walk up the chain" rules (R-EV-02, R-CM-01, R-CM-02, R-CM-03, R-EV-06,
 * R-PC-04) without needing access to the room's full message list.
 */
export interface AncestorMoveSummary {
  readonly moveId: string;
  readonly parentId: string | null;
  readonly authorId: string;
  readonly argumentType?: string | null;
  readonly disagreementAxis?: string | null;
  readonly createdAt?: string;
  /**
   * The packet that was emitted for THIS ancestor (when present). The
   * composition layer reads classifier signals from it to identify
   * upstream challenges / evidence claims.
   */
  readonly packet?: SemanticRefereePacket;
}

/**
 * The optional structural ancestry summary. Many rules only need the
 * accumulated `CompositionState` (which is keyed by move id) plus the current
 * move's `parentId`; for rules that need to inspect ancestors' packets or
 * authors (R-CM-01, R-CM-02), the caller supplies this list.
 *
 * Order: oldest-first (so `ancestors[0]` is the room root and
 * `ancestors[ancestors.length-1]` is the immediate parent).
 *
 * Optional: when absent, ancestor-walking rules degrade gracefully (they fall
 * back to targeting `parentId` instead of the upstream match).
 */
export type AncestorMoveSummaryChain = readonly AncestorMoveSummary[];

// ── composeVisualState input + output ──────────────────────────────

/** The input bundle to `composeVisualState`. */
export interface ComposeVisualStateInput {
  /**
   * The classifier packet for the current move. When absent (exempt moves,
   * fallback states), the composition layer still considers exemption rules
   * (R-EX-01 root, R-EX-02 first-move) and emits no per-classifier mutation.
   */
  readonly packet?: SemanticRefereePacket;
  /** The accumulated thread-level composition state. */
  readonly threadState: CompositionState;
  /** The current move's structural metadata. */
  readonly moveMeta: MoveMetadata;
  /** Optional chronological ancestor chain (oldest-first). */
  readonly ancestors?: AncestorMoveSummaryChain;
}

/** The output of `composeVisualState`. */
export interface CompositionResult {
  /** Zero or more mutations, each naming a target `moveId`. */
  readonly mutations: readonly NodeVisualMutation[];
  /**
   * A fresh `CompositionState` object — the input state is NOT mutated. The
   * caller stores this as the new accumulator for the next move.
   */
  readonly nextState: CompositionState;
}

// ── Binary-signal helper type ──────────────────────────────────────

/**
 * A read-only map from classifier id to its binary value + confidence. The
 * composition layer builds this from the packet's `binaries` array (treating
 * absent ids as `value: 0`) so rule predicates can index by id.
 */
export interface ClassifierSignalLookup {
  readonly get: (id: SemanticClassifierId) => {
    value: 0 | 1;
    confidence: SemanticConfidence;
  };
  /** Whether the classifier id was explicitly present in the packet. */
  readonly has: (id: SemanticClassifierId) => boolean;
}
