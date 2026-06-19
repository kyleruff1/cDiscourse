/**
 * UX-MEDIATOR-001 — Mediator board state derivation (pure TypeScript).
 *
 * A READ-ONLY PROJECTION: given a pre-built point-lifecycle map
 * (`buildPointLifecycleMap`), a pre-derived evidence-debt list
 * (`deriveEvidenceDebts`), and persisted machine observations (families
 * A–I, production rows), produce a JSON-serializable `MediatorBoardState`.
 *
 * It never calls a deriver, a classifier, a network, a clock, or randomness;
 * it never mutates its inputs; it never gates a submission. See
 * `mediatorBoardTypes.ts` for the full doctrine.
 *
 * State is decided worst-priority-wins, reusing the lifecycle ordering. Every
 * dispute-kind state (definition / scope / value / blocked / off-point) is
 * emitted ONLY when a supporting persisted observation or evidence-debt
 * status exists — never invented. `accounts_differ` (recollection) has a
 * reserved type but no detector in v1, so it is never synthesized.
 */
import type {
  EvidenceDebt,
  EvidenceDebtStatus,
} from '../evidence/evidenceDebtModel';
import { OPEN_EVIDENCE_DEBT_STATUSES, evidenceDebtKindWord } from '../evidence/evidenceDebtModel';
import type {
  PointLifecycleAxis,
  PointLifecycleClusterSummary,
  PointLifecycleState,
} from '../lifecycle/pointLifecycleModel';
import { LIFECYCLE_PRIORITY } from '../lifecycle/pointLifecycleModel';
import {
  helperForMediatorState,
  plainLanguageForMediatorState,
  plainLanguageForPathwayStep,
} from './mediatorPlainLanguage';
import { V4_DISPLAY_STATE_BY_CODE } from './mediatorBoardTypes';
import type {
  BlockedEvidencePath,
  DefinitionMismatch,
  DisagreementPoint,
  DisagreementPointKind,
  EvidenceDebtView,
  MediatorBoardOptions,
  MediatorBoardState,
  MediatorConfidence,
  MediatorGraphInput,
  MediatorGraphNode,
  MediatorMarkup,
  MediatorNextAction,
  MediatorObservationInput,
  MediatorStateCode,
  NodeDeviation,
  NonProvableKeyDetail,
  RecollectionConflict,
  ResolutionPathway,
  ResolutionPathwayStep,
  ScopeMismatch,
  StructuredImpasse,
  V4MediatorStateCode,
} from './mediatorBoardTypes';

// ── Observation raw-key sets (verbatim from machineObservationDefinitions/) ──

const DEFINITION_KEYS: ReadonlySet<string> = new Set([
  'disputes_definition', // family B
  'flags_term_ambiguity', // family C
  'proposes_shared_definition', // family C
]);
const DEFINITION_CONFIRM_KEY = 'confirms_shared_definition'; // family C
const SCOPE_KEYS: ReadonlySet<string> = new Set([
  'disputes_scope', // family B
  'scope_mismatch_identified', // family C
]);
const VALUE_KEYS: ReadonlySet<string> = new Set([
  'disputes_value_weighting', // family B
]);
const CONTEXT_LIMIT_KEY = 'flags_context_limit'; // family D
const OFF_POINT_KEYS: ReadonlySet<string> = new Set([
  'question_answer_mismatch', // family C
]);
/**
 * Recollection-conflict keys — INTENTIONALLY EMPTY in v1. A recollection
 * detector needs claim-identity (a deferred future card); `accounts_differ`
 * is therefore a reserved type that is never synthesized from absent input.
 */
const RECOLLECTION_KEYS: ReadonlySet<string> = new Set<string>();

const OPEN_DEBT_STATUS_SET: ReadonlySet<EvidenceDebtStatus> = new Set(OPEN_EVIDENCE_DEBT_STATUSES);

// ── Small pure helpers ────────────────────────────────────────

function axisToKind(axis: PointLifecycleAxis | null): DisagreementPointKind {
  switch (axis) {
    case 'fact':
    case 'definition':
    case 'causal':
    case 'value':
    case 'evidence':
    case 'logic':
    case 'scope':
      return axis;
    case 'source':
    case 'quote':
      return 'evidence';
    case 'unaxed':
    case null:
    default:
      return 'unaxed';
  }
}

interface ObservationIndex {
  /** messageId -> set of rawKeys observed on it. */
  byNode: ReadonlyMap<string, ReadonlySet<string>>;
  /** messageId -> rawKey -> best confidence seen. */
  confByNode: ReadonlyMap<string, ReadonlyMap<string, MediatorConfidence>>;
  total: number;
}

