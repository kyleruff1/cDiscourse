# OPS-MCP-FORTIFIED-ARCHITECTURE — current status (2026-06-02)

Snapshot of the cutover/MCP/queue/deployment posture after PR #423. Codifies operational knowledge so the next queue-load-smoke retry can proceed from a single source of truth without re-derivation. Companion design doc: `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md`. Codification audit: `docs/audits/OPS-MCP-FORTIFIED-ARCHITECTURE-DOCS-2026-06-02.md`.

This document is **status, not authorization**. It does NOT authorize Stage 1, H production retry, or any new family. Authorization is operator-territory and lives in a separate prompt per gate.

---

## 1. Family posture

| Family | Letter | Production | Admin validation | Production retry gate |
|---|---|---|---|---|
| parent_relation | A | enabled | enabled | — |
| disagreement_axis | B | enabled | enabled | — |
| misunderstanding_repair | C | enabled | enabled | — |
| evidence_source_chain | D | enabled | enabled | — |
| argument_scheme | E | enabled | enabled | — |
| critical_question | F | enabled | enabled | — |
| resolution_progress | G | enabled | enabled | — |
| claim_clarity | H | **disabled** | enabled | **GATED** (Card 3 production-enable smoke FAIL'd in PR #407; rolled back in PR #408; retry blocked on PASS-LOAD) |
| thread_topology | I | **disabled** | n/a | **GATED** (scoping audit only at `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md`) |
| sensitive_composer | J | **disabled** | n/a | **GATED** (scoping only) |

Source: `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — H at line 106, I at line 111, J at line 116, all `productionEnabled: false`. Do not flip without a separate operator card; the rollback in PR #408 is the canonical incident.

---

## 2. Queue posture

| Surface | Required steady state | Operational notes |
|---|---|---|
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | `false` outside drills | Operator-only env mutation; CC NEVER touches |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | `0` always (until separate Stage 1 authorization) | Smoke-tag override is the ONLY routing path used in drills to date |
| Smoke-tag prefix | `[arch-001-queue-smoke]` | Routes only when `_ENABLED=true` AND title carries this prefix; non-smoke debates still take legacy direct-dispatch |
| Drainer cron `arch-001-classifier-drain-tick` | active, `* * * * *` | M1 freshness < 120s = healthy |
| Watchdog cron `cutover-health-monitor-tick` | acceptable to be unscheduled while Stage 1 is inactive | Re-schedule before Stage 1 reconsideration |
| Queue residency post-drill | `non_terminal_rows = 0` | Verify via `.claude-tmp/load-smoke-queries/m2-queue-depth.sql` |
| `preflight_routed_args_last_hour` post-stand-down | matches exactly the in-window burst args; `0` for older windows | Confirms zero non-smoke leakage |

Drainer constants (locked; do not tune in this card):
- `DRAINER_PROVIDER_CONCURRENCY = 3` (`classifierDrainerCore.ts:65`)
- `DRAINER_WALL_CLOCK_BUDGET_MS = 90_000`
- `DRAINER_LEASE_TTL_SECONDS = 130`
- `DRAINER_MAX_ATTEMPTS = 4` (`classifierDrainerRetryPolicy.ts:53`)
- `DRAINER_RETRY_BACKOFF_SECONDS = [30, 120]` (clamped repeat for attempt 3→4)
- Edge→MCP fetch timeout: `15000ms` (`booleanObservationMcpAdapter.ts:142`)

---

## 3. MCP deployment posture (the critical architectural fact)

**`mcp-server/` deploys to Deno Deploy, NOT to Supabase Edge Functions.** This split surfaced in PR #420's R3 classification investigation and was sharpened in PR #422 / #423.

| Surface | Hosting | Auto-deploy on merge to main? | Where R3 logs live |
|---|---|---|---|
| `supabase/functions/*` (incl. `submit-argument`, `classifier-drainer`, `classify-argument-boolean-observations` proxy, `cutover-health-monitor`) | Supabase Edge | **YES** via the Supabase GitHub integration | Supabase function_logs |
| `mcp-server/*` (Deno app with the tool handlers, prompts, ban-list scanners, validators) | **Deno Deploy** project `cdiscourse-mcp-server` | **NO** — separate operator-driven push | **Deno Deploy** project logs (`cdiscourse-mcp-server` → Logs) |

Concrete URLs:
- **Production Deno Deploy base URL (current)**: `https://cdiscourse-mcp-server-39aev5ek2c4e.civildiscourse.deno.net`
- **Health**: `GET /health` (unauthenticated; uptime + capability ping)
- **Root**: `GET /` returns 404 — **this is expected**, not a deployment problem
- **Supabase adapter endpoint**: `POST /mcp/adapter-compat` (Bearer; what `SEMANTIC_REFEREE_MCP_URL` must point at)
- **Spec-compliant endpoint**: `POST /mcp` (Bearer; for future JSON-RPC callers; NOT what MCP-018 uses)

Hosted smoke (run from repo root):

```bash
cd ~/cdiscourse/debate-constitution-app
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server-39aev5ek2c4e.civildiscourse.deno.net \
  --token "$MCP_SERVER_BEARER_TOKEN"
# Expect: 23/23 PASS, exit 0 (PR #421 + #422 + #423 all met this gate post-deploy)
```

**Decisive operator step every time `mcp-server/` code changes**: push to Deno Deploy after the PR merges. Supabase merge auto-deploy will redeploy the proxy/adapter Edge Functions but will NOT carry MCP server code. If you skip the Deno Deploy push, the queue retry will hit the previous MCP build and the prompt fix will not be in effect.

---

## 4. Secrets posture

| Secret name | Lives in | Set by | Notes |
|---|---|---|---|
| `MCP_SERVER_BEARER_TOKEN` | Deno Deploy env vars | Dashboard → Settings → Environment Variables | Long random hex; rotate freely (see runbook §"Token rotation") |
| `ANTHROPIC_API_KEY` | Deno Deploy env vars | Dashboard | Server-side only; never leaves Deno Deploy |
| `SEMANTIC_REFEREE_MCP_URL` | Supabase Edge Function secrets | `npx supabase secrets set` | MUST point at `<deno-deploy-base>/mcp/adapter-compat`; NEVER `/mcp` |
| `SEMANTIC_REFEREE_MCP_TOKEN` | Supabase Edge Function secrets | `npx supabase secrets set` | Same value as Deno Deploy `MCP_SERVER_BEARER_TOKEN` |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` / `_PERCENTAGE` | Supabase Edge Function env | Operator-only | Default-off; only operator flips for drills |

### Supabase CLI auth for `secrets set` / `secrets list`

The Supabase CLI requires a **Supabase account personal access token (PAT)** through the `SUPABASE_ACCESS_TOKEN` env variable for any secrets operation. This is:

- **NOT** the project anon key
- **NOT** the project service-role key
- **NOT** a database password

It is an account-level token issued from the operator's Supabase account settings. Example shape (operator-side, never committed, never printed):

```bash
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCOUNT_PAT" npx supabase secrets set \
  SEMANTIC_REFEREE_MCP_URL="https://cdiscourse-mcp-server-39aev5ek2c4e.civildiscourse.deno.net/mcp/adapter-compat" \
  SEMANTIC_REFEREE_MCP_TOKEN="$MCP_SERVER_BEARER_TOKEN" \
  --project-ref qsciikhztvzzohssddrq
```

After use, unset the shell variable so the token does not persist in the shell history or env: `unset SUPABASE_ACCESS_TOKEN SUPABASE_ACCOUNT_PAT MCP_SERVER_BEARER_TOKEN`.

**Doctrine reminders**:
- NEVER commit `.env*` files containing tokens.
- NEVER print tokens to chat, logs, audits, or PR bodies.
- NEVER pass tokens to subagents or external tools.
- NEVER paste tokens into CC chat — the operator runs the actual `secrets set` themselves.

---

## 5. Failure knowledge (carried forward)

The cluster that motivated this whole chain (PR #407 H Card 3 production-enable smoke FAIL → PR #408 rollback → PR #411-#423 cutover work) presented as `mcp_api_error` / `provider_server_error` on family cells under burst load. The R3 logging shipped in PR #418 partitioned the bucket:

- **H1 (Family E ban-list rejection)**: REFUTED for the post-#421 / post-#423 drills (zero `boolean_observations_doctrine_ban_list` co-occurrences).
- **H2 (Anthropic provider-side)**: REFUTED (Anthropic returned `httpStatus=200` + `anthropic_call_success` BEFORE each validation failure; zero `api_error`/`timeout`/`rate_limited`/`network_error`).
- **H3 (packet/schema validation)**: CONFIRMED; narrowed to two specific evidenceSpan rawKey paths.

| Drill | argument_scheme dead-letter | critical_question dead-letter | Total rate | Failing paths |
|---|---:|---:|---:|---|
| PR #416 (pre-mitigation) | 3 | 0 | 5.357% | `evidenceSpan.abductive_explanation_present` (3×) |
| PR #419 (re-run pre-mitigation) | 3 | 0 | 5.357% | same |
| PR #422 (post-PR-#421 E mitigation) | **1** | **1** | **3.571%** | `evidenceSpan.abductive_explanation_present` (3 R3 events on 1 cell); `evidenceSpan.alternative_explanation_available` (2 R3 events on 1 cell) |

Mitigation pattern established by PR #421 + #423:
- **STRICT RESPONSE-SHAPE CONTRACT** block in the family's user prompt (key-set equality across all four maps; evidenceSpan value-type rules; null-for-false convention; pre-emit self-check).
- **Per-rawKey RAWKEY-SHAPE REINFORCEMENT** for the specific failing path (re-enumerates allowed string-or-null + forbidden object/array/boolean/number).

The pattern is **probabilistic**: PR #421 reduced E from 3 → 1. PR #423 extends to F and adds rule 6 reinforcement on E. The next drill (separate card) measures the residual.

---

## 6. Next operator gates

Strict sequence; do NOT skip steps:

1. **Deno Deploy push**: `mcp-server/` post-PR-#423 build must be deployed to `cdiscourse-mcp-server` on Deno Deploy. PR #423's merge alone does NOT do this. Use `deployctl` from `mcp-server/` (or the Deno Deploy GitHub integration if configured at the Deno Deploy dashboard level — operator's choice). Confirm post-deploy via the deployment list in the Deno Deploy dashboard at a commit that includes `9ae3c7a`.
2. **Hosted MCP smoke**: `bash scripts/mcp-server-001-smoke.sh --base-url <deno-deploy-base> --token "$MCP_SERVER_BEARER_TOKEN"` from repo root. Expect 23/23 PASS, exit 0.
3. **Queue-load-smoke retry** (separate operator-gated card): `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY` style; same N=8 harness + same query pack. Compare per-family dead-letter rates against PR #422 baseline (1 E + 1 F = 2/56 = 3.571%). Possible outcomes:
   - **PASS-LOAD** (zero cluster): operator separately decides on Stage 1 reconsideration.
   - **Further-reduced FAIL-LOAD**: extend pattern to the next surfaced family, iterate.
   - **No-change FAIL-LOAD**: revisit token-budget hypothesis (still "possible contributor only" per wording discipline) and/or RCA's R1 jsonb `failure_detail` persistence.
4. **Stage 1 reconsideration** is gated on PASS-LOAD. NEVER auto-flip from any drill.
5. **Family H production retry** stays gated until PASS-LOAD on a non-H drill PLUS a separate operator decision.
6. **Family I and J** stay gated; scoping only.

---

## 7. Provenance

This status doc is docs-only codification. Created in PR (TBD via PR #424 — see `docs/audits/OPS-MCP-FORTIFIED-ARCHITECTURE-DOCS-2026-06-02.md`). No runtime change. No env/Vault/cron/familyRegistry/migration/source-6 mutation by Claude.
