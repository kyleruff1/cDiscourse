# MCP-SERVER-001-SMOKE — 2026-05-26

**Operator:** Kyler
**Date:** 2026-05-26
**Server URL:** `https://cdiscourse-mcp-server.civildiscourse.deno.net`
**Server commit:** `8a1652c` (PR #308 squash-merge to `main`)
**Supabase project ref:** `qsciikhztvzzohssddrq`
**Audit status:** COMPLETE — final verdict **PASS** after DB-config provider override was corrected and Phase 5 was re-run

---

## Verdict

**PASS** — all five phases pass after a non-trivial mid-audit correction (DB runtime-config override).

- MCP-SERVER-001-SMOKE: **PASS**
- MCP-018 operator-hosted adapter path: **operational** (confirmed via `provider=mcp` + `inputHash=mcp-…` on 3/3 final Phase 5 calls, matching `supabase/functions/_shared/semanticReferee/mcpAdapter.ts:115-125` hard-stamp)
- Deno Deploy MCP server (`cdiscourse-mcp-server`): **operational**
- Supabase `semantic-referee` Edge Function route: **confirmed routing through `mcpAdapter.ts`** (DB-config `provider_mode='mcp'` overriding env)
- MCP-SERVER-002: **AUTHORIZED**
- ADMIN-MCP-001: **AUTHORIZED** (operator decides UX timing for flipping the "Coming later (MCP-018)" affordance live)

A non-blocking compatibility finding (actorRole enum drift between Supabase's `ClassifyMoveRequestSchema` and the MCP server's accepted values) is recorded below for follow-up via MCP-SERVER-001-FOLLOWUP or by folding into MCP-SERVER-002.

---

## Phase 0 — Anthropic provider preflight

- [x] Operator ran preflight against `https://api.anthropic.com/v1/messages` with the Anthropic key destined for Deno Deploy.
- [x] Model used: `claude-haiku-4-5`.
- [x] Response: HTTP 200.
- [x] Anthropic key value was NOT logged or echoed.

**Result:** PASS
**Notes:** Same key was set as `ANTHROPIC_API_KEY` on Deno Deploy in Phase 2.

---

## Phase 1 — Local smoke

- [x] `cd mcp-server && deno task start` started server on port 8080 in fixture-provider mode (background PID terminated post-smoke).
- [x] `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>` exited 0.
- [x] All 9 checks PASS.
- [x] No secrets present in stdout / stderr (script prints `Token: [REDACTED]`).

**Result:** PASS
**Notes:**
- Server env: `MCP_SERVER_BEARER_TOKEN=<64-byte hex>`, `MCP_SERVER_ENV=local`, `MCP_SERVER_USE_FIXTURE_PROVIDER=true`, `MODEL_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=<placeholder>` (placeholder required to satisfy Check 1's `credentialsConfigured: true` assertion in fixture mode; no real Anthropic call).
- Smoke output captured verbatim:

```
MCP-SERVER-001 smoke against: http://localhost:8080
Token: [REDACTED]

PASS [1-health]
PASS [2-compat-no-auth]
PASS [3-compat-bad-token]
PASS [4-compat-semantic-move]
PASS [5-compat-boolean-scaffold]
PASS [6-mcp-initialize]
PASS [7-mcp-tools-list]
PASS [8-mcp-tools-call-semantic]
PASS [9-mcp-tools-call-boolean-scaffold]

MCP-SERVER-001 smoke: 9 PASSES, 0 FAILS
EXIT: 0
```

- Local-only `/health` digest: `{"status":"ok","version":"0.1.0","environment":"local","supportedTools":["classify_semantic_move","classify_argument_boolean_observations"],"credentialsConfigured":true,"protocolVersion":"2025-11-25",...}`

---

## Phase 2 — Hosted deploy

- [x] Deployed to Deno Deploy project: `cdiscourse-mcp-server`
- [x] Production URL: `https://cdiscourse-mcp-server.civildiscourse.deno.net`
- [x] Entrypoint: `mcp-server/main.ts`
- [x] Environment variables set (by NAME only — values not echoed):
  - [x] `MCP_SERVER_BEARER_TOKEN` (hosted bearer; 64-byte hex)
  - [x] `ANTHROPIC_API_KEY` (the Phase-0-validated Anthropic key)
  - [x] `MODEL_PROVIDER=anthropic`
  - [x] `MCP_SERVER_ENV=prod`
  - [x] `ANTHROPIC_MODEL=claude-haiku-4-5`
- [x] **`MCP_SERVER_USE_FIXTURE_PROVIDER` is NOT set in production** (fixture provider is local-only).

**Result:** PASS
**Notes:** Deno build/deploy succeeded; production is serving traffic.

---

## Phase 3 — Hosted smoke

- [x] `bash scripts/mcp-server-001-smoke.sh --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net --token <hosted-token>` exited 0.
- [x] All 9 checks PASS (same 9 checks as Phase 1, but Checks 4 and 8 made REAL Anthropic calls against `claude-haiku-4-5` this time, not fixture).
- [x] `/health` endpoint reachable WITHOUT bearer (returns HTTP 200).
- [x] `/health` body contains `credentialsConfigured: true`.
- [x] N=3 health stability: HTTP 200 / HTTP 200 / HTTP 200.

**Result:** PASS
**Notes:** Initial hosted smoke attempt hit a transient local curl/SChannel failure; immediate rerun passed cleanly. Treating the final hosted smoke as PASS. Deno traces showed expected `/health`, `/mcp/adapter-compat`, and `/mcp` requests during the run.

---

## Phase 4 — Supabase secret wiring

- [x] `SEMANTIC_REFEREE_MCP_URL=https://cdiscourse-mcp-server.civildiscourse.deno.net/mcp/adapter-compat` set via `npx supabase secrets set` (NOTE: URL points at `/mcp/adapter-compat`, **NOT** `/mcp` — the simplified-envelope endpoint MCP-018's adapter sends).
- [x] `SEMANTIC_REFEREE_MCP_TOKEN=<hosted bearer token>` set via `npx supabase secrets set`.
- [x] `SEMANTIC_REFEREE_ENABLED=true` set.
- [x] `SEMANTIC_REFEREE_PROVIDER=mcp` set.
- [x] `npx supabase secrets list --project-ref qsciikhztvzzohssddrq | grep SEMANTIC_REFEREE_` post-snapshot shows all four expected names with non-null digests:
  - `SEMANTIC_REFEREE_ENABLED`
  - `SEMANTIC_REFEREE_MCP_TOKEN`
  - `SEMANTIC_REFEREE_MCP_URL`
  - `SEMANTIC_REFEREE_PROVIDER`

**Result:** PASS
**Notes:** Supabase function list also showed `semantic-referee` and `classify-argument-boolean-observations` Edge Functions both ACTIVE.

---

## Mid-audit diagnostic — DB runtime-config override

The first Phase 5 attempt (with all Phase 4 secrets set correctly) returned `provider: "anthropic"` and `inputHash: "anthropic-81a08810"` on all 3 calls. Per `supabase/functions/_shared/semanticReferee/mcpAdapter.ts:115,123` and `anthropicProvider.ts:92,100`, those identity fields are HARD-STAMPED by the respective adapter and uniquely identify the code path that handled the request. Their presence proved the `semantic-referee` Edge Function had routed through `anthropicProvider.ts`, not through the new `mcpAdapter.ts` — despite the Supabase secret `SEMANTIC_REFEREE_PROVIDER=mcp`.

Root cause: ADMIN-AI-001's DB-config layer (`supabase/functions/_shared/semanticReferee/runtimeConfig.ts:6-10`) takes precedence over `SEMANTIC_REFEREE_PROVIDER` env var when a row exists in `public.semantic_referee_runtime_config`. The row was present with `provider_mode='anthropic'`. The MCP-018 runbook explicitly flagged this scenario ("DB-config alternative").

Read-only inspection via `npx supabase db query --linked`:

```
id=true | provider_mode="anthropic" | enabled=true | updated_at="2026-05-25 04:36:43.074+00"
```

Schema notes for future operators:
- Table is a singleton — `id` is `boolean` (constraint pins it to `true`).
- Active toggle column is named `enabled`, not `semantic_referee_enabled`.

Fix applied via `npx supabase db query --linked` (service-role via Management API):

```sql
update public.semantic_referee_runtime_config
set provider_mode = 'mcp',
    enabled = true,
    updated_at = now()
where id = true
returning id, provider_mode, enabled, updated_at;
```

Post-update row:

```
id=true | provider_mode="mcp" | enabled=true | updated_at="2026-05-26 22:51:28.563978+00"
```

---

## Phase 5 — MCP-018 semantic-referee integration

- [x] Triggered the existing `semantic-referee` Edge Function path via direct `POST /functions/v1/semantic-referee` with operator admin JWT.
- [x] 3/3 calls returned HTTP 200.
- [x] Final payload included required `roomContext` (initial 422 was payload missing `roomContext`; corrected during operator's first Phase 5 attempt).
- [x] Final payload used `actorRole=observer` (see Non-blocking finding below — `moderator` was rejected by the MCP server's enum).
- [x] Returned `SemanticRefereePacket` shape (final 3 calls, after DB-config flip):
  - `enabled=true`
  - `reason=none`
  - `error=none`
  - `provider=mcp` ← MCP-018 adapter hard-stamp (`mcpAdapter.ts:123`)
  - `authoritative=false`
  - `modelVersion=operator-mcp-server`
  - `inputHash=mcp-f97a5a40` ← MCP-018 adapter hash prefix (`mcpAdapter.ts:115`)
  - `contentHash=phase5-mcp-valid-role-final-1779836705875`
  - `binariesCount=2`
  - `deterministicFallback=false`
- [x] All 3 calls produced identical identity fields (deterministic for same `contentHash`+`roomId`+`promptVersion`+`modelVersion` — expected and correct per `mcpAdapter.ts:116-117`).
- [x] No `deterministic_fallback` outcomes on any of the N=3 calls.
- [x] Doctrine grep over all 3 live responses: count = **0** (zero verdict/winner/correctness/fallacy tokens in user-facing strings).

**Result:** PASS

**Discriminator confirmation:** The `provider=mcp` + `inputHash=mcp-…` combination is the un-fakeable proof that the `semantic-referee` Edge Function routed through `mcpAdapter.ts`. The hosted MCP server received the request via `/mcp/adapter-compat`, called Anthropic `claude-haiku-4-5` server-side, returned the packet, and the Edge Function's adapter stamped the response with the MCP identity. This is the entire architectural contract MCP-SERVER-001 was meant to validate.

---

## Non-blocking finding — actorRole enum drift

During the operator's Phase 5 work, a direct hosted MCP call returned `invalid_params` for `roomContext.actorRole="moderator"`. Investigation showed:

- **Supabase `ClassifyMoveRequestSchema`** (Edge Function side) **permits** `actorRole="moderator"`.
- **MCP server** (deployed `cdiscourse-mcp-server`) currently accepts only `actorRole ∈ {initiator, primary_opponent, chime_in, observer}`.

The final smoke passed with `actorRole=observer`. The mismatch is non-blocking for MCP-SERVER-001-SMOKE PASS but represents a contract drift that will surface again the moment a real `moderator`-actor request flows through MCP-018.

**Recommended follow-up:** File **MCP-SERVER-001-FOLLOWUP** (or fold into MCP-SERVER-002 scope) to align the MCP server's `actorRole` enum with Supabase's `ClassifyMoveRequestSchema` by adding `moderator` to the server-side accepted values.

---

## Verdict authorizations

- **MCP-SERVER-001-SMOKE: PASS**
- **MCP-018 operator-hosted adapter path: operational**
- **MCP-SERVER-002: AUTHORIZED** — Family A boolean-observation classifier on the MCP server (replaces the scaffolded `isError: true, reason: "not_implemented"` envelope).
- **ADMIN-MCP-001: AUTHORIZED** — flip the account UI "Coming later (MCP-018)" affordance live (operator chooses UX timing).
- **MCP-021C-EDGE-SMOKE: AUTHORIZED to re-run** with the live MCP server (boolean-observation tool is still scaffolded, so a full Family A EDGE-SMOKE waits on MCP-SERVER-002; however, the infrastructure path itself can now be re-verified).

---

## Common failure_reason interpretations

| Symptom | Likely cause | Fix |
|---|---|---|
| Phase 1 health 401 | Health endpoint accidentally authed | Server misconfig (regression) |
| Phase 1 check 4 fails with 401 | Token mismatch local | Re-verify `.env.local` MCP_SERVER_BEARER_TOKEN |
| Phase 1 check 4 returns `reason: key_missing` | Anthropic key blank AND fixture flag not set | Set `MCP_SERVER_USE_FIXTURE_PROVIDER=true` for offline smoke, OR set ANTHROPIC_API_KEY |
| Phase 3 check 4 fails with `validation_failed` | Anthropic returned a shape the server rejected | Check Deno Deploy logs; the request likely tripped the doctrine ban-list or schema check |
| **Phase 5 returns `provider: 'mock'`** | `SEMANTIC_REFEREE_PROVIDER=mcp` not set OR Edge Function not redeployed | Set the secret and redeploy `semantic-referee` |
| **Phase 5 returns `provider: 'anthropic'` (THIS AUDIT'S MID-AUDIT FINDING)** | DB-config layer (`semantic_referee_runtime_config.provider_mode`) overrides env var | Update DB row to `provider_mode='mcp'` via service-role SQL (Admin UI control for `mcp` is still disabled until ADMIN-MCP-001 ships) |
| Phase 5 returns `enabled: false, reason: 'not_configured'` | Supabase secrets URL/TOKEN absent or wrong | Verify Phase 4; check the URL has `/mcp/adapter-compat` suffix |
| Phase 5 returns `enabled: false, reason: 'parse_failure'` | Server returned an unrecognized envelope shape | Check server's `/mcp/adapter-compat` returns `{result: {...}}` (priority-1) |
| Phase 5 returns `enabled: false, reason: 'validation_failed'` | Server returned a doctrine-violating packet | Check server logs; check ban-list scan; confirm prompt parity |
| Phase 5 returns `enabled: false, reason: 'rate_limited'` | Anthropic 429 | Wait and retry; check Anthropic console rate limits |
| Phase 5 returns `enabled: false, reason: 'network_error'` | DNS/TLS/connection problem | Verify Deno Deploy is healthy; check Supabase egress |
| Direct hosted MCP call returns `invalid_params` for actorRole | MCP server enum drift from Supabase schema | Add missing role values to MCP server's accepted set (MCP-SERVER-001-FOLLOWUP) |

---

## References

- Prior partial audit commit: `c3f23ac` (Phase 1 only)
- Server commit (deployed): `8a1652c` (PR #308)
- Sequencing decision: `docs/decisions/MCP-021C-edge-pivot.md`
- Intent brief: `docs/designs/MCP-SERVER-001-intent.md`
- Design doc: `docs/designs/MCP-SERVER-001.md` (1,545 lines, 24 sections)
- Review doc: `docs/reviews/MCP-SERVER-001-review.md` (24/24 PASS verdict matrix)
- Deployment runbook: `docs/deployment/mcp-server-001-runbook.md`
- MCP-018 adapter (the discriminator source): `supabase/functions/_shared/semanticReferee/mcpAdapter.ts:115-125` (hard-stamps `provider='mcp'` + `inputHash='mcp-…'`)
- Anthropic adapter (the alternative-path source): `supabase/functions/_shared/semanticReferee/anthropicProvider.ts:92-100` (hard-stamps `provider='anthropic'` + `inputHash='anthropic-…'`)
- DB-config resolver (the override layer): `supabase/functions/_shared/semanticReferee/runtimeConfig.ts:6-10`
