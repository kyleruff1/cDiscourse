# ARCH-001 Card 2 — Classifier queue SMOKE runbook (operator-run, post-deploy)

The synthetic production smoke that GATES Card 3. Operator-run AFTER the
prerequisites in `RUNBOOK.md` are complete (migration applied, drainer
deployed + secret set, Vault seeded, cron scheduled, MCP cap restored,
`CLASSIFIER_QUEUE_ROUTING_ENABLED=true`). Source of truth: parent design
`docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` §A.12.

**Doctrine for the smoke:** synthetic smoke-tagged arguments ONLY; no organic
user text; no secrets in logs. Full current A–G load on every smoke submit
(NO tiering). NO H/I/J. The verification POLLS to ACTUAL settle — NO fixed
sleep (test-discipline: the condition is the contract).

All smoke rooms MUST have a title starting with `[arch-001-queue-smoke]`
(the only tag `shouldRouteToQueue` honors). Run the monitoring queries from
`classifier-queue-monitoring.sql` (referenced as "query A".."query G").

---

## Step 0 — pre-flight

- Confirm `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` and the drainer is live
  (query F shows the lease table exists and is empty/expired; query C shows
  the audit table is reachable).
- Confirm an MCP server is reachable (the existing MCP-021C smoke posture).

## Step 1 — CANARY (one submit)

1. Create ONE synthetic room titled `[arch-001-queue-smoke] canary <ts>` and
   post ONE argument into it (via the normal authenticated submit path).
2. Expect: the enqueue inserts 7 A–G queue rows (state='pending'); the
   enqueue-kick fires; within a kick round-trip the drainer claims + starts.
