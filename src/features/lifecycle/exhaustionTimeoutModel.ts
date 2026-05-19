/**
 * GAME-001 — Point exhaustion and timeout rules (sibling deriver).
 *
 * Pure-TS advisory deriver for the four exhaustion / timeout lifecycle
 * states (`exhausted`, `moved_on_by_<side>`, `ignored_by_<side>`,
 * `ignored_by_both`) plus the broader-shape `synthesis_ready` advisory.
 *
 * This module is a SIBLING to `pointLifecycleModel.composeClusterState`,
 * not a replacement. LIFE-001 remains the canonical state oracle for
 * `PointLifecycleClusterSummary.state`. GAME-001 exposes a parallel
 * advisory-only reader that callers (AN-003, SC-003 sidecar, ST-002 chip
 * stack) opt into when they want override thresholds + a broader
 * synthesis-ready signal.
 *
 * Doctrine pins (cdiscourse-doctrine + point-standing-economy +
 * evidence-doctrine + timeline-grammar):
 *   - An advisory is never a verdict, never a punishment, never a block.
 *     `blocksSubmit: false` and `appliesPointStandingPenalty: false` are
 *     compile-time-pinned literal `false` fields.
 *   - The deriver reads labels / helper lines from RULE-003's
 *     `LIFECYCLE_UX_MAP`. It NEVER authors a new plain-language string.
 *   - No heat / popularity / engagement input. The `ExhaustionTimeoutInput`
 *     shape has no `heatScore` / `recentActivityWeight` / `engagementVelocity`.
 *   - No AI inference. No `fetch`. No `@anthropic-ai/sdk`. No xAI client.
 *   - No `Date.now()`. No `Math.random()`. No module-level mutable state.
 *     The deriver is pure / total / deterministic.
 *   - No import from `src/lib/constitution/engine` — the sacred engine
 *     is untouched.
 *
 * Integration consumer rule (documented for SC-003 / ST-002 / AN-003 use):
 *
 *   displayState =
 *     GAME-001's advisory (when non-null AND upstream is in the
 *                          "permissive" set, i.e. not a concession-shape
 *                          final move)
 *     ELSE LIFE-001's clusterSummary.state
 */

import type { ArgumentTimelineMapNode } from '../arguments/argumentGameSurfaceModel';
import type { SourceChainStatus } from '../evidence/evidenceModel';
import {
  countSameAxisPressure,
  hasAdditiveAxisInformation,
  turnsSinceSideEngagedCluster,
  countOffAxisPressure,
} from './pointLifecycleAdvisoryInputs';
import { deriveAxis, nodeHasQualifierCode } from './pointLifecycleClusters';
import {
  DEFAULT_LIFECYCLE_ADVISORY_CONFIG,
  _forbiddenLifecycleTokens,
} from './pointLifecycleModel';
import type {
  PointLifecycleAxis,
  PointLifecycleClusterSummary,
  PointLifecycleState,
} from './pointLifecycleModel';
import { LIFECYCLE_UX_MAP } from '../rulesUx/lifecycleUxMap';

// ── Advisory-state vocabulary ─────────────────────────────────

/**
 * The narrow set of seven advisory states this deriver can produce.
 *
 * A strict subset of `PointLifecycleState`. `branch_recommended` is
 * intentionally NOT here — it remains LIFE-001's responsibility.
 */
export type ExhaustionTimeoutAdvisoryState =
  | 'synthesis_ready'
  | 'exhausted'
  | 'ignored_by_both'
  | 'ignored_by_affirmative'
  | 'ignored_by_negative'
  | 'moved_on_by_affirmative'
  | 'moved_on_by_negative';

/** Frozen list of the seven producible advisory states. Iteration order
 *  matches the priority cascade. Tests iterate this. */
export const ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES:
  ReadonlyArray<ExhaustionTimeoutAdvisoryState> = Object.freeze([
    'synthesis_ready',
    'exhausted',
    'ignored_by_both',
    'ignored_by_affirmative',
    'ignored_by_negative',
    'moved_on_by_affirmative',
    'moved_on_by_negative',
  ]);

