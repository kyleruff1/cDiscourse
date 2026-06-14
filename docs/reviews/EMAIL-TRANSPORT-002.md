# EMAIL-TRANSPORT-002 — Review (GATE A, design-phase)

**Verdict:** Approve (GATE A pass)
**Reviewer agent run:** 2026-06-13
**Branch:** feat/EMAIL-TRANSPORT-002-newuser-credential-route (commit 98b5ade, parented on 1353b24, unpushed)
**Design:** docs/designs/EMAIL-TRANSPORT-002.md + docs/testing-runs/2026-06-14-email-transport-002-design.md
**Stage:** DESIGN — no production code exists. This is a GATE-A design review only.

## Summary

A well-grounded design-only card. It routes new-user credential creation onto the app-owned `/invite/<token>` redemption route (Option A: anon-key `supabase.auth.signUp` in-place, then the existing `acceptRoomInvite`), removing the dependency on GoTrue honoring `redirect_to` against the hosted Redirect-URLs allow-list — the exact smoke7 failure mode (host `cdiscourse.netlify.app` vs allow-listed `dev-cdiscourse.netlify.app` → Site-URL fallback → fragment tokens never reaching `/auth/callback`). Every load-bearing code citation in the design was checked against the branch and is accurate. The decoupling claim is sound. No-enumeration, email-binding, and secret hygiene are all preserved. The one genuine risk — the hosted `enable_confirmations` posture the local `config.toml` cannot attest to — is correctly surfaced as a load-bearing precondition with a built-in graceful-degrade detector and a fully-specified Option-B pivot. Open questions 1–3 are operator-policy calls, not design defects; #1 is a hard precondition the operator must answer before the implementer starts.

## Verification (design-phase)
- Diff footprint: 2 docs, +377 lines, **zero production code** — correct for a design card.
- typecheck / lint / test: N/A (no code; the 1805/70 baseline is the implementer's GATE-B gate, not this stage's). No HALT trigger.
- secret scan (cited client files `src/features/invites/`, `src/features/auth/`, `src/lib/auth/`, `src/lib/supabase.ts`): **clean** — zero `SERVICE_ROLE` / `ANTHROPIC_API_KEY`.
- doctrine scan: clean — design copy is verdict-free; existing `inviteCopyDoctrine` ban-list (BANNED_INVITE_FRAMING + word/substring tokens) already covers winner/loser/liar/challenger/opponent; the card extends it to `INVITE_CREDENTIAL_COPY`.

## Code cross-checks (design claim → actual)
- `config.toml:233` `enable_confirmations = false` — **confirmed exact.** `enable_signup = true` (`:183`,`:228`) confirmed; `minimum_password_length = 6` (`:189`) confirmed.
- `src/lib/supabase.ts` `detectSessionInUrl: false`, `persistSession: true`, `autoRefreshToken: true` (`:74-76`) — confirmed. Client posture is consistent with an app-owned, in-place session; a `signUp` persists a session the same way `signIn` does.
- `authApi.ts` — `signUpWithEmailPassword` (`:87-125`), `signInWithEmailPassword` (`:185-211`), `setInvitedUserPassword` (`:167-183`), `validateNewPassword` min-6 (`:34-39`), `getCurrentSession` (`:227-231`), `mapAuthError` → `email_already_used`/`weak_password`/`network_error`/`redirect_invalid`/`unknown` — all confirmed.
- `InviteRedeemGate.tsx` — `onPromptSignIn({invitedEmail, preferSignUp})` prop (`:56`), auto-accept effect on signed-in+pending+email (`:118-127`), single-path `SignedOutPrompt` today (`:214-222`) — confirmed.
- `inviteApi.ts` `lookupInviteByToken` response = `{status, tokenEcho, room{title, invitedByDisplayName}}` — **no email, no account flag** (`:92-100`) — confirmed (no-enumeration spine).
- `manage-room-invite handleAccept` email-binding `callerEmail !== invitee_email_lower → 403 invite_email_mismatch` (`:594-597`) — **confirmed exact.** JWT-required (`:549-553`), idempotent accept (23505 + `status='pending'` flip guard) — confirmed.
- `handleLookupByToken` unauthenticated minimum-projection (`:465-540`) — confirmed.
- `App.tsx handleInvitePromptSignIn` takes no args, just dispatches `SIGNED_OUT` (`:273-279`) — confirmed; the design's "App.tsx currently ignores both args" is accurate.
- `room-notifications` `buildInviteLinkFromOrigin` → `/invite/<token>` (existing-user lane), `buildBridgeRedirect` → `/auth/callback?invite=<token>` (new-user, gated `INVITE_AUTH_BRIDGE_ENABLED` default OFF), `resolveInviteNotificationStatus` branch-independent — confirmed.
- `inviteSchemas.ts` — `accept`/`lookup_by_token` take only `Token`; **no `provision_and_accept`** exists (`:42-58`) — confirmed; Option B correctly described as a new action requiring the schema + the `inviteSchemasMirror` parity.

