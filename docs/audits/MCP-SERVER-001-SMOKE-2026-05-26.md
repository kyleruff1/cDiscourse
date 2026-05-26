# MCP-SERVER-001-SMOKE — 2026-05-26

**Operator:** Kyler
**Date:** 2026-05-26
**Server URL:** (Phase 2 not yet executed)
**Server commit:** `8a1652c` (PR #308 squash-merge to `main`)
**Supabase project ref:** qsciikhztvzzohssddrq
**Audit status:** IN PROGRESS — Phase 1 complete; Phases 0/2/3/4/5 pending operator action

---

## Phase 0 — Anthropic provider preflight

- [ ] Operator runs `curl ... https://api.anthropic.com/v1/messages` with the key destined for Deno Deploy.
- [ ] HTTP 200 expected.

**Result:** PENDING (operator action)
**Notes:** Required before Phase 2 hosted deploy. The same key is set in Deno Deploy env in Phase 2; a healthy preflight prevents ambiguous mid-Phase-5 failures.

---

## Phase 1 — Local smoke

- [x] `cd mcp-server && deno task start` started server on port 8080 in fixture mode (background PID terminated post-smoke).
- [x] `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>` exited 0.
- [x] All 9 checks PASS.
- [x] No secrets present in stdout / stderr (script prints `Token: [REDACTED]`).

**Result:** PASS
**Notes:**
- Server env: `MCP_SERVER_BEARER_TOKEN=<64-byte hex>`, `MCP_SERVER_ENV=local`, `MCP_SERVER_USE_FIXTURE_PROVIDER=true`, `MODEL_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=<placeholder>` (placeholder required to satisfy Check 1's `credentialsConfigured: true` assertion in fixture mode; no real Anthropic call).
- Smoke output captured below verbatim:

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

- [ ] Deployed to Deno Deploy project: \<project name\>
- [ ] Environment variables set:
  - [ ] `MCP_SERVER_BEARER_TOKEN`
  - [ ] `ANTHROPIC_API_KEY`
  - [ ] `MODEL_PROVIDER=anthropic`
  - [ ] `MCP_SERVER_ENV=prod`
  - [ ] Optional: `ANTHROPIC_MODEL` pinned
  - [ ] Optional: `MCP_SERVER_ALLOWED_ORIGINS` pinned
- [ ] Deployed URL noted: \____________________________
- [ ] `MCP_SERVER_USE_FIXTURE_PROVIDER` is NOT set in prod env

**Result:** PASS / FAIL
**Notes:**

---

## Phase 3 — Hosted smoke

- [ ] `bash scripts/mcp-server-001-smoke.sh --base-url https://<deployed> --token <token>` exited 0.
- [ ] All 9 checks PASS.
- [ ] `/health` endpoint reachable WITHOUT bearer (returns 200).
- [ ] `/health` body contains `credentialsConfigured: true`.
- [ ] No 5xx errors on N=3 repeat runs.

**Result:** PASS / FAIL
**Notes:**

---

## Phase 4 — Supabase secret wiring

- [ ] `SEMANTIC_REFEREE_MCP_URL=https://<deployed>/mcp/adapter-compat` set via `npx supabase secrets set` (NOTE: URL points at `/mcp/adapter-compat`, NOT `/mcp`).
- [ ] `SEMANTIC_REFEREE_MCP_TOKEN=<token>` set via `npx supabase secrets set`.
- [ ] `npx supabase secrets list --project-ref qsciikhztvzzohssddrq | grep SEMANTIC_REFEREE_MCP` shows BOTH secrets.

**Result:** PASS / FAIL
**Notes:**

---

## Phase 5 — MCP-018 integration

- [ ] Triggered semantic-referee path on a test room (via the MCP-018 integration runbook OR a direct `semantic-referee` Edge Function invoke).
- [ ] Returned `SemanticRefereePacket` has `provider: 'mcp'` (NOT `'mock'`, NOT `'anthropic'`).
- [ ] `authoritative` is `false`.
- [ ] `binaries[]` carries one entry per requested classifier.
- [ ] No `deterministic_fallback` outcomes on N=3 test calls.

**Result:** PASS / FAIL
**Notes:**

---

## Verdict

- [ ] **PASS (all 5 phases)** — MCP-SERVER-002 + ADMIN-MCP-001 are AUTHORIZED to file.
- [ ] **PARTIAL** — some checks failed; specifics documented above.
- [ ] **FAIL** — server doesn't deploy OR MCP-018 route fails; file MCP-SERVER-001-FIX.

---

## Common failure_reason interpretations

| Symptom | Likely cause | Fix |
|---|---|---|
| Phase 1 health 401 | Health endpoint accidentally authed | Server misconfig (regression) |
| Phase 1 check 4 fails with 401 | Token mismatch local | Re-verify `.env.local` MCP_SERVER_BEARER_TOKEN |
| Phase 1 check 4 returns `reason: key_missing` | Anthropic key blank AND fixture flag not set | Set `MCP_SERVER_USE_FIXTURE_PROVIDER=true` for offline smoke, OR set ANTHROPIC_API_KEY |
| Phase 3 check 4 fails with `validation_failed` | Anthropic returned a shape the server rejected | Check Deno Deploy logs; the request likely tripped the doctrine ban-list or schema check |
| Phase 5 returns `provider: 'mock'` | `SEMANTIC_REFEREE_PROVIDER=mcp` not set OR Edge Function not redeployed | Set the secret and redeploy `semantic-referee` |
| Phase 5 returns `enabled: false, reason: 'not_configured'` | Supabase secrets URL/TOKEN absent or wrong | Verify Phase 4; check the URL has `/mcp/adapter-compat` suffix |
| Phase 5 returns `enabled: false, reason: 'parse_failure'` | Server returned an unrecognized envelope shape | Check server's `/mcp/adapter-compat` returns `{result: {...}}` (priority-1) |
| Phase 5 returns `enabled: false, reason: 'validation_failed'` | Server returned a doctrine-violating packet | Check server logs; check ban-list scan; confirm prompt parity |
| Phase 5 returns `enabled: false, reason: 'rate_limited'` | Anthropic 429 | Wait and retry; check Anthropic console rate limits |
| Phase 5 returns `enabled: false, reason: 'network_error'` | DNS/TLS/connection problem | Verify Deno Deploy is healthy; check Supabase egress |
