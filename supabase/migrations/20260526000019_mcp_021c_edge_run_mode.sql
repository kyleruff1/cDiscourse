-- ============================================================
-- Migration: 20260526000019_mcp_021c_edge_run_mode
-- Description: MCP-021C-EDGE — Add run_mode discriminator to the
--   MCP-021B argument_machine_observation_runs table. Adds a CHECK
--   constraint allowing only 'production' | 'admin_validation', a
--   DEFAULT of 'production' (backfills existing rows including the
--   9 smoke-seed rows from the MCP-021B Phase 2 audit), and an
--   index for the production-only filter at the persistence query
--   layer (see Source 6 filter design §8 of the design doc).
--
-- Card: MCP-021C-EDGE (intent brief docs/designs/MCP-021C-EDGE-intent.md;
--                       design docs/designs/MCP-021C-EDGE.md)
-- Predecessor: MCP-021B base migration
--              20260526000018_mcp_021b_machine_observation_results.sql
--
-- Doctrine encoded:
--   - run_mode discriminates PURPOSE (production classifier vs admin
--     validation run); does NOT discriminate provider provenance —
--     that remains in provider_key. (cdiscourse-doctrine §1, §10a)
--   - Admin validation rows are real persisted rows; Source 6
--     filters them out of production rendering at the persistence
--     query layer (preferred over adapter-layer filter — see
--     intent brief §"Source 6 filter requirement").
--   - Existing 9 smoke-seed rows from the MCP-021B audit backfill
--     to run_mode = 'production' via the column DEFAULT, preserving
--     their visibility through Source 6 in the UI.
--   - No new RLS policies. The existing amor_runs_select_via_argument
--     policy covers run_mode-aware reads transparently (the column
--     is additive; visibility doctrine is unchanged).
--
-- Statement order (OPS-001 §4 Class 3):
--   1. ALTER TABLE … ADD COLUMN run_mode (column + CHECK + DEFAULT NOT NULL)
--   2. CREATE INDEX … ON … (run_mode)
--   3. COMMENT ON COLUMN …
--
-- OPS-001 §4 four-class posture:
--   Class 1 — Ambiguous column references: not applicable; this
--     migration adds one column to an existing table. No subquery
--     or join introduced.
--   Class 2 — Column type mismatches: run_mode is text with CHECK;
--     same type pattern as the existing status column.
--   Class 3 — Implicit ordering dependencies: ALTER TABLE precedes
--     CREATE INDEX (the index references the new column). COMMENT
--     statements come last (descriptive only, no execution
--     dependency).
--   Class 4 — Function / trigger / extension dependencies: none
--     introduced. The migration is purely DDL on an existing table.
-- ============================================================

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS run_mode text NOT NULL DEFAULT 'production'
  CHECK (run_mode IN ('production', 'admin_validation'));

CREATE INDEX IF NOT EXISTS argument_machine_observation_runs_run_mode_idx
  ON public.argument_machine_observation_runs (run_mode);

COMMENT ON COLUMN public.argument_machine_observation_runs.run_mode IS
  'MCP-021C-EDGE: discriminator for run purpose. ''production'' rows '
  'feed Source 6 in the production UI. ''admin_validation'' rows are '
  'persisted for operator audit and are filtered out of production '
  'rendering at the persistence query layer '
  '(fetchPersistedObservationsForArguments). Default ''production'' '
  'backfills MCP-021B smoke-seed rows.';
