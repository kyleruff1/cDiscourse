# MCP-SERVER-001-SMOKE — Template

Copy this template to `docs/audits/MCP-SERVER-001-SMOKE-<YYYY-MM-DD>.md` and tick each box as you complete the five phases. The operator's signed-off copy is the source of truth that MCP-SERVER-001 shipped.

---

# MCP-SERVER-001-SMOKE — <YYYY-MM-DD>

**Operator:** \<name\>
**Date:** \<ISO date\>
**Server URL:** \<deployed URL\>
**Server commit:** \<git SHA of `mcp-server/` at deploy time\>
**Supabase project ref:** qsciikhztvzzohssddrq

---

## Phase 1 — Local smoke

- [ ] `cd mcp-server && deno task dev` started server on port 8080.
- [ ] `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>` exited 0.
- [ ] All 9 checks PASS.
- [ ] No secrets present in stdout / stderr (visual scan).

**Result:** PASS / FAIL
**Notes:**

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
