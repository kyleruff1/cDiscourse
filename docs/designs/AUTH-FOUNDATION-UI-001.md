# AUTH-FOUNDATION-UI-001 — Provider-ready Sign In UI structure (email-only default)

> **Issue:** #740 · **GATE-C:** No (UI-only; no provider call, no hosted config, no migration, no deploy) · **Lane:** AUTH-FOUNDATION (`docs/designs/AUTH-FOUNDATION-INDEX.md` §2) · **Disposition:** CLOSE_AFTER_IMPL
>
> Design + implementation map for restructuring the Sign In screen into a provider-region → divider → email/password layout, with a **FUTURE-reserved, disabled Google slot** and **no visible/clickable provider button this batch**. The default first-run surface is **email-only**: the provider region renders a future-framed "coming soon" notice (a `Text`, not a Pressable) + an "or continue with email" divider, then the unchanged email/password form. Email/password stays the always-working canonical path. No Facebook, no Apple. The real Google call (a wired, visible button) ships in #746 (AUTH-GOOGLE-SSO-003).
>
> **#740 / #760 reconciliation (binding):** #740 and #760 (UX-ONBOARDING-SSO-FIRST-001) target the same screen. They are merged into ONE coherent change with a **single canonical model** (`src/features/auth/authProviderSlotModel.ts`) and an **email-only default**. Per `cdiscourse-doctrine` §10 (email+password only in v1) and the no-faked-capability rule, this batch does **not** render an inert visible "Continue with Google" button — a visible provider button would imply an unimplemented capability while Google config is not live. The conventional `CONTINUE_WITH_GOOGLE_LABEL` is kept as a future-reserved constant for #746 but is **not rendered** while the slot is disabled.

## 1. Current state (file:line)

- `src/features/auth/AuthScreen.tsx` is a single email/password (+ optional display-name in signup mode) form. The brand lockup hero sits above the email field; the submit + sign-in/sign-up toggle Buttons sit below. There was **no** provider region and **no** divider before this card.
- Hero lockup sizing is owned by the pure model `src/features/auth/signInLockupModel.ts` (reused; not duplicated).
- Canonical brand copy: `src/lib/brandCopy.ts` — `PRIMARY_TAGLINE`, `PRINCIPLE_MARK_THE_POINT`, composed `AUTH_FIRST_RUN_COPY`.
- Email/password auth: `signInWithEmailPassword` (`src/features/auth/authApi.ts`), `signUpWithEmailPassword`; plain-language error mapping. **`signInWithOAuth` appears nowhere in `src/`** (confirmed by grep) — the disabled slot therefore cannot reach a provider even by accident.
- Shared `Button` (`src/components/Button.tsx`) already supplies `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState={{ disabled }}`, and `minHeight: 48` (≥44 tap target). It is reused by the email/password submit + toggle; no provider button is rendered this batch.

## 2. What this card builds

1. A **provider region** above the email form, owned by a pure model. In v1 it is **empty of provider buttons** and renders only the future-framed unavailable notice.
2. A **future-reserved, disabled Google slot** in the model (`enabled: false`). **No visible/clickable provider button renders this batch.** While disabled, the screen can issue **no** network/provider call.
3. An **"or continue with email" divider** between the region and the email form.
4. A **provider-unavailable** plain-language line under the region ("Social sign-in is coming soon. Use your email and password below to continue.") so the email path is always the obvious route while social is unavailable. The notice is a `Text`, never a Pressable — it is informational, not an affordance.
5. A **single canonical pure model** (`src/features/auth/authProviderSlotModel.ts`) that owns which slots render, in what order, whether each is enabled, the divider label, and the unavailable copy — keeping the screen thin and the decision unit-testable. #746 consumes this model.
6. The existing **email/password path unchanged** (validation, submit, toggle, emailSent branch all byte-identical).

Explicitly **not** built: no `signInWithOAuth`, no provider SDK, no redirect initiation, **no visible/enabled Google button**, no Facebook button, no Apple button, no hosted config, no change to email/password validation or the callback flow.

## 3. The pure model — `authProviderSlotModel.ts`

