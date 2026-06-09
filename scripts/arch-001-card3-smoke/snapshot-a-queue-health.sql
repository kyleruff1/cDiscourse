-- ARCH-001 Card 3 smoke — Snapshot A: queue health (read-only).
-- Poll this every ~5s during the N=56 burst until the settle predicate holds.
-- Scoped to smoke-tagged rooms only (never reads organic traffic). No write,
-- no service-role, no secret.
--
-- Settle predicate (ALL true):
--   pending = 0 AND due_retry_scheduled = 0 AND leased = 0 AND stale_leases = 0
--   (drain-lease/last-drain check lives in snapshot-c).
WITH smoke_runs AS (
  SELECT r.*
    FROM public.argument_machine_observation_runs r
    JOIN public.arguments a ON a.id = r.argument_id
    JOIN public.debates    d ON d.id = a.debate_id
   WHERE d.title LIKE '[arch-001-queue-smoke]%'
     AND r.family IS NOT NULL          -- queue rows only (exclude direct-dispatch)
)
SELECT
  count(*) FILTER (WHERE state = 'pending')                                              AS pending,
  count(*) FILTER (WHERE state = 'retry_scheduled')                                      AS retry_scheduled,
  count(*) FILTER (WHERE state = 'retry_scheduled' AND available_at <= now())            AS due_retry_scheduled,
  count(*) FILTER (WHERE state = 'leased')                                               AS leased,
  count(*) FILTER (WHERE state = 'leased' AND lease_expires_at < now())                  AS stale_leases,
  count(*) FILTER (WHERE state = 'succeeded')                                            AS succeeded,
  count(*) FILTER (WHERE state = 'dead_letter')                                          AS dead_letter,
  count(*) FILTER (WHERE state = 'failed_terminal')                                      AS failed_terminal,
  EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE state = 'pending')))::int    AS oldest_pending_age_s,
  EXTRACT(EPOCH FROM (now() - min(lease_expires_at) FILTER (WHERE state = 'leased')))::int AS oldest_leased_age_s
FROM smoke_runs;
