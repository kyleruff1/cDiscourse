/**
 * A11Y-PR0 (#913) — corridor-nav field on the primary nav transition.
 *
 * P0-3c: every primary nav item must leave the demo corridor, mirroring
 * deselectRoom. This pins clearDemoCorridor === true for all 5 sections
 * and confirms the other transition fields are unchanged (regression pin).
 */
import {
  PRIMARY_NAV_ORDER,
  resolvePrimaryNavTransition,
  type PrimaryNavSection,
} from '../../src/features/navigation/appPrimaryNavModel';

const ALL_SECTIONS: PrimaryNavSection[] = [
  'start_argument',
  'browse_arguments',
  'my_arguments',
  'profile',
  'about',
];

describe('A11Y-PR0 — resolvePrimaryNavTransition.clearDemoCorridor', () => {
  it.each(ALL_SECTIONS)('clearDemoCorridor is true for %s', (section) => {
    expect(resolvePrimaryNavTransition(section).clearDemoCorridor).toBe(true);
  });

  it('covers every primary nav section plus about', () => {
    // The 4 centered primary items plus about = the 5 sections above.
    expect(new Set([...PRIMARY_NAV_ORDER, 'about'])).toEqual(new Set(ALL_SECTIONS));
  });

  it('other transition fields are unchanged (regression pin)', () => {
    expect(resolvePrimaryNavTransition('start_argument')).toEqual({
      tab: 'arguments',
      startArgumentOpen: true,
      galleryLane: 'all',
      aboutOpen: false,
      deselectRoom: true,
      clearDemoCorridor: true,
    });
    expect(resolvePrimaryNavTransition('browse_arguments')).toEqual({
      tab: 'arguments',
      startArgumentOpen: false,
      galleryLane: 'all',
      aboutOpen: false,
      deselectRoom: true,
      clearDemoCorridor: true,
    });
    expect(resolvePrimaryNavTransition('my_arguments')).toEqual({
      tab: 'arguments',
      startArgumentOpen: false,
      galleryLane: 'my_rooms',
      aboutOpen: false,
      deselectRoom: true,
      clearDemoCorridor: true,
    });
    // UX-PR-G.2 (issue 922) — home_v2 on routes my_arguments to the resume-first
    // 'home' lane; every other field (incl. clearDemoCorridor) is identical.
    expect(resolvePrimaryNavTransition('my_arguments', { homeV2Enabled: true })).toEqual({
      tab: 'arguments',
      startArgumentOpen: false,
      galleryLane: 'home',
      aboutOpen: false,
      deselectRoom: true,
      clearDemoCorridor: true,
    });
    expect(resolvePrimaryNavTransition('profile')).toEqual({
      tab: 'account',
      startArgumentOpen: false,
      galleryLane: 'all',
      aboutOpen: false,
      deselectRoom: true,
      clearDemoCorridor: true,
    });
    expect(resolvePrimaryNavTransition('about')).toEqual({
      tab: 'arguments',
      startArgumentOpen: false,
      galleryLane: 'all',
      aboutOpen: true,
      deselectRoom: true,
      clearDemoCorridor: true,
    });
  });
});
