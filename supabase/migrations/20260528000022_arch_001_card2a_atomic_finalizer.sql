-- ============================================================
-- Migration: 20260528000022_arch_001_card2a_atomic_finalizer
-- Description: ARCH-001 Card 2A — ATOMIC QUEUE FINALIZER (one new SQL
--   function, nothing else). Adds public.finalize_classifier_job(...),
--   the single DB call the Card-2 drainer makes to finalize ONE claimed
--   classifier job: it INSERTs the per-observation result rows AND flips
--   the run row to its terminal state in ONE transaction (a plpgsql
--   function body is one implicit transaction).
--
--   This CORRECTS the non-atomic finalization plan in parent design §A.3
--   "Transaction / upsert strategy" (lines 313-315): that plan called for
--   the existing persistResults() PostgREST INSERT FOLLOWED BY a separate
--   `UPDATE …runs` — TWO independent PostgREST statements that cannot share
--   one transaction (I13: the Supabase JS client issues independent HTTP
--   statements). Because the queue reuses ONE run_id across retries and the
--   results table carries CONSTRAINT amor_unique_run_rawkey UNIQUE
--   (run_id, raw_key), the failure window (results written → run-UPDATE
--   fails → lease expires → reclaim → retry → re-INSERT) hits that unique
--   constraint → errors → loops toward dead_letter, dead-lettering a
--   genuinely-succeeded cell. This finalizer eliminates that window:
--   result-INSERT + run-UPDATE are one atomic unit, and the INSERT is
--   ON CONFLICT (run_id, raw_key) DO NOTHING so a retried finalize is a
--   harmless no-op rather than a unique-violation loop.
--
-- Card: ARCH-001 Card 2A
--   - Intent brief (authoritative scope + the resolved blocker + the
--     function spec + semantics + the 6 test cases):
--     docs/designs/ARCH-001-CARD2A-ATOMIC-FINALIZER-intent.md
--   - Parent design (finalization context this card corrects):
--     docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md
--     §A.3 "Transaction / upsert strategy (atomicity PROOF for Option 2)".
-- Predecessor migrations:
--   - 20260526000018_mcp_021b_machine_observation_results.sql
--     (CREATE argument_machine_observation_runs + ...results; the
--      finalized result-row columns are run_id, debate_id, argument_id,
--      schema_version, raw_key, family, confidence, evidence_span; and the
--      named non-partial constraint amor_unique_run_rawkey UNIQUE
--      (run_id, raw_key)).
--   - 20260528000021_arch_001_classifier_queue_substrate.sql
--     (Card 1: added the queue lifecycle columns this finalizer reads/writes
--      — state, status (NOT NULL dropped), completed_at, lease_owner,
--      lease_expires_at, failure_reason, failure_sub_reason,
--      dead_letter_reason. Card 1 shipped claim/lease/reclaim/release/
--      enqueue but NO finalize function. This file sorts AFTER it.)
--
-- ── OPERATOR GATE ──────────────────────────────────────────────
-- This migration is WRITTEN, NOT APPLIED. The operator applies it via
-- `npx supabase db push --linked` AFTER merge, then runs
-- scripts/arch-001-card2a-sql/verify-finalize-classifier-job.sql to prove
-- the 6 behavioral cases. Card 2 (drainer/enqueue) does NOT resume until
-- THIS card is merged + applied + verified (intent brief §Gate).
--
-- ── Scope (intent brief §SCOPE — MIGRATION ONLY) ───────────────
-- ONE new SQL function. NO new table, NO column change, NO index change
-- (Card 1's partial unique indexes #4/#5 already enforce single-success +
-- single-active). NO drainer/enqueue code, NO routing/flag, NO
-- autoTriggerDispatcher.ts change, NO persistenceWriter.ts change (the
-- direct-dispatch persistRun/persistResults path is UNCHANGED), NO
-- MCP-server change, NO Family H, NO prompt/taxonomy/family-key/
-- schema-mirror/Source-6/production-flag/audit-lint/package.json change.
--
-- ── Atomicity (the load-bearing correctness point) ─────────────
-- A plpgsql function body executes inside the caller's transaction as one
-- atomic unit (no statement-level autocommit between its statements).
-- This function contains NO `COMMIT`, NO `ROLLBACK`, NO autonomous-
-- transaction pragma, NO `dblink` / `pg_background` self-call. Therefore
-- the result-row INSERT and the run-row UPDATE either BOTH apply or BOTH
-- roll back. The reviewer's mechanical check (comment-stripped body):
--   must contain ZERO of: COMMIT | ROLLBACK | autonomous | dblink |
--   pg_background | SAVEPOINT.
--
-- ── Doctrine encoded ───────────────────────────────────────────
--   - cdiscourse-doctrine §6: NO secret literal anywhere. lease_owner /
--     p_owner hold opaque drainer invocation ids, never a secret.
--   - cdiscourse-doctrine §8: SECURITY INVOKER (matches the Card-1 queue
--     functions). The drainer calls via service-role, which already
--     bypasses RLS — no SECURITY DEFINER privilege-escalation surface is
--     introduced. RLS on both tables is UNCHANGED; no policy is touched.
--   - cdiscourse-doctrine §1/§10a: failure_reason / failure_sub_reason /
--     dead_letter_reason are TYPED operational reasons mirroring the
--     existing BooleanObservationFailureSubreason vocabulary — never a raw
--     provider body, prompt, or verdict about a participant.
--
-- ── OPS-001 §4 four-class posture ──────────────────────────────
--   Class 1 — Ambiguous column references: the ownership-guard SELECT and
--     both UPDATEs fully-qualify the target table
--     (public.argument_machine_observation_runs). The result INSERT names
--     every target column explicitly and sources the SELECT columns from
--     the locked run row's variables (no bare ambiguous reference). The
--     jsonb expansion aliases its derived columns (obs.raw_key, etc.) and
--     the constant run-row columns come from PL/pgSQL locals, so no column
--     name is ambiguous between the jsonb rowset and the runs row.
--   Class 2 — Column type mismatches: p_run_id uuid (matches runs.id);
--     p_owner/p_terminal_state/p_status/p_failure_reason/
--     p_failure_sub_reason/p_dead_letter_reason are text (match their
--     columns); p_observations is jsonb. The result-row columns are cast
--     to match the results table: confidence is text (CHECK low/medium/
--     high lives on the table), evidence_span is text, family is text.
--   Class 3 — Implicit ordering dependencies: the ownership guard (SELECT
--     … FOR UPDATE) runs BEFORE any write; for success the result INSERT
--     runs BEFORE the run-row UPDATE (both inside the one transaction, so
--     ordering is for readability, not correctness — they commit atomically
--     together). The function is created AFTER all columns/constraints it
--     references (predecessor migrations above); the COMMENT comes last.
--   Class 4 — Function / extension dependencies: uses only core SQL
--     (now(), jsonb_to_recordset, INSERT … ON CONFLICT, UPDATE). No
--     extension dependency beyond what predecessors already require. NO
--     `COMMENT ON … storage.*` (PR-003 SQLSTATE 42501 boundary preserved).
--
-- ── No client write path ───────────────────────────────────────
-- ZERO `CREATE POLICY` / `ALTER TABLE … ENABLE ROW LEVEL SECURITY` /
-- `CREATE TABLE` / `ALTER COLUMN` / `CREATE INDEX` in this migration. The
-- reviewer's mechanical check:
--   grep -E "CREATE POLICY|CREATE TABLE|CREATE INDEX|ADD COLUMN|ALTER COLUMN" \
--     supabase/migrations/20260528000022_*.sql
-- must return zero matches (this migration ships ONE function + ONE COMMENT).
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- finalize_classifier_job — atomic success / terminal-failure finalize
-- ════════════════════════════════════════════════════════════
-- Called ONCE by the Card-2 drainer per claimed job, after the classify
-- call returns. Success path inserts the per-observation result rows and
-- flips the run row to succeeded/success; terminal-failure path writes no
-- result rows and flips the run row to failed_terminal/dead_letter with
-- the typed failure fields. Both paths clear the lease.
--
-- Retry scheduling (retry_scheduled) is NOT this function — that stays a
-- run-row-only UPDATE in the Card-2 drainer (it sets available_at /
-- attempt_count and writes no result rows). This finalizer is ONLY for the
-- two TERMINAL outcomes: success + terminal failure.
--
-- Returns boolean:
--   true  = the caller owned the live lease and the job was finalized.
--   false = stale / wrong owner (state no longer 'leased' by p_owner) →
--           NO results inserted, NOTHING updated (a hard no-op). A drainer
--           whose lease expired or was reclaimed MUST NOT finalize.
CREATE OR REPLACE FUNCTION public.finalize_classifier_job(
  p_run_id             uuid,
  p_owner              text,    -- caller's lease_owner; MUST match the live lease or it is a no-op
  p_terminal_state     text,    -- 'succeeded' | 'failed_terminal' | 'dead_letter'
  p_status             text,    -- 'success' | 'failed' (compatibility terminal-outcome status)
  p_failure_reason     text,    -- nullable (terminal failure only)
  p_failure_sub_reason text,    -- nullable (terminal failure only)
  p_dead_letter_reason text,    -- nullable (set on the run row only when p_terminal_state='dead_letter')
  p_observations       jsonb    -- [{raw_key,family,confidence,evidence_span}] for success; [] / null for failure
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  -- Locked run-row context: the result rows read debate_id / argument_id /
  -- schema_version FROM the locked run row (the drainer never passes them),
  -- so the finalized result rows ALWAYS match the run row's own identity.
  v_debate_id      uuid;
  v_argument_id    uuid;
  v_schema_version text;
BEGIN
  -- ── Validate the terminal state FIRST (before any lock/write) ──
  -- Only the three TERMINAL states this finalizer is responsible for are
  -- allowed. retry_scheduled / pending / leased are NOT finalizations and
  -- must never be written here — an invalid value raises rather than
  -- silently corrupting the run lifecycle.
  IF p_terminal_state NOT IN ('succeeded', 'failed_terminal', 'dead_letter') THEN
    RAISE EXCEPTION
      'finalize_classifier_job: invalid p_terminal_state %, expected succeeded | failed_terminal | dead_letter',
      p_terminal_state;
  END IF;

  -- ── Ownership guard FIRST, before any write ──────────────────
  -- Lock the run row and verify the CALLER still owns the LIVE lease. The
  -- guard requires BOTH lease_owner = p_owner AND state = 'leased'. If the
  -- lease expired and was reclaimed (state moved to retry_scheduled /
  -- dead_letter, or lease_owner was cleared / changed to another drainer),
  -- this SELECT finds no row and the function returns false WITHOUT writing
  -- anything. FOR UPDATE holds the row lock for the rest of this
  -- transaction so a concurrent reclaim cannot race the finalize.
  SELECT r.debate_id, r.argument_id, r.schema_version
    INTO v_debate_id, v_argument_id, v_schema_version
    FROM public.argument_machine_observation_runs r
   WHERE r.id = p_run_id
     AND r.lease_owner = p_owner
     AND r.state = 'leased'
   FOR UPDATE;

  IF NOT FOUND THEN
    -- Stale lease, wrong owner, or already-terminal run → hard no-op.
    RETURN false;
  END IF;

  -- ── SUCCESS path ─────────────────────────────────────────────
  IF p_terminal_state = 'succeeded' THEN
    -- INSERT the per-observation result rows. Column mapping MIRRORS
    -- persistenceWriter.ts persistResults EXACTLY:
    --   run_id, debate_id, argument_id, schema_version, raw_key, family,
    --   confidence, evidence_span
    -- debate_id / argument_id / schema_version come from the locked run row
    -- (the run's own identity); raw_key / family / confidence / evidence_span
    -- come from each p_observations element. evidence_span is nullable and
    -- preserved as-is (same null handling as persistResults, which passes
    -- r.evidenceSpan straight through). When p_observations is NULL or [],
    -- jsonb_to_recordset yields zero rows and no result rows are inserted —
    -- a succeeded run with zero positive observations is valid (Source 6
    -- renders nothing), exactly as the direct-dispatch path allows.
    --
    -- ON CONFLICT (run_id, raw_key) DO NOTHING — explicit COLUMN INFERENCE
    -- against the columns of the named non-partial unique constraint
    -- amor_unique_run_rawkey UNIQUE (run_id, raw_key). Inference (not
    -- ON CONFLICT ON CONSTRAINT) is correct and preferred per the intent
    -- brief. This is what makes a retried finalize duplicate-SAFE: a repeat
    -- call (or a pre-existing (run_id, raw_key) row) inserts no duplicate and
    -- raises no unique violation, so the finalize never loops toward
    -- dead_letter on a genuinely-succeeded cell.
    INSERT INTO public.argument_machine_observation_results
      (run_id, debate_id, argument_id, schema_version, raw_key, family,
       confidence, evidence_span)
    SELECT
      p_run_id,
      v_debate_id,
      v_argument_id,
      v_schema_version,
      obs.raw_key,
      obs.family,
      obs.confidence,
      obs.evidence_span
    FROM jsonb_to_recordset(COALESCE(p_observations, '[]'::jsonb))
      AS obs(raw_key text, family text, confidence text, evidence_span text)
    ON CONFLICT (run_id, raw_key) DO NOTHING;

    -- Flip the run row to its terminal success state and clear the lease.
    -- status (the MCP-021B terminal-outcome field) is set to the
    -- caller-supplied compatibility value (expected 'success'). completed_at
    -- timestamps the finalize. Index #4 (amor_one_success_per_cell_idx)
    -- enforces single-success at the DB level.
    UPDATE public.argument_machine_observation_runs
       SET state            = 'succeeded',
           status           = p_status,
           completed_at     = now(),
           lease_owner      = NULL,
           lease_expires_at = NULL
     WHERE id = p_run_id;

    RETURN true;
  END IF;

  -- ── TERMINAL FAILURE path (failed_terminal | dead_letter) ────
  -- No result rows are written for a terminal failure. The typed failure
  -- fields are recorded; dead_letter_reason is set ONLY when the terminal
  -- state is dead_letter (a failed_terminal run leaves dead_letter_reason
  -- untouched). The lease is cleared. failure_reason / failure_sub_reason
  -- carry the typed operational reason (cdiscourse-doctrine §1/§6 — never a
  -- raw provider body or a verdict about a participant).
  UPDATE public.argument_machine_observation_runs
     SET state              = p_terminal_state,
         status             = p_status,
         completed_at       = now(),
         failure_reason     = p_failure_reason,
         failure_sub_reason = p_failure_sub_reason,
         dead_letter_reason = CASE
                                WHEN p_terminal_state = 'dead_letter'
                                  THEN p_dead_letter_reason
                                ELSE dead_letter_reason
                              END,
         lease_owner        = NULL,
         lease_expires_at   = NULL
   WHERE id = p_run_id;

  RETURN true;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- COMMENT (NO storage.* target — PR-003 SQLSTATE 42501 boundary)
-- ════════════════════════════════════════════════════════════

COMMENT ON FUNCTION public.finalize_classifier_job(uuid, text, text, text, text, text, text, jsonb) IS
  'ARCH-001 Card 2A: ATOMIC finalize of one claimed classifier job. In ONE '
  'transaction (plpgsql body; no COMMIT / autonomous txn inside): ownership '
  'guard FIRST (lease_owner = p_owner AND state = ''leased'' FOR UPDATE; '
  'returns false as a hard no-op for a stale / wrong / reclaimed owner — no '
  'result rows, no run UPDATE), then on success INSERTs the result rows '
  '(mirroring persistResults'' column mapping; ON CONFLICT (run_id, raw_key) '
  'DO NOTHING via column inference against amor_unique_run_rawkey — '
  'duplicate-safe on retry) and flips the run to succeeded/success, or on '
  'terminal failure (failed_terminal | dead_letter) flips the run with the '
  'typed failure fields and no result rows. Always clears the lease; sets '
  'completed_at. Retry scheduling (retry_scheduled) is NOT this function. '
  'SECURITY INVOKER (drainer calls via service-role). CORRECTS parent design '
  '§A.3''s two non-atomic PostgREST calls. cdiscourse-doctrine §1/§6/§8.';
