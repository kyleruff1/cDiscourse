# ARG-ROOM-004 — email transport smoke (2026-06-13)

Operator-authorized, single live send of the **new-user Auth-invite bridge**
(`INVITE_AUTH_BRIDGE_ENABLED`). Data plane only, admin JWT + the two deployed
Edge functions (`create-argument-room`, `room-notifications`). No service-role in
the harness. Gate armed for the smoke and disarmed after. No hard deletes.

## Gate lifecycle

| Step | Action | Result |
|---|---|---|
| Arm | `supabase secrets set INVITE_AUTH_BRIDGE_ENABLED=true` | set on project `qsciikhztvzzohssddrq` (== harness target), verified present |
| Smoke | one Auth-bridge send | see below |
| Disarm | `supabase secrets unset INVITE_AUTH_BRIDGE_ENABLED` | verified absent |

`INVITE_EMAIL_ENABLED` was **never** armed (existing-user Resend branch was out of
scope). Only the new-user bridge gate was touched.

## What the smoke did

1. `create-argument-room` (private + one invite to a fresh alias, with an `Origin`
   header) → mints the room + reserved invite + returns the create-time
   `inviteLink` carrying the raw token.
2. `room-notifications` `{ type: 'invite', inviteToken, … }` (with `Origin`) →
   the new-user branch builds `redirectTo = <origin>/auth/callback?invite=<token>`
   and calls `supabase.auth.admin.inviteUserByEmail`.

Critical contract detail: the new-user branch calls `inviteUserByEmail` **only when
`redirectTo` is non-null**, i.e. only when a valid raw token is present
(`room-notifications/index.ts:531-539`). A null token ⇒ no send. `notification:
queued` is a **gate-posture** value (any gate armed → `queued`), NOT a delivery
confirmation — by design, for no-enumeration.

Harness note: `create-argument-room`'s `inviteLink` is occasionally null in this
server-side harness (no browser Origin guarantee); the robust runner therefore
**retries create until it holds a valid token**, then fires the send exactly once.
A first attempt to `+arg004smoke2` had a null token ⇒ **no email sent**; the real
send went to `+arg004smoke3` on a token-bearing attempt.

## Result

| Check | Status | Evidence |
|---|---|---|
| Gate armed on the correct project | **PASS** | `qsciikhztvzzohssddrq`, verified in `secrets list` |
| `room-notifications` fired `inviteUserByEmail` (token + Origin present) | **PASS** | `notification: queued`, winner had a valid token |
| **Email arrives** | **PASS (operator)** | operator confirmed inbox `kyleruff+arg004smoke3@gmail.com` |
| **CTA opens Netlify, not localhost** | **PASS (operator)** | operator confirmed `https://cdiscourse.netlify.app/auth/callback?invite=…` |
| **New-user set-password** | **PASS (operator)** | operator confirmed |
| **Invite auto-accepts (reserved seat)** | **NOT CONFIRMED at DB** | invite `3e8286a5` was still `pending` at cleanup (`accepted_at: null`, `invitee_profile_id: null`) |
| **Invitee lands enrolled in room** | **NOT CONFIRMED at DB** | room `97ad8acb` participants = creator only (`ce8a9018`, moderator); invitee not enrolled |
| Gate disarmed | **PASS** | `secrets unset` verified absent |

### The accept/enrollment gap (open finding)

The **email transport half is verified** (gate → Auth-bridge send → real inbox →
Netlify callback → set-password). The **accept/enrollment half is NOT verified at
the database layer**: at cleanup time the winner invite was still `pending` (so it
was never accepted) and the invitee was not a participant. Two candidate causes,
to disambiguate on a follow-up:

1. **Auto-accept bridge did not persist** — the cold-start `?invite=` →
   `manage-room-invite accept` step may not have fired/enrolled (a real bridge gap
   worth a focused look), despite set-password succeeding.
2. **Cleanup-timing collision** — cleanup ran immediately on the operator's
   "round-trip worked, clean up" and revoked the still-`pending` invite; if the
   accept had not yet completed, the revoke then blocked it. (Revoking an
   *accepted* invite is a no-op 409, so a completed accept could not have been
   undone — which is why this points at the accept not having completed first.)

**Recommended follow-up (separate, operator-gated):** re-arm the bridge gate, send
to a fresh alias, and on the accept step verify the DB **before** any cleanup:
`argument_room_invites.status = 'accepted'` (+ `accepted_at`, `invitee_profile_id`
set) and a `debate_participants` row for the invitee. Only then disarm + archive.

## Cleanup / disarm (done)

- All `[ARG-ROOM-004%` smoke rooms archived (status flip) — 0 non-archived remain.
- All smoke **pending** invites revoked (incl. the winner, which was pending).
- Real user room `8114dad3` + invite `7b88d236` untouched (hard-guarded; still the
  only system-wide pending invite).
- Gate `INVITE_AUTH_BRIDGE_ENABLED` unset (disarmed) + verified absent.
- The `+arg004smoke3` auth user (created by `inviteUserByEmail`, password set by the
  operator) is **left in place** — leaving one unconfirmed test account is expected;
  flag for removal if desired (service-role admin op).
- Hard deletes: **none**.

## Update — accept retest conclusion (smoke4–smoke7) + a deployed UX finding

After the rate-limit window cleared, the accept round-trip was retried with the
operator **logged out** (the earlier fails were the operator clicking the invite
while signed in as another account → email-binding mismatch, working as designed).

Findings, in order, on the **old deployed Auth-bridge path** (Supabase built-in
Auth email; this path is being superseded by EMAIL-TRANSPORT-001 #635):

1. **Rate limit confirmed.** Supabase's built-in Auth email is ~3–4/hr; smoke5/6
   did not deliver after several sends in one window. Production needs custom SMTP.
2. **Logged-in mismatch** was the smoke3 accept failure (email-binding 403), not a
   bridge bug.
3. **NEW finding (smoke7, logged out): the set-password / credentials-creation
   screen never loaded.** The Supabase-branded invite email delivered and the CTA
   reached the deployed site, but the `/auth/callback` set-password UI for the
   invited new user did not render — so no alias session was established and the
   auto-accept could not run. Invite stayed `pending`; invitee never enrolled.

This is a **deployed `/auth/callback` set-password UX gap**, not a transport or
rate-limit problem. **Relevance to EMAIL-TRANSPORT-001:** the new product-email
lane routes its CTA to an **app-controlled invite redemption route** (not
Supabase's `/auth/callback`), so the new design must **own** the new-user
credential-creation step rather than depend on this callback screen. Recommend a
focused look at `src/features/auth/AuthCallbackScreen.tsx` /
`src/lib/auth/parseAuthCallbackUrl.ts` for the invite/set-password type, tracked
as a follow-up under the EMAIL-TRANSPORT-001 new-user flow (or a standalone
AuthCallback bug).

**Net for ARG-ROOM-004 email transport:** the gated Auth-bridge **send** is
verified (delivers when armed + within rate limit); the new-user **accept
round-trip** is NOT yet provable on the deployed app due to the set-password UX
gap — to be re-verified through EMAIL-TRANSPORT-001's app-controlled route.

Cleanup (this run): gate `INVITE_AUTH_BRIDGE_ENABLED` disarmed + verified absent;
all `[ARG-ROOM-004%` smoke rooms archived; all smoke pending invites revoked;
real user room/invite untouched; no hard deletes. The `+arg004smoke4..7` auth
users created by `inviteUserByEmail` are left in place (test accounts).
