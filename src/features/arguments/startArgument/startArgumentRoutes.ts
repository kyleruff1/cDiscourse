/**
 * NAV-START-ARGUMENT-001 Slice A — Start Argument route aliases.
 *
 * Pure TypeScript. NO React, NO Supabase, NO network, NO router import.
 *
 * ─────────────────────────────────────────────────────────────────
 * Why a pure resolver and not a URL router:
 *
 * CDiscourse is a deliberate NO-ROUTER app (the TL-003 / COMPOSER-002
 * "no-route" invariant — see `__tests__/composerDockNoRoute.test.ts` and
 * `__tests__/inRoomNoRoute.test.ts`). Screens are selected by in-memory
 * state in `MainAppShell`, never by `react-navigation` / `expo-router` /
 * `react-router` / `Linking` / `history`. Introducing a real router for
 * this card would violate that invariant and is explicitly out of scope.
 *
 * So "routes" here are PATH IDENTIFIERS the app understands as names for
 * the same destination. The canonical name is `/start-argument`. The two
 * legacy names the old New Argument surface was reached under
 * (`/new-argument` and `/arguments/new`) resolve to the SAME Start
 * Argument surface — i.e. they alias/redirect to it. No existing entry
 * point breaks: the gallery "New room" affordance opens the Start Argument
 * page, and any caller resolving a legacy path lands on the same page.
 * ─────────────────────────────────────────────────────────────────
 */

/** The canonical path name for the Start Argument page. */
export const START_ARGUMENT_CANONICAL_ROUTE = '/start-argument' as const;

/**
 * Legacy path names the old New Argument surface was reached under. Both
 * alias to the canonical Start Argument route.
 */
export const START_ARGUMENT_ALIAS_ROUTES = Object.freeze([
  '/new-argument',
  '/arguments/new',
]) as ReadonlyArray<string>;

/** Every path name that resolves to the Start Argument page. */
export const START_ARGUMENT_ALL_ROUTES: ReadonlyArray<string> = Object.freeze([
  START_ARGUMENT_CANONICAL_ROUTE,
  ...START_ARGUMENT_ALIAS_ROUTES,
]);

/** Stable target identifier the resolver returns for a matched path. */
export const START_ARGUMENT_ROUTE_TARGET = 'start-argument-page' as const;
export type StartArgumentRouteTarget = typeof START_ARGUMENT_ROUTE_TARGET;

/**
 * Normalize a raw path into the form the resolver compares. Trims, strips a
 * trailing slash (except the root), and lowercases. Pure + total — never
 * throws; a non-string returns the empty string.
 */
export function normalizeStartArgumentPath(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let p = raw.trim().toLowerCase();
  // Drop a query / hash suffix — only the path segment names the surface.
  const cut = p.search(/[?#]/);
  if (cut >= 0) p = p.slice(0, cut);
  // Strip a single trailing slash, but never reduce '/' to ''.
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/**
 * True when `path` is the canonical Start Argument route OR one of its
 * aliases. Both the canonical and the legacy New Argument paths resolve to
 * the Start Argument page (the alias/redirect contract).
 */
export function isStartArgumentRoute(path: unknown): boolean {
  const norm = normalizeStartArgumentPath(path);
  if (!norm) return false;
  return START_ARGUMENT_ALL_ROUTES.includes(norm);
}

/**
 * Resolve a raw path to the Start Argument page target, or `null` when the
 * path is not one the Start Argument surface owns. The canonical route and
 * BOTH legacy aliases return the same target — i.e. the legacy New Argument
 * paths redirect to the Start Argument page.
 */
export function resolveStartArgumentRoute(
  path: unknown,
): StartArgumentRouteTarget | null {
  return isStartArgumentRoute(path) ? START_ARGUMENT_ROUTE_TARGET : null;
}