## Design conformance (against the 9 verification asks)
1. **Decoupling soundness — PASS.** `config.toml:233` says exactly what the design claims; the client posture (`detectSessionInUrl:false`) is consistent; under confirmations-OFF an anon-key `signUp` returns a live persisted session synchronously, so there is no email, no GoTrue redirect, no `redirect_to`/allow-list dependency — this genuinely sidesteps smoke7. The CRITICAL caveat is correctly flagged: this depends on the **hosted** posture, which the repo cannot attest to. The design surfaces it as the single load-bearing precondition (Open question 1) AND builds in a degrade-detector (`signUp` ok but no live session → "check your email" state + legacy bridge) AND specifies Option B as the pivot. Properly handled.
2. **Option A — PASS.** No service-role, no Edge change, no migration, no email; touches only `src/**` + `App.tsx` + `__tests__/**` + docs → genuinely not-a-deploy (merge ≠ deploy; web bundle redeploys via the normal Netlify/Cloud Run path, not the Supabase integration). Email-binding stays server-side at `handleAccept:594-597` and is **not** weakened client-side — the gate still attempts accept blindly and the server returns `invite_email_mismatch` on a wrong-email signup.
3. **Option B — PASS.** Correctly flagged GATE-C (touches `manage-room-invite/index.ts` + `inviteSchemas.ts` → merge auto-redeploys the registered Edge fn → operator-gated merge-as-deploy). Uses only the service-role already present in that function; email-binding checked **before** provisioning; returns no session/token (client does its own `signInWithEmailPassword`). Explicitly not built speculatively.
4. **No-enumeration — PASS.** `lookup_by_token` shape is unchanged (no email, no account flag); the design adds nothing to it. The gate render cannot vary by account state (no input differs). `email_already_used` (A) / `account_exists` (B) is revealed only AFTER the user themselves types and submits the email — no enumeration via the unauthenticated lookup. The temptation to prefill the invited email is explicitly refused.
5. **Doctrine — PASS.** New copy is verdict-free and added to the existing ban-list scan; no raw token/internal code/failure reason surfaced (errors map through plain-language states; `mapSignUpOutcomeToStep` is specified to never surface raw Supabase messages); the room token stays on the `/invite/<token>` path and is never co-mingled onto an auth `redirect_to`.
6. **Secret hygiene — PASS.** Option A uses only the anon key (verified: zero service-role/provider keys in the client invite/auth surface); no token/secret in any new response or log; passwords go only into the auth call. Option B adds no new secret surface and returns no JWT.
7. **Edge cases — PASS.** All 12 named cases are present and technically grounded: confirmations-ON detect+pivot, typed-email≠invited (server `invite_email_mismatch` → existing `MismatchPanel`), already-account (offer sign-in), expired/revoked/accepted/archived/closed/not-found (rendered by lookup **before** the credential step is reachable), cold-start mid-signup (`pendingInviteIntent` 24h freshness survives), concurrent accept (idempotent 23505), weak password (`validateNewPassword` + server min-6 backstop), network fail (retryable), legacy `?invite=` bridge retained.
8. **Test plan — PASS.** Pure model (`inviteCredentialModel`) + component (RTL) + no-enumeration + ban-list extension, all without weakening existing assertions (§4 honored — existing `InviteRedeemGate.test.tsx` sign-in path stays asserted). Pure/Jest, no live network. New test file names follow the established `InviteRedeemGate.*.test.tsx` convention; they do not exist yet (correct for design phase).
9. **Scope — PASS.** No v1-scope violation (email+password only; no voting/scoring/search/OAuth/push/public-API). The send-side flip of `room-notifications` to the `/invite` route is correctly deferred to its own GATE-C follow-up (this card is its app-side prerequisite). Engine untouched (correct live path `src/domain/constitution/engine.ts` noted).

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings (ban-list extended to new bundle)
- [x] Score never blocks posting — N/A; this flow carries no score/heat/standing at all
- [x] No service-role in client code — Option A anon-key only, verified clean
- [x] No direct insert into public.arguments — N/A; touches invites/auth only
- [x] No AI calls in production app paths — none
- [x] Plain language only — every error maps through a plain-language state; no raw codes
- [x] Epic-specific (supabase-edge-contract §1): no new service-role in client; Option B reuses the existing one, email-binding-before-provision, no JWT returned, standard `{error, detail}` shape, auth/invalid/happy tests specified