const CONFIDENCE_RANK: Readonly<Record<MediatorConfidence, number>> = Object.freeze({
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
});

function buildObservationIndex(
  observations: ReadonlyArray<MediatorObservationInput>,
): ObservationIndex {
  const byNode = new Map<string, Set<string>>();
  const confByNode = new Map<string, Map<string, MediatorConfidence>>();
  const rows = Array.isArray(observations) ? observations : [];
  for (const row of rows) {
    if (!row || typeof row.argumentId !== 'string' || typeof row.rawKey !== 'string') continue;
    let keys = byNode.get(row.argumentId);
    if (!keys) {
      keys = new Set<string>();
      byNode.set(row.argumentId, keys);
    }
    keys.add(row.rawKey);
    let conf = confByNode.get(row.argumentId);
    if (!conf) {
      conf = new Map<string, MediatorConfidence>();
      confByNode.set(row.argumentId, conf);
    }
    const prev = conf.get(row.rawKey);
    const next: MediatorConfidence = row.confidence ?? 'unknown';
    if (!prev || CONFIDENCE_RANK[next] > CONFIDENCE_RANK[prev]) conf.set(row.rawKey, next);
  }
  return { byNode, confByNode, total: rows.length };
}

/** True when any member node carries `key`. */
function clusterHasKey(
  memberIds: ReadonlyArray<string>,
  key: string,
  index: ObservationIndex,
): boolean {
  for (const id of memberIds) {
    if (index.byNode.get(id)?.has(key)) return true;
  }
  return false;
}

/** True when any member node carries any key in `keys`. */
function clusterHasAnyKey(
  memberIds: ReadonlyArray<string>,
  keys: ReadonlySet<string>,
  index: ObservationIndex,
): boolean {
  for (const id of memberIds) {
    const onNode = index.byNode.get(id);
    if (!onNode) continue;
    for (const k of keys) if (onNode.has(k)) return true;
  }
  return false;
}

/** Best confidence across member nodes for any key in `keys`; null if none. */
function clusterKeyConfidence(
  memberIds: ReadonlyArray<string>,
  keys: ReadonlySet<string>,
  index: ObservationIndex,
): MediatorConfidence | null {
  let best: MediatorConfidence | null = null;
  for (const id of memberIds) {
    const conf = index.confByNode.get(id);
    if (!conf) continue;
    for (const k of keys) {
      const c = conf.get(k);
      if (c && (!best || CONFIDENCE_RANK[c] > CONFIDENCE_RANK[best])) best = c;
    }
  }
  return best;
}

/** First member node id carrying any key in `keys`, in member order. */
function firstNodeWithKey(
  memberIds: ReadonlyArray<string>,
  keys: ReadonlySet<string>,
  index: ObservationIndex,
): string | null {
  for (const id of memberIds) {
    const onNode = index.byNode.get(id);
    if (!onNode) continue;
    for (const k of keys) if (onNode.has(k)) return id;
  }
  return null;
}

/** Worst (most-attention) open-debt status across `debts`; null if no open debt. */
const DEBT_STATUS_SEVERITY: ReadonlyArray<EvidenceDebtStatus> = Object.freeze([
  'challenged',
  'unresolved',
  'stale',
  'requested',
]);
function worstOpenDebtStatus(debts: ReadonlyArray<EvidenceDebt>): EvidenceDebtStatus | null {
  let best: EvidenceDebtStatus | null = null;
  let bestRank = DEBT_STATUS_SEVERITY.length;
  for (const d of debts) {
    if (!OPEN_DEBT_STATUS_SET.has(d.status)) continue;
    const rank = DEBT_STATUS_SEVERITY.indexOf(d.status);
    const safe = rank < 0 ? DEBT_STATUS_SEVERITY.length - 1 : rank;
    if (safe < bestRank) {
      bestRank = safe;
      best = d.status;
    }
  }
  return best;
}

