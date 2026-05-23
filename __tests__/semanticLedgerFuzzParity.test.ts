/**
 * MCP-MOD-006 — Ledger fuzz-parity test.
 *
 * The MCP-MOD-006 refactor changed exactly ONE thing inside the ledger:
 * `l2SignalForCategory`'s `classifierFor` lookup is now a catalog-derived
 * view (inverted from `SEMANTIC_CLASSIFIER_CATALOG[*].ledgerCategories`)
 * rather than an inline literal table. The refactor must produce a
 * byte-identical lookup for every (category, classifier id) pair.
 *
 * This test proves it two ways:
 *
 *   1. Inverts the live catalog's `ledgerCategories` field and asserts the
 *      result equals the frozen pre-MCP-MOD-006 `classifierFor` literal.
 *
 *   2. Generates 50 deterministically-random `SemanticRefereePacket`s and,
 *      for every (packet, category) pair, asserts the binary the pre-refactor
 *      lookup would point to is the same binary the post-refactor catalog
 *      lookup points to. The reference impl reads `localOnlyClassifierFor`
 *      (a literal copy of the pre-refactor table) and is local to this file.
 *
 * The RNG is seeded with a committed fixed value so the corpus is identical
 * across runs and CI.
 */

import { SEMANTIC_CLASSIFIER_CATALOG } from '../src/lib/constitution/semanticClassifierCatalog';
import {
  ALL_REFEREE_POINT_CATEGORIES,
} from '../src/features/refereeLedger/types';
import type { RefereePointCategory } from '../src/features/refereeLedger/types';
import type {
  Binary01,
  SemanticBinarySample,
  SemanticClassifierId,
  SemanticConfidence,
  SemanticRefereePacket,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee';

// ── Pre-refactor reference data ───────────────────────────────────
//
// The pre-MCP-MOD-006 inline `classifierFor` table verbatim. Authored from
// the inline `const` block that lived in `l2SignalForCategory` before this
// card. Frozen at module load.

const localOnlyClassifierFor: Readonly<Partial<Record<RefereePointCategory, SemanticClassifierId>>> =
  Object.freeze({
    continuity: 'responds_to_parent',
    direct_response: 'responds_to_parent',
    evidence_provided: 'provides_evidence',
    evidence_relevance: 'evidence_supports_claim',
    quote_anchoring: 'quote_anchors_parent',
    clarification: 'requests_clarification',
    synthesis: 'ready_for_synthesis',
    branch_hygiene: 'suggests_side_branch',
    person_intent_drift: 'shifts_to_person_or_intent',
    staying_in_mode: 'fits_selected_debate_mode',
  }) as Partial<Record<RefereePointCategory, SemanticClassifierId>>;

// ── Derive the live table from the catalog ────────────────────────
//
// `reconcileMove.ts` keeps the derived table private; we re-derive it here
// from the same source (the catalog's `ledgerCategories` field) and assert
// equality with the reference literal. If the catalog's `ledgerCategories`
// entries drift from the pre-refactor table, this test fails.

function deriveLiveClassifierForFromCatalog(): Partial<
  Record<RefereePointCategory, SemanticClassifierId>
> {
  const out: Partial<Record<RefereePointCategory, SemanticClassifierId>> = {};
  for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
    for (const category of entry.ledgerCategories as readonly RefereePointCategory[]) {
      out[category] = entry.id as SemanticClassifierId;
    }
  }
  return out;
}

// ── Pre-refactor reference l2-signal impl ─────────────────────────
//
// Reproduces the pre-MCP-MOD-006 `l2SignalForCategory` logic byte-for-byte
// but sources the per-id lookup from `localOnlyClassifierFor` instead of the
// catalog-derived table.

function localOnlySemanticSign(
  category: RefereePointCategory,
  value: Binary01,
): -1 | 0 | 1 {
  if (category === 'person_intent_drift') return value === 1 ? -1 : 0;
  return value === 1 ? 1 : 0;
}

