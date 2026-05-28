/**
 * MCP-SERVER-005-FAMILY-D — validateMcpBooleanObservationResponse Family D tests.
 *
 * The validator is the shared structural validator. This file exercises it
 * against Family D response shapes (19 Subset keys, family-d-v1) to confirm
 * the validator works identically for Family D as it does for Family A/B/C.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validFamilyDResponse(): Record<string, unknown> {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-d-1',
    checkedRawKeys: ['source_provided', 'provides_evidence'],
    observations: {
      source_provided: true,
      provides_evidence: true,
    },
    confidence: {
      source_provided: 'high',
      provides_evidence: 'high',
    },
    evidenceSpan: {
      source_provided: 'Per the 2024 EPA report Table 3.1',
      provides_evidence: 'Per the 2024 EPA report Table 3.1',
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-d-v1',
    },
  };
}

Deno.test('Family D validator: happy path returns ok=true with parsed value', () => {
  const result = validateMcpBooleanObservationResponse(validFamilyDResponse());
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.nodeId, 'node-d-1');
    assertEquals(result.value.modelInfo.provider, 'mcp');
    assertEquals(result.value.modelInfo.classifierSetVersion, 'family-d-v1');
  }
});

Deno.test('Family D validator: rejects wrong schemaVersion', () => {
  const r = validFamilyDResponse();
  r.schemaVersion = 'mcp-021.bogus.v99';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'schemaVersion');
  }
});

Deno.test('Family D validator: rejects missing observations field', () => {
  const r = validFamilyDResponse();
  delete (r as Record<string, unknown>).observations;
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'observations');
  }
});

Deno.test('Family D validator: rejects empty nodeId', () => {
  const r = validFamilyDResponse();
  r.nodeId = '';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'nodeId');
  }
});

Deno.test('Family D validator: rejects non-boolean observation value', () => {
  const r = validFamilyDResponse();
  r.observations = { source_provided: 'yes', provides_evidence: true };
  r.confidence = { source_provided: 'high', provides_evidence: 'high' };
  r.evidenceSpan = { source_provided: null, provides_evidence: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.path.startsWith('observations.')) {
      throw new Error(`Expected observations.<key> path; got ${result.path}`);
    }
  }
});

Deno.test('Family D validator: rejects confidence value outside low|medium|high', () => {
  const r = validFamilyDResponse();
  r.confidence = { source_provided: 'very_high', provides_evidence: 'high' };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D validator: rejects evidenceSpan value that is neither string nor null', () => {
  const r = validFamilyDResponse();
  r.evidenceSpan = { source_provided: 42, provides_evidence: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D validator: rejects evidenceSpan string longer than MAX_EVIDENCE_SPAN_CHARS', () => {
  const r = validFamilyDResponse();
  const tooLong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 5);
  r.evidenceSpan = { source_provided: tooLong, provides_evidence: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D validator: rejects observation key missing from confidence', () => {
  const r = validFamilyDResponse();
  r.confidence = { source_provided: 'high' }; // missing provides_evidence
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.path.startsWith('confidence.')) {
      throw new Error(`Expected confidence.<key> path; got ${result.path}`);
    }
  }
});

Deno.test('Family D validator: rejects confidence key missing from observations', () => {
  const r = validFamilyDResponse();
  r.confidence = {
    source_provided: 'high',
    provides_evidence: 'high',
    rogue_extra_key: 'low',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D validator: rejects modelInfo without provider=mcp', () => {
  const r = validFamilyDResponse();
  r.modelInfo = {
    provider: 'anthropic',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: 'family-d-v1',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.provider');
  }
});

Deno.test('Family D validator: rejects modelInfo with empty classifierSetVersion', () => {
  const r = validFamilyDResponse();
  r.modelInfo = {
    provider: 'mcp',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: '',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D validator: accepts full 19-key Subset response', () => {
  // Build a full 19-key response with each key explicitly false (default state).
  // The 19 keys MUST fit within the MAX_FLAGS_PER_RESPONSE=20 cap (19 ≤ 20).
  const NINETEEN_KEYS = [
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
  ];
  const obs: Record<string, boolean> = {};
  const conf: Record<string, string> = {};
  const evid: Record<string, null> = {};
  for (const key of NINETEEN_KEYS) {
    obs[key] = false;
    conf[key] = 'medium';
    evid[key] = null;
  }
  const r = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-d-19',
    checkedRawKeys: NINETEEN_KEYS,
    observations: obs,
    confidence: conf,
    evidenceSpan: evid,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-d-v1',
    },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.checkedRawKeys.length, 19);
  }
});

Deno.test('Family D validator: accepts evidenceSpan strings up to 240 chars', () => {
  const r = validFamilyDResponse();
  const exactly240 = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS);
  r.evidenceSpan = { source_provided: exactly240, provides_evidence: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, true);
});

Deno.test('Family D validator: accepts confidence in {low, medium, high}', () => {
  for (const band of ['low', 'medium', 'high']) {
    const r = validFamilyDResponse();
    r.confidence = { source_provided: band, provides_evidence: 'medium' };
    const result = validateMcpBooleanObservationResponse(r);
    assertEquals(result.ok, true, `confidence band '${band}' should be accepted`);
  }
});

Deno.test('Family D validator: observation key MUST appear in checkedRawKeys', () => {
  const r = validFamilyDResponse();
  r.checkedRawKeys = ['source_provided']; // missing provides_evidence
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'checkedRawKeys');
  }
});

Deno.test('Family D validator: rejects observations field with > 20 keys (flag_count_too_high guard)', () => {
  // The shared validator caps at 20 keys. Family D has 19 binding keys (well
  // under the cap); this test confirms the cap still applies for inputs that
  // exceed it.
  const tooMany = 25;
  const obs: Record<string, boolean> = {};
  const conf: Record<string, string> = {};
  const evid: Record<string, null> = {};
  const checked: string[] = [];
  for (let i = 0; i < tooMany; i++) {
    const key = `fake_d_key_${i}`;
    obs[key] = false;
    conf[key] = 'medium';
    evid[key] = null;
    checked.push(key);
  }
  const r = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-d-overflow',
    checkedRawKeys: checked,
    observations: obs,
    confidence: conf,
    evidenceSpan: evid,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-d-v1',
    },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});
