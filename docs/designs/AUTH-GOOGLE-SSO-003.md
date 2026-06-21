# AUTH-GOOGLE-SSO-003 — "Continue with Google" UI

**Status:** Design draft
**Epic:** Epic 18 — Google SSO (one-link account creation)
**Release:** Launch (priority p0)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/746

> Design-only. NO production code, NO provider call, NO hosted config change, NO
> secret, NO deploy. Strictly downstream of the merged architecture design
> (`docs/designs/AUTH-GOOGLE-SSO-001.md`, #744), the ADR
> (`docs/adr/AUTH-GOOGLE-SSO-ADR-001.md`, #743), the provider-slot foundation
> (`src/features/auth/authProviderSlotModel.ts`, #740/#760), the verified hosted
> config (#745, `external_google_enabled=true` on 2026-06-21), and the merged
> provisioning trigger (#747). Invite resume (#748) is OUT of scope.

---

## Goal (one paragraph)

Expose a live "Continue with Google" affordance on the Sign In screen and wire it
to a thin `signInWithGoogle` client wrapper that initiates the Supabase OAuth
redirect, returning through the EXISTING `/auth/callback` consumer. The button is
gated behind a conservative, default-OFF runtime flag so merging this card does
NOT change the live Sign In surface until the operator opts in at deploy time —
matching the held-publish posture and keeping the existing email-only-default
tests valid. Email/password remains the always-present, byte-identical fallback;
no Facebook, no Apple. The design respects cdiscourse-doctrine in full: the
wrapper holds **no client secret** and **no service-role**, all error/unavailable
states are plain language (no internal codes, no verdict tokens, no reference
slogans), the OAuth provider call appears in exactly ONE allow-listed file, and
the redirect target is always the resolved current origin (never a hard-coded
`dev.cdiscourse.com`). The doctrine note: cdiscourse-doctrine §10 historically
listed "email+password only in v1 / no OAuth"; ADR #743 ratifies the deliberate,
operator-sanctioned scope change to add **Google only** for launch (Supabase Auth
remains the identity owner). This card is the UI half of that ratified evolution
— see the Doctrine self-check.

---

## Surface mapping table

| Surface | Current | Desired | Provider-config dep | Callback dep | Source file | Tests | Behavior touched? | Semantics touched? | Safe-now / defer |
|---|---|---|---|---|---|---|---|---|---|
| Provider-slot region (enabled branch) | Empty `<View testID="auth-provider-region" />` placeholder (never reached in v1; `hasVisibleProvider` is false by default) | Real `Button` labeled with `CONTINUE_WITH_GOOGLE_LABEL`, `onPress={signInWithGoogle}` | #745 LIVE (verified) — but button render is gated on a separate default-OFF runtime flag, so config-live ≠ button-shown | Reuses existing `/auth/callback` consumer; NO callback change | `src/features/auth/AuthScreen.tsx` (modified) | `authScreenProviderRegion.test.tsx` (extended) | Yes (new button when flag on) | No (no room/seat/score/mediator semantics) | Safe-now (default OFF) |
| Provider gate | None | `resolveGoogleAuthEnabled()` → true ONLY when `SUPABASE_CONFIGURED && EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'` | n/a (reads a public flag, not the secret) | n/a | `src/features/auth/googleAuthGate.ts` (new) | `googleAuthGate.test.ts` (new) | No (pure decision) | No | Safe-now |
| OAuth initiation wrapper | None (no `signInWithOAuth` anywhere in `src/`) | `signInWithGoogle()` → `supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } })`, returns `AuthResult` | Provider must be live to complete the round-trip (it is, #745); wrapper is inert-but-safe if not | redirectTo resolves to `<currentOrigin>/auth/callback`; consumer already handles the return | `src/features/auth/signInWithGoogle.ts` (new — the ONLY file allowed `signInWithOAuth`) | `signInWithGoogle.test.ts` (new) | Yes (initiates redirect) | No | Safe-now |
| Error-mapping reuse | `mapAuthError` is module-private to `authApi.ts` | Export `mapAuthError` from `authApi.ts` so the wrapper reuses it (single source of truth) | n/a | n/a | `src/features/auth/authApi.ts` (modified — add `export`) | covered by existing `authApiRedirect.test.ts` + new wrapper test | No (additive export; no logic change) | No | Safe-now |
| Provider model (`authProviderSlotModel.ts`) | Pure model; default email-only; future-consumable enabled-slot path already exists + tested | UNCHANGED (model stays pure; #746 only consumes it) | n/a | n/a | none | `authProviderSlotModel.test.ts` (unchanged) | No | No | Safe-now |
| Callback parser / consumer | Bare `?code=` already → `{kind:'code', type:null}` → `exchangeCodeForSession` → `success` | UNCHANGED (verified — see "parseAuthCallbackUrl verification") | n/a | This IS the dep; no change | none | existing `parseAuthCallbackUrl.test.ts` + `consumeAuthCallback.test.ts` (unchanged) | No | No | Safe-now |
| `buildAuthRedirectUrl` | 5 email `AuthRedirectKind`s; supports explicit `route` override | UNCHANGED — wrapper passes explicit `route: '/auth/callback'` with an existing kind (per merged architecture design §1) | n/a | n/a | none | existing `buildAuthRedirectUrl.test.ts` (unchanged) | No | No | Safe-now |
| Source-scan guard | `authScreenProviderRegion.test.tsx` asserts "no `signInWithOAuth` anywhere under src/" → `offenders === []` | Relax the src/-walk to a SINGLE-FILE allow-list: `offenders === ['src/features/auth/signInWithGoogle.ts']` | n/a | n/a | `authScreenProviderRegion.test.tsx` (modified) | self | No (test-only) | No | Safe-now |

Net: **3 new files, 3 modified files (1 production export + 2 test files), 0 deleted.** No migration, no Edge Function, no `app.json`/`package.json` change.

---

## Data model

**No new data model.** No DB table, no column, no RLS policy, no migration. No
new domain type in `src/lib/types.ts`.

The wrapper returns the EXISTING `AuthResult<T>` shape
(`src/features/auth/types.ts:17-23`):

```ts
export interface AuthResult<T = void> {
  ok: boolean;
  data?: T;
  error?: AuthError;   // 'invalid_credentials' | … | 'network_error' | 'config_missing' | 'redirect_invalid' | 'unknown'
  message?: string;    // human-readable, safe to show
}
```

`signInWithGoogle()` returns `Promise<AuthResult>` (the `void`-data variant): on a
successful initiation it returns `{ ok: true }` (the redirect itself navigates the
browser away; there is no user payload to return), and on a Supabase error it
returns `{ ok: false, error: mapAuthError(error.message), message: error.message }`.

**`AuthError` union — no change required.** `signInWithOAuth` failures surface as
generic Supabase error messages already covered by `mapAuthError`
(`network_error`, `redirect_invalid`, `unknown`). No new `AuthError` member
(specifically NOT an `'oauth'` member) is needed; adding one would force updates
to every exhaustive switch over `AuthError` for zero behavioral gain.

---

## File changes

### New files

- **`src/features/auth/googleAuthGate.ts`** (~30 lines) — the default-OFF gate.
  Pure decision module. Exports `resolveGoogleAuthEnabled(): boolean` and the
  flag-name constant. Reads the public runtime flag via the SAME resolution
  pattern as `src/lib/supabase.ts` (`readRuntimeEnv()` first, then `process.env`).
  Imports `SUPABASE_CONFIGURED` + `readRuntimeEnv` from `../../lib/supabase`. NO
  React, NO `signInWithOAuth`, NO secret. (Co-locating the gate inside the wrapper
  was considered; a dedicated module keeps the gate independently testable and
  importable by `AuthScreen` without the wrapper pulling in the Button render
  path. See "Wrapper-home decision".)

- **`src/features/auth/signInWithGoogle.ts`** (~45 lines) — the OAuth initiation
  wrapper. **The ONLY file in `src/` permitted to contain the string
  `signInWithOAuth`.** Imports `supabase` + `SUPABASE_CONFIGURED` from
  `../../lib/supabase`, `buildAuthRedirectUrl` from
  `../../lib/auth/buildAuthRedirectUrl`, `resolveRuntimeOrigin` + `getIsDev` from
  `../../lib/auth/resolveRuntimeOrigin`, `mapAuthError` (newly exported) +
  `AuthResult` type from `./authApi` / `./types`. Returns `AuthResult`. Never logs
  the provider response or any token. Guards `SUPABASE_CONFIGURED`. Never throws.

- **`__tests__/signInWithGoogle.test.ts`** (~120 lines) — wrapper unit test,
  mirroring the `authApiRedirect.test.ts` mock pattern.

- **`__tests__/googleAuthGate.test.ts`** (~60 lines) — gate unit test.

### Modified files

- **`src/features/auth/AuthScreen.tsx`** — two surgical changes (see "AuthScreen
  JSX delta"). (1) Add imports for `resolveGoogleAuthEnabled` and
  `signInWithGoogle`; (2) compute `googleEnabled` and pass `enabledSlots` to
  `resolveAuthProviderSlotRegion(...)` conditionally; (3) replace the empty
  placeholder `<View testID="auth-provider-region" />` inside the
  `hasVisibleProvider` branch with a real `Button`. Email/password form, value
  prop, divider, and all styles stay EXACTLY as-is. The file must contain neither
  `signInWithOAuth` nor the substring `oauth` nor the literal `'Continue with
  Google'` (it imports the `CONTINUE_WITH_GOOGLE_LABEL` constant instead) —
  preserving its three existing source guards. Net delta: ~+8 lines.

- **`src/features/auth/authApi.ts`** — change `function mapAuthError` to
  `export function mapAuthError` (1-word additive change, no logic touched) so the
  wrapper reuses the single error-mapping source of truth instead of duplicating
  it. (`safeBuildRedirect` is NOT exported — the wrapper constructs `redirectTo`
  inline with an explicit `route`, see "redirectTo construction"; `safeBuildRedirect`
  takes only a `kind` and cannot express the explicit OAuth route semantics.)

- **`__tests__/authScreenProviderRegion.test.tsx`** — (1) KEEP all existing
  default-OFF tests (flag unset → coming-soon, no Google button — still valid
  because the gate defaults OFF and the existing mock returns
  `readRuntimeEnv: () => ({})`). (2) ADD an "enabled-state" describe block. (3)
  Relax the src/-walk guard from `offenders === []` to the single-file allow-list.

### Deleted files

None.

### `.env.example`

`.env.example` already lists `EXPO_PUBLIC_*` public keys. The implementer SHOULD
add a documented placeholder line so the operator knows the flag exists:

```
# Set to 'true' at deploy (Netlify env) to show the live "Continue with Google"
# button. Unset / any other value keeps Sign In email-only. Requires the hosted
# Google provider to be enabled (AUTH-GOOGLE-SSO-002 / #745).
EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=
```

This is a key NAME with an empty value — safe to commit (cdiscourse-doctrine §6).

---

## API / interface contracts

### Gate — `src/features/auth/googleAuthGate.ts`

```ts
import { SUPABASE_CONFIGURED, readRuntimeEnv } from '../../lib/supabase';

/** Public runtime flag name. Default OFF: unset / any non-'true' value hides Google. */
export const GOOGLE_AUTH_ENABLED_FLAG = 'EXPO_PUBLIC_GOOGLE_AUTH_ENABLED' as const;

/**
 * True ONLY when Supabase is configured AND the operator has explicitly set the
 * public runtime flag to the exact string 'true'. Default OFF so merging #746
 * does not change the live Sign In surface; the operator flips the flag in
 * Netlify env when ready to go live post-#745. Resolution order mirrors
 * src/lib/supabase.ts: window.__CDISCOURSE_RUNTIME_ENV__ first, then process.env.
 *
 * NOTE: the runtime-env shim type in supabase.ts does not yet declare this slot;
 * the gate reads it defensively (string check) rather than widening that interface,
 * keeping the change isolated to this module. `readRuntimeEnv()` returns the
 * typed subset, so the gate also consults process.env directly for the flag.
 */
export function resolveGoogleAuthEnabled(): boolean {
  if (!SUPABASE_CONFIGURED) return false;
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[GOOGLE_AUTH_ENABLED_FLAG];
  const fromEnv = process.env[GOOGLE_AUTH_ENABLED_FLAG];
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}
```

> Implementer note: `readRuntimeEnv()` returns the narrow `CDiscourseRuntimeEnv`
> shape (only the three declared `EXPO_PUBLIC_*` slots). The flag is NOT one of
> them, so the gate reads it via the `Record<string, unknown>` cast above OR — the
> cleaner option — the implementer adds `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED?: string`
> to the `CDiscourseRuntimeEnv` interface + the `readRuntimeEnv()` projection in
> `supabase.ts` (a 2-line additive change, no behavior change). Either is
> acceptable; the cast keeps the change to one file, the interface widening is
> more type-honest. Recommend the interface widening for clarity, but flag it so
> the reviewer expects a `supabase.ts` touch if chosen. This design assumes the
> cast (one-file) approach by default to minimize blast radius.

### Wrapper — `src/features/auth/signInWithGoogle.ts`

```ts
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import { buildAuthRedirectUrl } from '../../lib/auth/buildAuthRedirectUrl';
import { resolveRuntimeOrigin, getIsDev } from '../../lib/auth/resolveRuntimeOrigin';
import { mapAuthError } from './authApi';
import type { AuthResult } from './types';

/**
 * Initiate the Supabase Google OAuth redirect. The post-auth landing is the
 * EXISTING /auth/callback consumer (no parallel callback). The redirect target
 * is the resolved CURRENT origin — never a hard-coded host — so it works on
 * localhost, Netlify dev, preview deploys, and prod without code change.
 *
 * Doctrine: NO client secret, NO service-role. Uses the public anon `supabase`
 * client only. The provider response / tokens are NEVER logged. A bad runtime
 * origin degrades the same way email flows do (omit redirectTo → Supabase falls
 * back to the dashboard Site URL) instead of blocking sign-in. Never throws.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!SUPABASE_CONFIGURED) {
    return {
      ok: false,
      error: 'config_missing',
      message:
        'Supabase is not configured. Copy .env.example to .env and fill in your project URL and anon key.',
    };
  }

  // redirectTo from the PURE helper. Explicit route '/auth/callback' with an
  // existing kind (per the merged architecture design §1) — AuthRedirectKind
  // names only the five email flows, so we pass route rather than adding an
  // OAuth kind. A throwing origin (InvalidAuthRedirectOrigin) degrades to
  // undefined so the redirect-config defect never hard-blocks sign-in.
  let redirectTo: string | undefined;
  try {
    redirectTo = buildAuthRedirectUrl({
      kind: 'magic_link', // any /auth/callback-defaulting kind; route is explicit below
      route: '/auth/callback',
      runtimeOrigin: resolveRuntimeOrigin(),
      isDev: getIsDev(),
    });
  } catch {
    redirectTo = undefined;
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) {
      return { ok: false, error: mapAuthError(error.message), message: error.message };
    }
    return { ok: true };
  } catch (e) {
    // signInWithOAuth navigation/transport failure → plain network class. The
    // raw error is NOT logged (no token / provider detail leak).
    const message = e instanceof Error ? e.message : 'Sign-in could not be started.';
    return { ok: false, error: mapAuthError(message), message };
  }
}
```

Key points:
- `kind: 'magic_link'` is a carrier only; `route: '/auth/callback'` is explicit,
  so the resolved URL is `<currentOrigin>/auth/callback` regardless of kind.
  (`confirm_signup`, `invite`, `email_change` all also default to `/auth/callback`
  — any of them works; `magic_link` chosen for least semantic surprise. The
  explicit `route` makes the choice irrelevant to the output.)
- `options.redirectTo` is OMITTED (passes `undefined`) when the origin is invalid,
  mirroring `authApi.ts` `safeBuildRedirect` degradation — Supabase then falls
  back to the dashboard Site URL.
- No `console.*` anywhere (lint forbids it; doctrine forbids token logging).

### AuthScreen wiring (top of component)

```ts
// new imports
import { resolveAuthProviderSlotRegion } from './authProviderSlotModel';
import { CONTINUE_WITH_GOOGLE_LABEL } from './authProviderSlotModel';
import { resolveGoogleAuthEnabled } from './googleAuthGate';
import { signInWithGoogle } from './signInWithGoogle';

// inside AuthScreen(), replacing line 45:
const googleEnabled = resolveGoogleAuthEnabled();
const providerRegion = resolveAuthProviderSlotRegion(
  googleEnabled ? { enabledSlots: [{ id: 'google', order: 0, enabled: true }] } : undefined,
);
```

> Note: `CONTINUE_WITH_GOOGLE_LABEL` is already exported from
> `authProviderSlotModel.ts:96`. It may be merged into the existing
> `resolveAuthProviderSlotRegion` import line.

### AuthScreen JSX delta (the `hasVisibleProvider` branch — lines 150-153)

BEFORE:
```tsx
{providerRegion.hasVisibleProvider ? (
  // FUTURE (#746): real, wired provider affordances render here.
  // Not reached in v1 — the default region is provider-unavailable.
  <View testID="auth-provider-region" />
) : (
```

AFTER:
```tsx
{providerRegion.hasVisibleProvider ? (
  // AUTH-GOOGLE-SSO-003 (#746) — live "Continue with Google" affordance.
  // Gated by resolveGoogleAuthEnabled() (default OFF). Label comes from the
  // CONTINUE_WITH_GOOGLE_LABEL constant (NOT a literal — keeps the AuthScreen
  // "no 'Continue with Google' literal" source guard green). onPress initiates
  // the Supabase OAuth redirect via the signInWithGoogle wrapper (the only file
  // that may name the provider call). Email/password below is unchanged.
  <View testID="auth-provider-region">
    <Button
      label={CONTINUE_WITH_GOOGLE_LABEL}
      onPress={signInWithGoogle}
      variant="secondary"
      testID="auth-provider-google-button"
    />
  </View>
) : (
```

- The existing `Button` component
  (`src/components/Button.tsx`) already supplies `accessibilityRole="button"` and
  `accessibilityLabel={label}` (so the a11y label resolves to "Continue with
  Google"), and `minHeight: 48` (≥ the 44px tap-target floor — accessibility-targets
  satisfied). No new accessibility props are required; the `accessibilityLabel`
  in the issue's acceptance criteria is satisfied by `Button`'s `label` →
  `accessibilityLabel` mapping. If the implementer wants belt-and-suspenders, an
  explicit `accessibilityLabel` prop could be added to `Button`, but that is a
  Button API change and out of scope — rely on the existing mapping.
- `variant="secondary"` renders the gold-hairline ghost button, visually distinct
  from the indigo primary "Sign In" CTA below — the provider button is not the
  primary action, the email/password path is.
- `onPress={signInWithGoogle}` passes the wrapper directly; `Pressable` calls it
  with no args, matching the wrapper's `()` signature. (The returned promise is
  intentionally not awaited in the handler — initiation navigates the browser
  away; there is no in-screen success state to render. This matches how OAuth
  redirect initiation works. The wrapper never throwing guarantees no unhandled
  rejection.)

---

## parseAuthCallbackUrl verification result

**Finding: NO callback change needed.** Verified by reading
`src/lib/auth/parseAuthCallbackUrl.ts` and `src/features/auth/consumeAuthCallback.ts`:

1. A bare OAuth PKCE return `<origin>/auth/callback?code=<x>` (no `type` param):
   - `parseAuthCallbackUrl` reaches the `code` branch
     (`parseAuthCallbackUrl.ts:173-177`): `query.get('code')` is non-empty, no
     fragment tokens, no error params → returns
     `{ kind: 'code', code, type: normalizeType(query.get('type')) }`. With no
     `type` param, `normalizeType(null)` returns `null`, so the result is
     `{ kind: 'code', code, type: null }`.
2. `consumeAuthCallback` handles that variant (`consumeAuthCallback.ts:162-170`):
   the `code` branch runs `exchangeCodeForSession(parsed.code)`. Since
   `isInvite(null)` is `false` (`consumeAuthCallback.ts:51-54`, `:167`), it returns
   `{ status: 'success' }` — NOT `needs_password` (which is invite-email-only).
3. This is fully consistent with `src/lib/supabase.ts:77`
   (`detectSessionInUrl: false`) and the default supabase-js PKCE flow (no
   `flowType` set → PKCE → `?code=` query return). The 12s bounded-timeout guard
   (`DEFAULT_CONSUME_TIMEOUT_MS`) applies unchanged, so a stalled exchange recovers
   to a plain `network` error.

Conclusion: the OAuth return is already a first-class handled path. **No shim, no
new branch, no callback edit.** This matches the merged architecture design §3
(`AUTH-GOOGLE-SSO-001.md:41-48`). The implementer must NOT touch
`parseAuthCallbackUrl.ts`, `consumeAuthCallback.ts`, or `AuthCallbackScreen.tsx`.

---

## redirectTo construction (and why NOT a new `'oauth'` kind)

The prompt offered two options and recommended adding an `'oauth'` kind. **This
design instead uses an explicit `route: '/auth/callback'` with an existing kind
and makes NO change to `buildAuthRedirectUrl`** — diverging from the prompt's
recommendation in favor of the merged architecture decision.

Rationale (source-of-truth chain):
- The merged architecture design `AUTH-GOOGLE-SSO-001.md` §1 (line 22, #744)
  EXPLICITLY chose this: *"Because `AuthRedirectKind` is the five email flows … and
  does not name an OAuth kind, the wrapper passes an explicit `route:
  '/auth/callback'` … rather than overloading an email kind."* The READINESS-001
  audit (746-T1) and the INDEX both restate this. The architecture design is
  operator-validated and merged; the prompt's recommendation was offered as
  "correct me if a fact is wrong," and the established design is the more
  authoritative source.
- Conservatism: `buildAuthRedirectUrl.ts` is a pure, heavily-tested helper (its
  test file has ~40 cases plus a doctrine file). Adding a 6th `AuthRedirectKind`
  forces touching the union, `DEFAULT_AUTH_ROUTES`, and the
  `DEFAULT_AUTH_ROUTES maps every kind` test — a wider, lower-value change than
  passing a `route` the helper already supports (`buildAuthRedirectUrl.ts:165-169`).
- Output is identical: `route: '/auth/callback'` yields
  `<normalizedOrigin>/auth/callback` for any `kind`.

`runtimeOrigin: resolveRuntimeOrigin()` returns `window.location.origin` first
(`resolveRuntimeOrigin.ts:37-43`) — the REAL current origin — so the redirect is
`<currentOrigin>/auth/callback` on localhost, `dev-cdiscourse.netlify.app`,
preview hashes, and prod. The `HOSTED_FALLBACK_ORIGIN` (`dev.cdiscourse.com`) is
reached ONLY when no runtime origin resolves in a non-dev build, which does not
happen in a browser. The wrapper test asserts the resolved (mocked) origin is
used, NOT `dev.cdiscourse.com`.

---

## Source-scan allow-list change

In `__tests__/authScreenProviderRegion.test.tsx`, the existing guard (lines
143-160) walks `src/` and asserts no file contains `signInWithOAuth`
(`offenders === []`). Relax it to a SINGLE-FILE allow-list:

```ts
it('signInWithOAuth appears ONLY in the dedicated wrapper under src/', () => {
  const SRC = path.join(ROOT, 'src');
  const ALLOW = [path.join('src', 'features', 'auth', 'signInWithGoogle.ts')];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        if (fs.readFileSync(full, 'utf8').includes('signInWithOAuth')) {
          const rel = path.relative(ROOT, full);
          if (!ALLOW.includes(rel)) offenders.push(rel);
        }
      }
    }
  };
  walk(SRC);
  expect(offenders).toEqual([]);
});
```

Optionally add a positive control asserting the wrapper file DOES contain
`signInWithOAuth` (so the allow-list cannot pass vacuously if the wrapper is ever
renamed/deleted):

```ts
it('the dedicated wrapper actually contains the provider call (allow-list is not vacuous)', () => {
  const wrapper = fs.readFileSync(
    path.join(ROOT, 'src', 'features', 'auth', 'signInWithGoogle.ts'), 'utf8',
  );
  expect(wrapper).toContain('signInWithOAuth');
});
```

The AuthScreen-specific guards (lines 131-141: AuthScreen source contains no
`signInWithOAuth` / no `oauth` substring / no `'Continue with Google'` literal)
stay UNCHANGED — AuthScreen still has none of those (it imports the constant + the
wrapper by name).

The model-purity guard in `authProviderSlotModel.test.ts:162-164` ("contains no
signInWithOAuth") also stays green — the model is unchanged.

---

## Test plan (every card-required case mapped)

### `__tests__/googleAuthGate.test.ts` (NEW)

Mock `../src/lib/supabase` with a mutable `SUPABASE_CONFIGURED` getter and a
`readRuntimeEnv` jest.fn (same pattern as `authApiRedirect.test.ts`). Control
`process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` per test (save/restore in
before/afterEach).

- `resolveGoogleAuthEnabled()` returns **false** when the flag is unset (default OFF).
- returns **false** when the flag is `'false'`, `'1'`, `'TRUE'`, `''`, or any non-`'true'` value (exact-string match).
- returns **false** when the flag is `'true'` but `SUPABASE_CONFIGURED` is false.
- returns **true** ONLY when flag === `'true'` AND `SUPABASE_CONFIGURED` is true.
- reads the runtime-env shim value in preference to `process.env` (set `readRuntimeEnv` to return `{ EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: 'true' }` with `process.env` unset → true).

### `__tests__/signInWithGoogle.test.ts` (NEW)

Mirror `authApiRedirect.test.ts`: mock `supabase.auth.signInWithOAuth`
(`mockSignInWithOAuth`), mock `resolveRuntimeOrigin` + `getIsDev`, mutable
`SUPABASE_CONFIGURED` getter, `readRuntimeEnv: () => ({})`.

- **calls `signInWithOAuth` with `provider: 'google'`** exactly once and returns `{ ok: true }` on success (`mockSignInWithOAuth` resolves `{ data:{}, error:null }`).
- **`redirectTo` ends in `/auth/callback` and uses the resolved current origin**: mock `resolveRuntimeOrigin` → `'https://dev-cdiscourse.netlify.app'`, assert `mockSignInWithOAuth.mock.calls[0][0].options.redirectTo === 'https://dev-cdiscourse.netlify.app/auth/callback'`.
- **redirectTo is NOT `dev.cdiscourse.com`**: with a real resolved origin mocked, assert the arg does NOT contain `dev.cdiscourse.com` and does contain the mocked origin.
- **invalid origin → `options` omitted (or `redirectTo` undefined)**: mock `resolveRuntimeOrigin` → `'file:///etc/passwd'` (makes `buildAuthRedirectUrl` throw), assert `signInWithOAuth` still called once with `options` undefined and the result is still `{ ok: true }` (degrade, don't block).
- **`SUPABASE_CONFIGURED === false` → safe no-op**: returns `{ ok:false, error:'config_missing' }` and `signInWithOAuth` is NOT called.
- **Supabase error → mapped, never throws**: `mockSignInWithOAuth` resolves `{ error:{ message:'Network request failed to fetch' } }` → result `{ ok:false, error:'network_error' }`.
- **rejection → caught, mapped, never throws**: `mockSignInWithOAuth` rejects → result `{ ok:false }`, no throw.
- **no token / provider detail logged**: spy on `console.log`/`console.error`/`console.warn`; assert zero calls across the happy path and the error path. (Also enforced by the no-`console` lint rule, but asserted here for doctrine.)

### `__tests__/authScreenProviderRegion.test.tsx` (EXTENDED)

KEEP every existing test (default-OFF surface, never-reaches-provider,
email/password still works, AuthScreen source guards). They remain valid because
the gate defaults OFF and the existing supabase mock returns
`readRuntimeEnv: () => ({})` (flag unset). ADD:

- A new describe **"AUTH-GOOGLE-SSO-003 — enabled state"** that forces the gate
  ON. Two viable mock strategies (pick one in implementation):
  - **(a)** Set the supabase mock's `readRuntimeEnv` to return
    `{ EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: 'true' }` and `SUPABASE_CONFIGURED` true,
    so the REAL `resolveGoogleAuthEnabled` returns true; or
  - **(b)** `jest.mock('../src/features/auth/googleAuthGate', () => ({ resolveGoogleAuthEnabled: () => true, GOOGLE_AUTH_ENABLED_FLAG: 'EXPO_PUBLIC_GOOGLE_AUTH_ENABLED' }))`.

  Recommend (a) — it exercises the real gate. Cases:
  - the **"Continue with Google" button renders** (by `testID="auth-provider-google-button"` AND by `getByText('Continue with Google')` AND by `getByLabelText('Continue with Google')`).
  - the provider-unavailable "coming soon" notice is **absent** (`queryByTestId('auth-provider-unavailable')` is null).
  - **pressing the Google button calls the mocked `signInWithGoogle` wrapper, NOT `supabase.auth.signInWithOAuth` directly from the component**: `jest.mock('../src/features/auth/signInWithGoogle', () => ({ signInWithGoogle: mockWrapper }))`; press → `mockWrapper` called once; assert `mockSignInWithOAuth` (the supabase-client spy) NOT called directly by the component (the component goes through the wrapper).
  - **email/password still works in the enabled state** (fill + press Sign In → `signInWithPassword` once).
  - **NO Facebook and NO Apple** affordance (`queryByText(/facebook/i)` / `/apple/i` null) even when Google is enabled.
  - the Google button meets the tap target: assert it renders via `Button` (the `minHeight:48` ≥ 44 is a Button invariant; component test asserts presence + role).
- Relax the src/-walk guard to the single-file allow-list (+ optional positive control), per "Source-scan allow-list change".

### Unchanged (explicitly NOT modified)

- `authProviderSlotModel.test.ts` — the model is unchanged; its
  future-consumability tests (lines 65-91) already cover the enabled-Google-slot
  path, and the copy-safety + purity guards still hold.
- `buildAuthRedirectUrl.test.ts` / `buildAuthRedirectUrl.doctrine.test.ts` — no
  `'oauth'` kind added, so no change.
- `parseAuthCallbackUrl.test.ts` / `consumeAuthCallback.test.ts` /
  `AuthCallbackScreen.test.tsx` — no callback change.
- `noLocalhostInProdAuthPaths.test.ts` — UNCHANGED, and it now ALSO guards the new
  wrapper: `signInWithGoogle.ts` lives under `src/features/auth/`, so the test's
  "no `http://localhost` / `127.0.0.1` under `src/features/auth/`" assertions
  automatically cover it. The wrapper passes because it hard-codes NO origin
  (redirectTo comes from `buildAuthRedirectUrl`). This is a free regression net —
  do not weaken it.

### Ban-list / copy scan

The only user-facing string introduced is the button label, sourced from the
existing `CONTINUE_WITH_GOOGLE_LABEL` constant (already verdict-free and
copy-tested in `authProviderSlotModel.test.ts:93-145`). The wrapper's
error `message` is the raw Supabase message mapped to a code; the SCREEN renders
plain copy via the existing `ErrorNotice` + `mapAuthError` path, never the raw
message. No new "coming soon" string is shown when enabled (the model returns an
empty `providerUnavailableCopy` when a slot is enabled — already tested). No new
ban-list test file is required, but the enabled-state component test implicitly
asserts no verdict tokens render (the only new visible string is the
already-scanned label).

### Test-count expectation

Test count goes UP (new gate suite + new wrapper suite + added enabled-state
cases; no tests removed). The implementer captures the exact
`Test Suites: X passed / Tests: Y passed` line with an explicit exit code and
updates `docs/core/current-status.md` per test-discipline. (Baseline at design
time per CLAUDE.md is 1805 tests / 70 suites; the implementer confirms the live
baseline on the branch before claiming the delta — do NOT author a stale count.)

---

## Edge cases

- **Flag unset / non-`'true'` value** → gate OFF → email-only surface unchanged →
  existing tests pass. (Default-safe.)
- **Flag `'true'` but `SUPABASE_CONFIGURED` false** → gate OFF (the
  `SUPABASE_CONFIGURED` precondition); no button; no broken provider call.
- **`SUPABASE_CONFIGURED` false at wrapper call time** (e.g. a race where the
  button somehow rendered) → wrapper returns `{ ok:false, error:'config_missing' }`,
  `signInWithOAuth` not called. Belt-and-suspenders with the gate's own
  `SUPABASE_CONFIGURED` check.
- **Invalid / dangerous runtime origin** (`file://`, `http://` in prod) →
  `buildAuthRedirectUrl` throws → caught → `redirectTo` undefined → `options`
  omitted → Supabase uses Site URL. Sign-in is never hard-blocked by a
  redirect-config defect (doctrine: redirect defect is advisory).
- **Sandboxed-iframe origin (`'null'`)** → `resolveRuntimeOrigin` already skips
  the literal `'null'` (`resolveRuntimeOrigin.ts:42`) and falls through to the
  injected/`process.env` origin, then null → hosted fallback. Wrapper still
  produces a valid https redirect.
- **Supabase / provider error on initiation** → mapped to a plain `AuthError`
  class; never throws; no token logged.
- **Network failure starting the redirect** → `mapAuthError` → `network_error`;
  the screen can surface plain copy. (The current AuthScreen does not render the
  wrapper's returned error inline — see "Out of scope"; the wrapper still returns
  a safe shape for a future inline-error card.)
- **Concurrent edits / offline** → N/A: no DB write, no local mutation, no
  optimistic state. OAuth initiation is a single navigation.
- **Permission-denied** → N/A at the client; provider/seat authorization is
  server-side and unchanged by this card.
- **Doctrine-constraint edge case** — "what if a popular/viral Google account
  signs in?" → identity is orthogonal to point standing; sign-in grants no
  factual standing, no heat, no score (cdiscourse-doctrine §1-§3). Nothing in this
  card touches the standing economy.
- **Bare `/auth/callback` re-entry after success** → already handled by the
  `empty` branch (`consumeAuthCallback.ts:134-145`, `already_session`); unchanged.

---

## Dependencies (cards / docs / files)

- **Assumes #745 (AUTH-GOOGLE-SSO-002) is complete** — hosted Google provider
  verified live (`external_google_enabled=true`, 2026-06-21). Required for the
  round-trip to COMPLETE, but NOT for this card to merge safely (the button is
  gated OFF by default; merging is inert until the operator flips the flag).
- **Assumes #747 (AUTH-GOOGLE-SSO-004) is complete** — `handle_new_user` coalesces
  `display_name` / `full_name` / `name`, so a first-time Google user gets a
  populated profile. Confirmed merged + applied. Not consumed by this card's code
  (server-side), but it is why a Google sign-in produces a usable profile.
- **Reads the merged architecture design** `docs/designs/AUTH-GOOGLE-SSO-001.md`
  §1 (redirectTo via explicit route), §3 (callback reuse → `success`).
- **Reads existing code (no change):**
  - `src/features/auth/authProviderSlotModel.ts` — `resolveAuthProviderSlotRegion`,
    `CONTINUE_WITH_GOOGLE_LABEL`.
  - `src/features/auth/consumeAuthCallback.ts` — the `code` branch returns
    `success`.
  - `src/lib/auth/parseAuthCallbackUrl.ts` — bare `?code=` → `{kind:'code',
    type:null}`.
  - `src/lib/auth/buildAuthRedirectUrl.ts` — `route` override
    (`:165-169`).
  - `src/lib/auth/resolveRuntimeOrigin.ts` — `window.location.origin` first.
  - `src/lib/supabase.ts` — `readRuntimeEnv()`, `SUPABASE_CONFIGURED`.
  - `src/components/Button.tsx` — supplies role + a11y label + 48px min height.
- **Modifies (additive export):** `src/features/auth/authApi.ts` — export
  `mapAuthError`.
- **Blocks #748 (AUTH-GOOGLE-SSO-005)** — invite resume through Google builds on
  the live button + wrapper this card ships. (#748 is OUT of scope here.)

---

## Risks

- **`mapAuthError` export ripple.** Exporting a previously-private function is
  additive and harmless, but the reviewer should confirm no test asserts
  `authApi.ts` has NO additional exports (none does today). Low risk.
- **Wrapper-home vs `authApi.ts` convention.** The merged architecture design and
  the issue both say the wrapper "parallels existing wrappers in `authApi.ts`."
  Placing it in a DEDICATED file (`signInWithGoogle.ts`) instead is a deliberate
  divergence driven by the source-scan allow-list (a single-purpose file is the
  tightest `signInWithOAuth` allow-list entry; relaxing the guard for the large,
  central `authApi.ts` would be a weaker boundary). The wrapper still reuses
  `authApi.ts`'s `mapAuthError` + the `AuthResult` shape, so the convention is
  honored in substance. Flag for reviewer awareness; this is the recommended
  resolution. (If the reviewer insists on `authApi.ts`, the allow-list entry
  becomes `authApi.ts` and the guard is correspondingly broader — document that
  trade-off, but the dedicated file is preferred.)
- **`readRuntimeEnv()` does not type the new flag.** The gate reads the flag via a
  `Record<string, unknown>` cast OR a 2-line `CDiscourseRuntimeEnv` widening in
  `supabase.ts`. The cast keeps blast radius to one file (default); the widening
  is more type-honest but touches `supabase.ts`. Either passes typecheck; the
  reviewer should expect a `supabase.ts` touch ONLY if the widening is chosen.
- **`oauth` substring trap in AuthScreen.** The AuthScreen source guard scans for
  the substring `oauth` (case-insensitive, `authScreenProviderRegion.test.tsx:134`).
  The import name `signInWithGoogle` and the testID `auth-provider-google-button`
  contain no `oauth` — safe. The implementer must not add any comment containing
  "OAuth" to AuthScreen.tsx (use "provider redirect" / "Google sign-in" in
  comments). Low risk but easy to trip.
- **Pressable passing the async wrapper.** `onPress={signInWithGoogle}` is fine
  because the wrapper never throws and the unawaited promise has no in-screen
  consumer. The reviewer should confirm there is no floating-promise lint rule
  that flags it; if there is, wrap as `onPress={() => { void signInWithGoogle(); }}`.
- **No live OAuth call in tests.** All tests mock `signInWithOAuth` / the wrapper.
  No network. (cdiscourse-doctrine §7: no provider call from the app in tests.)
- **Existing default-OFF tests must stay green.** Because the gate reads
  `readRuntimeEnv()` + `process.env`, a test environment that accidentally sets
  `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true` globally would flip the default-OFF tests.
  The implementer must ensure the existing `authScreenProviderRegion.test.tsx`
  mock keeps `readRuntimeEnv: () => ({})` and that `process.env` is unset for
  those cases (it is, in CI). Low risk; called out so the reviewer checks.

---

## Out of scope

Explicit list of related work this card does NOT include:

- **No hosted Google config / secret / redirect allow-list change** (that is #745,
  already done). This card writes no Supabase config.
- **No profile provisioning logic / migration** (that is #747, already done). The
  `handle_new_user` trigger is untouched.
- **No invite / room redemption through Google** (that is #748). No
  `pendingInviteIntent`, no `InviteRedeemGate` change.
- **No callback / parser / consumer change** — verified unnecessary.
- **No `'oauth'` `AuthRedirectKind`** — the explicit `route` approach is used per
  the architecture design.
- **No Facebook, no Apple** — reserved slot ids only; neither renders.
- **No native (iOS/Android) Google** — `app.json` declares no deep-link `scheme`;
  Google ships web-first per architecture design §8. A native build would need a
  `scheme` + native redirect URI in its own card.
- **No inline rendering of the wrapper's returned error in AuthScreen** — the
  wrapper returns a safe `AuthResult` for a future inline-error card, but wiring
  that error into the screen's `displayError` is a separate, optional enhancement
  (the OAuth redirect navigates away on success, so the common path shows no error
  in-screen). Keeping it out preserves the "zero re-layout" goal.
- **No `package.json` / `app.json` change, no new dependency.** The Button is an
  existing RN primitive wrapper.
- **No deploy / publish.** Claude writes code; the operator sets the Netlify env
  flag and (already) deployed the provider.

---

## Doctrine self-check

**cdiscourse-doctrine §10 (v1 scope "no OAuth") — the one tension, resolved.**
The doctrine skill's v1 scope guard lists "No OAuth / social login (email+password
only in v1)." This card adds OAuth. The tension is RESOLVED, not papered over:
ADR `AUTH-GOOGLE-SSO-ADR-001` (#743) is the operator-sanctioned, ratified scope
change to add **Google only** for launch, with Supabase Auth remaining the
identity owner (Google is an external provider, not a replacement IdP). The
SSO-INDEX states this explicitly ("#743 ratifies the scope change"). The entire
AUTH-GOOGLE-SSO epic (#743-#748) exists because this evolution was deliberately
adopted post-v1. This card is the UI half of that ratified plan; it does not
introduce OAuth unilaterally. Apple/Facebook remain excluded.

Walking the remaining doctrine constraints:

- **§1 Score is gameplay analysis, never truth** — no score/standing/verdict
  surface is touched. Sign-in grants no factual standing. ✓
- **§2/§3 Heat / popularity not evidence** — identity is orthogonal to standing; a
  Google account's follower/engagement count grants nothing. ✓
- **§4 AI moderator limits** — no AI call; this is pure auth wiring. ✓
- **§5 Rules engine sacred** — the engine is not imported or touched. ✓
- **§6 Secrets policy** — the wrapper holds NO client secret and NO service-role;
  it uses the public anon `supabase` client. The OAuth client secret lives only in
  Supabase (set in #745). The new flag `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` is a
  PUBLIC runtime flag (the `EXPO_PUBLIC_` prefix is the public contract), never a
  secret; `.env.example` carries only the empty key name. `grep -r
  "ANTHROPIC_API_KEY\|SERVICE_ROLE" src/` stays zero. ✓
- **§7 No AI calls from the app** — none. ✓
- **§8 Supabase conventions** — no migration, no RLS change, no table touched, no
  direct insert. ✓
- **§9 Plain language** — the only user-facing string is the existing,
  copy-tested `CONTINUE_WITH_GOOGLE_LABEL`; errors render via `mapAuthError` +
  plain copy, never raw codes/messages. No "coming soon" shown when enabled. ✓
- **§10a Observations vs Allegations** — N/A (no node labels). ✓

**supabase-edge-contract** — no Edge Function, no service-role in client, no
direct insert, RLS untouched. The wrapper uses only the public anon client. ✓

**expo-rn-patterns** — reuses the existing `Button` RN primitive (no new dep, no
Bootstrap, no icon lib); the model file `googleAuthGate.ts` is pure (no React);
the gate respects the platform-agnostic runtime-env resolution. The button is a
`Pressable`-backed `Button` with `accessibilityRole="button"` and ≥48px height. ✓

**accessibility-targets** — the Google button meets the 44px tap-target floor
(`Button` `minHeight:48`) and exposes `accessibilityRole="button"` +
`accessibilityLabel="Continue with Google"` (via `Button`'s `label` →
`accessibilityLabel` mapping). Color is not the sole differentiator (it is a
labeled text button). ✓

**test-discipline** — new pure model (`googleAuthGate`) and new wrapper each get a
dedicated unit suite covering happy path + failure cases; the component gets an
enabled-state suite; the source-scan guard is tightened (not loosened in spirit —
it now allow-lists exactly one file and gains a positive control). Test count goes
up; the implementer captures the exact count with an exit code. ✓

---

## Operator steps (if any)

**To merge:** None — pure code change; not GATE-C (no migration, no Edge Function,
no hosted config write, no secret). Automerge-eligible when green.

**To go live (when ready, post-#745):** set the public runtime flag in the Netlify
environment:

```
EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true
```

then redeploy the web bundle (the flag is read at runtime via the HOST-001
runtime-env shim / babel-injected `EXPO_PUBLIC_*`). Until the flag is set, the
Sign In surface stays email-only (default OFF). No `supabase db push`, no
`functions deploy` — the provider was already configured in #745.

**Pre-go-live smoke (operator, GATE-C-style, NOT run by Claude)** — per
`AUTH-GOOGLE-SSO-001.md` §9: assert the resolved runtime origin
(`https://dev-cdiscourse.netlify.app`, not the `dev.cdiscourse.com` fallback
literal) is on the hosted Supabase redirect allow-list; tap "Continue with
Google" → consent → return to `/auth/callback` → `success` session (not
`needs_password`); confirm email/password still works.

---

## Orchestrator-authored brief ledger

This design was produced from an orchestrator-authored brief (the task prompt),
not an operator-authored card. Per POSTRUN-UX001 discipline, the provenance of
each interpretive decision:

- **Derived from the merged source-of-truth chain (operator-validated):**
  - redirectTo via explicit `route: '/auth/callback'` (NO `'oauth'` kind) —
    `AUTH-GOOGLE-SSO-001.md` §1, restated in READINESS-001 746-T1 + INDEX.
    **This OVERRIDES the prompt's stated recommendation to add an `'oauth'` kind.**
  - NO callback change — `AUTH-GOOGLE-SSO-001.md` §3, verified live against
    `parseAuthCallbackUrl.ts` + `consumeAuthCallback.ts`.
  - #745 verified live, #747 merged — stated in the prompt + INDEX/runbook.
- **Derived from the epic framing (issue #746 + ADR #743):** Google-only scope,
  no Facebook/Apple, email/password fallback preserved, the doctrine §10
  reconciliation.
- **Derived from a pre-launch codebase survey (this session's reads):** the
  default-OFF gate's exact precondition (`SUPABASE_CONFIGURED && flag==='true'`);
  the `readRuntimeEnv()`/`process.env` resolution pattern; the
  `mapAuthError`-export decision (it is module-private today); the
  `noLocalhostInProdAuthPaths.test.ts` free-regression coverage of the new
  wrapper; the `oauth`-substring AuthScreen guard trap; the `Button` a11y/height
  invariants.
- **Resolved by orchestrator default (not explicit operator direction):**
  - Wrapper in a DEDICATED file `signInWithGoogle.ts` rather than `authApi.ts` —
    driven by the prompt's single-file allow-list requirement; diverges from the
    "parallels authApi.ts" wording in the architecture design + issue (substance
    preserved via `mapAuthError`/`AuthResult` reuse). **Operator/reviewer may
    prefer `authApi.ts`; the trade-off is documented in Risks.**
  - Gate in a DEDICATED file `googleAuthGate.ts` rather than co-located in the
    wrapper — for independent testability.
  - `readRuntimeEnv` `Record` cast (one-file) over `CDiscourseRuntimeEnv` widening
    (type-honest, touches `supabase.ts`) — defaulted to the cast to minimize blast
    radius; both flagged.
  - `variant="secondary"` for the Google button (visual subordination to the
    primary email CTA) — a design judgment, not specified.
  - Button label via the `Button` `label`→`accessibilityLabel` mapping rather than
    adding an explicit `accessibilityLabel` prop to `Button` (which would be an
    out-of-scope Button API change).
- **Requires operator review post-ship (Operator-deferred review):**
  - Confirm the dedicated-wrapper-file choice (vs `authApi.ts`) is acceptable.
  - Confirm `variant="secondary"` is the intended visual weight for the provider
    button.
  - Set `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true` in Netlify env + redeploy when
    ready to go live, then run the operator smoke.

---

## Not GATE-C / automerge note

This card is **NOT GATE-C**: no migration, no Edge Function, no hosted config
write, no secret, no deploy. Per the issue's own classification and the SSO-INDEX,
it is a client UI + wrapper change that is INERT until the operator enables the
flag (and the provider, already enabled in #745). It is **automerge-eligible when
green** (typecheck + lint + full test suite pass, reviewer approves). The live
behavior change is gated behind the operator's runtime-flag flip, not the merge.
