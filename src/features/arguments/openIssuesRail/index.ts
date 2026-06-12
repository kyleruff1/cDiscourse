/**
 * REF-006-RAIL — Open Issues rail public surface.
 *
 * The pure iterator (`openIssuesRailModel`) + the collapsed-by-default panel
 * (`OpenIssuesRail`). The host (`ArgumentGameSurface`) builds the candidate
 * `OpenIssue[]` via REF-002's `buildOpenIssue` (single derivation home) and
 * feeds them through `buildOpenIssuesLedger`.
 */

export * from './openIssuesRailModel';
export { OpenIssuesRail, OPEN_ISSUES_RAIL_INITIAL_ROWS } from './OpenIssuesRail';
export type { OpenIssuesRailProps } from './OpenIssuesRail';
