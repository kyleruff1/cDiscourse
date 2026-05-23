# ADMIN-AI-001 — Admin runtime provider-mode switch for the semantic referee

**Status:** Design draft
**Epic:** Epic 12 — Rules UX (MCP semantic-referee roadmap expansion; canonical label `epic:rules-ux`)
**Release:** 6.9+ (Phase E follow-up — sits directly on top of MCP-016 / MCP-017)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/225
**Branch:** `feat/ADMIN-AI-001-admin-runtime-provider-mode-switch-for-t`

**Builds directly on (merged):**

- **MCP-016** (`docs/designs/MCP-016.md`) — the `semantic-referee` Edge Function boundary, the provider registry (`providers.ts` / `providerRouting.ts` / `providerRoutingCore.ts`), the disabled-by-default contract, the deterministic `mock` / `fixture` providers, `buildFallbackPacket`, `validateOrFallback`.
- **MCP-017** (`docs/designs/MCP-017.md`) — the live `anthropic` provider (`anthropicProvider.ts`), the typed-`ProviderUnavailable` failure contract, the `ClassifyMoveDisabledReason` widening, the `providerRoutingCore.ts` extraction. The `anthropic` provider exists and is live on the dev project.

**Reuses the admin pattern (merged):** `admin-users` Edge Function (`supabase/functions/admin-users/index.ts`), `_shared/adminAuth.ts` (`requireAdmin`), `_shared/adminAudit.ts` (`writeAdminAudit`, `sanitizePayload`, `WHITELISTED_ACTIONS`), `_shared/adminSchemas.ts` (the zod discriminated-union request schema), `src/features/admin/adminApi.ts` + `src/features/admin/types.ts`, the `is_admin()` SQL helper and the `admin_audit_events` table (migration `20260516000007`).

---

## Goal (one paragraph)

