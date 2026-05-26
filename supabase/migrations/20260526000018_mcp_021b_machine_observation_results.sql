-- ============================================================
-- Migration: 20260526000018_mcp_021b_machine_observation_results
-- Description: MCP-021B — Persisted Machine Observation classifier
--   results. Adds two new tables (runs + results) with read-only
--   client RLS; no client write path (MCP-021C writes via service-role).
--
-- Card: MCP-021B (intent brief docs/designs/MCP-021B-intent.md;
--                 design docs/designs/MCP-021B.md)
-- Predecessor: MCP-021A (172-entry registry; schema version
--              mcp-021.machine-observations.boolean.v1 baked in
--              src/features/nodeLabels/mcpBooleanObservationSchema.ts:36)
--
-- Doctrine encoded by this migration:
--   - Persisted Machine Observations are STRUCTURAL FACTS about moves;
--     never verdicts, never truth labels. (cdiscourse-doctrine §1, §10a)
--   - Engagement / popularity / heat are NEVER inputs. The schema has
--     no view-count, retweet-count, follower-count, or engagement
--     column. (cdiscourse-doctrine §3)
--   - Service-role is the ONLY write path; the client never inserts,
--     updates, or deletes classifier rows. (Decision 2 of intent brief)
--   - Soft-delete semantics inherit from public.arguments cascade —
--     when the underlying argument is soft-deleted (status = 'deleted')
--     the visibility predicate hides results too.
--
-- Statement order (OPS-001 §4 Class 3 — implicit ordering dependencies):
--   1. CREATE TABLE public.argument_machine_observation_runs
--   2. CREATE TABLE public.argument_machine_observation_results
--      (references runs.id via FK — must be created AFTER runs)
--   3. CREATE INDEX (×3 — runs + results-by-arg + results-by-run)
--   4. ALTER TABLE … ENABLE ROW LEVEL SECURITY (×2)
--   5. CREATE POLICY (×1 on runs — SELECT only, TO authenticated)
--   6. CREATE POLICY (×1 on results — SELECT only, TO authenticated)
--   7. COMMENT ON TABLE / COMMENT ON COLUMN (no storage.* targets)
--
-- OPS-001 §4 four-class posture:
--   Class 1 — Ambiguous column references in subqueries: all RLS
--     subqueries fully-qualify column names against the policy-target
--     table (e.g. argument_machine_observation_runs.argument_id, NOT
--     bare argument_id). Defensive even where no ambiguity exists today,
--     to prevent a future maintainer's join from regressing.
--   Class 2 — Column type mismatches: every foreign key references the
--     same column type as declared on the referenced table (uuid against
--     uuid). debate_id and argument_id are both uuid; run_id is uuid.
--     Confidence is text with CHECK against the 3-value enum.
--   Class 3 — Implicit ordering dependencies: runs CREATE TABLE precedes
--     results CREATE TABLE (results.run_id FK references runs.id);
--     CREATE INDEX statements follow their CREATE TABLE; ENABLE ROW
--     LEVEL SECURITY precedes every CREATE POLICY on each table.
--   Class 4 — Function / trigger / extension dependencies: gen_random_uuid()
--     requires pgcrypto (enabled by every prior migration in this repo,
--     verified at QOL-039 header lines 19-30; same posture here). RLS
--     subqueries delegate to public.arguments SELECT, whose canonical
--     policy "arguments: select own, participant-private, or posted-public"
--     was created by 20260524000015_qol_039_room_visibility.sql (applied).
--     NO `COMMENT ON … storage.*` statements anywhere in this migration
--     (PR-003 SQLSTATE 42501 boundary preserved).
--
-- Visibility predicate divergence note (design §11.1):
--   The intent brief proposed an explicit `JOIN debates ON id = a.debate_id`
--   shape with `visibility = 'public' OR ... debate_participants` arms on
--   the runs SELECT policy. This design uses the META-1A canonical
--   delegation pattern instead (single-table EXISTS into public.arguments)
--   because the brief's shape would re-introduce the cross-table recursion
--   that QOL-039's SECURITY DEFINER helpers were created to avoid, and it
--   would omit the moderator/admin + author arms that the canonical
--   arguments SELECT policy carries. The brief explicitly authorizes this
--   divergence (intent brief §"Required RLS posture" → "Read policy for
--   runs" → line 204).
--
-- No client INSERT / UPDATE / DELETE policy for either table.
-- MCP-021C will write through a service-role Edge Function; service-role
-- bypasses RLS. This migration ships ZERO server-side write path.
-- ============================================================

-- ── 1. runs table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.argument_machine_observation_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id           uuid        NOT NULL
                                    REFERENCES public.debates(id)   ON DELETE CASCADE,
  argument_id         uuid        NOT NULL
                                    REFERENCES public.arguments(id) ON DELETE CASCADE,
  schema_version      text        NOT NULL,
  requested_families  text[]      NOT NULL DEFAULT '{}',
  provider_key        text,
  model_name          text,
  input_hash          text,
  status              text        NOT NULL
                                    CHECK (status IN ('success', 'failed', 'fallback')),
  failure_reason      text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── 2. results table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.argument_machine_observation_results (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid        NOT NULL
                                REFERENCES public.argument_machine_observation_runs(id)
                                ON DELETE CASCADE,
  debate_id       uuid        NOT NULL
                                REFERENCES public.debates(id)   ON DELETE CASCADE,
  argument_id     uuid        NOT NULL
                                REFERENCES public.arguments(id) ON DELETE CASCADE,
  schema_version  text        NOT NULL,
  raw_key         text        NOT NULL,
  family          text        NOT NULL,
  confidence      text        NOT NULL
                                CHECK (confidence IN ('low', 'medium', 'high')),
  evidence_span   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- One positive observation per (run, rawKey). Prevents MCP-021C from
  -- accidentally writing duplicates within a single run.
  CONSTRAINT amor_unique_run_rawkey UNIQUE (run_id, raw_key)
);

-- ── 3. indexes ─────────────────────────────────────────────────

-- runs: lookup by argument + version, most recent successful run first.
CREATE INDEX IF NOT EXISTS amor_runs_argument_version_completed_idx
  ON public.argument_machine_observation_runs
     (argument_id, schema_version, completed_at DESC NULLS LAST);

-- results: lookup by argument + version + rawKey (adapter happy path).
CREATE INDEX IF NOT EXISTS amor_results_argument_version_rawkey_idx
  ON public.argument_machine_observation_results
     (argument_id, schema_version, raw_key);

-- results: lookup by run (cascade-aware queries).
CREATE INDEX IF NOT EXISTS amor_results_run_idx
  ON public.argument_machine_observation_results (run_id);

-- ── 4. enable RLS on both tables ───────────────────────────────

ALTER TABLE public.argument_machine_observation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.argument_machine_observation_results ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS read policy: runs ───────────────────────────────────
--
-- DELEGATION pattern (META-1A precedent, see
-- 20260517000009_meta_1a_point_tags.sql:88-98): the EXISTS subquery
-- targets public.arguments. Postgres applies the canonical
-- "arguments: select own, participant-private, or posted-public" SELECT
-- policy (QOL-039 line 236-252) when the subquery runs, so this
-- inherits the full arm set:
--   - author_id = auth.uid()
--   - is_moderator_or_admin()
--   - status = 'posted' AND public.is_debate_open_or_locked_public(debate_id)
--   - status = 'posted' AND public.is_debate_participant(debate_id, auth.uid())
-- A non-participant of a private room cannot see the runs row because
-- the underlying argument row is invisible to them.
--
-- OPS-001 Class 1: the subquery column reference
-- `argument_machine_observation_runs.argument_id` is fully qualified to
-- the policy-target table (NOT bare `argument_id`). Defensive — there is
-- no ambiguity today, but a future maintainer's join inside the subquery
-- would not regress.

DROP POLICY IF EXISTS amor_runs_select_via_argument
  ON public.argument_machine_observation_runs;

CREATE POLICY amor_runs_select_via_argument
  ON public.argument_machine_observation_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.arguments a
      WHERE a.id = argument_machine_observation_runs.argument_id
    )
  );

