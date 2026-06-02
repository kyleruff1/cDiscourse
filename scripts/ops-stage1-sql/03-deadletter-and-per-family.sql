-- OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 gate probe E1/E2:
-- per-family terminal-state breakdown for recent routed args, so an
-- ISOLATED dead-letter is distinguishable from a CLUSTER (read-only).
--
-- For the most recent N routed args (N defaults to 25 via the LIMIT in
-- recent_routed), aggregates per family:
--   cells           = total runs for the family
--   succeeded        = terminal 'succeeded'
--   dead_letter      = terminal 'dead_letter'  (E2: >1 in one family = cluster)
--   failed_terminal  = terminal 'failed_terminal'
--   non_terminal     = pending / leased / retry_scheduled
--   max_attempts     = highest attempt_count seen for the family
--
-- Read against the budget rule in the roadmap §6: a single isolated typed
-- dead_letter is within tolerance; a per-family dead_letter count > 1
-- (especially in argument_scheme, the mitigated family) is a CLUSTER /
-- HALT signal. This probe only COUNTS — it asserts nothing and surfaces no
-- failure_sub_reason text, body, or classifier output.
--
-- Doctrine: queue/run metadata only. Read-only SELECT; no write.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops-stage1-sql/03-deadletter-and-per-family.sql
with recent_routed as (
  select argument_id, min(started_at) as arg_first_started
  from public.argument_machine_observation_runs
  where family is not null
  group by argument_id
  order by arg_first_started desc
  limit 25
)
select
  r.family,
  count(*)                                                       as cells,
  count(*) filter (where r.state = 'succeeded')                  as succeeded,
  count(*) filter (where r.state = 'dead_letter')                as dead_letter,
  count(*) filter (where r.state = 'failed_terminal')            as failed_terminal,
  count(*) filter (
    where r.state in ('pending', 'leased', 'retry_scheduled')
  )                                                              as non_terminal,
  max(r.attempt_count)                                           as max_attempts
from public.argument_machine_observation_runs r
join recent_routed rr on rr.argument_id = r.argument_id
where r.family is not null
group by r.family
order by r.family;
