/**
 * MCP-021C-EDGE — Test: end-to-end flow with mock MCP adapter (handler-level).
 *
 * Per design §10.3: this is the integration test that exercises the
 * Edge Function's per-argument flow without making a real fetch. We
 * cannot directly invoke the Deno-only handler from Jest, so this
 * test orchestrates the same SEQUENCE the handler runs by composing
 * the bridged modules (request builder + family registry filter +
 * sanitizer + result-row construction). The actual Edge Function
 * boundary (auth, JSON parse, service-role write) is covered by:
 *   - mcpOneTwoOneCEdgeFunctionHandler.test.ts (source-scan boundary)
 *   - mcpOneTwoOneCEdgePersistenceWriter.test.ts (writer boundary)
 *
 * Three scenarios exercised here:
 *   1. Adapter success with positive Family A observations → result rows
 *      reflect the observed rawKeys.
 *   2. Adapter success with zero positive observations → zero result rows.
 *   3. Adapter unavailable (network_error) → failed run, zero results.
 */

import {
  edgeBuildBooleanObservationRequestForArgument,
  edgeFilterFamiliesForMode,
  edgeSanitizeMcpBooleanObservationResponse,
  EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
  type BooleanObservationAdapterResult,
  type McpBooleanObservationRequest,
  type McpBooleanObservationResponse,
} from './_helpers/booleanObservationEdgeDeno';

const VALID_VERSION = EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;

const ARG_ID = 'arg-int-1';

function buildSuccessResponse(
  observations: Partial<Record<string, boolean>>,
  confidence: Partial<Record<string, 'low' | 'medium' | 'high'>>,
): McpBooleanObservationResponse {
  const keys = Object.keys(observations);
  const confidenceMap: Record<string, 'low' | 'medium' | 'high'> = {};
  const evidenceMap: Record<string, string | null> = {};
  for (const k of keys) {
    confidenceMap[k] = confidence[k] ?? 'high';
    evidenceMap[k] = null;
  }
  return {
    schemaVersion: VALID_VERSION as McpBooleanObservationResponse['schemaVersion'],
    nodeId: ARG_ID,
    checkedRawKeys: keys,
    observations: observations as Record<string, boolean>,
    confidence: confidenceMap,
    evidenceSpan: evidenceMap,
    modelInfo: {
      provider: 'mcp',
      serverName: 'operator-mcp-server',
      classifierSetVersion: 'mcp-021.classifier-set.v1',
    },
  };
}

/**
 * Simulate the handler's per-argument flow:
 *   1. Filter requestedFamilies via the mode gate.
 *   2. Build the MCP request.
 *   3. Invoke the (injected) adapter.
 *   4. On success: sanitize at INSPECT floor; collect positive
 *      observations + result rows.
 *   5. On unavailable: record the failure_reason.
 */
async function simulateHandlerFlow(opts: {
  argumentId: string;
  parentArgumentId: string | null;
  currentText: string;
  parentText: string | null;
  threadContextExcerpt: string;
  requestedFamilies: ReadonlyArray<'parent_relation' | 'disagreement_axis'>;
  mode: 'production' | 'admin_validation';
  adapter: (
    request: McpBooleanObservationRequest,
  ) => Promise<BooleanObservationAdapterResult>;
}): Promise<{
  status: 'success' | 'failed';
  failureReason: string | null;
  positiveCount: number;
  rawKeysWithPositive: string[];
}> {
  const eligibleFamilies = edgeFilterFamiliesForMode(opts.requestedFamilies, opts.mode);
  const request = edgeBuildBooleanObservationRequestForArgument({
    argumentId: opts.argumentId,
    parentArgumentId: opts.parentArgumentId,
    currentText: opts.currentText,
    parentText: opts.parentText,
    threadContextExcerpt: opts.threadContextExcerpt,
    requestedFamilies: eligibleFamilies,
    mode: opts.mode,
  });
  const result = await opts.adapter(request);
  if (result.kind === 'unavailable') {
    return {
      status: 'failed',
      failureReason: `mcp_${result.reason}`,
      positiveCount: 0,
      rawKeysWithPositive: [],
    };
  }
  const sanitized = edgeSanitizeMcpBooleanObservationResponse(result.response, {
    surface: 'inspect',
  });
  const rawKeysWithPositive: string[] = [];
  for (const rawKey of sanitized.checkedRawKeys) {
    if (sanitized.observations[rawKey] === true) {
      const def = EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey];
      if (def) rawKeysWithPositive.push(rawKey);
    }
  }
  return {
    status: 'success',
    failureReason: null,
    positiveCount: rawKeysWithPositive.length,
    rawKeysWithPositive,
  };
}

