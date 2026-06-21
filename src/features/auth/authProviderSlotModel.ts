/**
 * UX-COPY-BATCH-002 (#740 / #760) — Sign In provider-slot contract (pure TS).
 *
 * Pure TypeScript — NO React, NO Supabase, NO network, NO mutation. This is
 * the SINGLE canonical owner of the Sign In provider-slot contract that the
 * later SSO lane (#746 AUTH-GOOGLE-SSO-003) consumes. Email/password is NOT
 * modeled here — it is the always-present canonical path rendered directly by
 * AuthScreen.
 *
 * Doctrine (cdiscourse-doctrine §10 "email+password only in v1"; the v4 auth
 * lane reconciliation #740/#760):
 *  - The DEFAULT first-run surface is EMAIL-ONLY. No visible / clickable
 *    provider button renders this batch. Google config is not live, so a
 *    visible provider button would imply an unimplemented capability — that
 *    is doctrine-forbidden. The default surface shows a future-framed
 *    "coming soon" notice + an "or continue with SSO" divider, then the
 *    unchanged email/password form.
 *  - Google is a FUTURE-reserved slot, `enabled: false` today. While
 *    `enabled === false` the screen MUST NOT, and CANNOT, reach any provider:
 *    no provider button is rendered, and the provider sign-in call appears
 *    nowhere in `src/` (a source-scan guard enforces this).
 *  - Apple / Facebook are reserved slot IDS only (Apple deferred; Facebook is
 *    its own deferred card). None render in v1.
 *  - Plain language only. No internal codes, no verdict tokens, no reference
 *    slogans. `CONTINUE_WITH_GOOGLE_LABEL` is a conventional provider
 *    affordance string kept for #746 — it is NOT rendered while disabled.
 *
 * Forward-compatibility with #746 (zero re-layout):
 *  - #746 flips the Google slot to `enabled: true` (gated on config) by
 *    passing `enabledSlots` into `resolveAuthProviderSlotRegion(...)`, which
 *    sets `anyProviderEnabled: true` + `hasVisibleProvider: true`. The screen
 *    then mounts the (real, wired) provider button inside the SAME region and
 *    drops the real `signInWithGoogle` wrapper at the slot. No JSX
 *    restructuring is needed; the email path does not reflow.
 */

/**
 * Provider ids this contract reserves. Google is the future primary;
 * Apple / Facebook are reserved + deferred. NONE render in v1.
 */
export type AuthProviderSlotId = 'google' | 'apple' | 'facebook';

export interface AuthProviderSlot {
  /** Stable id used for testIDs + the future #746 wiring switch. */
  readonly id: AuthProviderSlotId;
  /** Render order (ascending). Google is the reserved PRIMARY slot (0). */
  readonly order: number;
  /**
   * Plain-language affordance label authored by the FUTURE card. Optional
   * because the v1 default renders no provider button.
   */
  readonly labelKey?: string;
  /** True ONLY when the provider call is wired + configured. FALSE today. */
  readonly enabled: boolean;
}

export interface AuthProviderSlotRegionModel {
  /**
   * Ordered slots that should RENDER as enabled provider buttons. EMPTY by
   * default in v1 — no provider button is rendered this batch.
   */
  readonly slots: ReadonlyArray<AuthProviderSlot>;
  /**
   * True when at least one slot is enabled (none today → false). Drives
   * whether the screen mounts a real provider button vs the
   * provider-unavailable notice.
   */
  readonly anyProviderEnabled: boolean;
  /**
   * Alias of `anyProviderEnabled` for the #760 consumer naming
   * (`hasVisibleProvider`) — true iff a provider button is visible.
   */
  readonly hasVisibleProvider: boolean;
  /**
   * The canonical slot ORDER a future card MUST honor so lighting a slot
   * needs no first-run re-layout.
   */
  readonly slotOrder: ReadonlyArray<AuthProviderSlotId>;
  /**
   * Future-framed plain-language line shown under the (empty) provider region
   * so the email path is the obvious route while social is unavailable.
   * Empty string when a provider is enabled (no notice needed).
   */
  readonly providerUnavailableCopy: string;
  /** Divider label between the email form and the SSO provider region. */
  readonly dividerLabel: string;
}

