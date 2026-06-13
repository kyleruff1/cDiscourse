# ARG-ROOM-004 — Invite acceptance, email transport, and auth-context handoff

Status: Design draft
Epic: Room Visibility & Invite (`ARG-ROOM-VISIBILITY-INVITE` slate)
Release: 6.7
Issue: #615 — https://github.com/kyleruff1/cDiscourse/issues/615

---

## Goal

Close the last gap between "a creator names one invitee at room creation" and "that invitee is sitting in the seat." The acceptance machinery, the new-user account flow, and the device-local context preservation are **already shipped**. What is missing is the **create-time orchestration** that wires them together, plus the **email transport** that actually reaches a brand-new or existing invitee with a working link.

Concretely, this card delivers five residuals on top of shipped seams — framed as **live-surface exposure** (turning the OFF-by-default email scaffold into a wired create path), **reconciliation** (feeding the create-path raw token into the transport whose link is currently `null`), and **handoff** (bridging the shipped `pendingInviteIntent` auto-accept so a brand-new invitee lands in the seat after setting a password). It rebuilds nothing.

This card is auth/email/transport only. It does **not** enforce the public five-seat cap at accept time — that is `ARG-ROOM-003`'s job (the accept path stays count-blind; see Divergence). It writes **no migration** (no new column is needed — the bridge travels in a URL, the token already persists as a hash).

---

## Product contract (the matrix verbatim)

| Visibility | Direct invites | Reserved seat | Open slots after create | Total capacity | Valid? |
| Private | 0 | 0 | 0 | 2 | NO (private requires one invite) |
| Private | 1 | 1 | 0 | 2 | YES (default) |
| Public | 0 | 0 | 4 | 5 | YES |
| Public | 1 | 1 | 3 | 5 | YES |
| any | 2+ | — | — | — | NO (max one direct invite) |

One direct invite at creation. Private rooms are 1v1. Public rooms are capped at five active participants. A public direct invite reserves one of the five seats. Public with no invite is valid. Private with no invite is invalid. Observers are not active participants.

ARG-ROOM-004 owns the **transport and acceptance** of that one direct invite — the row, the email, the account handoff, and the seat enrolment. It does not decide whether the invite was permitted (that is the create card) or whether a seat remains (that is the seat-cap card).

---

## Existing shipped state (file:line — what to REUSE)

The acceptance/auth half of this flow is dense and already proven end-to-end in production (the `devtest98` smoke). Reuse all of it.

**Invite row + token (QOL-038).**
- `argument_room_invites` row mint, raw token, and hash live in `supabase/functions/manage-room-invite/index.ts` `handleCreate` (:165-325). The raw token is generated at :257 and hashed at :258; only the hash (`token_hash`) is stored at :269. The web link `<origin>/invite/<token>` is built at :297-302 from the request origin (sanitised at :327-341) and returned to the inviter **only** at create time (:317-324).
- Five actions: `create` / `revoke` / `list_for_debate` / `lookup_by_token` (unauthenticated — the token is the auth) / `accept` (:91-103). `verify_jwt = false` with per-action auth inside (`supabase/config.toml`:427-428).
- `handleAccept` (:511-638) is the security spine: email-binding (`callerEmail === invite.invitee_email_lower`) at :561-563; idempotent re-accept by the same redeemer at :547-558; participant enrolment on the opposite side at :592-607; room-status guards at :572-577.
- Client wrappers in `src/features/invites/inviteApi.ts` — `createRoomInvite` (:142-151), `lookupInviteByToken` (:175-182), `acceptRoomInvite` (:184-188). The `inviteLink` is returned to the inviter only and never logged (:11-14, :42-55).
- Acceptance UI is `src/features/invites/InviteRedeemGate.tsx`: auto-fires `accept` on (signed-in + live pending + email match) at :117-127, and renders tailored recovery panels — mismatch (:402-418), expired/revoked/already-used/archived/closed/not-found (:230-321) — via `AcceptErrorBranch` (:267-321). Copy is `INVITE_REDEEM_COPY` in `src/features/invites/inviteCopy.ts`:110-125.

