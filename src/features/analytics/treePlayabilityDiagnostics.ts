/**
 * AN-003 — Tree playability diagnostics (pure TypeScript).
 *
 * Dev / debug-only deriver. Given a room's already-built lifecycle-mapped
 * argument tree, it answers three questions for an operator tuning
 * GAME-001's advisory thresholds: is this tree playable, where is it
 * stuck, and what advisory state dominates?
 *
 * NEVER:
 *   - calls AI (Anthropic, xAI, OpenAI, X)
 *   - calls Supabase / network
 *   - writes to the DB
 *   - reads heat / popularity / engagement / standingBand / toneBand /
 *     temperatureBand — playability is structural, not popularity-shaped
 *   - re-derives any consumed model (PointLifecycleMap, ArgumentTimelineMap,
 *     GAME-001 advisories, EV-001 contracts, SC-004 dock models). AN-003
 *     consumes already-built models; it never re-runs their builders.
 *   - labels a room, point, or person as winner / loser / correct / true /
 *     false / proven. `TreePlayabilityClass` values are structural readouts.
 *
 * Sibling, NOT a dependency: AN-001 (`boardDiagnostics.ts`). AN-003 must be
 * compatible (disjoint, non-duplicating) but does NOT import it. The
 * `fnv1a` helper below is a deliberate local copy of AN-001's helper of
 * the same shape — copying it avoids a cross-module coupling for one tiny
 * pure function (see boardDiagnostics.ts `fnv1a`).
 *
 * The model is deterministic given identical input. No `Date.now()`, no
 * `Math.random()` in the deriver body — any time-shaped value is passed in.
 */

import type { ArgumentTimelineMapModel, ArgumentTimelineMapNode }
  from '../arguments/argumentGameSurfaceModel';
import type { TimelineNodeActionDockModel, TimelineNodeActionDockActionCode }
  from '../arguments/timelineNodeActionDockModel';
import type { TimelineEvidenceContract } from '../evidence/evidenceModel';
import type { ExhaustionTimeoutAdvisory } from '../lifecycle';
import {
  ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES,
  ALL_POINT_LIFECYCLE_STATES,
  type PointLifecycleMap,
  type PointLifecycleState,
} from '../lifecycle';

// ── Input shape ────────────────────────────────────────────────

export interface TreePlayabilityDiagnosticsConfig {
  /**
   * Branch depth at or above which the tree is flagged "branch overload"
   * (a deep, possibly-stuck chain). Default 8. Advisory only.
   */
  branchOverloadDepthThreshold: number;

  /**
   * Fraction of clusters in an unresolved state at or above which the
   * room is flagged `unresolved_dominant`. Default 0.5. Advisory only.
   */
  unresolvedDominanceFraction: number;

  /**
   * Fraction of clusters in an exhausted/stale state at or above which
   * the room is flagged `stalled`. Default 0.4. Advisory only.
   */
  stalledDominanceFraction: number;
}

export interface TreePlayabilityDiagnosticsInput {
  /** Already-built timeline surface model (the room's argument tree). */
  timelineMap: ArgumentTimelineMapModel;

  /** Already-built LIFE-001 lifecycle map for the same room. */
  lifecycleMap: PointLifecycleMap;

  /**
   * GAME-001 advisory per cluster id (= branchRootMessageId). Optional;
   * when omitted, the `dominantAdvisoryState` falls back to the LIFE-001
   * cluster state. Keyed by cluster id. Caller builds via
   * `deriveExhaustionTimeoutAdvisory` / the LIFE-001 adapter.
   */
  exhaustionAdvisoryByClusterId?: ReadonlyMap<string, ExhaustionTimeoutAdvisory>;

  /**
   * EV-001 evidence contract lookup. Returns null for a message with no
   * artifacts. Caller supplies the same `getTimelineEvidenceContract`-backed
   * function the room shell uses. Optional — when omitted, evidence-debt
   * concentration is computed from lifecycle source/quote-request states
   * only (a coarser but still correct signal).
   */
  evidenceContractFor?: (messageId: string) => TimelineEvidenceContract | null;

