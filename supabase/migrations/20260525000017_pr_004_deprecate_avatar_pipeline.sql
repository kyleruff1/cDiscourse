-- ============================================================
-- Migration: 20260525000017_pr_004_deprecate_avatar_pipeline
-- Description: PR-004 — deprecate PR-003's avatar pipeline. Drop the
--   storage SELECT policy on profile-avatars (the bucket itself
--   remains — see "Why we do not drop the bucket" below), drop the
--   four avatar columns from public.profiles, drop the narrowed
--   UPDATE policy from migration 16, and restore the original
--   unrestricted UPDATE policy from migration 02. This card is the
--   operator-pivoted reversal of PR-003: the v1 avatar is now the
--   InitialsAvatar (formerly GeneratedAvatar) deterministic
--   identity glyph from PR-001, not an uploaded image. See
--   docs/designs/PR-004.md and docs/core/known-blockers.md
--   "PR-003 Storage Schema Comment Ownership" for the chain of
--   decisions.
--
-- Sequential after `20260525000016_pr_003_profile_avatars.sql`.
-- Migration 16 cannot be edited (cdiscourse-doctrine §8 append-only);
-- this migration REVERSES 16's effects via a new forward migration.
--
-- Extension dependencies:
--   - `storage` schema is built-in to Supabase; no `create extension`.
--   - `pgcrypto` is NOT required (no gen_random_uuid() calls).
--   - `is_moderator_or_admin()` is the existing helper from
--     20260516000002_rls_policies.sql line 17 — used in the restored
--     UPDATE policy WITH CHECK below.
--
-- OPS-001 four-class compliance:
--   Class 1 — Ambiguous column references in subqueries:
--     The restored UPDATE policy uses `id = auth.uid()` qualified by
--     the ON public.profiles table context. No subqueries. The
--     narrowed policy from migration 16 used a subselect-against-
--     same-table pattern to read OLD; that pattern is DROPPED here
--     so there is no subquery surface left to ambiguate.
--   Class 2 — Column type mismatches:
--     No new columns. The DROP COLUMN statements remove existing
--     columns of types text and timestamptz. The CHECK constraint
--     on avatar_moderation_status is dropped automatically with
--     the column.
--   Class 3 — Implicit ordering dependencies:
--     Statement order is enforced:
--       1. drop storage SELECT policy
--          ("profile-avatars: anyone can read" on storage.objects)
--          — must drop BEFORE removing the bucket reference (if we
--          ever drop the bucket; v1 keeps it).
--       2. drop the four columns from public.profiles
--          (IF EXISTS for safety even though they were added in 16).
--       3. drop the narrowed UPDATE policy
--          ("profiles: users update own — narrow" on public.profiles)
--          — must drop BEFORE creating the restored policy because
--          Postgres does not allow two policies with the same name
--          and policies are name-scoped per table.
--       4. recreate the original UPDATE policy
--          ("profiles: users update own; mods update any" on
--          public.profiles) with the same body as migration 02
--          lines 69–73.
--     No statement depends on a later statement.
--   Class 4 — Function / trigger / extension dependencies:
--     The restored UPDATE policy uses `is_moderator_or_admin()`
--     (existing helper from migration 02 line 17). No new function.
--     No new trigger. No new extension. No extension drop (pgcrypto
--     stays — it is used by other tables).
--
-- Storage ownership lesson (verbatim apply of the 2026-05-24
-- known-blockers entry "PR-003 Storage Schema Comment Ownership"):
--   - `storage.objects` is owned by supabase_storage_admin, not by
--     the standard migration role. The standard migration role can
--     CREATE POLICY and DROP POLICY on storage.objects (this is
--     granted by Supabase's storage RLS setup), but it cannot
--     COMMENT ON POLICY ... ON storage.*. This migration includes
--     NO `COMMENT ON POLICY ... ON storage.*` statement. The reason
--     for each drop is captured in inline `--` SQL comments instead.
--
-- Why we do not drop the storage bucket:
--   - `delete from storage.buckets` requires `supabase_storage_admin`
--     ownership for the same reason `COMMENT ON POLICY ON storage.*`
--     does. Attempting `delete from storage.buckets where id =
--     'profile-avatars'` from a migration may fail with the same
--     SQLSTATE 42501 insufficient_privilege error.
--   - The bucket itself has zero data after this migration applies
--     (PR-003 never reached production with real user uploads
--     because the deploy chain only just stabilized on 2026-05-24;
--     any test uploads are operator-cleanable via the Supabase
--     dashboard).
--   - Keeping the empty bucket is doctrine-safe: the storage SELECT
--     policy is dropped, so no caller can list its contents; the
--     four `profiles` columns are dropped, so no path string can
--     reference it; the `[functions.upload-avatar]` config block
--     is removed, so the Edge Function is unreachable.
--   - If the operator wants the bucket gone, they can delete it
--     via the Supabase dashboard (Storage -> profile-avatars -> ...)
--     which runs under the dashboard's elevated session and bypasses
--     the privilege boundary. Documented in PR-004 design §17
--     Operator steps.
--
-- Doctrine encoded by this migration:
--   - The four avatar columns on public.profiles are GONE.
--     Anything that referenced them in client code is also gone (the
--     deletion list in design §11 enumerates them).
--   - The profiles UPDATE policy is restored to the pre-PR-003 shape.
--     A user can update their own row (display_name in practice;
--     no other client-writable columns exist on profiles); a
--     moderator/admin can update any row.
--   - The storage bucket policies are gone — no caller can list the
--     bucket. Existing files in the bucket (if any) become
--     unreachable from the client and are operator-cleanable.
--
-- Companion design: docs/designs/PR-004.md §4 + §10.
-- ============================================================

-- ── 1. Drop storage SELECT policy ────────────────────────────
-- The bucket itself is intentionally not dropped (see header). Only
-- the SELECT policy is removed so no caller can list its contents.
DROP POLICY IF EXISTS "profile-avatars: anyone can read" ON storage.objects;

-- ── 2. Drop the four avatar columns ──────────────────────────
-- The CHECK constraint on avatar_moderation_status is dropped
-- automatically when the column is dropped. The IF EXISTS is safety
-- in case a future fresh-database apply executes this migration
-- before 16 (impossible in practice — db reset runs in numeric order
-- — but the guard is cheap).
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS avatar_path,
  DROP COLUMN IF EXISTS avatar_thumb_path,
  DROP COLUMN IF EXISTS avatar_updated_at,
  DROP COLUMN IF EXISTS avatar_moderation_status;

-- ── 3. Drop the narrowed UPDATE policy ───────────────────────
DROP POLICY IF EXISTS "profiles: users update own — narrow" ON public.profiles;

-- ── 4. Restore the original UPDATE policy ────────────────────
-- This is a byte-for-byte restoration of the original policy from
-- 20260516000002_rls_policies.sql lines 69–73. The
-- deprecateAvatarMigration.test.ts assertion (§13) verifies the
-- restored body matches the original. The DROP IF EXISTS immediately
-- before the CREATE makes the migration idempotent against a
-- partial-apply state.
DROP POLICY IF EXISTS "profiles: users update own; mods update any" ON public.profiles;

CREATE POLICY "profiles: users update own; mods update any"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid() OR is_moderator_or_admin())
WITH CHECK (id = auth.uid() OR is_moderator_or_admin());
