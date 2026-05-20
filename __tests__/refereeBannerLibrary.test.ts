/**
 * MCP-014 — Referee banner library: coverage tests.
 *
 * Proves the >=103-entry library meets the MCP-008 §5.1 category floors, that
 * every bannerCode is unique, that softened siblings resolve correctly, that
 * `CLASSIFIER_TO_BANNERS` keys exactly the 23-id catalog, that
 * `FEEDBACK_CODE_TO_BANNER` keys exactly the 22 feedback codes, and that every
 * mapped bannerCode resolves in `BANNER_BY_CODE`.
 */

import {
  REFEREE_BANNER_LIBRARY,
  BANNER_BY_CODE,
  INTENTIONALLY_SILENT_CLASSIFIERS,
  CLASSIFIER_TO_BANNERS,
  FEEDBACK_CODE_TO_BANNER,
  ALL_REFEREE_BANNER_CATEGORIES,
} from '../src/features/refereeBanners';
import type { RefereeBannerCategory } from '../src/features/refereeBanners';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee/semanticRefereeTypes';
import { ALL_REFEREE_FEEDBACK_CODES } from '../src/features/refereeLedger/types';

/** MCP-008 §5.1 per-category floor counts — sum is 103. */
const CATEGORY_FLOORS: Readonly<Record<RefereeBannerCategory, number>> = {
  continuity: 10,
  evidence_debt: 9,
  hot_take: 9,
  clever_rebuttal: 9,
  source_chain_gap: 9,
  branch_suggestion: 8,
  tangent_suggestion: 8,
  synthesis_readiness: 9,
  quote_needed: 8,
  mechanism_needed: 8,
  mode_mismatch: 8,
  pacing_cooldown: 8,
};

describe('MCP-014 banner library — size + category floors', () => {
  it('holds at least 100 banners (design target 103)', () => {
    expect(REFEREE_BANNER_LIBRARY.length).toBeGreaterThanOrEqual(100);
  });

  it('holds exactly 103 banners', () => {
    expect(REFEREE_BANNER_LIBRARY.length).toBe(103);
  });

  it('each of the 12 categories meets its MCP-008 §5.1 floor count', () => {
    for (const category of ALL_REFEREE_BANNER_CATEGORIES) {
      const count = REFEREE_BANNER_LIBRARY.filter(
        (b) => b.category === category,
      ).length;
      expect(count).toBeGreaterThanOrEqual(CATEGORY_FLOORS[category]);
    }
  });

  it('every banner has a known RefereeBannerCategory', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      expect(ALL_REFEREE_BANNER_CATEGORIES).toContain(banner.category);
    }
  });
});

describe('MCP-014 banner library — bannerCode uniqueness + length bounds', () => {
  it('every bannerCode is unique across the library', () => {
    const codes = REFEREE_BANNER_LIBRARY.map((b) => b.bannerCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every headline is non-empty and <= 64 chars', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      expect(banner.headline.length).toBeGreaterThan(0);
      expect(banner.headline.length).toBeLessThanOrEqual(64);
    }
  });

  it('every helperLine, when present, is <= 80 chars', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      if (banner.helperLine !== undefined) {
        expect(banner.helperLine.length).toBeGreaterThan(0);
        expect(banner.helperLine.length).toBeLessThanOrEqual(80);
      }
    }
  });

  it('BANNER_BY_CODE indexes every library entry', () => {
    expect(BANNER_BY_CODE.size).toBe(REFEREE_BANNER_LIBRARY.length);
    for (const banner of REFEREE_BANNER_LIBRARY) {
      expect(BANNER_BY_CODE.get(banner.bannerCode)).toBe(banner);
    }
  });
});

describe('MCP-014 banner library — softened siblings', () => {
  it('every non-null softenedSiblingCode resolves to a real low-confidence entry', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      if (banner.softenedSiblingCode === null) continue;
      const sibling = BANNER_BY_CODE.get(banner.softenedSiblingCode);
      expect(sibling).toBeDefined();
      expect(sibling?.minConfidence).toBe('low');
      // No infinite chain — a sibling has no sibling of its own.
      expect(sibling?.softenedSiblingCode).toBeNull();
    }
  });

  it('a banner with minConfidence above low has either a sibling or is itself a routing/low banner', () => {
    // A medium/high banner that could over-claim on a low signal should have a
    // softened sibling so the confidence rule can swap rather than always drop.
    for (const banner of REFEREE_BANNER_LIBRARY) {
      if (banner.minConfidence === 'low') continue;
      // Not a hard requirement that EVERY one has a sibling, but every one in
      // this library does — verify the design intent holds.
      expect(banner.softenedSiblingCode).not.toBeNull();
    }
  });
});

describe('MCP-014 banner library — CLASSIFIER_TO_BANNERS coverage', () => {
  it('keys exactly the 23-id SemanticClassifierId catalog', () => {
    const mapKeys = Object.keys(CLASSIFIER_TO_BANNERS).sort();
    const catalog = [...ALL_SEMANTIC_CLASSIFIER_IDS].sort();
    expect(mapKeys).toEqual(catalog);
  });

  it('every value is a non-empty array except for INTENTIONALLY_SILENT_CLASSIFIERS', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      const value = CLASSIFIER_TO_BANNERS[id];
      if (INTENTIONALLY_SILENT_CLASSIFIERS.has(id)) {
        expect(value).toEqual([]);
      } else {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('INTENTIONALLY_SILENT_CLASSIFIERS is exactly { contains_unplayable_insult_only }', () => {
    expect([...INTENTIONALLY_SILENT_CLASSIFIERS].sort()).toEqual([
      'contains_unplayable_insult_only',
    ]);
  });

  it('contains_unplayable_insult_only maps to an empty array', () => {
    expect(CLASSIFIER_TO_BANNERS.contains_unplayable_insult_only).toEqual([]);
  });

  it('every bannerCode referenced by CLASSIFIER_TO_BANNERS exists in BANNER_BY_CODE', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      for (const code of CLASSIFIER_TO_BANNERS[id]) {
        expect(BANNER_BY_CODE.has(code)).toBe(true);
      }
    }
  });
});

describe('MCP-014 banner library — FEEDBACK_CODE_TO_BANNER coverage', () => {
  it('keys exactly the 22-code RefereeFeedbackCode union', () => {
    const mapKeys = Object.keys(FEEDBACK_CODE_TO_BANNER).sort();
    const codes = [...ALL_REFEREE_FEEDBACK_CODES].sort();
    expect(mapKeys).toEqual(codes);
  });

  it('every value resolves to a real banner in BANNER_BY_CODE', () => {
    for (const code of ALL_REFEREE_FEEDBACK_CODES) {
      const bannerCode = FEEDBACK_CODE_TO_BANNER[code];
      expect(typeof bannerCode).toBe('string');
      expect(BANNER_BY_CODE.has(bannerCode)).toBe(true);
    }
  });

  it('the you_decide_the_lane feedback code maps to the routing banner', () => {
    expect(FEEDBACK_CODE_TO_BANNER.you_decide_the_lane).toBe(
      'pacing_you_decide_the_lane',
    );
  });
});
