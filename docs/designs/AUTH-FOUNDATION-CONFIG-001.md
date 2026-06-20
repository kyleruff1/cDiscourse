# AUTH-FOUNDATION-CONFIG-001 — Provider-agnostic auth config posture inventory + hosted-config checklist

> Status: closing design doc for issue #739. Read-only inventory — no config is changed, no provider is enabled, no secret appears here. This doc is the standalone, dedicated expansion of section 1 of `docs/designs/AUTH-FOUNDATION-INDEX.md`. It exists so the downstream Google SSO lane (#743, #745) has a single, named, file:line-cited baseline.

## 0. Scope and what this doc is

A provider-agnostic launch-readiness inventory of the CivilDiscourse auth **configuration posture**: Site URL, redirect allow-list, callback route, email-confirmation mode, runtime-origin resolution, and the local-vs-hosted config split. It produces a checklist and a gap log only. No `config.toml`, `app.json`, or hosted setting is edited; no OAuth provider is enabled.

The live auth path today is **email/password only**. `supabase.auth.signInWithPassword` is the only sign-in call (`src/features/auth/authApi.ts:197`) and `supabase.auth.signUp` the only sign-up call (`src/features/auth/authApi.ts:104`). A repo-wide search for `signInWithOAuth` in `src/` returns zero matches — there is no OAuth initiation anywhere in the client today.

## 1. Config posture inventory

### 1.1 Site URL — local vs hosted

- **Local:** `site_url = "http://localhost:8081"` (`supabase/config.toml:156`). The inline comment there states this is the LOCAL dev value (Expo web serves on :8081).
- **Hosted:** set per-environment in the Supabase Dashboard / Management API; it is **not inherited** from `config.toml`. The `config.toml:152-155` comment block states this explicitly and names the deployed dev host: `https://dev-cdiscourse.netlify.app`.

### 1.2 Redirect allow-list — local vs hosted

- **Local:** `additional_redirect_urls` at `supabase/config.toml:164-170` lists `http://localhost:8081`, `http://localhost:8081/**`, `https://dev-cdiscourse.netlify.app`, `https://dev-cdiscourse.netlify.app/**`, and the per-deploy preview wildcard `https://*--dev-cdiscourse.netlify.app/**`.
- **Hosted:** the deployed allow-list is Dashboard / Management-API only and must be kept in sync by an operator. The `config.toml:159-163` comment notes the `**` suffix matches the `/auth/callback` + `/auth/reset` paths and that a CLI rejecting glob patterns should keep the wildcard entry in the Dashboard list only.

### 1.3 Routes and how `buildAuthRedirectUrl` derives them

`DEFAULT_AUTH_ROUTES` (`src/lib/auth/buildAuthRedirectUrl.ts:47-53`) maps:

| Auth kind | Route |
|---|---|
| `confirm_signup` | `/auth/callback` |
| `magic_link` | `/auth/callback` |
| `invite` | `/auth/callback` |
| `email_change` | `/auth/callback` |
| `password_reset` | `/auth/reset` |

`buildAuthRedirectUrl` (`src/lib/auth/buildAuthRedirectUrl.ts:161-174`) composes `normalizedOrigin + route`. It is 100% pure (no `window`, no `process`, no network). The consumer side is `src/features/auth/consumeAuthCallback.ts` rendered by `src/features/auth/AuthCallbackScreen.tsx`. Note that `consumeAuthCallback` returns `needs_password` for exactly one flow, `type=invite` (`src/features/auth/consumeAuthCallback.ts:51-54`).

### 1.4 Email-confirmation mode — local vs hosted

- **Local:** `enable_confirmations = false` (`supabase/config.toml:233`) — confirmations OFF in local dev.
- **Hosted:** `mailer_autoconfirm: false` → confirmations **ON** (operator fact, memory `auth-email-deployment-facts`). This is why invite redemption uses server-side `provision_and_accept` (Option B) rather than a client `signUp` synchronous session — see `docs/designs/AUTH-FOUNDATION-INVITE-REDIRECT-001.md` and `src/features/invites/inviteApi.ts:229-238`.

### 1.5 Runtime-origin precedence

`resolveRuntimeOrigin()` (`src/lib/auth/resolveRuntimeOrigin.ts:34-60`) resolves the host origin in this order:
1. `window.location.origin` when a real browser location exists (skips the sandboxed-iframe literal `'null'`) — `resolveRuntimeOrigin.ts:37-44`.
2. The web Cloud Run runtime-env shim `readRuntimeEnv().EXPO_PUBLIC_APP_ORIGIN` — `:46-50`.
3. Native + local dev `process.env.EXPO_PUBLIC_APP_ORIGIN` (babel-injected) — `:52-56`.
4. Otherwise `null`, at which point `buildAuthRedirectUrl`'s fallback rules take over — `:58-59`.

`getIsDev()` fails closed: when `__DEV__` is undefined it returns `false` (treat unknown as production, never relax the https-only rule) — `resolveRuntimeOrigin.ts:69-71`.

### 1.6 The local-vs-hosted inheritance rule (stated once)

**`config.toml` auth blocks are LOCAL-only.** The deployed Site URL, the deployed redirect allow-list, the deployed email-confirmation mode, and any deployed provider block are configured per-environment in the Supabase Dashboard / Management API and are NOT inherited from `config.toml`. Source: `supabase/config.toml:152-155` (Site URL) and `:159-163` (redirect list). Treat `config.toml` auth values as a local-dev mirror, never as the source of truth for the hosted project (`qsciikhztvzzohssddrq`).

