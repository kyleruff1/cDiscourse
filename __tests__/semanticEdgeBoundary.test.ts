/**
 * MCP-016 / MCP-017 — Semantic referee disabled-by-default boundary tests.
 *
 * The dominant path: `SEMANTIC_REFEREE_ENABLED` unset / empty / not exactly
 * `'true'` → `{ enabled: false, reason: 'disabled' }` AND no provider function
 * is invoked. The disabled check happens BEFORE any provider is selected — this
 * suite asserts that with a provider spy.
 *
 * Tests import the pure routing core (`providerRoutingCore.ts`, zod-free) — env
 * and provider functions are injected, so no `Deno` and no live call is needed.
 *
 * MCP-017: `classifyWithProvider` is now `async` (the `anthropic` branch awaits
 * the live provider) and `SemanticRefereeProviderDeps` now requires a
 * `runAnthropic` member. The disabled-by-default tests `await` the outcome and
 * the spy deps include a `runAnthropic` spy — which must NEVER be called on any
 * disabled path (the flag check short-circuits before any provider).
 */
import {
  classifyWithProvider,
  runMockClassifier,
  runFixtureClassifier,
} from './_helpers/semanticRefereeDeno';
import type {
  ProviderResult,
  McpProviderResult,
  SemanticRefereeProviderDeps,
} from './_helpers/semanticRefereeDeno';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

function makeRequest(): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A move body.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'hash-1',
  };
}

/** A deps object whose provider functions are jest spies wrapping the real fns. */
function spyDeps(): {
  deps: SemanticRefereeProviderDeps;
  mockSpy: jest.Mock;
  fixtureSpy: jest.Mock;
  anthropicSpy: jest.Mock;
  mcpSpy: jest.Mock;
} {
  const mockSpy = jest.fn(runMockClassifier);
  const fixtureSpy = jest.fn(runFixtureClassifier);
  // A `runAnthropic` spy that must never fire on a disabled path. If a disabled
  // call ever reached it, the test would still fail the `not.toHaveBeenCalled`
  // assertion below.
  const anthropicSpy = jest.fn(
    async (): Promise<ProviderResult> => ({ kind: 'unavailable', reason: 'key_missing' }),
  );
  // MCP-018 — the `runMcp` spy. Same role as `anthropicSpy`: it must never fire
  // on a disabled path.
  const mcpSpy = jest.fn(
    async (): Promise<McpProviderResult> => ({ kind: 'unavailable', reason: 'url_missing' }),
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

describe('disabled-by-default — flag unset', () => {
  it('returns { enabled: false, reason: disabled } when SEMANTIC_REFEREE_ENABLED is unset', async () => {
    const { deps, mockSpy, fixtureSpy, anthropicSpy } = spyDeps();
    const outcome = await classifyWithProvider(makeRequest(), {}, deps);
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('disabled');
    // No provider function was invoked — the flag check happens first.
    expect(mockSpy).not.toHaveBeenCalled();
    expect(fixtureSpy).not.toHaveBeenCalled();
    expect(anthropicSpy).not.toHaveBeenCalled();
  });

  it('returns disabled when the flag is the empty string', async () => {
    const { deps, mockSpy } = spyDeps();
    const outcome = await classifyWithProvider(makeRequest(), { SEMANTIC_REFEREE_ENABLED: '' }, deps);
    expect(outcome.enabled).toBe(false);
    expect(mockSpy).not.toHaveBeenCalled();
  });

  it('returns disabled when the flag is the string "false"', async () => {
    const { deps, mockSpy } = spyDeps();
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'false' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('disabled');
    expect(mockSpy).not.toHaveBeenCalled();
  });

  it('returns disabled when the flag is "TRUE" (case-sensitive — only exact "true" enables)', async () => {
    const { deps, mockSpy } = spyDeps();
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'TRUE' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    expect(mockSpy).not.toHaveBeenCalled();
  });

  it('does not select a provider even when SEMANTIC_REFEREE_PROVIDER is set, if disabled', async () => {
    const { deps, mockSpy, fixtureSpy, anthropicSpy } = spyDeps();
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_PROVIDER: 'mock' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    expect(mockSpy).not.toHaveBeenCalled();
    expect(fixtureSpy).not.toHaveBeenCalled();
    expect(anthropicSpy).not.toHaveBeenCalled();
  });

  it('does not invoke the anthropic provider even when SEMANTIC_REFEREE_PROVIDER is anthropic, if disabled', async () => {
    const { deps, anthropicSpy } = spyDeps();
    // Disabled + provider explicitly anthropic — the flag short-circuit means
    // the live provider is never reached, so ANTHROPIC_API_KEY is never read.
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_PROVIDER: 'anthropic' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('disabled');
    expect(anthropicSpy).not.toHaveBeenCalled();
  });
});

describe('disabled-by-default — flag on, provider runs', () => {
  it('invokes the mock provider exactly once when enabled with the default provider', async () => {
    const { deps, mockSpy, fixtureSpy, anthropicSpy } = spyDeps();
    const outcome = await classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true' },
      deps,
    );
    expect(outcome.enabled).toBe(true);
    expect(mockSpy).toHaveBeenCalledTimes(1);
    expect(fixtureSpy).not.toHaveBeenCalled();
    expect(anthropicSpy).not.toHaveBeenCalled();
  });
});