// ── Threshold config ──────────────────────────────────────────

/**
 * Threshold overrides for the deriver. Defaults inherit from LIFE-001's
 * `DEFAULT_LIFECYCLE_ADVISORY_CONFIG` for the four shared thresholds plus
 * one new floor (`minClusterAgeForTimeoutAdvisory`) that LIFE-001 lacks.
 *
 * Doctrine: thresholds are advisory only. They never block posting,
 * never auto-archive, never auto-message a user.
 */
export interface ExhaustionTimeoutConfig {
  /** N — same-axis non-additive pressure required to fire `exhausted`. */
  exhaustionRepeatThreshold: number;
  /** M — turns of own-without-cluster required to fire
   *  `moved_on_by_<side>`. */
  movedOnTurnThreshold: number;
  /** K — turns since open request required to fire `ignored_by_<side>`. */
  ignoredBySideTurnThreshold: number;
  /** J — turns of both-side dormancy required to fire `ignored_by_both`. */
  ignoredByBothTurnThreshold: number;
  /** Minimum cluster age in room turns before any timeout advisory fires.
   *  Suppresses false-positives in nascent rooms. */
  minClusterAgeForTimeoutAdvisory: number;
}

/**
 * Defaults. The four shared thresholds mirror LIFE-001 exactly so the
 * two derivers agree out of the box. `minClusterAgeForTimeoutAdvisory`
 * is GAME-001-only.
 */
export const DEFAULT_EXHAUSTION_TIMEOUT_CONFIG: Readonly<ExhaustionTimeoutConfig> = Object.freeze({
  exhaustionRepeatThreshold: DEFAULT_LIFECYCLE_ADVISORY_CONFIG.exhaustionRepeatThreshold,
  movedOnTurnThreshold: DEFAULT_LIFECYCLE_ADVISORY_CONFIG.movedOnTurnThreshold,
  ignoredBySideTurnThreshold: DEFAULT_LIFECYCLE_ADVISORY_CONFIG.ignoredBySideTurnThreshold,
  ignoredByBothTurnThreshold: DEFAULT_LIFECYCLE_ADVISORY_CONFIG.ignoredByBothTurnThreshold,
  minClusterAgeForTimeoutAdvisory: 2,
});

// ── Deriver inputs ────────────────────────────────────────────

/**
 * Cluster-level inputs. Caller (room shell / AN-003 / sidecar adapter)
 * populates from existing LIFE-001 + META-001 fields.
 *
 * Strictly flat — no nested DAG, no walk. The deriver consumes
 * pre-computed booleans + counters so AN-003's threshold-sweep use case
 * runs at constant cost.
 */
export interface ExhaustionTimeoutInput {
  /** Cluster id (equals `branchRootMessageId` in the surface model). */
  clusterId: string;

  /**
   * The cluster's pre-existing LIFE-001 state, if known. Optional. When
   * passed, GAME-001 does NOT override these dominance categories:
   *   - 'archived_or_resolved' (admin-set terminal)
   *   - 'conceded' / 'narrowed' / 'confirmed' (concession-shape final move)
   *   - 'rebutted' (explicit pressure exists; advisory should not preempt)
   *   - 'synthesis_ready' (LIFE-001's stricter synthesis already fired)
   * If the upstream state is one of those, the deriver returns `null`.
   */
  upstreamClusterState?: PointLifecycleState | null;

  /**
   * Max same-axis pressure count across all rebuttal axes in this
   * cluster, counting only pressure moves that ADD NO new evidence /
   * scope / definition / mechanism. Caller computes via
   * `countMaxSameAxisNonAdditivePressure` (adapter helper).
   */
  maxSameAxisNonAdditivePressureCount: number;

  /** Turns since affirmative side last posted to this cluster. >= 0. */
  turnsSinceAffirmativeEngagedCluster: number;
  /** Turns since negative side last posted to this cluster. >= 0. */
  turnsSinceNegativeEngagedCluster: number;

