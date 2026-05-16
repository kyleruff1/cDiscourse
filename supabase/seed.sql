-- ============================================================
-- Dev Seed — supabase/seed.sql
-- Run by: supabase db reset (local dev only)
-- DO NOT apply to staging or production.
-- ============================================================
-- This file seeds representative test data: two fake users, one
-- debate, and a few arguments so the UI is not empty on first run.
-- Real users are created via Supabase Auth; these rows simulate the
-- profile state after signup.
-- ============================================================

-- ── Dev profiles (UUIDs are stable across resets) ────────────
INSERT INTO public.profiles (id, display_name, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Alice (Dev)', 'user'),
  ('00000000-0000-0000-0000-000000000002', 'Bob (Dev)',   'user'),
  ('00000000-0000-0000-0000-000000000003', 'Mod (Dev)',   'moderator')
ON CONFLICT (id) DO NOTHING;

-- ── One dev debate using the active constitution ──────────────
INSERT INTO public.debates (id, created_by, title, resolution, description, status, constitution_id)
SELECT
  '11111111-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'UBI and Long-Term Poverty',
  'Universal basic income reduces long-term poverty.',
  'A structured debate on the empirical and theoretical evidence for UBI as a poverty-reduction mechanism.',
  'open',
  id
FROM public.constitution_versions
WHERE slug = 'constitution-v1'
ON CONFLICT (id) DO NOTHING;

-- ── Participants ──────────────────────────────────────────────
INSERT INTO public.debate_participants (debate_id, user_id, side)
VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'affirmative'),
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'negative'),
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'moderator')
ON CONFLICT (debate_id, user_id) DO NOTHING;

-- ── Root thesis (affirmative) ─────────────────────────────────
INSERT INTO public.arguments (id, debate_id, parent_id, author_id, argument_type, side, body, depth, status)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  NULL,
  '00000000-0000-0000-0000-000000000001',
  'thesis',
  'affirmative',
  'Universal basic income (UBI) provides a stable income floor that breaks the poverty trap by '
  'reducing the marginal cost of taking economic risks such as pursuing education or entrepreneurship. '
  'Evidence from pilot programs in Stockton, CA and Finland supports this thesis.',
  0,
  'posted'
) ON CONFLICT (id) DO NOTHING;

-- ── Rebuttal (negative) ───────────────────────────────────────
INSERT INTO public.arguments (id, debate_id, parent_id, author_id, argument_type, side, body, depth, status)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'rebuttal',
  'negative',
  'The Stockton and Finland pilots are not representative: they were short-duration, '
  'limited in scale, and did not account for the macroeconomic effects of a universal — '
  'rather than targeted — income transfer. Labor supply effects and inflation pressure '
  'undermine the long-term poverty reduction claim.',
  1,
  'posted'
) ON CONFLICT (id) DO NOTHING;
