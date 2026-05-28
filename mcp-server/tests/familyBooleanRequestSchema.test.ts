/**
 * OPS-MCP-FAMILY-VALIDATOR-REFACTOR — Direct tests for validateFamilyBooleanRequest.
 *
 * These tests exercise the validator at the function-call boundary, asserting
 * byte-equal envelope shapes for every failure path documented in design §2.4.
 * The byte-equal preservation is the dominant risk per HALT #14; the 14
 * literal failure-string assertions below are the primary mitigation.
 *
 * The validator queries the production singleton registry; we ensure Family A
 * is registered at module load (defensive — Commit 3 introduces
 * `familyRegistryInit.ts` which is the canonical registration site; this
 * guard makes the test file robust to import order without double-registering).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — validator never produces verdict tokens;
 *     these tests assert only structural error envelopes.
 *   - test-discipline — byte-equal failure-string preservation across the
 *     11 validation rules listed in design §2.4.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { validateFamilyBooleanRequest } from '../lib/familyBooleanRequestSchema.ts';
import { isFamilySupported, register } from '../lib/familyRegistry.ts';
import {
  FAMILY_A_RAW_KEYS,
  FAMILY_A_CLASSIFIER_SET_VERSION,
} from '../lib/familyAKeys.ts';
import {
  FAMILY_B_RAW_KEYS,
  FAMILY_B_CLASSIFIER_SET_VERSION,
} from '../lib/familyBKeys.ts';
import {
  FAMILY_C_RAW_KEYS,
  FAMILY_C_CLASSIFIER_SET_VERSION,
} from '../lib/familyCKeys.ts';
import {
  FAMILY_D_RAW_KEYS,
  FAMILY_D_CLASSIFIER_SET_VERSION,
  FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS,
} from '../lib/familyDKeys.ts';

// Ensure Family A + Family B + Family C + Family D are registered in the
// production singleton for these tests. familyRegistryInit.ts is the
// canonical registration site; these guards keep the test self-sufficient
// and avoid a double-register throw if init happens elsewhere in the
// module graph.
if (!isFamilySupported('parent_relation')) {
  register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
}
if (!isFamilySupported('disagreement_axis')) {
  register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
}
if (!isFamilySupported('misunderstanding_repair')) {
  register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
}
if (!isFamilySupported('evidence_source_chain')) {
  register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
}

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1';

function validRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-1',
    parentNodeId: null,
    currentText: 'test body',
    parentText: null,
    threadContextExcerpt: 'test thread excerpt',
    requestedFamilies: ['parent_relation'],
    requestedRawKeys: ['supports_parent', 'challenges_parent'],
    definitions: {},
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('validateFamilyBooleanRequest-valid-family-a-request-passes', () => {
  const result = validateFamilyBooleanRequest(validRequest());
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.schemaVersion, SCHEMA_VERSION);
    assertEquals(result.value.nodeId, 'test-node-1');
    assertEquals(result.value.parentNodeId, null);
    assertEquals(result.value.currentText, 'test body');
    assertEquals(result.value.parentText, null);
    assertEquals(result.value.threadContextExcerpt, 'test thread excerpt');
    assertEquals(result.value.requestedFamilies, ['parent_relation']);
    assertEquals(result.value.requestedRawKeys, ['supports_parent', 'challenges_parent']);
    assertEquals(result.value.timeoutMs, 12000);
  }
});

Deno.test('validateFamilyBooleanRequest-empty-requestedRawKeys-array-accepted', () => {
  const result = validateFamilyBooleanRequest(validRequest({ requestedRawKeys: [] }));
  assertEquals(result.ok, true);
});

Deno.test('validateFamilyBooleanRequest-empty-requestedFamilies-array-accepted', () => {
  const result = validateFamilyBooleanRequest(validRequest({ requestedFamilies: [] }));
  assertEquals(result.ok, true);
});

Deno.test('validateFamilyBooleanRequest-rejects-non-object-with-invalid_params', () => {
  const result = validateFamilyBooleanRequest('string');
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, '$');
    assertEquals(result.detail, 'must be a plain object');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-bad-schemaVersion', () => {
  const result = validateFamilyBooleanRequest(validRequest({ schemaVersion: 'wrong' }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'schemaVersion');
    assertEquals(result.detail, `expected ${SCHEMA_VERSION}; got wrong`);
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-non-string-nodeId', () => {
  const result = validateFamilyBooleanRequest(validRequest({ nodeId: 123 }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'nodeId');
    assertEquals(result.detail, 'must be string');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-empty-nodeId', () => {
  const result = validateFamilyBooleanRequest(validRequest({ nodeId: '' }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'nodeId');
    assertEquals(result.detail, 'length below 1');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-oversized-nodeId', () => {
  const result = validateFamilyBooleanRequest(validRequest({ nodeId: 'x'.repeat(513) }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'nodeId');
    assertEquals(result.detail, 'length above 512');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-oversized-currentText', () => {
  const result = validateFamilyBooleanRequest(validRequest({ currentText: 'x'.repeat(8001) }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'currentText');
    assertEquals(result.detail, 'length above 8000');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-oversized-parentText', () => {
  const result = validateFamilyBooleanRequest(validRequest({ parentText: 'x'.repeat(8001) }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'parentText');
    assertEquals(result.detail, 'length above 8000');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-oversized-threadContextExcerpt', () => {
  const result = validateFamilyBooleanRequest(
    validRequest({ threadContextExcerpt: 'x'.repeat(8001) }),
  );
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'threadContextExcerpt');
    assertEquals(result.detail, 'length above 8000');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-unsupported-family-with-byte-equal-envelope', () => {
  // MCP-SERVER-005-FAMILY-D registered 'evidence_source_chain'; the test
  // now exercises an UNREGISTERED family (Family E: argument_scheme).
  // Envelope shape is byte-equal-preserved: kind=unsupported_family,
  // requestedFamilies field echoes the requested array.
  const result = validateFamilyBooleanRequest(
    validRequest({ requestedFamilies: ['argument_scheme'] }),
  );
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_family') {
    assertEquals(result.requestedFamilies, ['argument_scheme']);
  } else {
    throw new Error('expected unsupported_family failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-unsupported-rawKey-with-byte-equal-envelope', () => {
  const result = validateFamilyBooleanRequest(
    validRequest({ requestedRawKeys: ['supports_parent', 'fictional_raw_key_xyz'] }),
  );
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    // Only the unsupported one in the envelope; the supported one is filtered
    // out (matches pre-refactor behavior).
    assertEquals(result.unsupportedRawKeys, ['fictional_raw_key_xyz']);
  } else {
    throw new Error('expected unsupported_rawKey failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-non-plain-object-definitions', () => {
  const result = validateFamilyBooleanRequest(validRequest({ definitions: [] }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'definitions');
    assertEquals(result.detail, 'must be plain object');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-non-integer-timeoutMs', () => {
  const result = validateFamilyBooleanRequest(validRequest({ timeoutMs: 12.5 }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'timeoutMs');
    assertEquals(result.detail, 'must be integer');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-timeoutMs-below-1', () => {
  const result = validateFamilyBooleanRequest(validRequest({ timeoutMs: 0 }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'timeoutMs');
    assertEquals(result.detail, 'out of range 1..60000');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-timeoutMs-above-60000', () => {
  const result = validateFamilyBooleanRequest(validRequest({ timeoutMs: 60001 }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'timeoutMs');
    assertEquals(result.detail, 'out of range 1..60000');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-003-FAMILY-B additions
// ─────────────────────────────────────────────────────────────────────────

Deno.test('validateFamilyBooleanRequest-valid-family-b-request-passes', () => {
  const req = validRequest({
    requestedFamilies: ['disagreement_axis'],
    requestedRawKeys: ['disagreement_present', 'disputes_definition'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.requestedFamilies, ['disagreement_axis']);
    assertEquals(result.value.requestedRawKeys, ['disagreement_present', 'disputes_definition']);
  }
});

Deno.test('validateFamilyBooleanRequest-family-b-request-with-empty-rawKeys-passes', () => {
  const req = validRequest({
    requestedFamilies: ['disagreement_axis'],
    requestedRawKeys: [],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, true);
});

Deno.test('validateFamilyBooleanRequest-family-b-request-with-all-14-rawKeys-passes', () => {
  const req = validRequest({
    requestedFamilies: ['disagreement_axis'],
    requestedRawKeys: [
      'disputes_evidence_applicability',
      'disagreement_present',
      'disputes_definition',
      'disputes_scope',
      'disputes_fact',
      'disputes_causal_link',
      'disputes_value_weighting',
      'disputes_decision_criterion',
      'disputes_generalization',
      'disputes_analogy',
      'disputes_interpretation',
      'disputes_priority_order',
      'disputes_remedy_or_solution',
      'disputes_relevance',
    ],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.requestedRawKeys.length, 14);
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-a-key-under-disagreement-axis', () => {
  // Sending a Family A rawKey ('supports_parent') under
  // requestedFamilies=['disagreement_axis'] must be rejected — the rawKey
  // is supported in Family A but NOT in Family B's set.
  const req = validRequest({
    requestedFamilies: ['disagreement_axis'],
    requestedRawKeys: ['supports_parent'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['supports_parent']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family A key');
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-b-key-under-parent-relation', () => {
  // Symmetric: sending a Family B rawKey ('disputes_definition') under
  // requestedFamilies=['parent_relation'] must be rejected.
  const req = validRequest({
    requestedFamilies: ['parent_relation'],
    requestedRawKeys: ['disputes_definition'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['disputes_definition']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family B key');
  }
});

Deno.test('validateFamilyBooleanRequest-empty-requestedFamilies-with-family-b-rawKey-rejects', () => {
  // When requestedFamilies is empty, the validator defaults to checking
  // rawKeys against Family A only (byte-equal-preservation anchor in
  // familyBooleanRequestSchema.ts:50). A Family B rawKey under empty
  // requestedFamilies is therefore rejected as unsupported_rawKey.
  const req = validRequest({
    requestedFamilies: [],
    requestedRawKeys: ['disagreement_present'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['disagreement_present']);
  } else {
    throw new Error('expected unsupported_rawKey failure for Family B key under empty families');
  }
});

Deno.test('validateFamilyBooleanRequest-e-f-g-h-i-j-still-rejected-as-unsupported-family', () => {
  // Regression: Family E/F/G/H/I/J remain unsupported after Family D lands.
  // (Family D is now supported as of MCP-SERVER-005-FAMILY-D Subset path.)
  for (const family of [
    'argument_scheme',
    'critical_question',
    'resolution_progress',
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ]) {
    const result = validateFamilyBooleanRequest(validRequest({ requestedFamilies: [family] }));
    assertEquals(result.ok, false, `${family} should be unsupported`);
    if (!result.ok && result.kind === 'unsupported_family') {
      assertEquals(result.requestedFamilies, [family]);
    } else {
      throw new Error(`expected unsupported_family for ${family}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-004-FAMILY-C additions
// ─────────────────────────────────────────────────────────────────────────

Deno.test('validateFamilyBooleanRequest-valid-family-c-request-passes', () => {
  const req = validRequest({
    requestedFamilies: ['misunderstanding_repair'],
    requestedRawKeys: ['offers_candidate_understanding', 'confirms_understanding'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.requestedFamilies, ['misunderstanding_repair']);
    assertEquals(result.value.requestedRawKeys, ['offers_candidate_understanding', 'confirms_understanding']);
  }
});

Deno.test('validateFamilyBooleanRequest-family-c-request-with-empty-rawKeys-passes', () => {
  const req = validRequest({
    requestedFamilies: ['misunderstanding_repair'],
    requestedRawKeys: [],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, true);
});

Deno.test('validateFamilyBooleanRequest-family-c-request-with-all-17-rawKeys-passes', () => {
  const req = validRequest({
    requestedFamilies: ['misunderstanding_repair'],
    requestedRawKeys: [
      'clarified',
      'requests_clarification',
      'answers_clarification',
      'provides_alternate_interpretation',
      'offers_candidate_understanding',
      'confirms_understanding',
      'rejects_candidate_understanding',
      'requests_restatement',
      'self_initiates_self_repair',
      'other_initiates_repair',
      'acknowledges_misread',
      'flags_ambiguous_reference',
      'flags_term_ambiguity',
      'proposes_shared_definition',
      'confirms_shared_definition',
      'scope_mismatch_identified',
      'question_answer_mismatch',
    ],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.requestedRawKeys.length, 17);
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-a-key-under-misunderstanding-repair', () => {
  // Sending a Family A rawKey ('supports_parent') under
  // requestedFamilies=['misunderstanding_repair'] must be rejected — the
  // rawKey is supported in Family A but NOT in Family C's set.
  const req = validRequest({
    requestedFamilies: ['misunderstanding_repair'],
    requestedRawKeys: ['supports_parent'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['supports_parent']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family A key under C');
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-b-key-under-misunderstanding-repair', () => {
  // Sending a Family B rawKey ('disputes_definition') under
  // requestedFamilies=['misunderstanding_repair'] must be rejected.
  const req = validRequest({
    requestedFamilies: ['misunderstanding_repair'],
    requestedRawKeys: ['disputes_definition'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['disputes_definition']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family B key under C');
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-c-key-under-disagreement-axis', () => {
  // Symmetric: sending a Family C rawKey ('offers_candidate_understanding')
  // under requestedFamilies=['disagreement_axis'] must be rejected.
  const req = validRequest({
    requestedFamilies: ['disagreement_axis'],
    requestedRawKeys: ['offers_candidate_understanding'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['offers_candidate_understanding']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family C key under B');
  }
});

Deno.test('validateFamilyBooleanRequest-empty-requestedFamilies-with-family-c-rawKey-rejects', () => {
  // When requestedFamilies is empty, the validator defaults to checking
  // rawKeys against Family A only (byte-equal-preservation anchor). A
  // Family C rawKey under empty requestedFamilies is therefore rejected as
  // unsupported_rawKey.
  const req = validRequest({
    requestedFamilies: [],
    requestedRawKeys: ['offers_candidate_understanding'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['offers_candidate_understanding']);
  } else {
    throw new Error('expected unsupported_rawKey failure for Family C key under empty families');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-005-FAMILY-D additions
// ─────────────────────────────────────────────────────────────────────────

Deno.test('validateFamilyBooleanRequest-valid-family-d-request-passes', () => {
  const req = validRequest({
    requestedFamilies: ['evidence_source_chain'],
    requestedRawKeys: ['source_provided', 'provides_evidence'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.requestedFamilies, ['evidence_source_chain']);
    assertEquals(result.value.requestedRawKeys, ['source_provided', 'provides_evidence']);
  }
});

Deno.test('validateFamilyBooleanRequest-family-d-request-with-empty-rawKeys-passes', () => {
  const req = validRequest({
    requestedFamilies: ['evidence_source_chain'],
    requestedRawKeys: [],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, true);
});

Deno.test('validateFamilyBooleanRequest-family-d-request-with-all-19-rawKeys-passes', () => {
  const req = validRequest({
    requestedFamilies: ['evidence_source_chain'],
    requestedRawKeys: [
      'asks_for_evidence',
      'provides_evidence',
      'evidence_supports_claim',
      'creates_source_chain_gap',
      'opens_evidence_debt_marker',
      'closes_evidence_debt_marker',
      'supplies_corroborating_document',
      'source_provided',
      'quote_provided',
      'concrete_example_requested',
      'concrete_example_provided',
      'evidence_claim_present',
      'evidence_gap_present',
      'source_chain_repair',
      'anecdote_used',
      'statistic_used',
      'external_authority_used',
      'evidence_quality_questioned',
      'burden_request_present',
    ],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.requestedRawKeys.length, 19);
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-a-key-under-evidence-source-chain', () => {
  // Sending a Family A rawKey ('supports_parent') under
  // requestedFamilies=['evidence_source_chain'] must be rejected — the
  // rawKey is supported in Family A but NOT in Family D's set.
  const req = validRequest({
    requestedFamilies: ['evidence_source_chain'],
    requestedRawKeys: ['supports_parent'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['supports_parent']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family A key under D');
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-b-key-under-evidence-source-chain', () => {
  const req = validRequest({
    requestedFamilies: ['evidence_source_chain'],
    requestedRawKeys: ['disputes_definition'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['disputes_definition']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family B key under D');
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-c-key-under-evidence-source-chain', () => {
  const req = validRequest({
    requestedFamilies: ['evidence_source_chain'],
    requestedRawKeys: ['offers_candidate_understanding'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['offers_candidate_understanding']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family C key under D');
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-d-key-under-parent-relation', () => {
  const req = validRequest({
    requestedFamilies: ['parent_relation'],
    requestedRawKeys: ['source_provided'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['source_provided']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family D key under A');
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-d-key-under-disagreement-axis', () => {
  const req = validRequest({
    requestedFamilies: ['disagreement_axis'],
    requestedRawKeys: ['evidence_gap_present'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['evidence_gap_present']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family D key under B');
  }
});

Deno.test('validateFamilyBooleanRequest-cross-family-rejection-family-d-key-under-misunderstanding-repair', () => {
  const req = validRequest({
    requestedFamilies: ['misunderstanding_repair'],
    requestedRawKeys: ['burden_request_present'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['burden_request_present']);
  } else {
    throw new Error('expected unsupported_rawKey failure for cross-family Family D key under C');
  }
});

Deno.test('validateFamilyBooleanRequest-family-d-rejects-excluded-deterministic-rawKeys-as-unsupported-rawKey', () => {
  // Stage 2B operator binding: the 8 excluded deterministic Family D
  // rawKeys (5 auto_metadata + 3 lifecycle) must NOT be silently
  // converted into model-inferred keys. Requesting any of them under
  // requestedFamilies=['evidence_source_chain'] returns unsupported_rawKey
  // at the registry boundary (HALT trigger #15 / #18-22 safeguard:
  // deterministic excluded keys do not become AI-inferred keys).
  for (const excluded of FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS) {
    const req = validRequest({
      requestedFamilies: ['evidence_source_chain'],
      requestedRawKeys: [excluded],
    });
    const result = validateFamilyBooleanRequest(req);
    assertEquals(result.ok, false, `excluded deterministic rawKey '${excluded}' must be rejected`);
    if (!result.ok && result.kind === 'unsupported_rawKey') {
      assertEquals(result.unsupportedRawKeys, [excluded]);
    } else {
      throw new Error(`expected unsupported_rawKey for excluded deterministic '${excluded}'`);
    }
  }
});

Deno.test('validateFamilyBooleanRequest-empty-requestedFamilies-with-family-d-rawKey-rejects', () => {
  // When requestedFamilies is empty, the validator defaults to checking
  // rawKeys against Family A only. A Family D rawKey under empty
  // requestedFamilies is therefore rejected as unsupported_rawKey.
  const req = validRequest({
    requestedFamilies: [],
    requestedRawKeys: ['source_provided'],
  });
  const result = validateFamilyBooleanRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    assertEquals(result.unsupportedRawKeys, ['source_provided']);
  } else {
    throw new Error('expected unsupported_rawKey failure for Family D key under empty families');
  }
});

Deno.test('validateFamilyBooleanRequest-family-a-and-b-and-c-still-pass-after-d-registered', () => {
  // Regression: Family A/B/C requests still validate cleanly after
  // Family D registration.
  const reqA = validRequest({
    requestedFamilies: ['parent_relation'],
    requestedRawKeys: ['supports_parent'],
  });
  assertEquals(validateFamilyBooleanRequest(reqA).ok, true);
  const reqB = validRequest({
    requestedFamilies: ['disagreement_axis'],
    requestedRawKeys: ['disagreement_present'],
  });
  assertEquals(validateFamilyBooleanRequest(reqB).ok, true);
  const reqC = validRequest({
    requestedFamilies: ['misunderstanding_repair'],
    requestedRawKeys: ['offers_candidate_understanding'],
  });
  assertEquals(validateFamilyBooleanRequest(reqC).ok, true);
});
