/**
 * MCP-014 — Referee banner: plain-language coverage (cdiscourse-doctrine §9).
 *
 * Proves every bannerCode resolves through `toPlainLanguage` to its headline,
 * no resolved string leaks snake_case, an unknown code is suppressed (returns
 * null), and the MCP-014 block keys are disjoint from the pre-MCP-014
 * PLAIN_LANGUAGE_COPY key set (no collision with another feature's key).
 */

import { REFEREE_BANNER_LIBRARY } from '../src/features/refereeBanners';
import { toPlainLanguage } from '../src/features/arguments/gameCopy';

/**
 * Frozen snapshot of every PLAIN_LANGUAGE_COPY key that existed BEFORE the
 * MCP-014 bannerCode block was appended. Sourced from `gameCopy.ts` at the
 * MCP-013 ledger block boundary (the last pre-MCP-014 key is
 * `you_decide_the_lane`). MCP-014's bannerCode keys must be disjoint from this
 * set — a banner library never reuses another feature's key.
 */
const PRE_MCP014_KEYS: ReadonlySet<string> = new Set([
  // Validation rail codes
  'topic_satisfaction_lexical',
  'weak_relevance',
  'parent_nonresponsive',
  'tangent_shift',
  'off_topic',
  'weak_topic',
  'unclear_claim',
  'excessive_length',
  'invalid_transition',
  'evidence_required',
  'missing_parent',
  'loaded_clarification',
  'duplicate',
  'concession_evasion',
  'fact_confusion',
  'ad_hominem',
  'civility_risk',
  // Semantic-corpus axes / risks
  'source_chain',
  'anti_amplification',
  'evidence_debt',
  'platform_support_warning',
  'scope',
  'definition',
  'logic',
  'causal',
  // Runner / pipeline status
  'validation_failed_after_retries',
  'max_depth_reached',
  'synthesis_ready',
  'synthesis',
  'concession',
  'submit_failed',
  'three_in_a_row_failures',
  // Participant / role
  'observer',
  'moderator',
  'affirmative',
  'negative',
  'neutral',
  // LIFE-001 — Point lifecycle
  'open',
  'answered',
  'rebutted',
  'clarified',
  'sourced',
  'quote_requested',
  'source_requested',
  'narrowed',
  'conceded',
  'confirmed',
  'moved_on_by_affirmative',
  'moved_on_by_negative',
  'ignored_by_affirmative',
  'ignored_by_negative',
  'ignored_by_both',
  'exhausted',
  'branch_recommended',
  'archived_or_resolved',
  // META-001 — Manual tags
  'needs_source',
  'needs_quote',
  'definition_issue',
  'scope_issue',
  'causal_mechanism',
  'concession_offered',
  'narrowed_claim',
  'tangent',
  'ready_for_synthesis',
  // META-001 — Auto-derived metadata
  'has_reply',
  'has_rebuttal',
  'has_counter_rebuttal',
  'has_evidence',
  'source_attached',
  'quote_attached',
  'participant_skipped_node',
  'no_response_after_n_turns',
  'repeated_axis_pressure',
  'branch_suggested',
  'branch_created',
  'point_stalled',
  'point_exhausted',
  'synthesis_candidate',
  // MCP-013 — Referee ledger feedbackCode family
  'clean_parent_tie',
  'partial_parent_tie',
  'answered_the_question',
  'question_still_open',
  'evidence_debt_open',
  'evidence_connects',
  'evidence_needs_connecting',
  'nicely_anchored',
  'nice_narrowing',
  'concession_noted',
  'broad_point_set_down',
  'clarification_in_play',
  'almost_a_synthesis',
  'synthesis_named',
  'clean_branch',
  'belongs_on_a_branch',
  'back_to_the_claim',
  'debt_resolved',
  'fits_the_room',
  'pacing_is_on',
  'you_decide_the_lane',
]);

describe('MCP-014 plain-language — every bannerCode resolves to its headline', () => {
  it('toPlainLanguage(bannerCode) returns a non-null string equal to the headline', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      const plain = toPlainLanguage(banner.bannerCode);
      expect(plain).not.toBeNull();
      expect(plain).toBe(banner.headline);
    }
  });

  it('no toPlainLanguage(bannerCode) result contains an underscore (no snake_case leak)', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      const plain = toPlainLanguage(banner.bannerCode);
      expect(plain).not.toBeNull();
      expect((plain as string).includes('_')).toBe(false);
    }
  });
});

describe('MCP-014 plain-language — unknown codes are suppressed', () => {
  it('an unknown made-up code returns null from toPlainLanguage', () => {
    expect(toPlainLanguage('not_a_real_banner_zzz')).toBeNull();
  });

  it('an empty / nullish code returns null', () => {
    expect(toPlainLanguage('')).toBeNull();
    expect(toPlainLanguage(null)).toBeNull();
    expect(toPlainLanguage(undefined)).toBeNull();
  });
});

describe('MCP-014 plain-language — bannerCode keys are disjoint from pre-MCP-014 keys', () => {
  it('no bannerCode collides with a pre-existing PLAIN_LANGUAGE_COPY key', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      expect(
        PRE_MCP014_KEYS.has(banner.bannerCode)
          ? `collision: ${banner.bannerCode}`
          : null,
      ).toBeNull();
    }
  });

  it('every bannerCode is category-prefixed (no bare reuse of a feature key)', () => {
    const CATEGORY_PREFIXES = [
      'continuity_',
      'evidence_debt_',
      'hot_take_',
      'clever_rebuttal_',
      'source_chain_gap_',
      'branch_',
      'tangent_',
      'synthesis_',
      'quote_needed_',
      'mechanism_needed_',
      'mode_mismatch_',
      'pacing_',
    ];
    for (const banner of REFEREE_BANNER_LIBRARY) {
      const prefixed = CATEGORY_PREFIXES.some((p) =>
        banner.bannerCode.startsWith(p),
      );
      expect(prefixed ? null : `unprefixed: ${banner.bannerCode}`).toBeNull();
    }
  });
});
