/**
 * MCP-021C-EDGE — Test: server-side parser mirror parity.
 *
 * Per design §4.3 (BINDING per Outcome 3): loads BOTH parser copies
 *   - production: src/features/nodeLabels/mcpBooleanObservationSchema.ts
 *   - server-side mirror: supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts
 *     (via the Jest bridge __tests__/_helpers/booleanObservationEdgeDeno.ts)
 * and feeds both implementations the SAME ~30 fixture inputs. Each
 * fixture compares the two outputs for deep equality. If they diverge,
 * Trigger 8 fires.
 *
 * Doctrine: this is the BINDING parity test for the parser-import
 * outcome. Future edits to either parser MUST update both copies; this
 * test catches silent drift.
 */

import {
  parseMcpBooleanObservationResponse as parseProd,
  sanitizeMcpBooleanObservationResponse as sanitizeProd,
  buildMcpBooleanObservationRequest as buildProd,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION as SCHEMA_VERSION_PROD,
} from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import {
  edgeParseMcpBooleanObservationResponse as parseEdge,
  edgeSanitizeMcpBooleanObservationResponse as sanitizeEdge,
  edgeBuildMcpBooleanObservationRequest as buildEdge,
  EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION as SCHEMA_VERSION_EDGE,
} from './_helpers/booleanObservationEdgeDeno';
import { MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY } from '../src/features/nodeLabels/machineObservationDefinitions';

const VALID_VERSION = SCHEMA_VERSION_PROD;

function makeValidResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: VALID_VERSION,
    nodeId: 'arg-1',
    checkedRawKeys: ['has_rebuttal', 'supports_parent'],
    observations: { has_rebuttal: true, supports_parent: false },
    confidence: { has_rebuttal: 'high', supports_parent: 'medium' },
    evidenceSpan: { has_rebuttal: null, supports_parent: null },
    modelInfo: {
      provider: 'mcp',
      serverName: 'operator-mcp-server',
      classifierSetVersion: 'mcp-021.classifier-set.v1',
    },
    ...overrides,
  };
}

describe('MCP-021C-EDGE — schema version constant parity', () => {
  it('PARITY-VERSION-1 — schema version constant is identical', () => {
    expect(SCHEMA_VERSION_EDGE).toBe(SCHEMA_VERSION_PROD);
  });
});

describe('MCP-021C-EDGE — parser parity: happy path', () => {
  it('PARITY-PARSE-1 — both parsers accept a valid response', () => {
    const fixture = makeValidResponse();
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-PARSE-2 — both parsers preserve nodeId verbatim', () => {
    const fixture = makeValidResponse({ nodeId: 'unique-arg-uuid' });
    const prod = parseProd(fixture);
    const edge = parseEdge(fixture);
    expect(prod).toEqual(edge);
    if (!prod.ok || !edge.ok) throw new Error('expected ok results');
    expect(prod.response.nodeId).toBe('unique-arg-uuid');
    expect(edge.response.nodeId).toBe('unique-arg-uuid');
  });

  it('PARITY-PARSE-3 — both parsers preserve modelInfo verbatim', () => {
    const fixture = makeValidResponse({
      modelInfo: {
        provider: 'mcp',
        serverName: 'alt-server',
        classifierSetVersion: 'v2',
      },
    });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-PARSE-4 — both parsers accept observations with all FALSE values', () => {
    const fixture = makeValidResponse({
      observations: { has_rebuttal: false, supports_parent: false },
    });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-PARSE-5 — both parsers accept observations with all TRUE values', () => {
    const fixture = makeValidResponse({
      observations: { has_rebuttal: true, supports_parent: true },
    });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-PARSE-6 — both parsers accept observations of length 20 (max)', () => {
    const keys = Array.from({ length: 20 }, (_, i) => `key_${i}`);
    const observations: Record<string, boolean> = {};
    const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
    const evidenceSpan: Record<string, string | null> = {};
    for (const k of keys) {
      observations[k] = true;
      confidence[k] = 'medium';
      evidenceSpan[k] = null;
    }
    const fixture = makeValidResponse({
      checkedRawKeys: keys,
      observations,
      confidence,
      evidenceSpan,
    });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });
});

