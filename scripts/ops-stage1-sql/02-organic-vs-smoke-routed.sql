-- OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 gate probe E1:
-- organic vs smoke-tagged routed-arg split with terminal-state breakdown
-- for each bucket (read-only).
--
-- A routed run is smoke-tagged when its debate title begins with the
-- '[arch-001-queue-smoke]' override (these route regardless of percentage);
-- everything else is organic (hashed into the live percentage bucket).
-- This probe answers: have any ORGANIC cells routed, and if so did they
-- reach the terminal 'succeeded' lifecycle state within budget?
--
-- The queue lifecycle lives in the `state` column (pending / leased /
-- retry_scheduled / succeeded / failed_terminal / dead_letter). The three
-- terminal states are succeeded / failed_terminal / dead_letter; the other
-- three are non-terminal (still in flight).
--
-- bucket             = 'smoke' | 'organic'
-- routed_args        = distinct routed argument_ids in the bucket
-- runs_total         = total runs (cells) in the bucket
-- runs_succeeded     = runs in terminal 'succeeded' state
-- runs_dead_letter   = runs parked terminal in 'dead_letter'
-- runs_failed_term   = runs in terminal 'failed_terminal'
-- runs_non_terminal  = runs not yet terminal (pending/leased/retry_scheduled)
--
-- Doctrine: queue/run + debate-title metadata only — no body text, no
--           classifier output. Read-only SELECT; no write.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops-stage1-sql/02-organic-vs-smoke-routed.sql
with routed_runs as (
  select
    r.argument_id,
    r.state,
    case
      when d.title like '[arch-001-queue-smoke]%' then 'smoke'
      else 'organic'
    end as bucket
  from public.argument_machine_observation_runs r
  join public.debates d on d.id = r.debate_id
  where r.family is not null
)
select
  bucket,
  count(distinct argument_id)                                    as routed_args,
  count(*)                                                        as runs_total,
  count(*) filter (where state = 'succeeded')                    as runs_succeeded,
  count(*) filter (where state = 'dead_letter')                  as runs_dead_letter,
  count(*) filter (where state = 'failed_terminal')              as runs_failed_term,
  count(*) filter (
    where state in ('pending', 'leased', 'retry_scheduled')
  )                                                              as runs_non_terminal
from routed_runs
group by bucket
order by bucket;
