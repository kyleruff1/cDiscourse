-- ============================================================
-- Migration: 20260524000014_qol_040_room_notifications
-- Description: QOL-040 — room_notifications table + RLS for the
--   in-app notification lifecycle (10 triggers — invite,
--   new_response, concession_challenged, source_requested,
--   evidence_supplied, chime_in_posted, room_made_private,
--   chime_in_rejected, argument_settled,
--   invite_accepted_by_invitee). Insertion is service-role only;
--   the client SELECTs its own rows and UPDATEs only read_at.
--
-- Sequential after `20260524000013_qol_038_argument_room_invites.sql`.
--
-- Extension dependencies:
--   - `pgcrypto` is required for `gen_random_uuid()` in the column
--     default. Supabase enables pgcrypto by default in the public
--     schema; verified for this project at 2026-05-24. The same
--     `gen_random_uuid()` default is used by every prior migration
--     in this repo (argument_room_invites, concession_items,
--     point_tags, etc.). Per OPS-001 §4 "function/trigger/extension
--     dependencies", the dependency is documented here in the
--     header rather than asserted at apply time — re-create-
--     extension-if-not-exists is intentionally avoided to keep this
--     migration's footprint to just the new objects.
--
-- Doctrine encoded by this migration:
--   - RLS enabled. No INSERT / DELETE policy for the
--     `authenticated` role. Every write goes through the
--     `room-notifications` Edge Function's service-role client (or
--     the side-effect insert inside `submit-argument`). This
--     mirrors the `annotate-evidence`, `request-argument-deletion`,
--     and `manage-room-invite` precedents — a notification's
--     recipient set is a TRUST decision (who is a primary, who
--     had access before a transition). Letting clients insert
--     would let a user fabricate a notification addressed to
--     anyone.
--   - SELECT policy: a user reads only their OWN notifications.
--   - UPDATE policy: a user updates only their OWN row. The
--     PostgREST WITH CHECK cannot, by itself, restrict the column
--     set — but the only meaningful column for a recipient to
--     change is `read_at`. The API wrapper at
--     `src/features/notifications/notificationsApi.ts` scopes
--     every client write to `.update({ read_at: … })`. The blast
--     radius of a malicious recipient overwriting their OWN
--     `room_title` is only their own view — acceptable per design
--     §6.1.
--   - Rows are NEVER hard-deleted by clients (no DELETE policy).
--     The cascade on (debates.id, auth.users.id) handles cleanup
--     when a room is removed or a user account is deleted.
--   - The `type` CHECK enumerates the EXACT ten triggers QOL-040
--     ships. An eleventh trigger (`invite_expired_notice`) is
--     intentionally deferred per the design's enrichment E2.3 —
--     adding it later is a NEW migration, not an edit of this
--     one (per cdiscourse-doctrine §8: migrations are
--     append-only).
--   - `room_title` is the ONLY room content a notification ever
--     carries. The 200-char CHECK keeps the cell from becoming a
--     side channel for body text. See design §9 rule 1.
--   - `meta` is a tiny JSONB for neutral nouns (classification
--     label, `roomIsPrivate`, actor-name visibility gate). The
--     Edge Function NEVER puts argument body text into `meta`.
--
-- Statement order (OPS-001 §4 Class 3):
--   1. create table
--   2. create index
--   3. enable row level security
--   4. create policy
--
-- All column references inside RLS policies are fully qualified
-- (`room_notifications.recipient_id`) per OPS-001 defensive
-- discipline, even though no subquery joins are present in v1.
--
-- Companion design: docs/designs/QOL-040.md §6.1 + E2 + E4.
-- ============================================================

-- ── Table ────────────────────────────────────────────────────

