/**
 * LIFE-001 — Point lifecycle metadata model (pure TypeScript).
 *
 * Owns:
 *   - The locked 18-state `PointLifecycleState` vocabulary.
 *   - `LIFECYCLE_PRIORITY` worst-priority-wins table for cluster summaries.
 *   - `PointLifecycleSnapshot` (per-message) + `PointLifecycleClusterSummary`
 *     (per-cluster) + `PointLifecycleMap` (per-tree).
 *   - `LifecycleAdvisoryConfig` thresholds (advisories — NEVER blocking).
 *   - Three derivers: `derivePointLifecycleSnapshot`,
 *     `deriveClusterLifecycleSummary`, `buildPointLifecycleMap`.
 *   - The `getPointLifecyclePlainLabel` typed lookup helper.
 *   - `_forbiddenLifecycleTokens` (consumed by ban-list tests).
 *
 * Doctrine anchor — read this before changing anything in this file:
 *
 *   1. **A lifecycle state is a gameplay signal, never a verdict.** No state
 *      describes truth, winning, losing, or correctness.
 *   2. **Heat / popularity / engagement / virality / strength bands never
 *      feed lifecycle derivation.** Wrong-but-loud and right-but-quiet
 *      produce the same lifecycle state when the move structure is
 *      identical.
 *   3. **`ignored_by_*` describes a cluster, never a person.** The model
 *      labels a *point* as having unanswered requests on a *side*. It never
 *      labels a user as "ignoring" anything.
 *   4. **Concession is a scoring repair, not a defeat.** A `narrowed` or
 *      `conceded` cluster does not "lose" — the responder typically gains
 *      broad standing per the point-standing economy. Lifecycle reports
 *      the *move structure*, not the score outcome.
 *   5. **Exhaustion / moved-on / ignored / branch-recommended are
 *      ADVISORIES, never blocking.** They never prevent posting, never
 *      auto-archive, never auto-hide, never suppress an ordinary reply.
 *
 * LIFE-001 must build *on top of* the existing semantic-flag, qualifier,
 * evidence-contract, and branch-topology surfaces — NOT in parallel. The
 * classifier reads existing node fields and EV-001 contract output; it
 * NEVER re-derives `MessageCategory`, re-classifies a challenge axis, or
 * re-runs anti-amplification.
 *
 * Pure TS. No React. No Supabase. No network. No async. No mutation of any
 * input. No new dependency. No AI inference.
 */

import type {
  ArgumentTimelineMapEdge,
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
} from '../arguments/argumentGameSurfaceModel';
import type { EvidenceArtifact, SourceChainStatus } from '../evidence/evidenceModel';
import { summarizeArtifactsForReceiptChip } from '../evidence/evidenceModel';
import { PLAIN_LANGUAGE_COPY } from '../arguments/gameCopy';
import {
  buildSideTurnSequence,
  deriveAxis,
  findSameAxisAncestor,
  groupNodesByCluster,
  nodeHasQualifierCode,
} from './pointLifecycleClusters';
import {
  countOffAxisPressure,
  countSameAxisPressure,
  hasAdditiveAxisInformation,
  turnsSinceSideEngagedCluster,
} from './pointLifecycleAdvisoryInputs';

// ── Public types ──────────────────────────────────────────────

/**
 * LIFE-001 — Point lifecycle vocabulary. Each value is a board signal,
 * NEVER a verdict. The 18 values partition the gameplay states a cluster
 * can be in given the move-structure inputs LIFE-001 reads (parent → reply
 * axis, evidence artifacts, qualifier codes, branch topology, turn
 * sequence per side).
 *
 * Doctrine: no state may be inferred from truth / winner / loser /
 * correctness. No state may be inferred from heat / popularity / engagement
 * / virality / strength bands. Wrong-but-loud + right-but-quiet → identical
 * lifecycle when move structure matches.
 */
export type PointLifecycleState =
  | 'open'
  | 'answered'
  | 'rebutted'
  | 'clarified'
  | 'sourced'
  | 'quote_requested'
  | 'source_requested'
  | 'narrowed'
  | 'conceded'
  | 'confirmed'
  | 'synthesis_ready'
  | 'moved_on_by_affirmative'
  | 'moved_on_by_negative'
  | 'ignored_by_affirmative'
  | 'ignored_by_negative'
  | 'ignored_by_both'
  | 'exhausted'
  | 'branch_recommended'
  | 'archived_or_resolved';

/** Frozen array of every state. Tests + RULE-003 iterate this. */
export const ALL_POINT_LIFECYCLE_STATES: ReadonlyArray<PointLifecycleState> = Object.freeze([
  'open',
  'answered',
  'rebutted',
  'clarified',
  'sourced',
  'quote_requested',
  'source_requested',
  'narrowed',
  'conceded',
  'confirmed',
  'synthesis_ready',
  'moved_on_by_affirmative',
  'moved_on_by_negative',
  'ignored_by_affirmative',
  'ignored_by_negative',
  'ignored_by_both',
  'exhausted',
  'branch_recommended',
  'archived_or_resolved',
]);

/** Higher value = higher priority. Worst-priority-wins for cluster summary. */
export const LIFECYCLE_PRIORITY: Readonly<Record<PointLifecycleState, number>> = Object.freeze({
  archived_or_resolved: 0,
  synthesis_ready: 5,
  conceded: 10,
  narrowed: 10,
  confirmed: 10,
  sourced: 20,
  clarified: 20,
  open: 30,
  answered: 30,
  rebutted: 50,
  quote_requested: 50,
  source_requested: 50,
  branch_recommended: 60,
  moved_on_by_affirmative: 70,
  moved_on_by_negative: 70,
  ignored_by_affirmative: 80,
  ignored_by_negative: 80,
  ignored_by_both: 85,
  exhausted: 90,
});

/** Axes LIFE-001 reads from existing qualifier / argument-type fields. */
export type PointLifecycleAxis =
  | 'fact'
  | 'definition'
  | 'causal'
  | 'value'
  | 'evidence'
  | 'logic'
  | 'scope'
  | 'source'
  | 'quote'
  | 'unaxed';

