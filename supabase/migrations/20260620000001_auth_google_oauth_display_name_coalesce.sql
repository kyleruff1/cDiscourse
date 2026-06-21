-- ──────────────────────────────────────────────────────────────
-- AUTH-GOOGLE-SSO-004 (#747) — coalesce OAuth metadata into display_name.
--
-- WHAT THIS FIXES
--   The original handle_new_user() (20260516000001_initial_schema.sql:37-49)
--   read ONLY `raw_user_meta_data ->> 'display_name'`. That is the key the
--   email/password signup path sets (authApi.ts:108 → options.data.display_name).
--   A Google (OIDC) identity instead carries the human name under `full_name`
--   / `name`, with component parts `given_name` / `family_name`. So a Google
--   first sign-in provisioned a profile row with a NULL display_name.
--   This migration CREATE OR REPLACEs the function body to COALESCE a display
--   name across the known auth-metadata shapes, with an email-local-part
--   fallback and a stable generic last resort.
--
-- HOW (priority — each candidate trimmed, inner whitespace collapsed, empty->NULL)
--   1. display_name  (email/password path; MUST stay first to preserve behavior)
--   2. full_name     (Google OIDC standard claim)
--   3. name          (Google OIDC standard claim)
--   4. given_name + family_name (either or both present)
--   5. email local-part (split before '@')
--   6. generic fallback 'Member' (only reached if email is absent — a Google
--      OAuth user effectively always has a verified email, so step 6 is a true
--      last resort, not an expected Google outcome)
--
-- IDEMPOTENCY / NO-CLOBBER GUARANTEE
--   The INSERT keeps `ON CONFLICT (id) DO NOTHING` verbatim. The conflict
--   target is `id` (the auth.users uuid, the profiles PK), NEVER email, so
--   there is no enumeration surface and no same-email takeover: a trigger
--   re-fire, retry, or a future #748 client self-heal can never clobber a
--   user-edited display_name. First writer wins; the rest are no-ops.
--
-- CAP
--   The coalesced value is capped with `left(…, 60)`. 60 matches the app-side
--   edit limit DISPLAY_NAME_MAX (src/features/account/ContactInfoSection.tsx)
--   and the pure-TS twin's DISPLAY_NAME_DB_CAP
--   (src/features/auth/coalesceProviderDisplayName.ts). Keep all three equal.
--
-- EMAIL/PASSWORD EMPTY-STRING DELTA (the one intended behavioral change)
--   The email/password signup form labels display name "(optional)"; its
--   validator (authApi.ts validateAuthInput) requires only email + password,
--   and AuthScreen passes `displayName.trim() || undefined`, which authApi
--   stores as `display_name: displayName ?? ''`. So a user who signs up by
--   email/password and LEAVES THE OPTIONAL NAME BLANK lands with
--   raw_user_meta_data.display_name = '' TODAY — this delta IS REACHABLE in
--   practice, not just theoretical. Under the old trigger that empty string
--   was stored as profiles.display_name = ''. Under this function the empty
--   '' normalizes to NULL and falls through to the email local-part (or
--   'Member' if email is somehow absent). This is a strict improvement and is
--   the ONLY behavioral delta for the email/password path; a non-empty
--   display_name is byte-identical to today.
--
-- WHY NO `CREATE TRIGGER` HERE
--   `CREATE OR REPLACE FUNCTION` swaps the body in place. The existing trigger
--   `on_auth_user_created` (20260516000001_initial_schema.sql:51-53) keeps
--   pointing at the same function name, so it is NOT touched / re-created.
--
-- DEPENDENCY NOTE (function/extension deps)
--   Reads `NEW.email` (a column on the trigger's own auth.users row) and
--   `NEW.raw_user_meta_data`. No cross-schema table read is added, so
--   `SET search_path = public` is sufficient — do NOT widen to `public, auth`.
--   split_part / concat_ws / regexp_replace / btrim / nullif / left are
--   pg_catalog builtins and resolve regardless of search_path.
--
-- APPEND-ONLY / SECURITY DISCIPLINE
--   This is a NEW migration; it does NOT edit the applied 20260516000001.
--   No GRANT/REVOKE change (CREATE OR REPLACE preserves ownership + ACLs).
--   No ALTER TABLE, no RLS / policy change, no service_role, no secret.
--
-- GATE-C — migration-bearing → merge = apply.
--   Merging this PR auto-applies the migration to the remote DB via the
--   Supabase GitHub integration. The implementer never applies it remotely;
--   never run `supabase db push` from this card.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
BEGIN
  -- Coalesce a display name across the known auth-metadata shapes.
  -- Priority (each candidate trimmed, inner whitespace collapsed, empty -> NULL):
  --   1. display_name  (email/password path; MUST stay first to preserve current behavior)
  --   2. full_name     (Google OIDC standard claim)
  --   3. name          (Google OIDC standard claim)
  --   4. given_name + family_name (handles either or both present)
  --   5. email local-part (split before '@')
  --   6. generic fallback 'Member' (only reached if email is absent)
  v_display_name := COALESCE(
    nullif(btrim(regexp_replace(NEW.raw_user_meta_data ->> 'display_name', '\s+', ' ', 'g')), ''),
    nullif(btrim(regexp_replace(NEW.raw_user_meta_data ->> 'full_name',    '\s+', ' ', 'g')), ''),
    nullif(btrim(regexp_replace(NEW.raw_user_meta_data ->> 'name',         '\s+', ' ', 'g')), ''),
    nullif(btrim(regexp_replace(
      concat_ws(' ',
        nullif(btrim(NEW.raw_user_meta_data ->> 'given_name'),  ''),
        nullif(btrim(NEW.raw_user_meta_data ->> 'family_name'), '')
      ), '\s+', ' ', 'g')), ''),
    nullif(btrim(split_part(NEW.email, '@', 1)), ''),
    'Member'
  );

  -- Cap to the app-side edit limit (ContactInfoSection DISPLAY_NAME_MAX = 60).
  v_display_name := left(v_display_name, 60);

  INSERT INTO public.profiles (id, display_name, role)
  VALUES (NEW.id, v_display_name, 'user')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
