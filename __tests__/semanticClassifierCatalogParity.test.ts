/**
 * MCP-MOD-004 / MCP-MOD-006 — semantic classifier catalog parity tests.
 *
 * Asserts the Node-side `SEMANTIC_CLASSIFIER_CATALOG` agrees with the rest of
 * the per-id sources of truth:
 *
 *   1. Every member of `ALL_SEMANTIC_CLASSIFIER_IDS` has a catalog entry.
 *   2. Every catalog entry's `id` is in `ALL_SEMANTIC_CLASSIFIER_IDS`.
 *   3. For every id, `CATALOG_BY_ID.get(id).structuralQuestion` is a non-empty
 *      string (post-MCP-MOD-005 the catalog IS the source of truth — the prior
 *      `CLASSIFIER_QUESTION_TEXT` indirection was removed; `buildClassifierPrompt`
 *      reads `structuralQuestion` directly from the catalog).
 *   4. For every id, `CATALOG_BY_ID.get(id).bannerCode` is either `null` OR
 *      matches a banner code that exists in `REFEREE_BANNER_LIBRARY`.
 *   5. For every id, `CATALOG_BY_ID.get(id).bannerCode === bannerCodePriorityList[0]`
 *      OR both `null` / `[]` (MCP-MOD-006 — the catalog now owns the full
 *      priority list; the primary `bannerCode` is the first entry of that
 *      list). The banner library's `CLASSIFIER_TO_BANNERS` table is now a
 *      derived view; the parity assertion is internal to the catalog.
 *   6. For every id, `CATALOG_BY_ID.get(id).ledgerFeedbackCode` is either
 *      `null` OR matches a code in `ALL_REFEREE_FEEDBACK_CODES`.
 *   7. For every id, `CATALOG_BY_ID.get(id).family` is one of the six known
 *      families.
 *   8. (MCP-MOD-006) For every id, every value in
 *      `CATALOG_BY_ID.get(id).ledgerCategories` is a member of
 *      `ALL_REFEREE_POINT_CATEGORIES`.
 *   9. (MCP-MOD-006) The catalog-derived `CLASSIFIER_TO_BANNERS` view
 *      preserves the live banner library shape — every code is valid AND
 *      `INTENTIONALLY_SILENT_CLASSIFIERS` members have empty lists.
 */
import {
  SEMANTIC_CLASSIFIER_CATALOG,
  CATALOG_BY_ID,
} from '../src/lib/constitution/semanticClassifierCatalog';
import type {
  SemanticClassifierCatalogEntry,
  SemanticClassifierFamily,
} from '../src/lib/constitution/semanticClassifierCatalog';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee';
import {
  CLASSIFIER_TO_BANNERS,
} from '../src/features/refereeBanners/classifierBannerMap';
import {
  BANNER_BY_CODE,
  INTENTIONALLY_SILENT_CLASSIFIERS,
} from '../src/features/refereeBanners/refereeBannerLibrary';
import {
  ALL_REFEREE_FEEDBACK_CODES,
  ALL_REFEREE_POINT_CATEGORIES,
} from '../src/features/refereeLedger/types';

const KNOWN_FAMILIES: ReadonlyArray<SemanticClassifierFamily> = [
  'parent_continuity',
  'evidence',
  'movement',
  'mode_fit',
  'routing',
  'friction',
];

describe('semantic classifier catalog — id-coverage parity', () => {
  it('has exactly 23 entries (the frozen catalog-v0 set)', () => {
    expect(SEMANTIC_CLASSIFIER_CATALOG).toHaveLength(23);
  });

  it('declares entries in the same order as ALL_SEMANTIC_CLASSIFIER_IDS', () => {
    const catalogIds = SEMANTIC_CLASSIFIER_CATALOG.map((e) => e.id);
    expect(catalogIds).toEqual([...ALL_SEMANTIC_CLASSIFIER_IDS]);
  });

  it('every catalog entry id is in ALL_SEMANTIC_CLASSIFIER_IDS', () => {
    const known = new Set<string>(ALL_SEMANTIC_CLASSIFIER_IDS as readonly string[]);
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      expect(known.has(entry.id)).toBe(true);
    }
  });

  it('every member of ALL_SEMANTIC_CLASSIFIER_IDS has a catalog entry', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      expect((entry as SemanticClassifierCatalogEntry).id).toBe(id);
    }
  });

  it('CATALOG_BY_ID has the same number of entries as the array', () => {
    expect(CATALOG_BY_ID.size).toBe(SEMANTIC_CLASSIFIER_CATALOG.length);
  });
});

describe('semantic classifier catalog — structural-question parity', () => {
  it('every catalog entry has a non-empty structuralQuestion', () => {
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      expect(typeof entry.structuralQuestion).toBe('string');
      expect(entry.structuralQuestion.length).toBeGreaterThan(0);
    }
  });

  it('every catalog entry exposes a non-empty structuralQuestion (the catalog is the source of truth post-MCP-MOD-005)', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      const question = (entry as SemanticClassifierCatalogEntry).structuralQuestion;
      expect(typeof question).toBe('string');
      expect(question.length).toBeGreaterThan(0);
    }
  });

  it('every catalog entry has a non-empty binarySignal', () => {
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      expect(typeof entry.binarySignal).toBe('string');
      expect(entry.binarySignal.length).toBeGreaterThan(0);
    }
  });
});

describe('semantic classifier catalog — family parity', () => {
  it('every catalog entry has a known family', () => {
    const knownSet = new Set<string>(KNOWN_FAMILIES);
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      expect(knownSet.has(entry.family)).toBe(true);
    }
  });

  it('the six families partition the 23 ids — every family has at least one entry', () => {
    const byFamily = new Map<SemanticClassifierFamily, number>();
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      byFamily.set(entry.family, (byFamily.get(entry.family) ?? 0) + 1);
    }
    for (const family of KNOWN_FAMILIES) {
      expect((byFamily.get(family) ?? 0)).toBeGreaterThan(0);
    }
  });
});