function localOnlyFindBinary(
  packet: SemanticRefereePacket | undefined,
  id: SemanticClassifierId,
): SemanticBinarySample | undefined {
  if (!packet) return undefined;
  return packet.binaries.find((b) => b.classifierId === id);
}

interface L2Signal {
  present: true;
  sign: -1 | 0 | 1;
  confidence: SemanticConfidence;
}

function localOnlyL2Signal(
  category: RefereePointCategory,
  packet: SemanticRefereePacket | undefined,
): L2Signal | null {
  if (!packet) return null;
  const id = localOnlyClassifierFor[category];
  if (!id) return null;
  const binary = localOnlyFindBinary(packet, id);
  if (!binary) return null;
  return {
    present: true,
    sign: localOnlySemanticSign(category, binary.value),
    confidence: binary.confidence,
  };
}

/**
 * The live l2-signal — uses the catalog-derived `classifierFor` table.
 * Byte-faithful reproduction of the post-refactor `l2SignalForCategory`
 * minus the catalog-internals indirection. Reads the LIVE catalog so any
 * change to the derived view is observable from this test.
 */
const LIVE_CLASSIFIER_FOR = (() => {
  const out: Partial<Record<RefereePointCategory, SemanticClassifierId>> = {};
  for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
    for (const category of entry.ledgerCategories as readonly RefereePointCategory[]) {
      out[category] = entry.id as SemanticClassifierId;
    }
  }
  return Object.freeze(out);
})();

function liveL2Signal(
  category: RefereePointCategory,
  packet: SemanticRefereePacket | undefined,
): L2Signal | null {
  if (!packet) return null;
  const id = LIVE_CLASSIFIER_FOR[category];
  if (!id) return null;
  const binary = localOnlyFindBinary(packet, id);
  if (!binary) return null;
  return {
    present: true,
    sign: localOnlySemanticSign(category, binary.value),
    confidence: binary.confidence,
  };
}

// ── Deterministic RNG (mulberry32) ────────────────────────────────

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

const COMMITTED_SEED = 0x4f6d8c12; // MCP-MOD-006 ledger fuzz seed — do not change.

const CONFIDENCES: ReadonlyArray<SemanticConfidence> = ['low', 'medium', 'high'];

function pickOne<T>(rng: () => number, arr: ReadonlyArray<T>): T {
  return arr[Math.floor(rng() * arr.length)];
}

function generatePacket(rng: () => number): SemanticRefereePacket {
  const numBinaries = 1 + Math.floor(rng() * 10); // 1..10
  const seen = new Set<SemanticClassifierId>();
  const binaries: SemanticBinarySample[] = [];
  while (binaries.length < numBinaries && seen.size < ALL_SEMANTIC_CLASSIFIER_IDS.length) {
    const id = pickOne(rng, ALL_SEMANTIC_CLASSIFIER_IDS) as SemanticClassifierId;
    if (seen.has(id)) continue;
    seen.add(id);
    binaries.push({
      classifierId: id,
      value: (rng() < 0.5 ? 0 : 1) as Binary01,
      confidence: pickOne(rng, CONFIDENCES),
      reasonCode: 'fuzz_test_reason',
    });
  }
  return {
    packetVersion: 'mcp-semantic-referee-v0',
    promptVersion: 'mcp-semantic-referee-prompt-v1',
    modelVersion: 'mock-fuzz',
    provider: 'mock',
    authoritative: false,
    inputHash: 'hash_fuzz_input',
    contentHash: 'hash_fuzz_content',
    roomId: 'room_fuzz',
    binaries,
    routeSuggestion: 'no_route_change',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 0,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  };
}

// ── The test ──────────────────────────────────────────────────────

