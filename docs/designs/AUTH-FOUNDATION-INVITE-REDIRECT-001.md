# AUTH-FOUNDATION-INVITE-REDIRECT-001 — Preserve invite/room intent through auth redirects (design-first, provider-independent)

> Status: closing design doc for issue #742. Design/docs only — no code, Edge Function, or config is changed. This is the dedicated standalone expansion of section 4 of `docs/designs/AUTH-FOUNDATION-INDEX.md`. It audits the existing intent-continuity machinery and specifies the provider-independent contract that the Google redemption card (#748) will rely on.

## 0. Goal

Guarantee that an invitee's room/invite intent survives ANY authentication round-trip — email/password today, Google SSO tomorrow — without bypassing capacity/invite rules, without a client direct insert to `public.arguments`, and without service-role in the client.

## 1. End-to-end continuity contract: capture → persist → survive → resume → clear

### 1.1 Capture (deep link)

A tapped invite deep link yields a raw token, validated by `isValidInviteTokenShape` and packaged by `buildPendingInviteIntent(token, nowIso)` (`src/features/invites/pendingInviteIntent.ts:70-78`). The intent shape is `{ token, capturedAt }` (`pendingInviteIntent.ts:38-50`).

### 1.2 Persist (AsyncStorage + session snapshot)

The intent lives in BOTH places (`pendingInviteIntent.ts:11-19`):
- A dedicated device-local AsyncStorage key `cdiscourse:pending-invite-intent` (`PENDING_INVITE_INTENT_STORAGE_KEY`, `:35`), written by `savePendingInviteIntentToStorage` (`:139-150`). This covers the anonymous → sign-up → sign-in handshake where there is no user-keyed snapshot.
- The persisted session snapshot when a user is signed in.

Persistence failure is non-fatal — the freshly captured intent is still live in React state; only the cold-start path needs the persisted copy (`:136-138`). The token is never logged by this module (`:24-29`).

### 1.3 Survive the auth round-trip

A 24h freshness window (`PENDING_INVITE_INTENT_FRESHNESS_MS = 24 * 60 * 60 * 1000`, `pendingInviteIntent.ts:63`) is long enough to cover a confirmation roundtrip + reboot + browser restart, short enough that a weeks-old abandoned signup is not silently redirected. `loadFreshPendingInviteIntent` (`:118-126`) and `loadPendingInviteIntentFromStorage` (`:156-172`) parse + freshness-check on read and drop stale/malformed intents. A future-dated `capturedAt` (clock skew) is treated as fresh — never dropped as "too new" (`:99-110`).

The redirect plumbing the round-trip rides on: `buildAuthRedirectUrl` maps `invite → /auth/callback` (`src/lib/auth/buildAuthRedirectUrl.ts:50`), and `consumeAuthCallback` returns `needs_password` ONLY for `type=invite` (`src/features/auth/consumeAuthCallback.ts:51-54`) — every other flow returns `success`.

### 1.4 Resume (InviteRedeemGate auto-accept)

`InviteRedeemGate` resolves the token (`lookupInviteByToken`, `src/features/invites/InviteRedeemGate.tsx:97-106`) and auto-fires acceptance on (signed-in + live pending + email match) (`:124-134`). The email-match check is **server-side**: the client cannot see the invitee email from lookup, so the gate optimistically calls accept and the Edge Function returns `invite_email_mismatch` on a mismatch (`:129-133`). Acceptance routes through `acceptRoomInvite` (`:115`) → the Edge Function only.

### 1.5 Clear (on success / exit)

The persisted intent is removed via `clearPendingInviteIntentFromStorage` (idempotent, `pendingInviteIntent.ts:175-181`) once acceptance succeeds or the invitee exits, so a completed/abandoned intent does not re-fire on the next cold start.

## 2. Provider-independent requirement — does the intent survive an OAuth redirect?

The persistence layer is provider-agnostic by construction: the intent lives in a device-local AsyncStorage slot keyed by a fixed name (`pendingInviteIntent.ts:35`), independent of how the session is later established. The 24h freshness window and the parse/freshness helpers make no provider assumption. Therefore the SAME intent that survives the email-confirmation round-trip will survive a Google OAuth redirect's cold-start, because it is read back from the same AsyncStorage slot.