  /**
   * SC-004 dock-model builder for a single node, already bound to the
   * canonical participant actor. AN-003 calls this once per non-root,
   * non-detached node to detect "no actionable suggestion" nodes.
   * Optional — when omitted, `nodesWithNoActionableSuggestion` is reported
   * as `null` (signal unavailable, not zero).
   */
  dockModelForNode?: (messageId: string) => TimelineNodeActionDockModel | null;

  /** Optional config overrides. */
  config?: TreePlayabilityDiagnosticsConfig;
}

// ── Output shape ───────────────────────────────────────────────

/** A playability verdict-FREE structural readout. Dev/debug only. */
export type TreePlayabilityClass =
  | 'empty' // no messages
  | 'healthy' // unresolved + stalled both below their thresholds
  | 'unresolved_dominant' // many open/rebutted/requested clusters
  | 'stalled' // many exhausted/moved-on/ignored clusters
  | 'mixed'; // both dominance flags fire

export interface TreeBranchDepthStats {
  /** Max branch depth across every cluster (deepest path from a cluster
   *  root to a leaf). 0 for a single-message room. */
  maxDepth: number;
  /** Median of per-cluster max depths. Deterministic (lower-mid on ties). */
  medianDepth: number;
  /** True when `maxDepth >= config.branchOverloadDepthThreshold`. */
  isBranchOverload: boolean;
  /** The cluster id of the deepest chain (for the Markdown snapshot). */
  deepestClusterId: string | null;
}

export interface TreeLifecycleStateBreakdown {
  /** Count of clusters in each of the 19 PointLifecycleState values.
   *  Keys cover every entry of ALL_POINT_LIFECYCLE_STATES. */
  countsByState: Readonly<Record<PointLifecycleState, number>>;
  /** Total clusters (= sum of countsByState values). */
  totalClusters: number;
}

export interface TreePlayabilityDiagnostics {
  /** Verdict-free structural classification (see TreePlayabilityClass). */
  playabilityClass: TreePlayabilityClass;

  /** Total messages in the timeline map. */
  totalMessages: number;
  /** Total clusters (= lifecycleMap.byCluster.size). */
  totalClusters: number;

  /** Clusters in open / rebutted / source_requested / quote_requested. */
  unresolvedPointCount: number;
  /** Clusters in exhausted / moved_on_by_* / ignored_by_* / ignored_by_both. */
  exhaustedOrStalePointCount: number;
  /** unresolvedPointCount / totalClusters; 0 when no clusters. */
  unresolvedFraction: number;
  /** exhaustedOrStalePointCount / totalClusters; 0 when no clusters. */
  exhaustedOrStaleFraction: number;

  /** Branch depth statistics (max + median + overload flag). */
  branchDepth: TreeBranchDepthStats;

  /**
   * Average actions (edges) to reach the active unresolved point from its
   * cluster root. null when the timeline has no activeNode OR the active
   * node's cluster is not in an unresolved state.
   */
  actionsToActiveUnresolvedPointFromRoot: number | null;

  /**
   * Source / evidence debt concentration: fraction of clusters that carry
   * unresolved evidence debt (open source/quote request, OR a worst EV-001
   * status of no_source / broken on a claim-shape member). [0, 1].
   */
  evidenceDebtConcentration: number;
  /** Absolute count behind `evidenceDebtConcentration`. */
  evidenceDebtClusterCount: number;

  /**
   * Count of non-root, non-detached nodes whose SC-004 dock has no enabled
   * POST-producing action (the "dock would render empty" red flag,
   * adapted — SC-004's dock always keeps `open_cards_detail` enabled, so
   * a literally-empty dock is unreachable). null when `dockModelForNode`
   * was not supplied (signal unavailable, never silently 0).
   */
  nodesWithNoActionableSuggestion: number | null;

  /** Full per-state cluster breakdown (all 19 lifecycle states). */
  lifecycleBreakdown: TreeLifecycleStateBreakdown;

  /**
   * The advisory state that dominates the room: the most-frequent GAME-001
   * advisory state across clusters (ties broken by
   * ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES priority order), or null when
   * no cluster has a GAME-001 advisory. Falls back to the most-frequent
   * LIFE-001 exhausted/stale cluster state when no advisory map is given.
   */
  dominantAdvisoryState: PointLifecycleState | null;
  /** Count of clusters carrying `dominantAdvisoryState`. 0 when null. */
  dominantAdvisoryClusterCount: number;

