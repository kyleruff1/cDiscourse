# AUTH-CALLBACK-CONSUMER-001 — Supabase invite callback + password-set flow

**Status:** Design draft
**Epic:** Hosting (Epic 10) — email / auth dev-deployment infra
**Release:** 6.8 / 6.9 track (public dev deployment + admin/email/test infra)
**Priority / Effort:** P0 · L · **GATE-C (auth/session behavior — operator-gated merge; stop at PR, no automerge)**
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/607

---

## Installed-API verification (load-bearing — done before design, NO HALT)

Verified against the actually-installed packages in this worktree (`node -e` probes against `node_modules`, not from memory):

| Fact | Value | How verified |
|---|---|---|
| `@supabase/supabase-js` | **2.106.0** (range `^2.105.4`) | `require('@supabase/supabase-js/package.json').version` |
| `@supabase/auth-js` | **2.106.0** | `require('@supabase/auth-js/package.json').version` |
| `exchangeCodeForSession` | **present** — `(authCode: string): Promise<AuthTokenResponse>` | live `typeof client.auth.exchangeCodeForSession === 'function'` + `GoTrueClient.d.ts` |
| `setSession` | **present** — `({ access_token, refresh_token }): Promise<{ data:{ session,user }, error }>` | live `typeof` probe |
| `updateUser` | **present** — `({ password }): Promise<{ data:{ user }, error }>` (`UserAttributes.password` exists) | live `typeof` probe + `types.d.ts` |
| `getSession` | **present** — `(): Promise<{ data:{ session }, error }>` | live `typeof` probe |
| `verifyOtp` | present — `(params): Promise<AuthResponse>` (future-scoped `token_hash` path) | live `typeof` probe |
| Default `flowType` | **`'implicit'`** | `GoTrueClient.js` source: `flowType: 'implicit'` default |
| Project `flowType` override | **none** — `src/lib/supabase.ts` does not set `flowType` | `src/lib/supabase.ts:68-79` |

**Conclusion: no HALT.** All three required methods (`exchangeCodeForSession`, `setSession`, `updateUser`) exist in the installed version. No new dependency, no migration, no second auth client is required.

**Single most important consequence:** because the project runs the **implicit** flow (default, not overridden), a Supabase invite redirect lands as a **URL fragment token** (`#access_token=…&refresh_token=…&type=invite`), consumed via `setSession`. The query-code shape (`?code=…` → `exchangeCodeForSession`) only occurs under PKCE, which this project does **not** configure today. We support both shapes, but the fragment-token path is the one the seed invite will actually exercise.

---

## Goal (one paragraph)

A branded Supabase invite email now sends through the existing audited `admin-users` `invite_user` path (`supabase/functions/admin-users/index.ts:364-424` → `inviteUserByEmail(email, { redirectTo })`), which creates the `auth.users` row and emails the user a link that redirects to `<origin>/auth/callback`. But the app has **no consumer** for that route: `src/lib/supabase.ts:76` sets `detectSessionInUrl: false`, and there is no `/auth/callback` screen anywhere in the tree (confirmed by grep; `QOL-023.md:265` explicitly reserves it for "a future card"). This card is that future card — it renders `/auth/callback`, turns the Supabase redirect (fragment-token or query-code) into a valid app session or a plain recoverable error, and guides an invited (passwordless) user to set an email+password so they can sign in again later. It is the prerequisite that unblocks gap **G1** from `docs/testing-runs/2026-06-13-auth-branded-invite-smoke.md` (a real receipt → render → CTA → callback → account setup → sign-in smoke). The design is shaped by doctrine: **email+password only, no OAuth** (doctrine §10); **plain language, no winner/loser/truth/verdict/accusation/raw-code/stack-trace** (doctrine §1, §9); **secrets stay server-side — no service-role in the client, password never logged or persisted outside the single `updateUser` call, tokens redacted in any diagnostic** (doctrine §6); and **the deterministic rules engine remains the only submit gate** — this is auth/session only and never touches `src/lib/constitution/engine.ts`. **This card does NOT send any invite** and makes **no hosted config change**.

---

## Data model

**No new persisted data model. No migration. No table, no RLS, no Edge Function.**

The only state introduced is transient (in-memory React state + the existing Supabase session in `AsyncStorage`, written by the existing client config). Two pure TypeScript types are introduced for the parser/consumer:

