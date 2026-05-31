-- ============================================================
-- ARCH-001 Card 2 — Classifier queue LIVENESS MONITORING SQL
--
-- Read-only operator/admin monitoring queries (parent design §A.10). Run
-- these via psql / the Supabase SQL editor against the LINKED project
-- (service-role / dashboard SQL bypasses RLS, which is how the operational
-- queue/lease/audit tables are read — there is NO client SELECT policy on
-- them by design). NONE of these queries write; NONE read a secret, an
-- argument body, a prompt, or a provider payload (cdiscourse-doctrine §6).
--
-- This file lives in a SIBLING dir scripts/arch-001-card2-sql/ — NOT under
-- scripts/ops/ (which is observability-owned with its own ownership/count
-- tests). It mirrors the Card-1/Card-2A SQL-dir convention
-- (scripts/arch-001-card1-sql/, scripts/arch-001-card2a-sql/).
--
-- Card: ARCH-001 Card 2 — docs/designs/ARCH-001-CARD2-DRAINER-ENQUEUE-intent.md
-- Design (signals + thresholds source of truth):
--   docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md §A.10
-- Runbook (alert thresholds + triage):
--   scripts/arch-001-card2-sql/RUNBOOK.md
--
-- Doctrine: these are operational COUNTERS only. cdiscourse-doctrine §1 —
-- monitoring never implies a verdict about a participant; §3 — no
-- popularity/heat/engagement signal is read (queue order is arrival FIFO).
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- A. Queue health snapshot (the primary liveness query)
-- ════════════════════════════════════════════════════════════
-- pending / retry_scheduled / leased / dead_letter counts, recent terminal
-- failures, oldest-pending age, oldest-leased age. `family IS NOT NULL`
-- restricts to QUEUE rows (historical / direct-dispatch rows leave family
-- NULL and are excluded). Alert when oldest_pending_age_s > 300 (5 min).
SELECT
  count(*) FILTER (WHERE state = 'pending')                                   AS pending,
  count(*) FILTER (WHERE state = 'retry_scheduled')                           AS retry_scheduled,
  count(*) FILTER (WHERE state = 'retry_scheduled' AND available_at <= now()) AS retry_due,
  count(*) FILTER (WHERE state = 'leased')                                    AS leased,
  count(*) FILTER (WHERE state = 'dead_letter')                               AS dead_letter,
  count(*) FILTER (WHERE state = 'failed_terminal'
                     AND last_attempt_at > now() - interval '1 hour')         AS failed_last_hour,
  EXTRACT(EPOCH FROM now() - min(available_at))
    FILTER (WHERE state IN ('pending', 'retry_scheduled'))                    AS oldest_pending_age_s,
  EXTRACT(EPOCH FROM now() - min(lease_expires_at - interval '120 seconds'))
    FILTER (WHERE state = 'leased')                                           AS oldest_leased_age_s
FROM public.argument_machine_observation_runs
WHERE family IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- B. Failure-class breakdown (last hour) — capacity vs server vs rate vs schema
-- ════════════════════════════════════════════════════════════
-- Groups recent non-success queue rows by typed failure_sub_reason so the
-- operator can tell a provider/capacity transient from a contract regression.
-- A `provider_*` class dominating → tune C / enable the pacer. A
-- `response_*` class → MCP contract regression (out of this card's scope; do
-- NOT redeploy the MCP server under this card — file a follow-up).
SELECT failure_sub_reason, count(*) AS n
FROM public.argument_machine_observation_runs
WHERE family IS NOT NULL
  AND last_attempt_at > now() - interval '1 hour'
  AND state IN ('retry_scheduled', 'failed_terminal', 'dead_letter')
GROUP BY failure_sub_reason
ORDER BY n DESC;


