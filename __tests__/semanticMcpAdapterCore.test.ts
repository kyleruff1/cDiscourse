/**
 * MCP-018 — semantic-referee MCP-adapter core unit tests.
 *
 * Covers the zod-free, Jest-importable core (`mcpAdapterCore.ts`), loaded via
 * the `_helpers/semanticRefereeDeno.ts` bridge. These are the pure functions
 * the operator-hosted adapter (`mcpAdapter.ts`) composes — they touch no
 * `fetch`, no `Deno`, no `npm:zod`, so Jest runs them directly (MCP-018 design
 * §8 "Test reality").
 *
 * Every public function gets a happy-path + failure-case test — the pure-TS
 * model bar (test-discipline). No test makes a live MCP-server call.
 */
import {
  MCP_CLASSIFY_TOOL_NAME,
  MCP_REQUEST_TIMEOUT_MS,
  DEFAULT_MCP_MODEL_VERSION,
  ALL_MCP_UNAVAILABLE_REASONS,
  buildMcpToolRequestBody,
  extractMcpPacket,
  mcpParseJsonFromContent,
  sanitizeMcpRawPayload,
  parseJsonFromContent,
} from './_helpers/semanticRefereeDeno';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

function makeRequest(overrides: Partial<ClassifyMoveRequest> = {}): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A move body that narrows the parent claim.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent', 'narrows_claim'],
    contentHash: 'hash-1',
    ...overrides,
  };
}

// ── constants ─────────────────────────────────────────────────────

