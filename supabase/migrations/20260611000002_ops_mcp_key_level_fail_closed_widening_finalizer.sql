-- ============================================================
-- Migration: 20260611000002_ops_mcp_key_level_fail_closed_widening_finalizer
-- Description: OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING — re-create
--   public.finalize_classifier_job with ONE additive trailing parameter
--   `p_dropped_unclean_span_keys text[] DEFAULT NULL`, written to the
--   `dropped_unclean_span_keys` column on the SUCCESS branch only.
--
--   WHY: the J-only key-level fail-closed ship (20260611000001) added the
--   `dropped_unclean_span_keys text[]` column and wired the DIRECT-dispatch
--   path (classifyArgumentCore -> persistRun) to write it. Family J is
--   admin-validation-only and uses the direct path, so the queue drainer's
--   finalizer did NOT need the column. This WIDENING enables key-level
--   fail-closed for the PRODUCTION families (A–I), which run through the queue
--   drainer (claim_classifier_jobs -> classify -> finalize_classifier_job), NOT
--   the direct path. The drainer's SUCCESS finalize must therefore be able to
--   persist the same leak-safe drop-name list. This migration re-creates the
--   finalizer to accept + write it on the SUCCESS branch.
--
--   ONE SQL change, nothing else:
--     (E) DROP the 9-arg public.finalize_classifier_job(...) (the
--         OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE shape) and re-create it
--         with a trailing `p_dropped_unclean_span_keys text[] DEFAULT NULL`
--         parameter; the SUCCESS-branch UPDATE gains exactly one assignment
--         (dropped_unclean_span_keys = p_dropped_unclean_span_keys). EVERYTHING
--         ELSE — the ownership guard, the result-INSERT, the TERMINAL-FAILURE
--         UPDATE (incl. failure_detail = p_failure_detail), atomicity — is
--         BYTE-EQUAL to 20260602000001.
--     + an updated COMMENT ON FUNCTION (10-arg signature).
--
--   NO new column (dropped_unclean_span_keys already exists from
--   20260611000001). NO ALTER TABLE. NO backfill. NO RLS / policy / index /
--   table / extension change.
--
-- Card: OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING
--   - Design (authoritative scope + omission semantics + the A–I widening
--     deferral this card lifts): docs/designs/OPS-MCP-KEY-LEVEL-FAIL-CLOSED.md
--     (§"Scope decision" + §"Out of scope: A–I key-level drop" + the appended
--     widening section).
-- Predecessor migrations:
--   - 20260526000018_mcp_021b_machine_observation_results.sql
--     (CREATE argument_machine_observation_runs + ...results).
--   - 20260528000022_arch_001_card2a_atomic_finalizer.sql
--     (Card 2A: the original 8-arg public.finalize_classifier_job. NEVER edited;
--      its 8-arg shape test stays green against it.)
--   - 20260602000001_ops_mcp_classifier_failure_detail.sql
--     (the 9-arg finalizer this migration re-creates with ONE extra trailing
--      param. That file is NEVER edited; its 9-arg shape test stays green
--      against it. This migration's SUCCESS branch + TERMINAL-FAILURE branch are
--      copied FAITHFULLY from it — the ONLY delta is the new param + the one new
--      SUCCESS-branch SET dropped_unclean_span_keys = p_dropped_unclean_span_keys.)
--   - 20260611000001_ops_mcp_key_level_fail_closed_dropped_keys.sql
--     (added the `dropped_unclean_span_keys text[]` column + COMMENT this
--      finalizer now writes. NEVER edited.)
--
-- ── OPERATOR GATE ──────────────────────────────────────────────
-- This migration is WRITTEN, NOT APPLIED. The operator applies it via
-- `npx supabase db push --linked` BEFORE merging the Edge/drainer code that
-- calls the 10-arg finalizer (the Supabase GitHub integration auto-applies
-- migrations + auto-redeploys Edge Functions on merge to main; the new drainer
-- success path calls finalize_classifier_job with p_dropped_unclean_span_keys,
-- so the 10-arg overload MUST exist first or a success finalize that supplies
-- the 10th param would resolve to no function). Apply from the feature branch
-- (or land a migration-only PR first), verify the 10-arg overload exists, THEN
-- merge. Heightened reviewer verification applies (migration-bearing).
--
-- ── Backward compatibility (the verifier + any 8/9-arg caller) ─
-- The new trailing parameter is `p_dropped_unclean_span_keys text[] DEFAULT
-- NULL`, and the old 9-arg overload is DROPPED, so EXACTLY ONE
-- finalize_classifier_job exists. An existing 8-arg caller
-- (scripts/arch-001-card2a-sql/verify-finalize-classifier-job.sql) OR an
-- existing 9-arg caller resolves to the 10-arg function with the trailing
-- params defaulting to NULL, so it keeps working WITHOUT edits (a
-- succeeded/terminal finalize that omits the 10th param records
-- dropped_unclean_span_keys = NULL on the SUCCESS branch and NULL elsewhere,
-- exactly as before this card).
--
-- ── Atomicity (UNCHANGED from 20260602000001 / Card 2A) ────────
-- The function body is one implicit transaction; it contains NO COMMIT,
-- ROLLBACK, SAVEPOINT, autonomous-transaction pragma, dblink, or pg_background.
-- The ownership guard (SELECT ... FOR UPDATE; lease_owner = p_owner AND
-- state = 'leased') runs FIRST and returns false as a hard no-op for a stale /
-- wrong / reclaimed owner — NO results inserted, NO run UPDATE, so the new
-- dropped_unclean_span_keys write rides the same guard (written iff the
-- existing success UPDATE is written). All of this is byte-equal to
-- 20260602000001 except the one new param + the one new SUCCESS-branch SET.
--
-- ── Doctrine encoded ───────────────────────────────────────────
--   - cdiscourse-doctrine §1/§10a: dropped_unclean_span_keys carries rawKey
--     NAMES only (e.g. 'needs_pre_send_pause', 'introduces_new_issue') — never a
--     span, never a body, never a verdict about a participant. Omission asserts
--     nothing; no fabricated finding. The drop is fail-CLOSED validation at the
--     key scope; the drop-RATE alert is advisory and never gates.
--   - cdiscourse-doctrine §3: a drop never grants standing; popularity / satire
--     semantics are untouched.
--   - cdiscourse-doctrine §6: NO secret literal anywhere in this migration.
--   - cdiscourse-doctrine §8: SECURITY INVOKER (matches 20260602000001 + Card 2A
--     + the Card-1 queue functions); RLS UNCHANGED; never edits an applied
--     migration; no hard delete.
--
-- ── OPS-001 §4 four-class posture ──────────────────────────────
--   Class 1 — Ambiguous column references: the guard SELECT + both UPDATEs
--     fully-qualify / source from the locked run row's locals (unchanged from
--     20260602000001); the new SET dropped_unclean_span_keys =
--     p_dropped_unclean_span_keys references the parameter, not an ambiguous
--     column.
--   Class 2 — Column type mismatches: p_dropped_unclean_span_keys text[] matches
--     the existing dropped_unclean_span_keys text[] column exactly (added by
--     20260611000001). All other params are byte-equal to 20260602000001.
--   Class 3 — Implicit ordering dependencies: the DROP of the old 9-arg overload
--     precedes the CREATE OR REPLACE of the 10-arg; the COMMENT comes last. No
--     ALTER TABLE in this migration (the column already exists), so there is no
--     column-before-function ordering surface.
--   Class 4 — Function / extension dependencies: core SQL only (now(),
--     jsonb_to_recordset, INSERT ... ON CONFLICT, UPDATE). NO
--     `COMMENT ON ... storage.*` (PR-003 SQLSTATE 42501 boundary). NO extension
--     required.
--
-- ── No client write path ───────────────────────────────────────
-- ZERO `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY` / `CREATE TABLE` /
-- `CREATE INDEX` / `ALTER TABLE` / backfill `UPDATE`. This migration ships ONE
-- function re-create + ONE COMMENT ON FUNCTION.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- (E) Re-create finalize_classifier_job with the trailing
--     p_dropped_unclean_span_keys text[] DEFAULT NULL.
-- ════════════════════════════════════════════════════════════
-- Postgres treats finalize_classifier_job(9 args) and (10 args) as DISTINCT
-- functions, so the old 9-arg overload is DROPPED first; otherwise both would
-- coexist. The new param is trailing + DEFAULT NULL for 8/9-arg-caller
-- compatibility (see "Backward compatibility" above).
DROP FUNCTION IF EXISTS public.finalize_classifier_job(
  uuid, text, text, text, text, text, text, jsonb, jsonb
);

