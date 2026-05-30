-- ============================================================
-- ARCH-001 Card 1 — OPERATOR POST-MERGE LIVE VERIFICATION
--
-- Run this AFTER the operator applies
--   supabase/migrations/20260528000021_arch_001_classifier_queue_substrate.sql
-- via `npx supabase db push --linked`.
--
-- Purpose: prove the 6 Card-1 behavioral cases (intent brief
-- §"Card-1 tests") against the APPLIED database. These assertions
-- genuinely need a live Postgres (partial-index unique violations,
-- FOR UPDATE SKIP LOCKED concurrency, the lease ON CONFLICT race) and
-- therefore CANNOT run in the deterministic Jest suite — Docker was
-- unavailable in the implementer environment, so the Jest suite asserts
-- the migration TEXT/SHAPE contract and this script asserts the RUNTIME
-- behavior. (See __tests__/archOneClassifierQueueSubstrateMigration.test.ts
-- and __tests__/archOneClassifierQueueFunctionsShape.test.ts.)
--
-- SAFETY: the auto-runnable section (A–E below) runs entirely inside one
-- transaction that ALWAYS ROLLS BACK. It fabricates NO new debate /
-- argument / profile rows — it reuses one existing (debate_id,
-- argument_id) pair and inserts only synthetic queue rows under a
-- synthetic family/schema_version, all discarded by the ROLLBACK. It
-- never deploys anything, never touches secrets, never disables RLS.
--
-- The two genuinely-concurrent cases (SKIP-LOCKED claim isolation; the
-- two-acquirer lease race) require TWO sessions and are provided as a
-- documented manual procedure in section F. Section C proves the
-- single-session claim semantics (due/not-due, no double-claim,
-- attempt bump) that do not require a second session.
--
-- HOW TO RUN (psql against the linked project):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f scripts/arch-001-card1-sql/verify-classifier-queue-substrate.sql
-- A clean run prints a series of NOTICE lines ending with
--   'ARCH-001 Card 1 verification: ALL ASSERTIONS PASSED (rolled back)'
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
  v_arg   uuid;
  v_deb   uuid;
  v_sv    text := 'arch-001-card1-verify';   -- synthetic schema_version (never collides with real rows)
  v_fam   text := 'verify_family_A';
  v_mode  text := 'production';
  v_id1   uuid;
  v_id2   uuid;
  v_claimed int;
  v_owner text;
  v_owner2 text;
  v_released int;
  v_reclaimed int;
  v_state text;
  v_status text;
  v_attempt int;
  v_threw boolean;