A new pure-TS module (no React / Supabase / network imports). It is the **single canonical** provider-slot contract (#760 spec'd this name so #746 extends this file rather than forking a parallel model). It exports:

- `type AuthProviderSlotId = 'google' | 'apple' | 'facebook'` — RESERVED ids only. None render in v1. Google is the future primary; Apple/Facebook are deferred.
- `interface AuthProviderSlot { id; order; labelKey?; enabled }`.
- `interface AuthProviderSlotRegionModel { slots; anyProviderEnabled; hasVisibleProvider; slotOrder; providerUnavailableCopy; dividerLabel }`.
- `CONTINUE_WITH_GOOGLE_LABEL = 'Continue with Google'` — a conventional provider-affordance string, **future-reserved for #746 and NOT rendered while disabled** (not a lifted slogan; intentionally NOT in `brandCopy`, which holds CivilDiscourse brand phrases).
- `PROVIDER_EMAIL_DIVIDER_LABEL = 'or continue with email'` — original wording (NOT the reference's "or with email").
- `PROVIDER_UNAVAILABLE_COPY = 'Social sign-in is coming soon. Use your email and password below to continue.'` — plain language, future-framed, no codes, no verdict tokens, no slogans; never claims Google is live.
- `FIRST_RUN_PROVIDER_SLOT_ORDER = ['google', 'apple', 'facebook']` — the canonical order a future card MUST honor.
- `resolveAuthProviderSlotRegion(opts?)` — with no args (the v1 default) returns empty `slots`, `anyProviderEnabled: false` / `hasVisibleProvider: false`, the future-framed `providerUnavailableCopy`, and the divider label. When #746 passes `enabledSlots`, it returns those slots sorted + intersected against the canonical order, with `anyProviderEnabled` / `hasVisibleProvider = slots.length > 0` and an empty unavailable copy.

**Inertness lives in the model**: the Google slot is `enabled: false`, so no slot is rendered as a button and `anyProviderEnabled` is false. There is no provider press handler in the render path; `signInWithOAuth` is absent from `src/`.

## 4. Screen wiring (thin)

`AuthScreen` computes `const providerRegion = resolveAuthProviderSlotRegion();` once. Above the unchanged email `TextInputField` it renders a `testID="auth-provider-slot-region"` View: when `hasVisibleProvider` is false (the v1 default) it renders the provider-unavailable `Text` (`testID="auth-provider-unavailable"`, `accessibilityLiveRegion="polite"`); the future branch (`hasVisibleProvider` true, #746) mounts a `testID="auth-provider-region"` wrapper for the real wired button. Below the region it renders the divider (`testID="auth-provider-divider"` — decorative rules marked `importantForAccessibility="no"`; the label is plain `Text`, never a Pressable). Styling uses only existing tokens (`BRAND.text.muted`, `BRAND.accent.goldBorder`).

## 5. Accessibility (accessibility-targets skill)

- No provider button renders this batch, so there is no inert button to mis-announce. The email/password submit + toggle Buttons inherit the shared `Button` a11y (role button, label, disabled state, ≥44 tap target).
- The divider is **not** announced as interactive: rules carry `importantForAccessibility="no"`; the label is `Text` (role text), not a Pressable.
- The provider-unavailable line uses `accessibilityLiveRegion="polite"` so its plain guidance is announced without being chatty.

## 6. Tests

- **Pure-model** (`__tests__/authProviderSlotModel.test.ts`): default region is empty (`slots.length === 0`, `anyProviderEnabled === false`, `hasVisibleProvider === false`); the future-reserved Google slot id is in the canonical order; `FIRST_RUN_PROVIDER_SLOT_ORDER === ['google','apple','facebook']`; passing `enabledSlots` lights a slot with zero re-layout (consumability proof for #746); non-empty future-framed provider-unavailable copy while no provider is enabled; divider label; copy-safety scan (no verdict tokens, no internal codes, no lifted reference slogans incl. "mediator, not a judge", "create your account", "or with email"); `CONTINUE_WITH_GOOGLE_LABEL` exists as a future-reserved constant.
- **Default-surface + import-purity guards** (source-scan): `AuthScreen.tsx` contains the `auth-provider-slot-region` testID; contains **no** `signInWithOAuth` / `signInWithIdToken` / `oauth` / `OAuth`; contains **no** rendered `Continue with Google` / `Continue with Facebook` / `Continue with Apple` literal (no visible/enabled provider button); imports no provider/OAuth symbol; `authProviderSlotModel.ts` imports no React/Supabase/network and contains no `signInWithOAuth`. A doctrine token scan over both sources finds no verdict tokens.
- **Source-scan (no `signInWithOAuth` anywhere in `src/`)**: a tree scan asserts the provider method name appears nowhere under `src/`.

## 7. Forward-compatibility with #746 (AUTH-GOOGLE-SSO-003)

#746 drops the real Google call into this exact model with **no JSX restructuring**: (1) pass `enabledSlots: [{ id: 'google', order: 0, enabled: true }]` (gated on config) into `resolveAuthProviderSlotRegion`, which flips `hasVisibleProvider` to true and mounts the `auth-provider-region` wrapper; (2) render the real, wired provider button (using `CONTINUE_WITH_GOOGLE_LABEL`) inside that wrapper, calling the new `signInWithGoogle` wrapper (`supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`). The region + divider + email path do not reflow.

## 8. Doctrine self-check

- No provider call from the client; **no visible/enabled provider button this batch**; the slot is disabled by model flag, and `signInWithOAuth` is absent from `src/` entirely. ✓
- Email/password path preserved exactly. ✓
- Plain language only; no internal codes, no verdict / truth / winner / loser framing on the auth surface; the unavailable copy is future-framed and never claims Google is live. ✓
- No Facebook, no Apple. ✓
- No hosted config, no secret, no migration, no Edge Function, no deploy, no app.json change. ✓
- No reference slogans lifted; `CONTINUE_WITH_GOOGLE_LABEL` is a conventional affordance string reserved for #746, not rendered this batch; divider + unavailable copy are original repo-native wording. ✓
- Layout/order/enabled decisions live in one pure, unit-tested model. ✓