/** Frozen list of every axis. */
export const ALL_POINT_LIFECYCLE_AXES: ReadonlyArray<PointLifecycleAxis> = Object.freeze([
  'fact',
  'definition',
  'causal',
  'value',
  'evidence',
  'logic',
  'scope',
  'source',
  'quote',
  'unaxed',
]);

export interface PointLifecycleSnapshot {
  /** Same as the message's `id` field on `public.arguments`. */
  messageId: string;
  /** Cluster the message belongs to. Equal to its `branchRootMessageId` in
   *  the surface model. */
  clusterId: string;
  /** The cluster's current lifecycle state. */
  clusterState: PointLifecycleState;
  /** This message's individual contribution. */
  messageContribution: PointLifecycleState;
  /** Convenience: which axis the message was acting on, when derivable. */
  axis: PointLifecycleAxis | null;
  /** True when this message creates an open request that the other side
   *  has not yet answered. */
  opensRequest: boolean;
  /** True when this message resolves an open request by sourcing /
   *  quoting / evidencing the parent. */
  resolvesRequest: boolean;
  /** True when this message is an explicit concession-shape move. */
  isConcessionShape: boolean;
  /** True when this message is an explicit synthesis-shape move. */
  isSynthesisShape: boolean;
  /** Plain-language label fallback. */
  plainLabel: string;
}

export interface PointLifecycleClusterSummary {
  clusterId: string;
  /** Cluster root message id. Equals `branchRootMessageId`. */
  rootMessageId: string;
  /** Worst-priority state across the cluster's members + cluster-level
   *  rules. */
  state: PointLifecycleState;
  /** Plain-language default label. */
  plainLabel: string;
  /** Ordered chronological message-id list. Includes the cluster root. */
  messageIds: ReadonlyArray<string>;
  /** Count of unique members. */
  memberCount: number;
  /** Per-side activity counts (used by GAME-001 to TUNE thresholds). */
  affirmativeMoveCount: number;
  negativeMoveCount: number;
  observerMoveCount: number;
  /** True when the cluster has at least one open `source_requested` or
   *  `quote_requested` request. */
  hasOpenSourceOrQuoteRequest: boolean;
  /** True when the cluster has at least one explicit concession-shape or
   *  synthesis-shape move. */
  hasConcessionOrSynthesisMove: boolean;
  /** EV-001 contract worst-status across the cluster. */
  worstEvidenceStatus: SourceChainStatus;
  /** Detected axis distribution (chronologically last axis wins ties). */
  primaryAxis: PointLifecycleAxis | null;
  /** True when LIFE-001 decided the cluster's state is an advisory state. */
  isAdvisory: boolean;
}

export interface PointLifecycleMap {
  /** Frozen map keyed by cluster id (`branchRootMessageId`). */
  byCluster: ReadonlyMap<string, PointLifecycleClusterSummary>;
  /** Frozen map keyed by message id. */
  byMessage: ReadonlyMap<string, PointLifecycleSnapshot>;
  /** Frozen list of cluster ids in chronological order. */
  clusterOrder: ReadonlyArray<string>;
  /** Frozen list of every cluster's state for the room. */
  cumulativeStateSequence: ReadonlyArray<PointLifecycleState>;
  /** Stable hash of the inputs. */
  inputHash: string;
}

/**
 * Threshold constants for the four advisory states. LIFE-001 ships safe
 * defaults; GAME-001 may pass override values to tune. None of the
 * non-advisory states use these.
 *
 * Doctrine: thresholds are advisory only — they NEVER block posting,
 * NEVER auto-archive, NEVER auto-message a user.
 */
export interface LifecycleAdvisoryConfig {
  /** Same-axis pressure repeats required to fire `exhausted`. Default: 3. */
  exhaustionRepeatThreshold: number;
  /** Turns since the side last posted to this cluster required to fire
   *  `moved_on_by_<side>`. Default: 4. */
  movedOnTurnThreshold: number;
  /** Turns since the side received an open request on this cluster
   *  required to fire `ignored_by_<side>`. Default: 3. */
  ignoredBySideTurnThreshold: number;
  /** Combined-side dormancy turns required to fire `ignored_by_both`.
   *  Default: 6. */
  ignoredByBothTurnThreshold: number;
  /** Off-axis pressure repeats required to fire `branch_recommended`.
   *  Default: 2. */
  branchRecommendedRepeatThreshold: number;
}

export const DEFAULT_LIFECYCLE_ADVISORY_CONFIG: Readonly<LifecycleAdvisoryConfig> = Object.freeze({
  exhaustionRepeatThreshold: 3,
  movedOnTurnThreshold: 4,
  ignoredBySideTurnThreshold: 3,
  ignoredByBothTurnThreshold: 6,
  branchRecommendedRepeatThreshold: 2,
});

// ── Plain-language helper ─────────────────────────────────────

/**
 * Direct typed lookup for the 18 lifecycle codes. Returns the plain-language
 * label from `PLAIN_LANGUAGE_COPY` — the single source of plain-language
 * truth in the app.
 */
export function getPointLifecyclePlainLabel(state: PointLifecycleState): string {
  const copy = PLAIN_LANGUAGE_COPY as unknown as Record<string, string>;
  const value = copy[state];
  return typeof value === 'string' ? value : state;
}

/** Forbidden tokens scanned by ban-list tests. NOT a content filter. */
export function _forbiddenLifecycleTokens(): string[] {
  return [
    // Verdict tokens
    'winner', 'loser', 'correct', 'incorrect', 'true', 'false',
    'liar', 'dishonest', 'bad faith', 'manipulative',
    'extremist', 'propagandist', 'troll', 'bot', 'astroturfer',
    'verdict', 'proof', 'proven', 'disproven', 'lost', 'defeated', 'won',
    // Amplification tokens
    'likes', 'retweets', 'shares', 'views', 'followers', 'verified',
    'engagement', 'amplification', 'trending', 'virality', 'popular', 'viral',
    // Block / prevent tokens (advisories must never block)
    'block', 'prevent', 'reject', 'forbid', 'disallow', 'denied',
  ];
}

