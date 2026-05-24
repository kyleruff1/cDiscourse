-- ============================================================
-- Migration: 20260524000015_qol_039_room_visibility
-- Description: QOL-039 — Public ↔ Private room visibility transition rules.
--   Adds:
--     1. `visibility` column on `public.debates` (text + CHECK, default 'public').
--     2. BEFORE UPDATE trigger enforcing `public -> private` is the ONLY legal
--        transition (private rooms can never be re-published).
--     3. Two new SECURITY DEFINER helpers (`is_debate_private`,
--        `is_debate_open_or_locked_public`) following the existing
--        non-recursion pattern from migration `20260516000006`.
--     4. Four DROP/CREATE POLICY replacements on `debates`,
--        `debate_participants`, and `arguments` SELECT — so a private room
--        is invisible to non-participants and its arguments unreachable.
--     5. `room_visibility_changes` audit table (per E1.2 / OD-2) — counts
--        and chime-in argument IDs only; no individual dropped-observer
--        identities are persisted. Service-role INSERT only.
--
-- Sequential after `20260524000014_qol_040_room_notifications.sql`.
--
-- Extension dependencies:
--   - `pgcrypto` is required for `gen_random_uuid()` in the audit table's
--     column default. Supabase enables pgcrypto by default in the public
--     schema; verified for this project at 2026-05-24. The same
--     `gen_random_uuid()` default is used by every prior migration in this
--     repo (argument_room_invites, room_notifications, concession_items,
--     point_tags, etc.). Per OPS-001 §4 "function/trigger/extension
--     dependencies", the dependency is documented here in the header rather
--     than asserted at apply time — re-create-extension-if-not-exists is
--     intentionally avoided to keep this migration's footprint to just the
--     new objects.
--
-- Doctrine encoded by this migration:
--   - Visibility is an access property of the room, NEVER a verdict on the
--     room or the people in it. Making a room private is a structural
--     transition, never a punishment, never shaming.
--   - Visibility never gates the WRITE path. `submit-argument` is untouched;
--     a participant posts into a private room exactly as a public room.
--     Visibility changes READS and LISTING only.
--   - Heat / popularity / standing are NEVER inputs. Visibility is creator-
--     chosen, never auto-set by reply count, heat, or standing.
--   - `public -> private` is the ONLY transition. `private -> public` is
--     forbidden by the BEFORE UPDATE trigger below — even mods/admins
--     cannot reverse a private room. Re-exposing a room people argued in
--     believing it was private is a privacy violation.
--   - NO content mutation. The transition mutates ONE column on ONE
--     `debates` row and ZERO `arguments` rows. The "retained (muted), never
--     deleted" requirement for rejected chime-in branches is met by
--     definition — only the read audience shrinks.
--
-- Audit table (OD-2):
--   - Counts and chime-in ARGUMENT IDs only — never individual dropped-
--     observer user IDs. A mod scanning audit rows cannot reconstruct
--     "who was kicked out of a room". This honors §5.5 redaction.
--   - INSERT is service-role only (no INSERT policy for authenticated).
--     The `record-visibility-transition` Edge Function writes audit rows.
--
-- Statement order (OPS-001 §4 Class 3):
--   1. ALTER TABLE … ADD COLUMN visibility …
--   2. CREATE OR REPLACE FUNCTION public.enforce_room_visibility_one_way
--   3. CREATE TRIGGER debates_enforce_visibility_one_way
--   4. CREATE OR REPLACE FUNCTION public.is_debate_private
--   5. CREATE OR REPLACE FUNCTION public.is_debate_open_or_locked_public
--   6. DROP / CREATE POLICY (×3 on debates / debate_participants / arguments)
--      (argument_tags SELECT already delegates through EXISTS arguments,
--      per E1.6 — no separate replacement needed; confirming comment below.)
--   7. CREATE TABLE public.room_visibility_changes
--   8. CREATE INDEX (×2)
--   9. ALTER TABLE … ENABLE ROW LEVEL SECURITY
--   10. CREATE POLICY (×3 on room_visibility_changes)
--
-- All RLS-policy column references inside subqueries are fully-qualified
-- (`room_visibility_changes.debate_id`,
-- `room_visibility_changes.triggered_by_user_id`) per OPS-001 §4 Class 1
-- defensive discipline — even though no subquery joins cross-table here,
-- a future maintainer adding a join elsewhere will not regress.
--
-- Companion design: docs/designs/QOL-039.md §0–§15 + §E1–§E4.
-- ============================================================

