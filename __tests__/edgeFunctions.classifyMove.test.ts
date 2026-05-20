/**
 * MCP-016 — classifyMove client wrapper tests.
 *
 * `classifyMove` routes through `supabase.functions.invoke('semantic-referee')`.
 * `invoke` is mocked — NO live call. The wrapper never throws: a disabled
 * outcome, a packet, a fetch error, and an empty response all resolve to a
 * structured `ClassifyMoveFunctionResult` the caller can branch on.
 */
const mockInvoke = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
  SUPABASE_CONFIGURED: true,
}));

import { classifyMove } from '../src/lib/edgeFunctions';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

beforeEach(() => {
  mockInvoke.mockReset();
});

function makePayload(overrides: Partial<ClassifyMoveRequest> = {}): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A redacted move body.',
    roomContext: { side: 'affirmative' },
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'content-hash-1',
    ...overrides,
  };
}

describe('classifyMove — call shape', () => {
  it('invokes the semantic-referee function with the payload as the body', async () => {
    mockInvoke.mockResolvedValue({ data: { enabled: false, reason: 'disabled' }, error: null });
    const payload = makePayload();
    await classifyMove(payload);
    expect(mockInvoke).toHaveBeenCalledWith('semantic-referee', { body: payload });
  });
});

describe('classifyMove — disabled outcome', () => {
  it('returns ok:true with the disabled outcome when the function returns { enabled: false }', async () => {
    mockInvoke.mockResolvedValue({ data: { enabled: false, reason: 'disabled' }, error: null });
    const result = await classifyMove(makePayload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.enabled).toBe(false);
      if (!result.data.enabled) expect(result.data.reason).toBe('disabled');
    }
  });

  it('passes through a not_implemented disabled reason', async () => {
    mockInvoke.mockResolvedValue({
      data: { enabled: false, reason: 'not_implemented' },
      error: null,
    });
    const result = await classifyMove(makePayload());
    expect(result.ok).toBe(true);
    if (result.ok && !result.data.enabled) {
      expect(result.data.reason).toBe('not_implemented');
    }
  });
});

describe('classifyMove — enabled outcome', () => {
  it('returns ok:true with the packet when the function returns { enabled: true }', async () => {
    const packet = {
      packetVersion: 'mcp-semantic-referee-v0',
      promptVersion: 'mcp-semantic-referee-prompt-v0',
      modelVersion: 'mock-semantic-referee-v0',
      provider: 'mock',
      authoritative: false,
      inputHash: 'input-hash-1',
      contentHash: 'content-hash-1',
      roomId: 'room-1',
      binaries: [],
      routeSuggestion: 'no_route_change',
      frictionSuggestion: 'none',
      scoreHints: {
        continuityCredit: 0,
        evidencePressure: 0,
        branchHygiene: 0,
        synthesisReadiness: 0,
        sourceChainDebt: 0,
        unresolvedRedirectRisk: 0,
      },
    };
    mockInvoke.mockResolvedValue({ data: { enabled: true, packet }, error: null });
    const result = await classifyMove(makePayload());
    expect(result.ok).toBe(true);
    if (result.ok && result.data.enabled) {
      expect(result.data.packet.provider).toBe('mock');
      expect(result.data.packet.authoritative).toBe(false);
    }
  });
});

describe('classifyMove — error paths', () => {
  it('maps a FunctionsFetchError to ok:false with status 503', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsFetchError' },
    });
    const result = await classifyMove(makePayload());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it('unwraps a structured Edge Function error and returns ok:false with its status', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        status: 422,
        context: { json: async () => ({ error: 'validation_failed' }) },
      },
    });
    const result = await classifyMove(makePayload());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error.error).toBe('validation_failed');
    }
  });

  it('returns ok:false { error: empty_response } status 500 for an empty response', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const result = await classifyMove(makePayload());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('empty_response');
      expect(result.status).toBe(500);
    }
  });

  it('never throws even when invoke rejects-shaped error has no context', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', status: 500 } });
    await expect(classifyMove(makePayload())).resolves.toBeDefined();
  });
});
