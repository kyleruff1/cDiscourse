# AUTH-GOOGLE-SSO-ADR-001 — Google as the first social sign-in provider + one-link account creation

**Status:** Accepted
**Date:** 2026-06-20
**Deciders:** operator (kyleruff@gmail.com)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/743
**Slate:** CIVILDISCOURSE-FEATURE-REPOSITORY-SLATE-002 — auth-foundation → Google-SSO (index `docs/designs/AUTH-GOOGLE-SSO-INDEX.md`)
**Foundation lane (must precede):** AUTH-FOUNDATION-INDEX (`docs/designs/AUTH-FOUNDATION-INDEX.md`) — #739, #740, #741, #742
**Governs (binds):** AUTH-GOOGLE-SSO-001 (#744), AUTH-GOOGLE-SSO-002 (#745), AUTH-GOOGLE-SSO-003 (#746), AUTH-GOOGLE-SSO-004 (#747), AUTH-GOOGLE-SSO-005 (#748)

> This ADR is the durable decision root for adding Google sign-in to CivilDiscourse. It ratifies the scope change, fixes the constraints every downstream Google card must satisfy, and names the GATE-C items. It is **DOCS-ONLY** — it changes no config, ships no code, and makes no provider call. No secret appears here.

---

## § Context

The live auth path today is **email/password only**: `signInWithPassword` (`src/features/auth/authApi.ts:197`) and `signUp` (`src/features/auth/authApi.ts:104`). There is **no** `signInWithOAuth` anywhere in `src/` (confirmed by repo grep). The auth-email redirect builder maps the five email flows to `/auth/callback` / `/auth/reset` (`src/lib/auth/buildAuthRedirectUrl.ts:47-53`), and the callback consumer already contains a defensive PKCE branch that calls `exchangeCodeForSession` (`src/features/auth/consumeAuthCallback.ts:162-170`).

Historically, v1 explicitly **excluded** OAuth / social login: CLAUDE.md states "No OAuth / social login (email+password only in v1)" and the doctrine repeats it (cdiscourse-doctrine §10). The reference design, however, positions Google as the primary social button (`.tmp/slate002-ref/redesign-zip/handoff/structure/03-mobile-flow.md:34-42`, `:74`). This ADR is the deliberate decision to move social login from the v1 scope-guard onto the launch path — **Google only**.

Provisioning is already provider-independent at the database layer: the `handle_new_user` trigger fires on **any** `auth.users` insert, including an OAuth insert (`supabase/migrations/20260516000001_initial_schema.sql:37-53`, with `ON CONFLICT (id) DO NOTHING` at `:46`). So adding Google does not require a new IdP — it adds one external provider behind the existing Supabase Auth identity owner.

---

## § Decision

1. **Google is the FIRST social provider.** Apple and Facebook are explicitly **not in this lane**. Facebook is deferred post-launch (#749): no setup, UI, or secrets now; blocked until launch + Google stable + operator re-approval.
2. **Supabase Auth remains the identity owner.** Google is an *external provider*, not a replacement IdP. Sessions, tokens, and the `auth.users` record stay owned by Supabase Auth.
3. **One-link account creation.** A single "Continue with Google" affordance both creates an account on first use and signs in on return — there is no separate "sign up with Google" path. First use → `auth.users` insert → `handle_new_user` trigger → `public.profiles` row, with no extra client step.
4. **Hosted Google provider configuration is GATE-C and operator-run** (#745): the Google Cloud OAuth client (id/secret), consent screen, the Supabase callback redirect URI, and the hosted Supabase redirect allow-list are all changed only in the operator consoles / Management API. **Claude does not run #745.**
5. **The Google client secret is NEVER in the repo or client.** It lives only as a Supabase secret (and, for local-dev parity only, an `env(...)`-substituted, disabled-by-default `[auth.external.google]` block mirroring the Apple shape at `supabase/config.toml:359-372`). The conventional config substitution form is `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`.
6. **Email/password is permanently preserved as a fallback.** The existing wrappers and the always-present email/password form remain the canonical path; Google is additive.
7. **OAuth MUST NOT bypass invite / seat / room rules.** Invite acceptance stays server-side via the Edge Function (`src/features/invites/inviteApi.ts:212-216`); a Google-authenticated invitee is bound by the same server-side email-binding and capacity checks as an email/password invitee. The client never inserts to `public.arguments` and never holds service-role.
8. **Provisioning is idempotent and provider-independent** (#741, #747): repeated Google sign-ins yield exactly one profile row; the `ON CONFLICT (id) DO NOTHING` guard is the idempotency spine.
9. **No account enumeration; no service-role in client.** Same-email behavior (link vs distinct identity) is decided in §Same-email handling below; in no case may a Google sign-in *take over* an existing email/password account, and no error may reveal whether a given email already exists.

---

## § Same-email handling (binding rule for #747)

When the email returned by Google matches an email already present in `auth.users`, the resolved behavior depends on the hosted project's identity-linking setting and is therefore decided **at config time** (#745) and honored in provisioning (#747). The binding constraints are:

- **Never takeover.** A Google sign-in must never silently grant access to an account that was created with email/password, nor overwrite its credentials.
- **Never enumerate.** Whether the email already exists must not be disclosed by the error or success copy; states are plain-language and identical in shape regardless of prior existence.
- The chosen mode (automatic linking of identities under one user, OR distinct identities) is recorded in #745's runbook and asserted by #747's verification. Until that is fixed, downstream cards treat "distinct, no-takeover, no-enumeration" as the safe default.

---

## § Alternatives considered

- **Magic-link-only (no social provider).** Lower config surface and no Google Cloud project, but it does not deliver the one-tap social entry the reference design calls for and keeps friction high for first-run users. Rejected for launch; magic link may still be added later independently.
- **Apple first.** Apple Sign In is required by App Store policy *if* another social login ships on iOS, but the launch surface is web-first (`https://dev-cdiscourse.netlify.app`) and `app.json` declares no native deep-link `scheme` today, so an Apple-native flow is premature. Deferred; revisit when native ships.
- **Facebook in the same lane.** Rejected — Facebook adds app-review, privacy-policy, and provider-config burden that would gate the whole lane. Deferred to #749 post-launch.
- **Custom OAuth / replacement IdP.** Rejected — it would displace Supabase Auth as identity owner, contradicting the foundation and multiplying secret-handling and RLS risk.

---

## § Consequences

- **Scope change is deliberate and recorded.** This ADR supersedes the blanket v1 "no OAuth" guard *for Google only*; the rest of the v1 scope-guard list (cdiscourse-doctrine §10) is unchanged. Any future provider still requires its own ADR.
- A new client wrapper (`signInWithGoogle`) and a provider button slot are introduced downstream (#744 design, #740 slot, #746 impl); the wrapper carries **no secret**.
- A likely NEW migration coalesces the Google display-name metadata (`full_name` / `name`) the trigger does not currently read (it reads only `display_name`, `supabase/migrations/20260516000001_initial_schema.sql:45`); that migration is migration-bearing → heightened reviewer verification (#747).
- The hosted redirect allow-list and Google Cloud callback URI become operational dependencies; the Google button is **inert** until #745 lands.
- A documentation discrepancy must be reconciled: `HOSTED_FALLBACK_ORIGIN = https://dev.cdiscourse.com` (`src/lib/auth/buildAuthRedirectUrl.ts:65`) vs the actual deployed host `https://dev-cdiscourse.netlify.app` (`supabase/config.toml:167`). Tracked in #744.

---

## § GATE-C designation (this ADR does not perform any of these)

| Item | Card | Why GATE-C |
|---|---|---|
| Hosted Google provider config + secret + redirect allow-list | #745 | Operator console / Management API; identity- and secret-bearing |
| OAuth provisioning (likely display-name migration) | #747 | Migration / server write; migration-bearing review |
| Invite redemption through Google (if Edge/RLS change needed) | #748 | Server-side acceptance path |

The "Continue with Google" UI + wrapper (#746) is **not** GATE-C by itself, but is inert until #745 and ships behind that ordering.

---

## § Doctrine self-check

- Google client secret never in repo/client — Supabase secret only (decision §5). ✓
- Supabase Auth identity ownership preserved (decision §2). ✓
- Email/password fallback permanently preserved (decision §6). ✓
- OAuth never bypasses seat/invite rules — server-side acceptance (decision §7). ✓
- Idempotent, provider-independent provisioning (decision §8; `ON CONFLICT … DO NOTHING`). ✓
- No enumeration; no service-role in client (decision §9; §Same-email). ✓
- No truth / winner / verdict / person-judgment surface — auth is identity, not gameplay; no scoring or moderation copy introduced. ✓
- No provider call by Claude; docs-only. ✓
- No copied reference slogans; the only conventional string downstream is the standard "Continue with Google" affordance, authored in #746. ✓
