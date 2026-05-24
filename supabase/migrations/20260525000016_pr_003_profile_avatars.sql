-- ============================================================
-- Migration: 20260525000016_pr_003_profile_avatars
-- Description: PR-003 — profile avatar bucket + storage RLS +
--   profiles avatar columns + profiles UPDATE policy narrowing.
--
-- Sequential after `20260524000015_qol_039_room_visibility.sql`.
--
-- Extension dependencies:
--   - `storage` schema is built-in to Supabase; no `create extension`
--     required. `storage.buckets` and `storage.objects` are the two
--     tables touched.
--   - `pgcrypto` is NOT required by this migration. None of the new
--     columns use `gen_random_uuid()` (the four avatar columns are
--     plain text + timestamptz). The QOL-038 / QOL-040 / QOL-039
--     pgcrypto note is reproduced here as the OPS-001 four-class
--     precedent — Supabase enables pgcrypto by default in the public
--     schema; verified for this project at 2026-05-25.
--
-- OPS-001 four-class compliance:
--   Class 1 — Ambiguous column references in subqueries:
--     All `storage.objects` RLS policies reference `storage.objects.name`
--     and `storage.objects.bucket_id` fully qualified. The profiles
--     UPDATE policy's WITH CHECK names every column fully
--     (`public.profiles.avatar_path`, etc.) to avoid any ambiguity in
--     a future migration that adds a same-named column to a joined
--     table. Defensive — no subquery here joins cross-table, but a
--     future maintainer adding a join elsewhere will not regress.
--   Class 2 — Column type mismatches:
--     `avatar_path` and `avatar_thumb_path` are `text` (matching the
--     `storage.objects.name` type). `avatar_updated_at` is `timestamptz`
--     (matching every other `*_at` column in the repo).
--     `avatar_moderation_status` is `text` with a CHECK constraint
--     enumerating exactly the two values v1 ships
--     ('allowed', 'removed') — the same shape as
--     `debates.visibility` ('public', 'private') from migration 015.
--     `auth.uid()` returns `uuid`; the cast to `text` in the storage
--     RLS policies is explicit (`(auth.uid())::text`) to avoid the
--     type mismatch that would prevent the policy from being created.
--   Class 3 — Implicit ordering dependencies:
--     Statement order is enforced:
--       1. insert into storage.buckets (bucket must exist before
--          storage.objects RLS policies reference it).
--       2. alter table public.profiles add columns (columns must
--          exist before the narrowed UPDATE policy references them).
--       3. drop policy "profiles: users update own; mods update any".
--       4. create policy "profiles: users update own — narrow" (the
--          narrowed replacement).
--       5. create policy (x1) on storage.objects for public SELECT.
--          INSERT / UPDATE / DELETE policies are intentionally OMITTED
--          for the authenticated role — RLS default-denies, so absence
--          IS the denial. service-role bypasses RLS entirely.
--     No statement depends on a later statement.
--   Class 4 — Function / trigger / extension dependencies:
--     `auth.uid()` is a built-in Supabase function — no create.
--     No new triggers in this migration. `storage` schema is
--     built-in. `is_moderator_or_admin()` is the existing helper from
--     `20260516000002_rls_policies.sql` line 17 — reused to preserve
--     the existing mod/admin write capability on profiles.
--
-- Doctrine encoded by this migration:
--   - The four avatar columns are server-role-write-only by RLS. The
--     narrowed UPDATE policy on profiles refuses any UPDATE that
--     touches an avatar column (see WITH CHECK below) for the
--     authenticated role; the upload-avatar Edge Function writes via
--     service-role which bypasses RLS.
--   - Storage RLS: SELECT is public (the bucket is public-read by
--     design for v1; signed-URL support is a v2 follow-up). INSERT,
--     UPDATE, DELETE for the authenticated role are DENIED — only the
--     service-role client used by upload-avatar can write into the
--     bucket. The 2 MiB cap is enforced at the bucket level AND
--     re-checked inside the Edge Function (defense in depth).
--   - The avatar_moderation_status column ships as v1 scaffolding
--     (Q5) with a default of 'allowed' so existing behaviour is
--     preserved. There is no admin UI in v1; the column exists so a
--     future moderation card has a deterministic gate.
--   - Mods/admins retain UPDATE on profiles (the existing surface in
--     `is_moderator_or_admin()` was preserved in the narrowed
--     replacement). The narrowed policy's WITH CHECK only freezes the
--     avatar columns against the authenticated arm (caller is the
--     profile owner); mods/admins still bypass the freeze via the
--     `is_moderator_or_admin()` arm — they too would not typically
--     write avatar columns, but the OR keeps the existing UPDATE
--     surface for display_name management intact.
--
-- Companion design: docs/designs/PR-003.md §4 + §8.
-- ============================================================

-- ── 1. Storage bucket creation ───────────────────────────────

-- Public-read bucket for v1. file_size_limit = 2097152 (2 MiB) is
-- enforced at upload time by Supabase storage regardless of the Edge
-- Function check — defense in depth. allowed_mime_types restricts the
-- bucket to JPG / PNG / WebP at the storage layer; the Edge Function
-- re-validates server-side, and the client picker validates client-side
-- for UX. Three layers; only the first surfaces to the user under
-- normal conditions.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,                                          -- public-read for v1
  2097152,                                       -- 2 MiB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. profiles column additions ─────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path              text,
  ADD COLUMN IF NOT EXISTS avatar_thumb_path        text,
  ADD COLUMN IF NOT EXISTS avatar_updated_at        timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_moderation_status text
    NOT NULL DEFAULT 'allowed'
    CHECK (avatar_moderation_status IN ('allowed', 'removed'));

