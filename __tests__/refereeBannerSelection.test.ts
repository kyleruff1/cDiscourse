/**
 * MCP-014 — Referee banner: selectBanner determinism + category priority.
 *
 * Proves selectBanner is deterministic, an empty input yields a null banner,
 * BANNER_CATEGORY_PRIORITY is respected, pacing beats everything, at most one
 * banner is returned, ties break by pool order, and a malformed input never
 * throws.
 */

import {
  selectBanner,
  BANNER_CATEGORY_PRIORITY,
} from '../src/features/refereeBanners';
import type { BannerSelectionInput } from '../src/features/refereeBanners';

describe('MCP-014 selectBanner — determinism', () => {
  it('returns a deeply-equal result across repeated calls for the same input', () => {
    const input: BannerSelectionInput = {
      positiveBinaries: [
        { classifierId: 'responds_to_parent', confidence: 'high' },
        { classifierId: 'creates_source_chain_gap', confidence: 'medium' },
      ],
      categoryReadings: [
        {
          feedbackCode: 'source_attached',
          confidence: 'high',
          outcome: 'agreement',
          requiresUserChoice: false,
        },
      ],
    };
    const a = selectBanner(input);
    const b = selectBanner(input);
    const c = selectBanner(input);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });
});

describe('MCP-014 selectBanner — empty input', () => {
  it('an empty input yields { banner: null, selectionTrace: empty_pool }', () => {
    const result = selectBanner({ positiveBinaries: [], categoryReadings: [] });
    expect(result.banner).toBeNull();
    expect(result.selectionTrace).toBe('empty_pool');
  });

  it('null is a valid common result for an ordinary move', () => {
    const result = selectBanner({ positiveBinaries: [], categoryReadings: [] });
    expect(result.banner).toBeNull();
  });
});

describe('MCP-014 selectBanner — category priority', () => {
  it('a source_chain_gap candidate beats a co-occurring hot_take candidate', () => {
    const result = selectBanner({
      positiveBinaries: [
        { classifierId: 'contains_playable_hot_take', confidence: 'high' },
        { classifierId: 'creates_source_chain_gap', confidence: 'high' },
      ],
      categoryReadings: [],
    });
    expect(result.banner?.category).toBe('source_chain_gap');
  });

  it('a pacing_cooldown candidate beats every other category', () => {
    const result = selectBanner({
      positiveBinaries: [
        { classifierId: 'responds_to_parent', confidence: 'high' },
        { classifierId: 'creates_source_chain_gap', confidence: 'high' },
        { classifierId: 'needs_pre_send_pause', confidence: 'high' },
      ],
      categoryReadings: [],
    });
    expect(result.banner?.category).toBe('pacing_cooldown');
  });

  it('evidence_debt beats continuity (priority 3 vs 9)', () => {
    const result = selectBanner({
      positiveBinaries: [
        { classifierId: 'responds_to_parent', confidence: 'high' },
        { classifierId: 'asks_for_evidence', confidence: 'high' },
      ],
      categoryReadings: [],
    });
    expect(result.banner?.category).toBe('evidence_debt');
  });

  it('BANNER_CATEGORY_PRIORITY lists all 12 categories with pacing first and hot_take last', () => {
    expect(BANNER_CATEGORY_PRIORITY.length).toBe(12);
    expect(BANNER_CATEGORY_PRIORITY[0]).toBe('pacing_cooldown');
    expect(BANNER_CATEGORY_PRIORITY[BANNER_CATEGORY_PRIORITY.length - 1]).toBe(
      'hot_take',
    );
  });
});

describe('MCP-014 selectBanner — at most one banner', () => {
  it('the result banner is a single object or null, never an array', () => {
    const result = selectBanner({
      positiveBinaries: [
        { classifierId: 'responds_to_parent', confidence: 'high' },
        { classifierId: 'contains_playable_hot_take', confidence: 'high' },
        { classifierId: 'ready_for_synthesis', confidence: 'high' },
      ],
      categoryReadings: [],
    });
    expect(Array.isArray(result.banner)).toBe(false);
    expect(result.banner === null || typeof result.banner === 'object').toBe(true);
  });
});

describe('MCP-014 selectBanner — within-category tie breaks by pool order', () => {
  it('two same-category candidates pick the first-in-pool one', () => {
    // responds_to_parent maps to [continuity_clean_tie, continuity_engages_mechanism,
    // continuity_picks_up_thread] — all category 'continuity'. The first in pool
    // order at high confidence is continuity_clean_tie.
    const result = selectBanner({
      positiveBinaries: [
        { classifierId: 'responds_to_parent', confidence: 'high' },
      ],
      categoryReadings: [],
    });
    expect(result.banner?.bannerCode).toBe('continuity_clean_tie');
  });

  it('a packet-path candidate precedes a ledger-path candidate of the same category', () => {
    // Both feed a continuity candidate; the packet binary is processed first.
    const result = selectBanner({
      positiveBinaries: [
        { classifierId: 'answers_clarification', confidence: 'high' },
      ],
      categoryReadings: [
        {
          feedbackCode: 'answered_the_question',
          confidence: 'high',
          outcome: 'agreement',
          requiresUserChoice: false,
        },
      ],
    });
    // answers_clarification → [continuity_clarification_landed, continuity_answers_question]
    // The packet path is first; continuity_clarification_landed wins.
    expect(result.banner?.bannerCode).toBe('continuity_clarification_landed');
  });
});

describe('MCP-014 selectBanner — malformed input does not throw', () => {
  it('a null input returns { banner: null }', () => {
    const result = selectBanner(null as unknown as BannerSelectionInput);
    expect(result.banner).toBeNull();
    expect(result.selectionTrace).toBe('malformed_input');
  });

  it('an input missing positiveBinaries returns { banner: null }', () => {
    const result = selectBanner({
      categoryReadings: [],
    } as unknown as BannerSelectionInput);
    expect(result.banner).toBeNull();
    expect(result.selectionTrace).toBe('malformed_input');
  });

  it('an input missing categoryReadings returns { banner: null }', () => {
    const result = selectBanner({
      positiveBinaries: [],
    } as unknown as BannerSelectionInput);
    expect(result.banner).toBeNull();
    expect(result.selectionTrace).toBe('malformed_input');
  });
});

describe('MCP-014 selectBanner — intentionally silent classifier', () => {
  it('contains_unplayable_insult_only contributes no banner', () => {
    const result = selectBanner({
      positiveBinaries: [
        { classifierId: 'contains_unplayable_insult_only', confidence: 'high' },
      ],
      categoryReadings: [],
    });
    expect(result.banner).toBeNull();
    expect(result.selectionTrace).toBe('empty_pool');
  });

  it('an insult-only binary co-occurring with a real signal yields only the real banner', () => {
    const result = selectBanner({
      positiveBinaries: [
        { classifierId: 'contains_unplayable_insult_only', confidence: 'high' },
        { classifierId: 'responds_to_parent', confidence: 'high' },
      ],
      categoryReadings: [],
    });
    expect(result.banner?.category).toBe('continuity');
  });
});
