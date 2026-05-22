# ADMIN-AI-001 — Admin runtime provider-mode switch operator runbook

This runbook is for the **human operator** of the CDiscourse Supabase project. It walks through deploying the ADMIN-AI-001 code — the migration plus the two Edge Functions — that turns the `semantic-referee` provider mode into an **admin-controlled runtime setting**.

**The implementer agent does NOT run any `npx supabase` command in this runbook.** ADMIN-AI-001 produced **code + a migration only**. It made **no live Anthropic call**, set **no secret**, and deployed **nothing**. Every numbered step below is operator-runnable; the agent has no execution path here.

This card builds directly on MCP-016 (the boundary) and MCP-017 (the live `anthropic` provider). Both are assumed merged + deployed.

---

## 0. What ADMIN-AI-001 shipped

Today, switching the `semantic-referee` provider mode means editing the `SEMANTIC_REFEREE_PROVIDER` function env var and cold-starting the function — an operator-only, terminal-only action. ADMIN-AI-001 moves the *runtime source of truth* into a persisted admin DB setting so an authenticated admin can switch the effective provider mode from the Admin UI — **no env-var edit, no redeploy, no code change**.

The provider resolution hierarchy, top to bottom (first non-null wins):

> **1. Persisted admin runtime config (DB) → 2. `SEMANTIC_REFEREE_PROVIDER` env var → 3. code fallback `mock`.**

What shipped:

- **Migration `20260522000011_admin_ai_001_semantic_referee_runtime_config.sql`** — creates two RLS-protected tables and one `SECURITY DEFINER` read function, and seeds the singleton config row:
  - `public.semantic_referee_runtime_config` — the strongly-typed singleton (`provider_mode`, `enabled`). RLS: admin SELECT + admin UPDATE only; no INSERT/DELETE policy.
  - `public.semantic_referee_config_audit` — append-only provider-mode change history. RLS: admin SELECT + admin INSERT; no UPDATE/DELETE policy.
  - `public.get_semantic_referee_runtime_config()` — `SECURITY DEFINER`, locked `search_path`, returns only the three safe runtime fields (`provider_mode`, `enabled`, `updated_at`) — never `updated_by`, never audit history, never any secret.
  - **Seed row:** `{ provider_mode: 'anthropic', enabled: true }`.
- **`semantic-referee` Edge Function** — `classifyWithConfiguredProvider` now reads the persisted config first (via the `SECURITY DEFINER` RPC, on the caller-scoped client) and falls through to the env var only if that DB read fails. The env path — including its `?? 'mock'` code fallback — is unchanged.
- **`admin-users` Edge Function** — two new admin actions: `get_semantic_config` (read) and `set_semantic_config` (write). Both ride the existing JWT + `requireAdmin` pipeline.
- **Admin UI** — a new **Semantic Referee** tab.

The **code fallback stays `mock`** — only the *seed row* is `anthropic`. The DB layer sits *above* the env lookup; nothing about the disabled-by-default deploy posture changed.

---

## 1. Prerequisites

Before deploying:

1. **MCP-016 + MCP-017 are merged and deployed.** ADMIN-AI-001 modifies `providers.ts` and `semantic-referee/index.ts` and assumes the boundary + live `anthropic` provider exist.
2. **The branch is merged to `main`** (the operator merges the reviewed PR; the implementer does not push).
3. **An Anthropic API key is set** (`ANTHROPIC_API_KEY` Supabase secret) — *if* you intend the runtime mode to actually be `anthropic`. The seed row is `anthropic`, so the desired dev/test runtime state is live the moment the deploy lands. If the key is **not** set, the referee degrades gracefully (see §5) — no crash, no broken room — but it cannot reach the live provider. The Admin UI shows an "Anthropic key present: No" line in that case.
4. **A cost budget alert configured in the Anthropic dashboard** — ADMIN-AI-001 does not change spend; MCP-017's budget guidance still applies if the runtime mode is `anthropic`.

ADMIN-AI-001 itself sets **no new secret**. `npx supabase secrets set` is *not* part of this runbook — making secret-flipping unnecessary is the whole point of the card.

---

## 2. Deploy — run these in order

The deploy ordering matters. Run the migration **first**, then both functions.

### 2.1 Apply the migration

```bash
npx supabase db push --linked
```

This creates both tables, the `SECURITY DEFINER` function, the RLS policies, the index, and seeds the singleton row `{ provider_mode: 'anthropic', enabled: true }`.

### 2.2 Deploy `admin-users`

```bash
npx supabase functions deploy admin-users --linked
```

Ships the two new admin actions (`get_semantic_config`, `set_semantic_config`).

### 2.3 Deploy `semantic-referee`

```bash
npx supabase functions deploy semantic-referee --linked
```

Ships the DB-resolution layer in `providers.ts`.

