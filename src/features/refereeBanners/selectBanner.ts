/**
 * MCP-014 — Referee banner: the deterministic selection model.
 *
 * `selectBanner(input)` turns a `BannerSelectionInput` (built upstream from a
 * `SemanticRefereePacket` and/or a `LedgerResult`) into at most ONE banner.
 * Same input → same `BannerSelectionResult` every call: no randomness, no
 * clock, no model call, no network.
 *
 * Algorithm (MCP-008 §5.4, MCP-014 design § "selectBanner"):
 *   1. Build the candidate pool from `positiveBinaries` + `categoryReadings`.
 *   2. Force the `pacing_you_decide_the_lane` banner on any `conflict_routed`
 *      reading — a routed conflict never produces a confident line.
 *   3. Apply confidence handling — keep / swap to softened sibling / drop.
 *   4. Rank by `BANNER_CATEGORY_PRIORITY`; ties break by pool order.
 *   5. Return at most one banner. `null` is a valid, common, correct result.
 *
 * Pure TypeScript. No network. No Supabase. No React.
 */

import {
  BANNER_BY_CODE,
  INTENTIONALLY_SILENT_CLASSIFIERS,
} from './refereeBannerLibrary';
import {
  CLASSIFIER_TO_BANNERS,
  FEEDBACK_CODE_TO_BANNER,
} from './classifierBannerMap';
import type {
  BannerSelectionInput,
  BannerSelectionResult,
  RefereeBanner,
  RefereeBannerCategory,
  RefereeBannerConfidence,
} from './types';

/**
 * The fixed category-priority order (highest first) — most-actionable wins.
 * MCP-008 §5.4 step 3. A documented constant; never random, never time-based.
 */
export const BANNER_CATEGORY_PRIORITY: readonly RefereeBannerCategory[] = [
  'pacing_cooldown', // 1 — time-sensitive
  'source_chain_gap', // 2
  'evidence_debt', // 3
  'quote_needed', // 4
  'mechanism_needed', // 5
  'tangent_suggestion', // 6
  'branch_suggestion', // 7
  'mode_mismatch', // 8
  'continuity', // 9
  'synthesis_readiness', // 10
  'clever_rebuttal', // 11
  'hot_take', // 12
];

/** The routing banner force-selected for any `conflict_routed` reading. */
const CONFLICT_ROUTED_BANNER_CODE = 'pacing_you_decide_the_lane';

/** Confidence ranks — higher is more confident. */
const CONFIDENCE_RANK: Readonly<Record<RefereeBannerConfidence, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** One candidate in the pool — a banner code paired with its source confidence. */
interface PoolCandidate {
  bannerCode: string;
  confidence: RefereeBannerConfidence;
}

/**
 * Build the candidate pool: every classifier-derived banner, then every
 * feedback-code-derived banner, each paired with its source confidence.
 * Deterministic order: `positiveBinaries` order, then `categoryReadings`
 * order, then the `CLASSIFIER_TO_BANNERS` array order within each binary.
 */
function buildPool(input: BannerSelectionInput): {
  pool: PoolCandidate[];
  skipped: string[];
} {
  const pool: PoolCandidate[] = [];
  const skipped: string[] = [];

  for (const binary of input.positiveBinaries) {
    // An id in INTENTIONALLY_SILENT_CLASSIFIERS contributes nothing — its map
    // value is [] so the loop below is empty anyway; the skip is asserted
    // defensively here so a future map edit cannot accidentally surface it.
    if (INTENTIONALLY_SILENT_CLASSIFIERS.has(binary.classifierId)) {
      continue;
    }
    const codes = CLASSIFIER_TO_BANNERS[binary.classifierId];
    if (!codes) {
      // Impossible at the type level; recorded defensively, never thrown.
      skipped.push(`unknown_classifier:${String(binary.classifierId)}`);
      continue;
    }
    for (const bannerCode of codes) {
      if (!BANNER_BY_CODE.has(bannerCode)) {
        skipped.push(`unknown_banner:${bannerCode}`);
        continue;
      }
      pool.push({ bannerCode, confidence: binary.confidence });
    }
  }

  for (const reading of input.categoryReadings) {
    const bannerCode = FEEDBACK_CODE_TO_BANNER[reading.feedbackCode];
    if (!bannerCode) {
      skipped.push(`unknown_feedback_code:${String(reading.feedbackCode)}`);
      continue;
    }
    if (!BANNER_BY_CODE.has(bannerCode)) {
      skipped.push(`unknown_banner:${bannerCode}`);
      continue;
    }
    pool.push({ bannerCode, confidence: reading.confidence });
  }

  return { pool, skipped };
}

