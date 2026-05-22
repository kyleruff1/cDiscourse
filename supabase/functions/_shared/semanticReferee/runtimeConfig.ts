/**
 * ADMIN-AI-001 — Semantic referee runtime-config resolver (Deno-side).
 *
 * The DB layer of the provider-resolution hierarchy:
 *
 *   1. THIS resolver — reads the persisted admin runtime config via the
 *      SECURITY DEFINER RPC `get_semantic_referee_runtime_config()`.
 *   2. `SEMANTIC_REFEREE_PROVIDER` env var (the existing MCP-016 lookup, with
 *      its `?? 'mock'` code fallback — UNCHANGED, lives in
 *      `providerRoutingCore.ts`).
 *   3. Code fallback `mock`.
 *
 * `classifyWithConfiguredProvider` (in `providers.ts`) calls
 * `resolveSemanticRefereeConfig` first; if it returns a usable DB result the
 * DB is the runtime source of truth, otherwise the caller falls through to the
 * env path verbatim.
 *
 * NEVER throws. Any failure — rpc error, empty result, a thrown rpc
 * (network), an unexpected result shape, or an unknown `provider_mode` value —
 * returns `{ source: 'db_unavailable' }` so the caller falls through to env.
 * A corrupt row never silently picks a provider. This is doctrine constraint
 * #4 (provider resolution never throws to the client) at the DB layer.
 *
 * Zod-free on purpose: it does a `.rpc()` call and shape-checks the result by
 * hand, so the Jest bridge (`_helpers/semanticRefereeDeno.ts`) can `require()`
 * it and exercise the real logic. Imports nothing from `npm:` and reads no
 * `Deno.env` key — the only env reads in the semantic-referee tree stay
 * `SEMANTIC_REFEREE_ENABLED` / `SEMANTIC_REFEREE_PROVIDER` (in `providers.ts`).
 */
import type { createCallerClient } from '../supabaseClients.ts';

/**
 * The four config provider slots. This is the runtime *mode* union — distinct
 * from `types.ts`'s `SemanticProvider` (the packet `provider` field). It
 * mirrors the `CHECK` constraint on
 * `public.semantic_referee_runtime_config.provider_mode`.
 */
export type SemanticProviderMode = 'anthropic' | 'mock' | 'fixture' | 'mcp';

/** The four known modes, used to reject a corrupt `provider_mode` value. */
export const SEMANTIC_PROVIDER_MODES: readonly SemanticProviderMode[] = [
  'anthropic',
  'mock',
  'fixture',
  'mcp',
];

/**
 * The resolved DB-layer config.
 *
 * - `{ source: 'db', enabled, providerMode }` — a clean read of the singleton
 *   row. The DB is the runtime source of truth.
 * - `{ source: 'db_unavailable' }` — the DB read failed in some way; the
 *   caller MUST fall through to the env-var layer.
 */
export type ResolvedProviderConfig =
  | { source: 'db'; enabled: boolean; providerMode: SemanticProviderMode }
  | { source: 'db_unavailable' };

/** A `provider_mode` string is usable only if it is one of the four modes. */
function isKnownProviderMode(value: unknown): value is SemanticProviderMode {
  return (
    typeof value === 'string' &&
    (SEMANTIC_PROVIDER_MODES as readonly string[]).includes(value)
  );
}

/**
 * Read the persisted runtime config via the SECURITY DEFINER RPC.
 *
 * NEVER throws. Any failure (rpc error / empty / thrown / unexpected shape /
 * unknown provider_mode value) returns `{ source: 'db_unavailable' }` so the
 * caller falls through to the env-var layer.
 *
 * @param client a Supabase client — the caller-scoped (RLS) client from
 *   `semantic-referee/index.ts`. The RPC is SECURITY DEFINER, so the
 *   caller-scoped client can read the singleton even though the table's RLS
 *   restricts direct SELECT to admins.
 */
export async function resolveSemanticRefereeConfig(
  client: ReturnType<typeof createCallerClient>,
): Promise<ResolvedProviderConfig> {
  try {
    const { data, error } = await client.rpc('get_semantic_referee_runtime_config');

    // An rpc error — RLS / function missing / SQL error — falls through.
    if (error) {
      return { source: 'db_unavailable' };
    }

    // The RPC `RETURNS TABLE (...)`, so a clean call yields an array of rows.
    // Empty array / null / a non-array result → no usable row → fall through.
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      return { source: 'db_unavailable' };
    }

    const row = rows[0] as { provider_mode?: unknown; enabled?: unknown };

    // A corrupt / unknown provider_mode never picks a phantom provider — it
    // falls through to env rather than guessing.
    if (!isKnownProviderMode(row.provider_mode)) {
      return { source: 'db_unavailable' };
    }
    if (typeof row.enabled !== 'boolean') {
      return { source: 'db_unavailable' };
    }

    return {
      source: 'db',
      enabled: row.enabled,
      providerMode: row.provider_mode,
    };
  } catch {
    // A thrown rpc (network failure, unexpected client behavior) — the whole
    // body is wrapped so the resolver NEVER throws out. This is the guard for
    // doctrine constraint #4.
    return { source: 'db_unavailable' };
  }
}