  /**
   * True when at least one cluster member is a concession-shape move
   * OR an explicit narrowing contribution exists in the cluster.
   */
  hasConcessionOrNarrowing: boolean;

  /**
   * True when the cluster has any unresolved evidence debt (open
   * source/quote request, OR a claim-shape member with EV-001 worst
   * status of `no_source` / `broken`).
   */
  hasUnresolvedEvidenceDebt: boolean;

  /** True when an open source/quote request is directed AT affirmative. */
  affirmativeHasOpenRequestDirectedAtIt: boolean;
  /** True when an open source/quote request is directed AT negative. */
  negativeHasOpenRequestDirectedAtIt: boolean;

  /**
   * True when affirmative has ever posted at least one move in this
   * cluster historically. The `moved_on_by_<side>` advisory requires
   * the side to have engaged before; otherwise "moved on" doesn't make
   * sense.
   */
  affirmativeHasEverEngagedCluster: boolean;
  /** True when negative has ever posted at least one move in this cluster. */
  negativeHasEverEngagedCluster: boolean;

  /**
   * Count of off-axis pressure moves under the cluster
   * (`branch_this_off` / `tangent_or_joke` qualifiers). NOT used to
   * produce `branch_recommended` here — that remains LIFE-001's.
   * Tracked so consumers can break ties between `exhausted` and a
   * branch-recommended-shaped state upstream.
   */
  offAxisPressureCount: number;

  /**
   * The room's chronological move count at the moment of evaluation.
   * Used to derive `clusterAgeInRoomTurns`. Caller passes the integer;
   * no `Date.now` in the deriver.
   */
  roomMoveCountAtEvaluation: number;

  /**
   * The cluster root's `ordinal` (room-wide turn index when the root
   * was posted). >= 1 in well-formed input. Together with
   * `roomMoveCountAtEvaluation` defines cluster age.
   */
  clusterRootOrdinal: number;

  /** Optional override thresholds. When omitted, defaults apply. */
  config?: ExhaustionTimeoutConfig;
}

// ── Deriver output ────────────────────────────────────────────

/**
 * The advisory record. `state === null` is normal — most clusters in
 * most rooms produce it. UI consumers check `state !== null` before
 * rendering a chip.
 *
 * The two `false` literal fields are intentional compile-time pins:
 * the type contract NEVER promises a blocking or penalising advisory.
 */
export interface ExhaustionTimeoutAdvisory {
  /** The cluster being advised on. */
  clusterId: string;
  /** The advisory state, or `null` when no advisory fires. */
  state: ExhaustionTimeoutAdvisoryState | null;
  /** Plain-language label, READ from RULE-003's `LIFECYCLE_UX_MAP`.
   *  Empty string when `state === null`. */
  label: string;
  /** Plain-language helper line, READ from RULE-003's `LIFECYCLE_UX_MAP`.
   *  Empty when `state === null`. Always describes the cluster, never
   *  the user. */
  helperLine: string;
  /** The threshold rule that fired (debug only — never rendered).
   *  `null` when no advisory fires. */
  ruleFired: string | null;
  /** Whether the produced state is BLOCKING. Always `false`. Compile-time
   *  pinned via literal type. */
  blocksSubmit: false;
  /** Whether the produced state implies a point-standing penalty.
   *  Always `false`. Compile-time pinned via literal type. */
  appliesPointStandingPenalty: false;
}

// ── Internal helpers ──────────────────────────────────────────

/**
 * Upstream states that mark a cluster as "already classified by something
 * stronger than an advisory". When the caller passes one of these as
 * `upstreamClusterState`, the deriver returns `null`.
 */
const DEFERS_TO_UPSTREAM_STATES: ReadonlySet<PointLifecycleState> = new Set([
  'archived_or_resolved',
  'conceded',
  'narrowed',
  'confirmed',
  'rebutted',
  'synthesis_ready',
  'sourced',
]);

/** Compute cluster age in room turns. Clamped to >= 0 (defensive). */
function clusterAgeInRoomTurns(input: ExhaustionTimeoutInput): number {
  const age = input.roomMoveCountAtEvaluation - input.clusterRootOrdinal;
  if (!Number.isFinite(age) || age < 0) return 0;
  return age;
}

