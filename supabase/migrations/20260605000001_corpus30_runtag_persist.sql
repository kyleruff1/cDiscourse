-- ============================================================
-- Migration: 20260605000001_corpus30_runtag_persist
-- Card:        CORPUS-30-RUNTAG-PERSIST (issue #476)
-- Doctrine:    "the run tag becomes a first-class column, not a title parse."
--
-- The AI-driven bot corpus runner stamps every generated room with a run
-- identifier today by EMBEDDING it inside the debate title, e.g.
--   "Some Topic [ai-corpus 2026abcd #ai-foo-12-345678]"
-- Downstream gallery dedupe (`conversationGalleryModel`) and back-compat
-- filtering parse that title bracket. Parsing a free-text title is fragile.
--
-- This migration adds a durable, structured `run_tag` column so the runner
-- can write the identifier as data, and so admin / gallery filters (#469,
-- #499) can query it directly instead of substring-matching the title.
--
-- This migration is strictly ADDITIVE:
--   1. One nullable column on `public.debates` (`run_tag`).
--   2. One partial index on `public.debates` (run_tag IS NOT NULL).
--
-- The migration:
--   - DOES NOT remove or change the existing title-embedded run tag
--     (back-compat + gallery dedupe still depend on the title bracket).
--   - DOES NOT widen any CHECK constraint.
--   - DOES NOT drop a column, table, or constraint.
--   - DOES NOT edit any prior migration file.
--   - DOES NOT add/alter RLS (existing debates SELECT/INSERT policies cover
--     the new column; run_tag carries no new sensitivity beyond the title
--     that already exposes the same string).
--   - DOES NOT backfill any data. Backfill of legacy rows from the existing
--     title pattern is an OPERATOR-run, one-time step — the recipe is in the
--     trailing comment block; Claude never executes it.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. Additive column on public.debates (NULLABLE, no DEFAULT).
--    NULL = a normal user-created room (or a legacy corpus room not yet
--    backfilled). NOT NULL = a corpus-runner room stamped at insert time.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.debates
  ADD COLUMN run_tag text NULL;

COMMENT ON COLUMN public.debates.run_tag IS
  'Structured corpus run identifier written by the AI-driven bot corpus runner (scripts/bot-fixtures/runAiDrivenCorpus.js). Format: "ai-corpus <runId8> #<scenarioId>". NULL for normal user rooms and legacy corpus rooms not yet backfilled. ADDITIVE — the same identifier remains embedded in the title bracket for back-compat and gallery dedupe; this column is the durable, queryable copy.';

-- ─────────────────────────────────────────────────────────────────
-- 2. Partial index — most debates have NULL run_tag; only stamped corpus
--    rooms need to be indexed. Partial index keeps it small and matches the
--    dominant predicate "find rooms for a given run / any corpus room".
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX debates_run_tag_partial_idx
  ON public.debates (run_tag)
  WHERE run_tag IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- OPERATOR BACKFILL RECIPE (one-time, NOT run by Claude, NOT run by this
-- migration). Parses the legacy title bracket into the new run_tag column for
-- rooms created before the runner started writing run_tag.
--
-- Legacy title pattern produced by the runner:
--   "<seed title> [ai-corpus <runId8> #<scenarioId>]"
-- The captured run_tag value is the bracket CONTENTS:
--   "ai-corpus <runId8> #<scenarioId>"
--
-- Run as the operator (service-role / SQL editor), after this migration is
-- applied. Idempotent: only touches rows whose run_tag is still NULL and
-- whose title matches the corpus pattern.
--
--   UPDATE public.debates
--   SET    run_tag = substring(title FROM '\[(ai-corpus [^\]]+)\]')
--   WHERE  run_tag IS NULL
--     AND  title ~ '\[ai-corpus [^\]]+\]';
--
-- Verify before/after:
--   SELECT count(*) FILTER (WHERE run_tag IS NOT NULL) AS stamped,
--          count(*) FILTER (WHERE run_tag IS NULL
--                            AND title ~ '\[ai-corpus [^\]]+\]') AS legacy_unstamped
--   FROM public.debates;
-- ─────────────────────────────────────────────────────────────────