create table if not exists public.room_notifications (
  id            uuid        primary key default gen_random_uuid(),
  -- The user this notification is addressed to. Hard FK to
  -- auth.users — if the account is deleted, the notification is
  -- cascade-removed so the row never points at a missing user.
  recipient_id  uuid        not null references auth.users(id) on delete cascade,
  -- The room the notification is about. Hard FK to debates — if
  -- the room is hard-deleted, the notification is cascade-removed.
  debate_id     uuid        not null references public.debates(id) on delete cascade,
  -- The node to open on deep-link tap. NULL for room-level
  -- notifications (argument_settled, room_made_private,
  -- invite, invite_accepted_by_invitee). If the argument is
  -- soft-deleted (status='deleted'), the FK still resolves; if it
  -- is hard-deleted (rare), this column flips to NULL via SET NULL
  -- and the deep link falls back to the room root.
  argument_id   uuid        references public.arguments(id) on delete set null,
  -- Discriminator. The list is the EXACT ten triggers QOL-040
  -- ships. An eleventh trigger (`invite_expired_notice`) is
  -- intentionally deferred per design enrichment E2.3.
  type          text        not null check (type in (
                              'invite',
                              'new_response',
                              'concession_challenged',
                              'source_requested',
                              'evidence_supplied',
                              'chime_in_posted',
                              'room_made_private',
                              'chime_in_rejected',
                              'argument_settled',
                              'invite_accepted_by_invitee'
                            )),
  -- Denormalised room-title SNAPSHOT at delivery time. See design
  -- §6.1 + §9 — this is the ONLY room content a notification ever
  -- carries, and only because the recipient was authorised at the
  -- moment of delivery. 200-char CHECK keeps this cell from being
  -- abused as a body-text side channel.
  room_title    text        not null default '',
  -- Optional neutral metadata. The Edge Function NEVER puts
  -- argument body text into this JSONB. Allowed keys (per
  -- notificationModel.NotificationMeta): classification,
  -- roomIsPrivate, actorNameVisible, actorDisplayName.
  meta          jsonb       not null default '{}',
  -- TRUE once the recipient opens the notification. NULL means
  -- unread; not-NULL means read at that timestamp.
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  constraint room_notifications_room_title_length
    check (char_length(room_title) <= 200)
);

-- ── Indexes ──────────────────────────────────────────────────

-- Newest-first list for a recipient (the dominant read path —
-- the notification list screen).
create index if not exists room_notifications_recipient_idx
  on public.room_notifications (recipient_id, created_at desc);

-- Unread-count index (the badge / `loadUnreadCount` path).
create index if not exists room_notifications_unread_idx
  on public.room_notifications (recipient_id)
  where read_at is null;

-- Idempotency partial unique index for argument-derived triggers.
-- A retried Edge Function invocation is then a no-op insert (the
-- unique violation is caught and treated as success). Triggers
-- without an argument_id (settled, made-private, invite,
-- invite_accepted_by_invitee) are naturally low-frequency and
-- one-shot — no index needed.
create unique index if not exists room_notifications_arg_dedup_idx
  on public.room_notifications (recipient_id, type, argument_id)
  where argument_id is not null;

-- ── RLS ──────────────────────────────────────────────────────

alter table public.room_notifications enable row level security;

-- SELECT: a user sees ONLY their own notifications.
create policy room_notifications_select_own
  on public.room_notifications
  for select
  using (auth.uid() = room_notifications.recipient_id);

-- UPDATE: a user may update ONLY their own row. The API wrapper
-- pins the write to .update({ read_at }); the row is already the
-- recipient's, so the only meaningful column for them to change
-- is read_at. See design §6.1 for the explicit acceptance of this
-- scope.
create policy room_notifications_update_own_read
  on public.room_notifications
  for update
  using (auth.uid() = room_notifications.recipient_id)
  with check (auth.uid() = room_notifications.recipient_id);

-- INSERT: NO policy. Notifications are inserted ONLY by the
-- service-role client inside the submit-argument and
-- room-notifications Edge Functions. With RLS enabled and no
-- INSERT policy, an anon/auth client cannot insert.

-- DELETE: NO policy. Notifications are not deleted by clients.
-- (Cascade on debates / auth.users removal handles cleanup.)