// ── Constants for derivation ──────────────────────────────────

/** Side label values produced by the surface model's `pickSideLabel`. */
const SIDE_LABEL_AFFIRMATIVE = 'Aff';
const SIDE_LABEL_NEGATIVE = 'Neg';

/** EV-001 source-chain status severity (mirrors evidenceModel internal). */
const STATUS_SEVERITY: Readonly<Record<SourceChainStatus, number>> = Object.freeze({
  primary_present: 0,
  source_and_quote: 1,
  source_no_quote: 2,
  unverified: 3,
  no_source: 4,
  broken: 5,
});

/** Qualifier codes that mark explicit synthesis shape. */
const SYNTHESIS_QUALIFIER_CODES: ReadonlyArray<string> = Object.freeze([
  'synthesize_agreement',
  'synthesize_open_question',
]);

/** Argument types that count as confirmation moves. */
const CONFIRMATION_TYPES: ReadonlyArray<string> = Object.freeze([
  'confirmation',
]);

/** Codes the source-chain status reads as "has a primary source". */
const SOURCED_STATUSES: ReadonlyArray<SourceChainStatus> = Object.freeze([
  'source_and_quote',
  'primary_present',
]);

// ── Helpers ───────────────────────────────────────────────────

function sideOfNode(node: ArgumentTimelineMapNode): 'affirmative' | 'negative' | 'observer' | 'unknown' {
  if (node.sideLabel === SIDE_LABEL_AFFIRMATIVE) return 'affirmative';
  if (node.sideLabel === SIDE_LABEL_NEGATIVE) return 'negative';
  if (node.sideLabel === 'Obs' || node.sideLabel === 'Mod') return 'observer';
  return 'unknown';
}

function getFlagCodes(
  messageId: string,
  flagCodesByMessageId: ReadonlyMap<string, ReadonlyArray<string>>,
): ReadonlyArray<string> {
  return flagCodesByMessageId.get(messageId) || [];
}

function hasArchivedFlag(flagCodes: ReadonlyArray<string>): boolean {
  for (const code of flagCodes) {
    const norm = String(code || '').toLowerCase();
    if (norm === 'argument_resolved') return true;
    if (norm === 'archived_by_admin') return true;
  }
  return false;
}

function isSynthesisMove(node: ArgumentTimelineMapNode): boolean {
  const t = String(node.kindLabel || '').toLowerCase();
  if (t === 'synthesis') return true;
  for (const code of SYNTHESIS_QUALIFIER_CODES) {
    if (nodeHasQualifierCode(node, code)) return true;
  }
  return false;
}

function isBroadConcession(node: ArgumentTimelineMapNode): boolean {
  if (nodeHasQualifierCode(node, 'concede_broad_point')) return true;
  // concession argument type + no narrow lexeme/qualifier → broad.
  const t = String(node.kindLabel || '').toLowerCase();
  if (t === 'concession') {
    const hasNarrow = nodeHasQualifierCode(node, 'concede_small_point')
      || nodeHasQualifierCode(node, 'narrow_scope');
    return !hasNarrow;
  }
  return false;
}

function isNarrowConcession(node: ArgumentTimelineMapNode): boolean {
  if (nodeHasQualifierCode(node, 'concede_small_point')) return true;
  if (nodeHasQualifierCode(node, 'narrow_scope')) return true;
  const t = String(node.kindLabel || '').toLowerCase();
  if (t === 'concession') {
    if (nodeHasQualifierCode(node, 'concede_broad_point')) return false;
    return false; // default broad
  }
  return false;
}

function isConfirmationMove(node: ArgumentTimelineMapNode): boolean {
  const t = String(node.kindLabel || '').toLowerCase();
  if (CONFIRMATION_TYPES.includes(t)) return true;
  if (nodeHasQualifierCode(node, 'pure_accept') && !node.isRoot) return true;
  return false;
}

function isClarificationRequest(node: ArgumentTimelineMapNode): boolean {
  const t = String(node.kindLabel || '').toLowerCase();
  return t === 'clarification' || t === 'clarification_request';
}

function isAskSource(node: ArgumentTimelineMapNode): boolean {
  if (!isClarificationRequest(node)) return false;
  if (nodeHasQualifierCode(node, 'ask_receipts')) return true;
  if (nodeHasQualifierCode(node, 'source_request')) return true;
  return false;
}

function isAskQuote(node: ArgumentTimelineMapNode): boolean {
  if (!isClarificationRequest(node)) return false;
  if (nodeHasQualifierCode(node, 'quote_exact_bit')) return true;
  if (nodeHasQualifierCode(node, 'quote_request')) return true;
  return false;
}

function isRebuttalMove(node: ArgumentTimelineMapNode): boolean {
  const t = String(node.kindLabel || '').toLowerCase();
  return t === 'rebuttal' || t === 'counter-rebuttal' || t === 'counter_rebuttal';
}

function isSourcedMove(
  node: ArgumentTimelineMapNode,
  artifactStatus: SourceChainStatus | null,
): boolean {
  if (artifactStatus === null) return false;
  return SOURCED_STATUSES.includes(artifactStatus);
}

function worstEvidenceStatusFor(
  members: ReadonlyArray<ArgumentTimelineMapNode>,
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>,
): SourceChainStatus {
  let worst: SourceChainStatus = 'no_source';
  let worstSeverity = STATUS_SEVERITY.no_source;
  let anyArtifact = false;
  for (const m of members) {
    const s = artifactStatusByMessageId.get(m.messageId);
    if (!s) continue;
    anyArtifact = true;
    const sev = STATUS_SEVERITY[s];
    if (sev > worstSeverity) {
      worst = s;
      worstSeverity = sev;
    }
  }
  if (!anyArtifact) return 'no_source';
  return worst;
}

// ── Per-message classifier (Pass 1) ───────────────────────────