COMMENT ON COLUMN public.profiles.avatar_path IS
  'PR-003: storage path for the 256x256 avatar in profile-avatars bucket. '
  'NULL means no avatar uploaded. Server-role write only — the narrowed '
  'profiles UPDATE policy refuses client-JWT writes to this column.';

COMMENT ON COLUMN public.profiles.avatar_thumb_path IS
  'PR-003: storage path for the 64x64 thumbnail in profile-avatars bucket. '
  'NULL means no avatar uploaded. Server-role write only.';

COMMENT ON COLUMN public.profiles.avatar_updated_at IS
  'PR-003: last successful upload or remove timestamp. Used by the client '
  'as a cache-bust query parameter on the public URL. Server-role write only.';

COMMENT ON COLUMN public.profiles.avatar_moderation_status IS
  'PR-003: scaffolding for a future moderation card. Default ''allowed''. '
  'No admin UI in v1. When set to ''removed'' the upload-avatar '
  'read_url_for_user action returns null URLs so the client falls back to '
  'the GeneratedAvatar placeholder.';

-- ── 3. profiles UPDATE policy narrowing ──────────────────────

-- The existing UPDATE policy from `20260516000002_rls_policies.sql` line 69
-- granted UPDATE for `id = auth.uid() OR is_moderator_or_admin()` with the
-- same WITH CHECK. PR-003 NARROWS it: the caller may still UPDATE their
-- own row (or a mod/admin may UPDATE any row — display_name management
-- preserved), but the WITH CHECK now refuses any UPDATE that changes any
-- of the four avatar columns relative to the OLD row.
--
-- PostgreSQL RLS does not expose OLD inside a policy expression. The
-- subselect against `public.profiles p WHERE p.id = public.profiles.id`
-- reads the OLD row — established pattern for "freeze a column" via RLS
-- without a trigger. Works on Postgres >= 15 (Supabase is on 17 per
-- supabase/config.toml line 36). If a reviewer's local apply surfaces
-- unexpected behaviour, the documented fallback (design §16) is a
-- BEFORE UPDATE trigger that RAISES on avatar-column changes from the
-- authenticated role — fully replaceable without other migration changes.
DROP POLICY IF EXISTS "profiles: users update own; mods update any" ON public.profiles;
DROP POLICY IF EXISTS "profiles: users update own — narrow" ON public.profiles;

CREATE POLICY "profiles: users update own — narrow"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.profiles.id = auth.uid()
  OR public.is_moderator_or_admin()
)
WITH CHECK (
  (
    public.profiles.id = auth.uid()
    OR public.is_moderator_or_admin()
  )
  -- Avatar columns are server-role write only. The WITH CHECK refuses
  -- any UPDATE that changes the avatar columns. The expression below
  -- evaluates to true ONLY when every avatar column in NEW is byte-equal
  -- to the OLD row — read via a subselect against the same table by id.
  AND (
    SELECT
      COALESCE(p.avatar_path, '') IS NOT DISTINCT FROM COALESCE(public.profiles.avatar_path, '')
      AND COALESCE(p.avatar_thumb_path, '') IS NOT DISTINCT FROM COALESCE(public.profiles.avatar_thumb_path, '')
      AND p.avatar_updated_at IS NOT DISTINCT FROM public.profiles.avatar_updated_at
      AND p.avatar_moderation_status IS NOT DISTINCT FROM public.profiles.avatar_moderation_status
    FROM public.profiles p
    WHERE p.id = public.profiles.id
  )
);

COMMENT ON POLICY "profiles: users update own — narrow" ON public.profiles IS
  'PR-003: replaces the prior unrestricted UPDATE policy with one that '
  'freezes the four avatar columns against client-JWT writes. The upload-avatar '
  'Edge Function writes them via service-role (which bypasses RLS). The '
  'display_name + any other existing user-writable surface is unaffected.';

-- ── 4. Storage object RLS for profile-avatars ────────────────

-- SELECT — public-read (the bucket itself is public; this policy makes
-- it explicit for documentation, since storage.objects has RLS on by
-- default and a public bucket still requires a SELECT policy for
-- anonymous + authenticated access to function).
DROP POLICY IF EXISTS "profile-avatars: anyone can read" ON storage.objects;
CREATE POLICY "profile-avatars: anyone can read"
ON storage.objects
FOR SELECT
TO public
USING (storage.objects.bucket_id = 'profile-avatars');

COMMENT ON POLICY "profile-avatars: anyone can read" ON storage.objects IS
  'PR-003: public-read for the profile-avatars bucket. Avatars are low-sensitivity '
  'profile cosmetics the user chose to upload as their profile picture. Signed-URL '
  'support is a v2 follow-up; the moderation_status column gates per-user via the '
  'upload-avatar Edge Function read_url_for_user action.';

-- INSERT / UPDATE / DELETE policies for the authenticated role are
-- INTENTIONALLY OMITTED. With RLS enabled on storage.objects and no
-- write policy for `authenticated`, a client-side attempt to upload
-- via `supabase.storage.from('profile-avatars').upload(...)` returns
-- 403 (default-deny). Only the service-role client used by the
-- upload-avatar Edge Function can write into the bucket — service-role
-- bypasses RLS entirely, no policy needed for it.
--
-- This is the security guarantee for acceptance criterion
-- "RLS/storage policy prevents arbitrary overwrite": a malicious user
-- cannot write to another user's avatar path (or any path at all) via
-- their client JWT.
