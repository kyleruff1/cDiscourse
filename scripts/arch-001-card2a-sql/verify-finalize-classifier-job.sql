-- ============================================================
-- ARCH-001 Card 2A — OPERATOR POST-MERGE LIVE VERIFICATION
--
-- Run this AFTER the operator applies
--   supabase/migrations/20260528000022_arch_001_card2a_atomic_finalizer.sql
-- via `npx supabase db push --linked`.
--
-- Purpose: prove the 6 Card-2A behavioral cases (intent brief §Tests)
-- against the APPLIED database. These assertions genuinely need a
-- live Postgres (the result-INSERT + run-UPDATE atomicity, the ON CONFLICT
-- duplicate-safe path against amor_unique_run_rawkey, the ownership /
-- stale-owner no-op, the terminal-failure field writes) and therefore
-- CANNOT run in the deterministic Jest suite — Docker was unavailable in
-- the implementer environment, so the Jest suite asserts the migration
-- TEXT/SHAPE contract (see __tests__/archOneCardTwoAFinalizerMigration.test.ts)
-- and THIS script asserts the RUNTIME behavior.
--
-- CASE MAP (which cases are SHAPE vs LIVE):
--   - Cases 1-5 below are LIVE (require an applied DB; asserted here).
--   - Case 6 (direct-dispatch path unchanged) is a SHAPE assertion proven
--     in Jest (FIN-33/FIN-34 mirror persistResults; the writer file is
--     untouched). It is restated here as a documented note only — there is
--     nothing to run, because the point is that persistenceWriter.ts and the
--     direct persistRun/persistResults path were NOT modified by this card.
--
-- SAFETY: this script runs entirely inside one transaction that ALWAYS
-- ROLLS BACK. It fabricates NO new debate / argument / profile rows — it
-- reuses one existing (debate_id, argument_id) pair and inserts only
-- synthetic queue + result rows under a synthetic family/schema_version,
-- all discarded by the ROLLBACK. It never deploys anything, never touches
-- secrets, never disables RLS, never modifies persistenceWriter.ts.
--
-- HOW TO RUN (psql against the linked project):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f scripts/arch-001-card2a-sql/verify-finalize-classifier-job.sql
-- A clean run prints a series of NOTICE lines ending with
--   'ARCH-001 Card 2A verification: ALL ASSERTIONS PASSED (rolled back)'
-- and leaves the database unchanged. Any ASSERT failure aborts with a
-- message naming the failed case.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- Fixture: reuse an existing argument + debate. We never insert into
-- public.arguments / public.debates / public.profiles.
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_arg     uuid;
  v_deb     uuid;
  v_sv      text := 'arch-001-card2a-verify';   -- synthetic schema_version (never collides with real rows)
  v_mode    text := 'production';
  v_run     uuid;
  v_run2    uuid;
  v_run_fail uuid;
  v_owner_a text := 'verify-owner-a';
  v_owner_b text := 'verify-owner-b';
  v_ok      boolean;
  v_state   text;
  v_status  text;
  v_completed timestamptz;
  v_lease_owner text;
  v_lease_exp timestamptz;
  v_failure_reason text;
  v_failure_sub text;
  v_dead_reason text;
  v_result_count int;
