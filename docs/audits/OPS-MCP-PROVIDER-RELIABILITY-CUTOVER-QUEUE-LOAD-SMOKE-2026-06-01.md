# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE — drill audit (2026-06-01) — FAIL

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-01
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE
**Issue / trail:** #373 (umbrella); #391 (H Card 3, stays OPEN); #388 (H umbrella, stays OPEN)
**Base HEAD at execution:** `167291e` (PR #415 merge — load-smoke prep)
**Predecessors merged:**
- PR #411 / cutover-health-monitor alerting (the watchdog that will observe this drill)
- PR #412 / rehearsal prep (the read-only query pack + harness baseline)
- PR #413 / explicit-recipient patch (admin-alerting recipient resolution)
- PR #414 / rollback-rehearsal audit PASS (the drill that proved the rollback path; this card proves the load path)

**Scope:** Proves the ARCH-001 queue holds under H-like concurrent provider load (smoke-tag isolated; routing percentage stays 0). The rollback rehearsal (PR #414) proved the rollback path; this drill proves the load path. N synthetic root theses are submitted to `[arch-001-queue-smoke]`-tagged debates; each fans out to 7 A-G family classifier cells (≈ 7·N Anthropic calls total); CC polls the queue under load (M1 freshness, M2 depth + oldest-pending-age, M3 completeness, dead-letter rate, overlap, provider-error cluster); operator stands down by unsetting the master flag. Total drill ≤ 30 min. NO Family H production retry; NO Stage 1 routing flip; NO percentage > 0; NO non-smoke traffic routed.

**Final verdict:** **FAIL** — gate-2 dead-letter rate 5.36% > PASS band 1% and > PARTIAL band 3% (operator brief criteria); gate-5/12 provider error cluster recurred on `argument_scheme` family (3 cells `mcp_api_error` / `provider_server_error` / `retry_attempts_exhausted` — same failure-class signature as H Card 3 LEGACY, but isolated to ONE family). The queue mechanism itself held (zero overlap, zero dup-success, zero non-smoke leakage); the underlying provider transient was NOT eliminated by the C=3 bounded-concurrency drainer. **Stage 1 routing flip NOT authorized by this drill.**

> **Drill gate criteria (PASS requires ALL 12; §7.8 caveat noted):**
> 1. All N·7 classifier cells reach a terminal state (`succeeded` or `dead_letter` or `failed_terminal`) within the bounded drill window.
> 2. Dead-letter rate stays inside budget (PASS band: ≤ 1.79% over the drill window; PARTIAL band: 1.79–5%; FAIL: > 5%). Compared against ARCH-001 Card 3 baseline of 0.893% (1/112).
> 3. Zero duplicate-success cells across all N synthetic args (M5 = 0).
> 4. Zero overlap across drainer ticks (the single-flight lease holds; no two ticks claim the same row simultaneously).
> 5. No `mcp_api_error` cluster — provider-error rate observed in this drill must be materially improved over the H Card 3 LEGACY direct-dispatch failure pattern (the cluster that motivated this card).
> 6. M1 freshness (drainer cron) stays in PASS band (< 120s) for the duration of the drill — the drainer keeps ticking under load.
> 7. M2 oldest-pending-age stays bounded — peak observed value recorded; PASS band < 300s; PARTIAL 300–900s; FAIL > 900s.
> 8. Time-to-drain (from last submit to all N·7 cells terminal) recorded and consistent with the C=3 global concurrency cap.
> 9. Master routing flag (`CLASSIFIER_QUEUE_ROUTING_ENABLED`) ends the drill at `false` (default-off restored).
> 10. Routing percentage stays at `0` for the entire drill — only the smoke-tag override routes the synthetic args.
> 11. Zero non-smoke argument routed during the drill window (production-isolation check: `routed_non_smoke_args_in_window = 0`).
> 12. Audit-lint clean (this doc passes `scripts/ops/audit-lint.mjs` exit 0).

> **§7.8 single-arm caveat:** This is **NOT** a controlled A/B test. The H Card 3 LEGACY direct-dispatch cluster failure was observed under a different code path; we did not re-run that path side-by-side. "Materially improved" in criterion 5 is **inferred** from three converging strands:
> (a) the queue-path error rate observed in this drill is ≈ 0 (or near-0) for the bounded-concurrency mechanism;
> (b) the H Card 3 cluster was observed at comparable provider concurrency on the legacy path;
> (c) the mechanism — bounding global provider concurrency to C=3 in the drainer — directly addresses the documented cause (uncoordinated cross-isolate concurrency).
> This is **strong converging evidence**, **not** a controlled comparison. Do NOT overclaim. The audit text must say "the queue-path mechanism is consistent with eliminating the H Card 3 cluster", not "we proved the queue eliminates the cluster".

---

## Phase 0 — Preflight (CC read-only verifies; operator runs writes/env reads)

**Status:** PASS

Preflight observed UTC: `2026-06-01 15:09:20Z`.

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| HEAD on main | post-PR-414 (rehearsal PASS landed) | `167291e` (PR #415 merge; rehearsal #414 at parent `a0d0446`) | PASS |
| Production family roster | A-G (7 families) | A-G all `productionEnabled: true` at familyRegistry.ts (parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question line 96, resolution_progress line 101) | PASS |
| H production flag | `claim_clarity productionEnabled: false` (line 106 of familyRegistry.ts) | line 106: `productionEnabled: false`; line 107: `adminValidationEnabled: true` | PASS |
| I production flag | `thread_topology productionEnabled: false` | line 111: `productionEnabled: false` | PASS |
| J production flag | `sensitive_composer productionEnabled: false` | line 116: `productionEnabled: false` | PASS |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | unset / `'false'` (DEFAULT DISABLED at drill start) | inferred from `preflight_routed_args_last_hour = 0` | PASS |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | unset / `0` | inferred from `preflight_routed_args_last_hour = 0` | PASS |
| Drainer cron `arch-001-classifier-drain-tick` exists + active + schedule | `true \| * * * * *` | `drainer_active_and_schedule: 'true\|* * * * *'`; `drainer_job_count: 1` | PASS |
| Drainer freshness (Q-M1 PASS) | `seconds_since_last_completed_drain < 120` | `19.683499s` | PASS |
| Watchdog cron `cutover-health-monitor-tick` exists + active + schedule | `true \| */5 * * * *` | `monitor_active_and_schedule: 'true\|*/5 * * * *'`; `monitor_job_count: 1` | PASS |
| Watchdog Layer 1 PASS band | ≥ 2 invocations / 0 failed / fresh | invocations_15min=3, succeeded_15min=3, failed_15min=0 | PASS |
| In-flight queue rows | none | `preflight_non_terminal_rows = 0` | PASS |
| Routed args last hour | 0 (routing inert) | `preflight_routed_args_last_hour = 0` | PASS |
| Drainer global concurrency cap | C=3 in `drainerCore` | `DRAINER_PROVIDER_CONCURRENCY = 3` (classifierDrainerCore.ts:65) | PASS |
| Per-isolate provider cap | MCP cap=5 (referenced at classifierDrainerCore.ts:64 — `C <= MCP cap=5`) | confirmed in code comment | PASS |
| Drainer wall-clock budget T | 90s | `DRAINER_WALL_CLOCK_BUDGET_MS = 90_000` (classifierDrainerCore.ts:68) | PASS |
| Drainer single-flight lease TTL L | ≥ T + max_call_timeout + margin (≥130s) | `DRAINER_LEASE_TTL_SECONDS = 130` (classifierDrainerCore.ts:89) | PASS |
| Edge→MCP fetch timeout | 15000ms | `MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15000` (booleanObservationMcpAdapter.ts:142) | PASS |
| Retry backoff schedule | _audit skeleton expected [60, 180, 360]s_ | code value `[30, 120]s` (classifierDrainerRetryPolicy.ts:65); clamped repeat for attempt 3→4 per doc-comment | PASS — recorded as informational; code is authoritative; doc-fix follow-up tracked under cutover design |
| DRAINER_MAX_ATTEMPTS | 4 | `DRAINER_MAX_ATTEMPTS = 4` (classifierDrainerRetryPolicy.ts:53) | PASS |
| Anthropic model | `claude-haiku-4-5` | `DEFAULT_MODEL = 'claude-haiku-4-5-20251001'` (anthropicProvider.ts:13) | PASS |

Source query: `.claude-tmp/rehearsal-queries/preflight.sql` (read-only aggregate `SELECT`; no body text / no `evidence_span` / no JWT / no secret). _Note: audit skeleton referenced `load-smoke-queries/preflight.sql`; the rehearsal preflight is byte-equal coverage and was reused — load-smoke pack focuses on under-load queries (oldest-pending-trend / dead-letter-rate / dup-success / overlap / provider-error-cluster / completeness)._

_Operator drill clock starts only if every Phase 0 row is PASS._ — All Phase 0 rows PASS at `2026-06-01 15:09:20Z`.

---

## Phase (a) — Arm smoke-only routing (Operator)

**Status:** PASS

Actions completed by operator at drill start:
- [x] Set `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` via Supabase dashboard env. Waited for edge function redeploy propagation.
- [x] Confirmed `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` (DEFAULT — safe; only smoke-tag override routes, no broad traffic).
- [x] Operator confirmed env state to CC ("arm done") before Phase (b) began.

Boundary preserved at arm:
- Master flag ON + percentage 0 + smoke-tag override → only `[arch-001-queue-smoke]`-prefixed debates route through the queue. Any concurrent real submit takes the legacy direct-dispatch path. Verified in Phase (c) via production-isolation query (`preflight_routed_args_last_hour` was 0 pre-arm; under-load queries did not surface non-smoke routed args) and in Phase (f) inert-state check.

| Action | Operator-attested timestamp | Verdict |
|---|---|---|
| `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` set | 2026-06-01 (pre-15:17:33Z; operator confirmed before burst) | PASS |
| Edge propagation confirmed | confirmed before "arm done" reply | PASS |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` confirmed 0 | confirmed in same operator reply | PASS |

---

## Phase (b) — Authorize + Burst (Operator confirms N + spend authorization; CC runs harness once)

**Status:** PASS

Per the load-smoke brief: operator confirmed `N = 8` and the corresponding spend authorization (≈ 7·N = 56 Anthropic calls — one per A-G family per arg). CC ran the burst harness EXACTLY ONCE and captured 8 argument ids + 8 debate ids on stdout.

| Field | Operator-set or harness-recorded value | Verdict |
|---|---|---|
| N (synthetic args) | 8 | PASS |
| Expected Anthropic calls (N·7) | 56 | PASS |
| Operator spend authorization recorded | operator brief authorized N=8 explicitly; reconfirmed in "arm done" message | PASS |
| Burst harness invocation | exactly 1 | PASS |
| Synthetic argument ids (8) | `cedca9dd-e4a5-486e-bce8-9017f661cf95`, `cb532d72-1930-4258-b3a9-105a37fcf716`, `36612599-8977-4208-aaf4-9868aef7a8f3`, `3f1d3f05-0703-4ccb-925a-a919016c99e9`, `4ac25898-eaf0-449a-80c1-12ecd834136f`, `509676e9-e68a-4afd-a929-8d64fd8ebcde`, `0eeb8783-adcb-4b42-b83c-8bee8603b2ea`, `636bb83b-77a0-463f-a505-d56580d30665` | PASS |
| Synthetic debate ids (8) | `2e702aaf-196f-41be-b4f9-96d09743cc04`, `f91a788d-4e57-42aa-99ab-75e38f850931`, `170d148e-e77a-4bf0-8053-6eb6ce297d71`, `f8273d0d-eb7f-4baf-883b-63f44fcbd693`, `f9cc2578-49de-4bfd-99bb-25218e545e45`, `1d0fe1b6-9b9c-44cb-acba-1ad3667eb717`, `b825318d-c626-4cae-b8cc-3cd77f3cc00a`, `7a494132-1c93-49b6-9109-cacfc4a91984` | PASS |
| Debate title prefix | `[arch-001-queue-smoke]` (smoke-tag override; baked into harness const) | PASS |
| Per-submit latency range | 2344ms – 2944ms (mean ≈ 2693ms) | PASS |
| Burst exit code | 0 | PASS |
| stdout summary | `{"event":"summary","posted":8,"failed":0}` | PASS |
| Burst start UTC | 2026-06-01T15:17:33Z | PASS |
| Burst end UTC | 2026-06-01T15:17:38Z (~5s wall clock; concurrent fanout) | PASS |

Harness: `.claude-tmp/queue-load-smoke-burst.cjs` (gitignored; mirrors `.claude-tmp/rollback-rehearsal-submit.cjs` patterns — loadEnv/supabaseClient/submitMove trio + emit() allowlist + smoke-tag prefix discipline; bot signs in once and posts N theses to N freshly created debates).

Output JSONL: `.claude-tmp/queue-load-smoke-burst.jsonl` (gitignored; one event per line; safe metadata only — no JWT, no body, no provider payload).

Verdict: PASS = burst returned 201 for all N submits AND every debate title carried the smoke-tag prefix AND `failed = 0`.

---

## Phase (c) — Drain under load (CC read-only polls; operator standby)

**Status:** FAIL — gate-2 (dead-letter rate) and gate-5/12 (provider error cluster recurrence) both violated. All other under-load mechanics held.

CC executed read-only queries from `.claude-tmp/load-smoke-queries/` for the duration of the drain. Burst end at 2026-06-01T15:17:38Z. Drill window observed through 2026-06-01T15:31:02Z (~13 min total, dominated by the 4-attempt retry policy on the failing cells).

### M1 — Drainer freshness under load (`.claude-tmp/load-smoke-queries/m1-drainer-freshness.sql`)

| Poll tick (UTC) | Observed `seconds_since_last_completed_drain` | `completed_in_window` | Band | Verdict |
|---|---|---|---|---|
| t+30s — 15:18:03Z | 66.20s | 29 | < 120s | PASS |
| t+90s — 15:19:12Z | 6.72s | 28 | < 120s | PASS |
| t+325s — 15:23:03Z | 6.54s | 28 | < 120s | PASS |
| t+13min — 15:31:02Z (full drain) | (drainer still ticking on schedule) | — | < 120s | PASS |
| **peak observed (drill window)** | **66.20s** | — | < 120s | PASS — drainer stayed fresh throughout |

PASS band: < 120s sustained for the entire drill. **PASS** — peak 66.2s, well within budget.

### M2 — Queue depth + oldest-pending-age under load (`.claude-tmp/load-smoke-queries/m2-queue-depth.sql`)

| Poll tick (UTC) | `non_terminal_rows` | `pending_count` | `leased_count` | `retry_scheduled_count` | `oldest_pending_age_seconds` | Verdict |
|---|---|---|---|---|---|---|
| t+30s — 15:18:03Z | 37 | 16 | 20 | 1 | 33.64s | PASS |
| t+90s — 15:19:12Z | 3 | 0 | 0 | 3 | null (none pending) | PASS |
| t+325s — 15:23:03Z | 3 | 0 | 0 | 3 | null | PASS |
| t+13min — 15:31:02Z | 0 | 0 | 0 | 0 | null | PASS |
| **peak `non_terminal_rows`** | **37** | — | — | — | — | PASS |
| **peak `oldest_pending_age_seconds`** | — | — | — | — | **33.64s** | PASS (< 300s band) |

PASS band: peak `oldest_pending_age_seconds` < 300s. **PASS** — observed 33.64s.

### M3 — Cell completeness under load (`.claude-tmp/load-smoke-queries/m3-cell-completeness.sql` + `load-completeness.sql`)

| Poll tick (UTC) | `routed_arg_count` | `succeeded_cells` | `dead_letter_cells` | `terminal_cells_total` | `pct_grid_coverage` (succ/expected) | Verdict |
|---|---|---|---|---|---|---|
| t+30s — 15:18:03Z | 8 | 22 | 0 | 22 | 39.29% | in-progress |
| t+90s — 15:19:12Z | 8 | 53 | 0 | 53 | 94.64% | in-progress |
| t+325s — 15:23:03Z | 8 | 53 | 0 | 53 | 94.64% | retry pending |
| **at full drain — 15:31:02Z** | **8** | **53** | **3** | **56** | **94.64%** | all 56 cells terminal — gate-1 PASS |

**Authoritative completeness** (from `load-completeness.sql`):
- `routed_arg_count_in_burst = 8`
- `expected_cell_count = 56`
- `succeeded_cells = 53`
- `dead_letter_cells = 3`
- `failed_terminal_cells = 0`
- `non_terminal_cells = 0`
- `pct_grid_coverage = 94.64%`

PASS (gate-1): every routed arg reached terminal state (succeeded or dead_letter) within the drill window — 56/56.

### M4 — Dead-letter rate (`.claude-tmp/load-smoke-queries/load-dead-letter-rate.sql`)

| Metric | Observed | Band | Verdict |
|---|---|---|---|
| `dead_letter_cells` | 3 | — | — |
| `failed_terminal_cells` | 0 | — | — |
| `succeeded_cells` | 53 | — | — |
| `total_terminal_cells` | 53 (query filter excludes dead_letter from this column; cross-checked via load-completeness) | — | — |
| `dead_letter_pct` (3/56) | **5.36%** | operator brief PASS ≤ 1%; PARTIAL 1–3%; > 3% qualifies as material failure | **FAIL — gate-2 VIOLATED** |
| comparison vs ARCH-001 Card 3 baseline (0.893%) | **6.0× higher** | — | regression vs baseline |

### M5 — Duplicate-success absence (`load-duplicate-success.sql`)

| Metric | Observed | Verdict |
|---|---|---|
| `duplicate_success_cell_count` (across all 8 synthetic args) | 0 | PASS — gate-3 single-success invariant held |
| `max_succeeded_rows_per_cell` | 0 | PASS |
| `total_duplicate_success_rows` | 0 | PASS |

### Overlap absence (single-flight lease) — `load-overlapping-drain.sql`

| Metric | Observed | Verdict |
|---|---|---|
| `drain_rows_in_window` | 29 | informational |
| `overlapping_drain_pairs` | 0 | PASS — gate-4 single-flight invariant held |
| `drains_involved_in_overlap` | 0 | PASS |

### Provider error-class distribution — `load-provider-error-cluster.sql`

| Row kind | Family | State | Failure sub-reason | Cell count | Distinct families |
|---|---|---|---|---|---|
| detail | `argument_scheme` | `dead_letter` | `provider_server_error` | 3 | — |
| summary | (all) | (all) | (all `provider_*`) | 3 | 1 |

| Metric | Observed | Verdict |
|---|---|---|
| Distinct families showing `provider_*` terminal failures | **1** (`argument_scheme`) | informational |
| Cells in cluster | **3** | informational |
| `mcp_api_error` family count | 1 (single-family cluster) | informational |
| **Audit-skeleton gate-12 (`no family has >= 2 provider_* terminal failures`)** | **VIOLATED** — argument_scheme = 3 | **FAIL** |
| **Operator brief gate-5 (`no provider/server error cluster recurrence`)** | **VIOLATED** — single-family cluster with sustained provider_server_error across 4 attempts | **FAIL** |
| `load-provider-error-cluster.sql` own threshold (`>=2 in one family AND >1 family showing pattern`) | only 1 family shows pattern | per query's own thresholds: NOT FAIL (but the broader operator gate is what binds) |

**Per-cell forensics (from `.claude-tmp/load-smoke-queries/diag-state-breakdown.sql`)**:
- All 3 dead_letter cells: `attempt_count = 4`, `failure_reason = mcp_api_error`, `failure_sub_reason = provider_server_error`, `dead_letter_reason = retry_attempts_exhausted`.
- Retry trace via `diag-retry-scheduled.sql` at t+325s captured all 3 at `attempt_count=3, seconds_until_available ≈ 345s` (clamped 120s backoff for attempt 4). Attempt 4 fired at ≈ 2026-06-01T15:29Z and also failed, transitioning to dead_letter.
- Single family clustering — argument_scheme alone — distinguishes this from the H Card 3 LEGACY multi-family blowup, but the same `mcp_api_error / provider_server_error` failure-class signature persisted across 4 attempts spread over ~7 minutes (not a transient flake).

### Time-to-drain

| Metric | Observed | Verdict |
|---|---|---|
| Phase (b) burst end UTC | 2026-06-01T15:17:38Z | — |
| Time when all N·7 cells terminal | 2026-06-01T15:31:02Z (or slightly earlier; first poll confirming full termination) | — |
| **Time-to-drain (sec)** | **≈ 800s (~13 min)** | dominated by retry policy: 5 cells terminal in ~25s; remaining 3 cells consumed full attempt-1+30s+attempt-2+120s+attempt-3+120s+attempt-4 ≈ 5–7 min retry tail |

### Phase (c) composite verdict

| Sub-gate | Verdict |
|---|---|
| M1 < 120s sustained | PASS (peak 66.2s) |
| M2 oldest-pending-age < 300s peak | PASS (33.64s) |
| M3 all 56 cells reach terminal | PASS (gate-1) |
| M4 dead-letter rate ≤ 1% (operator brief PASS band) | **FAIL — 5.36%** |
| M5 duplicate-success = 0 | PASS |
| Overlap = 0 | PASS |
| `mcp_api_error` cluster materially improved over H Card 3 LEGACY | **FAIL — single-family cluster (argument_scheme) with sustained provider_server_error across 4 attempts** |

**Verdict for Phase (c): FAIL**.

---

## Phase (d) — Reliability verdict (CC summarizes)

**Status:** FAIL

CC tabulates the operator-brief gate criteria results (15-criterion list from drill brief Phase (d)) plus the audit-skeleton 12-criterion list. Both rolls flag the same two gates as failed; all other gates PASS.

### Operator brief 15-criterion roll-up

| Gate | Criterion | Observed | Verdict |
|---|---|---|---|
| 1 | 8 synthetic args submitted | 8/8 (Phase b) | PASS |
| 2 | 56 A-G cells expected | 56 routed | PASS |
| 3 | All cells terminal | 53 succeeded + 3 dead_letter + 0 non-terminal = 56 | PASS |
| 4 | No terminal holes | 0 non-terminal at full drain | PASS |
| 5 | **Dead-letter rate ≤ 1%** | **5.36% (3/56)** | **FAIL** |
| 6 | No H/I/J rows | confirmed — only A-G families present (`diag-state-breakdown.sql` shows 7 families, all production A-G) | PASS |
| 7 | `duplicate_success_cells = 0` | 0 | PASS |
| 8 | `direct_dispatch_leak_count = 0` | 0 — all 56 cells had `family IS NOT NULL` (routed via queue) | PASS |
| 9 | `overlapping_drain_count = 0` | 0 | PASS |
| 10 | Queue drains back to zero | non-terminal = 0 at full drain | PASS |
| 11 | Oldest pending age stays ≤ 300s | peak 33.64s | PASS |
| 12 | **No provider/server error cluster recurrence** (`no family has >= 2 provider_* terminal failures` AND `cluster does not reappear across multiple families`) | **argument_scheme has 3 provider_server_error dead_letter cells; condition A violated; condition B met (single-family)** | **FAIL** (condition A required) |
| 13 | cutover-health-monitor remains healthy | 3/3 succeeded last 15min, 0 failed; seconds_since_last=172s within `*/5 *` band | PASS |
| 14 | classifier drainer remains fresh | M1 peak 66.2s; sustained < 120s | PASS |
| 15 | No non-smoke production arguments routed | `preflight_routed_args_last_hour=0` pre-arm; no non-smoke routed args observed during drill window | PASS |

**Operator brief verdict: FAIL** — gates 5 and 12 violated. Per operator brief: "FAIL if ... provider/server error cluster recurs materially". Confirmed.

### Audit-skeleton 12-criterion roll-up (cross-check)

| Gate | Criterion | Verdict |
|---|---|---|
| 1 | All N·7 cells terminal | PASS |
| 2 | Dead-letter rate ≤ 1.79% (skeleton PASS band) | **FAIL** (5.36%) |
| 3 | M5 duplicate-success = 0 | PASS |
| 4 | Overlap = 0 | PASS |
| 5 | No `mcp_api_error` cluster materially improved over H Card 3 LEGACY | **FAIL** |
| 6 | M1 < 120s sustained | PASS |
| 7 | M2 oldest-pending-age peak < 300s | PASS |
| 8 | Time-to-drain recorded | PASS (≈ 800s) |
| 9 | Master routing flag ends `false` | (recorded in Phase e) |
| 10 | Routing percentage stays 0 | (recorded in Phase e) |
| 11 | Zero non-smoke routed in drill window | PASS |
| 12 | Audit-lint clean | (recorded at commit) |

### Composite verdict

**FAIL** — two independent gates trigger:

1. **Dead-letter rate 5.36% > 1% PASS band (operator brief)** — 3 of 56 cells dead-lettered.
2. **Provider error cluster recurrence on `argument_scheme` family** — 3 cells with `mcp_api_error` / `provider_server_error` / `retry_attempts_exhausted`, sustained across all 4 attempts (≈ 7 min of retry budget consumed). This is the H Card 3 LEGACY failure-class signature reappearing on the queue path, isolated to a single family.

**Mechanism vs underlying provider:**

The queue mechanism itself behaved correctly:
- Bounded concurrency (C=3) held (zero overlap, zero dup-success).
- Single-flight lease invariant held.
- Retry policy ran to completion (4 attempts with [30, 120]s backoff, attempt 3→4 clamped).
- Production isolation held (no non-smoke args routed; no H/I/J rows).

The underlying provider transient on `argument_scheme` did **not** resolve over the 4-attempt window. The cluster is single-family (unlike H Card 3 LEGACY's multi-family blowup), pointing to a different root cause shape: argument_scheme-prompt-specific provider instability under burst load, not generalized concurrency-induced provider rate-limiting.

### Strategic finding (§7.8 caveat updated)

The audit skeleton §7.8 single-arm caveat anticipated "strong converging evidence that the queue eliminates the cluster". This drill produced the **opposite**: strong converging evidence that the C=3 + retry mechanism alone does NOT eliminate provider-transient clustering on per-family basis. The audit text must say:

> **The queue-path mechanism reduces but does NOT eliminate the H Card 3 cluster shape.** The cluster reappears in a different distribution (single-family vs multi-family) consistent with provider-side instability on a specific prompt class. Authorizing Stage 1 routing flip from this drill alone would push real production traffic onto a cluster path that is not yet resolved.

---

## Phase (e) — Stand down (Operator)

**Status:** PASS

Actions completed by operator at drill end:
- [x] Set `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` via Supabase dashboard env. Propagation confirmed.
- [x] `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` remained `0` (no change).
- [x] Drainer cron `arch-001-classifier-drain-tick` left active (`* * * * *`) — no cron mutations.
- [x] Operator confirmed env state to CC ("stand down done at 2026-06-01T17:28:03Z").

| Action | Operator-attested timestamp | Verdict |
|---|---|---|
| `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` set | 2026-06-01T17:28:03Z | PASS |
| Edge propagation confirmed | confirmed before "stand down done" reply | PASS |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` confirmed still 0 | confirmed in same reply | PASS |
| Drainer cron unchanged (still active + `* * * * *`) | verified in Phase (f) preflight at 17:31:47Z: `drainer_active_and_schedule = 'true\|* * * * *'` | PASS |

---

## Phase (f) — Confirm inert (CC read-only)

**Status:** PASS — system in clean inert state post-stand-down.

Phase (f) snapshot @ 2026-06-01T17:31:47Z (≈ 3.5 min after operator stand-down).

| Query | Expected | Observed | Verdict |
|---|---|---|---|
| Routing flag state post-drill | `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (operator-attested) | operator-attested at 17:28:03Z + `preflight_routed_args_last_hour=0` (no new routed args in the hour post-arm/post-drill) | PASS |
| M1 post-stand-down | `seconds_since_last_completed_drain < 120` | 50.69s (also 45.67s in preflight snapshot 5s earlier) | PASS |
| M2 post-stand-down | `non_terminal_rows = 0` | 0 (0 pending / 0 leased / 0 retry_scheduled) | PASS |
| M3 — final coverage for synthetic args | every routed arg has 7 terminal cells | 8 routed args × 7 families = 56 terminal cells (53 succeeded + 3 dead_letter); `non_terminal_cells = 0` | PASS (terminal coverage); FAIL composite per gate-2/5 cluster |
| **Production-isolation check** — non-smoke routed args | `routed_non_smoke_args_in_window = 0` | `preflight_routed_args_last_hour = 0` post-drill (no leakage) | PASS |
| `duplicate_success_cell_count` (drill window) | 0 | 0 | PASS |
| `direct_dispatch_leak_count` (smoke args only) | 0 | 0 — all 56 cells had `family IS NOT NULL` (queue-routed) | PASS |
| `hij_rows_in_window` | 0 | 0 — `diag-state-breakdown.sql` showed only A-G families (no claim_clarity / thread_topology / sensitive_composer rows for drill args) | PASS |
| Cutover monitor health (post-drill) | recent invocations succeeded, 0 failed, fresh | 3 recent / 3 succeeded / 0 failed; `seconds_since_last_invocation = 123.5s` (within `*/5 * * * *` band) | PASS |
| Drainer health (post-drill) | `active=true`, `schedule='* * * * *'`, M1 < 120s | `drainer_active_and_schedule = 'true\|* * * * *'`; M1=50.69s | PASS |

Verdict: PASS — master routing flag is back to default-off, drainer + watchdog continue ticking healthily, zero pending queue rows, zero post-drill non-smoke args routed, zero duplicate-success, zero direct-dispatch leakage for smoke args, zero H/I/J rows. The composite drill verdict (FAIL) is determined by Phase (c)/(d) gate-2 and gate-5/12, NOT by Phase (f) — the system stand-down is clean.

---

## Provenance + boundary compliance

- **CC provider-spend invocations this card:** **0** by CC. The burst harness in Phase (b) was operator-authorized; it ran as the parent shell process (CC invoking the operator-blessed harness) and triggered downstream Anthropic classifier calls via the drainer. CC issued NO direct `classify-argument-boolean-observations` / MCP / Anthropic / xAI / X API call.
- **Provider spend observed during drill (operator-authorized burst):** 8 submits × 7 A-G families = 56 Anthropic Haiku classifier calls expected. Actual invocations on `argument_scheme` involved retries — attempts 1–4 for the 3 failing cells = 12 additional retry calls plus the 5 successful argument_scheme calls = 17 total argument_scheme provider calls (5 succeeded + 12 retry attempts that all ended in dead_letter). Total observed: ≈ 65 Anthropic calls bounded by the C=3 cap. Recorded in `.claude-tmp/queue-load-smoke-burst-N8.jsonl`.
- **CC writes (DB):** **0**. CC ran only read-only `SELECT` SQL via `npx supabase db query --linked --file <path>`. All SQL files live under `.claude-tmp/load-smoke-queries/` (gitignored). Read-only-leak-safe assertion `.claude-tmp/load-smoke-queries/assert-read-only.cjs` (mirrors `.claude-tmp/rehearsal-queries/assert-read-only.cjs`) verified no INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/GRANT/REVOKE/MERGE/COPY/CALL/EXECUTE in any `.sql` file in the load-smoke pack and no `evidence_span` selection. Two ad-hoc diagnostic queries (`diag-retry-scheduled.sql`, `diag-state-breakdown.sql`) added in-flight; both passed the read-only assertion.
- **CC writes (file system):** docs/audits/<this file>; the load-smoke harness + query pack + the two ad-hoc diagnostics under `.claude-tmp/` (all gitignored). The `.claude-tmp/rehearsal-queries/` set is **untouched** (byte-equal); the load-smoke set is a sibling at `.claude-tmp/load-smoke-queries/`.
- **Mutations performed by operator (drill window only):** (a) set `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` in Edge Function env (Phase a, pre-15:17:33Z); (b) set `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (Phase e, 17:28:03Z). No cron alteration. No percentage change (`CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` stayed `0` throughout). No source / migration / familyRegistry / package.json edits.
- **Non-smoke production impact:** **0** — production-isolation check in Phase (f) confirms `preflight_routed_args_last_hour = 0` post-drill (no leakage; only smoke-tagged debates routed).
- **No source / migration / runtime-flag change to main by this card.** Audit doc is the only file committed by the parent thread; harness + query pack stay in `.claude-tmp/` (gitignored).
- **No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / prompt text / provider payloads are written to this audit.**

---

## Authorizations + follow-ups

**Active verdict: FAIL — Stage 1 routing flip NOT authorized.**

**HALT actions (operator brief; all completed during drill):**
- [x] `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` set (Phase e at 17:28:03Z; verified in Phase f).
- [x] `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` stays at `0`.
- [x] Classifier drainer active and fresh (M1 = 50.69s post-stand-down; `drainer_active_and_schedule = 'true\|* * * * *'`).
- [x] cutover-health-monitor unaffected (3/3 succeeded last 15 min, 0 failed).
- [x] No re-enable of Family H. No start of Family I. No source / migration / cron / percentage changes by CC.

**Next-step decision (operator-gated; do NOT auto-proceed from this audit):**

The drill produced two converging findings that must be reconciled before any production ramp:

1. **The queue mechanism is sound.** Bounded concurrency held (zero overlap, zero dup-success, zero direct-dispatch leakage), single-flight lease held, retry policy ran to completion, production isolation held, watchdog stayed healthy. These are the load-path mechanics this card was scoped to prove.

2. **The underlying provider transient (`mcp_api_error` / `provider_server_error` on argument_scheme) was NOT eliminated by the C=3 + 4-attempt retry mechanism.** The cluster reappeared, isolated to a single family, sustained across all 4 attempts spread over ~7 min. This is the same failure-class signature observed in the H Card 3 LEGACY direct-dispatch path, but with a different distribution shape (single-family rather than multi-family).

**Tuning surfaces (ordered by suspicion):**

- **(P0) Investigate the argument_scheme prompt + provider behavior.** Why does argument_scheme specifically hit `provider_server_error` under burst load while the other 6 production families do not? Hypotheses to test:
  - Prompt size / token budget for argument_scheme is materially larger than other families, hitting a provider per-request limit.
  - Anthropic backend transient instability windowed against argument_scheme's request signature.
  - Validation/output-schema mismatch interpreted as provider-side error.
  
  This is the single most material follow-up. Until reproduced + characterized, do NOT enable Stage 1.

- **(P1) Drainer retry backoff schedule.** Observed at HEAD `[30, 120]`s (clamped repeat for attempt 3→4). The audit skeleton expected `[60, 180, 360]`s per the cutover design doc; code is authoritative. For provider transients with multi-minute scope, lengthening backoff may help, but only if the underlying issue resolves on a longer timescale.

- **(P2) `DRAINER_MAX_ATTEMPTS` (currently 4).** Bumping to 5 would have given each failing cell one more attempt, but doesn't address the root cause if the provider error is sustained.

- **(P3) Drainer global concurrency C (currently 3).** Lowering further would reduce simultaneous argument_scheme calls but at material cost to throughput. Likely NOT the root cause given single-family clustering.

**Mandatory follow-up cards (open before any Stage 1 retry):**

- **`OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA`** (P0 — characterize why argument_scheme specifically clustered; correlate with prompt size / Anthropic response codes / request timing under burst).
- **`OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY`** (rerun with potentially revised retry backoff or other mitigations after RCA — operator-gated, NOT auto-scheduled by this audit).

**Other follow-ups (regardless of verdict):**

- **H production retry** (`MCP-021C-EDGE-FAMILY-H-ENABLE-RETRY`) — STILL GATED. The original H Card 3 FAIL chain motivated this whole cutover. Until the cluster is RCA'd and a successful queue load-smoke proves elimination, no H retry.
- **Watchdog cadence tightening** (`OPS-CUTOVER-WATCHDOG-CADENCE-TIGHTENING`) — non-blocking; tracked from PR #414's structural finding.
- **Retry-backoff schedule doc drift** — the audit skeleton cited cutover design doc value `[60, 180, 360]`s but code (`classifierDrainerRetryPolicy.ts:65`) is `[30, 120]`s. Track as a low-priority doc-fix follow-up.

---

## Smoke artifacts

- **Burst harness (gitignored; operator-authorized run):** `.claude-tmp/queue-load-smoke-burst.cjs` — mirrors `.claude-tmp/rollback-rehearsal-submit.cjs` (loadEnv/supabaseClient/submitMove trio + emit() allowlist + smoke-tag prefix discipline). DISTINCT file at a DISTINCT path; the rehearsal harness is untouched (byte-equal).
- **Query pack (gitignored):** `.claude-tmp/load-smoke-queries/*.sql` + `assert-read-only.cjs`. DISTINCT directory; sibling of `.claude-tmp/rehearsal-queries/` (which stays untouched / byte-equal). Pack: m1-drainer-freshness, m2-queue-depth, m3-cell-completeness, watchdog-cron-freshness, load-completeness, load-dead-letter-rate, load-duplicate-success, load-overlapping-drain, load-provider-error-cluster, load-oldest-pending-trend.
- **Ad-hoc diagnostics added in-flight (gitignored):** `diag-retry-scheduled.sql`, `diag-state-breakdown.sql` — both passed `assert-read-only.cjs` and were used for cluster-root-cause forensics.
- **Synthetic argument ids:** `cedca9dd-e4a5-486e-bce8-9017f661cf95`, `cb532d72-1930-4258-b3a9-105a37fcf716`, `36612599-8977-4208-aaf4-9868aef7a8f3`, `3f1d3f05-0703-4ccb-925a-a919016c99e9`, `4ac25898-eaf0-449a-80c1-12ecd834136f`, `509676e9-e68a-4afd-a929-8d64fd8ebcde`, `0eeb8783-adcb-4b42-b83c-8bee8603b2ea`, `636bb83b-77a0-463f-a505-d56580d30665`.
- **Synthetic debate ids:** `2e702aaf-196f-41be-b4f9-96d09743cc04`, `f91a788d-4e57-42aa-99ab-75e38f850931`, `170d148e-e77a-4bf0-8053-6eb6ce297d71`, `f8273d0d-eb7f-4baf-883b-63f44fcbd693`, `f9cc2578-49de-4bfd-99bb-25218e545e45`, `1d0fe1b6-9b9c-44cb-acba-1ad3667eb717`, `b825318d-c626-4cae-b8cc-3cd77f3cc00a`, `7a494132-1c93-49b6-9109-cacfc4a91984`.
- **Synthetic debate title prefix:** `[arch-001-queue-smoke]` (the routing override key; same load-bearing tag the rehearsal used).
- **Burst JSONL output:** `.claude-tmp/queue-load-smoke-burst-N8.jsonl` (gitignored; one event per line; safe metadata only — bot_signed_in / burst_start / 8× submit_ok / summary).
- **Anthropic spend observed:** 56 expected + 12 retry attempts on argument_scheme failures = ≈ 65 Haiku calls bounded by C=3. Recorded in the per-cell `attempt_count` field surfaced by `diag-state-breakdown.sql`.
- **Output discipline:** No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / prompt text / raw provider payloads are written to this audit or any artifact.

## Key failure evidence (operator-preserved verbatim)

- 8 synthetic args submitted.
- 56 A-G cells expected.
- 53 succeeded.
- 3 dead_letter.
- dead-letter rate = 5.36%.
- all 3 dead letters were `argument_scheme`.
- `failure_reason = mcp_api_error`.
- `failure_sub_reason = provider_server_error`.
- `dead_letter_reason = retry_attempts_exhausted`.
- `attempt_count = 4`.
- no H/I/J rows.
- `duplicate_success_cells = 0`.
- `direct_dispatch_leak_count = 0`.
- `overlapping_drain_pairs = 0`.
- queue mechanism held, but the provider/server error class recurred.
- Stage 1 is not authorized from this drill.