**Email transport scaffold (QOL-040, OFF by default).**
- The Resend send block is `maybeSendInviteEmail` in `supabase/functions/room-notifications/index.ts`:230-317 — gated on `INVITE_EMAIL_ENABLED` + `RESEND_API_KEY` + `INVITE_EMAIL_FROM` (:238-243), POSTs to Resend at :282-297, returns `not_configured` with **no** network call until the operator flips the gate. It strips HTML/control characters from copy (`safeLine`, :260) and **never** logs the key, the response body, or the recipient (:228, :298-316).
- The existing-user lookup pattern (service-role `auth.admin.listUsers`, match by lower-cased email) is at :376-382.
- **The reconciliation gap:** `handleInvite` passes `inviteLink: null` at :416 with the comment "the raw token is unrecoverable from the hash." So today, even with the gate flipped, the existing-user email would carry no usable link.

**New-user Auth invite + set-password (#607/#608, shipped + smoke-passed).**
- `supabase/functions/admin-users/index.ts` `handleInviteUser` (:364-424) calls `auth.admin.inviteUserByEmail(email, { redirectTo })` (:374-381) — creates the auth user and sends the branded Supabase "Invite user" template. The response carries no id/email/link/token (uniform `buildInviteResponse`, :423); a generic failure is never special-cased into "already exists" (:397-399 — no enumeration).
- The redirect target for the `invite` flow defaults to `/auth/callback` (`src/lib/auth/buildAuthRedirectUrl.ts`:47-53, pure builder :161-174).
- The callback consumer chain: `parseAuthCallbackUrl` (pure, auth-only; never widened — `src/lib/auth/parseAuthCallbackUrl.ts`:120-188, secret-param redaction :57-65, :200-208) → `consumeAuthCallback` returns `needs_password` for exactly `type=invite` (`src/features/auth/consumeAuthCallback.ts`:52-54, :118) → `AuthCallbackScreen` hosts the set-password form (`src/features/auth/AuthCallbackScreen.tsx`:104-121) and clears the URL on Continue via `history.replaceState` (:93-102).
- End-to-end proven in production: `docs/testing-runs/2026-06-13-auth-live-invite-seed-smoke.md` (`devtest98` full success, :58-68).

**Context preservation (`pendingInviteIntent`, QOL-038).**
- `src/features/invites/pendingInviteIntent.ts` — `buildPendingInviteIntent` (:70-78), `savePendingInviteIntentToStorage` (:139-150), `loadPendingInviteIntentFromStorage` (:156-172), 24h freshness window (:63, :102-111). Token shape is validated by `isValidInviteTokenShape` (`src/features/invites/inviteDeepLink.ts`:55-60).
- `App.tsx` cold-start capture effect (:170-206) reads an `/invite/<token>` deep link and dispatches `SET_PENDING_INVITE_INTENT` (:185, :198). Routing priority: `AuthCallbackScreen` is highest (:290-304); the `InviteRedeemGate` runs next when an intent is live (:307-324).

**Operator smoke discipline (already written).**
- `scripts/auth/sendInviteSmoke.js` — dry-run by default (:127-140), present+length-only diagnostics (`fingerprint`, :60-65), `/auth/callback` redirect allow-list (`validateRedirectTo`, :101-123; hosts :45-49), live path invokes the audited `admin-users` `invite_user` action with no service-role in the script (:257-276). Hosted Auth URL config (Site URL + redirect allow-list) is now Netlify-correct (`docs/testing-runs/2026-06-13-auth-live-invite-seed-smoke.md`:46-50).

---

## Divergence from shipped (what this card adds/changes)

This card adds orchestration and transport wiring around the shipped pieces. It changes no acceptance logic and no auth parser.

1. **Create-time branch (BUILD, server-side).** `manage-room-invite` `handleCreate` learns to notify the invitee after the row is minted, branching on existing-vs-new **inside the function** (so the branch is invisible to the inviter):
   - existing user → the Resend room-invite email **with a working link** (the reconciliation: feed the create-path raw token, not the `null` at `room-notifications`:416);
   - new user → the Supabase Auth invite, whose redirect carries the room token so the seat auto-accepts after set-password.
2. **The `?invite=<token>` bridge (BUILD, tiny).** A new pure extractor reads `?invite=<token>` off the `/auth/callback` URL and seeds the shipped `pendingInviteIntent`. `parseAuthCallbackUrl` is **not** widened (it stays pure and auth-only).
3. **Uniform no-enumeration response (BUILD, small).** The create response shape is unchanged but its values are computed so the inviter cannot tell existing from new.
4. **Recovery copy (mostly REUSE).** The bridged new-user lands on the same `InviteRedeemGate` recovery surface; at most one optional reassurance line is added.
5. **Smoke PLAN (BUILD, dry).** Extend `sendInviteSmoke.js`'s plan to assert the `?invite=` round-trip and the existing-user transport — **no sends in this card**.

**ADR note (binding, recorded for the whole slate):** the public active-participant cap is reconciled from the shipped GAME-005 `PUBLIC_ROOM_SEAT_CAP = 6` to **5**. ARG-ROOM-004 does **not** implement that cap — `handleAccept` deliberately stays seat-count-blind (it only checks email-binding + room status, :561-577); seat enforcement is `ARG-ROOM-003`. ARG-ROOM-004 only guarantees that a create-time direct invite, when accepted, reserves exactly one seat by enrolling exactly one participant row (the shipped `(debate_id, user_id)` primary key makes that idempotent, :597-607).

---

## Chosen approach

Do the invitee notification **where the raw token already lives** — inside `handleCreate` — and bridge the new-user account back to the seat with a query parameter on the redirect. This keeps the token entirely server-side (it never round-trips through the client for the existing-user case) and reuses every shipped seam.

### (a) New-user create-time bridge — REUSE + small BUILD

**Flow:** create mints row + raw token (REUSE, `manage-room-invite`:257-269) → service-role existing-user lookup (REUSE the pattern at `room-notifications`:376-382) → **new** → `svc.auth.admin.inviteUserByEmail(inviteeEmail, { redirectTo })` (REUSE the primitive used at `admin-users`:374-381, but invoked here under the already-passed room-scoped authorization at `manage-room-invite`:204-232, so a non-admin creator can invite to *their* room) with:

```
redirectTo = `${safeOrigin}/auth/callback?invite=${rawToken}`
```

`safeOrigin` is the already-sanitised request origin (`manage-room-invite`:301, :327-341); the `/auth/callback` path matches the shipped default (`buildAuthRedirectUrl`:47-53) and the hosted allow-list (`config.toml`:164-170; hosted value fixed per the smoke doc :46-50).

**Handoff (BUILD, ~10 lines in `App.tsx` + one pure helper):**
- New pure helper `extractBridgedInviteToken(url): string | null` — parses the URL, reads `searchParams.get('invite')`, returns it only if `isValidInviteTokenShape` passes (REUSE :55-60), else `null`. Never throws. **Does not import or touch `parseAuthCallbackUrl`.** (Note `parseInviteDeepLink` cannot be reused as-is: it only matches the `/invite/<token>` *path* and strips the query, `inviteDeepLink.ts`:97-116.)
- In `App.tsx`, at the same synchronous `/auth/callback` capture point (:125-129), also call the extractor; if a token is present, `buildPendingInviteIntent` + `savePendingInviteIntentToStorage` + `dispatch SET_PENDING_INVITE_INTENT` (REUSE all three).

**Why this auto-completes with zero new accept logic:** routing priority renders `AuthCallbackScreen` first while `authCallback.active` is true (`App.tsx`:290-304); the intent branch (:307) is lower priority, so it does not pre-empt set-password. When the user taps Continue, `finishAndExit` flips `authCallback.active = false` (`AuthCallbackScreen`:93-102); the session is already live (set via `consumeAuthCallback`, flowing through `onAuthStateChange`); now the live intent renders `InviteRedeemGate`, whose shipped effect auto-fires `accept` on (signed-in + pending + email match) (:117-127). Email-binding passes because the Auth invite created the account with the invitee's exact email (`handleAccept`:561). The `savePendingInviteIntentToStorage` persistence covers a reload between set-password and Continue.

**Decision: prefer the `?invite=` redirect over a same-device storage seed.** Seeding `savePendingInviteIntentToStorage(token)` on the *creator's* device (the other option in the brief) only bridges when the invitee finishes on that same device — false for a brand-new invitee opening their email elsewhere. The query parameter travels *in the email link*, so it is cross-device safe. The storage seed remains a same-device complement, not the primary mechanism.

### (b) Existing-user email with a working link — REUSE (lift) + reconciliation

Lift `maybeSendInviteEmail` verbatim into `supabase/functions/_shared/inviteEmail.ts` (REUSE the body, gating, redaction, and `safeLine` exactly as at `room-notifications`:230-317) so both functions can call it. From `handleCreate`'s existing-user branch, call it with `inviteLink` = the **create-path raw-token link** already built at :302 — closing the `inviteLink: null` reconciliation gap (`room-notifications`:416). The token never leaves the Edge boundary (no client round-trip), and the transport stays OFF until the operator flips `INVITE_EMAIL_ENABLED`.

### (c) Uniform no-enumeration response — small BUILD

Keep the shipped `CreateRoomInviteResponse` shape (`inviteApi.ts`:42-55). Make its values branch-independent:
- `inviteLink` is **always** returned to the inviter (the `/invite/<token>` link works for new and existing alike via the shipped signed-out → `SignedOutPrompt` path in `InviteRedeemGate`:209-223). Returning it both ways leaks nothing.
- `notification` is computed from one rule that does not read the existing-vs-new branch: `not_configured` when no transport gate is armed (the default in this card), otherwise `queued`. The Resend `sent`-vs-`queued` deliverability distinction is collapsed to `queued` at the create boundary so per-branch deliverability cannot leak. The inviter sees identical output regardless of who the invitee is.

### (d) Recovery copy on the accept route — REUSE

The bridged new-user uses the same `InviteRedeemGate` surface; all recovery panels already exist (mismatch/expired/revoked/already-used/archived/closed/not-found, `InviteRedeemGate`:230-321, copy `inviteCopy.ts`:110-125). At most one optional, ban-list-clean reassurance line is added for the brief window between callback-done and gate-accept (see UI copy). No new error branch is required.

### (e) Live-smoke PLAN (no sends) — BUILD (dry)

Extend `sendInviteSmoke.js` and write a testing-run **plan** mirroring the shipped discipline: dry-run default, present+length-only diagnostics, `/auth/callback` redirect allow-list (REUSE :45-123). Add two dry assertions: (1) the new-user redirect carries `?invite=<token>` and still resolves to an allow-listed `/auth/callback` host; (2) the existing-user transport path is exercised in dry mode (gate OFF → `not_configured`, no network). The hosted Auth URL config precondition is already satisfied (smoke doc :46-50).

---

## Alternatives rejected

- **Widen `parseAuthCallbackUrl` to also read `?invite=`.** Rejected — the brief forbids it and it would entangle the auth-secret parser with an invite capability. The standalone extractor keeps the parser pure and auth-only (:120-188).
- **Route the existing-user link through the client + `room-notifications`.** The client holds `inviteLink` after create (`useRoomInvites`:76-77) and could pass it to `room-notifications`. Rejected — it round-trips the raw token through a second client request and a second Edge function for no benefit; doing the send in `handleCreate` keeps the token on one server boundary.
- **Call `admin-users` `invite_user` from the create path.** Rejected — that action enforces `requireAdmin` (the smoke script authenticates as an admin, `sendInviteSmoke.js`:237-255); a non-admin room creator cannot use it. Invoking `inviteUserByEmail` directly from `manage-room-invite` (which already has a service-role client and room-scoped authorization) is the correct seam.
- **Send both a Supabase Auth invite and a Resend email to a new user.** Rejected — double email; the new user cannot accept before they have an account, so the Auth invite (which creates the account) is the only useful email for them.
- **Add a column to mark "joined via bridge."** Rejected — no new state is needed; the token + email-binding already identify the redeemer (`handleAccept`:561). No migration.
- **Branch the response (`inviteLink` for existing, hidden for new).** Rejected — leaks existing-vs-new, violating the no-enumeration rule. Uniform response (c).

---

## Data/API shape

**No migration. No new table or column.** Reuse `argument_room_invites` (QOL-038) and `debate_participants` (the `(debate_id, user_id)` primary key, idempotent enrol). RLS unchanged and never disabled.

**`manage-room-invite` `create` request** — unchanged (`inviteSchemas.ts`:26-29): `{ action: 'create', debateId, inviteeEmail, intendedSeat }`.

**`manage-room-invite` `create` response** — same fields (`inviteApi.ts`:42-55), branch-independent values:

```
{ inviteId, status: 'pending', expiresAt, reused, inviteLink, notification }
//                                                              ^ 'not_configured' | 'queued' (no per-branch leak)
//                                          ^ always present (works for new + existing)
```

**Server-side branch inside `handleCreate` (BUILD), after the row insert at :261-295:**

```
existingUserId = serviceLookupByEmail(inviteeEmailLower)   // REUSE pattern room-notifications:376-382
if (existingUserId)  maybeSendInviteEmail({ ...,            // REUSE lifted _shared/inviteEmail.ts
                       inviteLink: `${safeOrigin}/invite/${rawToken}` })  // reconciliation vs :416
else                 svc.auth.admin.inviteUserByEmail(inviteeEmail, {     // REUSE primitive admin-users:374
                       redirectTo: `${safeOrigin}/auth/callback?invite=${rawToken}` })  // (a) bridge
return uniformResponse                                     // (c)
```

**Client / handoff (BUILD):**
- `extractBridgedInviteToken(url): string | null` — new pure helper (token-shape-gated, never throws).
- `App.tsx` — one extra read at the existing capture point; dispatches `SET_PENDING_INVITE_INTENT` + persists. No change to routing priority.

Both transport gates stay OFF by default: `INVITE_EMAIL_ENABLED` (Resend, existing-user) and the hosted Auth SMTP (Auth invite, new-user). No hosted-config write in this card.

---

## UI copy (ban-list-clean)

Reuse `INVITE_REDEEM_COPY` (`inviteCopy.ts`:110-125) and `AUTH_CALLBACK_COPY` (set-password) unchanged. New/clarified strings (plain language; no winner/loser/truth/dishonest/liar tokens):

- Inviter, uniform after create (no enumeration): "Invite ready. We'll email them a link if email is turned on — and you can copy the link yourself."
- Optional bridge reassurance, shown between set-password Continue and the seat-join: "You're all set. Adding you to the argument now…" (reuses the spirit of `joiningTitle` "Joining…", `inviteCopy.ts`:114).
- Existing recovery copy reused as-is: different-email (:115-118), expired (:119-121), no-longer-active (:122-123), already-used (:124-125), archived/closed/not-found (`InviteRedeemGate`:230-321).
- Email body copy is the shipped `maybeSendInviteEmail` text (`room-notifications`:257-279) — "You were invited to respond to an argument," room title, optional private-room line, the link, and the 14-day expiry note. No verdict language.

---

## Tests (named)

Pure-model and Edge tests (no live network), per the §17 acceptance-route + email rows:

- `extractBridgedInviteToken.test.ts` — valid `?invite=<token>`; missing param → `null`; malformed/short/long token shape → `null`; non-callback URL → `null`; never throws; does **not** read or echo fragment auth tokens (no secret leak).
- `parseAuthCallbackUrl.bridge-purity.test.ts` (extend) — a URL carrying `?invite=<token>` resolves to the same `tokens`/`empty` outcome as without it, proving the auth parser was **not** widened.
- `manageRoomInviteCreateBridge.test.ts` — existing-user branch invokes the lifted transport with `inviteLink` set to the create-path link (not `null`); new-user branch invokes `inviteUserByEmail` with a `redirectTo` whose path is `/auth/callback` and whose query carries `?invite=<rawToken>`; the response is **byte-identical across branches** (no enumeration); gates OFF → no network, `notification: 'not_configured'`; no `Authorization` / `RESEND_API_KEY` / service-role literal in any log line; the raw token appears in the response only as the shipped `inviteLink`.
- `inviteEmailTransport.test.ts` — the lifted `_shared/inviteEmail.ts`: gate off → `not_configured`, zero fetch; link present in body; recipient/link/key never logged; HTML/control-char stripping preserved.
- `appInviteBridgeHandoff.test.tsx` — on `/auth/callback?invite=<token>`: dispatches `SET_PENDING_INVITE_INTENT` and persists; `AuthCallbackScreen` renders **first** (priority preserved); after `onDone`, `InviteRedeemGate` renders and the shipped auto-accept fires.
- `inviteRedeemGate.bridgedNewUser.test.tsx` (extend) — bridged new-user → auto-accept success → `onAccepted(debateId)`; email mismatch → `MismatchPanel`; expired/revoked/already-used reuse the shipped branches.
- `sendInviteSmoke.bridge.test.js` (extend) — dry plan asserts the `?invite=` redirect resolves to an allow-listed `/auth/callback` host; present+length-only diagnostics; refusal when not armed; existing-user transport dry path returns `not_configured`.

All run under the shipped jest harness; no live xAI/Anthropic/X/Supabase write by Claude.

---

## Doctrine compliance

- **RLS on every table, never disabled.** No new table; `argument_room_invites` and `debate_participants` RLS unchanged. Privileged writes stay service-role inside the Edge boundary after per-action authorization (`manage-room-invite`:204-232, :597-607).
- **No service-role in client; no direct client insert into protected tables.** The new send + Auth invite run server-side in `manage-room-invite`; the client only invokes the function (`inviteApi.ts`:115-138). The smoke script reads no service-role (`sendInviteSmoke.js`:11-18).
- **No account enumeration.** Uniform create response (c); the existing-vs-new branch is server-side and invisible; mirrors `admin-users`:397-399, :423.
- **No invite token/link in any response/log.** The token stays server-side for both branches; the only client-facing token is the shipped inviter-only `inviteLink`. The lifted transport never logs link/recipient/key (`room-notifications`:228, :298-316). `parseAuthCallbackUrl` redaction unchanged (:57-65, :200-208).
- **Raw email never in public UI/MCP.** The inviter sees masked email only (`maskEmail`, `manage-room-invite`:122-128); the raw email is used only server-side for the send.
- **No new account write by Claude; email+password v1 only.** The new-user path uses the shipped passwordless Auth invite + set-password (no OAuth).
- **No live send / no hosted-config write in this card.** Both transport gates stay OFF; the smoke is a dry plan; the hosted Auth URL config was already corrected operationally (smoke doc :46-50), not by this card.
- **Plain language via `gameCopy`/`inviteCopy`; ban-list scanned.** No verdict/person tokens in any new string.
- **Engine untouched; no network in pure modules.** `extractBridgedInviteToken` is pure and side-effect-free.

---

## GATE-C + merge posture

**GATE-C** (touches Edge functions, email transport, and the auth handoff). Deploy-bearing: `manage-room-invite`, `room-notifications`, and `admin-users` are all registered in `config.toml` (:427-428, :437-438, :392-393), so a merge to `main` auto-deploys them via the Supabase GitHub integration. Therefore:

1. Land code with **both transport gates OFF** (`INVITE_EMAIL_ENABLED` unset; hosted Auth SMTP unchanged). Merge is safe — no behavior change for users until a gate is flipped.
2. After merge + auto-deploy, run the **dry** smoke (`--dry-run`, default) to confirm the `?invite=` redirect and the transport plan.
3. **Live** smoke is operator-gated and runs only after deploy, reusing the shipped armed-flag discipline (`CDISCOURSE_ALLOW_INVITE_SEND_SMOKE`, `--redirect-to …/auth/callback`, `--smtp-posture`). Precondition already met: hosted Site URL + redirect allow-list are Netlify-correct (smoke doc :46-50).
4. Never self-approve the gate flip or the live send.

**Recommended SPLIT** (per the brief): ship as two stacked cards sharing the create-branch scaffold —
- **ARG-ROOM-004a** — new-user Auth-invite bridge: the `?invite=` redirect, `extractBridgedInviteToken`, the `App.tsx` handoff, and the `inviteUserByEmail` branch. Lands first (it is the higher-value, account-creating path and already has a passing auth smoke to build on).
- **ARG-ROOM-004b** — existing-user Resend email: lift `_shared/inviteEmail.ts`, the existing-user branch with the reconciled link, and the transport dry smoke. Lands second, behind `INVITE_EMAIL_ENABLED`.
The uniform-response rule (c) must be present in **004a** so the response shape is already enumeration-safe before 004b adds the second branch.

---

## Risks

- **Auth email rate limit.** A burst of new-user creates consumes Supabase Auth emails; the hosted limit is low (the smoke doc's `devtest97` failed on exactly this, :70-74; `config.toml`:206 shows `email_sent = 2` locally). Mitigation: the create path mints the row + link regardless of email outcome, so a rate-limited send never blocks acceptance via the copyable link.
- **`redirectTo` allow-list vs query string.** The hosted allow-list entry `https://dev-cdiscourse.netlify.app/**` (`config.toml`:168, hosted :49) should match `/auth/callback?invite=…`, but Supabase's handling of query strings on allow-list matching must be proven by the dry+live smoke before relying on it. If a query string is stripped, fall back to the same-device storage seed and surface the copyable link.
- **Timing side-channel enumeration.** The new vs existing branches do different work (Auth invite vs Resend), a theoretical timing oracle. The *response* is uniform (the doctrine requirement) and both gates are OFF in this card; flagged as an open question for hardening, not a blocker.
- **Double-handoff.** A new user could receive the Auth invite *and* be handed a pasted `/invite/<token>` link. Both converge on the same idempotent `accept` (`handleAccept`:547-558), so the worst case is a no-op second attempt.
- **`history.replaceState('/')` drops the query before Continue.** Mitigated — the intent is dispatched + persisted at capture, before the URL is cleared (`AuthCallbackScreen`:99).

---

## Open questions

1. Does the hosted Supabase redirect allow-list preserve the `?invite=<token>` query through to `/auth/callback`? (Smoke-verify before 004a's live send — this is the one unproven link in the bridge.)
2. Should the existing-user branch also write the shipped in-app `room_notifications` `invite` row (`room-notifications`:391-404), or is the email sufficient? (Today `useRoomInvites.create` fires neither, :64-97.) Lean: keep the in-app row for existing users, email-only for new.
3. Lift `maybeSendInviteEmail` into `_shared/` vs duplicate it? Lean: lift, so `room-notifications` and `manage-room-invite` cannot drift.
4. Should the optional bridge reassurance line be shown at all, or is the existing `joiningTitle` enough given how brief the window is?
5. Confirm the SPLIT boundary with the operator: is 004b allowed to merge while `INVITE_EMAIL_ENABLED` is OFF (code-complete, dormant), matching the QOL-040 posture?