BEGIN
  SELECT a.id, a.debate_id INTO v_arg, v_deb
  FROM public.arguments a
  LIMIT 1;

  IF v_arg IS NULL THEN
    RAISE EXCEPTION 'ARCH-001 Card 2A verify: no existing argument row to anchor the fixture; seed one argument then re-run.';
  END IF;
  RAISE NOTICE 'ARCH-001 Card 2A verify: anchoring on existing argument % (debate %)', v_arg, v_deb;

  -- ============================================================
  -- CASE 1 — SUCCESS finalization.
  -- A leased row owned by owner-a is finalized 'succeeded': two result rows
  -- are inserted; the run flips to state=succeeded / status=success;
  -- completed_at is set; lease_owner + lease_expires_at are cleared; the
  -- function returns true.
  -- ============================================================
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, lease_owner, lease_expires_at,
     attempt_count, available_at, started_at)
  VALUES
    (v_arg, v_deb, 'verify_family_succ', v_mode, v_sv, ARRAY['verify_family_succ'],
     'leased', v_owner_a, now() + interval '120 seconds', 1, now(), now())
  RETURNING id INTO v_run;

  v_ok := public.finalize_classifier_job(
    v_run,
    v_owner_a,
    'succeeded',
    'success',
    NULL, NULL, NULL,
    jsonb_build_array(
      jsonb_build_object('raw_key', 'verify_rk_1', 'family', 'verify_family_succ',
                         'confidence', 'high',   'evidence_span', 'span one'),
      jsonb_build_object('raw_key', 'verify_rk_2', 'family', 'verify_family_succ',
                         'confidence', 'medium', 'evidence_span', NULL)
    )
  );
  ASSERT v_ok = true, 'CASE 1 FAILED: success finalize should return true';

  SELECT state, status, completed_at, lease_owner, lease_expires_at
    INTO v_state, v_status, v_completed, v_lease_owner, v_lease_exp
  FROM public.argument_machine_observation_runs WHERE id = v_run;
  ASSERT v_state = 'succeeded',     'CASE 1 FAILED: run state should be succeeded';
  ASSERT v_status = 'success',      'CASE 1 FAILED: run status should be success';
  ASSERT v_completed IS NOT NULL,   'CASE 1 FAILED: completed_at should be set';
  ASSERT v_lease_owner IS NULL,     'CASE 1 FAILED: lease_owner should be cleared';
  ASSERT v_lease_exp IS NULL,       'CASE 1 FAILED: lease_expires_at should be cleared';

  SELECT count(*) INTO v_result_count
  FROM public.argument_machine_observation_results WHERE run_id = v_run;
  ASSERT v_result_count = 2, format('CASE 1 FAILED: expected 2 result rows, got %s', v_result_count);

  -- evidence_span null-handling: the second observation had NULL evidence_span
  -- and must persist as NULL (mirrors persistResults pass-through).
  ASSERT EXISTS (
    SELECT 1 FROM public.argument_machine_observation_results
    WHERE run_id = v_run AND raw_key = 'verify_rk_2' AND evidence_span IS NULL
  ), 'CASE 1 FAILED: NULL evidence_span should persist as NULL';
  ASSERT EXISTS (
    SELECT 1 FROM public.argument_machine_observation_results
    WHERE run_id = v_run AND raw_key = 'verify_rk_1' AND evidence_span = 'span one'
  ), 'CASE 1 FAILED: non-null evidence_span should persist verbatim';
  RAISE NOTICE 'CASE 1 PASS: success finalize inserted results, flipped run terminal, cleared lease.';

  -- ============================================================
  -- CASE 2 — DUPLICATE-SAFE.
  -- 2a: re-finalizing the SAME run (now succeeded, lease cleared) is a no-op
  --     (the ownership guard fails because state is no longer 'leased') →
  --     returns false, no extra result rows, no unique-constraint loop.
  -- 2b: a pre-existing (run_id, raw_key) row on a freshly-leased run does NOT
  --     cause a unique violation — ON CONFLICT (run_id, raw_key) DO NOTHING
  --     silently skips the duplicate and still finalizes the run.
  -- ============================================================
  -- 2a: repeat finalize on the already-succeeded run.
  v_ok := public.finalize_classifier_job(
    v_run, v_owner_a, 'succeeded', 'success', NULL, NULL, NULL,
    jsonb_build_array(
      jsonb_build_object('raw_key', 'verify_rk_1', 'family', 'verify_family_succ',
                         'confidence', 'high', 'evidence_span', 'span one')
    )
  );
  ASSERT v_ok = false,
    'CASE 2a FAILED: re-finalizing an already-terminal run (lease cleared) must be a no-op returning false';
  SELECT count(*) INTO v_result_count
  FROM public.argument_machine_observation_results WHERE run_id = v_run;
  ASSERT v_result_count = 2,
    format('CASE 2a FAILED: repeat finalize must not add result rows (still expect 2, got %s)', v_result_count);
  RAISE NOTICE 'CASE 2a PASS: repeat finalize on a terminal run is a no-op (no dup rows, no error).';

  -- 2b: a NEW leased run; pre-seed one of its (run_id, raw_key) rows, then
  -- finalize success with that same raw_key plus a new one. The pre-existing
  -- row survives unchanged; the new one is inserted; NO unique violation.
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, lease_owner, lease_expires_at,
     attempt_count, available_at, started_at)
  VALUES
    (v_arg, v_deb, 'verify_family_dup', v_mode, v_sv, ARRAY['verify_family_dup'],
     'leased', v_owner_a, now() + interval '120 seconds', 1, now(), now())
  RETURNING id INTO v_run2;

  INSERT INTO public.argument_machine_observation_results
    (run_id, debate_id, argument_id, schema_version, raw_key, family, confidence, evidence_span)
  VALUES
    (v_run2, v_deb, v_arg, v_sv, 'verify_rk_dup', 'verify_family_dup', 'low', 'pre-existing');

  v_ok := public.finalize_classifier_job(
    v_run2, v_owner_a, 'succeeded', 'success', NULL, NULL, NULL,
    jsonb_build_array(
      jsonb_build_object('raw_key', 'verify_rk_dup', 'family', 'verify_family_dup',
                         'confidence', 'high', 'evidence_span', 'attempted-overwrite'),
      jsonb_build_object('raw_key', 'verify_rk_new', 'family', 'verify_family_dup',
                         'confidence', 'high', 'evidence_span', 'fresh')
    )
  );
  ASSERT v_ok = true, 'CASE 2b FAILED: finalize with a pre-existing rawKey should still finalize (return true)';

  SELECT count(*) INTO v_result_count
  FROM public.argument_machine_observation_results WHERE run_id = v_run2;
  ASSERT v_result_count = 2,
    format('CASE 2b FAILED: expected 2 rows (1 pre-existing kept + 1 new), got %s', v_result_count);
  -- The pre-existing row's evidence_span is UNCHANGED (DO NOTHING does not overwrite).
  ASSERT EXISTS (
    SELECT 1 FROM public.argument_machine_observation_results
    WHERE run_id = v_run2 AND raw_key = 'verify_rk_dup' AND evidence_span = 'pre-existing'
  ), 'CASE 2b FAILED: ON CONFLICT DO NOTHING must NOT overwrite the pre-existing row';
  SELECT state INTO v_state FROM public.argument_machine_observation_runs WHERE id = v_run2;
  ASSERT v_state = 'succeeded', 'CASE 2b FAILED: run should still reach succeeded despite the conflict';
  RAISE NOTICE 'CASE 2b PASS: pre-existing (run_id,raw_key) → no unique violation, no overwrite, run finalized.';

  -- ============================================================
  -- CASE 3 — WRONG-OWNER no-op.
  -- A row leased by owner-a; owner-b attempts to finalize → returns false,
  -- no result rows, the run stays leased by owner-a (unchanged).
  -- ============================================================
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, lease_owner, lease_expires_at,
     attempt_count, available_at, started_at)
  VALUES
    (v_arg, v_deb, 'verify_family_wrong', v_mode, v_sv, ARRAY['verify_family_wrong'],
     'leased', v_owner_a, now() + interval '120 seconds', 1, now(), now())
  RETURNING id INTO v_run;

  v_ok := public.finalize_classifier_job(
    v_run, v_owner_b, 'succeeded', 'success', NULL, NULL, NULL,
    jsonb_build_array(
      jsonb_build_object('raw_key', 'verify_rk_x', 'family', 'verify_family_wrong',
                         'confidence', 'high', 'evidence_span', 'nope')
    )
  );
  ASSERT v_ok = false, 'CASE 3 FAILED: wrong-owner finalize must return false';

  SELECT state, lease_owner INTO v_state, v_lease_owner
  FROM public.argument_machine_observation_runs WHERE id = v_run;
  ASSERT v_state = 'leased',          'CASE 3 FAILED: run must stay leased after a wrong-owner no-op';
  ASSERT v_lease_owner = v_owner_a,   'CASE 3 FAILED: lease_owner must remain owner-a';
  SELECT count(*) INTO v_result_count
  FROM public.argument_machine_observation_results WHERE run_id = v_run;
  ASSERT v_result_count = 0, 'CASE 3 FAILED: wrong-owner finalize must insert no result rows';
  RAISE NOTICE 'CASE 3 PASS: wrong-owner finalize is a hard no-op (run untouched, no results).';

  -- ============================================================
  -- CASE 4 — STALE / RECLAIMED-OWNER no-op.
  -- The lease that owner-a held has been reclaimed: the row moved to
  -- 'retry_scheduled' and lease_owner was cleared (exactly what
  -- reclaim_stale_leases does to an expired lease below the cap). owner-a's
  -- belated finalize must NOT fire — state is no longer 'leased' → false,
  -- no results, the reclaimed state is preserved.
  -- ============================================================
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, lease_owner, lease_expires_at,
     attempt_count, available_at, started_at)
  VALUES
    (v_arg, v_deb, 'verify_family_stale', v_mode, v_sv, ARRAY['verify_family_stale'],
     'retry_scheduled', NULL, NULL, 1, now(), now())   -- already reclaimed: not leased, owner cleared
  RETURNING id INTO v_run;

  v_ok := public.finalize_classifier_job(
    v_run, v_owner_a, 'succeeded', 'success', NULL, NULL, NULL,
    jsonb_build_array(
      jsonb_build_object('raw_key', 'verify_rk_y', 'family', 'verify_family_stale',
                         'confidence', 'high', 'evidence_span', 'too late')
    )
  );
  ASSERT v_ok = false, 'CASE 4 FAILED: stale/reclaimed-owner finalize must return false';

  SELECT state INTO v_state
  FROM public.argument_machine_observation_runs WHERE id = v_run;
  ASSERT v_state = 'retry_scheduled',
    'CASE 4 FAILED: a reclaimed (retry_scheduled) row must be preserved, not finalized';
  SELECT count(*) INTO v_result_count
  FROM public.argument_machine_observation_results WHERE run_id = v_run;
  ASSERT v_result_count = 0, 'CASE 4 FAILED: stale-owner finalize must insert no result rows';
  RAISE NOTICE 'CASE 4 PASS: stale/reclaimed-owner finalize is a hard no-op (reclaimed state preserved).';

  -- ============================================================
  -- CASE 5 — TERMINAL FAILURE finalization.
  -- 5a: failed_terminal — run → state=failed_terminal / status=failed;
  --     failure_reason + failure_sub_reason recorded; dead_letter_reason
  --     NOT set; lease cleared; NO result rows; returns true.
  -- 5b: dead_letter — run → state=dead_letter; dead_letter_reason recorded.
  -- ============================================================
  -- 5a: failed_terminal.
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, lease_owner, lease_expires_at,
     attempt_count, available_at, started_at)
  VALUES
    (v_arg, v_deb, 'verify_family_fail', v_mode, v_sv, ARRAY['verify_family_fail'],
     'leased', v_owner_a, now() + interval '120 seconds', 2, now(), now())
  RETURNING id INTO v_run_fail;

  v_ok := public.finalize_classifier_job(
    v_run_fail, v_owner_a, 'failed_terminal', 'failed',
    'provider_server_error', 'provider_capacity_exhausted', NULL,
    NULL   -- no observations on a terminal failure
  );
  ASSERT v_ok = true, 'CASE 5a FAILED: terminal-failure finalize should return true';

  SELECT state, status, completed_at, failure_reason, failure_sub_reason,
         dead_letter_reason, lease_owner, lease_expires_at
    INTO v_state, v_status, v_completed, v_failure_reason, v_failure_sub,
         v_dead_reason, v_lease_owner, v_lease_exp
  FROM public.argument_machine_observation_runs WHERE id = v_run_fail;
  ASSERT v_state = 'failed_terminal',                'CASE 5a FAILED: state should be failed_terminal';
  ASSERT v_status = 'failed',                        'CASE 5a FAILED: status should be failed';
  ASSERT v_completed IS NOT NULL,                    'CASE 5a FAILED: completed_at should be set';
  ASSERT v_failure_reason = 'provider_server_error', 'CASE 5a FAILED: failure_reason not recorded';
  ASSERT v_failure_sub = 'provider_capacity_exhausted', 'CASE 5a FAILED: failure_sub_reason not recorded';
  ASSERT v_dead_reason IS NULL,                      'CASE 5a FAILED: dead_letter_reason must stay NULL for failed_terminal';
  ASSERT v_lease_owner IS NULL,                      'CASE 5a FAILED: lease_owner should be cleared';
  ASSERT v_lease_exp IS NULL,                        'CASE 5a FAILED: lease_expires_at should be cleared';
  SELECT count(*) INTO v_result_count
  FROM public.argument_machine_observation_results WHERE run_id = v_run_fail;
  ASSERT v_result_count = 0, 'CASE 5a FAILED: terminal failure must insert no result rows';
  RAISE NOTICE 'CASE 5a PASS: failed_terminal finalize set failure fields, no results, lease cleared.';

  -- 5b: dead_letter.
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, lease_owner, lease_expires_at,
     attempt_count, available_at, started_at)
  VALUES
    (v_arg, v_deb, 'verify_family_dead', v_mode, v_sv, ARRAY['verify_family_dead'],
     'leased', v_owner_a, now() + interval '120 seconds', 3, now(), now())
  RETURNING id INTO v_run_fail;

  v_ok := public.finalize_classifier_job(
    v_run_fail, v_owner_a, 'dead_letter', 'failed',
    'max_attempts_exhausted', 'provider_server_error', 'attempt_cap_reached_terminal',
    NULL
  );
  ASSERT v_ok = true, 'CASE 5b FAILED: dead_letter finalize should return true';

  SELECT state, dead_letter_reason INTO v_state, v_dead_reason
  FROM public.argument_machine_observation_runs WHERE id = v_run_fail;
  ASSERT v_state = 'dead_letter',                          'CASE 5b FAILED: state should be dead_letter';
  ASSERT v_dead_reason = 'attempt_cap_reached_terminal',   'CASE 5b FAILED: dead_letter_reason should be recorded';
  RAISE NOTICE 'CASE 5b PASS: dead_letter finalize set state + dead_letter_reason.';

  -- ============================================================
  -- CASE 6 — DIRECT-DISPATCH PATH UNCHANGED (SHAPE, not live).
  -- There is nothing to run here: this card adds ONLY the finalizer and does
  -- NOT modify supabase/functions/_shared/booleanObservations/
  -- persistenceWriter.ts. The existing direct-dispatch persistRun /
  -- persistResults INSERT path is byte-for-byte unchanged. That guarantee is
  -- asserted in the Jest suite (FIN-33/FIN-34 prove the finalizer's result
  -- column mapping is byte-identical to persistResults, which only holds if
  -- the writer is untouched). See
  -- __tests__/archOneCardTwoAFinalizerMigration.test.ts.
  -- ============================================================
  RAISE NOTICE 'CASE 6 NOTE (shape-only): persistenceWriter.ts direct-dispatch path is UNCHANGED — verified in Jest, not here.';

  RAISE NOTICE 'ARCH-001 Card 2A verification: ALL ASSERTIONS PASSED (rolled back)';
END $$;

-- Discard ALL fixture writes (the synthetic queue + result rows). The
-- verification leaves the database unchanged.
ROLLBACK;
