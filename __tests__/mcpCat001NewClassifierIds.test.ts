/**
 * MCP-CAT-001 — Per-id verification for the 12 catalog v1 extension ids.
 *
 * Authoritative list (operator's final list — supersedes the design doc §5
 * table). Asserts:
 *   - All 12 new ids are present in `ALL_SEMANTIC_CLASSIFIER_IDS`.
 *   - Each new id has a catalog entry with all required fields populated.
 *   - Each new id's `structuralQuestion` starts with "Does this move ...?"
 *     (the structural-only convention).
 *   - Each new id's `bannerCode` is either `null` or matches a defined banner
 *     code in `REFEREE_BANNER_LIBRARY`.
 *   - Each new id's `ledgerFeedbackCode` is either `null` or matches a defined
 *     ledger feedback code.
 *   - Each new id's `binarySignal` contains no verdict / person-label token
 *     (extra defense beyond the existing semantic-anthropic seed-prompt
 *     ban-list test — that one scans `structuralQuestion`; this scans
 *     `binarySignal`).
 *
 * Pure source scan. No network. No Supabase. No React.
 */
import {
  SEMANTIC_CLASSIFIER_CATALOG,
  CATALOG_BY_ID,
} from '../src/lib/constitution/semanticClassifierCatalog';
import {
  ALL_SEMANTIC_CLASSIFIER_IDS,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import type { SemanticClassifierId } from '../src/features/semanticReferee/semanticRefereeTypes';
import {
  BANNER_BY_CODE,
} from '../src/features/refereeBanners/refereeBannerLibrary';
import {
  ALL_REFEREE_FEEDBACK_CODES,
} from '../src/features/refereeLedger/types';

/** Operator's authoritative 12-id list (per the MCP-CAT-001 task spec). */
const MCP_CAT_001_NEW_IDS: readonly SemanticClassifierId[] = [
  'disputes_evidence_applicability',
  'references_prior_agreement',
  'provides_temporal_constraint',
  'accepts_partial_with_caveat',
  'provides_alternate_interpretation',
  'opens_evidence_debt_marker',
  'closes_evidence_debt_marker',
  'supplies_corroborating_document',
  'introduces_sub_axis',
  'concedes_with_new_dispute',
  'proposes_settlement_terms',
  'accepts_settlement_terms',
];

/** Banned tokens (mirrors `cdiscourse-doctrine` §1 / the validator ban-list). */
const BANNED_TOKENS: readonly string[] = [
  'winner',
  'loser',
  'won',
  'lost',
  'right',
  'wrong',
  'true',
  'false',
  'correct',
  'incorrect',
  'proven',
  'defeated',
  'liar',
  'lying',
  'dishonest',
  'manipulative',
  'troll',
  'propagandist',
  'extremist',
  'stupid',
  'idiot',
];

/** Banned multi-word phrases (after whitespace collapse). */
const BANNED_PHRASES: readonly string[] = ['bad faith'];

function tokenSegments(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((seg) => seg.length > 0);
}

describe('MCP-CAT-001 — all 12 new ids present in ALL_SEMANTIC_CLASSIFIER_IDS', () => {
  it('every authoritative new id is a member of the catalog union', () => {
    const known = new Set<string>(ALL_SEMANTIC_CLASSIFIER_IDS as readonly string[]);
    for (const id of MCP_CAT_001_NEW_IDS) {
      expect({ id, present: known.has(id) }).toEqual({ id, present: true });
    }
  });

  it('the catalog grew by exactly 12 entries (23 + 12 = 35)', () => {
    expect(ALL_SEMANTIC_CLASSIFIER_IDS).toHaveLength(35);
    // 12 of the 35 entries are the MCP-CAT-001 ids.
    const newIdSet = new Set<string>(MCP_CAT_001_NEW_IDS as readonly string[]);
    const newCount = ALL_SEMANTIC_CLASSIFIER_IDS.filter((id) => newIdSet.has(id))
      .length;
    expect(newCount).toBe(12);
  });
});

describe('MCP-CAT-001 — every new id has a complete catalog entry', () => {
  it.each([...MCP_CAT_001_NEW_IDS])(
    '%s has a catalog entry with all required fields populated',
    (id: SemanticClassifierId) => {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      const e = entry!;
      expect(typeof e.binarySignal).toBe('string');
      expect(e.binarySignal.length).toBeGreaterThan(0);
      expect(typeof e.structuralQuestion).toBe('string');
      expect(e.structuralQuestion.length).toBeGreaterThan(0);
      expect(typeof e.family).toBe('string');
      // bannerCode + bannerCodePriorityList are kept in sync (parity test
      // covers this generally; here we just check both exist).
      expect(e.bannerCodePriorityList).toBeDefined();
      // ledgerCategories may be empty for new ids that surface only through
      // banners / composition rules; the field itself must still exist.
      expect(Array.isArray(e.ledgerCategories)).toBe(true);
    },
  );
});

describe('MCP-CAT-001 — structural-only convention for the new questions', () => {
  it.each([...MCP_CAT_001_NEW_IDS])(
    '%s structuralQuestion starts with "Does this move"',
    (id: SemanticClassifierId) => {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      const question = entry!.structuralQuestion;
      // Every new id follows the structural convention. Test passes if the
      // question STARTS with "Does this move" (case-sensitive — the catalog
      // uses this consistent prefix).
      expect(question.startsWith('Does this move')).toBe(true);
      // The structural convention ends with a question mark.
      expect(question.trim().endsWith('?')).toBe(true);
    },
  );
});

describe('MCP-CAT-001 — bannerCode resolves in the banner library', () => {
  it.each([...MCP_CAT_001_NEW_IDS])(
    '%s bannerCode is either null or a known banner code',
    (id: SemanticClassifierId) => {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      const code = entry!.bannerCode;
      if (code === null) {
        // Intentional silence — must also have an empty priority list.
        expect(entry!.bannerCodePriorityList).toEqual([]);
      } else {
        expect(BANNER_BY_CODE.has(code)).toBe(true);
      }
    },
  );

  it.each([...MCP_CAT_001_NEW_IDS])(
    '%s every entry in bannerCodePriorityList is a known banner code',
    (id: SemanticClassifierId) => {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      for (const code of entry!.bannerCodePriorityList) {
        expect({ id, code, known: BANNER_BY_CODE.has(code) }).toEqual({
          id,
          code,
          known: true,
        });
      }
    },
  );
});

describe('MCP-CAT-001 — ledgerFeedbackCode resolves in the ledger', () => {
  it.each([...MCP_CAT_001_NEW_IDS])(
    '%s ledgerFeedbackCode is either null or a known feedback code',
    (id: SemanticClassifierId) => {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      const code = entry!.ledgerFeedbackCode;
      if (code !== null) {
        const known = new Set<string>(
          ALL_REFEREE_FEEDBACK_CODES as readonly string[],
        );
        expect(known.has(code)).toBe(true);
      }
    },
  );
});

describe('MCP-CAT-001 — binarySignal doctrine scan', () => {
  it.each([...MCP_CAT_001_NEW_IDS])(
    '%s binarySignal contains no verdict / person-label token',
    (id: SemanticClassifierId) => {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      const value = entry!.binarySignal;
      const segments = new Set(tokenSegments(value));
      for (const token of BANNED_TOKENS) {
        expect({ id, banned: token, found: segments.has(token) }).toEqual({
          id,
          banned: token,
          found: false,
        });
      }
      const collapsed = value.toLowerCase().replace(/\s+/g, ' ').trim();
      for (const phrase of BANNED_PHRASES) {
        expect({ id, banned: phrase, found: collapsed.includes(phrase) }).toEqual({
          id,
          banned: phrase,
          found: false,
        });
      }
    },
  );
});

describe('MCP-CAT-001 — settlement ids follow the operator-specified wording', () => {
  // The design doc + fixture do NOT specify these ids; the operator's task
  // spec says the structural questions should be approximately:
  //   - proposes_settlement_terms: "Does this move propose a settlement summary
  //     or resolution terms the other participant could accept?"
  //   - accepts_settlement_terms: "Does this move accept a proposed settlement
  //     summary or resolution terms?"
  it('proposes_settlement_terms uses the operator-derived wording', () => {
    const entry = CATALOG_BY_ID.get('proposes_settlement_terms');
    expect(entry).toBeDefined();
    expect(entry!.structuralQuestion).toBe(
      'Does this move propose a settlement summary or resolution terms the other participant could accept?',
    );
  });

  it('accepts_settlement_terms uses the operator-derived wording', () => {
    const entry = CATALOG_BY_ID.get('accepts_settlement_terms');
    expect(entry).toBeDefined();
    expect(entry!.structuralQuestion).toBe(
      'Does this move accept a proposed settlement summary or resolution terms?',
    );
  });

  it('neither settlement question contains a forbidden settlement token', () => {
    // From the band-space-rent fixture's `forbiddenSettlementLanguage`.
    const FORBIDDEN = [
      'proven',
      'true',
      'false',
      'winner',
      'loser',
      'case closed',
      'right',
      'wrong',
      'correct',
      'incorrect',
      'victory',
      'defeated',
    ];
    for (const id of ['proposes_settlement_terms', 'accepts_settlement_terms'] as const) {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      const lower = entry!.structuralQuestion.toLowerCase();
      for (const banned of FORBIDDEN) {
        expect({ id, banned, found: lower.includes(banned) }).toEqual({
          id,
          banned,
          found: false,
        });
      }
    }
  });
});

describe('MCP-CAT-001 — catalog v1 contents are frozen', () => {
  it('each of the 12 new catalog entries is Object.frozen', () => {
    for (const id of MCP_CAT_001_NEW_IDS) {
      const entry = CATALOG_BY_ID.get(id);
      expect(entry).toBeDefined();
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  it('SEMANTIC_CLASSIFIER_CATALOG itself remains frozen post-extension', () => {
    expect(Object.isFrozen(SEMANTIC_CLASSIFIER_CATALOG)).toBe(true);
  });
});