## Open-question disposition (the explicit ask)
- **Q1 — hosted `enable_confirmations` posture: BLOCKING for implementation.** This is the single load-bearing precondition for Option A. The operator must confirm hosted "Confirm email" is **OFF** (matching `config.toml:233`) before the implementer starts. If it cannot be OFF, the operator must authorize the **Option-B pivot** (GATE-C). The design degrades gracefully if the posture is wrong, but the choice of A-vs-B is an operator decision the implementer needs up front.
- **Q2 — send-side room-notifications flip: NOT blocking.** Correctly deferred to its own GATE-C card; this card is its prerequisite and stands alone.
- **Q3 — throwaway-account hygiene: NOT blocking.** A typo'd-email signup creates a harmless `auth.users` row (no participant, no data); accepting this is consistent with the no-enumeration constraint (the invited email must not be prefilled/revealed). An operator cleanup follow-up is optional, not a gate.

**Option the operator must confirm before the implementer starts: A vs B**, contingent on the Q1 answer. Default is Option A (recommended, client-only, not-a-deploy). The implementer must NOT build Option B unless the operator explicitly confirms hosted confirmations must stay ON.

## Suggestions (non-blocking, for the implementer)
1. The confirmations-ON degrade-detector depends on the gate calling `getCurrentSession()` after a successful `signUp` (the `signUpWithEmailPassword` wrapper returns only `{id, email}`, not session state). The primitive exists (`authApi.ts:227-231`); the implementer should specify the "short bounded settle" concretely (e.g. await `getCurrentSession()` once, optionally one retry) and add a test for the "ok-but-no-session → check-your-email" state so the contingency path is covered, not just the happy path.
2. The `AuthScreen` "Confirmation email sent" misleading copy (`AuthScreen.tsx:36,46-58`) under confirmations-OFF is correctly out of scope, but it is reachable from the gate's "I already have an account → sign in → toggle to signup" path. Worth a one-line follow-up issue so it is not lost.
3. When extending `inviteCopyDoctrine.test.ts`, mirror the existing `BANNED_SUBSTRING_TOKENS` / `BANNED_WORD_TOKENS` structure exactly so the new bundle is scanned by the same assertions (no parallel weaker scan).

## Operator next steps
- This is a DESIGN artifact at **GATE A**. Approving advances to IMPLEMENT.
- **Before IMPLEMENT:** answer Q1 (hosted `enable_confirmations` posture) and confirm **Option A vs B**. Default A.
- Push the branch: `git push -u origin feat/EMAIL-TRANSPORT-002-newuser-credential-route`
- Deploy steps: **Option A — none beyond the normal app deploy + a manual smoke** (fresh alias → `/invite/<token>` → create account → enrolled, invite `accepted`, verify DB before cleanup). **Option B (only if pivoted) — merge = deploy** of `manage-room-invite` (operator-gated; auto-redeploys), then smoke `provision_and_accept` for email-binding-before-provision + no-session-returned.
- No migration, no Edge change, no secret/config mutation by Claude in either option (§4 — all operator actions).