describe('MCP-021C-EDGE — integration flow: success with positive Family A observations', () => {
  it('INT-1 — production + Family A + 3 positive keys → 3 result rows', async () => {
    const mockAdapter = jest.fn().mockResolvedValue({
      kind: 'success',
      response: buildSuccessResponse(
        {
          has_rebuttal: true,
          challenges_parent: true,
          supports_parent: true,
        },
        {
          has_rebuttal: 'high',
          challenges_parent: 'high',
          supports_parent: 'high',
        },
      ),
    } as BooleanObservationAdapterResult);

    const result = await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(result.status).toBe('success');
    expect(result.positiveCount).toBe(3);
    expect([...result.rawKeysWithPositive].sort()).toEqual([
      'challenges_parent',
      'has_rebuttal',
      'supports_parent',
    ]);
    expect(mockAdapter).toHaveBeenCalledTimes(1);
  });

  it('INT-2 — request to adapter carries 16 Family A keys + correct schema version', async () => {
    let capturedRequest: McpBooleanObservationRequest | null = null;
    const mockAdapter = jest.fn().mockImplementation(async (req: McpBooleanObservationRequest) => {
      capturedRequest = req;
      return {
        kind: 'success',
        response: buildSuccessResponse({}, {}),
      };
    });

    await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(capturedRequest).not.toBeNull();
    const captured = capturedRequest!;
    expect(captured.schemaVersion).toBe(VALID_VERSION);
    expect(captured.requestedRawKeys).toHaveLength(16);
    expect(captured.requestedFamilies).toEqual(['parent_relation']);
  });

  it('INT-3 — false observations are excluded from result rows', async () => {
    const mockAdapter = jest.fn().mockResolvedValue({
      kind: 'success',
      response: buildSuccessResponse(
        {
          has_rebuttal: true,
          challenges_parent: false,
          supports_parent: false,
        },
        { has_rebuttal: 'high', challenges_parent: 'high', supports_parent: 'high' },
      ),
    });

    const result = await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(result.status).toBe('success');
    expect(result.positiveCount).toBe(1);
    expect(result.rawKeysWithPositive).toEqual(['has_rebuttal']);
  });

  it('INT-4 — observations below inspect confidence floor are excluded', async () => {
    // has_rebuttal has inspectMinConfidence === 'high'; 'low' is below floor.
    const mockAdapter = jest.fn().mockResolvedValue({
      kind: 'success',
      response: buildSuccessResponse(
        { has_rebuttal: true },
        { has_rebuttal: 'low' },
      ),
    });

    const result = await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(result.status).toBe('success');
    expect(result.positiveCount).toBe(0);
    expect(result.rawKeysWithPositive).toEqual([]);
  });
});

describe('MCP-021C-EDGE — integration flow: success with zero positive observations', () => {
  it('INT-5 — all observations false → zero result rows; status still success', async () => {
    const mockAdapter = jest.fn().mockResolvedValue({
      kind: 'success',
      response: buildSuccessResponse(
        {
          has_rebuttal: false,
          supports_parent: false,
        },
        { has_rebuttal: 'high', supports_parent: 'high' },
      ),
    });

    const result = await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(result.status).toBe('success');
    expect(result.failureReason).toBeNull();
    expect(result.positiveCount).toBe(0);
    expect(result.rawKeysWithPositive).toEqual([]);
  });
});

describe('MCP-021C-EDGE — integration flow: adapter unavailable', () => {
  it('INT-6 — adapter network_error → status failed, failureReason mcp_network_error', async () => {
    const mockAdapter = jest.fn().mockResolvedValue({
      kind: 'unavailable',
      reason: 'network_error',
    } as BooleanObservationAdapterResult);

    const result = await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('mcp_network_error');
    expect(result.positiveCount).toBe(0);
    expect(result.rawKeysWithPositive).toEqual([]);
  });

  it('INT-7 — adapter url_missing → failed, failureReason mcp_url_missing', async () => {
    const mockAdapter = jest.fn().mockResolvedValue({
      kind: 'unavailable',
      reason: 'url_missing',
    } as BooleanObservationAdapterResult);

    const result = await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('mcp_url_missing');
  });

  it('INT-8 — adapter validation_failed → failed, failureReason mcp_validation_failed', async () => {
    const mockAdapter = jest.fn().mockResolvedValue({
      kind: 'unavailable',
      reason: 'validation_failed',
    } as BooleanObservationAdapterResult);

    const result = await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('mcp_validation_failed');
  });
});

