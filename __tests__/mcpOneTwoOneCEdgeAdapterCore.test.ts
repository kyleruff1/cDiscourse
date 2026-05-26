/**
 * MCP-021C-EDGE — Test: Boolean Observation MCP adapter core (pure helpers).
 *
 * Pure-TS tests of `booleanObservationMcpAdapterCore.ts` — every helper
 * that does NOT touch `Deno.env.get` or `fetch`. Loaded via the Jest
 * bridge.
 *
 * Doctrine:
 *   - Constants are stable per release (tool name, timeout, default
 *     server name).
 *   - `buildBooleanObservationToolRequestBody` is deterministic.
 *   - `extractBooleanObservationResponse` accepts the three documented
 *     envelope shapes and rejects everything else.
 *   - `sanitizeBooleanObservationRawPayload` allow-lists only safe keys.
 */

import {
  EDGE_MCP_BOOLEAN_OBSERVATION_TOOL_NAME,
  EDGE_MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS,
  EDGE_DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME,
  EDGE_DEFAULT_MCP_BOOLEAN_OBSERVATION_CLASSIFIER_SET_VERSION,
  EDGE_ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS,
  edgeBuildBooleanObservationToolRequestBody,
  edgeExtractBooleanObservationResponse,
  edgeSanitizeBooleanObservationRawPayload,
  EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
} from './_helpers/booleanObservationEdgeDeno';
import type { McpBooleanObservationRequest } from '../src/features/nodeLabels/mcpBooleanObservationSchema';

const SAMPLE_REQUEST: McpBooleanObservationRequest = {
  schemaVersion: EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION as McpBooleanObservationRequest['schemaVersion'],
  nodeId: 'arg-1',
  parentNodeId: 'arg-0',
  currentText: 'my reply',
  parentText: 'the parent',
  threadContextExcerpt: 'ancestors',
  requestedFamilies: ['parent_relation'],
  requestedRawKeys: ['has_rebuttal', 'supports_parent'],
  definitions: {},
  timeoutMs: 12_000,
};