  /** Stable count-based fingerprint (FNV-1a, no PII). Change-detection. */
  fingerprint: string;
}

// ── Config ─────────────────────────────────────────────────────

/** Default config. Frozen. */
export const DEFAULT_TREE_PLAYABILITY_CONFIG:
  Readonly<TreePlayabilityDiagnosticsConfig> = Object.freeze({
    branchOverloadDepthThreshold: 8,
    unresolvedDominanceFraction: 0.5,
    stalledDominanceFraction: 0.4,
  });

// ── Lifecycle-state classification sets ───────────────────────

/**
 * Cluster states that count as "unresolved". Exactly mirrors the AN-003
 * card body's first parenthesised list. `branch_recommended` is NOT here —
 * it is a routing advisory, neither unresolved nor stale.
 */
const UNRESOLVED_STATES: ReadonlySet<PointLifecycleState> = new Set<PointLifecycleState>([
  'open',
  'rebutted',
  'source_requested',
  'quote_requested',
]);

/**
 * Cluster states that count as "exhausted / stale". Exactly mirrors the
 * card body's second parenthesised list. `branch_recommended` is NOT here.
 */
const EXHAUSTED_OR_STALE_STATES: ReadonlySet<PointLifecycleState> = new Set<PointLifecycleState>([
  'exhausted',
  'moved_on_by_affirmative',
  'moved_on_by_negative',
  'ignored_by_affirmative',
  'ignored_by_negative',
  'ignored_by_both',
]);

/**
 * Dock action codes that PRODUCE a post. A node has "no actionable
 * suggestion" when none of these is enabled in its SC-004 dock. Excludes
 * `open_cards_detail` (always enabled — a detail panel, not a post),
 * `flag` (a report, not a debate move), `mark_moved_on` / `mark_ignored`
 * (annotations, not posts), and `expand_branch` (a UI primitive).
 */
const POST_PRODUCING_ACTION_CODES: ReadonlySet<TimelineNodeActionDockActionCode> =
  new Set<TimelineNodeActionDockActionCode>([
    'reply',
    'challenge',
    'ask_source',
    'ask_quote',
    'clarify',
    'add_evidence',
    'narrow',
    'concede',
    'confirm',
    'branch',
    'synthesize',
  ]);

/** EV-001 worst-status values that count as carrying evidence debt. */
const EVIDENCE_DEBT_STATUSES: ReadonlySet<string> = new Set<string>([
  'no_source',
  'broken',
]);

// ── Helpers ────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit. Stable across runs; small enough to embed in a
 * fingerprint string. Deliberate local copy of AN-001's `fnv1a`
 * (`boardDiagnostics.ts`) — copying avoids a cross-module coupling for
 * one tiny pure helper.
 */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Median of a number list — lower-middle element on an even count. */
function medianLowerMiddle(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  // Lower-middle index: for length n, index = ceil(n/2) - 1.
  const idx = Math.ceil(sorted.length / 2) - 1;
  return sorted[idx];
}

/** Empty per-state count record covering every lifecycle state. */
function emptyStateCounts(): Record<PointLifecycleState, number> {
  const out = {} as Record<PointLifecycleState, number>;
  for (const state of ALL_POINT_LIFECYCLE_STATES) {
    out[state] = 0;
  }
  return out;
}

/**
 * Compute per-cluster max branch depth + the deepest cluster id.
 *
 * For each cluster, AN-003 takes the cluster's member nodes from the
 * timeline map, finds the cluster root node, and computes the max
 * `node.depth - clusterRootNode.depth` (cluster-relative depth) across
 * members. `node.depth` is the timeline map's ABSOLUTE depth from the
 * timeline root (verified against `buildArgumentTimelineMap`).
 *
 * A cluster whose root is absent from the timeline map (data skew) is
 * treated as depth 0 — never throws.
 */
