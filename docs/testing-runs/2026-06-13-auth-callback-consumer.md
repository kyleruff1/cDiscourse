# AUTH-CALLBACK-CONSUMER-001 — seed-smoke readiness (callback consumer + set-password)

**Date:** 2026-06-13
**Card:** AUTH-CALLBACK-CONSUMER-001 (Supabase invite callback + password-set flow)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/607
**Branch:** `feat/AUTH-CALLBACK-CONSUMER-001-invite-callback`
**Design (binding spec):** `docs/designs/AUTH-CALLBACK-CONSUMER-001.md`

---

## Verdict

**`READY_FOR_SEED_SEND`**

The `/auth/callback` consumer is implemented, gated, and proven end-to-end with a
**synthetic, mock-driven** invite callback URL — no live invite was sent and no
hosted Supabase config was changed by this card. The readiness criteria from the
design are all met:

- `npx tsc --noEmit` → exit 0.
- Scoped `eslint` over the 4 new + 2 modified source files + 7 test files → exit 0.
- Full `npx jest --silent --ci` → **754 suites / 30436 passed, 1 skipped (30437 total), exit 0** (up from the branch-base baseline of 747 suites / 30289 passed + 1 skip = 30290 total: **+7 suites, +147 tests**, nondecreasing).
- The synthetic invite callback URL flows `parseAuthCallbackUrl → consumeAuthCallback({client: mock}) → needs_password → set-password (updateUser mock) → password_set`, pinned in `__tests__/authCallbackSmokeReadiness.test.ts` and `__tests__/AuthCallbackScreen.test.tsx`.

This verdict gates the **downstream** G1 live smoke (receipt → render → CTA →
`/auth/callback` → account setup → sign-in). It is **not** a request to send
anything now. The operator runs the live second pass when ready (checklist below).

---

## Redirect URL to use for the seed invite

```
https://<deployed-origin>/auth/callback
```

`<deployed-origin>` is whichever host actually serves the SPA. On web,
`resolveRuntimeOrigin()` uses the real `window.location.origin`, so the origin to
allow-list is the host the seed recipient will actually open. Per the design's
risk note there is a live discrepancy to reconcile at send time:

- `supabase/config.toml` names `dev-cdiscourse.netlify.app`.
- `buildAuthRedirectUrl.ts` `HOSTED_FALLBACK_ORIGIN` = `dev.cdiscourse.com`.

`buildAuthRedirectUrl({ kind: 'invite', runtimeOrigin: 'https://dev.cdiscourse.com', isDev: false })`
returns `https://dev.cdiscourse.com/auth/callback` (pinned in
`__tests__/authCallbackRouting.test.ts`). Whatever origin serves the SPA must be
the one passed to `--redirect-to` AND the one present in the Supabase redirect
allow-list (G4) — otherwise GoTrue ignores `redirect_to` and falls back to the
dashboard Site URL and the callback screen never loads.

The fragment never reaches the server (browser-only), so only the **path**
`/auth/callback` needs SPA fallback — already covered on Netlify
(`netlify.toml` `/* → /index.html 200`) and Cloud Run (`serve -s`). No host
change is required by this card.

---

## Callback shapes implemented (design point 1)

| Shape | Where | Method | This project | Outcome |
|---|---|---|---|---|
| (a) query-code `?code=…` | query | `exchangeCodeForSession(code)` | **defensive only** (PKCE not configured) | `needs_password` if `type=invite` else `success` |
| (b) fragment-token `#access_token=…&refresh_token=…&type=invite` | fragment | `setSession({access_token, refresh_token})` | **PRIMARY** (implicit flow — what the seed lands as) | `needs_password` for invite |
| (c) error `?error=…` / `#error=…&error_code=…` | query or fragment | none | yes (e.g. expired link) | `error` → plain recoverable copy |
| (d) empty / invalid | — | `getSession()` probe only | yes (refresh after consume) | `already_session` or `error:link_invalid` |
| `token_hash`+`type` (verifyOtp) | query | NOT consumed in v1 | possible if template switches to `{{ .TokenHash }}` | `unsupported` → plain copy + diagnostics record `token_hash` |

