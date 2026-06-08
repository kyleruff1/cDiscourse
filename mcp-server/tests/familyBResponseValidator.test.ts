/**
 * MCP-SERVER-003-FAMILY-B — validateMcpBooleanObservationResponse Family B tests.
 *
 * The validator is the shared structural validator. This file exercises it
 * against Family B response shapes (14 keys, family-b-v1) to confirm the
 * validator works identically for Family B as it does for Family A.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validFamilyBResponse(): Record<string, unknown> {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-b-1',
    checkedRawKeys: ['disagreement_present', 'disputes_scope'],
    observations: {
      disagreement_present: true,
      disputes_scope: false,
    },
    confidence: {
      disagreement_present: 'high',
      disputes_scope: 'medium',
    },
    evidenceSpan: {
      disagreement_present: 'sample evidence span for Family B',
      disputes_scope: null,
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-b-v1',
    },
  };
}

Deno.test('Family B validator: happy path returns ok=true with parsed value', () => {
  const result = validateMcpBooleanObservationResponse(validFamilyBResponse());
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.nodeId, 'node-b-1');
    assertEquals(result.value.modelInfo.provider, 'mcp');
    assertEquals(result.value.modelInfo.classifierSetVersion, 'family-b-v1');
  }
});

Deno.test('Family B validator: rejects wrong schemaVersion', () => {
  const r = validFamilyBResponse();
  r.schemaVersion = 'mcp-021.bogus.v99';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'schemaVersion');
  }
});

Deno.test('Family B validator: rejects missing observations field', () => {
  const r = validFamilyBResponse();
  delete (r as Record<string, unknown>).observations;
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'observations');
  }
});

Deno.test('Family B validator: rejects empty nodeId', () => {
  const r = validFamilyBResponse();
  r.nodeId = '';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'nodeId');
  }
});

Deno.test('Family B validator: rejects non-boolean observation value', () => {
  const r = validFamilyBResponse();
  r.observations = { disagreement_present: 'yes', disputes_scope: false };
  r.confidence = { disagreement_present: 'high', disputes_scope: 'medium' };
  r.evidenceSpan = { disagreement_present: null, disputes_scope: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.path.startsWith('observations.')) {
      throw new Error(`Expected observations.<key> path; got ${result.path}`);
    }
  }
});

Deno.test('Family B validator: rejects confidence value outside low|medium|high', () => {
  const r = validFamilyBResponse();
  r.confidence = { disagreement_present: 'very_high', disputes_scope: 'medium' };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B validator: rejects evidenceSpan value that is neither string nor null', () => {
  const r = validFamilyBResponse();
  r.evidenceSpan = { disagreement_present: 42, disputes_scope: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B validator: rejects evidenceSpan string longer than MAX_EVIDENCE_SPAN_CHARS', () => {
  const r = validFamilyBResponse();
  const tooLong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 5);
  r.evidenceSpan = { disagreement_present: tooLong, disputes_scope: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B validator: rejects observation key missing from confidence', () => {
  const r = validFamilyBResponse();
  r.confidence = { disagreement_present: 'high' }; // missing disputes_scope
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.path.startsWith('confidence.')) {
      throw new Error(`Expected confidence.<key> path; got ${result.path}`);
    }
  }
});

Deno.test('Family B validator: rejects confidence key missing from observations', () => {
  const r = validFamilyBResponse();
  r.confidence = {
    disagreement_present: 'high',
    disputes_scope: 'medium',
    rogue_extra_key: 'low',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B validator: rejects modelInfo without provider=mcp', () => {
  const r = validFamilyBResponse();
  r.modelInfo = {
    provider: 'anthropic',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: 'family-b-v1',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.provider');
  }
});

Deno.test('Family B validator: rejects modelInfo with empty classifierSetVersion', () => {
  const r = validFamilyBResponse();
  r.modelInfo = {
    provider: 'mcp',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: '',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B validator: accepts full 17-key response', () => {
  // Build a full 17-key response with each key explicitly false (default
  // state). MCP-BUILD2a added 3 disagreement-quality booleans (14 → 17).
  const SEVENTEEN_KEYS = [
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
    'isolates_main_disagreement',
    'distinguishes_fact_value_disagreement',
    'preserves_face_while_disagreeing',
  ];
  const obs: Record<string, boolean> = {};
  const conf: Record<string, string> = {};
  const evid: Record<string, null> = {};
  for (const key of SEVENTEEN_KEYS) {
    obs[key] = false;
    conf[key] = 'medium';
    evid[key] = null;
  }
  const r = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-b-17',
    checkedRawKeys: SEVENTEEN_KEYS,
    observations: obs,
    confidence: conf,
    evidenceSpan: evid,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-b-v1',
    },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.checkedRawKeys.length, 17);
  }
});

Deno.test('Family B validator: accepts evidenceSpan strings up to 240 chars', () => {
  const r = validFamilyBResponse();
  const exactly240 = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS);
  r.evidenceSpan = { disagreement_present: exactly240, disputes_scope: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, true);
});

Deno.test('Family B validator: accepts confidence in {low, medium, high}', () => {
  for (const band of ['low', 'medium', 'high']) {
    const r = validFamilyBResponse();
    r.confidence = { disagreement_present: band, disputes_scope: 'medium' };
    const result = validateMcpBooleanObservationResponse(r);
    assertEquals(result.ok, true, `confidence band '${band}' should be accepted`);
  }
});

Deno.test('Family B validator: observation key MUST appear in checkedRawKeys', () => {
  const r = validFamilyBResponse();
  r.checkedRawKeys = ['disagreement_present']; // missing disputes_scope
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'checkedRawKeys');
  }
});
