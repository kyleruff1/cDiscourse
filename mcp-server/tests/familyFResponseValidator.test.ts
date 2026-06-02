/**
 * MCP-SERVER-007-FAMILY-F — validateMcpBooleanObservationResponse Family F tests.
 *
 * The validator is the shared structural validator. This file exercises it
 * against Family F response shapes (14 keys, family-f-v1) and codifies the
 * drill-derived rejection paths surfaced by PR #422 (R3 classification):
 * evidenceSpan.alternative_explanation_available wrong-typed value and
 * checkedRawKeys arity/membership drift. These tests would flip red if the
 * validator's existing behavior is relaxed.
 *
 * Companion to mcp-server/tests/familyEResponseValidator.test.ts.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validFamilyFResponse(): Record<string, unknown> {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-f-1',
    checkedRawKeys: ['missing_warrant', 'consequence_probability_unclear'],
    observations: {
      missing_warrant: true,
      consequence_probability_unclear: false,
    },
    confidence: {
      missing_warrant: 'high',
      consequence_probability_unclear: 'medium',
    },
    evidenceSpan: {
      missing_warrant: 'because regulation will lead to harm',
      consequence_probability_unclear: null,
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-f-v1',
    },
  };
}

// ── Baseline shape regressions ────────────────────────────────────────

Deno.test('Family F validator: happy path returns ok=true with parsed value', () => {
  const result = validateMcpBooleanObservationResponse(validFamilyFResponse());
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.nodeId, 'node-f-1');
    assertEquals(result.value.modelInfo.provider, 'mcp');
    assertEquals(result.value.modelInfo.classifierSetVersion, 'family-f-v1');
  }
});

Deno.test('Family F validator: rejects evidenceSpan value that is neither string nor null', () => {
  const r = validFamilyFResponse();
  r.evidenceSpan = { missing_warrant: 42, consequence_probability_unclear: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('Family F validator: observation key MUST appear in checkedRawKeys', () => {
  const r = validFamilyFResponse();
  r.checkedRawKeys = ['missing_warrant']; // missing consequence_probability_unclear
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'checkedRawKeys');
  }
});

// ── OPS-MCP-FAMILIES-E-F-RESPONSE-SHAPE-TUNING — drill-derived regressions ──
//
// PR #422 R3 classification surfaced two validator failure paths on the
// Family F (critical_question) family:
// (a) evidenceSpan.alternative_explanation_available with a non-string
//     non-null value (object/array — drill path count 2 of 2).
// (b) observations carrying a key the model did not include in
//     checkedRawKeys (same mechanism as E's drill failure).
// These tests name the specific failure shape so a future regression flips
// them red.

Deno.test('Family F validator: drill regression — rejects evidenceSpan.alternative_explanation_available when value is a plain object', () => {
  const r = validFamilyFResponse();
  r.checkedRawKeys = ['alternative_explanation_available'];
  r.observations = { alternative_explanation_available: true };
  r.confidence = { alternative_explanation_available: 'medium' };
  // Drill-observed shape drift: model returned a structured object
  // instead of a string-or-null at this exact path. Validator must
  // reject with path 'evidenceSpan.alternative_explanation_available'.
  r.evidenceSpan = {
    alternative_explanation_available: {
      quote: 'platform suppression also explained by parallel regulation',
      band: 'high',
    },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.alternative_explanation_available');
  }
});

Deno.test('Family F validator: drill regression — rejects evidenceSpan.alternative_explanation_available when value is an array', () => {
  const r = validFamilyFResponse();
  r.checkedRawKeys = ['alternative_explanation_available'];
  r.observations = { alternative_explanation_available: true };
  r.confidence = { alternative_explanation_available: 'medium' };
  // Drill-observed shape drift variant: array instead of string-or-null.
  r.evidenceSpan = {
    alternative_explanation_available: ['parallel regulation', 'industry self-policing'],
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.alternative_explanation_available');
  }
});

Deno.test('Family F validator: drill regression — rejects checkedRawKeys when observations contains an extra key the model failed to include', () => {
  const r = validFamilyFResponse();
  // Same mechanism as the E drill: model emitted observations for a key
  // it did not list in checkedRawKeys. Validator must reject with path
  // 'checkedRawKeys'.
  r.checkedRawKeys = ['missing_warrant'];
  r.observations = {
    missing_warrant: true,
    alternative_explanation_available: false,
  };
  r.confidence = {
    missing_warrant: 'high',
    alternative_explanation_available: 'medium',
  };
  r.evidenceSpan = {
    missing_warrant: 'because regulation will lead to harm',
    alternative_explanation_available: null,
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'checkedRawKeys');
  }
});

Deno.test('Family F validator: acceptance — packet with strict key-set equality across all four maps and null evidenceSpan for false observations', () => {
  // Codifies the shape the new STRICT RESPONSE-SHAPE CONTRACT prompt
  // guardrails (this card) instruct the model to emit on Family F.
  const r = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-f-shape-tuning-positive',
    checkedRawKeys: ['alternative_explanation_available', 'missing_warrant'],
    observations: {
      alternative_explanation_available: false,
      missing_warrant: true,
    },
    confidence: {
      alternative_explanation_available: 'medium' as const,
      missing_warrant: 'high' as const,
    },
    evidenceSpan: {
      // false observation → null evidenceSpan (per prompt's new convention)
      alternative_explanation_available: null,
      // true observation → short anchoring quote within 240 chars
      missing_warrant: 'because regulation will lead to harm',
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-f-v1',
    },
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.checkedRawKeys.length, 2);
    assertEquals(Object.keys(result.value.observations).length, 2);
    assertEquals(Object.keys(result.value.confidence).length, 2);
    assertEquals(Object.keys(result.value.evidenceSpan).length, 2);
    assertEquals(result.value.evidenceSpan.alternative_explanation_available, null);
  }
});