-- ── 1. visibility column ─────────────────────────────────────

-- Default 'public' so every existing row keeps today's behavior (open /
-- locked debates stay globally readable). NOT NULL with a default backfills
-- every existing row in one statement.
ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private'));

COMMENT ON COLUMN public.debates.visibility IS
  'QOL-039: public = listed and globally readable; private = readable only by '
  'participants and mods/admins. ONE-WAY: public -> private only, by the '
  'creator. Never affects argument content; only read access + listing. '
  'Backfilled to public by the migration default; new private-from-creation '
  'rooms set this explicitly at INSERT.';

-- ── 2. one-way transition trigger ────────────────────────────

-- `public -> private` is the only legal transition. `private -> public`
-- is forbidden because re-exposing a room people argued in believing it
-- was private is a privacy violation. Mods/admins are NOT exempted — an
-- admin needing to re-publicize for legal/abuse reasons performs it as a
-- service-role migration with an audit trail (outside this card).
CREATE OR REPLACE FUNCTION public.enforce_room_visibility_one_way()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.visibility = 'private' AND NEW.visibility = 'public' THEN
    RAISE EXCEPTION 'room_visibility_is_one_way: a private room cannot be made public again';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_room_visibility_one_way() IS
  'QOL-039: BEFORE UPDATE trigger function. Rejects any private -> public '
  'transition with room_visibility_is_one_way. Enforces the privacy guarantee '
  'at the lowest layer — below RLS, below the API wrapper, below the UI.';

DROP TRIGGER IF EXISTS debates_enforce_visibility_one_way ON public.debates;
CREATE TRIGGER debates_enforce_visibility_one_way
  BEFORE UPDATE OF visibility ON public.debates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_room_visibility_one_way();

-- ── 3. SECURITY DEFINER helpers (same pattern as …0006) ──────

-- `is_debate_private(debate_id)` — used by the new `arguments` and
-- `debate_participants` SELECT policies to ask "is this row's debate private?"
-- without a raw subquery into `debates`, preserving the recursion fix.
CREATE OR REPLACE FUNCTION public.is_debate_private(p_debate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.debates d
    WHERE d.id = p_debate_id AND d.visibility = 'private'
  );
$$;

COMMENT ON FUNCTION public.is_debate_private(uuid) IS
  'QOL-039: returns true if the debate is private. SECURITY DEFINER — '
  'bypasses RLS on debates to avoid policy recursion (same pattern as '
  'is_debate_open_or_locked from migration 20260516000006).';

REVOKE ALL ON FUNCTION public.is_debate_private(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_debate_private(uuid) TO authenticated;

-- `is_debate_open_or_locked_public(debate_id)` — sibling of the existing
-- `is_debate_open_or_locked`, but tightened to require `visibility = 'public'`.
-- Adding a SIBLING (rather than modifying the existing helper) preserves the
-- existing helper's semantics for any callers that need the visibility-blind
-- check (e.g. moderation review surfaces).
CREATE OR REPLACE FUNCTION public.is_debate_open_or_locked_public(p_debate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.debates d
    WHERE d.id = p_debate_id
      AND d.status IN ('open', 'locked')
      AND d.visibility = 'public'
  );
$$;

COMMENT ON FUNCTION public.is_debate_open_or_locked_public(uuid) IS
  'QOL-039: returns true if the debate is open/locked AND public. '
  'SECURITY DEFINER — bypasses RLS on debates to avoid policy recursion '
  '(same pattern as is_debate_open_or_locked from migration 20260516000006).';

REVOKE ALL ON FUNCTION public.is_debate_open_or_locked_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_debate_open_or_locked_public(uuid) TO authenticated;

-- ── 4. RLS policy replacements ───────────────────────────────

-- 4.1 — debates SELECT
-- The original (post-recursion-fix) policy granted SELECT to any caller for
-- any `open`/`locked` debate. The new policy requires `visibility = 'public'`
-- for that arm — a private debate is only visible to its creator,
-- participants, and mods/admins.
DROP POLICY IF EXISTS "debates: select open, own, or participant" ON public.debates;
DROP POLICY IF EXISTS "debates: select public-open, own, or participant" ON public.debates;

CREATE POLICY "debates: select public-open, own, or participant"
ON public.debates
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR is_moderator_or_admin()
  OR public.is_debate_participant(id, auth.uid())
  OR (visibility = 'public' AND status IN ('open', 'locked'))
);