ADMIN-AI-001 makes the semantic-referee provider mode an **admin-controlled runtime setting**. Today `SEMANTIC_REFEREE_PROVIDER` is a Supabase function env var: changing it from `mock` to `anthropic` (or back) requires `npx supabase secrets set` and a function cold start — an operator-only, terminal-only action. This card moves the *runtime source of truth* to a persisted admin DB setting so an authenticated admin can switch the effective provider mode — `anthropic` / `mock` / `fixture` (and a reserved-but-disabled `mcp` slot) — from the Admin UI with **no env-var edit, no redeploy, and no code change**. The card adds (1) a strongly-typed singleton runtime-config table + an append-only audit table, both RLS-protected (admins only, normal users locked out entirely); (2) a narrow `SECURITY DEFINER` SQL function exposing only the safe runtime fields to the `semantic-referee` Edge Function — never secrets, never admin emails, never audit history; (3) a new resolution layer inside `providers.ts` that reads the persisted config **above** the existing env-var lookup; (4) a read+write surface in the existing `admin-users` Edge Function; (5) an Admin UI tab. The design is shaped by hard doctrine constraints that are reviewer blockers: the provider resolution **never throws to the client** (DB read failure falls through to env, env invalid falls through to the code fallback `mock`, `anthropic`-with-no-key returns MCP-017's typed `unavailable` outcome); the code-level `?? 'mock'` fallback in the registry is **preserved unchanged** — the new DB layer sits *above* env, env keeps its existing `?? 'mock'`; `ANTHROPIC_API_KEY` is never displayed in any UI; no service-role key ever reaches client code; the AI moderator's hard limits (no truth verdicts, advisory-only packets, score never blocks posting) are entirely untouched because this card only chooses *which provider answers*, not *what the answer means*.

## Cannot-proceed check

No conflict found. The operator's product decision (runtime mode = Anthropic; code fallback = Mock; source of truth = persisted admin DB setting; hierarchy = DB > env > code fallback) is fully expressible within the existing MCP-016/MCP-017 architecture without violating any of the 10 cdiscourse-doctrine rules. The design proceeds.

---

## Provider resolution hierarchy

The single resolution rule, top to bottom (first non-null wins):

> **1. Persisted admin runtime config (DB) → 2. `SEMANTIC_REFEREE_PROVIDER` env var → 3. code fallback `mock`.**

Detail:

1. **Persisted admin runtime config (DB).** The `semantic_referee_runtime_config` singleton row. If `enabled = false`, the layer is off (`{ enabled: false, reason: 'disabled' }`) regardless of env. If `enabled = true`, `provider_mode` is the effective provider — *unless* the DB read itself fails (network / RLS / function missing), in which case resolution **falls through to step 2** (never throws).
2. **`SEMANTIC_REFEREE_PROVIDER` env var.** The existing MCP-016 lookup, reached **only** when the DB read failed or returned no row. It keeps its existing `?? 'mock'` fallback **unchanged** — this is doctrine constraint #1.
3. **Code fallback `mock`.** The misconfiguration / DB-unavailable safety path baked into `providerRoutingCore.ts`'s `?? 'mock'`. **Not** a product preference — do NOT change the code default to `anthropic`.

There is no separate emergency hard-off / kill switch today (the card body lists one as item 0 "if one already exists" — it does not). The `enabled` boolean on the config row **is** the runtime off-switch; `SEMANTIC_REFEREE_ENABLED` env stays as the deploy-time off-switch. Both are honored (see Edge cases).

```
                       semantic-referee/index.ts
                                  │ await classifyWithConfiguredProvider(request)
                                  ▼
              _shared/semanticReferee/providers.ts
                                  │
       ┌── NEW: resolveProviderConfig(callerClient | serviceClient) ──┐
       │  1. SELECT public.get_semantic_referee_runtime_config()       │
       │       ├─ row found, enabled=false → { source:'db',           │
       │       │     enabled:false }                                  │
       │       ├─ row found, enabled=true  → { source:'db',           │
       │       │     enabled:true, provider: row.provider_mode }      │
       │       └─ read FAILS / no row      → fall through ▼            │
       │  2. Deno.env SEMANTIC_REFEREE_ENABLED / _PROVIDER            │
       │       └─ existing MCP-016 path, env `?? 'mock'` UNCHANGED    │
       └──────────────────────────────────────────────────────────────┘
                                  ▼
              classifyWithProvider(request, resolvedEnv, DEFAULT_PROVIDER_DEPS)
                                  ▼   (existing MCP-016/017 routing core — UNCHANGED)
                       mock / fixture / anthropic / mcp(stub)
                                  ▼
              validateOrFallback(...)  →  ok(outcome)  (HTTP 200 always)
```

---

## Operator-resolved design decisions

The five decision points from the operator addendum, resolved:

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Singleton config table vs key/value app-settings table | **New singleton table `semantic_referee_runtime_config`** | No canonical app-settings table exists (`grep` of `supabase/migrations/` for `app_settings` / `app_config` / `runtime_config` → 0 hits). A strongly-typed single-row table with a `CHECK` constraint on `provider_mode` is safer than a stringly-typed KV store and the card body explicitly calls for "a strongly-typed runtime config (singleton)". |
| 2 | RLS direct table update vs admin Edge Function | **Admin Edge Function — new actions on the existing `admin-users` function** | The established repo convention: *every* admin mutation in this codebase goes through `admin-users` with `requireAdmin` + `writeAdminAudit` (users, blocks, bot registry — none use RLS-direct admin writes from the client). Following it gives server-side admin enforcement, the confirmation-gate refine, and a guaranteed audit row per change. The DB still has RLS as defense-in-depth (admin-only), but the *write path* is the function. |
| 3 | DB seed value (`anthropic` vs `mock`) | **Seed `provider_mode = 'anthropic'`, `enabled = true`** | Operator preference, and MCP-017 is already merged + live on the dev/test project — seeding `anthropic` makes the dev/test project's desired runtime state (card body: "Desired runtime mode after this card (dev/test): `anthropic`") the immediate post-migration state with zero extra operator action. The *code* fallback stays `mock` (unchanged) — only the *seed row* is `anthropic`. A production project that wants a conservative start flips the row to `mock` via the UI (one click) after deploy. |
| 4 | Edge Function cache strategy | **Read on every invocation (no in-memory cache)** | Recommended simple path. The config read is one indexed single-row `SELECT` of a SECURITY DEFINER function — sub-millisecond. An in-memory cache would need cross-invocation invalidation reasoning (Edge Function instances are ephemeral and independent; a TTL cache means a switch can take up to TTL seconds to propagate, which contradicts the card's "switch with no redeploy" instant-rollback promise). The latency profile does not demand a cache. If a future profiling pass shows the read is hot, a short documented TTL cache is a clean follow-up — explicitly out of scope here. |
| 5 | `mcp` shown disabled vs hidden in the UI | **Shown disabled, labelled "Coming later (MCP-018)"** | Recommended. Admins should see the slot exists so the roadmap is legible; a disabled control with a "Coming later" label communicates intent without offering a non-functional choice. Selecting it is impossible from the UI; if the DB row somehow held `mcp` the registry returns the existing `{ enabled: false, reason: 'not_implemented' }` stub. |

---

## Data model

### New table — `public.semantic_referee_runtime_config` (singleton)

Singleton enforced by a one-row `CHECK` on a fixed primary key. Strongly typed: `provider_mode` is a `CHECK`-constrained text column (not a free string).

```sql
CREATE TABLE public.semantic_referee_runtime_config (
  -- Singleton guard: the PK is pinned to a single literal value.
  id              boolean     PRIMARY KEY DEFAULT true CHECK (id = true),
  provider_mode   text        NOT NULL DEFAULT 'anthropic'
                              CHECK (provider_mode IN ('anthropic', 'mock', 'fixture', 'mcp')),
  enabled         boolean     NOT NULL DEFAULT true,
  updated_by      uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

- `id boolean PRIMARY KEY DEFAULT true CHECK (id = true)` — the canonical Postgres singleton pattern: only one row can ever exist (a second insert collides on the PK). The Edge Function always reads "the" row.
- `provider_mode` — the four registry slots. `CHECK` mirrors `ALL_SEMANTIC_PROVIDERS` semantics; the migration comment names the source of truth.
- `enabled` — runtime off-switch. `false` → the layer is disabled regardless of `provider_mode` or env.
- `updated_by` — the admin who last changed it (for the UI "last changed by" line; resolved to a display name, never an email).
- **Seed:** the migration inserts exactly one row `{ id: true, provider_mode: 'anthropic', enabled: true }` (decision #3).

### New table — `public.semantic_referee_config_audit` (append-only)

A dedicated audit table for provider-mode changes. Rationale for a dedicated table rather than reusing `admin_audit_events`: `admin_audit_events.action` is governed by a whitelist of *user-management* actions and its rows are keyed on `target_user_id`; a provider-mode change has no target user and a distinct shape (old → new mode). A dedicated table keeps the config history queryable independently and keeps `admin_audit_events` semantically clean. (The card body explicitly asks for "a runtime config (singleton) table **+ an audit table**".)

```sql
CREATE TABLE public.semantic_referee_config_audit (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id    uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_mode    text        NULL,        -- null on the very first change
  new_mode         text        NOT NULL,
  previous_enabled boolean     NULL,
  new_enabled      boolean     NOT NULL,
  reason           text        NULL,        -- optional admin-supplied note
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

- Insert-only. SELECT for admins. **No UPDATE, no DELETE policy at all** — the audit-table pattern from `supabase-edge-contract` and `admin_audit_events`.
- Stores codes, not prose, and **no secrets / no emails / no API-key state** — the audit row records *which mode*, never *whether a key is present*.

### New SQL function — `public.get_semantic_referee_runtime_config()` (`SECURITY DEFINER`, locked `search_path`)

The narrow read surface the Edge Function calls. Returns **only** the three safe runtime fields — never `updated_by`, never audit history, never anything secret.

```sql
CREATE OR REPLACE FUNCTION public.get_semantic_referee_runtime_config()
RETURNS TABLE (provider_mode text, enabled boolean, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT provider_mode, enabled, updated_at
  FROM public.semantic_referee_runtime_config
  WHERE id = true
$$;
```

- `SECURITY DEFINER` + `SET search_path = public` — exactly the `is_admin()` pattern in migration `20260516000007`. Locked search_path blocks the privilege-escalation footgun.
- `RETURNS TABLE (...)` returns the **three safe fields only**. There is no overload that returns `updated_by` or audit rows.
- `REVOKE ALL ... FROM PUBLIC` then `GRANT EXECUTE ... TO authenticated, service_role` — the Edge Function reaches it via the caller-scoped client (authenticated) **or** the service-role client (see "API / interface contracts" for which client and why). Because it is `SECURITY DEFINER` it reads the row even though the table's RLS otherwise restricts SELECT to admins — this is deliberate and safe: the function exposes only non-sensitive runtime state and is the *only* way a non-admin-context read happens.

### Migration discipline

One new migration file: `supabase/migrations/20260522000011_admin_ai_001_semantic_referee_runtime_config.sql` (next sequential UTC-timestamp number after `20260521000010_qol042_argument_room_links.sql`). It is self-contained: creates both tables, the function, all RLS policies, all indexes, and the single seed row. Append-only — no existing migration is edited.

---

## File changes

### New files

- **`supabase/migrations/20260522000011_admin_ai_001_semantic_referee_runtime_config.sql`** — the migration above: two tables, `get_semantic_referee_runtime_config()`, RLS policies, indexes, the seed row. ~130 lines.

- **`supabase/functions/_shared/semanticReferee/runtimeConfig.ts`** — the **Deno-side config resolver**. Exports `resolveSemanticRefereeConfig(client): Promise<ResolvedProviderConfig>` (signature below). Calls `client.rpc('get_semantic_referee_runtime_config')`; on a clean read returns `{ source: 'db', enabled, providerMode }`; on **any** failure (rpc error, empty result, thrown) returns `{ source: 'db_unavailable' }` so the caller knows to fall through to env. **Never throws.** Zod-free (it does a `.rpc()` call and shape-checks the result by hand), so it can be Jest-bridged. ~75 lines. Imports only `types.ts` for the provider-mode union.

- **`supabase/functions/_shared/adminSemanticConfigSchemas.ts`** — zod schemas (`npm:zod@4`) for the two new `admin-users` actions: `GetSemanticConfigSchema` and `SetSemanticConfigSchema`. Kept in a small dedicated file (not appended to `adminSchemas.ts`) so the `semantic-referee` config concern is co-located and the existing `adminSchemas.ts` discriminated union is extended by *import*, not by bloating one file. Exports the two schemas + their inferred types + a `SEMANTIC_PROVIDER_MODES` const array. ~55 lines. **See "API / interface contracts" for the confirmation-gate `.refine()`.**

- **`src/features/admin/AdminSemanticRefereeTab.tsx`** — the new Admin UI tab. Read-only status card (effective mode + config source + last-changed-by + last-changed-at + an optional "Anthropic key present" boolean if the safe status field is wired — see Edge cases), a provider-mode selector (`anthropic` / `mock` / `fixture` enabled; `mcp` disabled + "Coming later (MCP-018)"), an `enabled` toggle, and the two confirmation flows (Anthropic-switch confirm dialog; one-click Mock rollback). Pure RN primitives (`View` / `Text` / `Pressable` / `ActivityIndicator`) — no new dependency. ~260 lines. **See "API / interface contracts" and "Edge cases" for the confirmation + a11y contract.**

- **`src/features/admin/semanticRefereeConfigApi.ts`** — the typed client wrapper. `adminGetSemanticRefereeConfig()` and `adminSetSemanticRefereeConfig(input)`, thin pass-throughs over `adminUsers({ action: ... })`, mirroring `adminApi.ts` exactly. Also exports a pure helper `requiresProviderConfirmation(nextMode)` (returns `true` for `anthropic`) so the UI and a test share one rule. ~70 lines.

- **`docs/deployment/admin-ai-001-provider-mode-runbook.md`** — operator runbook: `db push` for the migration, `functions deploy admin-users` + `functions deploy semantic-referee`, how to verify the seed row, how the DB > env > code hierarchy behaves, and the rollback (UI one-click to Mock, or SQL `UPDATE` of the singleton row in a break-glass scenario). ~150 lines.

### Modified files

- **`supabase/functions/_shared/semanticReferee/providers.ts`** — the heart of the change. `classifyWithConfiguredProvider` currently reads `Deno.env` directly and calls the routing core. It is changed to: (1) accept a Supabase client parameter (the caller-scoped client from `index.ts`); (2) `await resolveSemanticRefereeConfig(client)`; (3) if the resolver returns a usable DB result, build the `SemanticRefereeEnv` object from it (`SEMANTIC_REFEREE_ENABLED` ← `enabled ? 'true' : 'false'`, `SEMANTIC_REFEREE_PROVIDER` ← `providerMode`); (4) if the resolver returned `db_unavailable`, build the `SemanticRefereeEnv` from `Deno.env` **exactly as today** — the existing env path is kept verbatim, including its reliance on `providerRoutingCore.ts`'s `?? 'mock'`. The routing-core call, `validateOrFallback`, and the never-throw guarantee are unchanged. **`Deno.env.get` for `SEMANTIC_REFEREE_ENABLED` / `_PROVIDER` stays in this file** as the fallback branch — it is not deleted. ~+35 lines, 0 deleted.

- **`supabase/functions/semantic-referee/index.ts`** — `classifyWithConfiguredProvider` now needs the caller-scoped client. The function already builds `callerClient` for the room-RLS check (line 52); pass it: `await classifyWithConfiguredProvider(redactedInput, callerClient)`. The `try/catch` around the call is unchanged (belt-and-suspenders; the resolver never throws). ~2 lines changed.

- **`supabase/functions/admin-users/index.ts`** — add two cases to the action `switch`: `get_semantic_config` and `set_semantic_config`, each delegating to a new handler (`handleGetSemanticConfig` / `handleSetSemanticConfig`) below the existing handlers. The handlers use the already-resolved `serviceClient` (post-`requireAdmin`) to read/update the singleton row and insert the audit row. ~+75 lines. Nothing existing changes — purely additive cases + handlers.

- **`supabase/functions/_shared/adminSchemas.ts`** — add `GetSemanticConfigSchema` and `SetSemanticConfigSchema` (imported from the new `adminSemanticConfigSchemas.ts`) into the `AdminUsersRequestSchema` discriminated union array. ~+3 lines (two array entries + one import line).

- **`supabase/functions/_shared/adminAudit.ts`** — add `'get_semantic_config'` and `'set_semantic_config'` to `WHITELISTED_ACTIONS` so `isWhitelistedAction` accepts them (the action gate in `admin-users/index.ts` rejects un-whitelisted actions). ~+2 lines. Note: the *change-history* audit row goes into the new `semantic_referee_config_audit` table; `admin-users` still also writes a generic `admin_audit_events` row via `writeAdminAudit` for action-traffic visibility (the existing pattern — every action writes one). The whitelist addition is required for that generic row.

- **`src/lib/edgeFunctions.ts`** — add `'get_semantic_config'` and `'set_semantic_config'` to the `AdminUsersAction` union, and add the result/response interfaces (`SemanticRefereeConfigView`, `SetSemanticRefereeConfigInput`). The `adminUsers` wrapper itself is generic and unchanged. ~+25 lines.

- **`src/features/admin/types.ts`** — add `'semantic_referee'` to the `AdminTab` union and `ADMIN_TAB_LABELS` (label: `'Semantic Referee'`). Add the `SemanticRefereeConfigView` UI type (or re-export it from `edgeFunctions.ts`). ~+5 lines.

- **`src/features/admin/AdminScreen.tsx`** — add `'semantic_referee'` to the `TABS` array and the conditional render (`{tab === 'semantic_referee' && <AdminSemanticRefereeTab />}`). ~+3 lines.

- **`src/features/admin/index.ts`** — export `AdminSemanticRefereeTab` + the config API (mirrors the existing barrel). ~+2 lines.

- **`docs/core/current-status.md`** — new card status block + the updated test count (implementer fills in the real number after `npm run test`). ~+10 lines.

- **`CLAUDE.md`** — update the "Current stage" line per the stage-completion convention (the implementer does this only if the stage convention requires it for this card; if the card lands as a Phase-E follow-up without a stage bump, leave `CLAUDE.md` untouched). ~+1 line or 0.

### Deleted files

- None.

### Files deliberately NOT touched

- `providerRoutingCore.ts`, `providerRouting.ts` — the routing switch and `DEFAULT_PROVIDER_DEPS` are unchanged. The `?? 'mock'` fallback in `providerRoutingCore.ts` stays **byte-identical** (doctrine constraint #1). The new DB layer feeds the *input* to `classifyWithProvider`; it does not change the switch.
- `anthropicProvider.ts`, `anthropicClassifierCore.ts`, `seedPrompt.ts`, `contentSafetyScan.ts`, `schema.ts`, `mockProvider.ts`, `fixtureProvider.ts`, `redaction.ts`, `types.ts` — the provider implementations and the contract are untouched. (`types.ts`'s `ALL_SEMANTIC_PROVIDERS` is *read* by the new schema's mode list conceptually, but the union itself does not change.)
- `process-language-draft/` and its provider — unrelated; not modified.
- `src/lib/constitution/engine.ts` — untouched; this card adds no import to it.

---

## API / interface contracts

### Deno resolver — `resolveSemanticRefereeConfig`

```ts
// supabase/functions/_shared/semanticReferee/runtimeConfig.ts
import type { createCallerClient } from '../supabaseClients.ts';

export type SemanticProviderMode = 'anthropic' | 'mock' | 'fixture' | 'mcp';

export type ResolvedProviderConfig =
  | { source: 'db'; enabled: boolean; providerMode: SemanticProviderMode }
  | { source: 'db_unavailable' };  // caller MUST fall through to env

/**
 * Read the persisted runtime config via the SECURITY DEFINER RPC.
 * NEVER throws. Any failure (rpc error / empty / thrown / unexpected shape /
 * unknown provider_mode value) returns `{ source: 'db_unavailable' }` so the
 * caller falls through to the env-var layer.
 */
export async function resolveSemanticRefereeConfig(
  client: ReturnType<typeof createCallerClient>,
): Promise<ResolvedProviderConfig>;
```

Behavior:

- Calls `client.rpc('get_semantic_referee_runtime_config')`.
- `{ data, error }` → if `error`, or `data` is empty/`null`, or the first row's `provider_mode` is not one of the four known modes → `{ source: 'db_unavailable' }`.
- A `try/catch` wraps the whole body — a thrown rpc (network) → `{ source: 'db_unavailable' }`.
- On success → `{ source: 'db', enabled: row.enabled, providerMode: row.provider_mode }`.
- An unknown `provider_mode` string is treated as `db_unavailable` (fall through to env) rather than guessing — a corrupt row never silently picks a provider.

### Registry entry — `classifyWithConfiguredProvider` (modified signature)

```ts
// supabase/functions/_shared/semanticReferee/providers.ts
export async function classifyWithConfiguredProvider(
  request: ClassifyMoveRequest,
  client: ReturnType<typeof createCallerClient>,   // NEW PARAMETER
): Promise<ClassifyMoveOutcome>;
```

Resolution body (replaces the current direct `Deno.env` read):

```ts
const resolved = await resolveSemanticRefereeConfig(client);

let env: SemanticRefereeEnv;
if (resolved.source === 'db') {
  // DB is the runtime source of truth.
  env = {
    SEMANTIC_REFEREE_ENABLED: resolved.enabled ? 'true' : 'false',
    SEMANTIC_REFEREE_PROVIDER: resolved.providerMode,
  };
} else {
  // DB unavailable — fall through to the EXISTING env path, verbatim.
  // The env `?? 'mock'` lives in providerRoutingCore.ts and is UNCHANGED.
  env = {
    SEMANTIC_REFEREE_ENABLED: Deno.env.get('SEMANTIC_REFEREE_ENABLED') ?? undefined,
    SEMANTIC_REFEREE_PROVIDER: Deno.env.get('SEMANTIC_REFEREE_PROVIDER') ?? undefined,
  };
}

const outcome = await classifyWithProvider(request, env, DEFAULT_PROVIDER_DEPS);
if (!outcome.enabled) return outcome;
return { enabled: true, packet: validateOrFallback(request, outcome.packet) };
```

The routing core, `validateOrFallback`, and the never-throw guarantee are **identical to MCP-017**. The only change is *where the `SemanticRefereeEnv` comes from*.

**Note on the SECURITY DEFINER read via the caller-scoped client:** the `semantic-referee` Edge Function builds only a caller-scoped (RLS) client and must not build a service-role client (MCP-016 doctrine — no privileged write). `get_semantic_referee_runtime_config()` is `SECURITY DEFINER`, so the caller-scoped client can execute it and read the singleton row even though the table's RLS restricts direct SELECT to admins. This is the intended design: the function exposes only non-sensitive runtime state, and it is the *single* controlled read path. The `semantic-referee` function still builds **no** service-role client and performs **no** write — the config table is read-only from its perspective.

### Admin Edge Function — request schemas

```ts
// supabase/functions/_shared/adminSemanticConfigSchemas.ts
import { z } from 'npm:zod@4';

export const SEMANTIC_PROVIDER_MODES = ['anthropic', 'mock', 'fixture', 'mcp'] as const;

export const GetSemanticConfigSchema = z.object({
  action: z.literal('get_semantic_config'),
});

export const SetSemanticConfigSchema = z.object({
  action: z.literal('set_semantic_config'),
  // 'mcp' is intentionally NOT settable — the slot is reserved for MCP-018.
  providerMode: z.enum(['anthropic', 'mock', 'fixture']),
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
  // Confirmation gate: switching INTO anthropic requires confirmAnthropic=true.
  confirmAnthropic: z.boolean().optional(),
}).refine(
  (d) => d.providerMode !== 'anthropic' || d.confirmAnthropic === true,
  { message: 'confirmAnthropic=true required to switch to the Anthropic provider', path: ['confirmAnthropic'] },
);
```

- `providerMode` on the **write** path is `z.enum(['anthropic','mock','fixture'])` — `mcp` cannot be set even though the table's `CHECK` allows it (the slot is reserved; only MCP-018 enables it). This mirrors `adminSchemas.ts`'s `InviteUser` pattern where `'admin'` is excluded from the invite-role enum for a security reason.
- The `.refine()` enforces the **Anthropic confirmation step server-side** (doctrine constraint #7) — the UI dialog is the UX, this refine is the wall. Switching to `mock` / `fixture` needs no confirmation flag (constraint #8 — Mock is one-click).

### Admin Edge Function — handlers

```ts
// supabase/functions/admin-users/index.ts (new handlers)

async function handleGetSemanticConfig(body, caller, sc): Promise<Response> {
  const { data, error } = await sc
    .from('semantic_referee_runtime_config')
    .select('provider_mode, enabled, updated_at, updated_by')
    .eq('id', true)
    .maybeSingle();
  if (error) return internalError(error.message);

  // Resolve updated_by → a display name (NEVER an email).
  let updatedByName: string | null = null;
  if (data?.updated_by) {
    const { data: prof } = await sc
      .from('profiles').select('display_name').eq('id', data.updated_by).maybeSingle();
    updatedByName = prof?.display_name ?? null;
  }

  // Optional, SAFE Anthropic-key status: a boolean only, never the value.
  // anthropicKeyPresent = Boolean(Deno.env.get('ANTHROPIC_API_KEY'))
  const anthropicKeyPresent = Boolean(Deno.env.get('ANTHROPIC_API_KEY'));

  await writeAdminAudit({ actorUserId: caller.userId, action: 'get_semantic_config', payload: {} });

  return ok({
    providerMode: data?.provider_mode ?? 'anthropic',
    enabled: data?.enabled ?? true,
    updatedAt: data?.updatedAt ?? null,
    updatedByDisplayName: updatedByName,
    anthropicKeyPresent,            // boolean ONLY — see doctrine constraint #2
  });
}

async function handleSetSemanticConfig(body, caller, sc): Promise<Response> {
  // 1. Read the current row for the audit "previous" fields.
  const { data: prev } = await sc
    .from('semantic_referee_runtime_config')
    .select('provider_mode, enabled').eq('id', true).maybeSingle();

  // 2. Update the singleton.
  const { data: updated, error: updErr } = await sc
    .from('semantic_referee_runtime_config')
    .update({
      provider_mode: body.providerMode,
      enabled: body.enabled,
      updated_by: caller.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true)
    .select('provider_mode, enabled, updated_at')
    .single();
  if (updErr) return internalError(updErr.message);

  // 3. Append the dedicated config-audit row (never blocks the result).
  await sc.from('semantic_referee_config_audit').insert({
    actor_user_id: caller.userId,
    previous_mode: prev?.provider_mode ?? null,
    new_mode: body.providerMode,
    previous_enabled: prev?.enabled ?? null,
    new_enabled: body.enabled,
    reason: body.reason ?? null,
  });

  // 4. Generic admin-traffic audit row (existing pattern).
  await writeAdminAudit({
    actorUserId: caller.userId,
    action: 'set_semantic_config',
    reason: body.reason,
    payload: { providerMode: body.providerMode, enabled: body.enabled },
  });

  return ok({ providerMode: updated.provider_mode, enabled: updated.enabled, updatedAt: updated.updated_at });
}
```

### Client wrapper + response types

```ts
// src/lib/edgeFunctions.ts (additions)
export interface SemanticRefereeConfigView {
  providerMode: 'anthropic' | 'mock' | 'fixture' | 'mcp';
  enabled: boolean;
  updatedAt: string | null;
  updatedByDisplayName: string | null;
  anthropicKeyPresent: boolean;       // boolean ONLY — never the key value
}
export interface SetSemanticRefereeConfigInput {
  providerMode: 'anthropic' | 'mock' | 'fixture';
  enabled: boolean;
  reason?: string;
  confirmAnthropic?: boolean;
}
```

```ts
// src/features/admin/semanticRefereeConfigApi.ts
export async function adminGetSemanticRefereeConfig():
  Promise<AdminUsersResult<SemanticRefereeConfigView>> {
  return adminUsers({ action: 'get_semantic_config' });
}
export async function adminSetSemanticRefereeConfig(input: SetSemanticRefereeConfigInput):
  Promise<AdminUsersResult<{ providerMode: string; enabled: boolean; updatedAt: string }>> {
  return adminUsers({ action: 'set_semantic_config', ...input });
}
/** Shared rule: switching INTO anthropic needs a confirmation step. */
export function requiresProviderConfirmation(nextMode: string): boolean {
  return nextMode === 'anthropic';
}
```

### RLS policy text

```sql
-- semantic_referee_runtime_config — admin read + admin update; no insert/delete
-- policy for clients (the seed row is the only row; service_role bypasses RLS
-- for the Edge Function update).
ALTER TABLE public.semantic_referee_runtime_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "semantic_referee_runtime_config: admins can select"
  ON public.semantic_referee_runtime_config
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "semantic_referee_runtime_config: admins can update"
  ON public.semantic_referee_runtime_config
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
-- No INSERT policy: the singleton row is created by the migration seed only.
-- No DELETE policy: the row is permanent.

-- semantic_referee_config_audit — append-only; admin SELECT; admin INSERT
-- (defense-in-depth; real inserts go through admin-users with service_role).
ALTER TABLE public.semantic_referee_config_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "semantic_referee_config_audit: admins can select"
  ON public.semantic_referee_config_audit
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "semantic_referee_config_audit: admins can insert"
  ON public.semantic_referee_config_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
-- No UPDATE, no DELETE policy at all — audit history is immutable.
```

Normal (non-admin) users have **zero** policies granting them access to either table — RLS denies by default, so they cannot read or write either one. The only non-admin read path is the `SECURITY DEFINER` function, which exposes only the three safe runtime fields.

### Indexes

```sql
CREATE INDEX semantic_referee_config_audit_created_idx
  ON public.semantic_referee_config_audit (created_at DESC);
```

The config table is a single row — no index needed beyond the PK.

### `admin-users` JWT / auth

Unchanged. The two new actions ride the existing `admin-users` pipeline: `verify_jwt = true` in `config.toml` (already present, line 387), `requireAdmin(req)` (JWT verify via caller-scoped client → `profiles.role = 'admin'` via service-role client), `isWhitelistedAction` gate, then the handler. No caller-scoped bypass; no custom header escape hatch.

---

## Edge cases

The implementer must handle every one:

- **DB read fails (network / RPC error / function not yet deployed).** `resolveSemanticRefereeConfig` returns `{ source: 'db_unavailable' }`; `classifyWithConfiguredProvider` falls through to the `Deno.env` path **verbatim**. The user sees a working classify (env or `mock`), never an error. This is the central never-throw path.
- **Singleton row missing** (migration ran but seed somehow absent; or a future project where the table exists empty). The `SECURITY DEFINER` function returns an empty result → resolver → `db_unavailable` → env fallback. No crash.
- **`provider_mode` holds an unknown / corrupt value.** Resolver treats it as `db_unavailable` → env fallback. A corrupt row never picks a phantom provider.
- **`enabled = false` in the DB.** Resolver returns `{ source: 'db', enabled: false }`; `classifyWithConfiguredProvider` sets `SEMANTIC_REFEREE_ENABLED='false'`; the routing core's first check (`!== 'true'`) returns `{ enabled: false, reason: 'disabled' }`, HTTP 200. The runtime off-switch works.
- **DB says `enabled = true`, `provider_mode = 'anthropic'`, but `ANTHROPIC_API_KEY` is not set.** The routing core routes to `runAnthropicClassifier`, which returns MCP-017's typed `{ kind: 'unavailable', reason: 'key_missing' }`; the core maps it to `{ enabled: false, reason: 'key_missing' }`, HTTP 200. The caller falls back to layer 1. **The admin chose `anthropic` but the deploy lacks the key — the system degrades gracefully, exactly as MCP-017 specified. No exception, no broken room.** (The UI's `anthropicKeyPresent: false` boolean is the admin's signal that this will happen — see the a11y/UI section.)
- **DB says `anthropic`, env says `mock`.** DB wins (it is the runtime source of truth). The env value is *only* consulted when the DB read fails. This is the whole point of the card.
- **`SEMANTIC_REFEREE_ENABLED` env unset, DB `enabled = true`.** DB wins — the layer is on. The env flag is the *deploy-time* default; the DB row is the *runtime* state. (When the DB is reachable, the env `SEMANTIC_REFEREE_ENABLED` is not even read.)
- **`mcp` selected.** Not settable from the UI (`z.enum` excludes it on the write path) and the UI control is disabled. If the DB row somehow held `mcp` (manual SQL), the routing core returns the existing `{ enabled: false, reason: 'not_implemented' }` stub. No crash.
- **Concurrent admin edits.** Two admins switch the mode at the same instant. The `UPDATE ... WHERE id = true` is a single-row atomic write — last write wins; both produce an audit row recording their `previous → new` pair. No lock needed; the config is a single scalar choice, not a mergeable document. The UI re-fetches after a write so each admin sees the settled state.
- **Non-admin calls `get_semantic_config` / `set_semantic_config`.** `requireAdmin` returns 403 before any handler runs. A non-admin who calls the `SECURITY DEFINER` RPC directly gets only the three safe runtime fields — no secret, no audit, no `updated_by` — which is harmless (and is exactly what the `semantic-referee` function itself reads).
- **Permission-denied on the RLS direct read.** A non-admin's caller-scoped client `.from('semantic_referee_runtime_config').select()` returns zero rows (RLS), not an error — but no client code does this; the only read is the `SECURITY DEFINER` RPC and the admin Edge Function. Documented for completeness.
- **Confirmation bypass attempt.** A client calls `set_semantic_config` with `providerMode: 'anthropic'` and no `confirmAnthropic`. The zod `.refine()` rejects it → HTTP 422 `validation_failed`. The server is the wall; the dialog is the UX.
- **Switch to Mock while a classify is mid-flight.** The mid-flight call already resolved its config at its own invocation start; it completes with the old mode. The *next* invocation reads the new row. No in-memory cache means there is no stale-cache window — the next call is immediately correct. This is the latency argument for "read every invocation" (decision #4).
- **Migration applied but Edge Functions not yet redeployed.** The old `admin-users` lacks the two new actions → `isWhitelistedAction` returns false → `badRequest('unknown_action')`; the UI shows an actionable error. The old `semantic-referee` still reads `Deno.env` (its pre-card behavior) — safe. The runbook's deploy ordering (migration → both functions) prevents this in practice.
- **Doctrine edge case — "can the admin make the AI decide who's right?"** No. The admin chooses *which provider answers* (`mock` / `anthropic` / `fixture`). Every provider's output still flows through MCP-016's `.strict()` `SemanticRefereePacketSchema` (`authoritative: z.literal(false)`, no `block` field, no truth field) and MCP-017's `contentSafetyScan`. Switching to `anthropic` cannot widen the contract or grant the packet verdict authority — that is structurally impossible regardless of provider.
- **Doctrine edge case — "does the provider mode affect the score / standing bands?"** No. The provider mode chooses the *source* of advisory routing/friction suggestions. It does not touch `argumentScoreModel`, the strength bands, `antiAmplification.ts`, or any scoring path. Score still never blocks posting; `submit-argument` is untouched.

---

## Test plan

All tests are mock/bridge/fixture-driven — **no test makes a live Anthropic call, no test hits a real DB** (DB interaction is tested by mocking the Supabase client's `.rpc()` / `.from()` per the repo convention, e.g. `adminApi.test.ts`, `semanticEdgeAuth.test.ts`). Coverage bar (`test-discipline`): every new public function has a happy-path **and** failure-case test.

- **`__tests__/semanticRuntimeConfigResolver.test.ts`** — `resolveSemanticRefereeConfig` (bridged via `_helpers/semanticRefereeDeno.ts`, which gains a `require()` re-export for `runtimeConfig.ts`):
  - rpc returns a valid row `{ provider_mode: 'anthropic', enabled: true }` → `{ source: 'db', enabled: true, providerMode: 'anthropic' }`.
  - rpc returns `{ enabled: false }` → `{ source: 'db', enabled: false }`.
  - rpc returns an `error` → `{ source: 'db_unavailable' }`.
  - rpc returns empty `data` → `{ source: 'db_unavailable' }`.
  - rpc returns an unknown `provider_mode` string → `{ source: 'db_unavailable' }` (no phantom provider).
  - rpc **throws** (mocked `.rpc` rejecting) → `{ source: 'db_unavailable' }` — never throws out.
- **`__tests__/semanticProviderRegistryDbResolution.test.ts`** — `classifyWithConfiguredProvider` resolution precedence, with a mocked client + a mocked/stubbed `Deno.env`:
  - DB resolves `anthropic` + `enabled:true`, env says `mock` → routing receives `provider:'anthropic'` (DB wins).
  - DB resolves `enabled:false` → outcome `{ enabled: false, reason: 'disabled' }` regardless of env.
  - DB resolver returns `db_unavailable` → the env path is taken; env unset → `mock` (proves the `?? 'mock'` fallback still governs the env branch — the load-bearing regression).
  - DB resolver returns `db_unavailable` and `SEMANTIC_REFEREE_PROVIDER=fixture` env → `fixture` (env branch verbatim).
  - The resolver never throwing → `classifyWithConfiguredProvider` never throwing.
- **`__tests__/semanticProviderRegistry.test.ts`** (existing) — the MCP-016 "default is mock" test and the MCP-017 routing tests **must keep passing**. The routing *core* (`classifyWithProvider`) is unchanged, so they should pass untouched. The implementer confirms — if `classifyWithConfiguredProvider`'s new signature breaks a test that called it directly, the test is updated to pass the mocked client; no assertion about routing is dropped.
- **`__tests__/adminSemanticConfigSchemas.test.ts`** — re-declared-local-zod mirror (the `adminSchemas.test.ts` convention, since the schema file imports `npm:zod@4`):
  - `GetSemanticConfigSchema` accepts `{ action: 'get_semantic_config' }`.
  - `SetSemanticConfigSchema` accepts `mock` / `fixture` with `enabled` and no confirm flag.
  - rejects `providerMode: 'mcp'` on the write path (enum excludes it).
  - rejects `providerMode: 'anthropic'` **without** `confirmAnthropic: true` (the `.refine()`).
  - accepts `providerMode: 'anthropic'` **with** `confirmAnthropic: true`.
  - rejects an unknown `providerMode`, a missing `enabled`, an over-length `reason`.
- **`__tests__/adminSecurity.test.ts`** (extend the existing admin-security suite) — assert `'get_semantic_config'` and `'set_semantic_config'` are in `WHITELISTED_ACTIONS`; assert the `admin-users` action `switch` has a case for each (source scan); assert neither handler builds a caller-scoped bypass.
- **`__tests__/semanticRefereeConfigApi.test.ts`** — the client wrapper (mocked `adminUsers`):
  - `adminGetSemanticRefereeConfig` calls `adminUsers` with `{ action: 'get_semantic_config' }`.
  - `adminSetSemanticRefereeConfig` forwards `providerMode` / `enabled` / `reason` / `confirmAnthropic`.
  - `requiresProviderConfirmation('anthropic')` → `true`; `('mock')` / `('fixture')` → `false`.
- **`__tests__/AdminSemanticRefereeTab.test.tsx`** — RN Testing Library:
  - renders the current mode + source from a mocked `adminGetSemanticRefereeConfig`.
  - selecting `anthropic` opens the confirmation dialog; confirming calls `adminSetSemanticRefereeConfig` with `confirmAnthropic: true`.
  - selecting `mock` switches **without** a dialog (one-click rollback).
  - the `mcp` control is rendered **disabled** with the "Coming later" label and selecting it does nothing.
  - the tab never renders the `ANTHROPIC_API_KEY` value — only the `anthropicKeyPresent` boolean as "Anthropic key present: Yes/No".
  - loading / error / success states each render an actionable surface.
- **`__tests__/adminSemanticConfigBanList.test.ts`** — doctrine ban-list scan. Every user-facing string the tab and the API can render (mode labels, the confirmation-dialog copy, the status copy, the "Coming later" label, error messages) is scanned for verdict / truth tokens: `winner`, `loser`, `won`, `lost`, `right`, `wrong`, `true`, `false`, `correct`, `incorrect`, `liar`, `dishonest`, `bad faith`, `manipulative`, `propagandist`, `extremist`. Zero matches. (ADMIN-AI-001 adds user-facing strings → this scan is mandatory per `test-discipline`.)
- **`__tests__/adminSemanticConfigSecretScan.test.ts`** — source scan: `grep` of `src/features/admin/AdminSemanticRefereeTab.tsx` + `semanticRefereeConfigApi.ts` for `ANTHROPIC_API_KEY` / `SERVICE_ROLE` → zero matches; the tab never references an env-var key value; no `sk-ant-` / `sb_secret_` literal anywhere in the new client files. Also assert `Deno.env.get('ANTHROPIC_API_KEY')` appears only inside Edge Function files, never `src/`.
- **Migration sanity** — local `npx supabase db reset` runs the new migration cleanly; `npx supabase db lint` passes. (Operator/local-only — the implementer runs it locally if Docker is up; CI-time coverage is the schema/RLS shape asserted indirectly by the resolver tests against the documented contract.)
- **Edge Function integration** (`__tests__/semanticEdgeAuthRuntimeConfig.test.ts`, marked the same way MCP-016's `semanticEdgeAuth.test.ts` is marked — local `supabase functions serve`) — the `semantic-referee` function with a DB row of `enabled:true, provider:'mock'` returns a `provider:'mock'` packet; with `enabled:false` returns `{ enabled:false, reason:'disabled' }`; with the RPC stubbed to fail, falls through to env. Optional if `functions serve` is unavailable in CI — the resolver + registry unit tests are the CI-time coverage.

Test count must go **up**; the implementer captures the new total after `npm run test` and records it in `docs/core/current-status.md`.

---

## Dependencies (cards / docs / files)

- **Assumes MCP-016 is complete** — the `semantic-referee` Edge Function, `providers.ts`, `providerRoutingCore.ts`, the registry, the disabled-by-default contract, `validateOrFallback`, `buildFallbackPacket` all exist. This card modifies `providers.ts` and `semantic-referee/index.ts`; it cannot proceed without them. Merged.
- **Assumes MCP-017 is complete and deployed** — the live `anthropic` provider (`anthropicProvider.ts`), the typed `ProviderUnavailable` failure contract, the `key_missing` reason, the `ClassifyMoveDisabledReason` widening. Without it, switching to `anthropic` would have no live provider to route to. Merged + live on the dev project (per the card body and CLAUDE.md MCP-017 line).
- **Reads / extends the admin pattern** — `admin-users/index.ts` (the action switch + handler convention), `_shared/adminAuth.ts` `requireAdmin`, `_shared/adminAudit.ts` `writeAdminAudit` + `WHITELISTED_ACTIONS`, `_shared/adminSchemas.ts` `AdminUsersRequestSchema`, `src/features/admin/adminApi.ts`, `src/features/admin/types.ts`, `AdminScreen.tsx`. This card adds to all of them following the existing shape.
- **Reads the SQL admin pattern** — `is_admin()` and `admin_audit_events` from migration `20260516000007`. The new migration uses `is_admin()` in its RLS policies and copies the `SECURITY DEFINER` + locked-`search_path` shape.
- **Blocks nothing hard.** MCP-018 (#224, the operator-hosted MCP adapter) is independent — it un-stubs the `mcp` provider slot; once it lands, a one-line change to the write-path `z.enum` in `adminSemanticConfigSchemas.ts` (`'mcp'` added) and removing the UI's `disabled` flag makes `mcp` selectable. This card deliberately ships `mcp` disabled so the slot is visible but inert until #224.
- Skills consulted: `cdiscourse-doctrine`, `supabase-edge-contract`, `test-discipline`, and the repo admin-RLS / admin-auth pattern (inspected directly in `supabase/functions/admin-users/` + `_shared/adminAuth.ts` + `_shared/adminAudit.ts` + migration `20260516000007`).

---

## Risks

- **Forgetting that `classifyWithConfiguredProvider`'s signature changed.** Adding the `client` parameter is a breaking signature change; `semantic-referee/index.ts` is the only caller and must be updated in the same card. Any test that calls `classifyWithConfiguredProvider` directly must pass a mocked client. `tsc` catches the call-site; the implementer must not paper over it with `any`.
- **Accidentally deleting the env `?? 'mock'` fallback.** Doctrine constraint #1. The new DB layer adds a branch *above* env; the env branch — including `providerRoutingCore.ts`'s `?? 'mock'` — must stay byte-identical. The resolver returning `db_unavailable` must route to the *unchanged* env code. A reviewer will diff `providerRoutingCore.ts` and expect **zero** changes to it.
- **The resolver throwing.** If `resolveSemanticRefereeConfig` ever throws (an un-caught rpc rejection), `classifyWithConfiguredProvider` throws, and `index.ts`'s `try/catch` turns it into HTTP 500 — a client-visible hard error, a doctrine #4 violation. The resolver's whole body **must** be inside one `try/catch` returning `db_unavailable` on any throw. The `semanticRuntimeConfigResolver.test.ts` "rpc throws" case is the guard.
- **Migration ordering vs deploy ordering.** If the operator deploys the new `semantic-referee` before running `db push`, the function calls a non-existent RPC → the resolver returns `db_unavailable` → env fallback. Safe, but the runbook must state the order (migration first, then both functions) so the *intended* DB-driven behavior is live immediately.
- **`SECURITY DEFINER` function over-exposing.** The function must `RETURN TABLE (provider_mode, enabled, updated_at)` — three fields, no `updated_by`, no audit. A careless `SELECT *` would leak `updated_by` to any authenticated caller. The migration's explicit column list is the guard; a reviewer checks it.
- **`search_path` not locked on the function.** A `SECURITY DEFINER` function without `SET search_path = public` is a privilege-escalation footgun (doctrine constraint #6). The migration must include `SET search_path = public` — copied from `is_admin()`.
- **Anthropic-key status leaking more than a boolean.** `handleGetSemanticConfig` may return `anthropicKeyPresent: boolean` — and **only** that. It must never return the key, a prefix, a length, or a masked form. If the implementer is unsure, omitting the field entirely is acceptable (the card body and doctrine constraint #2 both allow "otherwise omit entirely"). The `adminSemanticConfigSecretScan.test.ts` enforces no key reference in `src/`.
- **`adminSchemas.ts` discriminated-union growth.** Adding two members to `AdminUsersRequestSchema` is mechanical, but the discriminated union must stay exhaustive — the `admin-users/index.ts` `switch` is not `default`-cased on purpose (TypeScript exhaustiveness). The two new `case`s are required or `tsc` fails. This is a feature, not a risk, but the implementer must add both.
- **RN Testing Library async** — the tab fetches config on mount; the test must `await` the loading→loaded transition (the `AdminCreateUserForm.test.tsx` / `adminMetadataEventsTab.test.tsx` pattern). Not a new risk; just follow the existing tab tests.
- **`mcp` settable by mistake.** The table `CHECK` allows `mcp` (so MCP-018 needs no migration), but the write-path `z.enum` must exclude it. If the implementer copies the table's four-mode list into the write schema, `mcp` becomes settable before MCP-018 exists. The write schema is `z.enum(['anthropic','mock','fixture'])` — three modes — deliberately.

---

## Out of scope

ADMIN-AI-001 explicitly does **not** include:

- **The Anthropic provider itself** — that is MCP-017 (#221), merged + deployed. This card only chooses *when* `anthropic` is the runtime provider.
- **The operator-hosted MCP-server adapter** — that is MCP-018 (#224). The `mcp` slot ships visible-but-disabled; un-stubbing it is #224's job.
- **An in-memory config cache in the Edge Function** — decision #4 is "read every invocation". A short TTL cache is a possible future profiling-driven follow-up, not this card.
- **A general app-settings / feature-flag framework** — this card builds *one* strongly-typed singleton for *one* setting. A generic settings system is a separate, larger design if ever wanted.
- **Per-room or per-debate provider overrides** — the config is global. Room-scoped provider selection is not in scope.
- **Changing the disabled-by-default *deploy-time* posture** — `SEMANTIC_REFEREE_ENABLED` env stays as the deploy gate; the DB `enabled` boolean is the *runtime* gate. The card adds the runtime gate; it does not remove the deploy gate.
- **Wiring `classifyMove` into a live room surface** — MCP-017's "in-room wiring follow-up" is still a separate card. This card changes *which provider* answers; it does not mount the packet into any new UI.
- **Cost dashboards / spend caps / rate limiting** — MCP-012's gating caps call rate; a cost dashboard is out of scope.
- **Any change to the AI moderator's authority** — no truth verdicts, no auto-hide, no `authoritative: true`, score never blocks posting — all unchanged; this card cannot affect them.
- **v1-scope-excluded features** — no voting, no winner-producing scoring, no real-time collaborative editing, no OAuth, no public API, no push notifications, no argument search.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 — no truth labels / score never blocks posting:** the card chooses *which provider* produces advisory packets; it does not touch the packet contract. Every provider's output still flows through MCP-016's `.strict()` `SemanticRefereePacketSchema` (`authoritative: z.literal(false)`, no `block` field, no truth field) and MCP-017's `contentSafetyScan`. The provider mode cannot grant the packet verdict authority. `submit-argument` is untouched — score still never blocks posting. `adminSemanticConfigBanList.test.ts` scans every new user-facing string for verdict tokens. ✓
- **cdiscourse-doctrine §1 (operator constraint #1) — the `?? 'mock'` default is preserved:** the new DB resolution layer sits *above* the env lookup. When the DB read fails, `classifyWithConfiguredProvider` routes to the **unchanged** env path; the env `?? 'mock'` fallback in `providerRoutingCore.ts` is byte-identical — a reviewer diffs `providerRoutingCore.ts` and finds zero changes. The code fallback stays `mock`; only the *seed row* is `anthropic`. ✓
- **cdiscourse-doctrine §4 / §7 — AI runs only in Edge Functions:** this card adds no AI call. The live `fetch` stays in `anthropicProvider.ts` (MCP-017). The new code is a DB read (`runtimeConfig.ts`), an admin write (`admin-users` handlers), and an Admin UI tab — no provider call anywhere. The client only calls `supabase.functions.invoke('admin-users')`. ✓
- **cdiscourse-doctrine §4 — provider resolution never throws to the client (operator constraint #4):** `resolveSemanticRefereeConfig` wraps its whole body in `try/catch` and returns `{ source: 'db_unavailable' }` on any failure — rpc error, empty result, throw, unknown mode. `classifyWithConfiguredProvider` then falls through to env; env invalid → code fallback `mock`; `anthropic` mode with no key → MCP-017's typed `unavailable` outcome → HTTP 200. No path produces a client-visible hard error. The `semanticRuntimeConfigResolver.test.ts` "rpc throws" case enforces it. ✓
- **cdiscourse-doctrine §6 — secrets policy (operator constraints #2, #3, #6):** `ANTHROPIC_API_KEY` is **never** displayed — the UI sees only a `anthropicKeyPresent: boolean` (or the field is omitted). No service-role key in client code — the admin write goes through `admin-users` with `requireAdmin`; the `semantic-referee` function builds **no** service-role client. The `SECURITY DEFINER` function has `SET search_path = public` (locked). `adminSemanticConfigSecretScan.test.ts` asserts `grep "ANTHROPIC_API_KEY\|SERVICE_ROLE" src/` → zero. ✓
- **cdiscourse-doctrine §5 — the rules engine is sacred:** `src/lib/constitution/engine.ts` is untouched; this card adds no import to it. ✓
- **cdiscourse-doctrine §8 / supabase-edge-contract — Supabase conventions:** both new tables have RLS enabled; the audit table is append-only with no UPDATE/DELETE policy; the migration is a new sequential file, append-only; no existing migration is edited; the runtime-config singleton is never hard-deleted (no DELETE policy). The admin write path is the Edge Function, not a client-side service-role call. ✓
- **cdiscourse-doctrine §5 (operator constraint #5) — JWT verification stays:** `admin-users` keeps `verify_jwt = true` + `requireAdmin`; the two new actions ride the same auth pipeline; no caller-scoped client bypass. ✓
- **operator constraint #7, #8 — confirmation steps:** switching to Anthropic requires `confirmAnthropic: true`, enforced *server-side* by the zod `.refine()` (the dialog is the UX, the refine is the wall); switching to Mock needs no confirmation flag — one-click rollback. ✓
- **supabase-edge-contract — no direct `public.arguments` insert:** this card writes only to `semantic_referee_runtime_config` and `semantic_referee_config_audit`, never to `public.arguments`; `submit-argument` is untouched. ✓
- **test-discipline — tests are part of done:** the plan covers the resolver (happy + 5 failure cases), the registry resolution precedence, the schemas (incl. the confirmation refine), the client wrapper, the UI tab, the ban-list scan (mandatory — new user-facing strings), the secret source-scan, and migration sanity. Every new public function has happy-path + failure-case tests. Test count goes up; `docs/core/current-status.md` is updated. ✓
- **cdiscourse-doctrine §9 — plain language:** the UI labels (`Anthropic` / `Mock` / `Fixture (dev/test)` / `Coming later (MCP-018)`) are plain; no internal validation code (`source_chain_lexical` etc.) is surfaced; the `provider_mode` codes are mapped to readable labels in the tab. ✓
- **cdiscourse-doctrine §10 — v1 scope:** no voting, no winner-producing scoring, no real-time collaborative editing, no OAuth, no public API, no push, no argument search introduced. ✓

---

## Operator steps (after the implementer commits)

This card produces **code + a migration only**. Claude does not deploy. After the implementation card merges and is reviewed, the operator runs, **in this order**:

1. `npx supabase db push --linked` — applies migration `20260522000011_admin_ai_001_semantic_referee_runtime_config.sql` (creates both tables, the `SECURITY DEFINER` function, the RLS policies, and seeds the singleton row `{ provider_mode: 'anthropic', enabled: true }`).
2. `npx supabase functions deploy admin-users --linked` — ships the two new admin actions (`get_semantic_config`, `set_semantic_config`).
3. `npx supabase functions deploy semantic-referee --linked` — ships the DB-resolution layer in `providers.ts`.
4. **Verify:** `npx supabase db lint` passes; in the Admin UI, open the new **Semantic Referee** tab — it should show effective mode `Anthropic`, config source `DB`. Switch to `Mock` (one click) and back to `Anthropic` (with the confirmation dialog) to confirm the round-trip.

Rollback: in the Admin UI, switch the mode to **Mock** (one click — no redeploy). Break-glass (UI unavailable): `UPDATE public.semantic_referee_runtime_config SET provider_mode = 'mock' WHERE id = true;` via the SQL editor. The full procedure is in `docs/deployment/admin-ai-001-provider-mode-runbook.md`.

The deploy ordering matters: if `semantic-referee` is deployed before `db push`, it falls through to the env-var path (safe, but not yet DB-driven) until the migration lands. Running the migration first makes the DB-driven behavior live the moment both functions are deployed.
