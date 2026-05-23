/**
 * MCP-MOD-006 — Banner library fuzz-parity test.
 *
 * Asserts the post-refactor `selectBanner` produces byte-identical
 * `BannerSelectionResult`s for 50 deterministically-generated random
 * `BannerSelectionInput` instances, versus a frozen pre-refactor reference
 * implementation defined in this file.
 *
 * The reference impl mirrors the pre-MCP-MOD-006 `CLASSIFIER_TO_BANNERS`
 * table verbatim (literal data, no catalog lookup) and reproduces the same
 * `buildPool` + confidence + ranking steps that `selectBanner.ts` performs.
 * Post-refactor `selectBanner` reads `CLASSIFIER_TO_BANNERS` (which is now a
 * derived view over the catalog's `bannerCodePriorityList`) — if the catalog
 * extension or the derived view drifts, this test fails.
 *
 * The RNG is seeded with a committed fixed value so the corpus is identical
 * across runs and CI. The reference impl is local to this test file (the
 * `localOnly` prefix) and never leaks to production.
 */

import {
  selectBanner,
  BANNER_CATEGORY_PRIORITY,
} from '../src/features/refereeBanners';
import type {
  BannerSelectionInput,
  BannerSelectionResult,
  RefereeBanner,
  RefereeBannerConfidence,
} from '../src/features/refereeBanners';
import {
  BANNER_BY_CODE,
  INTENTIONALLY_SILENT_CLASSIFIERS,
} from '../src/features/refereeBanners/refereeBannerLibrary';
import {
  FEEDBACK_CODE_TO_BANNER,
} from '../src/features/refereeBanners/classifierBannerMap';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee';
import type { SemanticClassifierId } from '../src/features/semanticReferee/semanticRefereeTypes';
import {
  ALL_REFEREE_FEEDBACK_CODES,
  ALL_RECONCILIATION_OUTCOMES,
} from '../src/features/refereeLedger/types';
import type {
  RefereeFeedbackCode,
  ReconciliationOutcome,
  LedgerConfidence,
} from '../src/features/refereeLedger/types';

// ── Pre-refactor reference data ───────────────────────────────────
//
// The `CLASSIFIER_TO_BANNERS` literal table EXACTLY as it stood pre-MCP-MOD-006.
// Authored from the inline `Object.freeze` block that lived in
// `src/features/refereeBanners/classifierBannerMap.ts` before this card.
// Frozen at module load. Not exported; only the reference impl reads this.

const localOnlyClassifierToBanners: Readonly<
  Record<SemanticClassifierId, readonly string[]>
> = Object.freeze({
  responds_to_parent: Object.freeze([
    'continuity_clean_tie',
    'continuity_engages_mechanism',
    'continuity_picks_up_thread',
  ]),
  introduces_new_issue: Object.freeze([
    'tangent_new_issue_here',
    'branch_belongs_on_branch',
  ]),
  asks_for_evidence: Object.freeze([
    'evidence_debt_opened',
    'evidence_debt_a_source_would_help',
  ]),
  provides_evidence: Object.freeze([
    'evidence_debt_source_attached',
    'evidence_debt_resolved',
  ]),
  evidence_supports_claim: Object.freeze([
    'evidence_debt_resolved',
    'evidence_debt_source_attached',
  ]),
  quote_anchors_parent: Object.freeze([
    'clever_rebuttal_anchored',
    'continuity_clean_tie',
  ]),
  narrows_claim: Object.freeze([
    'synthesis_nice_narrowing',
    'synthesis_narrow_concession_noted',
  ]),
  concedes_narrow_point: Object.freeze([
    'synthesis_narrow_concession_noted',
    'synthesis_nice_narrowing',
  ]),
  requests_clarification: Object.freeze([
    'continuity_clarification_landed',
    'quote_needed_pin_the_passage',
  ]),
  answers_clarification: Object.freeze([
    'continuity_clarification_landed',
    'continuity_answers_question',
  ]),
  shifts_to_person_or_intent: Object.freeze([
    'hot_take_keeps_it_about_the_claim',
  ]),
  uses_popularity_as_evidence: Object.freeze([
    'source_chain_gap_popularity_not_proof',
  ]),
  contains_playable_hot_take: Object.freeze([
    'hot_take_playable',
    'hot_take_has_an_edge',
    'hot_take_room_can_engage',
  ]),
  contains_unplayable_insult_only: Object.freeze([]),
  is_satire_or_parody: Object.freeze(['hot_take_invites_a_reply']),
  uses_satire_as_evidence: Object.freeze([
    'source_chain_gap_satire_not_evidence',
  ]),
  cites_retraction: Object.freeze(['source_chain_gap_retraction_noted']),
  creates_source_chain_gap: Object.freeze([
    'source_chain_gap_chain_breaks',
    'source_chain_gap_trace_it_back',
    'source_chain_gap_one_more_link',
  ]),
  suggests_side_branch: Object.freeze([
    'branch_new_voice_welcome',
    'branch_belongs_on_branch',
  ]),
  suggests_diagonal_tangent: Object.freeze([
    'tangent_different_axis',
    'tangent_new_issue_here',
  ]),
  fits_selected_debate_mode: Object.freeze([
    'mode_mismatch_fits_the_room',
  ]),
  needs_pre_send_pause: Object.freeze([
    'pacing_a_pause_before_sending',
    'pacing_take_a_short_pause',
  ]),
  ready_for_synthesis: Object.freeze([
    'synthesis_shared_ground_named',
    'synthesis_almost_there',
    'synthesis_sides_converging',
  ]),
});

