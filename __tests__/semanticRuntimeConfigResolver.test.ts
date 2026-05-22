/**
 * ADMIN-AI-001 — `resolveSemanticRefereeConfig` (the DB-config resolver).
 *
 * Exercised via the `_helpers/semanticRefereeDeno.ts` Jest bridge, which
 * `require()`s the real zod-free `runtimeConfig.ts`. The resolver calls
 * `client.rpc('get_semantic_referee_runtime_config')`; every test passes a
 * hand-built fake client with a `.rpc()` stub.
 *
 * Coverage bar (test-discipline): the happy path plus EVERY failure case.
 * The resolver must NEVER throw — any failure returns
 * `{ source: 'db_unavailable' }` so the caller falls through to env. The
 * "rpc throws" case is the doctrine-constraint-#4 guard.
 */
import {
  resolveSemanticRefereeConfig,
  SEMANTIC_PROVIDER_MODES,
} from './_helpers/semanticRefereeDeno';
import type { ResolvedProviderConfig } from './_helpers/semanticRefereeDeno';

type RpcResult = { data: unknown; error: unknown };

/** A fake Supabase client whose `.rpc()` resolves to a fixed result. */
function clientResolving(result: RpcResult) {
  return {
    rpc: async (_fn: string): Promise<RpcResult> => result,
  };
}

/** A fake client whose `.rpc()` rejects (a thrown network failure). */
function clientThrowing(err: unknown) {
  return {
    rpc: async (_fn: string): Promise<RpcResult> => {
      throw err;
    },
  };
}

describe('resolveSemanticRefereeConfig — happy path', () => {
  it('a valid row { provider_mode: anthropic, enabled: true } resolves to source=db', async () => {
    const out = await resolveSemanticRefereeConfig(
      clientResolving({
        data: [{ provider_mode: 'anthropic', enabled: true, updated_at: '2026-05-22T00:00:00Z' }],
        error: null,
      }),
    );
    expect(out).toEqual<ResolvedProviderConfig>({
      source: 'db',
      enabled: true,
      providerMode: 'anthropic',
    });
  });

  it('an enabled:false row resolves to source=db with enabled false', async () => {
    const out = await resolveSemanticRefereeConfig(
      clientResolving({
        data: [{ provider_mode: 'mock', enabled: false, updated_at: null }],
        error: null,
      }),
    );
    expect(out).toEqual<ResolvedProviderConfig>({
      source: 'db',
      enabled: false,
      providerMode: 'mock',
    });
  });

  it('resolves each of the four known provider modes', async () => {
    for (const mode of SEMANTIC_PROVIDER_MODES) {
      const out = await resolveSemanticRefereeConfig(
        clientResolving({ data: [{ provider_mode: mode, enabled: true }], error: null }),
      );
      expect(out).toEqual({ source: 'db', enabled: true, providerMode: mode });
    }
  });
});

describe('resolveSemanticRefereeConfig — failure cases all return db_unavailable', () => {
  it('an rpc error → db_unavailable', async () => {
    const out = await resolveSemanticRefereeConfig(
      clientResolving({ data: null, error: { message: 'rpc failed' } }),
    );
    expect(out).toEqual({ source: 'db_unavailable' });
  });

  it('an empty data array → db_unavailable (singleton row missing)', async () => {
    const out = await resolveSemanticRefereeConfig(
      clientResolving({ data: [], error: null }),
    );
    expect(out).toEqual({ source: 'db_unavailable' });
  });

  it('null data → db_unavailable', async () => {
    const out = await resolveSemanticRefereeConfig(
      clientResolving({ data: null, error: null }),
    );
    expect(out).toEqual({ source: 'db_unavailable' });
  });

  it('a non-array data result → db_unavailable', async () => {
    const out = await resolveSemanticRefereeConfig(
      clientResolving({ data: { provider_mode: 'mock', enabled: true }, error: null }),
    );
    expect(out).toEqual({ source: 'db_unavailable' });
  });

  it('an unknown provider_mode string → db_unavailable (no phantom provider)', async () => {
    const out = await resolveSemanticRefereeConfig(
      clientResolving({
        data: [{ provider_mode: 'some_corrupt_value', enabled: true }],
        error: null,
      }),
    );
    expect(out).toEqual({ source: 'db_unavailable' });
  });

  it('a missing provider_mode → db_unavailable', async () => {
    const out = await resolveSemanticRefereeConfig(
      clientResolving({ data: [{ enabled: true }], error: null }),
    );
    expect(out).toEqual({ source: 'db_unavailable' });
  });

  it('a non-boolean enabled → db_unavailable', async () => {
    const out = await resolveSemanticRefereeConfig(
      clientResolving({ data: [{ provider_mode: 'mock', enabled: 'true' }], error: null }),
    );
    expect(out).toEqual({ source: 'db_unavailable' });
  });
});

describe('resolveSemanticRefereeConfig — NEVER throws (doctrine constraint #4)', () => {
  it('a thrown rpc (network failure) → db_unavailable, no exception escapes', async () => {
    const out = await resolveSemanticRefereeConfig(
      clientThrowing(new Error('network down')),
    );
    expect(out).toEqual({ source: 'db_unavailable' });
  });

  it('a non-Error thrown value → db_unavailable', async () => {
    const out = await resolveSemanticRefereeConfig(clientThrowing('boom'));
    expect(out).toEqual({ source: 'db_unavailable' });
  });

  it('resolving never rejects — only ever resolves to a ResolvedProviderConfig', async () => {
    // A client whose rpc itself is missing would throw a TypeError inside the
    // resolver body — still caught and turned into db_unavailable.
    const brokenClient = {} as { rpc: (fn: string) => Promise<RpcResult> };
    await expect(resolveSemanticRefereeConfig(brokenClient)).resolves.toEqual({
      source: 'db_unavailable',
    });
  });
});
