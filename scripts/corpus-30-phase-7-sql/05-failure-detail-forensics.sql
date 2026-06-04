-- CORPUS-30 Phase 7 — Step 5: failure_detail forensics (terminal failures).
-- For every terminal failure row, project the leak-safe jsonb
-- failure_detail surface so MCP-side root cause can be inferred WITHOUT
-- reading raw MCP payloads.
--
-- failure_detail->>'reason' is the canonical typed sub-reason. Other
-- fields are leak-safe diagnostic projections; the migration's column
-- comment in 20260602000001 is authoritative.
--
-- Run only if Step 3 surfaced non-zero 'failed' rows for any family.
WITH corpus_args AS (
  SELECT a.id
    FROM public.arguments a
    JOIN public.debates d ON a.debate_id = d.id
   WHERE d.title LIKE '%corpus-prod-synthetic-20260603-1924-d49e04cd%'
)
SELECT
  COALESCE(r.family, r.requested_families[1]) AS family,
  r.failure_reason,
  r.failure_sub_reason,
  r.failure_detail->>'reason'      AS detail_reason,
  r.failure_detail->>'classifier'  AS detail_classifier,
  r.failure_detail->>'http_status' AS detail_http_status,
  r.attempt_count,
  r.state,
  COUNT(*) AS n
  FROM public.argument_machine_observation_runs r
 WHERE r.argument_id IN (SELECT id FROM corpus_args)
   AND r.status = 'failed'
 GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
 ORDER BY 1, 9 DESC, 4;