describe('semantic classifier catalog — banner-code parity', () => {
  it('every non-null bannerCode is a code that exists in REFEREE_BANNER_LIBRARY', () => {
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      if (entry.bannerCode === null) continue;
      expect(BANNER_BY_CODE.has(entry.bannerCode)).toBe(true);
    }
  });

  it('every code in any entry.bannerCodePriorityList exists in REFEREE_BANNER_LIBRARY (MCP-MOD-006)', () => {
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      for (const code of entry.bannerCodePriorityList) {
        expect({ id: entry.id, code, exists: BANNER_BY_CODE.has(code) }).toEqual({
          id: entry.id,
          code,
          exists: true,
        });
      }
    }
  });

  it('every entry has bannerCode === bannerCodePriorityList[0] OR both null/[] (MCP-MOD-006 catalog-internal invariant)', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      const e = entry as SemanticClassifierCatalogEntry;
      if (e.bannerCode === null) {
        expect(e.bannerCodePriorityList.length).toBe(0);
      } else {
        expect(e.bannerCodePriorityList.length).toBeGreaterThan(0);
        expect(e.bannerCodePriorityList[0]).toBe(e.bannerCode);
      }
    }
  });

  it('the derived CLASSIFIER_TO_BANNERS view equals the catalog entry-for-entry (MCP-MOD-006)', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      const fromCatalog = (entry as SemanticClassifierCatalogEntry).bannerCodePriorityList;
      const fromLibrary = CLASSIFIER_TO_BANNERS[id];
      expect(fromLibrary).toEqual(fromCatalog);
    }
  });

  it('intentionally-silent classifiers have an empty bannerCodePriorityList (MCP-MOD-006)', () => {
    for (const id of INTENTIONALLY_SILENT_CLASSIFIERS) {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      expect((entry as SemanticClassifierCatalogEntry).bannerCodePriorityList).toEqual([]);
      expect((entry as SemanticClassifierCatalogEntry).bannerCode).toBeNull();
    }
  });
});

describe('semantic classifier catalog — ledger-categories parity (MCP-MOD-006)', () => {
  it('every value in any entry.ledgerCategories is a member of ALL_REFEREE_POINT_CATEGORIES', () => {
    const known = new Set<string>(ALL_REFEREE_POINT_CATEGORIES as readonly string[]);
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      for (const category of entry.ledgerCategories) {
        expect({ id: entry.id, category, known: known.has(category) }).toEqual({
          id: entry.id,
          category,
          known: true,
        });
      }
    }
  });

  it('the inverted (category → id) view is collision-free in catalog v0', () => {
    const seen: Record<string, string> = {};
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      for (const category of entry.ledgerCategories) {
        if (seen[category] !== undefined && seen[category] !== entry.id) {
          throw new Error(
            `category "${category}" collides — ids "${seen[category]}" and "${entry.id}"`,
          );
        }
        seen[category] = entry.id;
      }
    }
    // Exactly 10 (category, id) pairs exist in catalog v0 — the same 10
    // entries the pre-MCP-MOD-006 inline `classifierFor` table held.
    expect(Object.keys(seen).length).toBe(10);
  });

  it('exactly 9 ids carry at least one ledgerCategories entry; 14 carry none', () => {
    const withCat = SEMANTIC_CLASSIFIER_CATALOG.filter(
      (e) => e.ledgerCategories.length > 0,
    );
    const withoutCat = SEMANTIC_CLASSIFIER_CATALOG.filter(
      (e) => e.ledgerCategories.length === 0,
    );
    expect(withCat).toHaveLength(9);
    expect(withoutCat).toHaveLength(14);
  });

  it('responds_to_parent surfaces under exactly two categories (continuity + direct_response)', () => {
    const entry = CATALOG_BY_ID.get('responds_to_parent');
    expect(entry).toBeDefined();
    expect((entry as SemanticClassifierCatalogEntry).ledgerCategories).toEqual([
      'continuity',
      'direct_response',
    ]);
  });
});

describe('semantic classifier catalog — ledger-feedback-code parity', () => {
  it('every non-null ledgerFeedbackCode is in ALL_REFEREE_FEEDBACK_CODES', () => {
    const known = new Set<string>(ALL_REFEREE_FEEDBACK_CODES as readonly string[]);
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      if (entry.ledgerFeedbackCode === null) continue;
      expect(known.has(entry.ledgerFeedbackCode)).toBe(true);
    }
  });

  it('exactly 11 ids have a non-null ledgerFeedbackCode (per MCP-MOD-002 inventory)', () => {
    const mapped = SEMANTIC_CLASSIFIER_CATALOG.filter(
      (e) => e.ledgerFeedbackCode !== null,
    );
    expect(mapped).toHaveLength(11);
  });

  it('exactly 12 ids have a null ledgerFeedbackCode (per MCP-MOD-002 inventory)', () => {
    const unmapped = SEMANTIC_CLASSIFIER_CATALOG.filter(
      (e) => e.ledgerFeedbackCode === null,
    );
    expect(unmapped).toHaveLength(12);
  });
});

describe('semantic classifier catalog — frozen / immutable', () => {
  it('SEMANTIC_CLASSIFIER_CATALOG is frozen', () => {
    expect(Object.isFrozen(SEMANTIC_CLASSIFIER_CATALOG)).toBe(true);
  });

  it('every catalog entry is frozen', () => {
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });
});
