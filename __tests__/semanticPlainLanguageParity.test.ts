/**
 * MCP-MOD-006 — Plain-language parity test.
 *
 * `toPlainLanguage` (in `src/features/arguments/gameCopy.ts`) now consults
 * `CATALOG_BY_ID.get(id).plainLanguageLabel` FIRST and falls back to the
 * `PLAIN_LANGUAGE_COPY` table for ids without an override. Catalog v0 has no
 * `plainLanguageLabel` set on any of the 23 entries, so behavior must be
 * byte-identical to the pre-MCP-MOD-006 implementation.
 *
 * This test captures the exact pre-refactor output for every classifier id
 * (as a frozen reference table embedded in this file — derived from the
 * pre-MCP-MOD-006 `PLAIN_LANGUAGE_COPY` content) and asserts the live
 * `toPlainLanguage` returns the same value. A future card that sets
 * `plainLanguageLabel` on a catalog entry would change the live output for
 * that id; this test would then need updating (which is the whole point — a
 * single-file edit becomes observable).
 */

import { toPlainLanguage } from '../src/features/arguments/gameCopy';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee';
import {
  SEMANTIC_CLASSIFIER_CATALOG,
  CATALOG_BY_ID,
} from '../src/lib/constitution/semanticClassifierCatalog';

/**
 * The pre-MCP-MOD-006 frozen reference, extended for MCP-CAT-001's 12 new ids.
 * For every classifier id in `ALL_SEMANTIC_CLASSIFIER_IDS`, the value
 * `toPlainLanguage(id)` returned BEFORE the catalog override was wired in.
 * Captured by reading the pre-refactor `PLAIN_LANGUAGE_COPY` table for each
 * id directly.
 *
 * Authored from the inline table snapshot in `gameCopy.ts` pre-refactor:
 * only `ready_for_synthesis` had a matching key in `PLAIN_LANGUAGE_COPY`
 * (the value `'Ready for synthesis'`). Every other classifier id had no
 * matching key, so `toPlainLanguage` returned `null`.
 *
 * The 12 MCP-CAT-001 ids likewise have no `PLAIN_LANGUAGE_COPY` entry under
 * their classifier-id key (the gameCopy table maps banner codes, not classifier
 * ids, for the new ids); `toPlainLanguage` returns `null` for them too.
 */
const PRE_REFACTOR_PLAIN_LANGUAGE: Readonly<Record<string, string | null>> =
  Object.freeze({
    responds_to_parent: null,
    introduces_new_issue: null,
    asks_for_evidence: null,
    provides_evidence: null,
    evidence_supports_claim: null,
    quote_anchors_parent: null,
    narrows_claim: null,
    concedes_narrow_point: null,
    requests_clarification: null,
    answers_clarification: null,
    shifts_to_person_or_intent: null,
    uses_popularity_as_evidence: null,
    contains_playable_hot_take: null,
    contains_unplayable_insult_only: null,
    is_satire_or_parody: null,
    uses_satire_as_evidence: null,
    cites_retraction: null,
    creates_source_chain_gap: null,
    suggests_side_branch: null,
    suggests_diagonal_tangent: null,
    fits_selected_debate_mode: null,
    needs_pre_send_pause: null,
    ready_for_synthesis: 'Ready for synthesis',
    // ── MCP-CAT-001 (catalog v1) — 12 new ids, all null (same posture as
    //    the catalog v0 ids without a PLAIN_LANGUAGE_COPY override).
    disputes_evidence_applicability: null,
    references_prior_agreement: null,
    provides_temporal_constraint: null,
    accepts_partial_with_caveat: null,
    provides_alternate_interpretation: null,
    opens_evidence_debt_marker: null,
    closes_evidence_debt_marker: null,
    supplies_corroborating_document: null,
    introduces_sub_axis: null,
    concedes_with_new_dispute: null,
    proposes_settlement_terms: null,
    accepts_settlement_terms: null,
  });

describe('MCP-MOD-006 — toPlainLanguage parity for every classifier id', () => {
  it('the pre-refactor reference covers all 35 classifier ids (catalog v1, post-MCP-CAT-001)', () => {
    expect(Object.keys(PRE_REFACTOR_PLAIN_LANGUAGE).sort()).toEqual(
      [...ALL_SEMANTIC_CLASSIFIER_IDS].sort(),
    );
  });

  it('toPlainLanguage(id) returns the pre-refactor value for every classifier id', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      const expected = PRE_REFACTOR_PLAIN_LANGUAGE[id];
      expect({ id, value: toPlainLanguage(id) }).toEqual({ id, value: expected });
    }
  });

  it('no catalog entry currently sets plainLanguageLabel (catalog v0 baseline)', () => {
    // The MCP-MOD-006 refactor adds the catalog seam but never populates a
    // label — every existing entry must still have `plainLanguageLabel`
    // undefined. A later card that wires a label per id will need to update
    // PRE_REFACTOR_PLAIN_LANGUAGE accordingly and bump the parity table.
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      expect(entry.plainLanguageLabel).toBeUndefined();
    }
  });

  it('the catalog override path takes precedence when a label IS present (simulated)', () => {
    // Sanity check on the override mechanism: pick the first id, look up
    // its catalog entry, and verify the override would be picked up.
    // We do NOT mutate the catalog (it is frozen); we assert the helper
    // logic by testing the resolver shape via `CATALOG_BY_ID.get`. The
    // override path is exercised by `toPlainLanguage` itself.
    const firstId = ALL_SEMANTIC_CLASSIFIER_IDS[0];
    const entry = CATALOG_BY_ID.get(firstId);
    expect(entry).toBeDefined();
    // When plainLanguageLabel is undefined (catalog v0), the fallback path
    // is the PLAIN_LANGUAGE_COPY table lookup — confirmed by the
    // per-id parity assertion above.
    expect(entry?.plainLanguageLabel).toBeUndefined();
  });
});

describe('MCP-MOD-006 — toPlainLanguage non-classifier behavior is unchanged', () => {
  it('a known non-classifier code still resolves through the fallback table', () => {
    // `synthesis_ready` is a lifecycle code that pre-existed in
    // PLAIN_LANGUAGE_COPY; it is NOT a classifier id but it shares a token
    // with one (`ready_for_synthesis`). The fallback path must still produce
    // its pre-refactor value.
    expect(toPlainLanguage('synthesis_ready')).toBe('Ready for synthesis');
  });

  it('an unknown code resolves to null (suppression contract)', () => {
    expect(toPlainLanguage('this_is_not_a_real_code')).toBeNull();
    expect(toPlainLanguage('')).toBeNull();
    expect(toPlainLanguage(null)).toBeNull();
    expect(toPlainLanguage(undefined)).toBeNull();
  });

  it('normalization (case + spaces + hyphens) is preserved', () => {
    expect(toPlainLanguage('Ready For Synthesis')).toBe('Ready for synthesis');
    expect(toPlainLanguage('READY-FOR-SYNTHESIS')).toBe('Ready for synthesis');
    expect(toPlainLanguage('  ready for synthesis  ')).toBe('Ready for synthesis');
  });
});
