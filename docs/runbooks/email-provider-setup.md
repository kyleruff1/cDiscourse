# Email provider setup — operator runbook (EMAIL-TRANSPORT-001)

**Audience:** operator (Kyler) only. Every step here is an operator action. The agent NEVER runs any of these commands, NEVER sets a secret, NEVER pushes hosted config, and NEVER sends a live email.

**Companion design:** `docs/designs/EMAIL-TRANSPORT-001.md`.
**Linked project:** `qsciikhztvzzohssddrq` (dev).
**Default provider:** Resend. **Documented alternative:** Postmark (the swap steps are noted inline).

This runbook brings CDiscourse-owned email live in **two lanes**:
- **Lane A — Supabase Auth** (invite / recovery / magic-link / confirmation / email-change) via **Custom SMTP**. Supabase owns the token; the provider only relays the bytes.
- **Lane B — product email** (ARG-ROOM invites) via the provider **HTTP API** from the `room-notifications` Edge function.

> **Golden rule on secrets:** a provider API key, SMTP password, service-role key, or access token is NEVER typed on a command line, NEVER pasted into a doc/PR/issue, NEVER committed. Type/paste values on stdin only. After handling a value: `Clear-History; Set-Clipboard $null` (PowerShell) or `history -c; pbcopy < /dev/null` (bash/zsh).

---

## 0. Prerequisites

- [ ] The EMAIL-TRANSPORT-001 PR is merged (auto-redeploys `room-notifications`, inert because gates default OFF).
- [ ] You control DNS for `cdiscourse.com` (or the chosen sending subdomain `mail.cdiscourse.com`).
- [ ] You have a Resend account (or Postmark) and can add a sending domain.
- [ ] You have `SUPABASE_ACCESS_TOKEN` available **only if** you intend to use the gated Management-API path instead of the Dashboard (Section 4b).

---

## 1. DNS checklist (do this first — deliverability depends on it)

Add these records on the sending domain. Use a dedicated subdomain (`mail.cdiscourse.com`) so the apex domain's existing mail/records are untouched. Exact record values come from the provider's domain-verification screen.

| Record | Host (example) | Purpose | Source |
|---|---|---|---|
| **Verified sender domain** | `mail.cdiscourse.com` | Provider proves you own the sending domain | Resend → Domains → Add Domain |
| **SPF** (TXT) | `mail.cdiscourse.com` → `v=spf1 include:<provider-spf> ~all` | Authorizes the provider's MTAs to send for you | Provider verification screen |
| **DKIM** (TXT/CNAME) | `<selector>._domainkey.mail.cdiscourse.com` | Cryptographic signing of outbound mail | Provider verification screen (provider-generated key) |
| **DMARC** (TXT) | `_dmarc.cdiscourse.com` → `v=DMARC1; p=quarantine; rua=mailto:dmarc@cdiscourse.com; fo=1` | Alignment policy + aggregate reporting | You author (start `p=none` for monitoring, tighten to `p=quarantine` once aligned) |
| **Return-Path / bounce** (CNAME) | provider-specified | Custom return-path for bounce handling + alignment | Provider verification screen |

- [ ] Sending domain added in the provider and showing **Verified**.
- [ ] SPF published and resolving (`nslookup -type=txt mail.cdiscourse.com`).
- [ ] DKIM published and showing **Verified** in the provider.
- [ ] DMARC published (begin `p=none`, move to `p=quarantine` after a week of clean aggregate reports).
- [ ] **Reply-to mailbox** `support@cdiscourse.com` exists and is monitored (the operator-approved reply-to address).

> **Postmark swap:** same four record classes; Postmark's "Sender Signatures / Domains" screen generates its own SPF include + DKIM selector + return-path CNAME. Re-verify the domain under Postmark before repointing SMTP.

---

## 2. Set server-side secrets (names only here — values typed on stdin)

These are Supabase **Edge Function** secrets for Lane B (the product HTTP API) and the gating model. Run each `secrets set` and paste the value when prompted; do NOT put a value on the command line.

```powershell
# Lane B / gating secrets (server-side only). Provider key value typed on stdin.
npx supabase secrets set CDISCOURSE_EMAIL_PROVIDER=resend --linked
npx supabase secrets set CDISCOURSE_EMAIL_FROM="CDiscourse <invites@mail.cdiscourse.com>" --linked
npx supabase secrets set CDISCOURSE_EMAIL_REPLY_TO="support@cdiscourse.com" --linked

# RESEND_API_KEY already exists on the linked project. ONLY if rotating:
#   npx supabase secrets set RESEND_API_KEY --linked         # then paste the value on stdin
# Postmark alternative (instead of RESEND_API_KEY):
#   npx supabase secrets set CDISCOURSE_EMAIL_PROVIDER=postmark --linked
#   npx supabase secrets set POSTMARK_SERVER_TOKEN --linked  # then paste the value on stdin
```

