/**
 * ASP-EXTRACT-001 (Slice 2) — ArgumentGameSurface is now a re-export shim.
 *
 * The room surface was split into src/features/arguments/room/ with zero
 * behavior change: ArgumentRoom (the orchestrator) plus the two lens files
 * ExchangeView (stack / feed) and MapView (timeline map), plus the shared
 * roomActionCodes registry. The whole component moved verbatim into
 * ArgumentRoom; the col1 slot now dispatches to ExchangeView or MapView by
 * mode.
 *
 * This shim preserves every existing import path and every render test that
 * imports ArgumentGameSurface by name (ArgumentTreeScreen, DemoCorridorScreen,
 * and the integration / QUOTE-FORGE render pins all keep working unchanged).
 * All source-scan suites that read THIS file for moved tokens were repointed
 * to the room/ files those tokens now live in.
 *
 * No new capability. No verdict tokens. No AI. No Supabase. No service-role.
 */
export { ArgumentRoom as ArgumentGameSurface } from './room/ArgumentRoom';
export type { Props as ArgumentGameSurfaceProps } from './room/ArgumentRoom';
