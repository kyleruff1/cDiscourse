# ARG-ROOM-002 — Backend visibility, capacity, invite, and access-control

Status: Design draft
Epic: Argument-room visibility, capacity, and invites (ARG-ROOM-VISIBILITY-INVITE slate)
Release: 6.7
Issue: #613 — https://github.com/kyleruff1/cDiscourse/issues/613

---

## Goal

Make the room-creation contract **true at the database**. Today the slate's three pillars exist as separate shipped primitives that do not yet enforce the contract together:

- **Visibility** ships (QOL-039): a `visibility` column, a one-way `public → private` trigger, and visibility-hiding read policies — `supabase/migrations/20260524000015_qol_039_room_visibility.sql:85-94,103-123,189-198`.
- **Invite-by-email** ships (QOL-038): the `argument_room_invites` table, the `manage-room-invite` Edge Function, and a per-address live-invite uniqueness rule — `supabase/migrations/20260524000013_qol_038_argument_room_invites.sql:51-95`.
- **Capacity is enforced nowhere.** The join guard `is_debate_joinable` checks **status only** (`supabase/migrations/20260516000006_fix_debates_rls_recursion.sql:96-118`), and the participants INSERT policy is `WITH CHECK (user_id = auth.uid() AND is_debate_joinable(debate_id))` (`:161-168`) — no count, no side cap, no visibility check. Any signed-in user can self-insert into any open room without bound. `private`-requires-invite is not enforced. "One direct invite" is currently "one **live invite per (room, email)**" (`20260524000013:93-95`), not "one per room."

This card is **enforcement, live-surface exposure, and reconciliation on top of the shipped seams** — not a rebuild. It adds one new migration (helpers + a capacity trigger + a tightened participants INSERT policy + a tighter one-invite-per-room index + an atomic creation function), one new Edge Function (`create-argument-room`) that makes creation server-authoritative, and the reconciliation of the shipped public seat cap from 6 to 5. It reuses QOL-038's invite table, token-hash discipline, and `manage-room-invite` accept path verbatim; reuses QOL-039's visibility column and `SECURITY DEFINER` helpers; and reuses the `20260516000006` recursion-safe helper pattern.

---

## Product contract (the binding matrix — verbatim)

| Visibility | Direct invites | Reserved seat | Open slots after create | Total capacity | Valid? |
| Private | 0 | 0 | 0 | 2 | NO (private requires one invite) |
| Private | 1 | 1 | 0 | 2 | YES (default) |
| Public | 0 | 0 | 4 | 5 | YES |
| Public | 1 | 1 | 3 | 5 | YES |
| any | 2+ | — | — | — | NO (max one direct invite) |

The rules, restated as one-liners (these are the acceptance sentences every layer must satisfy):

- One direct invite at creation.
- Private rooms are 1v1.
- Public rooms are capped at five active participants.
- A public direct invite reserves one of the five seats.
- Public with no invite is valid.
- Private with no invite is invalid.
- Observers are not active participants.

---

## Existing shipped state (file:line — what to REUSE)

