/**
 * LIFE-001 — Advisory threshold input helpers.
 *
 * Pure TS. No React, no Supabase, no network.
 *
 * Doctrine: thresholds drive ADVISORY states only. Advisory states never
 * block posting, never auto-archive, never auto-message. They surface
 * non-progressing clusters as a gentle nudge.
 */

import type { ArgumentTimelineMapNode } from '../arguments/argumentGameSurfaceModel';
import { deriveAxis, nodeHasQualifierCode } from './pointLifecycleClusters';
import type { PointLifecycleAxis } from './pointLifecycleModel';
import type { SourceChainStatus } from '../evidence/evidenceModel';

/** Argument-type labels treated as rebuttal-shaped. */
function isRebuttalLike(node: ArgumentTimelineMapNode): boolean {
  const t = String(node.kindLabel || '').toLowerCase();
  return t === 'rebuttal' || t === 'counter-rebuttal' || t === 'counter_rebuttal';
}

/**
 * Count distinct same-axis rebuttal/answered pressure moves under the
 * cluster. Used by the exhaustion advisory.
 *
 * Counts only same-axis pressure moves that ADD NO NEW INFORMATION. A
 * pressure move "adds new information" when it attaches an EvidenceArtifact
 * (status not no_source/unverified/broken), provides a target excerpt
 * (quote_exact_bit on the move), or carries an axis-narrowing qualifier
 * (`narrow_scope`, `define_term`).
 */
export function countSameAxisPressure(
  cluster: ReadonlyArray<ArgumentTimelineMapNode>,
  axis: PointLifecycleAxis,
): number {
  let count = 0;
  for (const m of cluster) {
    if (!isRebuttalLike(m)) continue;
    const a = deriveAxis(m);
    if (a !== axis) continue;
    count += 1;
  }
  return count;
}

/**
 * True when the move ADDS new evidence / scope / definition / mechanism
 * information. When true, the pressure is "additive" and the exhaustion
 * counter does NOT increment.
 *
 * Observable inputs only:
 *   - artifactStatus !== null AND not no_source/broken — a new artifact
 *     was attached and inspected.
 *   - quote_exact_bit qualifier — the move quotes a different part of
 *     the parent.
 *   - narrow_scope / define_term qualifiers — the move narrows or
 *     redefines the axis.
 */
export function hasAdditiveAxisInformation(
  node: ArgumentTimelineMapNode,
  artifactStatus: SourceChainStatus | null,
): boolean {
  if (artifactStatus !== null
    && artifactStatus !== 'no_source'
    && artifactStatus !== 'broken'
    && artifactStatus !== 'unverified') {
    return true;
  }
  if (nodeHasQualifierCode(node, 'quote_exact_bit')) return true;
  if (nodeHasQualifierCode(node, 'narrow_scope')) return true;
  if (nodeHasQualifierCode(node, 'define_term')) return true;
  return false;
}

/**
 * @deprecated Prefer `hasAdditiveAxisInformation` (clearer name).
 * Kept for documentation parity with the design's helper list.
 */
export function moveAddsAxisInformation(
  node: ArgumentTimelineMapNode,
  artifactStatus: SourceChainStatus | null,
): boolean {
  return hasAdditiveAxisInformation(node, artifactStatus);
}

/**
 * Count off-axis pressure moves under the cluster. Used by the
 * branch_recommended advisory.
 *
 * "Off-axis" means the move carries `branch_this_off` or `tangent_or_joke`
 * qualifier codes. These are the qualifier deriver's outputs that already
 * land in `droppedTags[].code`. Surface model upstream is `MessageCategory
 * === 'tangent'` which the upstream classifier emits via the qualifier
 * code surface.
 */
export function countOffAxisPressure(
  cluster: ReadonlyArray<ArgumentTimelineMapNode>,
): number {
  let count = 0;
  for (const m of cluster) {
    if (nodeHasQualifierCode(m, 'branch_this_off')
      || nodeHasQualifierCode(m, 'tangent_or_joke')) {
      count += 1;
    }
  }
  return count;
}

/**
 * Count ROOM-WIDE turns since the side last posted to this cluster.
 *
 * Algorithm:
 *   - Find the last cluster member posted by `side` (using sideLabel match).
 *   - In the side's room-wide turn sequence, find the index of that
 *     message and return `(sequence.length - index - 1)` — i.e. how many
 *     subsequent turns the side has had WITHOUT posting to this cluster.
 *   - If the side has never posted to this cluster, return
 *     `sequence.length` (every one of the side's turns is a turn away
 *     from this cluster).
 */
export function turnsSinceSideEngagedCluster(
  side: 'affirmative' | 'negative',
  cluster: ReadonlyArray<ArgumentTimelineMapNode>,
  sideTurnSequence: ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>,
): number {
  const sequence = sideTurnSequence.get(side) || [];
  const sideLabel = side === 'affirmative' ? 'Aff' : 'Neg';
  const clusterMsgIds = new Set<string>();
  for (const m of cluster) {
    if (m.sideLabel === sideLabel) clusterMsgIds.add(m.messageId);
  }
  // Walk the room-wide turn sequence backwards: count turns until we hit
  // a turn that's in this cluster.
  let turnsAway = 0;
  for (let i = sequence.length - 1; i >= 0; i--) {
    if (clusterMsgIds.has(sequence[i])) return turnsAway;
    turnsAway += 1;
  }
  return turnsAway;
}