```ts
// src/lib/auth/parseAuthCallbackUrl.ts  (pure — no window / process / supabase)

/** Flow types Supabase may stamp on a callback (subset we read). Unknown → string. */
export type AuthCallbackFlowType =
  | 'invite'
  | 'signup'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | (string & {}); // tolerate unknown values without widening to plain string in narrowing

/** Discriminated union — the exact 5 variants named in the card. */
export type AuthCallbackParsed =
  | { kind: 'code'; code: string; type: AuthCallbackFlowType | null }
  | {
      kind: 'tokens';
      accessToken: string;
      refreshToken: string;
      type: AuthCallbackFlowType | null;
      expiresIn: number | null;
    }
  | {
      kind: 'error';
      // Sanitised, non-secret strings copied from the URL's error params.
      error: string;           // e.g. 'access_denied'
      errorCode: string | null; // e.g. 'otp_expired'
      description: string | null; // human text Supabase supplied (already non-secret)
      recoverable: boolean;    // true for expiry/denied → "may have expired" copy
    }
  | { kind: 'empty' }          // /auth/callback with no recognizable params
  | { kind: 'unsupported'; reason: string }; // params present but not a shape we consume (e.g. 'token_hash')

// src/features/auth/consumeAuthCallback.ts

/** The 4 outcomes named in the card. */
export type AuthCallbackOutcome =
  | { status: 'success' }        // session established; no password step needed
  | { status: 'needs_password' } // session established; invited passwordless user must set one
  | { status: 'already_session' }// a live session already existed (idempotent re-entry)
  | { status: 'error'; reason: AuthCallbackErrorReason };

/** Plain, non-secret reason classes → drive which plain copy the screen shows. */
export type AuthCallbackErrorReason =
  | 'expired'        // otp_expired / link reused → "may have expired"
  | 'link_invalid'   // unsupported / malformed / empty-with-no-session
  | 'network'        // fetch failure during the injected client call
  | 'config_missing' // SUPABASE_CONFIGURED === false
  | 'unknown';
```

---

## File changes

### New files

- `src/lib/auth/parseAuthCallbackUrl.ts` (**pure**, ~170 lines) — `parseAuthCallbackUrl(url)`, `redactAuthCallbackUrl(url)`, `describeAuthCallbackForDiagnostics(parsed)`, `isAuthCallbackPath(pathname)`. No `window` / `process` / React / Supabase imports — mirrors the purity of `buildAuthRedirectUrl.ts` and `inviteDeepLink.ts`. NEVER throws (malformed URL → `unsupported`).
- `src/features/auth/consumeAuthCallback.ts` (~130 lines) — `consumeAuthCallback({ client, parsed })`. The only side effect is the **injected** auth-client call; no `window`/`process`, no direct `supabase` import (the production caller passes `supabase.auth`). Returns `AuthCallbackOutcome`. Defines the minimal structural `AuthCallbackClient` interface so tests inject a mock.
- `src/features/auth/authCallbackCopy.ts` (~70 lines) — `AUTH_CALLBACK_COPY` plain-language bundle (one key per UI state + button labels). Idiomatic to this repo (`inviteCopy.ts`, `gameCopy.ts`, `preferencesCopy.ts`, `CORRIDOR_COPY`). Centralising the strings makes the ban-list test trivial.
- `src/features/auth/AuthCallbackScreen.tsx` (~250 lines) — the UI. Reuses `Screen`, `Button`, `TextInputField`, `ErrorNotice`, `LoadingNotice`. Owns the local state machine, runs the parse+consume once on mount (guarded by a ref), renders the six states, hosts the set-password form, and clears the URL + flips the App flag on Continue / Return-to-sign-in.

### Modified files

- `src/features/auth/authApi.ts` (~+35 lines) — add `setInvitedUserPassword(password): Promise<AuthResult>` (wrapper around `supabase.auth.updateUser({ password })`) + a `validateNewPassword(password): string | null` helper (the password half of `validateAuthInput`, reused so the screen and wrapper agree). Reuses the existing `mapAuthError` + `SUPABASE_CONFIGURED` guard. **No edit** to the existing sign-in / sign-up / reset wrappers.
- `App.tsx` (~+40 lines) — in `AppRoot`: (1) a `useState` initializer that captures `{ active, url }` from `window.location` **synchronously at first render** (guarded by `typeof window !== 'undefined'` + `isAuthCallbackPath`), so the fragment is read before any effect runs; (2) a new **highest-priority** branch in the `content` switch: when `authCallback.active`, render `<AuthCallbackScreen capturedUrl={…} onDone={() => setAuthCallback({active:false})} />` above the invite gate / AuthScreen / MainAppShell; (3) include the callback branch in `showRootHeader` so the bare `AppHeader` still docks. No router; mirrors the `aboutOpen` / `demoCorridorOpen` / `pendingInviteIntent` state-flag pattern (App.tsx ~:274, ~:437, ~:441).

