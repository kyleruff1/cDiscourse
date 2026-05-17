-- ============================================================
-- Migration: 20260517000008_stage6_1_8_argument_deletion_requests
-- Description: Argument-deletion request workflow (Stage 6.1.8).
--
--   - Users cannot delete arguments directly.
--   - They can REQUEST deletion of their own argument.
--   - Admins review and resolve the request.
--   - No row in `public.arguments` is ever auto-deleted by this migration.
--
-- RLS:
--   - Authenticated user can insert a request ONLY for an argument they
--     authored (verified via `arguments.author_id = auth.uid()`).
--   - Authenticated user can SELECT their OWN requests.
--   - Admins can SELECT and UPDATE all requests.
--   - Normal users CANNOT UPDATE status; UPDATE is admin-only.
-- ============================================================

create table if not exists public.argument_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  argument_id uuid not null references public.arguments(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  admin_note text,
  constraint argument_deletion_requests_status_check
    check (status in ('requested', 'reviewing', 'approved', 'rejected', 'cancelled')),
  constraint argument_deletion_requests_reason_length
    check (reason is null or char_length(reason) <= 2000),
  constraint argument_deletion_requests_admin_note_length
    check (admin_note is null or char_length(admin_note) <= 2000)
);

create index if not exists argument_deletion_requests_argument_idx
  on public.argument_deletion_requests (argument_id);
create index if not exists argument_deletion_requests_requester_idx
  on public.argument_deletion_requests (requester_id);
create index if not exists argument_deletion_requests_status_idx
  on public.argument_deletion_requests (status);

-- One OPEN request per (requester, argument) — closed requests do not block.
create unique index if not exists argument_deletion_requests_one_open_per_argument
  on public.argument_deletion_requests (argument_id, requester_id)
  where status in ('requested', 'reviewing');

alter table public.argument_deletion_requests enable row level security;

-- ── INSERT: requester must be the argument's author. ──
drop policy if exists adr_insert_own_argument on public.argument_deletion_requests;
create policy adr_insert_own_argument
  on public.argument_deletion_requests
  for insert
  with check (
    auth.uid() = requester_id
    and exists (
      select 1 from public.arguments a
      where a.id = argument_id
        and a.author_id = auth.uid()
        and a.debate_id = debate_id
    )
  );

-- ── SELECT: requester sees own; admins see all. ──
drop policy if exists adr_select_own_or_admin on public.argument_deletion_requests;
create policy adr_select_own_or_admin
  on public.argument_deletion_requests
  for select
  using (
    auth.uid() = requester_id
    or public.is_admin(auth.uid())
  );

-- ── UPDATE: admins only. ──
drop policy if exists adr_update_admin_only on public.argument_deletion_requests;
create policy adr_update_admin_only
  on public.argument_deletion_requests
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ── DELETE: nobody via PostgREST. (Admins use service_role from Edge Function only if needed.) ──
drop policy if exists adr_no_delete on public.argument_deletion_requests;

comment on table public.argument_deletion_requests is
  'Stage 6.1.8: users request deletion of their own arguments. Admins review and resolve. No row in public.arguments is auto-deleted.';
