# AUTH-FOUNDATION — Index

> Provider-agnostic auth launch-readiness umbrella for CivilDiscourse. This index ties together the four foundation cards and names the Google dependency and the Facebook deferral. It is design/docs only — no config is changed, no provider is enabled, no secret appears here.
>
> Sequencing is non-negotiable: **foundation lands (or is ratified) BEFORE the Google lane.** Google config is GATE-C and operator-run; Facebook is post-launch only.

## Cards in this lane

| Card | Title | GATE-C | Issue |
|---|---|---|---|
| AUTH-FOUNDATION-CONFIG-001 | Config posture inventory + hosted-config checklist | No | #739 |
| AUTH-FOUNDATION-UI-001 | Provider-ready Sign In UI structure | No | #740 |
| AUTH-FOUNDATION-PROVISIONING-001 | Idempotent app-profile provisioning (provider-independent) | Design no / impl maybe | #741 |
| AUTH-FOUNDATION-INVITE-REDIRECT-001 | Preserve invite/room intent through auth redirects | No | #742 |

Downstream Google lane: see `docs/designs/AUTH-GOOGLE-SSO-INDEX.md` (#743 … #748). Facebook: #749 (deferred post-launch).

## 1. Config posture

The live auth path today is **email/password only** — `supabase.auth.signInWithPassword` (`src/features/auth/authApi.ts:197`) and `signUp` (`:104`). There is no `signInWithOAuth` anywhere in `src/`.

- **Site URL** — local `http://localhost:8081` (`supabase/config.toml:156`); hosted is set per-environment in the Dashboard / Management API and is **not inherited** from `config.toml` (`config.toml:152-155`). Deployed dev host: `https://dev-cdiscourse.netlify.app`.
- **Redirect allow-list** — local `config.toml:164-170` (localhost + `dev-cdiscourse.netlify.app` + preview-hash wildcard); hosted allow-list is Dashboard/Management-API only.
- **Routes** — `buildAuthRedirectUrl` maps `confirm_signup|magic_link|invite|email_change → /auth/callback` and `password_reset → /auth/reset` (`src/lib/auth/buildAuthRedirectUrl.ts:47-53`). The consumer screen is `src/features/auth/AuthCallbackScreen.tsx` over `consumeAuthCallback` (`src/features/auth/consumeAuthCallback.ts`).
- **Email confirmation** — local `enable_confirmations = false` (`config.toml:233`); hosted `mailer_autoconfirm: false` → confirmations **ON**. This is why invite redemption uses server-side `provision_and_accept` (Option B), not a client `signUp` synchronous session.
- **Runtime-origin precedence** — `window.location.origin` → injected `EXPO_PUBLIC_APP_ORIGIN` → `process.env.EXPO_PUBLIC_APP_ORIGIN` → null fallback (`src/lib/auth/resolveRuntimeOrigin.ts:34-60`).
- **Provider blocks** — `[auth.external.apple]` exists but `enabled = false` (`config.toml:359-372`); there is **no** `[auth.external.google]` block. The full provider name list is at `config.toml:356-358`.

### Hosted-config checklist (operator-runnable later; no secrets here)
1. Hosted Site URL = the launch host.
2. Hosted redirect allow-list includes the app `/auth/callback` and `/auth/reset` return URLs for each environment.
3. Email-confirmation mode is intentional for launch.
4. (Google lane) `[auth.external.google]` enabled hosted with client id/secret as Supabase secrets — #745.

### Redirect/callback gap log
- **Fallback-origin mismatch**: `HOSTED_FALLBACK_ORIGIN = https://dev.cdiscourse.com` (`buildAuthRedirectUrl.ts:65`) vs the actual deployed host `https://dev-cdiscourse.netlify.app`. Track and reconcile.
- **Allow-list drift**: hosted allow-list must stay in sync with the routes `buildAuthRedirectUrl` emits; a non-allow-listed `redirect_to` is silently dropped → Site-URL fallback.
- **Native scheme**: `app.json` declares no deep-link `scheme` — only relevant when native OAuth ships (flag for the Google lane).

## 2. UI slot strategy

The Sign In screen (`src/features/auth/AuthScreen.tsx:80-174`) is currently a single email/password (+ optional display-name) form with the brand lockup hero (sizing model `src/features/auth/signInLockupModel.ts`). The foundation UI card adds a **provider region → "or continue with email" divider → email/password fallback** layout, with a **future-reserved primary "Continue with Google" affordance that is inert** (no provider call). Canonical copy is reused from `src/lib/brandCopy.ts` (`PRIMARY_TAGLINE:34`, `PRINCIPLE_MARK_THE_POINT:40`). **No Facebook or Apple button.** The layout decision lives in a pure model so it is unit-testable.

## 3. Provisioning model

Profile rows are created **server-side by a DB trigger**, provider-independently: `public.handle_new_user()` (`SECURITY DEFINER`, pinned `search_path`) inserts into `public.profiles` with `ON CONFLICT (id) DO NOTHING`, fired by `on_auth_user_created AFTER INSERT ON auth.users` (`supabase/migrations/20260516000001_initial_schema.sql:37-53`). The client never inserts a profile and never uses service-role; email/password `signUp` only passes `display_name` via auth metadata (`authApi.ts:108`). The foundation provisioning card answers: where (trigger), email/pw creates profile (yes), client-vs-server (server), missing-profile self-heal (idempotent, service-role-free), idempotent upsert (`ON CONFLICT DO NOTHING`), same-email handling (deferred to the Google ADR), no enumeration, no client service-role. A Google identity carries name under different metadata keys (`full_name`/`name`) than `display_name` — the likely real work item, handled in #747.

## 4. Invite/redirect continuity

Pending-invite intent already survives cold start + email-confirmation round-trips via a device-local AsyncStorage slot with a 24h freshness window (`src/features/invites/pendingInviteIntent.ts:31-181`), and resumes at `InviteRedeemGate` which auto-fires server-side `acceptRoomInvite` on (signed-in + pending + email-match) (`src/features/invites/InviteRedeemGate.tsx:124-134`). Acceptance and new-user provisioning go through the Edge Function only — the client NEVER inserts directly and NEVER uses service-role (`src/features/invites/inviteApi.ts:212-238`). The foundation card specifies the **provider-independent** requirement: the same intent must resume after a Google OAuth redirect (not just email confirmation), enforced server-side with no capacity/seat bypass, no direct `public.arguments` insert, and no enumeration.

## 5. Google dependency

The Google lane is strictly downstream. It depends on this foundation for: the redirect allow-list inventory (1), the provider UI slot (2), the provisioning model (3), and the invite-continuity contract (4). See `docs/designs/AUTH-GOOGLE-SSO-INDEX.md`.

## 6. Facebook deferred

Facebook SSO is DEFERRED post-launch (#749): no setup, UI, secrets, or config now. Blocked until launch + Google stable in prod + operator re-approval; any future review must cover Facebook app-review, privacy, and provider config.

## 7. GATE-C items in/under this lane
- #741 — GATE-C only if the missing-profile self-heal needs a migration / server write.
- #745 (config), #747 (provisioning impl), #748 (redemption impl) — GATE-C (downstream).
- #749 — GATE-C when eventually built; not now.

## Doctrine + reference notes
Secrets never in repo/client; no service-role in client; Supabase Auth stays identity owner; email/password fallback always preserved; plain-language, no-enumeration error states. The design package (`.tmp/slate002-ref/redesign-zip/handoff/`) is feature/IA inspiration only — no slogans are lifted; user-facing copy reuses existing repo-canonical `brandCopy`/`inviteCopy` constants or original plain wording.