/**
 * Conventional provider label. FUTURE-reserved for #746 — kept so the later
 * card extends this file instead of forking a parallel constant. NOT rendered
 * while the Google slot is disabled (no visible Google button this batch).
 * Intentionally NOT sourced from brandCopy (brandCopy holds CivilDiscourse
 * brand phrases, not provider names).
 */
export const CONTINUE_WITH_GOOGLE_LABEL = 'Continue with Google' as const;

/**
 * Divider copy between the email/password form and the SSO provider region.
 * Plain, original wording (NOT the reference's "or with email"). Renamed from
 * PROVIDER_EMAIL_DIVIDER_LABEL — AUTH-GOOGLE-SSO-LAYOUT-001 (#780) moved the
 * provider region BELOW the email Sign In button, so the divider now leads
 * into the SSO options rather than into the email form.
 */
export const PROVIDER_SSO_DIVIDER_LABEL = 'or continue with SSO' as const;

/**
 * Provider-unavailable copy. Plain language; no codes, no verdict tokens, no
 * slogans. Future-framed: states plainly that social sign-in is coming and
 * that email works now, so the email path is the obvious route. Never claims
 * Google is live. AUTH-GOOGLE-SSO-LAYOUT-001 (#780) moved this notice BELOW the
 * email form, so the prior directional word "below" was dropped — the copy is
 * now position-neutral and correct regardless of where the notice renders.
 */
export const PROVIDER_UNAVAILABLE_COPY =
  'Social sign-in is coming soon. Use your email and password to continue.' as const;

/**
 * The canonical first-run slot ORDER. Google primary; Apple / Facebook
 * reserved + deferred. ORDER is the contract a future card honors.
 */
export const FIRST_RUN_PROVIDER_SLOT_ORDER: ReadonlyArray<AuthProviderSlotId> = [
  'google',
  'apple',
  'facebook',
];

/**
 * Resolve the provider-region model.
 *
 * Default (no args, the v1 default): returns EMPTY `slots`,
 * `anyProviderEnabled: false` / `hasVisibleProvider: false`, the future-framed
 * `providerUnavailableCopy`, and the divider label — so the screen renders the
 * "coming soon" notice + divider above the unchanged email form, with NO
 * provider button.
 *
 * Future (#746 passes `enabledSlots`): returns those slots sorted by `order`
 * and intersected against `FIRST_RUN_PROVIDER_SLOT_ORDER`, with
 * `anyProviderEnabled` / `hasVisibleProvider` = `slots.length > 0` and an empty
 * `providerUnavailableCopy` (no notice needed). This is the consumable hook
 * with ZERO first-run re-layout.
 */
export function resolveAuthProviderSlotRegion(opts?: {
  enabledSlots?: ReadonlyArray<AuthProviderSlot>;
}): AuthProviderSlotRegionModel {
  const requested = opts?.enabledSlots ?? [];
  // Only ids in the canonical order are honored; only enabled slots render.
  const known = requested.filter(
    (s) => FIRST_RUN_PROVIDER_SLOT_ORDER.includes(s.id) && s.enabled,
  );
  const slots = [...known].sort((a, b) => a.order - b.order);
  const anyProviderEnabled = slots.length > 0;
  return {
    slots,
    anyProviderEnabled,
    hasVisibleProvider: anyProviderEnabled,
    slotOrder: FIRST_RUN_PROVIDER_SLOT_ORDER,
    providerUnavailableCopy: anyProviderEnabled ? '' : PROVIDER_UNAVAILABLE_COPY,
    dividerLabel: PROVIDER_SSO_DIVIDER_LABEL,
  };
}
