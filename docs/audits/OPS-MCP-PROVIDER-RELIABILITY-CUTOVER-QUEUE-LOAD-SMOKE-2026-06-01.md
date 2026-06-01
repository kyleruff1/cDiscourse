# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE — drill audit skeleton (2026-06-01)

Audit-Lint: v1
Audit-type: ops

**Date:** _PENDING_ (operator fills at drill start)
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE
**Issue / trail:** #373 (umbrella); #391 (H Card 3, stays OPEN); #388 (H umbrella, stays OPEN)
**Base HEAD at execution:** _PENDING_ (operator records at drill start)
**Predecessors merged:**
- PR #411 / cutover-health-monitor alerting (the watchdog that will observe this drill)
- PR #412 / rehearsal prep (the read-only query pack + harness baseline)
- PR #413 / explicit-recipient patch (admin-alerting recipient resolution)
- PR #414 / rollback-rehearsal audit PASS (the drill that proved the rollback path; this card proves the load path)

**Scope:** Proves the ARCH-001 queue holds under H-like concurrent provider load (smoke-tag isolated; routing percentage stays 0). The rollback rehearsal (PR #414) proved the rollback path; this drill proves the load path. N synthetic root theses are submitted to `[arch-001-queue-smoke]`-tagged debates; each fans out to 7 A-G family classifier cells (≈ 7·N Anthropic calls total); CC polls the queue under load (M1 freshness, M2 depth + oldest-pending-age, M3 completeness, dead-letter rate, overlap, provider-error cluster); operator stands down by unsetting the master flag. Total drill ≤ 30 min. NO Family H production retry; NO Stage 1 routing flip; NO percentage > 0; NO non-smoke traffic routed.

**Final verdict:** **PENDING**

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

**Status:** _PENDING_

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| HEAD on main | post-PR-414 (rehearsal PASS landed) | _<fill>_ | _PENDING_ |
| Production family roster | A-G (7 families) | _<fill>_ | _PENDING_ |
| H production flag | `claim_clarity productionEnabled: false` (line 106 of familyRegistry.ts) | _<fill>_ | _PENDING_ |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | unset / `'false'` (DEFAULT DISABLED at drill start) | _<fill>_ (inferred from `preflight_routed_args_last_hour = 0`) | _PENDING_ |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | unset / `0` | _<fill>_ | _PENDING_ |
| Drainer cron `arch-001-classifier-drain-tick` exists + active + schedule | `true \| * * * * *` | _<fill>_ | _PENDING_ |
| Drainer freshness (Q-M1 PASS) | `seconds_since_last_completed_drain < 120` | _<fill>_ | _PENDING_ |
| Watchdog cron `cutover-health-monitor-tick` exists + active + schedule | `true \| */5 * * * *` | _<fill>_ | _PENDING_ |
| Watchdog Layer 1 PASS band | ≥ 2 invocations / 0 failed / fresh | _<fill>_ | _PENDING_ |
| In-flight queue rows | none | `preflight_non_terminal_rows = 0` | _PENDING_ |
| Routed args last hour | 0 (routing inert) | 0 | _PENDING_ |
| Drainer global concurrency cap | C=3 in `drainerCore` | _<fill>_ (source-equality assertion against HEAD) | _PENDING_ |
| Per-isolate provider cap | 5 in `providerConcurrency.ts` | _<fill>_ | _PENDING_ |
| Drainer call timeout T | 90s | _<fill>_ | _PENDING_ |
| Edge→MCP fetch timeout | 15000ms | _<fill>_ | _PENDING_ |
| Retry backoff schedule | [60s, 180s, 360s] | _<fill>_ | _PENDING_ |
| DRAINER_MAX_ATTEMPTS | 4 | _<fill>_ | _PENDING_ |
| Anthropic model | `claude-haiku-4-5` | _<fill>_ | _PENDING_ |

Source query: `.claude-tmp/load-smoke-queries/preflight.sql` (read-only aggregate `SELECT`; no body text / no `evidence_span` / no JWT / no secret).

_Operator drill clock starts only if every Phase 0 row is PASS._

---

## Phase (a) — Arm smoke-only routing (Operator)

**Status:** _PENDING_

Actions to be completed by operator at drill start:
- [ ] Set `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` via Supabase dashboard env. Wait for edge function redeploy propagation (~30-60s).
- [ ] Confirm `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` (DEFAULT — safe; only smoke-tag override routes, no broad traffic).
- [ ] Operator confirms env state to CC ("arm done") before Phase (b) begins.

Boundary preserved at arm:
- Master flag ON + percentage 0 + smoke-tag override → only `[arch-001-queue-smoke]`-prefixed debates route through the queue. Any concurrent real submit takes the legacy direct-dispatch path. This will be verified in Phase (c) via the production-isolation query and in Phase (f) inert-state check.

| Action | Operator-attested timestamp | Verdict |
|---|---|---|
| `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` set | _<fill>_ | _PENDING_ |
| Edge propagation confirmed | _<fill>_ | _PENDING_ |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` confirmed 0 | _<fill>_ | _PENDING_ |

---

## Phase (b) — Authorize + Burst (Operator confirms N + spend authorization; CC runs harness once)

**Status:** _PENDING_

Per the load-smoke brief: operator confirms `N` (the number of synthetic args to submit) and the corresponding spend authorization (≈ 7·N Anthropic calls — one per A-G family per arg). CC runs the burst harness EXACTLY ONCE and captures the N argument ids + N debate ids on stdout.

| Field | Operator-set or harness-recorded value | Verdict |
|---|---|---|
| N (synthetic args) | _<fill>_ | _PENDING_ |
| Expected Anthropic calls (N·7) | _<fill>_ | _PENDING_ |
| Operator spend authorization recorded | _<fill>_ | _PENDING_ |
| Burst harness invocation | exactly 1 | _PENDING_ |
| Synthetic argument ids | _<fill>_ (N ids; recorded in burst stdout) | _PENDING_ |
| Synthetic debate ids | _<fill>_ (N ids; each prefixed `[arch-001-queue-smoke]`) | _PENDING_ |
| Debate title prefix | `[arch-001-queue-smoke]` (smoke-tag override) | _PENDING_ |
| Burst total submitMs | _<fill>_ | _PENDING_ |
| Burst exit code | 0 | _PENDING_ |
| stdout summary | `{posted: N, failed: 0}` | _PENDING_ |
| Burst start UTC | _<fill>_ | _PENDING_ |
| Burst end UTC | _<fill>_ | _PENDING_ |

Harness: `.claude-tmp/queue-load-smoke-burst.cjs` (gitignored; mirrors `.claude-tmp/rollback-rehearsal-submit.cjs` patterns — loadEnv/supabaseClient/submitMove trio + emit() allowlist + smoke-tag prefix discipline; bot signs in once and posts N theses to N freshly created debates).

Output JSONL: `.claude-tmp/queue-load-smoke-burst.jsonl` (gitignored; one event per line; safe metadata only — no JWT, no body, no provider payload).

Verdict: PASS = burst returned 201 for all N submits AND every debate title carried the smoke-tag prefix AND `failed = 0`.

---

## Phase (c) — Drain under load (CC read-only polls; operator standby)

**Status:** _PENDING_

CC executes read-only queries from `.claude-tmp/load-smoke-queries/` on a polling cadence (every 15–30s) for the duration of the drain. Records peak queue depth, peak oldest-pending-age, time-to-drain, and provider-error-class distribution.

### M1 — Drainer freshness under load (`.claude-tmp/load-smoke-queries/m1-drainer-freshness.sql`)

| Poll tick | Observed `seconds_since_last_completed_drain` | Band | Verdict |
|---|---|---|---|
| t+15s | _<fill>_ | _<fill>_ | _PENDING_ |
| t+30s | _<fill>_ | _<fill>_ | _PENDING_ |
| t+60s | _<fill>_ | _<fill>_ | _PENDING_ |
| t+90s | _<fill>_ | _<fill>_ | _PENDING_ |
| ... | _<fill>_ | _<fill>_ | _PENDING_ |
| peak observed (drill window) | _<fill>_ | _<fill>_ | _PENDING_ |

PASS band: < 120s sustained for the entire drill.

### M2 — Queue depth + oldest-pending-age under load (`.claude-tmp/load-smoke-queries/m2-queue-depth.sql`)

| Poll tick | `non_terminal_rows` | `pending_count` | `leased_count` | `retry_scheduled_count` | `oldest_pending_age_seconds` | Verdict |
|---|---|---|---|---|---|---|
| t+15s | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _PENDING_ |
| t+30s | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _PENDING_ |
| t+60s | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _PENDING_ |
| t+90s | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _PENDING_ |
| ... | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _PENDING_ |
| **peak `non_terminal_rows`** | _<fill>_ | — | — | — | — | _PENDING_ |
| **peak `oldest_pending_age_seconds`** | — | — | — | — | _<fill>_ | _PENDING_ |

PASS band: peak `oldest_pending_age_seconds` < 300s. PARTIAL 300–900s. FAIL > 900s.

### M3 — Cell completeness under load (`.claude-tmp/load-smoke-queries/m3-cell-completeness.sql`)

| Poll tick | `routed_arg_count` | `succeeded_cells` | `terminal_cells_total` | `pct_grid_coverage` | Verdict |
|---|---|---|---|---|---|
| t+30s | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _PENDING_ |
| t+60s | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _PENDING_ |
| t+90s | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _PENDING_ |
| t+120s | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _PENDING_ |
| ... | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ | _PENDING_ |
| **at full drain** | _<fill>_ (= N) | _<fill>_ (≤ N·7) | _<fill>_ (= N·7) | 100.0 | _PENDING_ |

PASS: every routed arg reaches `terminal_cells_total = 7` (all A-G families resolved) within the drill window.

### M4 — Dead-letter rate (`.claude-tmp/load-smoke-queries/m4-dead-letter-rate.sql`)

Filtered to the drill window (`created_at >= <Phase b start UTC>`).

| Metric | Observed | Band | Verdict |
|---|---|---|---|
| `dead_letter_cells` | _<fill>_ | — | _PENDING_ |
| `terminal_cells_total` | _<fill>_ | — | _PENDING_ |
| `dead_letter_pct` | _<fill>_ | PASS ≤ 1.79%; PARTIAL 1.79–5%; FAIL > 5% | _PENDING_ |
| comparison vs ARCH-001 Card 3 baseline (0.893%) | _<fill>_ | — | _PENDING_ |

### M5 — Duplicate-success absence

| Metric | Observed | Verdict |
|---|---|---|
| `duplicate_success_cells` (across all N synthetic args) | _<fill>_ | _PENDING_ (PASS = 0) |

### Overlap absence (single-flight lease)

| Metric | Observed | Verdict |
|---|---|---|
| `overlapping_drain_ticks` | _<fill>_ | _PENDING_ (PASS = 0) |
| `simultaneous_row_claims` | _<fill>_ | _PENDING_ (PASS = 0) |

### Provider error-class distribution (the gate-5 signal)

| `failure_reason` / `failure_sub_reason` / `dead_letter_reason` (column name TBC at HEAD) | Count | Pct of total cells | Verdict |
|---|---|---|---|
| (none — succeeded) | _<fill>_ | _<fill>_ | _PENDING_ |
| `mcp_api_error` cluster | _<fill>_ | _<fill>_ | _PENDING_ (PASS = ≈ 0; "materially improved" vs H Card 3 LEGACY — see §7.8 caveat above) |
| `mcp_validation_failed` | _<fill>_ | _<fill>_ | _PENDING_ |
| (other) | _<fill>_ | _<fill>_ | _PENDING_ |

### Time-to-drain

| Metric | Observed | Verdict |
|---|---|---|
| Phase (b) burst end UTC | _<fill>_ | — |
| Time when all N·7 cells terminal | _<fill>_ | — |
| **Time-to-drain (sec)** | _<fill>_ | _PENDING_ (informational; consistent with C=3 + N·7 / 3 expected steady-state rate) |

Verdict for Phase (c): _PENDING_ — PASS = M1 stays < 120s sustained AND M2 oldest-pending-age < 300s peak AND M3 reaches 100.0 within drill window AND M4 ≤ 1.79% AND M5 = 0 AND overlap = 0 AND `mcp_api_error` cluster materially improved over H Card 3 LEGACY baseline.

---

## Phase (d) — Reliability verdict (CC summarizes)

**Status:** _PENDING_

CC tabulates the gate criteria results into a single verdict block.

| Gate criterion (from drill gate criteria 1–12 above) | Observed | Verdict |
|---|---|---|
| 1. All N·7 cells terminal | _<fill>_ | _PENDING_ |
| 2. Dead-letter rate ≤ 1.79% (PASS band) | _<fill>_ | _PENDING_ |
| 3. M5 duplicate-success = 0 | _<fill>_ | _PENDING_ |
| 4. Overlap = 0 (single-flight lease held) | _<fill>_ | _PENDING_ |
| 5. No `mcp_api_error` cluster (materially improved vs H Card 3 LEGACY — §7.8 caveat) | _<fill>_ | _PENDING_ |
| 6. M1 < 120s sustained | _<fill>_ | _PENDING_ |
| 7. M2 oldest-pending-age peak < 300s | _<fill>_ | _PENDING_ |
| 8. Time-to-drain recorded + consistent with C=3 | _<fill>_ | _PENDING_ |

Composite verdict for the load-path proof: _PENDING_ — PASS = all 8 above PASS.

---

## Phase (e) — Stand down (Operator)

**Status:** _PENDING_

Actions to be completed by operator at drill end:
- [ ] Set `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` via Supabase dashboard env. Confirm propagation.
- [ ] `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` remains `0` (no change needed; flag-off makes percentage inert).
- [ ] Drainer cron `arch-001-classifier-drain-tick` left active (`* * * * *`) — no cron mutations required by this drill.
- [ ] Operator confirms env state to CC ("stand down done").

| Action | Operator-attested timestamp | Verdict |
|---|---|---|
| `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` set | _<fill>_ | _PENDING_ |
| Edge propagation confirmed | _<fill>_ | _PENDING_ |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` confirmed still 0 | _<fill>_ | _PENDING_ |
| Drainer cron unchanged (still active + `* * * * *`) | _<fill>_ | _PENDING_ |

---

## Phase (f) — Confirm inert (CC read-only)

**Status:** _PENDING_

| Query | Expected | Observed | Verdict |
|---|---|---|---|
| Routing flag state post-drill | `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (operator-attested) | _<fill>_ | _PENDING_ |
| M1 post-stand-down | `seconds_since_last_completed_drain < 120` | _<fill>_ | _PENDING_ |
| M2 post-stand-down | `non_terminal_rows = 0` | _<fill>_ | _PENDING_ |
| M3 — final coverage for synthetic args | every routed arg has 7 succeeded cells (or terminal dead_letter inside budget) | _<fill>_ | _PENDING_ |
| **Production-isolation check** — non-smoke routed args during drill window | `routed_non_smoke_args_in_window = 0` | _<fill>_ | _PENDING_ (criterion 11) |
| `duplicate_success_cells` (drill window) | 0 | _<fill>_ | _PENDING_ |
| `direct_dispatch_leak_count` (smoke args only) | 0 | _<fill>_ | _PENDING_ |
| `hij_rows_in_window` | 0 | _<fill>_ | _PENDING_ (Family H/I/J unchanged, production-disabled) |
| Cutover monitor health (post-drill) | recent invocations succeeded, 0 failed, fresh | _<fill>_ | _PENDING_ |
| Drainer health (post-drill) | `active=true`, `schedule='* * * * *'`, M1 < 120s | _<fill>_ | _PENDING_ |

Verdict: _PENDING_ — PASS = master routing flag default-off, drainer + watchdog ticking healthy, zero pending queue rows, zero non-smoke args routed, zero duplicate-success, zero direct-dispatch leakage for smoke args, zero H/I/J rows.

---

## Provenance + boundary compliance

- **CC provider-spend invocations this card:** **0** by CC. The burst harness in Phase (b) is operator-run; it triggers ≈ 7·N Anthropic calls downstream via the drainer (the operator-authorized spend). CC issues NO `submit-argument` / `classify-argument-boolean-observations` / MCP / Anthropic / xAI / X API call.
- **CC writes (DB):** **0**. CC ran only read-only `SELECT` SQL via `npx supabase db query --linked --file <path>`. All SQL files live under `.claude-tmp/load-smoke-queries/` (gitignored). Read-only-leak-safe assertion `.claude-tmp/load-smoke-queries/assert-read-only.cjs` (mirrors `.claude-tmp/rehearsal-queries/assert-read-only.cjs`) verifies no INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/GRANT/REVOKE/MERGE/COPY/CALL/EXECUTE in any `.sql` file in the load-smoke pack and no `evidence_span` selection.
- **CC writes (file system):** docs/audits/<this file>; the load-smoke harness + query pack under `.claude-tmp/` (all gitignored). The `.claude-tmp/rehearsal-queries/` set is **untouched** (byte-equal); the load-smoke set is a sibling at `.claude-tmp/load-smoke-queries/`.
- **Mutations performed by operator (drill window only):** (a) set `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` in Edge Function env (Phase a); (b) set `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (Phase e). No cron alteration. No percentage change (percentage stays `0` throughout). No source / migration / familyRegistry / package.json edits.
- **Provider spend during drill:** = exactly the operator-authorized burst (≈ 7·N Anthropic calls). Recorded in `.claude-tmp/queue-load-smoke-burst.jsonl` summary `{posted: N, failed: <fill>}`.
- **Non-smoke production impact:** **0** expected — production-isolation check in Phase (f) confirms `routed_non_smoke_args_in_window = 0`.
- **No source / migration / runtime-flag change to main by this card.** Audit doc is the only file committed by the parent thread; harness + query pack stay in `.claude-tmp/` (gitignored).
- **No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / prompt text / provider payloads are written to this audit.**

---

## Authorizations + follow-ups

**On PASS:**
- The load path is proven for H-like concurrent provider load under the C=3 drainer cap; the queue eliminates the H Card 3 LEGACY direct-dispatch error cluster (per §7.8 inference).
- Authorize **Stage 1 routing flip** (`OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1`): operator sets `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` + `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1` for the 1% ramp, OR — if real production traffic is too low for a meaningful 1% ramp — authorize a **broad enable** at a higher percentage backed by the proof from this drill plus the rollback rehearsal. Decision to be made via separate operator prompt; do NOT auto-flip from this audit.

**On PARTIAL / FAIL:**
- HALT. Do NOT proceed to any production ramp.
- Investigate the failing criterion. Likely tuning surfaces (in order of suspicion):
  1. Drainer global C (currently 3) — too low if `mcp_api_error` cluster persists with thin retry queue; too high if M2 oldest-pending-age spikes inside the drainer's own retry window.
  2. Retry backoff schedule (`[60, 180, 360]`s) — lengthen if the cluster is provider-rate-limit-shaped; shorten if cells dead-letter prematurely.
  3. DRAINER_MAX_ATTEMPTS (currently 4) — raise carefully if dead-letter band exceeded but a fifth attempt would have closed many cells.
  4. Per-isolate cap (currently 5) — lower if global C=3 is held by stale leases across multiple isolates.
- Open a follow-up card under `OPS-MCP-PROVIDER-RELIABILITY-DRAINER-TUNING` if any of the above is changed.

**Other follow-ups (regardless of verdict):**
- **H production retry** (`MCP-021C-EDGE-FAMILY-H-ENABLE-RETRY`) remains gated by Stage 5 PASS holding ≥ 1 week AFTER the cutover Stage 1 / broad-enable proof lands.
- **Watchdog cadence tightening** (`OPS-CUTOVER-WATCHDOG-CADENCE-TIGHTENING`) — the rehearsal audit (PR #414) recorded a structural finding about M1+watchdog email-latency composition. Not blocked by this card; revisit before strict-< 5 min detection is required.

---

## Smoke artifacts

- **Burst harness (gitignored; operator-run-only):** `.claude-tmp/queue-load-smoke-burst.cjs` — mirrors `.claude-tmp/rollback-rehearsal-submit.cjs` (loadEnv/supabaseClient/submitMove trio + emit() allowlist + smoke-tag prefix discipline). DISTINCT file at a DISTINCT path; the rehearsal harness is untouched (byte-equal).
- **Query pack (gitignored):** `.claude-tmp/load-smoke-queries/*.sql` + `assert-read-only.cjs`. DISTINCT directory; sibling of `.claude-tmp/rehearsal-queries/` (which stays untouched / byte-equal).
- **Synthetic argument ids + debate ids:** recorded in Phase (b) evidence above (N pairs).
- **Synthetic debate title prefix:** `[arch-001-queue-smoke]` (the routing override key; same load-bearing tag the rehearsal used).
- **Burst JSONL output:** `.claude-tmp/queue-load-smoke-burst.jsonl` (gitignored; one event per line; safe metadata only).
- **Anthropic spend bookkeeping:** ≈ 7·N calls bounded; recorded in burst JSONL exit summary.
- **Output discipline:** No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / prompt text / raw provider payloads are written to this audit or any artifact.
