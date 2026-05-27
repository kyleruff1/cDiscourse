# MCP-SERVER-001 — Operator deployment runbook

This runbook covers everything the operator does AFTER `feat/MCP-SERVER-001-…` merges to main:

1. Phase 1 — Local smoke (verifies the merged code runs locally)
2. Phase 2 — Deno Deploy deployment
3. Phase 3 — Hosted smoke
4. Phase 4 — Supabase secret wiring
5. Phase 5 — MCP-018 integration verification
6. Token rotation
7. Logs access
8. Rollback

Bring the audit template at `docs/audits/MCP-SERVER-001-smoke-template.md` into a dated audit doc as you work. Tick the boxes as each phase passes.

---

## What MCP-SERVER-001 shipped

- A Deno-based HTTP MCP server under `mcp-server/`.
- Three endpoints:
  - `GET /health` — uptime + capability ping (unauthenticated by design).
  - `POST /mcp` — official MCP Streamable HTTP (JSON-RPC 2.0). Bearer required.
  - `POST /mcp/adapter-compat` — simplified `{tool, input}` envelope the shipped MCP-018 + MCP-021C-EDGE adapters consume. Bearer required.
- Two registered tools:
  - `classify_semantic_move` — fully implemented; calls Anthropic via the canonical seed prompt and returns a SemanticRefereePacket structural subset.
  - `classify_argument_boolean_observations` — fully implemented as of **MCP-SERVER-002**; calls Anthropic via the Family A (`parent_relation`) prompt and returns an MCP-021A `McpBooleanObservationResponse` over 16 binding rawKeys. Family B-J return an `unsupported_family` error envelope. See **MCP-SERVER-002 — Family A testing** below for the test procedure.
- A local smoke script at `scripts/mcp-server-001-smoke.sh`.
- Fixtures at `mcp-server/fixtures/`.

## Prerequisites

