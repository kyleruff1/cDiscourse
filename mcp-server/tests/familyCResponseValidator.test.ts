/**
 * MCP-SERVER-004-FAMILY-C — validateMcpBooleanObservationResponse Family C tests.
 *
 * The validator is the shared structural validator. This file exercises it
 * against Family C response shapes (20 keys, family-c-v1) to confirm the
 * validator works identically for Family C as it does for Family A/B.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validFamilyCResponse(): Record<string, unknown> {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-c-1',
    checkedRawKeys: ['offers_candidate_understanding', 'confirms_understanding'],
    observations: {
      offers_candidate_understanding: true,
      confirms_understanding: false,
    },
    confidence: {
      offers_candidate_understanding: 'high',
      confirms_understanding: 'medium',
    },
    evidenceSpan: {
      offers_candidate_understanding: 'Are you saying libraries are like roads?',
      confirms_understanding: null,
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-c-v1',
    },
  };
}

Deno.test('Family C validator: happy path returns ok=true with parsed value', () => {
  const result = validateMcpBooleanObservationResponse(validFamilyCResponse());
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.nodeId, 'node-c-1');
    assertEquals(result.value.modelInfo.provider, 'mcp');
    assertEquals(result.value.modelInfo.classifierSetVersion, 'family-c-v1');
  }
});

Deno.test('Family C validator: rejects wrong schemaVersion', () => {
  const r = validFamilyCResponse();
  r.schemaVersion = 'mcp-021.bogus.v99';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'schemaVersion');
  }
});

Deno.test('Family C validator: rejects missing observations field', () => {
  const r = validFamilyCResponse();
  delete (r as Record<string, unknown>).observations;
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'observations');
  }
});

Deno.test('Family C validator: rejects empty nodeId', () => {
  const r = validFamilyCResponse();
  r.nodeId = '';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'nodeId');
  }
});

Deno.test('Family C validator: rejects non-boolean observation value', () => {
  const r = validFamilyCResponse();
  r.observations = { offers_candidate_understanding: 'yes', confirms_understanding: false };
  r.confidence = { offers_candidate_understanding: 'high', confirms_understanding: 'medium' };
  r.evidenceSpan = { offers_candidate_understanding: null, confirms_understanding: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.path.startsWith('observations.')) {
      throw new Error(`Expected observations.<key> path; got ${result.path}`);
    }
  }
});

Deno.test('Family C validator: rejects confidence value outside low|medium|high', () => {
  const r = validFamilyCResponse();
  r.confidence = { offers_candidate_understanding: 'very_high', confirms_understanding: 'medium' };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C validator: rejects evidenceSpan value that is neither string nor null', () => {
  const r = validFamilyCResponse();
  r.evidenceSpan = { offers_candidate_understanding: 42, confirms_understanding: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C validator: rejects evidenceSpan string longer than MAX_EVIDENCE_SPAN_CHARS', () => {
  const r = validFamilyCResponse();
  const tooLong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 5);
  r.evidenceSpan = { offers_candidate_understanding: tooLong, confirms_understanding: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C validator: rejects observation key missing from confidence', () => {
  const r = validFamilyCResponse();
  r.confidence = { offers_candidate_understanding: 'high' }; // missing confirms_understanding
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.path.startsWith('confidence.')) {
      throw new Error(`Expected confidence.<key> path; got ${result.path}`);
    }
  }
});

Deno.test('Family C validator: rejects confidence key missing from observations', () => {
  const r = validFamilyCResponse();
  r.confidence = {
    offers_candidate_understanding: 'high',
    confirms_understanding: 'medium',
    rogue_extra_key: 'low',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C validator: rejects modelInfo without provider=mcp', () => {
  const r = validFamilyCResponse();
  r.modelInfo = {
    provider: 'anthropic',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: 'family-c-v1',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.provider');
  }
});

Deno.test('Family C validator: rejects modelInfo with empty classifierSetVersion', () => {
  const r = validFamilyCResponse();
  r.modelInfo = {
    provider: 'mcp',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: '',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C validator: accepts full 20-key response', () => {
  // Build a full 20-key response (17 + 3 MCP-BUILD2c) with each key explicitly
  // false (default state).
  const TWENTY_KEYS = [
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
    'offers_repair_path',
    'names_ambiguity_source',
    'accepts_correction',
  ];
  const obs: Record<string, boolean> = {};
  const conf: Record<string, string> = {};
  const evid: Record<string, null> = {};
  for (const key of TWENTY_KEYS) {
    obs[key] = false;
    conf[key] = 'medium';
    evid[key] = null;
  }
  const r = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-c-20',
    checkedRawKeys: TWENTY_KEYS,
    observations: obs,
    confidence: conf,
    evidenceSpan: evid,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-c-v1',
    },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.checkedRawKeys.length, 20);
  }
});

Deno.test('Family C validator: accepts evidenceSpan strings up to 240 chars', () => {
  const r = validFamilyCResponse();
  const exactly240 = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS);
  r.evidenceSpan = { offers_candidate_understanding: exactly240, confirms_understanding: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, true);
});

Deno.test('Family C validator: accepts confidence in {low, medium, high}', () => {
  for (const band of ['low', 'medium', 'high']) {
    const r = validFamilyCResponse();
    r.confidence = { offers_candidate_understanding: band, confirms_understanding: 'medium' };
    const result = validateMcpBooleanObservationResponse(r);
    assertEquals(result.ok, true, `confidence band '${band}' should be accepted`);
  }
});

Deno.test('Family C validator: observation key MUST appear in checkedRawKeys', () => {
  const r = validFamilyCResponse();
  r.checkedRawKeys = ['offers_candidate_understanding']; // missing confirms_understanding
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'checkedRawKeys');
  }
});

Deno.test('Family C validator: rejects observations field with > 20 keys (flag_count_too_high guard)', () => {
  // The shared validator caps at 20 keys. Family C has 17 binding keys; this
  // test confirms the cap still applies to Family C inputs.
  const tooMany = 25;
  const obs: Record<string, boolean> = {};
  const conf: Record<string, string> = {};
  const evid: Record<string, null> = {};
  const checked: string[] = [];
  for (let i = 0; i < tooMany; i++) {
    const key = `fake_key_${i}`;
    obs[key] = false;
    conf[key] = 'medium';
    evid[key] = null;
    checked.push(key);
  }
  const r = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-c-overflow',
    checkedRawKeys: checked,
    observations: obs,
    confidence: conf,
    evidenceSpan: evid,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-c-v1',
    },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});
