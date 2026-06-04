-- CORPUS-30 Phase 7 — Step 3: failure-reason breakdown per family.
-- Where MCP packet-shape / timeout / provider_server_error patterns
-- surface. Memory markers:
--   * [[mcp-validation-failed-burst-concurrency]] — 2nd cause of
--     mcp_validation_failed under load (~4-8s, load-correlated).
--   * [[mcp-provider-server-error-bucketing]] — classifier-queue
--     provider_server_error is ambiguous; real reason lives in
--     failure_detail->>'reason'.
--   * [[mcp-mixed-source-family-edge-subset]] — mixed-source MCP families
--     (D, G) need a MCP_SERVER_SUPPORTED_FAMILY_SOURCES entry in the Edge
--     booleanObservationRequestBuilder.ts or production fails with
--     mcp_validation_failed.
--
-- failure_sub_reason was added by 20260528000021 (queue substrate;
-- nullable for DIRECT-DISPATCH rows).
-- failure_detail jsonb was added by 20260602000001 (terminal-failure
-- diagnostic; nullable on success and on direct-path rows).
--
-- Useful comparisons:
--   * 0 'failed' rows across A-G: green for this corpus.
--   * 'failed' dominated by mcp_validation_failed: revisit
--     OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 1 typing card).
--   * 'failed' dominated by mcp_network_error / mcp_provider_server_error:
--     revisit OPS-MCP-RESULT-VALIDATION-RETRY-TUNING + check failure_detail.
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
  COUNT(*) AS n,
  -- Surface the JSONB reason if present (truncated for table readability).
  -- failure_detail->>'reason' is the canonical leak-safe field.
  COUNT(DISTINCT r.failure_detail->>'reason') AS distinct_failure_detail_reasons
  FROM public.argument_machine_observation_runs r
 WHERE r.argument_id IN (SELECT id FROM corpus_args)
   AND r.status = 'failed'
 GROUP BY 1, 2, 3
 ORDER BY 1, 4 DESC;
