/**
 * MCP-016 — Semantic referee disabled-by-default boundary tests.
 *
 * The dominant path: `SEMANTIC_REFEREE_ENABLED` unset / empty / not exactly
 * `'true'` → `{ enabled: false, reason: 'disabled' }` AND no provider function
 * is invoked. The disabled check happens BEFORE any provider is selected — this
 * suite asserts that with a provider spy.
 *
 * Tests import the pure routing core (`providerRouting.ts`, zod-free) — env and
 * provider functions are injected, so no `Deno` and no live call is needed.
 */
import {
  classifyWithProvider,
  runMockClassifier,
  runFixtureClassifier,
} from './_helpers/semanticRefereeDeno';
import type { SemanticRefereeProviderDeps } from './_helpers/semanticRefereeDeno';
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
} {
  const mockSpy = jest.fn(runMockClassifier);
  const fixtureSpy = jest.fn(runFixtureClassifier);
  return {
    deps: { runMock: mockSpy, runFixture: fixtureSpy },
    mockSpy,
    fixtureSpy,
  };
}

describe('disabled-by-default — flag unset', () => {
  it('returns { enabled: false, reason: disabled } when SEMANTIC_REFEREE_ENABLED is unset', () => {
    const { deps, mockSpy, fixtureSpy } = spyDeps();
    const outcome = classifyWithProvider(makeRequest(), {}, deps);
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('disabled');
    // No provider function was invoked — the flag check happens first.
    expect(mockSpy).not.toHaveBeenCalled();
    expect(fixtureSpy).not.toHaveBeenCalled();
  });

  it('returns disabled when the flag is the empty string', () => {
    const { deps, mockSpy } = spyDeps();
    const outcome = classifyWithProvider(makeRequest(), { SEMANTIC_REFEREE_ENABLED: '' }, deps);
    expect(outcome.enabled).toBe(false);
    expect(mockSpy).not.toHaveBeenCalled();
  });

  it('returns disabled when the flag is the string "false"', () => {
    const { deps, mockSpy } = spyDeps();
    const outcome = classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'false' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('disabled');
    expect(mockSpy).not.toHaveBeenCalled();
  });

  it('returns disabled when the flag is "TRUE" (case-sensitive — only exact "true" enables)', () => {
    const { deps, mockSpy } = spyDeps();
    const outcome = classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'TRUE' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    expect(mockSpy).not.toHaveBeenCalled();
  });

  it('does not select a provider even when SEMANTIC_REFEREE_PROVIDER is set, if disabled', () => {
    const { deps, mockSpy, fixtureSpy } = spyDeps();
    const outcome = classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_PROVIDER: 'mock' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    expect(mockSpy).not.toHaveBeenCalled();
    expect(fixtureSpy).not.toHaveBeenCalled();
  });
});

describe('disabled-by-default — flag on, provider runs', () => {
  it('invokes the mock provider exactly once when enabled with the default provider', () => {
    const { deps, mockSpy, fixtureSpy } = spyDeps();
    const outcome = classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true' },
      deps,
    );
    expect(outcome.enabled).toBe(true);
    expect(mockSpy).toHaveBeenCalledTimes(1);
    expect(fixtureSpy).not.toHaveBeenCalled();
  });
});
