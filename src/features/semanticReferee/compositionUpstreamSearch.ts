/**
 * COMP-001 §13.2 + §11 R-1 — Upstream-search helper.
 *
 * Walks up an ancestor chain from the current move toward the root, calling
 * a predicate on each ancestor. Returns the FIRST (most-recent) ancestor for
 * which the predicate returns true, or `null` when none matches.
 *
 * Used by R-EV-02 / R-CM-01 / R-CM-02 / R-CM-03 / R-PC-04 / R-EV-06. Extracted
 * to its own module so callers (tests, the smoke-test orchestrator) can
 * import it without coupling to the rule list — and so its edge cases
 * (deleted ancestors, missing parentIds, very deep chains) live in their
 * own test file (`__tests__/compositionUpstreamSearch.test.ts`).
 *
 * Pure TS — no Supabase, no React, no network, no async.
 */

import type { AncestorMoveSummaryChain } from './compositionTypes';

/**
 * The predicate's return value when an ancestor matches. Callers may attach
 * a `matchReason` for trace/debug — composition rules ignore the field.
 */
export interface AncestorMatch {
  readonly moveId: string;
  readonly matchedAtIndex: number;
}

/** The predicate signature. */
export type AncestorPredicate = (
  ancestor: AncestorMoveSummaryChain[number],
  indexFromImmediateParent: number,
) => boolean;

/**
 * Walk up the chain from the most-recent ancestor (immediate parent)
 * toward the root, returning the first match.
 *
 * The chain is supplied OLDEST-FIRST (`ancestors[0]` is root,
 * `ancestors[ancestors.length-1]` is the immediate parent). This helper
 * reverses the iteration so the immediate parent is visited first.
 *
 * Edge cases:
 *   - empty chain → returns `null` (no ancestors to search).
 *   - missing `parentId` on a link → treated as a structural gap; the helper
 *     does NOT skip the move (callers may inspect it), but it does not
 *     follow the broken link further upward.
 *   - very-deep chains → simple O(N) reverse iteration; no recursion, no
 *     stack-overflow risk at v1 room sizes (practical ceiling ≈ 100).
 *
 * The helper is intentionally INDIFFERENT to deletion state — the design
 * §13 Q4 keeps deletion handling at the render layer.
 */
export function findUpstreamMove(
  ancestors: AncestorMoveSummaryChain | undefined,
  predicate: AncestorPredicate,
): AncestorMatch | null {
  if (!ancestors || ancestors.length === 0) {
    return null;
  }
  // Walk newest-first (immediate parent → root).
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const indexFromImmediateParent = ancestors.length - 1 - i;
    const ancestor = ancestors[i];
    if (!ancestor) {
      continue;
    }
    if (predicate(ancestor, indexFromImmediateParent)) {
      return Object.freeze({
        moveId: ancestor.moveId,
        matchedAtIndex: i,
      });
    }
  }
  return null;
}

/**
 * Convenience helper — finds the most-recent ancestor authored by a
 * DIFFERENT author than the current move's `authorId`. Used by R-CM-02.
 */
export function findUpstreamByDifferentAuthor(
  ancestors: AncestorMoveSummaryChain | undefined,
  currentAuthorId: string,
  axisFilter?: string | null,
): AncestorMatch | null {
  return findUpstreamMove(ancestors, (ancestor) => {
    if (ancestor.authorId === currentAuthorId) {
      return false;
    }
    if (axisFilter != null && axisFilter.length > 0) {
      if (ancestor.disagreementAxis !== axisFilter) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Convenience helper — finds the most-recent ancestor authored by the SAME
 * author as the current move's `authorId`. Used by R-CM-01 (find the
 * broader-scoped ancestor by the same author).
 */
export function findUpstreamBySameAuthor(
  ancestors: AncestorMoveSummaryChain | undefined,
  currentAuthorId: string,
): AncestorMatch | null {
  return findUpstreamMove(ancestors, (ancestor) => {
    return ancestor.authorId === currentAuthorId;
  });
}
