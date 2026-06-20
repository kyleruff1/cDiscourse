# AUTH-GOOGLE-SSO-READINESS-001 — zero-mutation Google SSO readiness audit + implementation map

**Status:** Readiness audit (read-only). Issue #768. Builds on closed #743 (ADR) + #744 (architecture) + the AUTH-FOUNDATION design docs (#739/#741/#742). Maps the GATE-C Google SSO lane (#745/#746/#747/#748). **No Supabase/Google config, no provider call, no secret, no live Google button, no provisioning/invite write, no deploy was performed.**

## 1. Executive summary

**Verdict: READY_FOR_745.** The codebase seams required for Google SSO are in place and provider-independent — the app can proceed to the GATE-C hosted-config card (#745) next. Security posture is clean: no account enumeration, no service-role in the client, no provider secret in the repo, and the default Sign In surface renders no live/enabled Google button (future-framed "coming soon" only).

Reusable seams (evidence in §3–§7):
- **Callback consumer is OAuth-ready** — `consumeAuthCallback` already has the `exchangeCodeForSession(code)` branch, a 12 s timeout guard, idempotent re-entry, and the correct flow distinction (a Google `code` return → `success`, never the invite-only `needs_password`). No parallel callback needed.
- **Single authoritative session listener** — one `onAuthStateChange` in `AppSessionProvider`; a Google-established session propagates for free.
- **Provider slot is inert + zero-re-layout** — `authProviderSlotModel` flips the reserved Google slot via one flag; default surface stays email-only.
- **Provisioning is trigger-based + provider-independent** — `handle_new_user` fires on the `auth.users` insert identically for a future Google identity (conflict target is `profiles.id`, not email → no same-email enumeration surface).
- **Invite intent persists provider-independently** — the pending-invite store + resume path do not assume the email round-trip.

**Two honest downstream work items (neither blocks #745):**
- **#747 (genuine GATE-C):** the `handle_new_user` trigger reads only `raw_user_meta_data->>'display_name'`; Google carries the name under `full_name`/`name`, so a Google user would land with a NULL `display_name`. Fixing it needs a NEW coalescing migration (never edit an applied one) — migration-bearing, heightened reviewer verification. A Google user still gets a profile row (id-keyed); only the display name is empty until this lands.
- **#748:** the client wiring to resume a persisted invite intent specifically after a Google callback (the store + resume decision exist; the OAuth-return trigger does not, because no `signInWithOAuth` exists yet). Likely client-only (the `profiles` self-heal is already permitted by `auth.uid()`-scoped RLS — §5), GATE-C only if an Edge/RLS change proves necessary.

## 2. Baseline SHAs

| Ref | SHA |
|---|---|
| HEAD / origin/main | `99ac928` |
| origin/netlify-prod | `99ac928` (fully published — OD-5 lane shipped via FF-024) |

No unpublished runtime. Tracked tree clean. No live `signInWithOAuth` anywhere in `src/` (verified). Provider-ready UI is merged + published (#740/#760, email-only default).

## Current auth/session map

> Lane A readiness map for the Google SSO lane (#743–#748). READ-ONLY. Cites `file:line` in the primary checkout `C:/Users/kyler/cdiscourse/debate-constitution-app`. No config, no provider call, no OAuth proposed here.

### 1. Supabase client init — single client, implicit flow, manual callback consume
`src/lib/supabase.ts:69-87` creates the one app-wide client via `createClient`. Material facts for the SSO lane:
- **Publishable key, not anon** — resolved as `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`supabase.ts:59-62`), with a web runtime-env shim (`window.__CDISCOURSE_RUNTIME_ENV__`, `supabase.ts:32-54`) taking precedence over `process.env`. `SUPABASE_CONFIGURED` (`supabase.ts:65`) gates every auth wrapper.
- **`detectSessionInUrl: false`** (`supabase.ts:77`). The client does NOT auto-parse a callback URL. This is load-bearing for the lane: the app deliberately owns callback consumption manually (see §3/§4), so there is no competing auto-consumer to race a Google return.
- **No `flowType` set** (`supabase.ts:73-86`) → GoTrue's default **implicit** flow. `src/lib/auth/parseAuthCallbackUrl.ts:11-15` documents this: the live invite/confirm shape is a URL **fragment** (`#access_token=…`); the PKCE `?code=` query shape is parsed **defensively** but is not what email flows land as today. A Google OAuth return is the case that exercises the `code` branch in practice.
- `autoRefreshToken: true`, `persistSession: true`, `storage: AsyncStorage` (`supabase.ts:74-76`); fetch wrapped by `makeTimeoutFetch` (`supabase.ts:83-85`) so a stalled GoTrue request aborts.

### 2. Session lifecycle — one authoritative listener
`src/features/session/AppSessionProvider.tsx:42-87` registers the **sole** in-app `onAuthStateChange` subscription. It handles `INITIAL_SESSION` (`:45-59`), `SIGNED_IN` (`:61-73`, de-duped against `TOKEN_REFRESHED` via `lastUserId`), and `SIGNED_OUT` (`:75-81`), dispatching into a reducer-backed `SessionState`. The exported `subscribeToAuthChanges` (`src/features/auth/authApi.ts:234-240`) is a helper that is **not** mounted in the app shell, so there is no double-listener. `getSession` is only read by non-owning consumers: `authApi.ts:227-231` (`getCurrentSession`) and `account/contactApi.ts:142` (email display). **Consequence for SSO:** a session established by the callback consume (`setSession`/`exchangeCodeForSession`) propagates to the app for free through this one listener — `App.tsx:328-329` states exactly this. No new session plumbing is needed for Google.

### 3. Auth callback route — real `/auth/callback`, synchronous capture, highest priority
There **is** a real callback route, not implicit-only recovery:
- `App.tsx:140-144` captures a `/auth/callback` navigation **synchronously in a `useState` initializer** at first render (web-only via `typeof window` guard) so the implicit-flow fragment token is read before any effect can strip/race it (`isAuthCallbackPath` from `parseAuthCallbackUrl.ts:76-80`).
- `App.tsx:321-335` routes the callback with the **highest priority** (above unconfigured/invite/signed_out/shell). `AuthCallbackScreen.tsx:69-89` runs parse + consume exactly once (ref-guarded), injecting `supabase.auth` as the client (`AuthCallbackScreen.tsx:83`).

### 4. Code-exchange consumer — already present and reusable by Google OAuth
`src/features/auth/consumeAuthCallback.ts` is a pure, client-injected consumer with a discriminated outcome (`success | needs_password | already_session | error`, `:28-33`). It already implements **all** branches the Google round-trip needs:
- **PKCE `code` branch** (`consumeAuthCallback.ts:162-170`) calls `client.exchangeCodeForSession(parsed.code)` — this is the branch a Google return hits. `parseAuthCallbackUrl.ts:173-177` produces `{ kind: 'code', code, type }`.
- **Implicit `tokens` branch** (`:147-160`) calls `setSession` for fragment tokens (the email-invite reality).
- **`empty` branch** (`:134-145`) probes `getSession` for idempotent re-entry (`already_session`).
- Every awaited client call is bounded by `DEFAULT_CONSUME_TIMEOUT_MS = 12_000` (`:84`, `:95-105`); a stall maps to a recoverable `network` error, so a hung Google exchange recovers instead of pinning the screen.
- Errors are mapped to non-secret reason classes only (`:60-72`); no token value is logged anywhere (`AuthCallbackScreen.tsx:24-28`).

### 5. Flow distinction — `consumeAuthCallback` DOES distinguish flows; `needs_password` is invite-only
`isInvite(type)` (`consumeAuthCallback.ts:51-54`) returns true **only** for `type === 'invite'`. Both the `tokens` branch (`:156`) and the `code` branch (`:167`) return `needs_password` **iff** `isInvite(parsed.type)`, else `success`. A Google OAuth `code` return carries no `type` query param → `parseAuthCallbackUrl.ts:176` sets `type: null` → `isInvite(null) === false` → **`success`, never `needs_password`** (OAuth users have no set-password step). `outcomeToPhase` (`AuthCallbackScreen.tsx:48-59`) maps `success`/`already_session` → `accepted`, `needs_password` → the set-password form. This matches the design's stated outcome rule (`docs/designs/AUTH-GOOGLE-SSO-001.md:47`).

### 6. No OAuth today; the forward-compat seam is already built
- Repo-wide grep: **zero** `signInWithOAuth` / `signInWithIdToken` / `provider: 'google'` in `src/`. The live auth surface is email/password + invite-set-password (`authApi.ts:185-211`, `:167-183`) + password reset (`:133-153`) + signout (`:213-225`).
- `src/features/auth/authProviderSlotModel.ts` is the pure, no-React provider-slot contract that the SSO UI card (#746) consumes. Google is a **reserved slot, `enabled: false`** (`:41-55`, `:117-121`); `resolveAuthProviderSlotRegion` flips it via `enabledSlots` with **zero first-run re-layout** (`:138-156`). The module documents (`:18-27`) that no provider button renders and the provider call must appear **nowhere in `src/`** while disabled (a source-scan guard). `CONTINUE_WITH_GOOGLE_LABEL` (`:96`) is reserved but not rendered.

### 7. Redirect URL construction — reusable by an OAuth `redirectTo`
`buildAuthRedirectUrl` (`src/lib/auth/buildAuthRedirectUrl.ts:161-174`) is pure and supports an explicit `route` override (`:165-169`); `AuthRedirectKind` enumerates the five **email** flows only (`:18-23`, default routes `:47-53`), so an OAuth caller would pass `route: '/auth/callback'` rather than overloading an email kind. Origin comes from `resolveRuntimeOrigin()` (`resolveRuntimeOrigin.ts:34-60`, prefers `window.location.origin`) + `getIsDev()`. Failure degrades to `null` via `safeBuildRedirect` (`authApi.ts:73-83`) so a bad origin never hard-blocks. **Reconciliation flag (cosmetic-at-runtime):** `HOSTED_FALLBACK_ORIGIN = https://dev.cdiscourse.com` (`buildAuthRedirectUrl.ts:65`) is NOT the deployed host (`https://dev-cdiscourse.netlify.app`, `supabase/config.toml:167`); reached only if no runtime origin resolves in a non-dev build.

### 8. Native vs web (allow-list scope)
`app.json` declares **no** deep-link `scheme` (verified). So the callback path is **web-only** today: `App.tsx:140-144` is `typeof window`-guarded; native boot never activates it. Google therefore ships web-first; native Google would require a `scheme` + native redirect URI (its own card). `supabase/config.toml:164-169` `additional_redirect_urls` already allow-lists the app return URLs that cover `/auth/callback`: `http://localhost:8081/**`, `https://dev-cdiscourse.netlify.app/**`, `https://*--dev-cdiscourse.netlify.app/**`. `site_url = "http://localhost:8081"` (`config.toml:156`).

### Readiness verdict
The existing callback consumer is **ready to be reused by Google OAuth without a parallel callback**: the `code`/`exchangeCodeForSession` branch, the timeout guard, the flow-distinction (`success` vs invite-only `needs_password`), the single session listener, and the inert provider slot are all in place. The remaining work is exactly the lane's later cards: the `signInWithGoogle` wrapper + live button (#746, client UI, INERT until #745), and the hosted provider config + redirect allow-list (#745, GATE-C, operator-only).

## Provider-ready UI status

**Lane B verdict: READY (provider-ready, email-only, inert).** The Sign In surface is restructured into a provider-region → divider → email/password layout whose default state is EMAIL-ONLY with a FUTURE-reserved, **disabled** Google slot. No clickable/enabled provider button renders, `signInWithOAuth` appears nowhere in `src/`, and a single canonical pure model (`authProviderSlotModel.ts`) owns the slot decision so #746 lights it with zero re-layout. No Facebook/Apple. Nothing in this lane proposes or performs OAuth, hosted config, or any provisioning write — those stay in the later GATE-C cards (#745/#746/#747/#748).

### 1. Default surface is email-only (confirmed)

- `AuthScreen.tsx:45` resolves the region **once** with no args: `const providerRegion = resolveAuthProviderSlotRegion();`. The no-args path returns empty `slots`, `anyProviderEnabled: false`, `hasVisibleProvider: false`, the future-framed unavailable copy, and the divider label (`authProviderSlotModel.ts:138-156`).
- `AuthScreen.tsx:150-163`: when `hasVisibleProvider` is false (the v1 default) the region renders the provider-unavailable `Text` (`testID="auth-provider-unavailable"`, `accessibilityLiveRegion="polite"`) — **not** a button. The `hasVisibleProvider === true` branch (`:152-153`, the `auth-provider-region` wrapper) is the FUTURE #746 mount point and is unreached today.
- The copy is future-framed and never claims Google is live: `PROVIDER_UNAVAILABLE_COPY = 'Social sign-in is coming soon. Use your email and password below to continue.'` (`authProviderSlotModel.ts:110-111`).
- The divider (`AuthScreen.tsx:165-171`) is decorative: rules carry `importantForAccessibility="no"`; the label is plain `Text` (`PROVIDER_EMAIL_DIVIDER_LABEL = 'or continue with email'`, `authProviderSlotModel.ts:102`), never a Pressable.
- The email/password form below (`AuthScreen.tsx:173-213`) is unchanged: `validateAuthInput` (`authApi.ts:22`) → `signIn`/`signUp` (the email path uses `signInWithEmailPassword`, `authApi.ts:185-211`).

### 2. The provider region renders a notice, NOT an enabled Google button (confirmed)

- `authProviderSlotModel.ts:41` reserves `AuthProviderSlotId = 'google' | 'apple' | 'facebook'` — **IDs only; none render in v1**. `resolveAuthProviderSlotRegion` filters to ids in `FIRST_RUN_PROVIDER_SLOT_ORDER` **and** `s.enabled` (`:143-145`); with no `enabledSlots` the rendered set is empty.
- `CONTINUE_WITH_GOOGLE_LABEL = 'Continue with Google'` exists as a future-reserved constant (`authProviderSlotModel.ts:96`) but is **not rendered** while disabled. Source guards assert the literal is absent from `AuthScreen.tsx` (`authScreenProviderRegion.test.tsx:137-141`).

### 3. ZERO `signInWithOAuth` in the render path / `src/` (confirmed)

- Tree grep over `src/` for `signInWithOAuth|signInWithIdToken|oauth|OAuth|signInWithGoogle` returns only a doc-comment in `authProviderSlotModel.ts:33` and an unrelated `subscribeToAuthChanges` substring in `authApi.ts:234` — **no call site**.
- Enforced by tests: `authScreenProviderRegion.test.tsx:131-135` (AuthScreen has no `signInWithOAuth`/`signInWithIdToken`/`oauth`), `:143-160` (tree-walk asserts `signInWithOAuth` appears in NO `.ts`/`.tsx` under `src/`), `:98-101` (rendering the default surface never calls a mocked `signInWithOAuth` — must stay at 0). `authProviderSlotModel.test.ts:162-164` asserts the model contains no `signInWithOAuth`. No Facebook/Apple affordance renders (`authScreenProviderRegion.test.tsx:81-85`).

### 4. EXACTLY what #746 (AUTH-GOOGLE-SSO-003) must add later

#746 is a UI-only consumer of this lane's seam (NOT GATE-C by itself; inert until #745 enables the provider). The seam is precise and zero-re-layout:

**(a) The model flag that flips.** Pass `enabledSlots` into the already-called resolver — no model edit needed: `resolveAuthProviderSlotRegion({ enabledSlots: [{ id: 'google', order: 0, enabled: true }] })`. This flips `anyProviderEnabled`/`hasVisibleProvider` to `true` and returns one sorted `google` slot with an empty `providerUnavailableCopy` (`authProviderSlotModel.ts:141-155`; proven consumable by `authProviderSlotModel.test.ts:66-78`). The flip must be **gated on config** (#745) so the live button never appears before the provider exists.

**(b) Where the real button + `onPress` drop in.** Inside the existing `hasVisibleProvider` branch at `AuthScreen.tsx:152-153` (the `testID="auth-provider-region"` wrapper). Render the real wired button there using `CONTINUE_WITH_GOOGLE_LABEL`; the region/divider/email path do not reflow.

**(c) The `signInWithGoogle` wrapper.** A new wrapper in `authApi.ts` paralleling `signInWithEmailPassword` (`authApi.ts:185-211`): same `AuthResult` shape (`types.ts`), same `SUPABASE_CONFIGURED` gate, `mapAuthError` reuse (`authApi.ts:43-62`), **no secret**. Body: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })` (architecture-confirmed at `AUTH-GOOGLE-SSO-001.md:13-19`, `AUTH-GOOGLE-SSO-INDEX.md:26`).

**(d) The `redirectTo` it must pass.** `buildAuthRedirectUrl({ kind, runtimeOrigin: resolveRuntimeOrigin(), isDev: getIsDev(), route: '/auth/callback' })`. **Load-bearing detail:** `AuthRedirectKind` is the five email flows only (`buildAuthRedirectUrl.ts:18-23`) — it does NOT name an OAuth kind — so the wrapper passes an **explicit `route: '/auth/callback'`** override (supported at `buildAuthRedirectUrl.ts:165-169`) rather than overloading an email kind (`AUTH-GOOGLE-SSO-001.md:22`). Redirect failure must degrade exactly like the email flows: wrap in `safeBuildRedirect` semantics (`authApi.ts:73-83`) → omit `redirectTo` on `InvalidAuthRedirectOrigin`, never block; surface `REDIRECT_INVALID_MESSAGE` (`authApi.ts:13-14`) for `redirect_invalid`, never the raw `invalid_auth_redirect_origin` code. The post-auth landing reuses the existing `consumeAuthCallback` PKCE branch (`AUTH-GOOGLE-SSO-INDEX.md:27`) — Google returns `success`, not the invite-only `needs_password`.

**(e) The a11y/test contract #746 must satisfy (and must not regress).** From the design (`AUTH-FOUNDATION-UI-001.md:54-57`) and the existing guard suite:
- The live button must use the shared `Button` (`src/components/Button.tsx`) which supplies `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState`, and `minHeight: 48` (≥44 tap target) — accessibility-targets compliance.
- Wrapper unit test (per #746 + `AUTH-GOOGLE-SSO-001.md:79-81`): `signInWithGoogle` calls `signInWithOAuth` with `provider: 'google'` and a `redirectTo` derived from `buildAuthRedirectUrl` (asserted via the Supabase mock, **never a live call**); refuses with the config-missing `AuthResult` when `SUPABASE_CONFIGURED` is false; never throws.
- Component test: the email/password fallback still submits (`authScreenProviderRegion.test.tsx:104-122` is the pattern to preserve); no Facebook/Apple button rendered.
- **The current "must-stay-0" / "no Continue-with-Google literal" guards (`authScreenProviderRegion.test.tsx:75-101, 131-141`) and the tree-wide `signInWithOAuth`-absent guard (`:143-160`) will need to be re-scoped by #746** — the tree-scan in particular flips from "must be absent everywhere" to "permitted only in the new wrapper." That re-scope is #746's responsibility and is the one place this lane's tests intentionally hard-gate the future card.

### Doctrine posture for this lane (READ-ONLY map; no recommendations to perform)

Supabase Auth remains the identity owner; the deterministic engine is untouched (this is the pre-auth screen). No secret/service-role in client (`grep` clean for `signInWithOAuth`; `redirectTo` is a PUBLIC URL, `buildAuthRedirectUrl.ts:9-15`). No account enumeration on this surface. OAuth does not exist yet, so it cannot bypass invite/seat/room rules — #748 owns redemption-through-Google and is out of this lane. Provisioning idempotency (one `public.profiles` row via the `handle_new_user` trigger) is #747's concern, not this lane's. Voice/Google are not claimed LIVE: the only provider mention is the future-framed "coming soon" notice. Facebook is reserved-id-only and explicitly deferred (not this lane).

## Lane C — Profile provisioning findings (readiness map for #747)

> READ-ONLY map. Cites the primary checkout (`C:/Users/kyler/cdiscourse/debate-constitution-app`); this worktree has 0 tracked files checked out, HEAD `99ac928` = `main`. No files edited, no git/gh writes, no config proposed. This section MAPS readiness; it performs none of #747's GATE-C steps.

### Where profile rows are created today (email/password users)

Profile rows are created **server-side, by a single database trigger on `auth.users`** — there is no client-side profile insert and no service-role in the client.

- `public.handle_new_user()` is `SECURITY DEFINER` with a pinned `SET search_path = public` and runs `INSERT INTO public.profiles (id, display_name, role) VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name', 'user') ON CONFLICT (id) DO NOTHING;` (`supabase/migrations/20260516000001_initial_schema.sql:37-49`; `SECURITY DEFINER` at `:40`, pinned search_path at `:41`, `ON CONFLICT (id) DO NOTHING` at `:46`).
- Fired by `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();` (`20260516000001_initial_schema.sql:51-53`).
- `public.profiles.id` is `uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, `role` defaults to `'user'` (`20260516000001_initial_schema.sql:25-31`; PK at `:26`). PK + `ON CONFLICT (id) DO NOTHING` means **at most one row per user can ever exist**.

The client's email/password `signUp` passes only `data: { display_name: displayName ?? '' }` into auth metadata (`src/features/auth/authApi.ts:104-111`; `options.data` at `:108`); the trigger reads `NEW.raw_user_meta_data ->> 'display_name'` (`migration:45`) and writes the row. There is **no `insert('profiles')` in the client** — the only client `profiles` calls are a SELECT (`src/features/account/accountApi.ts:55-59`) and an UPDATE of display_name (`accountApi.ts:90-93`). Repo-wide grep for `signInWithOAuth` over `src/` returns **zero matches**, so OAuth is genuinely not implemented live (doctrine "Google/voice must not be claimed LIVE when not implemented" is satisfied).

### Is provisioning trigger-based / provider-independent? — YES

The trigger keys off the **`auth.users` insert**, not off any provider (`AFTER INSERT ON auth.users`, `migration:51-53`). A future Google identity also produces an `auth.users` row, so it fires the **identical** trigger and yields exactly one profile. No branch of the provisioning logic inspects the provider. The merged ADR ratifies this independently: "the `handle_new_user` trigger fires on **any** `auth.users` insert, including an OAuth insert" (`docs/adr/AUTH-GOOGLE-SSO-ADR-001.md:21`, decision §8 at `:34`). The merged design doc agrees (`docs/designs/AUTH-FOUNDATION-PROVISIONING-001.md:52-54`).

### Is there a missing-profile self-heal? — NO (none in code today)

There is **no self-heal** anywhere. The missing-profile case dead-ends: when the profile SELECT returns no row, `fetchOwnProfile` maps `PGRST116` to `not_found` and returns it to the caller without attempting a re-provision (`src/features/account/accountApi.ts:61-67`). Grep for `upsert`/`ensureProfile`/`provisionProfile`/`self-heal`/`missing.profile` over `src/` finds only an unrelated `debate_user_state` upsert (`src/features/debates/debateUserStateApi.ts:70`). The design doc states this explicitly: "This self-heal does not exist in code today… If/when implemented it is a GATE-C follow-up… belongs to #747" (`AUTH-FOUNDATION-PROVISIONING-001.md:30`).

### MATERIAL CORRECTION to the merged design doc — a scoped client self-heal already has its RLS grant (likely NOT GATE-C)

The design doc's Q4 rejects a client-side insert fallback because it "would require either a broad RLS insert policy or a service-role key in the client. Both are out of bounds." (`AUTH-FOUNDATION-PROVISIONING-001.md:29`); issue #741 Q4 likewise says "do NOT grant the client direct insert." **But the scoped grant already exists:** RLS policy `"profiles: users can insert own" … FOR INSERT TO authenticated WITH CHECK (id = auth.uid())` (`supabase/migrations/20260516000002_rls_policies.sql:61-65`). This is a **narrow, self-only** insert (not a broad policy, no service-role). Therefore a missing-profile self-heal can be a **pure client-side idempotent `.upsert({ id: uid, ... }, { onConflict: 'id' })` executed under the existing anon-key + RLS** — no new migration, no RPC, no Edge Function, no service-role. That keeps the "no service-role in client" invariant fully intact (anon-key + `WITH CHECK (id = auth.uid())` ≠ service-role) and matches the existing `debate_user_state` upsert-under-RLS pattern. The doc's two listed server options (SECURITY DEFINER RPC or Edge upsert, `:28`) remain valid but are **not the only safe option** and are heavier than necessary. **Net for #747: the self-heal alone is likely NOT GATE-C.** (The doc's broader point — never grant a *broad* insert or ship service-role — still holds; it just overstated that "client INSERT fallback is out of bounds," since the auth.uid()-scoped grant is already present and safe.)

### Same-email conflict risk + idempotency needs for #747

- **Idempotency spine is already in place.** `ON CONFLICT (id) DO NOTHING` (`migration:46`) + PK on `profiles.id` (`migration:26`) guarantee no duplicate rows from trigger retries; any self-heal MUST reuse the same conflict-on-`id` semantics so a race between trigger and self-heal can never double-insert (`AUTH-FOUNDATION-PROVISIONING-001.md:32-34`).
- **Same-email is a config-time decision (#745), honored in #747.** Supabase Auth stays identity owner; the binding rule is **never takeover, never enumerate**; until #745 fixes the linking mode, downstream treats "distinct, no-takeover, no-enumeration" as the safe default (`AUTH-GOOGLE-SSO-ADR-001.md:39-45`, decision §9 at `:35-36`). Provisioning keys to `auth.users(id)` so identity ownership is Supabase's, not the app's (`AUTH-FOUNDATION-PROVISIONING-001.md:40`). The conflict target is `id` (the `auth.users` uuid), **not email**, so the upsert itself carries no cross-account takeover risk.
- **No-enumeration is required of every path.** Existing auth error mapping collapses Supabase messages into non-revealing classes (`src/features/auth/authApi.ts:43-62`); a self-heal must return the **same outcome shape regardless of pre-existing state** (`AUTH-FOUNDATION-PROVISIONING-001.md:46`).
- **The real #747 work item = display-name metadata mapping (this IS the GATE-C trigger).** The trigger reads only `raw_user_meta_data ->> 'display_name'` (`migration:45`), but a Google identity carries the name under `full_name` / `name`, so a Google user gets a **NULL display_name** (`AUTH-FOUNDATION-PROVISIONING-001.md:42`; ADR `:62`; INDEX `docs/designs/AUTH-FOUNDATION-INDEX.md:46`; #747 body). Fixing this means a **NEW migration** that coalesces `display_name`/`full_name`/`name` (never edit the applied `20260516000001`). **That migration is migration-bearing → GATE-C** (heightened reviewer verification: `npx supabase db reset --linked=false` when Docker available, else heightened textual review per roadmap-reviewer template) — `AUTH-FOUNDATION-PROVISIONING-001.md:64-66`, ADR `:73`.

### Is #747 even needed if the trigger already covers OAuth?

Partly. For **pure profile-row creation + idempotency**, the trigger already covers OAuth with zero new code (provider-independent by construction; #747 body says "VERIFY first… no new code may be needed"). What #747 still genuinely needs: (1) the display-name coalescing migration (GATE-C, migration-bearing) so Google users don't land with NULL display_name; (2) the optional missing-profile self-heal — which, per the correction above, can be a non-GATE-C client upsert under the existing `id = auth.uid()` RLS policy; (3) assert the #745 same-email mode (link vs distinct) with no-takeover / no-enumeration tests. #747 (= AUTH-GOOGLE-SSO-004) is OPEN, p0, and depends on #741 (CLOSED) + #743 ADR (Accepted) + #745 (config, to test live).

## Invite/redirect continuity findings (Lane D)

> READ-ONLY map of how invite/room intent survives an auth round-trip and what #748 (AUTH-GOOGLE-SSO-005) must close for the Google OAuth path. No config, OAuth, or provisioning is proposed here; this maps readiness for later GATE-C cards.

### 1. End-to-end continuity contract (capture → persist → survive → resume → clear)

**Capture (cold start).** App.tsx parses `window.location.href` once at first render (empty-deps one-shot, `App.tsx:191-228`) via `resolveColdStartInviteToken` (`src/features/invites/bridgedInviteToken.ts:83-87`), which matches EITHER the `/invite/<token>` deep-link path (`parseInviteDeepLink`) OR the `/auth/callback?invite=<token>` bridge query (`extractBridgedInviteToken`, `bridgedInviteToken.ts:48-70`). A hit is packaged by `buildPendingInviteIntent(token, nowIso)` → `{ token, capturedAt }` (`src/features/invites/pendingInviteIntent.ts:38-50, 70-78`).

**Persist (two stores).** The intent is written to BOTH a dedicated device-local AsyncStorage key `cdiscourse:pending-invite-intent` (`pendingInviteIntent.ts:35`, written `App.tsx:206` via `savePendingInviteIntentToStorage`, `pendingInviteIntent.ts:139-150`) AND the in-memory session slice (`dispatch({ type: 'SET_PENDING_INVITE_INTENT' })`, `App.tsx:207`). The AsyncStorage slot is the provider-independent carrier — it covers the anonymous → sign-up handshake where there is no user-keyed snapshot (`pendingInviteIntent.ts:11-19`). The token is never logged by this module (`pendingInviteIntent.ts:24-29`).

**Survive.** A 24h freshness window (`PENDING_INVITE_INTENT_FRESHNESS_MS = 24*60*60*1000`, `pendingInviteIntent.ts:63`) drops stale intents on read; `loadFreshPendingInviteIntent` (`:118-126`) and `loadPendingInviteIntentFromStorage` (`:156-172`) parse + freshness-check and return `null` for missing/malformed/stale. Future-dated `capturedAt` (clock skew) is treated as fresh (`:99-110, 109`).

**Resume.** When `pendingInviteIntent` is present in session state, `InviteRedeemGate` renders above every other screen (`App.tsx:338-355`). The gate resolves the token (`lookupInviteByToken`, `InviteRedeemGate.tsx:97-106`) and auto-fires `acceptRoomInvite` once `signedIn` && live `pending` && `viewerEmail` is set (`InviteRedeemGate.tsx:125-134`). Email-match is **server-side**: the client cannot see the invited email from lookup (`LookupInviteByTokenResponse.room` carries only `title` + `invitedByDisplayName`, `inviteApi.ts:92-100`), so the gate optimistically accepts and the Edge Function returns `invite_email_mismatch` on a mismatch (`InviteRedeemGate.tsx:129-133`, mapped to `MismatchPanel` `:329-338`).

**Clear.** On accept success or invitee exit, `clearPendingInviteIntentFromStorage` (idempotent, `pendingInviteIntent.ts:175-181`) + `CLEAR_PENDING_INVITE_INTENT` run (`App.tsx:242-254`), so a completed/abandoned intent does not re-fire on the next cold start.

### 2. Is the resume path provider-independent, or does it assume the email-confirmation round-trip?

**The persistence layer is provider-independent by construction.** The intent lives in a fixed-name AsyncStorage slot read back regardless of how the session is later established (`pendingInviteIntent.ts:35, 156-172`); neither the freshness window nor the parse helpers make any provider assumption. The resume *gate trigger* (`InviteRedeemGate.tsx:125-134`) keys only on `signedIn` + `pending` + `viewerEmail` — also provider-agnostic.

**But the App.tsx orchestration that feeds the gate is currently shaped around the email-confirmation/bridge round-trip, and this is exactly the seam #748 must close:**

- The cold-start re-read effect (`App.tsx:191-228`) runs ONCE with empty deps. On an OAuth return to `/auth/callback?code=<authcode>`, `resolveColdStartInviteToken` returns `null` — an OAuth provider's return URL carries `?code=` (or a token fragment), NOT `/invite/<token>` or `?invite=` (`bridgedInviteToken.ts:64-69, 83-87`). The effect therefore falls through to the persisted-intent branch `loadPendingInviteIntentFromStorage` (`App.tsx:218-221`), which *does* re-load a previously persisted intent. So resume works **only because the generic AsyncStorage fallback re-reads it** — there is no OAuth-callback-aware re-read; it is incidental, untested for this path, and load-bearing-by-accident.
- Priority ordering: `authCallback.active` (set when `isAuthCallbackPath(pathname)` is true for `/auth/callback`, `parseAuthCallbackUrl.ts:76-80`; captured `App.tsx:140-144`) is the HIGHEST-priority branch (`App.tsx:321-335`), above the `pendingInviteIntent` gate branch (`App.tsx:338`). So on the OAuth return, `AuthCallbackScreen` runs first; the gate only mounts after `onDone` flips the flag and clears the URL via `window.history.replaceState(null,'','/')` (`AuthCallbackScreen.tsx:93-102, 99`). The resume thus depends on the AuthCallbackScreen → `onDone` → re-render sequence, not on an explicit "OAuth consumed → re-read intent → enter gate" wire.
- The callback consumer already supports the OAuth shape: `consumeAuthCallback` handles the PKCE `code` branch via `exchangeCodeForSession` (`consumeAuthCallback.ts:46-48, 162-170`) and returns `success` (NOT `needs_password`, which is reserved for `type=invite` only, `consumeAuthCallback.ts:51-54, 156, 167`). `parseAuthCallbackUrl` recognizes `?code=` (`parseAuthCallbackUrl.ts:173-177`). This precondition is satisfied; OAuth users correctly get no set-password step.

### 3. Precise gap #748 must close

There is **no `signInWithOAuth` anywhere in `src/`** (repo-wide search: zero matches), and the Sign In provider slot is doctrine-safe-inert today: `resolveAuthProviderSlotRegion()` returns empty slots with the Google slot `enabled:false` (`src/features/auth/authProviderSlotModel.ts:138-156, 53-55`), consumed by `AuthScreen` with no args so **no Google button renders** (`AuthScreen.tsx:45`). `CONTINUE_WITH_GOOGLE_LABEL` is a reserved string, not rendered (`authProviderSlotModel.ts:96, 20-26`).

#748's work (per the owner's "LEAVE OPEN" comment on the issue and `AUTH-GOOGLE-SSO-001.md:59-65` §6) is the **client intent-resume-after-Google-callback wiring + a pure resume-decision test + live confirmation** — specifically:
1. Make the OAuth-callback → first-signed-in transition drive a deterministic re-read of the persisted intent into the gate, rather than relying on the incidental generic-fallback re-read in the empty-deps cold-start effect (`App.tsx:191-228` vs the gate at `:338`). The foundation card (`AUTH-FOUNDATION-INVITE-REDIRECT-001.md:41-43`) names this as "the OAuth-callback → first-signed-in → gate wiring."
2. A pure decision test proving: intent resume after OAuth callback → first signed-in → auto-accept fires on email match; plain mismatch/expired/closed otherwise (`AUTH-GOOGLE-SSO-001.md:89-90`; issue #748 Tests).
3. Confirm the server-side email-binding/capacity check still governs Google invitees (Google account email vs invited email → `invite_email_mismatch`, no enumeration).
4. Live confirmation is GATE-C and gated on #745 (hosted Google config); a browser-auth smoke against `dev-cdiscourse.netlify.app` is operator-run, not Claude-run.

GATE-C classification: client-only resume wiring is **NOT** GATE-C; it becomes GATE-C only if it requires an Edge/RLS change (default expectation per the issue: the existing server path suffices, so client-only).

### 4. Invariants confirmed (no bypass / no direct insert / no client service-role)

| Invariant | Evidence |
|---|---|
| **(a) No capacity/seat/invite-binding bypass** — acceptance stays server-side. | `acceptRoomInvite` / `provisionAndAcceptInvite` invoke `manage-room-invite` Edge Function only (`inviteApi.ts:143-166, 212-216, 229-238`); email-match enforced server-side (`InviteRedeemGate.tsx:129-133`). Accepted-debate hand-off selects the room with the side stored on the participant row the Edge Function inserted — no client-side seat write (`App.tsx:609-638`). |
| **(b) No direct client insert to `public.arguments`.** | Invite wrappers "NEVER import a service-role key, NEVER insert into argument_room_invites directly" (`inviteApi.ts:1-15, esp. 5-8` and `224-227`); acceptance is an Edge invoke, not a client write. |
| **(c) No service-role in client.** | `grep ANTHROPIC_API_KEY\|SERVICE_ROLE\|service_role` over `src/features/invites` → zero matches; `inviteApi.ts:224-227`. |
| **(d) Email-binding mismatch is plain copy, no enumeration.** | Mismatch surfaces server `invite_email_mismatch` → `MismatchPanel` (`InviteRedeemGate.tsx:116-117, 329-338`); the client never learns the bound email (`inviteApi.ts:92-100`); the "Sign in as someone else" path keeps the intent across `SIGNED_OUT` (`App.tsx:256-271`). |

### 5. Cross-link + minor doc-accuracy note (for the #748 implementer)

- Hosted redirect-allow-list dependency: the launch host's allow-list MUST include `/auth/callback` or the round-trip silently falls back to Site URL — tracked in `AUTH-FOUNDATION-CONFIG-001` and `AUTH-GOOGLE-SSO-001.md:26-39` §2 (assert resolved origin `dev-cdiscourse.netlify.app`, not the `dev.cdiscourse.com` fallback literal at `buildAuthRedirectUrl.ts:65`, is allow-listed before the Google smoke). Not in scope for this map.
- `AUTH-FOUNDATION-INVITE-REDIRECT-001.md:41` says the OAuth path "must drive a re-read of the persisted intent (`loadPendingInviteIntentFromStorage`) and feed it into the gate." The current cold-start effect (`App.tsx:218`) already calls that helper as a generic fallback, so the helper exists and works — the actual missing piece is making the re-read **fire deterministically on the OAuth-callback → first-signed-in transition** (today it rides the empty-deps cold-start one-shot + the AuthCallbackScreen→onDone re-render, which is incidental and untested for `?code=`). The implementer should treat #748 as wiring + a pure decision test around that transition, not as adding the load helper.


## Hosted config checklist for #745

> **READ-ONLY readiness map.** This section enumerates the EXACT hosted settings #745 (AUTH-GOOGLE-SSO-002) will need to set later. It names settings only — **no values, no secrets, no `signInWithOAuth` code, no config write, no Google Cloud call**. #745 is **GATE-C, operator-run; Claude does NOT execute it** (`docs/designs/AUTH-GOOGLE-SSO-INDEX.md:14`, `:39`; ADR `docs/adr/AUTH-GOOGLE-SSO-ADR-001.md:30`, `:72`; issue #745 "GATE-C classification"). The hosted project (`qsciikhztvzzohssddrq`) is configured via Dashboard / Management API — **NOT `config.toml`**; `config.toml` auth blocks are LOCAL-only (`docs/designs/AUTH-FOUNDATION-CONFIG-001.md:54`; `supabase/config.toml:152-155`, `:159-163`).

### Why this is a map, not a setup

The live auth path today is **email/password only** — `signInWithPassword` (`src/features/auth/authApi.ts:197`) and `signUp` (`src/features/auth/authApi.ts:104`); a repo-wide search for `signInWithOAuth` in `src/` returns zero matches (`docs/designs/AUTH-FOUNDATION-CONFIG-001.md:9`; ADR `:17`). There is **no `[auth.external.google]` block**; the only external block is `[auth.external.apple]` with `enabled = false` (`supabase/config.toml:359-372`; inventory `docs/designs/AUTH-FOUNDATION-CONFIG-001.md:58-60`). The provider name `google` is in the documented list at `supabase/config.toml:356-358`. The Google button is **inert until #745 lands** (ADR `:63`, `:76`).

### The eight hosted setup items #745 will need (settings named only)

| # | Setting to set (named only) | Where it lives | Evidence (file:line) |
|---|---|---|---|
| 1 | **Enable the Supabase Google provider** — turn on the hosted `[auth.external.google]` provider (`enabled`). Dashboard → Authentication → Providers → Google, or Management API `PATCH /v1/projects/{ref}/config/auth`. | Hosted (Dashboard / Management API) — NOT `config.toml` | issue #745 Scope; `AUTH-GOOGLE-SSO-INDEX.md:14`; `config.toml:356-358` (provider list); mirror shape `config.toml:359-372` |
| 2 | **Google OAuth client id + client secret** — the provider's `client_id` and `secret`, **stored as a Supabase secret only, NEVER in repo/client/`config.toml`**. The `config.toml` substitution form (local-dev parity, disabled by default) is `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`, mirroring the Apple `env(...)` form. | Secret store (hosted); local mirror = `env(...)` only | ADR `:31`, `:82`; `AUTH-GOOGLE-SSO-001.md:24`, `:69`; `config.toml:362-363` (Apple `env(...)` precedent); `AUTH-FOUNDATION-CONFIG-001.md:71` |
| 3 | **Google Cloud authorized redirect URI = the Supabase callback** — set the OAuth client's authorized redirect URI to `https://<ref>.supabase.co/auth/v1/callback` (ref `qsciikhztvzzohssddrq`). This is the **same value for every app environment**. Set in the Google Cloud console (operator). | Google Cloud console | `AUTH-GOOGLE-SSO-001.md:28`, `:37`; `AUTH-GOOGLE-SSO-INDEX.md:29`; issue #745 Scope |
| 4 | **Supabase redirect allow-list (`uri_allow_list`) entries** — the app **return URLs** `…/auth/callback` and `…/auth/reset` for each environment must be on the **hosted** allow-list: local `http://localhost:8081/**`; Netlify dev stable `https://dev-cdiscourse.netlify.app/**`; per-deploy preview wildcard `https://*--dev-cdiscourse.netlify.app/**`; prod `<launch-host>/**` when it exists. (Local mirror only: `config.toml:164-170`.) | Hosted (Management API field `uri_allow_list`); local mirror `config.toml:164-170` | `AUTH-GOOGLE-SSO-001.md:30-35`; `AUTH-FOUNDATION-CONFIG-001.md:67`; `config.toml:164-170` |
| 5 | **Site URL (`site_url`)** — the hosted launch host (currently `https://dev-cdiscourse.netlify.app` for dev). A `redirect_to` not on the allow-list is silently dropped to the **Site URL**, so this is the fallback target and must be correct. Set via Dashboard → URL Configuration or Management API field `site_url`. | Hosted (Dashboard / Management API field `site_url`); local mirror `config.toml:156` | `AUTH-FOUNDATION-CONFIG-001.md:15-16`, `:66`; `config.toml:152-156` |
| 6 | **Local dev callback (`localhost:8081`)** — `http://localhost:8081` + `http://localhost:8081/**` on the LOCAL allow-list for `supabase start` Google testing. Local `site_url = "http://localhost:8081"`. (`skip_nonce_check` is the documented local-Google nonce knob; named only, not changed.) | Local `config.toml` only (LOCAL-only block) | `config.toml:156`, `:164-166`, `:369-370`; `AUTH-FOUNDATION-CONFIG-001.md:15`, `:20` |
| 7 | **`dev.cdiscourse.com` vs `dev-cdiscourse.netlify.app` fallback-origin reconciliation** — gap **G1**: the non-dev fallback literal `HOSTED_FALLBACK_ORIGIN = 'https://dev.cdiscourse.com'` (`src/lib/auth/buildAuthRedirectUrl.ts:65`) does NOT equal the deployed host `https://dev-cdiscourse.netlify.app` (`config.toml:167`). NON-blocking at runtime because the deployed SPA resolves `window.location.origin` first (`src/lib/auth/resolveRuntimeOrigin.ts:37-42`); it becomes blocking only if the fallback literal is ever used as a `redirect_to` without being allow-listed (silently dropped to Site URL). **Before the Google operator smoke, assert the resolved runtime origin (`https://dev-cdiscourse.netlify.app`, not the `dev.cdiscourse.com` literal) is on the hosted allow-list.** Reconciliation is tracked, not performed in this card. | Assertion against hosted allow-list (the literal lives in client source, out of scope to edit here) | `buildAuthRedirectUrl.ts:65`, `:96-100`; `resolveRuntimeOrigin.ts:37-42`; `AUTH-FOUNDATION-CONFIG-001.md:77`, `:81-85`; `AUTH-GOOGLE-SSO-001.md:39`; ADR `:64` |
| 8 | **Redacted read-back checks** — after the hosted PATCH, `GET …/config/auth` and confirm the provider is enabled and the allow-list/Site URL are correct; **verify any secret VALUE by SHA-256 digest match, never print it**; and **PATCH only the fields being changed** (sending stale `site_url`/`uri_allow_list` clobbers the Dashboard-correct ones). | Management API GET read-back + digest compare (established precedent) | `docs/runbooks/email-provider-setup.md:73`, `:120-124`; `AUTH-FOUNDATION-CONFIG-001.md:64` |

### Round-trip note (why items 3 + 4 are BOTH required)

The Google Cloud authorized redirect URI (item 3) is the **Supabase** callback `https://<ref>.supabase.co/auth/v1/callback`; the **app return URL** `…/auth/callback` (item 4) must be on the **Supabase** allow-list. Both are required for one complete OAuth round-trip — the Google callback lands at Supabase, then Supabase redirects to the allow-listed app return URL (`AUTH-GOOGLE-SSO-001.md:28`, `:37`; `AUTH-GOOGLE-SSO-INDEX.md:29`). The return lands on the **existing** consumer (`consumeAuthCallback` PKCE branch, `src/features/auth/consumeAuthCallback.ts:162-170`) and resolves to `success` (not `needs_password`, which is invite-email-only, `:51-54`) — no parallel callback, no hosted change needed there (`AUTH-GOOGLE-SSO-001.md:43-48`).

### Config-time decision #745 fixes (consumed downstream)

The **same-email link-vs-distinct identity mode** is decided at config time in #745 and honored in provisioning #747; the binding constraints are **never takeover, never enumerate** (ADR `:41-45`; `AUTH-GOOGLE-SSO-001.md:57`). Until fixed, downstream treats "distinct, no-takeover, no-enumeration" as the safe default (ADR `:45`).

### Excluded from #745 (named only)

- **No UI** ("Continue with Google" button is #746; inert until #745) — issue #745 Non-goals; `AUTH-GOOGLE-SSO-INDEX.md:15-16`.
- **No native deep-link `scheme`** — `app.json` declares none (gap G3); Google ships **web-first**, native is out of lane (`AUTH-FOUNDATION-CONFIG-001.md:79`; `AUTH-GOOGLE-SSO-001.md:73-75`).
- **No Facebook / Apple.** Facebook deferred post-launch #749; Apple not in lane (ADR `:27`, `:52-53`; `AUTH-GOOGLE-SSO-INDEX.md:42-43`; `docs/designs/AUTH-FACEBOOK-SSO-001-DEFERRED.md`).
- **No provisioning write / no migration / no invite-redemption change** here — those are #747 / #748 (`AUTH-GOOGLE-SSO-INDEX.md:16-17`, `:40`).

### Doctrine compliance

Google client secret never in repo/client (Supabase secret only); no service-role in client; Supabase Auth remains identity owner; email/password fallback preserved; OAuth never bypasses seat/invite rules (server-side acceptance, `src/features/invites/inviteApi.ts:212-216`); no enumeration; auth is identity plumbing — no truth/winner/verdict surface touched (ADR `:80-90`; `AUTH-GOOGLE-SSO-001.md:99-107`).

## 8. Implementation map (#745 → #746 → #747 → #748)

| Card | Type | Ready now | Blocked on | Next dependency |
|---|---|---|---|---|
| **#745** AUTH-GOOGLE-SSO-002 — hosted Google OAuth config | **GATE-C (operator)** | Redirect/callback target + allow-list entries already exist + stable (§3/§7); operator runbook fully enumerated (§7) | Hosted operator action (Supabase Management API / Dashboard + Google Cloud console); cannot be done from repo | Operator GATE-C execution against the hosted project (ref `qsciikhztvzzohssddrq`) + redacted read-back |
| **#746** AUTH-GOOGLE-SSO-003 — Continue with Google UI | client UI (not GATE-C) | The slot flip (`resolveAuthProviderSlotRegion`) is zero-re-layout; the callback consumer already handles the return | Inert until #745 (no hosted provider to call) | #745 → `signInWithGoogle` wrapper + live button + relax the `src/`-wide zero-`signInWithOAuth` guard to a single-file allow-list |
| **#747** AUTH-GOOGLE-SSO-004 — OAuth profile provisioning | partly GATE-C | `handle_new_user` is provider-independent → a Google user gets a profile row (id-keyed); the `auth.uid()`-scoped `profiles` self-heal is already RLS-permitted | **GAP:** Google name lands under `full_name`/`name`, trigger reads only `display_name` → NULL display name | A NEW coalescing migration (`coalesce(display_name, full_name, name, email-local)`) — migration-bearing GATE-C; verify on a live Google sign-in first |
| **#748** AUTH-GOOGLE-SSO-005 — invite redemption through Google SSO | likely client-only | Intent persists in a fixed-name store; resume decision + auto-accept + no-enumeration RTL guard exist + are provider-independent | The OAuth-return resume trigger doesn't exist (no `signInWithOAuth` yet) | Implement/confirm the client intent-resume-after-Google-callback wiring + the pure resume test; GATE-C only if an Edge/RLS change is needed |

**Sequence:** #745 (operator, unblocks the rest) → #746 (UI) → #747 (provisioning + display-name migration) → #748 (invite resume). #745 is NOT blocked by the #747/#748 gaps — those are each card's own downstream scope.

## 9. Risks and halt conditions

- NON-BLOCKING (tracked in #744): HOSTED_FALLBACK_ORIGIN literal 'https://dev.cdiscourse.com' (buildAuthRedirectUrl.ts:65) differs from the deployed host 'https://dev-cdiscourse.netlify.app' (config.toml:167). Cosmetic at runtime because resolveRuntimeOrigin prefers window.location.origin on the deployed SPA, but load-bearing if the non-dev fallback path is ever exercised. #745's operator smoke MUST assert the RESOLVED origin (not the fallback literal) is on the hosted allow-list before sign-off.
- DOC CORRECTION (for #747 implementer, not a security risk): AUTH-FOUNDATION-PROVISIONING-001.md:29 frames any client profiles INSERT fallback as 'out of bounds', but the auth.uid()-scoped RLS grant 'profiles: users can insert own' (rls_policies.sql:62-65) already permits a safe scoped self-heal with no service-role/migration/Edge. That sub-piece is therefore likely NOT GATE-C.
- GENUINE GATE-C WORK (#747): the trigger reads only raw_user_meta_data->>'display_name' (initial_schema.sql:45); Google carries name under full_name/name, so a Google user lands with NULL display_name. Fixing requires a NEW coalescing migration (never edit the applied 20260516000001) — migration-bearing, heightened reviewer verification. Not a defect today; a gap to file/build under #747, not a blocker for the #745 hosted-config card.
- TEST GUARD will turn red on #746 (expected, by design): authScreenProviderRegion.test.tsx:143-160 asserts ZERO signInWithOAuth anywhere under src/; the #746 wrapper must relax this to a single-file allow-list. Same-email no-takeover/no-enumeration is fixed by the #745 hosted identity-linking setting and is NOT client-unit-testable — must be confirmed by the operator smoke, not claimed green from jest.
- config.toml is LOCAL-only; hosted allow-list / Site URL / Google provider state cannot be verified from repo source — operator must confirm hosted-side at #745.


**Halt conditions before #745:** none — the audit found no codebase gap that blocks the hosted-config card. **Halt conditions WITHIN later cards:** #747's display-name fix is migration-bearing (GATE-C, heightened reviewer verification, never edit an applied migration); #746 must relax the zero-`signInWithOAuth` source-scan guard to a single-file allow-list (expected, by design); same-email no-takeover / no-enumeration is controlled by the hosted Supabase identity-linking setting and is **operator-smoke-verified, not jest-claimable**.


## Test/smoke matrix

> Lane F maps the test + manual-smoke gates the implementation cards (#746/#747/#748) will need. **This card writes no tests** — it defines what each card must prove and names the existing pattern files to mirror. Doctrine: Supabase Auth owns identity; the deterministic engine is the submission gate; secrets never in repo/client; no service-role in client; no account enumeration; OAuth never bypasses invite/seat/room rules; provisioning is idempotent; Google must never be claimed *live* when not implemented; Facebook is out of this lane.

### F.0 — Readiness verdict

The seam is **READY_WITH_NOTES**. Every gate below has a concrete, already-on-`main` pattern to mirror, and the foundation surface is purpose-built for these cards:

- `src/features/auth/authProviderSlotModel.ts` is pure-TS and already carries the disabled Google slot + ORDER so #746 "lights it with zero re-layout" (`__tests__/authProviderSlotModel.test.ts:65-91`).
- `signInWithGoogle` does **not** exist anywhere in `src/` today (repo grep returns only a comment at `src/features/auth/authProviderSlotModel.ts:33`) — so the #746 wrapper is genuinely new code, not a no-op, and the wrapper-shape test is the only way to assert it.
- `consumeAuthCallback` already returns `{ status: 'success' }` (not `needs_password`) for a non-invite `code`/`tokens` flow (`src/features/auth/consumeAuthCallback.ts:156`, `:167`; `isInvite` at `:52-54`) — the OAuth resume gate for #748 tests an *existing* contract, no consumer change required.
- The `handle_new_user` trigger reads **only** `display_name` (`supabase/migrations/20260516000001_initial_schema.sql:45`), and **no** Google-coalescing migration exists yet — so #747's migration is real, migration-bearing work.

Notes (carried into the per-card gates): the cards must assert the doctrine *negatives* (no `signInWithOAuth` outside the wrapper, no service-role/secret in client, no `@`/email leak in error trees), not just the happy path. The reference repo `.tmp/slate002-ref/` is intent-only and must not be lifted into copy or tests.

### F.1 — #746: "Continue with Google" UI + `signInWithGoogle` wrapper

NOT GATE-C (client UI + wrapper; no migration/Edge/hosted change). Inert until #745. All provider behavior is asserted **via a Supabase mock — never a live call** (design `docs/designs/AUTH-GOOGLE-SSO-001.md:80`).

| # | Gate (assertion) | Type | Mirror pattern (file:line) |
|---|---|---|---|
| 746-T1 | `signInWithGoogle` calls `supabase.auth.signInWithOAuth` exactly once with `provider: 'google'` and `options.redirectTo` derived from `buildAuthRedirectUrl` (explicit `route: '/auth/callback'`, design `AUTH-GOOGLE-SSO-001.md:22`) | wrapper unit (mock) | `__tests__/authApiRedirect.test.ts:66-106` (asserts `signUp`/`resetPasswordForEmail` arg shape via mock) |
| 746-T2 | Returns the config-missing `AuthResult` and makes **no** provider call when `SUPABASE_CONFIGURED` is false; never throws | wrapper unit | `__tests__/authApiRedirect.test.ts:156-164` (config_missing branch + "not called"); shape parallels `authApi.ts:189-195` |
| 746-T3 | Redirect-unavailable degrades like email flows: a bad origin yields `redirectTo` omitted (Supabase falls back to Site URL), `result.ok` still progresses; provider/redirect error maps through `mapAuthError`/`REDIRECT_INVALID_MESSAGE` (`authApi.ts:13-14`, `:43-62`, `:73-83`) | wrapper unit | `__tests__/authApiRedirect.test.ts:82-94`, `:144-154` (invalid-origin omit + redirect_invalid mapping) |
| 746-T4 | Default Sign In surface renders the live button **only when a Google slot is enabled**; the default (config-absent) surface renders the "coming soon" notice, **no** clickable "Continue with Google" | component (RTL) | `__tests__/authScreenProviderRegion.test.tsx:61-95` (notice not button; no Google affordance) |
| 746-T5 | Email/password fallback still submits → `signInWithPassword` once; the email path never touches `signInWithOAuth` | component (RTL) | `__tests__/authScreenProviderRegion.test.tsx:104-122` |
| 746-T6 | **No** Facebook and **no** Apple affordance rendered | component (RTL) | `__tests__/authScreenProviderRegion.test.tsx:81-85` |
| 746-T7 | Copy safety: button label + any unavailable copy carry no verdict tokens, no snake_case, no lifted reference slogans; "Continue with Google" is the only conventional string | model/ban-list | `__tests__/authProviderSlotModel.test.ts:93-145` |
| 746-T8 | Accessibility: the button meets tap-target + screen-reader-label requirements (label = "Continue with Google") | component (a11y) | `accessibility-targets` skill; query-by-label pattern `authScreenProviderRegion.test.tsx:75-79` |
| 746-S1 (guard) | `signInWithOAuth` appears in **exactly one** wrapper site under `src/` and **not** in `AuthScreen.tsx` source (the slot model purity guard must relax to allow the new wrapper, not the screen) | source-scan | `__tests__/authScreenProviderRegion.test.tsx:124-160`; `authProviderSlotModel.test.ts:148-165` |

Note: 746-S1 is load-bearing — the current guard at `authScreenProviderRegion.test.tsx:143-160` asserts **zero** `signInWithOAuth` anywhere under `src/`. #746 must convert that to an allow-list of the single wrapper file (the `noLocalhostInProdAuthPaths.test.ts:18-25` allow-list idiom is the template), or the guard will red the moment the wrapper lands.

### F.2 — #747: OAuth profile provisioning (idempotent; no client service-role; same-email)

GATE-C **if** a new migration/server write is required (the likely display_name-coalescing migration) → migration-bearing → heightened reviewer verification (`npx supabase db reset --linked=false` when Docker is available, else heightened textual review per the roadmap-reviewer template / OPS-001). If verification shows the existing trigger suffices, the card downgrades to a docs confirmation and only the verification tests below remain.

| # | Gate (assertion) | Type | Mirror pattern (file:line) |
|---|---|---|---|
| 747-T1 | If a coalescing migration lands: it `CREATE OR REPLACE`s `handle_new_user` to `COALESCE(display_name, full_name, name)` from `raw_user_meta_data`, preserves `SECURITY DEFINER` + `SET search_path = public` + `ON CONFLICT (id) DO NOTHING` | migration shape-scan | `__tests__/qol039Migration.test.ts:62-96` (SECURITY DEFINER + search_path scan); trigger shape `initial_schema.sql:37-53` |
| 747-T2 | Idempotency: the `ON CONFLICT (id) DO NOTHING` guard is preserved (the idempotency spine, ADR `AUTH-GOOGLE-SSO-ADR-001.md:34`); a repeated insert yields exactly one row | migration shape-scan + operator reset | `qol039Migration.test.ts:148-150` (idempotent CREATE); behavioral half is operator `db reset` |
| 747-T3 | Resulting profile-row shape asserted: display_name populated for a Google user **or** its absence explicitly accepted with rationale (design `AUTH-GOOGLE-SSO-001.md:86-87`) | migration shape-scan / docs | `qol039Migration.test.ts:153-167` (column-presence assertions) |
| 747-T4 | Append-only discipline: the migration is a **new** file with a timestamp later than every pre-existing migration; it never edits `20260516000001_initial_schema.sql` | source-scan | `__tests__/qol039Migration.test.ts:280-308` |
| 747-T5 | OPS-001 four-class compliance (ambiguous-column, type, statement-order, extension deps) if the migration touches policies/functions | migration shape-scan | `__tests__/qol039Migration.test.ts:248-278` |
| 747-T6 | Same-email: behavior matches the ADR (link vs distinct, fixed at config in #745); **never takeover, never enumerate**; until #745 fixes the mode the safe default is "distinct, no-takeover, no-enumeration" (ADR `AUTH-GOOGLE-SSO-ADR-001.md:39-45`) | docs assertion + operator smoke | ADR §Same-email; no client unit can prove the hosted mode — operator smoke step F.4-4 |
| 747-S1 | No client service-role / no direct `profiles` insert in any provisioning client path; every privileged write is an Edge Function | source-scan | `__tests__/demoCorridorNoProvider.test.ts:31-66` (`SERVICE_ROLE`/`service_role` forbidden-token scan) |

Note: the same-email *runtime* outcome (747-T6) is **not unit-testable from the client** — it is fixed by the hosted identity-linking setting (#745) and can only be confirmed by the operator smoke (F.4-4). The unit/shape layer can only assert the ADR's binding constraints (no enumeration in copy, no takeover code path). Flag this as the one gate that depends on a console state outside the repo.

### F.3 — #748: invite/room redemption through Google SSO

GATE-C **only if** an Edge/RLS change is required for the OAuth redemption path; default is client-only intent-resume wiring (NOT GATE-C). Default to verifying the existing server path suffices (`acceptRoomInvite` → `manage-room-invite` Edge Function, `src/features/invites/inviteApi.ts:212-216`).

| # | Gate (assertion) | Type | Mirror pattern (file:line) |
|---|---|---|---|
| 748-T1 | Pure decision: intent persists across the OAuth round-trip (24h freshness, dedicated key `cdiscourse:pending-invite-intent`) and is re-read after the Google callback consume → first signed-in | pure-model unit | `__tests__/pendingInviteIntent.test.ts:106-175` (load-fresh + AsyncStorage round-trip/stale-drop) |
| 748-T2 | Resume → auto-accept fires on (signed-in + live pending + server email-match); fires `acceptRoomInvite({ token })` and calls `onAccepted` | component (RTL) | `__tests__/InviteRedeemGate.newuser.test.tsx:117-182` (signedIn flip → accept → onAccepted); gate logic `InviteRedeemGate.tsx:124-134` |
| 748-T3 | OAuth callback yields `{ status: 'success' }`, **not** `needs_password` (needs_password is invite-email-only, `consumeAuthCallback.ts:51-54`); the synthetic-URL parse→consume chain proves resume readiness | unit (mock client) | `__tests__/consumeAuthCallback.test.ts:56-74` + `__tests__/authCallbackSmokeReadiness.test.ts:31-67` |
| 748-T4 | Server-side email-binding still governs the Google invitee: a mismatch surfaces `invite_email_mismatch` as **plain** copy, no enumeration | component + copy ban-list | `InviteRedeemGate.tsx:128-134` (server-side check); copy `__tests__/inviteCopyDoctrine.test.ts:104-185` |
| 748-T5 | No-enumeration: the signed-out gate render is **byte-identical** regardless of whether the invitee already has an account, and the tree never contains the invited address (`@`) | component (RTL) | `__tests__/InviteRedeemGate.newuser.test.tsx:184-227` |
| 748-T6 | Capacity/seat/invite-binding enforced server-side; the client **never** inserts to `public.arguments` and **never** holds service-role; token never logged | source-scan + wrapper unit | `inviteApi.ts:212-238` (invoke-only, no insert); forbidden-token scan idiom `demoCorridorNoProvider.test.ts:31-66` |
| 748-T7 | If an Edge/RLS change is needed: follow `supabase-edge-contract` + heightened review (happy + auth-refused + invalid-input) | Edge integration | `supabase-edge-contract` skill; manage-room-invite tests `__tests__/manageRoomInviteSafety.test.ts` |

Note: prefer 748 to land as a **pure resume-decision test** (748-T1) plus the existing RTL gate flow (748-T2/T5) with the Edge wrappers mocked — `InviteRedeemGate.newuser.test.tsx` already mocks `inviteApi` + `authApi`, so the OAuth resume variant is a small extension, not a new harness. Reuse the `inviteCopy` plain-language bundle; author no new copy (per the card's no-slogan note).

### F.4 — Operator manual smoke (GATE-C; runnable AFTER #745 is armed; NOT run by Claude)

From `docs/designs/AUTH-GOOGLE-SSO-001.md:92-97`, against `https://dev-cdiscourse.netlify.app`:

0. **Precondition (assert first):** the *resolved runtime origin* is `https://dev-cdiscourse.netlify.app` (from `window.location.origin`, `resolveRuntimeOrigin.ts:37-43`) and is on the hosted Supabase redirect allow-list — **not** the `HOSTED_FALLBACK_ORIGIN = https://dev.cdiscourse.com` literal (`buildAuthRedirectUrl.ts:65`), which is *not* the deployed host (`config.toml:167`). An unreconciled origin is silently dropped to the Site URL and breaks the round-trip (design §2, `AUTH-GOOGLE-SSO-001.md:39`; cross-ref #739).
1. Logged-out → tap "Continue with Google" → Google consent → return to `/auth/callback` → a `success` session is established (**not** `needs_password`).
2. Verify exactly **one** `public.profiles` row; verify display_name behavior matches #747 (populated, or absence accepted).
3. **Same-email:** confirm the hosted link-vs-distinct mode matches the #745 runbook; confirm **no takeover** of an existing email/password account and **no enumeration** in any state (#747-T6).
4. **Invite path:** open an invite link → sign in with Google → confirm auto-accept on email-match, and the plain mismatch/expired/closed state otherwise.
5. Confirm email/password sign-in still works (fallback preserved).

The smoke is operator-gated because the Google provider, secret, and allow-list are GATE-C (#745) and "Claude must NOT run it" (#745 body; ADR `AUTH-GOOGLE-SSO-ADR-001.md:30`).

### F.5 — Cross-cutting doctrine gates (apply to all three cards)

- **No live provider call in unit tests** — every `signInWithOAuth`/Edge interaction is mocked (design `AUTH-GOOGLE-SSO-001.md:80`; pattern `authScreenProviderRegion.test.tsx:27` keeps `mockSignInWithOAuth` at 0 calls on the default surface).
- **No secret / no service-role in client** — `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE\|service_role" src/ app/` stays clean; mirror the forbidden-token scan in `demoCorridorNoProvider.test.ts:31-66`.
- **No enumeration in any error** — copy ban-list (`inviteCopyDoctrine.test.ts`) + byte-identical render (`InviteRedeemGate.newuser.test.tsx:184-227`).
- **Plain language only** — no internal codes/snake_case in any user-facing string (`authProviderSlotModel.test.ts:133-138`, `inviteCopyDoctrine.test.ts:166-177`).
- **No copied reference slogans** — `.tmp/slate002-ref/` is intent-only; "Continue with Google" is the sole conventional string.
- **Test count goes up** — current baseline is **1805 tests / 70 suites** (CLAUDE.md Stage 6.4); each card must raise it and capture the `Tests: Y passed` line with an explicit exit 0 (`test-discipline` skill).

## 11. Security / doctrine attestation

DOCTRINE/SECURITY ATTESTATION — Lane G (verified against primary checkout C:/Users/kyler/cdiscourse/debate-constitution-app at HEAD 99ac928 = main). All six lane sub-findings independently re-verified by direct file inspection; no fabricated cites.

IDENTITY OWNERSHIP & SUBMISSION GATE: Doctrine holds. Single Supabase createClient using the publishable/anon key only (src/lib/supabase.ts:58-71); detectSessionInUrl:false with manual consume (supabase.ts:77); session lifecycle owned by one AppSessionProvider listener; deterministic engine remains the submission gate (unchanged this lane).

SECRETS / NO SERVICE-ROLE IN CLIENT: CLEAN. grep over src/ and the navigation guard / dev-fixture validator are the ONLY occurrences of SERVICE_ROLE/service_role and they are denylist/forbidden-token entries (appPrimaryNavModel.ts:233-234, argumentScenarioValidation.ts:24) plus two doc-comments asserting ANTHROPIC_API_KEY is server-only (edgeFunctions.ts:9,397). No createClient with a service key, no secret literals. Provider secrets follow the env() pattern: config.toml has only [auth.external.apple] enabled=false with secret=env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET); no committed Google secret, no [auth.external.google] block. Invite acceptance is Edge-invoke-only (inviteApi.ts), never a direct insert.

PROVISIONING IDEMPOTENCY & NO TAKEOVER/ENUMERATION: SOUND. handle_new_user() is SECURITY DEFINER + SET search_path=public + INSERT ... ON CONFLICT (id) DO NOTHING (initial_schema.sql:37-49); trigger fires AFTER INSERT ON auth.users provider-independently (:51-53); profiles.id PK = one row per user; conflict target is the auth.users uuid, not email, so no email-based takeover. Same-email link-vs-distinct is a #745 config-time decision (safe default distinct/no-takeover/no-enumerate per ADR). The auth.uid()-scoped self-insert RLS grant already exists (rls_policies.sql:62-65), so a missing-profile self-heal can be a scoped client upsert without service-role/RPC/Edge. No client profiles insert/upsert exists today (no premature self-heal).

INVITE/SEAT/ROOM BYPASS: NO BYPASS. OAuth code branch returns success (not needs_password); needs_password is reserved exclusively for type=invite; intent persists provider-independently with a 24h window and is gated server-side on email-match in InviteRedeemGate. No signInWithOAuth exists in src/, so no OAuth path can currently bypass invite/seat rules.

FAKE-LIVE-GOOGLE COPY: NONE. resolveAuthProviderSlotRegion default returns no visible provider; PROVIDER_UNAVAILABLE_COPY is future-framed ('Social sign-in is coming soon...'); CONTINUE_WITH_GOOGLE_LABEL is a reserved, NON-rendered constant; tests pin zero signInWithOAuth tree-wide and zero provider button on default render. Google is never claimed live.

FACEBOOK CREEP: NONE. Facebook appears only as a reserved AuthProviderSlotId in the canonical order array, explicitly deferred and never rendered (authProviderSlotModel.ts:39,41,120). No Facebook config, copy, or call site.

The codebase seams genuinely support a later Google SSO GATE-C build: a real /auth/callback PKCE consumer (exchangeCodeForSession) already exists and is reusable, the provider slot lights with zero re-layout, and provisioning is provider-independent. The remaining live behavior is correctly INERT and gated on operator hosted config (#745).

- **Enumeration:** NONE OBSERVED. Provisioning conflict target is profiles.id (the auth.users uuid), not email, so no same-email probe surface (initial_schema.sql:44-46). ON CONFLICT DO NOTHING never reveals prior-row existence to the caller. fetchOwnProfile maps PGRST116 to 'not_found' without leaking other users. InviteRedeemGate enforces email-match server-side with a byte-identical no-enumeration render pattern (test-pinned). Same-email link-vs-distinct mode is a #745 config-time decision with the safe default recorded as distinct/no-takeover/no-enumerate (ADR). One residual: the hosted identity-linking setting governs live same-email behavior and is NOT client-testable — the #745 operator smoke must confirm no-enumeration/no-takeover live before sign-off.
- **Service-role in client:** NONE. No service-role key in client: zero createClient-with-service-key; the only SERVICE_ROLE/service_role string matches in src/ are denylist/forbidden-token entries (appPrimaryNavModel.ts:233-234, argumentScenarioValidation.ts:24) and two doc-comments stating ANTHROPIC_API_KEY/service-role are server-only (edgeFunctions.ts:9,397). Client uses publishable/anon key only (supabase.ts:59-71). Invite acceptance and any privileged provisioning go through Edge-function invoke only (inviteApi.ts), never a direct privileged insert. The one client .upsert in src/ is debate_user_state (RLS-scoped), unrelated to identity. No app/ dir exists to leak through.
- **Provider secret:** NONE. No OAuth provider secret in repo or client. config.toml uses the env() substitution pattern (apple secret = env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)); no committed Google client_id/secret and no [auth.external.google] block at all — Google config is hosted-only and operator-owned (#745). Established Management-API precedent (email-provider-setup.md) handles secrets via PATCH-only-changed-fields + SHA-256 digest read-back that never prints the value. Risk surfaces only if #745 is run carelessly; that is operator GATE-C scope, never self-approved, and outside the codebase.
- **Fake-live-Google copy:** NONE. Default auth surface renders no provider button and shows future-framed 'Social sign-in is coming soon' copy (authProviderSlotModel.ts:110-111,138-156); CONTINUE_WITH_GOOGLE_LABEL is a reserved constant that is NOT rendered while the slot is disabled; no signInWithOAuth call site exists in src/ (grep clean). Tests pin zero OAuth calls and zero provider button on default render. Google is never claimed live, and the live button stays inert until #745 hosted config lands. Facebook is reserved-slot-only and deferred — no Facebook creep.


## 12. Recommended next command

**#745 AUTH-GOOGLE-SSO-002 — hosted Google OAuth config (GATE-C, operator-token-required).** All readiness seams pass; #745 is the operator-gated entry point that unblocks #746/#747/#748. Per §7 the operator: enables the Google provider in hosted Supabase Auth, registers the Google Cloud OAuth client (id + secret as a Supabase secret, never repo/client), sets the Google Cloud authorized redirect URI to `https://<ref>.supabase.co/auth/v1/callback`, confirms the Supabase redirect allow-list + Site URL cover the deployed host, and runs the redacted read-back. The #745 operator smoke MUST assert the RESOLVED runtime origin (not the `dev.cdiscourse.com` fallback literal) is on the hosted allow-list before sign-off.

After #745: #746 (Continue with Google UI) → #747 (provisioning + display-name coalescing migration) → #748 (invite resume through Google).

## Boundary attestation
No runtime mutation, no provider call, no queue arm, no Supabase config write, no deployment, no netlify-prod publish, no H/I/J flip, no Family K production change, no service-role/client leakage, no package install, no app.json change, no schema/RLS/Auth-config change, no room/invite/seat/chime-in/mediator/submission semantics changed. Read-only audit + this doc + issue comments only.
