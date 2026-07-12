/**
 * NAV-START-ARGUMENT-001 Slice B — global header / masthead primary nav model.
 *
 * Pure TypeScript. NO React, NO Supabase, NO network, NO router import.
 *
 * ─────────────────────────────────────────────────────────────────
 * Why a pure model and not a URL router:
 *
 * CDiscourse is a deliberate NO-ROUTER app (the TL-003 / COMPOSER-002
 * "no-route" invariant — see `__tests__/composerDockNoRoute.test.ts` and
 * `__tests__/inRoomNoRoute.test.ts`). Screens are selected by in-memory
 * state in `MainAppShell`, never by `react-navigation` / `expo-router` /
 * `react-router` / `Linking` / `history`.
 *
 * This model names the PRIMARY user navigation items, the in-memory shell
 * state each item targets, and a pure derivation of which item is the
 * "active section" given the current shell state. The header component
 * consumes these; the shell applies the resulting state transitions. No
 * navigation primitive is involved anywhere in the chain.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * The primary navigation sections shown in the centered masthead nav.
 * `about` is rendered separately (upper-right) but shares the active-state
 * derivation so the active section is unambiguous.
 *
 * NOTE: Admin / Debug are SECONDARY, role-gated tabs and are intentionally
 * NOT part of this primary set. Regular users never see them; the primary
 * header is the same for every authenticated user.
 */
export type PrimaryNavSection =
  | 'start_argument'
  | 'browse_arguments'
  | 'my_arguments'
  | 'profile'
  | 'about';

/** The four centered primary nav items (in render order). `about` is shown separately. */
export const PRIMARY_NAV_ORDER: ReadonlyArray<PrimaryNavSection> = Object.freeze([
  'start_argument',
  'browse_arguments',
  'my_arguments',
  'profile',
]);

/** User-facing labels. Plain language; no internal codes, no verdict vocabulary. */
export const PRIMARY_NAV_LABELS: Record<PrimaryNavSection, string> = {
  start_argument: 'Start An Argument',
  browse_arguments: 'Browse Arguments',
  my_arguments: 'My Arguments',
  profile: 'Profile',
  about: 'About CivilDiscourse',
};

/**
 * Screen-reader hints describing the result of activating each item. Kept
 * short — the label already names the destination.
 */
export const PRIMARY_NAV_HINTS: Record<PrimaryNavSection, string> = {
  start_argument: 'Opens the page for starting a new argument',
  browse_arguments: 'Opens the list of argument rooms to browse',
  my_arguments: 'Shows the argument rooms you have joined',
  profile: 'Opens your account and profile',
  about: 'Opens information about CivilDiscourse',
};

/**
 * The in-memory shell state the model reads to decide the active section.
 * Mirrors the fields `MainAppShell` already holds. Pure data — no React.
 *
 * - `tab`            : the active secondary tab id (`arguments` / `account` / ...).
 * - `hasDebate`      : true when a room is open (a debate is selected).
 * - `startArgumentOpen` : true when the Start Argument page is showing.
 * - `galleryLane`    : the active gallery lane filter (`'my_rooms'` means
 *                      the "My Arguments" view is active).
 * - `aboutOpen`      : true when the public About screen is showing.
 */
export interface PrimaryNavShellState {
  tab: string;
  hasDebate: boolean;
  startArgumentOpen: boolean;
  galleryLane: string;
  aboutOpen: boolean;
}

/**
 * Derive which primary nav item should render as active for the given shell
 * state. Pure + total — always returns a section (defaults to
 * `browse_arguments`, the gallery, which is the app's home surface).
 *
 * Precedence (most specific first):
 *   1. About screen open               → 'about'
 *   2. Account tab                     → 'profile'
 *   3. Arguments tab + Start page open → 'start_argument'
 *   4. Arguments tab + 'my_rooms' lane → 'my_arguments'
 *   5. Anything else on Arguments      → 'browse_arguments'
 *
 * A room being open does NOT change the active primary section — the user
 * reached the room from a gallery surface, so the gallery item stays the
 * active anchor unless a more specific signal (start page / lane) applies.
 */
export function deriveActivePrimaryNavSection(
  state: PrimaryNavShellState,
): PrimaryNavSection {
  if (state.aboutOpen) return 'about';
  if (state.tab === 'account') return 'profile';
  if (state.tab === 'arguments') {
    if (state.startArgumentOpen) return 'start_argument';
    if (!state.hasDebate && state.galleryLane === 'my_rooms') return 'my_arguments';
    return 'browse_arguments';
  }
  return 'browse_arguments';
}

