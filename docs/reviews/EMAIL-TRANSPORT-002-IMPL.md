# EMAIL-TRANSPORT-002 — Review (GATE C, Option B implementation)

**Verdict:** Approve
**Reviewer agent run:** 2026-06-13
**Branch:** feat/EMAIL-TRANSPORT-002-newuser-credential-route (HEAD 7a597ea, impl commits c43a626 / 99f4b4a / 6e0e834 / 7a597ea on GATE-A base d6bd233)
**Design:** docs/designs/EMAIL-TRANSPORT-002.md (§ "Contingency: Option B")
**GATE-A design review:** docs/reviews/EMAIL-TRANSPORT-002.md (Approve)
**Gate posture:** GATE-C — touches `supabase/functions/manage-room-invite/index.ts` (config.toml-registered) → merge auto-redeploys the Edge fn. The new action is inert until the client calls it.

## Summary

A clean, security-first implementation of the design's Option-B contingency: a new
UNAUTHENTICATED `provision_and_accept` action on `manage-room-invite` that lets a
brand-new invitee set credentials in place on the app-owned `/invite/<token>` route,
decoupling the new-user flow from GoTrue's `redirect_to`/allow-list (the smoke7 failure
mode). The Option-B pivot is **operator-authorized** (current-status.md records a live
Management-API read returning `mailer_autoconfirm: false` → hosted confirmations ON →
Option A's synchronous-session signUp not viable), satisfying the design/GATE-A
precondition that B is never built speculatively. The security spine is correct in source
order — email-binding and room-open are both enforced *before* `auth.admin.createUser`,
the response carries no session/JWT/token, service-role lives only inside the Edge fn,
and `lookup_by_token` is byte-unchanged (no enumeration). The `enrolAndFlipInvite`
extraction is behavior-preserving (existing accept assertions re-pointed, never weakened).
New copy is verdict-free and routes every error through the plain-language registry. All
gates pass; the two full-suite failures are pre-existing flakes unrelated to this branch
(both pass in isolation, both exist byte-identical on main).

## Verification (reviewer re-run, worktree on branch @ 7a597ea)
- **typecheck:** pass (exit 0)
- **lint:** pass (exit 0, `--max-warnings 0`)
- **test (full suite):** `Test Suites: 2 failed, 795 passed, 797 total` / `Tests: 2 failed, 1 skipped, 31063 passed, 31066 total` — exit 1, BUT the 2 failures are PRE-EXISTING FLAKES, not regressions (see below). Isolated re-run of the 2 suites: exit 0, 62/62. ET-002-specific suites isolated: 8 passed / 164 tests, exit 0.
- **Count reconciliation:** 31063 passed + 2 flaked-but-pass-isolated = **31065**, matching the implementer's claim (797 suites / 31065 passed / 1 pre-existing skip / 31066 total, +3 suites / +71 tests over 794/30994). Confirmed.
- **secret scan:** clean — no secret VALUE in the diff (the `Bearer`/`JWT`/`token` matches are all in docs prose). No `sk-ant-`/`sb_secret_`/`eyJ…`/service-role-key literal anywhere.
- **service-role-in-client scan:** clean — `createServiceClient` / `admin.createUser` / `admin.inviteUserByEmail` appear ONLY in `supabase/functions/manage-room-invite/index.ts`; zero in `app/` or `src/`. (The two `app/ src/` grep hits for `SERVICE_ROLE`/`service_role` are pre-existing guard-regex / role-name strings, not in this diff, not usages.)
- **doctrine scan:** clean — the only banned-token matches are the ban-list *definitions inside the ban-list test* (expected); no verdict token in production copy.
- **.skip/.only/xit/console.log added:** none.

### Pre-existing flakes (branch exonerated)
- `__tests__/moveMetadataLedger.test.ts` (META-001 `< 60 ms` wall-clock perf) — the documented full-suite-parallel-load flake (MEMORY: flaky-life001-perf-test-fullsuite).
- `__tests__/startArgumentInviteLinkBox.test.tsx` — RTL suite from the prior ARG-ROOM-008 card.
- Both: NOT in this branch's diff; byte-identical to `main`; pass in isolation (62/62, exit 0). Source `moveMetadataLedger.ts` unchanged. Neither is a regression introduced by this card.

## The nine prompt verification asks (claim → actual)
1. **SECURITY — service-role only in Edge: PASS.** `grep` confirms `createServiceClient`/`admin.createUser` only in the Edge fn; zero in `app/`/`src/`. No secret value in any file.
2. **SECURITY — email-binding BEFORE provisioning: PASS.** Source order in `handleProvisionAndAccept`: `403 invite_email_mismatch` (typedEmailLower !== invitee_email_lower) precedes `svc.auth.admin.createUser`. A wrong email can never mint an account. Asserted by the static test `bindingIdx < createIdx` (manageRoomInviteEdgeCases). Room-open also precedes createUser (`archivedIdx < createIdx`, also asserted).
3. **SECURITY — no session/JWT/token in response: PASS.** Success body is `{ debateId, status, enteredAsParticipant, intendedSeat }` only. Asserted by the test scanning every `ok({…})` body for session/jwt/access_token/refresh_token/`\btoken\b`. The client signs in separately via `signInWithEmailPassword`. The component test asserts the rendered tree holds no password value and no token after success.
4. **NO-ENUMERATION: PASS.** `handleLookupByToken` projection is unchanged (the only diff touching it is docstring whitespace + comments). The gate's signed-out render is byte-identical regardless of account state (newuser test renders twice, asserts `treeA === treeB` and no `@` in the tree). `account_exists` is reachable only after the caller submits their own email+password (`createUser` error → 409), never via the unauthenticated lookup.
5. **BEHAVIOR-PRESERVING extraction: PASS.** `enrolAndFlipInvite` is the verbatim enrolment+flip+audit logic (opposite-side selection, 23505 idempotency, best-effort flip, audit with emailDomain only) shared by `handleAccept` and `handleProvisionAndAccept`. The §5.5 / §10 accept assertions were re-pointed to scan the shared helper (intent unchanged, never weakened); handleAccept is asserted to call it. create/revoke/list/lookup/accept actions and the `?invite=` bridge / 23505 relabel are untouched.
6. **DOCTRINE — copy: PASS.** `INVITE_CREDENTIAL_COPY` is verdict-free, plain-language, shows only room title + inviter + account fields (no heat/score/standing). Added to the `inviteCopyDoctrine` ban-list scan. New codes `account_exists`/`provision_failed`/`weak_password` map through `ERROR_CODE_MAP`; the pure model surfaces NO raw provider message (accepts only `{ ok, errorCode }`, falls back generically for unknown codes).
7. **EDGE CONTRACT: PASS.** Schema-validated (zod discriminated-union + `Password` min6/max128), token-possession-gated (no JWT — correct for the design, like `lookup_by_token`; the token+email+password ARE the auth and email-binding is the spine), password passed only into `createUser` and never logged (asserted), stable `{error, message}` shape via `jsonError`. No migration / no RLS (confirmed — `--name-only -- 'supabase/migrations/**'` empty; heightened migration review not triggered).
8. **TESTS: PASS.** +71 tests / +3 suites cover the new contract and the design's edge cases: existing-account (`account_exists`), already-accepted, expired/revoked/archived/closed, wrong-email (email_mismatch, server binding), weak/over-long/missing password (schema), cold-start (gate auto-accept off live session), no-enumeration, no-session-returned, no-token/password-log, no-JWT. No `.skip`/`.only`, no new `console.log`. Gate re-run reconciles to the claimed count (see Verification).

## Design conformance
- [x] All design Option-B file-changes are present (Edge action + schema + client wrapper + pure model + in-place step + gate two-path + copy + App.tsx)
- [x] No undocumented file-changes (every prod file in the diff is named in the design or its Option-B contingency)
- [x] Data model matches design (no new table/column/RLS; uses auth.users via admin.createUser + existing invites/participants)
- [x] API contracts match design (provision_and_accept body {token,email,password}; returns {debateId,status,…}, no session)
- [x] Schema mirror: the design referenced a separate `inviteSchemasMirror.ts`; the ACTUAL established pattern (QOL-038) is an in-test re-declared mirror in `__tests__/inviteSchemas.test.ts`, which the implementer correctly extended with the new action + 6 dedicated tests. Spec intent (mirror parity for the new action) satisfied. (See Suggestion 1.)

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings (ban-list extended to INVITE_CREDENTIAL_COPY; copy scanned)
- [x] Score never blocks posting — N/A; this flow carries no score/heat/standing
- [x] No service-role in client code — verified zero in app/ src/; only in the Edge fn
- [x] No direct insert into public.arguments — N/A; touches invites/auth/participants only, all via the Edge fn
- [x] No AI calls in production app paths — none
- [x] Plain language only — every error maps through plain-language states; raw provider message never surfaced (model accepts only error CODES)
- [x] Epic-specific (supabase-edge-contract §1): no new service-role in client; Edge reuses the existing one; email-binding-before-provision; no JWT returned; standard {error,message} shape; auth/invalid-input/happy-path covered. (cdiscourse-doctrine: no-enumeration held; token rides only the /invite path + pendingInviteIntent; password never logged.)

## Test coverage
- [x] New public functions have unit tests (validateInviteCredentialForm, mapProvisionOutcomeToStep, mapSignInOutcomeToStep, credentialCopyForMode — inviteCredentialModel.test.ts)
- [x] User-facing strings have ban-list assertion (inviteCopyDoctrine extended to INVITE_CREDENTIAL_COPY)
- [x] Edge cases from design § "Edge cases" have tests (account_exists, email_mismatch, expired/revoked/accepted/archived/closed, weak/over-long/missing password, no-enumeration, no-session, cold-start auto-accept)
- [x] Accessibility assertions present (InviteCredentialStep uses accessibilityRole/Label/State, minHeight 44/48 tap targets; secureTextEntry on password)

## Blockers
None.

## Suggestions (non-blocking)
1. **Schema mirror is manual (pre-existing QOL-038 limitation).** `__tests__/inviteSchemas.test.ts` re-declares the zod schema rather than importing the Edge `inviteSchemas.ts` (which can't load in Jest via `npm:zod@4`). A drift between the two declarations would not be auto-caught. EMAIL-TRANSPORT-001 introduced the better `*SchemasMirror.ts` importable-twin pattern (`emailSchemasMirror.ts`); a future cleanup could migrate the invite schemas to that pattern so the parity is import-enforced, not by-hand. Not introduced by this card.
2. **`account_exists` detection uses a message-substring + `status===422` heuristic** (`msg.includes('already'|'registered'|'exists')`). This is robust to the current GoTrue behavior but is string-fragile across Supabase Auth versions; if GoTrue changes the duplicate-email error wording/status, the path would degrade to the neutral `provision_failed` (safe — never an enumeration leak, just a worse UX). Worth a one-line note for the operator smoke to confirm the live 409→account_exists mapping on the deployed fn.
3. **The `account_exists` → sign-in UX is a banner + a manual "switch mode" tap**, not an auto-switch into sign-in sub-mode. Functional and doctrine-clean; a minor future polish could auto-flip `mode` to `signin` on `offer_signin` to save the user a tap.
4. **AuthScreen "Confirmation email sent" misleading copy** (out of scope, carried from GATE-A) is still reachable from the SessionExpiredPrompt → AuthScreen path. Worth a follow-up issue so it is not lost.

## Operator next steps
- **This is a GATE-C card — merge IS a deploy.** `manage-room-invite` is config.toml-registered; the squash-merge auto-redeploys it via the Supabase GitHub integration. The new `provision_and_accept` action is **inert until the client invokes it** (the client wrapper ships in the same PR, so the in-place credential step becomes live on the same merge — the smoke below exercises it).
- Push the branch: `git push -u origin feat/EMAIL-TRANSPORT-002-newuser-credential-route`
- Open PR: `gh pr create --title "EMAIL-TRANSPORT-002: app-controlled new-user credential route (Option B)" --body-file docs/reviews/EMAIL-TRANSPORT-002-IMPL.md`
- **Deploy (operator, GATE-C):** merge auto-redeploys; optionally `npx supabase functions deploy manage-room-invite --linked`.
- **Manual smoke (operator):** fresh alias → `/invite/<token>` → "Create account & join" → set the invited email + password → lands enrolled, invite flips to `accepted`, `debate_participants` row present (verify the DB BEFORE cleanup — the ARG-ROOM-004 lesson). Also smoke: wrong email → `invite_email_mismatch` with NO `auth.users` row minted; an already-registered email → `account_exists` (the Suggestion-2 mapping). No Auth email round-trip involved.
- Per §4: Claude never deploys / sets a secret / flips a config / runs the live smoke — each is an operator action.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup".

## Safe-to-PR statement
**Yes — safe to PR and operator-merge as a GATE-C card.** Security is sound (service-role
Edge-only, email-binding-before-provision verified in source order + test, no session/JWT/token
returned, no enumeration, password never logged). The extraction is behavior-preserving.
Doctrine is clean. All gates pass (the 2 full-suite failures are pre-existing flakes, branch
exonerated). The Option-B pivot is operator-authorized (hosted confirmations ON). The merge
auto-redeploys `manage-room-invite`; the new action is inert until the client calls it (and the
client ships in the same PR, so the operator smoke validates the live path). No HALT condition
triggered.