CREATE OR REPLACE FUNCTION public.finalize_classifier_job(
  p_run_id                    uuid,
  p_owner                     text,    -- caller's lease_owner; MUST match the live lease or it is a no-op
  p_terminal_state            text,    -- 'succeeded' | 'failed_terminal' | 'dead_letter'
  p_status                    text,    -- 'success' | 'failed' (compatibility terminal-outcome status)
  p_failure_reason            text,    -- nullable (terminal failure only)
  p_failure_sub_reason        text,    -- nullable (terminal failure only)
  p_dead_letter_reason        text,    -- nullable (set on the run row only when p_terminal_state='dead_letter')
  p_observations              jsonb,   -- [{raw_key,family,confidence,evidence_span}] for success; [] / null for failure
  p_failure_detail            jsonb DEFAULT NULL,    -- leak-safe diagnostic object; NULL on success + when omitted
  p_dropped_unclean_span_keys text[] DEFAULT NULL    -- NEW: leak-safe rawKey NAMES dropped by key-level fail-closed; written on SUCCESS only; NULL otherwise
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
  IF p_terminal_state NOT IN ('succeeded', 'failed_terminal', 'dead_letter') THEN
    RAISE EXCEPTION
      'finalize_classifier_job: invalid p_terminal_state %, expected succeeded | failed_terminal | dead_letter',
      p_terminal_state;
  END IF;

  -- ── Ownership guard FIRST, before any write ──────────────────
  -- Lock the run row and verify the CALLER still owns the LIVE lease (BOTH
  -- lease_owner = p_owner AND state = 'leased'). A stale / reclaimed / wrong
  -- owner finds no row → return false WITHOUT writing anything. FOR UPDATE
  -- holds the row lock for the rest of this transaction.
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
  -- Byte-equal to 20260602000001 EXCEPT the one new assignment
  -- dropped_unclean_span_keys = p_dropped_unclean_span_keys. The success UPDATE
  -- still never references failure_detail (a succeeded run's failure_detail
  -- stays NULL — the no-behavior-change guarantee for that column). When the
  -- caller omits the 10th param (8/9-arg callers) OR the run dropped zero keys,
  -- p_dropped_unclean_span_keys is NULL and the column is set to NULL (the
  -- column default), so a zero-drop success is indistinguishable from a
  -- pre-card success.
  IF p_terminal_state = 'succeeded' THEN
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

    UPDATE public.argument_machine_observation_runs
       SET state                    = 'succeeded',
           status                   = p_status,
           completed_at             = now(),
           dropped_unclean_span_keys = p_dropped_unclean_span_keys,
           lease_owner              = NULL,
           lease_expires_at         = NULL
     WHERE id = p_run_id;

    RETURN true;
  END IF;

  -- ── TERMINAL FAILURE path (failed_terminal | dead_letter) ────
  -- BYTE-EQUAL to 20260602000001. No result rows. The typed failure fields are
  -- recorded; dead_letter_reason only when the terminal state is dead_letter;
  -- failure_detail = p_failure_detail (the leak-safe diagnostic object). The
  -- lease is cleared. This branch does NOT touch dropped_unclean_span_keys — a
  -- failed run has no cleanly-assessed drop signal (it stays NULL).
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
         failure_detail     = p_failure_detail,
         lease_owner        = NULL,
         lease_expires_at   = NULL
   WHERE id = p_run_id;

  RETURN true;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- COMMENT (NO storage.* target — PR-003 SQLSTATE 42501 boundary)
-- ════════════════════════════════════════════════════════════

COMMENT ON FUNCTION public.finalize_classifier_job(uuid, text, text, text, text, text, text, jsonb, jsonb, text[]) IS
  'ARCH-001 Card 2A finalizer + OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE + '
  'OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING. ATOMIC finalize of one claimed '
  'classifier job (plpgsql body = one transaction; no COMMIT / autonomous txn). '
  'Ownership guard FIRST (lease_owner = p_owner AND state = ''leased'' FOR '
  'UPDATE; false hard no-op for a stale / wrong / reclaimed owner). Success → '
  'INSERT result rows (ON CONFLICT (run_id, raw_key) DO NOTHING) + flip run to '
  'succeeded/success + dropped_unclean_span_keys = p_dropped_unclean_span_keys '
  '(the NEW trailing DEFAULT NULL param: leak-safe rawKey NAMES the MCP server '
  'dropped by key-level fail-closed; NULL when zero keys dropped or an 8/9-arg '
  'caller omits it; failure_detail untouched → NULL). Terminal failure '
  '(failed_terminal | dead_letter) → flip with the typed failure fields + '
  'failure_detail = p_failure_detail (does NOT touch dropped_unclean_span_keys → '
  'NULL). Always clears the lease; sets completed_at. Retry scheduling '
  '(retry_scheduled) is NOT this function. SECURITY INVOKER. '
  'cdiscourse-doctrine §1/§3/§6/§8/§10a.';
