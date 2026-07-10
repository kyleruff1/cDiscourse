/**
 * UX-MEDIATOR-001 — Mediator board state: types (pure TypeScript).
 *
 * The mediator board is a READ-ONLY PROJECTION. It turns the existing
 * pure-TS derived models — the point lifecycle map (LIFE-001,
 * `pointLifecycleModel.ts`), the evidence-debt list (EV-003,
 * `evidenceDebtModel.ts`) — plus persisted machine observations
 * (MCP-021B, families A–I) into one JSON-serializable board state that a
 * later UI card (Disagreement Points rail, Evidence Debt surface,
 * Structured Impasse banner) can render.
 *
 * Doctrine anchor — read before changing anything here:
 *
 *   1. **This is not a truth oracle.** No state, label, or field declares who
 *      is right/wrong, true/false, winner/loser, or infers intent / labels a
 *      person. The deterministic Constitution engine remains the sole
 *      submission gate; this module NEVER blocks, routes, delays, or gates a
 *      post. It only re-reads what already happened.
 *   2. **Popularity / heat / strength bands never feed it.** The projection
 *      reads move STRUCTURE (lifecycle clusters, evidence debts, classifier
 *      observations) — never `standingBand` / `toneBand` / `temperatureBand`
 *      / engagement.
 *   3. **Uncertainty is preserved, not collapsed.** Every point carries a
 *      `confidence` that may be `unknown`; when inputs do not support a
 *      specific dispute kind the state falls back to `open`, never to a
 *      stronger claim.
 *   4. **Observation-driven, never invented.** Definition / scope / blocked /
 *      recollection markers are emitted ONLY when a supporting persisted
 *      observation or debt status exists. Claim-identity and a recollection
 *      detector are deferred (UX-MEDIATOR future cards); the types exist but
 *      `accounts_differ` is never synthesized from absent input.
 *
 * Pure TS. No React. No Supabase. No fetch. No MCP call. No clock. No
 * randomness. No mutation of any input. JSON-serializable in and out.
 * Consumes persisted machine observations only.
 */
import type { EvidenceDebt, EvidenceDebtKind, EvidenceDebtStatus } from '../evidence/evidenceDebtModel';
import type { PointLifecycleMap, PointLifecycleState } from '../lifecycle/pointLifecycleModel';

// ── Confidence ────────────────────────────────────────────────

/**
 * Confidence in a derived mediator state. `unknown` is a first-class value
 * (doctrine §3 — preserve uncertainty). Persisted observation rows carry
 * `low | medium | high`; a derived point with no supporting observation may
 * be `unknown`.
 */
export type MediatorConfidence = 'low' | 'medium' | 'high' | 'unknown';

// ── State vocabulary ──────────────────────────────────────────

/**
 * The mediator state code for a disagreement point. Each value is a
 * STRUCTURAL state, never a verdict. Mapped to plain language by
 * `plainLanguageForMediatorState` (ban-list scanned by tests).
 */
export type MediatorStateCode =
  | 'open' // an active disagreement with no more specific signal yet
  | 'needs_evidence' // an open source/quote/evidence obligation is owed
  | 'evidence_blocked' // a request was declined / the record is unavailable
  | 'key_detail_unavailable' // a pivotal detail cannot be settled from available record
  | 'definition_not_shared' // a term is used two ways; no shared definition confirmed
  | 'scope_mismatch' // the reply addresses a broader/narrower claim than the point
  | 'missing_mechanism' // a causal conclusion depends on an unstated step
  | 'value_tradeoff' // the disagreement is a priority/tradeoff, not a provable fact
  | 'narrowed' // a concession/narrowing happened; a smaller disagreement remains
  | 'off_point' // a move does not address the point it replies to
  | 'accounts_differ' // difference of recollection (deferred detector; type reserved)
  | 'structured_impasse' // good-form exchange, no available pathway, clash remains
  | 'resolved_or_settled'; // confirmed / synthesized / admin-resolved

/** Frozen list of every state code. Tests iterate this. */
export const ALL_MEDIATOR_STATE_CODES: ReadonlyArray<MediatorStateCode> = Object.freeze([
  'open',
  'needs_evidence',
  'evidence_blocked',
  'key_detail_unavailable',
  'definition_not_shared',
  'scope_mismatch',
  'missing_mechanism',
  'value_tradeoff',
  'narrowed',
  'off_point',
  'accounts_differ',
  'structured_impasse',
  'resolved_or_settled',
]);