-- ── 6. RLS read policy: results ────────────────────────────────
--
-- INHERIT-VIA-RUN pattern (design §4.3): the EXISTS subquery targets
-- argument_machine_observation_runs, whose SELECT policy in turn targets
-- public.arguments. The chain is one level deeper than META-1A's
-- pt_select_read_access but follows the same delegation pattern and
-- remains recursion-free because each hop is a single-table EXISTS into
-- a table whose own SELECT policy resolves without a cycle:
--   results → runs → arguments → SECURITY DEFINER helpers
--
-- OPS-001 Class 1: the subquery column reference
-- `argument_machine_observation_results.run_id` is fully qualified.

DROP POLICY IF EXISTS amor_results_select_via_run
  ON public.argument_machine_observation_results;

CREATE POLICY amor_results_select_via_run
  ON public.argument_machine_observation_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.argument_machine_observation_runs r
      WHERE r.id = argument_machine_observation_results.run_id
    )
  );

-- ── 7. Write policies — explicit "no client write" posture ─────
--
-- NO client INSERT / UPDATE / DELETE policy for either table.
-- MCP-021C writes via a service-role Edge Function; service-role bypasses
-- RLS. This migration ships ZERO client write path. The reviewer's
-- mechanical check:
--   grep -E "CREATE POLICY .* FOR (INSERT|UPDATE|DELETE)" \
--     supabase/migrations/20260526000018_*.sql
-- must return zero matches.

-- ── 8. COMMENT ON TABLE / COLUMN (NO storage.* targets) ────────

COMMENT ON TABLE public.argument_machine_observation_runs IS
  'MCP-021B: per-classifier-run audit row for Machine Observation classifier '
  'work on a single argument. Status enum records success / failed / fallback. '
  'Service-role WRITE only (MCP-021C); client SELECT only via RLS. '
  'cdiscourse-doctrine §1, §10a: structural observation; never a verdict.';

COMMENT ON TABLE public.argument_machine_observation_results IS
  'MCP-021B: per-positive-observation row. Absence of a row for a (run, rawKey) '
  'means the classifier did not observe that rawKey on the move. The adapter '
  'src/features/nodeLabels/machineObservationPersistenceAdapter.ts validates '
  'schema_version, rawKey-registry membership, confidence floor, and truncates '
  'evidence_span to 240 chars at read time. cdiscourse-doctrine §3: engagement, '
  'popularity, and heat are NEVER inputs — the schema has no such columns.';

COMMENT ON COLUMN public.argument_machine_observation_results.raw_key IS
  'One of the 172 MCP-021A MachineObservationDefinition rawKeys. Unknown rawKeys '
  'are silently dropped by the adapter — never echoed in UI, never logged.';

COMMENT ON COLUMN public.argument_machine_observation_results.confidence IS
  'One of low / medium / high. The adapter applies per-surface threshold via '
  'MachineObservationDefinition.confidenceEligibility before emitting a '
  'NodeLabelMark for any surface.';
