# CDiscourse — Admin Bootstrap

_Stage 6.1.2 — 2026-05-16_

## Promoting your first admin

The Stage 6.1.2 migration (`20260516000007_stage6_admin_operations.sql`) does NOT hard-code any user as admin. You must promote your dev account manually.

### Steps

1. Sign up (or sign in once) with your dev admin email so the auth + profile rows exist.
   - For this project: **kyleruff+devtests1@gmail.com**
2. Open the Supabase Dashboard → SQL Editor for the dev project (`qsciikhztvzzohssddrq`).
3. Copy the SQL from `scripts/admin/bootstrap-admin.sql.template` (template) or use the local-only copy at `scripts/admin/bootstrap-admin.local.sql` (gitignored, contains your real email pre-filled).
4. Substitute `<admin-email>` with your dev admin email if using the template.
5. Run the script in SQL Editor. The verification query should return one row with `role = 'admin'` and `is_admin = true`.
6. Refresh the Expo app. The Account tab should now show `ADMIN? true` and the top-level **Admin** tab should appear.

### Verify SQL (copy-pasteable)

Substitute the email below before running:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('<admin-email>');

select
  u.id,
  u.email,
  p.display_name,
  p.role,
  public.is_admin(u.id) as is_admin
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('<admin-email>');
```

### Why not put the email in a migration?

- Migrations are committed source code. Personal emails should not be embedded in version control of a multi-environment app.
- Different environments (dev, staging, prod) need different admins.
- Promotion is a one-time bootstrap; subsequent admins should be granted via the Admin Users UI (which writes to `admin_audit_events`).

### Promoting additional admins later

Use the Admin Users tab:

1. Sign in as admin.
2. Find the target user by email/name.
3. Open detail panel → enter reason → check "Confirm admin grant" → tap "Promote to admin."

The action runs through `admin-users` and writes an audit event.

### Safety notes

- Never share the SQL Editor URL or service-role key.
- Never commit `scripts/admin/bootstrap-admin.local.sql` (it's gitignored).
- Do not promote production users without a documented reason.
- The Edge Function blocks demoting the last admin, but the bootstrap SQL does not — only run it on accounts you control.
