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
| **PR #425 (post-PR-#423 E+F mitigation)** | **0** | **0** | **0.000%** | none terminal — **PASS-LOAD** (2 transient retries on E + F, both recovered on attempt 2) |
| **PR #426 (confirmatory)** | **0** | **0** | **0.000%** | none terminal — **PASS-LOAD-CONFIRM** (1 transient retry on `evidence_source_chain`, recovered on attempt 2) |

Mitigation pattern established by PR #421 + #423:
- **STRICT RESPONSE-SHAPE CONTRACT** block in the family's user prompt (key-set equality across all four maps; evidenceSpan value-type rules; null-for-false convention; pre-emit self-check).
- **Per-rawKey RAWKEY-SHAPE REINFORCEMENT** for the specific failing path (re-enumerates allowed string-or-null + forbidden object/array/boolean/number).

The pattern is **probabilistic** and **reproducibly successful**: PR #421 reduced E from 3 → 1; PR #423 extended to F and added rule 6 reinforcement on E; PR #425 achieved the first **PASS-LOAD** (0 dead-letter, 56/56); PR #426 **confirmed reproducibility** (PASS-LOAD-CONFIRM, second consecutive 56/56). The packet/schema cluster is **eliminated to terminal**. A residual ~1–2 cells per drill (~2–4% per-attempt) surfaces a transient validation failure on a *varying* family each drill (E+F in #425, D in #426), but the 4-attempt retry budget absorbs every transient before it reaches terminal. The cluster is gone; the transient floor is comfortably within the retry budget.

---

## 6. Next operator gates

**Progress as of PR #426 + the canary-then-burst runbook card:** Steps 1–3 below are COMPLETE. The deploy landed (Deno Deploy build `qrvrmvp6qqhn` from `d2d436a`), hosted smoke passed 23/23, and two consecutive PASS-LOAD drills (#425 + #426) eliminated the cluster. The next gate is Stage 1 reconsideration, which is a SEPARATE operator-gated card.

Strict sequence; do NOT skip steps:

1. ~~**Deno Deploy push**~~ — DONE. `mcp-server/` build serving production at `https://cdiscourse-mcp-server.civildiscourse.deno.net`.
2. ~~**Hosted MCP smoke**~~ — DONE. 23/23 PASS (operator-attested at PR #425/#426).
3. ~~**Queue-load-smoke retry**~~ — DONE twice. PR #425 PASS-LOAD; PR #426 PASS-LOAD-CONFIRM. Both 56/56, 0 dead-letter.
4. **Arming discipline (binding for ALL queue-routing drills, including Stage 1):** the **canary-then-burst** sequence (design doc §3.7). Operator sets the routing flag, verifies via `secrets list`, waits ≥ 120s; CC runs an N=1 canary; CC confirms 7 A-G rows with `family IS NOT NULL` and zero H/I/J; ONLY THEN CC runs the N=8 burst. If the canary shows `family = NULL`, HALT — routing did not propagate. The canary is a routing-path verification gate, NOT a substitute for N=8. Codified in `docs/audits/OPS-MCP-CANARY-THEN-BURST-RUNBOOK-2026-06-02.md`.
5. **Stage 1 reconsideration** (separate operator-gated card `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1`): the two PASS-LOAD drills MEET the PASS-LOAD prerequisite, but reconsideration is still a deliberate operator decision. Stage 1 at **1% only** (`CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1`); 5% → 25% → 50% → 100% each require a SEPARATE operator authorization. **NEVER auto-flip from any audit.** Re-enable `cutover-health-monitor-tick` as part of Stage 1, not before.
6. **Family H production retry** stays gated until a PASS-LOAD on a non-H drill PLUS a separate operator decision (the PR #407 H Card 3 FAIL is the canonical incident).
7. **Family I and J** stay gated; scoping only.

---

## 7. Provenance

This status doc is docs-only codification. Created in PR #424 (`docs/audits/OPS-MCP-FORTIFIED-ARCHITECTURE-DOCS-2026-06-02.md`); extended in the canary-then-burst runbook card (`docs/audits/OPS-MCP-CANARY-THEN-BURST-RUNBOOK-2026-06-02.md`) with the §5 PASS-LOAD/PASS-LOAD-CONFIRM drill rows and §6 gate-progress update. No runtime change. No env/Vault/cron/familyRegistry/migration/source-6 mutation by Claude.