### Unchanged on purpose (call out so the implementer does not "fix" them)

- `src/lib/supabase.ts:76` `detectSessionInUrl: false` **stays false.** We consume the URL manually. Flipping it to `true` would make the client auto-consume on every page load and race the manual path — do not change it.
- `src/features/session/AppSessionProvider.tsx` — unchanged. Its existing `onAuthStateChange` listener (`:42-84`) already dispatches `SIGNED_IN` when `setSession` / `exchangeCodeForSession` establishes a session, so the app transitions to signed-in **for free** once we consume. We do not add a second listener.
- `src/lib/auth/buildAuthRedirectUrl.ts` — unchanged; `invite` → `/auth/callback` is already correct (`DEFAULT_AUTH_ROUTES.invite`).
- `netlify.toml` / `scripts/runtime/server.mjs` — unchanged; SPA fallback already covers `/auth/callback` (see Routing decision).

### Deleted files

None.

### Implementer-authored deliverable doc (not code)

- `docs/testing-runs/2026-06-13-auth-callback-consumer.md` — required by the issue's acceptance list. Carries the seed-smoke readiness **verdict** (`READY_FOR_SEED_SEND` when typecheck/lint/test are green AND a synthetic invite callback URL is proven to flow parse→consume(mock)→`needs_password`→set-password; otherwise `NOT_READY`) plus the operator checklist (Operator steps below). The implementer writes this after the gates pass.

---

## API / interface contracts

### Pure parser — `src/lib/auth/parseAuthCallbackUrl.ts`

```ts
/** True for the bare callback route (tolerates one trailing slash). Pure. */
export function isAuthCallbackPath(pathname: string): boolean;
// '/auth/callback' or '/auth/callback/' → true; anything else → false.

/**
 * Parse a full callback URL into a discriminated union. NEVER throws.
 * Reads BOTH the query string and the fragment because GoTrue (implicit flow)
 * delivers tokens AND errors in the FRAGMENT, while PKCE delivers the code in
 * the QUERY. Precedence: error > tokens > code > empty/unsupported.
 */
export function parseAuthCallbackUrl(url: string): AuthCallbackParsed;

/**
 * Return a log-safe rendering of a URL: access_token / refresh_token / code /
 * token_hash values are replaced with '***'. Used ONLY in diagnostics. Never
 * emits a real token. NEVER throws.
 */
export function redactAuthCallbackUrl(url: string): string;

/**
 * Non-secret summary for a diagnostics line / the testing-run doc:
 * { kind, type, hasCode, hasTokens, errorCode, reason }. No token values.
 */
export function describeAuthCallbackForDiagnostics(parsed: AuthCallbackParsed): {
  kind: AuthCallbackParsed['kind'];
  type: string | null;
  hasCode: boolean;
  hasTokens: boolean;
  errorCode: string | null;
  reason: string | null;
};
```

Parsing rules:
- Use the WHATWG `URL` parser (as `inviteDeepLink.ts` / `buildAuthRedirectUrl.ts` do). Parse `url.search` and `url.hash` (strip leading `?`/`#`) with `URLSearchParams`.
- **error** (highest precedence): if `error` or `error_description` appears in query OR fragment → `{ kind:'error', … }`. `recoverable = true` when `error_code ∈ {otp_expired, …}` or `error ∈ {access_denied}`; copy maps to "may have expired".
- **tokens**: if fragment has non-empty `access_token` AND `refresh_token` → `{ kind:'tokens', … , type: params.get('type'), expiresIn: Number|null }`.
- **code**: else if query has non-empty `code` → `{ kind:'code', code, type: query.get('type') ?? null }`.
- **unsupported**: else if recognizable-but-unconsumable params are present — notably `token_hash` (+ `type`), the `verifyOtp` shape — → `{ kind:'unsupported', reason:'token_hash' }`. A string that fails `new URL(...)` → `{ kind:'unsupported', reason:'unparseable' }`.
- **empty**: else (`/auth/callback` with no query and no fragment) → `{ kind:'empty' }`.

### Consumer — `src/features/auth/consumeAuthCallback.ts`

```ts
/** Minimal structural client. supabase.auth is assignable to this. */
export interface AuthCallbackClient {
  getSession(): Promise<{ data: { session: unknown | null }; error: { message: string } | null }>;
  setSession(tokens: { access_token: string; refresh_token: string }):
    Promise<{ data: { session: unknown | null }; error: { message: string } | null }>;
  exchangeCodeForSession(authCode: string):
    Promise<{ data: { session: unknown | null }; error: { message: string } | null }>;
}

export async function consumeAuthCallback(input: {
  client: AuthCallbackClient;
  parsed: AuthCallbackParsed;
}): Promise<AuthCallbackOutcome>;
```

