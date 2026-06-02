-- OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 gate probe E5/E6:
-- routing liveness + isolation leakage check (read-only).
--
-- Per recent routed argument, counts the routing fan-out three ways:
--   routing_rows  = runs carrying a non-null family (queue routing path);
--   legacy_rows   = runs with a null family (legacy direct-dispatch path) —
--                   must be 0 on a routed arg (E5: no routing-isolation breach);
--   hij_rows      = runs whose family is one of the three gated families
--                   (claim_clarity / thread_topology / sensitive_composer) —
--                   must be 0 (E6: no gated-family leakage into the A-G set).
--
-- "recent routed" = the most recent N argument_ids (N defaults to 25 via the
-- LIMIT in recent_routed) that have at least one run with a non-null family.
--
-- Doctrine: queue/run metadata only — no body text, no classifier output.
--           These are routing-isolation health signals, never a gameplay or
--           truth signal. Read-only SELECT; no write of any kind.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops-stage1-sql/01-routing-liveness-and-leakage.sql
with recent_routed as (
  select argument_id, min(started_at) as arg_first_started
  from public.argument_machine_observation_runs
  where family is not null
  group by argument_id
  order by arg_first_started desc
  limit 25
)
select
  r.argument_id,
  count(*) filter (where r.family is not null)                       as routing_rows,
  count(*) filter (where r.family is null)                           as legacy_rows,
  count(*) filter (
    where r.family in ('claim_clarity', 'thread_topology', 'sensitive_composer')
  )                                                                   as hij_rows,
  count(distinct r.family) filter (where r.family is not null)        as distinct_families
from public.argument_machine_observation_runs r
join recent_routed rr on rr.argument_id = r.argument_id
group by r.argument_id
order by r.argument_id;
