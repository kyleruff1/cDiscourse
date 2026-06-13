-- ============================================================
-- Migration: 20260613000001_arg_room_002_room_capacity_and_creation
-- Card: ARG-ROOM-002 (#613) — Server-authoritative capacity +
--   private-requires-invite + one-invite-per-room enforcement.
-- Design: docs/designs/ARG-ROOM-002-BACKEND-VISIBILITY-CAPACITY-INVITES.md
-- Review: docs/reviews/ARG-ROOM-002-design-review.md
--
-- Makes the binding room-creation matrix TRUE AT THE DATABASE. On top of
-- the shipped seams (QOL-039 visibility, QOL-038 invites, the 20260516000006
-- recursion-safe helpers) this migration adds, all APPEND-ONLY (no prior
-- applied file is edited):
--
--   1. room_active_seat_cap(uuid)        — derived cap (private 2 / public 5).
--   2. count_active_participants(uuid)   — non-observer participant count.
--   3. user_email_lower(uuid)            — caller email (definer-scoped).
--   4. count_reserved_invites(uuid,text) — live pending-invite seat reservation.
--   5. enforce_room_capacity()           — BEFORE INSERT trigger on
--                                          debate_participants (fires for EVERY
--                                          writer, incl. the service-role accept
--                                          path that bypasses RLS but not triggers).
--   6. argument_room_invites_one_live_per_room — one pending invite per ROOM
--      (strictly tighter than the shipped per-address index; additive).
--   7. Tightened debate_participants INSERT policy — client self-join is for
--      PUBLIC rooms only (private join is creator-RPC / service-role-accept only).
--   8. create_argument_room(...) RPC     — atomic room + creator + optional
--      invite in ONE transaction; re-asserts private => invite; service_role-only.
--   9. DROP "debates: authenticated can create" — closes the direct-insert door
--      (design-review [blocking] #1). After this, the create_argument_room RPC
--      is the ONLY room creator; a direct PostgREST `debates` insert is refused.
--
-- The binding matrix (operator-ratified 2026-06-13; mirrors
-- src/features/debates/argumentRoomCreationMatrix.ts):
--   Private + 0 invite  -> INVALID (private requires one invite)
--   Private + 1 invite  -> VALID   (cap 2; 1 active creator + 1 reserved invite)
--   Public  + 0 invite  -> VALID   (cap 5; 1 active creator + 4 open)
--   Public  + 1 invite  -> VALID   (cap 5; 1 active + 1 reserved + 3 open)
--   any     + 2+ invite -> INVALID (max one direct invite)
--   Observers are NEVER active participants and are NEVER capped.
--
-- ── Doctrine encoded ────────────────────────────────────────
--   - RLS stays ENABLED on every table; nothing is disabled. Policies are
--     replaced via DROP/CREATE in THIS new migration, never by editing an
--     applied file (cdiscourse-doctrine §8 / supabase-edge-contract §5).
--   - Recursion landmine respected: every cross-table read inside a policy or
--     trigger goes through a SECURITY DEFINER STABLE helper (the 20260516000006
--     pattern). No raw cross-table subquery in any policy.
--   - No oracle surface (design-review [should] #2): count_active_participants,
--     count_reserved_invites, and user_email_lower are REVOKEd from PUBLIC and
--     NOT granted to authenticated. They are invoked ONLY by the SECURITY
--     DEFINER capacity trigger, which runs as the function owner and therefore
--     does not need the invoker to hold EXECUTE. room_active_seat_cap is also
--     kept definer-only (the pure-TS twin roomCapacityModel.ts covers client
--     preview, so even its grant is unnecessary).
--   - No service-role anywhere in client code: create_argument_room is granted
--     to service_role ONLY (the create-argument-room Edge Function caller).
--   - Capacity is a structural property (seat availability), NEVER a verdict on
--     a person; "full" is a seat fact. Observers are first-class, never penalized.
--   - Soft-state only: no arguments row is touched; no invite row is hard-deleted.
--
-- ── OPS-001 four-class compliance ───────────────────────────
--   Class 1 (ambiguous column): every column reference inside a policy/trigger
--     subquery is fully qualified (e.g. argument_room_invites.debate_id,
--     debate_participants.user_id) so an ambiguous-column failure (the QOL-041
--     motivating class) cannot occur even if a future maintainer adds a join.
--   Class 2 (type mismatch): all helper params + FKs are uuid / text /
--     timestamptz as their target columns; create_argument_room re-uses the
--     debates / argument_room_invites column types verbatim.
--   Class 3 (statement order): helper functions are created BEFORE the trigger
--     function that calls them, the trigger function BEFORE the trigger, the
--     index + policy + RPC changes last. DROP ... IF EXISTS precedes each
--     CREATE so re-apply is safe.
--   Class 4 (function/extension deps): NO new extension. user_email_lower and
--     count_reserved_invites read `auth.users`; both are SECURITY DEFINER with
--     `SET search_path = public, auth` so the auth schema resolves regardless
--     of caller role. is_debate_private / is_debate_joinable / is_debate_participant
--     are reused from 20260524000015 + 20260516000006 (already applied).
--
-- ── Data precondition for the operator (one-invite-per-room index) ──
--   Step 6 creates a UNIQUE index on (debate_id) WHERE status='pending'. If any
--   existing room already carries 2+ pending invites (the shipped per-address
--   index permits that), the CREATE UNIQUE INDEX will fail. QOL-038's create
--   surface was never wired into room creation, so production should have zero
--   such rooms; if `db push` reports a unique-violation here, the operator
--   revokes the surplus pending invites first (status flip, never a hard delete).
--
-- Sequential after 20260611000002_ops_mcp_key_level_fail_closed_widening_finalizer.sql.
-- ============================================================

-- ── 1. Derived cap — pure function of visibility. No new column. ──
-- The matrix says capacity is a pure function of visibility, so persisting a
-- column would be denormalized state that could drift; deriving here is one
-- edit to retune and cannot desync (mirrors publicSeatModel's "NO new DB
-- column" doctrine). The pure-TS twin lives in roomCapacityModel.ts.
CREATE OR REPLACE FUNCTION public.room_active_seat_cap(p_debate_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN d.visibility = 'private' THEN 2 ELSE 5 END
  FROM public.debates d
  WHERE d.id = p_debate_id;
$$;

COMMENT ON FUNCTION public.room_active_seat_cap(uuid) IS
  'ARG-ROOM-002: derived active-participant cap for a room (private 2 / public '
  '5). SECURITY DEFINER STABLE — bypasses RLS on debates to read visibility '
  'without policy recursion (the 20260516000006 pattern). Definer-only: the '
  'capacity trigger (also definer) is the only caller; NOT granted to '
  'authenticated (the pure-TS roomCapacityModel twin covers client preview).';

REVOKE ALL ON FUNCTION public.room_active_seat_cap(uuid) FROM PUBLIC;
-- Intentionally NOT granted to authenticated (no client-reachable RPC surface).

-- ── 2. Active-participant count — observers are not active participants. ──
CREATE OR REPLACE FUNCTION public.count_active_participants(p_debate_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.debate_participants dp
  WHERE dp.debate_id = p_debate_id
    AND dp.side <> 'observer';
$$;

COMMENT ON FUNCTION public.count_active_participants(uuid) IS
  'ARG-ROOM-002: count of ACTIVE (side <> observer) participants in a room. '
  'SECURITY DEFINER STABLE. Definer-only: called solely by the capacity '
  'trigger. NOT granted to authenticated — a client-reachable count would be '
  'an enumeration surface the RLS deliberately denies (design-review [should] #2).';

REVOKE ALL ON FUNCTION public.count_active_participants(uuid) FROM PUBLIC;
-- Intentionally NOT granted to authenticated (oracle fix, design-review #2).

-- ── 3. Caller email (lower). Reads auth.users — definer-scoped. ──
-- Returns only a lowercased email to the trigger; never exposed to a client
-- query result. NOT granted to authenticated — only definer callers (the
-- capacity trigger, also definer) invoke it.
CREATE OR REPLACE FUNCTION public.user_email_lower(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(u.email)
  FROM auth.users u
  WHERE u.id = p_user_id;
$$;

COMMENT ON FUNCTION public.user_email_lower(uuid) IS
  'ARG-ROOM-002: lowercased email for a user id. SECURITY DEFINER STABLE with '
  'search_path = public, auth so it may read auth.users regardless of caller '
  'role. Returns only the email to the (definer) capacity trigger; NEVER a '
  'client-reachable surface. Intentionally NOT granted to authenticated.';

REVOKE ALL ON FUNCTION public.user_email_lower(uuid) FROM PUBLIC;
-- Intentionally NOT granted to authenticated (no account-enumeration surface).

-- ── 4. Reserved live invites, excluding (a) the joining user's own invite ──
--    and (b) any invite whose addressee already holds an active seat (so an
--    invitee self-joining a public room while their invite is still pending is
--    not double-counted). Fully-qualified columns throughout (OPS-001 Class 1).
CREATE OR REPLACE FUNCTION public.count_reserved_invites(
  p_debate_id uuid,
  p_exclude_email text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT count(*)::int
  FROM public.argument_room_invites i
  WHERE i.debate_id = p_debate_id
    AND i.status = 'pending'
    AND i.expires_at > now()
    AND (p_exclude_email IS NULL OR i.invitee_email_lower <> p_exclude_email)
    AND NOT EXISTS (
      SELECT 1
      FROM public.debate_participants dp
      JOIN auth.users u ON u.id = dp.user_id
      WHERE dp.debate_id = i.debate_id
        AND dp.side <> 'observer'
        AND lower(u.email) = i.invitee_email_lower
    );
$$;

COMMENT ON FUNCTION public.count_reserved_invites(uuid, text) IS
  'ARG-ROOM-002: count of live (pending, unexpired) invites that RESERVE a seat '
  'against the cap — excluding the joining user''s own invite and any invite '
  'whose addressee already holds an active seat (no double-count). SECURITY '
  'DEFINER STABLE. Definer-only: called solely by the capacity trigger. NOT '
  'granted to authenticated — count_reserved_invites(room, ''guess@x'') would '
  'otherwise be an invite-email confirmation oracle (design-review [should] #2).';

REVOKE ALL ON FUNCTION public.count_reserved_invites(uuid, text) FROM PUBLIC;
-- Intentionally NOT granted to authenticated (invite-email oracle fix, #2).

-- ── 5. Capacity trigger — fires for EVERY writer ────────────
-- The client RLS self-join path AND the manage-room-invite service-role accept
-- path both pass through this trigger (service-role bypasses RLS, NOT triggers).
-- Definer so it may read auth.users + the count helpers regardless of caller
-- role. The already-seated guard reuses the shipped is_debate_participant
-- helper (recursion-safe) rather than a raw subquery.
CREATE OR REPLACE FUNCTION public.enforce_room_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_cap      integer;
  v_active   integer;
  v_reserved integer;
  v_email    text;
BEGIN
  -- Observers are not active participants — never capped (matrix invariant).
  IF NEW.side = 'observer' THEN
    RETURN NEW;
  END IF;

  -- Already seated (idempotent re-accept / double self-join): never let the
  -- cap reject a seat the user already holds. The (debate_id,user_id) PK
  -- handles the duplicate. Reuses the recursion-safe helper.
  IF public.is_debate_participant(NEW.debate_id, NEW.user_id) THEN
    RETURN NEW;
  END IF;

  v_cap := public.room_active_seat_cap(NEW.debate_id);
  -- No such room: let the FK on debate_participants.debate_id raise instead.
  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  v_email    := public.user_email_lower(NEW.user_id);
  v_active   := public.count_active_participants(NEW.debate_id);
  v_reserved := public.count_reserved_invites(NEW.debate_id, v_email);

  IF v_active + v_reserved + 1 > v_cap THEN
    RAISE EXCEPTION 'room_capacity_reached'
      USING ERRCODE = 'check_violation',
            DETAIL  = format('cap=%s active=%s reserved=%s', v_cap, v_active, v_reserved);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_room_capacity() IS
  'ARG-ROOM-002: BEFORE INSERT trigger on debate_participants. Rejects an '
  'active (non-observer) join when active + reserved-invites + 1 would exceed '
  'the room''s derived cap. Fires for EVERY writer incl. the service-role '
  'accept path (RLS is bypassed by service-role, triggers are not). Observers '
  'and already-seated users are passed through.';

DROP TRIGGER IF EXISTS debate_participants_enforce_capacity ON public.debate_participants;
CREATE TRIGGER debate_participants_enforce_capacity
  BEFORE INSERT ON public.debate_participants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_room_capacity();

-- ── 6. One direct invite per ROOM (tighter than the per-address index) ──
-- Additive: the shipped argument_room_invites_one_live (debate_id,
-- invitee_email_lower) WHERE status='pending' stays. With this index reserved
-- invites are always 0 or 1, which keeps the cap math simple and matches
-- "max one direct invite". A non-pending (revoked/expired/accepted) invite
-- never blocks a new pending one.
CREATE UNIQUE INDEX IF NOT EXISTS argument_room_invites_one_live_per_room
  ON public.argument_room_invites (debate_id)
  WHERE status = 'pending';

-- ── 7. Tighten participants INSERT: client self-join is PUBLIC-only ──
-- Creator auto-join + invitee accept run through service-role (bypass RLS) and
-- are still gated by the capacity trigger above. Net effect: into a private
-- room, only the creator (at create, via the RPC) and the named invitee (at
-- accept) can ever be added. Reuses the QOL-039 is_debate_private helper.
DROP POLICY IF EXISTS "debate_participants: users join as themselves" ON public.debate_participants;
CREATE POLICY "debate_participants: users join as themselves"
ON public.debate_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_debate_joinable(debate_id)
  AND public.is_debate_private(debate_id) = false
);

-- ── 8. Atomic creation RPC — room + creator + optional invite, one tx ──
-- Re-asserts private => invite so the rule holds even if a future caller
-- bypasses the Edge layer. Stores only the token_hash (the raw token is hashed
-- in the Edge layer and never reaches Postgres). The creator is inserted BEFORE
-- the invite so the capacity trigger sees 0 reserved on the creator join
-- (0 active + 0 reserved + 1 = 1 <= cap), then the invite reserves seat 2.
CREATE OR REPLACE FUNCTION public.create_argument_room(
  p_created_by uuid,
  p_title text,
  p_resolution text,
  p_description text,
  p_constitution_id uuid,
  p_visibility text,
  p_invitee_email_lower text,
  p_intended_seat text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE (debate_id uuid, invite_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debate_id uuid;
  v_invite_id uuid := NULL;
BEGIN
  IF p_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'invalid_visibility' USING ERRCODE = 'check_violation';
  END IF;
  -- private => invite (the matrix's binding rule, enforced at the DB for ALL
  -- callers of this RPC, not just the Edge validator).
  IF p_visibility = 'private'
     AND (p_invitee_email_lower IS NULL OR p_token_hash IS NULL) THEN
    RAISE EXCEPTION 'private_requires_invite' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.debates (
    created_by, title, resolution, description, status, constitution_id, visibility
  )
  VALUES (
    p_created_by, p_title, p_resolution, coalesce(p_description, ''),
    'open', p_constitution_id, p_visibility
  )
  RETURNING id INTO v_debate_id;

  -- Creator auto-join (active seat 1). Fires the capacity trigger: 0 active +
  -- 0 reserved + 1 = 1 <= cap.
  INSERT INTO public.debate_participants (debate_id, user_id, side)
  VALUES (v_debate_id, p_created_by, 'moderator');

  IF p_invitee_email_lower IS NOT NULL AND p_token_hash IS NOT NULL THEN
    INSERT INTO public.argument_room_invites (
      debate_id, invited_by, invitee_email_lower, intended_seat,
      status, token_hash, expires_at
    )
    VALUES (
      v_debate_id, p_created_by, p_invitee_email_lower,
      coalesce(p_intended_seat, 'respondent'), 'pending', p_token_hash, p_expires_at
    )
    RETURNING id INTO v_invite_id;
  END IF;

  RETURN QUERY SELECT v_debate_id, v_invite_id;
END;
$$;

COMMENT ON FUNCTION public.create_argument_room(uuid,text,text,text,uuid,text,text,text,text,timestamptz) IS
  'ARG-ROOM-002: atomic room creation — debate + creator participant + optional '
  'one invite in ONE transaction. Re-asserts private => invite. SECURITY '
  'DEFINER; granted to service_role ONLY (the create-argument-room Edge '
  'Function). The ONLY room creator after this migration drops the client '
  'debates INSERT policy.';

REVOKE ALL ON FUNCTION public.create_argument_room(uuid,text,text,text,uuid,text,text,text,text,timestamptz) FROM PUBLIC;
-- Granted to service_role ONLY (the Edge Function caller); never to authenticated.
GRANT EXECUTE ON FUNCTION public.create_argument_room(uuid,text,text,text,uuid,text,text,text,text,timestamptz) TO service_role;

-- ── 9. Close the direct-insert door (design-review [blocking] #1) ──
-- The shipped "debates: authenticated can create" policy (20260516000002:157-160)
-- let any authenticated client INSERT a debates row directly — including
-- visibility='private' with NO invite, bypassing the create_argument_room RPC
-- and the matrix's private => invite rule. Dropping it (with NO replacement
-- INSERT policy for authenticated) makes the service_role create_argument_room
-- RPC the SOLE room creator, so private => invite is now TRUE AT THE DATABASE
-- for every writer.
--
-- Migration of legitimate client insert paths:
--   - The production client createDebate (src/features/debates/debatesApi.ts)
--     is rewired in this same card to call the create-argument-room Edge
--     Function (co-lands here — no window where the live surface is stranded).
--   - The operator-gated bot-fixture runners under scripts/bot-fixtures/
--     (runStressBatch.js, runAiDrivenCorpus.js, runXaiAdversarialBotCorpus.js,
--     runXaiAdversarialThreadCorpus.js, runMcpSmokeTest.js) do
--     `botClient.from('debates').insert(...)` as the AUTHENTICATED bot user and
--     WILL be refused once this deploys. They must move to the Edge Function
--     (or a service-role harness) in a follow-up — see the operator note in the
--     card summary. They are live-gated dev scripts, not run in CI.
DROP POLICY IF EXISTS "debates: authenticated can create" ON public.debates;