- Anthropic API key.
- Deno Deploy account ([https://deno.com/deploy](https://deno.com/deploy)).
- Supabase project link confirmed via `npx supabase link --project-ref qsciikhztvzzohssddrq`.
- A generated bearer token for this server (long random hex; rotate freely).

---

## Phase 1 — Local smoke

This verifies the merged code runs locally before the operator commits to a hosted deploy.

```bash
# From repo root:
cd mcp-server
cp .env.local.example .env.local
# Edit .env.local — set MCP_SERVER_BEARER_TOKEN to a long random string.
# Leave ANTHROPIC_API_KEY blank if you want the offline smoke; set it
# to a real key if you want to also verify a real Anthropic call works.
deno task dev
# Server listens on http://localhost:8080
```

In another shell:

```bash
bash scripts/mcp-server-001-smoke.sh \
  --base-url http://localhost:8080 \
  --token <bearer-from-.env.local>
# Expect: 9/9 PASS, exit 0
```

If a check fails, the script prints the failing check name + an excerpt of the response. Common local failures:

| Symptom | Cause | Fix |
|---|---|---|
| Check 1 (`1-health`) fails on connection refused | Server not running | `cd mcp-server && deno task dev` |
| Check 1 fails on `credentialsConfigured: false` | Either bearer OR Anthropic key blank in `.env.local` | Set both in `.env.local` |
| Check 4 (`4-compat-semantic-move`) fails | Anthropic key invalid OR fixture provider disabled | Set `MCP_SERVER_USE_FIXTURE_PROVIDER=true` in `.env.local` for offline smoke |
| Check 8 (`8-mcp-tools-call-semantic`) returns `isError: true` with `reason: "key_missing"` | ANTHROPIC_API_KEY missing AND fixture flag not set | One of: set ANTHROPIC_API_KEY, or set MCP_SERVER_USE_FIXTURE_PROVIDER=true |

The fixture-provider mode (`MCP_SERVER_USE_FIXTURE_PROVIDER=true`) bypasses the live Anthropic call and returns the fixture from `mcp-server/fixtures/classify-semantic-move.response.json`. Use it for offline smoke. **NEVER set this flag in production** — production must call the real Anthropic API.

---

## Phase 2 — Deno Deploy deployment

1. Log in to Deno Deploy: <https://dash.deno.com>.
2. Create a new project. Recommended name: `cdiscourse-mcp-server` (or operator's chosen name).
3. Connect to the GitHub repo if using GitHub integration (optional; alternatively use `deno deploy` from the CLI).
4. Configure entrypoint: `mcp-server/main.ts`.
5. Set environment variables in the Deno Deploy dashboard → Settings → Environment Variables:

| Name | Value | Notes |
|---|---|---|
| `MCP_SERVER_BEARER_TOKEN` | (your random hex) | The token the Supabase Edge Function will present |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | Server-side only; CDiscourse client never sees this |
| `MODEL_PROVIDER` | `anthropic` | Only `anthropic` is supported in v1 |
| `MCP_SERVER_ENV` | `prod` | Affects the `/health` `environment` field |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` (optional) | Pin to a dated snapshot like `claude-haiku-4-5-20251001` if desired |
| `MCP_SERVER_REQUEST_TIMEOUT_MS` | `30000` (optional) | Default is 30s |
| `MCP_SERVER_MODEL_TIMEOUT_MS` | `25000` (optional) | Default is 25s |
| `MCP_SERVER_ALLOWED_ORIGINS` | (optional) | Comma-separated. Recommended: pin to your Supabase project URL |

**DO NOT set `MCP_SERVER_USE_FIXTURE_PROVIDER` in production.** That flag is for local / CI smoke only.

6. Deploy. Note the deployed URL (e.g. `https://cdiscourse-mcp-server.deno.dev`).

---

## Phase 3 — Hosted smoke

```bash
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.deno.dev \
  --token <same-token-as-deno-deploy-env>
# Expect: 9/9 PASS, exit 0
```

Note: the hosted smoke calls REAL Anthropic (no fixture flag). Check 4 + Check 8 verify a real `SemanticRefereePacket` returns from a real `claude-haiku-4-5` invocation.

If a hosted check fails, view Deno Deploy logs (Dashboard → project → Logs). The structured log lines include `requestId`, `tool`, `duration_ms`, `status`, and `reason`. They NEVER include the bearer token, the Anthropic key, or argument body text.

---

## Phase 4 — Supabase secret wiring

```bash
npx supabase secrets set \
  SEMANTIC_REFEREE_MCP_URL=https://cdiscourse-mcp-server.deno.dev/mcp/adapter-compat \
  --project-ref qsciikhztvzzohssddrq

npx supabase secrets set \
  SEMANTIC_REFEREE_MCP_TOKEN=<same-token-as-deno-deploy-env> \
  --project-ref qsciikhztvzzohssddrq

# Verify both are set:
npx supabase secrets list --project-ref qsciikhztvzzohssddrq | grep SEMANTIC_REFEREE_MCP
# Expected: two lines, both with HASHED values (Supabase never shows raw secrets)
```

**CRITICAL: the URL suffix.** The Supabase Edge Function adapter (MCP-018) sends the simplified `{tool, input}` envelope, NOT a JSON-RPC `tools/call`. The URL MUST point at `/mcp/adapter-compat`, NOT `/mcp`. Setting it to `/mcp` would route the Edge Function's traffic to the official endpoint, which would reject the envelope as invalid JSON-RPC.

The official `/mcp` endpoint exists so future callers (e.g. a Claude Desktop integration) can speak the spec without modification, but MCP-018's deployed traffic stays on `/mcp/adapter-compat`.

---

## Phase 5 — MCP-018 integration verification

Trigger the semantic-referee path on a test debate room (via the existing MCP-018 integration runbook, or directly invoke the `semantic-referee` Edge Function with a synthetic input).

Expected packet shape (`provider`, `authoritative`, `binaries[]`):

```json
{
  "packetVersion": "mcp-semantic-referee-v0",
  "promptVersion": "mcp-semantic-referee-prompt-v2",
  "modelVersion": "claude-haiku-4-5",
  "provider": "mcp",
  "authoritative": false,
  "binaries": [
    {
      "classifierId": "responds_to_parent",
      "value": 1,
      "confidence": "high",
      "reasonCode": "<some snake_case reason>"
    }
  ],
  "routeSuggestion": "mainline",
  "frictionSuggestion": "none",
  "scoreHints": { … }
}
```

Verify:
- `provider` is `mcp` (NOT `mock`)
- `authoritative` is `false`
- `binaries[]` carries one entry per requested classifier
- No `deterministic_fallback` outcomes on N=3 test calls (one-off transients on a single call are not blockers; three in a row indicate a real server issue)

If `provider: 'mock'` returns: the MCP-018 routing did not select the MCP server. Check `SEMANTIC_REFEREE_PROVIDER=mcp` is set in Supabase function secrets and the `semantic-referee` Edge Function has been redeployed since the secret was set.

If `enabled: false, reason: 'not_configured'` returns: the secret URL or token is missing or wrong. Re-verify Phase 4.

---

## Token rotation

1. Generate a new random hex bearer.
2. Set the new value in Deno Deploy env vars (Settings → Environment Variables).
3. Set the SAME new value in Supabase function secrets: `npx supabase secrets set SEMANTIC_REFEREE_MCP_TOKEN=<new> --project-ref qsciikhztvzzohssddrq`.
4. Deno Deploy + Supabase rolls forward together. There is no window where the old token is rejected by one side and the new one is rejected by the other.

If you need a zero-downtime rotation: deploy a second project with the new token, wire Supabase to it, then deprecate the old project. v1 does not require this; the read above is the standard approach.

---

## Logs access

Deno Deploy dashboard → project → Logs tab. Log lines are structured JSON. Fields you'll see (per design §15.2):

| Field | Example |
|---|---|
| `ts` | `2026-05-26T13:15:00.000Z` |
| `level` | `info` / `warn` / `error` |
| `event` | `mcp_tools_call`, `anthropic_call_success`, etc. |
| `requestId` | UUID |
| `tool` | `classify_semantic_move` |
| `endpoint` | `/mcp` or `/mcp/adapter-compat` |
| `duration_ms` | 1234 |
| `status` | `success` / `failure` / `timeout` / `rejected` |
| `errorClass` | `validation_failed`, `model_timeout`, `rate_limited`, etc. |
| `httpStatus` | 200 / 401 / 403 / 500 |
| `promptHash` / `responseHash` | SHA-256 hex (debugging only; the body is NEVER logged) |

You will NOT see: bearer tokens, the Anthropic API key, any raw prompt or response text, any argument body text, any room or move id text.

---

## MCP-SERVER-002 — Family A testing

The MCP-SERVER-002 card promoted `classify_argument_boolean_observations` from
a scaffolded `not_implemented` envelope to the real Family A classifier. The
test procedure is documented in detail at `docs/audits/MCP-SERVER-002-smoke-template.md`.

Key points for operator deployment:

1. **No new env vars required.** Family A reuses the same ANTHROPIC_API_KEY +
   MCP_SERVER_BEARER_TOKEN + ANTHROPIC_MODEL secrets MCP-SERVER-001 already needs.
   `MCP_SERVER_USE_FIXTURE_PROVIDER=true` (offline mode) is supported for both tools.
2. **No new dependencies.** Server-side Deno tree only.
3. **Updated smoke script:** Checks 5 + 9 of `scripts/mcp-server-001-smoke.sh`
   now validate the REAL Family A response shape (16 rawKeys, schemaVersion,
   modelInfo.classifierSetVersion='family-a-v1'). Run the same script as before;
   the new checks are baked in.
4. **Family B-J:** the server returns `unsupported_family` for any
   `requestedFamilies` outside `['parent_relation']`. MCP-SERVER-003+ adds
   additional families.
5. **Phase 3 validator:** post-deploy, capture the Family A response payload
   and run `deno run --allow-read mcp-server/scripts/validate-family-a-response.ts
   <payload-path>` to verify MCP-021A schema compliance.
6. **Provider precedence reminder (added with MCP-SERVER-002):** the
   `public.semantic_referee_runtime_config.provider_mode` DB row wins over the
   `SEMANTIC_REFEREE_PROVIDER` env var. If Phase 5 returns the wrong provider,
   inspect and flip the DB row (see `docs/audits/MCP-SERVER-001-smoke-template.md`
   Phase 5 prerequisite).

---

## Rollback

If the MCP server misbehaves and you need to fall back to the deterministic semantic-referee:

```bash
npx supabase secrets unset SEMANTIC_REFEREE_MCP_URL --project-ref qsciikhztvzzohssddrq
npx supabase secrets unset SEMANTIC_REFEREE_MCP_TOKEN --project-ref qsciikhztvzzohssddrq
```

The MCP-018 adapter sees `url_missing`/`token_missing` and returns `{enabled: false, reason: 'not_configured'}`. The Edge Function falls back to the deterministic layer-1 packet. Users see no error; the semantic-referee experience degrades gracefully.

The MCP server can stay deployed (no need to tear down Deno Deploy); it's just unused until the secrets are set again.

---

## Operator-deferred decisions

The design (`docs/designs/MCP-SERVER-001.md`) §24.14 enumerates eight decisions the operator should confirm at deploy time:

1. **Hosting platform** — design defaults to Deno Deploy.
2. **Server location** — design ships co-located at `mcp-server/`.
3. **Model id pinning** — design defaults to `claude-haiku-4-5` alias. Pin to a dated snapshot for stability.
4. **Allowed origins** — design recommends pinning `MCP_SERVER_ALLOWED_ORIGINS` to the Supabase project URL.
5. **URL suffix** — design pins `https://<deployed>/mcp/adapter-compat` for the Supabase secret. Do NOT change this unless you also modify the MCP-018 adapter.
6. **Project name on Deno Deploy** — design suggests `cdiscourse-mcp-server`.
7. **CI/deploy workflow** — design leaves CI out of scope for v1. Operator deploys manually.
8. **Protocol-version pinning** — design pins `2025-11-25` (latest at authoring).
