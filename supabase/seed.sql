-- ============================================================
-- Dev Seed — supabase/seed.sql
-- Run by: supabase db reset (local dev only)
-- DO NOT apply to staging or production.
-- ============================================================
-- This file seeds representative test data: three fake users, one
-- debate, and a few arguments so the UI is not empty on first run.
-- Real users are created via Supabase Auth; these rows simulate the
-- auth + profile state after signup.
-- ============================================================
-- DEV-SEED-001 (#772) — FK + trigger interaction.
--
-- public.profiles.id REFERENCES auth.users(id) (20260516000001_initial_schema.sql:26).
-- Seeding profiles WITHOUT a matching auth.users row raises profiles_id_fkey
-- (SQLSTATE 23503) and aborts the whole `supabase db reset` / preview reset.
-- So we seed the auth.users rows FIRST.
--
-- Inserting into auth.users fires the on_auth_user_created trigger
-- (20260516000001_initial_schema.sql:51-53), whose handle_new_user() body was
-- replaced by 20260620000001_auth_google_oauth_display_name_coalesce.sql. That
-- trigger AUTO-CREATES the public.profiles row with role 'user' ALWAYS and a
-- display_name COALESCEd from raw_user_meta_data (display_name first). So after
-- the auth.users inserts below, three profiles already exist as role 'user'.
--
-- The explicit profiles statement therefore runs as an UPSERT
-- (ON CONFLICT (id) DO UPDATE) so the intended dev state wins over the
-- trigger defaults — specifically so Mod (Dev) keeps role 'moderator'. A plain
-- DO NOTHING here would silently leave Mod as role 'user'.
--
-- Final intended seeded state:
--   00000000-…-0001  display_name 'Alice (Dev)'  role 'user'
--   00000000-…-0002  display_name 'Bob (Dev)'    role 'user'
--   00000000-…-0003  display_name 'Mod (Dev)'    role 'moderator'
-- ============================================================

-- ── Dev auth.users (LOCAL DEV ONLY) ──────────────────────────
-- Minimal GoTrue-shape rows so the profiles FK is satisfied. The
-- encrypted_password is a throwaway bcrypt hash of a non-secret dev password
-- ('devpassword'); these accounts exist only in a local/preview database that
-- is wiped on every reset. pgcrypto (gen_salt / crypt) is enabled by default in
-- Supabase. email_confirmed_at is set so the rows are usable even if email
-- confirmations are toggled on. raw_user_meta_data.display_name mirrors the
-- profile names below so the trigger-created profile is already consistent
-- before the upsert.
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'alice@dev.local',
    crypt('devpassword', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Alice (Dev)"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'bob@dev.local',
    crypt('devpassword', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Bob (Dev)"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'mod@dev.local',
    crypt('devpassword', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Mod (Dev)"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ── Dev profiles (UUIDs are stable across resets) ────────────
-- UPSERT (not DO NOTHING): the on_auth_user_created trigger already created
-- these rows as role 'user' from the auth.users inserts above. The DO UPDATE
-- makes the explicit dev display_name + role win, so Mod (Dev) is 'moderator'.
INSERT INTO public.profiles (id, display_name, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Alice (Dev)', 'user'),
  ('00000000-0000-0000-0000-000000000002', 'Bob (Dev)',   'user'),
  ('00000000-0000-0000-0000-000000000003', 'Mod (Dev)',   'moderator')
ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      role         = EXCLUDED.role;

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