- [ ] `CDISCOURSE_EMAIL_PROVIDER` set (`resend` or `postmark`).
- [ ] `CDISCOURSE_EMAIL_FROM` set (sender name `CDiscourse`; address `invites@mail.cdiscourse.com` for product, or `no-reply@mail.cdiscourse.com`).
- [ ] `CDISCOURSE_EMAIL_REPLY_TO=support@cdiscourse.com` set.
- [ ] Provider key present (`RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`).
- [ ] **Master gate left OFF for now:** do NOT set `CDISCOURSE_EMAIL_TRANSPORT_ENABLED=true` yet (Section 6).

> Verify a secret VALUE without printing it: compare its SHA-256 digest to the provider's copy — never echo the value.

---

## 3. Get the provider's SMTP relay credentials (for Lane A)

Lane A (Supabase Auth) uses **Custom SMTP**, not the HTTP API. Get the provider's SMTP relay details:

- **Resend:** SMTP host `smtp.resend.com`, port `465` (SSL) or `587` (STARTTLS), username `resend`, password = a Resend API key (can be the same key or a dedicated SMTP key).
- **Postmark:** SMTP host `smtp.postmarkapp.com`, port `587`, username + password = your Postmark **Server API token** (used as both).

- [ ] SMTP host / port / username / password obtained (kept out of any file).

---

## 4. Configure Supabase Auth Custom SMTP (Lane A)

Two paths. **Prefer the Dashboard (4a).** Use the Management-API path (4b) only if you explicitly want it, and only with the read → patch-intended-only → read-back discipline.

### 4a. Dashboard path (recommended)

Supabase Dashboard → project `qsciikhztvzzohssddrq` → **Authentication**:

1. **Emails → SMTP Settings → Enable Custom SMTP.**
   - [ ] Sender name: `CDiscourse`
   - [ ] Sender email: `no-reply@mail.cdiscourse.com` (or `invites@mail.cdiscourse.com`)
   - [ ] SMTP host / port / username / password from Section 3 (password pasted, never saved to a file)
   - [ ] Minimum interval / rate limit raised from the built-in cap once Custom SMTP is verified
2. **Authentication → URL Configuration** — confirm (do NOT change unless wrong):
   - [ ] **Site URL** points to the deployed app (`https://dev-cdiscourse.netlify.app`).
   - [ ] **Redirect allow-list** still contains `http://localhost:8081/**`, `https://dev-cdiscourse.netlify.app/**`, and the Netlify preview wildcard `https://*--dev-cdiscourse.netlify.app/**` (mirrors `supabase/config.toml`:164-170). The invite bridge redirect `…/auth/callback?invite=<token>` must resolve under one of these.
3. **Authentication → Emails → Templates** — update to the branded CDiscourse templates (Section 5).

> **Reply-to in Lane A:** Supabase Custom SMTP does not always expose a reply-to field. If it does, set `support@cdiscourse.com`. If not, set the reply-to at the provider's sending-domain level, or rely on the From mailbox being monitored.

### 4b. Gated Management-API path (alternative — only if you choose it)

This path mutates hosted Auth config via the Management API. It is gated and must NEVER overwrite unrelated settings.

**Arming:** set BOTH for this session only:
```powershell
$env:SUPABASE_ACCESS_TOKEN = "<paste-on-prompt-not-here>"   # operator's personal access token
$env:CDISCOURSE_ALLOW_SUPABASE_AUTH_SMTP_UPDATE = "1"        # explicit intent flag
```

**Procedure (read → patch-intended-only → read-back):**
1. **Read current** Auth config first and save the full response locally (gitignored scratch):
   `GET https://api.supabase.com/v1/projects/qsciikhztvzzohssddrq/config/auth`
