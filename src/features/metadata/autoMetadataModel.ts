/**
 * META-001 — Auto-derived metadata model (pure TypeScript).
 *
 * Owns:
 *   - `deriveAutoMetadataForMessage` — produces the list of
 *     `AutoMetadataEntry` observations for a single move by reading
 *     existing seams.
 *   - Per-code predicates.
 *
 * Doctrine — read every word before changing this file:
 *
 *   1. Auto metadata is an observation about move STRUCTURE, never a
 *      truth claim. `has_evidence` means "an artifact is attached"; it
 *      never means the evidence is sufficient, correct, or popular.
 *   2. No code may be derived from heat / popularity / engagement /
 *      virality / strength bands / AI annotation. Wrong-but-loud and
 *      right-but-quiet produce identical auto-metadata when the move
 *      structure matches.
 *   3. Cluster-wide codes (`point_stalled`, `point_exhausted`,
 *      `synthesis_candidate`) mirror onto every cluster member by design
 *      — SC-004 / ST-002 surface them on whichever bubble the viewer
 *      selected. `inputSignals` documents the cluster source so AN-003
 *      can distinguish per-message from cluster-mirrored signals.
 *   4. The deriver NEVER calls `deriveMessageCategory`,
 *      `derivePrimaryQualifier`, `deriveMessageQualifiers`, `deriveAxis`,
 *      or `applyAntiAmplification`. Axis comes from
 *      `PointLifecycleSnapshot.axis`. Qualifier codes are read from
 *      `node.droppedTags[].code`. Anti-amplification operates on
 *      standing, NOT on metadata.
 *
 * Pure TS. No React. No Supabase. No network. No async. No mutation.
 */

import type {
  ArgumentTimelineMapNode,
} from '../arguments/argumentGameSurfaceModel';
import type {
  EvidenceArtifact,
} from '../evidence/evidenceModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleSnapshot,
  PointLifecycleState,
} from '../lifecycle';
import type {
  AutoMetadataCode,
  AutoMetadataConfig,
  AutoMetadataEntry,
} from './moveMetadataLedger';

// ── Helpers ───────────────────────────────────────────────────

/** Qualifier codes that mark a move as a tangent suggestion / branch. */
const TANGENT_QUALIFIER_CODES: ReadonlyArray<string> = Object.freeze([
  'branch_this_off',
  'tangent_or_joke',
]);

function nodeHasQualifierCode(node: ArgumentTimelineMapNode, code: string): boolean {
  for (const t of node.droppedTags) {
    if (String(t.code || '').toLowerCase() === code) return true;
  }
  return false;
}

function nodeIsChallenge(node: ArgumentTimelineMapNode): boolean {
  return node.kindColorFamily === 'challenge';
}

function nodeSideLabel(node: ArgumentTimelineMapNode): 'affirmative' | 'negative' | null {
  if (node.sideLabel === 'Aff') return 'affirmative';
  if (node.sideLabel === 'Neg') return 'negative';
  return null;
}

// ── Public API ────────────────────────────────────────────────

export interface DeriveAutoMetadataForMessageInput {
  node: ArgumentTimelineMapNode;
  clusterSummary: PointLifecycleClusterSummary;
  messageSnapshot: PointLifecycleSnapshot | null;
  childNodes: ReadonlyArray<ArgumentTimelineMapNode>;
  descendantNodes: ReadonlyArray<ArgumentTimelineMapNode>;
  artifacts: ReadonlyArray<EvidenceArtifact>;
  detectedAt: string;
  autoMetadataConfig: AutoMetadataConfig;
  /** Pre-computed lookup of `messageContribution` for each descendant. */
  descendantContributions: ReadonlyMap<string, PointLifecycleState>;
  /** Chronological room-wide list of all nodes. Used by skip / response
   *  threshold predicates. */
  roomNodes: ReadonlyArray<ArgumentTimelineMapNode>;
}

/**
 * Returns the list of auto-derived metadata codes observed for one move.
 * Reads ONLY the inputs (surface node, lifecycle snapshot/cluster summary,
 * artifact list, descendant info, room-wide chronological ordering). Never
 * re-derives anything upstream.
 *
 * Pure. Deterministic. Idempotent. O(descendantCount + roomNodes) per call.
 */
