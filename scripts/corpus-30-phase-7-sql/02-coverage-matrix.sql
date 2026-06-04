-- CORPUS-30 Phase 7 — Step 2: A-G coverage matrix from auto-trigger.
-- Each submit-argument insert under this runTag fired the auto-trigger
-- dispatcher (supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts)
-- which iterates productionEnabledFamilies() and persists ONE
-- argument_machine_observation_runs row per (argument_id, family) call
-- via persistenceWriter.persistRun (one call per family, 1-element
-- requested_families array per call).
--
-- Schema reality:
--   * `family` column on _runs (added by 20260528000021) is the QUEUE
--     path's per-job family pointer; the DIRECT-DISPATCH path (auto-trigger)
--     does NOT populate it (persistenceWriter.persistRun lines 83-96 — no
--     `family` key). For auto-trigger rows, the family is in
--     `requested_families[1]` (a 1-element text[] array).
--   * `run_mode` is NOT NULL DEFAULT 'production' (added by 20260526000019).
--     Auto-trigger pins 'production' (AUTO_TRIGGER_MODE in dispatcher line 109).
--   * COALESCE handles both paths: queue writes populate `family`; auto-trigger
--     leaves it NULL and we fall back to requested_families[1].
--
-- Expected: 7 families x 300 arguments = up to 2100 rows. The split of
-- status='success' vs 'failed' per family is the headline result. If
-- the queue substrate also ran (per-debate flag), some rows may also be
-- in pre-terminal `state` (pending/leased/retry_scheduled) — included
-- via the `state` dimension to surface that.
WITH corpus_args AS (
  SELECT a.id
    FROM public.arguments a
    JOIN public.debates d ON a.debate_id = d.id
   WHERE d.title LIKE '%corpus-prod-synthetic-20260603-1924-d49e04cd%'
)
SELECT
  COALESCE(r.family, r.requested_families[1]) AS family,
  r.status,
  r.state,
  r.run_mode,
  COUNT(*) AS n
  FROM public.argument_machine_observation_runs r
 WHERE r.argument_id IN (SELECT id FROM corpus_args)
 GROUP BY 1, 2, 3, 4
 ORDER BY 1, 2 NULLS LAST, 3, 4;