/**
 * The in-memory transition each primary nav item drives. The shell applies
 * these fields literally; this is the single source of truth for "tapping
 * item X sets state Y" so the wiring is unit-testable without React.
 *
 * Every field is a plain in-memory state write — NO route, NO URL, NO
 * navigation primitive.
 */
export interface PrimaryNavTransition {
  /** Target secondary tab. */
  tab: 'arguments' | 'account';
  /** Whether to open the Start Argument page (Arguments tab only). */
  startArgumentOpen: boolean;
  /** The gallery lane to activate (Arguments tab only). `'all'` = full gallery. */
  galleryLane: 'all' | 'my_rooms';
  /** Whether the public About screen should be open. */
  aboutOpen: boolean;
  /**
   * Whether to deselect any open room. Every primary nav item returns to a
   * top-level surface, so this is always true — tapping a primary item
   * leaves the current room (state-only deselect, no route).
   */
  deselectRoom: boolean;
  /**
   * A11Y-PR0 (#913) — whether to leave the demo corridor. Every primary
   * nav item returns to a top-level surface, so this is always true; it
   * mirrors `deselectRoom`. Before this field `handlePrimaryNav` never
   * cleared `demoCorridorOpen`, so the corridor co-rendered on top of the
   * target surface (P0-3c). The shell reads this flag and clears the
   * corridor state (no route).
   */
  clearDemoCorridor: boolean;
}

/**
 * Resolve the in-memory transition for a primary nav item. Pure + total.
 *
 * - Start An Argument → Arguments tab, Start page open, room deselected.
 * - Browse Arguments  → Arguments tab, full gallery (all lanes), room deselected.
 * - My Arguments      → Arguments tab, 'my_rooms' lane, room deselected.
 * - Profile           → Account tab, room deselected.
 * - About             → About screen open (tab unchanged conceptually; we
 *                       keep `tab: 'arguments'` so leaving About returns to
 *                       the gallery), room deselected.
 */
export function resolvePrimaryNavTransition(
  section: PrimaryNavSection,
): PrimaryNavTransition {
  switch (section) {
    case 'start_argument':
      return {
        tab: 'arguments',
        startArgumentOpen: true,
        galleryLane: 'all',
        aboutOpen: false,
        deselectRoom: true,
        clearDemoCorridor: true,
      };
    case 'browse_arguments':
      return {
        tab: 'arguments',
        startArgumentOpen: false,
        galleryLane: 'all',
        aboutOpen: false,
        deselectRoom: true,
        clearDemoCorridor: true,
      };
    case 'my_arguments':
      return {
        tab: 'arguments',
        startArgumentOpen: false,
        galleryLane: 'my_rooms',
        aboutOpen: false,
        deselectRoom: true,
        clearDemoCorridor: true,
      };
    case 'profile':
      return {
        tab: 'account',
        startArgumentOpen: false,
        galleryLane: 'all',
        aboutOpen: false,
        deselectRoom: true,
        clearDemoCorridor: true,
      };
    case 'about':
      return {
        tab: 'arguments',
        startArgumentOpen: false,
        galleryLane: 'all',
        aboutOpen: true,
        deselectRoom: true,
        clearDemoCorridor: true,
      };
  }
}

/**
 * Vocabulary that must NEVER appear in any primary-header label, hint, or
 * the About screen copy when shown to a regular user. Two classes:
 *
 *  1. Verdict / popularity (doctrine §1-§3).
 *  2. Operational / role-restricted surfaces that must not leak into the
 *     PUBLIC header for regular users (Admin, Debug, classifier health,
 *     the H/I/J families, routing/production-family status).
 *
 * Exported so the header + About tests can scan rendered strings against a
 * single list.
 */
export const FORBIDDEN_PUBLIC_NAV_TOKENS: ReadonlyArray<string> = Object.freeze([
  // Verdict / popularity
  'winner',
  'loser',
  'liar',
  'truth',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  // Operational / role-restricted surfaces (must not appear in the public header)
  'admin',
  'debug',
  'classifier',
  'classifier-health',
  'classifier health',
  'production family',
  'routing',
  'family h',
  'family i',
  'family j',
  'service role',
  'service_role',
]);
