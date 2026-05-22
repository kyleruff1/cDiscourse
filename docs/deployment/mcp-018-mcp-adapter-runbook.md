# MCP-018 — Operator-hosted MCP-server adapter operator runbook

This runbook is for the **human operator** of the CDiscourse Supabase project. It walks through deploying the MCP-018 adapter code for the `semantic-referee` Edge Function and — separately — enabling the operator-hosted `mcp` provider.

**The implementer agent does NOT run any `npx supabase` command in this runbook.** MCP-018 produced the MCP-adapter CODE only. It made **no live MCP-server call**. Deploying the updated function, setting any secret, and flipping the provider flag are operator actions, explicitly outside the implementation card (MCP-018 design §13). Every numbered step below is operator-runnable; the agent has no execution path here.

The first real MCP-server call is made by the operator, after Step 2 + Step 3 below.

---

## 0. What MCP-018 shipped

MCP-018 un-stubs MCP-009's reserved `mcp` provider slot with a real, working adapter — the exact analog of the MCP-017 `anthropic` provider:

- `supabase/functions/_shared/semanticReferee/mcpAdapter.ts` — the Deno-only orchestrator. The **only** file that reads `SEMANTIC_REFEREE_MCP_URL` and `SEMANTIC_REFEREE_MCP_TOKEN` (via `Deno.env.get()`) and `POST`s the operator-hosted MCP server.
- `mcpAdapterCore.ts` — the zod-free core (MCP-tool request-body assembly, MCP-response packet extraction, JSON parse, sanitizer).
- `providerRoutingCore.ts` — the `mcp` branch is now wired (was a `not_implemented` stub) through an injected `runMcp` dep; `providerRouting.ts` wires the live `runMcpAdapter` into `DEFAULT_PROVIDER_DEPS`.

The `mcp` provider is **opt-in**. With `SEMANTIC_REFEREE_PROVIDER` unset (or any value other than `mcp`), the function still runs the deterministic `mock` provider exactly as MCP-016 shipped it. Deploying the MCP-018 code does **not** change runtime behaviour until Step 4 flips the flag.

Every MCP-server response is re-validated through the outbound `SemanticRefereePacketSchema` **and** the Deno content-safety scanner before it leaves the boundary. A URL-missing / token-missing / API error / rate limit / network failure / parse failure / validation failure all return a typed `{ enabled: false, reason }` outcome with **HTTP 200** — the user never sees an error, the caller falls back to the deterministic layer-1 result. `provider` is hard-stamped `'mcp'` and `authoritative` hard-pinned `false`; a misbehaving MCP server cannot reach the user.

---

## 1. Prerequisites

Before deploying:

1. **MCP-016 and MCP-017 are merged and deployed.** MCP-018 builds on the deployed boundary. If `semantic-referee` is not yet deployed at all, deploy it first (Step 2 does that).
2. **An operator-hosted MCP server, reachable over HTTPS.** It must:
   - expose the `classify_semantic_move` tool;
   - honor MCP-001's structural catalog — it classifies an argument move's **structure** only;
   - **never** assign a truth value, pick a winner, or read popularity as evidence. The operator owns that server's doctrine compliance. The CDiscourse boundary re-validates every response (the `.strict()` packet schema + the content-safety scanner reject any smuggled verdict / `block` / `authoritative: true`), but the MCP server is contractually required to behave (MCP-009 §"MCP-server placement").
   - The expected `classify_semantic_move` tool-result contract: the tool returns a single JSON result the adapter can read as one of `{ result: {...} }`, `{ output: {...} }`, or `{ content: [ ... ] }` with a `type:'json'` block (`{ "type": "json", "json": {...} }`) or a `type:'text'` block whose `text` holds a JSON object. The inner object is the structural packet (`binaries` / `routeSuggestion` / `frictionSuggestion` / `scoreHints`); the adapter stamps `provider` / `authoritative` / version strings / hashes itself.
3. **An MCP service token** for the operator-hosted server. This is the only credential the Edge Function presents.
4. **The MCP server URL is `https://`.** The adapter rejects a non-`https` URL as `url_missing` before any `fetch` — a plaintext endpoint would leak the token. A self-hosted server must terminate TLS.
5. **The branch is merged to `main`** (the operator merges the reviewed PR; the implementer does not push).

---

## 2. Deploy the updated function

Ship the MCP-018 adapter code. This is safe to run at any time — the function keeps mock-behaving until Step 4.

```bash
npx supabase functions deploy semantic-referee --linked
```

The function now contains the `mcpAdapter.ts` code path but still routes to `mock` because `SEMANTIC_REFEREE_PROVIDER` is unset (the `?? 'mock'` default). Verify the deploy succeeded:

```bash
npx supabase functions list
```