function computeBranchDepthStats(
  lifecycleMap: PointLifecycleMap,
  nodeById: ReadonlyMap<string, ArgumentTimelineMapNode>,
  branchOverloadDepthThreshold: number,
): TreeBranchDepthStats {
  const perClusterMaxDepth: number[] = [];
  let maxDepth = 0;
  let deepestClusterId: string | null = null;

  for (const [clusterId, summary] of lifecycleMap.byCluster.entries()) {
    const rootNode = nodeById.get(summary.rootMessageId);
    const rootDepth = rootNode ? rootNode.depth : 0;
    let clusterMaxRelative = 0;
    for (const memberId of summary.messageIds) {
      const memberNode = nodeById.get(memberId);
      if (!memberNode) continue;
      const relative = memberNode.depth - rootDepth;
      if (relative > clusterMaxRelative) clusterMaxRelative = relative;
    }
    perClusterMaxDepth.push(clusterMaxRelative);
    if (clusterMaxRelative > maxDepth) {
      maxDepth = clusterMaxRelative;
      deepestClusterId = clusterId;
    }
  }

  return {
    maxDepth,
    medianDepth: medianLowerMiddle(perClusterMaxDepth),
    isBranchOverload: maxDepth >= branchOverloadDepthThreshold,
    deepestClusterId,
  };
}

/**
 * Structural classification from the two dominance fractions.
 * Verdict-free — never reads heat / popularity / standing.
 */
function classifyPlayability(
  totalClusters: number,
  unresolvedFraction: number,
  exhaustedOrStaleFraction: number,
  config: TreePlayabilityDiagnosticsConfig,
): TreePlayabilityClass {
  if (totalClusters === 0) return 'empty';
  const unresolvedDominant = unresolvedFraction >= config.unresolvedDominanceFraction;
  const stalled = exhaustedOrStaleFraction >= config.stalledDominanceFraction;
  if (unresolvedDominant && stalled) return 'mixed';
  if (unresolvedDominant) return 'unresolved_dominant';
  if (stalled) return 'stalled';
  return 'healthy';
}

/**
 * The dominant GAME-001 advisory state. Most-frequent advisory state
 * across clusters; ties broken by `ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES`
 * order (earlier wins). Returns null when no cluster has an advisory.
 */
function computeDominantAdvisoryFromGame001(
  advisoryByClusterId: ReadonlyMap<string, ExhaustionTimeoutAdvisory>,
): { state: PointLifecycleState | null; count: number } {
  const counts = new Map<PointLifecycleState, number>();
  for (const advisory of advisoryByClusterId.values()) {
    if (advisory.state == null) continue;
    counts.set(advisory.state, (counts.get(advisory.state) || 0) + 1);
  }
  if (counts.size === 0) return { state: null, count: 0 };
  let bestState: PointLifecycleState | null = null;
  let bestCount = 0;
  for (const state of ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES) {
    const count = counts.get(state) || 0;
    if (count > bestCount) {
      bestCount = count;
      bestState = state;
    }
  }
  return { state: bestState, count: bestCount };
}

/**
 * Fallback dominant advisory: the most-frequent LIFE-001 cluster state
 * among `EXHAUSTED_OR_STALE_STATES`. Used when no GAME-001 advisory map
 * is supplied. Ties broken by `ALL_POINT_LIFECYCLE_STATES` order.
 */
function computeDominantAdvisoryFromLifecycle(
  lifecycleMap: PointLifecycleMap,
): { state: PointLifecycleState | null; count: number } {
  const counts = new Map<PointLifecycleState, number>();
  for (const summary of lifecycleMap.byCluster.values()) {
    if (!EXHAUSTED_OR_STALE_STATES.has(summary.state)) continue;
    counts.set(summary.state, (counts.get(summary.state) || 0) + 1);
  }
  if (counts.size === 0) return { state: null, count: 0 };
  let bestState: PointLifecycleState | null = null;
  let bestCount = 0;
  for (const state of ALL_POINT_LIFECYCLE_STATES) {
    const count = counts.get(state) || 0;
    if (count > bestCount) {
      bestCount = count;
      bestState = state;
    }
  }
  return { state: bestState, count: bestCount };
}

/** True when the SC-004 dock has at least one enabled POST-producing action. */
function dockHasEnabledPostAction(dock: TimelineNodeActionDockModel): boolean {
  for (const action of dock.actions) {
    if (action.isDisabled) continue;
    if (POST_PRODUCING_ACTION_CODES.has(action.action)) return true;
  }
  return false;
}

