# Branded Supabase invite email + controlled invite smoke (2026-06-13)

## Header

| Field | Value |
|---|---|
| Run | AUTH-INVITE-BRANDED-SMOKE-2026-06-13 — **first pass (inspect + implement, NO live send)** |
| HEAD SHA | `836edca` (`main == origin/main`, verified) |
| Branch | `feat/auth-branded-invite-smoke-2026-06-13` |
| Selected implementation path | **Brand via repo-managed Supabase invite template + `config.toml` activation; send via the existing audited `admin-users` `invite_user` Edge action (JWT-admin, no service-role)** |
| Supabase project ref | not read this run (not needed for a no-send pass; never printed regardless) |
| SMTP posture | **SUPABASE_DEFAULT_SMTP_LIMITED / UNKNOWN-for-hosted** — SMTP is commented out in `config.toml:244`; `email_sent = 2`/hour (`:206`). Hosted custom-SMTP status is Dashboard-only and was not read. Must be confirmed `custom` before any live Gmail-delivery send (§9). |
| Redirect URL (host/path) | recommended `https://dev-cdiscourse.netlify.app/auth/callback` (host allow-listed `config.toml:168`; path = `DEFAULT_AUTH_ROUTES.invite`, `buildAuthRedirectUrl.ts:50`). No token in the URL. |
| Seed email | `kyleruff+devtest99@gmail.com` (default; not sent this pass) |
| Flags armed this run | **none** — `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE`, `CDISCOURSE_ALLOW_INVITE_SEND_SMOKE`, `CDISCOURSE_ALLOW_INVITE_BATCH`, `CDISCOURSE_ALLOW_DOCS_AUTOMERGE`, `CDISCOURSE_INVITE_*` all absent |

> **Headline finding (read before arming a live send):** a branded invite email is buildable and correct, and the send seam already exists — but a **full account-creation smoke is BLOCKED** by an unbuilt `/auth/callback` consumer screen (gap **G1** below). The invite will *send*, *render*, *verify the token*, and *create the `auth.users` row*, but clicking the link lands on an **unhandled route**, so the invited (passwordless) user cannot set a password / sign in **in the app** yet. Arm `CDISCOURSE_ALLOW_INVITE_SEND_SMOKE` only with that scope understood.

---

## Architecture inventory (`file:line@836edca`)

| Concern | Live seam | Verdict |
|---|---|---|
| Account invite (send) | `supabase/functions/admin-users/index.ts:364-424` `handleInviteUser` → `auth.admin.inviteUserByEmail(email, { redirectTo })`. Deliberately chosen over generate-link "so the invite link/token never enters function memory… the email body stays entirely in the Supabase template" (`:369-373`). | **CHOSEN (send).** Audited (`writeAdminAudit`), admin-gated (`requireAdmin`), response carries no link/token/email (`adminInvitePayload.ts buildInviteResponse`). |
| Client invite wrapper | `src/features/admin/adminApi.ts:104-122` `adminInviteUser` → derives `redirectTo` from `buildAuthRedirectUrl({kind:'invite'})`, posts `action:'invite_user'`. | Reused as-is. |
| Email body (branding) | The Supabase "Invite user" template. Seam reserved (commented) at `config.toml:253-256` → `./supabase/templates/invite.html`. | **CHOSEN (brand).** Template did not exist; created this run + block activated. |
| Redirect builder | `src/lib/auth/buildAuthRedirectUrl.ts:18-23,:47-53` — first-class `'invite'` kind, `DEFAULT_AUTH_ROUTES.invite = '/auth/callback'`. Allow-list `config.toml:164-170`. | Correct; produces `<origin>/auth/callback`. |
| **Redirect CONSUMER** (`/auth/callback`) | **NONE shipped.** Grep for `auth/callback`/`getSessionFromUrl`/`exchangeCodeForSession`/`setSession`/`type=invite` finds only the URL *builder*; `supabase.ts:76` sets `detectSessionInUrl: false`; `QOL-023.md:265`: "a **future card** actually renders `/auth/callback`". | **GAP G1** — blocks in-app account-creation completion. |
| `admin-users` deploy | `config.toml:387-388` `[functions.admin-users] verify_jwt = true`. | Deployed; callable with an admin JWT (no service-role in the client). |
| SMTP | `config.toml:244` `# [auth.email.smtp]` (commented) + `:206` `email_sent = 2`/hour. | **GAP G2** — hosted SMTP unverified; default SMTP is rate-limited and unsuitable for arbitrary external delivery. |