2. **Patch only the SMTP fields** you intend to change (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_admin_email`, `smtp_sender_name`, `smtp_max_frequency`) — and NOTHING else. Do NOT send `site_url`, `uri_allow_list`, or any field you are not deliberately changing; sending stale values can clobber the Dashboard-correct ones:
   `PATCH https://api.supabase.com/v1/projects/qsciikhztvzzohssddrq/config/auth` with a body containing ONLY the SMTP keys.
3. **Read back** and diff against step 1 to confirm only the intended fields changed:
   `GET …/config/auth` again; assert `site_url` + `uri_allow_list` are unchanged.

**Disarm immediately after:**
```powershell
Remove-Item Env:\CDISCOURSE_ALLOW_SUPABASE_AUTH_SMTP_UPDATE
Remove-Item Env:\SUPABASE_ACCESS_TOKEN
Clear-History
```

- [ ] If 4b used: current config read + saved, only SMTP fields patched, read-back confirms Site URL + redirect allow-list unchanged, flags disarmed.

---

## 5. Push branded Auth templates (Lane A) — operator-gated

The branded templates live in `supabase/templates/*.html`. Local dev reads them via `config.toml` `[auth.email.template.*]`. The **hosted** project's templates are a SEPARATE push, gated by `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE`.

- **Dashboard:** Authentication → Emails → Templates → paste each template's HTML (Invite, Confirm signup, Magic Link, Reset Password, Change Email Address). Each must use ONLY `{{ .ConfirmationURL }}` (CTA), `{{ .Email }}` (safety copy), and (rarely) `{{ .RedirectTo }}` / `{{ .Data.* }}`.
- **CLI:** with `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE=1` armed for the session, `npx supabase config push` (which reads `config.toml`'s `content_path` entries). Verify on the Dashboard afterward.

- [ ] Invite template = branded `invite.html` (already shipped; confirm it is the hosted version).
- [ ] Recovery / magic-link / confirmation / email-change templates branded (or scheduled as the follow-up per the design's open question 2).
- [ ] Every hosted template: names CDiscourse, shows NO visible "Supabase", ban-list clean, ≥44px CTA, HTML + plain fallback.

---

## 6. Live smoke (operator-gated, ONE dev alias) — then go live

Do NOT enable the master gate until a single-target seed smoke succeeds. **Batch is forbidden before the seed passes.**

### 6a. Lane A (Auth invite) seed smoke — reuses the shipped invite smoke

```powershell
# Dry first (default — no network, no send):
node scripts/auth/sendInviteSmoke.js --dry-run --email kyleruff+emailtransport01@gmail.com

# Live single (armed). Confirms Custom SMTP + branded Auth template end-to-end:
$env:CDISCOURSE_ALLOW_INVITE_SEND_SMOKE = "1"
node scripts/auth/sendInviteSmoke.js --live `
  --email kyleruff+emailtransport01@gmail.com `
  --redirect-to https://dev-cdiscourse.netlify.app/auth/callback `
  --smtp-posture custom
Remove-Item Env:\CDISCOURSE_ALLOW_INVITE_SEND_SMOKE
```
- [ ] Email received at `kyleruff+emailtransport01@gmail.com` (inbox/spam/promotions checked).
- [ ] Sender shows `CDiscourse`, NOT Supabase. From = the configured CDiscourse address.
- [ ] Template is the branded one; CTA works; account-creation flow completes.

### 6b. Lane B (product invite email) seed smoke — single target, master gate ON

```powershell
# Arm the product transport master gate + the smoke target (server-side):
npx supabase secrets set CDISCOURSE_EMAIL_TRANSPORT_ENABLED=true --linked
npx supabase secrets set INVITE_EMAIL_ENABLED=true --linked          # both required for the product lane
npx supabase secrets set CDISCOURSE_ALLOW_EMAIL_TRANSPORT_SMOKE=1 --linked
npx supabase secrets set CDISCOURSE_EMAIL_SMOKE_TARGET=kyleruff+emailtransport01@gmail.com --linked
```
Then trigger ONE existing-user room invite to that address (via the app or the extended `sendInviteSmoke.js` Lane-B dry/live plan) and confirm the product email.

- [ ] Product invite email received; sender = CDiscourse; CTA = `…/invite/<token>` (app-controlled route, no raw provider token visible).
- [ ] Copy is ban-list clean (no winner/loser/truth/verdict; no `challenger`/`opponent`).
- [ ] Public/private indicator + capacity copy render correctly.

### 6c. Go live (batch) — only after 6a + 6b pass

```powershell
# Disarm the single-target smoke gate; arm batch ONLY now:
npx supabase secrets unset CDISCOURSE_ALLOW_EMAIL_TRANSPORT_SMOKE --linked
npx supabase secrets unset CDISCOURSE_EMAIL_SMOKE_TARGET --linked
npx supabase secrets set CDISCOURSE_ALLOW_EMAIL_TRANSPORT_BATCH=1 --linked
```
- [ ] `CDISCOURSE_EMAIL_TRANSPORT_ENABLED=true` (product lane master switch).
- [ ] `INVITE_EMAIL_ENABLED=true` (existing-user product invite — both required).
- [ ] `INVITE_AUTH_BRIDGE_ENABLED=true` (new-user Auth bridge — independent Lane-A gate; set when you want the new-user Auth invite live).
- [ ] Monitor the provider dashboard (delivery, bounce, complaint) for the first day.

---

## 7. Rollback / kill switch

To instantly stop ALL product email without a deploy:
```powershell
npx supabase secrets set CDISCOURSE_EMAIL_TRANSPORT_ENABLED=false --linked
```
This returns `skipped_gate_off` from `sendTransactionalEmail` (no network). To stop the new-user Auth bridge: `INVITE_AUTH_BRIDGE_ENABLED=false`. To revert Auth emails to the built-in service: disable Custom SMTP in the Dashboard (the rate limit returns, but it is a safe fallback).

---

## 8. Provider swap (Resend → Postmark) summary

1. Verify `mail.cdiscourse.com` under Postmark; publish Postmark's SPF/DKIM/return-path records.
2. `npx supabase secrets set CDISCOURSE_EMAIL_PROVIDER=postmark --linked` + `POSTMARK_SERVER_TOKEN` (stdin).
3. Repoint Custom SMTP (Section 4) at `smtp.postmarkapp.com` with the Postmark server token.
4. Re-run the Section 6 seed smoke before going live. No product code change is required — the factory selects the Postmark module.
