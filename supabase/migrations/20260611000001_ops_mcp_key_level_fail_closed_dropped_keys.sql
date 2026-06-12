-- ============================================================
-- Migration: 20260611000001_ops_mcp_key_level_fail_closed_dropped_keys
-- Description: OPS-MCP-KEY-LEVEL-FAIL-CLOSED — persist a leak-safe audit list
--   of the rawKey NAMES the MCP server dropped by OMISSION (key-level
--   fail-closed) on a SUCCESS run. When ONE Family J evidenceSpan trips the
--   doctrine ban-scan, the server now omits THAT key (it never returns and
--   never persists its span) while the clean sibling keys survive — replacing
--   the packet-level death penalty with key-level death. The run carrying the
--   drop is a SUCCESS; the signal needs its OWN column (NOT failure_reason /
--   failure_detail — those are WRITE-ONLY failure diagnostics that stay NULL on
--   success per 20260602000001, and admin-classifier-health reads failure_detail
--   only for failure reasons).
--
--   ONE SQL change, nothing else:
--     (B) ADD COLUMN dropped_unclean_span_keys text[] (NULLABLE, DEFAULT NULL,
--         NO backfill) to public.argument_machine_observation_runs.
--     + one COMMENT ON COLUMN.
--
--   text[] (NOT jsonb) so ad-hoc ops SQL can `unnest()` the array to count
--   per-key drop rates (scripts/ops/sql/18-unclean-span-key-drops-by-family.sql).
--   Stores rawKey NAMES only — never a span, never a body, never a verdict.
--
-- Card: OPS-MCP-KEY-LEVEL-FAIL-CLOSED
--   - Design (authoritative scope + omission semantics + J-only enablement +
--     deployment ordering): docs/designs/OPS-MCP-KEY-LEVEL-FAIL-CLOSED.md
-- Predecessor migrations:
--   - 20260526000018_mcp_021b_machine_observation_results.sql
--     (CREATE argument_machine_observation_runs + ...results).
--   - 20260602000001_ops_mcp_classifier_failure_detail.sql
--     (the additive-nullable run-row column precedent this migration mirrors
--      EXACTLY: nullable, DEFAULT NULL, no backfill, no RLS change, no index,
--      success rows previously NULL stay NULL).
--
-- ── OPERATOR GATE ──────────────────────────────────────────────
-- This migration is WRITTEN, NOT APPLIED. The operator applies it via
-- `npx supabase db push --linked` BEFORE merging the Edge code that writes the
-- column (the Supabase GitHub integration auto-applies migrations + auto-
-- redeploys registered Edge Functions on merge to main; the direct-dispatch
-- persistRun path writes dropped_unclean_span_keys, so the column MUST exist
-- first or a SUCCESS run with a drop would throw on INSERT). Apply from the
-- feature branch (or land a migration-only PR first), verify the column exists,
-- THEN merge the code. Heightened reviewer verification applies (migration-
-- bearing).
--
-- ── Scope: NO finalizer re-create on first ship ────────────────
-- Family J is admin-validation-only (productionEnabled:false), and
-- admin_validation runs use the DIRECT dispatch path
-- (classifyArgumentCore → persistRun), NOT the queue drainer. The drainer's
-- finalize_classifier_job SUCCESS branch does NOT write this column, and under
-- J-only enablement it never needs to. Widening key-level drop to A–I
-- (production → drainer) is a separate, production-touching follow-up that
-- would additionally re-create finalize_classifier_job to write the column on
-- its SUCCESS branch + take its own cdiscourse-doctrine §10a + production review.
--
-- ── Backward compatibility ─────────────────────────────────────
-- The column is additive + nullable + DEFAULT NULL with NO backfill. Every
-- historical row stays NULL. Every run with zero drops stays NULL (the caller
-- omits the field → the conditional spread in persistenceWriter.ts leaves the
-- column absent from the INSERT payload → NULL). No reader requires it; the
-- admin-classifier-health panel reads it as an OPTIONAL counts-only bucket.
--
-- ── Doctrine encoded ───────────────────────────────────────────
--   - cdiscourse-doctrine §1/§10a: dropped_unclean_span_keys carries rawKey
--     NAMES only (e.g. 'needs_pre_send_pause') — never a span, never a body,
--     never a verdict about a participant. Omission asserts nothing; no
--     fabricated finding. The drop is fail-CLOSED validation at the key scope.
--   - cdiscourse-doctrine §3: a drop never grants standing; popularity / satire
--     semantics are untouched.
--   - cdiscourse-doctrine §6: NO secret literal anywhere in this migration.
--   - cdiscourse-doctrine §8: RLS UNCHANGED; additive nullable column; never
--     edits an applied migration; no hard delete.
--
-- ── OPS-001 §4 four-class posture ──────────────────────────────
--   Class 1 — Ambiguous column references: the lone ALTER TABLE ADD COLUMN
--     names the table + column fully; no SELECT, no multi-table reference, no
--     ambiguity surface.
--   Class 2 — Column type mismatches: dropped_unclean_span_keys text[] matches
--     the Edge writer's `string[]` payload (supabase-js serializes a JS string
--     array to a Postgres text[]). No other column is touched.
--   Class 3 — Implicit ordering dependencies: a single ADD COLUMN IF NOT EXISTS
--     followed by its COMMENT ON COLUMN. The COMMENT runs AFTER the column
--     exists. No function re-create, no dependency on another statement.
--   Class 4 — Function / extension dependencies: core SQL only (ALTER TABLE ADD
--     COLUMN, COMMENT ON COLUMN). NO `COMMENT ON ... storage.*` (PR-003 SQLSTATE
--     42501 boundary). NO extension required.
--
-- ── No client write path ───────────────────────────────────────
-- ZERO `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY` / `CREATE TABLE` /
-- `CREATE INDEX` / `CREATE OR REPLACE FUNCTION` / backfill `UPDATE`. This
-- migration ships ONE additive nullable column + ONE COMMENT.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- (B) Additive nullable column — NO backfill, NO NOT NULL, NO default object.
-- ════════════════════════════════════════════════════════════
-- Historical rows stay NULL. Runs with zero drops stay NULL (the success caller
-- omits the field). Only a SUCCESS run that dropped >= 1 unclean-span key
-- populates it. text[] (not jsonb) so ad-hoc ops SQL can unnest() the array to
-- count per-key drop rates without parsing.
ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS dropped_unclean_span_keys text[];


-- ════════════════════════════════════════════════════════════
-- COMMENT (NO storage.* target — PR-003 SQLSTATE 42501 boundary)
-- ════════════════════════════════════════════════════════════

COMMENT ON COLUMN public.argument_machine_observation_runs.dropped_unclean_span_keys IS
  'OPS-MCP-KEY-LEVEL-FAIL-CLOSED: leak-safe text[] of the rawKey NAMES the MCP '
  'server dropped by OMISSION (key-level fail-closed) because their evidenceSpan '
  'tripped the byte-unchanged doctrine ban-scan. Written ONLY on a SUCCESS run '
  'that dropped >= 1 key (NULL on success-with-zero-drops, NULL on historical '
  'rows, NULL on failed runs). NAMES ONLY — never a span, never a body, never a '
  'verdict about a participant. Family J (sensitive_composer) only on first '
  'ship (admin-validation-only; direct-dispatch path; the drainer SUCCESS '
  'branch does not write this column). cdiscourse-doctrine §1/§3/§6/§10a — '
  'omission asserts nothing; a drop never grants standing.';
