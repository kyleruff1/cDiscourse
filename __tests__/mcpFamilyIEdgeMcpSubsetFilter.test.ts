/**
 * MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET — Edge → MCP subset filter regression.
 *
 * Family I (`thread_topology`) is a mixed-source family: 8 auto_metadata
 * + 7 lifecycle + 6 ai_classifier (21 total). Per the MCP-SERVER-010-FAMILY-I
 * Stage 2B operator decision, the hosted MCP server supports ONLY the 6
 * ai_classifier keys; the 15 deterministic keys are excluded.
 *
 * The Card 1 ship (MCP-SERVER-010-FAMILY-I, #392 PR #546 merged 4b9dabd)
 * registered the 6-key subset on the hosted MCP server (verified live:
 * hosted Deno smoke 25/25, checks 24/25 family-i-v1) but the Edge request
 * builder had no `thread_topology` entry in MCP_SERVER_SUPPORTED_FAMILY_SOURCES.
 * Absence = full registry passthrough, so the Edge sent all 21 Family I keys;
 * the hosted MCP server rejected the 15 deterministic keys
 * (`unsupported_rawKey`) → Edge mapped to `mcp_validation_failed` for EVERY
 * Family I admin_validation request.
 *
 * This fix adds MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] =
 * {'ai_classifier'}, byte-mirroring the Family D + Family G entries. A
 * source-type allowlist of {'ai_classifier'} automatically selects exactly
 * the 6 ai_classifier keys — no explicit key list is needed. The filter is
 * mode-agnostic, so admin_validation and production request paths share it.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §10a — thread-topology observations are structural
 *     facts about argument-tree shape; never verdicts.
 *   - cdiscourse-doctrine §7 — pure TS; no Deno-specific calls in the builder.
 *   - Stage 2B operator binding — 6-key ai_classifier subset only; no
 *     mcp-server change; no compound-key shape; no schema mirror change. The
 *     subset entry was added by Card 1A WITHOUT a productionEnabled flip; the
 *     later MCP-021C-EDGE-FAMILY-I-ENABLE (MCP-I-D2) card flipped
 *     thread_topology to productionEnabled:true, and SFI-9/SFI-10 below now
 *     bind that post-flip state (the subset entry stays byte-identical across
 *     the flip — it is mode-agnostic).
 */

import {
  edgeBuildBooleanObservationRequestForArgument,
  edgeGetMcpServerSupportedFamilySources,
  edgeLookupFamilyRegistryEntry,
} from './_helpers/booleanObservationEdgeDeno';

// The 6 ai_classifier keys the hosted MCP server supports for Family I.
// Source: supabase/functions/_shared/booleanObservations/machineObservationDefinitions/familyI.ts
const FAMILY_I_AI_CLASSIFIER_KEYS = [
  'introduces_new_issue',
  'references_prior_agreement',
  'introduces_sub_axis',
  'returns_to_prior_issue',
  'references_external_context',
  'compares_options',
] as const;