Consumer logic (deterministic; the ONLY network is the injected client call):
1. `parsed.kind === 'error'` → `{ status:'error', reason: parsed.recoverable ? 'expired' : 'link_invalid' }`.
2. `parsed.kind === 'empty'` → call `getSession()`; live session → `already_session`; else → `{ status:'error', reason:'link_invalid' }`.
3. `parsed.kind === 'unsupported'` → `{ status:'error', reason:'link_invalid' }` (diagnostics still record `parsed.reason`).
4. `parsed.kind === 'tokens'` → `setSession({ access_token, refresh_token })`. On `error` → `mapConsumeError(error.message)` (→ `network` | `expired` | `unknown`). On success → `isInvite(parsed.type) ? needs_password : success`.
5. `parsed.kind === 'code'` → `exchangeCodeForSession(code)`. Same success/error handling as (4).

Where `isInvite(type) === (type === 'invite')`. **Only `invite` returns `needs_password`** — it is the one flow that creates a passwordless user. `signup` (already has a password), `magiclink`, `email_change`, and a missing `type` all return `success`. (`recovery` is future-scoped via `/auth/reset`.) Documented in the module header so the rule is not mistaken for a bug.

### Set-password wrapper — `src/features/auth/authApi.ts`

```ts
/** Password-only validator (the password half of validateAuthInput). */
export function validateNewPassword(password: string): string | null;
// '' / < 6 chars → 'Password must be at least 6 characters.'; else null.

/**
 * Set the password for the currently-authenticated (invited) user.
 * Wraps supabase.auth.updateUser({ password }). Requires a live session,
 * which consumeAuthCallback established. NEVER logs / persists the password.
 */
export async function setInvitedUserPassword(password: string): Promise<AuthResult>;
// SUPABASE_CONFIGURED===false → { ok:false, error:'config_missing', message:… }
// updateUser error → { ok:false, error: mapAuthError(msg), message: msg }
// success → { ok:true }
```

### UI — `src/features/auth/AuthCallbackScreen.tsx`

```ts
interface AuthCallbackScreenProps {
  /** Full callback URL captured at App boot (pathname + search + hash). */
  capturedUrl: string;
  /** Called when the user taps Continue / Return to sign in — App flips the
   *  in-memory authCallback flag so AppRoot routes normally afterward. */
  onDone: () => void;
}
```

Derived UI states (one `<Screen>` each): `checking` → `accepted` (success | already_session) / `set_password` (needs_password) → `password_set` / `error_generic` (link_invalid|unknown|config_missing) / `error_expired` (expired). `accepted` and `password_set` show a primary **Continue to CivilDiscourse**; error states show a secondary **Return to sign in**. Continue/Return both call `window.history.replaceState(null, '', '/')` (strip the path + tokens from the address bar/history) then `onDone()`.

### App boot capture — `App.tsx`

```ts
// Synchronous at first render so the fragment is read before any effect.
const [authCallback, setAuthCallback] = useState<{ active: boolean; url: string }>(() => {
  if (typeof window === 'undefined') return { active: false, url: '' };
  const { pathname, href } = window.location;
  return isAuthCallbackPath(pathname) ? { active: true, url: href } : { active: false, url: '' };
});
// In the content switch, BEFORE the pendingInviteIntent / signed_out / shell branches:
if (authCallback.active) {
  content = <AuthCallbackScreen capturedUrl={authCallback.url}
              onDone={() => setAuthCallback({ active: false, url: '' })} />;
}
```

---

## Callback semantics (card design point 1)

| Shape | Where | Method | This project? | Outcome |
|---|---|---|---|---|
| (a) query-code `?code=…` | query | `exchangeCodeForSession(code)` | **Defensive only** (PKCE; not configured) | `needs_password` if `type=invite` else `success` |
| (b) fragment-token `#access_token=…&refresh_token=…&type=invite` | fragment | `setSession({access_token,refresh_token})` | **PRIMARY** (implicit flow — what the invite lands as) | `needs_password` for invite |
| (c) error `?error=…` / `#error=…&error_code=…` | query or fragment | none (no client call) | yes (e.g. expired link) | `error` → plain recoverable copy |
| (d) empty / invalid | — | `getSession()` only (idempotency probe) | yes (refresh after consume) | `already_session` (session present) or `error:link_invalid` |
| future: `token_hash`+`type` (verifyOtp) | query | NOT consumed in v1 | possible if template switches to `{{ .TokenHash }}` | `unsupported` → plain copy + diagnostics record `token_hash` |