// ── Point-state decision (v4 candidate-set + Gate A + ordered picker) ──
//
// UX-MEDIATOR-001 precedence delta. The shipped early-return cascade is
// restructured into THREE phases so the precedence is a single explicit total
// order (and the v4 conflict rows fall out of that order + one gate):
//
//   1. Resolution dominance — a settled point is terminal; short-circuit.
//   2. Build a candidate set — each candidate is an independent boolean keyed
//      off the SAME deterministic / observation inputs as the shipped cascade
//      (the per-signal detection is moved VERBATIM into named predicates).
//   3. Gate A + ordered pick — demote `structured_impasse` when any non-impasse
//      candidate has an available pathway (v4: "Impasse + any path remains →
//      not impasse"), then pick the highest-priority candidate.
//
// This fixes the two shipped divergences from the v4 priority table:
//   D1 — impasse was too LOW (checked after needs_evidence/definition/scope);
//        now it is highest, but Gate A keeps it from firing while a pathway
//        remains.
//   D2 — narrowed was too HIGH (checked before the evidence/definition/scope
//        signals); now `needs_evidence` (and every more-specific state) wins
//        over `narrowed` when both are candidates.
//
// `point.state` still emits one of the 13 internal codes (Inspect / downstream
// consumers unchanged); `v4DisplayStateFor` projects it onto the v4 nine.

interface PointStateResult {
  state: MediatorStateCode;
  confidence: MediatorConfidence;
}

interface PointStateCandidate {
  state: MediatorStateCode;
  confidence: MediatorConfidence;
}

/**
 * Internal-code precedence (HIGHEST wins). Derived from
 * `V4_PRIMARY_STATE_PRIORITY` (the published v4 display order) with the four
 * superset codes inserted at their display rank so the internal `point.state`
 * keeps the precise code while the ORDER matches v4:
 *
 *   resolved_or_settled    — terminal dominance (handled before the picker;
 *                            listed here only for completeness / exhaustiveness)
 *   structured_impasse     — v4 #1 (subject to Gate A)
 *   evidence_blocked       — v4 #2
 *   key_detail_unavailable — display→evidence_blocked; just below a declined
 *                            debt so a declined debt still wins (shipped step 3)
 *   accounts_differ        — v4 #3 (never a candidate in v1)
 *   definition_not_shared  — v4 #4
 *   scope_mismatch         — v4 #5
 *   off_point              — display→scope_mismatch; just below an explicit scope signal
 *   missing_mechanism      — v4 #6
 *   needs_evidence         — v4 #7 (now outranks narrowed → fixes D2)
 *   narrowed               — v4 #8
 *   value_tradeoff         — display→open; a priorities difference, just above open
 *   open                   — v4 #9 default
 */
const INTERNAL_STATE_PRIORITY: ReadonlyArray<MediatorStateCode> = Object.freeze([
  'resolved_or_settled',
  'structured_impasse',
  'evidence_blocked',
  'key_detail_unavailable',
  'accounts_differ',
  'definition_not_shared',
  'scope_mismatch',
  'off_point',
  'missing_mechanism',
  'needs_evidence',
  'narrowed',
  'value_tradeoff',
  'open',
]);

const INTERNAL_PRIORITY_RANK: Readonly<Record<MediatorStateCode, number>> = Object.freeze(
  INTERNAL_STATE_PRIORITY.reduce<Record<string, number>>((acc, code, i) => {
    acc[code] = INTERNAL_STATE_PRIORITY.length - i;
    return acc;
  }, {}) as Record<MediatorStateCode, number>,
);

/**
 * Build the candidate set for a cluster. Each candidate is an independent
 * boolean computed exactly as the shipped cascade computed it — only the
 * SELECTION (below) changes. `open` is always a candidate (the fallback).
 */