/** Build the populated advisory record from a state. */
function buildAdvisory(
  clusterId: string,
  state: ExhaustionTimeoutAdvisoryState,
  ruleFired: string,
): ExhaustionTimeoutAdvisory {
  const entry = LIFECYCLE_UX_MAP[state];
  return {
    clusterId,
    state,
    label: entry.label,
    helperLine: entry.helperLine,
    ruleFired,
    blocksSubmit: false,
    appliesPointStandingPenalty: false,
  };
}

/** Build the empty advisory record. */
function emptyAdvisory(clusterId: string): ExhaustionTimeoutAdvisory {
  return {
    clusterId,
    state: null,
    label: '',
    helperLine: '',
    ruleFired: null,
    blocksSubmit: false,
    appliesPointStandingPenalty: false,
  };
}

// ── Public deriver ────────────────────────────────────────────

/**
 * Pure / total / deterministic. Never throws. Never mutates input.
 *
 * Priority cascade (first match wins):
 *   1. synthesis_ready  — concession + no debt + permissive upstream + age >= floor
 *   2. exhausted        — same-axis pressure >= N + age >= floor
 *   3. ignored_by_both  — both sides dormant >= J + age >= floor
 *   4. ignored_by_<side> — open request directed at side + dormant >= K + age >= floor
 *   5. moved_on_by_<side> — dormant >= M + side has ever engaged + no open request + age >= floor
 *   6. otherwise → null
 */