> `supabase/config.toml` already declares `[functions.semantic-referee]` `verify_jwt = true` (from MCP-016). MCP-018 needs no `config.toml` change and no migration.

---

## 3. Set the MCP secrets

Two new secrets identify the operator-hosted MCP server. Both are **Supabase function secrets** — server-only; neither is `EXPO_PUBLIC_`-prefixed; neither appears in `.env` / `.env.example` / `app/` / `src/`.

```bash
# 3a. The HTTPS endpoint of the operator-hosted MCP server. Must be https://.
npx supabase secrets set SEMANTIC_REFEREE_MCP_URL=https://<operator-mcp-host>/<path>

# 3b. The MCP service token. Sent as the Authorization Bearer credential.
npx supabase secrets set SEMANTIC_REFEREE_MCP_TOKEN=<mcp-service-token>

# 3c. Verify both are present.
npx supabase secrets list
```

If `SEMANTIC_REFEREE_MCP_URL` is absent, empty, or not `https://`, the adapter returns `unavailable: url_missing` → the caller sees `{ enabled: false, reason: 'not_configured' }`. If `SEMANTIC_REFEREE_MCP_TOKEN` is absent or empty, the adapter returns `unavailable: token_missing` → again `{ enabled: false, reason: 'not_configured' }`. In both cases the function returns HTTP 200 and the caller falls back to the deterministic layer-1 result — there is no user-visible error.

---

## 4. Enable the MCP provider

```bash
# 4a. Confirm the layer is enabled at all (MCP-016 established this flag).
#     The semantic-referee layer is OFF unless this equals the exact string 'true'.
npx supabase secrets set SEMANTIC_REFEREE_ENABLED=true

# 4b. Flip the provider to mcp. THIS is the doctrine-critical line — it is the
#     only action that makes the function call the operator-hosted MCP server.
npx supabase secrets set SEMANTIC_REFEREE_PROVIDER=mcp

# 4c. Verify.
npx supabase secrets list
```

After 4b, the next `classifyMove` invocation routes to the operator-hosted MCP adapter.

> **DB-config alternative.** If ADMIN-AI-001's DB layer is the runtime source of truth, the provider flip is instead a SQL update of the `semantic_referee_runtime_config.provider_mode` row to `'mcp'`. The `provider_mode` CHECK constraint already permits `'mcp'` (ADMIN-AI-001). **Note the Admin UI control for `mcp` stays disabled** ("Coming later" label) — making `mcp` admin-selectable is a separate one-line follow-up card (add `'mcp'` to the write-path `z.enum` in `adminSemanticConfigSchemas.ts` and drop the UI `disabled` flag); it is **not** part of MCP-018. The DB row can still be set by hand. The DB layer overrides the env var when a DB row exists.

> **Doctrine note.** `SEMANTIC_REFEREE_PROVIDER` defaults to `'mock'`. Any value other than the exact string `'mcp'` (including unset) keeps the deterministic mock provider. There is no way to make `mcp` the default — it is always an explicit operator opt-in.

---

## 5. Smoke test

From a single test room, invoke `classifyMove` (the `src/lib/edgeFunctions.ts` wrapper) and inspect the returned `SemanticRefereePacket`:

- `packet.provider` is `'mcp'` (not `'mock'`).
- `packet.authoritative` is `false` (always — the boundary hard-pins it).
- `packet.binaries` carries one entry per requested classifier.

If the packet comes back `provider: 'mock'`, the flag did not take — re-check Step 4b and that the function was redeployed (Step 2). If the outcome is `{ enabled: false, reason: 'not_configured' }`, the MCP URL or token is missing / empty, or the URL is not `https` (Step 3). If `{ enabled: false, reason: 'api_error' }` / `'rate_limited'` / `'network_error'`, the MCP server is unreachable, erroring, or rate-limiting — check the MCP server's own logs and uptime. If `{ enabled: false, reason: 'parse_failure' }`, the MCP server returned an envelope shape the adapter does not recognise — confirm the `classify_semantic_move` tool-result contract in §1 step 2. If `{ enabled: false, reason: 'validation_failed' }`, the MCP server returned a structurally-invalid or doctrine-violating packet — the boundary rejected it; check the MCP server's classifier output against the packet contract.

A function cold start picks up new secret values; if a stale value seems to persist, wait for the next cold start or redeploy.

---

## 6. Rollback

Rollback is a **single command, instant, no redeploy**:

```bash
npx supabase secrets set SEMANTIC_REFEREE_PROVIDER=mock
```

(Or, if the DB layer is the source of truth, set the `semantic_referee_runtime_config.provider_mode` row back to `'mock'`.)

The next invocation resumes the deterministic mock provider. Because the mock path was never removed, rollback cannot fail. To leave the deployed code in place but be certain no MCP-server call can happen, this flag flip is sufficient — the MCP URL and token are never read when the provider is `mock`.