### 1.7 Provider blocks present today

- `[auth.external.apple]` exists but `enabled = false` (`supabase/config.toml:359-372`).
- There is **no** `[auth.external.google]` block.
- The full provider name list (apple, azure, … google, … x, …) is in the comment at `supabase/config.toml:356-358`.

## 2. Hosted-config checklist (operator-runnable later; no secrets, no values committed)

This enumerates the hosted auth settings that must be present for launch sign-in. It names settings only — it embeds no secret and no secret value. The Management-API path is noted where relevant.

1. **Hosted Site URL** = the launch host (currently `https://dev-cdiscourse.netlify.app` for the dev env). Set via Dashboard → Authentication → URL Configuration, or Management API `PATCH /v1/projects/{ref}/config/auth` field `site_url`.
2. **Hosted redirect allow-list** includes the app return URLs `…/auth/callback` and `…/auth/reset` for each environment (stable host + preview wildcard). Management API field `uri_allow_list`.
3. **Email-confirmation mode** is intentional for launch (hosted is currently ON via `mailer_autoconfirm: false`). Confirm this is the desired launch posture; it drives the Option-B invite flow.
4. **(Google lane — DEFERRED to #745)** `[auth.external.google]` enabled hosted with client id + client secret stored as Supabase secrets (never in repo, never in `config.toml`). Not part of this card.

No secret name in this checklist carries a value. The OAuth secret is referenced in `config.toml` only via env substitution form (`secret = "env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)"`, `config.toml:363`), never as a literal.

## 3. Redirect / callback gap log

| # | Gap | Evidence | Launch-blocking? |
|---|---|---|---|
| G1 | **Fallback-origin mismatch.** `HOSTED_FALLBACK_ORIGIN = 'https://dev.cdiscourse.com'` (`src/lib/auth/buildAuthRedirectUrl.ts:65`) does NOT equal the actual deployed host `https://dev-cdiscourse.netlify.app` (`config.toml:153-155`). | `buildAuthRedirectUrl.ts:65`, `:98`; `config.toml:153-155` | **NON-blocking** under current resolver behavior — see determination below. |
| G2 | **Allow-list drift.** The hosted allow-list must stay in sync with the routes `buildAuthRedirectUrl` emits; a `redirect_to` not on the hosted allow-list is silently dropped → falls back to Site URL. | `config.toml:159-163`; memory `auth-email-deployment-facts` | Conditional — blocking only if a needed route is absent from the hosted list. #744's allow-list matrix must assert the resolved origin is allow-listed before the Google smoke. |
| G3 | **Native deep-link scheme absent.** `app.json` declares no `scheme` key (confirmed: a `scheme` grep over `app.json` returns nothing). | `app.json` (no `scheme` key) | NON-blocking now; relevant only when native OAuth redirects ship. Flag for the Google lane. |

### G1 launch determination (the required dev.cdiscourse.com vs dev-cdiscourse.netlify.app call)

The fallback-origin literal `https://dev.cdiscourse.com` is used ONLY when no runtime origin resolves in a non-dev build (`buildAuthRedirectUrl.ts:96-100`, `resolveOrigin` Rule 2). On the deployed SPA, `resolveRuntimeOrigin()` returns `window.location.origin` first (`resolveRuntimeOrigin.ts:37-44`), which IS the real host `https://dev-cdiscourse.netlify.app`. Therefore the mismatched literal is not normally reached in the browser.

**Determination: NON-blocking IFF** (a) the hosted redirect allow-list + Site URL use the real host `https://dev-cdiscourse.netlify.app`, and (b) the runtime-origin resolver prefers `window.location.origin` (it does — `resolveRuntimeOrigin.ts:37-44`). It BECOMES blocking only if the `https://dev.cdiscourse.com` fallback literal is ever used as a `redirect_to` without being allow-listed — Supabase then silently drops it to the Site URL. The literal should be reconciled to the real host (tracked here, not changed in this card).

## 4. Deferrals stated explicitly

- **Google provider config is DEFERRED to #745.** No `[auth.external.google]` block, no Google client id/secret, no Google enablement is in scope here.
- **Facebook is post-launch-only (#749).** No Facebook setup, UI, secrets, or config now.

## 5. Doctrine compliance

Secrets never appear in this doc or in the repo/client; the OAuth secret is referenced only via `env(...)` substitution in `config.toml`. No service-role. No provider call. Auth is identity plumbing — no truth/winner/loser/verdict surface is touched. Plain-language redirect-error copy already exists (`REDIRECT_INVALID_MESSAGE`, `src/features/auth/authApi.ts:13`).

## 6. Acceptance-bullet evidence map

| Acceptance bullet | Satisfied by |
|---|---|
| Markdown inventory + checklist + gap log exists under `docs/designs/` and cites real file:line | This doc §1–§3; cites `authApi.ts`, `buildAuthRedirectUrl.ts`, `resolveRuntimeOrigin.ts`, `config.toml`, `consumeAuthCallback.ts`, `app.json` |
| Hosted-config checklist names every required hosted setting without any secret/value | §2 (Site URL, allow-list, confirmation mode, Google-deferred); OAuth secret only as `env(...)` form |
| Gap log records the `dev.cdiscourse.com` vs `dev-cdiscourse.netlify.app` discrepancy and whether it blocks launch | §3 G1 + the G1 launch determination (NON-blocking under current resolver) |
| Local-vs-hosted inheritance rule stated in one place | §1.6 (config.toml auth blocks are LOCAL-only) |
| Google marked DEFERRED; Facebook post-launch-only | §4 |
