---
name: supabase-edge-contract
description: Supabase data + Edge Function patterns for this repo. Invoke when designing or implementing any card that touches the database, RLS, Edge Functions, storage, or auth (especially Epics 6 Evidence, 9 Profile, 10 Hosting). Covers the no-service-role-in-client rule, migration discipline, and the standard Edge Function shape.
---

# Supabase contract — CDiscourse

## Hard rules

1. **No service-role key in client code.** Ever. `SUPABASE_SERVICE_ROLE_KEY` only lives in Supabase secrets, used inside Edge Functions.
2. **No direct insert into `public.arguments` from the client.** Always go through the `submit-argument` Edge Function.
3. **No raw inserts into `flags`, `constitution_versions`, or audit tables from the client.**
4. **RLS is always on.** Never write a migration that disables RLS.
5. **Migrations are append-only.** If a migration has been applied (locally or remote), write a new migration to change it. Never edit an applied file.
6. **Soft-delete only** for `arguments`. Set `is_deleted = true`. Hard delete is a service-role-only operation behind `request-argument-deletion`.
7. **`flags` rows never delete.** Dismiss with `dismissed = true`, `reviewed_by`, `reviewed_at`.

## Edge Function shape — the standard contract

Every Edge Function in `supabase/functions/<name>/index.ts` should:

```ts
import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

serve(async (req) => {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // 2. Auth — verify JWT from caller
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

  // 3. Build caller-scoped client (anon key + the caller's JWT) for caller-scoped reads
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // 4. Build service-role client ONLY if a privileged write is required
  // const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, ...);

  // 5. Validate input — use a schema (zod or hand-written validator)
  // 6. Authorization check — does this caller own this row? Is this caller an admin?
  // 7. Mutate via the narrowest client possible
  // 8. Audit log if the action is non-trivial
  // 9. Return JSON. NEVER include service-role response details, NEVER echo secrets.
});

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
```

### Logging rules inside Edge Functions

- NEVER log: `Authorization` header, `SERVICE_ROLE` key, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, raw user emails (except for the action target), JWTs.
- DO log: function name, caller user id, action target id, decision, duration, error class.

### Response rules

- Errors return a stable shape: `{ error: 'code', message: 'human readable' }`. No stack traces in production.
- Never return another user's PII (email, phone) unless the caller is an admin and the action explicitly requires it.
- The `request-argument-deletion` function NEVER returns admin email addresses to the client.

## RLS pattern library

### Caller-owned reads

```sql
create policy "caller can read own rows" on public.<table>
  for select using (auth.uid() = user_id);
```

### Admin-only update

```sql
create policy "admins can update" on public.<table>
  for update using (public.is_moderator_or_admin());
```

### Insert by author only

```sql
create policy "author can insert" on public.<table>
  for insert with check (auth.uid() = author_id);
```

### Audit-table pattern

Audit rows are insert-only. SELECT for admins. No UPDATE, no DELETE policies at all.

## Migration discipline

- File name: `supabase/migrations/<UTC-timestamp>_<snake_case_description>.sql` (zero-padded, e.g., `20260517000010_add_evidence_artifacts.sql`).
- Each migration is **self-contained** — it must apply against the previous state without manual steps.
- Test locally: `npx supabase db reset` (runs all migrations + seed) before considering done.
- Lint: `npx supabase db lint`.
- For Stage 6.5-6.8, Claude does NOT deploy migrations. Write the file; the operator runs `npx supabase db push --linked`.

## Storage buckets (Epic 9 — avatar work)

For `profile-avatars` (PR-003):

- Bucket policy: public-read opt-in, otherwise signed URL.
- RLS: only the authenticated owner can INSERT/UPDATE/DELETE their own path.
- Path convention: `profile-avatars/<user_id>/avatar-256.jpg`, `profile-avatars/<user_id>/avatar-64.jpg`.
- Server-side resize is preferred. If client uploads original, an Edge Function or scheduled job strips EXIF, resizes, and re-uploads.

## When deploying anything

Claude does NOT deploy. The operator runs:
- `npx supabase db push --linked` for migrations
- `npx supabase functions deploy <name> --linked` for Edge Functions

When you write a migration or function, end the design doc with an explicit "Deploy step (operator): ..." line so the operator knows what to run.

## Common mistakes to refuse

- "Just use service-role from a script in the app" → NO. Move it to an Edge Function.
- "Add an admin escape hatch via a custom header" → NO. Use the existing `is_moderator_or_admin()` SQL function and JWT claims.
- "Disable RLS temporarily to test" → NO. Add a specific policy for the test case or use a service-role test harness.
- "Hard-delete an argument" → NO. Soft-delete + deletion request.
- "Return the admin's email in a flag review response" → NO. Return an opaque admin id or display name.