export interface DerivePointLifecycleSnapshotInput {
  node: ArgumentTimelineMapNode;
  parentNode: ArgumentTimelineMapNode | null;
  clusterId: string;
  /** Cluster's current state (computed by the cluster summary in a separate
   *  pass). */
  clusterState: PointLifecycleState;
  /** EV-001 contract status for this message's artifacts. `null` when no
   *  artifacts are attached. */
  artifactStatus: SourceChainStatus | null;
  /** Other messages in the cluster (chronological order). */
  clusterMembers: ReadonlyArray<ArgumentTimelineMapNode>;
  /** Optional flag codes for this message. */
  flagCodes?: ReadonlyArray<string>;
}

/**
 * Returns the per-message contribution. Pure. Deterministic.
 *
 * Reads ONLY the inputs above. Never reads `standingBand`, `toneBand`,
 * `temperatureBand`, `topicScore`, or any AI annotation. Never re-derives
 * `MessageCategory`.
 */
export function derivePointLifecycleSnapshot(
  input: DerivePointLifecycleSnapshotInput,
): PointLifecycleSnapshot {
  const { node, clusterId, clusterState, artifactStatus, clusterMembers } = input;
  const flagCodes = input.flagCodes || [];
  const messageContribution = deriveMessageContribution(
    node,
    artifactStatus,
    clusterMembers,
    flagCodes,
  );
  const axis = deriveAxis(node);
  const opensRequest = messageContribution === 'source_requested'
    || messageContribution === 'quote_requested';
  const resolvesRequest = messageContribution === 'sourced'
    && clusterMembersHaveOpenRequestBefore(node, clusterMembers);
  const isConcessionShape = messageContribution === 'conceded'
    || messageContribution === 'narrowed';
  const isSynthesisShape = messageContribution === 'synthesis_ready';

  return {
    messageId: node.messageId,
    clusterId,
    clusterState,
    messageContribution,
    axis,
    opensRequest,
    resolvesRequest,
    isConcessionShape,
    isSynthesisShape,
    plainLabel: getPointLifecyclePlainLabel(clusterState),
  };
}

function clusterMembersHaveOpenRequestBefore(
  node: ArgumentTimelineMapNode,
  members: ReadonlyArray<ArgumentTimelineMapNode>,
): boolean {
  for (const m of members) {
    if (m.messageId === node.messageId) continue;
    if (m.ordinal >= node.ordinal) continue;
    if (isAskSource(m) || isAskQuote(m)) return true;
  }
  return false;
}

/**
 * Decide one `PointLifecycleState` value for a single message based on its
 * shape. Per-message classifier rules per design §"Per-message contribution".
 */
function deriveMessageContribution(
  node: ArgumentTimelineMapNode,
  artifactStatus: SourceChainStatus | null,
  clusterMembers: ReadonlyArray<ArgumentTimelineMapNode>,
  flagCodes: ReadonlyArray<string>,
): PointLifecycleState {
  // Rule 1 — synthesis-shape move
  if (isSynthesisMove(node)) return 'synthesis_ready';

  // Rule 2 — admin-set resolution / archive
  if (hasArchivedFlag(flagCodes)) return 'archived_or_resolved';

  // Rule 3 — broad concession
  if (isBroadConcession(node)) return 'conceded';

  // Rule 4 — narrow concession
  if (isNarrowConcession(node)) return 'narrowed';

  // Rule 5 — confirmation
  if (isConfirmationMove(node)) return 'confirmed';

  // Rule 6 — sourced (evidence anchored on this move)
  if (isSourcedMove(node, artifactStatus)) return 'sourced';

  // Rule 7 — source requested (open clarification request for a source)
  if (isAskSource(node)) return 'source_requested';

  // Rule 8 — quote requested
  if (isAskQuote(node)) return 'quote_requested';

  // Rule 9 — clarified (other clarification request shape)
  if (isClarificationRequest(node)) return 'clarified';
  if (nodeHasQualifierCode(node, 'define_term')) return 'clarified';

  // Rule 10/11 — rebuttal / counter-rebuttal
  if (isRebuttalMove(node)) {
    const axis = deriveAxis(node) || 'unaxed';
    const nodeById = new Map<string, ArgumentTimelineMapNode>();
    for (const m of clusterMembers) nodeById.set(m.messageId, m);
    const ancestor = findSameAxisAncestor(node, axis, clusterMembers, nodeById);
    if (ancestor !== null) return 'rebutted';
    return 'answered';
  }

  // Rule 13/14 — root with no replies / cluster root with no descendants
  if (node.isRoot && node.replyCount === 0) return 'open';
  if (node.messageId === node.branchRootMessageId && node.descendantCount === 0) {
    return 'open';
  }

  // Rule 12 — any other reply (claim / support / evidence-without-source / thesis)
  return 'answered';
}

// ── Per-cluster classifier (Pass 2) ───────────────────────────

export interface DeriveClusterSummaryInput {
  clusterId: string;
  rootMessageId: string;
  members: ReadonlyArray<ArgumentTimelineMapNode>;
  /** All edges in the cluster (subset of the timeline map's edges). */
  edges: ReadonlyArray<ArgumentTimelineMapEdge>;
  /** Frozen map keyed by messageId — EV-001 contract status for each
   *  cluster member's attached artifacts. */
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>;
  /** Frozen map keyed by messageId — `flagCodes` upstream. */
  flagCodesByMessageId: ReadonlyMap<string, ReadonlyArray<string>>;
  /** Map of side → ordered list of room-wide message ids that side has
   *  posted (for advisory turn counts). */
  sideTurnSequence: ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>;
  /** Advisory thresholds. */
  advisoryConfig: LifecycleAdvisoryConfig;
}

/**
 * Compose per-message contributions into one cluster summary. Pure.
 * Reads cluster members (chronological), edges, EV-001 contract status,
 * flag codes, side turn sequence, advisory thresholds.
 */
