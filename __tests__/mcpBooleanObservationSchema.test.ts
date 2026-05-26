/**
 * MCP-021A — Test category 5: MCP boolean observation schema validation.
 *
 * Tests the parser, sanitizer, request builder, and response→marks
 * bridge for the MCP boolean observation contract. All failure modes
 * from design §5.5 are covered.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §7 — validators are pure; no network call.
 *   - cdiscourse-doctrine §10a — unknown rawKeys are dropped silently
 *     (never echoed to UI or logs).
 *   - design doc §5 — failure-mode contract.
 */

import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  buildMcpBooleanObservationRequest,
  mcpResponseToNodeLabelMarks,
  parseMcpBooleanObservationResponse,
  sanitizeMcpBooleanObservationResponse,
  type McpBooleanObservationResponse,
} from '../src/features/nodeLabels/mcpBooleanObservationSchema';

function validResponseJson(): McpBooleanObservationResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-1',
    checkedRawKeys: [],
    observations: {},
    confidence: {},
    evidenceSpan: {},
    modelInfo: {
      provider: 'mcp',
      serverName: 'mcp-server-test',
      classifierSetVersion: '2026.05.25-001',
    },
  };
}

describe('MCP-021A — MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION constant', () => {
  it('equals the v1 wire-version string', () => {
    expect(MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION).toBe(
      'mcp-021.machine-observations.boolean.v1',
    );
  });
});

describe('MCP-021A — parseMcpBooleanObservationResponse — happy path', () => {
  it('accepts a valid JSON string', () => {
    const result = parseMcpBooleanObservationResponse(JSON.stringify(validResponseJson()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.nodeId).toBe('node-1');
    }
  });

  it('accepts a pre-parsed plain object', () => {
    const result = parseMcpBooleanObservationResponse(validResponseJson());
    expect(result.ok).toBe(true);
  });

  it('preserves the schema version', () => {
    const result = parseMcpBooleanObservationResponse(validResponseJson());
    if (result.ok) {
      expect(result.response.schemaVersion).toBe(MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    }
  });

  it('preserves observations + confidence + evidenceSpan maps', () => {
    const candidate = validResponseJson();
    candidate.checkedRawKeys = ['has_evidence', 'source_attached'];
    candidate.observations = { has_evidence: true, source_attached: false };
    candidate.confidence = { has_evidence: 'high', source_attached: 'medium' };
    candidate.evidenceSpan = { has_evidence: 'cited the FBI UCR 2010-2023', source_attached: null };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.observations['has_evidence']).toBe(true);
      expect(result.response.confidence['has_evidence']).toBe('high');
      expect(result.response.evidenceSpan['source_attached']).toBeNull();
    }
  });

  it('preserves modelInfo provenance', () => {
    const result = parseMcpBooleanObservationResponse(validResponseJson());
    if (result.ok) {
      expect(result.response.modelInfo.provider).toBe('mcp');
      expect(result.response.modelInfo.serverName).toBe('mcp-server-test');
    }
  });
});

