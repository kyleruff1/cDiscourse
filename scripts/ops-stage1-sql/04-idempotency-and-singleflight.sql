-- OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 gate probe E3/E4:
-- idempotency (no duplicate success per cell) + single-flight (no
-- overlapping drain leases) check (read-only).
--
-- duplicate_success_cells: count of cells — a cell is the tuple
--   (argument_id, family, run_mode, schema_version) — that have MORE than
--   one terminal 'succeeded' run. The amor_one_success_per_cell partial
--   unique index already forbids this at the DB level, so the expected
--   value is 0 (E3). Any value > 0 is a HALT signal.
--
-- overlapping_drain_pairs: count of UNORDERED pairs of recent drain-audit
--   rows whose active windows overlap. A drain's active window is
--   [started_at, coalesce(completed_at, now())]; two windows overlap when
--   each starts at-or-before the other ends. The single-flight TTL lease
--   should make this 0 (E4). Any value > 0 means two drains ran
--   concurrently — a HALT signal. The self-join is restricted to the most
--   recent 200 audit rows so the pair scan stays bounded.
--
-- Doctrine: queue/run + drain-audit metadata only. Read-only SELECT; no
--           write. These are concurrency-correctness signals, never a
--           gameplay or truth signal.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops-stage1-sql/04-idempotency-and-singleflight.sql
with success_per_cell as (
  select
    argument_id, family, run_mode, schema_version,
    count(*) as success_runs
  from public.argument_machine_observation_runs
  where state = 'succeeded'
    and family is not null
  group by argument_id, family, run_mode, schema_version
),
recent_audit as (
  select id, started_at, coalesce(completed_at, now()) as window_end
  from public.classifier_drain_audit
  order by started_at desc
  limit 200
),
overlaps as (
  select a.id as a_id, b.id as b_id
  from recent_audit a
  join recent_audit b
    on a.id < b.id
   and a.started_at <= b.window_end
   and b.started_at <= a.window_end
)
select
  (select count(*) from success_per_cell where success_runs > 1) as duplicate_success_cells,
  (select count(*) from overlaps)                                as overlapping_drain_pairs;