BEGIN
  SELECT a.id, a.debate_id INTO v_arg, v_deb
  FROM public.arguments a
  LIMIT 1;

  IF v_arg IS NULL THEN
    RAISE EXCEPTION 'ARCH-001 verify: no existing argument row to anchor the fixture; seed one argument then re-run.';
  END IF;
  RAISE NOTICE 'ARCH-001 verify: anchoring on existing argument % (debate %)', v_arg, v_deb;

  -- ============================================================
  -- CASE 6 (compatibility) — assert FIRST so the substrate sanity is
  -- proven before the other cases depend on it: a state='pending',
  -- status NULL row inserts with NO CHECK / NOT NULL / FK violation.
  -- ============================================================
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, available_at, started_at)
  VALUES
    (v_arg, v_deb, v_fam, v_mode, v_sv, ARRAY[v_fam], 'pending', now(), now())
  RETURNING id INTO v_id1;

  SELECT state, status INTO v_state, v_status
  FROM public.argument_machine_observation_runs WHERE id = v_id1;
  ASSERT v_state = 'pending', 'CASE 6 FAILED: pending row did not persist state=pending';
  ASSERT v_status IS NULL,    'CASE 6 FAILED: pending row should have NULL status';
  RAISE NOTICE 'CASE 6 PASS: pending row with NULL status inserted cleanly.';

  -- ============================================================
  -- CASE 2 (index #5 — one active job per cell)
  -- 2a: a second active job for the same cell raises a unique violation.
  -- 2b: enqueue_classifier_job ON CONFLICT DO NOTHING no-ops the active cell.
  -- ============================================================
  v_threw := false;
  BEGIN
    INSERT INTO public.argument_machine_observation_runs
      (argument_id, debate_id, family, run_mode, schema_version,
       requested_families, state, available_at, started_at)
    VALUES
      (v_arg, v_deb, v_fam, v_mode, v_sv, ARRAY[v_fam], 'pending', now(), now());
  EXCEPTION WHEN unique_violation THEN
    v_threw := true;
  END;
  ASSERT v_threw, 'CASE 2a FAILED: a SECOND active job for the cell did NOT raise unique_violation (index #5 missing/wrong predicate)';
  RAISE NOTICE 'CASE 2a PASS: second active job blocked by index #5.';

  -- 2b: the enqueue helper must be a no-op (RETURNING NULL) for an active cell.
  v_id2 := public.enqueue_classifier_job(v_arg, v_deb, v_fam, v_mode, v_sv);
  ASSERT v_id2 IS NULL, 'CASE 2b FAILED: enqueue_classifier_job for an active cell should DO NOTHING (return NULL)';
  RAISE NOTICE 'CASE 2b PASS: enqueue_classifier_job no-ops an active cell.';

  -- ============================================================
  -- CASE 1 (index #4 — one success per cell)
  -- 1a: transition the active row to succeeded, then a SECOND succeeded
  --     row for the cell raises a unique violation.
  -- 1b: a failed_terminal row + a later succeeded row is allowed.
  -- ============================================================
  UPDATE public.argument_machine_observation_runs
     SET state = 'succeeded', status = 'success', completed_at = now()
   WHERE id = v_id1;

  v_threw := false;
  BEGIN
    INSERT INTO public.argument_machine_observation_runs
      (argument_id, debate_id, family, run_mode, schema_version,
       requested_families, state, status, available_at, started_at, completed_at)
    VALUES
      (v_arg, v_deb, v_fam, v_mode, v_sv, ARRAY[v_fam], 'succeeded', 'success', now(), now(), now());
  EXCEPTION WHEN unique_violation THEN
    v_threw := true;
  END;
  ASSERT v_threw, 'CASE 1a FAILED: a SECOND succeeded row for the cell did NOT raise unique_violation (index #4 missing/wrong predicate)';
  RAISE NOTICE 'CASE 1a PASS: second succeeded row blocked by index #4.';

  -- 1b: a different cell (family B) — a failed_terminal then a later
  -- succeeded row coexist (failed row is outside index #4).
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, status, available_at, started_at, completed_at)
  VALUES
    (v_arg, v_deb, 'verify_family_B', v_mode, v_sv, ARRAY['verify_family_B'],
     'failed_terminal', 'failed', now(), now(), now());
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, status, available_at, started_at, completed_at)
  VALUES
    (v_arg, v_deb, 'verify_family_B', v_mode, v_sv, ARRAY['verify_family_B'],
     'succeeded', 'success', now(), now(), now());
  RAISE NOTICE 'CASE 1b PASS: failed_terminal + later succeeded coexist for one cell.';

  -- ============================================================
  -- CASE 3 (claim_classifier_jobs — single-session semantics)
  -- 3a: a due pending row is claimed and bumped to leased + attempt_count 1.
  -- 3b: a NOT-yet-due row (available_at in the future) is NOT claimed.
  -- (3c SKIP-LOCKED isolation requires two sessions — see section F.)
  -- ============================================================
  -- family C: one due pending row, one future pending row.
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, available_at, started_at)
  VALUES
    (v_arg, v_deb, 'verify_family_C_due', v_mode, v_sv, ARRAY['verify_family_C_due'],
     'pending', now() - interval '1 minute', now());
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, available_at, started_at)
  VALUES
    (v_arg, v_deb, 'verify_family_C_future', v_mode, v_sv, ARRAY['verify_family_C_future'],
     'pending', now() + interval '1 hour', now());

  SELECT count(*) INTO v_claimed
  FROM public.claim_classifier_jobs(10, 'verify-owner-1', interval '120 seconds') c
  WHERE c.family LIKE 'verify_family_C%';
  ASSERT v_claimed = 1,
    format('CASE 3 FAILED: expected to claim exactly 1 due row, claimed %s', v_claimed);

  SELECT state, attempt_count INTO v_state, v_attempt
  FROM public.argument_machine_observation_runs
  WHERE family = 'verify_family_C_due' AND schema_version = v_sv;
  ASSERT v_state = 'leased',      'CASE 3 FAILED: due row not transitioned to leased';
  ASSERT v_attempt = 1,           'CASE 3 FAILED: attempt_count not bumped to 1 on claim';

  SELECT state INTO v_state
  FROM public.argument_machine_observation_runs
  WHERE family = 'verify_family_C_future' AND schema_version = v_sv;
  ASSERT v_state = 'pending',     'CASE 3 FAILED: future-available_at row should NOT be claimed';
  RAISE NOTICE 'CASE 3 PASS: claim claims the due row (leased, attempt=1), leaves the future row pending.';

  -- ============================================================
  -- CASE 5 (reclaim_stale_leases)
  -- 5a: an expired leased row below the cap → retry_scheduled.
  -- 5b: an expired leased row AT the cap (attempt_count 3) → dead_letter.
  -- ============================================================
  -- Force the family_C_due leased row to be expired, attempt below cap.
  UPDATE public.argument_machine_observation_runs
     SET lease_expires_at = now() - interval '1 second', attempt_count = 1
   WHERE family = 'verify_family_C_due' AND schema_version = v_sv;

  -- A second leased row at the cap (attempt_count 3), expired.
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, attempt_count, lease_expires_at, available_at, started_at)
  VALUES
    (v_arg, v_deb, 'verify_family_D_cap', v_mode, v_sv, ARRAY['verify_family_D_cap'],
     'leased', 3, now() - interval '1 second', now(), now());

  SELECT public.reclaim_stale_leases() INTO v_reclaimed;
  ASSERT v_reclaimed >= 2,
    format('CASE 5 FAILED: expected to reclaim >= 2 expired leased rows, reclaimed %s', v_reclaimed);

  SELECT state INTO v_state
  FROM public.argument_machine_observation_runs
  WHERE family = 'verify_family_C_due' AND schema_version = v_sv;
  ASSERT v_state = 'retry_scheduled',
    'CASE 5a FAILED: expired leased row below cap should become retry_scheduled';

  SELECT state INTO v_state
  FROM public.argument_machine_observation_runs
  WHERE family = 'verify_family_D_cap' AND schema_version = v_sv;
  ASSERT v_state = 'dead_letter',
    'CASE 5b FAILED: expired leased row AT the attempt cap should become dead_letter';
  RAISE NOTICE 'CASE 5 PASS: reclaim moves below-cap→retry_scheduled and at-cap→dead_letter.';

  -- ============================================================
  -- CASE 4 (drain lease — single-session semantics)
  -- 4a: acquire returns its own owner; a second acquire while live → NULL.
  -- 4b: an expired lease is stealable.
  -- 4c: release deletes only the OWN lease.
  -- (The two-acquirer RACE requires two sessions — see section F.)
  -- ============================================================
  v_owner := public.acquire_drain_lease('verify-lease-owner-1', interval '120 seconds');
  ASSERT v_owner = 'verify-lease-owner-1',
    'CASE 4a FAILED: first acquire should return its own owner';

  v_owner2 := public.acquire_drain_lease('verify-lease-owner-2', interval '120 seconds');
  ASSERT v_owner2 IS NULL,
    'CASE 4a FAILED: a second acquire while a LIVE lease is held should return NULL';
  RAISE NOTICE 'CASE 4a PASS: live lease blocks a second acquirer (single-flight).';

  -- 4b: force-expire the lease, then a new owner can steal it.
  UPDATE public.classifier_drain_lock
     SET expires_at = now() - interval '1 second'
   WHERE lock_key = 'classifier_drain';
  v_owner2 := public.acquire_drain_lease('verify-lease-owner-2', interval '120 seconds');
  ASSERT v_owner2 = 'verify-lease-owner-2',
    'CASE 4b FAILED: an EXPIRED lease should be stealable by a new owner';
  RAISE NOTICE 'CASE 4b PASS: expired lease is stealable.';

  -- 4c: release by a NON-owner deletes nothing; release by the owner deletes 1.
  v_released := public.release_drain_lease('verify-lease-owner-1');   -- not current owner
  ASSERT v_released = 0,
    'CASE 4c FAILED: release by a non-owner should delete 0 rows';
  v_released := public.release_drain_lease('verify-lease-owner-2');   -- current owner
  ASSERT v_released = 1,
    'CASE 4c FAILED: release by the owner should delete exactly 1 row';
  RAISE NOTICE 'CASE 4c PASS: release deletes only the own lease.';

  RAISE NOTICE 'ARCH-001 Card 1 verification: ALL ASSERTIONS PASSED (rolled back)';
