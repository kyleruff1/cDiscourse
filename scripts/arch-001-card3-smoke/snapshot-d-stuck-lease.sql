-- ARCH-001 Card 3 smoke — Snapshot D: stuck-lease detector (read-only).
-- A 'leased' row whose lease_expires_at has passed indicates a drainer died
-- mid-batch; reclaim_stale_leases (run first in every drain) should recover it
-- to retry_scheduled, or dead_letter at the reclaim cap (3). If rows persist
-- here across several ticks, the cron tick is not firing (check snapshot C +
-- the Vault seed / shared-secret match). Scoped to smoke-tagged rooms. No
-- write, no service-role, no secret.
WITH smoke_runs AS (
  SELECT r.*
    FROM public.argument_machine_observation_runs r
    JOIN public.arguments a ON a.id = r.argument_id
    JOIN public.debates    d ON d.id = a.debate_id
   WHERE d.title LIKE '[arch-001-queue-smoke]%'
     AND r.family IS NOT NULL
)
SELECT
  id,
  argument_id,
  family,
  attempt_count,
  lease_owner,
  lease_expires_at,
  EXTRACT(EPOCH FROM (now() - lease_expires_at))::int AS lease_overdue_s
FROM smoke_runs
WHERE state = 'leased'
  AND lease_expires_at < now()
ORDER BY lease_expires_at ASC;
