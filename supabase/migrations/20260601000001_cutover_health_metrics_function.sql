-- ============================================================
-- Migration: 20260601000001_cutover_health_metrics_function
-- Description: OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING — one
--   read-only stored function that returns the 6 alert-condition
--   health metrics as a single JSON object. The cutover-health-monitor
--   Edge Function calls this RPC once per tick + classifies the result
--   via the pure-TS cutoverHealthAlertModel.
--
-- Card: OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING
--   - Design + intent absorbed into the function-header comment below.
--   - Parent design: docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md
--   - The 6 condition queries mirror design §5.8 M1/M2/M4/M5/M6/M8.
--
-- Doctrine (cdiscourse-doctrine):
--   §1, §3 — function returns operational counters only; no truth /
--   popularity / engagement signal. §6 — no evidence_span text in the
--   output (Condition F returns counts ONLY; the SUMs of CASE-WHEN
--   matches per banned-token category). §7 — read-only; no INSERT,
--   no UPDATE, no DELETE, no DDL inside the function body.
--
-- Behavior:
--   - SECURITY DEFINER so the Edge Function's service-role client
--     can call it without RLS friction; the function itself does ONLY
--     read-only SELECTs against append-only audit / queue tables that
--     the service role already reads in the existing classifier-drainer
--     and submit-argument paths.
--   - Function is STABLE (returns the same value for the same input
--     within a transaction; relies only on `now()` + table state).
--   - No prompt / taxonomy / family-key / schema-mirror / Source 6 /
--     production-flag / audit-lint change.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cutover_health_metrics()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  m1 jsonb;
  m2 jsonb;
  m4 jsonb;
  m5_count int;
  m6_count int;
  m8 jsonb;
BEGIN
  -- ── Condition A — M1 drainer cron freshness ──────────────────
  SELECT jsonb_build_object(
    'seconds_since_last_completed_drain',
      EXTRACT(EPOCH FROM (now() - MAX(completed_at))),
    'completed_in_window',
      COUNT(*) FILTER (WHERE outcome = 'completed'),
    'non_completed_in_window',
      COUNT(*) FILTER (WHERE outcome <> 'completed')
  )
  INTO m1
  FROM public.classifier_drain_audit
  WHERE completed_at >= now() - INTERVAL '30 minutes';

  -- ── Condition B — M2 queue depth + oldest-pending-age ────────
  SELECT jsonb_build_object(
    'non_terminal_rows',
      COUNT(*) FILTER (WHERE state IN ('pending', 'leased', 'retry_scheduled')),
    'oldest_pending_age_seconds',
      EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (WHERE state = 'pending'))),
    'pending_count',         COUNT(*) FILTER (WHERE state = 'pending'),
    'leased_count',          COUNT(*) FILTER (WHERE state = 'leased'),
    'retry_scheduled_count', COUNT(*) FILTER (WHERE state = 'retry_scheduled')
  )
  INTO m2
  FROM public.argument_machine_observation_runs
  WHERE family IS NOT NULL
    AND created_at >= now() - INTERVAL '30 minutes';

  -- ── Condition C — M4 dead-letter rate ─────────────────────────
  SELECT jsonb_build_object(
    'total_terminal_cells',
      COUNT(*),
    'dead_letter_cells',
      COUNT(*) FILTER (WHERE state = 'dead_letter'),
    'dead_letter_pct',
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE state = 'dead_letter')
          / NULLIF(COUNT(*), 0),
        3
      )
  )
  INTO m4
  FROM public.argument_machine_observation_runs
  WHERE family IS NOT NULL
    AND state IN ('succeeded', 'dead_letter', 'failed_terminal')
    AND created_at >= now() - INTERVAL '24 hours';

  -- ── Condition E — M5 duplicate-success absence ────────────────
  WITH dup_rows AS (
    SELECT argument_id, family, run_mode
    FROM public.argument_machine_observation_runs
    WHERE state = 'succeeded'
      AND family IS NOT NULL
      AND created_at >= now() - INTERVAL '24 hours'
    GROUP BY argument_id, family, run_mode
    HAVING COUNT(*) > 1
    LIMIT 50
  )
  SELECT COUNT(*)::int INTO m5_count FROM dup_rows;

  -- ── Condition D — M6 direct-dispatch leakage absence ──────────
  WITH routed_args AS (
    SELECT DISTINCT argument_id
    FROM public.argument_machine_observation_runs
    WHERE family IS NOT NULL
      AND created_at >= now() - INTERVAL '1 hour'
  )
  SELECT COUNT(*)::int
  INTO m6_count
  FROM public.argument_machine_observation_runs
  WHERE argument_id IN (SELECT argument_id FROM routed_args)
    AND family IS NULL;

  -- ── Condition F — M8 doctrine ban-list scan ───────────────────
  -- Counts only; no evidence_span text leaves SQL.
  WITH routed_args AS (
    SELECT DISTINCT argument_id
    FROM public.argument_machine_observation_runs
    WHERE family IS NOT NULL
      AND created_at >= now() - INTERVAL '24 hours'
  )
  SELECT jsonb_build_object(
    'total_evidence_spans_scanned', COUNT(*),
    'hits_verdict_persona',
      SUM(CASE WHEN LOWER(r.evidence_span) ~ '\b(winner|loser|liar|dishonest)\b' THEN 1 ELSE 0 END),
    'hits_truth_or_victory',
      SUM(CASE WHEN LOWER(r.evidence_span) ~ '\b(true|correct|proves|refutes|defeated|conceded)\b' THEN 1 ELSE 0 END),
    'hits_quality_verdict',
      SUM(CASE WHEN LOWER(r.evidence_span) ~ '\b(weak|sloppy|lazy|careless|confused|unsound|incoherent|illogical)\b' THEN 1 ELSE 0 END),
    'hits_motive_verdict',
      SUM(CASE WHEN LOWER(r.evidence_span) ~ '\b(bad faith|manipulative|propagandist|extremist|stupid|idiot)\b' THEN 1 ELSE 0 END)
  )
  INTO m8
  FROM public.argument_machine_observation_results r
  JOIN public.argument_machine_observation_runs rn ON rn.id = r.run_id
  WHERE r.argument_id IN (SELECT argument_id FROM routed_args)
    AND rn.family IS NOT NULL
    AND rn.run_mode = 'production'
    AND rn.state = 'succeeded';

  RETURN jsonb_build_object(
    'conditionA', COALESCE(m1, '{}'::jsonb),
    'conditionB', COALESCE(m2, '{}'::jsonb),
    'conditionC', COALESCE(m4, '{}'::jsonb),
    'conditionD', jsonb_build_object('direct_dispatch_leak_count', COALESCE(m6_count, 0)),
    'conditionE', jsonb_build_object('duplicate_success_cell_count', COALESCE(m5_count, 0)),
    'conditionF', COALESCE(m8, '{}'::jsonb),
    'collected_at', to_jsonb(now())
  );
END;
$$;

COMMENT ON FUNCTION public.cutover_health_metrics() IS
  'OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING: read-only aggregator for '
  'the 6 silent-failure alert conditions (A drainer stale, B queue backlog, '
  'C dead-letter rate, D direct-dispatch leak, E duplicate success, F doctrine '
  'ban-list). Returns counts only; no evidence_span text in the output. '
  'Called by the cutover-health-monitor Edge Function.';

-- Tighten privileges: only service_role + postgres can EXECUTE. The Edge
-- Function uses the service-role client; ordinary users never see this.
REVOKE EXECUTE ON FUNCTION public.cutover_health_metrics() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cutover_health_metrics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cutover_health_metrics() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cutover_health_metrics() TO service_role;
