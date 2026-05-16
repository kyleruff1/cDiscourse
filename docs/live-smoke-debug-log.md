# CDiscourse — Live Smoke Debug Log

Records observed symptoms, root causes, and resolutions found during browser smoke tests. No secrets, JWTs, API keys, or auth headers are recorded here.

---

## Entry 1 — Stage 5.5.6.1 — 2026-05-16

### Observation

| Field | Value |
|---|---|
| Date | 2026-05-16 |
| Stage | 5.5.6.1 |
| Browser URL | http://localhost:8081 |
| Affected tab | Debates |
| Symptom | `infinite recursion detected in policy for relation "debates"` |
| UI state | Empty state: "No debates yet. Tap + New to start the first debate." |
| Other tabs | Auth, Account, Composer not tested (blocked by this error) |

### Logs Checked

| Source | Checked | Finding |
|---|---|---|
| Supabase API logs (Dashboard → Logs) | yes | REST GET /rest/v1/debates returned error |
| Supabase Postgres logs | yes | `infinite recursion detected in policy for relation "debates"` |
| Browser DevTools Console | yes | Error propagated to client via PostgREST 500 |
| No secret values copied | yes | — |

### SQL Inspection Queries Used

```sql
-- Identify recursive policy paths
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('debates', 'debate_participants', 'profiles')
ORDER BY tablename, policyname;
```

### Root Cause

**RLS mutual recursion between `debates` and `debate_participants`.**

Exact loop:

1. Client fetches `GET /rest/v1/debates` → triggers `debates` SELECT RLS policy.
2. `"debates: select open, own, or participant"` policy (migration 0002) contains:
   ```sql
   OR EXISTS (
     SELECT 1 FROM public.debate_participants
     WHERE debate_id = id AND user_id = auth.uid()
   )
   ```
3. This subquery reads `debate_participants` → triggers `debate_participants` SELECT RLS policy.
4. `"debate_participants: select own or open debate"` policy contains:
   ```sql
   OR EXISTS (
     SELECT 1 FROM public.debates
     WHERE id = debate_id AND status IN ('open', 'locked')
   )
   ```
5. This subquery reads `debates` → triggers `debates` SELECT RLS policy again → **infinite recursion**.

Secondary recursion (on INSERT into `debate_participants`):
- `"debate_participants: users join as themselves"` (WITH CHECK) also queries `debates` directly → same loop.

### Migration Applied

**`supabase/migrations/20260516000006_fix_debates_rls_recursion.sql`**

Strategy: Replace the two cross-table subqueries with narrow `SECURITY DEFINER` helper functions. SECURITY DEFINER functions run as the function owner (postgres superuser in Supabase), bypassing RLS on the tables they query. This breaks the recursion loop without weakening policy intent.

New helpers:
- `public.is_debate_participant(p_debate_id uuid, p_user_id uuid)` — queries `debate_participants` as definer (no RLS)
- `public.is_debate_joinable(p_debate_id uuid)` — queries `debates` as definer (no RLS)
- `public.is_debate_open_or_locked(p_debate_id uuid)` — queries `debates` as definer (no RLS)

Policies replaced (drop + recreate):
- `"debates: select open, own, or participant"` — now calls `is_debate_participant(id, auth.uid())`
- `"debate_participants: select own or open debate"` — now calls `is_debate_open_or_locked(debate_id)`
- `"debate_participants: users join as themselves"` — now calls `is_debate_joinable(debate_id)`

No RLS was weakened. No service-role key was added to the client. No destructive DB reset was run.

### Verification

| Step | Result |
|---|---|
| `npx supabase db push` | ✅ Migration 0006 applied — 3 policies recreated, 3 helpers created |
| `npx supabase db push --dry-run` | ✅ Remote database is up to date |
| `npx supabase functions list` | ✅ submit-argument ACTIVE |
| Browser smoke test — Debates tab | 🔲 Pending user retest |
| Browser smoke test — Create debate | 🔲 Pending user retest |
| Browser smoke test — Join debate | 🔲 Pending user retest |

### Remaining Smoke-Test Items

After verifying Debates tab loads:
- B. Auth: sign in, sign out, session persist
- C. Debate: create, join, select
- D. Argument tree
- E/F. Composer root and reply
- G. Submit flow
- H. Session recovery
- I. Responsive layout
- J. Console errors
- K. Account tab

---

## Entry 2 — Stage 6.1.2.1 — 2026-05-16

### Observation

| Field | Value |
|---|---|
| Date | 2026-05-16 |
| Stage | 6.1.2.1 |
| Browser URL | http://localhost:8081 (operator-driven) |
| Symptom (pre-bootstrap) | Account tab showed `ADMIN? false` for the dev human user |
| Root cause | `profiles.role` had not yet been promoted to `admin` for that user |
| Resolution | Ran `scripts/admin/bootstrap-admin.local.sql` via `npx supabase db query --linked --file …`. Verification row returned `role=admin`, `is_admin=true` |

### Verification

| Step | Result |
|---|---|
| Migration 0007 applied | ✅ remote DB reports "up to date" |
| `admin-users` function deployed | ✅ ACTIVE v1 |
| Bootstrap SQL ran | ✅ one row updated; verification row confirms `is_admin=true` |
| Account tab `ADMIN? true` (post-refresh) | 🔲 pending operator browser refresh |
| Admin tab visible | 🔲 pending operator browser refresh |

### Notes

- After bootstrap SQL runs, the Expo app may need a hard refresh (clear cache and reload) for the new role to flow through `useAccountProfile` and `getVisibleTabs`. The role is fetched on screen mount.
- Bootstrap script is at `scripts/admin/bootstrap-admin.local.sql` (gitignored). Committed template at `scripts/admin/bootstrap-admin.sql.template`.
- No secrets exposed in this entry.