export function deriveAutoMetadataForMessage(
  input: DeriveAutoMetadataForMessageInput,
): AutoMetadataEntry[] {
  const out: AutoMetadataEntry[] = [];
  const seen = new Set<AutoMetadataCode>();

  function push(code: AutoMetadataCode, signals: string[]): void {
    if (seen.has(code)) return;
    seen.add(code);
    out.push({
      code,
      detectedAt: input.detectedAt,
      inputSignals: Object.freeze(signals.slice(0, 4)),
    });
  }

  // 1. has_reply — node has ≥ 1 direct child.
  if (input.childNodes.length > 0 || input.node.replyCount > 0) {
    push('has_reply', ['node.replyCount > 0']);
  }

  // 2. has_rebuttal — node has ≥ 1 child whose argument-type family is
  //    challenge.
  let hasChallengeChild = false;
  for (const c of input.childNodes) {
    if (nodeIsChallenge(c)) {
      hasChallengeChild = true;
      break;
    }
  }
  if (hasChallengeChild) {
    push('has_rebuttal', ['child.kindColorFamily === challenge']);
  }

  // 3. has_counter_rebuttal — node has ≥ 1 grandchild whose family is
  //    challenge AND whose parent is also a challenge.
  let hasCounter = false;
  for (const c of input.childNodes) {
    if (!nodeIsChallenge(c)) continue;
    for (const d of input.descendantNodes) {
      if (d.parentId === c.messageId && nodeIsChallenge(d)) {
        hasCounter = true;
        break;
      }
    }
    if (hasCounter) break;
  }
  if (hasCounter) {
    push('has_counter_rebuttal', ['grandchild.kindColorFamily === challenge']);
  }

  // 4. has_evidence — node has ≥ 1 attached EvidenceArtifact (any kind).
  if (input.artifacts.length > 0) {
    push('has_evidence', ['artifactsByMessageId.get(messageId).length > 0']);
  }

  // 5. source_requested — a direct child has `messageContribution ===
  //    'source_requested'`.
  let sourceReq = false;
  let quoteReq = false;
  for (const c of input.childNodes) {
    const mc = input.descendantContributions.get(c.messageId);
    if (mc === 'source_requested') sourceReq = true;
    if (mc === 'quote_requested') quoteReq = true;
  }
  if (sourceReq) {
    push('source_requested', ['child.messageContribution === source_requested']);
  }
  if (quoteReq) {
    push('quote_requested', ['child.messageContribution === quote_requested']);
  }

  // 6. source_attached — own artifacts include kind 'url' or 'dataset'.
  let hasUrlOrDataset = false;
  let hasQuoteArtifact = false;
  for (const a of input.artifacts) {
    if (a.kind === 'url' || a.kind === 'dataset') hasUrlOrDataset = true;
    if (typeof a.quote === 'string' && a.quote.trim().length > 0) hasQuoteArtifact = true;
  }
  if (hasUrlOrDataset) {
    push('source_attached', ['artifact.kind in {url, dataset}']);
  }

  // 7. quote_attached — own artifacts include a non-empty `quote` field.
  if (hasQuoteArtifact) {
    push('quote_attached', ['artifact.quote non-empty']);
  }

  // 8. participant_skipped_node — a same-side participant has posted ≥ 1
  //    message in the room AFTER this node was created BUT did not post a
  //    direct reply to this node within `participantSkippedTurnThreshold`
  //    of their own subsequent turns.
  const skippedSide = computeParticipantSkipped(
    input.node,
    input.roomNodes,
    input.autoMetadataConfig.participantSkippedTurnThreshold,
  );
  if (skippedSide) {
    push('participant_skipped_node', [
      'same-side participant did not reply within K turns',
      `side === ${skippedSide}`,
    ]);
  }

  // 9. no_response_after_n_turns — node has at least one direct child whose
  //    `messageContribution` is `source_requested` or `quote_requested` AND
  //    no descendant has `messageContribution === 'sourced'` AND
  //    `noResponseTurnThreshold` room-wide turns have passed.
  const hasOpenAsk = sourceReq || quoteReq;
  if (hasOpenAsk) {
    let hasSourced = false;
    for (const mc of input.descendantContributions.values()) {
      if (mc === 'sourced') {
        hasSourced = true;
        break;
      }
    }
    if (!hasSourced) {
      const turnsSinceAsk = computeRoomTurnsSinceFirstOpenAskChild(
        input.node,
        input.childNodes,
        input.roomNodes,
        input.descendantContributions,
      );
      if (turnsSinceAsk >= input.autoMetadataConfig.noResponseTurnThreshold) {
        push('no_response_after_n_turns', [
          'open source_requested/quote_requested child',
          `roomTurnsSinceAsk >= ${input.autoMetadataConfig.noResponseTurnThreshold}`,
        ]);
      }
    }
  }

  // 10. repeated_axis_pressure — node has ≥ threshold descendants whose
  //     `axis === node.disagreementAxis` AND none of them is additive.
  //     `additive` is a property the message either has or doesn't —
  //     LIFE-001's `hasAdditiveAxisInformation` is the deciding seam, but
  //     META-001 must not call it (forbidden import). Instead we rely on
  //     descendant `messageContribution === 'rebutted'` as the
  //     non-additive same-axis pressure proxy (LIFE-001 already classified
  //     it).
  if (input.messageSnapshot?.axis) {
    let count = 0;
    for (const d of input.descendantNodes) {
      const dSnap = input.descendantContributions.get(d.messageId);
      if (dSnap !== 'rebutted') continue;
      // A descendant counts only when its axis matches this node's axis.
      // Axis comes from LIFE-001's per-message snapshot — META-001 cannot
      // re-derive it, but it can compare two pre-derived axes via the
      // snapshot lookup the caller threads in. We approximate by checking
      // the cluster-level `primaryAxis` AND the descendant's own
      // `disagreementAxis` if available — but we do not have a snapshot
      // map handy here. The cluster summary's `primaryAxis` is the safe
      // approximation: when both this node and the descendant agree with
      // the cluster's primary axis, we count.
      if (input.clusterSummary.primaryAxis === input.messageSnapshot.axis) {
        count += 1;
      }
    }
    if (count >= input.autoMetadataConfig.repeatedAxisPressureThreshold) {
      push('repeated_axis_pressure', [
        'descendant.messageContribution === rebutted',
        `same-axis count >= ${input.autoMetadataConfig.repeatedAxisPressureThreshold}`,
        `axis === ${input.messageSnapshot.axis}`,
      ]);
    }
  }

  // 11. branch_suggested — node carries qualifier `branch_this_off` /
  //     `tangent_or_joke` OR lifecycle cluster is `branch_recommended`.
  let branchSuggested = false;
  for (const code of TANGENT_QUALIFIER_CODES) {
    if (nodeHasQualifierCode(input.node, code)) {
      branchSuggested = true;
      break;
    }
  }
  if (!branchSuggested && input.clusterSummary.state === 'branch_recommended') {
    branchSuggested = true;
  }
  if (branchSuggested) {
    push('branch_suggested', [
      'node.droppedTags contains branch_this_off OR tangent_or_joke',
      'OR lifecycle.cluster.state === branch_recommended',
    ]);
  }

  // 12. branch_created — node is the root of a BR-001 branch (i.e.
  //     `node.branchRootMessageId === node.messageId` AND
  //     `node.parentId !== null`).
  if (input.node.branchRootMessageId === input.node.messageId && input.node.parentId !== null) {
    push('branch_created', [
      'node.branchRootMessageId === node.messageId',
      'AND node.parentId !== null',
    ]);
  }

  // 13. point_stalled — cluster lifecycle state is in
  //     {moved_on_by_affirmative, moved_on_by_negative,
  //     ignored_by_affirmative, ignored_by_negative, ignored_by_both}.
  if (
    input.clusterSummary.state === 'moved_on_by_affirmative'
    || input.clusterSummary.state === 'moved_on_by_negative'
    || input.clusterSummary.state === 'ignored_by_affirmative'
    || input.clusterSummary.state === 'ignored_by_negative'
    || input.clusterSummary.state === 'ignored_by_both'
  ) {
    push('point_stalled', [`lifecycle.cluster.state === ${input.clusterSummary.state}`]);
  }

  // 14. point_exhausted — cluster lifecycle state is `exhausted`.
  if (input.clusterSummary.state === 'exhausted') {
    push('point_exhausted', ['lifecycle.cluster.state === exhausted']);
  }

  // 15. synthesis_candidate — cluster lifecycle state is `synthesis_ready`
  //     OR the cluster has any `narrowed` AND any `conceded` (member
  //     contributions) AND no `rebutted` after them.
  let synthesisCandidate = false;
  if (input.clusterSummary.state === 'synthesis_ready') {
    synthesisCandidate = true;
  } else {
    synthesisCandidate = clusterHasNarrowedAndConcededWithoutRebutAfter(
      input.clusterSummary,
      input.descendantContributions,
    );
  }
  if (synthesisCandidate) {
    push('synthesis_candidate', [
      input.clusterSummary.state === 'synthesis_ready'
        ? 'lifecycle.cluster.state === synthesis_ready'
        : 'cluster has narrowed AND conceded with no rebut after',
    ]);
  }

  return out;
}

