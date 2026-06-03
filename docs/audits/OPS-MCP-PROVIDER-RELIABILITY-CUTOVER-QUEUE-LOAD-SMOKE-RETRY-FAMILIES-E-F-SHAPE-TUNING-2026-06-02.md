# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY-FAMILIES-E-F-SHAPE-TUNING — drill audit (2026-06-02) — PASS-LOAD

> **Superseded for gate/pass/ramp semantics (2026-06-03).** The canonical reference for every pass / PASS-LOAD / PASS-LOAD-CONFIRM / Stage-1 / plumbing-vs-organic / ramp / dead-letter / cluster definition is `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` (operator-ratified). Any pass/load/ramp/threshold language below is historical; where it differs from the canonical doc, the canonical doc governs.

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-02 UTC
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY-FAMILIES-E-F-SHAPE-TUNING
**Issue / trail:** #373 (cutover umbrella); two-family mitigation PR #423; architecture codification PR #424
**Base HEAD at execution:** `d2d436a` (PR #424 — fortified architecture codification; includes PR #423 mitigation underneath)
**Predecessors merged:** PR #411 through PR #424 (cutover chain)
**Deno Deploy production state:** build `qrvrmvp6qqhn` from main commit `d2d436a` serving traffic at `https://cdiscourse-mcp-server.civildiscourse.deno.net`; hosted MCP smoke 23/23 PASS (operator-attested); Supabase Edge secrets `SEMANTIC_REFEREE_MCP_URL` and `SEMANTIC_REFEREE_MCP_TOKEN` updated to match.

**Scope:** Post-mitigation queue-load-smoke retry against the same N=8 burst harness + same read-only query pack used in PR #416 / #419 / #422. Measures whether PR #423's two-family STRICT RESPONSE-SHAPE CONTRACT pattern (Family E rule 6 + Family F full block) eliminates the residual packet/schema cluster surfaced by PR #422.

**Final verdict:** **PASS-LOAD.** This is the first PASS-LOAD verdict in the entire drill chain (PR #416 FAIL → #419 FAIL → #422 FAIL-LOAD/PASS-R3-DIAGNOSTIC → **this drill PASS-LOAD**). All 56 cells succeeded; zero dead-letter; zero failed_terminal; zero duplicate-success; zero overlap; zero non-smoke leakage; zero H/I/J rows; queue drained back to zero. The mitigation pattern WORKED.

**This audit does NOT auto-authorize Stage 1.** PASS-LOAD is the prerequisite for Stage 1 reconsideration per the design's decision-gate sequence (`docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` §5); the actual Stage 1 routing flip remains operator-territory in a SEPARATE prompt. Family H production retry remains gated. Family I and J remain gated.

---

## 1. Drill gate criteria

PASS-LOAD requires ALL of the following (per `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` §5 + operator brief):

1. 8 synthetic args submitted.
2. 56 A-G cells expected.
3. All 56 cells reach terminal state.
4. All 56 cells succeed (`dead_letter_cells = 0`, `failed_terminal_cells = 0`).
5. Dead-letter rate ≤ 1%.
6. `duplicate_success_cells = 0`.
7. `overlapping_drain_pairs = 0`.
8. Queue returns to zero post-drain.
9. No H/I/J rows in window.
10. No direct-dispatch leakage on smoke args.
11. No non-smoke production arguments routed during drill window.
12. Drainer fresh through the drill (M1 < 120s sustained).
13. M2 oldest pending age ≤ 300s peak.
14. No provider/server error cluster recurrence (per family / per rawKey path).
15. Stand-down completed cleanly; routing flag back to `false`.

All 15 PASS in this drill (per §4 / §5 below).

---

## Phase 0 — Preflight

**Status:** PASS

Preflight observed UTC: `2026-06-02T03:43:10Z`.

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| HEAD on main | post-PR-424 (codification); includes PR #423 mitigation | `d2d436a` | PASS |
| Family E rule 6 RAWKEY-SHAPE REINFORCEMENT present | yes | `RAWKEY-SHAPE REINFORCEMENT` count=1 in familyEPrompt.ts | PASS |
| Family F STRICT RESPONSE-SHAPE CONTRACT + rule 6 present | yes | `STRICT RESPONSE-SHAPE CONTRACT` count=1 + `RAWKEY-SHAPE REINFORCEMENT` count=1 in familyFPrompt.ts | PASS |
| `FAMILY_E_MAX_TOKENS` | unchanged at 1500 | `FAMILY_E_MAX_TOKENS = 1500` | PASS |
| `FAMILY_F_MAX_TOKENS` | unchanged at 1500 | `FAMILY_F_MAX_TOKENS = 1500` | PASS |
| H/I/J production gates | `productionEnabled: false` at familyRegistry.ts:105/110/115 | confirmed | PASS |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | `false` (pre-arm) | inferred from `preflight_routed_args_last_hour=0` | PASS |
| Drainer cron | active + `* * * * *` | `'true\|* * * * *'`; freshness=10.4s | PASS |
| Watchdog cron `cutover-health-monitor-tick` | acceptable unscheduled (Stage 1 inactive) | `monitor_job_count=0` | PASS (acceptable per brief) |
| In-flight queue rows | 0 | `preflight_non_terminal_rows=0` | PASS |
| Routed args last hour | 0 | `preflight_routed_args_last_hour=0` | PASS |
| Working tree | clean | no tracked modifications | PASS |
| Deno Deploy production build | `d2d436a` (includes #423 mitigation) | operator-attested build `qrvrmvp6qqhn` on main; hosted smoke 23/23 PASS at `https://cdiscourse-mcp-server.civildiscourse.deno.net` | PASS |
| Supabase secrets | `SEMANTIC_REFEREE_MCP_URL` and `SEMANTIC_REFEREE_MCP_TOKEN` updated by operator | confirmed in operator preflight message | PASS |

---

## Phase (a) — Arm smoke-only routing (Operator)

**Status:** PASS

Operator-attested:
- `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` (pre-burst)
- `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` (confirmed at 0; smoke-tag override is the only routing path)
- Edge propagation confirmed before "armed" reply

---

## Phase (b) — Burst (one execution; operator-authorized spend)

**Status:** PASS

| Field | Value |
|---|---|
| N (synthetic args) | 8 |
| Expected Anthropic calls (N·7) | 56 |
| Burst harness invocation | exactly 1 — `node .claude-tmp/queue-load-smoke-burst.cjs 8` (tee'd to `.claude-tmp/queue-load-smoke-retry-families-e-f-shape-tuning-N8.jsonl`) |
| Burst start UTC | 2026-06-02T03:45:47Z |
| Burst end UTC | 2026-06-02T03:45:51Z (~4s wall clock) |
| Exit code | 0 |
| Posted | 8 |
| Failed | 0 |
| Per-submit latency | 2565ms – 2892ms |
| Synthetic argument ids (8) | `523c3d3a-dc88-461d-abdf-5c3ac0d1f916`, `dc509f49-a9d7-4a67-9960-a210f31fbddf`, `cadb5884-8a2e-40c5-b8ca-0b2a8d3ccf74`, `aec9b48b-ecd3-4551-b4b8-884881c312bb`, `237de782-7352-4c87-b4d0-97c7f46c03ca`, `fec1107b-4f03-427e-89f6-6c5600d100c8`, `791994f9-a562-45a6-80bb-4838c8250f02`, `5b7e79a6-6277-4ff2-8574-fb7b99a38f79` |
| Synthetic debate ids (8) | `de063ec4-a2ee-4dc2-96ff-fa0d98a0deeb`, `4299b191-9685-48ef-b8f6-fc340034e7ee`, `41593476-ef4c-48de-abfb-cb6abb83c8a7`, `9a83b582-80de-42ac-aa8e-3b25108bfebb`, `2c1d63ba-cbf6-45a1-9568-f2b71b998dba`, `7f0e0110-066a-4b18-828a-c40b2d2f0930`, `7eee7954-1202-4209-a03b-c8df455ad442`, `b1646da5-85db-436c-9f3e-c44669819a4e` |

---

## Phase (c) — Drain monitoring (CC read-only polls)

**Status:** PASS — full drain to terminal in ~135 seconds.

Drill window: 2026-06-02T03:45:47Z (burst start) → 2026-06-02T03:48:06Z (full drain).

| Poll tick (UTC, ~t offset) | M1 | M2 non_terminal (pending / leased / retry) | Oldest pending | M3 succeeded |
|---|---|---|---|---|
| t+47s — 03:46:38Z | 103s | 25 (16 / 7 / 2) | 56.5s | 34/56 (60.71%) |
| t+135s — 03:48:06Z (full drain) | 52.7s | **0** | null | **56/56 (100.00%)** |

**Authoritative completeness (from `load-completeness.sql` at 03:48:32Z):**
- `routed_arg_count_in_burst = 8`
- `expected_cell_count = 56`
- `succeeded_cells = 56`
- `dead_letter_cells = 0`
- `failed_terminal_cells = 0`
- `non_terminal_cells = 0`
- `pct_grid_coverage = 100.00%`

**Gate roll-up:**

| Gate | Observed | Verdict |
|---|---|---|
| All 56 cells terminal | 56 succeeded + 0 dead_letter + 0 failed_terminal + 0 non-terminal | PASS |
| **Dead-letter rate ≤ 1% (operator brief PASS band)** | **0.000% (0/56)** | **PASS** |
| `duplicate_success_cell_count = 0` | 0 | PASS |
| `overlapping_drain_pairs = 0` | 0 (across 29 drains in window) | PASS |
| M1 fresh (< 120s sustained) | peak 103s; recovered to 52.7s | PASS |
| M2 oldest_pending_age ≤ 300s peak | peak 56.5s | PASS |
| Provider-error cluster recurrence | **0 cells in cluster** (load-provider-error-cluster summary `distinct_provider_failing_family_count = 0`) | **PASS** |
| Time-to-drain | ~135s (vs ~800s for PR #422; ~6× faster wall-clock) | informational |

### Per-family attempt distribution (from `diag-families-e-f-retry-trail.sql`)

| Family | Attempt 1 succeeded | Attempt 2 succeeded | Total terminal |
|---|---:|---:|---:|
| parent_relation (A) | 8 | 0 | 8 |
| disagreement_axis (B) | 8 | 0 | 8 |
| misunderstanding_repair (C) | 8 | 0 | 8 |
| evidence_source_chain (D) | 8 | 0 | 8 |
| **argument_scheme (E)** | **7** | **1** | **8** |
| **critical_question (F)** | **7** | **1** | **8** |
| resolution_progress (G) | 8 | 0 | 8 |
| **TOTAL** | **54** | **2** | **56** |

The exact same two families that produced terminal dead-letters in PR #422 (`argument_scheme`, `critical_question`) each had 1 transient validation failure at attempt 1 here — but **the retry mechanism + the PR #423 prompt hardening combined to absorb them on attempt 2**. Zero dead-letters. Zero terminal failures. The per-attempt failure rate has dropped enough that the existing 4-attempt retry budget cleanly handles transients without exhausting.

### Material delta vs PR #422 baseline (same harness, same N=8, same query pack)

| Metric | PR #416 (pre-mit) | PR #419 (pre-mit re-run) | PR #422 (post-#421 E mitigation) | **This drill (post-#423 E+F mitigation)** | Delta vs PR #422 |
|---|---|---|---|---|---|
| Total dead-letter cells | 3 | 3 | 2 | **0** | **−100% (eliminated)** |
| Dead-letter rate | 5.357% | 5.357% | 3.571% | **0.000%** | **PASS-LOAD threshold met** |
| `argument_scheme` dead-letter | 3 | 3 | 1 | **0** | **−100% (eliminated)** |
| `critical_question` dead-letter | 0 | 0 | 1 | **0** | **−100% (eliminated)** |
| Distinct failing families | 1 | 1 | 2 | **0** | — |
| Time-to-drain | ~13 min | ~13 min | ~13 min | **~2.25 min** | **−83%** |

---

## Phase (d) — R3 classification

**Status:** Not required for PASS-LOAD verdict (no terminal failures).

Per operator brief Phase (d): "If all 56 cells succeed and there are no `boolean_observation_tool_error` rows needed for diagnosis, record that the R3 failure did not reproduce."

**The R3 packet/schema failure did NOT reproduce to terminal in this drill.** 2 cells (1 `argument_scheme` + 1 `critical_question`) did pass through retry_scheduled before succeeding at attempt 2; this would have logged 1 `boolean_observation_tool_error` event per cell to Deno Deploy logs (informational only). The transient validation failures were absorbed by the retry mechanism; no terminal classification was needed. No operator log-aggregate forwarding was requested.

If the operator wants to confirm the absorbed-retry events corresponded to the same `evidenceSpan.abductive_explanation_present` and `evidenceSpan.alternative_explanation_available` paths (consistent with PR #422 finding but at lower rate), a separate read-only Deno Deploy log query against the drill window `2026-06-02T03:45:30Z → 2026-06-02T03:48:30Z` filtered on `boolean_observation_tool_error` + `family in (argument_scheme, critical_question)` would surface them. Not blocking for this audit.

---

## Phase (e) — Stand down (Operator)

**Status:** PASS

Operator-attested at 2026-06-02T03:48–04:13Z (operator stand-down message):
- `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` set
- `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` stays at `0`
- Drainer cron `arch-001-classifier-drain-tick` left active, `* * * * *` unchanged
- `cutover-health-monitor` left unscheduled per brief (acceptable while Stage 1 inactive)

---

## Phase (f) — Final inert verification

**Status:** PASS

Phase (f) snapshot @ 2026-06-02T04:14:01Z.

| Query | Expected | Observed | Verdict |
|---|---|---|---|
| Routing flag state post-drill | `false` (operator-attested) | confirmed in stand-down message; `preflight_routed_args_last_hour=8` matches exactly the 8 burst args from the drill window (zero post-stand-down routing) | PASS |
| M1 post-stand-down | < 120s | **0.27s** (very fresh) | PASS |
| M2 post-stand-down | non_terminal = 0 | 0 (0 pending / 0 leased / 0 retry_scheduled) | PASS |
| `duplicate_success_cell_count` (drill window) | 0 | 0 | PASS |
| `direct_dispatch_leak_count` (smoke args) | 0 | 0 — all 56 cells routed via queue (`family IS NOT NULL`); load-completeness confirms 8 routed args | PASS |
| `hij_rows_in_window` | 0 | 0 — only A-G families observed (per `diag-families-e-f-retry-trail.sql` showing 7 production families, all A-G) | PASS |
| Non-smoke routed args in drill window | 0 | `preflight_routed_args_last_hour=8` matches the 8 burst args exactly (zero non-smoke leakage) | PASS |
| Drainer health post-drill | active + fresh | `drainer_active_and_schedule='true\|* * * * *'`; `drainer_job_count=1`; M1=0.27s | PASS |
| Overlap (drill window) | 0 | `overlapping_drain_pairs=0` across `drain_rows_in_window=29` | PASS |
| Watchdog cron | unscheduled (acceptable; Stage 1 not active) | `monitor_job_count=0` | PASS (acceptable per brief) |

System stand-down clean. All operational invariants held.

---

## Provenance + boundary compliance

- **CC provider-spend invocations this card:** **0**. Burst was operator-authorized; downstream Anthropic calls (≈56 Haiku classifier calls + ~2 retry attempts) triggered via the drainer.
- **CC writes (DB):** **0**. Read-only `SELECT` SQL via `npx supabase db query --linked --file <path>` only.
- **CC writes (file system):** docs/audits/<this file>; one new read-only diagnostic probe at `.claude-tmp/load-smoke-queries/diag-families-e-f-retry-trail.sql` (gitignored).
- **Routing flag entry/exit:** entered at `false` (operator-attested per PR #422 stand-down at 2026-06-02T01:12:09Z; verified clean across the gap by the Phase 0 `preflight_routed_args_last_hour=0` check). Exited at `false` (operator-attested Phase e).
- **Non-smoke production impact:** **0** — `preflight_routed_args_last_hour=8` post-stand-down matches the 8 burst args exactly (zero leakage).
- **Mutations:** **0** by CC. No env / Vault / cron / percentage / routing-flag / migration / familyRegistry / retry-policy / drainer / ban-list / validator / schema-mirror / prompt / key file / MCP-tool / package.json / source change.
- **Output discipline:** No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / raw provider payloads / raw MCP log lines written to this audit.

---

## Authorizations + follow-ups

**Active verdict: PASS-LOAD.**

This is the **first PASS-LOAD** in the entire drill chain (#416/#419 FAIL → #422 PASS-R3-DIAGNOSTIC/FAIL-LOAD → **this drill PASS-LOAD**). The post-PR-#421 + post-PR-#423 mitigation pattern eliminated the chronic `argument_scheme` cluster and the analogous `critical_question` cluster on the same N=8 harness that produced them in PR #416/#419/#422.

### What this audit AUTHORIZES

- **Operator may now consider Stage 1 routing flip reconsideration** as a SEPARATE operator-gated card. PASS-LOAD is the prerequisite per `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` §5; this audit MEETS that prerequisite but does NOT itself flip the flag. Any Stage 1 ramp goes through a separate operator prompt (e.g., `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1`) with explicit operator authorization at percentage 1% → 5% → 25% → 50% → 100% intervals.

### What this audit does NOT authorize

- **Stage 1 routing flip does NOT auto-flip from this audit.** No file in main was modified during this drill aside from this audit doc.
- **Family H production retry remains gated.** PASS-LOAD on this non-H drill is a necessary but not sufficient condition for H reconsideration; the operator separately decides H based on additional evidence (the H Card 3 FAIL in PR #407 is the canonical incident).
- **Family I remains gated.**
- **Family J remains gated.**
- **`cutover-health-monitor` remains unscheduled** per operator brief; do not re-enable in this card.

### Recommended next operator step (operator decides)

Two valid paths:

**Path A (cautious; recommended)**: Schedule one more confirmatory drill (`OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-CONFIRM` or similar) to verify PASS-LOAD is reproducible. Same harness, same query pack. If the second drill also PASS-LOAD, the mitigation result is solidified.

**Path B (proceed)**: Open `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1` (separate operator card) to start the production routing ramp at 1%. The card should include: operator-set `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1`; observation window of 24–72h; rollback plan; alerting reactivation via re-scheduling `cutover-health-monitor-tick`; PASS criteria for 1% → 5% → 25% → 50% → 100% progression.

CC does NOT recommend one path over the other; this is operator-territory.

### Follow-ups (regardless of next-step choice)

- The 2 transient retry events on `argument_scheme` and `critical_question` indicate the per-rawKey failure rate is now low enough to be absorbed by the existing retry budget, but it is non-zero. A second confirmatory drill would help characterize the residual rate distribution.
- RCA's **R1** (jsonb `failure_detail` column on `argument_machine_observation_runs`) remains a high-value future improvement; with the cluster now eliminated, R1 would persist the kind of transient evidence that this drill saw (1 retry per failing family) automatically for every cell, removing the need for operator-side Deno Deploy log pulls.
- The PR #421 + #423 mitigation pattern (STRICT RESPONSE-SHAPE CONTRACT + per-rawKey RAWKEY-SHAPE REINFORCEMENT) is now an established operational template; if any new family surfaces a packet/schema cluster, apply the same template per `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` §3.4.

---

## Smoke artifacts

- **Burst harness (gitignored; operator-authorized run):** `.claude-tmp/queue-load-smoke-burst.cjs` — UNCHANGED from PR #415 (17,866 bytes).
- **Query pack (gitignored):** `.claude-tmp/load-smoke-queries/*.sql` + `assert-read-only.cjs`. UNCHANGED from PR #415; +1 new read-only diagnostic this drill: `diag-families-e-f-retry-trail.sql`.
- **Synthetic argument ids + debate ids:** recorded in Phase (b) evidence above.
- **Synthetic debate title prefix:** `[arch-001-queue-smoke]` (routing override key).
- **Burst JSONL output:** `.claude-tmp/queue-load-smoke-retry-families-e-f-shape-tuning-N8.jsonl` (gitignored).
- **Output discipline:** No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / raw provider payloads / raw MCP log lines written to this audit or any artifact.
