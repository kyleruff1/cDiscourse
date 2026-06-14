# EMAIL-TRANSPORT-002 — design-phase record (2026-06-14)

## Header
| Field | Value |
|---|---|
| Card | EMAIL-TRANSPORT-002 — app-controlled new-user credential creation via the `/invite` redemption route |
| Issue | https://github.com/kyleruff1/cDiscourse/issues/637 |
| Stage | DESIGN (Phase 0 + design doc); GATE A follows |
| Branch | `feat/EMAIL-TRANSPORT-002-newuser-credential-route` |
| Baseline | `origin/main @ 1353b24` (EMAIL-TRANSPORT-001 / #636 merged) |
| Worktree | clean at branch creation (`git status` empty); HEAD == baseline |
| Deliverables | `docs/designs/EMAIL-TRANSPORT-002.md` (design) + this testing-run record |
| Code written | **none** (design-only) |

## Governance posture (verified before designing)
- Read `docs/core/pipeline-governance-contract.md` v1. Applied: this is a read-only DESIGN stage producing artifacts only; no §4 action taken, no gate self-approved.
- Phase-0 HALT check: worktree confirmed via `git rev-parse --show-toplevel` (in the agent worktree, not the shared checkout); `git status` clean; HEAD at the cited baseline `1353b24`. No mutation performed, so no typecheck/lint/test gate is the precondition for this stage — DESIGN writes no production code (§2). The full suite baseline (1805 tests / 70 suites from CLAUDE.md Stage 6.4) is the implementer's gate, not this stage's.
- Skills loaded + applied: `cdiscourse-doctrine`, `test-discipline`, `supabase-edge-contract`. Engine path note honored: live engine is `src/domain/constitution/engine.ts` (CLAUDE.md `src/lib/...` is stale) — untouched and uncoupled by this design.

## Phase 0 inventory — key findings (file:line)

### Root cause re-verified against the code (matches the issue)
1. **The set-password flow is genuinely working.** `docs/testing-runs/2026-06-13-auth-live-invite-seed-smoke.md` (devtest98, lines 58-68) shows the full new-user Auth-bridge loop succeeding end-to-end **once the hosted Site-URL/Redirect-URLs were corrected** (the G4 Management-API fix). So the defect is NOT app code.
2. **The failure is upstream GoTrue + hosted config.** `2026-06-13-arg-room-004-email-smoke.md` smoke7 (lines 100-114): the CTA reached host `cdiscourse.netlify.app` (line 47) but the hosted allow-list/Site-URL had been set to `dev-cdiscourse.netlify.app` (the devtest98 fix). GoTrue ignores a `redirect_to` not on the allow-list and falls back to the Site URL → the implicit-flow `#access_token=…` fragment never reached `/auth/callback` → set-password never loaded → no session → auto-accept could not run. Confirmed mechanism (host mismatch).
3. **The co-mingled `?invite=` query is a second, plausible fragility.** `room-notifications/index.ts:273-277` builds `redirectTo = <origin>/auth/callback?invite=<token>` via `buildBridgeRedirect`. A query on the `redirect_to` may itself defeat allow-list matching depending on the hosted match mode (unproven, but the design removes the dependency entirely).

### The decoupling linchpin (the decisive code finding)
- `supabase/config.toml:233` — `[auth.email] enable_confirmations = false`. With confirmations OFF, `supabase.auth.signUp({ email, password })` (via the existing `signUpWithEmailPassword`, `authApi.ts:87-125`) **creates a confirmed user and returns an active, persisted session synchronously — no email round-trip.** `src/lib/supabase.ts:72-78` has `persistSession: true` + `detectSessionInUrl: false`, so the app owns the session and no GoTrue URL handling is involved. **This is what makes a fully app-owned new-user provisioning possible with the anon key alone** — no `/auth/callback`, no `redirect_to`, no allow-list. (Hosted posture must match — see Open question 1.)

### The redemption spine is already 90% ready
- `InviteRedeemGate.tsx` already plumbs `onPromptSignIn({ invitedEmail, preferSignUp })` (`:56`, `:192-194`) — the signup intent prop exists but `App.tsx:273-279` ignores both args today. The auto-accept effect (`:117-127`) already fires `acceptRoomInvite` on signed-in + live-pending. The pure pieces — `pendingInviteIntent` (survives the anonymous→signup→signed-in handshake), `inviteDeepLink` (token on the path only), `inviteApi` (lookup/accept wrappers) — are all reusable unchanged.
- `manage-room-invite handleAccept:594-597` enforces email-binding server-side (`callerEmail === invitee_email_lower`). The app-owned signup only *establishes* the matching session; the binding is never weakened.
- `manage-room-invite handleLookupByToken:465-540` returns the **minimum projection** (`status`, `tokenEcho`, `room{title, invitedByDisplayName}`) — **no email, no account flag.** This is the no-enumeration spine; the design adds nothing to it.

### The deployed friction the design routes around
- `AuthScreen.tsx:36,46-58` always shows "Confirmation email sent" on signup — **misleading under confirmations-OFF**, and that email is itself the fragile Lane-A path. The design's in-place credential step on `/invite` knows it is mid-redemption, promises no email, and flows straight into accept. (Fixing AuthScreen's generic copy is a noted follow-up, out of scope.)

