/**
 * MCP-016 — Semantic referee provider registry routing tests.
 *
 * Asserts the doctrine-critical routing rules:
 *   - flag on, provider UNSET → defaults to `mock` (the deliberate deviation
 *     from `languageProcessing/providers.ts`, which defaults to `anthropic`);
 *   - `mock` / `fixture` are wired;
 *   - `anthropic` / `mcp` are STUBS → `{ enabled: false, reason: not_implemented }`;
 *   - an unknown provider value → `{ enabled: false, reason: not_configured }`.
 *
 * Plus a source-scan asserting the registry has no `anthropicProvider` /
 * `mcpAdapter` module behind the stubbed slots.
 */
import * as fs from 'fs';
import * as path from 'path';
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
    requestedClassifiers: ['responds_to_parent', 'narrows_claim'],
    contentHash: 'hash-1',
  };
}

function spyDeps(): {
  deps: SemanticRefereeProviderDeps;
  mockSpy: jest.Mock;
  fixtureSpy: jest.Mock;
} {
  const mockSpy = jest.fn(runMockClassifier);
  const fixtureSpy = jest.fn(runFixtureClassifier);
  return { deps: { runMock: mockSpy, runFixture: fixtureSpy }, mockSpy, fixtureSpy };
}

describe('provider registry — default is mock', () => {
  it('routes to mock when the flag is on and the provider is unset (doctrine default)', () => {
    const { deps, mockSpy, fixtureSpy } = spyDeps();
    const outcome = classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true' },
      deps,
    );
    expect(outcome.enabled).toBe(true);
    if (outcome.enabled) expect(outcome.packet.provider).toBe('mock');
    expect(mockSpy).toHaveBeenCalledTimes(1);
    expect(fixtureSpy).not.toHaveBeenCalled();
  });

  it('routes to mock when SEMANTIC_REFEREE_PROVIDER is explicitly "mock"', () => {
    const { deps, mockSpy } = spyDeps();
    const outcome = classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'mock' },
      deps,
    );
    expect(outcome.enabled).toBe(true);
    expect(mockSpy).toHaveBeenCalledTimes(1);
  });
});

describe('provider registry — fixture provider', () => {
  it('routes to the fixture provider when SEMANTIC_REFEREE_PROVIDER is "fixture"', () => {
    const { deps, mockSpy, fixtureSpy } = spyDeps();
    const outcome = classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'fixture' },
      deps,
    );
    expect(outcome.enabled).toBe(true);
    expect(fixtureSpy).toHaveBeenCalledTimes(1);
    expect(mockSpy).not.toHaveBeenCalled();
  });
});

describe('provider registry — anthropic and mcp slots are stubbed off', () => {
  it('returns { enabled: false, reason: not_implemented } for provider "anthropic"', () => {
    const { deps, mockSpy, fixtureSpy } = spyDeps();
    const outcome = classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'anthropic' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_implemented');
    // The stub is a literal return — no provider function is invoked.
    expect(mockSpy).not.toHaveBeenCalled();
    expect(fixtureSpy).not.toHaveBeenCalled();
  });

  it('returns { enabled: false, reason: not_implemented } for provider "mcp"', () => {
    const { deps, mockSpy } = spyDeps();
    const outcome = classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'mcp' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_implemented');
    expect(mockSpy).not.toHaveBeenCalled();
  });
});

describe('provider registry — unknown provider value', () => {
  it('returns { enabled: false, reason: not_configured } for an unknown provider name', () => {
    const { deps, mockSpy } = spyDeps();
    const outcome = classifyWithProvider(
      makeRequest(),
      { SEMANTIC_REFEREE_ENABLED: 'true', SEMANTIC_REFEREE_PROVIDER: 'some_unknown_provider' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_configured');
    expect(mockSpy).not.toHaveBeenCalled();
  });
});

describe('provider registry — no module behind the stubbed slots', () => {
  const sharedDir = path.join(process.cwd(), 'supabase/functions/_shared/semanticReferee');

  /** Collect every `import ... from '...'` specifier from a source file. */
  function importSpecifiers(src: string): string[] {
    return Array.from(src.matchAll(/from\s+['"]([^'"]+)['"]/g)).map((m) => m[1]);
  }

  it('no anthropicProvider.ts file exists in the _shared/semanticReferee tree', () => {
    expect(fs.existsSync(path.join(sharedDir, 'anthropicProvider.ts'))).toBe(false);
  });

  it('no mcpAdapter.ts file exists in the _shared/semanticReferee tree', () => {
    expect(fs.existsSync(path.join(sharedDir, 'mcpAdapter.ts'))).toBe(false);
  });

  it('providerRouting.ts imports no anthropic / mcp provider module', () => {
    const src = fs.readFileSync(path.join(sharedDir, 'providerRouting.ts'), 'utf8');
    // The comments may NAME the stubbed-file paths for documentation — the
    // assertion is about IMPORTS: no import specifier resolves to either file.
    for (const spec of importSpecifiers(src)) {
      expect(spec).not.toMatch(/anthropicProvider/);
      expect(spec).not.toMatch(/mcpAdapter/);
    }
    // The anthropic / mcp slots are literal not_implemented returns.
    expect(src).toMatch(/reason:\s*'not_implemented'/);
  });

  it('providers.ts imports no anthropic / mcp provider module', () => {
    const src = fs.readFileSync(path.join(sharedDir, 'providers.ts'), 'utf8');
    for (const spec of importSpecifiers(src)) {
      expect(spec).not.toMatch(/anthropicProvider/);
      expect(spec).not.toMatch(/mcpAdapter/);
    }
  });
});