export function deriveClusterLifecycleSummary(
  input: DeriveClusterSummaryInput,
): PointLifecycleClusterSummary {
  const {
    clusterId,
    rootMessageId,
    members,
    artifactStatusByMessageId,
    flagCodesByMessageId,
    sideTurnSequence,
    advisoryConfig,
  } = input;

  // Member contributions (chronological).
  const sortedMembers = members.slice().sort((a, b) => a.ordinal - b.ordinal);
  const contributions: PointLifecycleState[] = sortedMembers.map((m) =>
    deriveMessageContribution(
      m,
      artifactStatusByMessageId.get(m.messageId) ?? null,
      sortedMembers,
      getFlagCodes(m.messageId, flagCodesByMessageId),
    ),
  );

  // Aggregate observable signals.
  let affirmativeMoveCount = 0;
  let negativeMoveCount = 0;
  let observerMoveCount = 0;
  let lastAxis: PointLifecycleAxis | null = null;
  let hasConcessionOrSynthesisMove = false;
  for (const m of sortedMembers) {
    const side = sideOfNode(m);
    if (side === 'affirmative') affirmativeMoveCount += 1;
    else if (side === 'negative') negativeMoveCount += 1;
    else if (side === 'observer') observerMoveCount += 1;
    const a = deriveAxis(m);
    if (a) lastAxis = a;
    if (
      isSynthesisMove(m)
      || isBroadConcession(m)
      || isNarrowConcession(m)
    ) {
      hasConcessionOrSynthesisMove = true;
    }
  }

  const worstEvidenceStatus = worstEvidenceStatusFor(sortedMembers, artifactStatusByMessageId);

  // Track open request windows (closed by a sourced answer afterward).
  const hasOpenSourceOrQuoteRequest = clusterHasOpenSourceOrQuoteRequest(
    sortedMembers,
    artifactStatusByMessageId,
  );

  const state = composeClusterState(
    sortedMembers,
    contributions,
    artifactStatusByMessageId,
    flagCodesByMessageId,
    sideTurnSequence,
    advisoryConfig,
    hasOpenSourceOrQuoteRequest,
  );

  return {
    clusterId,
    rootMessageId,
    state,
    plainLabel: getPointLifecyclePlainLabel(state),
    messageIds: Object.freeze(sortedMembers.map((m) => m.messageId)),
    memberCount: sortedMembers.length,
    affirmativeMoveCount,
    negativeMoveCount,
    observerMoveCount,
    hasOpenSourceOrQuoteRequest,
    hasConcessionOrSynthesisMove,
    worstEvidenceStatus,
    primaryAxis: lastAxis,
    isAdvisory: isAdvisoryState(state),
  };
}

function isAdvisoryState(state: PointLifecycleState): boolean {
  return state === 'exhausted'
    || state === 'moved_on_by_affirmative'
    || state === 'moved_on_by_negative'
    || state === 'ignored_by_affirmative'
    || state === 'ignored_by_negative'
    || state === 'ignored_by_both'
    || state === 'branch_recommended';
}

function clusterHasOpenSourceOrQuoteRequest(
  sortedMembers: ReadonlyArray<ArgumentTimelineMapNode>,
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>,
): boolean {
  // A request is "open" when an ask-source / ask-quote move exists AND no
  // later same-axis-or-parent sourced move closes it.
  let openRequestAxis: PointLifecycleAxis | null = null;
  let openRequestOrdinal = -1;
  let openRequestParentId: string | null = null;
  let openRequestAskerId: string | null = null;
  let foundOpen = false;
  for (const m of sortedMembers) {
    if (isAskSource(m) || isAskQuote(m)) {
      openRequestAxis = deriveAxis(m) || (isAskSource(m) ? 'source' : 'quote');
      openRequestOrdinal = m.ordinal;
      openRequestParentId = m.parentId;
      openRequestAskerId = m.messageId;
      foundOpen = true;
      continue;
    }
    if (foundOpen) {
      const status = artifactStatusByMessageId.get(m.messageId) ?? null;
      if (isSourcedMove(m, status)) {
        const sameParent = openRequestParentId !== null && m.parentId === openRequestParentId;
        const repliesToAsker = openRequestAskerId !== null && m.parentId === openRequestAskerId;
        const memberAxis = deriveAxis(m);
        const sameAxis = openRequestAxis !== null && memberAxis === openRequestAxis;
        if (sameParent || repliesToAsker || sameAxis) {
          foundOpen = false;
          openRequestAxis = null;
          openRequestOrdinal = -1;
          openRequestParentId = null;
          openRequestAskerId = null;
        }
      }
    }
  }
  return foundOpen && openRequestOrdinal >= 0;
}

function lastSourceOrQuoteRequestState(
  sortedMembers: ReadonlyArray<ArgumentTimelineMapNode>,
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>,
): 'source_requested' | 'quote_requested' | null {
  // Find the chronologically-last unanswered ask. quote_requested wins
  // tie-break per design (more specific).
  let latest: { state: 'source_requested' | 'quote_requested'; ordinal: number } | null = null;
  // We need to re-scan with state tracking: a request is open if no later
  // sourced move closes it. A close happens when:
  //   (a) the sourced move shares the asker's parent (same target), OR
  //   (b) the sourced move replies to the asker itself, OR
  //   (c) the sourced move shares the same axis as the request.
  for (let i = 0; i < sortedMembers.length; i++) {
    const m = sortedMembers[i];
    const isS = isAskSource(m);
    const isQ = isAskQuote(m);
    if (!isS && !isQ) continue;
    const reqAxis = deriveAxis(m) || (isS ? 'source' : 'quote');
    const reqParent = m.parentId;
    const reqId = m.messageId;
    let closed = false;
    for (let j = i + 1; j < sortedMembers.length; j++) {
      const after = sortedMembers[j];
      const status = artifactStatusByMessageId.get(after.messageId) ?? null;
      if (!isSourcedMove(after, status)) continue;
      const sameParent = reqParent !== null && after.parentId === reqParent;
      const repliesToAsker = after.parentId === reqId;
      const afterAxis = deriveAxis(after);
      const sameAxis = afterAxis === reqAxis;
      // Source-axis ask closed by any sourced evidence move under the
      // same parent or replying to the asker.
      if (sameParent || repliesToAsker || sameAxis) {
        closed = true;
        break;
      }
    }
    if (!closed) {
      const state: 'source_requested' | 'quote_requested' = isQ ? 'quote_requested' : 'source_requested';
      if (!latest || m.ordinal > latest.ordinal
        || (m.ordinal === latest.ordinal && state === 'quote_requested')) {
        latest = { state, ordinal: m.ordinal };
      }
      // Prefer quote_requested when an open quote-request exists, per design.
      if (isQ) latest = { state: 'quote_requested', ordinal: m.ordinal };
    }
  }
  return latest ? latest.state : null;
}