describe('MCP-021C-EDGE — parser parity: failure modes', () => {
  it('PARITY-FAIL-1 — both parsers reject not_json (raw string non-JSON)', () => {
    expect(parseProd('not valid json {{}')).toEqual(parseEdge('not valid json {{}'));
  });

  it('PARITY-FAIL-2 — both parsers reject not_json (non-string non-object)', () => {
    expect(parseProd(42)).toEqual(parseEdge(42));
    expect(parseProd(null)).toEqual(parseEdge(null));
    expect(parseProd(undefined)).toEqual(parseEdge(undefined));
    expect(parseProd([])).toEqual(parseEdge([]));
  });

  it('PARITY-FAIL-3 — both parsers reject wrong_schema_version', () => {
    const fixture = makeValidResponse({ schemaVersion: 'mcp-999.v999' });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-4 — both parsers reject missing schemaVersion field', () => {
    const fixture = makeValidResponse();
    delete (fixture as Record<string, unknown>).schemaVersion;
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-5 — both parsers reject missing nodeId field', () => {
    const fixture = makeValidResponse();
    delete (fixture as Record<string, unknown>).nodeId;
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-6 — both parsers reject empty nodeId', () => {
    const fixture = makeValidResponse({ nodeId: '' });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-7 — both parsers reject missing observations field', () => {
    const fixture = makeValidResponse();
    delete (fixture as Record<string, unknown>).observations;
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-8 — both parsers reject observations.length > 20', () => {
    const keys = Array.from({ length: 21 }, (_, i) => `key_${i}`);
    const observations: Record<string, boolean> = {};
    const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
    const evidenceSpan: Record<string, string | null> = {};
    for (const k of keys) {
      observations[k] = true;
      confidence[k] = 'medium';
      evidenceSpan[k] = null;
    }
    const fixture = makeValidResponse({
      checkedRawKeys: keys,
      observations,
      confidence,
      evidenceSpan,
    });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-9 — both parsers reject observations value non-boolean', () => {
    const fixture = makeValidResponse({
      observations: { has_rebuttal: 'true' as unknown as boolean },
    });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-10 — both parsers reject confidence value not in low/medium/high', () => {
    const fixture = makeValidResponse({
      confidence: { has_rebuttal: 'super_high' as unknown as 'high' },
    });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-11 — both parsers reject modelInfo.provider !== "mcp"', () => {
    const fixture = makeValidResponse({
      modelInfo: {
        provider: 'anthropic' as unknown as 'mcp',
        serverName: 'x',
        classifierSetVersion: 'y',
      },
    });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-12 — both parsers reject missing modelInfo', () => {
    const fixture = makeValidResponse();
    delete (fixture as Record<string, unknown>).modelInfo;
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-13 — both parsers reject evidenceSpan with numeric value', () => {
    const fixture = makeValidResponse({
      evidenceSpan: { has_rebuttal: 42 as unknown as string },
    });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-14 — both parsers reject confidence as non-object', () => {
    const fixture = makeValidResponse({ confidence: 'high' as unknown as Record<string, string> });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });

  it('PARITY-FAIL-15 — both parsers reject checkedRawKeys non-array', () => {
    const fixture = makeValidResponse({ checkedRawKeys: 'has_rebuttal' as unknown as string[] });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
  });
});

