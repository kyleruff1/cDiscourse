/**
 * MCP-SERVER-006-FAMILY-E — validateMcpBooleanObservationResponse Family E tests.
 *
 * The validator is the shared structural validator. This file exercises it
 * against Family E response shapes (16 keys, family-e-v1) to confirm
 * the validator works identically for Family E as it does for Family A/B/C/D.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validFamilyEResponse(): Record<string, unknown> {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-e-1',
    checkedRawKeys: ['slippery_slope_reasoning_present', 'causal_reasoning_present'],
    observations: {
      slippery_slope_reasoning_present: true,
      causal_reasoning_present: false,
    },
    confidence: {
      slippery_slope_reasoning_present: 'high',
      causal_reasoning_present: 'medium',
    },
    evidenceSpan: {
      slippery_slope_reasoning_present: 'leads to banning Y, then Z, then mainstream censorship',
      causal_reasoning_present: null,
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-e-v1',
    },
  };
}

Deno.test('Family E validator: happy path returns ok=true with parsed value', () => {
  const result = validateMcpBooleanObservationResponse(validFamilyEResponse());
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.nodeId, 'node-e-1');
    assertEquals(result.value.modelInfo.provider, 'mcp');
    assertEquals(result.value.modelInfo.classifierSetVersion, 'family-e-v1');
  }
});

Deno.test('Family E validator: rejects wrong schemaVersion', () => {
  const r = validFamilyEResponse();
  r.schemaVersion = 'mcp-021.bogus.v99';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'schemaVersion');
  }
});

Deno.test('Family E validator: rejects missing observations field', () => {
  const r = validFamilyEResponse();
  delete (r as Record<string, unknown>).observations;
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'observations');
  }
});

Deno.test('Family E validator: rejects empty nodeId', () => {
  const r = validFamilyEResponse();
  r.nodeId = '';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'nodeId');
  }
});

Deno.test('Family E validator: rejects non-boolean observation value', () => {
  const r = validFamilyEResponse();
  r.observations = { slippery_slope_reasoning_present: 'yes', causal_reasoning_present: false };
  r.confidence = { slippery_slope_reasoning_present: 'high', causal_reasoning_present: 'medium' };
  r.evidenceSpan = { slippery_slope_reasoning_present: null, causal_reasoning_present: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.path.startsWith('observations.')) {
      throw new Error(`Expected observations.<key> path; got ${result.path}`);
    }
  }
});

Deno.test('Family E validator: rejects confidence value outside low|medium|high', () => {
  const r = validFamilyEResponse();
  r.confidence = { slippery_slope_reasoning_present: 'very_high', causal_reasoning_present: 'medium' };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E validator: rejects evidenceSpan value that is neither string nor null', () => {
  const r = validFamilyEResponse();
  r.evidenceSpan = { slippery_slope_reasoning_present: 42, causal_reasoning_present: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E validator: rejects evidenceSpan string longer than MAX_EVIDENCE_SPAN_CHARS', () => {
  const r = validFamilyEResponse();
  const tooLong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 5);
  r.evidenceSpan = { slippery_slope_reasoning_present: tooLong, causal_reasoning_present: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E validator: rejects observation key missing from confidence', () => {
  const r = validFamilyEResponse();
  r.confidence = { slippery_slope_reasoning_present: 'high' }; // missing causal_reasoning_present
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.path.startsWith('confidence.')) {
      throw new Error(`Expected confidence.<key> path; got ${result.path}`);
    }
  }
});

Deno.test('Family E validator: rejects confidence key missing from observations', () => {
  const r = validFamilyEResponse();
  r.confidence = {
    slippery_slope_reasoning_present: 'high',
    causal_reasoning_present: 'medium',
    rogue_extra_key: 'low',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E validator: rejects modelInfo without provider=mcp', () => {
  const r = validFamilyEResponse();
  r.modelInfo = {
    provider: 'anthropic',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: 'family-e-v1',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.provider');
  }
});

Deno.test('Family E validator: rejects modelInfo with empty classifierSetVersion', () => {
  const r = validFamilyEResponse();
  r.modelInfo = {
    provider: 'mcp',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: '',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E validator: accepts full 16-key response', () => {
  // Build a full 16-key response with each key explicitly false (default state).
  // The 16 keys MUST fit within the MAX_FLAGS_PER_RESPONSE=20 cap (16 ≤ 20).
  const SIXTEEN_KEYS = [
    'causal_reasoning_present',
    'analogy_reasoning_present',
    'example_reasoning_present',
    'authority_reasoning_present',
    'consequence_reasoning_present',
    'principle_reasoning_present',
    'definition_reasoning_present',
    'classification_reasoning_present',
    'precedent_reasoning_present',
    'means_end_reasoning_present',
    'tradeoff_reasoning_present',
    'abductive_explanation_present',
    'exception_reasoning_present',
    'slippery_slope_reasoning_present',
    'cost_benefit_reasoning_present',
    'risk_reasoning_present',
  ];
  const obs: Record<string, boolean> = {};
  const conf: Record<string, string> = {};
  const evid: Record<string, null> = {};
  for (const key of SIXTEEN_KEYS) {
    obs[key] = false;
    conf[key] = 'medium';
    evid[key] = null;
  }
  const r = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-e-16',
    checkedRawKeys: SIXTEEN_KEYS,
    observations: obs,
    confidence: conf,
    evidenceSpan: evid,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-e-v1',
    },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.checkedRawKeys.length, 16);
  }
});

Deno.test('Family E validator: accepts evidenceSpan strings up to 240 chars', () => {
  const r = validFamilyEResponse();
  const exactly240 = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS);
  r.evidenceSpan = { slippery_slope_reasoning_present: exactly240, causal_reasoning_present: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, true);
});

Deno.test('Family E validator: accepts confidence in {low, medium, high}', () => {
  for (const band of ['low', 'medium', 'high']) {
    const r = validFamilyEResponse();
    r.confidence = { slippery_slope_reasoning_present: band, causal_reasoning_present: 'medium' };
    const result = validateMcpBooleanObservationResponse(r);
    assertEquals(result.ok, true, `confidence band '${band}' should be accepted`);
  }
});

Deno.test('Family E validator: observation key MUST appear in checkedRawKeys', () => {
  const r = validFamilyEResponse();
  r.checkedRawKeys = ['slippery_slope_reasoning_present']; // missing causal_reasoning_present
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'checkedRawKeys');
  }
});

Deno.test('Family E validator: rejects observations field with > 20 keys (flag_count_too_high guard)', () => {
  // The shared validator caps at 20 keys. Family E has 16 binding keys (well
  // under the cap); this test confirms the cap still applies for inputs that
  // exceed it.
  const tooMany = 25;
  const obs: Record<string, boolean> = {};
  const conf: Record<string, string> = {};
  const evid: Record<string, null> = {};
  const checked: string[] = [];
  for (let i = 0; i < tooMany; i++) {
    const key = `fake_e_key_${i}`;
    obs[key] = false;
    conf[key] = 'medium';
    evid[key] = null;
    checked.push(key);
  }
  const r = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-e-overflow',
    checkedRawKeys: checked,
    observations: obs,
    confidence: conf,
    evidenceSpan: evid,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-e-v1',
    },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});
