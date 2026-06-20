# AUTH-GOOGLE-SSO — Index

> Provider-specific Google sign-in plan, strictly downstream of the provider-agnostic foundation (`docs/designs/AUTH-FOUNDATION-INDEX.md`). Design/docs only — no provider call, no hosted config change, no secret here. Hosted Google config is GATE-C and operator-run.

## Why Google first
The reference design positions Google as the primary social button (`.tmp/slate002-ref/redesign-zip/handoff/structure/03-mobile-flow.md:34-42`, `:74`). Historically v1 excluded OAuth (cdiscourse-doctrine §10); #743 ratifies the scope change to add **Google only** for launch (Apple/Facebook excluded from this lane). Supabase Auth remains the identity owner; Google is an external provider, not a replacement IdP.

## Cards (in order)

| Card | Title | GATE-C | Issue |
|---|---|---|---|
| AUTH-GOOGLE-SSO-ADR-001 | ADR: Google first + one-link account creation | No | #743 |
| AUTH-GOOGLE-SSO-001 | Architecture design | No | #744 |
| AUTH-GOOGLE-SSO-002 | Hosted Google config + redirect allow-list (operator) | **Yes** | #745 |
| AUTH-GOOGLE-SSO-003 | "Continue with Google" UI impl | No | #746 |
| AUTH-GOOGLE-SSO-004 | OAuth profile provisioning impl | Maybe | #747 |
| AUTH-GOOGLE-SSO-005 | Invite/room redemption through Google SSO | Maybe | #748 |

## Foundation dependency (must precede this lane)
- Redirect allow-list inventory → #739
- Provider UI slot → #740
- Provisioning model → #741
- Invite-continuity contract → #742

## Architecture summary
- **Initiation**: a new `signInWithGoogle` client wrapper paralleling `src/features/auth/authApi.ts:185` calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`, with `redirectTo` from `buildAuthRedirectUrl` (`src/lib/auth/buildAuthRedirectUrl.ts:161`). No client secret.
- **Callback/session**: reuse the existing consumer — `consumeAuthCallback` already handles the PKCE `exchangeCodeForSession` branch (`src/features/auth/consumeAuthCallback.ts:162-170`). Google returns `success` (not `needs_password`, which is invite-email-only, `:51-54`).
- **One-click create**: Google first-use → `auth.users` insert → `handle_new_user` trigger → `public.profiles` row (`supabase/migrations/20260516000001_initial_schema.sql:37-53`); no extra client step.
- **Redirect URLs**: local `localhost:8081`, Netlify dev `dev-cdiscourse.netlify.app` (+ preview hashes), prod when it exists. The Supabase Google callback (`https://<ref>.supabase.co/auth/v1/callback`) is registered in the Google Cloud console; the app return URL is on the Supabase allow-list. Reconcile the `dev.cdiscourse.com` vs `dev-cdiscourse.netlify.app` fallback-origin literal (`buildAuthRedirectUrl.ts:65`).
- **Native vs web**: `app.json` declares no deep-link `scheme` — if native Google ships, a `scheme` + native redirect URI is required; decide launch platform scope in #744.

## Provisioning (Google specifics)
The `handle_new_user` trigger fires for OAuth users too, but reads only `display_name` from metadata (`authApi.ts:108`), while Google supplies `full_name`/`name`. #747 verifies the trigger suffices and, if needed, adds a NEW migration to coalesce the display name — idempotent, service-role-free on the client, RLS preserved. Same-email handling follows the ADR (link vs distinct; never takeover; no enumeration).

## Invite redemption through Google
The pending intent (`pendingInviteIntent.ts:31-181`) must be re-read after the Google callback consume → first signed-in state so `InviteRedeemGate` resumes its server-side `acceptRoomInvite` (`InviteRedeemGate.tsx:124-134`). Capacity/seat/invite-binding stay server-side; the client never inserts to `public.arguments` and never uses service-role (`inviteApi.ts:224-227`). #748.

## GATE-C + operator gates
- #745 — hosted provider config + secrets + redirect allow-list: GATE-C, operator console access required, Claude does NOT run it; per the pipeline governance contract this is never self-approved.
- #747 / #748 — GATE-C only if they require migration / Edge / RLS changes (migration-bearing → heightened reviewer verification).

## Facebook deferred
Facebook is NOT in this lane. #749 is deferred post-launch only; no setup/UI/secrets now; blocked until launch + Google stable + operator re-approval; future review must include Facebook app-review/privacy/provider-config.

## Doctrine + reference notes
Google client secret NEVER in repo/client (Supabase secret only); no service-role in client; Supabase Auth identity ownership preserved; email/password fallback preserved; OAuth never bypasses seat/invite rules; plain-language, no-enumeration states. Reference package is inspiration only; the only standard provider string used is the conventional "Continue with Google" affordance label — no marketing slogans are lifted.
