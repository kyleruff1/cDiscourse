# EMAIL-TRANSPORT-001 — CDiscourse-owned transactional email transport + Supabase Auth Custom SMTP

**Status:** Design draft
**Epic:** Interaction / Room Visibility & Invite (`ARG-ROOM-VISIBILITY-INVITE` slate, transport residual)
**Release:** 6.7
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/635
**Branch:** `feat/EMAIL-TRANSPORT-001-email-transport`
**Baseline:** `origin/main @ e187c68`

**Governance:** this card runs under the *CDiscourse Pipeline Governance Contract v1*. The stage gates (§2), HALT conditions (§3), and the never-self-approve list (§4) are binding. This is a **design-only** card: no production code, no migration, no live email send, no hosted-config mutation. GATE A follows this doc.

---

## Goal

Stop CDiscourse emails from appearing as Supabase-branded / default-SMTP, and build a maintainable, swappable, CDiscourse-owned email system that serves **two lanes**: (A) Supabase Auth emails (invite, password reset, magic link, confirmation), delivered via a managed provider's **Custom SMTP** so Supabase stays the token owner; and (B) CDiscourse **product email** (ARG-ROOM invite emails for existing and new users), delivered via the managed provider's **HTTP API** from a shared Deno module inside Supabase Edge Functions.

This card is motivated directly by the ARG-ROOM-004 live smoke (2026-06-13): the new-user Auth-bridge email rides Supabase's built-in Auth email service, which is test-only, rate-limited (~3-4/hr), and Supabase-branded. Production invites need Custom SMTP + CDiscourse branding.

The design is shaped by these doctrine constraints, all of which the build must satisfy:
- **`cdiscourse-doctrine` §1** — no winner/loser/truth/verdict/accusation copy anywhere in email bodies; score/judgment never appears in a transactional email.
- **`cdiscourse-doctrine` §6 + `supabase-edge-contract` §1** — provider keys + service-role keys live only in Supabase secrets, never in client code, never in git, never in logs/docs/tests/PR/error payloads.
- **`supabase-edge-contract`** — product email is a privileged action; it runs server-side in an Edge Function via `fetch()` to the provider HTTP API. No nodemailer, no SMTP socket from Deno, no client send.
- **No account enumeration** — the inviter-facing response is byte-identical for an existing-vs-new invitee (this is already the live posture; the new transport must not break it).
- **Supabase owns Auth tokens** — Lane A never generates Auth links in app/client code; the provider only carries the bytes Supabase produced.

It is built so that turning email on is a sequence of explicit operator gates, and merging the code while every gate is OFF changes nothing for users (the registered Edge functions auto-deploy on merge but stay inert).

---

## Phase 0 inventory (what is already there — file:line)

The repo already has most of the transactional-email machinery. This card **standardizes and extends** it; it rebuilds nothing.

### Templates (Lane A)
- `supabase/templates/invite.html` — a fully branded CDiscourse "Invite user" Auth template (shipped under `AUTH-INVITE-BRANDED-SMOKE-2026-06-13`). It uses `{{ .ConfirmationURL }}` for the CTA + plain fallback link and `{{ .Email }}` in the safety note only. It contains **no visible "Supabase"**, no raw token, table layout + inline CSS, a ≥44px CTA, a preheader, and a plain fallback. It is the doctrine-required pattern for all Lane-A templates this card adds.
- No other templates exist under `supabase/templates/` (only `invite.html`). The other Auth flows (recovery / magic link / confirmation / email-change) currently fall back to the Supabase default (un-branded) templates.

