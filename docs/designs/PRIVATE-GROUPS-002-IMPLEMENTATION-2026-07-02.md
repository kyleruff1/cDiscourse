# PRIVATE-GROUPS-002 — Implementation (private circle schema + access controls)

**Card:** PRIVATE-GROUPS-002 — issue [#859](https://github.com/CivilDiscourse/cdiscourse/issues/859)
**Epic:** PRODUCT-REDIRECT-001 (#826)
**Canonical design:** [docs/designs/PRIVATE-GROUPS-001.md](./PRIVATE-GROUPS-001.md) (#838, merged)
**Baseline:** main @ `dd8e7a1`
**Gate:** GATE-C (migration-bearing + Edge-function-bearing)
**Reviewed:** 2026-07-02

This is the implementation record for the GATE-C card that consumes the
PRIVATE-GROUPS-001 design. It builds the first net-new social-graph entity in
CDiscourse — a **circle** — plus its membership, invite, room-scoping FK, RLS,
helpers, RPC, and the two service-role Edge Functions that own every write.

---

## Scope

- **Migration** `supabase/migrations/20260702000001_private_groups_002_circles.sql`
  — 3 tables (`circles`, `circle_members`, `circle_invites`), a nullable
  `debates.circle_id` FK + a same-row CHECK, 4 SECURITY DEFINER helpers, the
  `create_circle` RPC, and SELECT-only RLS policies.
- **Edge Functions** `supabase/functions/manage-circle/index.ts` and
  `supabase/functions/manage-circle-invite/index.ts` + shared zod schemas in
  `supabase/functions/_shared/circleSchemas.ts`, registered in
  `supabase/config.toml`.
- **Client (minimal only)** `src/features/circles/circleModel.ts` (pure-TS
  member-count bands / minimal-circle detection / display roll-up) +
  `src/features/circles/circleInviteLifecycle.ts` (pure-TS lifecycle model that
  mirrors the Edge refusal + enrol semantics for the flow test). **No
  circlesApi / circleInviteApi / useCircles / UI** — those are #839/#840/#843.
- **Tests** — 7 new files (132 assertions).

**NO … by Claude:** no production/linked DDL or DML (nothing was ever run with
`--linked`); no manual Edge/Deno/Netlify deploy; no provider spend; no
`submit-argument`; no auto-backfill; no client UX beyond the two pure-TS
models. Docker was unavailable this session, so the local `supabase db reset`
was SKIPPED and the static source-scans are the accepted fallback.

---

## Migration statement-order table

Statement order follows OPS-001 §4 Class 3 (helpers before the policies that
call them; `is_circle_deleted` before `is_circle_member` which calls it).

| # | Statement | Notes |
|---|---|---|
| 1 | `create table public.circles` + RLS enable + comments | owner FK -> auth.users on delete cascade; name 1..80; soft-delete |
| 2 | `create table public.circle_members` + `circle_members_one_owner` partial unique + user/circle partial indexes + RLS enable | role in (owner, member); `unique (circle_id, user_id)` |
| 3 | `create table public.circle_invites` + `circle_invites_one_live` (per-address) + token/circle indexes + RLS enable | clone of `argument_room_invites`; NO per-circle single-invite cap |
| 4 | `alter table public.debates add column circle_id` + `debates_circle_id` partial index | additive, default NULL |
| 5 | Helpers: `is_circle_deleted`, `is_circle_member`, `is_circle_owner`, `is_argument_visible_in_circle` | all `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public` |
| 6 | `alter table public.debates add constraint debates_circle_requires_private` | same-row CHECK; validates trivially |
| 7 | `create_circle(...)` RPC | plpgsql SECURITY DEFINER; service_role grant only |
| 8 | SELECT policies on the 3 tables | zero authenticated write policy anywhere |

---

## Helper signature + GRANT matrix

| Helper | Signature | Attributes | REVOKE PUBLIC | GRANT authenticated | GRANT service_role |
|---|---|---|---|---|---|
| `is_circle_deleted` | `(p_circle_id uuid) -> boolean` | sql STABLE DEFINER search_path=public | yes | **NO** (definer-only, oracle avoidance) | — |
| `is_circle_member` | `(p_circle_id uuid, p_user_id uuid default auth.uid()) -> boolean` | sql STABLE DEFINER search_path=public | yes | yes | — |
| `is_circle_owner` | `(p_circle_id uuid, p_user_id uuid default auth.uid()) -> boolean` | sql STABLE DEFINER search_path=public | yes | yes | — |
| `is_argument_visible_in_circle` | `(arg_id uuid, viewer_id uuid) -> boolean` | sql STABLE DEFINER search_path=public | yes | yes | — |
| `create_circle` | `(p_owner_id uuid, p_name text, p_description text) -> uuid` | plpgsql DEFINER search_path=public | yes | **NO** | **yes (only)** |

`is_argument_visible_in_circle` body BEGINS with a call to
`public.is_argument_visible(arg_id, viewer_id)` (the COV-004 canonical arms are
preserved BY CALL, never inlined). Its circle arm requires
`a.status = 'posted' AND a.inactive_at IS NULL AND NOT
public.is_debate_inactive(a.debate_id) AND d.circle_id IS NOT NULL AND
d.visibility = 'private' AND public.is_circle_member(d.circle_id, viewer_id)`.
Update in **LOCKSTEP** with `is_argument_visible`; the
`circleVisibilityCompositionRlsScan` test is the alarm bell.

---

## RLS policy table + zero-authenticated-write attestation

| Table | Policy | Command | USING |
|---|---|---|---|
| `circles` | `circles_select_member_owner_admin` | SELECT | `is_circle_member(id) OR is_circle_owner(id) OR is_moderator_or_admin()` |
| `circle_members` | `circle_members_select_member_admin` | SELECT | `is_circle_member(circle_members.circle_id) OR is_moderator_or_admin()` |
| `circle_invites` | `circle_invites_select_inviter_own` | SELECT | `circle_invites.invited_by = auth.uid()` |
| `circle_invites` | `circle_invites_select_circle_owner` | SELECT | `is_circle_owner(circle_invites.circle_id)` |
| `circle_invites` | `circle_invites_select_invitee_own` | SELECT | `circle_invites.invitee_email_lower = lower(auth.jwt() ->> 'email')` |
| `circle_invites` | `circle_invites_select_mod_or_admin` | SELECT | `is_moderator_or_admin()` |

**Zero-authenticated-write attestation:** there is **no** `FOR INSERT`, `FOR
UPDATE`, or `FOR DELETE` policy — for the `authenticated` role or any role — on
`circles`, `circle_members`, or `circle_invites`. Every write flows through the
service-role Edge Functions (`create_circle` RPC for create; service-role
UPDATE for rename/soft-delete/transfer/remove; service-role insert for invite
enrolment). RLS stays ENABLED on all three tables; nothing is disabled. The
`circleRlsScan` test pins this (each table has RLS enabled + no write policy;
every circle-table policy is `FOR SELECT`).

**No existing arm loosened:** the migration does NOT touch the COV-004
`is_argument_visible` body or any `arguments` / `debates` /
`debate_participants` SELECT policy. Circle reads are strictly additive via the
new sibling helper + the new tables' own SELECT policies.

---

## Edge action tables

### `manage-circle` — `verify_jwt = true`

| Action | Auth posture | Authorization | Never returns |
|---|---|---|---|
| `create` | JWT (createCallerClient + getUser) | — (any authed user) | — (returns own circleId + role) |
| `rename` | JWT | `authorizeOwner` (circles.owner_id === caller) BEFORE update | another member's PII |
| `soft_delete` | JWT | `authorizeOwner` BEFORE update | — |
| `transfer_ownership` | JWT | `authorizeOwner` + new owner must be a live member; demote-then-promote in service-role tx | — |
| `remove_member` | JWT | `authorizeOwner` BEFORE update; owner cannot self-remove | — |
| `list_mine` | JWT | caller-scoped RLS read | another member's email / PII |

`create` calls `create_circle` RPC with `p_owner_id = the caller id` (never a
client-supplied owner).

### `manage-circle-invite` — `verify_jwt = false`

| Action | Auth posture | Authorization | Never returns |
|---|---|---|---|
| `create` | JWT (re-checked in fn) | `is_circle_owner` BEFORE token mint | the raw token (except this create response) |
| `revoke` | JWT | caller-scoped RLS read of the invite | — |
| `list_for_circle` | JWT | caller-scoped RLS read | `token_hash`; emails are masked |
| `lookup_by_token` | **UNAUTH** (token is the auth) | service-role read | the member list; another member's email |
| `accept` | JWT | email-binding (caller email === invitee_email_lower) | JWT / session / raw token |
| `provision_and_accept` | **UNAUTH** (token+email+password) | email-binding BEFORE provisioning | JWT / session / raw token / admin email |

Accept + provision enroll into `circle_members` (role `member`) via service
role and flip the invite to `accepted` (idempotent re-accept; re-add-after-
removal reuses the row). The raw token is minted (`generateInviteToken()`) and
returned ONCE in the create response only; only `token_hash` is stored.

---

## Test inventory + counts

| File | Assertions (approx) | Covers |
|---|---|---|
| `__tests__/circleModel.test.ts` | 19 | every pure fn + failure/empty; band ban-list |
| `__tests__/circleMigration.test.ts` | 33 | 3 tables + RLS; indexes; debates.circle_id + CHECK; helper signatures + pins; create_circle shape + grant; statement order; NO-BACKFILL; highest sequential |
| `__tests__/circleRlsScan.test.ts` | 30 | RLS enabled; NO authenticated write on any table; each SELECT arm; helper GRANT surface; recursion (no raw subquery) |
| `__tests__/circleVisibilityCompositionRlsScan.test.ts` | 8 | THE ANCHOR — is_argument_visible by CALL, never inlined; circle arm requires private + is_circle_member; extends the COV-004 drift detector |
| `__tests__/manageCircleSafety.test.ts` | 16 | handler structure; owner-gate-before-mutate; create_circle p_owner_id=caller; no console.log/leak; PII safety; error codes; config registration |
| `__tests__/manageCircleInviteSafety.test.ts` | 20 | 6 handlers; owner-gate; lookup/provision service-role-only; email-binding-before-provisioning; raw-token-only-in-create; no leak; ban-list; config registration |
| `__tests__/circleInviteFlow.test.ts` | 12 | lifecycle over an in-memory store: mint -> lookup -> mismatch -> accept enrolls -> idempotent re-accept -> expired/revoked/deleted refusals -> re-add reuse |

**132 new tests / 7 suites.** All pass. Full suite: **32502 -> 32634 passed
(+1 pre-existing skip = 32635 total), 883 suites, exit 0.** Typecheck + lint
(`--max-warnings 0`) clean.

---

## Doctrine self-check

- **§1 (no truth labels):** a circle is an access/memory boundary; nothing
  labels a person/claim. Circle name/description are user content, scanned by
  the ban-list test in rendered UI. Band tokens (`empty`/`solo`/`pair`/`small`/
  `large`) carry no verdict. ✅
- **§2 (heat = activity):** no heat/temperament/ranking in the circle model. ✅
- **§3 (popularity != evidence):** no leaderboard, no ranking, no
  engagement-as-signal. Member count is structural. ✅
- **§4 (AI limits):** no AI; membership is deterministic SQL. ✅
- **§5 (engine sacred):** the Constitution engine is untouched. ✅
- **§6 (secrets):** `token_hash` (sha-256) only, raw token never stored;
  service-role only inside Edge Functions; no secrets printed/logged. ✅
- **§7 (no AI from production app):** none. ✅
- **§8 (Supabase conventions):** RLS enabled on every new table; no
  authenticated write policies; soft-delete only; sequential append-only
  migration; helpers REVOKE PUBLIC + grant to authenticated (except the
  definer-only oracle); RPC granted to service_role only. ✅
- **§9 (plain language):** no internal codes surfaced. ✅
- **§10 (v1 scope guards):** no voting/winner, no push notifications, no
  argument search, no public API. ✅
- **supabase-edge-contract:** no service-role in client; no direct `arguments`
  insert; RLS always on; migrations append-only; standard Edge shape
  (CORS -> auth -> validate -> authorize -> narrowest-client mutate -> JSON,
  no secrets echoed). ✅
- **COV-004 composition (the load-bearing one):** canonical
  `is_argument_visible` arms preserved by CALL, never inlined-and-diverged; the
  circle grant is a strict additive superset in a sibling helper; zero existing
  arms loosened; the drift test extends to the circle helper. ✅

---

## NO-BACKFILL rationale (consent-preserving)

The migration is **purely additive**: 3 new tables + one nullable column
(`debates.circle_id`, default NULL) + helpers + one RPC + SELECT policies.
**Zero existing rows are mutated.** There is NO `INSERT INTO circles /
circle_members / circle_invites` and NO `UPDATE public.debates SET circle_id`
anywhere in the migration. Existing private rooms were created under
`argument_room_invites` (per-room, email-keyed) with **no consent to a
persistent group memory boundary**; auto-converting them into circles would
retroactively create a durable social-graph object the participants never opted
into — a consent violation. Circles are a **forward** primitive; users opt in
by creating them. Every existing `debates` row keeps `circle_id = NULL` (today's
behaviour, bit-for-bit). This is the safest possible rollout posture.

---

## Rollback posture (forward-only)

The migration adds tables + one nullable column + helpers + RPC + SELECT
policies. Rolling back = a **follow-up** migration that `DROP`s the new objects
and the `circle_id` column (never editing the applied file). Because
`circle_id` defaults NULL and nothing reads it until downstream cards ship,
dropping it is non-destructive to existing room behaviour. No existing
policy/helper is edited, so a rollback cannot re-open a private-room leak.

---

## Interpretive-notes ledger (audit-ratified)

1. **`create_circle` signature** — `(p_owner_id uuid, p_name text,
   p_description text) -> uuid`, plpgsql SECURITY DEFINER, granted to
   `service_role` only. The Edge `create` action passes `p_owner_id = the
   caller` resolved from the JWT.
2. **`is_circle_deleted` is definer-only** — REVOKEd from PUBLIC and NOT granted
   to `authenticated` (oracle avoidance); it is called only inside the other
   helpers.
3. **Client wrappers scoped out** — `circlesApi` / `circleInviteApi` /
   `useCircles` and all UI are OUT OF SCOPE (owned by #839/#840/#843). This card
   ships only `circleModel.ts` + `circleInviteLifecycle.ts` (pure TS).

---

## Operator deploy steps

Migration-bearing + adds two Edge Functions. **MERGE = production migration
apply + Edge deploy** via the Supabase GitHub integration (the two functions
are registered in `config.toml` in THIS PR, so they auto-deploy on merge to
`main`). The merge gate therefore requires **separate operator authorization**.

- Auto path (on merge): the Supabase integration applies
  `20260702000001_private_groups_002_circles.sql` and redeploys the registered
  `manage-circle` + `manage-circle-invite` functions.
- Manual fallback: `npx supabase db push --linked`, then
  `npx supabase functions deploy manage-circle --linked` and
  `npx supabase functions deploy manage-circle-invite --linked`.
- No env var, no secret rotation, no provider spend required.

**No-spend / no-deploy attestation (this card):** the migration was NOT applied
to any linked/production DB in this gate — verification was local-only
(source-scan; Docker unavailable so `supabase db reset` was skipped). No Edge
function was deployed by Claude. No provider spend. No `--linked` anything.