describe('MCP-MOD-006 — catalog-derived classifierFor parity with pre-refactor table', () => {
  it('the pre-refactor classifierFor literal has the expected 10 entries', () => {
    expect(Object.keys(localOnlyClassifierFor).sort()).toEqual(
      [
        'branch_hygiene',
        'clarification',
        'continuity',
        'direct_response',
        'evidence_provided',
        'evidence_relevance',
        'person_intent_drift',
        'quote_anchoring',
        'staying_in_mode',
        'synthesis',
      ].sort(),
    );
  });

  it('the catalog-derived classifierFor table equals the pre-refactor literal entry-for-entry', () => {
    const derived = deriveLiveClassifierForFromCatalog();
    expect(derived).toEqual(localOnlyClassifierFor);
  });

  it('inversion is collision-free — no category gets two distinct ids', () => {
    const seen: Partial<Record<RefereePointCategory, SemanticClassifierId>> = {};
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      for (const category of entry.ledgerCategories as readonly RefereePointCategory[]) {
        if (seen[category] !== undefined && seen[category] !== entry.id) {
          throw new Error(
            `category ${category} collides between ids ${String(seen[category])} and ${entry.id}`,
          );
        }
        seen[category] = entry.id as SemanticClassifierId;
      }
    }
    // Just confirm we made it through without throwing.
    expect(Object.keys(seen).length).toBe(10);
  });

  it('the 26 catalog ids without a ledgerCategories entry are exactly the documented set (catalog v1, post-MCP-CAT-001)', () => {
    // 35 catalog ids total (catalog v1). 9 ids carry at least one
    // ledgerCategories entry (one id — `responds_to_parent` — surfaces under
    // TWO categories: `continuity` AND `direct_response`, the only
    // multi-category id in catalog v1). That gives 10 (category, id) pairs.
    // The remaining 26 ids (14 from catalog v0 + 12 from MCP-CAT-001) contribute
    // through `scoreHints`, the anti-amplification context, banner-only
    // surfacing, or layer-1 facts and so carry no per-id ledger category.
    const without = SEMANTIC_CLASSIFIER_CATALOG.filter(
      (e) => e.ledgerCategories.length === 0,
    ).map((e) => e.id);
    expect(new Set(without)).toEqual(
      new Set([
        // ── catalog v0 (14) ─────────────────────────────────────────
        'introduces_new_issue',
        'asks_for_evidence',
        'narrows_claim',
        'concedes_narrow_point',
        'answers_clarification',
        'uses_popularity_as_evidence',
        'contains_playable_hot_take',
        'contains_unplayable_insult_only',
        'is_satire_or_parody',
        'uses_satire_as_evidence',
        'cites_retraction',
        'creates_source_chain_gap',
        'suggests_diagonal_tangent',
        'needs_pre_send_pause',
        // ── MCP-CAT-001 / catalog v1 (12) ───────────────────────────
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
      ]),
    );
    expect(without.length).toBe(26);
  });
});

describe('MCP-MOD-006 — l2-signal fuzz-parity (50 random packets × 10 categories)', () => {
  const rng = makeRng(COMMITTED_SEED);
  const packets: SemanticRefereePacket[] = [];
  for (let i = 0; i < 50; i++) packets.push(generatePacket(rng));

  const categoriesWithLookup = ALL_REFEREE_POINT_CATEGORIES.filter(
    (c) => localOnlyClassifierFor[c] !== undefined,
  );

  it('the packet corpus has the expected size', () => {
    expect(packets).toHaveLength(50);
  });

  it('for every (packet, category) pair the live and reference l2-signals are deeply equal', () => {
    for (let i = 0; i < packets.length; i++) {
      for (const category of categoriesWithLookup) {
        const reference = localOnlyL2Signal(category, packets[i]);
        const live = liveL2Signal(category, packets[i]);
        expect({ packet: i, category, live }).toEqual({
          packet: i,
          category,
          live: reference,
        });
      }
    }
  });

  it('for every (packet, category-without-lookup) pair both impls return null', () => {
    const withoutLookup = ALL_REFEREE_POINT_CATEGORIES.filter(
      (c) => localOnlyClassifierFor[c] === undefined,
    );
    for (let i = 0; i < packets.length; i++) {
      for (const category of withoutLookup) {
        expect(liveL2Signal(category, packets[i])).toBeNull();
        expect(localOnlyL2Signal(category, packets[i])).toBeNull();
      }
    }
  });

  it('the reference impl is a separate function object from the live impl', () => {
    expect(localOnlyL2Signal).not.toBe(liveL2Signal);
  });
});
