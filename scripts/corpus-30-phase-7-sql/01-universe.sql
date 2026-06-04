-- CORPUS-30 Phase 7 — Step 1: confirm the universe under test.
-- Read-only. No mutations. No service-role required for inspection
-- via psql -h <host> -U <admin_user> (or Supabase Studio's SQL editor
-- as an admin) — Supabase admin role bypasses RLS for SELECT.
--
-- runTag under inspection: corpus-prod-synthetic-20260603-1924-d49e04cd
-- Expected: 30 debates, 300 arguments.
SELECT
  (
    SELECT COUNT(*) FROM public.debates
     WHERE title LIKE '%corpus-prod-synthetic-20260603-1924-d49e04cd%'
  ) AS debate_count,
  (
    SELECT COUNT(*) FROM public.arguments a
      JOIN public.debates d ON a.debate_id = d.id
     WHERE d.title LIKE '%corpus-prod-synthetic-20260603-1924-d49e04cd%'
  ) AS argument_count;