> Why the order matters: if `semantic-referee` is deployed **before** `db push`, it calls a non-existent RPC — the resolver returns `db_unavailable` and the function falls through to the env-var path (safe, but not yet DB-driven). Running the migration first makes the DB-driven behaviour live the moment both functions are deployed. Likewise, if the migration runs but `admin-users` is the old build, the two new actions return `unknown_action` and the Admin UI shows an actionable error until `admin-users` is redeployed.

---

## 3. Verify

```bash
npx supabase db lint
```

Then in the app:

1. Sign in as an admin and open the **Admin** screen → the new **Semantic Referee** tab.
2. The status card should show **Provider mode: Anthropic**, **Config source: Saved setting (database)**, and an **Anthropic key present: Yes/No** line.
3. Switch to **Mock** — this is **one click**, no confirmation. The status card should re-fetch and show **Mock**.
4. Switch back to **Anthropic** — a confirmation panel appears ("Anthropic mode may use provider credits. Continue?"). Confirm it. The status card should show **Anthropic** again.
5. Optionally, in the SQL editor, confirm the audit trail:
   ```sql
   SELECT previous_mode, new_mode, previous_enabled, new_enabled, created_at
   FROM public.semantic_referee_config_audit
   ORDER BY created_at DESC
   LIMIT 5;
   ```

---

## 4. How the DB > env > code hierarchy behaves

| Situation | Effective provider |
|---|---|
| DB reachable, row `enabled = true`, `provider_mode = X` | **X** — the DB is the runtime source of truth |
| DB reachable, row `enabled = false` | The referee layer is **off** (HTTP 200, `reason: disabled`), regardless of `provider_mode` or env |
| DB read fails (network / RPC error / migration not yet applied) | Falls through to the `SEMANTIC_REFEREE_PROVIDER` env var; if that is unset, the code fallback **`mock`** |
| DB row holds a corrupt / unknown `provider_mode` | Treated as a DB-read failure — falls through to env (a corrupt row never picks a phantom provider) |
| DB `provider_mode = 'anthropic'` but `ANTHROPIC_API_KEY` is missing | The referee reports itself **unavailable** (MCP-017's typed `key_missing` outcome, HTTP 200) — rooms still work |
| DB `provider_mode = 'mcp'` | The `mcp` slot is a stub — `reason: not_implemented`, HTTP 200 (the `mcp` slot is reserved for MCP-018; it is not settable from the Admin UI) |

The resolution **never throws to the client**. Every failure path is a normal HTTP-200 outcome the caller already knows how to fall back from.

---

## 5. Rollback

**Primary rollback — no redeploy.** In the Admin UI → **Semantic Referee** tab, switch the provider mode to **Mock**. This is one click (no confirmation) and takes effect on the *next* `semantic-referee` invocation — there is no in-memory cache, so there is no stale-cache window.

To turn the referee off entirely without changing the mode, use the **Runtime state** toggle on the same tab.

**Break-glass — Admin UI unavailable.** In the Supabase SQL editor:

```sql
-- Switch the runtime provider mode to mock.
UPDATE public.semantic_referee_runtime_config
SET provider_mode = 'mock', updated_at = now()
WHERE id = true;

-- Or turn the referee layer off entirely.
UPDATE public.semantic_referee_runtime_config
SET enabled = false, updated_at = now()
WHERE id = true;
```

A break-glass SQL `UPDATE` does **not** write a `semantic_referee_config_audit` row (that audit row is written by the `admin-users` handler, not a trigger) — note the change in your own ops log if you take this path.

**Full code rollback.** If the ADMIN-AI-001 code itself must be reverted, redeploy the previous `semantic-referee` + `admin-users` builds. The two new tables can be left in place harmlessly — the old `semantic-referee` build simply never reads them. There is no need to drop the tables.

---

## 6. Production note — conservative start

The migration seeds `provider_mode = 'anthropic'` because MCP-017 is already live on the dev/test project and `anthropic` is the desired dev/test runtime state. A **production** project that wants a conservative start should, immediately after deploy, open the Admin UI → **Semantic Referee** tab and switch the mode to **Mock** (one click). The seed value is a starting point, not a mandate — the runtime mode is now an admin setting.

---

## 7. What ADMIN-AI-001 does NOT change

- It does **not** change the AI moderator's authority — no truth verdicts, no auto-hide, no `authoritative: true`. Switching to `anthropic` cannot widen the packet contract; every provider's output still flows through MCP-016's `.strict()` schema and MCP-017's content-safety scan.
- It does **not** touch scoring — `argumentScoreModel`, the strength bands, `submit-argument`. Score still never blocks posting.
- It does **not** add a config cache, a per-room override, or a general feature-flag framework. The config is one global setting; the Edge Function reads it on every invocation (sub-millisecond indexed single-row `SELECT`).
- It does **not** un-stub the `mcp` slot — that is MCP-018. The `mcp` slot ships visible-but-disabled in the Admin UI.