describe('MCP-021C-EDGE — adapter core constants', () => {
  it('AC-1 — MCP_BOOLEAN_OBSERVATION_TOOL_NAME is classify_argument_boolean_observations', () => {
    expect(EDGE_MCP_BOOLEAN_OBSERVATION_TOOL_NAME).toBe('classify_argument_boolean_observations');
  });

  it('AC-2 — MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS is 15_000', () => {
    expect(EDGE_MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  it('AC-3 — DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME is operator-mcp-server', () => {
    expect(EDGE_DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME).toBe('operator-mcp-server');
  });

  it('AC-4 — DEFAULT_MCP_BOOLEAN_OBSERVATION_CLASSIFIER_SET_VERSION is mcp-021.classifier-set.v1', () => {
    expect(EDGE_DEFAULT_MCP_BOOLEAN_OBSERVATION_CLASSIFIER_SET_VERSION).toBe('mcp-021.classifier-set.v1');
  });

  it('AC-5 — ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS contains exactly 7 values', () => {
    expect(EDGE_ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS).toEqual([
      'url_missing',
      'token_missing',
      'api_error',
      'rate_limited',
      'network_error',
      'parse_failure',
      'validation_failed',
    ]);
  });
});

describe('MCP-021C-EDGE — buildBooleanObservationToolRequestBody', () => {
  it('AC-6 — body has tool field === MCP_BOOLEAN_OBSERVATION_TOOL_NAME', () => {
    const body = edgeBuildBooleanObservationToolRequestBody(SAMPLE_REQUEST);
    expect(body.tool).toBe('classify_argument_boolean_observations');
  });

  it('AC-7 — body has input field carrying the request shape', () => {
    const body = edgeBuildBooleanObservationToolRequestBody(SAMPLE_REQUEST);
    expect(body.input).toBeDefined();
    const input = body.input as Record<string, unknown>;
    expect(input.schemaVersion).toBe(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    expect(input.nodeId).toBe('arg-1');
    expect(input.parentNodeId).toBe('arg-0');
    expect(input.currentText).toBe('my reply');
    expect(input.parentText).toBe('the parent');
    expect(input.threadContextExcerpt).toBe('ancestors');
  });

  it('AC-8 — body is deterministic for the same request', () => {
    const a = edgeBuildBooleanObservationToolRequestBody(SAMPLE_REQUEST);
    const b = edgeBuildBooleanObservationToolRequestBody(SAMPLE_REQUEST);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('AC-9 — body has only two top-level keys: tool + input', () => {
    const body = edgeBuildBooleanObservationToolRequestBody(SAMPLE_REQUEST);
    expect(Object.keys(body).sort()).toEqual(['input', 'tool']);
  });

  it('AC-10 — body NEVER carries credentials / authorization', () => {
    const body = edgeBuildBooleanObservationToolRequestBody(SAMPLE_REQUEST);
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toContain('authorization');
    expect(serialized).not.toContain('bearer');
    expect(serialized).not.toContain('semantic_referee_mcp_token');
  });
});

describe('MCP-021C-EDGE — extractBooleanObservationResponse', () => {
  it('AC-11 — extracts { result: {...} } shape', () => {
    const envelope = { result: { schemaVersion: 'x', nodeId: 'y' } };
    expect(edgeExtractBooleanObservationResponse(envelope)).toEqual({
      schemaVersion: 'x',
      nodeId: 'y',
    });
  });

  it('AC-12 — extracts { output: {...} } shape', () => {
    const envelope = { output: { schemaVersion: 'x', nodeId: 'y' } };
    expect(edgeExtractBooleanObservationResponse(envelope)).toEqual({
      schemaVersion: 'x',
      nodeId: 'y',
    });
  });

  it('AC-13 — extracts { content: [...] } shape with json block', () => {
    const envelope = {
      content: [{ type: 'json', json: { schemaVersion: 'x' } }],
    };
    expect(edgeExtractBooleanObservationResponse(envelope)).toEqual({ schemaVersion: 'x' });
  });

  it('AC-14 — extracts { content: [...] } shape with text block carrying JSON', () => {
    const envelope = {
      content: [{ type: 'text', text: '{"schemaVersion": "x"}' }],
    };
    expect(edgeExtractBooleanObservationResponse(envelope)).toEqual({ schemaVersion: 'x' });
  });

  it('AC-15 — returns null for unrecognised envelope', () => {
    expect(edgeExtractBooleanObservationResponse({ foo: 'bar' })).toBeNull();
  });

  it('AC-16 — returns null for non-object', () => {
    expect(edgeExtractBooleanObservationResponse(null)).toBeNull();
    expect(edgeExtractBooleanObservationResponse(undefined)).toBeNull();
    expect(edgeExtractBooleanObservationResponse(42)).toBeNull();
    expect(edgeExtractBooleanObservationResponse('string')).toBeNull();
    expect(edgeExtractBooleanObservationResponse([])).toBeNull();
  });

  it('AC-17 — returns null for content[] with no usable block', () => {
    const envelope = {
      content: [{ type: 'image', image: 'irrelevant' }],
    };
    expect(edgeExtractBooleanObservationResponse(envelope)).toBeNull();
  });

  it('AC-18 — prefers json block over text block when both present', () => {
    const envelope = {
      content: [
        { type: 'text', text: '{"from": "text"}' },
        { type: 'json', json: { from: 'json' } },
      ],
    };
    expect(edgeExtractBooleanObservationResponse(envelope)).toEqual({ from: 'json' });
  });
});

describe('MCP-021C-EDGE — sanitizeBooleanObservationRawPayload', () => {
  it('AC-19 — keeps tool/status/stop_reason/usage only', () => {
    const raw = {
      tool: 'classify_argument_boolean_observations',
      status: 'ok',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100 },
      result: { secret: 'should-not-appear' },
      authorization: 'should-not-appear',
    };
    const sanitized = edgeSanitizeBooleanObservationRawPayload(raw);
    expect(sanitized).toEqual({
      tool: 'classify_argument_boolean_observations',
      status: 'ok',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100 },
    });
  });

  it('AC-20 — returns undefined values for missing keys', () => {
    const sanitized = edgeSanitizeBooleanObservationRawPayload({});
    expect(sanitized).toEqual({
      tool: undefined,
      status: undefined,
      stop_reason: undefined,
      usage: undefined,
    });
  });

  it('AC-21 — returns undefined values for non-object inputs', () => {
    const sanitized = edgeSanitizeBooleanObservationRawPayload(null);
    expect(sanitized).toEqual({
      tool: undefined,
      status: undefined,
      stop_reason: undefined,
      usage: undefined,
    });
  });

  it('AC-22 — NEVER returns raw response body or credentials', () => {
    const sanitized = edgeSanitizeBooleanObservationRawPayload({
      tool: 'classify_argument_boolean_observations',
      result: 'whole response',
      content: [{ type: 'json', json: { secret: 'x' } }],
      authorization: 'Bearer xxx',
    });
    const serialized = JSON.stringify(sanitized).toLowerCase();
    expect(serialized).not.toContain('whole response');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('bearer');
    expect(serialized).not.toContain('authorization');
  });
});
