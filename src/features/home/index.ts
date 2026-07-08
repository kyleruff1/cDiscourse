/**
 * HOME-001 (#874) — ArgumentHome ("Your table") public surface.
 */
export { ArgumentHome, type ArgumentHomeProps } from './ArgumentHome';
export { ArgumentCard, type ArgumentCardProps, type ArgumentCardState } from './ArgumentCard';
export {
  buildArgumentHomeViewModel,
  collectFixtureDebateIds,
  collectUnreadDebateIds,
  type BuildArgumentHomeInput,
  type ArgumentHomeViewModel,
} from './homeModel';