**Rejected seams:** (a) a new local script using `SUPABASE_SERVICE_ROLE_KEY` — rejected; doctrine §6 keeps service-role inside Edge Functions only, and bot scripts establish the JWT pattern (`scripts/bot-fixtures/supabaseClient.js` uses the anon key). (b) `{{ .TokenHash }}` + a self-constructed confirm URL — rejected; that path *requires* the unbuilt `/auth/callback` consumer. (c) `manage-room-invite` (`supabase/functions/manage-room-invite`) — that is the QOL-038 **room-membership** token system, a different concept from account invites.

---

## Email design summary

- **File:** `supabase/templates/invite.html` (the Supabase "Invite user" body). HTML-only — the hosted invite template takes a single `content_path`; the in-body plain link is the fallback (there is no separate text-template key for invites).
- **Subject:** `You're invited to CDiscourse` (`config.toml`).
- **From name/address:** governed by the SMTP `sender_name`/`admin_email` (or Supabase default) — **not** set by this template; confirm in the Dashboard before send.
- **Brand elements:** `CDiscourse` wordmark header + footer; max-width 600px card; conservative table layout with inline CSS.
- **CTA:** `Accept invite` → `{{ .ConfirmationURL }}` (bulletproof button, 14px×28px padding = ~52px tap target).
- **Fallback:** visible "copy and paste this link" + the `{{ .ConfirmationURL }}` as text.
- **Variables used:** `{{ .ConfirmationURL }}` (CTA + fallback) and `{{ .Email }}` (safety note only). No `{{ .TokenHash }}`, no standalone `{{ .RedirectTo }}` link.
- **Doctrine:** no truth/verdict/winner/loser/accusation copy, no manipulative urgency, no raw internal codes (pinned by `__tests__/authBrandedInviteTemplate.test.ts`). Value prop names claim · source · quote · scope · next move.
- **Preview/testing method:** static structural + ban-list assertions (44 tests). Visual rendering across Gmail clients is an **operator step** (no rendered-email tooling in-session).

---

## Safety gates

| Gate | Status | Evidence |
|---|---|---|
| Secret hygiene (no value printed) | PASS | Script `fingerprint()` prints presence + length + 4-char fp only; `buildRedactedPlan` fingerprints creds; pinned by guard tests. No secret read this pass. |
| No service-role in client / script | PASS | Script source has no `SERVICE_ROLE`/`service_role`/`inviteUserByEmail(` (pinned). Send goes through the admin-JWT → Edge function. |
| No live send by default | PASS | Script defaults to `--dry-run`; live requires `--live` **and** `CDISCOURSE_ALLOW_INVITE_SEND_SMOKE=1`; batch requires `--range` **and** `CDISCOURSE_ALLOW_INVITE_BATCH=1`. |
| Redirect allow-list verification | PARTIAL | `validateRedirectTo` enforces allow-listed host + `/auth/callback`. The *callback consumer* itself is unbuilt (G1). |
| SMTP posture | UNVERIFIED | G2 — must be confirmed `custom` in the hosted Dashboard before live send; the script refuses `--smtp-posture unknown`. |
| Hosted template not auto-changed | PASS | Only repo files changed; the hosted "Invite user" template is a separate Dashboard/`supabase config push` action gated by `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE` (G3). |

---

## Test results

- `npm run typecheck` → **exit 0**.
- Full `npx jest --silent` → **747 suites / 30289 passed + 1 pre-existing skip / 0 failures** (baseline 745/30245 → **+2 suites / +44 tests**, nondecreasing).
- `npx eslint` on the new `.test.ts` files → **exit 0**. (`.html`/`.js`/`.toml` are outside the `--ext .ts,.tsx` lint scope, matching the bot-script convention; `node --check scripts/auth/sendInviteSmoke.js` → OK.)
- New suites: `__tests__/authBrandedInviteTemplate.test.ts` (brand/CTA/one-link/fallback/ban-list/a11y/config-activation) + `__tests__/authInviteSmokeScriptGuards.test.ts` (dry-run default, live/batch gating, target + redirect validation, range cap, secret redaction, no-service-role, audited-path-only).

---

## Live smoke