### Auth + template registration (config.toml)
- `[auth]` (`config.toml`:150-192) — `site_url = http://localhost:8081` (local dev), `additional_redirect_urls` allow-list (`:164-170`) covers `localhost:8081`, `dev-cdiscourse.netlify.app`, and the Netlify preview wildcard. **Hosted Site URL + redirect list are set per-environment in the Dashboard, not from this file.**
- `[auth.rate_limit] email_sent = 2` (`:206`) — the LOCAL dev cap. The hosted built-in Auth email cap (~3-4/hr) is the production motivation for Custom SMTP.
- `[auth.email]` (`:226-241`) — `enable_confirmations = false`, `otp_*` settings. No confirmation email is sent today.
- `[auth.email.smtp]` (`:244-251`) — **commented out** (a SendGrid example skeleton). Custom SMTP is NOT configured in this file. Lane A's SMTP wiring is a **hosted Dashboard action** (or a gated Management-API patch), not a `config.toml` edit, because the SMTP password is a secret.
- `[auth.email.template.invite]` (`:259-261`) — `subject = "You're invited to CDiscourse"`, `content_path = "./supabase/templates/invite.html"`. Local dev reads this; the **hosted** template is a separate `supabase config push` / Dashboard action, operator-gated by `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE` (per the file's own comment `:253-258`).

### Registered Edge functions (deploy-bearing on merge to main)
The Supabase GitHub integration auto-applies migrations and redeploys functions registered in `config.toml` `[functions.*]`. The functions this card touches are all registered:
- `[functions.room-notifications]` (`:437-438`, `verify_jwt = true`) — **the email-send seam**.
- `[functions.create-argument-room]` (`:460-461`, `verify_jwt = true`) — mints the invite + returns the create-time `inviteLink`.
- `[functions.manage-room-invite]` (`:427-428`, `verify_jwt = false`) — owns create/revoke/list/lookup/accept.
- `[functions.admin-users]` (`:392-393`, `verify_jwt = true`) — `invite_user` → `inviteUserByEmail` (Auth invite).
- `[functions.request-argument-deletion]` (`:410-411`) and `[functions.cutover-health-monitor]` (`:504-505`) — both already call Resend via `fetch()` (the precedent pattern).

### The current invite + email-trigger flow + gates
- `supabase/functions/room-notifications/index.ts` `handleInvite` (`:413-548`) is the email-send seam. It branches **server-side** (invisible to the inviter):
  - **EXISTING-user** → in-app bell row (`insertRows`) + `maybeSendInviteEmail(...)` via Resend, gated by `INVITE_EMAIL_ENABLED` (`:189-191`, default OFF), `RESEND_API_KEY`, `INVITE_EMAIL_FROM` (`:330-344`). POSTs to `https://api.resend.com/emails` (`:374`).
  - **NEW-user** → `supabase.auth.admin.inviteUserByEmail(email, { redirectTo: <origin>/auth/callback?invite=<token> })`, gated by `INVITE_AUTH_BRIDGE_ENABLED` (`:199-201`, default OFF). The new-user branch ONLY sends when `redirectTo` is non-null, i.e. a valid raw token is present (`buildBridgeRedirect`, `:252-256`).
  - The inviter-facing `notification` status is **gate-posture-based and branch-independent** (`resolveInviteNotificationStatus`, `:212-214`): `'queued'` if **any** gate is armed, `'not_configured'` if both are off. This is intentional — it prevents existing-vs-new enumeration.
- `supabase/functions/create-argument-room/index.ts` mints the raw token in Deno (`generateInviteToken`, `:150`), stores only the hash, and returns a create-time `inviteLink` = `<origin>/invite/<rawToken>` to the creator once (`:192-211`).
- `supabase/functions/manage-room-invite/index.ts` `handleAccept` enforces **email-binding** (`callerEmail === invite.invitee_email_lower` → else `403 invite_email_mismatch`, `:595-596`).
- `supabase/functions/admin-users/index.ts` `handleInviteUser` (`:364-424`) uses `inviteUserByEmail` so the invite link/token never enters function memory — the Supabase template is the source of truth.

### Shared Edge conventions to mirror
- `supabase/functions/_shared/http.ts` — `corsHeaders`, `ok/badRequest/unauthorized/forbidden/methodNotAllowed/validationFailed/internalError`. Stable error shape `{ error, detail }`.
- `supabase/functions/_shared/supabaseClients.ts` — `createCallerClient(authHeader)` (RLS-scoped) + `createServiceClient()` (service-role). Imports `npm:@supabase/supabase-js@2`.
- `supabase/functions/_shared/inviteToken.ts` / `inviteTokenShape.ts` — token gen/hash + `INVITE_TOKEN_MIN_LENGTH=32` / `MAX_LENGTH=64`.
- `supabase/functions/_shared/inviteSchemas.ts` — `npm:zod@4` discriminated-union request schema pattern (the Deno-only import; mirrored dependency-free in `src/features/invites/inviteSchemasMirror.ts` for Jest).

### The Resend precedent (already in production)
`RESEND_API_KEY` is **already used** in 3 Edge functions, all sharing the same `maybeSend*` pattern (gate → `fetch('https://api.resend.com/emails')` with `authorization: Bearer ${apiKey}` built in-place → drain body without echoing → never log key/body/recipient):
- `room-notifications` `maybeSendInviteEmail` (`:322-409`) — env `INVITE_EMAIL_ENABLED` + `RESEND_API_KEY` + `INVITE_EMAIL_FROM`.
- `request-argument-deletion` `maybeSendAdminNotification` (`:157+`) — env `RESEND_API_KEY` + `ADMIN_NOTIFICATION_FROM`.
- `cutover-health-monitor` `maybeSendAlertEmail` (`:183+`) — env `RESEND_API_KEY` + `ADMIN_NOTIFICATION_FROM`.

`RESEND_API_KEY` is set as a hosted secret on the linked project (`qsciikhztvzzohssddrq`). Confirmed **presence only, never values**: no live email-send flag is armed in any committed file — the tracked env files are only `.env.example`, `.env.bot-tests.example`, `.env.engagement-intelligence.example` (the real `.env*` are gitignored), and `.env.example` carries no `CDISCOURSE_EMAIL_*` / `INVITE_EMAIL_ENABLED` / SMTP keys. `INVITE_EMAIL_ENABLED` and `INVITE_AUTH_BRIDGE_ENABLED` default OFF in code.

### Operator smoke discipline to preserve
`scripts/auth/sendInviteSmoke.js` — dry-run default, present+length-only `fingerprint` diagnostics (no value fragment, `:60-65`), `/auth/callback` redirect allow-list (`validateRedirectTo`, `:101-123`), live path authenticates as an admin **user** (JWT) and invokes the audited `admin-users` Edge action with **no service-role in the script** (`:312-353`), `kyleruff+devtestNN@gmail.com` seed-shape gate, hard batch cap of 5. EMAIL-TRANSPORT-001's smoke must inherit this redaction/fingerprint/arming discipline exactly.

---

## Architecture decision: managed provider, not self-hosted SMTP

**Decision: a managed transactional email provider, accessed two ways, default Resend, swappable behind a small interface; Postmark is the documented alternative. We do NOT run a self-hosted SMTP daemon.**

### Why managed, not self-hosted

| Dimension | Self-hosted SMTP daemon (Postfix/etc.) | Managed provider (Resend/Postmark) |
|---|---|---|
| Deliverability | We own IP warmup, reputation, bounce/complaint loops, blocklist remediation | Provider owns shared/dedicated IP reputation, FBL handling, suppression lists |
| Auth-domain proof | We configure + rotate SPF/DKIM/DMARC by hand on our own MTA | Provider gives a verified sending domain + DKIM key to add as one DNS record set |
| Operational surface | A long-running daemon to patch, monitor, secure (open-relay risk), and host | No daemon — HTTP API + SMTP relay endpoint; nothing for us to run |
| Edge compatibility | Deno Edge functions cannot open arbitrary SMTP sockets cleanly; product email would need a separate always-on host | Product email is a plain `fetch()` to an HTTPS endpoint from the existing Edge runtime |
| Doctrine fit | Adds infrastructure to host (Epic 10 spike territory) + a new secret/credential surface | Reuses the shipped Resend `fetch()` pattern; one provider key as a hosted secret |

A self-hosted daemon is rejected: it adds an always-on host to operate, multiplies the deliverability + security burden (open-relay, IP reputation), and **cannot be reached cleanly from Deno Edge `fetch()`** for the product lane. The card's hard constraint forbids it.

### Why Resend default

- It serves **both** lanes from one account: a **Custom SMTP relay** for Supabase Auth (Lane A) and an **HTTP API** (`POST https://api.resend.com/emails`) for product email (Lane B).
- It is **already wired** in three Edge functions with a battle-tested redaction pattern — Lane B is a refactor + extension of existing code, not a new dependency.
- The hosted `RESEND_API_KEY` secret already exists on the linked project.

### Why Postmark documented alternative (swap path)

The provider is behind a `EmailProvider` interface (below). Postmark also offers Custom SMTP for Auth + an HTTP API (`POST https://api.postmarkapp.com/email`) with a server token (`POSTMARK_SERVER_TOKEN` header `X-Postmark-Server-Token`). Swapping providers is: (1) set `CDISCOURSE_EMAIL_PROVIDER=postmark` + the Postmark secret, (2) point Supabase Custom SMTP at Postmark's relay, (3) re-run DNS verification for Postmark. No call-site change in product code — only the provider module the factory selects.

### Why Supabase Edge over a Netlify function

Lane B is a privileged action (it reads the invitee row + raw token, both server-only) that already lives in `room-notifications` / `manage-room-invite`. The provider HTTP API is reachable from Deno Edge via `fetch()` (proven by the 3 existing functions). A Netlify function would (a) duplicate the service-role + token-handling boundary outside Supabase, (b) need its own secret surface, and (c) add a second deploy target for no capability gain. **Edge satisfies the provider API; Netlify is not used.** (The card's escape hatch — "if Netlify is ever proposed, prove Edge cannot satisfy the provider API and use Netlify secret env only" — is not triggered: Edge demonstrably satisfies it.)

---

## The two lanes

### Lane A — Supabase Auth (Custom SMTP, Supabase owns the token)

- **Mechanism:** Supabase Auth sends invite / password-reset / magic-link / confirmation / email-change emails. We enable **Custom SMTP** in the hosted project (Dashboard → Authentication → Emails/SMTP, or the gated Management-API patch) pointed at the provider's SMTP relay using provider credentials.
- **Sender identity:** sender name `CDiscourse`; sender address `no-reply@mail.cdiscourse.com` (default) or `invites@mail.cdiscourse.com`; **reply-to** `support@cdiscourse.com` (operator-approved).
- **Token ownership:** Supabase generates every Auth link/token. The provider only carries the rendered bytes. **No Auth link is ever generated in `app/` or `src/`.** This card does not change that — `inviteUserByEmail` (admin-users, room-notifications new-user branch) stays the seam.
- **Templates:** Auth templates live in `supabase/templates/` and use ONLY Supabase template variables:
  - `{{ .ConfirmationURL }}` — the CTA + plain-fallback link (the only link variable; never construct a link by hand).
  - `{{ .RedirectTo }}` — only where a redirect echo is appropriate (rarely; the room invite bridge rides inside `{{ .ConfirmationURL }}`'s query, so this is usually unused).
  - `{{ .Email }}` — safety copy only ("This was sent to {{ .Email }}").
  - `{{ .Data.* }}` — only sanitized, non-secret metadata (e.g. `{{ .Data.display_name }}` already passed by `inviteUserByEmail`). Never a token, never a secret.
  - `invite.html` already conforms. This card **adds branded templates for the other Auth flows** (recovery / magic-link / confirmation / email-change) following the same pattern, and registers them in `config.toml` `[auth.email.template.*]` for local dev. Hosted template push stays operator-gated by `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE` (existing posture).
- **Hosted config push:** a separate, operator-gated action (Dashboard or the runbook's gated Management-API path). Editing `config.toml` does NOT change the hosted templates or SMTP.

### Lane B — CDiscourse product email (provider HTTP API from Edge)

- **Mechanism:** a shared Deno module under `supabase/functions/_shared/email/` that the ARG-ROOM invite flow calls. Provider HTTP API via `fetch()` only — **no nodemailer, no SMTP from Edge or client**.
- **Caller:** `room-notifications` `handleInvite` (existing-user branch) is the first consumer; the module subsumes the existing `maybeSendInviteEmail` so the two cannot drift. (`manage-room-invite`'s create-time branch, per ARG-ROOM-004, can also call it once that card lands; this card provides the module either way.)
- **Copy (CDiscourse-branded, ban-list clean):** brand "CDiscourse"; "You've been invited to an argument"; a plain-language public/private indicator; "Private rooms are 1v1 by invitation."; "Public rooms allow up to 5 active participants; observers are uncapped."; CTA "Open invitation" → an **app-controlled redemption route** (`<origin>/invite/<token>` — the shipped path the `InviteRedeemGate` consumes, NOT a raw provider token); "If you weren't expecting this, ignore it."
- **What the body NEVER contains:** the raw token in plain text outside the CTA href, internal validation codes, failure reasons, verdict framing, or any of the doctrine ban-list tokens.
- **No-enumeration:** the client-visible result shape is identical for existing vs new addresses (the existing/new decision stays server-side; the inviter-facing `notification` status stays gate-posture-based).

---

## Data model

**No new data model. No migration. No new table or column.**

- Lane A uses Supabase Auth's own tables (untouched) + `supabase/templates/*.html` (files, not DB).
- Lane B reuses `argument_room_invites` (QOL-038) and `debate_participants`. The raw token already persists only as a hash; the raw value travels server-side from create-time into the transport, exactly as ARG-ROOM-004 established.
- No RLS change. No table is created, altered, or has RLS disabled.

The only new persistent artifacts are **TypeScript modules**, **HTML templates**, and **gating env/secrets** (server-side only).

---

## File changes

### New files (production)

- `supabase/functions/_shared/email/emailProvider.ts` (~70-110 lines) — the provider-agnostic interface + factory.
  - `interface EmailProvider { send(message: TransactionalEmailMessage): Promise<EmailSendResult>; readonly id: EmailProviderId; }`
  - `function getEmailProvider(): EmailProvider | null` — reads `CDISCOURSE_EMAIL_PROVIDER` (default `'resend'`), returns the concrete provider when its key is present, else `null` (→ `not_configured`, no send).
- `supabase/functions/_shared/email/resendProvider.ts` (~80-120 lines) — the Resend `EmailProvider` implementation. `POST https://api.resend.com/emails`, `authorization: Bearer ${apiKey}` built in-place, body drained without echo, never logs key/body/recipient. (Lifts + generalizes the shipped `room-notifications` `maybeSendInviteEmail` fetch block.)
- `supabase/functions/_shared/email/emailTemplates.ts` (~120-180 lines) — pure render functions producing `{ subject, html, text }`. First export: `renderArgumentRoomInviteEmail(input)`. HTML + plain-text fallback, mobile-safe inline CSS, CDiscourse sender identity copy. **No I/O, no env, no fetch** — pure, so it is unit-testable for ban-list + structure.
- `supabase/functions/_shared/email/emailSchemas.ts` (~60-100 lines) — `npm:zod@4` validators for the module inputs (mirrors `inviteSchemas.ts`); a dependency-free mirror lives in `src/features/email/emailSchemasMirror.ts` so Jest can import it (the Deno `npm:zod@4` import cannot load in Jest, per the existing `inviteSchemasMirror` precedent).
- `supabase/functions/_shared/email/safety.ts` (~80-140 lines) — pure sanitizers + the doctrine ban-list scan: `sanitizeLine(s)` (strip HTML/control chars, clamp length — lifts `safeLine`), `assertNoBannedTokens(text)`, `sanitizeRoomContext(input)`. Used by both render + provider layers as a defense-in-depth gate before any send.
- `supabase/functions/_shared/email/sendTransactionalEmail.ts` (~70-110 lines) — the orchestrator: `sendTransactionalEmail(input): Promise<EmailSendResult>`. Resolves the master gate → resolves the provider → renders via templates → runs the safety scan → calls `provider.send`. Returns the audit-safe result. This is the single seam the Edge functions call.

### New files (mirrors + types for Jest)

- `src/features/email/emailSchemasMirror.ts` (~50-80 lines) — dependency-free mirror of `emailSchemas.ts` shapes, imported by tests (mirrors the `inviteSchemasMirror` pattern). **Not** wired into the client runtime; it is types/validators only and makes no network call.

### New files (Lane A templates)

- `supabase/templates/recovery.html`, `supabase/templates/magic_link.html`, `supabase/templates/confirmation.html`, `supabase/templates/email_change.html` (~120-150 lines each) — branded CDiscourse Auth templates mirroring `invite.html` (brand, `{{ .ConfirmationURL }}` CTA + plain fallback, `{{ .Email }}` safety copy only, ≥44px target, no visible "Supabase", ban-list clean). **Scope decision below** may defer the non-invite templates to a follow-up; minimum for this card is the design + the runbook checklist, with the templates themselves an explicit operator-gated build.

### Modified files (production)

- `supabase/functions/room-notifications/index.ts` (~-50 / +20 net) — replace the inline `maybeSendInviteEmail` body with a call to `sendTransactionalEmail(...)` from the shared module. The existing-user branch, the gate posture (`resolveInviteNotificationStatus`), and the branch-independent response are **preserved byte-for-behavior**. `INVITE_EMAIL_ENABLED` is reconciled into the master gate (below).
- `supabase/config.toml` (~+12 lines) — register the new Lane-A templates under `[auth.email.template.recovery|magic_link|confirmation|email_change]` (local-dev only; hosted push stays gated). Add a documenting comment block for the master email gate. The commented `[auth.email.smtp]` block gets a CDiscourse-specific comment pointing at the runbook (still commented — SMTP is a hosted action, not a file edit). **No function registration change** (room-notifications already registered).

### Modified files (smoke)

- `scripts/auth/sendInviteSmoke.js` (~+40 lines) — extend the dry plan to assert the Lane-B transactional path (gate OFF → `not_configured`, no network) and the master-gate posture, preserving the fingerprint/redaction/arming discipline. **No new send capability** beyond the existing armed-flag gates.

### New files (docs)

- `docs/designs/EMAIL-TRANSPORT-001.md` (this file).
- `docs/runbooks/email-provider-setup.md` — operator runbook (DNS, Dashboard, gated Management-API, secret-set commands, live-smoke runbook).
- `docs/testing-runs/2026-06-13-email-transport-design.md` — design-phase record.

### Deleted files

None.

---

## API / interface contracts

All types are JSON-serializable and live in the Deno module (mirrored for Jest where needed). No secret ever appears in any of these shapes.

```ts
// emailProvider.ts
export type EmailProviderId = 'resend' | 'postmark';

export interface TransactionalEmailMessage {
  to: string;              // single recipient (validated email); product lane sends one at a time
  from: string;            // CDISCOURSE_EMAIL_FROM, e.g. "CDiscourse <invites@mail.cdiscourse.com>"
  replyTo?: string;        // CDISCOURSE_EMAIL_REPLY_TO, e.g. "support@cdiscourse.com"
  subject: string;
  html: string;
  text: string;            // plain-text fallback (required — never HTML-only)
  // NO token field, NO secret field, NO internal-code field by construction.
}

export interface EmailSendResult {
  // Audit-safe: carries NO recipient, NO provider id string, NO body, NO key.
  status: 'sent' | 'not_configured' | 'failed_sanitized' | 'skipped_gate_off' | 'blocked_banned_copy';
  providerStatusClass?: 'ok' | 'provider_4xx' | 'provider_5xx' | 'network_error'; // class only, never the body
}

export interface EmailProvider {
  readonly id: EmailProviderId;
  send(message: TransactionalEmailMessage): Promise<EmailSendResult>;
}

export function getEmailProvider(env?: Record<string, string | undefined>): EmailProvider | null;
```

```ts
// emailTemplates.ts  (PURE — no env, no fetch, no I/O)
export interface ArgumentRoomInviteEmailInput {
  roomTitle: string;                  // sanitized room context; clamped + HTML-stripped before use
  roomVisibility: 'public' | 'private';
  inviterDisplayName?: string | null; // optional, sanitized; absent => neutral "Someone"
  redemptionUrl: string;              // app-controlled route, e.g. `${origin}/invite/${token}`
  // NOTE: the token appears ONLY inside redemptionUrl's href, never as a standalone field.
}

export interface RenderedEmail { subject: string; html: string; text: string; }

export function renderArgumentRoomInviteEmail(input: ArgumentRoomInviteEmailInput): RenderedEmail;
```

```ts
// sendTransactionalEmail.ts  (the single Edge-facing seam)
export interface SendTransactionalEmailInput {
  to: string;
  rendered: RenderedEmail;            // produced by an emailTemplates render fn
  // from / replyTo are resolved from env inside the orchestrator, not passed by the caller.
}

export function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<EmailSendResult>;
```

**Gate resolution (inside `sendTransactionalEmail` / `getEmailProvider`):**

```
masterEnabled  = env.CDISCOURSE_EMAIL_TRANSPORT_ENABLED === 'true'
if (!masterEnabled)                          -> { status: 'skipped_gate_off' }   (NO network)
provider       = getEmailProvider(env)        // null when key/from missing
if (!provider || !env.CDISCOURSE_EMAIL_FROM) -> { status: 'not_configured' }     (NO network)
if (!assertNoBannedTokens(rendered))         -> { status: 'blocked_banned_copy' } (NO network)
result         = await provider.send(...)     // fetch(); never logs key/body/recipient
```

**Resend provider request (the only network call):**
```
POST https://api.resend.com/emails
headers: { 'content-type': 'application/json', authorization: `Bearer ${RESEND_API_KEY}` }  // key built in-place
body:    { from, to: [to], reply_to, subject, html, text }
```
(Postmark alternative, documented only: `POST https://api.postmarkapp.com/email`, header `X-Postmark-Server-Token: ${POSTMARK_SERVER_TOKEN}`, body `{ From, To, ReplyTo, Subject, HtmlBody, TextBody, MessageStream }`.)

---

## Gating model (precise)

Three layers, all server-side, all default-safe. **Merging this card with every gate at its default value sends no email and mutates no hosted config.**

### 1. Master runtime gate (new)
- `CDISCOURSE_EMAIL_TRANSPORT_ENABLED` — default `false`. When `false`, `sendTransactionalEmail` returns `skipped_gate_off` with **no network call** and `getEmailProvider` is never reached. This is the single switch the operator flips to bring product email live after DNS + SMTP + a passing seed smoke.

### 2. Provider configuration secrets (server-side only)
- `CDISCOURSE_EMAIL_PROVIDER` — `resend` (default) | `postmark`.
- `RESEND_API_KEY` (or `POSTMARK_SERVER_TOKEN`) — the provider key. Already a hosted secret for Resend.
- `CDISCOURSE_EMAIL_FROM` — e.g. `CDiscourse <invites@mail.cdiscourse.com>`.
- `CDISCOURSE_EMAIL_REPLY_TO` — e.g. `support@cdiscourse.com`.
- Missing key or `FROM` → `not_configured` (no send), even if the master gate is on.

### 3. Live-smoke arming (operator, one-shot)
- `CDISCOURSE_ALLOW_EMAIL_TRANSPORT_SMOKE=1` **and** `CDISCOURSE_EMAIL_SMOKE_TARGET=<one dev alias>` are both required for the smoke script to attempt a single live send.
- **Batch is forbidden until the single-target seed smoke passes** (the smoke script refuses a batch without a separate `CDISCOURSE_ALLOW_EMAIL_TRANSPORT_BATCH=1` that the operator only sets after the seed succeeds), reusing the `sendInviteSmoke.js` `MAX_BATCH`/arming discipline.

### How this reconciles with the existing gates (do NOT silently break them)

The two existing gates stay valid; the master gate **wraps** them so they cannot send while it is OFF:

- `INVITE_EMAIL_ENABLED` (existing-user Resend product email) — **becomes subordinate to** `CDISCOURSE_EMAIL_TRANSPORT_ENABLED`. The product lane's effective send predicate is `CDISCOURSE_EMAIL_TRANSPORT_ENABLED === 'true' && INVITE_EMAIL_ENABLED === 'true'` (both must be on). Reading: the master gate is the lane-wide kill switch; `INVITE_EMAIL_ENABLED` remains the per-feature (room-invite) switch. This preserves the existing operator mental model and means flipping the master OFF instantly disables the existing-user email even if `INVITE_EMAIL_ENABLED` is still on. **The existing-user email keeps working exactly as before once both are on.**
  - *Migration note for the operator:* after this card deploys, to keep existing-user invite email behaving as it does today, set **both** `CDISCOURSE_EMAIL_TRANSPORT_ENABLED=true` and `INVITE_EMAIL_ENABLED=true`. If only `INVITE_EMAIL_ENABLED` is set (the pre-card state), the master gate (default OFF) now holds the send. This is a deliberate, documented behavior change in the gate composition, surfaced here and in the runbook so it is not a silent break.
- `INVITE_AUTH_BRIDGE_ENABLED` (new-user Supabase Auth invite) — **Lane A, NOT Lane B.** It governs `inviteUserByEmail`, which sends via Supabase Auth's SMTP (built-in OR Custom SMTP once Lane A is configured), not via the product `EmailProvider`. It therefore stays an **independent** gate and is **not** subsumed by `CDISCOURSE_EMAIL_TRANSPORT_ENABLED` — the product-email master switch must not accidentally govern the Auth bridge. Lane A's branding is controlled by the SMTP/template config, not by the product gate. The branch-independent `notification` status (`resolveInviteNotificationStatus`) is updated to read the **effective** posture: armed if `INVITE_AUTH_BRIDGE_ENABLED` (Lane A) OR (`CDISCOURSE_EMAIL_TRANSPORT_ENABLED && INVITE_EMAIL_ENABLED`) (Lane B) — preserving no-enumeration across both lanes.
- `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE` (existing, hosted-template push gate) and the new `CDISCOURSE_ALLOW_SUPABASE_AUTH_SMTP_UPDATE` (runbook's Management-API SMTP patch gate) are operator-only hosted-mutation gates — design-only here; never set by Claude.

**Secrets policy (restated):** no provider key, service-role key, or SMTP password in client (`app/`, `src/`), git, docs, tests, logs, PR bodies, or error payloads. Provider key + SMTP password live only in Supabase secrets (Edge) / the hosted SMTP config. The mirrors in `src/features/email/` are types/validators only and read no secret.

---

## Edge cases

- **Master gate OFF (default):** `skipped_gate_off`, no network, no provider read. The most common state; merge lands here.
- **Master ON but provider key/FROM missing:** `not_configured`, no network. The operator armed the lane before setting secrets.
- **Provider 4xx (bad domain, unverified sender):** `provider.send` returns `{ status: 'failed_sanitized', providerStatusClass: 'provider_4xx' }`; body drained without echo; the in-app bell already landed; the inviter's copyable link still works. The user action is never blocked.
- **Provider 5xx / network error:** `{ status: 'failed_sanitized', providerStatusClass: 'provider_5xx' | 'network_error' }`; same non-blocking posture; operator reconciles later.
- **Banned copy slips into a template:** `assertNoBannedTokens` returns false → `blocked_banned_copy`, **no send** (defense-in-depth on top of the template ban-list test).
- **Empty / whitespace recipient or room title:** sanitizer clamps; an empty recipient → `not_configured` (no send); an empty room title falls back to neutral "an argument" (mirrors the shipped `maybeSendInviteEmail`).
- **HTML / control chars in room title or inviter name:** stripped by `sanitizeLine` before render; the template never interpolates raw user text.
- **Concurrent invites to the same address:** idempotent at the DB layer (existing unique indexes); the email is best-effort and a duplicate send is at worst a duplicate inbox item, never a data error.
- **Auth email rate limit (Lane A, built-in SMTP):** the very motivation for Custom SMTP. Until Lane A's Custom SMTP is configured, `inviteUserByEmail` rides the ~3-4/hr built-in cap; the create path mints the row + link regardless, so a rate-limited Auth email never blocks acceptance (the copyable link is the fallback). Custom SMTP removes the cap.
- **No-enumeration under partial arming:** if only one lane's gate is armed, `resolveInviteNotificationStatus` still returns a single posture-based value across both branches — the inviter cannot infer existing-vs-new.
- **Provider swap mid-flight:** changing `CDISCOURSE_EMAIL_PROVIDER` selects a different module at the next call; in-flight sends are unaffected (each call resolves the provider fresh). Lane A SMTP must be repointed separately (runbook).
- **Doctrine edge — "heat / popularity in an email":** an invite email never references room heat, engagement, vote counts, or any standing — only the neutral public/private capacity facts. Heat/popularity never enter transactional copy.

---

## Test plan (the 12 test classes the card lists)

All tests run under the shipped Jest harness against the Deno modules' Jest-importable mirrors and the pure render/safety functions; **no live network, no live send.** Test file paths:

1. `__tests__/emailProviderFactory.test.ts` — `getEmailProvider`: returns Resend when `CDISCOURSE_EMAIL_PROVIDER` unset/`resend` + key present; returns Postmark when `postmark` + token present; returns `null` when key missing; never reads `.env` files.
2. `__tests__/emailMasterGate.test.ts` — master gate OFF → `skipped_gate_off`, zero fetch; master ON + key missing → `not_configured`, zero fetch; master ON + key present → reaches provider (mocked).
3. `__tests__/emailGateReconciliation.test.ts` — product lane sends only when `CDISCOURSE_EMAIL_TRANSPORT_ENABLED && INVITE_EMAIL_ENABLED`; `INVITE_AUTH_BRIDGE_ENABLED` is NOT governed by the master gate; `resolveInviteNotificationStatus` posture covers both lanes; no-enumeration holds under every gate combination.
4. `__tests__/renderArgumentRoomInviteEmail.test.ts` — happy path: subject + html + text present; CTA href is the redemption route; public/private indicator + capacity copy present; inviter-name optional path; empty room title → neutral fallback.
5. `__tests__/emailCopyDoctrine.test.ts` — ban-list scan of every rendered string (`winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist/stupid/idiot/truth/verdict/correct/incorrect/untrue` + `challenger/opponent` per invite doctrine); no internal validation codes; no raw `token`/JWT/bearer/hash literal in the body outside the CTA href.
6. `__tests__/emailNoTokenLeak.test.ts` — the rendered body + the `TransactionalEmailMessage` + the `EmailSendResult` carry no standalone token, no secret, no recipient in the result; the token appears only inside `redemptionUrl`.
7. `__tests__/emailSafetySanitizers.test.ts` — `sanitizeLine` strips HTML/control chars + clamps; `assertNoBannedTokens` true/false cases; `sanitizeRoomContext` neutralizes hostile input.
8. `__tests__/resendProviderRequest.test.ts` — (mocked fetch) Resend request shape: URL, `authorization: Bearer` header built in-place, body `{ from, to:[...], reply_to, subject, html, text }`; non-2xx → `failed_sanitized` + `provider_4xx/5xx` class, body drained not echoed; thrown fetch → `network_error`.
9. `__tests__/emailNoLogLeak.test.ts` (source-scan, mirrors `cutoverHealthMonitorSourceScan` + `authInviteSmokeScriptGuards`) — no `console.log`/`console.error` line in `_shared/email/*` emits `RESEND_API_KEY`/`POSTMARK_SERVER_TOKEN`/`Authorization`/`Bearer`/recipient/body; no `nodemailer` import; no SMTP socket; the only network host is `api.resend.com` (or the documented Postmark host).
10. `__tests__/roomNotificationsEmailRefactor.test.ts` — `room-notifications` existing-user branch now calls the shared `sendTransactionalEmail`; gate OFF → `not_configured`/`skipped_gate_off`, no network; the branch-independent response shape is byte-identical existing-vs-new (no-enumeration preserved).
11. `__tests__/emailSchemasMirror.test.ts` — the Jest mirror's validators match the Deno `emailSchemas.ts` shapes (byte-equal field/regex contract, mirroring `inviteSchemasMirror.test.ts`).
12. `__tests__/authTemplatesBranding.test.ts` (extends `authBrandedInviteTemplate.test.ts`) — every `supabase/templates/*.html` Auth template: names CDiscourse, contains no visible "Supabase", uses only allowed Supabase variables (`{{ .ConfirmationURL }}` / `{{ .Email }}` / `{{ .RedirectTo }}` / `{{ .Data.* }}`), ban-list clean, ≥44px CTA, HTML + plain fallback; `config.toml` registers each template's `content_path`.

Plus the existing-suite regression: `sendInviteSmoke` guard tests extended to cover the new dry assertions (`scripts/auth/sendInviteSmoke.js` → `__tests__/authInviteSmokeScriptGuards.test.ts` or a sibling `emailTransportSmokeGuards.test.js`).

---

## Dependencies (cards / docs / files)

- **Assumes ARG-ROOM-004's create-time invite seam exists** (it does — `room-notifications` `handleInvite` + `create-argument-room` `inviteLink`). This card standardizes that send path; it does not require ARG-ROOM-004's `manage-room-invite` create-branch to be merged, but composes cleanly with it.
- **Reads existing `room-notifications` `maybeSendInviteEmail`** (`:322-409`) as the lift source for `resendProvider.ts` + `emailTemplates.ts`.
- **Reads `request-argument-deletion` `maybeSendAdminNotification`** + `cutover-health-monitor` `maybeSendAlertEmail` as the redaction/gate precedent. (Out of scope to refactor those onto the new module in this card — see Out of scope — but they are documented as future consolidation targets.)
- **Reads `scripts/auth/sendInviteSmoke.js`** for the smoke discipline to inherit.
- **Reuses `supabase/templates/invite.html`** as the Lane-A template pattern.
- **Blocks** any future "fully on, production invite email" operational card until DNS + Custom SMTP + a passing seed smoke (this card is the prerequisite scaffold).

---

## Risks

- **Gate-composition behavior change.** Subsuming `INVITE_EMAIL_ENABLED` under the master gate means an operator who had `INVITE_EMAIL_ENABLED=true` pre-card now needs **both** gates on. Mitigation: documented loudly here + in the runbook; the default-OFF master gate means merge is inert and the operator opts in deliberately.
- **DNS / deliverability is operator-owned and out of code's control.** SPF/DKIM/DMARC misconfiguration → spam folder or rejection. Mitigation: the runbook's DNS checklist + a single-target seed smoke before any batch.
- **Hosted Custom SMTP vs `config.toml`.** Editing `config.toml`'s `[auth.email.smtp]` does NOT change the hosted project; the SMTP password is a secret that must go through the Dashboard or the gated Management-API path. A reviewer/operator could mistake the file edit for the live change. Mitigation: explicit runbook framing + the commented-only `[auth.email.smtp]` block.
- **Management-API overwrite hazard.** A naive Auth-config PATCH can clobber unrelated settings (Site URL, redirect allow-list). Mitigation: the runbook's read-current → patch-intended-fields-only → read-back procedure, gated by `CDISCOURSE_ALLOW_SUPABASE_AUTH_SMTP_UPDATE=1` + `SUPABASE_ACCESS_TOKEN`.
- **Deno `npm:zod@4` cannot load in Jest.** Mitigation: the `emailSchemasMirror.ts` dependency-free mirror (proven by `inviteSchemasMirror`).
- **Existing tests touching `room-notifications` email** (`roomNotifications.email.test.ts`, `.safety.test.ts`, `roomNotificationsCreateTimeInvite.test.ts`) may need updates when the inline send is replaced by the shared module. Mitigation: the refactor preserves behavior + response shape; update the tests to call through the new seam, never weaken an assertion.
- **Provider lock-in creep.** If a render or call site hard-codes Resend specifics, the Postmark swap breaks. Mitigation: the `EmailProvider` interface + the factory; the ban on provider specifics outside `resendProvider.ts`/`postmarkProvider.ts`.

---

## Out of scope

- Refactoring `request-argument-deletion` and `cutover-health-monitor` onto the shared `EmailProvider` module (documented as a future consolidation; this card touches only the room-invite product lane).
- Actually configuring hosted Custom SMTP, pushing hosted Auth templates, or sending any live email (all operator-gated, runbook-documented, never done in this card).
- DNS record creation (operator action; the runbook lists what to create).
- Building the Postmark provider module (`postmarkProvider.ts`) — documented as the swap path; the interface accommodates it, but only `resendProvider.ts` is built now.
- Any voting/scoring/search/OAuth/push/public-API feature (v1 scope guard).
- Email open/click tracking, unsubscribe-list management beyond the existing room-notifications unsubscribe handling, or marketing/digest email (transactional only).
- Bounce/complaint webhook ingestion (provider-side suppression handles it for v1; a webhook handler is a later card).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** email copy carries no winner/loser/truth/verdict/correct/incorrect tokens; the ban-list test (`emailCopyDoctrine.test.ts`) + the runtime `assertNoBannedTokens` gate enforce it. Score/judgment never appears in a transactional email.
- **cdiscourse-doctrine §2-3 (heat/popularity not surfaced):** invite copy states only public/private capacity facts; no heat, engagement, or standing language.
- **cdiscourse-doctrine §4 (AI limits):** no AI call anywhere in this card; email transport is not an AI surface.
- **cdiscourse-doctrine §6 + supabase-edge-contract §1 (secrets):** provider key + SMTP password live only in Supabase secrets / hosted SMTP config; never in client, git, docs, tests, logs, PR, or error payloads. The `EmailSendResult` is audit-safe (no recipient, no provider string, no body, no key). `src/features/email/*` mirrors read no secret.
- **supabase-edge-contract (Edge shape):** Lane B runs server-side in a registered Edge function via `fetch()` to the provider HTTPS API; no service-role in client; no nodemailer; no SMTP socket from Edge or client. Standard error shape preserved.
- **No account enumeration:** the inviter-facing response stays byte-identical existing-vs-new; `resolveInviteNotificationStatus` is updated to a single posture-based value across both lanes.
- **No-token-leak:** the raw token appears only inside the CTA `redemptionUrl` href, never as a standalone field, never logged, never returned.
- **Supabase owns Auth tokens:** Lane A never generates Auth links in `app/`/`src/`; `{{ .ConfirmationURL }}` is the only link variable; the provider only carries Supabase's bytes.
- **Plain language (§9):** no internal validation codes in any email string; copy is normal-user prose.
- **v1 scope (§10):** transactional email only; no voting/search/OAuth/push/public-API.
- **Engine sacred (§5):** the rules engine (`src/domain/constitution/engine.ts` — the live path; CLAUDE.md's `src/lib/...` reference is stale) is untouched; the pure render/safety modules have no network and no engine coupling.

---

## GATE-C note (for the implement/review stages that follow)

This card is **GATE-C** at implement-time: it touches `supabase/functions/**`, `supabase/config.toml` (template registration), `supabase/templates/**`, and secrets posture. The Supabase GitHub integration **auto-applies migrations and redeploys registered Edge functions on merge to `main`**, so **merge is a deploy** (operator-gated, never autonomous). However, the deploy is **inert while gated OFF**: `CDISCOURSE_EMAIL_TRANSPORT_ENABLED` defaults false, both existing gates default OFF, and no template/SMTP hosted push happens on merge (those are separate operator actions). No new function is registered (room-notifications already registered). Per §4: Claude never flips a gate, never sets a secret, never pushes hosted SMTP/templates, never runs a live smoke — each is an explicit operator action.

---

## Deploy step (operator)

After the implementer's PR is reviewed and the operator approves the merge:

1. **Merge to main** (operator-gated — merge = deploy; auto-redeploys `room-notifications` with the shared-module refactor, inert because gates default OFF).
2. **Provider + DNS** — per `docs/runbooks/email-provider-setup.md`: verify the sending domain, add SPF/DKIM/DMARC, confirm the reply-to mailbox.
3. **Secrets (server-side only, names only here):** `npx supabase secrets set CDISCOURSE_EMAIL_PROVIDER=resend CDISCOURSE_EMAIL_FROM="…" CDISCOURSE_EMAIL_REPLY_TO="…" --linked` (and `RESEND_API_KEY` if rotating). Provider key/value typed on stdin, never on the command line.
4. **Lane A Custom SMTP** — Dashboard (Authentication → Emails/SMTP) or the runbook's gated Management-API path (`CDISCOURSE_ALLOW_SUPABASE_AUTH_SMTP_UPDATE=1` + `SUPABASE_ACCESS_TOKEN`, read-current → patch-intended-only → read-back).
5. **Hosted Auth templates** — operator-gated push (`CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE`), Dashboard or `supabase config push`.
6. **Seed smoke** — `CDISCOURSE_ALLOW_EMAIL_TRANSPORT_SMOKE=1 CDISCOURSE_EMAIL_SMOKE_TARGET=kyleruff+emailtransport01@gmail.com` single target; confirm receipt + CDiscourse branding + rendering.
7. **Go live** — only after the seed smoke passes: `CDISCOURSE_EMAIL_TRANSPORT_ENABLED=true` (+ `INVITE_EMAIL_ENABLED=true` to keep existing-user invite email behaving as before). Batch only after enabling `CDISCOURSE_ALLOW_EMAIL_TRANSPORT_BATCH=1`.

---

## GATE-A self-check

- [x] **Scope is explicit** — two lanes, the shared module file plan, the gate reconciliation, the 12 test classes, edge cases, risks, out-of-scope.
- [x] **No production code written** — this is a design doc; the file plan describes what the implementer builds.
- [x] **No migration / no data-model change** — reuses existing tables; no RLS change.
- [x] **Provider decision justified** — managed (not self-hosted), Resend default, Postmark swap; Edge over Netlify proven.
- [x] **Existing gates reconciled, not silently broken** — `INVITE_EMAIL_ENABLED` subordinated to the master gate (documented behavior change); `INVITE_AUTH_BRIDGE_ENABLED` kept independent (Lane A); no-enumeration posture preserved across both lanes.
- [x] **Secret hygiene specified** — server-side only; audit-safe result shape; source-scan test (#9) + no-leak test (#6); mirrors carry no secret.
- [x] **Doctrine self-check complete** — §1/§2-3/§4/§5/§6/§9/§10 + no-enumeration + no-token-leak + Supabase-owns-tokens all addressed.
- [x] **GATE-C + merge-as-deploy posture stated** — inert-while-gated; operator-only gate flips / secret sets / hosted pushes / live smoke.
- [x] **Deploy step + runbook + design testing-run produced** — all three deliverables written on the feature branch.
- [x] **Engine path corrected** — live engine is `src/domain/constitution/engine.ts` (CLAUDE.md's `src/lib/...` is stale); engine untouched regardless.

**Open questions for the operator** (carried into the testing-run record):
1. Sender address default — `no-reply@mail.cdiscourse.com` vs `invites@mail.cdiscourse.com` for the product invite lane? (Design assumes `invites@…` for product, `no-reply@…` acceptable for non-reply Auth flows; reply-to `support@cdiscourse.com` confirmed.)
2. Should the non-invite Lane-A templates (recovery / magic-link / confirmation / email-change) ship in THIS card, or be deferred to a follow-up while this card lands the invite lane + the shared module + the runbook? (Lean: land the module + invite lane + runbook now; the additional templates are a small, low-risk follow-up that reuses the same pattern.)
3. Confirm the gate-composition decision: is subsuming `INVITE_EMAIL_ENABLED` under `CDISCOURSE_EMAIL_TRANSPORT_ENABLED` the intended relationship (master kill switch + per-feature switch, both required)?
