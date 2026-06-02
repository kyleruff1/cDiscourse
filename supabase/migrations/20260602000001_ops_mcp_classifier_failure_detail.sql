-- ============================================================
-- Migration: 20260602000001_ops_mcp_classifier_failure_detail
-- Description: OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE — persist a
--   leak-safe `failure_detail jsonb` on the classifier-queue run row so
--   failure investigations stop requiring a manual Deno Deploy log pull.
--   Three investigations in the ARCH-001 + OPS-MCP cutover arc (PR #419,
--   PR #420, the lone Family-F provider_server_error dead-letter in PR #429)
--   each had to leave the DB and read Deno logs, because the run row records
--   failure_reason / failure_sub_reason / dead_letter_reason but NOT the
--   validator path, the structured reason, or a correlation id. This makes
--   the row self-describing for triage. WRITE-ONLY diagnostics: the drainer
--   writes failure_detail alongside its existing terminal/retry failure
--   writes; NOTHING reads it (no UI, no consumer, no view, no backfill).
--
--   Two SQL changes, nothing else:
--     (B) ADD COLUMN failure_detail jsonb (NULLABLE, DEFAULT NULL, NO backfill)
--         to public.argument_machine_observation_runs.
--     (E) DROP the 8-arg public.finalize_classifier_job(...) and re-create it
--         with a trailing `p_failure_detail jsonb DEFAULT NULL` parameter; the
--         TERMINAL-FAILURE UPDATE gains exactly one assignment
--         (failure_detail = p_failure_detail). The SUCCESS branch is BYTE-EQUAL
--         (it never references failure_detail) so a succeeded row stays NULL.
--     + one COMMENT ON COLUMN and an updated COMMENT ON FUNCTION.
--
-- Card: OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE
--   - Design (authoritative scope + the allow/deny field set + write-path
--     placement + deployment ordering):
--     docs/designs/OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE.md
-- Predecessor migrations:
--   - 20260526000018_mcp_021b_machine_observation_results.sql
--     (CREATE argument_machine_observation_runs + ...results).
--   - 20260528000021_arch_001_classifier_queue_substrate.sql
--     (Card 1: queue lifecycle columns — state, attempt_count, lease_*,
--      failure_sub_reason, dead_letter_reason, available_at, last_attempt_at).
--   - 20260528000022_arch_001_card2a_atomic_finalizer.sql
--     (Card 2A: the 8-arg public.finalize_classifier_job this migration
--      re-creates with one extra trailing param. That file is NEVER edited;
--      its 8-arg shape test stays green against it.)
--
-- ── OPERATOR GATE ──────────────────────────────────────────────
-- This migration is WRITTEN, NOT APPLIED. The operator applies it via
-- `npx supabase db push --linked` BEFORE the drainer PR merges (the Supabase
-- GitHub integration auto-applies migrations + auto-redeploys Edge Functions
-- on merge to main; the new drainer calls the 9-arg finalizer and writes
-- failure_detail, so the column + 9-arg function MUST exist first or every
-- failing cell's terminal write throws). Apply from the feature branch (or land
-- a migration-only PR first), verify the column + 9-arg overload exist, THEN
-- merge. Routing stays DISARMED through the deploy (Stage 1 is closed).
--
-- ── Backward compatibility (the verifier + any 8-arg caller) ───
-- The new trailing parameter is `p_failure_detail jsonb DEFAULT NULL`, and the
-- old 8-arg overload is DROPPED, so EXACTLY ONE finalize_classifier_job exists.
-- An existing 8-arg caller — including
-- scripts/arch-001-card2a-sql/verify-finalize-classifier-job.sql — resolves to
-- the 9-arg function with p_failure_detail defaulting to NULL, so it keeps
-- working WITHOUT edits (a succeeded/terminal finalize that omits the 9th param
-- simply records failure_detail = NULL, exactly as before this card).
--
-- ── Atomicity (UNCHANGED from Card 2A) ─────────────────────────
-- The function body is one implicit transaction; it contains NO COMMIT,
-- ROLLBACK, SAVEPOINT, autonomous-transaction pragma, dblink, or pg_background.
-- The ownership guard (SELECT ... FOR UPDATE; lease_owner = p_owner AND
-- state = 'leased') runs FIRST and returns false as a hard no-op for a stale /
-- wrong / reclaimed owner — NO results inserted, NO run UPDATE, so
-- failure_detail rides the same guard (written iff the existing failure columns
-- are written). All of this is byte-equal to 20260528000022 except the one new
-- param + the one new SET assignment in the terminal-failure UPDATE.
--
-- ── Doctrine encoded ───────────────────────────────────────────
--   - cdiscourse-doctrine §1/§10a: failure_detail carries TYPED transport /
--     schema / structural strings only (validator_path, reason, family,
--     correlation_id, run_mode, schema_version + attempt_count) — never a raw
--     provider body, prompt, evidenceSpan value, or a verdict about a
--     participant. The Edge-side builder buildRunRowFailureDetail(...) is a
--     STRUCTURAL allow-list (no free-text entry point) + secret-shape scrub.
--   - cdiscourse-doctrine §6: NO secret literal anywhere in this migration.
--     failure_detail is a secret-surface closed by the Edge builder; the column
--     itself stores only what that allow-list emits.
--   - cdiscourse-doctrine §8: SECURITY INVOKER (matches Card 2A + the Card-1
--     queue functions); RLS UNCHANGED; additive nullable column; never edits an
--     applied migration.
--
-- ── OPS-001 §4 four-class posture ──────────────────────────────
--   Class 1 — Ambiguous column references: the guard SELECT + both UPDATEs
--     fully-qualify / source from the locked run row's locals (unchanged from
--     Card 2A); the new SET failure_detail = p_failure_detail references the
--     parameter, not an ambiguous column.
--   Class 2 — Column type mismatches: p_failure_detail jsonb matches the new
--     failure_detail jsonb column exactly. All other params are byte-equal to
--     Card 2A.
--   Class 3 — Implicit ordering dependencies: the ADD COLUMN runs BEFORE the
--     CREATE OR REPLACE (the function body references the new column), and the
--     COMMENTs come last. The DROP of the old 8-arg overload precedes the
--     CREATE OR REPLACE of the 9-arg.
--   Class 4 — Function / extension dependencies: core SQL only (now(),
--     jsonb_to_recordset, INSERT ... ON CONFLICT, UPDATE, ALTER TABLE ADD
--     COLUMN). NO `COMMENT ON ... storage.*` (PR-003 SQLSTATE 42501 boundary).
--
-- ── No client write path ───────────────────────────────────────
-- ZERO `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY` / `CREATE TABLE` /
-- `CREATE INDEX` / backfill `UPDATE`. This migration ships ONE additive
-- nullable column + ONE function re-create + two COMMENTs.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- (B) Additive nullable column — NO backfill, NO NOT NULL, NO default object.
-- ════════════════════════════════════════════════════════════
-- Historical rows stay NULL. Success rows stay NULL (the success branch never
-- assigns it). Pre-terminal rows (pending / leased) stay NULL. Only a
-- terminal-failure or retry-scheduled write populates it. jsonb (not text) so
-- ad-hoc ops SQL can filter on `failure_detail->>'reason'` without parsing.
ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS failure_detail jsonb;


