/**
 * MCP-016 / MCP-017 / MCP-018 — Semantic referee provider registry routing tests.
 *
 * Asserts the doctrine-critical routing rules:
 *   - flag on, provider UNSET → defaults to `mock` (the deliberate deviation
 *     from `languageProcessing/providers.ts`, which defaults to `anthropic`) —
 *     THE LOAD-BEARING REGRESSION GUARD, unchanged in intent since MCP-016;
 *   - `mock` / `fixture` are wired;
 *   - `anthropic` is the MCP-017 LIVE provider — reached only through an
 *     injected async `runAnthropic` dep; a `success` result becomes
 *     `{ enabled: true, packet }`, every `unavailable` reason becomes
 *     `{ enabled: false, reason }`;
 *   - `mcp` is the MCP-018 operator-hosted adapter — reached only through an
 *     injected async `runMcp` dep; a `success` result becomes
 *     `{ enabled: true, packet }`, every `McpUnavailableReason` becomes
 *     `{ enabled: false, reason }` via the `mcpReasonToOutcomeReason` map
 *     (`url_missing`/`token_missing` → `not_configured`, the rest pass through);
 *   - an unknown provider value → `{ enabled: false, reason: not_configured }`.
 *
 * MCP-018 NOTE: the `mcp` slot is no longer a `not_implemented` stub. The
 * previous "mcp slot stays stubbed off" test is REWRITTEN below as "mcp routes
 * to runMcp" — the documented single existing-assertion change (MCP-018 design
 * §5). `SemanticRefereeProviderDeps` now also requires a `runMcp` member; every
 * test injects a `runMcp` spy. The routing SWITCH is exercised through the
 * zod-free `providerRoutingCore.ts`; the live `mcpAdapter.ts` is covered by
 * `semanticMcpSourceScan.test.ts` and `semanticEdgeMcpAdapter.test.ts`.
 */
import {
  classifyWithProvider,
  mcpReasonToOutcomeReason,
  runMockClassifier,
  runFixtureClassifier,
  buildFallbackPacket,
  ALL_MCP_UNAVAILABLE_REASONS,
} from './_helpers/semanticRefereeDeno';
import type {
  ProviderResult,
  McpProviderResult,
  McpUnavailableReason,
  SemanticRefereeProviderDeps,
} from './_helpers/semanticRefereeDeno';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';
import type { SemanticRefereePacket } from '../src/features/semanticReferee';

function makeRequest(): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A move body.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent', 'narrows_claim'],
    contentHash: 'hash-1',
  };
}

/**
 * A deps object whose four provider functions are jest spies. `runMock` /
 * `runFixture` wrap the real synchronous fns; `runAnthropic` / `runMcp` are
 * async spies the individual test configures with `mockResolvedValueOnce`.
 */
function spyDeps(): {
  deps: SemanticRefereeProviderDeps;
  mockSpy: jest.Mock;
  fixtureSpy: jest.Mock;
  anthropicSpy: jest.Mock<Promise<ProviderResult>, [ClassifyMoveRequest]>;
  mcpSpy: jest.Mock<Promise<McpProviderResult>, [ClassifyMoveRequest]>;
} {
  const mockSpy = jest.fn(runMockClassifier);
  const fixtureSpy = jest.fn(runFixtureClassifier);
  // Default: an `unavailable` result. Tests that need `success` override it.
  const anthropicSpy = jest.fn<Promise<ProviderResult>, [ClassifyMoveRequest]>(
    async () => ({ kind: 'unavailable', reason: 'key_missing' }),
  );
  const mcpSpy = jest.fn<Promise<McpProviderResult>, [ClassifyMoveRequest]>(
    async () => ({ kind: 'unavailable', reason: 'url_missing' }),
  );
  return {
    deps: {
      runMock: mockSpy,
      runFixture: fixtureSpy,
      runAnthropic: anthropicSpy,
      runMcp: mcpSpy,
    },
    mockSpy,
    fixtureSpy,
    anthropicSpy,
    mcpSpy,
  };
}

/** A schema-valid `anthropic`-provider packet for the success-path spy. */
function makeAnthropicPacket(): SemanticRefereePacket {
  // Reuse the deterministic fallback shape and re-stamp it as the anthropic
  // provider — it is already schema-valid and carries no verdict token.
  const base = buildFallbackPacket(makeRequest());
  return { ...base, provider: 'anthropic', modelVersion: 'claude-haiku-4-5' };
}

/** A schema-valid `mcp`-provider packet for the success-path spy. */
function makeMcpPacket(): SemanticRefereePacket {
  // Reuse the deterministic fallback shape and re-stamp it as the mcp provider
  // — it is already schema-valid and carries no verdict token.
  const base = buildFallbackPacket(makeRequest());
  return { ...base, provider: 'mcp', modelVersion: 'operator-mcp-server' };
}

