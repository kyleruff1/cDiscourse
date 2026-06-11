-- OPS-MCP-OBSERVABILITY — Q18: unclean-span key drops by family
--
-- OPS-MCP-KEY-LEVEL-FAIL-CLOSED observability Q-file. Counts SUCCESS runs that
-- dropped >= 1 key by OMISSION (key-level fail-closed) because that key's
-- evidenceSpan tripped the byte-unchanged doctrine ban-scan, grouped by family
-- + run_mode + the unnest-ed dropped rawKey NAME, over a recent window.
--
-- READ-ONLY operator query (SELECT only). NAMES ONLY — it surfaces the dropped
-- rawKey NAME (e.g. 'needs_pre_send_pause') and per-key counts; it NEVER reads
-- a body, an evidence_span, or any span content. cdiscourse-doctrine §1/§10a:
-- a drop is fail-closed validation at the key scope; the per-key DROP RATE is an
-- ADVISORY signal that prompt iteration may be warranted for that key's
-- span-anchoring — it never gates and never flips a family posture.
--
-- A sustained rate on one key (e.g. needs_pre_send_pause dropping on a large
-- fraction of Family J admin_validation runs) is the operator's cue to iterate
-- the prompt's span-anchoring for that key. Family J (sensitive_composer) is the
-- only enabled family on first ship (admin-validation-only; direct-dispatch
-- path), so production rows here should be empty until a widening follow-up.
SELECT
  fam.family                     AS family,
  r.run_mode                     AS run_mode,
  dk.dropped_raw_key             AS dropped_raw_key,
  COUNT(DISTINCT r.id)           AS runs_with_drop,
  COUNT(DISTINCT r.argument_id)  AS distinct_arguments
FROM public.argument_machine_observation_runs r
CROSS JOIN LATERAL unnest(r.requested_families) AS fam(family)
CROSS JOIN LATERAL unnest(r.dropped_unclean_span_keys) AS dk(dropped_raw_key)
WHERE r.dropped_unclean_span_keys IS NOT NULL
  AND cardinality(r.dropped_unclean_span_keys) > 0
  AND r.status = 'success'
  AND COALESCE(r.completed_at, r.started_at) >= now() - interval '30 days'
GROUP BY fam.family, r.run_mode, dk.dropped_raw_key
ORDER BY runs_with_drop DESC, fam.family, dk.dropped_raw_key;