-- 4.2 — debate_participants SELECT
-- The original (post-recursion-fix) policy granted SELECT on participant rows
-- for any open/locked debate (so anyone could enumerate participants of any
-- open debate). The new policy requires the debate be PUBLIC for that arm,
-- and adds a participant-of-the-debate arm so participants of a private room
-- can still see their co-participants (required for the seat strip + GAME-005
-- governance surfaces).
DROP POLICY IF EXISTS "debate_participants: select own or open debate" ON public.debate_participants;
DROP POLICY IF EXISTS "debate_participants: select own, participant, or public-open debate" ON public.debate_participants;

CREATE POLICY "debate_participants: select own, participant, or public-open debate"
ON public.debate_participants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_moderator_or_admin()
  OR public.is_debate_participant(debate_id, auth.uid())
  OR public.is_debate_open_or_locked_public(debate_id)
);

-- 4.3 — arguments SELECT
-- The original policy granted SELECT to any caller for any `posted` argument
-- whose debate was `open`/`locked`. The new policy requires the debate be
-- PUBLIC for that arm; private-room arguments are readable only by the
-- author, participants of the debate, and mods/admins.
--
-- This is the policy that makes "retained (muted), never deleted" and
-- "non-participant read access revoked" simultaneously true: the rejected
-- chime-in author's own row is still readable to THEM (`author_id = auth.uid()`
-- arm), still readable to PARTICIPANTS of the room (the participant arm),
-- and no longer readable to other non-participants once the room is private.
-- Nothing is deleted; only the audience shrinks.
DROP POLICY IF EXISTS "arguments: select posted in readable debates or own" ON public.arguments;
DROP POLICY IF EXISTS "arguments: select own, participant-private, or posted-public" ON public.arguments;

CREATE POLICY "arguments: select own, participant-private, or posted-public"
ON public.arguments
FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
  OR is_moderator_or_admin()
  OR (
    status = 'posted'
    AND (
      -- public room: any authenticated user
      public.is_debate_open_or_locked_public(debate_id)
      -- private room: participants only
      OR public.is_debate_participant(debate_id, auth.uid())
    )
  )
);

-- 4.4 — argument_tags SELECT — NO POLICY CHANGE per E1.6.
-- argument_tags SELECT delegates through EXISTS arguments (see
-- `20260516000002_rls_policies.sql` lines 244-260). It therefore
-- AUTO-INHERITS the visibility gate from the updated `arguments` SELECT
-- policy above. If a future maintainer refactors `argument_tags` SELECT to
-- a direct debates-join, they MUST preserve the visibility gate manually.

-- ── 5. room_visibility_changes audit table (OD-2) ─────────────

-- Counts-only audit table: records WHEN a transition happened, WHO triggered
-- it, and STRUCTURAL counts of who was retained/dropped/rejected — never the
-- individual dropped-observer user IDs. The `rejected_chime_in_ids` array
-- stores ARGUMENT IDs (the chime-in moves), not user IDs, mirroring existing
-- chime-in audit patterns.
--
-- INSERT is service-role only (the `record-visibility-transition` Edge
-- Function per E1.3). With RLS enabled and no INSERT policy, an anon/auth
-- client cannot insert.
CREATE TABLE IF NOT EXISTS public.room_visibility_changes (
  -- Primary key. gen_random_uuid() requires pgcrypto (see header).
  transition_id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The room being transitioned. The operator's "room_id references the
  -- arguments table" phrasing in the launch prompt is interpreted as the
  -- only schema-consistent reading: the room IS a debate row, so this is
  -- `debate_id REFERENCES public.debates(id)`. CASCADE on debate deletion
  -- keeps audit rows pointing at a real debate.
  debate_id                   uuid        NOT NULL
                                            REFERENCES public.debates(id) ON DELETE CASCADE,
  transitioned_at             timestamptz NOT NULL DEFAULT now(),
  -- v1 carries only one trigger kind. Reserved for future trigger kinds
  -- (e.g. mod-initiated under QOL-040.2, or automatic under a later card).
  trigger_kind                text        NOT NULL DEFAULT 'manual_creator_action'
                                            CHECK (trigger_kind IN ('manual_creator_action')),
  -- The user who initiated the transition. Under OD-1 this is always the
  -- room creator. Recorded explicitly for the moderation-review case.
  triggered_by_user_id        uuid        NOT NULL
                                            REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Counts only — never individual user IDs for dropped observers.
  retained_participant_count  integer     NOT NULL
                                            CHECK (retained_participant_count >= 0),
  dropped_participant_count   integer     NOT NULL
                                            CHECK (dropped_participant_count >= 0),
  rejected_chime_in_count     integer     NOT NULL
                                            CHECK (rejected_chime_in_count >= 0),
  -- Array of `public.arguments.id` values — the chime-in ARGUMENT IDs that
  -- were structurally rejected (per GAME-005's MovedToObserverRecord set
  -- at transition time). NOT user IDs. This respects the existing chime-in
  -- audit patterns and avoids creating a surveillance surface for tracking
  -- individual users who chimed in.
  rejected_chime_in_ids       uuid[]      NOT NULL DEFAULT '{}'::uuid[]
);