-- ════════════════════════════════════════════════════════════
-- C. Last successful drain + skipped-tick / recovery counters (audit row)
-- ════════════════════════════════════════════════════════════
-- From the per-drain audit table. Alert when (now() - last_drain_completed)
-- > 5 min WHILE pending > 0 (drainer down / startup failing). A high
-- skipped_ticks_15m with processed_15m = 0 suggests a stuck lease owner —
-- run query E.
SELECT
  max(completed_at)                                                            AS last_drain_completed,
  sum(jobs_processed) FILTER (WHERE completed_at > now() - interval '15 min')  AS processed_15m,
  sum(jobs_succeeded) FILTER (WHERE completed_at > now() - interval '15 min')  AS succeeded_15m,
  sum(jobs_failed)    FILTER (WHERE completed_at > now() - interval '15 min')  AS failed_15m,
  sum(dead_letters)   FILTER (WHERE completed_at > now() - interval '1 hour')  AS dead_letters_1h,
  count(*) FILTER (WHERE outcome = 'skipped_single_flight'
                     AND started_at > now() - interval '15 min')               AS skipped_ticks_15m,
  sum(stale_leases_recovered)
    FILTER (WHERE completed_at > now() - interval '1 hour')                    AS recovered_1h
FROM public.classifier_drain_audit;


-- ════════════════════════════════════════════════════════════
-- D. Drain throughput sample (recent drains; observe jobs/drain + outcome)
-- ════════════════════════════════════════════════════════════
-- The 20 most-recent drains. Use during the smoke to read jobs-per-drain,
-- the completed/partial/skipped mix, and whether the LAST drain ran AFTER
-- the final smoke submit (a settle-condition input — see the smoke runbook).
SELECT
  started_at,
  completed_at,
  outcome,
  jobs_processed,
  jobs_succeeded,
  jobs_failed,
  dead_letters,
  stale_leases_recovered
FROM public.classifier_drain_audit
ORDER BY started_at DESC
LIMIT 20;


-- ════════════════════════════════════════════════════════════
-- E. Stuck-lease detector (rows leased but past their job lease)
-- ════════════════════════════════════════════════════════════
-- Rows still 'leased' with lease_expires_at in the past indicate a drainer
-- that died mid-batch and a reclaimer that has not yet run. The next drain's
-- reclaim_stale_leases() recovers these to retry_scheduled (or dead_letter
-- at the attempt cap); if they persist across multiple drains, investigate.
SELECT
  id,
  argument_id,
  family,
  attempt_count,
  lease_owner,
  lease_expires_at,
  EXTRACT(EPOCH FROM now() - lease_expires_at) AS expired_for_s
FROM public.argument_machine_observation_runs
WHERE state = 'leased'
  AND lease_expires_at < now()
  AND family IS NOT NULL
ORDER BY lease_expires_at ASC;


-- ════════════════════════════════════════════════════════════
-- F. Single-flight lease snapshot (is a drain in flight right now?)
-- ════════════════════════════════════════════════════════════
-- The TTL lease row. A row with expires_at > now() means a drain holds the
-- lease (single-flight active). A row with expires_at < now() is an expired
-- lease that the next acquire will steal — if it lingers and no drain runs,
-- a manual `DELETE FROM classifier_drain_lock WHERE expires_at < now();`
-- is safe (TTL semantics). owner is an opaque invocation id (NO secret).
SELECT
  lock_key,
  owner,
  acquired_at,
  expires_at,
  (expires_at > now()) AS lease_live
FROM public.classifier_drain_lock;


-- ════════════════════════════════════════════════════════════
-- G. Dead-letter detail (operator triage of exhausted cells)
-- ════════════════════════════════════════════════════════════
-- Each dead-lettered queue cell with its typed reasons. dead_letter > 0 is
-- an alert (a cell exhausted retries). To RE-DRIVE a dead-lettered cell
-- after a fix, an admin sets state='pending', available_at=now(),
-- attempt_count=0 for the specific row (service-role; NEVER client) — see
-- the runbook. NEVER disable the rules-engine gate; these are operational
-- counters, never a verdict (cdiscourse-doctrine §1).
SELECT
  id,
  argument_id,
  family,
  attempt_count,
  failure_reason,
  failure_sub_reason,
  dead_letter_reason,
  last_attempt_at
FROM public.argument_machine_observation_runs
WHERE state = 'dead_letter'
  AND family IS NOT NULL
ORDER BY last_attempt_at DESC NULLS LAST;
