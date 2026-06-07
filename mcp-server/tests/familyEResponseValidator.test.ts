/**
 * MCP-SERVER-006-FAMILY-E — validateMcpBooleanObservationResponse Family E tests.
 *
 * The validator is the shared structural validator. This file exercises it
 * against Family E response shapes (19 keys post MCP-BUILD2e, family-e-v1) to
 * confirm the validator works identically for Family E as it does for Family
 * A/B/C/D.
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

Deno.test('Family E validator: accepts full 19-key response', () => {
  // MCP-BUILD2e: build a full 19-key response (16 + 3 new structure keys) with
  // each key explicitly false (default state). The 19 keys MUST fit within the
  // MAX_FLAGS_PER_RESPONSE=20 cap (19 ≤ 20 — manifest §0.5 cap confirmation).
  const NINETEEN_KEYS = [
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
    'linked_premise_structure',
    'convergent_premise_structure',
    'enthymeme_gap_detected',
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
    nodeId: 'node-e-19',
    checkedRawKeys: NINETEEN_KEYS,
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
    assertEquals(result.value.checkedRawKeys.length, 19);
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
  // The shared validator caps at 20 keys. Family E has 19 binding keys post
  // MCP-BUILD2e (still under the cap); this test confirms the cap still applies
  // for inputs that exceed it.
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

// ── OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING — drill-derived regressions ──
//
// The R3 classification from PR #420 logged the two specific validator
// failure paths the chronic argument_scheme cluster produces under burst:
// (a) evidenceSpan.abductive_explanation_present with a non-string non-null
// value (the drill's "evidenceSpan.abductive_explanation_present = 1" path
// count), and (b) observations carrying a key the model did not include in
// checkedRawKeys (the drill's "checkedRawKeys = 2" path count). These tests
// name the specific failure shape so a future regression flips them red.

Deno.test('Family E validator: drill regression — rejects evidenceSpan.abductive_explanation_present when value is a plain object', () => {
  const r = validFamilyEResponse();
  r.checkedRawKeys = ['abductive_explanation_present'];
  r.observations = { abductive_explanation_present: true };
  r.confidence = { abductive_explanation_present: 'medium' };
  // Drill-observed shape drift: model returned a structured object instead
  // of a string-or-null. Validator must reject with path
  // 'evidenceSpan.abductive_explanation_present'.
  r.evidenceSpan = {
    abductive_explanation_present: { quote: 'leads to platform suppression', confidence: 'high' },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.abductive_explanation_present');
  }
});

Deno.test('Family E validator: drill regression — rejects evidenceSpan.abductive_explanation_present when value is an array', () => {
  const r = validFamilyEResponse();
  r.checkedRawKeys = ['abductive_explanation_present'];
  r.observations = { abductive_explanation_present: true };
  r.confidence = { abductive_explanation_present: 'medium' };
  // Drill-observed shape drift variant: array instead of string-or-null.
  r.evidenceSpan = {
    abductive_explanation_present: ['leads to platform suppression', 'then mainstream'],
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.abductive_explanation_present');
  }
});

Deno.test('Family E validator: drill regression — rejects checkedRawKeys when observations contains an extra key the model failed to include', () => {
  const r = validFamilyEResponse();
  // Drill-observed checkedRawKeys arity/membership mismatch: model emitted
  // observations for a key it did not list in checkedRawKeys. Validator
  // must reject with path 'checkedRawKeys' and the drill-style detail.
  r.checkedRawKeys = ['slippery_slope_reasoning_present'];
  r.observations = {
    slippery_slope_reasoning_present: true,
    abductive_explanation_present: false,
  };
  r.confidence = {
    slippery_slope_reasoning_present: 'high',
    abductive_explanation_present: 'medium',
  };
  r.evidenceSpan = {
    slippery_slope_reasoning_present: 'leads to banning Y, then Z',
    abductive_explanation_present: null,
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'checkedRawKeys');
  }
});

Deno.test('Family E validator: acceptance — packet with strict key-set equality across all four maps and null evidenceSpan for false observations', () => {
  // This codifies the shape the new STRICT RESPONSE-SHAPE CONTRACT prompt
  // guardrails (PR for OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING) instruct
  // the model to emit. Two requested keys, one true with a string
  // evidenceSpan, one false with null evidenceSpan, identical key sets
  // across observations / confidence / evidenceSpan / checkedRawKeys.
  const r = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-e-shape-tuning-positive',
    checkedRawKeys: ['abductive_explanation_present', 'slippery_slope_reasoning_present'],
    observations: {
      abductive_explanation_present: false,
      slippery_slope_reasoning_present: true,
    },
    confidence: {
      abductive_explanation_present: 'medium' as const,
      slippery_slope_reasoning_present: 'high' as const,
    },
    evidenceSpan: {
      // false observation → null evidenceSpan (per prompt's new convention)
      abductive_explanation_present: null,
      // true observation → short anchoring quote within 240 chars
      slippery_slope_reasoning_present: 'leads to banning Y, then Z, then mainstream',
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-e-v1',
    },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.checkedRawKeys.length, 2);
    assertEquals(Object.keys(result.value.observations).length, 2);
    assertEquals(Object.keys(result.value.confidence).length, 2);
    assertEquals(Object.keys(result.value.evidenceSpan).length, 2);
    assertEquals(result.value.evidenceSpan.abductive_explanation_present, null);
  }
});
