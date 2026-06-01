# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL — Executable drill runbook

**Status:** Design draft. Docs-only in THIS phase. The drill itself (Phase 4 execution) is operator-authorized and involves operator env / cron writes plus ONE synthetic provider-spend submit (≈ 7 Anthropic calls via the drainer); CC stays read-only throughout.
**Epic:** Epic 12 / MCP semantic-referee track (Civil Discourse classifier infrastructure)
**Issue / trail:** Predecessor PRs: PR #408 (H rollback `722f17b`), PR #409 (cutover design `7560826`), PR #410 (Stage 0 readiness audit `55463b5`), PR #411 (alerting card `e03dbaa`). Parent: `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` §8 gate 6.
**Branch:** `feat/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL`
**Base SHA:** `e03dbaa` (origin/main, PR #411 alerting merge).
**Date:** 2026-06-01 UTC (operator local 2026-05-31).
**Operator:** Kyler.

> **Constitutional invariant (HARD; repeated because it is the spine).** AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine (`src/lib/constitution/engine.ts`) is the sole acceptance gate. Classifiers run AFTER an argument is stored. No step in this rehearsal blocks, rejects, routes, or delays an ordinary user post. The synthetic argument used in the drill is dispatched on a `[arch-001-queue-smoke]`-tagged debate so the routing predicate isolates it; production traffic is left on the legacy direct-dispatch path throughout.

> **Why this card exists.** ARCH-001 is shipped + smoke-PASSED. The next gate in the cutover chain is §8 gate 6 of the cutover design: rehearse the rollback end-to-end before flipping any production traffic onto the queue. This document is the **standalone, executable runbook** for that drill — written so the operator can run the entire procedure from one document without scrolling the 664-line cutover design.

---

## 0. Cannot-proceed preconditions (read this first)

If ANY of the following is unmet at drill time, **do not begin** the rehearsal. Surface the unmet precondition to the operator and STOP.

| # | Precondition | How to verify |
|---|---|---|
| 1 | Green baseline on main HEAD `e03dbaa`. `npm run typecheck && npm run lint && npm run test` exit 0. | CC runs read-only verifications; operator runs full test command outside the drill window. |
| 2 | Alerting card active. Migration `20260601000001_cutover_health_metrics_function.sql` present; Edge function `supabase/functions/cutover-health-monitor/index.ts` present; classifier `src/features/cutoverHealthAlerts/cutoverHealthAlertModel.ts` present. | File presence check (CC, read-only). |
| 3 | `cutover-health-monitor-tick` pg_cron scheduled + active. | CC runs SQL Q-W1 below; PASS if `recent_invocations >= 2` AND `failed_invocations = 0`. |
| 4 | **Resend pre-flight (Layer 3) passed.** An admin actually received a Resend email from `cutover-health-monitor` during a forced ALERT condition. (See `docs/runbooks/cutover-health-monitor.md` § "Layer 3 — Resend pre-flight before alerting goes live".) | Operator confirms admin inbox receipt out-of-band; CC cannot verify this. |
| 5 | Production family roster is A–G. `claim_clarity` `productionEnabled: false`. | `supabase/functions/_shared/booleanObservations/familyRegistry.ts:106` (CC read-only file check). |
| 6 | Routing master flag is currently OFF: `CLASSIFIER_QUEUE_ROUTING_ENABLED` unset OR `'false'`; `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` unset OR `0`. | Operator-only env read via Supabase console (CC cannot access env). |
| 7 | No competing routing change in flight (no open PR touching `classifierQueueRouting.ts`, `submit-argument/index.ts:780-846`, or `classifier-drainer/`). | Operator checks via `gh pr list --search "classifierQueueRouting OR submit-argument OR classifier-drainer"`. |
| 8 | Drainer cron `arch-001-classifier-drain-tick` is `active = true` with `* * * * *`. | CC runs SQL Q-Pre1 below. |
| 9 | Queue is quiet (no in-flight non-terminal rows on non-smoke debates in last 30 min). | CC runs M2 in §6 below. |
| 10 | Operator has confirmed staffing for the ≤30-min rehearsal window. | Operator-only. |

**If any precondition FAILS, the drill does not begin.** Specifically: if (2) or (3) fails, the alerting card is not actually active and the rehearsal step (d) — "watchdog observes fault" — cannot be validated. Operator must finish the alerting setup first.

---

## 1. Drill scope + non-goals

### In scope (this drill)

- Verify the ARCH-001 queue path completes a routed argument end-to-end via the drainer (M1/M2/M3 PASS).
- Verify the cutover-health-monitor watchdog detects a dead drainer within < 5 min (Condition A reaches ALERT band) AND the Resend email lands in an admin inbox.
- Verify the master-flag flip-off returns the system to a fully inert default-off state with **zero production traffic affected** throughout.
- Confirm the detection SLA + rollback latency budget are achievable in practice with the procedure as designed.

### Non-goals (HARD; not in this drill)

- **NO** Stage 1 routing percentage > 0 on non-smoke traffic. The drill uses percentage = 0 + smoke-tag override path; no real production argument is routed.
- **NO** Family H production-enable re-attempt. H stays frozen (`productionEnabled: false`).
- **NO** family registry / Constitution / migration / source-code change.
- **NO** durable env / Vault / cron change after the drill closes. Both operator env and cron mutations are temporary; the final operator action is to restore the cron and unset the master flag.
- **NO** measurement of throughput at scale, no Anthropic tier upgrade test, no load shape characterization. This is a binary-pass drill: rollback works or it doesn't.

### What "works" means

The rehearsal PASSES when **ALL** of the following hold:

1. Step (b): one synthetic routed argument reaches 7/7 succeeded cells with `pct_grid_coverage > 99.0%` (M3 PASS).
2. Step (d): after simulated drainer death, M1 surfaces `seconds_since_last_completed_drain > 300` within **< 5 min** AND the cutover-health-monitor watchdog reports Condition A at ALERT severity AND an admin receives the Resend email.
3. Step (f): after master flag is unset + cron re-enabled, the system is verifiably inert: routing predicate returns `false` for every argument; M6 direct-dispatch leakage on the synthetic arg = 0; queue settles (in-flight smoke arg completes once cron is back OR falls to dead-letter; no production arg is affected throughout the drill).
4. Total drill wall-clock ≤ 30 min.
5. Detection-to-rollback budget ≤ 10 min (5 min detection + 5 min rollback execution).

If ANY of these fails, the drill FAILS; do not advance to Stage 1.

---

## 2. Critical reconciliation — percentage 0 vs 100

**Recommendation: rehearse at `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE = 0` (smoke-tag override path).** Document the decision; let the operator override only with explicit reason.

### Why the cutover design said 100

`docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` §8 gate 6(a) lines 577–584 say "Set `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` + `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=100` with a `[arch-001-queue-smoke]`-tagged synthetic debate (smoke-tag override path)." The design's choice of 100 was probably written under the assumption that percentage and smoke-tag override are equivalent for a synthetic-only run.

### Why percentage = 0 is the safer default

Per cutover design §1 routing matrix lines 65–73 (Routing path matrix, rows 1–3):

- **Master flag ON + percentage 0 + `[arch-001-queue-smoke]` debate** → ARCH-001 queue path **only** for the smoke-tagged argument. Every NON-smoke-tagged debate's submit stays on direct-dispatch. Production traffic untouched.
- **Master flag ON + percentage 100** → ALL non-smoke-tagged production arguments route to the queue ALSO. If there is ANY real production traffic during the 30-min drill window, it routes through ARCH-001 — which, before Stage 1, is exactly the routing change the operator is trying to *rehearse the rollback for*, not adopt.

### Recommendation in operational terms

| Configuration | Effect | Recommended? |
|---|---|---|
| Master flag ON; percentage = 0; smoke-tag override on synthetic arg | Drill argument routes; ZERO production traffic affected | **YES (DEFAULT)** |
| Master flag ON; percentage = 100; smoke-tag on synthetic arg | Drill argument routes; ALL non-smoke production args ALSO route during drill window | Only if confirmed zero production traffic (e.g., maintenance window) AND operator wants to also stress-test the percentage path |

**Operator decision required at PR-creation time.** See §9. Default is `0`.

---

## 3. Per-step operator / CC split (the drill table)

Each step names: **WHO** performs it (Operator or CC), the **EXACT** command or SQL (transcribed verbatim with citation), the **EXPECTED** result + PASS/PARTIAL/FAIL threshold, and the **ABORT/ROLLBACK** action if it fails.

### Convention

- **CC = Claude Code.** Read-only `SELECT` via `npx supabase db query --linked --file <path>` ONLY. The 4 query files live at `.claude-tmp/rehearsal-queries/*.sql` (gitignored) and are also reproduced inline in §6 below.
- **Operator = Kyler.** Env flips via Supabase dashboard or PAT-authenticated `supabase secrets set`; cron mutations via `UPDATE cron.job`; the synthetic submit via the harness at `.claude-tmp/rollback-rehearsal-submit.cjs` (gitignored, operator-run only — CC does NOT execute this script).
- All `UPDATE cron.job …` statements run via `npx supabase db query --linked --file <path>`. Operator transcribes the one-liner into a small SQL file rather than typing inline at the shell.
- **Time budget:** Step (a) 2 min · (b) 5 min · (c) < 1 min · (d) ≤ 5 min (must be ≤ 5 min to PASS) · (e) 2 min · (f) ≤ 5 min · close ≤ 10 min · **Total ≤ 30 min**.

### Drill steps

| Step | Who | Action | PASS / PARTIAL / FAIL | Abort / rollback |
|---|---|---|---|---|
| **Preflight** | CC | Run §6 Q-Pre1 (cron `arch-001-classifier-drain-tick` active) + Q-W1 (watchdog cron freshness) + M1 + M2. | All PASS (cron active; watchdog ticked in last 6 min; M1 < 120s; M2 oldest_pending < 300s OR null). | If any FAIL, do not begin the drill. Surface the failing query + verdict to operator. |
| **(a) Flip master flag ON; submit one synthetic argument** | Operator | (i) Set `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` via Supabase console → Project Settings → Edge Functions → Environment Variables. Save. Wait 30s for Edge runtime to pick up the new env on cold-start (the same propagation behavior used in the ARCH-001 Card 3 smoke; see `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md` §Phase B). (ii) `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` stays UNSET or `0` (recommended; see §2). (iii) Run harness: `node .claude-tmp/rollback-rehearsal-submit.cjs --count 1` — posts ONE root argument to a synthetic debate whose title starts with `[arch-001-queue-smoke]`. (iv) Capture printed `argId` + `debateId`. CC is NOT involved in this step. | The harness's `summary` event reports `{posted: 1, failed: 0}`. Submit latency may be 2–4s on cold-start (acceptable; this is architectural non-blocking). | If submit fails (non-201): do NOT proceed. Operator unsets `CLASSIFIER_QUEUE_ROUTING_ENABLED` immediately. Investigate the failure; the drill is aborted. |
| **(b) CC verifies the routed arg completes via the drainer** | CC | Wait ~30s for the drainer cron tick (or one kick), then run M3 (per-cell completeness on routed args in last hour). Also run M1, M2 once for a baseline snapshot. | **PASS** = M3 `pct_grid_coverage > 99.0%` AND `succeeded_cells = 7` for the `routed_arg_count = 1` (one argId, 7 A-G cells), M1 < 120s, M2 oldest_pending < 300s OR null. **PARTIAL** = 6/7 succeeded with 1 cell still in-flight; rerun in 60s. **FAIL** = any cell `dead_letter` or `failed_terminal`, OR `routed_arg_count = 0` (routing predicate did not fire — investigate `shouldRouteToQueue`). | On FAIL: operator unsets master flag immediately. Drill aborted. On PARTIAL: poll once more after 60s; if still PARTIAL, treat as FAIL. |
| **(c) Operator simulates drainer failure** | Operator | Write a small SQL file: `UPDATE cron.job SET active = false WHERE jobname = 'arch-001-classifier-drain-tick';` and run via `npx supabase db query --linked --file <path>`. Record exact UTC timestamp `T_fail`. CC is NOT involved in this step. | `UPDATE cron.job` returns `UPDATE 1`. | If `UPDATE 0`: cron name has drifted. Surface to operator. Drill ABORTED; operator immediately unsets master flag to ensure inert state. |
| **(d) CC confirms M1 + watchdog detect dead drainer within < 5 min** | CC | Start polling cadence: run M1 at `T_fail + 90s`, `T_fail + 180s`, `T_fail + 240s`, `T_fail + 300s` (4 reads). At each read also run Q-W1 (watchdog cron freshness). Operator simultaneously watches admin inbox for Resend email. | **PASS** = ALL of: (i) M1 `seconds_since_last_completed_drain > 300` by `T_fail + 300s` (drainer detected stale); (ii) Q-W1 reports `recent_invocations >= 2` AND `failed_invocations = 0` AND `seconds_since_last_invocation < 360` (watchdog is alive); (iii) operator confirms Resend email landed in admin inbox with `cutoverHealthAlertModel` reporting Condition A at ALERT severity. **FAIL** = M1 does not cross 300s within the polling window, OR Q-W1 reports watchdog failing (watchdog itself is dead and silent failure mode is in effect), OR no email received within 5 min of the M1 ALERT crossing. | On FAIL: drill cannot continue. Operator immediately re-enables drainer cron (step e) AND unsets master flag. Investigate why detection failed (cron-job mechanics differ from audit-table mechanics; consult §5.10 of cutover design + `docs/runbooks/cutover-health-monitor.md` § "Layer 1 / Layer 2"). |
| **(e) Operator rolls back: unset master flag + re-enable drainer cron** | Operator | (i) Unset `CLASSIFIER_QUEUE_ROUTING_ENABLED` (or set `'false'`) via Supabase console env path. Wait 30s for Edge runtime to pick up the change. (ii) Write a small SQL file: `UPDATE cron.job SET active = true WHERE jobname = 'arch-001-classifier-drain-tick';` and run via `npx supabase db query --linked --file <path>`. Record exact UTC timestamp `T_rollback`. CC is NOT involved in this step. | (i) Console confirms env unset/changed; (ii) `UPDATE cron.job` returns `UPDATE 1`. | If either step fails: escalate. Re-enabling the cron is the more critical of the two — if env propagation is slow, that's only a few seconds of degradation; if cron stays disabled, every routed argument silently queues. |
| **(f) CC confirms inert state + zero production impact** | CC | At `T_rollback + 60s`: run M1 (drainer freshness recovers, should drop below 120s within 2 ticks). Run M2 (queue settles: in-flight smoke arg either completes or moves toward dead-letter on next retry attempt). Run M6 (direct-dispatch leakage absence) scoped to the synthetic argId from step (a) — must return `direct_dispatch_leak_count = 0`. Verify queue table has NO new non-terminal rows for non-smoke debates created during the entire drill window (i.e., production traffic was untouched). | **PASS** = M1 recovers (< 120s), M6 = 0, no non-smoke production rows in queue created during drill window. **PARTIAL** = M1 still > 120s but < 300s (drainer just restarted; one more tick will recover); rerun once after 60s. **FAIL** = M6 > 0 OR any non-smoke production debate has a queue row created during the drill window. | M6 > 0 is an IMMEDIATE escalation — the routing predicate is broken. Production debate routing during drill window means percentage was not 0 OR the predicate has a bug. |
| **Close audit** | CC + Operator | CC fills `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL-2026-06-01.md` with: drill start/end UTC, step-by-step verdict table mirroring this design's rows, the 4 query results captured at each step, total wall-clock, detection latency, rollback latency, exact `T_fail` and `T_rollback`. Operator reviews + signs verdict. | Audit verdict = **PASS** (Stage 1 may be authorized in a later prompt) or **FAIL** (chain HALTS; investigate before re-rehearsing). | n/a |

---

## 4. Read-only query pack (verbatim, with PASS/PARTIAL/FAIL thresholds)

The 4 queries below are the load-bearing read-only verifications CC runs during the drill. Each is transcribed verbatim from its source-of-truth section in either the cutover design `§5.8` or the cutover-health-monitor runbook. Save each into a separate file under `.claude-tmp/rehearsal-queries/` (gitignored) so CC can invoke as `npx supabase db query --linked --file .claude-tmp/rehearsal-queries/<file>.sql`. The header comment carries the PASS/PARTIAL/FAIL thresholds so the operator and reviewer can verify mappings to verdicts.

> **Source-of-truth citations:** M1 + M2 + M3 are from cutover design §5.8 (lines 268–322). M6 is from §5.8 lines 364–377. The watchdog Layer-1 query Q-W1 is from `docs/runbooks/cutover-health-monitor.md` lines 135–151. Q-Pre1 (cron active row) is a standard `cron.job` introspection.

### Q-Pre1 — drainer cron row exists + active (preflight only)

```sql
-- Q-Pre1: Drainer cron row present and active.
-- PASS: exactly 1 row, schedule = '* * * * *', active = true
-- FAIL: 0 rows (cron not scheduled; drill cannot begin) OR active = false
SELECT
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'arch-001-classifier-drain-tick';
```

### Q-W1 — watchdog cron freshness (preflight + step d cross-check)

Source: `docs/runbooks/cutover-health-monitor.md` § "Layer 1 — watchdog cron freshness (operator-runnable SQL)" lines 135–151.

```sql
-- Q-W1: watchdog cutover-health-monitor cron freshness, 15-minute window.
-- PASS: recent_invocations >= 2 AND failed_invocations = 0 AND seconds_since_last_invocation < 360
-- WARN: exactly one missed tick (recent_invocations = 1 OR seconds_since_last_invocation in 360-599)
-- FAIL — IMMEDIATE ROLLBACK: recent_invocations = 0 OR failed_invocations > 0 OR seconds_since_last_invocation >= 600
SELECT
  COUNT(*)                                                AS recent_invocations,
  COUNT(*) FILTER (WHERE status = 'succeeded')            AS succeeded_invocations,
  COUNT(*) FILTER (WHERE status = 'failed')               AS failed_invocations,
  EXTRACT(EPOCH FROM (now() - MAX(start_time)))           AS seconds_since_last_invocation
FROM cron.job_run_details d
JOIN cron.job              j ON j.jobid = d.jobid
WHERE j.jobname    = 'cutover-health-monitor-tick'
  AND d.start_time >= now() - INTERVAL '15 minutes';
```

### M1 — drainer cron freshness

Source: cutover design §5.8 lines 268–278.

```sql
-- M1: Drainer cron freshness (Condition A in cutover-health-monitor parity).
-- PASS: seconds_since_last_completed_drain < 120 (drainer ticked within 2 min)
-- PARTIAL: 120-300 (one missed tick; investigate)
-- FAIL: > 300 (drainer is stuck or stopped; auto-rollback)
-- NOTE on NULL: when classifier_drain_audit has zero `completed` rows in the
-- window, MAX(completed_at) is NULL and seconds_since_last_completed_drain
-- is NULL. Treat NULL as FAIL (the drainer is unable to prove liveness).
SELECT
  EXTRACT(EPOCH FROM (now() - MAX(completed_at))) AS seconds_since_last_completed_drain,
  COUNT(*) FILTER (WHERE outcome = 'completed') AS completed_in_window,
  COUNT(*) FILTER (WHERE outcome != 'completed') AS non_completed_in_window
FROM public.classifier_drain_audit
WHERE completed_at >= now() - INTERVAL '30 minutes';
```

### M2 — queue depth + oldest-pending-age

Source: cutover design §5.8 lines 282–295.

```sql
-- M2: Queue depth + oldest pending age (Condition B in cutover-health-monitor parity).
-- PASS: oldest_pending_age_seconds < 300 (5 min) OR NULL (no pending rows; quiet load)
-- PARTIAL: 300-900 (5-15 min; investigate)
-- FAIL: > 900 (drainer behind; auto-rollback)
SELECT
  COUNT(*) FILTER (WHERE state IN ('pending', 'leased', 'retry_scheduled')) AS non_terminal_rows,
  EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (WHERE state = 'pending'))) AS oldest_pending_age_seconds,
  COUNT(*) FILTER (WHERE state = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE state = 'leased') AS leased_count,
  COUNT(*) FILTER (WHERE state = 'retry_scheduled') AS retry_scheduled_count
FROM public.argument_machine_observation_runs
WHERE family IS NOT NULL  -- queue rows only; legacy direct-dispatch has family=NULL on the run row
  AND created_at >= now() - INTERVAL '30 minutes';
```

### M3 — per-cell completeness on routed arguments

Source: cutover design §5.8 lines 299–322.

```sql
-- M3: Per-cell completeness on routed arguments in the last 1-hour window.
-- For the rehearsal this is scoped to the synthetic argId(s) from step (a).
-- PASS: pct_grid_coverage > 99.0% (allows some in-flight)
-- PARTIAL: 95-99%
-- FAIL: < 95%
WITH routed_args AS (
  SELECT DISTINCT argument_id
  FROM public.argument_machine_observation_runs
  WHERE family IS NOT NULL
    AND created_at >= now() - INTERVAL '1 hour'
)
SELECT
  COUNT(DISTINCT r.argument_id) AS routed_arg_count,
  COUNT(*) FILTER (WHERE r.state = 'succeeded') AS succeeded_cells,
  COUNT(*) FILTER (WHERE r.state = 'dead_letter') AS dead_letter_cells,
  COUNT(*) FILTER (WHERE r.state NOT IN ('succeeded', 'dead_letter', 'failed_terminal')) AS non_terminal_cells,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE r.state = 'succeeded')
    / NULLIF(COUNT(DISTINCT r.argument_id) * 7, 0),
    2
  ) AS pct_grid_coverage
FROM public.argument_machine_observation_runs r
WHERE r.argument_id IN (SELECT argument_id FROM routed_args)
  AND r.family IS NOT NULL;
```

### M6 — direct-dispatch leakage absence on routed arguments

Source: cutover design §5.8 lines 364–377. Run scoped to the synthetic argId from step (a) to verify the routing predicate did not fire BOTH paths.

```sql
-- M6: Direct-dispatch leakage absence on routed arguments.
-- The routing branch is mutually exclusive: a routed argument must have ONLY
-- queue rows (family IS NOT NULL). If any row exists with family IS NULL for
-- the same argument_id, the predicate fired BOTH paths — a critical bug.
-- PASS: 0 (routed arguments must NEVER take both paths)
-- FAIL: > 0 → IMMEDIATE auto-rollback + escalation (the routing predicate is broken)
WITH routed_args AS (
  SELECT DISTINCT argument_id
  FROM public.argument_machine_observation_runs
  WHERE family IS NOT NULL
    AND created_at >= now() - INTERVAL '1 hour'
)
SELECT COUNT(*) AS direct_dispatch_leak_count
FROM public.argument_machine_observation_runs
WHERE argument_id IN (SELECT argument_id FROM routed_args)
  AND family IS NULL;  -- direct-dispatch run rows have NULL family on the run row
```

> **Why M4/M5/M7/M8 are NOT in the rehearsal pack.** M4 (dead-letter rate) is a 24h aggregate — a 30-min drill does not produce sufficient volume to assess. M5 (duplicate-success) is a defensive backstop already covered by the DB partial unique index `(argument_id, family, run_mode) WHERE state = 'succeeded'`; running it on a single synthetic arg is overhead with no signal. M7 (provider RPM) is irrelevant at single-arg load (7 calls in ~15s ≈ 28 RPM, well below ceiling). M8 (doctrine ban-list scan on `evidence_span`) runs in Stage 1+ on real routed traffic; a single synthetic arg's spans do not stress doctrine. All four remain in §5.8 for Stage 1 cadence.

---

## 5. Auxiliary artifacts (produced by THIS card's run; gitignored)

The **design doc** (this file) is the only tracked artifact this card commits. Three companion artifacts are operator-produced at drill time and live under `.claude-tmp/` (which is in `.gitignore`):

| Path | Purpose | Who creates | Persistence |
|---|---|---|---|
| `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL-2026-06-01.md` | Per-drill audit skeleton with verdict table, per-step timestamps, query results, total wall-clock, detection latency, rollback latency. Tracked + committed AFTER drill PASS. | CC fills skeleton during/after drill; operator signs verdict. | Committed to repo after drill. |
| `.claude-tmp/rollback-rehearsal-submit.cjs` | Synthetic submit harness modeled on `.claude-tmp/h-card3-submit.cjs`. Posts ONE root argument with a debate title starting with `[arch-001-queue-smoke]`. Includes safe-output discipline (no Authorization / Bearer / synthetic body in stdout). | Operator authors before drill (CC may help draft via a separate prompt if requested). | Gitignored. |
| `.claude-tmp/rehearsal-queries/*.sql` | The 6 SQL files from §4 above (Q-Pre1, Q-W1, M1, M2, M3, M6) one per file. | Operator transcribes from this doc OR CC writes via a separate prompt. | Gitignored. |

> **Note: the harness is operator-run only.** CC does NOT execute `.claude-tmp/rollback-rehearsal-submit.cjs`. The submit goes through production `submit-argument` and consumes ≈ 7 Anthropic provider calls (one per A–G family cell processed via the drainer). That spend is the unavoidable cost of validating the queue end-to-end and is authorized by the rehearsal's operator-approved scope.

---

## 6. Doctrine self-check

Walking through the constraints from `cdiscourse-doctrine` and `supabase-edge-contract` and asserting each is respected:

| Rule | How this design respects it |
|---|---|
| §1 — Score is gameplay analysis, never truth. Score never blocks posting. | The synthetic submit posts to `submit-argument` exactly as a real user submission does. The deterministic rules engine in `src/lib/constitution/engine.ts` is the sole acceptance gate. The ARCH-001 queue runs AFTER submit completes; queue failures (cells that dead-letter or never run) do NOT roll back the submitted argument. The drill does not modify the engine, the constitution, or any acceptance criterion. |
| §1 — No truth labels in user-facing strings. | This drill produces NO user-facing string. The audit skeleton (per-cell evidence span scans) is gated through the doctrine ban-list scan (M8 lives in Stage 1+ cadence; it is not relevant to this 30-min drill at single-arg volume). |
| §2 — Heat ≠ truth, heat ≠ consensus. | No heat / popularity signal participates in routing. The routing predicate `shouldRouteToQueue` reads ONLY the master enable flag, the percentage knob, and a structural smoke-tag on the debate title. |
| §3 — Popularity is not evidence. | The synthetic argument is a single test fixture; no engagement signal, no virality metric, no popularity weight participates anywhere in the drill. |
| §4 — AI moderator hard limits. | The drainer's classifier calls happen via Edge Functions (`classifier-drainer` invokes the existing MCP server endpoint). Classifier output is advisory (`authoritative: false`). The drill exercises the queue path; the classifier semantics are unchanged. |
| §5 — Rules engine sacred. | Zero change to `src/lib/constitution/engine.ts`. This card is docs-only; no source code edit anywhere. |
| §6 — Secrets policy. | Drill commands NEVER print: `Authorization`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, JWT prefixes. The harness draft (`.claude-tmp/rollback-rehearsal-submit.cjs`) inherits the safe-output discipline from `.claude-tmp/h-card3-submit.cjs` (no body text, no auth header, no env values in stdout). `npx supabase db query --linked` uses the project's existing PAT-less connection (operator may use `.claude-tmp/supabase-management.env` if available, but it is not required for SQL SELECTs). |
| §7 — No AI calls from the production app. | The synthetic submit consumes ≈ 7 Anthropic calls via the drainer (one per A–G family cell). All AI calls run inside the `classifier-drainer` Edge Function → MCP server, NOT in the production app. Drill compliance: **PASSES** because all AI calls live server-side; the production app boundary is honored. |
| §8 — Supabase conventions: RLS, append-only migrations, soft-delete. | The synthetic argument is soft-deletable if needed. No migration is written by this card. RLS is untouched. The temporary cron mutations in steps (c) + (e) are reversible UPDATE statements against `cron.job`, not migrations. |
| §9 — Plain language for users. | No user-facing string is produced by the drill. The audit skeleton uses internal codes (M1, M2, etc.) targeted at operators + reviewers only. |
| §10a — Observations vs Allegations. | No node label is produced; no annotation rendered to users. |
| §10 — v1 scope guards (no voting / OAuth / push / search). | None of these are touched. |
| Edge contract — service-role + RLS + soft-delete. | The drill writes ONLY: the operator's env flag (Supabase console, no service-role in client), the operator's cron `UPDATE`s (executed via `npx supabase db query --linked`, which uses the linked project's auth model — not a service-role from client code), and the synthetic argument insert via `submit-argument` (the standard Edge contract path; service-role wraps the actual write inside the function). The synthetic argument's debate is created via the same harness pattern as Card 3 (`.claude-tmp/h-card3-submit.cjs`), which respects the same envelope. |

**No doctrine conflict found.** The drill is fully compatible with all 10 rules + the edge-contract conventions.

---

## 7. Risks

Risks the operator + reviewer should weigh before authorizing the drill:

1. **Watchdog cron freshness preflight is necessary; the alerting watchdog could be silently dead.** Q-W1 must PASS before step (a). If the watchdog is dead (Q-W1 FAIL band), step (d) cannot validate "watchdog observes fault" because the watchdog is the thing being relied upon to observe the fault. The §0 preconditions hard-gate this.

2. **Resend pre-flight (Layer 3) is operator-only and unverifiable by CC.** The §0 preconditions require the operator to have confirmed an admin actually received a Resend email during a forced ALERT condition earlier (per cutover-health-monitor runbook § "Layer 3"). If that pre-flight was skipped, step (d) might report `emailStatus: sent` while no admin actually receives a message — the worst silent-failure mode.

3. **Edge function env propagation lag.** Setting `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` triggers an Edge runtime cold-start; the new env value propagates over ~30s. If the synthetic submit hits a hot isolate that has not picked up the new env yet, the routing predicate returns `false` and the argument takes the direct-dispatch path. **Mitigation:** the 30s wait after env set is the documented propagation budget; ARCH-001 Card 3 smoke observed 3177 ms submit latency on the first cold-start submit, confirming the wait is real-world correct. If step (b) M3 reports `routed_arg_count = 0`, this is the likely cause; the operator can re-submit and retry rather than abort.

4. **Cron disable in step (c) MUST be reversed in step (e) even if the drill fails midway.** If the operator aborts the drill between steps (c) and (e), the cron stays disabled, and ANY routed argument (including future smoke-tagged debates) silently queues indefinitely. **Mitigation:** the abort/rollback column of each step in §3 explicitly requires the operator to re-enable the cron at every abort branch. The audit doc verifies cron is `active = true` at close.

5. **Cron name drift.** If `cron.job.jobname` for the drainer has been renamed (e.g., maintenance script altered it), step (c) `UPDATE` returns `UPDATE 0` instead of `UPDATE 1`. **Mitigation:** Q-Pre1 at preflight verifies the exact jobname matches `arch-001-classifier-drain-tick`; if it does not, the drill cannot begin.

6. **Drill timing collision with the cutover-health-monitor cron.** The watchdog ticks every 5 min (`*/5 * * * *`). If the operator simulates drainer death exactly at a `*/5` boundary, the next watchdog tick may fire BEFORE the drainer-freshness window crosses the 300s threshold (the watchdog evaluates M1 at the moment of its tick). **Mitigation:** the 4-poll cadence in step (d) (`T_fail + 90/180/240/300s`) handles this — by `T_fail + 300s` the watchdog will have observed at least one tick where M1 reports `seconds_since_last_completed_drain > 300`.

7. **Detection latency could exceed 5 min in production-pressure conditions.** The 5-min budget is a service-level target, not a guarantee. Anthropic cold-starts, edge runtime restarts, or a temporarily-degraded Postgres can push the detection past 5 min. If step (d) PARTIAL-passes at `T_fail + 360s`, that is still actionable and should be recorded — but the drill verdict must be FAIL because the SLA was not met.

8. **In-flight smoke arg after rollback.** Step (f) acknowledges the synthetic arg may either complete (if cron is back fast enough) or fall to dead-letter. Either outcome is acceptable; ONLY the production-traffic-leakage check (M6) is load-bearing.

9. **PAT availability for cron `UPDATE`s.** `npx supabase db query --linked` works with the linked project; both the `UPDATE cron.job` statements in (c) and (e) are write statements, NOT read-only. The operator's linked credentials must permit `UPDATE` on `cron.job`. If they do not, the operator falls back to the Supabase dashboard SQL editor (no PAT required). Either path is fine; the drill table assumes the file-based path.

---

## 8. Audit doc references (artifacts this card produces)

| Artifact | Path | Tracked? |
|---|---|---|
| Design doc (this file) | `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL.md` | YES (committed) |
| Drill audit skeleton | `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL-2026-06-01.md` | Created post-drill; tracked after drill verdict |
| Synthetic submit harness | `.claude-tmp/rollback-rehearsal-submit.cjs` | NO (gitignored; operator-run only) |
| Query pack (6 SQL files) | `.claude-tmp/rehearsal-queries/{q-pre1,q-w1,m1,m2,m3,m6}.sql` | NO (gitignored; reproduced verbatim in §4) |
| Operator-side check log | `.claude-tmp/rollback-rehearsal-checks.log` (timestamped per-query verdict transcript) | NO (gitignored) |

---

## 9. Open questions / decisions for operator at PR-creation time

The reviewer should confirm these in the review doc; the operator confirms them on the PR before drill authorization.

1. **Percentage 0 vs 100 (§2).** Recommended default: percentage = 0 + smoke-tag override path. ONLY override to 100 if production traffic is verifiably zero during the drill window (e.g., explicit maintenance window, no active users) AND operator wants to also stress-test the percentage path. Operator decision: **`__` recommended (0)** / **`__` override to 100 with documented justification**.

2. **Drill timing window.** A 30-min drill at a low-traffic time minimizes incidental risk. Operator may choose UTC overnight or any quiet window. Operator decision: **proposed `__` (UTC datetime)**.

3. **Resend pre-flight (Layer 3) verification status.** Has the operator already executed a forced-ALERT cycle on the cutover-health-monitor + verified admin inbox receipt? (Per cutover-health-monitor runbook § "Layer 3 — Resend pre-flight before alerting goes live".) Operator decision: **`__` YES (date / cycle id)** / **`__` NO (must complete before drill)**.

4. **Harness authorship.** The harness draft at `.claude-tmp/rollback-rehearsal-submit.cjs` does not yet exist. Will the operator (a) write it before drill day (mirror `.claude-tmp/h-card3-submit.cjs` with `[arch-001-queue-smoke]` tag), OR (b) request a separate CC prompt to draft it? Operator decision: **`__` operator drafts** / **`__` CC drafts in follow-up prompt**.

5. **Audit name date.** If the drill executes on a date other than 2026-06-01, rename the audit file accordingly (`docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL-<YYYY-MM-DD>.md`). Operator confirms drill date.

---

## 10. Boundary statement (THIS phase + the drill phase)

### THIS phase (design doc; CC + operator just for this PR)

- **Files touched:**
  - NEW `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL.md` (this file)
- **Files NOT touched:** zero src / app / mcp-server / supabase/functions / supabase/migrations / scripts / package.json / familyRegistry / production-roster change.
- **Env / Vault / cron / runtime flag changes by CC:** NONE.
- **Provider-spend invocations by CC:** ZERO (no `submit-argument`, no `classify-argument-boolean-observations`, no MCP call, no Anthropic / xAI / X invocation).
- **Read-only SQL by CC:** ALLOWED via `npx supabase db query --linked --file <path>` for the §0 precondition verifications + the §3 step verifications (M1, M2, M3, M6, Q-Pre1, Q-W1). Read-only SELECTs only.

### The drill phase (Phase 4 execution; operator-authorized, separate prompt)

- **Operator writes:** 1 env flip ON + 1 env flip OFF (`CLASSIFIER_QUEUE_ROUTING_ENABLED`); 1 cron disable + 1 cron re-enable (`UPDATE cron.job`); 1 synthetic submit via harness.
- **Provider-spend invocations:** ≈ 7 Anthropic calls (one per A–G family cell processed by the drainer for the single synthetic argument). Authorized by the rehearsal's operator-approved scope.
- **CC writes:** ZERO. CC stays read-only throughout the drill, executing the SQL pack and filling the audit skeleton.

---

## Appendix A — Required reading manifest (used to author this doc)

This design was authored at base SHA `e03dbaa` after reading:

- `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` — full file, especially §1 (verified state + routing matrix), §5.8 (M1–M8 queries), §6 Stage 0 + Stage 1, §8 gate 6 (the rehearsal procedure transcribed here), §9 (open questions).
- `docs/runbooks/cutover-health-monitor.md` — Layer 1 watchdog cron-freshness query (Q-W1), Layer 2 endpoint health probe, Layer 3 Resend pre-flight gate.
- `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md` — format reference, Phase B routing-enable mechanics (env propagation budget).
- `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md` — the H FAIL that motivates the cutover.
- `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE0-READINESS-2026-06-01.md` — Stage 0 readiness audit (PR #410); confirmed the chain pre-state and the deferred operator decisions.
- `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts` — verified env var names (`CLASSIFIER_QUEUE_ROUTING_ENABLED`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`), smoke tag (`[arch-001-queue-smoke]`), routing predicate signature.
- `supabase/migrations/20260528000021_arch_001_classifier_queue_substrate.sql` — verified queue table column names (`state`, `family`, `available_at`, `created_at`) and state enum (`pending`, `leased`, `retry_scheduled`, `succeeded`, `dead_letter`, `failed_terminal`), and `classifier_drain_audit(completed_at, outcome)`.
- `.claude-tmp/h-card3-submit.cjs` — synthetic-submit harness pattern (boundary contract: no service-role, no env value print, no body text in stdout, anon-path + bot JWT only). The `.claude-tmp/rollback-rehearsal-submit.cjs` harness inherits this pattern with the tag swapped to `[arch-001-queue-smoke]` and `--count 1`.
- `.claude/agents/roadmap-reviewer.md` § "Migration-bearing card verification (mandatory)" — confirmed this card adds NO migration; the reviewer confirms this in the review doc.

---

## Appendix B — Glossary (drill-specific terms)

- **`T_fail`** — exact UTC timestamp at which the operator disabled the drainer cron in step (c). Recorded in the audit doc.
- **`T_rollback`** — exact UTC timestamp at which the operator re-enabled the drainer cron in step (e). Recorded in the audit doc.
- **Detection latency** — `min(T_M1_alert, T_email_received) − T_fail`. Must be < 5 min for PASS.
- **Rollback latency** — `T_rollback − T_detect`. Must be < 5 min for PASS.
- **Total drill wall-clock** — close-audit timestamp minus start-preflight timestamp. Must be ≤ 30 min for PASS.
- **Routed-arg count** — the number of distinct `argument_id`s in `argument_machine_observation_runs` with non-null `family` and `created_at >= now() - 1h`. For the drill, this MUST equal exactly 1 (the synthetic arg from step (a)).
- **In-flight smoke arg** — the synthetic arg from step (a); after step (c) disables the cron, this arg's queue rows stay in `pending` / `leased` / `retry_scheduled` states until cron is re-enabled. After step (e), the drainer either completes the rows (PASS path) or they reach `dead_letter` via attempt-count exhaustion. Either outcome is acceptable for the drill's verdict.
