-- ARCH-001 Card 3 smoke — Snapshot C: last-drain + drain counters (read-only).
-- Confirms the drainer is alive and tells you the last completed drain time
-- (used by the settle predicate: last_drain_completed > final-submit-ts). The
-- audit row carries ONLY operational counters — no body/prompt/payload, no
-- secret. No write, no service-role.
SELECT
  owner,
  outcome,
  started_at,
  completed_at,
  jobs_processed,
  jobs_succeeded,
  jobs_failed,
  dead_letters,
  stale_leases_recovered
FROM public.classifier_drain_audit
ORDER BY started_at DESC
LIMIT 20;

-- Recent drain summary (last 15 minutes): how many real drains vs
-- single-flight skips, and the cumulative dead-letter count (PASS = 0).
SELECT
  count(*) FILTER (WHERE outcome <> 'skipped_single_flight')  AS real_drains,
  count(*) FILTER (WHERE outcome = 'skipped_single_flight')   AS skipped_single_flight,
  max(completed_at)                                           AS last_drain_completed,
  coalesce(sum(dead_letters), 0)                              AS dead_letters_total
FROM public.classifier_drain_audit
WHERE started_at > now() - interval '15 minutes';