function buildPointStateCandidates(
  cluster: PointLifecycleClusterSummary,
  openDebts: ReadonlyArray<EvidenceDebt>,
  index: ObservationIndex,
): PointStateCandidate[] {
  const lc: PointLifecycleState = cluster.state;
  const memberIds = cluster.messageIds;
  const hasAnyObs = memberIds.some((id) => index.byNode.has(id));
  const fallbackConfidence: MediatorConfidence = hasAnyObs ? 'medium' : 'unknown';
  const candidates: PointStateCandidate[] = [];

  // Evidence obligation (open debt OR lifecycle ask) — verbatim from shipped step 3.
  const lifecycleAsksEvidence = lc === 'source_requested' || lc === 'quote_requested';
  const hasEvidenceObligation = openDebts.length > 0 || lifecycleAsksEvidence;
  const declined = openDebts.some((d) => d.status === 'unresolved');
  const hasContextLimit = clusterHasKey(memberIds, CONTEXT_LIMIT_KEY, index);

  // structured_impasse — exhausted (Gate A may demote it below).
  if (lc === 'exhausted') {
    candidates.push({ state: 'structured_impasse', confidence: 'high' });
  }
  // evidence_blocked — a declined (unresolved) debt with an open obligation.
  if (hasEvidenceObligation && declined) {
    candidates.push({ state: 'evidence_blocked', confidence: 'high' });
  }
  // key_detail_unavailable — context-limit flag (with or without an open debt,
  //   but NOT when a declined debt already wins evidence_blocked).
  if (hasContextLimit && !(hasEvidenceObligation && declined)) {
    candidates.push({
      state: 'key_detail_unavailable',
      confidence: clusterKeyConfidence(memberIds, new Set([CONTEXT_LIMIT_KEY]), index) ?? 'medium',
    });
  }
  // accounts_differ — reserved; key set is empty in v1, so this never fires.
  if (RECOLLECTION_KEYS.size > 0 && clusterHasAnyKey(memberIds, RECOLLECTION_KEYS, index)) {
    candidates.push({ state: 'accounts_differ', confidence: 'low' });
  }
  // definition_not_shared — definition keys present, not confirmed.
  if (
    clusterHasAnyKey(memberIds, DEFINITION_KEYS, index)
    && !clusterHasKey(memberIds, DEFINITION_CONFIRM_KEY, index)
  ) {
    candidates.push({
      state: 'definition_not_shared',
      confidence: clusterKeyConfidence(memberIds, DEFINITION_KEYS, index) ?? 'medium',
    });
  }
  // scope_mismatch — observation-driven, OR lifecycle branch_recommended (low conf).
  if (clusterHasAnyKey(memberIds, SCOPE_KEYS, index)) {
    candidates.push({
      state: 'scope_mismatch',
      confidence: clusterKeyConfidence(memberIds, SCOPE_KEYS, index) ?? 'medium',
    });
  } else if (lc === 'branch_recommended') {
    candidates.push({ state: 'scope_mismatch', confidence: 'low' });
  }
  // off_point — lifecycle ignored/moved-on, OR Q/A mismatch observation.
  if (
    lc === 'ignored_by_affirmative'
    || lc === 'ignored_by_negative'
    || lc === 'ignored_by_both'
    || lc === 'moved_on_by_affirmative'
    || lc === 'moved_on_by_negative'
    || clusterHasAnyKey(memberIds, OFF_POINT_KEYS, index)
  ) {
    candidates.push({ state: 'off_point', confidence: 'medium' });
  }
  // missing_mechanism — causal axis + still-contested lifecycle (proxy → low conf).
  if (cluster.primaryAxis === 'causal' && (lc === 'rebutted' || lc === 'answered' || lc === 'open')) {
    candidates.push({ state: 'missing_mechanism', confidence: 'low' });
  }
  // needs_evidence — an open obligation with no declined / context-limit block.
  if (hasEvidenceObligation && !declined && !hasContextLimit) {
    candidates.push({ state: 'needs_evidence', confidence: 'high' });
  }
  // narrowed — a repair, never a defeat (now ranks below the evidence/definition/
  //   scope/missing-link signals → fixes D2).
  if (lc === 'narrowed' || lc === 'conceded') {
    candidates.push({ state: 'narrowed', confidence: 'high' });
  }
  // value_tradeoff — value axis or value observation (display collapses to open).
  if (cluster.primaryAxis === 'value' || clusterHasAnyKey(memberIds, VALUE_KEYS, index)) {
    candidates.push({
      state: 'value_tradeoff',
      confidence: clusterKeyConfidence(memberIds, VALUE_KEYS, index) ?? 'medium',
    });
  }
  // open — always the fallback; preserves uncertainty when nothing else fires.
  candidates.push({ state: 'open', confidence: fallbackConfidence });

  return candidates;
}

/**
 * True when a NON-impasse, non-fallback candidate has a resolution pathway a
 * participant can act on now. Used by Gate A: structured_impasse is demoted
 * while any such pathway remains (v4 conflict row "Impasse + any path remains
 * → not impasse").
 *
 * `open` is EXCLUDED (R3 in the design): `open` is the terminal fallback, not a
 * real alternative pathway — its `respond_to_point` step is always "available",
 * so counting it would mean impasse could never stand. An exhausted cluster
 * with nothing actionable above `open` is exactly a structured impasse.
 * `resolved_or_settled` never reaches the candidate set (Phase 1 short-circuit).
 */
function anyNonImpassePathwayAvailable(candidates: ReadonlyArray<PointStateCandidate>): boolean {
  for (const c of candidates) {
    if (c.state === 'structured_impasse' || c.state === 'open') continue;
    if (pathwayForState('', c.state).anyAvailable) return true;
  }
  return false;
}

