/**
 * UX-001.5A — Priority model.
 *
 * Per-source default priority + per-mark priority comparator +
 * duplicate-text resolver. Pure TS — no React, no Supabase, no network.
 *
 * Rationale (per roadmap §"Deduplication rules"):
 *   - Manual tags (User Allegations) are participant intent, surfaced
 *     first when present.
 *   - Lifecycle is the most stable Machine Observation source.
 *   - Auto metadata is the second-most stable.
 *   - Semantic-referee composer is the next tier.
 *   - Composition mutation + AI classifier + future_source rank lowest
 *     (and are not emitted in v1 anyway).
 *
 * Pure TS. JSON-serializable. No new dependency.
 */

import type { NodeLabelMark, NodeLabelSource } from './nodeLabelTypes';

/**
 * Source-level priority for tie-breaking. Lower number = higher
 * priority. Frozen literal — no input, no mutation.
 */
export const PRIORITY_BY_SOURCE: Readonly<Record<NodeLabelSource, number>> = Object.freeze({
  manual_tag: 10,
  lifecycle: 20,
  auto_metadata: 30,
  semantic_referee: 40,
  composition_mutation: 50,
  ai_classifier: 60,
  future_source: 99,
});

/**
 * Compare two marks for display ordering. Lower-priority value sorts
 * first. Ties broken by source priority, then alphabetically by label.
 * Pure.
 */
export function comparePriorityThenAlphabetical(
  a: NodeLabelMark,
  b: NodeLabelMark,
): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  const aSrc = PRIORITY_BY_SOURCE[a.source];
  const bSrc = PRIORITY_BY_SOURCE[b.source];
  if (aSrc !== bSrc) return aSrc - bSrc;
  // Final tie — alphabetical by label for stable, deterministic ordering.
  if (a.label < b.label) return -1;
  if (a.label > b.label) return 1;
  return 0;
}

/**
 * Given two marks with the same `kind` + same text, return the one to
 * KEEP. The dropped mark is still represented in Inspect via the
 * un-deduped path. Pure.
 *
 * Resolution:
 *   - If sources differ, keep the higher-priority source per
 *     `PRIORITY_BY_SOURCE`.
 *   - If sources are equal, keep the one with the lower per-mark
 *     `priority` field.
 *   - If still tied, keep `a` (stable).
 */
export function resolveSourceForDuplicateText(
  a: NodeLabelMark,
  b: NodeLabelMark,
): NodeLabelMark {
  const aSrc = PRIORITY_BY_SOURCE[a.source];
  const bSrc = PRIORITY_BY_SOURCE[b.source];
  if (aSrc !== bSrc) return aSrc < bSrc ? a : b;
  if (a.priority !== b.priority) return a.priority < b.priority ? a : b;
  return a;
}
