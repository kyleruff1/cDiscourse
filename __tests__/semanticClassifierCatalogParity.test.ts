/**
 * MCP-MOD-004 — semantic classifier catalog parity tests.
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
 *   5. For every id, `CATALOG_BY_ID.get(id).bannerCode` matches the FIRST entry
 *      of `CLASSIFIER_TO_BANNERS[id]` — the catalog's primary code is the
 *      banner library's primary candidate.
 *   6. For every id, `CATALOG_BY_ID.get(id).ledgerFeedbackCode` is either
 *      `null` OR matches a code in `ALL_REFEREE_FEEDBACK_CODES`.
 *   7. For every id, `CATALOG_BY_ID.get(id).family` is one of the six known
 *      families.
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
import { BANNER_BY_CODE } from '../src/features/refereeBanners/refereeBannerLibrary';
import { ALL_REFEREE_FEEDBACK_CODES } from '../src/features/refereeLedger/types';

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

  it('every non-null bannerCode matches the FIRST code in CLASSIFIER_TO_BANNERS[id] (catalog is the primary; the banner library keeps the full priority list)', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      const catalogCode = (entry as SemanticClassifierCatalogEntry).bannerCode;
      const libraryCodes = CLASSIFIER_TO_BANNERS[id];
      if (catalogCode === null) {
        expect(libraryCodes.length).toBe(0);
      } else {
        expect(libraryCodes.length).toBeGreaterThan(0);
        expect(libraryCodes[0]).toBe(catalogCode);
      }
    }
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