// ── Pre-refactor reference impl ───────────────────────────────────
//
// Byte-faithful re-implementation of `selectBanner.ts` that reads the
// pre-MCP-MOD-006 `localOnlyClassifierToBanners` table rather than the live
// (derived) `CLASSIFIER_TO_BANNERS` import. Every other piece of logic
// (confidence handling, category priority, conflict_routed, malformed-input
// guard) is identical to the live implementation.

const LOCAL_ONLY_CONFLICT_ROUTED_BANNER_CODE = 'pacing_you_decide_the_lane';

const LOCAL_ONLY_CONFIDENCE_RANK: Readonly<Record<RefereeBannerConfidence, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

interface LocalOnlyPoolCandidate {
  bannerCode: string;
  confidence: RefereeBannerConfidence;
}

function localOnlyBuildPool(input: BannerSelectionInput): {
  pool: LocalOnlyPoolCandidate[];
  skipped: string[];
} {
  const pool: LocalOnlyPoolCandidate[] = [];
  const skipped: string[] = [];

  for (const binary of input.positiveBinaries) {
    if (INTENTIONALLY_SILENT_CLASSIFIERS.has(binary.classifierId)) {
      continue;
    }
    const codes = localOnlyClassifierToBanners[binary.classifierId];
    if (!codes) {
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

function localOnlyResolveConfidence(candidate: LocalOnlyPoolCandidate): RefereeBanner | null {
  const banner = BANNER_BY_CODE.get(candidate.bannerCode);
  if (!banner) return null;
  if (LOCAL_ONLY_CONFIDENCE_RANK[candidate.confidence] >= LOCAL_ONLY_CONFIDENCE_RANK[banner.minConfidence]) {
    return banner;
  }
  if (banner.softenedSiblingCode) {
    const sibling = BANNER_BY_CODE.get(banner.softenedSiblingCode);
    if (sibling) return sibling;
  }
  return null;
}

function localOnlySelectBanner(input: BannerSelectionInput): BannerSelectionResult {
  if (
    !input ||
    typeof input !== 'object' ||
    !Array.isArray(input.positiveBinaries) ||
    !Array.isArray(input.categoryReadings)
  ) {
    return { banner: null, selectionTrace: 'malformed_input' };
  }

  const hasRoutedConflict = input.categoryReadings.some(
    (reading) =>
      reading.outcome === 'conflict_routed' || reading.requiresUserChoice === true,
  );
  if (hasRoutedConflict) {
    const routed = BANNER_BY_CODE.get(LOCAL_ONLY_CONFLICT_ROUTED_BANNER_CODE);
    if (routed) {
      return {
        banner: routed,
        selectionTrace: `conflict_routed:${LOCAL_ONLY_CONFLICT_ROUTED_BANNER_CODE}`,
      };
    }
    return { banner: null, selectionTrace: 'conflict_routed_banner_missing' };
  }

  const { pool, skipped } = localOnlyBuildPool(input);
  if (pool.length === 0) {
    const trace =
      skipped.length > 0 ? `empty_pool:skipped(${skipped.join(',')})` : 'empty_pool';
    return { banner: null, selectionTrace: trace };
  }

  const survivors: RefereeBanner[] = [];
  for (const candidate of pool) {
    const resolved = localOnlyResolveConfidence(candidate);
    if (resolved) survivors.push(resolved);
  }
  if (survivors.length === 0) {
    return { banner: null, selectionTrace: 'all_suppressed_low_confidence' };
  }

  let winner: RefereeBanner | null = null;
  let winnerPriority = Number.POSITIVE_INFINITY;
  for (const banner of survivors) {
    const priority = BANNER_CATEGORY_PRIORITY.indexOf(banner.category);
    const effectivePriority = priority === -1 ? Number.MAX_SAFE_INTEGER : priority;
    if (effectivePriority < winnerPriority) {
      winnerPriority = effectivePriority;
      winner = banner;
    }
  }

  if (!winner) {
    return { banner: null, selectionTrace: 'no_winner' };
  }
  const skippedNote = skipped.length > 0 ? `;skipped(${skipped.join(',')})` : '';
  return {
    banner: winner,
    selectionTrace: `selected:${winner.bannerCode}@${winner.category}${skippedNote}`,
  };
}

// ── Deterministic RNG (mulberry32) ────────────────────────────────
//
// Tiny seeded PRNG. The committed seed value below must NEVER change without
// re-capturing the corpus — that is the whole point of a frozen fuzz suite.

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMMITTED_SEED = 0x6dcb5106; // MCP-MOD-006 fuzz seed — do not change.

const SEMANTIC_CONFIDENCES: ReadonlyArray<RefereeBannerConfidence> = ['low', 'medium', 'high'];
const LEDGER_CONFIDENCES: ReadonlyArray<LedgerConfidence> = ['low', 'medium', 'high'];
const FEEDBACK_CODES: ReadonlyArray<RefereeFeedbackCode> = ALL_REFEREE_FEEDBACK_CODES;
const OUTCOMES: ReadonlyArray<ReconciliationOutcome> = ALL_RECONCILIATION_OUTCOMES;

function pickOne<T>(rng: () => number, arr: ReadonlyArray<T>): T {
  return arr[Math.floor(rng() * arr.length)];
}

function generatePacket(rng: () => number): BannerSelectionInput {
  const numBinaries = Math.floor(rng() * 4); // 0..3
  const positiveBinaries: Array<{
    classifierId: SemanticClassifierId;
    confidence: RefereeBannerConfidence;
  }> = [];
  for (let i = 0; i < numBinaries; i++) {
    positiveBinaries.push({
      classifierId: pickOne(rng, ALL_SEMANTIC_CLASSIFIER_IDS) as SemanticClassifierId,
      confidence: pickOne(rng, SEMANTIC_CONFIDENCES),
    });
  }
  const numReadings = Math.floor(rng() * 3); // 0..2
  const categoryReadings: Array<{
    feedbackCode: RefereeFeedbackCode;
    confidence: LedgerConfidence;
    outcome: ReconciliationOutcome;
    requiresUserChoice: boolean;
  }> = [];
  for (let i = 0; i < numReadings; i++) {
    const outcome = pickOne(rng, OUTCOMES);
    categoryReadings.push({
      feedbackCode: pickOne(rng, FEEDBACK_CODES),
      confidence: pickOne(rng, LEDGER_CONFIDENCES),
      outcome,
      requiresUserChoice: outcome === 'conflict_routed',
    });
  }
  return { positiveBinaries, categoryReadings };
}

// ── The test ──────────────────────────────────────────────────────

describe('MCP-MOD-006 — selectBanner fuzz-parity (50 random packets)', () => {
  const rng = makeRng(COMMITTED_SEED);
  const fixtures: BannerSelectionInput[] = [];
  for (let i = 0; i < 50; i++) fixtures.push(generatePacket(rng));

  it('the corpus has the expected size and shape', () => {
    expect(fixtures).toHaveLength(50);
    for (const fixture of fixtures) {
      expect(Array.isArray(fixture.positiveBinaries)).toBe(true);
      expect(Array.isArray(fixture.categoryReadings)).toBe(true);
    }
  });

  it('post-refactor selectBanner returns byte-identical BannerSelectionResult for all 50 fixtures', () => {
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      const live = selectBanner(fixture);
      const reference = localOnlySelectBanner(fixture);
      expect({ index: i, ...live }).toEqual({ index: i, ...reference });
    }
  });

  it('the reference impl produces deterministic output for the same input', () => {
    const a = localOnlySelectBanner(fixtures[0]);
    const b = localOnlySelectBanner(fixtures[0]);
    expect(a).toEqual(b);
  });

  it('the live impl produces deterministic output for the same input', () => {
    const a = selectBanner(fixtures[7]);
    const b = selectBanner(fixtures[7]);
    expect(a).toEqual(b);
  });

  it('the reference impl is local to this test file (sanity — it must not be the live impl)', () => {
    // A defensive cross-check: confirm the two functions are distinct objects.
    expect(localOnlySelectBanner).not.toBe(selectBanner);
  });
});