END $$;

-- Discard ALL fixture writes (including the synthetic queue rows and the
-- lease/audit rows). The verification leaves the database unchanged.
ROLLBACK;

-- ============================================================
-- Section F — TWO-SESSION concurrency procedure (manual; cannot run in
-- a single transaction because SKIP LOCKED / the lease race need two
-- concurrent backends).
--
-- F1 — claim_classifier_jobs SKIP-LOCKED isolation:
--   Session 1:  BEGIN;
--               SELECT * FROM public.claim_classifier_jobs(1, 'owner-1', interval '120 seconds');
--               -- leave the txn OPEN (the claimed row's lock is held)
--   Session 2:  SELECT * FROM public.claim_classifier_jobs(1, 'owner-2', interval '120 seconds');
--               -- EXPECT: session 2 does NOT return the row session 1 locked;
--               --         it returns the NEXT due row (or zero rows). No double-claim.
--   Session 1:  ROLLBACK;   -- (or COMMIT, then clean up the synthetic rows)
--   (Use synthetic family/schema_version rows you insert + delete yourself,
--    OR run inside a shared scratch debate; never leave synthetic rows behind.)
--
-- F2 — acquire_drain_lease two-acquirer race:
--   Ensure no live lease:  DELETE FROM public.classifier_drain_lock WHERE lock_key='classifier_drain';
--   Run from two sessions as simultaneously as possible:
--     SELECT public.acquire_drain_lease('race-owner-A', interval '120 seconds');
--     SELECT public.acquire_drain_lease('race-owner-B', interval '120 seconds');
--   EXPECT: exactly ONE session returns its own owner; the other returns NULL.
--   Cleanup:  SELECT public.release_drain_lease(<the winner>);  -- or DELETE the lock row.
--
-- These two are the defence-in-depth proofs (design §A.4): SKIP LOCKED
-- guarantees no two drainers claim the same job row, and the conditional
-- ON CONFLICT WHERE expires_at < now() guarantees at most one acquirer
-- wins a live lease.
-- ============================================================