export function deriveExhaustionTimeoutAdvisory(
  input: ExhaustionTimeoutInput,
): ExhaustionTimeoutAdvisory {
  const config = input.config || DEFAULT_EXHAUSTION_TIMEOUT_CONFIG;
  const { clusterId } = input;

  // Upstream-defers: a stronger state already classified this cluster.
  if (input.upstreamClusterState != null
    && DEFERS_TO_UPSTREAM_STATES.has(input.upstreamClusterState)) {
    return emptyAdvisory(clusterId);
  }

  const age = clusterAgeInRoomTurns(input);
  const ageMet = age >= config.minClusterAgeForTimeoutAdvisory;

  // 1. synthesis_ready — concession-or-narrowing + no unresolved evidence debt.
  if (ageMet
    && input.hasConcessionOrNarrowing
    && !input.hasUnresolvedEvidenceDebt) {
    return buildAdvisory(clusterId, 'synthesis_ready', 'synthesis.concessionAndNoDebt');
  }

  // 2. exhausted — repeated same-axis pressure adding no new information.
  // Treat negative threshold defensively as 0.
  const exhaustionThreshold = Math.max(0, config.exhaustionRepeatThreshold);
  if (ageMet
    && input.maxSameAxisNonAdditivePressureCount >= exhaustionThreshold
    && input.maxSameAxisNonAdditivePressureCount > 0) {
    return buildAdvisory(clusterId, 'exhausted', 'exhaustion.repeatThreshold');
  }

  // 3. ignored_by_both — both sides dormant past the both-side threshold.
  const ignoredBothThreshold = Math.max(0, config.ignoredByBothTurnThreshold);
  if (ageMet
    && input.turnsSinceAffirmativeEngagedCluster >= ignoredBothThreshold
    && input.turnsSinceNegativeEngagedCluster >= ignoredBothThreshold
    && (input.affirmativeHasOpenRequestDirectedAtIt
      || input.negativeHasOpenRequestDirectedAtIt)) {
    return buildAdvisory(clusterId, 'ignored_by_both', 'ignoredBoth.turnThreshold');
  }

  // 4. ignored_by_<side> — open request directed at side + side dormant >= K.
  const ignoredSideThreshold = Math.max(0, config.ignoredBySideTurnThreshold);
  const affQualifies = input.affirmativeHasOpenRequestDirectedAtIt
    && input.turnsSinceAffirmativeEngagedCluster >= ignoredSideThreshold
    && input.turnsSinceAffirmativeEngagedCluster > 0;
  const negQualifies = input.negativeHasOpenRequestDirectedAtIt
    && input.turnsSinceNegativeEngagedCluster >= ignoredSideThreshold
    && input.turnsSinceNegativeEngagedCluster > 0;
  if (ageMet && (affQualifies || negQualifies)) {
    if (affQualifies && negQualifies) {
      // Both qualify — return the side with HIGHER turn count; ties → negative.
      if (input.turnsSinceAffirmativeEngagedCluster
        > input.turnsSinceNegativeEngagedCluster) {
        return buildAdvisory(clusterId, 'ignored_by_affirmative', 'ignoredBySide.turnThreshold');
      }
      return buildAdvisory(clusterId, 'ignored_by_negative', 'ignoredBySide.turnThreshold');
    }
    if (affQualifies) {
      return buildAdvisory(clusterId, 'ignored_by_affirmative', 'ignoredBySide.turnThreshold');
    }
    return buildAdvisory(clusterId, 'ignored_by_negative', 'ignoredBySide.turnThreshold');
  }

  // 5. moved_on_by_<side> — dormant >= M + has ever engaged + no open request at side.
  const movedOnThreshold = Math.max(0, config.movedOnTurnThreshold);
  const affMovedOn = input.affirmativeHasEverEngagedCluster
    && !input.affirmativeHasOpenRequestDirectedAtIt
    && input.turnsSinceAffirmativeEngagedCluster >= movedOnThreshold
    && input.turnsSinceAffirmativeEngagedCluster > 0;
  const negMovedOn = input.negativeHasEverEngagedCluster
    && !input.negativeHasOpenRequestDirectedAtIt
    && input.turnsSinceNegativeEngagedCluster >= movedOnThreshold
    && input.turnsSinceNegativeEngagedCluster > 0;
  if (ageMet && (affMovedOn || negMovedOn)) {
    if (affMovedOn && negMovedOn) {
      // Both qualify — higher turn count wins; ties → negative.
      if (input.turnsSinceAffirmativeEngagedCluster
        > input.turnsSinceNegativeEngagedCluster) {
        return buildAdvisory(clusterId, 'moved_on_by_affirmative', 'movedOn.turnThreshold');
      }
      return buildAdvisory(clusterId, 'moved_on_by_negative', 'movedOn.turnThreshold');
    }
    if (affMovedOn) {
      return buildAdvisory(clusterId, 'moved_on_by_affirmative', 'movedOn.turnThreshold');
    }
    return buildAdvisory(clusterId, 'moved_on_by_negative', 'movedOn.turnThreshold');
  }

  // 6. No rule fires.
  return emptyAdvisory(clusterId);
}

// ── Adapter from LIFE-001 outputs ─────────────────────────────

/**
 * Convenience adapter input — bundles the LIFE-001 outputs the deriver
 * needs into one record. NOT auto-wired into LIFE-001's pipeline.
 */
export interface BuildExhaustionTimeoutInputFromLifecycleInput {
  /** The cluster's LIFE-001 summary. */
  clusterSummary: PointLifecycleClusterSummary;
  /** The cluster's member nodes (chronologically sorted). */
  clusterMembers: ReadonlyArray<ArgumentTimelineMapNode>;
  /** Per-side room-wide turn sequence (LIFE-001's
   *  `buildSideTurnSequence` output). */
  sideTurnSequence: ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>;
  /** EV-001 source-chain status keyed by message id. Members without an
   *  artifact are absent from the map. */
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>;
  /** The room's chronological move count at evaluation. */
  roomMoveCountAtEvaluation: number;
  /** The cluster root's ordinal in the room. */
  clusterRootOrdinal: number;
  /** Optional override thresholds. */
  config?: ExhaustionTimeoutConfig;
}