/** The canonical empty diagnostics record. */
function emptyDiagnostics(): TreePlayabilityDiagnostics {
  const lifecycleBreakdown: TreeLifecycleStateBreakdown = {
    countsByState: Object.freeze(emptyStateCounts()),
    totalClusters: 0,
  };
  const branchDepth: TreeBranchDepthStats = {
    maxDepth: 0,
    medianDepth: 0,
    isBranchOverload: false,
    deepestClusterId: null,
  };
  return {
    playabilityClass: 'empty',
    totalMessages: 0,
    totalClusters: 0,
    unresolvedPointCount: 0,
    exhaustedOrStalePointCount: 0,
    unresolvedFraction: 0,
    exhaustedOrStaleFraction: 0,
    branchDepth,
    actionsToActiveUnresolvedPointFromRoot: null,
    evidenceDebtConcentration: 0,
    evidenceDebtClusterCount: 0,
    nodesWithNoActionableSuggestion: null,
    lifecycleBreakdown,
    dominantAdvisoryState: null,
    dominantAdvisoryClusterCount: 0,
    fingerprint: fnv1a('empty'),
  };
}

// ── Main entry point ───────────────────────────────────────────

/**
 * AN-003 — derive tree playability diagnostics. Pure. Deterministic.
 * Never throws. Never mutates input. No clock read. No network. No AI.
 */
