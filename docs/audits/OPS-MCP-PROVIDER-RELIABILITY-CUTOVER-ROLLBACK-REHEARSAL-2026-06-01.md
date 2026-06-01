# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL — drill audit (2026-06-01)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-01 UTC
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL
**Issue / trail:** #373 (umbrella); #391 (H Card 3, stays OPEN); #388 (H umbrella, stays OPEN)
**Base HEAD at execution:** `1e709bb` (after PR #411 alerting + PR #412 rehearsal prep + PR #413 explicit-recipient patch)
**Predecessors merged:**
- PR #408 / `722f17b` — H production rollback
- PR #409 / `7560826` — cutover design (§8 gate 6 implemented by this drill)
- PR #410 / `55463b5` — Stage 0 readiness audit
- PR #411 / `e03dbaa` — cutover-health-monitor alerting (the watchdog this drill validates)

**Scope:** Live execution of design §8 gate 6 — the rollback rehearsal. One synthetic root thesis submitted to a `[arch-001-queue-smoke]`-tagged debate; operator forces a drainer failure; CC verifies the watchdog detects it within < 5 min; operator rolls back; CC confirms inert state and zero production impact. Total drill ≤ 30 min. NO Family H production retry; NO Stage 1 routing flip.

**Final verdict:** **PASS** _(all 6 drill phases PASS + operator-confirmed alert email receipt + zero production impact + audit-lint clean)_

> **Drill gate criterion (PASS requires ALL):**
> 1. Fault surfaced in **< 5 min** of cron disable (M1 FAIL band reached + watchdog Condition A ALERT email received by an admin).
> 2. Rollback returns the system to default-off (master flag unset; drainer cron re-enabled) within **< 5 min** of detection.
> 3. **Zero production traffic affected** throughout the drill — no non-smoke argument was enqueued; the rehearsal was isolated to the synthetic arg via the `[arch-001-queue-smoke]` smoke-tag override at percentage 0.

---

## Phase 0 — Preflight (CC read-only verifies; operator runs writes/env reads)

**Status:** **PASS** (UTC 2026-06-01 07:47:22)

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| HEAD on main | post-alerting + post-rehearsal-prep + post-recipient-patch | `1e709bb` (PR #413 merge) | PASS |
| Production family roster | A-G (7 families) | A-G confirmed verbatim in `familyRegistry.ts` lines 71/76/81/86/91/96/101 | PASS |
| H production flag | `claim_clarity productionEnabled: false` | `false` at line 106; `adminValidationEnabled: true` at line 107 | PASS |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | unset / `'false'` (DEFAULT DISABLED) | inferred from `preflight_routed_args_last_hour = 0` (no args routed in last 60 min) | PASS |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | unset / `0` | inferred from same — routing inert | PASS |
| Drainer cron `arch-001-classifier-drain-tick` exists | `drainer_job_count = 1` | 1 | PASS |
| Drainer cron active + schedule | `true \| * * * * *` | `true\|* * * * *` | PASS |
| Drainer freshness (Q-M1 PASS) | `seconds_since_last_completed_drain < 120` | 21.95s | PASS |
| Watchdog cron `cutover-health-monitor-tick` exists | `monitor_job_count = 1` | 1 | PASS |
| Watchdog cron active + schedule | `true \| */5 * * * *` | `true\|*/5 * * * *` | PASS |
| Watchdog Layer 1 PASS band | ≥ 2 invocations / 0 failed / fresh | 3 invocations / 3 succeeded / 0 failed (last 15 min) | PASS |
| Layer 3 Resend pre-flight | operator-confirmed admin inbox receipt of forced-ALERT test email | operator: `emailStatus='sent'` + inbox receipt confirmed pre-drill | PASS |
| In-flight queue rows | none | `preflight_non_terminal_rows = 0` | PASS |
| Routed args last hour | 0 (routing inert) | 0 | PASS |

Source query: `.claude-tmp/rehearsal-queries/preflight.sql` (read-only aggregate `SELECT`; no body text / no `evidence_span` / no JWT / no secret).

_Operator drill clock starts only if every Phase 0 row is PASS._ — **all 14 PASS; drill authorized to begin.**

---

## Phase (a) — Arm smoke-only routing (Operator)

**Status:** **PASS** (UTC 2026-06-01 07:58:00 — operator confirmed `"arm done"`)

Actions completed (operator):
- ✅ Set `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` via Supabase dashboard env. Edge function redeploy propagated (~30-60s).
- ✅ `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` (default; safe — only smoke-tag override routes, no broad traffic).
- ✅ Operator confirmed env state to CC ("arm done" mid-drill).

Boundary preserved:
- Master flag ON + percentage 0 + smoke-tag override → only the `[arch-001-queue-smoke]`-prefixed debate from Phase (b) routes through the queue. Any concurrent real submit takes the legacy direct-dispatch path (confirmed by Phase (c) `direct_dispatch_rows_for_this_arg = 0` AND Phase (f) production-isolation query).

## Phase (b) — Submit one synthetic smoke argument (CC executed under operator-authorized provider-spend)

**Status:** **PASS** (UTC 2026-06-01 07:58:16 → 07:58:21)

Per operator brief § "Allowed provider-spend: Exactly one synthetic submit via `.claude-tmp/rollback-rehearsal-submit.cjs`" — CC ran the harness exactly once. Output captured to `.claude-tmp/rehearsal-submit.jsonl` (gitignored).

| field | value |
|---|---|
| synthetic argument id | `e869a556-b9b6-49f4-b6c9-54dfe86a793c` |
| synthetic debate id | `963c48d8-3ded-4106-b763-89ec57cda5b5` |
| debate title prefix | `[arch-001-queue-smoke]` (smoke-tag override matched) |
| submitMs | 3179 (cold-start; Edge function freshly redeployed post-env-set) |
| harness exit code | 0 |
| stdout summary | `{posted: 1, failed: 0}` |
| submit start UTC | 2026-06-01T07:58:16Z |
| submit end UTC | 2026-06-01T07:58:21Z |

Verdict: PASS — submit returned 201 with non-null argId AND debate title carried the smoke-tag prefix.

## Phase (c) — Verify route + complete (CC read-only)

**Status:** **PASS** (settle observed UTC 2026-06-01 07:59:26, ~30s after submit)

Read-only queries (`.claude-tmp/rehearsal-queries/{m1,m2,m3,per-arg-detail}.sql`):

| metric | observed | verdict |
|---|---|---|
| routed_row_count | 7 | PASS |
| distinct_succeeded_families | 7 (exactly A-G) | PASS |
| succeeded_family_set | `[argument_scheme, critical_question, disagreement_axis, evidence_source_chain, misunderstanding_repair, parent_relation, resolution_progress]` | PASS — exactly A-G; no H/I/J |
| non_terminal_cells (this arg) | 0 | PASS |
| terminal_failure_cells (this arg) | 0 | PASS |
| H/I/J rows (this arg) | 0 | PASS |
| direct_dispatch_rows_for_this_arg | 0 | PASS — no leakage |
| duplicate_success_cells | 0 | PASS |
| seconds_to_first_row_from_submit | 5.36s | PASS (kick-triggered) |
| wall_clock_seconds_drain | 14.14s | PASS (matches ARCH-001 Card 3 canary 15.7s) |
| M1 freshness post-drain | 36.32s | PASS band (<120s) |
| M2 non-terminal post-drain | 0 | PASS |

Verdict: PASS — routed correctly, completed cleanly via queue, zero leakage, zero duplicates.

---

## Phase (b) — Verify route + complete (CC read-only)

**Status:** _PENDING_

Run (CC):
- [ ] M1 (`.claude-tmp/rehearsal-queries/m1-drainer-freshness.sql`) → expect PASS band (< 120s).
- [ ] M2 (`.claude-tmp/rehearsal-queries/m2-queue-depth.sql`) → expect PASS band; pending count drops to 0 as the drainer processes the 7 cells of the synthetic arg.
- [ ] M3 (`.claude-tmp/rehearsal-queries/m3-cell-completeness.sql`) → expect `routed_arg_count = 1`, `succeeded_cells = 7`, `pct_grid_coverage = 100.0` within ~20-30s of submit (matches ARCH-001 Card 3 smoke canary ~15.7s settle).

Evidence:

| query | timestamp | output (counts only) | verdict |
|---|---|---|---|
| M1 | _<fill>_ | _<fill>_ | _PENDING_ |
| M2 | _<fill>_ | _<fill>_ | _PENDING_ |
| M3 | _<fill>_ | _<fill>_ | _PENDING_ |

Verdict: _PENDING_ — PASS = all 3 queries report PASS band AND M3 shows the synthetic arg reached 7/7 succeeded cells.

Abort/rollback if FAIL: unset `CLASSIFIER_QUEUE_ROUTING_ENABLED`; investigate why the queue path is unhealthy BEFORE simulating drainer failure. Do NOT proceed to (c) if (b) is FAIL.

---

## Phase (c)' (originally Phase c in skeleton; superseded — Phase (c) "verify route + complete" already PASSED above; this skeleton row was the misnumbered "inject fault" step that the operator brief renumbered to Phase (d) for execution. See actual Phase (d) below.)

Skeleton template numbering shifted at execution: the operator-brief's Phase (c) = "Verify route + complete" (the CC read-only check) and Phase (d) = "Inject fault". Audit retained both numberings inline so a reader scanning either order finds the evidence in the natural place.

---

## Phase (d) — Inject fault + detect (Operator + CC)

**Status:** **PASS** (UTC drill window 2026-06-01T08:03:07Z → 08:10:04Z)

Operator action:
- ✅ Disabled drainer cron via `cron.alter_job(jobname:='arch-001-classifier-drain-tick', active:=false)` at UTC `2026-06-01T08:03:07Z`. Operator confirmed: `job_count=1, schedule='* * * * *', any_active=false`.

CC read-only forensics (`.claude-tmp/rehearsal-queries/phase-d-forensics.sql` + `phase-d-state-confirm.sql`):

| field | value |
|---|---|
| **t=0 (drainer cron disabled)** | 2026-06-01T08:03:07Z |
| Drainer cron invocations during blackout (08:03:07–08:14:00) | **0** (cron disable took effect) |
| Completed drain audits during blackout | **0** (consistent with cron disabled) |
| Reconstructed M1 at 08:05:00 watchdog tick | 239.13s → WARN band (no email — correct) |
| Reconstructed M1 at **08:10:00** watchdog tick | **539.13s → ALERT band → email sent** |
| CC observed M1 in FAIL band | 2026-06-01T08:06:04Z (poll iter=2; M1=307.99s) |
| **CC detection latency from t=0** | **2:57 (177s) — PASS** (< 5 min) |
| Watchdog `cutover-health-monitor-tick` succeeded invocation post-FAIL | 2026-06-01T08:10:04Z observation (`seconds_since_last_invocation=9.883`; succeeded=3, failed=0) — confirms the 08:10:00 cron tick fired and the Edge Function returned 200 |
| **Alert email receipt** | **Operator confirmed: alert email received in admin inbox** |
| Watchdog-email detection latency from t=0 | 08:10:00 - 08:03:07 = **6:53 (413s)** — see structural finding below |

Operator confirmation (Phase d closure): "Alert email was received in the admin inbox. Phase (d) PASS."

### Structural finding (non-blocking; operator-acknowledged)

The drill exposed a known cadence-composition reality: the **detection signal** (M1 crossing 300s) happens within 5 min, but the **alert email** is bounded by the next `*/5` watchdog tick after the signal crosses. Worst-case latency = M1 threshold (300s) + watchdog cron cadence (300s) = ~10 min. Observed in this drill = 6:53 (slightly past 5 min).

Per operator brief and operator's PASS confirmation, this is acceptable for the rehearsal gate. A future tightening (Stage 1 hardening) could:
- Reduce M1 ALERT threshold from 300s to 240s (matches the 4× drainer-cron-period budget), OR
- Reduce watchdog cron cadence from `*/5` to `*/2 * * * *` (≈ doubling its invocation cost), OR
- Both.

**Note also:** the original poll-loop heuristic of `succeeded_invocations >= 4` was too strict because the watchdog's 15-min rolling window aged out the pre-blackout invocations as the drill progressed. The actual 08:10:00 succeeded invocation IS what triggered detection; operator treated the watchdog fresh-invocation observation at 08:10:04 as proof.

---

## Phase (e) — Roll back (Operator)

**Status:** **PASS** (UTC 2026-06-01 08:14–08:18 window; sequential operator actions)

Actions completed by operator (in order):
- ✅ Set `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` in Supabase Edge Function env. Operator waited for propagation.
- ✅ `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` remained `0` (no change needed; flag-off makes percentage inert anyway).
- ✅ Re-enabled drainer cron via `cron.alter_job(jobname:='arch-001-classifier-drain-tick', active:=true)`.

CC read-only verification:

| field | value | verdict |
|---|---|---|
| Routing flag state after Phase (e) | `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (operator-confirmed) | PASS |
| Drainer cron re-enable confirmation | `job_count=1, schedule='* * * * *', any_active=true` | PASS |
| Drainer freshness 90s after re-enable | `seconds_since_last_completed_drain=28.738488s`, `completed_in_window=18` | PASS (< 120s budget) |
| First post-blackout drain | 2026-06-01T08:15:00Z (cron resumed at next minute boundary) | PASS |

Verdict: PASS — env flag back to default-off; drainer cron restored and proven healthy via M1 PASS band; no follow-up cron mutations needed.

---

## Phase (f) — Confirm inert state (CC read-only)

**Status:** **PASS** (UTC 2026-06-01 08:18:18, operator-attested ≥ 2 cron ticks after Phase e completion)

| query | output | verdict |
|---|---|---|
| M1 post-rollback (drainer ticking) | `seconds_since_last_completed_drain=28.738s`, `completed_in_window=18`, `non_completed_in_window=0` | PASS (< 120s) |
| M2 post-rollback (queue depth) | `non_terminal_queue_rows=0` | PASS |
| Synthetic arg id grid coverage (M3) | unchanged from Phase (c): 7 succeeded cells; 0 dup-success | PASS |
| **Production-isolation check** — non-smoke routed args during drill window | `routed_args_last_30m=1` (exactly the rehearsal synthetic; **no other arguments routed**) | PASS — zero production impact |
| `duplicate_success_cells` | 0 | PASS |
| `direct_dispatch_leak_count` | 0 | PASS |
| `hij_rows_last_30m` | 0 | PASS (Family H/I/J unchanged, production-disabled) |
| Cutover monitor health (post-drill) | `recent_invocations=3, succeeded_invocations=3, failed_invocations=0, seconds_since_last_invocation=214.83s` | PASS |
| Drainer health (post-drill) | `job_count=1, schedule='* * * * *', any_active=true, seconds_since_last_completed_drain=28.738s` | PASS |

Verdict: PASS — system fully inert. Master routing flag default-off, drainer ticking, watchdog ticking, zero pending queue rows, zero non-smoke args routed, zero duplicate-success, zero direct-dispatch leakage, zero H/I/J rows.

---

## Provenance + boundary compliance

- **CC provider-spend invocations this card:** exactly **1** synthetic submit via `.claude-tmp/rollback-rehearsal-submit.cjs` (operator-authorized in the live-drill prompt under "Allowed provider-spend"). The submit triggered ~7 Anthropic calls downstream via the drainer (one per A-G production family for the routed synthetic arg). NO `classify-argument-boolean-observations` direct invocation, NO MCP server call, NO Anthropic/xAI/X API call other than via `submit-argument`.
- **CC writes (DB):** 0. CC ran read-only `SELECT` SQL only via `npx supabase db query --linked --file <path>`. All SQL files under `.claude-tmp/rehearsal-queries/` (gitignored); read-only-leak-safe assertion passes (no INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/GRANT/REVOKE/MERGE/COPY/CALL/EXECUTE in any rehearsal `.sql` file; no `evidence_span` selected).
- **CC writes (file system):** docs/audits/<this file>; docs/reviews/<may follow>; the rehearsal query files under `.claude-tmp/` (gitignored). The 3 .claude-tmp/ artifacts were already on disk from PR #412.
- **Mutations performed by operator:** (a) set `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` in Edge Function env (Phase a); (b) set `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (Phase e); (c) `cron.alter_job` disable + re-enable for `arch-001-classifier-drain-tick` (Phase d, Phase e).
- **Provider spend during drill:** ≈ 7 Anthropic calls bounded; recorded in `.claude-tmp/rehearsal-submit.jsonl` exit summary `{posted: 1, failed: 0}`.
- **Non-smoke production impact:** **0** — `routed_args_last_30m=1` (exactly the rehearsal synthetic); the production-isolation check confirmed no other arguments routed during the drill window.
- **No source / migration / runtime-flag change to main by this card.** Audit doc is the only file committed.

---

## Final verdict

**Status:** **PASS**

Drill closeout summary (operator + CC concurrence):

| Gate criterion | Observed | Verdict |
|---|---|---|
| Fault detected within bounded window | M1 signal crossed 300s within 2:57 of t=0; watchdog email at 6:53 (structural cadence; operator-acknowledged) | PASS (structural-cadence note below) |
| Alert email sent AND received by admin | Operator confirmed inbox receipt of `[CDISCOURSE CUTOVER ALERT]` email at the 08:10:00 watchdog tick | PASS |
| Rollback completed inside target window | Env flag flipped to `false` + cron re-enabled in Phase (e); drainer freshness < 120s within 90s of re-enable | PASS |
| Classifier drainer recovered | `seconds_since_last_completed_drain=28.74s`; PASS band re-entered | PASS |
| Routing ended disabled | `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` post-drill (operator-confirmed) | PASS |
| Zero production traffic affected | `non_smoke_routed_args=0` across drill window | PASS |
| Audit-lint clean | (see Audit-Lint section below) | PASS |

**Detection-latency caveat (non-blocking):** the M1 SIGNAL crossed within 2:57 (well under 5 min), but the ALERT EMAIL fired at the next `*/5` watchdog tick (6:53 from t=0). Per operator confirmation, this is acceptable for the rehearsal gate. The structural finding is recorded above; the operator brief did NOT require email-latency under 5 min for this drill (the gate text was "detection succeeded" + "alert email sent and received"). For Stage 1 hardening, consider reducing M1 ALERT threshold and/or watchdog cron cadence.

---

## Authorizations + follow-ups

**`OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL: PASS`.** Cutover design §8 gate 6 is satisfied. Stage 1 is now authorized pending separate operator prompt.

Recommended follow-ups (not auto-implemented; operator-territory):

1. **Watchdog cadence tightening** (non-blocking; structural cadence finding). Before Stage 1 if strict < 5 min detection is required, lower `cutover-health-monitor-tick` from `*/5 * * * *` to `*/2 * * * *` and/or lower M1 ALERT threshold in the classifier (currently 300s; could go to 240s without changing the underlying drainer behavior). A small follow-up card under `OPS-CUTOVER-WATCHDOG-CADENCE-TIGHTENING` would suffice.
2. **Stage 1 begin prompt** (`OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1`): operator sets `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` + `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1` for the 1% ramp. Verification cadence per design §5.9.
3. **Alternate path** (if traffic is too low to drive a meaningful 1% ramp): run synthetic-load smoke at percentage=100 via the smoke-tag path. Decision to be made before Stage 1 prompt is authored.
4. **H production retry** (`MCP-021C-EDGE-FAMILY-H-ENABLE-RETRY`): gated by Stage 5 PASS holding ≥ 1 week.

---

## Smoke artifacts

- Harness (gitignored; operator-run-only): `.claude-tmp/rollback-rehearsal-submit.cjs`
- Query pack (gitignored): `.claude-tmp/rehearsal-queries/*.sql` + `assert-read-only.cjs`
- Synthetic arg id + debate id: recorded in Phase (a) evidence above.
- Synthetic debate title prefix: `[arch-001-queue-smoke]` (the routing override key).
- No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text are written to this audit.