/** Compute max same-axis non-additive pressure across all axes. */
function countMaxSameAxisNonAdditivePressure(
  members: ReadonlyArray<ArgumentTimelineMapNode>,
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>,
): number {
  // Collect distinct axes seen on rebuttal-shaped members.
  const axesSeen = new Set<PointLifecycleAxis>();
  for (const m of members) {
    const t = String(m.kindLabel || '').toLowerCase();
    if (t === 'rebuttal' || t === 'counter-rebuttal' || t === 'counter_rebuttal') {
      const a = deriveAxis(m);
      if (a) axesSeen.add(a);
    }
  }
  if (axesSeen.size === 0) return 0;

  let maxCount = 0;
  for (const axis of axesSeen) {
    const total = countSameAxisPressure(members, axis);
    // Subtract additive moves on this axis.
    let additive = 0;
    for (const m of members) {
      const t = String(m.kindLabel || '').toLowerCase();
      if (t !== 'rebuttal' && t !== 'counter-rebuttal' && t !== 'counter_rebuttal') continue;
      if (deriveAxis(m) !== axis) continue;
      const status = artifactStatusByMessageId.get(m.messageId) ?? null;
      if (hasAdditiveAxisInformation(m, status)) additive += 1;
    }
    const nonAdditive = total - additive;
    if (nonAdditive > maxCount) maxCount = nonAdditive;
  }
  return maxCount;
}

/** Detect whether the cluster has a concession-shape or narrowing-shape move. */
function clusterHasConcessionOrNarrowing(
  members: ReadonlyArray<ArgumentTimelineMapNode>,
): boolean {
  for (const m of members) {
    const t = String(m.kindLabel || '').toLowerCase();
    if (t === 'concession') return true;
    if (nodeHasQualifierCode(m, 'concede_broad_point')) return true;
    if (nodeHasQualifierCode(m, 'concede_small_point')) return true;
    if (nodeHasQualifierCode(m, 'narrow_scope')) return true;
  }
  return false;
}

/**
 * Detect unresolved evidence debt. Two paths:
 *   - The cluster has an open source/quote request
 *     (summary.hasOpenSourceOrQuoteRequest), OR
 *   - At least one claim/support/rebuttal member has EV-001 worst-status
 *     of `no_source` / `broken`.
 */
function clusterHasUnresolvedEvidenceDebt(
  summary: PointLifecycleClusterSummary,
  members: ReadonlyArray<ArgumentTimelineMapNode>,
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>,
): boolean {
  if (summary.hasOpenSourceOrQuoteRequest) return true;
  for (const m of members) {
    const t = String(m.kindLabel || '').toLowerCase();
    // Skip clarification-shape moves — they don't carry evidence.
    if (t === 'clarification' || t === 'question' || t === 'concession'
      || t === 'synthesis') continue;
    const status = artifactStatusByMessageId.get(m.messageId);
    if (status === 'no_source' || status === 'broken') return true;
  }
  return false;
}

/**
 * Detect whether each side has ever engaged with the cluster (posted at
 * least one move in it historically).
 */
function sideHasEverEngagedCluster(
  side: 'affirmative' | 'negative',
  members: ReadonlyArray<ArgumentTimelineMapNode>,
): boolean {
  const sideLabel = side === 'affirmative' ? 'Aff' : 'Neg';
  for (const m of members) {
    if (m.sideLabel === sideLabel) return true;
  }
  return false;
}

/**
 * Detect whether an open source/quote request is directed AT a given side.
 *
 * Heuristic: walk the cluster chronologically; the LATEST member with a
 * `source_requested` / `quote_requested` qualifier code (or with
 * `quoteRequest` / `sourceRequest` shape qualifiers) targets the OTHER
 * side — the side being asked. The "asked side" is the side whose move
 * triggered the request (the parent's author side).
 *
 * Returns true when that asked side equals the side we're asking about
 * AND the request has not been resolved (the cluster summary still flags
 * `hasOpenSourceOrQuoteRequest`).
 */