function decidePointState(
  cluster: PointLifecycleClusterSummary,
  openDebts: ReadonlyArray<EvidenceDebt>,
  index: ObservationIndex,
): PointStateResult {
  const lc: PointLifecycleState = cluster.state;

  // Phase 1 — Resolution dominance (terminal; never competes in the picker).
  if (lc === 'archived_or_resolved' || lc === 'confirmed' || lc === 'synthesis_ready') {
    return { state: 'resolved_or_settled', confidence: 'high' };
  }

  // Phase 2 — Candidate set.
  let candidates = buildPointStateCandidates(cluster, openDebts, index);

  // Phase 3a — Gate A: demote structured_impasse when a pathway remains.
  const hasImpasse = candidates.some((c) => c.state === 'structured_impasse');
  if (hasImpasse && anyNonImpassePathwayAvailable(candidates)) {
    candidates = candidates.filter((c) => c.state !== 'structured_impasse');
  }

  // Phase 3b — Ordered pick: highest-priority candidate (open is always present).
  let chosen: PointStateCandidate = candidates[candidates.length - 1]; // 'open' fallback
  let bestRank = -1;
  for (const c of candidates) {
    const rank = INTERNAL_PRIORITY_RANK[c.state] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      chosen = c;
    }
  }
  return { state: chosen.state, confidence: chosen.confidence };
}

/**
 * Project an internal 13-code mediator state onto the v4 nine-state DISPLAY
 * vocabulary (UX-MEDIATOR-001). A pure total function over all 13 codes.
 * `point.state` is unchanged; downstream cards (UX-MEDIATOR-002/005) consume
 * this helper to render the v4 vocabulary. `resolved_or_settled` is terminal
 * and returned as its own atom (it is not one of the nine live states).
 */
export function v4DisplayStateFor(
  code: MediatorStateCode,
): V4MediatorStateCode | 'resolved_or_settled' {
  return V4_DISPLAY_STATE_BY_CODE[code];
}

// ── Public derivations (each (graph, observations) per the card contract) ──

/** Group the lifecycle clusters into projected disagreement points. */
export function deriveOpenDisagreementPoints(
  graph: MediatorGraphInput,
  observations: ReadonlyArray<MediatorObservationInput>,
): ReadonlyArray<DisagreementPoint> {
  const index = buildObservationIndex(observations);
  const nodeById = indexNodes(graph.nodes);
  const debtsByCluster = bucketDebtsByCluster(graph.evidenceDebts, nodeById);
  const points: DisagreementPoint[] = [];

  for (const clusterId of graph.lifecycle.clusterOrder) {
    const cluster = graph.lifecycle.byCluster.get(clusterId);
    if (!cluster) continue;
    const clusterDebts = debtsByCluster.get(clusterId) ?? [];
    const openDebts = clusterDebts.filter((d) => OPEN_DEBT_STATUS_SET.has(d.status));
    const decided = decidePointState(cluster, openDebts, index);
    const rootNode = nodeById.get(cluster.rootMessageId) ?? null;
    points.push({
      id: clusterId,
      anchor: {
        nodeId: cluster.rootMessageId,
        parentNodeId: rootNode ? rootNode.parentId : null,
        targetExcerpt: rootNode?.targetExcerpt ?? null,
      },
      kind: axisToKind(cluster.primaryAxis),
      state: decided.state,
      plainLabel: plainLanguageForMediatorState(decided.state),
      lifecycleState: cluster.state,
      confidence: decided.confidence,
      openEvidenceDebtIds: openDebts.map((d) => d.id).sort(compareStrings),
      memberNodeIds: cluster.messageIds.slice(),
      isAdvisory:
        cluster.isAdvisory || decided.state === 'off_point' || decided.state === 'structured_impasse',
    });
  }
  return points;
}

/** Project the pre-derived evidence debts into mediator board views. */
export function deriveEvidenceDebt(
  graph: MediatorGraphInput,
  observations: ReadonlyArray<MediatorObservationInput>,
): ReadonlyArray<EvidenceDebtView> {
  const index = buildObservationIndex(observations);
  const nodeById = indexNodes(graph.nodes);
  const views: EvidenceDebtView[] = (graph.evidenceDebts ?? []).map((debt) => {
    const node = nodeById.get(debt.nodeId);
    const pointId = node ? node.branchRootMessageId : debt.nodeId;
    const isOpen = OPEN_DEBT_STATUS_SET.has(debt.status);
    const isBlocked = debt.status === 'unresolved' || index.byNode.get(debt.nodeId)?.has(CONTEXT_LIMIT_KEY) === true;
    const stateCode: MediatorStateCode = isBlocked
      ? 'evidence_blocked'
      : isOpen
        ? 'needs_evidence'
        : 'resolved_or_settled';
    return {
      debtId: debt.id,
      nodeId: debt.nodeId,
      pointId,
      kind: debt.debtKind,
      status: debt.status,
      isOpen,
      isBlocked,
      plainLabel: plainLanguageForMediatorState(stateCode),
    };
  });
  views.sort((a, b) => compareStrings(a.debtId, b.debtId));
  return views;
}