## Decisions taken in the design
1. **Option A (recommended): app-owned in-place signup on `/invite` via the anon-key `signUp`.** No service-role, no Edge change, no migration, no email, no `/auth/callback`. Client-only → not a deploy. This is the design.
2. **Option B (contingency, GATE-C): a new `manage-room-invite` `provision_and_accept` action** using the already-present service-role `auth.admin.createUser`, email-binding-checked **before** provisioning, returning no session/token. Fully specified so the implementer can pivot **only if** the operator confirms hosted confirmations must stay ON. Not built speculatively.
3. **Option C (magic-link/OTP) rejected** — it reintroduces the email + `redirect_to`/allow-list dependency this card exists to remove.
4. **`bridgedInviteToken.ts` retained, demoted to legacy-compat** — already-sent Auth-bridge emails keep working; it is no longer the primary new-user path.
5. **No-enumeration held as a hard line** — no account-existence flag added anywhere; the credential step requires the user to type the invited email (we must not prefill/reveal it); account existence is revealed only after the user themselves submits.

## Scope-reality audit (per the POSTRUN-UX001 rule)
- **Current chain (verified):** email CTA → (new-user) `/auth/callback?invite=<token>` → GoTrue implicit-flow session → `AuthCallbackScreen` set-password → cold-start `?invite=` capture → `acceptRoomInvite`. The break is at the GoTrue redirect step (hosted-config dependent).
- **Allowed file scope vs required scope:** the card names client invite/auth files. Option A delivers entirely within `src/features/invites/**` + `src/features/auth/**` (read-only reuse) + `App.tsx` (one small wiring fix) + `__tests__/**` + docs. **No scope correction needed for Option A.** Option B would expand into `supabase/functions/manage-room-invite/**` + schemas (GATE-C) — flagged, not entered.
- **Hard blocker surfaced:** the hosted `enable_confirmations` posture is the one precondition Option A depends on and the repo cannot read it. The design handles this with a graceful in-step detection + the Option-B pivot, and raises it as the load-bearing operator question. No silent assumption.
- **Effort:** Option A is a small client card (1 new screen ~140-200 LOC, 1 pure model ~60-110 LOC, ~3 small edits, 3 new + 2 updated test files). Option B adds ~1 Edge action + 1 wrapper + schema mirror + GATE-C verification.

## Open questions for the operator
1. **Hosted `enable_confirmations` posture** (load-bearing): is hosted "Confirm email" OFF (matching `config.toml:233`)? Option A's in-place session requires OFF. If it must stay ON → authorize the Option-B pivot.
2. **Send-side flip timing**: should a follow-up card flip the `room-notifications` new-user branch from `/auth/callback?invite=` to the `/invite/<token>` app route so brand-new invitees receive the decoupled link directly? (This card is the app-side prerequisite; the flip is its own GATE-C card.)
3. **Throwaway-account hygiene**: accept that a new user who typos the email creates a harmless throwaway `auth.users` row (no participant, no data), or add an operator cleanup follow-up? (No-enumeration forbids prefilling/revealing the invited email.)

## Edge / migration needs + GATE posture
- **Option A: none.** No Edge change, no migration. Client-only → **not a deploy** (web bundle redeploys via the normal app deploy, not the Supabase integration). Still runs GATE A → B → C.
- **Option B (only if pivoted): GATE-C.** Touches `supabase/functions/manage-room-invite/index.ts` + `inviteSchemas.ts` → merge auto-redeploys the registered Edge function → operator-gated merge-as-deploy.

## Doctrine ban-list / secret hygiene (design-level)
- All new user-facing copy (`INVITE_CREDENTIAL_COPY`) routes through the existing `inviteCopyDoctrine` ban-list scan; no verdict/truth/heat tokens; no internal codes (§9).
- Anon-key only (Option A); service-role only the one already in `manage-room-invite` (Option B), returning no JWT/token. No raw token/JWT/bearer/hash/password in any new response or log. Email-binding unchanged.

## GATE-A readiness verdict
**READY for GATE A.** The design is decision-complete (Option A chosen + Option B fully specified as the contingency), the decoupling mechanism is named and grounded in `config.toml:233` + the smoke evidence, no-enumeration + email-binding + secret hygiene are preserved, the file/test plan is concrete, the one load-bearing precondition (hosted confirmations) is surfaced as an explicit operator question with a built-in fallback, and the GATE-C posture is stated per option (A: client-only / not a deploy; B: merge-as-deploy). No production code was written; both deliverables are committed on the feature branch.