---

## Routing decision (card design point 4)

- **Detection (web):** `isAuthCallbackPath(window.location.pathname)` captured **synchronously** in an `AppRoot` `useState` initializer at first render. State-flag routing only — **no expo-router, no `app/` dir** (the repo has none; routing is App.tsx state, per TL-003 / COMPOSER-002 invariant). The callback branch is placed **first** in the `content` priority order; if we are on `/auth/callback`, that is unambiguously the flow to run.
- **No collision with the QOL-038 invite deep-link effect:** `parseInviteDeepLink` only matches paths starting with `/invite/` (`inviteDeepLink.ts:97`), so `/auth/callback` returns `null` there and the existing cold-start effect is a no-op for our route. The two invite systems are distinct: QOL-038 `/invite/<token>` = room-membership; this card `/auth/callback` = Supabase **account** invite.
- **SPA fallback (verified on both hosts):** the invite link is a hard navigation to `<origin>/auth/callback#…`. Netlify: `netlify.toml:34-38` `from="/*" to="/index.html" status=200` serves index.html for the path. Cloud Run: `scripts/runtime/server.mjs:148` runs `serve -s` (single-page-app fallback). The **fragment never reaches the server** (browser-only), so only the path needs fallback — covered on both. No host change needed.
- **URL hygiene:** after consumption (or on Continue/Return) call `window.history.replaceState(null, '', '/')` to strip `?query` + `#fragment` (tokens) from the address bar and history. A subsequent refresh then lands on `/` (or bare `/auth/callback` → `empty` → `already_session`), never re-consuming a used token.
- **Native:** `typeof window === 'undefined'` → branch never activates → **zero behavior change** on iOS/Android. Native deep-link capture (`expo-linking`) is **future-scoped** — it is a dependency-level change, and it mirrors the existing QOL-038 decision to defer native invite capture (App.tsx:148-151).

---

## Edge cases