// The 15 deterministic keys (8 auto_metadata + 7 lifecycle) the hosted MCP
// server does NOT support; the Edge must NOT send them.
const FAMILY_I_DETERMINISTIC_EXCLUDED_KEYS = [
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

const FAMILY_I_BASE_INPUT = {
  argumentId: 'arg-i-1',
  parentArgumentId: 'arg-i-0',
  currentText: 'a reply that may introduce a new issue or sub-axis',
  parentText: 'a claim being evaluated for thread topology',
  threadContextExcerpt: 'thread context',
  requestedFamilies: ['thread_topology' as const],
  mode: 'admin_validation' as const,
};

describe('MCP-SERVER-010A-FAMILY-I Edge → MCP subset filter (Stage 2B fix)', () => {
  it('SFI-1 — getMcpServerSupportedFamilySources(thread_topology) === {ai_classifier}', () => {
    const sources = edgeGetMcpServerSupportedFamilySources('thread_topology');
    expect(sources).toBeDefined();
    expect(Array.from(sources!).sort()).toEqual(['ai_classifier']);
  });

  it('SFI-2 — Family I admin_validation request contains exactly 6 ai_classifier rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_I_BASE_INPUT);
    expect(req.requestedRawKeys.length).toBe(6);
  });

  it('SFI-3 — every Family I rawKey sent matches the operator-approved 6-key ai_classifier set', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_I_BASE_INPUT);
    const sent = new Set(req.requestedRawKeys);
    for (const expected of FAMILY_I_AI_CLASSIFIER_KEYS) {
      expect(sent.has(expected)).toBe(true);
    }
    expect(sent.size).toBe(6);
  });

  it('SFI-4 — Family I request does NOT include any of the 15 excluded deterministic rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_I_BASE_INPUT);
    const sent = new Set(req.requestedRawKeys);
    for (const excluded of FAMILY_I_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });

  it('SFI-5 — Family I definitions map size matches the 6 rawKeys (no orphan keys)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_I_BASE_INPUT);
    expect(Object.keys(req.definitions).length).toBe(6);
    for (const key of Object.keys(req.definitions)) {
      expect(FAMILY_I_AI_CLASSIFIER_KEYS.includes(key as never)).toBe(true);
    }
  });

  it('SFI-6 — every Family I definition emitted has source=ai_classifier', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_I_BASE_INPUT);
    for (const def of Object.values(req.definitions)) {
      expect(def.source).toBe('ai_classifier');
    }
  });

  it('SFI-7 — Family D (evidence_source_chain) subset entry is unchanged (still {ai_classifier} → 22 keys)', () => {
    const sources = edgeGetMcpServerSupportedFamilySources('evidence_source_chain');
    expect(sources).toBeDefined();
    expect(Array.from(sources!).sort()).toEqual(['ai_classifier']);
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_I_BASE_INPUT,
      requestedFamilies: ['evidence_source_chain'],
    });
    expect(req.requestedRawKeys.length).toBe(22);
  });

  it('SFI-8 — Family G (resolution_progress) subset entry is unchanged (still {ai_classifier} → 21 keys)', () => {
    const sources = edgeGetMcpServerSupportedFamilySources('resolution_progress');
    expect(sources).toBeDefined();
    expect(Array.from(sources!).sort()).toEqual(['ai_classifier']);
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_I_BASE_INPUT,
      requestedFamilies: ['resolution_progress'],
    });
    expect(req.requestedRawKeys.length).toBe(21);
  });

  it('SFI-9 — familyRegistry thread_topology entry is productionEnabled:true (post MCP-021C-EDGE-FAMILY-I-ENABLE / MCP-I-D2 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('thread_topology');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('SFI-10 — production-mode Family I request emits exactly the 6 ai_classifier keys with NO deterministic leak (subset filter is mode-agnostic; family is now productionEnabled)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_I_BASE_INPUT,
      mode: 'production',
    });
    // thread_topology IS productionEnabled (post MCP-I-D2 flip), so the
    // family survives the production filter; the mode-agnostic subset filter
    // then keeps only the 6 ai_classifier keys. No deterministic key may
    // appear, and every key present must be from the 6 ai_classifier set.
    expect(req.requestedRawKeys.length).toBe(6);
    const sent = new Set(req.requestedRawKeys);
    for (const excluded of FAMILY_I_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
    for (const key of req.requestedRawKeys) {
      expect(FAMILY_I_AI_CLASSIFIER_KEYS.includes(key as never)).toBe(true);
    }
    expect(req.requestedFamilies).toContain('thread_topology');
  });

  it('SFI-11 — multi-family request (I + A) sends Family A all-source + Family I ai_classifier only', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_I_BASE_INPUT,
      requestedFamilies: ['thread_topology', 'parent_relation'],
    });
    // 6 Family I ai_classifier + 19 Family A = 25 total (no overlap between families).
    // Family A = 19 post-MCP-BUILD2b (#540): 16 base parent_relation keys + 3 new
    // parent-relation quality booleans (acknowledges_parent_strength,
    // compares_parent_to_sibling_branch, identifies_parent_scope_limit).
    expect(req.requestedRawKeys.length).toBe(25);
    const sent = new Set(req.requestedRawKeys);
    for (const key of FAMILY_I_AI_CLASSIFIER_KEYS) {
      expect(sent.has(key)).toBe(true);
    }
    for (const excluded of FAMILY_I_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });
});
