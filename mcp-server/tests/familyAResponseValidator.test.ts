/**
 * MCP-SERVER-002 — validateMcpBooleanObservationResponse unit tests.
 *
 * Covers every failure mode listed in the design §3.4.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  MAX_EVIDENCE_SPAN_CHARS,
  MAX_FLAGS_PER_RESPONSE,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validResponse(): Record<string, unknown> {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-1',
    checkedRawKeys: ['supports_parent', 'challenges_parent'],
    observations: {
      supports_parent: true,
      challenges_parent: false,
    },
    confidence: {
      supports_parent: 'high',
      challenges_parent: 'medium',
    },
    evidenceSpan: {
      supports_parent: 'sample evidence span',
      challenges_parent: null,
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-a-v1',
    },
  };
}

Deno.test('validator: happy path returns ok=true with parsed value', () => {
  const result = validateMcpBooleanObservationResponse(validResponse());
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.nodeId, 'node-1');
    assertEquals(result.value.modelInfo.provider, 'mcp');
    assertEquals(result.value.modelInfo.classifierSetVersion, 'family-a-v1');
  }
});

Deno.test('validator: rejects non-object root', () => {
  const result = validateMcpBooleanObservationResponse('not an object');
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, '$');
  }
});

Deno.test('validator: rejects wrong schemaVersion', () => {
  const r = validResponse();
  r.schemaVersion = 'mcp-021.bogus.v99';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'schemaVersion');
  }
});

Deno.test('validator: rejects missing required field', () => {
  const r = validResponse();
  delete (r as Record<string, unknown>).observations;
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'observations');
  }
});

Deno.test('validator: rejects missing nodeId', () => {
  const r = validResponse();
  delete (r as Record<string, unknown>).nodeId;
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('validator: rejects empty nodeId', () => {
  const r = validResponse();
  r.nodeId = '';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'nodeId');
  }
});

Deno.test('validator: rejects non-array checkedRawKeys', () => {
  const r = validResponse();
  r.checkedRawKeys = 'not-an-array';
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'checkedRawKeys');
  }
});

Deno.test('validator: rejects non-string checkedRawKeys entry', () => {
  const r = validResponse();
  r.checkedRawKeys = ['supports_parent', 42];
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('validator: rejects non-boolean observation value', () => {
  const r = validResponse();
  r.observations = { supports_parent: 'yes', challenges_parent: false };
  r.confidence = { supports_parent: 'high', challenges_parent: 'medium' };
  r.evidenceSpan = { supports_parent: null, challenges_parent: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.path.startsWith('observations.')) {
      throw new Error(`Expected observations.<key> path; got ${result.path}`);
    }
  }
});

Deno.test('validator: rejects flag count above MAX_FLAGS_PER_RESPONSE', () => {
  const r = validResponse();
  const obs: Record<string, boolean> = {};
  const conf: Record<string, string> = {};
  const evid: Record<string, string | null> = {};
  for (let i = 0; i < MAX_FLAGS_PER_RESPONSE + 1; i += 1) {
    obs[`raw_key_${i}`] = true;
    conf[`raw_key_${i}`] = 'high';
    evid[`raw_key_${i}`] = null;
  }
  r.observations = obs;
  r.confidence = conf;
  r.evidenceSpan = evid;
  r.checkedRawKeys = Object.keys(obs);
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'observations');
  }
});

Deno.test('validator: rejects confidence value outside low|medium|high', () => {
  const r = validResponse();
  r.confidence = { supports_parent: 'very_high', challenges_parent: 'medium' };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('validator: rejects evidenceSpan value that is neither string nor null', () => {
  const r = validResponse();
  r.evidenceSpan = { supports_parent: 42, challenges_parent: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('validator: rejects evidenceSpan string longer than MAX_EVIDENCE_SPAN_CHARS', () => {
  const r = validResponse();
  const tooLong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 5);
  r.evidenceSpan = { supports_parent: tooLong, challenges_parent: null };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('validator: rejects observation key not in confidence', () => {
  const r = validResponse();
  r.confidence = { supports_parent: 'high' }; // missing challenges_parent
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.path.startsWith('confidence.')) {
      throw new Error(`Expected confidence.<key> path; got ${result.path}`);
    }
  }
});

Deno.test('validator: rejects confidence key not in observations', () => {
  const r = validResponse();
  r.confidence = {
    supports_parent: 'high',
    challenges_parent: 'medium',
    rogue_extra_key: 'low',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('validator: rejects evidenceSpan key not in observations', () => {
  const r = validResponse();
  r.evidenceSpan = {
    supports_parent: null,
    challenges_parent: null,
    rogue_extra_key: 'something',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('validator: rejects observation key missing from checkedRawKeys', () => {
  const r = validResponse();
  r.checkedRawKeys = ['supports_parent']; // missing challenges_parent
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'checkedRawKeys');
  }
});

Deno.test('validator: rejects modelInfo without provider=mcp', () => {
  const r = validResponse();
  r.modelInfo = {
    provider: 'anthropic',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: 'family-a-v1',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.provider');
  }
});

Deno.test('validator: rejects modelInfo with empty serverName', () => {
  const r = validResponse();
  r.modelInfo = {
    provider: 'mcp',
    serverName: '',
    classifierSetVersion: 'family-a-v1',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});

Deno.test('validator: rejects modelInfo with empty classifierSetVersion', () => {
  const r = validResponse();
  r.modelInfo = {
    provider: 'mcp',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: '',
  };
  const result = validateMcpBooleanObservationResponse(r);
  assertEquals(result.ok, false);
});
