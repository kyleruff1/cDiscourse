/**
 * UX-COPY-001 — CivilDiscourse v4 brand + first-run copy constants.
 *
 * The single home for the v4 "net-new" reusable brand phrases so the
 * sign-in / first-run surface (and any future surface the design places
 * them on) references one source of truth rather than re-authoring the
 * strings inline. Pure TypeScript — no React, no Supabase, no network.
 *
 * Doctrine (cdiscourse-doctrine §1, §9):
 *   - Visible product name is "CivilDiscourse" (one word).
 *   - The framing is mediator, not judge: the app surfaces the
 *     STRUCTURE of a disagreement, never who is right. No verdict /
 *     standing / popularity / person-label vocabulary appears here.
 *   - "Mark the point, not the person." is the principle line — used
 *     SPARINGLY, never as the masthead tagline (that is `BRAND.taglineText`
 *     in designTokens.ts).
 *   - Voice is NOT shipped: there is no voice-first prompt.
 *
 * QUICK-COPY-001 — the Sign In value-prop card is the brand lockup + the
 * primary tagline only. The three-beat sub-explanation and the mediator
 * framing footer (and their `FIRST_RUN_SUBLINE` / `MEDIATOR_NOT_A_JUDGE`
 * constants + `subline` / `mediatorFooter` keys) were removed; they had
 * no other consumer.
 */

/** Visible product name. One word. Never the repo/package identifier. */
export const PRODUCT_NAME = 'CivilDiscourse' as const;

/**
 * Primary tagline. Mirrors `BRAND.taglineText` in designTokens.ts (the
 * masthead fixture). Re-stated here as the canonical brand phrase so
 * copy consumers that are not the header can reference it by name.
 */
export const PRIMARY_TAGLINE = 'A high-trust room for hard conversations.' as const;

/**
 * Principle line. Use SPARINGLY (it is not the masthead tagline). It is
 * the dignity-pill phrase from the v4 design.
 */
export const PRINCIPLE_MARK_THE_POINT = 'Mark the point, not the person.' as const;

/**
 * Net-new mediator prompts from the v4 design (reserved reusable copy).
 * Referenced where the design places them; exported here so future
 * cards (next-move, impasse) reuse one source of truth.
 */
export const WHAT_REMAINS_UNRESOLVED = 'What remains unresolved' as const;
export const WHAT_WOULD_MOVE_THIS_FORWARD = 'What would move this forward' as const;

/**
 * Composed first-run / sign-in copy block. The AuthScreen renders this
 * as the value-prop card; grouping it keeps the strings testable in
 * isolation and re-orderable without touching the screen.
 */
export const AUTH_FIRST_RUN_COPY = {
  brand: PRODUCT_NAME,
  tagline: PRIMARY_TAGLINE,
} as const;
