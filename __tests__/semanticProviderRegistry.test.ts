/**
 * MCP-016 / MCP-017 — Semantic referee provider registry routing tests.
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
 *   - `mcp` stays a STUB → `{ enabled: false, reason: not_implemented }`;
 *   - an unknown provider value → `{ enabled: false, reason: not_configured }`.
 *
 * MCP-017 NOTE: `classifyWithProvider` is now `async` (the `anthropic` branch
 * awaits the live provider) and `SemanticRefereeProviderDeps` now requires a
 * `runAnthropic` member. Every test `await`s the outcome and injects a
 * `runAnthropic` spy. The routing SWITCH is exercised through the zod-free
 * `providerRoutingCore.ts` (the bridge loads it from there); the live
 * `anthropicProvider.ts` itself is covered by `semanticAnthropicSourceScan.test.ts`
 * and `semanticEdgeAuthAnthropic.test.ts`.
 */
import {
  classifyWithProvider,
  runMockClassifier,
  runFixtureClassifier,
  buildFallbackPacket,
} from './_helpers/semanticRefereeDeno';
import type {
  ProviderResult,
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
 * A deps object whose three provider functions are jest spies. `runMock` /
 * `runFixture` wrap the real synchronous fns; `runAnthropic` is an async spy
 * the individual test configures with `mockResolvedValueOnce`.
 */
function spyDeps(): {
  deps: SemanticRefereeProviderDeps;
  mockSpy: jest.Mock;
  fixtureSpy: jest.Mock;
  anthropicSpy: jest.Mock<Promise<ProviderResult>, [ClassifyMoveRequest]>;
} {
  const mockSpy = jest.fn(runMockClassifier);
  const fixtureSpy = jest.fn(runFixtureClassifier);
  // Default: an `unavailable` result. Tests that need `success` override it.
  const anthropicSpy = jest.fn<Promise<ProviderResult>, [ClassifyMoveRequest]>(
    async () => ({ kind: 'unavailable', reason: 'key_missing' }),
  );
  return {
    deps: { runMock: mockSpy, runFixture: fixtureSpy, runAnthropic: anthropicSpy },
    mockSpy,
    fixtureSpy,
    anthropicSpy,
  };
}

/** A schema-valid `anthropic`-provider packet for the success-path spy. */
function makeAnthropicPacket(): SemanticRefereePacket {
  // Reuse the deterministic fallback shape and re-stamp it as the anthropic
  // provider — it is already schema-valid and carries no verdict token.
  const base = buildFallbackPacket(makeRequest());
  return { ...base, provider: 'anthropic', modelVersion: 'claude-haiku-4-5' };
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
    const { deps, mockSpy, fixtureSpy, anthropicSpy } = spyDeps();
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
    // mock / fixture are NOT touched when anthropic is selected.
    expect(mockSpy).not.toHaveBeenCalled();
    expect(fixtureSpy).not.toHaveBeenCalled();
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

describe('provider registry — mcp slot stays stubbed off', () => {
  it('returns { enabled: false, reason: not_implemented } for provider "mcp"', async () => {
    const { deps, mockSpy, fixtureSpy, anthropicSpy } = spyDeps();
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'mcp' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_implemented');
    // The stub is a literal return — no provider function is invoked.
    expect(mockSpy).not.toHaveBeenCalled();
    expect(fixtureSpy).not.toHaveBeenCalled();
    expect(anthropicSpy).not.toHaveBeenCalled();
  });
});

describe('provider registry — unknown provider value', () => {
  it('returns { enabled: false, reason: not_configured } for an unknown provider name', async () => {
    const { deps, mockSpy, anthropicSpy } = spyDeps();
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'some_unknown_provider' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_configured');
    expect(mockSpy).not.toHaveBeenCalled();
    expect(anthropicSpy).not.toHaveBeenCalled();
  });
});
