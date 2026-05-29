-- OPS-MCP-LATENCY-BUDGET — Q17: per-argument wall-clock background time.
--
-- wall_clock_background = max(completed_at) − min(started_at) over an
-- argument's production SUCCESS runs (the BINDING threshold clock, D2).
-- sum_of_per_family   = Σ (completed_at − started_at)        (context clock).
-- The gap (wall_clock − sum) is the inter-family dispatch overhead
-- (idempotency pre-check + scheduling between sequential iterations).
--
-- Same recent-N argument set as Q16. The report computes p50/p95 of
-- wall_clock_background across these argument rows in JS.
--
-- Doctrine: aggregate timing only; no body content.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/17-auto-trigger-wall-clock-per-argument.sql
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
  count(*)                                                              as family_runs,
  round(extract(epoch from (max(r.completed_at) - min(r.started_at)))::numeric, 3)
                                                                        as wall_clock_background_seconds,
  round(extract(epoch from sum(r.completed_at - r.started_at))::numeric, 3)
                                                                        as sum_of_per_family_seconds
from public.argument_machine_observation_runs r
join recent_args ra on ra.argument_id = r.argument_id
where r.run_mode = 'production'
  and r.status = 'success'
  and r.completed_at is not null
group by r.argument_id
order by wall_clock_background_seconds desc;