describe('provider registry — default is mock', () => {
  it('routes to mock when the flag is on and the provider is unset (doctrine default)', async () => {
    const { deps, mockSpy, fixtureSpy, anthropicSpy } = spyDeps();
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true' },
      deps,
    );
    expect(outcome.enabled).toBe(true);
    if (outcome.enabled) expect(outcome.packet.provider).toBe('mock');
    expect(mockSpy).toHaveBeenCalledTimes(1);
    expect(fixtureSpy).not.toHaveBeenCalled();
    expect(anthropicSpy).not.toHaveBeenCalled();
  });

  it('routes to mock when SEMANTIC_REFEREE_PROVIDER is explicitly "mock"', async () => {
    const { deps, mockSpy, anthropicSpy } = spyDeps();
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'mock' },
      deps,
    );
    expect(outcome.enabled).toBe(true);
    expect(mockSpy).toHaveBeenCalledTimes(1);
    expect(anthropicSpy).not.toHaveBeenCalled();
  });
});

describe('provider registry — fixture provider', () => {
  it('routes to the fixture provider when SEMANTIC_REFEREE_PROVIDER is "fixture"', async () => {
    const { deps, mockSpy, fixtureSpy, anthropicSpy } = spyDeps();
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'fixture' },
      deps,
    );
    expect(outcome.enabled).toBe(true);
    expect(fixtureSpy).toHaveBeenCalledTimes(1);
    expect(mockSpy).not.toHaveBeenCalled();
    expect(anthropicSpy).not.toHaveBeenCalled();
  });
});

describe('provider registry — anthropic live provider (MCP-017)', () => {
  it('routes SEMANTIC_REFEREE_PROVIDER=anthropic to runAnthropic and returns its packet on success', async () => {
    const { deps, mockSpy, fixtureSpy, anthropicSpy, mcpSpy } = spyDeps();
    const packet = makeAnthropicPacket();
    anthropicSpy.mockResolvedValueOnce({ kind: 'success', packet });

    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'anthropic' },
      deps,
    );

    expect(outcome.enabled).toBe(true);
    if (outcome.enabled) {
      expect(outcome.packet.provider).toBe('anthropic');
      expect(outcome.packet).toBe(packet);
    }
    expect(anthropicSpy).toHaveBeenCalledTimes(1);
    // mock / fixture / mcp are NOT touched when anthropic is selected.
    expect(mockSpy).not.toHaveBeenCalled();
    expect(fixtureSpy).not.toHaveBeenCalled();
    expect(mcpSpy).not.toHaveBeenCalled();
  });

  it('translates an unavailable:key_missing result to { enabled: false, reason: key_missing }', async () => {
    const { deps, anthropicSpy } = spyDeps();
    anthropicSpy.mockResolvedValueOnce({ kind: 'unavailable', reason: 'key_missing' });

    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'anthropic' },
      deps,
    );

    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('key_missing');
    expect(anthropicSpy).toHaveBeenCalledTimes(1);
  });

  it('translates every ProviderUnavailableReason into the matching disabled reason', async () => {
    const reasons = [
      'key_missing',
      'api_error',
      'rate_limited',
      'network_error',
      'parse_failure',
      'validation_failed',
    ] as const;
    for (const reason of reasons) {
      const { deps, anthropicSpy } = spyDeps();
      anthropicSpy.mockResolvedValueOnce({ kind: 'unavailable', reason });
      const outcome = await classifyWithProvider(
        makeRequest(),
        { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'anthropic' },
        deps,
      );
      expect(outcome.enabled).toBe(false);
      if (!outcome.enabled) expect(outcome.reason).toBe(reason);
    }
  });

  it('passes the request through to runAnthropic unchanged', async () => {
    const { deps, anthropicSpy } = spyDeps();
    const request = makeRequest();
    anthropicSpy.mockResolvedValueOnce({ kind: 'success', packet: makeAnthropicPacket() });
    await classifyWithProvider(
      request,
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'anthropic' },
      deps,
    );
    expect(anthropicSpy).toHaveBeenCalledWith(request);
  });
});