describe('MCP-021C-EDGE — sanitizer parity: per-surface confidence floor', () => {
  it('PARITY-SAN-1 — both sanitizers drop unknown raw_keys', () => {
    const parsed = parseProd(
      makeValidResponse({
        checkedRawKeys: ['has_rebuttal', 'this_unknown_key_does_not_exist'],
        observations: { has_rebuttal: true, this_unknown_key_does_not_exist: true },
        confidence: { has_rebuttal: 'high', this_unknown_key_does_not_exist: 'high' },
        evidenceSpan: { has_rebuttal: null, this_unknown_key_does_not_exist: null },
      }),
    );
    if (!parsed.ok) throw new Error('expected ok');
    const prodOut = sanitizeProd(parsed.response, { surface: 'inspect' });
    const edgeOut = sanitizeEdge(parsed.response, { surface: 'inspect' });
    expect(prodOut).toEqual(edgeOut);
  });

  it('PARITY-SAN-2 — both sanitizers apply timeline_node confidence floor identically', () => {
    const parsed = parseProd(
      makeValidResponse({
        checkedRawKeys: ['has_rebuttal'],
        observations: { has_rebuttal: true },
        confidence: { has_rebuttal: 'low' }, // has_rebuttal requires 'high' on timeline
        evidenceSpan: { has_rebuttal: null },
      }),
    );
    if (!parsed.ok) throw new Error('expected ok');
    const prodOut = sanitizeProd(parsed.response, { surface: 'timeline_node' });
    const edgeOut = sanitizeEdge(parsed.response, { surface: 'timeline_node' });
    expect(prodOut).toEqual(edgeOut);
  });

  it('PARITY-SAN-3 — both sanitizers apply inspect confidence floor identically', () => {
    const parsed = parseProd(
      makeValidResponse({
        checkedRawKeys: ['has_rebuttal'],
        observations: { has_rebuttal: true },
        confidence: { has_rebuttal: 'high' },
        evidenceSpan: { has_rebuttal: null },
      }),
    );
    if (!parsed.ok) throw new Error('expected ok');
    const prodOut = sanitizeProd(parsed.response, { surface: 'inspect' });
    const edgeOut = sanitizeEdge(parsed.response, { surface: 'inspect' });
    expect(prodOut).toEqual(edgeOut);
  });

  it('PARITY-SAN-4 — both sanitizers truncate evidenceSpan at 240 chars', () => {
    const longSpan = 'x'.repeat(500);
    const parsed = parseProd(
      makeValidResponse({
        checkedRawKeys: ['has_rebuttal'],
        observations: { has_rebuttal: true },
        confidence: { has_rebuttal: 'high' },
        evidenceSpan: { has_rebuttal: longSpan },
      }),
    );
    if (!parsed.ok) throw new Error('expected ok');
    const prodOut = sanitizeProd(parsed.response, { surface: 'inspect' });
    const edgeOut = sanitizeEdge(parsed.response, { surface: 'inspect' });
    expect(prodOut).toEqual(edgeOut);
    expect(prodOut.evidenceSpan['has_rebuttal']?.length).toBeLessThanOrEqual(240);
  });

  it('PARITY-SAN-5 — both sanitizers handle empty observations', () => {
    const parsed = parseProd(
      makeValidResponse({
        checkedRawKeys: [],
        observations: {},
        confidence: {},
        evidenceSpan: {},
      }),
    );
    if (!parsed.ok) throw new Error('expected ok');
    const prodOut = sanitizeProd(parsed.response, { surface: 'inspect' });
    const edgeOut = sanitizeEdge(parsed.response, { surface: 'inspect' });
    expect(prodOut).toEqual(edgeOut);
  });
});

describe('MCP-021C-EDGE — request builder parity', () => {
  it('PARITY-BUILD-1 — both builders produce identical request for parent_relation family', () => {
    const input = {
      nodeId: 'arg-1',
      parentNodeId: 'arg-0',
      currentText: 'my reply',
      parentText: 'the parent thesis',
      threadContextExcerpt: 'ancestor context',
      requestedFamilies: ['parent_relation' as const],
      requestedRawKeys: [],
    };
    const prodOut = buildProd(input);
    const edgeOut = buildEdge(input);
    expect(prodOut).toEqual(edgeOut);
  });

  it('PARITY-BUILD-2 — both builders produce identical request for empty family list', () => {
    const input = {
      nodeId: 'arg-1',
      parentNodeId: null,
      currentText: 'my reply',
      parentText: null,
      threadContextExcerpt: '',
      requestedFamilies: [],
      requestedRawKeys: [],
    };
    expect(buildProd(input)).toEqual(buildEdge(input));
  });

  it('PARITY-BUILD-3 — both builders produce identical request for requestedRawKeys', () => {
    const input = {
      nodeId: 'arg-1',
      parentNodeId: 'arg-0',
      currentText: 'my reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: [],
      requestedRawKeys: ['has_rebuttal', 'supports_parent'],
    };
    expect(buildProd(input)).toEqual(buildEdge(input));
  });
});