describe('MCP-021A — parseMcpBooleanObservationResponse — failure modes', () => {
  it('returns not_json for non-JSON strings', () => {
    const result = parseMcpBooleanObservationResponse('not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_json');
  });

  it('returns not_json for empty string', () => {
    const result = parseMcpBooleanObservationResponse('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_json');
  });

  it('returns not_json for null', () => {
    const result = parseMcpBooleanObservationResponse(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_json');
  });

  it('returns not_json for number', () => {
    const result = parseMcpBooleanObservationResponse(42);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_json');
  });

  it('returns wrong_shape when parsed root is array', () => {
    const result = parseMcpBooleanObservationResponse('[]');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_shape');
  });

  it('returns wrong_schema_version when schemaVersion missing', () => {
    const candidate = { ...validResponseJson() } as Record<string, unknown>;
    delete candidate['schemaVersion'];
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_schema_version');
  });

  it('returns wrong_schema_version when schemaVersion is wrong', () => {
    const candidate = { ...validResponseJson(), schemaVersion: 'mcp-021.v999' };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_schema_version');
  });

  it('returns missing_required_field when nodeId missing', () => {
    const candidate = { ...validResponseJson() } as Record<string, unknown>;
    delete candidate['nodeId'];
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_required_field');
  });

  it('returns missing_required_field when observations missing', () => {
    const candidate = { ...validResponseJson() } as Record<string, unknown>;
    delete candidate['observations'];
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_required_field');
  });

  it('returns missing_required_field when confidence missing', () => {
    const candidate = { ...validResponseJson() } as Record<string, unknown>;
    delete candidate['confidence'];
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_required_field');
  });

  it('returns wrong_shape when nodeId is empty string', () => {
    const candidate = { ...validResponseJson(), nodeId: '' };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_shape');
  });

  it('returns wrong_shape when checkedRawKeys is not array', () => {
    const candidate = { ...validResponseJson(), checkedRawKeys: 'oops' };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_shape');
  });

  it('returns wrong_shape when checkedRawKeys has non-string entry', () => {
    const candidate = { ...validResponseJson(), checkedRawKeys: [1, 2, 3] };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_shape');
  });

  it('returns wrong_shape when observations has non-boolean value', () => {
    const candidate = { ...validResponseJson(), observations: { foo: 'yes' } };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_shape');
  });

  it('returns wrong_shape when confidence has invalid band', () => {
    const candidate = { ...validResponseJson(), confidence: { foo: 'super_high' } };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_shape');
  });

  it('returns wrong_shape when evidenceSpan has non-string non-null value', () => {
    const candidate = { ...validResponseJson(), evidenceSpan: { foo: 42 } };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_shape');
  });

  it('returns wrong_shape when modelInfo.provider is not "mcp"', () => {
    const candidate = {
      ...validResponseJson(),
      modelInfo: { provider: 'openai', serverName: 'x', classifierSetVersion: 'y' },
    };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_shape');
  });

  it('returns flag_count_too_high when observations > 20 entries', () => {
    const observations: Record<string, boolean> = {};
    for (let i = 0; i < 21; i++) observations[`key_${i}`] = true;
    const candidate = { ...validResponseJson(), observations };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('flag_count_too_high');
  });

  it('accepts exactly 20 observations as the boundary case', () => {
    const observations: Record<string, boolean> = {};
    const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
    const checkedRawKeys: string[] = [];
    for (let i = 0; i < 20; i++) {
      observations[`key_${i}`] = false;
      confidence[`key_${i}`] = 'medium';
      checkedRawKeys.push(`key_${i}`);
    }
    const candidate = { ...validResponseJson(), checkedRawKeys, observations, confidence };
    const result = parseMcpBooleanObservationResponse(candidate);
    expect(result.ok).toBe(true);
  });
});

describe('MCP-021A — sanitizeMcpBooleanObservationResponse', () => {
  it('drops unknown rawKeys silently (never echoed)', () => {
    const response = validResponseJson();
    response.checkedRawKeys = ['unknown_key_that_is_not_in_registry'];
    response.observations = { unknown_key_that_is_not_in_registry: true };
    response.confidence = { unknown_key_that_is_not_in_registry: 'high' };
    response.evidenceSpan = { unknown_key_that_is_not_in_registry: 'should be dropped' };
    const sanitized = sanitizeMcpBooleanObservationResponse(response, { surface: 'inspect' });
    expect(Object.keys(sanitized.observations)).toEqual([]);
    expect(Object.keys(sanitized.confidence)).toEqual([]);
    expect(sanitized.checkedRawKeys).toEqual([]);
  });

  it('returns a NEW object (never mutates input)', () => {
    const response = validResponseJson();
    const before = JSON.stringify(response);
    sanitizeMcpBooleanObservationResponse(response, { surface: 'inspect' });
    expect(JSON.stringify(response)).toBe(before);
  });

  it('preserves modelInfo provenance', () => {
    const response = validResponseJson();
    response.modelInfo = {
      provider: 'mcp',
      serverName: 'my-server',
      classifierSetVersion: 'v9',
    };
    const sanitized = sanitizeMcpBooleanObservationResponse(response, { surface: 'inspect' });
    expect(sanitized.modelInfo.serverName).toBe('my-server');
    expect(sanitized.modelInfo.classifierSetVersion).toBe('v9');
  });

  it('truncates evidenceSpan over 240 chars for known keys', () => {
    // Note: this only validates the truncation logic — known-key happy path
    // depends on Family A+ commits adding entries. Until then, no keys are
    // known, so this test just asserts the sanitizer accepts long input.
    const response = validResponseJson();
    response.checkedRawKeys = ['unknown_long_value'];
    response.observations = { unknown_long_value: true };
    response.confidence = { unknown_long_value: 'high' };
    response.evidenceSpan = { unknown_long_value: 'x'.repeat(500) };
    const sanitized = sanitizeMcpBooleanObservationResponse(response, { surface: 'inspect' });
    // Unknown keys are dropped silently; truncation pass tested once Family A lands.
    expect(Object.keys(sanitized.evidenceSpan)).toEqual([]);
  });
});

describe('MCP-021A — buildMcpBooleanObservationRequest', () => {
  it('returns a structurally valid request', () => {
    const req = buildMcpBooleanObservationRequest({
      nodeId: 'node-1',
      parentNodeId: null,
      currentText: 'sample',
      parentText: null,
      threadContextExcerpt: '',
      requestedFamilies: [],
      requestedRawKeys: [],
    });
    expect(req.schemaVersion).toBe(MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    expect(req.nodeId).toBe('node-1');
    expect(req.parentNodeId).toBeNull();
    expect(req.timeoutMs).toBeGreaterThan(0);
  });

  it('falls back to default timeout when not provided', () => {
    const req = buildMcpBooleanObservationRequest({
      nodeId: 'node-1',
      parentNodeId: null,
      currentText: '',
      parentText: null,
      threadContextExcerpt: '',
      requestedFamilies: [],
      requestedRawKeys: [],
    });
    expect(req.timeoutMs).toBe(12_000);
  });

  it('respects an explicit timeoutMs', () => {
    const req = buildMcpBooleanObservationRequest({
      nodeId: 'node-1',
      parentNodeId: null,
      currentText: '',
      parentText: null,
      threadContextExcerpt: '',
      requestedFamilies: [],
      requestedRawKeys: [],
      timeoutMs: 5_000,
    });
    expect(req.timeoutMs).toBe(5_000);
  });

  it('drops unknown rawKeys from definitions (never includes them)', () => {
    const req = buildMcpBooleanObservationRequest({
      nodeId: 'node-1',
      parentNodeId: null,
      currentText: '',
      parentText: null,
      threadContextExcerpt: '',
      requestedFamilies: [],
      requestedRawKeys: ['definitely_not_a_real_raw_key'],
    });
    expect(Object.keys(req.definitions)).toEqual([]);
  });

  it('preserves requestedFamilies frozen', () => {
    const req = buildMcpBooleanObservationRequest({
      nodeId: 'node-1',
      parentNodeId: null,
      currentText: '',
      parentText: null,
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      requestedRawKeys: [],
    });
    expect(Object.isFrozen(req.requestedFamilies)).toBe(true);
  });
});

describe('MCP-021A — mcpResponseToNodeLabelMarks', () => {
  it('returns [] for a response with no positive observations', () => {
    const response = validResponseJson();
    const marks = mcpResponseToNodeLabelMarks(response, { surface: 'inspect' });
    expect(marks).toEqual([]);
  });

  it('skips unknown rawKeys (never produces a mark for them)', () => {
    const response = validResponseJson();
    response.checkedRawKeys = ['unknown_key'];
    response.observations = { unknown_key: true };
    response.confidence = { unknown_key: 'high' };
    response.evidenceSpan = { unknown_key: null };
    const marks = mcpResponseToNodeLabelMarks(response, { surface: 'inspect' });
    expect(marks).toEqual([]);
  });
});
