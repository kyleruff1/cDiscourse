# EMAIL-TRANSPORT-001 — design-phase record (2026-06-13)

**Card:** EMAIL-TRANSPORT-001 — CDiscourse-owned transactional email transport + Supabase Auth Custom SMTP
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/635
**Branch:** `feat/EMAIL-TRANSPORT-001-email-transport`
**Baseline:** `origin/main @ e187c68`
**Stage:** DESIGN (Phase 0 + design draft). Pre-GATE-A. **No production code, no migration, no live send, no hosted-config mutation.**
**Design doc:** `docs/designs/EMAIL-TRANSPORT-001.md`
**Runbook:** `docs/runbooks/email-provider-setup.md`

---

## Phase 0 inventory findings (what already exists)

| Area | Finding | Implication for the design |
|---|---|---|
| Auth template | `supabase/templates/invite.html` is fully branded CDiscourse, no visible "Supabase", uses `{{ .ConfirmationURL }}` + `{{ .Email }}` only, ≥44px CTA, plain fallback. | The pattern is set; new Lane-A templates mirror it. The invite lane is already branded — the gap is the OTHER Auth flows + product email branding/transport. |
| Other Auth templates | None exist (`invite.html` only). Recovery / magic-link / confirmation / email-change fall back to Supabase defaults (un-branded). | Lane A adds branded templates for the remaining flows (design open question 2: this card vs follow-up). |
| `config.toml` SMTP | `[auth.email.smtp]` is COMMENTED OUT (SendGrid example). No Custom SMTP in the file. | Lane A SMTP is a HOSTED action (Dashboard or gated Management-API), not a file edit — the password is a secret. Documented in the runbook. |
| `config.toml` invite template | Registered: `subject` + `content_path = ./supabase/templates/invite.html`. Hosted push gated by `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE`. | New templates register the same way; hosted push stays operator-gated. |
| `config.toml` rate limit | `[auth.rate_limit] email_sent = 2` (LOCAL). Hosted built-in ~3-4/hr. | Confirms the motivation: Custom SMTP removes the cap. |
| Registered functions | `room-notifications`, `create-argument-room`, `manage-room-invite`, `admin-users`, `request-argument-deletion`, `cutover-health-monitor` all registered → **auto-deploy on merge** (deploy-bearing, GATE-C). | This card modifies `room-notifications` (already registered) — merge = deploy, inert while gated OFF. No new registration. |
| Email-send seam | `room-notifications` `handleInvite` (:413-548): existing-user → Resend `maybeSendInviteEmail` (gate `INVITE_EMAIL_ENABLED`); new-user → `inviteUserByEmail` (gate `INVITE_AUTH_BRIDGE_ENABLED`); branch-independent `notification` status (`resolveInviteNotificationStatus`). | This is the seam EMAIL-TRANSPORT-001 standardizes. The new-vs-existing branch + no-enumeration must be preserved. |
| Resend precedent | `RESEND_API_KEY` used in 3 functions (`room-notifications`, `request-argument-deletion`, `cutover-health-monitor`) with an identical gate→`fetch(api.resend.com)`→drain-body→never-log pattern. | Lane B is a refactor/extension of proven code, not a new dependency. The shared `EmailProvider` module lifts this pattern. |
| Shared conventions | `_shared/http.ts`, `_shared/supabaseClients.ts`, `_shared/inviteToken*.ts`, `_shared/inviteSchemas.ts` (zod-Deno) + `src/features/invites/inviteSchemasMirror.ts` (Jest mirror). | New `_shared/email/*` modules mirror these; `emailSchemas.ts` gets a `src/features/email/emailSchemasMirror.ts` Jest twin. |
| Token discipline | Raw token minted in Deno (`create-argument-room`), stored as hash only, returned once as `inviteLink` to creator. ARG-ROOM-004 feeds it server-side into the transport. | The email CTA uses the app-controlled `/invite/<token>` route; the token never appears as a standalone field, never logged. |
| Email-binding | `manage-room-invite` `handleAccept` enforces `callerEmail === invitee_email_lower` → 403 `invite_email_mismatch`. | Unchanged; the email transport does not touch acceptance security. |
| Smoke discipline | `scripts/auth/sendInviteSmoke.js`: dry default, present+length-only `fingerprint`, redirect allow-list, admin-JWT (no service-role in script), seed-shape gate, batch cap 5. | EMAIL-TRANSPORT-001's smoke inherits this exactly; the runbook reuses it for the Lane-A seed. |
| Secret presence (NEVER values) | Tracked env files are only `.env.example` / `.env.bot-tests.example` / `.env.engagement-intelligence.example`; the real `.env*` are gitignored. `.env.example` carries NO `CDISCOURSE_EMAIL_*` / `INVITE_EMAIL_ENABLED` / SMTP keys. `INVITE_EMAIL_ENABLED` + `INVITE_AUTH_BRIDGE_ENABLED` default OFF in code. `RESEND_API_KEY` is a hosted secret on `qsciikhztvzzohssddrq`. | **Confirmed presence-only: no live email-send flag is armed in any committed file.** Merge of this card is inert. |