function composeClusterState(
  sortedMembers: ReadonlyArray<ArgumentTimelineMapNode>,
  contributions: ReadonlyArray<PointLifecycleState>,
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>,
  flagCodesByMessageId: ReadonlyMap<string, ReadonlyArray<string>>,
  sideTurnSequence: ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>,
  advisoryConfig: LifecycleAdvisoryConfig,
  hasOpenSourceOrQuoteRequest: boolean,
): PointLifecycleState {
  if (sortedMembers.length === 0) return 'open';

  // Rule 1 — Resolution dominance.
  for (const c of contributions) {
    if (c === 'archived_or_resolved') return 'archived_or_resolved';
  }

  const lastContribution = contributions[contributions.length - 1];

  // Rule 2 — Synthesis dominance.
  const hasSynthesis = contributions.includes('synthesis_ready');
  if (hasSynthesis) {
    // Must have NO open request and NO rebuttal AFTER the latest synthesis.
    let latestSynthesisOrdinal = -1;
    for (let i = 0; i < contributions.length; i++) {
      if (contributions[i] === 'synthesis_ready') {
        latestSynthesisOrdinal = sortedMembers[i].ordinal;
      }
    }
    let rebutAfter = false;
    for (let i = 0; i < contributions.length; i++) {
      if (
        contributions[i] === 'rebutted'
        && sortedMembers[i].ordinal > latestSynthesisOrdinal
      ) {
        rebutAfter = true;
        break;
      }
    }
    if (!hasOpenSourceOrQuoteRequest && !rebutAfter) return 'synthesis_ready';
  }

  // Rule 3 — Concession dominance (with caveat — last-wins, rebut-after invalidates).
  if (lastContribution === 'conceded') {
    // Check no later same-axis rebut exists (defensive — it's already
    // the last contribution, so there isn't anything later by definition).
    return 'conceded';
  }
  if (lastContribution === 'narrowed') {
    return 'narrowed';
  }

  // Rule 4 — Confirmed dominance.
  if (lastContribution === 'confirmed') {
    return 'confirmed';
  }

  // Rule 5 — Open request dominance, modulated by advisory pass (ignored_*).
  // Per design, advisories ARE the more specific signal once enough turns
  // pass with the request unanswered. We check the ignored_* advisories
  // first; if any fires, it wins; otherwise the bare open-request state
  // applies.
  const openReqState = lastSourceOrQuoteRequestState(sortedMembers, artifactStatusByMessageId);
  if (openReqState) {
    if (hasOpenSourceOrQuoteRequest) {
      const ignoredBoth = isIgnoredByBoth(
        sortedMembers,
        sideTurnSequence,
        advisoryConfig.ignoredByBothTurnThreshold,
      );
      if (ignoredBoth) return 'ignored_by_both';
      const ignoredSide = isIgnoredBySide(
        sortedMembers,
        sideTurnSequence,
        advisoryConfig.ignoredBySideTurnThreshold,
      );
      if (ignoredSide === 'affirmative') return 'ignored_by_affirmative';
      if (ignoredSide === 'negative') return 'ignored_by_negative';
    }
    return openReqState;
  }

  // Rule 6 — Sourced dominance (no open request).
  if (lastContribution === 'sourced') return 'sourced';

  // Rule 7 — Pressure dominance.
  const hasRebut = contributions.includes('rebutted');
  if (hasRebut) {
    // Check no later concession / synthesis / sourced closes it.
    let lastRebutOrdinal = -1;
    for (let i = 0; i < contributions.length; i++) {
      if (contributions[i] === 'rebutted') {
        lastRebutOrdinal = sortedMembers[i].ordinal;
      }
    }
    let closedAfter = false;
    for (let i = 0; i < contributions.length; i++) {
      const c = contributions[i];
      if (sortedMembers[i].ordinal <= lastRebutOrdinal) continue;
      if (c === 'conceded' || c === 'narrowed' || c === 'synthesis_ready' || c === 'sourced') {
        closedAfter = true;
        break;
      }
    }
    if (!closedAfter) {
      // Rule 8a — Exhaustion check (advisory).
      const exhaustion = computeExhaustionState(
        sortedMembers,
        artifactStatusByMessageId,
        advisoryConfig,
      );
      if (exhaustion) return exhaustion;
      return 'rebutted';
    }
  }

  // Rule 8b — Branch recommended (advisory).
  const offAxisCount = countOffAxisPressure(sortedMembers);
  if (offAxisCount >= advisoryConfig.branchRecommendedRepeatThreshold
    && advisoryConfig.branchRecommendedRepeatThreshold > 0) {
    return 'branch_recommended';
  }
  if (advisoryConfig.branchRecommendedRepeatThreshold === 0 && offAxisCount > 0) {
    return 'branch_recommended';
  }

  // Rule 8c — Ignored by both (advisory).
  if (hasOpenSourceOrQuoteRequest) {
    const ignoredBoth = isIgnoredByBoth(
      sortedMembers,
      sideTurnSequence,
      advisoryConfig.ignoredByBothTurnThreshold,
    );
    if (ignoredBoth) return 'ignored_by_both';

    // Rule 8d — Ignored by one side (advisory).
    const ignoredSide = isIgnoredBySide(
      sortedMembers,
      sideTurnSequence,
      advisoryConfig.ignoredBySideTurnThreshold,
    );
    if (ignoredSide === 'affirmative') return 'ignored_by_affirmative';
    if (ignoredSide === 'negative') return 'ignored_by_negative';
  }

  // Rule 8e — Moved on (advisory).
  const movedOn = isMovedOn(
    sortedMembers,
    sideTurnSequence,
    advisoryConfig.movedOnTurnThreshold,
    hasOpenSourceOrQuoteRequest,
  );
  if (movedOn === 'affirmative') return 'moved_on_by_affirmative';
  if (movedOn === 'negative') return 'moved_on_by_negative';

  // Rule 9 — Open default.
  if (sortedMembers.length === 1) {
    const root = sortedMembers[0];
    if (root.replyCount === 0 && root.descendantCount === 0) return 'open';
  }
  if (contributions.includes('clarified')) {
    // Only clarification activity, no other axis pressure → clarified.
    const onlyClarifiedOrAnswered = contributions.every(
      (c) => c === 'clarified' || c === 'answered' || c === 'open',
    );
    if (onlyClarifiedOrAnswered) return 'clarified';
  }

  return 'answered';
}

