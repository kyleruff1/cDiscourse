# AUTH-GOOGLE-SSO-001 — Google SSO architecture design

> Architecture/design for Google sign-in via Supabase Auth OAuth, strictly downstream of the provider-agnostic foundation (`docs/designs/AUTH-FOUNDATION-INDEX.md`) and bound by the ADR (`docs/adr/AUTH-GOOGLE-SSO-ADR-001.md`). **Design-only** — no provider call, no config change, no secret here. Hosted Google config is GATE-C and operator-run (#745).

**Issue:** https://github.com/kyleruff1/cDiscourse/issues/744
**Decision root:** AUTH-GOOGLE-SSO-ADR-001 (#743)
**Precedes:** #745 (config), #746 (UI), #747 (provisioning), #748 (redemption)

---

## 1. Client initiation (the new wrapper)

There is **no** `signInWithOAuth` today; the live auth surface is email/password (`src/features/auth/authApi.ts:185-211`). The design adds a new `signInWithGoogle` wrapper that parallels the existing wrappers (same `AuthResult` shape, same `SUPABASE_CONFIGURED` gate, **no secret**):

```
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo }
})
```

- `redirectTo` is derived from `buildAuthRedirectUrl` (`src/lib/auth/buildAuthRedirectUrl.ts:161`) so the post-auth landing is `/auth/callback`. Because `AuthRedirectKind` is the five email flows (`buildAuthRedirectUrl.ts:18-23`) and does not name an OAuth kind, the wrapper passes an **explicit `route: '/auth/callback'`** (the `route` override is supported at `buildAuthRedirectUrl.ts:165-169`) rather than overloading an email kind. The origin is resolved via `resolveRuntimeOrigin()` + `getIsDev()` (`src/lib/auth/resolveRuntimeOrigin.ts:34-60`).
- Redirect failure degrades the same way email flows do: `safeBuildRedirect` returns `null` on `InvalidAuthRedirectOrigin` (`authApi.ts:73-83`) and the caller omits `redirectTo`, letting Supabase fall back to the dashboard Site URL — a redirect-config defect is advisory, never a hard block.
- No client secret is involved in initiation; the OAuth secret is held only by Supabase/Google (#745).

## 2. Redirect allow-list matrix (per environment)

The Supabase **Google callback URI** (`https://<ref>.supabase.co/auth/v1/callback`, project ref `qsciikhztvzzohssddrq`) is registered in the **Google Cloud** console as the OAuth client's authorized redirect URI. The **app return URL** (`…/auth/callback`) must be on the **Supabase** redirect allow-list. Both are required for a complete round-trip.

| Environment | App origin (resolved) | App return URL (must be on Supabase allow-list) | Where allow-listed |
|---|---|---|---|
| Local Expo web | `http://localhost:8081` | `http://localhost:8081/**` | `supabase/config.toml:164-170` (local) |
| Netlify dev (stable) | `https://dev-cdiscourse.netlify.app` | `https://dev-cdiscourse.netlify.app/**` | `config.toml:167-168` (local mirror) + hosted Dashboard/Management API |
| Netlify dev (per-deploy preview) | `https://<hash>--dev-cdiscourse.netlify.app` | `https://*--dev-cdiscourse.netlify.app/**` | `config.toml:169` + hosted allow-list |
| Prod (when it exists) | launch host | `<launch-host>/**` | hosted allow-list only |

The Google Cloud authorized-redirect-URI value is the **Supabase** callback, the same for every app environment: `https://qsciikhztvzzohssddrq.supabase.co/auth/v1/callback`. (Operator step — #745.)

**Fallback-origin reconciliation (assertion):** `HOSTED_FALLBACK_ORIGIN = https://dev.cdiscourse.com` (`buildAuthRedirectUrl.ts:65`) is **not** the deployed host; the deployed host is `https://dev-cdiscourse.netlify.app` (`config.toml:167`). At runtime the deployed SPA resolves its origin from `window.location.origin` (`resolveRuntimeOrigin.ts:37-43`), so the `dev.cdiscourse.com` literal is only reached when no runtime origin resolves in a non-dev build — which should not happen on Netlify. **Before the Google operator smoke, assert the resolved runtime origin (`https://dev-cdiscourse.netlify.app`, not the `dev.cdiscourse.com` fallback literal) is on the hosted Supabase redirect allow-list** (cross-ref #739). An unreconciled origin is silently dropped to the Site URL and breaks the round-trip. The literal mismatch is tracked as a docs/code reconciliation item (cosmetic at runtime, load-bearing if the fallback path is ever exercised).

## 3. Callback + session recovery (reuse, no parallel callback)

The Google round-trip lands on the existing consumer — there is **no** parallel callback:

- `parseAuthCallbackUrl` + `AuthCallbackScreen` route the URL to `consumeAuthCallback`.
- A Google PKCE return carries a `code`; `consumeAuthCallback` hits its defensive PKCE branch and calls `exchangeCodeForSession` (`src/features/auth/consumeAuthCallback.ts:162-170`).
- **Outcome rule:** Google is not an invite, so `isInvite(parsed.type)` is false and the branch returns `{ status: 'success' }` — **not** `needs_password`. `needs_password` is reserved for the passwordless **invite** flow only (`consumeAuthCallback.ts:51-54`, `:156`, `:167`). OAuth users have no password step.
- The bounded-timeout guard (`DEFAULT_CONSUME_TIMEOUT_MS = 12_000`, `consumeAuthCallback.ts:84`) applies unchanged, so a stalled GoTrue exchange recovers to a plain `network` error instead of hanging.

## 4. One-click account creation

First Google use → Supabase inserts the `auth.users` row → the existing `handle_new_user` trigger fires (`supabase/migrations/20260516000001_initial_schema.sql:37-53`) → a `public.profiles` row is created with `ON CONFLICT (id) DO NOTHING` (`:46`). No extra client step, no client insert. This is the single "Continue with Google" link doing both create-and-sign-in per the ADR.

## 5. Provisioning dependency + same-email handling

- **Dependency on #741 / #747.** The trigger reads only `display_name` from metadata (`migration …:45`), while Google supplies `full_name` / `name`. A Google user therefore risks a **null display_name**. #747 verifies the trigger suffices and, if a mapping is needed, adds a **NEW** migration to coalesce `display_name` / `full_name` / `name` (never edits the applied migration). The OAuth metadata key difference from the email path (which sets `display_name`, `authApi.ts:108`) is the concrete reason this is real work, not a no-op.
- **Same-email rule** follows the ADR (`docs/adr/AUTH-GOOGLE-SSO-ADR-001.md` §Same-email handling): link-vs-distinct is fixed at config time (#745) and honored in #747; **never takeover, never enumerate**, no service-role in client.

## 6. Invite / redeem continuity

The pending invite intent must survive the OAuth round-trip and resume at the gate (#742, impl #748):

- Intent persists in AsyncStorage with a 24h freshness window (`src/features/invites/pendingInviteIntent.ts:35`, `:63`).
- After the Google callback consume reaches the first signed-in state, `InviteRedeemGate` re-reads the intent and auto-fires accept on (signed-in + live pending + server-side email match) (`src/features/invites/InviteRedeemGate.tsx:124-134`).
- Acceptance is **server-side only** via the Edge Function (`src/features/invites/inviteApi.ts:212-216`); the email-binding check (Google account email vs invited email) runs server-side and surfaces `invite_email_mismatch` as plain copy with no enumeration. The client never inserts to `public.arguments` and never holds service-role.

## 7. No enumeration / no service-role / secrets posture

- No client secret anywhere; the OAuth secret is a Supabase secret only (#745).
- No service-role in the client; every privileged write goes through an Edge Function.
- Error states are plain-language via `mapAuthError` + `REDIRECT_INVALID_MESSAGE` (`authApi.ts:13-14`, `:43-62`); no internal codes, no verdict tokens, no slogans, no existence disclosure.

## 8. Native vs web scope decision

`app.json` declares **no** deep-link `scheme` (confirmed by repo grep). Therefore **Google ships web-first at launch** (Netlify dev, then prod). Native Google is **out of scope** for this lane; if/when a native build ships, a `scheme` plus a native redirect URI (and the matching Google Cloud + Supabase allow-list entries) become a prerequisite and earn their own card. This design does not add a `scheme`.

## 9. Test + operator-smoke plan (gated; not executed here)

**Unit tests (land with #746):**
- `signInWithGoogle` calls `signInWithOAuth` with `provider: 'google'` and a `redirectTo` derived from `buildAuthRedirectUrl` (asserted via a Supabase mock, never a live call).
- The wrapper refuses (returns the config-missing `AuthResult`) when `SUPABASE_CONFIGURED` is false, and never throws.
- Component: the email/password fallback still submits; **no** Facebook/Apple button is rendered.
- Accessibility: the button meets tap-target + screen-reader-label requirements (accessibility-targets skill).

**Provisioning verification (land with #747):**
- One profile row per Google user; repeated sign-in never duplicates (idempotency).
- display_name populated (or its absence explicitly accepted with rationale) if the coalescing migration lands; resulting profile-row shape asserted.

**Invite-resume test (land with #748):**
- Pure decision test: intent resume after OAuth callback → first signed-in → auto-accept fires on email match; plain mismatch/expired/closed otherwise.

**Operator smoke (GATE-C, operator-run against `dev-cdiscourse.netlify.app`, NOT run by Claude):**
1. Precondition: assert the resolved runtime origin (`https://dev-cdiscourse.netlify.app`) is on the hosted Supabase redirect allow-list (§2).
2. Tap "Continue with Google" → Google consent → return to `/auth/callback` → `success` session established (not `needs_password`).
3. Verify exactly one `public.profiles` row; verify display_name behavior matches #747.
4. Invite path: open an invite link, sign in with Google, confirm auto-accept on email match and the plain mismatch state otherwise.
5. Confirm email/password sign-in still works (fallback preserved).

## 10. Doctrine self-check

- No client secret; no service-role in client. ✓
- Supabase Auth identity ownership preserved; reuses the existing callback consumer. ✓
- Email/password fallback preserved. ✓
- OAuth never bypasses seat/invite rules — server-side acceptance. ✓
- Plain-language, no-enumeration states. ✓
- No provider call by Claude; design-only. ✓
- No copied reference slogans; the only conventional string downstream is "Continue with Google" (authored in #746). ✓