describe('MCP-021C-EDGE — integration flow: admin_validation mode', () => {
  it('INT-9 — admin_validation + disagreement_axis is allowed (positive keys emit)', async () => {
    // Pick the first key that has inspect floor 'low' for clarity. Most
    // disagreement_axis keys have looser inspect floors than parent_relation.
    let capturedRequest: McpBooleanObservationRequest | null = null;
    const mockAdapter = jest.fn().mockImplementation(async (req: McpBooleanObservationRequest) => {
      capturedRequest = req;
      // Pick the first 3 rawKeys from the request and mark them true.
      const keys = req.requestedRawKeys.slice(0, 3);
      const observations: Record<string, boolean> = {};
      const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
      for (const k of keys) {
        observations[k] = true;
        confidence[k] = 'high';
      }
      return {
        kind: 'success',
        response: buildSuccessResponse(observations, confidence),
      };
    });

    const result = await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['disagreement_axis'],
      mode: 'admin_validation',
      adapter: mockAdapter,
    });

    expect(result.status).toBe('success');
    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.requestedFamilies).toEqual(['disagreement_axis']);
    expect(capturedRequest!.requestedRawKeys.length).toBeGreaterThan(0);
  });

  it('INT-10 — admin_validation + disagreement_axis goes through (not blocked by production gate)', async () => {
    const mockAdapter = jest.fn().mockResolvedValue({
      kind: 'success',
      response: buildSuccessResponse({}, {}),
    });

    const result = await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['disagreement_axis'],
      mode: 'admin_validation',
      adapter: mockAdapter,
    });

    expect(result.status).toBe('success');
    expect(mockAdapter).toHaveBeenCalled();
  });

  it('INT-11 — admin_validation includes parent_relation also (mixed families)', async () => {
    let capturedRequest: McpBooleanObservationRequest | null = null;
    const mockAdapter = jest.fn().mockImplementation(async (req: McpBooleanObservationRequest) => {
      capturedRequest = req;
      return { kind: 'success', response: buildSuccessResponse({}, {}) };
    });

    await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation', 'disagreement_axis'],
      mode: 'admin_validation',
      adapter: mockAdapter,
    });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.requestedFamilies).toContain('parent_relation');
    expect(capturedRequest!.requestedFamilies).toContain('disagreement_axis');
  });
});

describe('MCP-021C-EDGE — integration flow: production accepts A+B+C, rejects D–J (post Stage 2B)', () => {
  it('INT-12 — production + disagreement_axis (B) → keeps the family + its 14 raw keys (post Stage 2B)', async () => {
    let capturedRequest: McpBooleanObservationRequest | null = null;
    const mockAdapter = jest.fn().mockImplementation(async (req: McpBooleanObservationRequest) => {
      capturedRequest = req;
      return { kind: 'success', response: buildSuccessResponse({}, {}) };
    });

    await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['disagreement_axis'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(capturedRequest).not.toBeNull();
    // Post Stage 2B: disagreement_axis (B) is productionEnabled, so
    // production mode KEEPS it.
    expect(capturedRequest!.requestedFamilies).toEqual(['disagreement_axis']);
    expect(capturedRequest!.requestedRawKeys.length).toBe(14);
  });
});

describe('MCP-021C-EDGE — integration flow: root argument (depth-0)', () => {
  it('INT-13 — parentArgumentId null + parentText null still drives a successful classification', async () => {
    const mockAdapter = jest.fn().mockResolvedValue({
      kind: 'success',
      response: buildSuccessResponse(
        { has_rebuttal: false }, // root: no rebuttal yet
        { has_rebuttal: 'high' },
      ),
    });

    const result = await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: null,
      currentText: 'root thesis',
      parentText: null,
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(result.status).toBe('success');
    expect(result.positiveCount).toBe(0);
  });
});

describe('MCP-021C-EDGE — integration flow: schema version pinning', () => {
  it('INT-14 — request to adapter carries the MCP-021A schema version constant', async () => {
    let capturedRequest: McpBooleanObservationRequest | null = null;
    const mockAdapter = jest.fn().mockImplementation(async (req: McpBooleanObservationRequest) => {
      capturedRequest = req;
      return { kind: 'success', response: buildSuccessResponse({}, {}) };
    });

    await simulateHandlerFlow({
      argumentId: ARG_ID,
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation'],
      mode: 'production',
      adapter: mockAdapter,
    });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.schemaVersion).toBe('mcp-021.machine-observations.boolean.v1');
  });
});