// ── v4 display vocabulary (UX-MEDIATOR-001 precedence delta) ───
//
// The shipped 13-code `MediatorStateCode` is a SUPERSET kept for internal
// traceability / Inspect. The CivilDiscourse v4 UX overhaul publishes an
// ELEVEN-state DISPLAY vocabulary. The vocabulary defines:
//   - `V4MediatorStateCode`         — the eleven display states (a subset of 13).
//   - `V4_PRIMARY_STATE_PRIORITY`   — the canonical highest-wins precedence.
//   - `V4_DISPLAY_STATE_BY_CODE`    — the total 13→11 display mapping.
// `point.state` is UNCHANGED (still one of the 13); these are an additive
// parallel projection consumed via `v4DisplayStateFor` (no field added — O-3).
//
// UX-IMPASSE-002 (#710) surfaces two formerly-collapsed display states
// (`key_detail_unavailable`, `value_tradeoff`) whose deterministic producers
// already fire on real data (see deriveMediatorBoardState.ts). This is an
// ADDITIVE change to the display vocabulary (two new members), never a rename
// of any internal code or `point.state` value.
//
// Doctrine: the display vocabulary ranks STRUCTURE, never truth / a person /
// who is winning. `resolved_or_settled` is terminal/suppressed — it is NOT a
// live primary state and is excluded from the priority list.

/**
 * The eleven v4 DISPLAY states (a subset of `MediatorStateCode`). Each is a
 * structural state, never a verdict. `resolved_or_settled` is intentionally
 * NOT a member — a resolved point is not an open disagreement. `value_tradeoff`
 * and `key_detail_unavailable` were surfaced by UX-IMPASSE-002 (#710).
 */
export type V4MediatorStateCode =
  | 'structured_impasse'
  | 'evidence_blocked'
  | 'key_detail_unavailable'
  | 'accounts_differ'
  | 'definition_not_shared'
  | 'scope_mismatch'
  | 'missing_mechanism'
  | 'needs_evidence'
  | 'narrowed'
  | 'value_tradeoff'
  | 'open';

/** Frozen list of the eleven v4 display states. Tests iterate this. */
export const ALL_V4_MEDIATOR_STATE_CODES: ReadonlyArray<V4MediatorStateCode> = Object.freeze([
  'structured_impasse',
  'evidence_blocked',
  'key_detail_unavailable',
  'accounts_differ',
  'definition_not_shared',
  'scope_mismatch',
  'missing_mechanism',
  'needs_evidence',
  'narrowed',
  'value_tradeoff',
  'open',
]);

/**
 * The canonical v4 precedence (HIGHEST wins). `decidePointState` builds a
 * candidate set, applies Gate A (impasse demotion), then picks the highest
 * code in THIS order that is a candidate. A strict total order → no ties.
 *
 *    1 structured_impasse     — terminal frame, ONLY when no pathway remains
 *    2 evidence_blocked       — the record is unavailable (declined obligation)
 *    3 key_detail_unavailable — UX-IMPASSE-002 (#710); just below a declined
 *                               evidence_blocked (a context-limit detail)
 *    4 accounts_differ        — difference of recollection (detector deferred; never synthesized in v1)
 *    5 definition_not_shared  — wins over scope (shared terms unlock scope)
 *    6 scope_mismatch
 *    7 missing_mechanism      — display label "Missing link"
 *    8 needs_evidence         — a source would move it forward
 *    9 narrowed               — a repair, not a defeat
 *   10 value_tradeoff         — UX-IMPASSE-002 (#710); just above open (a
 *                               priorities difference)
 *   11 open                   — default; preserves uncertainty
 */
export const V4_PRIMARY_STATE_PRIORITY: ReadonlyArray<V4MediatorStateCode> = Object.freeze([
  'structured_impasse',
  'evidence_blocked',
  'key_detail_unavailable',
  'accounts_differ',
  'definition_not_shared',
  'scope_mismatch',
  'missing_mechanism',
  'needs_evidence',
  'narrowed',
  'value_tradeoff',
  'open',
]);

/**
 * The total 13→11 display mapping. Defined over ALL 13 `MediatorStateCode`s so
 * it is exhaustive (tested). After UX-IMPASSE-002 (#710) only `off_point` (plus
 * the terminal `resolved_or_settled`) still collapses for DISPLAY; the internal
 * `point.state` keeps the precise code for Inspect either way:
 *
 *   off_point              → scope_mismatch      (answers a broader/narrower claim)
 *   resolved_or_settled    → resolved_or_settled (terminal/suppressed; not a live state)
 *
 * `key_detail_unavailable` and `value_tradeoff` now map to THEMSELVES (identity);
 * UX-IMPASSE-002 surfaced them as their own display states because their
 * deterministic producers already fire on real data. A declined evidence debt
 * still wins `evidence_blocked` over a context-limit detail (the producer guard
 * in deriveMediatorBoardState.ts), so surfacing `key_detail_unavailable` never
 * steals a true `evidence_blocked` row.
 */
export const V4_DISPLAY_STATE_BY_CODE: Readonly<
  Record<MediatorStateCode, V4MediatorStateCode | 'resolved_or_settled'>