describe('provider registry — mcp operator-hosted adapter (MCP-018)', () => {
  // This block REPLACES the MCP-016/MCP-017 "mcp slot stays stubbed off →
  // not_implemented" test. MCP-018 un-stubs the `mcp` slot; the slot now routes
  // to the injected `runMcp` dep — the documented single existing-assertion
  // change (MCP-018 design §5).
  it('routes SEMANTIC_REFEREE_PROVIDER=mcp to runMcp and returns its packet on success', async () => {
    const { deps, mockSpy, fixtureSpy, anthropicSpy, mcpSpy } = spyDeps();
    const packet = makeMcpPacket();
    mcpSpy.mockResolvedValueOnce({ kind: 'success', packet });

    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'mcp' },
      deps,
    );

    expect(outcome.enabled).toBe(true);
    if (outcome.enabled) {
      expect(outcome.packet.provider).toBe('mcp');
      expect(outcome.packet).toBe(packet);
    }
    expect(mcpSpy).toHaveBeenCalledTimes(1);
    // mock / fixture / anthropic are NOT touched when mcp is selected.
    expect(mockSpy).not.toHaveBeenCalled();
    expect(fixtureSpy).not.toHaveBeenCalled();
    expect(anthropicSpy).not.toHaveBeenCalled();
  });

  it('maps an unavailable:url_missing result to { enabled: false, reason: not_configured }', async () => {
    const { deps, mcpSpy } = spyDeps();
    mcpSpy.mockResolvedValueOnce({ kind: 'unavailable', reason: 'url_missing' });

    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'mcp' },
      deps,
    );

    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_configured');
    expect(mcpSpy).toHaveBeenCalledTimes(1);
  });

  it('maps an unavailable:token_missing result to { enabled: false, reason: not_configured }', async () => {
    const { deps, mcpSpy } = spyDeps();
    mcpSpy.mockResolvedValueOnce({ kind: 'unavailable', reason: 'token_missing' });

    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'mcp' },
      deps,
    );

    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_configured');
  });

  it('passes through every other McpUnavailableReason unchanged', async () => {
    // api_error / rate_limited / network_error / parse_failure /
    // validation_failed are ALREADY legal ClassifyMoveDisabledReasons.
    const passthrough: readonly McpUnavailableReason[] = [
      'api_error',
      'rate_limited',
      'network_error',
      'parse_failure',
      'validation_failed',
    ];
    for (const reason of passthrough) {
      const { deps, mcpSpy } = spyDeps();
      mcpSpy.mockResolvedValueOnce({ kind: 'unavailable', reason });
      const outcome = await classifyWithProvider(
        makeRequest(),
        { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'mcp' },
        deps,
      );
      expect(outcome.enabled).toBe(false);
      if (!outcome.enabled) expect(outcome.reason).toBe(reason);
    }
  });

  it('passes the request through to runMcp unchanged', async () => {
    const { deps, mcpSpy } = spyDeps();
    const request = makeRequest();
    mcpSpy.mockResolvedValueOnce({ kind: 'success', packet: makeMcpPacket() });
    await classifyWithProvider(
      request,
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'mcp' },
      deps,
    );
    expect(mcpSpy).toHaveBeenCalledWith(request);
  });

  it('never invokes runMcp on a disabled call (the disabled check short-circuits first)', async () => {
    const { deps, mcpSpy } = spyDeps();
    // SEMANTIC_REFEREE_ENABLED unset — disabled by default. Even with the
    // provider set to mcp, runMcp must NOT fire.
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_PROVIDER: 'mcp' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('disabled');
    expect(mcpSpy).not.toHaveBeenCalled();
  });
});

describe('provider registry — unknown provider value', () => {
  it('returns { enabled: false, reason: not_configured } for an unknown provider name', async () => {
    const { deps, mockSpy, anthropicSpy, mcpSpy } = spyDeps();
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'some_unknown_provider' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_configured');
    expect(mockSpy).not.toHaveBeenCalled();
    expect(anthropicSpy).not.toHaveBeenCalled();
    expect(mcpSpy).not.toHaveBeenCalled();
  });
});

describe('mcpReasonToOutcomeReason — the McpUnavailableReason → outcome map (MCP-018)', () => {
  // Every McpUnavailableReason a ClassifyMoveDisabledReason value (MCP-018
  // design §4 resolution 1 / §8 "Reason-map unit test").
  const LEGAL_DISABLED_REASONS: ReadonlySet<string> = new Set<string>([
    'disabled',
    'not_configured',
    'not_implemented',
    'key_missing',
    'api_error',
    'rate_limited',
    'network_error',
    'parse_failure',
    'validation_failed',
  ]);

  it('maps url_missing and token_missing onto the existing not_configured reason', () => {
    expect(mcpReasonToOutcomeReason('url_missing')).toBe('not_configured');
    expect(mcpReasonToOutcomeReason('token_missing')).toBe('not_configured');
  });

  it('passes the other five reasons through to themselves', () => {
    for (const reason of [
      'api_error',
      'rate_limited',
      'network_error',
      'parse_failure',
      'validation_failed',
    ] as const) {
      expect(mcpReasonToOutcomeReason(reason)).toBe(reason);
    }
  });

  it('maps every McpUnavailableReason to a legal ClassifyMoveDisabledReason', () => {
    for (const reason of ALL_MCP_UNAVAILABLE_REASONS) {
      expect(LEGAL_DISABLED_REASONS.has(mcpReasonToOutcomeReason(reason))).toBe(true);
    }
  });
});