- **Empty `/auth/callback`, no session** (e.g. user opens the bare URL, or token already consumed + URL cleared then hard-refreshed to a stale bookmark): `getSession()` null → `error:link_invalid` → "This invite link could not be completed" + Return to sign in. Never a crash, never a blank screen.
- **Empty `/auth/callback`, live session** (refresh after a successful consume): `already_session` → "You can sign in now" + Continue. Idempotent.
- **Error in fragment vs query:** implicit-flow errors arrive in the **fragment** (`#error=access_denied&error_code=otp_expired&error_description=…`); the parser reads both. `otp_expired` / `access_denied` → `recoverable=true` → "This invite link may have expired."
- **Tokens present but `setSession` fails** (reused/stale token, clock skew): mapped to `expired` or `network` or `unknown` → plain copy + Return to sign in. Never echoes the Supabase error verbatim if it contains internal codes.
- **`type` resolution:** `type=invite` → `needs_password`; `type=signup`/`magiclink`/`email_change` → `success`; **missing `type` with valid tokens** → `success` (cannot prove invite → do not force a password step). Documented rule, not a guess.
- **`token_hash` link** (if the hosted template is ever switched to `{{ .TokenHash }}`): `unsupported(reason:'token_hash')` → plain "could not be completed" copy; diagnostics + the testing-run doc record `token_hash` so the operator knows to either keep `{{ .ConfirmationURL }}` or file the `verifyOtp` follow-up. No crash.
- **Both code and tokens present** (shouldn't happen): precedence error > tokens > code → tokens win (implicit reality). Deterministic, tested.
- **Malformed / non-URL string:** `parseAuthCallbackUrl` catches the `URL` throw → `unsupported(reason:'unparseable')` → plain copy. Parser NEVER throws.
- **Double-consume:** a `useRef` gate ensures consume runs exactly once per mount; URL-clearing after success prevents re-consume on refresh.
- **Concurrent session transition:** when `setSession` succeeds, the existing `AppSessionProvider` `onAuthStateChange` fires `SIGNED_IN` underneath us. Because the callback branch is **highest priority** in `AppRoot`, the screen stays mounted (no flicker to the shell) until the user taps Continue, which flips `authCallback.active=false` and lets `AppRoot` render the now-signed-in shell. (`TOKEN_REFRESHED` also emits `SIGNED_IN`; the provider's existing `lastUserId` guard already de-dupes.)
- **Offline / network failure** during consume or `updateUser`: `mapAuthError` → `network_error` → "Check your connection and try again." + retry; the form is never left in a stuck spinner (loading flag always resets in `finally`).
- **Permission-denied:** not reachable — the anon client acts only on the caller's own freshly-established session; `updateUser` mutates only the caller's own user. **No service-role**, so there is no elevated path to deny.
- **`SUPABASE_CONFIGURED === false`** (env missing): the wrapper short-circuits to `config_missing`; the screen shows the same plain "could not be completed / contact an admin" recovery (it does NOT print the env hint that AuthScreen shows operators — invited end-users get plain copy).
- **Password set but user navigates away** before Continue: they remain signed in for the session and can set/recover the password later; acceptable for v1. The always-present Return-to-sign-in is the escape if `updateUser` keeps failing.
- **Doctrine-constraint edge:** the callback flow assigns **no truth value, no score, no verdict** to anyone; it neither reads nor writes the rules engine or any `arguments`/`flags` row. "What if a failed link implies the user did something wrong? — it doesn't": error copy is link-state language ("this link could not be completed / may have expired"), never user-blaming.

---

## Test plan

All new tests; counts are estimates. Pure modules get full branch coverage. Mocking follows the established `__tests__/authApiRedirect.test.ts` pattern (mock `../src/lib/supabase` + async-storage) and the `InviteRedeemGate.test.tsx` source-scan pattern.

- `__tests__/parseAuthCallbackUrl.test.ts` (**~34 tests**) — happy paths for code / tokens(invite) / tokens(signup) / tokens(no-type); error in query; error in fragment; `otp_expired`→recoverable; empty; `token_hash`→unsupported; unparseable→unsupported; precedence (error>tokens>code; tokens>code); `isAuthCallbackPath` (match, trailing slash, `/auth/callbacks` no-match, `/invite/x` no-match); **redaction** (`access_token`/`refresh_token`/`code`/`token_hash` → `***`, asserts no real token substring survives); `describeAuthCallbackForDiagnostics` carries no token value; parser never throws on garbage (fuzz a few).
- `__tests__/consumeAuthCallback.test.ts` (**~22 tests**) — tokens→`setSession` called with exactly `{access_token,refresh_token}`, invite→`needs_password`, signup→`success`; code→`exchangeCodeForSession(code)`→`needs_password`/`success`; `setSession` error→`error` with `expired`/`network`/`unknown` mapping; empty+session→`already_session`; empty+no-session→`error:link_invalid`; unsupported→`error:link_invalid`; error-kind never calls the client; **no token logged** (spy `console.*` — assert never called with a token-shaped arg); **only the injected client is touched** (no global `supabase` import / no `fetch`).
- `__tests__/authCallbackSetPassword.test.ts` (**~12 tests**) — `validateNewPassword` boundaries; `setInvitedUserPassword` config_missing (no client call); `updateUser({password})` success→`{ok:true}`; weak/network error mapping; **password never appears in any logged/returned diagnostic**; source-scan: file contains no `SERVICE_ROLE` / `service_role` / `ANTHROPIC_API_KEY`.
- `__tests__/AuthCallbackScreen.test.tsx` (**~20 tests**) — render `checking` then `accepted` (mock consume=success); `set_password` path → fill password → submit calls `setInvitedUserPassword` → `password_set`; submit **disabled until valid** (`accessibilityState.disabled`); password input has `accessibilityLabel` + `secureTextEntry`; `error_generic` + `error_expired` render plain copy + Return-to-sign-in; Continue calls `history.replaceState` + `onDone`; **rendered output contains no raw code / no token / no snake_case / no stack trace**; source-scan: no `console.*`, no `SERVICE_ROLE`, no direct secret literal.
- `__tests__/authCallbackCopy.test.ts` (**~10 tests**) — **ban-list** over every `AUTH_CALLBACK_COPY` string: none of `winner|loser|true|false|correct|liar|dishonest|bad faith|verdict|guilty|wrong|stupid`; no `_` snake_case leak; no `error:`/`code`/`Error`/stack token; every UI state + every button has a non-empty string.
- `__tests__/authCallbackRouting.test.ts` (**~12 tests** — regression + doctrine guard) — `buildAuthRedirectUrl({kind:'invite', runtimeOrigin:'https://dev.cdiscourse.com', isDev:false})` still ends `/auth/callback` (pin); `isAuthCallbackPath` truth table; **App.tsx source-scan**: callback branch guarded by `typeof window`, captured synchronously, `detectSessionInUrl` not changed; **no `SERVICE_ROLE` / `service_role` / `ANTHROPIC_API_KEY` in any of the 4 new files**; sign-in/sign-up wrappers' source is byte-unchanged except the appended `setInvitedUserPassword` / `validateNewPassword` (assert the existing exports still present).
- `__tests__/authCallbackSmokeReadiness.test.ts` (**~6 tests**) — feed a **synthetic** invite callback URL (`https://dev.cdiscourse.com/auth/callback#access_token=fake.aaa.bbb&refresh_token=fake-refresh&expires_in=3600&token_type=bearer&type=invite`) through `parseAuthCallbackUrl` → `consumeAuthCallback({client: mock, parsed})` → assert `needs_password`; assert the mock client's `setSession` got the parsed tokens; assert **no network module is imported** and **no live send** is possible from these modules. This is the green-light proof the testing-run doc cites — entirely mock-driven.

**Estimated total: ~116 new tests across 7 files** (test count goes up, per test-discipline). The implementer captures the exact `Tests: N passed` line + exit 0 before claiming done and records it in `docs/core/current-status.md`.

---

## Dependencies (cards / docs / files)

- **Assumes QOL-023 complete** (it is): `buildAuthRedirectUrl` maps `invite → /auth/callback` (`buildAuthRedirectUrl.ts:50`), `mapAuthError` has the `redirect_invalid` branch, and `REDIRECT_INVALID_MESSAGE` is staged (`authApi.ts:13`). QOL-023:265 explicitly names this card as the consumer.
- **Assumes AUTH-INVITE-BRANDED-SMOKE shipped** the send + template seam (it did): `admin-users` `invite_user` → `inviteUserByEmail(email,{redirectTo})` (`admin-users/index.ts:374`) and `supabase/templates/invite.html`. This card consumes the redirect that path produces.
- **Reads** `src/lib/supabase.ts` (`supabase` singleton + `SUPABASE_CONFIGURED`; `detectSessionInUrl:false` preserved), `src/features/session/AppSessionProvider.tsx:42-84` (the existing `onAuthStateChange` that auto-dispatches `SIGNED_IN`), and App.tsx's state-flag routing (`aboutOpen`/`demoCorridorOpen`/`pendingInviteIntent`).
- **Will unblock** the real seed invite smoke (G1): receipt → render → CTA → `/auth/callback` → account setup → sign-in. After this merges, the operator runs the gated `scripts/auth/sendInviteSmoke.js --live …` second pass.

---

## Risks

- **PKCE-verifier caveat (the one real gotcha).** If the project ever sets `flowType:'pkce'` in `src/lib/supabase.ts`, an **admin-initiated** invite produces a `?code=` whose PKCE `code_verifier` was never stored in *this* browser (the flow began server-side), so `exchangeCodeForSession` would fail with a missing-verifier error. **Mitigation:** the project is implicit today (verified), so the live invite lands as a fragment token and the `?code=` branch is purely defensive. If flow ever switches to PKCE, the correct fix is `verifyOtp({ token_hash, type })` with a `{{ .TokenHash }}` template — documented as a future card, NOT built here. The implementer must keep the `?code=` branch but not assume it is the live path.
- **Redirect allow-list (G4 from the smoke doc).** The deployed origin must be in Supabase Auth → URL Configuration → Redirect URLs, or GoTrue ignores `redirect_to` and sends the user to the Site URL instead — the callback screen would then never load. This is an **operator/Dashboard** precondition, not code; listed in Operator steps. Note the live discrepancy: `config.toml` names `dev-cdiscourse.netlify.app` while `buildAuthRedirectUrl.ts:65` `HOSTED_FALLBACK_ORIGIN = dev.cdiscourse.com` — on web, `resolveRuntimeOrigin` uses the real `window.location.origin`, so whichever host actually serves the SPA is the origin that must be allow-listed.
- **Existing tests:** none should break — sign-in/sign-up/reset behavior is byte-unchanged, `detectSessionInUrl` stays false, and the App.tsx branch is guarded by web-path detection (native + normal web boot unaffected). If any pre-existing App.tsx structural snapshot exists it may need a benign update (none found in the test tree).
- **`history.replaceState` availability:** present on every web target; guarded by the same `typeof window` check. Native never reaches this code.
- **Set-password not enforced:** an invited user who closes the tab before setting a password stays passwordless and must recover later. Acceptable v1 trade-off; flagged so it isn't mistaken for a bug. (No silent auto-skip is added.)

---

## Out of scope

- **`/auth/reset` password-reset consumer** — a separate route QOL-023 reserved (`DEFAULT_AUTH_ROUTES.password_reset = '/auth/reset'`); future card. This card is `/auth/callback` only.
- **Native deep-link capture** (`expo-linking` for `cdiscourse://auth/callback`) — future-scoped; dependency-level change, mirrors the QOL-038 native deferral.
- **`token_hash` / `verifyOtp` consumption** — parser flags it `unsupported` for diagnostics; not consumed in v1.
- **Sending any invite** (single or batch) — explicitly forbidden by the card; the send seam already exists and is operator-gated.
- **Any hosted Supabase config** — SMTP (G2), template paste/sync (G3), redirect allow-list (G4) are operator Dashboard actions.
- **Flipping `detectSessionInUrl` to `true`** — would conflict with manual consumption.
- **Any migration / Edge Function / RLS change**; **OAuth / social login** (doctrine §10).
- **Voting/scoring, search, push** and other v1-forbidden items.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks):** the screen assigns no winner/loser/truth/verdict to any person or claim; copy is link-state language only. It never reads or writes the rules engine, `arguments`, `flags`, or any score — auth/session only. The deterministic engine remains the sole submit gate (untouched). Ban-list test pins the copy.
- **cdiscourse-doctrine §6 (secrets):** no `SERVICE_ROLE` / `ANTHROPIC_API_KEY` in any new client file (pinned by a source-scan test + the pre-commit grep). The password is sent only into `supabase.auth.updateUser({ password })` and never logged, persisted, or returned in a diagnostic. Tokens are `***`-redacted in `redactAuthCallbackUrl` / diagnostics. The client uses only the public anon/publishable key via the existing `supabase` singleton.
- **cdiscourse-doctrine §7 (no AI calls from the app):** none — no Anthropic/xAI/X/fetch to any provider; the only network is the injected Supabase auth client.
- **cdiscourse-doctrine §9 (plain language):** no internal code is surfaced; `mapAuthError` + `AUTH_CALLBACK_COPY` produce plain prose; unknown error messages degrade to a generic plain line rather than echoing a raw code/stack.
- **cdiscourse-doctrine §10 (v1 scope):** email+password only — **no OAuth**, no new forbidden feature.
- **test-discipline:** tests ship with the card (7 files, ~116 tests); pure modules get full branch coverage; count goes up; no `.skip`/`.only`; gate greens captured by exit code.
- **accessibility-targets:** reuse `Button` (minHeight 48, role/label/`accessibilityState.disabled`) and `TextInputField` (minHeight 44, `accessibilityLabel`, `secureTextEntry`); password error rendered via `ErrorNotice` (`accessibilityRole="alert"`); submit disabled until `validateNewPassword` passes (reflected in `accessibilityState`); focus/reading order top-to-bottom; **reduce-motion N/A** (the screen introduces no animation); **keyboard-badge rule N/A** (no key badges added).
- **expo-rn-patterns:** no new dependency — RN primitives + existing shared components only; pure `*Model`-style files (`parseAuthCallbackUrl.ts`) carry no React/Supabase import; platform divergence handled by a single `typeof window` guard rather than scattered `Platform.OS` checks.

---

## Operator steps

**For merging this card:** **GATE-C — operator-gated merge.** Stop at PR; no automerge (auth/session behavior). Reviewer applies the auth/session lane checks. **No** migration, **no** function deploy, **no** hosted config, **no** secret — so there is **no `db push` / `functions deploy` for this card's code.**

**To then run the real seed invite smoke (G1 unblocked) — downstream, not part of this merge:**
1. Confirm the **deployed origin** that serves the SPA (Netlify `dev-cdiscourse.netlify.app` per the smoke doc, or Cloud Run `dev.cdiscourse.com`) is in **Supabase Auth → URL Configuration → Redirect URLs** (G4).
2. Confirm **custom SMTP** is configured in the hosted Auth settings (G2) — default SMTP is rate-limited (`email_sent=2`/hr) and not for arbitrary external addresses.
3. Paste `supabase/templates/invite.html` into **Dashboard → Authentication → Email Templates → "Invite user"** so the hosted email is branded (G3), gated by `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE`.
4. Arm `CDISCOURSE_ALLOW_INVITE_SEND_SMOKE=1` + seed env and run `node scripts/auth/sendInviteSmoke.js --live --email <seed> --redirect-to https://<origin>/auth/callback --smtp-posture custom`, then open the link and verify the callback screen → set-password → sign-in end to end.

These four are the existing smoke-doc preconditions, repeated in the implementer-authored `docs/testing-runs/2026-06-13-auth-callback-consumer.md` operator checklist. **For this card's code change itself: None — pure client code change, no operator deploy.**