describe('MCP-021C-EDGE — registry parity', () => {
  it('PARITY-REG-1 — every prod rawKey is present in the edge registry', () => {
    const prodKeys = Object.keys(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY);
    const {
      EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
    } = require('./_helpers/booleanObservationEdgeDeno');
    for (const key of prodKeys) {
      expect(EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[key]).toBeDefined();
    }
  });

  it('PARITY-REG-2 — registry sizes match exactly', () => {
    const {
      EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
    } = require('./_helpers/booleanObservationEdgeDeno');
    expect(Object.keys(EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY).length).toBe(
      Object.keys(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY).length,
    );
  });

  it('PARITY-REG-3 — per-rawKey definitions match deep-equally', () => {
    const {
      EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
    } = require('./_helpers/booleanObservationEdgeDeno');
    for (const [key, prodDef] of Object.entries(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY)) {
      expect(EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[key]).toEqual(prodDef);
    }
  });
});

// ── OPS-MCP-KEY-LEVEL-FAIL-CLOSED — keysDroppedForUncleanSpan parity ───────

describe('MCP-021C-EDGE — keysDroppedForUncleanSpan parity (key-level fail-closed)', () => {
  it('PARITY-KLF-1 — both parsers carry the optional field identically when present', () => {
    const fixture = makeValidResponse({
      checkedRawKeys: ['has_rebuttal'],
      observations: { has_rebuttal: true },
      confidence: { has_rebuttal: 'high' },
      evidenceSpan: { has_rebuttal: null },
      keysDroppedForUncleanSpan: ['needs_pre_send_pause'],
    });
    const prod = parseProd(fixture);
    const edge = parseEdge(fixture);
    expect(prod).toEqual(edge);
    if (!prod.ok) throw new Error('expected ok');
    expect(prod.response.keysDroppedForUncleanSpan).toEqual(['needs_pre_send_pause']);
  });

  it('PARITY-KLF-2 — both parsers OMIT the field when absent (byte-identical to pre-card)', () => {
    const fixture = makeValidResponse();
    const prod = parseProd(fixture);
    const edge = parseEdge(fixture);
    expect(prod).toEqual(edge);
    if (!prod.ok) throw new Error('expected ok');
    expect('keysDroppedForUncleanSpan' in prod.response).toBe(false);
  });

  it('PARITY-KLF-3 — both parsers reject a non-array field identically (wrong_shape)', () => {
    const fixture = makeValidResponse({
      keysDroppedForUncleanSpan: 'needs_pre_send_pause' as unknown as string[],
    });
    expect(parseProd(fixture)).toEqual(parseEdge(fixture));
    expect(parseProd(fixture).ok).toBe(false);
  });

  it('PARITY-KLF-4 — both sanitizers PRESERVE the field verbatim (names only)', () => {
    const parsed = parseProd(
      makeValidResponse({
        checkedRawKeys: ['has_rebuttal'],
        observations: { has_rebuttal: true },
        confidence: { has_rebuttal: 'high' },
        evidenceSpan: { has_rebuttal: null },
        keysDroppedForUncleanSpan: ['needs_pre_send_pause'],
      }),
    );
    if (!parsed.ok) throw new Error('expected ok');
    const prodOut = sanitizeProd(parsed.response, { surface: 'inspect' });
    const edgeOut = sanitizeEdge(parsed.response, { surface: 'inspect' });
    expect(prodOut).toEqual(edgeOut);
    expect(prodOut.keysDroppedForUncleanSpan).toEqual(['needs_pre_send_pause']);
  });
});