export function computeTreePlayabilityDiagnostics(
  input: TreePlayabilityDiagnosticsInput,
): TreePlayabilityDiagnostics {
  const { timelineMap, lifecycleMap } = input;
  const config = input.config || DEFAULT_TREE_PLAYABILITY_CONFIG;

  // Empty timeline → the canonical empty record.
  if (!timelineMap || timelineMap.nodes.length === 0) {
    return emptyDiagnostics();
  }

  const totalMessages = timelineMap.nodes.length;
  const totalClusters = lifecycleMap.byCluster.size;

  // Index nodes by id for cheap lookups.
  const nodeById = new Map<string, ArgumentTimelineMapNode>();
  for (const node of timelineMap.nodes) {
    nodeById.set(node.messageId, node);
  }

  // ── Lifecycle breakdown + unresolved / stale counts ──────────
  const countsByState = emptyStateCounts();
  let unresolvedPointCount = 0;
  let exhaustedOrStalePointCount = 0;
  for (const summary of lifecycleMap.byCluster.values()) {
    countsByState[summary.state] += 1;
    if (UNRESOLVED_STATES.has(summary.state)) unresolvedPointCount += 1;
    if (EXHAUSTED_OR_STALE_STATES.has(summary.state)) exhaustedOrStalePointCount += 1;
  }
  const unresolvedFraction = totalClusters === 0 ? 0 : unresolvedPointCount / totalClusters;
  const exhaustedOrStaleFraction =
    totalClusters === 0 ? 0 : exhaustedOrStalePointCount / totalClusters;

  // ── Branch depth ─────────────────────────────────────────────
  const branchDepth = computeBranchDepthStats(
    lifecycleMap,
    nodeById,
    config.branchOverloadDepthThreshold,
  );

  // ── Actions to the active unresolved point from its cluster root ──
  let actionsToActiveUnresolvedPointFromRoot: number | null = null;
  const activeNode = timelineMap.activeNode;
  if (activeNode) {
    const activeClusterSummary = lifecycleMap.byCluster.get(activeNode.branchRootMessageId);
    if (activeClusterSummary && UNRESOLVED_STATES.has(activeClusterSummary.state)) {
      const clusterRoot = nodeById.get(activeClusterSummary.rootMessageId);
      const rootDepth = clusterRoot ? clusterRoot.depth : 0;
      actionsToActiveUnresolvedPointFromRoot = Math.max(0, activeNode.depth - rootDepth);
    }
  }

  // ── Evidence-debt concentration ──────────────────────────────
  let evidenceDebtClusterCount = 0;
  const evidenceContractFor = input.evidenceContractFor;
  for (const summary of lifecycleMap.byCluster.values()) {
    let carriesDebt =
      summary.hasOpenSourceOrQuoteRequest
      || summary.state === 'source_requested'
      || summary.state === 'quote_requested';
    if (!carriesDebt && evidenceContractFor) {
      // EV-001 path — a cluster member with a no_source / broken contract.
      for (const memberId of summary.messageIds) {
        const contract = evidenceContractFor(memberId);
        if (contract && EVIDENCE_DEBT_STATUSES.has(contract.receiptChip.status)) {
          carriesDebt = true;
          break;
        }
      }
    }
    if (carriesDebt) evidenceDebtClusterCount += 1;
  }
  const evidenceDebtConcentration =
    totalClusters === 0 ? 0 : evidenceDebtClusterCount / totalClusters;

  // ── Nodes with no actionable suggestion ──────────────────────
  let nodesWithNoActionableSuggestion: number | null = null;
  const dockModelForNode = input.dockModelForNode;
  if (dockModelForNode) {
    let count = 0;
    for (const node of timelineMap.nodes) {
      if (node.isRoot) continue;
      if (node.isDetached) continue;
      const dock = dockModelForNode(node.messageId);
      if (!dock) continue;
      if (!dockHasEnabledPostAction(dock)) count += 1;
    }
    nodesWithNoActionableSuggestion = count;
  }

  // ── Dominant advisory state ──────────────────────────────────
  const dominant = input.exhaustionAdvisoryByClusterId
    ? computeDominantAdvisoryFromGame001(input.exhaustionAdvisoryByClusterId)
    : computeDominantAdvisoryFromLifecycle(lifecycleMap);

  // ── Playability classification ───────────────────────────────
  const playabilityClass = classifyPlayability(
    totalClusters,
    unresolvedFraction,
    exhaustedOrStaleFraction,
    config,
  );

  // ── Fingerprint ──────────────────────────────────────────────
  const fingerprintParts: Array<string | number> = [
    totalMessages,
    totalClusters,
    unresolvedPointCount,
    exhaustedOrStalePointCount,
    branchDepth.maxDepth,
    branchDepth.medianDepth,
    evidenceDebtClusterCount,
    nodesWithNoActionableSuggestion ?? -1,
  ];
  for (const state of ALL_POINT_LIFECYCLE_STATES) {
    fingerprintParts.push(countsByState[state]);
  }
  const fingerprint = fnv1a(fingerprintParts.join(':'));

  return {
    playabilityClass,
    totalMessages,
    totalClusters,
    unresolvedPointCount,
    exhaustedOrStalePointCount,
    unresolvedFraction,
    exhaustedOrStaleFraction,
    branchDepth,
    actionsToActiveUnresolvedPointFromRoot,
    evidenceDebtConcentration,
    evidenceDebtClusterCount,
    nodesWithNoActionableSuggestion,
    lifecycleBreakdown: {
      countsByState: Object.freeze(countsByState),
      totalClusters,
    },
    dominantAdvisoryState: dominant.state,
    dominantAdvisoryClusterCount: dominant.count,
    fingerprint,
  };
}

// ── Markdown emitter ───────────────────────────────────────────

/** Format a [0,1] fraction as an integer-percent string. */
function pct(fraction: number): string {
  if (!Number.isFinite(fraction)) return '0';
  return String(Math.round(fraction * 100));
}

/**
 * Render a dev/debug Markdown snapshot from a TreePlayabilityDiagnostics
 * record (+ optional room label). Pure string builder. No file I/O here —
 * the caller (dev script) writes the file. Never emits a verdict token.
 *
 * The internal lifecycle codes (`open`, `rebutted`, …) and the
 * `playabilityClass` value are shown DELIBERATELY — this is operator
 * tooling, not a user-facing surface, so `gameCopy.toPlainLanguage` is
 * intentionally NOT applied. The ban-list test still guarantees no
 * verdict word ever appears.
 */
