/**
 * UX-PR-G (#920) P1-12 — no rail action ships without a handler.
 *
 * Share was a guaranteed no-op (zero suppliers, rooms have no URLs) yet it
 * rendered for every observer. This guard makes that class of bug impossible:
 * for EVERY code any getRailActions set can render, the code must EITHER map to
 * a non-null bubble control (dispatched via handleAction) OR be one of the
 * ROOM-locally-routed codes (RAIL_LOCALLY_ROUTED_CODES: join / open_timeline /
 * watch). A future codeless entry fails this test.
 */
import {
  getRailActions,
  railActionToBubbleControl,
  RAIL_LOCALLY_ROUTED_CODES,
  type RailViewerRole,
  type RailBubbleActor,
} from '../src/features/arguments/ArgumentSideActionRail';

const ROLES: RailViewerRole[] = ['observer', 'participant'];
const ACTORS: RailBubbleActor[] = ['self', 'other', 'bot', 'admin', 'unknown'];

function everyRenderedCode(): string[] {
  const codes = new Set<string>();
  for (const role of ROLES) {
    for (const actor of ACTORS) {
      for (const a of getRailActions(role, actor)) codes.add(a.code);
    }
  }
  return [...codes];
}

describe('UX-PR-G P1-12 — rail handler-presence guard', () => {
  it('every rendered rail code has a handler (bubble control OR locally routed)', () => {
    const locallyRouted = new Set<string>(RAIL_LOCALLY_ROUTED_CODES);
    for (const code of everyRenderedCode()) {
      const hasBubbleControl = railActionToBubbleControl(code as never) !== null;
      const isLocallyRouted = locallyRouted.has(code);
      expect(hasBubbleControl || isLocallyRouted).toBe(true);
    }
  });

  it("'share' no longer appears in ANY getRailActions set", () => {
    expect(everyRenderedCode()).not.toContain('share');
  });

  it("RAIL_LOCALLY_ROUTED_CODES does not contain 'share' (it was removed, not re-homed)", () => {
    expect(RAIL_LOCALLY_ROUTED_CODES).not.toContain('share');
    expect([...RAIL_LOCALLY_ROUTED_CODES].sort()).toEqual(
      ['join_aff', 'join_neg', 'open_timeline', 'watch'].sort(),
    );
  });
});