function computeExhaustionState(
  sortedMembers: ReadonlyArray<ArgumentTimelineMapNode>,
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>,
  advisoryConfig: LifecycleAdvisoryConfig,
): PointLifecycleState | null {
  // For each axis, count same-axis pressure moves that add no new info.
  const axisCounts = new Map<PointLifecycleAxis, number>();
  for (const m of sortedMembers) {
    if (!isRebuttalMove(m)) continue;
    const axis = deriveAxis(m);
    if (!axis || axis === 'unaxed') continue;
    const status = artifactStatusByMessageId.get(m.messageId) ?? null;
    if (hasAdditiveAxisInformation(m, status)) continue;
    axisCounts.set(axis, (axisCounts.get(axis) || 0) + 1);
  }
  const threshold = advisoryConfig.exhaustionRepeatThreshold;
  if (threshold <= 0) {
    // Defensive: threshold of 0 fires when any non-additive same-axis
    // pressure exists.
    for (const v of axisCounts.values()) {
      if (v >= 1) return 'exhausted';
    }
    return null;
  }
  for (const v of axisCounts.values()) {
    if (v >= threshold) return 'exhausted';
  }
  // Fall back: also try non-axed same-axis pressure if we couldn't classify.
  const nonAdditiveTotal = countSameAxisPressure(sortedMembers, 'unaxed' as PointLifecycleAxis);
  if (threshold > 0 && nonAdditiveTotal >= threshold) {
    // Only treat as exhausted when ALL same-axis pressure shares the same
    // axis — `unaxed` accumulation isn't the same as a single axis being
    // repeated; do NOT promote here. This branch exists for defensive
    // coverage only.
  }
  return null;
}

function isIgnoredByBoth(
  sortedMembers: ReadonlyArray<ArgumentTimelineMapNode>,
  sideTurnSequence: ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>,
  threshold: number,
): boolean {
  if (threshold <= 0) return true;
  const affTurns = turnsSinceSideEngagedCluster('affirmative', sortedMembers, sideTurnSequence);
  const negTurns = turnsSinceSideEngagedCluster('negative', sortedMembers, sideTurnSequence);
  return affTurns >= threshold && negTurns >= threshold;
}

function isIgnoredBySide(
  sortedMembers: ReadonlyArray<ArgumentTimelineMapNode>,
  sideTurnSequence: ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>,
  threshold: number,
): 'affirmative' | 'negative' | null {
  if (threshold < 0) return null;
  // The "ignored" side is the requestee — the side that DID NOT post the
  // request. We approximate by finding the side of the last open ask-shape
  // move; the OTHER side is the requestee.
  let lastRequestSide: 'affirmative' | 'negative' | 'observer' | 'unknown' | null = null;
  for (const m of sortedMembers) {
    if (isAskSource(m) || isAskQuote(m)) {
      lastRequestSide = sideOfNode(m);
    }
  }
  if (!lastRequestSide) return null;
  const requestee: 'affirmative' | 'negative' | null =
    lastRequestSide === 'affirmative' ? 'negative'
    : lastRequestSide === 'negative' ? 'affirmative'
    : null;
  if (!requestee) return null;
  const turns = turnsSinceSideEngagedCluster(requestee, sortedMembers, sideTurnSequence);
  if (threshold === 0) return requestee;
  return turns >= threshold ? requestee : null;
}

function isMovedOn(
  sortedMembers: ReadonlyArray<ArgumentTimelineMapNode>,
  sideTurnSequence: ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>,
  threshold: number,
  hasOpenRequest: boolean,
): 'affirmative' | 'negative' | null {
  if (threshold < 0) return null;
  // A side has not posted to this cluster in `threshold` of its OWN
  // subsequent turns AND there is no open request directed at them.
  for (const side of ['affirmative', 'negative'] as const) {
    if (hasOpenRequest) {
      // If there's an open request directed at this side, "moved on" does
      // not fire (the "ignored" advisory may apply instead).
      // Approximate: a request from the other side is "directed at" this side.
      const otherSidePostedRequest = sortedMembers.some(
        (m) => (isAskSource(m) || isAskQuote(m)) && sideOfNode(m) !== side,
      );
      if (otherSidePostedRequest) continue;
    }
    const turns = turnsSinceSideEngagedCluster(side, sortedMembers, sideTurnSequence);
    if (threshold === 0 && turns >= 0) return side;
    if (turns >= threshold) {
      const sideHasEverPosted = sortedMembers.some((m) => sideOfNode(m) === side);
      if (sideHasEverPosted) return side;
    }
  }
  return null;
}

// ── Tree-level entry point ─────────────────────────────────────

export interface BuildPointLifecycleMapInput {
  /** Pass the already-built timeline map (no recomputation). */
  timelineMap: ArgumentTimelineMapModel;
  /** Frozen map keyed by argumentId → artifacts. */
  artifactsByMessageId: ReadonlyMap<string, ReadonlyArray<EvidenceArtifact>>;
  /** Optional `flagCodes` lookup. Defaults to empty. */
  flagCodesByMessageId?: ReadonlyMap<string, ReadonlyArray<string>>;
  /** Optional advisory threshold overrides. Defaults to
   *  `DEFAULT_LIFECYCLE_ADVISORY_CONFIG`. */
  advisoryConfig?: LifecycleAdvisoryConfig;
}

