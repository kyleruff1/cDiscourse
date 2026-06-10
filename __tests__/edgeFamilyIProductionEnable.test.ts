/**
 * MCP-021C-EDGE-FAMILY-I-ENABLE (MCP-I-D2) — Family I production-mode flip binding.
 *
 * This file is the dedicated card-scoped binding that locks in the
 * POST-flip state of `familyRegistry.ts`. It mirrors the FIE/HHE-* pattern
 * from `edgeFamilyHProductionEnable.test.ts` for Family I
 * (`thread_topology`): every assertion here asserts that Family I is now
 * production-enabled and that A/B/C/D/E/F/G/H remain production-enabled
 * while J (`sensitive_composer`) remains admin-only.
 *
 * If a future card accidentally reverts the Family I production flag,
 * this file fails the build with a Family-I-specific error message.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1, §10a — Machine Observations are
 *     structural; production enablement is gameplay-routing, never a
 *     verdict on the family's quality. Family I's keys are STRUCTURAL
 *     thread-topology relations (`introduces_new_issue`,
 *     `returns_to_prior_issue`, `references_external_context`, …) — a
 *     measurable property of how a move relates to the conversation
 *     graph, NEVER a quality judgment on the writer or the claim.
 *   - cdiscourse-doctrine §3 — `references_external_context` records the
 *     structural fact of an external reference; it never grants factual
 *     standing from virality/engagement.
 *   - cdiscourse-doctrine §4 — classifier outputs are post-storage,
 *     advisory; `engine.ts` remains the sole submission acceptance gate.
 *   - cdiscourse-doctrine §7 — Pure TS; no Deno-specific runtime call.
 *
 * DIV-1 (the principal divergence from H-ENABLE): Family I is a
 * MIXED-source family (8 auto_metadata + 7 lifecycle + 6 ai_classifier =
 * 21 total). The Edge subset filter
 * `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] =
 * {'ai_classifier'}` is ALREADY PRESENT (added at Card 1A
 * `MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET`, PR #550) and is mode-agnostic.
 * So the subset-filter guards below assert the entry is PRESENT (IIE-17)
 * and that production-mode I returns exactly the 6 ai_classifier keys
 * with NO deterministic leak (IIE-18) — the INVERSE of H's HHE-17/18,
 * which asserted absence + a 12-key full passthrough. This mirrors G's
 * GGE-16/17 (G is also mixed-source).
 *
 * HALT trigger 13 (subset filter entry for I must STAY PRESENT and
 * unchanged) is guarded by IIE-17 + IIE-18 below. This card does NOT
 * touch the subset filter block in booleanObservationRequestBuilder.ts.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeFilterFamiliesForMode,
  edgeBuildBooleanObservationRequestForArgument,
  edgeGetMcpServerSupportedFamilySources,
} from './_helpers/booleanObservationEdgeDeno';
import * as fs from 'fs';
import * as path from 'path';

// The 6 ai_classifier keys the MCP server supports for Family I
// (operator-approved at MCP-SERVER-010-FAMILY-I Card 1; mirrored from
// mcp-server/lib/familyIKeys.ts:92-99 / machineObservationDefinitions/familyI.ts).
// Family I is MIXED-source; only these 6 ai_classifier keys are sent to the
// hosted MCP — the 15 deterministic keys are derived via non-MCP paths.
const FAMILY_I_AI_CLASSIFIER_KEYS = [
  'introduces_new_issue',
  'references_prior_agreement',
  'introduces_sub_axis',
  'returns_to_prior_issue',
  'references_external_context',
  'compares_options',
] as const;

// The 15 deterministic keys (8 auto_metadata + 7 lifecycle) that the MCP
// server does NOT support and that the subset filter MUST exclude from a
// Family I request in EITHER mode (no deterministic leak).
const FAMILY_I_DETERMINISTIC_EXCLUDED = [
  // auto_metadata (8)
  'has_reply',
  'participant_skipped_node',
  'no_response_after_n_turns',
  'repeated_axis_pressure',
  'splits_thread',
  'merges_thread',
  'references_sibling_node',
  'references_ancestor_node',
  // lifecycle (7)
  'open',
  'answered',
  'moved_on_by_affirmative',
  'moved_on_by_negative',
  'ignored_by_affirmative',
  'ignored_by_negative',
  'ignored_by_both',
] as const;

describe('MCP-021C-EDGE-FAMILY-I-ENABLE — Family I production-mode flip binding', () => {
  it('IIE-1 — Family I entry has productionEnabled: true (post MCP-I-D2 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('thread_topology');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('IIE-2 — Family I entry has adminValidationEnabled: true (unchanged across the flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('thread_topology');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('IIE-3 — edgeProductionEnabledFamilies() includes thread_topology', () => {
    expect(edgeProductionEnabledFamilies()).toContain('thread_topology');
  });

  it('IIE-4 — edgeProductionEnabledFamilies() has length 9 (post MCP-I-D2 flip)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(9);
  });

  it('IIE-5 — edgeProductionEnabledFamilies() preserves registry A→I order', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
      'thread_topology',
    ]);
  });

  it('IIE-6 — edgeFilterFamiliesForMode([thread_topology], production) keeps thread_topology', () => {
    expect(edgeFilterFamiliesForMode(['thread_topology'], 'production')).toEqual([
      'thread_topology',
    ]);
  });
});

describe('MCP-021C-EDGE-FAMILY-I-ENABLE — J remains admin-only (no widening past I)', () => {
  const J_ADMIN_ONLY = ['sensitive_composer'] as const;

  for (const family of J_ADMIN_ONLY) {
    it(`IIE-7:${family} — productionEnabled is false (awaits its own card / N=0 disposition)`, () => {
      const entry = edgeLookupFamilyRegistryEntry(family);
      expect(entry).not.toBeNull();
      expect(entry!.productionEnabled).toBe(false);
    });
  }
});

describe('MCP-021C-EDGE-FAMILY-I-ENABLE — Family I is the 9th entry; registry order preserved', () => {
  it('IIE-8 — Family I occupies index 8 in EDGE_FAMILY_REGISTRY (A→J order preserved)', () => {
    expect(EDGE_FAMILY_REGISTRY[8].family).toBe('thread_topology');
    expect(EDGE_FAMILY_REGISTRY[8].productionEnabled).toBe(true);
    expect(EDGE_FAMILY_REGISTRY[8].adminValidationEnabled).toBe(true);
  });

  it('IIE-9 — Family A is still first (preserves Family A iteration #1 behavior)', () => {
    expect(EDGE_FAMILY_REGISTRY[0].family).toBe('parent_relation');
    expect(EDGE_FAMILY_REGISTRY[0].productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-I-ENABLE — A/B/C/D/E/F/G/H production posture unchanged', () => {
  // HALT trigger 4: A/B/C/D/E/F/G/H productionEnabled flipped (already true;
  // do not touch). These assertions catch any accidental drift on the now-8
  // prior production families during the Family I flip. Family H
  // (claim_clarity) stays production-enabled (the live-verified
  // post-MCP-H-002 state).
  const A_THROUGH_H: ReadonlyArray<[string, string]> = [
    ['parent_relation', 'A'],
    ['disagreement_axis', 'B'],
    ['misunderstanding_repair', 'C'],
    ['evidence_source_chain', 'D'],
    ['argument_scheme', 'E'],
    ['critical_question', 'F'],
    ['resolution_progress', 'G'],
    ['claim_clarity', 'H'],
  ];

  for (const [family, letter] of A_THROUGH_H) {
    it(`IIE-10:${letter} — Family ${letter} (${family}) remains productionEnabled: true`, () => {
      const entry = edgeLookupFamilyRegistryEntry(family);
      expect(entry).not.toBeNull();
      expect(entry!.productionEnabled).toBe(true);
    });
  }
});

describe('MCP-021C-EDGE-FAMILY-I-ENABLE — subset filter PRESENT for Family I (defensive guard for HALT trigger 13; DIV-1)', () => {
  it('IIE-17 — MCP_SERVER_SUPPORTED_FAMILY_SOURCES HAS an entry for thread_topology equal to {ai_classifier}', () => {
    // DIV-1: Family I is MIXED-source (8 auto_metadata + 7 lifecycle + 6
    // ai_classifier). Unlike uniform Family H (no entry → full
    // passthrough), Family I MUST carry a subset entry so production-mode
    // requests filter to the 6 ai_classifier keys and the 15 deterministic
    // keys are never sent to the MCP server (sending them triggers
    // unsupported_rawKey → mcp_validation_failed). The entry was added at
    // Card 1A (MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET, PR #550); this card
    // MUST NOT add, remove, or modify it. HALT trigger 13 binds: the subset
    // filter for I must STAY PRESENT and unchanged (the INVERSE of H's
    // HHE-17, which asserts absence). Mirrors G's GGE-16.

    // Assert presence + shape via the test-only export.
    const sources = edgeGetMcpServerSupportedFamilySources('thread_topology');
    expect(sources).toBeDefined();
    expect(Array.from(sources!).sort()).toEqual(['ai_classifier']);

    // Also assert presence in the builder source block itself (the
    // constant the production path filters on).
    const builderPath = path.join(
      process.cwd(),
      'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts',
    );
    const builderText = fs.readFileSync(builderPath, 'utf8');
    const constantBlock = builderText.match(
      /const MCP_SERVER_SUPPORTED_FAMILY_SOURCES[\s\S]*?\n\}\);/,
    );
    expect(constantBlock).not.toBeNull();
    expect(constantBlock![0]).toContain('thread_topology');
  });

  it('IIE-18 — production-mode Family I request contains exactly the 6 ai_classifier rawKeys, byte-equal to admin_validation-mode, with NO deterministic leak', () => {
    // DIV-1: the INVERSE of H's HHE-18. Family I's subset filter is
    // mode-agnostic, so the production-mode builder returns exactly the 6
    // ai_classifier keys (never the 15 deterministic keys) and the result
    // is byte-equal to the admin_validation-mode request.
    const reqProd = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-i-prod-1',
      parentArgumentId: 'arg-i-prod-0',
      currentText: 'a reply that may introduce a new issue or a sub-axis',
      parentText: 'a claim being evaluated for thread topology',
      threadContextExcerpt: '',
      requestedFamilies: ['thread_topology'],
      mode: 'production',
    });
    expect(reqProd.requestedRawKeys.length).toBe(6);

    // Every key sent is one of the 6 ai_classifier keys.
    const sent = new Set(reqProd.requestedRawKeys);
    for (const expected of FAMILY_I_AI_CLASSIFIER_KEYS) {
      expect(sent.has(expected)).toBe(true);
    }
    // No deterministic leak: none of the 15 excluded keys appear.
    for (const excluded of FAMILY_I_DETERMINISTIC_EXCLUDED) {
      expect(sent.has(excluded)).toBe(false);
    }

    // Mode-agnostic: byte-equal vs admin_validation-mode.
    const reqAdmin = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-i-prod-1',
      parentArgumentId: 'arg-i-prod-0',
      currentText: 'a reply that may introduce a new issue or a sub-axis',
      parentText: 'a claim being evaluated for thread topology',
      threadContextExcerpt: '',
      requestedFamilies: ['thread_topology'],
      mode: 'admin_validation',
    });
    expect([...reqProd.requestedRawKeys].sort()).toEqual(
      [...reqAdmin.requestedRawKeys].sort(),
    );
  });

  it('IIE-19 — acceptance-gate invariant: the classifier dispatch fork is fail-closed (no classifier path gates submission)', () => {
    // cdiscourse-doctrine §4 / design §0: the deterministic engine.ts is the
    // SOLE submission acceptance gate. The classifier/queue dispatch is
    // post-storage and gated by a strict, DEFAULT-DISABLED master flag —
    // flipping a family's productionEnabled boolean changes ONLY which
    // structural Observations the Edge requests, never whether a post is
    // accepted. Source-scan confirms shouldRouteToQueue fail-closes on the
    // master flag (`enabled !== true` → false), so no classifier path can
    // block, reject, route, or delay an ordinary user post.
    const routingPath = path.join(
      process.cwd(),
      'supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts',
    );
    const routingText = fs.readFileSync(routingPath, 'utf8');
    expect(routingText).toMatch(/if\s*\(\s*enabled\s*!==\s*true\s*\)\s*return\s+false/);
  });
});