Only `type=invite` returns `needs_password`. `signup` / `magiclink` /
`email_change` / missing-type establish the session and continue (`success`).
`recovery` is future-scoped via `/auth/reset`.

---

## Doctrine + posture confirmations

- `src/lib/supabase.ts` `detectSessionInUrl: false` is **unchanged** (the consumer reads the URL manually; flipping it would race the manual path). Pinned in `__tests__/authCallbackRouting.test.ts`.
- No migration, no Edge Function, no RLS, no SQL, no hosted Supabase config change, no provider call, no second auth client (the existing `src/lib/supabase.ts` singleton is reused).
- No service-role / Anthropic key in any new client file (source-scan tests + `grep` clean).
- The password is sent only into `supabase.auth.updateUser({ password })`; never logged, never persisted, never returned in a diagnostic. Tokens are `***`-redacted by `redactAuthCallbackUrl`.
- Sign-in / sign-up / reset / signOut wrappers are behaviourally unchanged — only `validateNewPassword` + `setInvitedUserPassword` were appended to `authApi.ts`.
- Copy is plain link-state language only (ban-list test over `AUTH_CALLBACK_COPY`).
- No live or batch invite send is possible from these modules (source-scan in `__tests__/authCallbackSmokeReadiness.test.ts`).

---

## Operator seed-send checklist (DO NOT run any send as part of this card)

These are the existing smoke-doc preconditions
(`docs/testing-runs/2026-06-13-auth-branded-invite-smoke.md`), repeated here so the
operator can run the **downstream** G1 live pass after this card merges:

1. **G4 — redirect allow-list:** confirm the deployed origin that serves the SPA (Netlify `dev-cdiscourse.netlify.app` or Cloud Run `dev.cdiscourse.com`) is in **Supabase Auth → URL Configuration → Redirect URLs**.
2. **G2 — custom SMTP:** confirm custom SMTP is configured in hosted Auth settings (default SMTP is rate-limited and not for arbitrary external addresses).
3. **G3 — branded template:** paste `supabase/templates/invite.html` into **Dashboard → Authentication → Email Templates → "Invite user"** (gated by `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE`).
4. **G1 — live send + verify (operator-gated):** arm `CDISCOURSE_ALLOW_INVITE_SEND_SMOKE=1` + seed env, then run
   `node scripts/auth/sendInviteSmoke.js --live --email <seed> --redirect-to https://<origin>/auth/callback --smtp-posture custom`,
   open the emailed link, and verify the callback screen → set-password → sign-in end to end.

**For this card's code change itself: no operator deploy.** Pure client-side
change — no `db push`, no `functions deploy`, no hosted config, no secret, no env
var, no new dependency. **GATE-C: stop at PR; operator-gated merge (auth/session
behaviour).**

---

## Files

New (4 source + 7 test + this doc):

- `src/lib/auth/parseAuthCallbackUrl.ts`
- `src/features/auth/consumeAuthCallback.ts`
- `src/features/auth/authCallbackCopy.ts`
- `src/features/auth/AuthCallbackScreen.tsx`
- `__tests__/parseAuthCallbackUrl.test.ts`
- `__tests__/consumeAuthCallback.test.ts`
- `__tests__/authCallbackSetPassword.test.ts`
- `__tests__/AuthCallbackScreen.test.tsx`
- `__tests__/authCallbackCopy.test.ts`
- `__tests__/authCallbackRouting.test.ts`
- `__tests__/authCallbackSmokeReadiness.test.ts`

Modified (2):

- `src/features/auth/authApi.ts` (+`validateNewPassword`, +`setInvitedUserPassword`)
- `App.tsx` (synchronous `/auth/callback` capture + highest-priority screen branch + header dock)