function sideHasOpenRequestDirectedAtIt(
  side: 'affirmative' | 'negative',
  summary: PointLifecycleClusterSummary,
  members: ReadonlyArray<ArgumentTimelineMapNode>,
): boolean {
  if (!summary.hasOpenSourceOrQuoteRequest) return false;
  const sideLabel = side === 'affirmative' ? 'Aff' : 'Neg';
  // The request's TARGET is the side whose move is being asked about —
  // i.e. the parent of the request move. We find the chronologically
  // latest request and inspect its parent.
  const byId = new Map<string, ArgumentTimelineMapNode>();
  for (const m of members) byId.set(m.messageId, m);
  for (let i = members.length - 1; i >= 0; i -= 1) {
    const m = members[i];
    if (nodeHasQualifierCode(m, 'source_request')
      || nodeHasQualifierCode(m, 'quote_request')
      || nodeHasQualifierCode(m, 'request_quote')
      || nodeHasQualifierCode(m, 'request_source')) {
      // The request targets the side of the parent move.
      const parent = m.parentId ? byId.get(m.parentId) : null;
      if (parent && parent.sideLabel === sideLabel) return true;
      return false;
    }
  }
  return false;
}

/**
 * Adapter: build a fully-populated `ExhaustionTimeoutInput` from
 * LIFE-001's `PointLifecycleClusterSummary` + cluster members +
 * room-wide side turn sequence.
 *
 * Pure / total / deterministic. Never mutates its input.
 */
export function buildExhaustionTimeoutInputFromLifecycle(
  input: BuildExhaustionTimeoutInputFromLifecycleInput,
): ExhaustionTimeoutInput {
  const {
    clusterSummary,
    clusterMembers,
    sideTurnSequence,
    artifactStatusByMessageId,
    roomMoveCountAtEvaluation,
    clusterRootOrdinal,
    config,
  } = input;

  const turnsAff = turnsSinceSideEngagedCluster(
    'affirmative',
    clusterMembers,
    sideTurnSequence,
  );
  const turnsNeg = turnsSinceSideEngagedCluster(
    'negative',
    clusterMembers,
    sideTurnSequence,
  );

  return {
    clusterId: clusterSummary.clusterId,
    upstreamClusterState: clusterSummary.state,
    maxSameAxisNonAdditivePressureCount: countMaxSameAxisNonAdditivePressure(
      clusterMembers,
      artifactStatusByMessageId,
    ),
    turnsSinceAffirmativeEngagedCluster: turnsAff,
    turnsSinceNegativeEngagedCluster: turnsNeg,
    hasConcessionOrNarrowing: clusterHasConcessionOrNarrowing(clusterMembers),
    hasUnresolvedEvidenceDebt: clusterHasUnresolvedEvidenceDebt(
      clusterSummary,
      clusterMembers,
      artifactStatusByMessageId,
    ),
    affirmativeHasOpenRequestDirectedAtIt: sideHasOpenRequestDirectedAtIt(
      'affirmative',
      clusterSummary,
      clusterMembers,
    ),
    negativeHasOpenRequestDirectedAtIt: sideHasOpenRequestDirectedAtIt(
      'negative',
      clusterSummary,
      clusterMembers,
    ),
    affirmativeHasEverEngagedCluster: sideHasEverEngagedCluster('affirmative', clusterMembers),
    negativeHasEverEngagedCluster: sideHasEverEngagedCluster('negative', clusterMembers),
    offAxisPressureCount: countOffAxisPressure(clusterMembers),
    roomMoveCountAtEvaluation,
    clusterRootOrdinal,
    config,
  };
}

// ── Test-only forbidden tokens ────────────────────────────────

/**
 * Test-only: the verdict / popularity / amplification / personal-attack
 * token list scanned across every produced label + helperLine. Union of
 * LIFE-001's ban list plus the GAME-001-specific amplification guard.
 *
 * Not part of the runtime API — leading underscore is the convention
 * for "exported for tests only".
 */
export function _forbiddenExhaustionTimeoutTokens(): string[] {
  const base = _forbiddenLifecycleTokens();
  // GAME-001 extras: extra verdict-flavored adjacencies + person-attribution
  // verbs that the deriver's helper lines must never carry.
  const extras = [
    'punish', 'penalty', 'penalise', 'penalize',
    'condemn', 'accuse', 'accusation',
    'ignored you', 'they ignored', 'the user',
  ];
  return [...base, ...extras];
}
