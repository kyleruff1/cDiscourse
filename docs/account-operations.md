# CDiscourse — Account Operations

_Last updated: 2026-05-16 (Stage 5.5.6)_

## Account Model

| Layer | What it owns | Where it lives |
|---|---|---|
| Supabase Auth | Login credentials, email, password, JWT session | `auth.users` (Supabase-managed) |
| `public.profiles` | Display name, app role, creation time | Postgres, RLS-protected |
| App session | Selected debate, draft, submission state | AsyncStorage (device-local) |

**Key rules:**
- `profiles.id` is a foreign key to `auth.users.id` — one row per user.
- `profiles.role` controls app-level permissions: `user`, `moderator`, `admin`.
- Role escalation is **backend-only** — no client UI can change roles.
- Auth tokens are never manually stored by the app (Supabase handles storage).
- The app session snapshot is separate from the Supabase auth session.

---

## Profile Auto-Creation

When a new user completes email confirmation, Supabase fires `on_auth_user_created` which calls `public.handle_new_user()`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name', 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

This runs automatically. If a profile is missing after signup (rare edge case), see the backfill query below.

---

## Profile RLS Summary

| Operation | Who | Rule |
|---|---|---|
| SELECT | Any authenticated user | All profiles readable (display names needed for UI) |
| INSERT | Authenticated user (own row) | `id = auth.uid()` |
| UPDATE | User (own row), mod/admin (any row) | Display name only; role changes are backend-only |
| DELETE | Prohibited | No delete policy |

---

## Safe Backend Maintenance Tools

| Tool | Use for |
|---|---|
| Supabase Dashboard → Authentication → Users | View/disable/delete auth users, reset passwords, view email confirmation status |
| Supabase Dashboard → Table Editor → profiles | View/edit profile rows |
| Supabase SQL Editor | Run maintenance queries (backfill, role promote/demote) |
| Supabase CLI | Migrations, function deployment, secret management |

**Never** put `SUPABASE_SERVICE_ROLE_KEY` in the Expo app or `.env`.

---

## Common Account Operations (SQL Editor)

All queries below use placeholders. Run in Supabase Dashboard → SQL Editor.

### List all users with their profile role

```sql
SELECT
  au.id,
  au.email,
  au.created_at,
  p.display_name,
  p.role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
ORDER BY au.created_at DESC;
```

### Find a user by email

```sql
SELECT au.id, au.email, p.display_name, p.role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE au.email = '<user-email>';
```

### Find users with missing profile rows

```sql
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ORDER BY au.created_at DESC;
```

### Backfill a missing profile row

```sql
INSERT INTO public.profiles (id, display_name, role)
SELECT id, raw_user_meta_data ->> 'display_name', 'user'
FROM auth.users
WHERE id = '<user-uuid>'
ON CONFLICT (id) DO NOTHING;
```

### Backfill all missing profiles at once

```sql
INSERT INTO public.profiles (id, display_name, role)
SELECT au.id, au.raw_user_meta_data ->> 'display_name', 'user'
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

### Update display name (backend)

```sql
UPDATE public.profiles
SET display_name = '<new-display-name>'
WHERE id = '<user-uuid>';
```

### Promote a user to moderator

```sql
UPDATE public.profiles
SET role = 'moderator'
WHERE id = (
  SELECT id FROM auth.users WHERE email = '<user-email>'
);
```

### Demote a user back to regular participant

```sql
UPDATE public.profiles
SET role = 'user'
WHERE id = (
  SELECT id FROM auth.users WHERE email = '<user-email>'
);
```

### Promote to admin

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = '<user-email>'
);
```

### List all arguments by a user

```sql
SELECT a.id, a.argument_type, a.side, a.body, a.created_at, d.resolution
FROM public.arguments a
JOIN public.debates d ON d.id = a.debate_id
WHERE a.author_id = (
  SELECT id FROM auth.users WHERE email = '<user-email>'
)
ORDER BY a.created_at DESC;
```

### List all debates created by a user

```sql
SELECT d.id, d.resolution, d.created_at
FROM public.debates d
WHERE d.created_by = (
  SELECT id FROM auth.users WHERE email = '<user-email>'
)
ORDER BY d.created_at DESC;
```

### List moderation flags for a user's arguments

```sql
SELECT af.id, af.flag_code, af.severity, af.status, af.created_at, a.body
FROM public.argument_flags af
JOIN public.arguments a ON a.id = af.argument_id
WHERE a.author_id = (
  SELECT id FROM auth.users WHERE email = '<user-email>'
)
ORDER BY af.created_at DESC;
```

---

## Disable or Delete an Auth User

**Use the Supabase Dashboard** — do not delete auth users from Postgres directly.

1. Go to Dashboard → Authentication → Users
2. Find the user by email
3. Use "Block user" to disable (reversible) or "Delete user" (irreversible)
4. Deleting `auth.users` will cascade-delete the `public.profiles` row (ON DELETE CASCADE)
5. Arguments and debates created by that user will remain (`ON DELETE RESTRICT` or `SET NULL` depending on table)

**Do not:**
- Manually delete from `auth.users` via SQL unless you understand the cascade implications
- Create a client-side delete/ban flow
- Expose admin role-change RPCs to regular authenticated users

---

## Profile Row Recovery After Signup

If a user signs up but no profile row appears:

1. Check `auth.users` for the user's row and confirm email is confirmed
2. Run the backfill query above
3. If the trigger failed, check Supabase Dashboard → Edge Functions → Logs

---

## Warnings

- Do not edit `auth.users` credentials directly (use Dashboard or Auth API)
- Do not put `SUPABASE_SERVICE_ROLE_KEY` in `.env`, client code, or any committed file
- Do not create admin-only client screens until role/RLS patterns are proven in production
- Do not expose role-changing RPCs to normal authenticated users via Edge Functions without careful RLS
- Role label mapping: `user` → "Participant", `moderator` → "Moderator", `admin` → "Admin"