> = Object.freeze({
  open: 'open',
  needs_evidence: 'needs_evidence',
  evidence_blocked: 'evidence_blocked',
  key_detail_unavailable: 'key_detail_unavailable',
  definition_not_shared: 'definition_not_shared',
  scope_mismatch: 'scope_mismatch',
  missing_mechanism: 'missing_mechanism',
  value_tradeoff: 'value_tradeoff',
  narrowed: 'narrowed',
  off_point: 'scope_mismatch',
  accounts_differ: 'accounts_differ',
  structured_impasse: 'structured_impasse',
  resolved_or_settled: 'resolved_or_settled',
});

/** The kind of disagreement a point is about (projected from the lifecycle axis). */
export type DisagreementPointKind =
  | 'fact'
  | 'definition'
  | 'scope'
  | 'causal'
  | 'value'
  | 'evidence'
  | 'logic'
  | 'recollection'
  | 'unaxed';

// ── Inputs (narrow adapter boundary) ──────────────────────────

/**
 * Narrow node metadata the projection needs. The caller maps a full
 * `ArgumentTimelineMapNode` (+ the argument row's `targetExcerpt`) down to
 * this shape so the mediator core never imports the surface/React layer.
 */
export interface MediatorGraphNode {
  messageId: string;
  parentId: string | null;
  ordinal: number;
  /** Cluster id — equals `branchRootMessageId` in the surface/lifecycle model. */
  branchRootMessageId: string;
  kindLabel: string;
  sideLabel: string;
  isRoot: boolean;
  replyCount: number;
  descendantCount: number;
  /** The parent excerpt this move claims to address, when known. */
  targetExcerpt?: string | null;
}

/**
 * A persisted machine-observation row, narrowed to what the projection
 * reads. The production `MachineObservationResultRow` (MCP-021B) is
 * structurally assignable to this. The caller passes PRODUCTION rows only
 * (run_mode filtering happens upstream).
 */
export interface MediatorObservationInput {
  argumentId: string;
  /**
   * The observation family identifier (a `MachineObservationFamily` value,
   * carried as a string to match the persisted `MachineObservationResultRow`
   * shape). The projection keys its decisions off `rawKey`, not `family`.
   */
  family: string;
  rawKey: string;
  confidence: MediatorConfidence;
}

/**
 * The projection input. The caller builds `lifecycle` (via
 * `buildPointLifecycleMap`) and `evidenceDebts` (via `deriveEvidenceDebts`)
 * from the room's rows and passes them in alongside the narrow node list.
 * The mediator core re-reads them; it never re-derives or calls a deriver,
 * keeping it a pure projection over already-derived state.
 */
export interface MediatorGraphInput {
  debateId: string;
  nodes: ReadonlyArray<MediatorGraphNode>;
  lifecycle: PointLifecycleMap;
  evidenceDebts: ReadonlyArray<EvidenceDebt>;
}

export interface MediatorBoardOptions {
  /** When set, biases `nextAction` toward the point containing this node. */
  activeNodeId?: string | null;
  /**
   * INTEL-001 (#900) — OPTIONAL engagement-lane weighting for the `nextAction`
   * tie-break ONLY. Absent/empty => byte-identical board (incl. `inputHash`).
   * It changes WHICH open point `nextAction` names among equally-pressing ones;
   * it invents no state, no label, no field on any point. It is a SUMMARY
   * weighting, never a verdict and never a standing.
   */
  weightingSignals?: {
    /** Nodes participating in a dodge-chain. A point whose members intersect this set is more pressing. */
    pressuredNodeIds?: readonly string[];
    /** Room debt-answer pressure 0..1 (1 - answerRate); biases toward unresolved points. */
    unresolvedDebtPressure?: number;
  };
}

// ── Output marker types ───────────────────────────────────────

export interface PointAnchor {
  nodeId: string;
  parentNodeId: string | null;
  /** What the point's root move claims to address, when known. */
  targetExcerpt: string | null;
}

export interface DisagreementPoint {
  /** Stable id — equals the lifecycle cluster id (`branchRootMessageId`). */
  id: string;
  anchor: PointAnchor;
  kind: DisagreementPointKind;
  state: MediatorStateCode;
  plainLabel: string;
  /** The underlying lifecycle state, for traceability (never rendered raw). */
  lifecycleState: PointLifecycleState;
  confidence: MediatorConfidence;
  /** Ids of open evidence debts attached to this point's nodes. */
  openEvidenceDebtIds: ReadonlyArray<string>;
  /** Chronological member message ids (includes the point root). */
  memberNodeIds: ReadonlyArray<string>;
  /** True when the state is an advisory (impasse / off-point / etc.). */
  isAdvisory: boolean;
}

