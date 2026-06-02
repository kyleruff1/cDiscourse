-- OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 gate probe E8/E9:
-- drainer freshness (M1) and queue depth (M2) reported TOGETHER, so the
-- idle-empty-vs-stuck distinction is explicit in one result (read-only).
--
-- m1_seconds_since_last_drain: seconds since the most recent completed
--   drain (max(completed_at) over the drain audit). Freshness gate E8 is
--   "< 120s while M2 > 0". When M2 = 0 this value may be large and that is
--   HEALTHY INERTNESS, not a stall — see m2_non_terminal below.
--
-- m2_non_terminal: count of queue rows still in flight
--   (state pending / leased / retry_scheduled, family IS NOT NULL). Gate E9
--   is "drains back to 0 after a burst".
--
-- drainer_reading: a plain-language interpretation combining the two —
--   'idle_empty'   : M2 = 0 (no work) — stale M1 is fine here;
--   'fresh_working': M2 > 0 and M1 < 120s (work present, draining);
--   'STUCK'        : M2 > 0 and M1 >= 120s (work present, NOT draining) —
--                    this is the only E8 failure condition.
--
-- Doctrine: queue/run + drain-audit metadata only. Read-only SELECT; no
--           write. System-health signal, never a gameplay or truth signal.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops-stage1-sql/05-drainer-freshness-and-depth.sql
with last_drain as (
  select max(completed_at) as last_completed_at
  from public.classifier_drain_audit
),
depth as (
  select count(*) as m2_non_terminal
  from public.argument_machine_observation_runs
  where state in ('pending', 'leased', 'retry_scheduled')
    and family is not null
)
select
  round(extract(epoch from (now() - ld.last_completed_at))::numeric, 1)
                                                            as m1_seconds_since_last_drain,
  d.m2_non_terminal,
  case
    when d.m2_non_terminal = 0 then 'idle_empty'
    when ld.last_completed_at is not null
         and (now() - ld.last_completed_at) < interval '120 seconds'
      then 'fresh_working'
    else 'STUCK'
  end                                                        as drainer_reading
from last_drain ld
cross join depth d;