describe('mcpAdapterCore — constants', () => {
  it('MCP_CLASSIFY_TOOL_NAME is the documented classify_semantic_move tool name', () => {
    expect(MCP_CLASSIFY_TOOL_NAME).toBe('classify_semantic_move');
  });

  it('MCP_REQUEST_TIMEOUT_MS is a bounded positive integer', () => {
    expect(Number.isInteger(MCP_REQUEST_TIMEOUT_MS)).toBe(true);
    expect(MCP_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(MCP_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });

  it('DEFAULT_MCP_MODEL_VERSION is a non-empty string', () => {
    expect(typeof DEFAULT_MCP_MODEL_VERSION).toBe('string');
    expect(DEFAULT_MCP_MODEL_VERSION.length).toBeGreaterThan(0);
  });

  it('ALL_MCP_UNAVAILABLE_REASONS has exactly the seven documented values', () => {
    expect(new Set(ALL_MCP_UNAVAILABLE_REASONS)).toEqual(
      new Set([
        'url_missing',
        'token_missing',
        'api_error',
        'rate_limited',
        'network_error',
        'parse_failure',
        'validation_failed',
      ]),
    );
    expect(ALL_MCP_UNAVAILABLE_REASONS).toHaveLength(7);
  });
});

// ── buildMcpToolRequestBody ───────────────────────────────────────

describe('buildMcpToolRequestBody', () => {
  it('produces { tool: classify_semantic_move, input: {...} }', () => {
    const body = buildMcpToolRequestBody(makeRequest());
    expect(body.tool).toBe('classify_semantic_move');
    expect(typeof body.input).toBe('object');
    expect(body.input).not.toBeNull();
  });

  it('the input carries the redacted move body, requested classifiers, contentHash, roomId', () => {
    const body = buildMcpToolRequestBody(
      makeRequest({ moveBodyRedacted: 'UNIQUE_MOVE_MARKER_42' }),
    );
    const input = body.input as Record<string, unknown>;
    expect(input.moveBodyRedacted).toBe('UNIQUE_MOVE_MARKER_42');
    expect(input.requestedClassifiers).toEqual(['responds_to_parent', 'narrows_claim']);
    expect(input.contentHash).toBe('hash-1');
    expect(input.roomId).toBe('room-1');
  });

  it('includes the redacted parent body when present', () => {
    const body = buildMcpToolRequestBody(
      makeRequest({ parentBodyRedacted: 'UNIQUE_PARENT_MARKER_99' }),
    );
    const input = body.input as Record<string, unknown>;
    expect(input.parentBodyRedacted).toBe('UNIQUE_PARENT_MARKER_99');
  });

  it('omits parentBodyRedacted for a root move', () => {
    const body = buildMcpToolRequestBody(makeRequest({ parentBodyRedacted: undefined }));
    const input = body.input as Record<string, unknown>;
    expect(input).not.toHaveProperty('parentBodyRedacted');
  });

  it('includes moveId / parentId / promptVersionHint only when present', () => {
    const withIds = buildMcpToolRequestBody(
      makeRequest({ moveId: 'm1', parentId: 'p1', promptVersionHint: 'pv-1' }),
    ).input as Record<string, unknown>;
    expect(withIds.moveId).toBe('m1');
    expect(withIds.parentId).toBe('p1');
    expect(withIds.promptVersionHint).toBe('pv-1');

    const without = buildMcpToolRequestBody(makeRequest()).input as Record<string, unknown>;
    expect(without).not.toHaveProperty('moveId');
    expect(without).not.toHaveProperty('parentId');
    expect(without).not.toHaveProperty('promptVersionHint');
  });

  it('carries the room context fields when present and omits absent ones', () => {
    const body = buildMcpToolRequestBody(
      makeRequest({
        roomContext: {
          debateMode: 'formal',
          selectedAction: 'rebut',
          selectedMoveType: 'rebuttal',
          side: 'affirmative',
          actorRole: 'primary_opponent',
        },
      }),
    );
    const ctx = (body.input as Record<string, unknown>).roomContext as Record<string, unknown>;
    expect(ctx).toEqual({
      debateMode: 'formal',
      selectedAction: 'rebut',
      selectedMoveType: 'rebuttal',
      side: 'affirmative',
      actorRole: 'primary_opponent',
    });

    const emptyCtx = (
      buildMcpToolRequestBody(makeRequest()).input as Record<string, unknown>
    ).roomContext as Record<string, unknown>;
    expect(Object.keys(emptyCtx)).toHaveLength(0);
  });

  it('is deterministic — same request yields a byte-identical body across calls', () => {
    const request = makeRequest();
    const a = JSON.stringify(buildMcpToolRequestBody(request));
    const b = JSON.stringify(buildMcpToolRequestBody(request));
    expect(a).toBe(b);
  });

  it('carries no verdict / truth / winner / popularity / block field (doctrine)', () => {
    // The request bears user-derived content; serialize it whole and scan for
    // any verdict-asking key (MCP-018 design §3 rule 5 / §8 ban-list).
    const serialized = JSON.stringify(
      buildMcpToolRequestBody(
        makeRequest({
          moveBodyRedacted: 'clean structural body',
          parentBodyRedacted: 'clean parent body',
        }),
      ),
    ).toLowerCase();
    for (const banned of [
      '"verdict"',
      '"truth"',
      '"truthvalue"',
      '"winner"',
      '"loser"',
      '"popularity"',
      '"block"',
      '"blocked"',
      '"iscorrect"',
      '"isright"',
    ]) {
      expect(serialized).not.toContain(banned);
    }
  });
});

// ── extractMcpPacket ──────────────────────────────────────────────

describe('extractMcpPacket', () => {
  it('returns the inner object for a { result: {...} } envelope', () => {
    expect(extractMcpPacket({ result: { provider: 'mcp', a: 1 } })).toEqual({
      provider: 'mcp',
      a: 1,
    });
  });

  it('returns the inner object for an { output: {...} } envelope', () => {
    expect(extractMcpPacket({ output: { provider: 'mcp', b: 2 } })).toEqual({
      provider: 'mcp',
      b: 2,
    });
  });

  it('prefers result over output when both are present', () => {
    expect(extractMcpPacket({ result: { from: 'result' }, output: { from: 'output' } })).toEqual(
      { from: 'result' },
    );
  });

  it('returns the json payload from a content[] type:json block', () => {
    const envelope = {
      content: [
        { type: 'text', text: 'some prose' },
        { type: 'json', json: { provider: 'mcp', c: 3 } },
      ],
    };
    expect(extractMcpPacket(envelope)).toEqual({ provider: 'mcp', c: 3 });
  });

  it('parses JSON out of a content[] type:text block when no json block exists', () => {
    const envelope = {
      content: [{ type: 'text', text: 'result: {"provider":"mcp","d":4}' }],
    };
    expect(extractMcpPacket(envelope)).toEqual({ provider: 'mcp', d: 4 });
  });

  it('returns null for a non-object input', () => {
    expect(extractMcpPacket(null)).toBeNull();
    expect(extractMcpPacket('a string')).toBeNull();
    expect(extractMcpPacket(42)).toBeNull();
    expect(extractMcpPacket([1, 2, 3])).toBeNull();
  });

  it('returns null for an empty / unrecognised envelope', () => {
    expect(extractMcpPacket({})).toBeNull();
    expect(extractMcpPacket({ unexpected: 'shape' })).toBeNull();
  });

  it('returns null for a content[] with no usable block', () => {
    expect(extractMcpPacket({ content: [] })).toBeNull();
    expect(extractMcpPacket({ content: [{ type: 'image', url: 'x' }] })).toBeNull();
    expect(extractMcpPacket({ content: [{ type: 'text', text: 'no object here' }] })).toBeNull();
  });

  it('returns null when result / output are present but not plain objects', () => {
    expect(extractMcpPacket({ result: 'not-an-object' })).toBeNull();
    expect(extractMcpPacket({ output: [1, 2] })).toBeNull();
  });
});

// ── parseJsonFromContent (the mcpAdapterCore local copy) ──────────

describe('mcpAdapterCore parseJsonFromContent', () => {
  it('parses a bare JSON object', () => {
    expect(mcpParseJsonFromContent('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' });
  });

  it('parses a fenced JSON object', () => {
    expect(mcpParseJsonFromContent('```json\n{"value":1}\n```')).toEqual({ value: 1 });
  });

  it('parses a JSON object surrounded by prose', () => {
    expect(mcpParseJsonFromContent('Here it is: {"ok":true} done.')).toEqual({ ok: true });
  });

  it('returns null for non-JSON text — never throws', () => {
    expect(mcpParseJsonFromContent('just some prose, no object')).toBeNull();
  });

  it('returns null for a JSON array (must be an object)', () => {
    expect(mcpParseJsonFromContent('[1,2,3]')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(mcpParseJsonFromContent('')).toBeNull();
  });

  it('returns null for a non-string input', () => {
    expect(mcpParseJsonFromContent(null)).toBeNull();
    expect(mcpParseJsonFromContent(42)).toBeNull();
    expect(mcpParseJsonFromContent({})).toBeNull();
  });

  it('returns null for a malformed object body — never throws', () => {
    expect(mcpParseJsonFromContent('{ not valid json }')).toBeNull();
  });

  it('behaves identically to the anthropicClassifierCore sibling copy (parity)', () => {
    // MCP-018 OQ-4: the mcpAdapterCore copy is a documented local copy of the
    // sibling's identical helper. Feed both the same inputs; they must agree.
    const inputs: unknown[] = [
      '{"a":1}',
      '```json\n{"x":true}\n```',
      'prose {"k":"v"} more',
      'no object here',
      '[1,2,3]',
      '',
      null,
      42,
      {},
      '{ broken }',
    ];
    for (const input of inputs) {
      expect(mcpParseJsonFromContent(input)).toEqual(parseJsonFromContent(input));
    }
  });
});

// ── sanitizeMcpRawPayload ─────────────────────────────────────────

describe('sanitizeMcpRawPayload', () => {
  it('retains only the allow-listed envelope keys (tool / status / stop_reason / usage)', () => {
    const raw = {
      tool: 'classify_semantic_move',
      status: 'ok',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
      result: { provider: 'mcp', secret: 'inner-packet-body' },
      headers: { Authorization: 'Bearer should-never-appear' },
    };
    const sanitized = sanitizeMcpRawPayload(raw);
    expect(Object.keys(sanitized).sort()).toEqual(['status', 'stop_reason', 'tool', 'usage']);
    expect(sanitized.tool).toBe('classify_semantic_move');
    expect(sanitized.status).toBe('ok');
    expect(sanitized.stop_reason).toBe('end_turn');
    expect(sanitized.usage).toEqual({ input_tokens: 100, output_tokens: 50 });
  });

  it('drops the inner packet, free-text fields, and any Authorization-shaped value', () => {
    const raw = {
      result: { reasonCode: 'free text', body: 'sensitive' },
      content: ['raw body'],
      Authorization: 'Bearer leaked-token-value',
    };
    const sanitized = sanitizeMcpRawPayload(raw);
    expect(sanitized).not.toHaveProperty('result');
    expect(sanitized).not.toHaveProperty('content');
    expect(sanitized).not.toHaveProperty('Authorization');
    // The serialized sanitized payload carries no Bearer literal.
    expect(JSON.stringify(sanitized)).not.toContain('Bearer');
  });

  it('returns all-undefined for a non-object input — never throws', () => {
    const allUndefined = {
      tool: undefined,
      status: undefined,
      stop_reason: undefined,
      usage: undefined,
    };
    expect(sanitizeMcpRawPayload(null)).toEqual(allUndefined);
    expect(sanitizeMcpRawPayload('a string')).toEqual(allUndefined);
    expect(sanitizeMcpRawPayload([1, 2])).toEqual(allUndefined);
  });
});