export interface NodeDeviation {
  kind: 'off_point' | 'scope_mismatch';
  plainLabel: string;
  /** Doctrine: deviations are advisory; the user can always post anyway. */
  postAnywayAlwaysAvailable: true;
}

export interface MediatorMarkup {
  nodeId: string;
  /** The point (cluster) this node belongs to. */
  pointId: string;
  /** The single primary state chip a node shows (the point's state). */
  primaryState: MediatorStateCode;
  /** Non-null only when this specific move is off-point / scope-mismatched. */
  deviation: NodeDeviation | null;
  /** Worst open evidence-debt status on this node, when any. */
  evidenceDebtChipStatus: EvidenceDebtStatus | null;
  confidence: MediatorConfidence;
}

export interface EvidenceDebtView {
  debtId: string;
  nodeId: string;
  pointId: string;
  kind: EvidenceDebtKind;
  status: EvidenceDebtStatus;
  isOpen: boolean;
  /** True when the obligation is declined (`unresolved`) or record-limited. */
  isBlocked: boolean;
  plainLabel: string;
}

export interface BlockedEvidencePath {
  pointId: string;
  nodeId: string;
  /** The debt this blockage is tied to, when one exists. */
  debtId: string | null;
  /** A plain-language artifact category, never a demand for disclosure. */
  artifactCategory: string | null;
  plainLabel: string;
}

export interface DefinitionMismatch {
  pointId: string;
  nodeId: string;
  /** True when a shared definition was proposed but not confirmed. */
  proposedButNotConfirmed: boolean;
  confidence: MediatorConfidence;
}

export interface ScopeMismatch {
  pointId: string;
  nodeId: string;
  confidence: MediatorConfidence;
}

export interface RecollectionConflict {
  pointId: string;
  /** Memory-claim node ids. Empty in v1 (detector deferred). */
  memoryNodeIds: ReadonlyArray<string>;
  /** Verifiable-claim node ids. Empty in v1. */
  verifiableNodeIds: ReadonlyArray<string>;
  confidence: MediatorConfidence;
}

export interface NonProvableKeyDetail {
  pointId: string;
  nodeId: string;
  /** Nodes whose interpretation depends on the unprovable detail. */
  dependentNodeIds: ReadonlyArray<string>;
}

export type ResolutionPathwayStepCode =
  | 'provide_source'
  | 'define_term'
  | 'narrow_or_branch'
  | 'respond_to_point'
  | 'name_tradeoff'
  | 'supply_mechanism'
  | 'await_record';

export interface ResolutionPathwayStep {
  code: ResolutionPathwayStepCode;
  plainLabel: string;
  /** True when the step is something a participant can do now. */
  available: boolean;
}

export interface ResolutionPathway {
  pointId: string;
  steps: ReadonlyArray<ResolutionPathwayStep>;
  /** False => a candidate structured impasse (no available pathway). */
  anyAvailable: boolean;
}

export interface StructuredImpasse {
  pointId: string;
  /** Both sides followed the form (lifecycle reached exhaustion). */
  followedForm: true;
  /** No pathway is available right now. */
  openPathwayExists: false;
  /** The remaining unresolved member node ids. */
  remainingClaimNodeIds: ReadonlyArray<string>;
  plainLabel: string;
}

export interface MediatorNextAction {
  /** The point this action advances, or null when none is open. */
  pointId: string | null;
  code: ResolutionPathwayStepCode | 'none';
  plainPrompt: string;
}

/**
 * The full board state. ALL keyed collections are plain objects / arrays
 * (NOT Map) so the whole structure is JSON-serializable round-trip
 * (a Map would serialize to `{}`).
 */
export interface MediatorBoardState {
  debateId: string;
  points: ReadonlyArray<DisagreementPoint>;
  /** Keyed by node id. Plain object for JSON-serializability. */
  markupByNodeId: Readonly<Record<string, MediatorMarkup>>;
  evidenceDebts: ReadonlyArray<EvidenceDebtView>;
  blockedEvidencePaths: ReadonlyArray<BlockedEvidencePath>;
  definitionMismatches: ReadonlyArray<DefinitionMismatch>;
  scopeMismatches: ReadonlyArray<ScopeMismatch>;
  /** Empty in v1 — recollection detector is a deferred future card. */
  recollectionConflicts: ReadonlyArray<RecollectionConflict>;
  nonProvableKeyDetails: ReadonlyArray<NonProvableKeyDetail>;
  impasses: ReadonlyArray<StructuredImpasse>;
  /** Keyed by point id. Plain object for JSON-serializability. */
  pathwaysByPointId: Readonly<Record<string, ResolutionPathway>>;
  nextAction: MediatorNextAction | null;
  /** Stable hash of the inputs (mirrors the lifecycle map's inputHash). */
  inputHash: string;
}
