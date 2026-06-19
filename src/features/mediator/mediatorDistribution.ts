/**
 * UX-MEDIATOR-005 — Disagreement state-distribution roll-up (pure TypeScript).
 *
 * A read-only composition of the rail's already-selected live points, bucketed
 * by their v4 DISPLAY state (UX-MEDIATOR-001's `v4DisplayStateFor`) and ordered
 * by the canonical `V4_PRIMARY_STATE_PRIORITY` (impasse-first). The rail renders
 * this as a flex-weighted distribution bar above the row list.
 *
 * Doctrine: this is a STRUCTURE composition, never a scoreboard. Ordering is by
 * structural priority — NEVER by count magnitude, votes, heat, or engagement.
 * Each segment width shows COMPOSITION (count / total), not popularity. The
 * terminal/suppressed `resolved_or_settled` state is excluded — a resolved point
 * is not a live disagreement. This re-reads the same live points the rows render;
 * it adds NO second derivation (single-derivation invariant).
 *
 * Pure TS. No React. No Supabase. No fetch. No clock. No randomness. No input
 * mutation. Deterministic. JSON-serializable output.
 */
import {
  V4_PRIMARY_STATE_PRIORITY,
  type DisagreementPoint,
  type V4MediatorStateCode,
} from './mediatorBoardTypes';
import { v4DisplayStateFor } from './deriveMediatorBoardState';
import { plainLanguageForMediatorState } from './mediatorPlainLanguage';

/**
 * One bucket of the distribution: a v4 display state, how many live points fall
 * into it, and its plain-language label. Only non-empty buckets are emitted.
 */
export interface DisagreementDistributionSegment {
  /** The nine-state v4 display vocabulary (never the raw 13-code internal). */
  displayState: V4MediatorStateCode;
  /** Number of live points whose projected display state is this bucket. */
  count: number;
  /** Plain-language label (ban-list clean) — `plainLanguageForMediatorState`. */
  plainLabel: string;
}

/**
 * Bucket the live points by their v4 display state and emit ordered,
 * non-empty segments (highest structural priority first).
 *
 * - Each point's internal `point.state` is projected through `v4DisplayStateFor`
 *   so the bar shares the node chip's nine-state display vocabulary (O-1).
 * - Any point whose display projection is `resolved_or_settled` (terminal /
 *   suppressed) is excluded from the distribution — it is not a live state.
 *   (`selectLivePoints` already filters resolved points; this is the belt-and-
 *   suspenders guard so the helper is correct on any input.)
 * - Order is `V4_PRIMARY_STATE_PRIORITY`, NEVER count magnitude.
 * - Segment counts sum to the number of non-terminal live points.
 */
export function buildDisagreementDistribution(
  livePoints: ReadonlyArray<DisagreementPoint>,
): ReadonlyArray<DisagreementDistributionSegment> {
  const counts = new Map<V4MediatorStateCode, number>();
  if (Array.isArray(livePoints)) {
    for (const point of livePoints) {
      if (!point) continue;
      const displayState = v4DisplayStateFor(point.state);
      // Terminal / suppressed — not a live disagreement state.
      if (displayState === 'resolved_or_settled') continue;
      counts.set(displayState, (counts.get(displayState) ?? 0) + 1);
    }
  }

  const segments: DisagreementDistributionSegment[] = [];
  for (const displayState of V4_PRIMARY_STATE_PRIORITY) {
    const count = counts.get(displayState) ?? 0;
    if (count <= 0) continue;
    segments.push({
      displayState,
      count,
      plainLabel: plainLanguageForMediatorState(displayState),
    });
  }
  return segments;
}

/** Total live points represented by a distribution (sum of segment counts). */
export function totalDistributionCount(
  segments: ReadonlyArray<DisagreementDistributionSegment>,
): number {
  return segments.reduce((sum, s) => sum + s.count, 0);
}