/** Resolution pathway per point, keyed by point id (JSON-serializable object). */
export function deriveResolutionPathways(
  graph: MediatorGraphInput,
  observations: ReadonlyArray<MediatorObservationInput>,
): Readonly<Record<string, ResolutionPathway>> {
  const points = deriveOpenDisagreementPoints(graph, observations);
  const out: Record<string, ResolutionPathway> = {};
  for (const point of points) {
    out[point.id] = pathwayForState(point.id, point.state);
  }
  return out;
}

/** Structured impasse markers (exhausted + no available pathway). */
export function deriveImpasseMarkers(
  graph: MediatorGraphInput,
  observations: ReadonlyArray<MediatorObservationInput>,
): ReadonlyArray<StructuredImpasse> {
  const points = deriveOpenDisagreementPoints(graph, observations);
  const impasses: StructuredImpasse[] = [];
  for (const point of points) {
    if (point.state !== 'structured_impasse') continue;
    const pathway = pathwayForState(point.id, point.state);
    if (pathway.anyAvailable) continue; // defensive: only when no pathway exists
    impasses.push({
      pointId: point.id,
      followedForm: true,
      openPathwayExists: false,
      remainingClaimNodeIds: point.memberNodeIds.slice(),
      plainLabel: plainLanguageForMediatorState('structured_impasse'),
    });
  }
  return impasses;
}

// ── Orchestrator ──────────────────────────────────────────────

export function deriveMediatorBoardState(
  graph: MediatorGraphInput,
  observations: ReadonlyArray<MediatorObservationInput>,
  options?: MediatorBoardOptions,
): MediatorBoardState {
  const debateId = graph.debateId;
  const index = buildObservationIndex(observations);
  const nodeById = indexNodes(graph.nodes);
  const points = deriveOpenDisagreementPoints(graph, observations);
  const pointById = new Map<string, DisagreementPoint>();
  for (const p of points) pointById.set(p.id, p);

  const evidenceDebts = deriveEvidenceDebt(graph, observations);
  const debtsByNode = new Map<string, EvidenceDebt[]>();
  for (const d of graph.evidenceDebts ?? []) {
    const list = debtsByNode.get(d.nodeId) ?? [];
    list.push(d);
    debtsByNode.set(d.nodeId, list);
  }

  // Per-node markup (one primary chip + optional node-specific deviation).
  const markupByNodeId: Record<string, MediatorMarkup> = {};
  const orderedNodes = graph.nodes.slice().sort((a, b) => a.ordinal - b.ordinal);
  for (const node of orderedNodes) {
    const point = pointById.get(node.branchRootMessageId);
    if (!point) continue;
    markupByNodeId[node.messageId] = {
      nodeId: node.messageId,
      pointId: point.id,
      primaryState: point.state,
      deviation: deviationForNode(node, index),
      evidenceDebtChipStatus: worstOpenDebtStatus(debtsByNode.get(node.messageId) ?? []),
      confidence: point.confidence,
    };
  }

  // Derived marker collections.
  const blockedEvidencePaths = deriveBlockedPaths(graph, evidenceDebts, index);
  const definitionMismatches = deriveDefinitionMismatches(points, index);
  const scopeMismatches = deriveScopeMismatches(points, index);
  const nonProvableKeyDetails = deriveNonProvableKeyDetails(points);
  const recollectionConflicts: ReadonlyArray<RecollectionConflict> = Object.freeze([]); // deferred
  const impasses = deriveImpasseMarkers(graph, observations);

  const pathwaysByPointId = deriveResolutionPathways(graph, observations);
  const nextAction = deriveNextAction(points, pathwaysByPointId, options ?? {}, nodeById);

  const inputHash = computeInputHash(graph, observations);

  return Object.freeze({
    debateId,
    points: Object.freeze(points),
    markupByNodeId: Object.freeze(markupByNodeId),
    evidenceDebts: Object.freeze(evidenceDebts),
    blockedEvidencePaths: Object.freeze(blockedEvidencePaths),
    definitionMismatches: Object.freeze(definitionMismatches),
    scopeMismatches: Object.freeze(scopeMismatches),
    recollectionConflicts,
    nonProvableKeyDetails: Object.freeze(nonProvableKeyDetails),
    impasses: Object.freeze(impasses),
    pathwaysByPointId: Object.freeze(pathwaysByPointId),
    nextAction,
    inputHash,
  });
}

