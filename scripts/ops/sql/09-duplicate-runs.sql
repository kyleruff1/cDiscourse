-- OPS-MCP-OBSERVABILITY — Q9: Duplicate successful runs (classified).
--
-- Detects multiple successful runs for the same
-- (argument_id, family, run_mode, schema_version, provider_key, model_name)
-- tuple AND classifies each pair into one of four categories so the
-- report distinguishes documented audit/smoke re-fires from genuinely
-- organic duplicate-risk candidates.
--
-- Family attribution joins through results because family lives on
-- results (D5 resolution).
--
-- ---------------------------------------------------------------------
-- Stage 2B re-scope (OPS-MCP-IDEMPOTENCY-HARDENING)
-- ---------------------------------------------------------------------
--
-- Per the operator's Stage 2B binding decision (Cause-C-only path), the
-- RCA at design HEAD `a79c041` found NO current runtime idempotency
-- defect for the 3 surfaced pairs:
--
--   * Pairs 1+2 (admin_validation, ~8h 26m gap) — operator-driven
--     admin_validation smoke re-runs across two audit sessions. Documented
--     in `docs/audits/MCP-021C-EDGE-SMOKE-2026-05-26.md` Phase 3.2 and
--     `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md`
--     Phase 3.4. admin_validation is by-design re-runnable.
--
--   * Pair 3 (production, 2m 11s gap) — operator-driven Phase 6
--     idempotency smoke. Documented in
--     `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-2026-05-26.md`
--     Phase 6 lines 210-234. The second run came from a deliberate
--     manual invocation of `classify-argument-boolean-observations` with
--     `mode=production` for an argument that had already received an
--     auto-trigger run. The audit's verdict matrix calls this
--     "Idempotency PASS (by design) — manual Edge path benign by design".
--
-- The original (pre-classification) Q9 surfaced all three pairs as
-- undifferentiated "duplicate_successful_runs > 1" rows, which over-read
-- the signal as runtime defect when it was documented audit/smoke
-- re-fire. This classified version preserves visibility into TRUE
-- duplicate risk (organic_duplicate_candidate, needs_investigation)
-- while marking documented re-fires (audit_or_smoke_rerun) so an
-- operator can read the report at a glance.
--
-- ---------------------------------------------------------------------
-- Classification categories (4)
-- ---------------------------------------------------------------------
--
--   audit_or_smoke_rerun
--     Documented audit / smoke / manual re-fire. NOT a runtime defect.
--     Detected via two complementary signals (the SQL applies whichever
--     fires; either is sufficient):
--       Signal 1 (data-derived time-gap heuristic):
--         run_mode = 'admin_validation' AND gap between the earliest and
--         latest run is at least 1 hour. admin_validation is by-design
--         re-runnable across audit sessions (intent brief §8); the
--         1-hour floor excludes any same-session race window.
--       Signal 2 (run_id allowlist for documented historical pairs):
--         Pair 1: 67431fe3-… + c8f09f4d-…
--         Pair 2: f370e813-… + 0263205e-…
--         Pair 3: a416c21a-… + 7ea35268-…
--         These are the three pairs documented in committed audit files
--         at design time. The allowlist is a defensive fallback so the
--         Pair 3 production pair (which has a SHORT 2m 11s gap and would
--         otherwise classify as needs_investigation) is properly
--         attributed to the documented Phase 6 smoke.
--
--   synthetic_test_data
--     Pre-cleanup test-seed rows. Detected via
--     provider_key LIKE 'smoke-%'. Currently empty post-cleanup
--     (`b8ce07b` removed 11 synthetic rows) but kept defensively so
--     future test-seed leakage surfaces as a distinct category, not as
--     organic duplicate risk.
--
--   needs_investigation
--     Suspicious very-short gap (< 30s) between successful runs on the
--     same tuple AND not provably an audit re-fire AND not synthetic.
--     A < 30s gap is shorter than any documented legitimate re-fire
--     pattern; combined with same input_hash this is a candidate
--     race-condition or retry-loop side effect.
--
--   organic_duplicate_candidate
--     DEFAULT for any duplicate-pair that does NOT match the above three
--     categories. This is the bucket the operator must investigate when
--     a future report shows non-zero rows here.
--
-- The default is conservative: ANYTHING the SQL cannot provably classify
-- as audit_or_smoke_rerun / synthetic_test_data / needs_investigation
-- falls through to organic_duplicate_candidate so real duplicate risk is
-- NEVER hidden.
--
-- ---------------------------------------------------------------------
-- Operator action mapping
-- ---------------------------------------------------------------------
--
--   audit_or_smoke_rerun         → no action; expected by-design.
--   synthetic_test_data          → ops/cleanup card (precedent at
--                                  `b8ce07b` OPS-MCP-TEST-DATA-CLEANUP).
--   needs_investigation          → file investigation card; review the
--                                  involved run_ids and timestamps for
--                                  race-condition evidence.
--   organic_duplicate_candidate  → file OPS-MCP-IDEMPOTENCY-HARDENING-
--                                  RUNTIME (deferred per Stage 2B until
--                                  this bucket goes non-zero).
--
-- ---------------------------------------------------------------------
-- Doctrine
-- ---------------------------------------------------------------------
--
--   * No raw argument bodies.
--   * No evidence_span content.
--   * No verdict tokens (per cdiscourse-doctrine).
--   * Read-only query; aggregate counts only.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q9
--                  + docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING.md
--                    (Stage 2B re-scope section at top).
--
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/09-duplicate-runs.sql
with run_to_family as (
  -- For each successful run, distinct (run, family) tuples where the
  -- run produced at least one positive. A LEFT JOIN preserves runs
  -- with zero positives (family = NULL — filtered below).
  select distinct r.id as run_id, r.argument_id, r.run_mode,
                  r.schema_version, r.provider_key, r.model_name,
                  r.started_at,
                  res.family,
                  r.status
  from public.argument_machine_observation_runs r
  left join public.argument_machine_observation_results res on res.run_id = r.id
  where r.status = 'success'
),
grouped as (
  -- Aggregate runs by the duplicate-key tuple. Capture min/max
  -- started_at so downstream classification can apply the time-gap
  -- heuristic. Also array_agg the run_ids so the run_id allowlist
  -- fallback can be applied.
  select
    argument_id,
    family,
    run_mode,
    schema_version,
    provider_key,
    model_name,
    count(distinct run_id) as duplicate_successful_runs,
    min(started_at) as earliest_started_at,
    max(started_at) as latest_started_at,
    array_agg(distinct run_id) as run_ids
  from run_to_family
  where family is not null
  group by argument_id, family, run_mode, schema_version, provider_key, model_name
  having count(distinct run_id) > 1
)
select
  argument_id,
  family,
  run_mode,
  schema_version,
  provider_key,
  model_name,
  duplicate_successful_runs,
  case
    -- synthetic_test_data: pre-cleanup test-seed providers. Highest
    -- priority because a smoke-% provider is structural test data
    -- regardless of timing or run_mode.
    when provider_key like 'smoke-%' then 'synthetic_test_data'

    -- audit_or_smoke_rerun via run_id allowlist (Signal 2). The three
    -- pairs are explicitly documented in committed audit files; the
    -- allowlist is a defensive fallback for the production Pair 3
    -- which has a 2m 11s gap that would otherwise classify as
    -- needs_investigation.
    when run_ids && array[
      '67431fe3-5e29-4c38-8fc3-96c6f59467fa'::uuid,
      'c8f09f4d-8cb5-44df-b925-1d428f73d24f'::uuid,
      'f370e813-1f80-4b40-8bc1-7a4d71c59489'::uuid,
      '0263205e-cc71-4116-bbf0-7d19b86d75c5'::uuid,
      'a416c21a-bc06-4446-9902-7112ff59ff37'::uuid,
      '7ea35268-4caf-4621-b8a5-65e99f8aaa9a'::uuid
    ]::uuid[] then 'audit_or_smoke_rerun'

    -- audit_or_smoke_rerun via time-gap heuristic (Signal 1):
    -- admin_validation duplicates with at least a 1-hour gap are
    -- cross-session audit re-runs by design.
    when run_mode = 'admin_validation'
         and (latest_started_at - earliest_started_at) >= interval '1 hour'
      then 'audit_or_smoke_rerun'

    -- needs_investigation: very-short gap (< 30s) on the same tuple is
    -- shorter than any documented legitimate re-fire pattern. This is
    -- the race-condition or retry-loop bucket.
    when (latest_started_at - earliest_started_at) < interval '30 seconds'
      then 'needs_investigation'

    -- Default: organic_duplicate_candidate. ANY duplicate not provably
    -- classified into the three categories above lands here so real
    -- duplicate risk is never hidden by the filter.
    else 'organic_duplicate_candidate'
  end as classification
from grouped
order by
  -- Surface the most-urgent classifications first so an operator
  -- scanning the report sees real risk at the top.
  case
    when provider_key like 'smoke-%' then 3
    when run_ids && array[
      '67431fe3-5e29-4c38-8fc3-96c6f59467fa'::uuid,
      'c8f09f4d-8cb5-44df-b925-1d428f73d24f'::uuid,
      'f370e813-1f80-4b40-8bc1-7a4d71c59489'::uuid,
      '0263205e-cc71-4116-bbf0-7d19b86d75c5'::uuid,
      'a416c21a-bc06-4446-9902-7112ff59ff37'::uuid,
      '7ea35268-4caf-4621-b8a5-65e99f8aaa9a'::uuid
    ]::uuid[] then 4
    when run_mode = 'admin_validation'
         and (latest_started_at - earliest_started_at) >= interval '1 hour' then 4
    when (latest_started_at - earliest_started_at) < interval '30 seconds' then 1
    else 2
  end asc,
  duplicate_successful_runs desc,
  argument_id,
  family;