COMMENT ON TABLE public.room_visibility_changes IS
  'QOL-039: append-only audit log of room visibility transitions. Counts and '
  'chime-in argument IDs only; no individual dropped-observer user IDs. INSERT '
  'is service-role only via record-visibility-transition Edge Function. SELECT '
  'is mod/admin OR room creator OR triggering user.';

COMMENT ON COLUMN public.room_visibility_changes.rejected_chime_in_ids IS
  'Array of public.arguments.id values — chime-in argument IDs that were '
  'structurally rejected at transition time. NOT user IDs. A future moderation '
  'review can trace specific chime-in arguments via existing chime-in audit '
  'patterns; the table does not enable reconstruction of dropped-observer lists.';

-- ── 6. Indexes ───────────────────────────────────────────────

-- Per-debate history (room creator + moderator review surface).
CREATE INDEX IF NOT EXISTS room_visibility_changes_debate_idx
  ON public.room_visibility_changes (debate_id, transitioned_at DESC);

-- Per-actor history (triggering user looking up their own past actions).
CREATE INDEX IF NOT EXISTS room_visibility_changes_triggered_by_idx
  ON public.room_visibility_changes (triggered_by_user_id, transitioned_at DESC);

-- ── 7. RLS on audit table ────────────────────────────────────

ALTER TABLE public.room_visibility_changes ENABLE ROW LEVEL SECURITY;

-- SELECT — mods/admins read all rows (moderation review surface).
DROP POLICY IF EXISTS rvc_select_mod_or_admin ON public.room_visibility_changes;
CREATE POLICY rvc_select_mod_or_admin
  ON public.room_visibility_changes FOR SELECT
  TO authenticated
  USING (public.is_moderator_or_admin());

-- SELECT — the room creator reads their own room's history.
-- Fully-qualified `room_visibility_changes.debate_id` per OPS-001 §4 Class 1
-- defensive discipline (avoids ambiguous-column-reference at policy-create
-- time when a future maintainer joins another table inside this subquery).
DROP POLICY IF EXISTS rvc_select_room_creator ON public.room_visibility_changes;
CREATE POLICY rvc_select_room_creator
  ON public.room_visibility_changes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.debates d
      WHERE d.id = room_visibility_changes.debate_id
        AND d.created_by = auth.uid()
    )
  );

-- SELECT — the triggering user reads their own audit row.
-- Under OD-1 this is typically the same user as the room creator, but the
-- policy is recorded explicitly so the auditing intent is unambiguous.
DROP POLICY IF EXISTS rvc_select_own_action ON public.room_visibility_changes;
CREATE POLICY rvc_select_own_action
  ON public.room_visibility_changes FOR SELECT
  TO authenticated
  USING (room_visibility_changes.triggered_by_user_id = auth.uid());

-- NO INSERT / UPDATE / DELETE policy for the authenticated role.
-- Audit rows are inserted ONLY by the `record-visibility-transition` Edge
-- Function via the service-role client. With RLS enabled and no INSERT
-- policy, an anon/auth client cannot insert. UPDATE / DELETE are never
-- legal — the audit log is append-only.
