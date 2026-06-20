# UX-ONBOARDING-SSO-FIRST-001 — First-run provider-ready auth slot (email-only default)

> Issue #760 (epic: civildiscourse-v4). Design + thin UI/model + test. **No provider wiring, no OAuth, no redirect/callback, no Supabase Auth config, no secret, no migration, no deploy.** The default first-run surface is **email-only** — no visible/clickable provider button this batch.

## What this card delivers

The signed-out first-run surface is `src/features/auth/AuthScreen.tsx` (rendered as the session gate; #676 folded UX-FIRST-RUN-001 into this same screen). This card gives that screen a **documented provider-slot contract** so a future SSO lane (#746) can add a real provider button **with no first-run re-layout**, while keeping the default surface email-only and doctrine-clean (no faked, unimplemented capability).

Three pieces:
1. A single canonical pure-TS slot-contract model: `src/features/auth/authProviderSlotModel.ts`.
2. A provider-slot region in `AuthScreen.tsx` (`testID="auth-provider-slot-region"`) that, by default, renders a future-framed "coming soon" notice (a `Text`, NOT a Pressable/Button) + an "or continue with email" divider above the unchanged email/password form. **No visible/enabled provider button renders.**
3. Tests asserting the default surface shows **no** enabled provider button, the slot region exists in the layout, and the email/password path is unbroken.

## The #740 / #760 reconciliation (binding)

`AUTH-FOUNDATION-UI-001` (#740) and `AUTH-GOOGLE-SSO-003` (#746) target the **same screen**. #740 and #760 are merged into ONE coherent change in this batch with a **single canonical model** and an **email-only default**. There was no `authProviderUiModel`/`signInProviderLayoutModel` in `src/` to reuse, so this card **creates** the canonical contract — named `authProviderSlotModel` — rather than extending a non-existent one. #746 **extends this file** rather than forking.

| Card | Default first-run surface |
|---|---|
| **#760 / #740 (this batch)** | **Email-only.** No visible/enabled provider button. Future-reserved Google slot disabled. A future-framed "coming soon" notice + an "or continue with email" divider sit above the unchanged email/password form. |
| **#746** | The live, wired Google button dropped into the slot (GATE-C, operator-run config). |

Doctrine (`cdiscourse-doctrine` §10: email+password only in v1) resolves the conflict in favor of the stricter default: **do not render an inert visible provider button by default** — a visible button implies an unimplemented capability while Google config is not live. The clean layering is:

- **#760 / #740 own** the slot vocabulary, slot ORDER, the default-empty (no enabled button) policy, the divider label, and the future-framed unavailable copy.
- **#746 consumes** the same model by passing `enabledSlots` into `resolveAuthProviderSlotRegion(...)`, which flips `anyProviderEnabled` / `hasVisibleProvider` to `true` and mounts the real wired provider button inside the SAME region — **without any first-run re-layout**.

To avoid double-implementing, the model is named `authProviderSlotModel` (not the `signInProviderLayoutModel`/`authProviderUiModel` placeholder names floated earlier) so the later card **extends this file**.

## The slot contract

`src/features/auth/authProviderSlotModel.ts` (pure TypeScript — no React, no Supabase, no network):

- `AuthProviderSlotId = 'google' | 'apple' | 'facebook'` — RESERVED ids only. None render as enabled buttons in v1. Google is the future primary; Apple/Facebook are deferred.
- `FIRST_RUN_PROVIDER_SLOT_ORDER = ['google', 'apple', 'facebook']` — the **canonical order** a future card MUST honor.
- `AuthProviderSlot { id; order; labelKey?; enabled }` — the per-slot shape. The user-facing label is authored / rendered by the **future** card (the conventional "Continue with Google" affordance string, kept as the future-reserved `CONTINUE_WITH_GOOGLE_LABEL` constant), not rendered here.
- `AuthProviderSlotRegionModel { slots; anyProviderEnabled; hasVisibleProvider; slotOrder; providerUnavailableCopy; dividerLabel }`.
- `resolveAuthProviderSlotRegion(opts?)`:
  - **Default (no args, v1):** empty `slots`, `anyProviderEnabled: false` / `hasVisibleProvider: false`, the future-framed `providerUnavailableCopy`, the divider label, and `slotOrder: FIRST_RUN_PROVIDER_SLOT_ORDER`.
  - **Future (with `enabledSlots`):** returns those slots sorted by `order` and intersected with the canonical order; `anyProviderEnabled` / `hasVisibleProvider = slots.length > 0`; empty `providerUnavailableCopy`.

### How a future card consumes it (no re-layout)

The future SSO lane changes only the **input** to `resolveAuthProviderSlotRegion` and renders inside the already-present region:

```
// later, in the SSO lane — illustrative only, NOT shipped by #760/#740
const providerRegion = resolveAuthProviderSlotRegion({
  enabledSlots: [{ id: 'google', order: 0, enabled: true }],
});
// hasVisibleProvider === true → AuthScreen mounts the real wired Google
// button inside the existing region; the 'or continue with email' divider
// stays above the unchanged email/password form.
```

Because the region (`testID="auth-provider-slot-region"`) already sits between the value-prop block and the email field in the default layout, lighting a slot does not reflow the email path or the footer.

## AuthScreen integration (default = email-only, no enabled button)

Between the value-prop block and the Email field, `AuthScreen` renders:

- when `providerRegion.hasVisibleProvider` is `false` (the v1 default) → a future-framed "coming soon" notice (a `Text`, `testID="auth-provider-unavailable"`, `accessibilityLiveRegion="polite"`) — **no Button, no Pressable, no provider affordance** — followed by the "or continue with email" divider (`testID="auth-provider-divider"`; decorative rules `importantForAccessibility="no"`; label is plain `Text`, never interactive);
- when `hasVisibleProvider` is `true` (the future #746 path) → a `testID="auth-provider-region"` wrapper the SSO lane fills with the real wired provider button.

The email/password form, the sign-in/sign-up toggle, and the confirmation screen are unchanged. The notice never claims Google is live; it tells the reader social sign-in is coming soon and that email works now.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy · NO OAuth/provider wiring · NO redirect/callback · NO Supabase Auth config · NO secret/credential · NO native dep · NO package install · NO app.json change · NO identity-field change. Does not change room/seat/chime-in/invite/observer/auth/session/submission semantics. Email/password sign-in keeps working; **no visible/enabled "Continue with Google" button renders this batch** — the future affordance is wired under operator-gated config in #740/#746's later lane. `signInWithOAuth` appears nowhere in `src/`.

## Doctrine compliance

Mediator, not judge — the auth surface carries no verdict/winner/loser/standing/person-judgment copy. No unimplemented capability is faked (no inert visible buttons by default). Secrets never in repo/client; no service-role. Email/password is the always-available path. Voice/timeline/Google are NOT claimed live. Reference button/marketing copy is not lifted; the only standard string a future card uses is the conventional "Continue with Google" affordance label, kept as a future-reserved constant and rendered only when #746 lights the slot.

## Cross-references

- `docs/designs/AUTH-FOUNDATION-UI-001.md` — #740, the merged provider-ready Sign In structure (same batch, same canonical model).
- `docs/designs/AUTH-FOUNDATION-INDEX.md` §2 (UI slot strategy) — #740/#746 lane.
- `docs/designs/AUTH-GOOGLE-SSO-INDEX.md` — downstream Google lane (GATE-C).
- `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md` — epic 16 slate; first-run copy folded into UX-COPY-001 (#676).
- `docs/designs/AUTH-FACEBOOK-SSO-001-DEFERRED.md` — Facebook deferred post-launch (slot reserved only).
