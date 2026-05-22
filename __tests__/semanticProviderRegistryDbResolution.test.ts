/**
 * ADMIN-AI-001 — `classifyWithConfiguredProvider` DB > env > code resolution.
 *
 * `providers.ts` imports `npm:zod@4` transitively (via `schema.ts`), so Jest
 * cannot `require()` `classifyWithConfiguredProvider` itself — exactly the
 * `adminSchemas.test.ts` situation. This suite proves the resolution precedence
 * two ways:
 *
 *  1. BEHAVIOUR — it replicates the EXACT resolution body of
 *     `classifyWithConfiguredProvider` (the `if (resolved.source === 'db')`
 *     branch) using the two REAL zod-free pieces the function composes:
 *     `resolveSemanticRefereeConfig` (the DB layer) and `classifyWithProvider`
 *     (the routing core) — both loaded via the Jest bridge. The replica is the
 *     load-bearing assertion: DB wins over env; db_unavailable falls through
 *     to env; the env branch's `?? 'mock'` still governs.
 *
 *  2. SOURCE — it scans the real `providers.ts` to prove the shipped file
 *     wires those two pieces in that exact order, with the env branch
 *     byte-for-byte unchanged (doctrine constraint #1).
 *
 * If `classifyWithConfiguredProvider`'s real body and this replica ever
 * diverge, the source-scan assertions fail.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  resolveSemanticRefereeConfig,
  classifyWithProvider,
  runMockClassifier,
  runFixtureClassifier,
} from './_helpers/semanticRefereeDeno';
import type {
  ResolvedProviderConfig,
  ProviderResult,
  SemanticRefereeEnv,
  SemanticRefereeProviderDeps,
} from './_helpers/semanticRefereeDeno';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

type RpcResult = { data: unknown; error: unknown };

function makeRequest(): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A move body.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'hash-1',
  };
}

function clientResolving(result: RpcResult) {
  return { rpc: async (_fn: string): Promise<RpcResult> => result };
}

function spyDeps(): SemanticRefereeProviderDeps {
  return {
    runMock: jest.fn(runMockClassifier),
    runFixture: jest.fn(runFixtureClassifier),
    runAnthropic: jest.fn<Promise<ProviderResult>, [ClassifyMoveRequest]>(
      async () => ({ kind: 'unavailable', reason: 'key_missing' }),
    ),
  };
}

/**
 * The EXACT resolution body of `classifyWithConfiguredProvider` from
 * `providers.ts` — `env` is built from the DB result when `source === 'db'`,
 * otherwise from the injected `denoEnv` (the verbatim env path). `denoEnv`
 * stands in for `Deno.env.get(...)` — `undefined` for an unset var.
 */
async function resolveAndRoute(
  resolved: ResolvedProviderConfig,
  denoEnv: { enabled?: string; provider?: string },
  deps: SemanticRefereeProviderDeps,
) {
  let env: SemanticRefereeEnv;
  if (resolved.source === 'db') {
    env = {
      SEMANTIC_REFEREE_ENABLED: resolved.enabled ? 'true' : 'false',
      SEMANTIC_REFEREE_PROVIDER: resolved.providerMode,
    };
  } else {
    env = {
      SEMANTIC_REFEREE_ENABLED: denoEnv.enabled ?? undefined,
      SEMANTIC_REFEREE_PROVIDER: denoEnv.provider ?? undefined,
    };
  }
  return classifyWithProvider(makeRequest(), env, deps);
}

// ── 1. Behaviour — DB resolution precedence ──────────────────────

describe('ADMIN-AI-001 resolution — DB wins over env', () => {
  it('DB anthropic + enabled:true beats env mock → routing receives anthropic', async () => {
    const deps = spyDeps();
    const resolved = await resolveSemanticRefereeConfig(
      clientResolving({ data: [{ provider_mode: 'anthropic', enabled: true }], error: null }),
    );
    await resolveAndRoute(resolved, { enabled: 'true', provider: 'mock' }, deps);
    // DB said anthropic → runAnthropic ran, runMock did not.
    expect(deps.runAnthropic).toHaveBeenCalledTimes(1);
    expect(deps.runMock).not.toHaveBeenCalled();
  });

  it('DB mock beats env anthropic → routing receives mock', async () => {
    const deps = spyDeps();
    const resolved = await resolveSemanticRefereeConfig(
      clientResolving({ data: [{ provider_mode: 'mock', enabled: true }], error: null }),
    );
    const outcome = await resolveAndRoute(
      resolved,
      { enabled: 'true', provider: 'anthropic' },
      deps,
    );
    expect(outcome.enabled).toBe(true);
    if (outcome.enabled) expect(outcome.packet.provider).toBe('mock');
    expect(deps.runMock).toHaveBeenCalledTimes(1);
    expect(deps.runAnthropic).not.toHaveBeenCalled();
  });

  it('DB enabled:false → outcome { enabled:false, reason:disabled } regardless of env', async () => {
    const deps = spyDeps();
    const resolved = await resolveSemanticRefereeConfig(
      clientResolving({ data: [{ provider_mode: 'anthropic', enabled: false }], error: null }),
    );
    const outcome = await resolveAndRoute(
      resolved,
      { enabled: 'true', provider: 'anthropic' },
      deps,
    );
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('disabled');
    // The disabled-by-default check fires before any provider — none invoked.
    expect(deps.runMock).not.toHaveBeenCalled();
    expect(deps.runAnthropic).not.toHaveBeenCalled();
  });

  it('DB mcp → routing returns the not_implemented stub', async () => {
    const deps = spyDeps();
    const resolved = await resolveSemanticRefereeConfig(
      clientResolving({ data: [{ provider_mode: 'mcp', enabled: true }], error: null }),
    );
    const outcome = await resolveAndRoute(resolved, {}, deps);
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_implemented');
  });
});