**Room table + visibility (QOL-039 #208).**
- `public.debates` with `visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private'))` — `20260524000015_qol_039_room_visibility.sql:85-94`. Owner is `created_by`. Status is `draft | open | locked | archived` — `20260516000001_initial_schema.sql:144-145`.
- One-way trigger `enforce_room_visibility_one_way` blocks `private → public` below RLS — `20260524000015:103-123`.
- `SECURITY DEFINER STABLE` helpers `is_debate_private(uuid)` (`:130-141`) and `is_debate_open_or_locked_public(uuid)` (`:156-169`). **Reuse both** for cap derivation and the tightened join policy.
- `debates` SELECT already withholds private rooms from non-participants — `:189-198`. The gallery relies on this; client list has no `WHERE` (`src/features/debates/debatesApi.ts:97-99`).

**Participants (never capacity-limited today).**
- `public.debate_participants (debate_id, user_id, side ∈ affirmative|negative|observer|moderator, joined_at; PK(debate_id,user_id))`, **no role/status column** — `20260516000001:164-170`.
- Recursion-safe `SECURITY DEFINER STABLE` helpers `is_debate_participant`, `is_debate_open_or_locked`, `is_debate_joinable` — `20260516000006:36-118`. **Reuse the pattern; the recursion landmine is mandatory** — any cross-table read inside a policy or trigger goes through a `SECURITY DEFINER STABLE` helper, never a raw subquery.
- Participants INSERT policy `WITH CHECK (user_id = auth.uid() AND is_debate_joinable(debate_id))` — `20260516000006:161-168`. This is the policy this card **tightens** (replace via a new migration; never edit the applied file).

**One direct invite (QOL-038 #207).**
- `public.argument_room_invites` — `20260524000013:51-88`. Token stored only as `token_hash` (sha-256 hex); raw token never persisted — `:78-80,169-170`. Partial-unique `argument_room_invites_one_live` = one pending invite per `(debate_id, invitee_email_lower)` — `:93-95`. RLS enabled with **no authenticated write policy** — every write is service-role via the Edge Function — `:104,157-164`.
- `manage-room-invite` Edge Function (`verify_jwt = false`, per-action auth) with `create / revoke / list_for_debate / lookup_by_token / accept` — `supabase/functions/manage-room-invite/index.ts:1-30`. **Reuse the accept path unchanged**: it enrols the invitee as a primary participant via service-role insert (`:597-599`), then flips the invite to `accepted` (`:609-617`), gated by an email-binding check (`:561-563`). Token mint/hash live in `supabase/functions/_shared/inviteToken.ts` (imported at `index.ts:43`). **Reuse for the new create function.**
- Client wrapper `createRoomInvite` — `src/features/invites/inviteApi.ts:142-151`.

**Creation today (CLIENT insert — the thing this card moves).**
- `createDebate` does a direct client INSERT into `public.debates` (`src/features/debates/debatesApi.ts:127-139`), then a best-effort client INSERT auto-joining the creator as side `moderator` (`:146-148`). Visibility defaults to `public` (`:125`). There is no create Edge Function. The live create surface `src/features/arguments/startArgument/StartArgumentPage.tsx` calls `createDebate` and has no visibility / invite / capacity control (always public). The orphaned `CreateDebateForm.tsx` already has a working Public/Private radiogroup to lift — `src/features/debates/CreateDebateForm.tsx:20-54,108-131` (default public `:61`).

**Write-path membership check stays as-is.**
- `submit-argument` checks membership **existence**, not count — `supabase/functions/submit-argument/index.ts:160-194`. Capacity is enforced at **join**, not at post; this function is untouched. (QOL-039 already established that visibility never gates the write path — `20260524000015:36-38`.)

**Shipped seat cap to reconcile.**
- `PUBLIC_ROOM_SEAT_CAP = 6` and `PRIMARY_SEAT_COUNT = 2` — `src/features/debates/publicSeatModel.ts:62,68`. The seat-count strip renders `{active} of {cap}` — `:708-710`. The 1v1 contract literal lives in `src/features/debates/roomContractModel.ts:26,101-113`.

**Copy + Edge registration.**
- `ROOM_VISIBILITY_COPY` — `src/features/arguments/gameCopy.ts:1604-1665` (reuse; extend with capacity copy). Edge Functions register in `supabase/config.toml` (`[functions.<name>]` + `verify_jwt`), e.g. `submit-argument` `:386-387`, `manage-room-invite` `verify_jwt = false` `:427-428`, `request-argument-deletion` `:410-411`. **Registration matters**: only `config.toml`-registered functions auto-deploy on merge.

---

## Divergence from shipped (what this card adds / changes)

1. **Capacity is enforced for the first time** — a `BEFORE INSERT` trigger on `debate_participants` that counts active (non-observer) participants plus reserved live invites and rejects at the visibility cap. Today nothing counts (`20260516000006:96-118`).
2. **Capacity is DERIVED from visibility, not persisted** — a `SECURITY DEFINER STABLE` helper `room_active_seat_cap(debate_id)` returns `2` for private, `5` for public. **No new `debates` column.** The matrix says capacity is a pure function of visibility, so a column would be denormalized state that could drift; the derivation mirrors how `publicSeatModel`/`roomContractModel` derive seats rather than persist them (`publicSeatModel.ts:14-33` doctrine note).
3. **Private rooms become genuinely invite-only at the join layer** — the participants INSERT policy is tightened so a client self-join into a private room is refused (the only way into a private room is the creator auto-join or the service-role accept path). Today `is_debate_joinable` ignores visibility (`20260516000006:96-118,161-168`).
4. **"One direct invite" means one per ROOM** — a new partial-unique index `argument_room_invites_one_live_per_room` on `(debate_id) WHERE status = 'pending'`, strictly tighter than the shipped per-address index (`20260524000013:93-95`). Both coexist; the new one is additive.
5. **Creation moves behind a server-authoritative Edge Function** `create-argument-room` that atomically inserts the room + the creator participant + (optionally) the one invite, and enforces `private ⇒ invite` and `≤ 1 invite` server-side. The client direct insert (`debatesApi.ts:127-148`) is replaced by a client wrapper that calls the function. This is the one place we *replace* a shipped seam, justified by atomicity (a private room must never exist without its invite, which two separate client inserts cannot guarantee).
6. **Reserved-seat accounting** — a live pending invite counts as one occupied seat (so the invitee can always accept), but is excluded from the count for the invitee themselves and is void once its addressee already holds an active seat (no double-count).

### ADR — public active-participant cap 6 → 5 (operator-binding)

**Decision:** the public active-participant cap is **5**. The shipped `PUBLIC_ROOM_SEAT_CAP = 6` (`publicSeatModel.ts:62`) is **superseded** and reconciled to 5 in the same release.

**Rationale:** the binding matrix sets public total capacity at 5 (creator + four others, or creator + reserved invite + three others). GAME-005 proposed 6 as a tuning value, explicitly behind a single named constant for exactly this kind of one-edit retune (`publicSeatModel.ts:57-62`). Reconciling to 5 keeps one doctrine across the slate.

**Consequences:** chime-in capacity becomes `5 − PRIMARY_SEAT_COUNT (2) = 3` (was 4). Single sources of truth, kept in parity by a test: `room_active_seat_cap` (SQL, authoritative for enforcement) and `PUBLIC_ROOM_SEAT_CAP` (TS, authoritative for UI preview). The TS change (constant + `publicSeatModel` tests + the `{active} of {cap}` strip) lands with the frontend sibling card but is recorded here because this is the doctrinal source.

---

## Chosen approach

### A. Capacity is derived, enforced by a trigger (parts a + b)

Add four `SECURITY DEFINER STABLE` helpers and one `BEFORE INSERT` trigger (full sketch below). The cap is a pure function of visibility. The trigger is the enforcement point because **triggers fire for every writer** — the client self-join (RLS path) *and* the `manage-room-invite` service-role accept path (`index.ts:597-599`) both pass through it, where RLS alone would not (service-role bypasses RLS, not triggers). The occupancy formula for a new active join by user `U`:

```
occupied = active_participants(room)            -- side <> 'observer'
         + reserved_invites(room, except U)     -- live pending invites not addressed to U
                                                 -- and not already held by an active seat
reject when  occupied + 1 > room_active_seat_cap(room)
```

Observers are never counted and never capped (matrix: "Observers are not active participants"). An already-seated user is skipped so an idempotent re-accept never trips the cap.

### B. Private becomes invite-only at the join layer (part d, defense in depth)

Tighten the participants INSERT policy so the **client** self-join arm only applies to public rooms. The creator auto-join and the invitee accept both run through the new Edge Function / the shipped accept path under **service-role**, which bypasses RLS but still hits the capacity trigger. Net effect: into a private room, only the creator (at create) and the named invitee (at accept) can ever be added.

### C. Creation is atomic and server-authoritative (parts d + e)

A new Edge Function `create-argument-room` (`verify_jwt = true`) validates `private ⇒ invite` and `≤ 1 invite`, mints the token in Deno (reusing `_shared/inviteToken.ts`), and calls a single `SECURITY DEFINER` RPC `create_argument_room(...)` that inserts the room, the creator participant, and the optional invite **in one transaction**. The RPC re-asserts `private ⇒ invite` so the rule holds even if a future caller bypasses the Edge layer. The Edge Function returns the invite link **only to the creator, only at create time**, exactly like `manage-room-invite` create (`index.ts:313-324`). This is the only place the raw token exists, so it is also the only place that can feed the (operator-gated, default-OFF) send path — `room-notifications` cannot recover a raw token from the stored hash (its `inviteLink` is null by construction).

### D. One invite per room (part e)

Add the tighter partial-unique index. With it, reserved invites are always `0` or `1`, which keeps the cap math simple and matches "max one direct invite."

---

## Alternatives rejected

- **Persist a `debates.capacity` column.** Rejected: capacity is a pure function of visibility (the matrix), so a column is derived state that can drift from `visibility`, and it would need a backfill + a CHECK tying it to visibility. Deriving in `room_active_seat_cap` is one edit to retune and cannot desync.
- **Enforce capacity in `submit-argument` instead of at join.** Rejected: a user is "in the room" at join, not at first post; gating posts would let over-cap users sit in the room and would entangle the untouched write path (QOL-039 deliberately keeps visibility/capacity off the write path — `20260524000015:36-38`).
- **Keep creation as a client insert and enforce `private ⇒ invite` with a deferred constraint.** Rejected: the invite lives in a different table inserted by a separate client call; a cross-table commit-time check is not expressible as a simple constraint, and two client transactions cannot be atomic. The Edge + RPC gives true atomicity and one server-authoritative home for `private ⇒ invite` and `≤ 1 invite`.
- **Enforce the cap purely in RLS `WITH CHECK` (count subquery).** Rejected: the authoritative enrolment is the service-role accept path, which bypasses RLS; a count in RLS would not catch it. A trigger catches every writer. (RLS tightening is still used, but only for the private/public *join-layer* distinction, not the count.)
- **Reuse the shipped per-address index as the "one invite" rule.** Rejected: `argument_room_invites_one_live` is per `(debate, email)` (`20260524000013:93-95`) — it permits many concurrent invites to different addresses. The matrix says one per room.
- **A new "active" boolean on `debate_participants`.** Rejected: `side <> 'observer'` already expresses "active"; a new column is redundant state.

---

## Data / API shape

### New migration `supabase/migrations/20260613000001_arg_room_002_room_capacity_and_creation.sql`

A new file (append-only; the applied QOL-038/039/recursion migrations are never edited). Statement order, fully-qualified column references in every policy/trigger subquery (OPS-001 ambiguous-column discipline), and `SECURITY DEFINER STABLE` helpers throughout (recursion landmine).

```sql
-- 1. Derived cap — pure function of visibility. No new column.
create or replace function public.room_active_seat_cap(p_debate_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case when d.visibility = 'private' then 2 else 5 end
  from public.debates d where d.id = p_debate_id;
$$;
revoke all on function public.room_active_seat_cap(uuid) from public;
grant execute on function public.room_active_seat_cap(uuid) to authenticated;

-- 2. Active-participant count — observers are not active participants.
create or replace function public.count_active_participants(p_debate_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.debate_participants dp
  where dp.debate_id = p_debate_id and dp.side <> 'observer';
$$;
revoke all on function public.count_active_participants(uuid) from public;
grant execute on function public.count_active_participants(uuid) to authenticated;

-- 3. Caller email (lower). Reads auth.users — definer-scoped, returns only a
--    lowercased email to the trigger; never exposed to a client query result.
create or replace function public.user_email_lower(p_user_id uuid)
returns text language sql stable security definer set search_path = public, auth as $$
  select lower(u.email) from auth.users u where u.id = p_user_id;
$$;
revoke all on function public.user_email_lower(uuid) from public;
-- intentionally NOT granted to authenticated: only definer callers (the
-- capacity trigger, also definer) invoke it. No client-reachable surface.

-- 4. Reserved live invites, excluding (a) the joining user's own invite and
--    (b) any invite whose addressee already holds an active seat.
create or replace function public.count_reserved_invites(p_debate_id uuid, p_exclude_email text)
returns integer language sql stable security definer set search_path = public, auth as $$
  select count(*)::int
  from public.argument_room_invites i
  where i.debate_id = p_debate_id
    and i.status = 'pending'
    and i.expires_at > now()
    and (p_exclude_email is null or i.invitee_email_lower <> p_exclude_email)
    and not exists (
      select 1 from public.debate_participants dp
      join auth.users u on u.id = dp.user_id
      where dp.debate_id = i.debate_id
        and dp.side <> 'observer'
        and lower(u.email) = i.invitee_email_lower
    );
$$;
revoke all on function public.count_reserved_invites(uuid, text) from public;
grant execute on function public.count_reserved_invites(uuid, text) to authenticated;

-- 5. Capacity trigger — fires for EVERY writer (client RLS path AND the
--    manage-room-invite service-role accept path). Definer so it may read
--    auth.users + the count helpers regardless of caller role.
create or replace function public.enforce_room_capacity()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_cap integer; v_active integer; v_reserved integer; v_email text;
begin
  -- Observers are not active participants — never capped.
  if new.side = 'observer' then return new; end if;

  -- Already seated (idempotent re-accept / double self-join): let the
  -- (debate_id,user_id) PK handle the duplicate; never let the cap reject
  -- a seat the user already holds.
  if exists (select 1 from public.debate_participants dp
             where dp.debate_id = new.debate_id and dp.user_id = new.user_id) then
    return new;
  end if;

  v_cap := public.room_active_seat_cap(new.debate_id);
  if v_cap is null then return new; end if; -- no such room: let the FK raise.

  v_email    := public.user_email_lower(new.user_id);
  v_active   := public.count_active_participants(new.debate_id);
  v_reserved := public.count_reserved_invites(new.debate_id, v_email);

  if v_active + v_reserved + 1 > v_cap then
    raise exception 'room_capacity_reached'
      using errcode = 'check_violation',
            detail  = format('cap=%s active=%s reserved=%s', v_cap, v_active, v_reserved);
  end if;
  return new;
end;
$$;

drop trigger if exists debate_participants_enforce_capacity on public.debate_participants;
create trigger debate_participants_enforce_capacity
  before insert on public.debate_participants
  for each row execute function public.enforce_room_capacity();

-- 6. One direct invite per ROOM (tighter than the shipped per-address index).
create unique index if not exists argument_room_invites_one_live_per_room
  on public.argument_room_invites (debate_id) where status = 'pending';

-- 7. Tighten participants INSERT: client self-join is for PUBLIC rooms only.
--    Creator auto-join + invitee accept run through service-role (bypass RLS)
--    and are still gated by the capacity trigger above.
drop policy if exists "debate_participants: users join as themselves" on public.debate_participants;
create policy "debate_participants: users join as themselves"
on public.debate_participants for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_debate_joinable(debate_id)
  and public.is_debate_private(debate_id) = false   -- reuse QOL-039 helper
);

-- 8. Atomic creation RPC — one transaction for room + creator + optional invite.
--    Re-asserts private => invite and stores only the token_hash (raw token
--    is hashed in the Edge layer and never reaches Postgres).
create or replace function public.create_argument_room(
  p_created_by uuid, p_title text, p_resolution text, p_description text,
  p_constitution_id uuid, p_visibility text,
  p_invitee_email_lower text, p_intended_seat text,
  p_token_hash text, p_expires_at timestamptz
) returns table (debate_id uuid, invite_id uuid)
language plpgsql security definer set search_path = public as $$
declare v_debate_id uuid; v_invite_id uuid := null;
begin
  if p_visibility not in ('public','private') then
    raise exception 'invalid_visibility' using errcode = 'check_violation';
  end if;
  if p_visibility = 'private' and (p_invitee_email_lower is null or p_token_hash is null) then
    raise exception 'private_requires_invite' using errcode = 'check_violation';
  end if;

  insert into public.debates (created_by, title, resolution, description,
                              status, constitution_id, visibility)
  values (p_created_by, p_title, p_resolution, coalesce(p_description,''),
          'open', p_constitution_id, p_visibility)
  returning id into v_debate_id;

  -- Creator auto-join (active seat 1). The capacity trigger sees 0 active +
  -- 0 reserved + 1 = 1 <= cap.
  insert into public.debate_participants (debate_id, user_id, side)
  values (v_debate_id, p_created_by, 'moderator');

  if p_invitee_email_lower is not null and p_token_hash is not null then
    insert into public.argument_room_invites
      (debate_id, invited_by, invitee_email_lower, intended_seat,
       status, token_hash, expires_at)
    values (v_debate_id, p_created_by, p_invitee_email_lower,
            coalesce(p_intended_seat,'respondent'), 'pending', p_token_hash, p_expires_at)
    returning id into v_invite_id;
  end if;

  return query select v_debate_id, v_invite_id;
end;
$$;
revoke all on function public.create_argument_room(uuid,text,text,text,uuid,text,text,text,text,timestamptz) from public;
-- granted to service_role only (the Edge Function caller); never to authenticated.
grant execute on function public.create_argument_room(uuid,text,text,text,uuid,text,text,text,text,timestamptz) to service_role;
```

Worked occupancy checks against the matrix:

- **Create private (1 invite):** creator insert → `0 + 0 + 1 = 1 ≤ 2`. Invite insert → reserved becomes 1. Room is now `1 active + 1 reserved = 2 = cap`. Open slots after create: 0. ✓
- **Create public (0 invite):** creator → `1 ≤ 5`. Open slots: 4. ✓
- **Create public (1 invite):** creator + reserved → `1 active + 1 reserved`. Open slots for non-invitees: 3. ✓
- **Random user joins private:** `v_email` ≠ the one invite → reserved 1; `1 + 1 + 1 = 3 > 2` → rejected (and the tightened RLS already refuses the client self-join). ✓
- **Invitee accepts a "full" private room:** accept runs service-role; `v_email` = invitee → their own invite excluded → reserved 0; `1 + 0 + 1 = 2 ≤ 2` → allowed. ✓ (No change needed to `manage-room-invite`; its email-binding at `index.ts:561-563` guarantees `v_email` matches.)
- **6th active join to a public room:** `5 + 0 + 1 = 6 > 5` → rejected. ✓

### New Edge Function `supabase/functions/create-argument-room/index.ts` (`verify_jwt = true`)

Standard Edge shape (`supabase-edge-contract`): CORS preflight; JWT verify → `callerId`, `callerEmail`; Zod validate; mint token (if invite) via `_shared/inviteToken.ts`; service-role RPC; uniform response.

```
Request:  { title, resolution, description?, visibility: 'public'|'private',
            invite?: { email: string, intendedSeat?: 'respondent'|'co_primary' } }
Rules:    visibility==='private' && !invite           -> 400 private_requires_invite
          invite present && caller email === invite.email -> 400 cannot_invite_self
          (the schema accepts at most ONE invite object; an array/2nd invite is a
           validation_failed; the one-per-room index is the durable backstop)
Flow:     load active constitution id
          if invite: rawToken = generateInviteToken(); tokenHash = await hashInviteToken(rawToken)
          rpc create_argument_room(callerId, title, resolution, description,
              constitutionId, visibility, inviteeEmailLower|null, intendedSeat|null,
              tokenHash|null, defaultExpiresAt())
          inviteLink = invite ? `${sanitiseOrigin(req)}/invite/${rawToken}` : null
Response: { debateId, visibility, inviteId|null, inviteLink|null }  // link ONLY to creator
```

- The raw token is returned to the creator once (same posture as `manage-room-invite` create `index.ts:313-324`) and is the only feed for the operator-gated send path. It is never logged, never stored, never in `list_for_debate`, never to MCP.
- Logs carry function name, caller id, room id (short), `emailDomain` only — never the raw token, the full email, the Authorization header, or the service-role key (`supabase-edge-contract` logging rules; mirrors `manage-room-invite` `index.ts:306-311`).
- **No account enumeration:** the response is identical whether or not the invited email belongs to an existing user. Whether the downstream send is "new-user account invite" (`admin-users` `inviteUserByEmail`) or "existing-user room email" (`room-notifications`, gated `INVITE_EMAIL_ENABLED`, default OFF — QOL-040 owns the flip) is decided *outside* this function and never leaks into its response.

### New client wrapper + rewire

- `createArgumentRoom(input)` in `src/features/debates/debatesApi.ts` (or a sibling `roomCreateApi.ts`) calls the Edge Function via `supabase.functions.invoke`, replacing the direct insert + client auto-join at `debatesApi.ts:127-148`. `StartArgumentPage.tsx` is rewired to call it and to surface the lifted visibility radiogroup (`CreateDebateForm.tsx:108-131`) + an optional single invite field (`InvitePanel` single-email pattern). The frontend sibling card (ARG-ROOM-003) owns the surface; this card owns the wrapper + Edge contract.

### New pure-TS preview model `src/features/debates/roomCapacityModel.ts`

A small, pure, JSON-serializable twin of `room_active_seat_cap` so the create surface and seat strip can preview "Full" / "3 open seats" without a round-trip — mirroring how `publicSeatModel` derives client-side. Public functions: `roomActiveSeatCap(visibility)` (`private → 2`, `public → 5`), `openSlotsAfterCreate(visibility, directInvites)`, `isCreationValid(visibility, directInvites)` (the matrix), `canJoinActive(active, reserved, cap)`. The SQL helper remains authoritative for enforcement; the TS model is advisory preview, kept in parity by a test.

---

## UI copy (ban-list-clean)

New keys appended to `src/features/arguments/gameCopy.ts` next to `ROOM_VISIBILITY_COPY` (`:1604-1665`). Plain language; capacity is **structural availability**, never a verdict, never heat/popularity, never punitive.

```
ROOM_CAPACITY_COPY = {
  room_full_public:  'This argument already has the most people it can hold.',
  room_full_private: 'This is a private one-on-one argument — both seats are taken.',
  seats_open_one:    '1 open seat',
  seats_open_many:   '{count} open seats',
  reserved_seat_note:'One seat is held for the person you invited.',
  private_requires_invite: 'A private argument needs one person invited to start it.',
  at_most_one_invite:'You can invite one person when you start an argument.',
  cannot_invite_self:'You cannot invite yourself.',
}
```

Reuse verbatim from shipped copy: `ROOM_VISIBILITY_COPY.option_public_helper` ("Anyone can find and read this argument.") and `option_private_helper` ("Only people you invite can find and read this argument.") — `gameCopy.ts:1607-1609`. Any internal denial code surfaced to a user (`room_capacity_reached`, `private_requires_invite`) maps through `gameCopy.toPlainLanguage`; unknown codes are suppressed, not echoed (doctrine §9). No string in this card contains a verdict token (winner/loser/correct/true/false/liar/dishonest) or a removal token (kicked/banned/booted) — those appear only in the ban-list tests below.

---

## Tests (named)

**Migration / RLS / trigger (DB harness — `npx supabase db reset` + SQL assertions, or a node integration suite against local Supabase):**

- `roomCapacity.privateNoInvite.rejected` — `create_argument_room(... visibility:'private', invite:null)` raises `private_requires_invite`; and a client self-join into a private room is refused by the tightened INSERT policy.
- `roomCapacity.publicCap.enforced` — five active joins succeed; the sixth raises `room_capacity_reached`.
- `roomCapacity.privateCap.enforced` — creator + invitee = 2; a third active join raises `room_capacity_reached`.
- `roomCapacity.inviteReservesSeat` — public room, creator + 1 pending invite → exactly 3 further non-invitee self-joins succeed; the 4th is rejected (the reserved seat is held).
- `roomCapacity.reservedInvitee.canAcceptAtFullRoom` — private room at cap (creator + reserved invite); the named invitee's accept (service-role path) succeeds.
- `roomInvite.wrongUser.cannotAccept` — a signed-in user whose email ≠ `invitee_email_lower` gets `invite_email_mismatch`, even when a seat is free (asserts the shipped binding at `manage-room-invite/index.ts:561-563` still holds under the cap).
- `roomCapacity.observersUncapped` — inserting a participant with `side='observer'` into a full room succeeds.
- `roomInvite.oneInvitePerRoom` — a second pending invite create on the same room is rejected by `argument_room_invites_one_live_per_room`.
- `roomCapacity.idempotentAccept.noCapTrip` — a re-accept by the already-seated invitee does not raise `room_capacity_reached` (already-seated guard).
- `roomCapacity.noDoubleCount.inviteeSelfJoinPublic` — invitee self-joins a public room via the client (invite stays pending); a later third user still gets the correct seat count (the addressee-already-seated exclusion fires).
- `roomVisibility.oneWay.unregressed` — the QOL-039 `private → public` block (`20260524000015:103-123`) still raises after this migration (sanity).
- `roomCapacity.cap.derivation` — `room_active_seat_cap` returns 5 for public, 2 for private.

**Edge Function (`create-argument-room`):**

- `createArgumentRoom.happy.publicNoInvite` / `.publicOneInvite` / `.privateOneInvite` — 200, correct `debateId` / `inviteId` / `inviteLink` shape.
- `createArgumentRoom.privateNoInvite.rejected` — 400 `private_requires_invite`.
- `createArgumentRoom.twoInvites.rejected` — `validation_failed` (schema accepts ≤ 1).
- `createArgumentRoom.selfInvite.rejected` — 400 `cannot_invite_self`.
- `createArgumentRoom.authRefused` — no JWT → 401.
- `createArgumentRoom.noEnumeration` — response shape + status are identical for an invited email that does vs does not map to an existing account (no `user_exists` signal anywhere).
- `createArgumentRoom.noTokenLeak` — `inviteLink` is returned only to the creator; a static scan asserts the source never `console.*`-logs the raw token, the Authorization header, or `SERVICE_ROLE`.

**Pure-TS model (`roomCapacityModel.test.ts`, 100% on public functions):**

- `roomActiveSeatCap` (public→5, private→2); `openSlotsAfterCreate` (the four valid matrix rows); `isCreationValid` (private+0 invalid, private+1 valid, public+0 valid, public+1 valid, any+2 invalid); `canJoinActive` boundary at cap.
- `parity.tsCapMatchesSqlCap` — asserts `PUBLIC_ROOM_SEAT_CAP === roomActiveSeatCap('public')` so the 6→5 reconciliation cannot half-land.

**Doctrine ban-list:**

- `roomCapacityCopy.banlist` — scans every `ROOM_CAPACITY_COPY` string (and the capacity strip render) for verdict / removal / heat / person tokens; reuses the `_forbiddenChimeInGovernanceTokens()` list shape (`publicSeatModel.ts:833-874`). Zero matches.
- `gameCopy.plainLanguage.coverage` — `room_capacity_reached` and `private_requires_invite` map through `toPlainLanguage` with no snake_case leak.

**Reconciliation (updated, not removed):**

- `publicSeatModel.test.ts` updated for `PUBLIC_ROOM_SEAT_CAP === 5` and chime-in capacity 3; the `{active} of {cap}` strip asserts "of 5". Test count goes up, never down.

---

## Doctrine compliance

- **RLS always on; never disabled.** The new index/trigger/RPC add to existing RLS-enabled tables; no `DISABLE ROW LEVEL SECURITY` anywhere. The participants INSERT policy is replaced via a **new** migration, never by editing the applied `20260516000006` (§8 migration discipline).
- **No service-role in client; no direct client insert into protected tables for the new enforcement.** Capacity is a DB trigger; creation moves to an Edge Function whose service-role RPC is the only authoritative writer (mirrors `submit-argument` and `manage-room-invite`). The client wrapper calls the function; it holds no service-role key.
- **Recursion landmine respected.** Every cross-table read inside a policy or trigger goes through a `SECURITY DEFINER STABLE` helper (`room_active_seat_cap`, `count_active_participants`, `count_reserved_invites`, `user_email_lower`, plus the reused `is_debate_private` / `is_debate_joinable`). No raw cross-table subquery in a policy.
- **No account enumeration.** The create response and the invite flow are uniform regardless of whether the invited email maps to an existing user (mirrors `manage-room-invite` create's `notification: 'queued'`, `index.ts:317-324`).
- **Raw email / token protection (durable).** The raw token is hashed in Deno and never reaches Postgres; only `token_hash` is stored (`20260524000013:78-80`). The raw token appears only in the create-time response to the creator and the send path — never in logs, `list_for_debate`, audit rows, or MCP. Audit/log carry `emailDomain` + a short room id only.
- **No winner/loser/truth/heat copy; plain language via gameCopy (ban-list scanned).** Capacity is structural availability; "full" is a seat fact, never a verdict or a removal. Observers are first-class, never penalized.
- **Email + password v1 only.** The invitee-accept email binding (`auth.jwt() ->> 'email'`, `20260524000013:146`) and `callerEmail` checks assume the shipped email identity; no OAuth.
- **Soft-state only.** No `arguments` row is touched; no invite row is hard-deleted (status flips only, per `20260524000013:38-42`).

---

## GATE-C + merge posture

This card is **deploy-bearing**: `supabase/migrations/**` and `config.toml`-registered `supabase/functions/**` are auto-applied / auto-deployed by the Supabase GitHub integration on merge to `main`. **Merge is a deploy** → GATE-C, Risk High, never-self-approve (a migration-bearing + RLS-bearing change), heightened reviewer verification per the migration-bearing card protocol (`.claude/agents/roadmap-reviewer.md`).

**Recommended split into subcards** (the implementation is too large and too deploy-coupled for one PR):

- **ARG-ROOM-002a (migration):** the four helpers + capacity trigger + tightened participants INSERT policy + `one_live_per_room` index + `create_argument_room` RPC. Migration-bearing; reviewer runs `npx supabase db reset --linked=false` (or the heightened textual review) against the four named issue classes. Lands first.
- **ARG-ROOM-002b (Edge + client):** `create-argument-room` function + `config.toml` registration (`verify_jwt = true`) + the `createArgumentRoom` client wrapper + rewire of `StartArgumentPage` / deprecate the `createDebate` direct insert. Depends on 002a's RPC being live (config.toml registration is what makes it auto-deploy).
- **ARG-ROOM-002c (reconciliation, may fold into the frontend sibling ARG-ROOM-003):** `PUBLIC_ROOM_SEAT_CAP` 6→5 in `publicSeatModel.ts:62` + its tests + the `{active} of {cap}` strip + `roomCapacityModel.ts`. Must land in the same release as 002a so the SQL cap (5) and the TS cap never disagree (the parity test enforces this).

Operator deploy steps (when not relying on the GitHub integration): `npx supabase db push --linked` (002a) then `npx supabase functions deploy create-argument-room --linked` (002b). Claude does not deploy and does not flip any hosted config; the email send remains gated OFF (QOL-040 owns that flip).

---

## Risks

- **High — migration-bearing deploy on merge (QOL-041 incident class).** Mitigations baked in: fully-qualified columns in every subquery, explicit statement order, NULL-cap defensive branch, `SECURITY DEFINER STABLE` helpers, `npx supabase db reset` before claiming done.
- **Reserved-seat double-count** (invitee self-joins a public room via the client while their invite stays pending). Mitigated by the addressee-already-seated `NOT EXISTS` guard in `count_reserved_invites` plus the email-exclusion; covered by `roomCapacity.noDoubleCount.inviteeSelfJoinPublic`.
- **Service-role accept bypasses RLS but not the trigger** — verified compatible with the shipped accept order (participant insert at `manage-room-invite/index.ts:597-599` precedes the invite flip at `:609-617`); the email exclusion makes the still-pending invite not block the invitee.
- **`PUBLIC_ROOM_SEAT_CAP` 6→5 ripples** to `publicSeatModel` tests, the seat strip, and chime-in capacity (4→3). Must land same release; the parity test fails loudly if only one side changes.
- **Creator auto-join moves from client to service-role RPC.** Existing rooms (created via the old path) already have their moderator row; no backfill needed — the trigger only gates new inserts.
- **Legacy private rooms with zero invites** (if any exist in production before this card). The tightened RLS + cap make them effectively single-seat (creator only); a data check should confirm none are stranded. Note for the operator.
- **`auth.users` read in `user_email_lower`.** Definer-scoped, not granted to `authenticated`, returns only a lowercased email to the trigger — no client-reachable surface; verify `search_path` includes `auth`.

---

## Open questions

1. **Does `side='moderator'` always mean the creator?** Today only the creator auto-joins as moderator (`debatesApi.ts:148`), so counting moderators as active is correct for the matrix. If a platform moderator later joins to oversee, should they be exempt from the cap (e.g., `side='moderator' AND profiles.role IN ('moderator','admin')` → uncapped)? Deferred; v1 counts all non-observers.
2. **Observer → active upgrade path.** The current schema has no side-mutation path (`joinDebate` only inserts; PK blocks a second row). An observer who later wants an active seat would need an `UPDATE OF side` trigger branch. Out of v1 scope; flagged for a follow-up.
3. **Post-creation additional invites.** The one-invite-per-room index caps *live* invites at 1 at all times, not just at creation. Confirm this is desired (the cap math implies extra public seats fill by self-join, so a second concurrent reservation is never needed). If post-creation re-invites to a different person after expiry/revoke are wanted, the index already permits them (non-pending invites do not block a new pending one).
4. **Where the 6→5 TS reconciliation lands** — folded into ARG-ROOM-003 (frontend) or kept as 002c. Recommend the frontend card owns the TS constant + copy; this doc's ADR is the doctrinal source either way.
5. **`§13` server-validation scope.** This doc treats the slate's room-creation rules (§13) as exactly the binding matrix in *Product contract*; if §13 in the slate spec carries additional sub-rules, the `create_argument_room` RPC + the Edge validator are the single home to add them.
