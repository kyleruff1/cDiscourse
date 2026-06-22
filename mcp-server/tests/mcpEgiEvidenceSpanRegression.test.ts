/**
 * MCP-EGI-002 — Cross-family validator regression for the four rawKeys whose
 * `evidenceSpan.<rawKey>` validation failed in production on 2026-06-21 with
 * Anthropic HTTP 200 and adapter-compat HTTP 200 (the residual masked by the
 * Edge as `provider_server_error`).
 *
 * The validator at `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` is
 * UNCHANGED by MCP-EGI-002. These regression tests guard the existing
 * structural contract for the specific paths the prompt-hardening rule-6
 * blocks are designed to keep clean:
 *
 *   - `evidenceSpan.compares_options`               (Family I / thread_topology)
 *   - `evidenceSpan.convergent_premise_structure`   (Family E / argument_scheme)
 *   - `evidenceSpan.tradeoff_reasoning_present`     (Family E / argument_scheme)
 *   - `evidenceSpan.synthesis_proposed`             (Family G / resolution_progress)
 *
 * Discipline note: the live rejected value SHAPE was not surfaced (the validator
 * detail string is structurally suppressed by the Phase-1 leak-safety posture
 * in `booleanObservationMcpAdapter.ts:261-274` and
 * `classifierRunRowFailureDetail.ts:43-51`). These tests therefore enumerate
 * all four candidate branches that the validator can take at path
 * `evidenceSpan.<rawKey>` without asserting which one occurred live:
 *
 *   1. value type — object / array / boolean / number → "value must be string or null"
 *   2. length cap — string of length 241 → "length 241 exceeds max 240"
 *   3. asymmetry — key in observations, missing from evidenceSpan
 *   4. asymmetry — key in evidenceSpan, missing from observations
 *
 * Accepts: short string / null / exactly 240-char string.
 *
 * No raw evidenceSpan values are surfaced in error messages — only validator
 * paths.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

interface FamilyKeyCase {
  readonly label: string;
  readonly classifierSetVersion: string;
  readonly rawKey: string;
}

const EGI_KEYS: readonly FamilyKeyCase[] = [
  {
    label: 'Family I / thread_topology',
    classifierSetVersion: 'family-i-v1',
    rawKey: 'compares_options',
  },
  {
    label: 'Family E / argument_scheme',
    classifierSetVersion: 'family-e-v1',
    rawKey: 'convergent_premise_structure',
  },
  {
    label: 'Family E / argument_scheme',
    classifierSetVersion: 'family-e-v1',
    rawKey: 'tradeoff_reasoning_present',
  },
  {
    label: 'Family G / resolution_progress',
    classifierSetVersion: 'family-g-v1',
    rawKey: 'synthesis_proposed',
  },
];

function basePacket(testCase: FamilyKeyCase): Record<string, unknown> {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-regression-node-1',
    checkedRawKeys: [testCase.rawKey],
    observations: { [testCase.rawKey]: true },
    confidence: { [testCase.rawKey]: 'medium' },
    evidenceSpan: { [testCase.rawKey]: 'short anchor' },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: testCase.classifierSetVersion,
    },
  };
}

function falsePacket(testCase: FamilyKeyCase): Record<string, unknown> {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-regression-node-1',
    checkedRawKeys: [testCase.rawKey],
    observations: { [testCase.rawKey]: false },
    confidence: { [testCase.rawKey]: 'low' },
    evidenceSpan: { [testCase.rawKey]: null },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: testCase.classifierSetVersion,
    },
  };
}

for (const testCase of EGI_KEYS) {
  Deno.test(`MCP-EGI-002 — ${testCase.label} — ${testCase.rawKey} short string accepted`, () => {
    const result = validateMcpBooleanObservationResponse(basePacket(testCase));
    assertEquals(result.ok, true);
  });

  Deno.test(`MCP-EGI-002 — ${testCase.label} — ${testCase.rawKey} null accepted on false observation`, () => {
    const result = validateMcpBooleanObservationResponse(falsePacket(testCase));
    assertEquals(result.ok, true);
  });

  // MCP-EGI-005 — the deterministic-null-fallback contract introduced for the four
  // compound structural rawKeys requires the validator to accept a TRUE observation
  // paired with a null evidenceSpan. This is already permitted by the validator's
  // string|null rule (no rule conditions evidenceSpan on the observation boolean);
  // this test pins the behavior so the prompt-side null fallback is safe to instruct.
  Deno.test(`MCP-EGI-005 — ${testCase.label} — ${testCase.rawKey} null accepted on TRUE observation`, () => {
    const packet = basePacket(testCase);
    (packet.observations as Record<string, unknown>)[testCase.rawKey] = true;
    (packet.evidenceSpan as Record<string, unknown>)[testCase.rawKey] = null;
    const result = validateMcpBooleanObservationResponse(packet);
    assertEquals(result.ok, true);
  });

  Deno.test(`MCP-EGI-002 — ${testCase.label} — ${testCase.rawKey} exactly 240-char string accepted`, () => {
    const packet = basePacket(testCase);
    (packet.evidenceSpan as Record<string, unknown>)[testCase.rawKey] = 'a'.repeat(
      MAX_EVIDENCE_SPAN_CHARS,
    );
    const result = validateMcpBooleanObservationResponse(packet);
    assertEquals(result.ok, true);
  });

  Deno.test(`MCP-EGI-002 — ${testCase.label} — ${testCase.rawKey} 241-char string rejected (length branch)`, () => {
    const packet = basePacket(testCase);
    (packet.evidenceSpan as Record<string, unknown>)[testCase.rawKey] = 'a'.repeat(
      MAX_EVIDENCE_SPAN_CHARS + 1,
    );
    const result = validateMcpBooleanObservationResponse(packet);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.path, `evidenceSpan.${testCase.rawKey}`);
    }
  });

  Deno.test(`MCP-EGI-002 — ${testCase.label} — ${testCase.rawKey} nested JSON object rejected (value-type branch)`, () => {
    const packet = basePacket(testCase);
    (packet.evidenceSpan as Record<string, unknown>)[testCase.rawKey] = {
      quote: 'x',
      band: 'high',
    };
    const result = validateMcpBooleanObservationResponse(packet);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.path, `evidenceSpan.${testCase.rawKey}`);
    }
  });

  Deno.test(`MCP-EGI-002 — ${testCase.label} — ${testCase.rawKey} JSON array rejected (value-type branch)`, () => {
    const packet = basePacket(testCase);
    (packet.evidenceSpan as Record<string, unknown>)[testCase.rawKey] = ['x', 'y'];
    const result = validateMcpBooleanObservationResponse(packet);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.path, `evidenceSpan.${testCase.rawKey}`);
    }
  });

  Deno.test(`MCP-EGI-002 — ${testCase.label} — ${testCase.rawKey} boolean rejected (value-type branch)`, () => {
    const packet = basePacket(testCase);
    (packet.evidenceSpan as Record<string, unknown>)[testCase.rawKey] = true;
    const result = validateMcpBooleanObservationResponse(packet);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.path, `evidenceSpan.${testCase.rawKey}`);
    }
  });

  Deno.test(`MCP-EGI-002 — ${testCase.label} — ${testCase.rawKey} number rejected (value-type branch)`, () => {
    const packet = basePacket(testCase);
    (packet.evidenceSpan as Record<string, unknown>)[testCase.rawKey] = 1;
    const result = validateMcpBooleanObservationResponse(packet);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.path, `evidenceSpan.${testCase.rawKey}`);
    }
  });

  Deno.test(`MCP-EGI-002 — ${testCase.label} — ${testCase.rawKey} missing entry rejected (asymmetry: obs has key, evidenceSpan missing)`, () => {
    const packet = basePacket(testCase);
    // observations has the key; remove it from evidenceSpan.
    const spans = { ...(packet.evidenceSpan as Record<string, unknown>) };
    delete spans[testCase.rawKey];
    packet.evidenceSpan = spans;
    const result = validateMcpBooleanObservationResponse(packet);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.path, `evidenceSpan.${testCase.rawKey}`);
    }
  });

  Deno.test(`MCP-EGI-002 — ${testCase.label} — ${testCase.rawKey} extra entry rejected (asymmetry: evidenceSpan has key, observations missing)`, () => {
    const packet = basePacket(testCase);
    const extraKey = `${testCase.rawKey}_extra_typo`;
    packet.evidenceSpan = {
      ...(packet.evidenceSpan as Record<string, unknown>),
      [extraKey]: null,
    };
    const result = validateMcpBooleanObservationResponse(packet);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.path, `evidenceSpan.${extraKey}`);
    }
  });
}

Deno.test('MCP-EGI-002 — validator preservation: max evidence-span cap is unchanged at 240', () => {
  // Belt-and-suspenders: the MAX_EVIDENCE_SPAN_CHARS constant MUST stay at
  // 240. MCP-EGI-002 hardens prompts to conform to the cap, not to raise it.
  assertEquals(MAX_EVIDENCE_SPAN_CHARS, 240);
});
