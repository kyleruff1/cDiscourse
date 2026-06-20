# AUTH-GOOGLE-SSO-002 — hosted Google OAuth config runbook (GATE-C)

**Status:** Issue #745. Config prerequisites verified read-only; the Google-enable step is **BLOCKED on operator execution** (Google Cloud OAuth client + provider secret). #745 stays OPEN. No app code, no Supabase migration/Edge, no provider secret in repo, no Facebook, no deploy.

## 1. What this card did

- **Read-only verification** of the hosted Supabase Auth config via the Management API (`GET /v1/projects/{ref}/config/auth`) using the operator-provisioned access token (token never printed/logged; only non-secret config values recorded below).
- Produced the exact remaining operator steps + the post-enable smoke.
- **No mutation performed.** Enabling a hosted OAuth provider requires creating a Google Cloud OAuth client and entering its **client secret** — operator-only work (the agent does not create provider secrets or enter them into config).

## 2. Verified current hosted state (project ref `qsciikhztvzzohssddrq`, read-only, redacted)

| Setting | Current value | Needed for Google SSO | Status |
|---|---|---|---|
| `site_url` | `https://dev-cdiscourse.netlify.app` | the deployed host | ✅ correct (no change) |
| `uri_allow_list` | `http://localhost:8081/**, https://dev-cdiscourse.netlify.app/**` | must cover the app return `…/auth/callback` (matched by `/**`) + local dev | ✅ complete (no change) |
| `external_google_enabled` | `false` | `true` | ⛔ **operator must enable** |
| `external_google_client_id` | absent | a real Google OAuth client id | ⛔ **operator provides** |
| `external_google_secret` | absent | a real Google OAuth client secret (Supabase secret) | ⛔ **operator provides — never in repo/client** |
| `external_facebook_enabled` | `false` | (not this lane) | ✅ stays false (Facebook deferred) |
| `mailer_autoconfirm` | `false` (confirmations ON) | unchanged | ✅ (matches readiness doc) |

**Key result:** the Supabase **Site URL** and **redirect allow-list** already satisfy Google SSO — no allow-list change is required. The only remaining config work is creating the Google OAuth client and enabling the provider.

## 3. Remaining operator steps (GATE-C — operator executes)

**A. Google Cloud console (creates the client + secret):**
1. Create / select a Google Cloud project; configure the OAuth consent screen (app name = CivilDiscourse; support email; **minimum scopes** for sign-in only: `openid`, `email`, `profile`). No Facebook.
2. Create an **OAuth 2.0 Client ID** (type: Web application).
3. **Authorized redirect URI** (exact): `https://qsciikhztvzzohssddrq.supabase.co/auth/v1/callback` (this is Supabase's GoTrue callback — where Google returns; it is NOT in the Supabase `uri_allow_list`).
4. Authorized JavaScript origins (optional for the server-side code flow; if added, use `https://dev-cdiscourse.netlify.app` + `http://localhost:8081`).
5. Copy the generated **client ID** and **client secret** (the secret is shown once — store it directly into Supabase in step B; do not paste it into the repo, this doc, an issue, or any log).

**B. Supabase hosted Auth (enable the provider):**
- Dashboard → Authentication → Providers → Google → enable → paste the client ID + client secret → save. **OR** Management API `PATCH /v1/projects/qsciikhztvzzohssddrq/config/auth` with `external_google_enabled=true`, `external_google_client_id=<id>`, `external_google_secret=<secret>` (secret supplied by the operator at call time; never committed).
- Leave `site_url` + `uri_allow_list` as-is (already correct).
- Confirm Google's **"Skip nonce checks"** / identity-linking posture per the same-email policy (see §5).

**C. Redacted read-back (verification, agent or operator can run read-only):**
- `GET /v1/projects/{ref}/config/auth` → assert `external_google_enabled=true`, `external_google_client_id` PRESENT, `external_google_secret` PRESENT (value never printed — verify by presence/length/SHA only), `site_url` + `uri_allow_list` unchanged.

## 4. Post-enable smoke (deferred — run after step B, operator-approved test account only)

Not runnable now (provider disabled). After enable:
1. Logged-out → Sign In → (after #746 ships the live button) Continue with Google → Google consent → returns to `…/auth/callback`.
2. Assert the callback resolves a session (the existing `consumeAuthCallback` `exchangeCodeForSession` branch → `success`, not `needs_password`) and the app shows no local-config warning.
3. **Smoke caveats:** test account only; no room creation / posting / invite; do not implement provisioning in this card. The **resolved runtime origin** (not the `dev.cdiscourse.com` fallback literal) must be the one that round-trips — assert it is the deployed host.

## 5. Cross-references / downstream (still OPEN)
- **#746** Continue with Google UI — inert until this card's enable lands; then the live `signInWithGoogle` wrapper + button.
- **#747** OAuth profile provisioning — the `handle_new_user` trigger is provider-independent, BUT Google's name arrives under `full_name`/`name` while the trigger reads only `display_name` → a NEW coalescing migration (GATE-C) is needed so Google users don't land with a NULL display name.
- **#748** invite redemption through Google — client intent-resume-after-Google-callback wiring.
- Full seam map: `docs/designs/AUTH-GOOGLE-SSO-READINESS-001.md`.

## 6. #745 disposition
**OPEN — blocked on operator execution** (Google Cloud OAuth client creation + provider secret entry). The agent cannot create or enter provider secrets. When the operator completes §3.A–§3.B and the redacted read-back confirms `external_google_enabled=true`, #745 can close.

## Boundary attestation
No runtime mutation, no provider call (read-only Supabase Management API GET only), no Google Cloud console call, no provider secret committed or handled, no queue arm, no Supabase config WRITE, no schema/RLS/migration/Edge change, no deployment, no netlify-prod publish, no Facebook setup, no service-role/client leakage, no package install, no app.json change, no app code, no Sign In UI change, no provisioning/invite write, no room/seat/chime-in/mediator/submission semantics changed.