-- ════════════════════════════════════════════════════════════
-- (E) Re-create finalize_classifier_job with the trailing p_failure_detail.
-- ════════════════════════════════════════════════════════════
-- Postgres treats finalize_classifier_job(8 args) and (9 args) as DISTINCT
-- functions, so the old 8-arg overload is DROPPED first; otherwise both would
-- coexist. The new param is trailing + DEFAULT NULL for 8-arg-caller
-- compatibility (see "Backward compatibility" above).
DROP FUNCTION IF EXISTS public.finalize_classifier_job(
  uuid, text, text, text, text, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.finalize_classifier_job(
  p_run_id             uuid,
  p_owner              text,    -- caller's lease_owner; MUST match the live lease or it is a no-op
  p_terminal_state     text,    -- 'succeeded' | 'failed_terminal' | 'dead_letter'
  p_status             text,    -- 'success' | 'failed' (compatibility terminal-outcome status)
  p_failure_reason     text,    -- nullable (terminal failure only)
  p_failure_sub_reason text,    -- nullable (terminal failure only)
  p_dead_letter_reason text,    -- nullable (set on the run row only when p_terminal_state='dead_letter')
  p_observations       jsonb,   -- [{raw_key,family,confidence,evidence_span}] for success; [] / null for failure
  p_failure_detail     jsonb DEFAULT NULL  -- NEW: leak-safe diagnostic object; NULL on success + when omitted
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

  -- ── SUCCESS path (BYTE-EQUAL to Card 2A — never references failure_detail) ─
  -- A succeeded run's failure_detail stays NULL (the column default); the
  -- success UPDATE does not assign it. This is the no-behavior-change guarantee
  -- for the success path.
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
       SET state            = 'succeeded',
           status           = p_status,
           completed_at     = now(),
           lease_owner      = NULL,
           lease_expires_at = NULL
     WHERE id = p_run_id;

    RETURN true;
  END IF;

  -- ── TERMINAL FAILURE path (failed_terminal | dead_letter) ────
  -- No result rows. The typed failure fields are recorded; dead_letter_reason
  -- only when the terminal state is dead_letter. The lease is cleared. The ONE
  -- new assignment vs Card 2A is `failure_detail = p_failure_detail` (the
  -- leak-safe diagnostic object the drainer built from its allow-list helper).
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
-- COMMENTs (NO storage.* target — PR-003 SQLSTATE 42501 boundary)
-- ════════════════════════════════════════════════════════════

COMMENT ON COLUMN public.argument_machine_observation_runs.failure_detail IS
  'OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE: leak-safe diagnostic jsonb '
  'written ONLY on a terminal-failure / retry-scheduled run row (NULL on '
  'success, NULL on historical rows, NULL on the lease-expiry reclaim path). '
  'Allow-list ONLY: validator_path, reason, family, correlation_id, '
  'attempt_count, run_mode, schema_version — built Edge-side by a structural '
  'allow-list helper (no body / prompt / evidenceSpan / payload / secret entry '
  'point) + a secret-shape scrub. WRITE-ONLY diagnostics: nothing reads it. '
  'cdiscourse-doctrine §1/§6/§10a — transport/schema/structural strings only, '
  'never a verdict about a participant.';

COMMENT ON FUNCTION public.finalize_classifier_job(uuid, text, text, text, text, text, text, jsonb, jsonb) IS
  'ARCH-001 Card 2A finalizer + OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE. '
  'ATOMIC finalize of one claimed classifier job (plpgsql body = one '
  'transaction; no COMMIT / autonomous txn). Ownership guard FIRST '
  '(lease_owner = p_owner AND state = ''leased'' FOR UPDATE; false hard no-op '
  'for a stale / wrong / reclaimed owner). Success → INSERT result rows '
  '(ON CONFLICT (run_id, raw_key) DO NOTHING) + flip run to succeeded/success '
  '(failure_detail untouched → NULL). Terminal failure (failed_terminal | '
  'dead_letter) → flip with the typed failure fields + the new '
  'failure_detail = p_failure_detail (the trailing DEFAULT NULL param; an '
  '8-arg caller omits it → NULL). Always clears the lease; sets completed_at. '
  'Retry scheduling (retry_scheduled) is NOT this function. SECURITY INVOKER. '
  'cdiscourse-doctrine §1/§6/§8.';