**Where the OAuth path must re-read the intent:** at the first signed-in state after the callback is consumed. For email/password today, the resume trigger is the `InviteRedeemGate` auto-accept effect that fires once `signedIn` becomes true (`InviteRedeemGate.tsx:124-134`). For the OAuth path, the same first-signed-in transition must drive a re-read of the persisted intent (`loadPendingInviteIntentFromStorage`, `pendingInviteIntent.ts:156-172`) and feed it into the gate.

**Named gap to close in #748 (the Google redemption card):** there is no `signInWithOAuth` call in `src/` today (confirmed by a repo-wide search returning zero matches), and `consumeAuthCallback` currently special-cases only `type=invite` for the passwordless set-password step (`consumeAuthCallback.ts:51-54`). The OAuth callback (an authorization-code exchange via `exchangeCodeForSession`, declared at `consumeAuthCallback.ts:46-48`) must, on reaching the first signed-in state, route the user back through `InviteRedeemGate` with the persisted token so the existing server-side auto-accept (`InviteRedeemGate.tsx:124-134`) fires. No provider-specific assumption in the persistence layer blocks this; the gap is purely the OAuth-callback → first-signed-in → gate wiring, which is #748's implementation work (GATE-C, not in scope here).

## 3. Invariants that MUST hold through any redirect

| Invariant | Evidence |
|---|---|
| **(a) No capacity/seat/invite-binding bypass** — acceptance stays server-side via the Edge Function. | `acceptRoomInvite` / `provisionAndAcceptInvite` invoke the `manage-room-invite` Edge Function only (`src/features/invites/inviteApi.ts:212-238`); email-match enforced server-side (`InviteRedeemGate.tsx:129-133`). |
| **(b) No direct client insert to `public.arguments`.** | The invite wrappers "NEVER import a service-role key and NEVER insert directly" (`inviteApi.ts:224-227`); acceptance is an Edge invoke, not a client write. |
| **(c) No service-role in client.** | `inviteApi.ts:224-227`; `CLAUDE.md` security table. |
| **(d) Email-binding mismatch handled with plain copy, no enumeration.** | Mismatch returns `invite_email_mismatch` from the server, surfaced through the gate's error state (`InviteRedeemGate.tsx:116-117, 129-133`); the client cannot enumerate the bound email. |

## 4. Hosted redirect-allow-list dependency (cross-link)

The launch host's redirect allow-list MUST include the `/auth/callback` return path or the intent round-trip breaks: a `redirect_to` not on the hosted allow-list is silently dropped → falls back to Site URL (`supabase/config.toml:159-163`; memory `auth-email-deployment-facts`). This is tracked in `docs/designs/AUTH-FOUNDATION-CONFIG-001.md` §3 (gap log G2) and cross-references the Google config card (#745). #744's allow-list matrix must assert the resolved origin/callback path is allow-listed before the Google smoke.

## 5. Doctrine compliance

Acceptance remains the server's job; the client never inserts arguments and never uses service-role; tokens are never logged (`pendingInviteIntent.ts:24-29`); error states are plain-language and non-enumerating. No truth/winner/verdict surface is implicated — this is identity/intent plumbing.

## 6. Tests

The pure helpers in `pendingInviteIntent.ts` (build / parse / freshness / load-fresh) are already tested. This design card adds no new pure helper, so no new test is required. The OAuth-callback → gate wiring named in §2 is #748's work and carries its own tests there.

## 7. Acceptance-bullet evidence map

| Acceptance bullet | Satisfied by |
|---|---|
| Continuity-contract doc/section with full capture→persist→resume flow + file:line citations | §1.1–§1.5 (cites `pendingInviteIntent.ts`, `InviteRedeemGate.tsx`, `buildAuthRedirectUrl.ts:50`, `consumeAuthCallback.ts:51-54`) |
| Proves intent survives an OAuth redirect, OR names the precise gap to close in the Google redemption card | §2 — provider-agnostic persistence proven; precise gap (OAuth-callback → first-signed-in → gate wiring) named for #748 |
| The four invariants restated with evidence | §3 table (a)–(d) with file:line |
| Hosted-redirect-allow-list dependency cross-linked to the config card | §4 (cross-links AUTH-FOUNDATION-CONFIG-001 §3 G2 and #745) |
