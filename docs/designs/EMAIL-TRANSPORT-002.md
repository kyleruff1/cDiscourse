# EMAIL-TRANSPORT-002 — App-controlled new-user credential creation via the `/invite` redemption route

**Status:** Design draft
**Epic:** Interaction / Room Visibility & Invite (`ARG-ROOM-VISIBILITY-INVITE` slate) — new-user phase-2 of the EMAIL-TRANSPORT-001 app-controlled-route design
**Release:** 6.7
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/637
**Branch:** `feat/EMAIL-TRANSPORT-002-newuser-credential-route`
**Baseline:** `origin/main @ 1353b24` (includes the merged EMAIL-TRANSPORT-001, #636)

**Governance:** this card runs under the *CDiscourse Pipeline Governance Contract v1*. The stage gates (§2), HALT conditions (§3), and the never-self-approve list (§4) are binding. This is a **design-only** card: no production code, no migration, no live email send, no hosted-config mutation. GATE A follows this doc. The implement stage that follows is **client-only and GATE-C-free** under the recommended option (Option A); the contingency option (Option B) is GATE-C and is called out explicitly.

---

## Goal

Make a brand-new invitee (no CDiscourse account) able to complete the invite round-trip on the deployed app **without depending on GoTrue honoring a `redirect_to` query string against the hosted Redirect-URLs allow-list.** Today the new-user path rides the Supabase Auth "Invite user" email whose CTA returns to `<origin>/auth/callback?invite=<roomToken>`; that path only works when (a) the host matches the hosted allow-list AND (b) the co-mingled `?invite=` query survives allow-list matching. The 2026-06-13 smoke proved both fragilities are real: smoke7 used host `cdiscourse.netlify.app` while the hosted allow-list had been set to `dev-cdiscourse.netlify.app`, GoTrue fell back to the Site URL, the implicit-flow `#access_token=…` fragment never reached `/auth/callback`, and the set-password screen never loaded — so the auto-accept never ran.

The durable fix: own new-user credential creation **end to end on the CDiscourse-owned `/invite/<token>` redemption route** (the route `InviteRedeemGate` already consumes). The room-invite token stays on a CDiscourse route from the email CTA through to acceptance and is **never co-mingled onto Supabase's `/auth/callback?invite=`.** Account provisioning still uses Supabase Auth internally (the anon-key `signUp`), but the redemption + set-credentials UX is app-owned, so there is no GoTrue redirect, no fragment token, and no allow-list dependency for the new-user flow.

This design is shaped by these doctrine constraints, all of which the build must satisfy:
- **`supabase-edge-contract` §1 + `cdiscourse-doctrine` §6** — no service-role key in client code; the recommended option uses only the anon-key `supabase.auth.signUp`, no service-role anywhere new.
- **No account enumeration** — `lookup_by_token` must keep returning the *same* client-visible shape whether or not the invitee already has an account. The design adds **no** account-existence flag to any response, and the set-credentials UX is reached the same way for existing-vs-new (the existing-vs-new decision stays where it already is: server-side, via the accept call's outcome and the client's own session state).
- **No raw token / JWT / bearer / hash in any response or log** — the token already travels only inside the `/invite/<token>` path (parsed by `parseInviteDeepLink`) and is never logged; this card adds no new place it could leak. Passwords go ONLY into `supabase.auth.signUp` / `updateUser` and are cleared from state after.
- **Email-binding stays the security spine** — acceptance still requires a signed-in session whose email equals `invitee_email_lower` (server-side, `manage-room-invite handleAccept`:594-597). The app-owned signup just establishes that session; it does not weaken the binding.
- **Doctrine ban-list (§1)** — all new user-facing copy is verdict-free and runs through the existing `inviteCopyDoctrine` ban-list scan.

---

## Phase 0 inventory (what is already there — file:line)

### The proven set-password flow (to reuse, not to depend on for new users)
- `src/features/auth/AuthCallbackScreen.tsx` — renders six phases incl. `set_password`; the set-password form calls `setInvitedUserPassword(password)` (`:104-121`). **Proven working** end-to-end (devtest98, `docs/testing-runs/2026-06-13-auth-live-invite-seed-smoke.md` lines 58-68). This screen is reached only after GoTrue establishes an implicit-flow session via `/auth/callback` — exactly the dependency this card removes for new users.
- `src/features/auth/consumeAuthCallback.ts` — `needs_password` is returned **only** for `type=invite` (`:51-54`, `:118`, `:128`); it requires the fragment tokens to have landed.
- `src/lib/auth/parseAuthCallbackUrl.ts` — pure parser of the `/auth/callback` fragment/query; under implicit flow the live shape is `#access_token=…&refresh_token=…&type=invite`.
- `src/lib/auth/buildAuthRedirectUrl.ts` — computes the auth-email redirect; `DEFAULT_AUTH_ROUTES.invite = '/auth/callback'` (`:47-53`). Fail-closed; degrades to Site URL on a bad origin (the failure mode the smoke hit).
- `src/lib/supabase.ts` — the single anon-key client; `detectSessionInUrl: false` (`:76`) so the app, not GoTrue, owns URL handling. `persistSession: true`, `autoRefreshToken: true` — a client `signUp` therefore persists a session the same way a `signIn` does.
- `src/features/auth/authApi.ts` — `signUpWithEmailPassword` (`:87-125`) calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`; `setInvitedUserPassword` (`:167-183`) calls `updateUser({ password })`; `validateNewPassword` (`:34-39`, min 6). **`signUp` already establishes a session client-side** — see the confirmations note below.
- `src/features/auth/AuthScreen.tsx` — the generic sign-in/sign-up screen. On `signUp` success it always shows "Confirmation email sent" (`:36`, `:46-58`) — **misleading when `enable_confirmations = false`** (the new invitee is told to check an email that the durable flow does not need and that is itself the fragile Lane-A path). This is the deployed friction the app-owned step replaces for the invite flow.

### The Supabase Auth confirmation posture (the linchpin)
- `supabase/config.toml` `[auth.email] enable_confirmations = false` (`:233`). With confirmations OFF, `supabase.auth.signUp({ email, password })` **creates a confirmed user and returns an active session immediately, with no email round-trip.** This is what makes a fully app-owned new-user provisioning possible with the anon key alone — no `/auth/callback`, no `redirect_to`, no allow-list. (The hosted project's posture must match; verified-by-operator item below.)
- `[auth] enable_signup = true` (`:183`) and `[auth.email] enable_signup = true` (`:228`) — client signup is permitted.
- `additional_redirect_urls` (`:164-170`) names `dev-cdiscourse.netlify.app` (local file only; the hosted allow-list lives in the Dashboard). This card's new-user flow stops *depending* on this list.

### The app-controlled redemption route (the spine this card extends)
- `src/features/invites/InviteRedeemGate.tsx` — the `/invite/<token>` gate. State machine: `resolving → lookup_ok → (signed-out → SignedOutPrompt | signed-in+match → auto-accept | signed-in+mismatch → MismatchPanel)` + expired/revoked/accepted/archived/closed/notfound panels. **`onPromptSignIn` already carries `{ invitedEmail: string | null; preferSignUp: boolean }`** (`:56`, `:192-194`) — the signup intent is already plumbed through the prop, but App.tsx currently ignores both args (`:273-279`). The auto-accept effect (`:117-127`) fires `acceptRoomInvite` on (signed-in + live-pending + has-email); the email-match is enforced server-side.
- `src/features/invites/inviteApi.ts` — `lookupInviteByToken` / `acceptRoomInvite` wrappers (`:175-188`). The lookup response (`:92-100`) carries **only** `status`, `tokenEcho`, `room {title, invitedByDisplayName}` — **no invitee email, no account-existence flag** (no-enumeration). Accept requires a session (`acceptRoomInvite` → `manage-room-invite accept`).
- `src/features/invites/inviteDeepLink.ts` — pure `/invite/<token>` parser; token shape base64url, 32-64 chars (`:39-60`). The token rides ONLY the path; `stripTrailingDecorations` drops any `?query`/`#hash` (`:108-116`).
- `src/features/invites/bridgedInviteToken.ts` — the **fragile `?invite=` bridge** to decouple. `extractBridgedInviteToken` (`:48-70`) reads `?invite=` off `/auth/callback`; `resolveColdStartInviteToken` (`:83-87`) prefers the `/invite/` path, falls back to the bridge. This module STAYS for backward compatibility (an already-sent Auth-bridge email in someone's inbox must still work) but is no longer the **primary** new-user path.
- `src/features/invites/pendingInviteIntent.ts` — device-local + snapshot intent slice; 24h freshness; carries `token` through the auth round-trip (`:38-50`, `:118-126`). Reused unchanged; it already survives the "anonymous → sign up → signed-in" handshake (`:11-18`).
- `App.tsx` — mounts `AuthCallbackScreen` at top priority when on `/auth/callback` (`:312-326`), else `InviteRedeemGate` when a `pendingInviteIntent` is live (`:329-345`). `handleInvitePromptSignIn` (`:273-279`) currently drops the `{invitedEmail, preferSignUp}` args and just dispatches `SIGNED_OUT`, letting the generic `AuthScreen` render; after sign-in the gate re-mounts (intent survives) and auto-accepts.

### The new-user send + accept seam (Edge)
- `supabase/functions/room-notifications/index.ts` `handleInvite` (`:398-533`): the **new-user branch** (`:503-525`) builds `redirectTo = <origin>/auth/callback?invite=<token>` (`buildBridgeRedirect`, `:273-277`) and calls `supabase.auth.admin.inviteUserByEmail` — gated by `INVITE_AUTH_BRIDGE_ENABLED` (`:220-222`, default OFF). The **existing-user branch** (`:468-502`) already uses the app-controlled `<origin>/invite/<token>` link (`buildInviteLinkFromOrigin`, `:262-266`) via the EMAIL-TRANSPORT-001 product lane (`maybeSendInviteEmail` → `sendTransactionalEmail`). `resolveInviteNotificationStatus` (`:233-235`) keeps the inviter-facing status branch-independent (no enumeration).
- `supabase/functions/manage-room-invite/index.ts` `handleAccept` (`:545-672`): the security spine. Requires a JWT (`:549-553`), enforces **email-binding** `callerEmail === invitee_email_lower` else `403 invite_email_mismatch` (`:594-597`), enrols the invitee opposite the creator, flips the invite to `accepted` (idempotent). `handleLookupByToken` (`:465-540`) returns the minimum projection — **no email echoed, no account flag.**
- `supabase/functions/_shared/inviteSchemas.ts` — the request schema. `accept` / `lookup_by_token` take only a `Token` (`:42-50`). No new action is required by the recommended option.

### EMAIL-TRANSPORT-001 (the merged foundation)
- `docs/designs/EMAIL-TRANSPORT-001.md` — the two-lane transport. **Lane B product email already routes its CTA to `<origin>/invite/<token>`** (design §"Lane B" + the merged `maybeSendInviteEmail` refactor). This card makes the **new-user** flow consume that same app-controlled route instead of the Auth bridge, completing the "app-controlled route end to end" intent line 133 of that design stated for the redemption URL.

---

## Architecture decision: app-owned in-place signup on `/invite`, anon-key only (Option A)

**Decision: a brand-new invitee sets credentials directly on the `/invite/<token>` redemption route via an app-owned "Create your account" step that calls the existing anon-key `supabase.auth.signUp` (no email, no `/auth/callback`, no `redirect_to`, no service-role). On signup success, a session is established in-place and the existing `acceptRoomInvite` flow runs — its server-side email-binding is the gate. The fragile `?invite=` Auth bridge stays only as legacy compatibility for already-sent emails.**

### Why this works (the decoupling)
With `enable_confirmations = false`, `supabase.auth.signUp({ email, password })` returns an active, persisted session synchronously — no email is sent, so there is **nothing for GoTrue's `redirect_to`/allow-list to break.** The room token never leaves the CDiscourse `/invite/<token>` path. The set-credentials UX is a CDiscourse screen, not GoTrue's `/auth/callback`. The only Supabase dependency is the anon-key auth call the app already makes for every signup.

### Why NOT keep the Auth-bridge as the primary new-user path
The bridge is doubly fragile (host-mismatch fallback + query-survival), is rate-limited (~3-4/hr built-in), and depends on hosted config the repo cannot see or test. EMAIL-TRANSPORT-001 already moved the **product-email** CTA to the app route for exactly this reason; this card finishes the job for the new-user account step.

### Account-provisioning options (mapped, per the card)

| Option | Mechanism | Service-role? | Edge/migration? | Email round-trip? | Gate | Verdict |
|---|---|---|---|---|---|---|
| **A (recommended)** | Client `supabase.auth.signUp({email,password})` on `/invite`, then existing `acceptRoomInvite` | **No** (anon key) | **No** | **No** (confirmations OFF) | client-only | **Chosen** — smallest surface, no new server code, no GATE-C, fully decoupled |
| B (contingency) | New `manage-room-invite` action `provision_and_accept` that `auth.admin.createUser({email_confirm:true})` + accept, returns a one-time sign-in path | Yes (already in that fn) | **Yes** (Edge change) | No | GATE-C | Only if confirmations cannot be OFF hosted, or operator wants server-minted accounts. Designed below as the fallback. |
| C (rejected) | Send a Supabase magic-link / OTP to set the password | No | No | **Yes** | — | Rejected — reintroduces the email + `redirect_to`/allow-list dependency this card exists to remove. |

**Option A is the design.** Option B is fully specified in "Contingency: Option B" so the implementer can pivot without a redesign **only if** the operator confirms hosted `enable_confirmations` cannot be OFF. The implementer does **not** build B speculatively.

### Why this is not a new "AuthScreen signup"
The generic `AuthScreen` shows "Confirmation email sent" on signup (a lie under confirmations-OFF) and is not invite-context-aware. The app-owned step on `/invite` (a) knows it is mid-redemption, (b) does not promise an email, (c) flows straight into `acceptRoomInvite`, and (d) shows the room title/inviter context. It reuses `signUpWithEmailPassword` and `validateNewPassword`; it does not reuse the `AuthScreen` UI.

---

## Data model

**No new data model. No migration. No new table or column. No RLS change.** (True for both Option A and Option B.)

- Account creation uses Supabase Auth's own `auth.users` (untouched schema) via `signUp` (Option A) or `admin.createUser` (Option B).
- Acceptance reuses `argument_room_invites` + `debate_participants` exactly as today.
- The token persists only as a hash server-side; the raw token travels only on the `/invite/<token>` path and the `pendingInviteIntent` slice, exactly as shipped.

The only new persistent artifacts are **TypeScript modules + copy strings + tests** (Option A). Option B additionally adds one Edge action (no schema change).

---

## File changes (Option A — the design)

### New files (production)
- `src/features/invites/InviteCredentialStep.tsx` (~140-200 lines) — the app-owned "Create your account" step rendered inside the redemption flow for a signed-out invitee who chooses to create an account. Renders: room context (title + inviter, from the lookup), an email field (the invitee types the address the invite was sent to), a password field (`validateNewPassword`), and a primary "Create account & join" button. On submit → `signUpWithEmailPassword(email, password)`; on success the parent advances (session is live, intent survives, auto-accept fires). On `email_already_used` → a "You already have an account — sign in instead" affordance that switches to the sign-in sub-mode (reusing `signInWithEmailPassword`). Pure presentation + the two existing auth wrappers; **no new network primitive, no service-role, no token handling** (the token stays in the gate's state). testIDs: `invite-credential-step`, `invite-credential-email`, `invite-credential-password`, `invite-credential-submit`, `invite-credential-switch-signin`.
- `src/features/invites/inviteCredentialModel.ts` (~60-110 lines, PURE) — the decision/validation model the step renders from, so the logic is unit-testable without React:
  - `validateInviteCredentialForm(input): { ok: true } | { ok: false; field: 'email' | 'password'; message: string }` — composes `validateInviteEmailInput` + `validateNewPassword`.
  - `mapSignUpOutcomeToStep(result): InviteCredentialStepState` — maps the `AuthResult` error union (`email_already_used` → `offer_signin`, `weak_password` → inline, `network_error` → retry, `redirect_invalid`/`config_missing`/`unknown` → generic) to a plain-language UI state. **No raw Supabase message ever surfaced** (doctrine §9).
  - `type InviteCredentialMode = 'create' | 'signin'`.

### Modified files (production)
- `src/features/invites/InviteRedeemGate.tsx` (~+40 / -10 net) — extend the **signed-out `pending`** branch. Today `SignedOutPrompt`'s single "Continue" routes to the generic AuthScreen. New: the signed-out pending panel offers **two** clearly-labelled paths — "I'm new — create my account" (mounts `InviteCredentialStep` in `create` mode, in-route) and "I already have an account — sign in" (the existing `onPromptSignIn({ preferSignUp: false })` path to AuthScreen, unchanged). The `InviteCredentialStep` is rendered **inside the gate** (a new `phase: 'credentials'` or a local sub-state) so the token never leaves the gate and the user never leaves `/invite`. On credential success the gate falls through to its existing auto-accept effect (session now live + email typed === binding). No change to the lookup/accept calls, the panels, or the auto-accept logic. The `onPromptSignIn` prop keeps its signature (used for the "sign in" path).
- `src/features/invites/inviteCopy.ts` (~+18 lines) — add the `INVITE_CREDENTIAL_COPY` bundle (heading, body, email/password labels + placeholders, "Create account & join" / "Joining…" buttons, the "already have an account" switch label, the per-error plain-language strings). All strings verdict-free; covered by the existing `inviteCopyDoctrine` ban-list scan (extended to include the new bundle).
- `App.tsx` (~+8 / -4 net) — wire `handleInvitePromptSignIn` to actually consume `{ invitedEmail, preferSignUp }` for the "sign in" path (today it ignores both). No new top-level screen; the credential step lives inside the gate. (Optional, low-risk: pass a default `preferSignUp` hint to the AuthScreen if/when AuthScreen is made invite-aware — explicitly OUT of scope here to keep the diff small; see Out of scope.)

### New files (tests)
- `__tests__/inviteCredentialModel.test.ts` — happy path, each error mapping, ban-list of the rendered states, no-raw-message assertion.
- `__tests__/InviteCredentialStep.test.tsx` — RTL: renders fields, validates inline, calls `signUpWithEmailPassword` on submit (mocked), shows the offer-signin affordance on `email_already_used`, never renders a token/password in the DOM after success.
- `__tests__/InviteRedeemGate.newuser.test.tsx` — the signed-out pending branch now offers create-account; choosing it mounts the credential step; on signup success the gate fires `acceptRoomInvite` (mocked) and calls `onAccepted`; the existing signed-out → sign-in path still works; no-enumeration assertion (the gate renders identically for a token whose invitee has-vs-has-no account — the gate cannot tell, and must not try to).

### Modified files (tests)
- `__tests__/inviteCopyDoctrine.test.ts` — extend the scanned surface to include `INVITE_CREDENTIAL_COPY`.
- `__tests__/InviteRedeemGate.test.tsx` — update the signed-out pending assertions for the new two-path panel (the existing sign-in path must remain green; no assertion weakened).

### Deleted files
None. `bridgedInviteToken.ts` is **retained** (legacy already-sent-email compatibility) and explicitly documented as no longer the primary new-user path.

---

## API / interface contracts (Option A)

No new Edge action, no new wire contract. The new surfaces are pure-client:

```ts
// inviteCredentialModel.ts  (PURE — no network, no React, no token, no secret)
export type InviteCredentialMode = 'create' | 'signin';

export type InviteCredentialStepState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'inline_error'; field: 'email' | 'password'; message: string }
  | { kind: 'offer_signin'; message: string }      // email_already_used
  | { kind: 'retryable'; message: string }          // network_error
  | { kind: 'blocked'; message: string };           // config_missing / redirect_invalid / unknown

export function validateInviteCredentialForm(input: { email: string; password: string }):
  | { ok: true }
  | { ok: false; field: 'email' | 'password'; message: string };

// `result` is the AuthResult from signUpWithEmailPassword (the existing wrapper).
export function mapSignUpOutcomeToStep(result: AuthResult<AuthUser>): InviteCredentialStepState;
```

```tsx
// InviteCredentialStep.tsx
export interface InviteCredentialStepProps {
  roomTitle: string;                 // from lookup (display-safe)
  inviterDisplayName: string | null; // from lookup
  /** Fired on a successful signUp (or signIn in 'signin' sub-mode). The parent
   *  gate already holds the token; it re-runs lookup/accept off its live session. */
  onCredentialsEstablished: () => void;
  /** The user picked "I already have an account" → parent routes to AuthScreen. */
  onUseExistingAccount: () => void;
  /** Universal escape hatch — clears intent + drops to gallery. */
  onExit: () => void;
}
```

The two auth calls are the **existing** wrappers, unchanged:
- `signUpWithEmailPassword(email, password)` → `supabase.auth.signUp(...)` (anon key; session established in-place under confirmations-OFF).
- `signInWithEmailPassword(email, password)` → `supabase.auth.signInWithPassword(...)` (the offer-signin sub-mode).
- Acceptance: the gate's existing `acceptRoomInvite({ token })` → `manage-room-invite accept` (email-binding enforced server-side).

---

## Edge cases (Option A)

- **Confirmations ON hosted (the contingency trigger):** if the hosted project has `enable_confirmations = true`, `signUp` would *not* return a live session and would send a confirmation email (re-introducing the fragile path). The step detects this: a `signUp` that returns `ok` but yields **no live session** (the parent checks session state after success, with a short bounded settle) surfaces a "Check your email to finish" state and the legacy bridge remains. This is the signal to the operator to either set confirmations OFF or pivot to Option B. **This is the one operator-verified precondition** (see Open questions).
- **Email the invitee types ≠ the invited address:** `signUp` succeeds (creates an account for the typed address), but `acceptRoomInvite` then returns `invite_email_mismatch` (server-side binding, `:595`). The gate already renders `MismatchPanel` for this code. Copy guides them to use the invited address. **The binding is never weakened** — a wrong-email signup just cannot accept.
- **Email already has an account (`email_already_used`):** the step offers the sign-in sub-mode; on sign-in success the auto-accept runs. No enumeration leak — this is surfaced only *after* the user themselves typed the email and submitted (they already know whether it's theirs); the *lookup* never reveals it.
- **Already-accepted / expired / revoked / archived / closed / not-found:** unchanged — `lookup_by_token` returns the status and the gate renders the existing panel **before** the credential step is ever offered (the credential step is only reachable from signed-out `pending`).
- **Cold start mid-signup:** the `pendingInviteIntent` slice (24h freshness, device-local) already survives this; after the session establishes the gate re-mounts and auto-accepts. No change.
- **Concurrent accept (two tabs):** accept is idempotent server-side (`23505` on the participant insert + the `status='pending'` guard on the flip); a duplicate is a no-op success.
- **Weak / short password:** `validateNewPassword` (min 6) blocks submit inline; the server `minimum_password_length = 6` is the backstop.
- **Network failure during signUp or accept:** mapped to a retryable state; the user action is never lost (intent persists).
- **Legacy already-sent Auth-bridge email in an inbox:** still works — `resolveColdStartInviteToken` still reads the `?invite=` bridge and `AuthCallbackScreen` still runs for those URLs. This card does not remove that path; it just stops *generating* it as the primary new-user route (the send-side flip is a follow-up — see Out of scope).
- **Doctrine edge — "does the credential step show any standing/heat/score?":** No. It shows only room title + inviter name + the account fields. No heat, no score, no verdict.
- **`detectSessionInUrl: false`:** unchanged — the app owns URL handling; the credential step never parses a URL fragment, so no auth secret is read on the `/invite` route.

---

## Test plan (Option A)

All tests run under the shipped Jest harness; pure-model + RTL; **no live network, no live signup.** File paths:

1. `__tests__/inviteCredentialModel.test.ts` — `validateInviteCredentialForm` happy + each invalid field; `mapSignUpOutcomeToStep` for every `AuthError` value (`email_already_used → offer_signin`, `weak_password → inline_error(password)`, `network_error → retryable`, `config_missing`/`redirect_invalid`/`unknown → blocked`); asserts **no raw Supabase message** appears in any returned `message`.
2. `__tests__/InviteCredentialStep.test.tsx` — renders email+password fields; inline validation blocks submit; submit calls the **mocked** `signUpWithEmailPassword` once with the typed values; success calls `onCredentialsEstablished`; `email_already_used` shows the switch-to-signin affordance and calls `signInWithEmailPassword` when used; **after success the rendered tree contains no password value and no token.**
3. `__tests__/InviteRedeemGate.newuser.test.tsx` — signed-out `pending` now offers "create account"; selecting it mounts the credential step; on signup success the gate calls **mocked** `acceptRoomInvite` then `onAccepted({debateId})`; the existing "sign in" path still calls `onPromptSignIn`; **no-enumeration**: the gate's signed-out render is byte-identical for two tokens regardless of invitee account state (the gate has no input that could differ).
4. `__tests__/inviteCopyDoctrine.test.ts` (extend) — the ban-list scan now covers `INVITE_CREDENTIAL_COPY` (no `winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist/challenger/opponent`, no internal codes, no snake_case leak).
5. `__tests__/InviteRedeemGate.test.ts` (update) — the signed-out pending branch's existing sign-in path stays green against the new two-path panel; **no assertion weakened** (per §4 — a failing existing assertion is fixed by correcting the code/test intent, never by loosening the bar).
6. Regression guard (no new test file): the `App.tsx` wiring change is covered by any existing App-level invite tests; if none, the gate-level test (#3) is the contract. The implementer confirms `npm run test` count goes **up** by the new tests and the existing invite/auth suites stay green.

Doctrine ban-list assertion is mandatory (this card adds user-facing strings): covered by #1, #2, #4.

---

## Contingency: Option B (only if hosted confirmations cannot be OFF) — GATE-C

Specified so the implementer can pivot without a redesign. **Do not build unless the operator confirms `enable_confirmations` must stay ON hosted.**

- **New `manage-room-invite` action `provision_and_accept`** (`verify_jwt = false` already): body `{ action: 'provision_and_accept', token, email, password }`. Steps, all service-role, all after the per-action checks:
  1. Validate token shape (Zod) + look up the invite by `token_hash` (reuse `handleAccept`'s live-status checks).
  2. **Email-binding first:** require `email.toLowerCase() === invitee_email_lower` else `403 invite_email_mismatch` — the binding is checked **before** any account is created, so a wrong email never provisions an account.
  3. `auth.admin.createUser({ email, password, email_confirm: true })` (idempotent: on `email_already_exists`, return a distinct `account_exists` code so the client routes to sign-in — **no enumeration via the unauthenticated lookup**, because this path requires the user to have typed the email + password themselves).
  4. Run the existing accept enrolment + invite flip.
  5. **Return NO session/token** — return `{ debateId, status: 'accepted' }`; the client then performs a normal `signInWithEmailPassword(email, password)` to obtain its own session. (The Edge function never returns a JWT/refresh token to the client — no secret leak.)
- **Client wrapper** `provisionAndAcceptInvite({ token, email, password })` in `inviteApi.ts`, called by `InviteCredentialStep` instead of `signUp`.
- **Doctrine/contract:** service-role is already present in `manage-room-invite`; this adds no new secret surface. Password travels in the POST body over TLS to the Edge function and is passed only into `createUser` — **never logged** (the function already logs only `emailDomain` + short ids). Email-binding-before-provision preserves the security spine. The unauthenticated `lookup_by_token` shape is **unchanged** (no account flag).
- **GATE-C:** Option B touches `supabase/functions/manage-room-invite/index.ts` + `inviteSchemas.ts` (+ the `inviteSchemasMirror.ts`). The Supabase GitHub integration auto-redeploys registered Edge functions on merge → **merge is a deploy (operator-gated).** Tests: happy path, email-mismatch-before-provision, account-exists path, auth-refused/invalid-input, no-token/no-password-leak source scan, `inviteSchemasMirror` parity for the new action.

---

## Dependencies (cards / docs / files)

- **Assumes EMAIL-TRANSPORT-001 (#636) is merged** — it is (baseline `1353b24`). This card consumes that design's app-controlled `<origin>/invite/<token>` redemption URL as the canonical new-user route and finishes the "app-controlled route end to end" intent for the account step.
- **Reads `InviteRedeemGate.tsx` / `inviteApi.ts` / `pendingInviteIntent.ts`** — the redemption spine, extended not replaced.
- **Reads `authApi.ts` (`signUpWithEmailPassword`, `signInWithEmailPassword`, `validateNewPassword`)** — reused as-is.
- **Reads `consumeAuthCallback.ts` / `AuthCallbackScreen.tsx`** — the proven set-password UX; reused conceptually (the in-place form mirrors its validation), kept intact for the legacy bridge.
- **Relates to the `bridgedInviteToken` `?invite=` bridge** — this card demotes it from primary to legacy-compat; it is retained so already-sent Auth-bridge emails keep working.
- **Blocks / enables** a future send-side card that flips `room-notifications`'s new-user branch from `buildBridgeRedirect` (`/auth/callback?invite=`) to `buildInviteLinkFromOrigin` (`/invite/<token>`) so brand-new invitees receive the app-route link directly. That send-side flip is **out of scope here** (it is GATE-C and operator-gated) but this card is its prerequisite (the app must be able to provision on `/invite` before the email points there).
- **Operator-owned, out of code:** the hosted `enable_confirmations` posture (the Option-A precondition) and the eventual Redirect-URLs hosted fix (the quick fix, explicitly not this card).

---

## Risks

- **Hosted `enable_confirmations` posture unknown from the repo.** Option A's in-place session depends on confirmations being OFF hosted. Mitigation: the step detects "signed up but no session" and degrades gracefully; the operator verifies the posture (Open question 1); Option B is the documented pivot.
- **`AuthScreen`'s "Confirmation email sent" misleading copy is broader than this card.** This card does NOT fix the generic AuthScreen (out of scope) — it routes new invitees around it via the in-place step. If a user still reaches AuthScreen signup (the "sign in" path then toggles to signup), they'd see the misleading copy. Mitigation: the in-place create-account path is the primary, prominent option on the gate; the AuthScreen path is for users who already have an account. Note it as a follow-up.
- **Existing `InviteRedeemGate.test.ts` assertions** on the single-path signed-out panel will need updating for the two-path panel. Mitigation: update to the new contract without weakening (per §4); the existing sign-in path stays asserted.
- **Email-binding mismatch UX.** A new user who typos the email creates a throwaway account and then hits `MismatchPanel`. Mitigation: clear copy on the credential step ("Use the email this invite was sent to"); the throwaway account is harmless (no participant row, no data) and is a known Auth-hygiene item, not a defect. (Optional future: prefill/echo nothing about the invited email — we must NOT reveal it, so the user must type it; this is the no-enumeration cost.)
- **No-enumeration discipline must hold.** The temptation to prefill the invited email or show "this email already has an account" from the *lookup* must be refused — the lookup stays minimum-projection. Mitigation: the test (#3) asserts the gate render cannot vary by account state; Option B's `account_exists` is reachable only after the user supplies the email+password.
- **Two auth code paths (in-place + AuthScreen).** Slight duplication of "create account" logic. Mitigation: both call the same `signUpWithEmailPassword` wrapper; the in-place step adds only invite-context presentation + the pure model.

---

## Out of scope

- **Fixing the hosted Redirect-URLs / Site-URL** (the dashboard quick fix) — operator action, explicitly not this card (issue body "Immediate quick fix").
- **Flipping the send-side new-user branch** in `room-notifications` from `/auth/callback?invite=` to `/invite/<token>` — a separate GATE-C send-side card; this card is its app-side prerequisite.
- **Removing `bridgedInviteToken.ts` / the `?invite=` bridge** — retained for legacy already-sent emails; a later cleanup card can remove it once no live bridge emails remain.
- **Refactoring the generic `AuthScreen` signup copy / making AuthScreen invite-aware** — a small follow-up; this card routes around it.
- **Building Option B** unless the operator confirms confirmations must stay ON (then it's the pivot, still its own GATE-C verification).
- **Branded non-invite Auth templates / SMTP / DNS** — EMAIL-TRANSPORT-001 / runbook territory.
- **Any voting/scoring/search/OAuth/push/public-API** (v1 scope guard).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** the credential step + copy carry no winner/loser/verdict/truth tokens; `INVITE_CREDENTIAL_COPY` is added to the `inviteCopyDoctrine` ban-list scan. Score never enters this flow.
- **cdiscourse-doctrine §2-3 (heat/popularity not surfaced):** the step shows only room title + inviter name + account fields — no heat, engagement, or standing.
- **cdiscourse-doctrine §4 (AI limits):** no AI call anywhere; this is auth + redemption UX only.
- **cdiscourse-doctrine §6 + supabase-edge-contract §1 (secrets / service-role):** Option A uses ONLY the anon-key `supabase.auth.signUp` / `signInWithPassword` — **no service-role in client, none added.** Option B uses the service-role that already lives in `manage-room-invite`, adds no new secret, and returns no JWT/token to the client. Passwords go only into the auth call and are cleared from state.
- **supabase-edge-contract (Edge shape):** Option A adds no Edge change. Option B adds one action to an existing registered function with auth-refused / invalid-input / happy-path tests and the standard `{error, detail}` shape; email-binding is checked before provisioning.
- **No account enumeration:** `lookup_by_token` shape is UNCHANGED (no email, no account flag). The gate render cannot vary by account state (asserted by test #3). Account existence is revealed only after the user themselves submits the email+password (Option A `email_already_used`; Option B `account_exists`).
- **No-token / no-secret leak:** the room token rides only the `/invite/<token>` path + the `pendingInviteIntent` slice (existing); it is never logged, never co-mingled onto an auth redirect, never returned in a new response. The credential step holds no token (the gate does). No password is logged.
- **Email-binding preserved:** acceptance still requires `callerEmail === invitee_email_lower` server-side; the app-owned signup only establishes the session, it does not bypass the binding (Option A) or provisions-after-binding-check (Option B).
- **Plain language (§9):** every error maps through a plain-language string; raw Supabase messages are never surfaced (asserted by test #1).
- **v1 scope (§10):** no voting/search/OAuth/push/public-API; email+password only (the existing v1 auth).
- **Engine sacred (§5):** `src/domain/constitution/engine.ts` (the live path; CLAUDE.md's `src/lib/...` is stale) is untouched; nothing in this card couples to the engine.

---

## GATE-C / merge-as-deploy posture

- **Option A (the design): NOT a deploy.** It touches only `src/**` (client) + `__tests__/**` + `App.tsx` + docs. It changes **no** `supabase/functions/**`, **no** `supabase/migrations/**`, **no** §4 surface, and introduces no new operative semantics that an operator must ratify. Per §5 it is a client-only PR; the merge is not auto-deploy-bearing (the web bundle redeploys via the normal Netlify/Cloud Run app deploy, not the Supabase integration). It still runs GATE A → B → C as a normal card; the merge decision at GATE C is the operator's, but it is not a deploy.
- **Option B (contingency only): GATE-C / merge = deploy.** It touches `supabase/functions/manage-room-invite/index.ts` + `inviteSchemas.ts`; the Supabase GitHub integration auto-redeploys registered Edge functions on merge → operator-gated merge. Inert posture: the new action only runs when the client calls it; no gate flip needed, but the deploy itself is operator-only.

Per §4: Claude never flips a hosted config, never sets a secret, never deploys, never runs a live signup smoke — each is an explicit operator action.

---

## Deploy step (operator)

**Option A (recommended): pure client change.**
1. **Verify the hosted Auth posture once** (Open question 1): confirm hosted `Authentication → Providers → Email → Confirm email` is **OFF** (matches local `enable_confirmations = false`). If ON, either turn it OFF (so in-place signup yields a live session) or authorize the Option-B pivot.
2. **Merge to main** (operator-gated GATE-C decision, but **not a deploy** — client-only; the web bundle redeploys via the normal app deploy).
3. **Manual smoke (operator):** fresh alias → `/invite/<token>` → "create my account" → set email+password → lands enrolled in the room, invite flips to `accepted`, `debate_participants` row present. Verify the DB **before** any cleanup (the ARG-ROOM-004 smoke's lesson). No Auth email involved.

**Option B (only if pivoted):** additionally
4. **Merge = deploy** of `manage-room-invite` (operator-gated; auto-redeploys on merge).
5. Smoke the `provision_and_accept` action with a fresh alias, verifying email-binding-before-provision and the no-session-returned contract.

If Option A and hosted confirmations are already OFF: **None beyond the normal app deploy + the manual smoke.**

---

## GATE-A self-check

- [x] **Scope is explicit** — Option A (chosen, client-only) + Option B (contingency, GATE-C) fully specified; the decoupling mechanism (anon-key `signUp` under confirmations-OFF) is named; file plan, contracts, edge cases, test plan, risks, out-of-scope all present.
- [x] **No production code written** — design doc only; the file plan describes what the implementer builds.
- [x] **No migration / no data-model change** — both options reuse existing tables; no RLS change.
- [x] **Decoupling from `/auth/callback` proven in the design** — the new-user account step runs on `/invite/<token>` with no GoTrue redirect, no fragment, no allow-list dependency; the legacy bridge is retained, not relied on.
- [x] **No-enumeration preserved** — `lookup_by_token` shape unchanged; the gate render cannot vary by account state; account existence revealed only post-user-submit.
- [x] **Email-binding + secret hygiene specified** — server-side binding unchanged; anon-key only (A) / service-role-already-present (B); no token/JWT/password in any new response or log.
- [x] **Doctrine self-check complete** — §1/§2-3/§4/§5/§6/§9/§10 + no-enumeration + no-token-leak + email-binding all addressed.
- [x] **GATE-C posture stated** — Option A is client-only (not a deploy); Option B is GATE-C (merge = deploy).
- [x] **Deploy step + design testing-run produced** — both deliverables written on the feature branch.
- [x] **Engine path corrected** — live engine is `src/domain/constitution/engine.ts`; untouched.

**Open questions for the operator** (carried into the testing-run record):
1. **Hosted `enable_confirmations` posture** — is hosted "Confirm email" OFF (matching local `config.toml:233`)? Option A's in-place session requires OFF. If it must stay ON, authorize the Option-B pivot. (This is the single load-bearing precondition.)
2. **Send-side flip timing** — should a follow-up card flip the `room-notifications` new-user branch to email the `/invite/<token>` app route (instead of `/auth/callback?invite=`) so brand-new invitees receive the decoupled link directly? (This card is the app-side prerequisite; the send-side flip is its own GATE-C card.)
3. **Throwaway-account hygiene** — accept that a new user who typos the email creates a harmless throwaway `auth.users` row (no participant, no data), or add an operator cleanup follow-up? (No-enumeration forbids prefilling/revealing the invited email, so the user must type it.)