// ── Internal helpers for the orchestrator ─────────────────────

function indexNodes(nodes: ReadonlyArray<MediatorGraphNode>): ReadonlyMap<string, MediatorGraphNode> {
  const m = new Map<string, MediatorGraphNode>();
  for (const n of nodes ?? []) m.set(n.messageId, n);
  return m;
}

function bucketDebtsByCluster(
  debts: ReadonlyArray<EvidenceDebt>,
  nodeById: ReadonlyMap<string, MediatorGraphNode>,
): ReadonlyMap<string, EvidenceDebt[]> {
  const m = new Map<string, EvidenceDebt[]>();
  for (const d of debts ?? []) {
    const node = nodeById.get(d.nodeId);
    const clusterId = node ? node.branchRootMessageId : d.nodeId;
    const list = m.get(clusterId) ?? [];
    list.push(d);
    m.set(clusterId, list);
  }
  return m;
}

function deviationForNode(node: MediatorGraphNode, index: ObservationIndex): NodeDeviation | null {
  const onNode = index.byNode.get(node.messageId);
  if (!onNode) return null;
  for (const k of OFF_POINT_KEYS) {
    if (onNode.has(k)) {
      return {
        kind: 'off_point',
        plainLabel: plainLanguageForMediatorState('off_point'),
        postAnywayAlwaysAvailable: true,
      };
    }
  }
  for (const k of SCOPE_KEYS) {
    if (onNode.has(k)) {
      return {
        kind: 'scope_mismatch',
        plainLabel: plainLanguageForMediatorState('scope_mismatch'),
        postAnywayAlwaysAvailable: true,
      };
    }
  }
  return null;
}

