-- OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 window-close READINESS report.
--
-- Read-only. Reports whether the 24h Stage-1 observation window has elapsed
-- and how much organic (non-smoke) traffic was routed during it. Columns:
--   armed_at              — the recorded 1% arm time (2026-06-02T07:50:54Z).
--   window_close_at       — arm + INTERVAL '24 hours' (the earliest moment a
--                           human MAY decide to close the window).
--   sec_until_window_close — seconds remaining until window_close_at; <= 0
--                           once the 24h has elapsed.
--   window_elapsed        — boolean: has now() reached window_close_at.
--   non_smoke_routed_args — DISTINCT organic args routed since arm (debate
--                           title without the '[arch-001-queue-smoke]' prefix).
--
-- IMPORTANT: this script does NOT close the window. Closing the Stage-1
-- observation window, issuing any PASS verdict, and advancing the routing
-- percentage above 1% are HUMAN decisions made AFTER the window has elapsed
-- and the metrics have been reviewed. This SELECT mutates nothing and merely
-- reports readiness inputs for that human decision.
--
-- Doctrine (cdiscourse): readiness inputs are operational facts, never a
-- verdict. No body content; no per-row text.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops-stage1-sql/stage1-window-close-readonly.sql
WITH arm AS (
  SELECT TIMESTAMPTZ '2026-06-02T07:50:54Z' AS armed_at
)
SELECT
  arm.armed_at                                                                  AS armed_at,
  arm.armed_at + INTERVAL '24 hours'                                            AS window_close_at,
  EXTRACT(EPOCH FROM (arm.armed_at + INTERVAL '24 hours' - now()))::bigint      AS sec_until_window_close,
  (now() >= arm.armed_at + INTERVAL '24 hours')                                 AS window_elapsed,
  (
    SELECT COUNT(DISTINCT r.argument_id)
    FROM public.argument_machine_observation_runs r
    JOIN public.debates d ON d.id = r.debate_id
    WHERE r.family IS NOT NULL
      AND r.created_at >= arm.armed_at
      AND d.title NOT LIKE '[arch-001-queue-smoke]%'
  )                                                                             AS non_smoke_routed_args
FROM arm;