---

## Decisions

1. **Managed provider, NOT self-hosted SMTP.** A self-hosted daemon adds an always-on host, multiplies the deliverability/security burden, and cannot be reached cleanly from Deno Edge `fetch()` for the product lane. Rejected per the card's hard constraint.
2. **Resend default, Postmark documented swap.** Resend serves both lanes (Custom SMTP for Auth + HTTP API for product), is already wired in 3 functions, and its key is already a hosted secret. Postmark is behind the same `EmailProvider` interface for a no-call-site-change swap.
3. **Supabase Edge over Netlify.** The provider HTTP API is reachable from Deno via `fetch()` (proven). Netlify would duplicate the service-role/token boundary + add a deploy target for no capability gain. The card's Netlify escape hatch is not triggered.
4. **Two lanes, distinct gates.** Lane A (Auth) via Custom SMTP, Supabase owns the token, no Auth links in app/client. Lane B (product) via the shared `_shared/email/` module, provider HTTP API, app-controlled redemption route.
5. **Gate reconciliation:** new master `CDISCOURSE_EMAIL_TRANSPORT_ENABLED` (default OFF) **subsumes** `INVITE_EMAIL_ENABLED` for the product lane (both required to send) but **does NOT** govern `INVITE_AUTH_BRIDGE_ENABLED` (Lane A, separate). `resolveInviteNotificationStatus` updated to a single posture across both lanes to preserve no-enumeration. This is a deliberate, documented behavior change (orchestrator default — see open question 3).
6. **Audit-safe result shape.** `EmailSendResult` carries `status` + `providerStatusClass` only — no recipient, no body, no key, no provider string. Source-scan + no-leak tests enforce it.
7. **No migration, no data-model change.** Reuses `argument_room_invites` + `debate_participants` + `supabase/templates/*`. RLS untouched.

---

## Deliverables produced this stage

- [x] `docs/designs/EMAIL-TRANSPORT-001.md` — full design (provider decision, two lanes, shared interface + file plan, `renderArgumentRoomInviteEmail` + `sendTransactionalEmail` signatures, audit-safe result shape, gating model + reconciliation, 12-class test plan, edge cases, risks, out-of-scope, GATE-C note, deploy step, GATE-A self-check).
- [x] `docs/runbooks/email-provider-setup.md` — DNS checklist (SPF/DKIM/DMARC/verified domain/reply-to), Dashboard checklist, gated Management-API alternative (read → patch-intended-only → read-back), secret-set commands (names only), live-smoke runbook (one dev alias `kyleruff+emailtransport01@gmail.com`), rollback, provider swap.
- [x] `docs/testing-runs/2026-06-13-email-transport-design.md` — this record.

---

## Open questions for the operator (carried to GATE A)

1. **Sender address.** Product invite from `invites@mail.cdiscourse.com` (design assumption) vs `no-reply@mail.cdiscourse.com`? Reply-to `support@cdiscourse.com` confirmed.
2. **Lane-A template scope.** Ship the non-invite Auth templates (recovery / magic-link / confirmation / email-change) in THIS card, or land the shared module + invite lane + runbook now and the additional templates as a small follow-up? (Lean: follow-up.)
3. **Gate composition.** Confirm `INVITE_EMAIL_ENABLED` becoming subordinate to `CDISCOURSE_EMAIL_TRANSPORT_ENABLED` (both required for the product lane) is the intended relationship. This is the one orchestrator-default behavior change; it needs operator ratification.

---

## GATE-A readiness

| Criterion | Status |
|---|---|
| Phase 0 inventory complete + summarized in the design | ✅ |
| Provider decision made + justified (managed, Resend default, Postmark swap, Edge over Netlify) | ✅ |
| Two lanes designed with distinct, default-safe gates | ✅ |
| Existing gates reconciled, not silently broken (documented behavior change surfaced) | ✅ |
| Concrete file plan + signatures + audit-safe result shape | ✅ |
| 12-class test plan with file paths | ✅ |
| Edge cases, risks, out-of-scope enumerated | ✅ |
| Secret hygiene: server-side only, no value in any committed file (presence-only confirmed) | ✅ |
| Doctrine self-check (no truth labels / no-enumeration / no-token-leak / Supabase-owns-tokens / secrets / v1 scope / engine untouched) | ✅ |
| GATE-C + merge-as-deploy posture stated (inert-while-gated) | ✅ |
| Deploy step + runbook produced | ✅ |
| No production code / migration / live send / hosted mutation performed | ✅ |

**Verdict: READY FOR GATE A.** Three open questions are operator-policy calls (sender address, Lane-A template scope, gate-composition ratification), not blockers — the design proceeds on documented defaults and surfaces each for operator decision. No doctrine conflict; no v1-scope violation; no secret exposure.