3. Poll query A until SETTLE (Step 3 predicate). Then read completeness:
   - 7 A–G family cells reach `state='succeeded'` (`status='success'`).
   - H/I/J cells: ZERO (they are never enqueued — query A pending/leased/etc.
     never includes them; verify no row exists for `claim_clarity` /
     `thread_topology` / `sensitive_composer`).
   - No duplicate success (query: a GROUP BY (argument_id, family) HAVING
     count(*) FILTER (WHERE state='succeeded') > 1 returns ZERO rows — index
     #4 guarantees this).
   - Submit was nonblocking (the 201 returned in the usual ~1.3–3.3s band).
4. Record: time-to-first-job-start, time-to-complete.

If the canary fails, STOP and triage (RUNBOOK.md) before the burst.

## Step 2 — SUSTAINED / REPEATED BURST (3 waves of 5)

Not one tight burst — three waves so the queue must drain across multiple
invocations.

1. Wave 1: create 5 smoke rooms (or reuse, with 5 new arguments) → 35 jobs.
2. Wait ~30–60s (let the drainer make progress), then Wave 2 (5 more → 35).
3. Wait ~30–60s, then Wave 3 (5 more → 35). Total 105 jobs across 15 args.

Throughout, sample query A + query D to watch pending drain down and
jobs-per-drain. `oldest_pending_age_s` must stay ≤ 300 (5 min) under burst.

## Step 3 — POLL TO ACTUAL SETTLE (no fixed sleep)

Poll query A (+ query C, E, F) on a loop (e.g. every 5s, bounded by a
generous max wall e.g. 10 min) until ALL of these hold:

```
pending = 0
AND retry_due (state='retry_scheduled' AND available_at <= now()) = 0
AND leased = 0
AND stale leases (query E rows) = 0
AND (the drain lease is not live (query F lease_live=false / no row)
     OR query C last_drain_completed > <the final wave's last submit ts>)
```

Only THEN evaluate completeness. A bounded poll loop is NOT a fixed sleep —
it exits on the condition.

## Step 4 — COMPLETENESS + verdict

After settle, assert:
- **Full A–G:** every expected `(argument, family='A..G', run_mode='production')`
  cell reaches `succeeded` OR an explicit terminal (`failed_terminal` /
  `dead_letter`) with the correct typed `failure_sub_reason`.
- **No H/I/J:** zero rows for the three non-production families.
- **No duplicate success:** the GROUP BY check from Step 1.3 returns zero.
- **Submit nonblocking:** submit latency band unaffected (~1.3–3.3s); no
  submit was blocked/rejected by a classifier path (a classifier acceptance
  gate would be a FAIL).
- **Doctrine evidence_span clean:** re-scan the `evidence_span` over the
  positive result rows for banned verdict tokens (zero — as prior smokes did).
- **Relaxed queue SLO** (NOT the old strict 30s direct-dispatch p95 — design
  §A.12 SLO table): every cell reaches a terminal within ≤ 5 min of its wave;
  throughput ≈ 12·C RPM ± tail; 0 dead-letters for A–G; retries allowed
  (capacity/server/429) provided every cell still reaches `succeeded`.

**Verdict:** PASS = every A–G cell `succeeded` under the 3×5 burst within the
async SLO, no duplicate successes, single-flight held (no over-concurrency
beyond C), submit nonblocking, no secret/raw leak, chosen C recorded. C tuned
DOWN to reach completeness is PASS-after-tune. PARTIAL = completeness reached
but an SLO band missed / a topology adjustment needed / only `provider_*`
dead-letters. FAIL = terminal holes, duplicate successes, submit blocks, H/I/J
run, a secret/raw payload leaks, or a classifier acceptance gate is observed.

---

## Step 5 — RECLAIM-vs-FINALIZE RACE (carry-forward #4; two psql sessions)

The race that motivated the Card-2A atomic finalizer. Prove that a
`finalize_classifier_job` mid-transaction and a concurrent
`reclaim_stale_leases()` cannot produce a double-success or an inconsistent
terminal row. Two `psql` sessions against the LINKED project.

This uses a SYNTHETIC queue row over an existing (debate_id, argument_id)
pair under a synthetic `family`/`schema_version` so it cannot collide with
real rows; CLEAN UP at the end. (You may instead drive it inside a single
transaction per session as the Card-2A verify script does; the two-session
form below exercises the ACTUAL concurrent lock interaction.)

**Setup (session A):** pick an existing argument + debate, then enqueue a
synthetic-family job and claim it so it is `leased` by a known owner with an
ALREADY-EXPIRED lease (so the reclaimer in session B is eligible to act):

```sql
-- session A — setup (NOT committed yet; see step ordering below)
-- 1. Insert a synthetic leased row directly (bypass enqueue's family check):
INSERT INTO public.argument_machine_observation_runs
  (argument_id, debate_id, family, run_mode, schema_version,
   requested_families, state, available_at, started_at,
   attempt_count, lease_owner, lease_expires_at)
SELECT a.argument_id, a.debate_id, 'arch_race_family', 'production',
       'arch-001-card2-race', ARRAY['arch_race_family'], 'leased',
       now(), now(), 1, 'race-owner-A', now() - interval '5 seconds'
FROM (SELECT id AS argument_id, debate_id FROM public.arguments LIMIT 1) a
RETURNING id;   -- note the run_id
```

**Run the race:**

1. **Session A** — BEGIN a transaction and call the finalizer (it takes
   `FOR UPDATE` on the run row and holds it until you COMMIT):
   ```sql
   BEGIN;
   SELECT public.finalize_classifier_job(
     '<run_id>', 'race-owner-A', 'succeeded', 'success',
     NULL, NULL, NULL, '[]'::jsonb);   -- returns true (A owns the live lease)
   -- DO NOT COMMIT YET.
   ```
2. **Session B** — while A holds the row lock, run the reclaimer (the lease
   is expired, so without the lock it WOULD reclaim the row):
   ```sql
   SELECT public.reclaim_stale_leases();   -- BLOCKS on A's FOR UPDATE lock
   ```
   Session B blocks (it cannot reclaim a row session A holds locked).
3. **Session A** — COMMIT:
   ```sql
   COMMIT;
   ```
   Now session B unblocks. Because A already flipped the row to `succeeded`
   (lease cleared), B's reclaimer `WHERE state='leased' AND lease_expires_at
   < now()` no longer matches it → B reclaims 0 rows for this cell.

**Assert (either session):**
```sql
SELECT state, status, lease_owner FROM public.argument_machine_observation_runs
 WHERE id = '<run_id>';
-- EXPECT exactly: state='succeeded', status='success', lease_owner IS NULL.
```
- Exactly ONE terminal row, consistent pair (`succeeded`↔`success`).
- No double-success (index #4 would block a second succeeded row anyway).
- The reclaimer did NOT revert the finalized row.

**Reverse-order variant (recommended too):** rerun with B's reclaimer
COMMITTING FIRST (reset the row to leased/expired, then have B reclaim before
A finalizes). Now A's `finalize_classifier_job` ownership guard
(`lease_owner = p_owner AND state = 'leased' FOR UPDATE`) finds the row no
longer `leased` by `race-owner-A` → returns **false** (a hard no-op). Assert
the drainer-side contract: a `false` return means the caller LOST the lease;
it must NOT record success (carry-forward #1). The row is left in the
reclaimer's `retry_scheduled` state, re-claimable later — no double-success.

**Cleanup:**
```sql
DELETE FROM public.argument_machine_observation_runs
 WHERE schema_version = 'arch-001-card2-race' AND family = 'arch_race_family';
DELETE FROM public.argument_machine_observation_results
 WHERE schema_version = 'arch-001-card2-race';   -- if any were written
```

Record the race result (no double-success, consistent terminal row) in the
smoke audit alongside the burst verdict. A PASS here + the burst PASS gate
Card 3.