function deriveBlockedPaths(
  graph: MediatorGraphInput,
  views: ReadonlyArray<EvidenceDebtView>,
  index: ObservationIndex,
): ReadonlyArray<BlockedEvidencePath> {
  const out: BlockedEvidencePath[] = [];
  const seen = new Set<string>();
  // From declined / record-limited debts.
  for (const v of views) {
    if (!v.isBlocked) continue;
    const key = `${v.pointId}:${v.nodeId}:${v.debtId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const debt = (graph.evidenceDebts ?? []).find((d) => d.id === v.debtId);
    out.push({
      pointId: v.pointId,
      nodeId: v.nodeId,
      debtId: v.debtId,
      artifactCategory: debt ? evidenceDebtKindWord(debt.debtKind) : null,
      plainLabel: plainLanguageForMediatorState('evidence_blocked'),
    });
  }
  // From context-limit observations with no debt on the node.
  for (const node of graph.nodes ?? []) {
    if (!index.byNode.get(node.messageId)?.has(CONTEXT_LIMIT_KEY)) continue;
    const hasDebt = (graph.evidenceDebts ?? []).some((d) => d.nodeId === node.messageId);
    if (hasDebt) continue;
    const key = `${node.branchRootMessageId}:${node.messageId}:null`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      pointId: node.branchRootMessageId,
      nodeId: node.messageId,
      debtId: null,
      artifactCategory: null,
      plainLabel: plainLanguageForMediatorState('key_detail_unavailable'),
    });
  }
  out.sort((a, b) => compareStrings(`${a.pointId}:${a.nodeId}`, `${b.pointId}:${b.nodeId}`));
  return out;
}

function deriveDefinitionMismatches(
  points: ReadonlyArray<DisagreementPoint>,
  index: ObservationIndex,
): ReadonlyArray<DefinitionMismatch> {
  const out: DefinitionMismatch[] = [];
  for (const point of points) {
    if (point.state !== 'definition_not_shared') continue;
    const nodeId = firstNodeWithKey(point.memberNodeIds, DEFINITION_KEYS, index) ?? point.anchor.nodeId;
    out.push({
      pointId: point.id,
      nodeId,
      proposedButNotConfirmed:
        clusterHasKey(point.memberNodeIds, 'proposes_shared_definition', index)
        && !clusterHasKey(point.memberNodeIds, DEFINITION_CONFIRM_KEY, index),
      confidence: point.confidence,
    });
  }
  return out;
}

function deriveScopeMismatches(
  points: ReadonlyArray<DisagreementPoint>,
  index: ObservationIndex,
): ReadonlyArray<ScopeMismatch> {
  const out: ScopeMismatch[] = [];
  for (const point of points) {
    if (point.state !== 'scope_mismatch') continue;
    const nodeId = firstNodeWithKey(point.memberNodeIds, SCOPE_KEYS, index) ?? point.anchor.nodeId;
    out.push({ pointId: point.id, nodeId, confidence: point.confidence });
  }
  return out;
}

function deriveNonProvableKeyDetails(
  points: ReadonlyArray<DisagreementPoint>,
): ReadonlyArray<NonProvableKeyDetail> {
  const out: NonProvableKeyDetail[] = [];
  for (const point of points) {
    if (point.state !== 'key_detail_unavailable') continue;
    out.push({
      pointId: point.id,
      nodeId: point.anchor.nodeId,
      dependentNodeIds: point.memberNodeIds.slice(),
    });
  }
  return out;
}

function pathwayForState(pointId: string, state: MediatorStateCode): ResolutionPathway {
  const steps: ResolutionPathwayStep[] = [];
  const step = (code: ResolutionPathwayStep['code'], available: boolean): ResolutionPathwayStep => ({
    code,
    plainLabel: plainLanguageForPathwayStep(code),
    available,
  });
  switch (state) {
    case 'needs_evidence':
      steps.push(step('provide_source', true));
      break;
    case 'evidence_blocked':
      steps.push(step('await_record', false), step('narrow_or_branch', true));
      break;
    case 'key_detail_unavailable':
      steps.push(step('await_record', false), step('narrow_or_branch', true));
      break;
    case 'definition_not_shared':
      steps.push(step('define_term', true));
      break;
    case 'scope_mismatch':
      steps.push(step('narrow_or_branch', true));
      break;
    case 'value_tradeoff':
      steps.push(step('name_tradeoff', true));
      break;
    case 'missing_mechanism':
      steps.push(step('supply_mechanism', true));
      break;
    case 'off_point':
      steps.push(step('respond_to_point', true));
      break;
    case 'open':
      steps.push(step('respond_to_point', true));
      break;
    case 'narrowed':
      steps.push(step('respond_to_point', true));
      break;
    case 'accounts_differ':
      steps.push(step('await_record', false));
      break;
    case 'structured_impasse':
      steps.push(step('await_record', false));
      break;
    case 'resolved_or_settled':
    default:
      break;
  }
  return { pointId, steps, anyAvailable: steps.some((s) => s.available) };
}

function deriveNextAction(
  points: ReadonlyArray<DisagreementPoint>,
  pathways: Readonly<Record<string, ResolutionPathway>>,
  options: MediatorBoardOptions,
  nodeById: ReadonlyMap<string, MediatorGraphNode>,
): MediatorNextAction {
  // Bias toward the active node's point, if supplied and actionable.
  const activePointId = options.activeNodeId
    ? nodeById.get(options.activeNodeId)?.branchRootMessageId ?? null
    : null;

  const actionable = points.filter((p) => pathways[p.id]?.anyAvailable);
  if (actionable.length === 0) {
    return { pointId: null, code: 'none', plainPrompt: 'No open pathway at the moment.' };
  }

  let chosen: DisagreementPoint | null =
    activePointId ? actionable.find((p) => p.id === activePointId) ?? null : null;
  if (!chosen) {
    // Most pressing = worst lifecycle priority; ties broken by earliest member.
    chosen = actionable
      .slice()
      .sort((a, b) => {
        const pa = LIFECYCLE_PRIORITY[a.lifecycleState] ?? 0;
        const pb = LIFECYCLE_PRIORITY[b.lifecycleState] ?? 0;
        if (pa !== pb) return pb - pa;
        return compareStrings(a.id, b.id);
      })[0];
  }

  const step = pathways[chosen.id].steps.find((s) => s.available);
  return {
    pointId: chosen.id,
    code: step ? step.code : 'none',
    plainPrompt: step ? step.plainLabel : helperForMediatorState(chosen.state),
  };
}

function computeInputHash(
  graph: MediatorGraphInput,
  observations: ReadonlyArray<MediatorObservationInput>,
): string {
  const debtSig = (graph.evidenceDebts ?? [])
    .map((d) => `${d.id}:${d.status}`)
    .sort(compareStrings)
    .join(',');
  const lifecycleSig = graph.lifecycle?.inputHash ?? '';
  return `m1|lc=${lifecycleSig}|n=${(graph.nodes ?? []).length}|d=${debtSig}|o=${observations.length}`;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