export function renderTreePlayabilityMarkdown(
  diagnostics: TreePlayabilityDiagnostics,
  options?: { roomLabel?: string; generatedAtLabel?: string },
): string {
  const roomLabel = options?.roomLabel || 'unnamed room';
  const generatedAtLabel = options?.generatedAtLabel || 'not recorded';
  const d = diagnostics;

  const lines: string[] = [];
  lines.push(`# Tree playability snapshot — ${roomLabel}`);
  lines.push('');
  lines.push(`Generated: ${generatedAtLabel}   (dev/debug only — not a user-facing report)`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Playability class: ${d.playabilityClass}`);
  lines.push(`- Messages: ${d.totalMessages}   Clusters: ${d.totalClusters}`);
  lines.push('');
  lines.push('## Resolution');
  lines.push(
    `- Unresolved points: ${d.unresolvedPointCount} (${pct(d.unresolvedFraction)}%)`,
  );
  lines.push(
    `- Exhausted / stale points: ${d.exhaustedOrStalePointCount} `
    + `(${pct(d.exhaustedOrStaleFraction)}%)`,
  );
  lines.push(
    `- Evidence-debt concentration: ${pct(d.evidenceDebtConcentration)}% `
    + `(${d.evidenceDebtClusterCount} clusters)`,
  );
  lines.push('');
  lines.push('## Branch depth');
  lines.push(`- Max depth: ${d.branchDepth.maxDepth}   Median depth: ${d.branchDepth.medianDepth}`);
  lines.push(`- Branch overload: ${d.branchDepth.isBranchOverload ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Reachability');
  lines.push(
    '- Actions to active unresolved point from root: '
    + `${d.actionsToActiveUnresolvedPointFromRoot === null
      ? 'n/a'
      : String(d.actionsToActiveUnresolvedPointFromRoot)}`,
  );
  lines.push(
    '- Nodes with no actionable suggestion: '
    + `${d.nodesWithNoActionableSuggestion === null
      ? 'signal unavailable'
      : String(d.nodesWithNoActionableSuggestion)}`,
  );
  lines.push('');
  lines.push('## Advisory distribution');
  lines.push(
    `- Dominant advisory state: ${d.dominantAdvisoryState ?? 'none'} `
    + `(${d.dominantAdvisoryClusterCount} clusters)`,
  );
  lines.push('- Per-state cluster counts:');
  lines.push('  | Lifecycle state | Clusters |');
  lines.push('  | --- | --- |');
  for (const state of ALL_POINT_LIFECYCLE_STATES) {
    lines.push(`  | ${state} | ${d.lifecycleBreakdown.countsByState[state]} |`);
  }
  lines.push('');
  lines.push('## Fingerprint');
  lines.push(d.fingerprint);
  lines.push('');

  return lines.join('\n');
}

// ── Test-only forbidden tokens ────────────────────────────────

/**
 * Test-only: the verdict / popularity / amplification token list scanned
 * across every string `renderTreePlayabilityMarkdown` can produce.
 *
 * Not a content filter. Internal lifecycle codes (`open`, `rebutted`, …)
 * are deliberately ALLOWED in the dev/debug Markdown — only verdict and
 * popularity words are banned. Leading underscore = "exported for tests".
 */
export function _forbiddenTreePlayabilityTokens(): string[] {
  return [
    // Verdict tokens
    'winner', 'loser', 'correct', 'incorrect', 'true', 'false',
    'liar', 'dishonest', 'bad faith', 'manipulative',
    'extremist', 'propagandist', 'troll', 'astroturfer',
    'verdict', 'proof', 'proven', 'disproven', 'lost', 'defeated', 'won',
    'right', 'wrong', 'validated',
    // Popularity / amplification tokens — playability never reads these
    'likes', 'retweets', 'shares', 'views', 'followers', 'verified',
    'engagement', 'amplification', 'trending', 'virality', 'popular', 'viral',
  ];
}

// ── Test-only internal access ─────────────────────────────────

/**
 * Exported for tests that want to assert on the helpers directly. Not
 * part of the runtime API surface.
 */
export const _internal = {
  fnv1a,
  medianLowerMiddle,
  computeBranchDepthStats,
  classifyPlayability,
  computeDominantAdvisoryFromGame001,
  computeDominantAdvisoryFromLifecycle,
  dockHasEnabledPostAction,
  UNRESOLVED_STATES,
  EXHAUSTED_OR_STALE_STATES,
  POST_PRODUCING_ACTION_CODES,
  EVIDENCE_DEBT_STATUSES,
};
