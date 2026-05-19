/**
 * SC-004 — SC-002 popover ↔ SC-004 dock mutual-exclusion test.
 *
 * Per design §"Risks" #1 — tapping a node when the dock is wired MUST
 * route to dock-selection, NOT to popover-open. The info-icon is the only
 * way to open the popover; doing so dismisses the dock.
 *
 * This test asserts the contract by reading the tap-handler logic from
 * ArgumentTimelineMap.tsx (source scan) and verifying:
 *
 *   1. There's an `onSelectTarget` short-circuit branch in `handleNodeTap`.
 *   2. The info-icon handler dismisses the dock target before opening the
 *      popover.
 *
 * No render harness is required; we validate the doctrine via source
 * inspection. A future component-render test (QOL-022) would assert it
 * via actual taps.
 */

import * as fs from 'fs';
import * as path from 'path';

const TIMELINE_MAP_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'features', 'arguments', 'ArgumentTimelineMap.tsx'),
  'utf8',
);

describe('SC-004 mutual exclusion — SC-002 popover vs SC-004 dock', () => {
  it('handleNodeTap routes through onSelectTarget when the dock is wired', () => {
    // The tap handler must short-circuit to dock-selection before falling
    // through to the legacy popover path.
    expect(TIMELINE_MAP_SRC.includes('onSelectTarget')).toBe(true);
    expect(TIMELINE_MAP_SRC.includes('// SC-004 path')).toBe(true);
  });

  it('handleInfoTap dismisses the dock when opening the popover', () => {
    // The info-icon handler must call onSelectTarget(null) before
    // setPopoverMessageId(...).
    // Find the handleInfoTap body and check both lines are present.
    const match = TIMELINE_MAP_SRC.match(/handleInfoTap[\s\S]*?\}, \[onSelectTarget\]\);/);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[0].includes('onSelectTarget?.(null)')).toBe(true);
      expect(match[0].includes('setPopoverMessageId(effect.messageId)')).toBe(true);
    }
  });

  it('the dock is only rendered when popoverModel is null (mutual exclusion in JSX)', () => {
    // The dock render condition includes `!popoverModel` so both
    // surfaces are never visible at the same time.
    expect(TIMELINE_MAP_SRC.includes('selectedTarget && actionDockModel && !popoverModel')).toBe(true);
  });
});

describe('SC-004 mutual exclusion — opening cards-detail dismisses the dock', () => {
  const GAME_SURFACE_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'features', 'arguments', 'ArgumentGameSurface.tsx'),
    'utf8',
  );

  it('handleOpenCardsDetail dismisses the dock target', () => {
    const match = GAME_SURFACE_SRC.match(/handleOpenCardsDetail[\s\S]*?\}, \[\]\);/);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[0].includes('setSelectedDockTarget(null)')).toBe(true);
    }
  });

  it('handleActionDockAction never calls a router method', () => {
    // COMPOSER-001 — useCallback deps may include `sorted` (needed for parent
    // argumentType lookup when computing the composer preset). Accept either
    // `[handleAction]` (pre-COMPOSER-001) or `[handleAction, sorted]`.
    const match = GAME_SURFACE_SRC.match(/handleActionDockAction[\s\S]*?\}, \[handleAction(?:, sorted)?\]\);/);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[0].includes('router.push')).toBe(false);
      expect(match[0].includes('router.navigate')).toBe(false);
      expect(match[0].includes('Linking.openURL')).toBe(false);
    }
  });
});