/**
 * Builds the per-tree lifecycle map in three passes:
 *   Pass 1 — group nodes by `branchRootMessageId` into clusters.
 *   Pass 2 — for each cluster, compute the cluster summary.
 *   Pass 3 — for each non-deleted message, compute the snapshot.
 *
 * Pure. Deterministic. O(n + n × depth_avg).
 */
export function buildPointLifecycleMap(
  input: BuildPointLifecycleMapInput,
): PointLifecycleMap {
  const { timelineMap, artifactsByMessageId } = input;
  const flagCodesByMessageId = input.flagCodesByMessageId || new Map<string, ReadonlyArray<string>>();
  const advisoryConfig = input.advisoryConfig || DEFAULT_LIFECYCLE_ADVISORY_CONFIG;

  if (timelineMap.nodes.length === 0) {
    return {
      byCluster: new Map(),
      byMessage: new Map(),
      clusterOrder: Object.freeze([]),
      cumulativeStateSequence: Object.freeze([]),
      inputHash: '',
    };
  }

  // Pass 0 — Build artifactStatusByMessageId from artifactsByMessageId.
  const artifactStatusByMessageId = new Map<string, SourceChainStatus>();
  for (const [mid, artifacts] of artifactsByMessageId.entries()) {
    if (!artifacts || artifacts.length === 0) continue;
    const summary = summarizeArtifactsForReceiptChip(artifacts);
    artifactStatusByMessageId.set(mid, summary.status);
  }

  // Pass 1 — group nodes by cluster.
  const clusters = groupNodesByCluster(timelineMap.nodes);
  const sideTurnSequence = buildSideTurnSequence(timelineMap.nodes);

  // Cluster order = chronological by root ordinal.
  const clusterEntries = Array.from(clusters.entries());
  clusterEntries.sort((a, b) => {
    const rootA = a[1].find((m) => m.messageId === a[0]);
    const rootB = b[1].find((m) => m.messageId === b[0]);
    const ordA = rootA ? rootA.ordinal : 0;
    const ordB = rootB ? rootB.ordinal : 0;
    return ordA - ordB;
  });

  const byCluster = new Map<string, PointLifecycleClusterSummary>();
  const byMessage = new Map<string, PointLifecycleSnapshot>();
  const clusterOrder: string[] = [];
  const cumulativeStateSequence: PointLifecycleState[] = [];

  const nodeById = new Map<string, ArgumentTimelineMapNode>();
  for (const n of timelineMap.nodes) nodeById.set(n.messageId, n);

  // Edge bucketing per cluster (so cluster summaries get only relevant edges).
  const edgesPerCluster = new Map<string, ArgumentTimelineMapEdge[]>();
  for (const edge of timelineMap.edges) {
    const toNode = nodeById.get(edge.toMessageId);
    if (!toNode) continue;
    const cid = toNode.branchRootMessageId;
    if (!edgesPerCluster.has(cid)) edgesPerCluster.set(cid, []);
    edgesPerCluster.get(cid)!.push(edge);
  }

  // Pass 2 — cluster summaries.
  for (const [clusterId, members] of clusterEntries) {
    const root = members.find((m) => m.messageId === clusterId) || members[0];
    const summary = deriveClusterLifecycleSummary({
      clusterId,
      rootMessageId: root.messageId,
      members,
      edges: edgesPerCluster.get(clusterId) || [],
      artifactStatusByMessageId,
      flagCodesByMessageId,
      sideTurnSequence,
      advisoryConfig,
    });
    byCluster.set(clusterId, summary);
    clusterOrder.push(clusterId);
    cumulativeStateSequence.push(summary.state);
  }

  // Pass 3 — per-message snapshots.
  for (const [clusterId, members] of clusterEntries) {
    const summary = byCluster.get(clusterId)!;
    const sortedMembers = members.slice().sort((a, b) => a.ordinal - b.ordinal);
    for (const m of sortedMembers) {
      const parentNode = m.parentId ? nodeById.get(m.parentId) || null : null;
      const snapshot = derivePointLifecycleSnapshot({
        node: m,
        parentNode,
        clusterId,
        clusterState: summary.state,
        artifactStatus: artifactStatusByMessageId.get(m.messageId) ?? null,
        clusterMembers: sortedMembers,
        flagCodes: getFlagCodes(m.messageId, flagCodesByMessageId),
      });
      byMessage.set(m.messageId, snapshot);
    }
  }

  // inputHash — stable hash of "what would change the result"
  const inputHash = computeInputHash(
    timelineMap,
    artifactsByMessageId,
    flagCodesByMessageId,
    advisoryConfig,
  );

  return {
    byCluster,
    byMessage,
    clusterOrder: Object.freeze(clusterOrder),
    cumulativeStateSequence: Object.freeze(cumulativeStateSequence),
    inputHash,
  };
}

function computeInputHash(
  timelineMap: ArgumentTimelineMapModel,
  artifactsByMessageId: ReadonlyMap<string, ReadonlyArray<EvidenceArtifact>>,
  flagCodesByMessageId: ReadonlyMap<string, ReadonlyArray<string>>,
  advisoryConfig: LifecycleAdvisoryConfig,
): string {
  const lastNode = timelineMap.nodes[timelineMap.nodes.length - 1];
  const lastId = lastNode ? lastNode.messageId : '';
  const lastCreated = lastNode ? lastNode.createdAt : '';
  const artifactsSig = `${artifactsByMessageId.size}`;
  const flagsSig = `${flagCodesByMessageId.size}`;
  const cfgSig = [
    advisoryConfig.exhaustionRepeatThreshold,
    advisoryConfig.movedOnTurnThreshold,
    advisoryConfig.ignoredBySideTurnThreshold,
    advisoryConfig.ignoredByBothTurnThreshold,
    advisoryConfig.branchRecommendedRepeatThreshold,
  ].join('|');
  return `n=${timelineMap.nodes.length}|last=${lastId}@${lastCreated}|a=${artifactsSig}|f=${flagsSig}|c=${cfgSig}`;
}
