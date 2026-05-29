-- OPS-MCP-LATENCY-BUDGET — Q16: per-(argument, family) production durations.
--
-- One row per production auto-trigger SUCCESS run for the most recent N
-- arguments (N defaults to 5 via the LIMIT in recent_args). Production
-- auto-trigger runs carry EXACTLY ONE element in requested_families
-- (the dispatcher classifies one family per iteration), so
-- requested_families[1] is the family. Duration = completed_at − started_at,
-- in seconds. The report aggregates min/p50/p95/max per family in JS.
--
-- Doctrine: aggregate timing only; no body content; no evidence_span.
--           Latency is a system-performance metric, never a gameplay signal.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops-latency-sql/01-auto-trigger-per-family-duration.sql
with recent_args as (
  select argument_id, min(started_at) as arg_first_started
  from public.argument_machine_observation_runs
  where run_mode = 'production'
    and status = 'success'
    and completed_at is not null
  group by argument_id
  order by arg_first_started desc
  limit 5
)
select
  r.argument_id,
  (r.requested_families)[1]                                   as family,
  round(extract(epoch from (r.completed_at - r.started_at))::numeric, 3)
                                                              as family_seconds,
  r.started_at,
  r.completed_at
from public.argument_machine_observation_runs r
join recent_args ra on ra.argument_id = r.argument_id
where r.run_mode = 'production'
  and r.status = 'success'
  and r.completed_at is not null
  and array_length(r.requested_families, 1) = 1
order by r.argument_id, family;