/**
 * Apply the confidence softening / suppression rule to one candidate.
 * Returns the resolved `RefereeBanner` to keep, or `null` to drop it.
 *
 * | source confidence | banner.minConfidence | action                         |
 * |-------------------|----------------------|--------------------------------|
 * | >= minConfidence  | any                  | keep as authored               |
 * | <  minConfidence  | has softened sibling | swap to sibling (minConf low)  |
 * | <  minConfidence  | no softened sibling  | drop                           |
 */
function resolveConfidence(
  candidate: PoolCandidate,
): RefereeBanner | null {
  const banner = BANNER_BY_CODE.get(candidate.bannerCode);
  if (!banner) return null;

  if (CONFIDENCE_RANK[candidate.confidence] >= CONFIDENCE_RANK[banner.minConfidence]) {
    return banner;
  }

  // Source confidence is below the banner's floor — soften or drop.
  if (banner.softenedSiblingCode) {
    const sibling = BANNER_BY_CODE.get(banner.softenedSiblingCode);
    // The sibling has minConfidence 'low', so it is never re-suppressed.
    if (sibling) return sibling;
  }
  return null;
}

/**
 * The deterministic banner selection entry point. Returns the same
 * `BannerSelectionResult` for the same `BannerSelectionInput` every call.
 */
export function selectBanner(input: BannerSelectionInput): BannerSelectionResult {
  // Defensive guard — a null / malformed input never throws.
  if (
    !input ||
    typeof input !== 'object' ||
    !Array.isArray(input.positiveBinaries) ||
    !Array.isArray(input.categoryReadings)
  ) {
    return { banner: null, selectionTrace: 'malformed_input' };
  }

  // Step 2 — force the conflict-routed banner. An unresolved routing decision
  // outranks every compliment; the pool is REPLACED, not appended to.
  const hasRoutedConflict = input.categoryReadings.some(
    (reading) =>
      reading.outcome === 'conflict_routed' || reading.requiresUserChoice === true,
  );
  if (hasRoutedConflict) {
    const routed = BANNER_BY_CODE.get(CONFLICT_ROUTED_BANNER_CODE);
    if (routed) {
      return {
        banner: routed,
        selectionTrace: `conflict_routed:${CONFLICT_ROUTED_BANNER_CODE}`,
      };
    }
    // Defensive — the routing banner is always in the library; never reached.
    return { banner: null, selectionTrace: 'conflict_routed_banner_missing' };
  }

  // Step 1 — build the candidate pool.
  const { pool, skipped } = buildPool(input);
  if (pool.length === 0) {
    const trace =
      skipped.length > 0 ? `empty_pool:skipped(${skipped.join(',')})` : 'empty_pool';
    return { banner: null, selectionTrace: trace };
  }

  // Step 3 — apply confidence handling to every pooled candidate, preserving
  // pool order. A dropped candidate carries no banner.
  const survivors: RefereeBanner[] = [];
  for (const candidate of pool) {
    const resolved = resolveConfidence(candidate);
    if (resolved) survivors.push(resolved);
  }
  if (survivors.length === 0) {
    return { banner: null, selectionTrace: 'all_suppressed_low_confidence' };
  }

  // Step 4 — rank by BANNER_CATEGORY_PRIORITY. The first survivor (pool order)
  // in the highest-priority category present wins. No randomness.
  let winner: RefereeBanner | null = null;
  let winnerPriority = Number.POSITIVE_INFINITY;
  for (const banner of survivors) {
    const priority = BANNER_CATEGORY_PRIORITY.indexOf(banner.category);
    // A category not in the priority list (impossible per the union) sorts last.
    const effectivePriority = priority === -1 ? Number.MAX_SAFE_INTEGER : priority;
    if (effectivePriority < winnerPriority) {
      winnerPriority = effectivePriority;
      winner = banner;
    }
  }

  // Step 5 — return at most one banner.
  if (!winner) {
    return { banner: null, selectionTrace: 'no_winner' };
  }
  const skippedNote = skipped.length > 0 ? `;skipped(${skipped.join(',')})` : '';
  return {
    banner: winner,
    selectionTrace: `selected:${winner.bannerCode}@${winner.category}${skippedNote}`,
  };
}
