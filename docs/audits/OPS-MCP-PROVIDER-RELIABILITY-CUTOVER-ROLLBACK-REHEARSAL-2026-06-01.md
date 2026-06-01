# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL — audit skeleton (2026-06-01)

Audit-Lint: v1
Audit-type: ops

**Date:** _<YYYY-MM-DD UTC>_ (placeholder; operator fills at execution time)
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL
**Issue / trail:** #373 (umbrella); #391 (H Card 3, stays OPEN); #388 (H umbrella, stays OPEN)
**Base HEAD at execution:** _<commit SHA>_ (placeholder; operator records the main HEAD at drill start)
**Predecessors merged:**
- PR #408 / `722f17b` — H production rollback
- PR #409 / `7560826` — cutover design (§8 gate 6 implemented by this drill)
- PR #410 / `55463b5` — Stage 0 readiness audit
- PR #411 / `e03dbaa` — cutover-health-monitor alerting (the watchdog this drill validates)

**Scope:** Live execution of design §8 gate 6 — the rollback rehearsal. One synthetic root thesis submitted to a `[arch-001-queue-smoke]`-tagged debate; operator forces a drainer failure; CC verifies the watchdog detects it within < 5 min; operator rolls back; CC confirms inert state and zero production impact. Total drill ≤ 30 min. NO Family H production retry; NO Stage 1 routing flip.

**Final verdict:** **PENDING** _(operator + CC fill at drill close; one of: PASS / PARTIAL / FAIL)_

> **Drill gate criterion (PASS requires ALL):**
> 1. Fault surfaced in **< 5 min** of cron disable (M1 FAIL band reached + watchdog Condition A ALERT email received by an admin).
> 2. Rollback returns the system to default-off (master flag unset; drainer cron re-enabled) within **< 5 min** of detection.
> 3. **Zero production traffic affected** throughout the drill — no non-smoke argument was enqueued; the rehearsal was isolated to the synthetic arg via the `[arch-001-queue-smoke]` smoke-tag override at percentage 0.

---

## Phase 0 — Preflight (CC read-only verifies; operator runs writes/env reads)

**Status:** _PENDING_

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| `git status -sb` clean (tracked) | yes; pre-existing operator-territory untracked OK | _<fill>_ | _PENDING_ |
| HEAD on main | `e03dbaa` or successor with alerting + rollback present | _<fill>_ | _PENDING_ |
| typecheck / lint / test exit 0 | yes | _<fill>_ | _PENDING_ |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | unset / `'false'` (DEFAULT DISABLED) | _<fill>_ | _PENDING_ |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | unset / `0` | _<fill>_ | _PENDING_ |
| Drainer cron `arch-001-classifier-drain-tick` | `active = true`, schedule `* * * * *` | _<fill>_ | _PENDING_ |
| Watchdog cron `cutover-health-monitor-tick` | `active = true`, schedule `*/5 * * * *` (or operator-chosen cadence) | _<fill>_ | _PENDING_ |
| Watchdog Layer 1 query | PASS band (≥ 2 invocations / 0 failed / `seconds_since_last_invocation` < 360) | _<fill>_ | _PENDING_ |
| Layer 3 Resend pre-flight | operator confirms an admin actually received a forced-ALERT test email | _<fill>_ | _PENDING_ |
| Production family roster | A-G (7 families) | _<fill>_ | _PENDING_ |
| H production flag | `claim_clarity productionEnabled: false` | _<fill>_ | _PENDING_ |
| In-flight queue rows | none (M2 PASS; oldest_pending null OR < 300s) | _<fill>_ | _PENDING_ |

_Operator drill clock starts only if every Phase 0 row is PASS._

---

## Phase (a) — Arm + submit (Operator)

**Status:** _PENDING_

Actions (operator):
- [ ] Set `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` via Supabase dashboard env (no PAT required). Wait for Edge function redeploy (≤ 60s).
- [ ] Confirm `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` (recommended default per design § "Critical reconciliation" — keeps the drill isolated to the synthetic arg; setting `100` would expand blast radius to all concurrent real submits).
- [ ] Run `node .claude-tmp/rollback-rehearsal-submit.cjs | tee .claude-tmp/rehearsal-submit.jsonl`.

Evidence:

| field | value |
|---|---|
| synthetic argument id | _<fill>_ |
| synthetic debate id | _<fill>_ |
| debate title (must start with `[arch-001-queue-smoke]`) | _<fill>_ |
| submit_response_latency_ms | _<fill>_ |
| harness exit code | _<fill>_ |
| stdout summary `{posted, failed}` | _<fill>_ |

Verdict: _PENDING_ — PASS = submit returned 201 with non-null argId AND debate title carries the smoke-tag prefix.

Abort/rollback if FAIL: unset `CLASSIFIER_QUEUE_ROUTING_ENABLED`; do NOT proceed to (b).

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

## Phase (c) — Inject fault (Operator)

**Status:** _PENDING_

Action (operator):
- [ ] Disable drainer cron:
  ```sql
  UPDATE cron.job SET active = false WHERE jobname = 'arch-001-classifier-drain-tick';
  ```
- [ ] Record exact UTC timestamp of the UPDATE — this is t=0 for the detection clock.

Evidence:

| field | value |
|---|---|
| t=0 (drainer cron disabled UTC) | _<fill>_ |
| rows affected by UPDATE | _<fill>_ (must be 1) |
| post-UPDATE verification: `SELECT active FROM cron.job WHERE jobname='arch-001-classifier-drain-tick'` | _<fill>_ (must be `false`) |

Verdict: _PENDING_ — PASS = `active = false` confirmed.

---

## Phase (d) — Detect fault (CC read-only + operator confirms email)

**Status:** _PENDING_

Detection clock: **must surface within < 5 minutes of t=0.**

CC runs every ~30-60 s starting at t+120s:
- [ ] M1 → expect FAIL band (`seconds_since_last_completed_drain > 300`) once 5 min have elapsed.
- [ ] Watchdog Layer 1 (`.claude-tmp/rehearsal-queries/watchdog-cron-freshness.sql`) → confirm the watchdog cron itself remains alive (PASS band) independent of the drainer cron. (If the watchdog cron also dies, the drill cannot validate detection — escalate.)
- [ ] Confirm cutover-health-monitor's most recent invocation observed Condition A ALERT (verify by querying `classifier_drain_audit` for drainer freshness AND, separately, monitoring `cron.job_run_details` for the watchdog cron's recent invocations).

Operator confirms:
- [ ] An ALERT-severity Resend email was delivered to at least one admin inbox during the 5-min detection window. Record the receipt timestamp (admin local clock OK; subject line should be `[CDISCOURSE CUTOVER ALERT] N alert / M warn`).

Evidence:

| field | value |
|---|---|
| t+5 min M1 `seconds_since_last_completed_drain` | _<fill>_ |
| t+5 min M1 verdict | _<fill>_ (must be FAIL) |
| Watchdog Layer 1 PASS through detection window | _<fill>_ (must be PASS — the watchdog cron must stay alive) |
| First Resend email receipt UTC | _<fill>_ |
| Email subject string | _<fill>_ |
| Email body cited Condition A | _<fill>_ (yes/no) |
| **Detection latency** (`first_alert_receipt - t0`) | _<fill>_ (PASS = < 300s) |

Verdict: _PENDING_ — PASS = detection latency < 5 min AND admin received an actual ALERT email AND the watchdog cron stayed alive throughout.

Abort/rollback if FAIL: even if (d) FAILs, proceed to (e) immediately to restore drainer cron — DO NOT leave the cron disabled past the drill window.

---

## Phase (e) — Roll back (Operator)

**Status:** _PENDING_

Actions (operator), executed sequentially:
- [ ] Record t+detection (operator clock at which the alert was observed/decided to roll back).
- [ ] Unset `CLASSIFIER_QUEUE_ROUTING_ENABLED` (or set `'false'`) via Supabase dashboard env. Wait for Edge function redeploy (≤ 60s).
- [ ] Re-enable drainer cron:
  ```sql
  UPDATE cron.job SET active = true WHERE jobname = 'arch-001-classifier-drain-tick';
  ```
- [ ] Record t+rollback UTC.

Evidence:

| field | value |
|---|---|
| t+detection UTC | _<fill>_ |
| Dashboard env update timestamp | _<fill>_ |
| `cron.job SET active = true` row count | _<fill>_ (must be 1) |
| post-UPDATE verification: `SELECT active …` | _<fill>_ (must be `true`) |
| t+rollback UTC | _<fill>_ |
| **Rollback latency** (`t+rollback - t+detection`) | _<fill>_ (PASS = < 300s) |

Verdict: _PENDING_ — PASS = both env unset AND cron re-enable confirmed within 5 min of detection.

---

## Phase (f) — Confirm inert state (CC read-only)

**Status:** _PENDING_

Run (CC), after (e) completes and ≥ 2 cron ticks have elapsed (~2-3 min):
- [ ] M1 → expect PASS band again (drainer ticking).
- [ ] M2 → expect non_terminal_rows = 0 OR shrinking; any in-flight smoke arg either completes once cron is back OR falls to dead-letter.
- [ ] M3 → for the synthetic arg id from Phase (a), confirm `routed_arg_count` row is unchanged from Phase (b) (no double-count, no duplicate success).
- [ ] Production-isolation check: verify ZERO non-smoke arguments were enqueued during the entire drill window:
  ```sql
  SELECT COUNT(*) AS non_smoke_routed_args
  FROM public.argument_machine_observation_runs r
  JOIN public.debates d ON d.id = r.debate_id
  WHERE r.family IS NOT NULL
    AND r.created_at >= '<t=phase a start>'::timestamptz
    AND NOT (d.title LIKE '[arch-001-queue-smoke]%');
  ```
  Expected: 0.

Evidence:

| query | output (counts only) | verdict |
|---|---|---|
| M1 post-rollback | _<fill>_ | _PENDING_ (must be PASS band) |
| M2 post-rollback | _<fill>_ | _PENDING_ (must be PASS band) |
| M3 post-rollback (synthetic arg) | _<fill>_ | _PENDING_ |
| non_smoke_routed_args during drill window | _<fill>_ | _PENDING_ (must be 0) |

Verdict: _PENDING_ — PASS = system is inert (master flag default-off; drainer ticking; no double-count; zero non-smoke args routed during drill window).

---

## Provenance + boundary compliance

- **CC provider-spend invocations this card:** 0 (no `submit-argument`, no `classify-argument-boolean-observations`, no MCP, no Anthropic/xAI/X).
- **CC writes:** 0 (CC ran read-only SQL only via `npx supabase db query --linked --file <path>`; the audit doc was the only write to the file system).
- **Mutations performed by operator:** the `CLASSIFIER_QUEUE_ROUTING_ENABLED` env flip ON + OFF; the two `UPDATE cron.job` statements (disable then re-enable); ONE synthetic submit via the bot-fixture harness.
- **Provider spend during drill:** ≈ 7 Anthropic calls (one per A-G production family for the routed synthetic arg). Bounded; recorded in the harness exit summary.
- **No source / migration / runtime flag change to main by this card.** Audit doc + skeleton inputs only.

---

## Final verdict

**Status:** _PENDING_

PASS / PARTIAL / FAIL — operator fills, citing:
- Detection latency value vs 5-min budget.
- Rollback latency value vs 5-min budget.
- `non_smoke_routed_args` count (must be 0).
- Resend email receipt confirmation.

---

## Authorizations + follow-ups

On PASS:
- `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL: PASS`.
- Cutover design §8 gate 6 is satisfied.
- Next operator-authorized prompt is the staged cutover begin: `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1` OR (if there is little/no real traffic) a synthetic-load smoke at 100% percentage via the smoke-tag path (see cutover design § "What comes after").

On PARTIAL or FAIL:
- HALT. Do NOT advance to Stage 1.
- Fix the surfaced gap (drainer audit-write reliability; watchdog cron stability; Resend deliverability; rollback propagation latency).
- Re-rehearse before any cutover step.

---

## Smoke artifacts

- Harness (gitignored; operator-run-only): `.claude-tmp/rollback-rehearsal-submit.cjs`
- Query pack (gitignored): `.claude-tmp/rehearsal-queries/*.sql` + `assert-read-only.cjs`
- Synthetic arg id + debate id: recorded in Phase (a) evidence above.
- Synthetic debate title prefix: `[arch-001-queue-smoke]` (the routing override key).
- No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text are written to this audit.
