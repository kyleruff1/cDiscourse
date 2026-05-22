# Row Level Security — CDiscourse

All user-facing tables have RLS enabled. The `service_role` key (used by Edge Functions and Supabase admin) bypasses RLS entirely — no policies are required for it. The `anon` role has no access to any table (no policies for it exist).

---

## Role Model

| Role | How it's used | RLS applies? |
|---|---|---|
| `authenticated` | Any logged-in Supabase user | Yes |
| `anon` | Unauthenticated requests | Yes (blocked by absence of policies) |
| `service_role` | Edge Functions, migrations, admin tooling | **No** — bypasses RLS |

**Important**: The `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key) in the client app grants the `authenticated` role after `supabase.auth.signIn()`. The `SUPABASE_SERVICE_ROLE_KEY` is never in the client bundle — it is set only as a Supabase Edge Function secret.

---

## Helper Function

```sql
public.is_moderator_or_admin() → boolean
```

Returns `true` if `auth.uid()` has `role = 'moderator'` or `role = 'admin'` in the `profiles` table. Used in most policies rather than duplicating the lookup.

Declared `SECURITY DEFINER` with `SET search_path = public` to prevent privilege escalation via search-path injection.

---

## Policy Table

| Table | Operation | Who | Condition |
|---|---|---|---|
| `profiles` | SELECT | authenticated | always |
| `profiles` | INSERT | authenticated | `id = auth.uid()` |
| `profiles` | UPDATE | authenticated | own row OR mod/admin |
| `constitution_versions` | SELECT | authenticated | always |
| `constitution_versions` | INSERT | authenticated | mod/admin only |
| `constitution_rules` | SELECT | authenticated | always |
| `constitution_rules` | INSERT | authenticated | mod/admin only |
| `constitution_rules` | UPDATE | authenticated | mod/admin only |
| `tag_definitions` | SELECT | authenticated | always |
| `tag_definitions` | ALL | authenticated | mod/admin only |
| `flag_definitions` | SELECT | authenticated | always |
| `flag_definitions` | ALL | authenticated | mod/admin only |
| `debates` | SELECT | authenticated | open/locked, own, participant, OR mod/admin |
| `debates` | INSERT | authenticated | `created_by = auth.uid()` |
| `debates` | UPDATE | authenticated | creator OR mod/admin |
| `debate_participants` | SELECT | authenticated | own membership, open debate, OR mod/admin |
| `debate_participants` | INSERT | authenticated | `user_id = auth.uid()` |
| `debate_participants` | DELETE | authenticated | own OR mod/admin |
| `arguments` | SELECT | authenticated | posted+open-debate, own, OR mod/admin |
| `arguments` | INSERT | authenticated | `author_id = auth.uid()` |
| `arguments` | UPDATE | authenticated | own OR mod/admin |
| `argument_tags` | SELECT | authenticated | mirrors argument visibility |
| `argument_tags` | INSERT | authenticated | own argument OR mod/admin |
| `argument_tags` | DELETE | authenticated | own tag OR mod/admin |
| `argument_flags` | SELECT | authenticated | own argument, debate participant, OR mod/admin |
| `argument_flags` | INSERT | authenticated | `source IN ('user_report','client_rules')` + `created_by = auth.uid()` |
| `argument_flags` | UPDATE | authenticated | mod/admin only |
| `topic_satisfaction_checks` | SELECT | authenticated | own argument, debate participant, OR mod/admin |
| `topic_satisfaction_checks` | INSERT | authenticated | **blocked** (`WITH CHECK (false)`) — service_role only |
| `moderation_reviews` | SELECT | authenticated | mod/admin only |
| `moderation_reviews` | INSERT | authenticated | mod/admin + `reviewer_id = auth.uid()` |
| `audio_submissions` | SELECT | authenticated | own OR mod/admin |
| `audio_submissions` | INSERT | authenticated | `user_id = auth.uid()` |
| `audio_submissions` | UPDATE | authenticated | own row while `transcript_status = 'uploaded'` |
| `argument_room_links` | SELECT | authenticated | source room visible (open/locked, source-room participant, OR mod/admin) — active rows only |
| `argument_room_links` | INSERT | authenticated | source-room participant, `created_by = auth.uid()` (+ `link_target_must_be_locked` trigger: target is a settled, readable room) |
| `argument_room_links` | UPDATE | authenticated | link author OR mod/admin — soft-remove only (`link_columns_immutable` trigger: only `is_removed` may change) |

---

## Per-Table Policy Notes

### `profiles`

- **Role escalation prevention**: the UPDATE policy allows users to modify their own row, but does not restrict which columns they change via RLS alone. The application layer (or an Edge Function) must reject attempts to self-promote `role`. A column-level privilege or a separate BEFORE trigger can enforce this in a later stage.
- The auth trigger (`handle_new_user`) runs as `SECURITY DEFINER` and can write `profiles` without being subject to the INSERT policy.

### `constitution_versions` and `constitution_rules`

- Both are effectively **read-only for users**. Only moderators/admins may insert new versions or rules. There are no UPDATE or DELETE policies for users because the constitution is treated as append-only reference data.

### `debates`

- Draft debates (`status = 'draft'`) are visible only to the creator and mods. This allows creators to prepare a debate before publishing.
- Locked debates remain readable — they just don't accept new arguments. The application layer enforces the no-new-arguments rule; the RLS allows reading.

### `argument_room_links` — Cross-room reference (QOL-042)

- A row links a **source** (new) room to a **target** (prior, settled) room as read-only context. There is **no DELETE policy** — links are soft-removed via `is_removed = true` (the soft-delete doctrine, mirroring `arguments` / `point_tags`).
- **The access check is RLS-enforced, not UI-only.** A link row carries no prior-room content, so SELECT gates on the *source* room's visibility. The prior room's *body / nodes* are read separately through the existing `debates` / `arguments` SELECT policies under the caller's JWT — an unauthorized viewer of a private prior room gets zero `arguments` rows there. The only denormalized field is `target_title_snapshot` (the prior room's title, ≤200 chars), so a title-only viewer sees the title but never the content.
- **Two BEFORE triggers replace recursive `WITH CHECK` subqueries.** `link_target_must_be_locked` (BEFORE INSERT) rejects the insert unless the target is a `locked` room the inserting user can read (it calls the existing `is_debate_open_or_locked` / `is_debate_participant` / `is_moderator_or_admin` SECURITY DEFINER helpers — no subquery into `debates` inside a policy, avoiding the recursion the `…0006` migration fixed). `link_columns_immutable` (BEFORE UPDATE) rejects any change to a column other than `is_removed`, so the link is immutable after creation and can never re-open or mutate the locked prior room.
- **QOL-039 (visibility) is a soft dependency.** Until `debates.visibility` exists, readability uses `is_debate_open_or_locked` alone (every open/locked room is content-readable); the title-only state is latent. When QOL-039 lands, a follow-up migration swaps in the visibility-aware source-readability helper.

### `argument_flags` — Source Authority

The `source` column encodes who raised the flag:

| Source | Inserted by | RLS path |
|---|---|---|
| `client_rules` | Client app (non-authoritative) | `authenticated` INSERT policy |
| `server_rules` | Edge Function (authoritative) | `service_role` bypasses RLS |
| `semantic_adapter` | Edge Function (AI, non-authoritative) | `service_role` bypasses RLS |
| `user_report` | End user | `authenticated` INSERT policy |
| `moderator` | Moderator/admin via app | `service_role` or future mod-only INSERT policy |

The `authenticated` INSERT policy only allows `source IN ('user_report', 'client_rules')`. Any attempt to insert `server_rules` or `semantic_adapter` flags directly from the client is blocked by RLS. Edge Functions use the service role key and bypass RLS.

### `topic_satisfaction_checks`

The INSERT policy explicitly uses `WITH CHECK (false)` to block all `authenticated` inserts. This is a safety guard — topic checks are only meaningful when produced server-side. Even if the client somehow tries to insert a fake check, it will be rejected.

### `moderation_reviews`

No UPDATE or DELETE policies exist. This is intentional: the table is an immutable decision log. If a reviewer changes their mind, they insert a new row (e.g. first `dismiss`, then `escalate`). The most-recent row is the current decision.

---

## Edge Function Security Pattern

Edge Functions should:
1. Use `SUPABASE_SERVICE_ROLE_KEY` (never the anon/publishable key) when writing authoritative data (`server_rules` flags, topic checks, transcript status updates).
2. Extract the caller's JWT from the `Authorization` header to verify the request came from an authenticated user before taking action on their behalf.
3. Never return the service role key or any internal credential to the client.

```typescript
// Pattern inside an Edge Function
import { createClient } from '@supabase/supabase-js';

// Admin client — bypasses RLS; use for authoritative writes
const adminClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// User client — scoped to the caller; respects RLS; use for reads on their behalf
const userClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
);
```

---

## Security Notes

| Risk | Mitigation |
|---|---|
| Anon key exposed in client bundle | Acceptable — RLS is the guard; anon key alone grants nothing without a valid JWT |
| Service role key in client code | **Never** — it's a Supabase Edge Function secret only |
| User self-promotes role | RLS UPDATE policy permits own-row updates; application layer and/or trigger must reject role changes by non-admins |
| Fake `server_rules` flag inserted by client | Blocked: `authenticated` INSERT policy on `argument_flags` restricts `source` to `user_report` and `client_rules` |
| Topic check spoofing | INSERT policy is `WITH CHECK (false)` for authenticated — only service_role can insert |
| Moderator review spam | INSERT policy requires `reviewer_id = auth.uid()` and `is_moderator_or_admin()` — two checks |
| Cross-debate data leak | Debate-scoped queries use `debate_id` foreign keys; argument SELECT policy joins through `debates` status |