---

## 7. Token rotation

When the MCP service token is rotated, update the secret; the function picks up the new value on its next cold start:

```bash
npx supabase secrets set SEMANTIC_REFEREE_MCP_TOKEN=<new-mcp-service-token>
```

There is no per-function copy of the token — `SEMANTIC_REFEREE_MCP_TOKEN` is read only by `semantic-referee`. Rotating the URL (if the operator-hosted server moves) is the identical `secrets set` on `SEMANTIC_REFEREE_MCP_URL`.

---

## 8. Disable the layer entirely

To turn the whole semantic-referee layer off — mock and `mcp` alike — clear the master flag:

```bash
npx supabase secrets set SEMANTIC_REFEREE_ENABLED=false
```

(Or, with the DB layer, set the runtime-config row's `enabled` to `false`.)

With `SEMANTIC_REFEREE_ENABLED` not equal to `'true'`, the function returns `{ enabled: false, reason: 'disabled' }` (HTTP 200) and **no provider — mock or mcp — is selected, and no MCP URL or token is read**. The disabled check runs before any provider selection.

---

## 9. Monitoring

The MCP server is a **new operational surface** the operator owns. The per-room call rate is bounded **upstream** by MCP-012's gating, which MCP-018 does not change:

- **Trigger gates** — only specific move events trigger a classify.
- **Batching** — at most 5 classifiers per MCP call.
- **In-memory LRU cache** — a repeated `(roomId, contentHash, promptVersion)` is served from cache, no call.
- **Token budget** — the move body is capped at 8000 chars by the inbound schema.
- **Retry policy** — at most 2 attempts.

What to watch after the flag flip:

- **MCP server uptime.** When the MCP server is down, the adapter degrades to `network_error` → deterministic fallback. Users are unaffected, but the `mcp` layer is effectively off until the server recovers.
- **MCP server latency vs the timeout budget.** The adapter applies a `MCP_REQUEST_TIMEOUT_MS` bound (15 s) via `AbortSignal.timeout`. A timed-out request maps to `network_error` → deterministic fallback. If the MCP server's p99 latency approaches the budget, the `mcp` layer is silently degrading — investigate the server or raise the bound (a one-line code change to `MCP_REQUEST_TIMEOUT_MS` in `mcpAdapterCore.ts`).
- **MCP server error rate.** A rising rate maps to `api_error` / `rate_limited` → deterministic fallback. Users are unaffected; the live layer is off for those calls.
- **Expected per-room call rate** — a sustained spike beyond the expected per-active-room rate suggests a misconfigured trigger; roll back (§6) and investigate.

---

## 10. Security note

- The **model key** — if the operator-hosted MCP server itself calls Anthropic or another model to do the classification — lives **on the MCP server, not in Supabase**. This is a security advantage of the `mcp` provider (the model key need not be a Supabase secret at all) at the cost of one extra credential to rotate: `SEMANTIC_REFEREE_MCP_TOKEN`. MCP-018's adapter holds only the MCP service token, never a model key.
- The MCP server is operator-hosted and **must be access-controlled.** The `SEMANTIC_REFEREE_MCP_TOKEN` is the only thing the Edge Function presents; the server must reject any unauthenticated request.
- The token travels **only over TLS** — the adapter rejects a non-`https` `SEMANTIC_REFEREE_MCP_URL` before any `fetch`.
- The token / URL / Authorization header / raw response body are **never logged** by the adapter.

---

## Operator decision summary

| Decision | Recommendation |
|---|---|
| Where the model key lives | **On the operator-hosted MCP server** — the `mcp` provider's design intent. Supabase holds only the MCP service token. |
| Env-var flip vs DB-config flip | Either works. Use the **DB row** if ADMIN-AI-001's runtime config is your source of truth; otherwise the `secrets set` env path. The Admin UI `mcp` control stays disabled until the separate follow-up card. |
| MCP request timeout | The code default `MCP_REQUEST_TIMEOUT_MS` (15 s) is a safe start. Tune it (a one-line change) only if the operator-hosted server's real latency demands it. |
| Ship the adapter before or after the in-room wiring card | **Land MCP-018 first**, deploy in mock mode; flip to `mcp` once an operator-hosted MCP server is proven. The adapter degrades to `not_configured` with no server. |

---

## What the operator never does in this runbook

- Run any command the implementer should have run — the implementer ran none; every step here is the operator's.
- Commit a token or URL value to git — `.env` / `.env.example` carry no server secret; this runbook is the canonical name list.
- Deploy to the wrong project — `secrets set` / `functions deploy` operate on the `--linked` project; confirm the link before Step 2.
- Make `mcp` admin-selectable — that is a separate one-line follow-up card; MCP-018 leaves the Admin UI control disabled.