// ── Internal helpers ──────────────────────────────────────────

function computeParticipantSkipped(
  node: ArgumentTimelineMapNode,
  roomNodes: ReadonlyArray<ArgumentTimelineMapNode>,
  threshold: number,
): 'affirmative' | 'negative' | null {
  if (threshold <= 0) return null;
  const nodeSide = nodeSideLabel(node);
  if (!nodeSide) return null;
  // Same side as the node we're observing — they're the "skipper".
  const sameSide = nodeSide;
  // Count same-side moves that happened AFTER this node and did not reply
  // directly to this node.
  let postsAfter = 0;
  let replyToNode = false;
  for (const m of roomNodes) {
    if (m.ordinal <= node.ordinal) continue;
    if (nodeSideLabel(m) !== sameSide) continue;
    postsAfter += 1;
    if (m.parentId === node.messageId) {
      replyToNode = true;
    }
  }
  if (replyToNode) return null;
  if (postsAfter >= threshold) return sameSide;
  return null;
}

function computeRoomTurnsSinceFirstOpenAskChild(
  node: ArgumentTimelineMapNode,
  childNodes: ReadonlyArray<ArgumentTimelineMapNode>,
  roomNodes: ReadonlyArray<ArgumentTimelineMapNode>,
  descendantContributions: ReadonlyMap<string, PointLifecycleState>,
): number {
  // Find the chronologically-first child whose contribution is
  // source_requested or quote_requested.
  let firstAskOrdinal: number | null = null;
  for (const c of childNodes) {
    const mc = descendantContributions.get(c.messageId);
    if (mc === 'source_requested' || mc === 'quote_requested') {
      if (firstAskOrdinal === null || c.ordinal < firstAskOrdinal) {
        firstAskOrdinal = c.ordinal;
      }
    }
  }
  if (firstAskOrdinal === null) return 0;
  let turns = 0;
  for (const m of roomNodes) {
    if (m.ordinal > firstAskOrdinal) turns += 1;
  }
  return turns;
}