- **Dry-run result:** ran `node scripts/auth/sendInviteSmoke.js --dry-run --email kyleruff+devtest99@gmail.com` → `mode: dry_run`, `sendArmed: false`, `batchEnabled: false`, all credentials `present: false`, exit 0. No network, no credential read, no send.
- **Seed live send:** **NOT ATTEMPTED** — `CDISCOURSE_ALLOW_INVITE_SEND_SMOKE` is absent (operator's stated first pass = no live send).
- Receipt confirmed? **PENDING** · Rendering confirmed? **PENDING** · Account creation confirmed? **PENDING (blocked by G1 in-app; see below).**

## Batch decision

**Not attempted.** `CDISCOURSE_ALLOW_INVITE_BATCH` absent and seed not yet confirmed. Default batch (`kyleruff+devtest98@gmail.com`, `kyleruff+devtest97@gmail.com`) remains gated behind both the flag and operator confirmation of the seed.

---

## Gaps / preconditions before a live send

- **G1 — `/auth/callback` consumer is unbuilt (BLOCKER for full account creation).** `supabase.ts:76` `detectSessionInUrl:false` + no callback route + `QOL-023.md:265` ("a future card actually renders `/auth/callback`"). A live invite will deliver + render + verify + create the `auth.users` row, but the invited user cannot set a password / sign in **in the app** until a callback screen ships. *Recommended follow-up card:* `AUTH-CALLBACK-CONSUMER-001` — render `/auth/callback` (+ `/auth/reset`), establish the session from the URL, route a passwordless invited user to a set-password/onboarding step. **A seed smoke can still prove receipt + rendering + token-verify + auth.users row; it cannot prove in-app sign-in until G1 ships.**
- **G2 — SMTP posture unverified.** Confirm a custom SMTP provider is configured in the hosted Auth settings before expecting Gmail delivery; default Supabase SMTP is rate-limited (`email_sent = 2`/hr) and not for arbitrary external addresses.
- **G3 — hosted template sync.** Editing `config.toml` + the template file changes **local** `supabase start` only. To brand the **hosted** invite email, paste `supabase/templates/invite.html` into Dashboard → Authentication → Email Templates → "Invite user" (or `supabase config push` if your setup supports it) — gated by `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE`.
- **G4 — redirect origin confirmation.** `config.toml:155` names `dev-cdiscourse.netlify.app` while `buildAuthRedirectUrl.ts:65` `HOSTED_FALLBACK_ORIGIN = dev.cdiscourse.com`. Pass the **actual deployed origin** explicitly as `--redirect-to https://<origin>/auth/callback`; the script refuses any host not in the allow-list.

---

## Open operator actions

1. **Review + merge this PR** — it touches `supabase/**` (template + `config.toml`) → **GATE-C / operator-gated merge** (a `supabase/**` change; not autonomous). The branded template is the reviewable deliverable.
2. **Decide G1** — file/launch `AUTH-CALLBACK-CONSUMER-001` if you want end-to-end account creation; otherwise treat the seed smoke as receipt+render+verify only.
3. **Confirm G2/G3/G4** in the hosted Dashboard (custom SMTP; paste the template; confirm the deployed origin).
4. **Then, second pass (seed only):** arm `CDISCOURSE_ALLOW_INVITE_SEND_SMOKE=1` + `CDISCOURSE_INVITE_SEED_EMAIL` + `CDISCOURSE_INVITE_REDIRECT_TO`, set `CDISCOURSE_ADMIN_EMAIL`/`CDISCOURSE_ADMIN_PASSWORD` (admin user, env only), and run:
   `node scripts/auth/sendInviteSmoke.js --live --email kyleruff+devtest99@gmail.com --redirect-to https://<origin>/auth/callback --smtp-posture custom`
5. **Check the seed alias** (`kyleruff+devtest99@gmail.com`) inbox/spam/promotions: subject, From name/address, brand rendering, CTA, fallback link, mobile rendering, any spammy/unclear copy. Report whether to proceed to `devtest98`/`devtest97`.
6. **Batch only after** seed receipt is confirmed: arm `CDISCOURSE_ALLOW_INVITE_BATCH=1` and run `--live --range 98..97 …`.

---

## Appendix — commands run (read-only / build / gates)

- Baseline: `git status/rev-parse/fetch` (`main == origin/main` @ `836edca`); `npm run typecheck` (exit 0); `npx jest --silent` (745→747).
- Inventory greps over auth/invite/Supabase config (see Architecture inventory cites).
- New: `node scripts/auth/sendInviteSmoke.js --dry-run …` (dry-run only); `node --check` on the script; targeted + full Jest; eslint on new tests.
- **No** provider call, **no** Supabase write, **no** live send, **no** hosted config change, **no** secret read.