describe('ADMIN-AI-001 resolution — db_unavailable falls through to env', () => {
  it('db_unavailable + env anthropic → routing receives anthropic (env branch)', async () => {
    const deps = spyDeps();
    const resolved = await resolveSemanticRefereeConfig(
      clientResolving({ data: null, error: { message: 'rpc failed' } }),
    );
    expect(resolved.source).toBe('db_unavailable');
    await resolveAndRoute(resolved, { enabled: 'true', provider: 'anthropic' }, deps);
    expect(deps.runAnthropic).toHaveBeenCalledTimes(1);
  });

  it('db_unavailable + env fixture → routing receives fixture (env branch verbatim)', async () => {
    const deps = spyDeps();
    const resolved = await resolveSemanticRefereeConfig(
      clientResolving({ data: [], error: null }),
    );
    const outcome = await resolveAndRoute(
      resolved,
      { enabled: 'true', provider: 'fixture' },
      deps,
    );
    expect(outcome.enabled).toBe(true);
    expect(deps.runFixture).toHaveBeenCalledTimes(1);
  });

  it('db_unavailable + env provider UNSET → mock (the `?? mock` fallback still governs)', async () => {
    // THE LOAD-BEARING REGRESSION: when the DB is unavailable and the env var
    // is unset, the routing core's `?? 'mock'` must still pick mock. This is
    // doctrine constraint #1 — the env branch's code fallback is unchanged.
    const deps = spyDeps();
    const resolved = await resolveSemanticRefereeConfig(
      clientResolving({ data: null, error: null }),
    );
    expect(resolved.source).toBe('db_unavailable');
    const outcome = await resolveAndRoute(resolved, { enabled: 'true' }, deps);
    expect(outcome.enabled).toBe(true);
    if (outcome.enabled) expect(outcome.packet.provider).toBe('mock');
    expect(deps.runMock).toHaveBeenCalledTimes(1);
  });

  it('db_unavailable + env ENABLED unset → disabled (env deploy gate still applies)', async () => {
    const deps = spyDeps();
    const resolved = await resolveSemanticRefereeConfig(
      clientResolving({ data: null, error: { message: 'down' } }),
    );
    const outcome = await resolveAndRoute(resolved, {}, deps);
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('disabled');
  });
});

// ── 2. Source — providers.ts wires the two pieces in that exact order ──

describe('providers.ts — the shipped file wires DB resolution above env', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/_shared/semanticReferee/providers.ts'),
    'utf8',
  );

  it('classifyWithConfiguredProvider takes the caller-scoped client parameter', () => {
    expect(src).toMatch(
      /classifyWithConfiguredProvider\(\s*request: ClassifyMoveRequest,\s*client: ReturnType<typeof createCallerClient>,/,
    );
  });

  it('it calls resolveSemanticRefereeConfig(client) — the DB layer first', () => {
    expect(src).toContain("import { resolveSemanticRefereeConfig } from './runtimeConfig.ts'");
    expect(src).toMatch(/const resolved = await resolveSemanticRefereeConfig\(client\);/);
  });

  it('the DB branch builds env from resolved.enabled + resolved.providerMode', () => {
    expect(src).toMatch(/resolved\.source === 'db'/);
    expect(src).toMatch(/SEMANTIC_REFEREE_ENABLED: resolved\.enabled \? 'true' : 'false'/);
    expect(src).toMatch(/SEMANTIC_REFEREE_PROVIDER: resolved\.providerMode/);
  });

  it('the db_unavailable branch keeps the EXISTING Deno.env path verbatim', () => {
    expect(src).toMatch(
      /SEMANTIC_REFEREE_ENABLED: Deno\.env\.get\('SEMANTIC_REFEREE_ENABLED'\) \?\? undefined/,
    );
    expect(src).toMatch(
      /SEMANTIC_REFEREE_PROVIDER: Deno\.env\.get\('SEMANTIC_REFEREE_PROVIDER'\) \?\? undefined/,
    );
  });

  it('it still routes via classifyWithProvider + validateOrFallback (unchanged tail)', () => {
    expect(src).toMatch(/classifyWithProvider\(request, env, DEFAULT_PROVIDER_DEPS\)/);
    expect(src).toMatch(/validateOrFallback\(request, outcome\.packet\)/);
  });
});

describe('providerRoutingCore.ts — the `?? mock` code fallback is unchanged', () => {
  it('still reads `env.SEMANTIC_REFEREE_PROVIDER ?? \'mock\'` (doctrine constraint #1)', () => {
    const core = fs.readFileSync(
      path.join(
        process.cwd(),
        'supabase/functions/_shared/semanticReferee/providerRoutingCore.ts',
      ),
      'utf8',
    );
    expect(core).toMatch(/env\.SEMANTIC_REFEREE_PROVIDER \?\? 'mock'/);
  });
});