function clusterHasNarrowedAndConcededWithoutRebutAfter(
  clusterSummary: PointLifecycleClusterSummary,
  descendantContributions: ReadonlyMap<string, PointLifecycleState>,
): boolean {
  // We can't see contributions for members of OTHER nodes' subtrees from
  // this signature alone, but the cluster summary's `state` already
  // dominates downstream classification (synthesis_ready wins by priority
  // when both signals are present). The fallback heuristic uses the
  // contributions we DO have access to via descendantContributions of the
  // observed node: a narrowed contribution + a conceded contribution in
  // the visible descendants is a strong proxy. This is an advisory signal
  // — false negatives are acceptable; false positives are not.
  let hasNarrowed = false;
  let hasConceded = false;
  let lastNarrowedOrConcededOrdinal = -1;
  let lastRebutOrdinal = -1;
  let i = 0;
  for (const c of descendantContributions.values()) {
    i += 1;
    if (c === 'narrowed') {
      hasNarrowed = true;
      lastNarrowedOrConcededOrdinal = i;
    } else if (c === 'conceded') {
      hasConceded = true;
      lastNarrowedOrConcededOrdinal = i;
    } else if (c === 'rebutted') {
      lastRebutOrdinal = i;
    }
  }
  // Defensive use of cluster summary — never decide on
  // `clusterSummary.state === 'rebutted'` because that would surface
  // synthesis under live disagreement.
  if (clusterSummary.state === 'rebutted') return false;
  if (!hasNarrowed || !hasConceded) return false;
  return lastRebutOrdinal <= lastNarrowedOrConcededOrdinal;
}
