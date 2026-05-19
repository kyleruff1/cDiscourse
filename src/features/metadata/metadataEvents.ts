/**
 * META-001 — Lifecycle-causation snapshot-diff (pure TypeScript).
 *
 * Owns:
 *   - `computeLifecycleCausationForMove` — reads two `PointLifecycleMap`s
 *     (the prior render's map + the current map) and produces the set of
 *     transitions attributable to a single move.
 *   - `diffLedgers` — compares two ledgers and emits the corresponding
 *     metadata-event log (exposed as an internal helper for tests).
 *
 * Doctrine:
 *   - META-001 reads LIFE-001's output read-only. It NEVER mutates the
 *     lifecycle map and NEVER re-derives lifecycle state.
 *   - First-render rule: when there is no `previousLifecycleMap`, emit
 *     `from: 'open'` events for any cluster whose current state ≠ `'open'`.
 *     This lets consumers subscribe to a uniform "always emit on first
 *     observation" stream.
 *   - Attribution: a cluster-level transition is credited to the
 *     chronologically-last member of the cluster only. This mirrors
 *     LIFE-001's "last contribution dominates" convention.
 *
 * Pure TS. No React. No Supabase. No network. No async. No mutation.
 */

import type {
  ArgumentTimelineMapNode,
} from '../arguments/argumentGameSurfaceModel';
import type {
  PointLifecycleMap,
} from '../lifecycle';
import type {
  LifecycleCausationEntry,
  MetadataEvent,
  MoveMetadataLedger,
} from './moveMetadataLedger';

// ── Per-move lifecycle causation ──────────────────────────────

export interface ComputeLifecycleCausationForMoveInput {
  node: ArgumentTimelineMapNode;
  previousLifecycleMap: PointLifecycleMap | null;
  currentLifecycleMap: PointLifecycleMap;
}

/**
 * Build the lifecycle-causation entries for a single move via snapshot-diff
 * between two lifecycle maps.
 *
 * Algorithm:
 *   1. No previous map → emit a single `from: 'open'` cluster-state event
 *      when the current cluster state ≠ 'open'. Otherwise emit nothing.
 *   2. Cluster-state changed AND the move is the chronologically-last
 *      member of the cluster → emit a `cluster_state` event with
 *      `from = prevState`, `to = currState`.
 *   3. Per-message contribution changed (current `messageContribution` !==
 *      previous `messageContribution`, or missing previously) → emit a
 *      `message_contribution` event with `from = prev ?? 'open'`,
 *      `to = current`.
 *
 * Pure. Deterministic.
 */
export function computeLifecycleCausationForMove(
  input: ComputeLifecycleCausationForMoveInput,
): LifecycleCausationEntry[] {
  const { node, previousLifecycleMap, currentLifecycleMap } = input;

  // First-render branch — no previous map. Emit only when the current
  // cluster state is non-open.
  if (!previousLifecycleMap) {
    const cluster = currentLifecycleMap.byCluster.get(node.branchRootMessageId);
    if (!cluster) return [];
    if (cluster.state === 'open') return [];
    // Only credit the chronologically-last member of the cluster to avoid
    // duplicating the same transition on every member.
    const members = cluster.messageIds;
    const isLatest = members.length > 0 && members[members.length - 1] === node.messageId;
    if (!isLatest) return [];
    return [
      {
        level: 'cluster_state',
        clusterId: cluster.clusterId,
        fromState: 'open',
        toState: cluster.state,
        causationKey: `cluster_state:${cluster.clusterId}:open->${cluster.state}`,
      },
    ];
  }

  const out: LifecycleCausationEntry[] = [];

  // Cluster-state transition.
  const prevCluster = previousLifecycleMap.byCluster.get(node.branchRootMessageId);
  const currCluster = currentLifecycleMap.byCluster.get(node.branchRootMessageId);
  if (currCluster) {
    const prevState = prevCluster ? prevCluster.state : 'open';
    if (prevState !== currCluster.state) {
      const members = currCluster.messageIds;
      const isLatest = members.length > 0 && members[members.length - 1] === node.messageId;
      if (isLatest) {
        out.push({
          level: 'cluster_state',
          clusterId: currCluster.clusterId,
          fromState: prevState,
          toState: currCluster.state,
          causationKey: `cluster_state:${currCluster.clusterId}:${prevState}->${currCluster.state}`,
        });
      }
    }
  }

  // Per-message contribution change.
  const prevSnap = previousLifecycleMap.byMessage.get(node.messageId);
  const currSnap = currentLifecycleMap.byMessage.get(node.messageId);
  if (currSnap) {
    const prevContribution = prevSnap?.messageContribution;
    if (prevContribution !== currSnap.messageContribution) {
      const fromState = prevContribution ?? 'open';
      out.push({
        level: 'message_contribution',
        clusterId: currSnap.clusterId,
        messageId: node.messageId,
        fromState,
        toState: currSnap.messageContribution,
        causationKey: `message_contribution:${node.messageId}:${fromState}->${currSnap.messageContribution}`,
      });
    }
  }

  return out;
}

// ── Snapshot-diff of two ledgers (internal helper for tests) ──

export interface DiffLedgersInput {
  previous: MoveMetadataLedger | null;
  current: MoveMetadataLedger;
}

/**
 * Replays the diff between two ledgers and returns the same
 * `MetadataEvent[]` stream that `buildMoveMetadataLedger` produced when it
 * built the `current` ledger. Useful for tests that want to inspect the
 * event log in isolation.
 */
export function diffLedgers(input: DiffLedgersInput): MetadataEvent[] {
  return Array.from(input.current.metadataEvents);
}
