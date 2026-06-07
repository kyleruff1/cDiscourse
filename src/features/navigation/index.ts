/**
 * NAV-START-ARGUMENT-001 Slice B — global header / masthead navigation.
 *
 * Public barrel for the shared-shell primary navigation: the pure model
 * (sections + active derivation + state transitions), the presentational
 * header nav component, and the public About screen.
 */
export {
  PRIMARY_NAV_ORDER,
  PRIMARY_NAV_LABELS,
  PRIMARY_NAV_HINTS,
  FORBIDDEN_PUBLIC_NAV_TOKENS,
  deriveActivePrimaryNavSection,
  resolvePrimaryNavTransition,
  type PrimaryNavSection,
  type PrimaryNavShellState,
  type PrimaryNavTransition,
} from './appPrimaryNavModel';
export { AppPrimaryNav, APP_COPYRIGHT_TEXT } from './AppPrimaryNav';
export { AboutScreen } from './AboutScreen';
