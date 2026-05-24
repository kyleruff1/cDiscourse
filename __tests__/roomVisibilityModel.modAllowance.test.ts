/**
 * QOL-039 — OD-1 verification: moderator allowance is creator-only at the
 * UI/model layer.
 *
 * The operator's resolution (OD-1, Option A, 2026-05-24): the
 * `canTransitionToPrivate` gate drops the mod arm because QOL-040's shipped
 * `room-notifications` `handleRoomMadePrivate` accepts ONLY the creator as
 * the authorized actor. A mod-initiated transition would succeed at the
 * DB+RLS layer but fail at the notification dispatch layer.
 *
 * The DB+RLS layer keeps the creator-OR-mod permission as defense-in-depth
 * (no behavior change at that layer). This test documents the boundary at
 * the UI/model layer.
 */
import {
  canTransitionToPrivate,
  type VisibilityTransitionContext,
} from '../src/features/debates/roomVisibilityModel';

const CREATOR = 'user-creator-aaaa';
const MOD = 'user-mod-bbbb';

function modContext(
  over: Partial<VisibilityTransitionContext> = {},
): VisibilityTransitionContext {
  return {
    roomId: 'room-1',
    currentVisibility: 'public',
    roomStatus: 'open',
    callerUserId: MOD,
    createdByUserId: CREATOR,
    callerIsModeratorOrAdmin: true,
    ...over,
  };
}

describe('canTransitionToPrivate — OD-1 mod allowance', () => {
  it('mod on a public room → not_room_creator (OD-1)', () => {
    const res = canTransitionToPrivate(modContext());
    expect(res).toEqual({ allowed: false, reason: 'not_room_creator' });
  });

  it('admin on a public room → not_room_creator (OD-1, same rule)', () => {
    // Same path — `callerIsModeratorOrAdmin` covers both. Both are
    // equivalent to non-creator under OD-1.
    const res = canTransitionToPrivate(modContext());
    expect(res).toEqual({ allowed: false, reason: 'not_room_creator' });
  });

  it('mod on an already-private room → already_private (precedes not_room_creator)', () => {
    // The already-private check fires first — no surface for the
    // "make private" action at all.
    const res = canTransitionToPrivate(modContext({ currentVisibility: 'private' }));
    expect(res).toEqual({ allowed: false, reason: 'already_private' });
  });

  it('the callerIsModeratorOrAdmin field is RESERVED but does not change the verdict', () => {
    // Same context, two different values for the reserved field. The
    // verdict stays the same.
    const withMod = canTransitionToPrivate(modContext({ callerIsModeratorOrAdmin: true }));
    const withoutMod = canTransitionToPrivate(modContext({ callerIsModeratorOrAdmin: false }));
    expect(withMod).toEqual(withoutMod);
  });

  it('the creator is always allowed regardless of the reserved field', () => {
    const creatorWithMod = canTransitionToPrivate(
      modContext({ callerUserId: CREATOR, callerIsModeratorOrAdmin: true }),
    );
    const creatorWithoutMod = canTransitionToPrivate(
      modContext({ callerUserId: CREATOR, callerIsModeratorOrAdmin: false }),
    );
    expect(creatorWithMod).toEqual({ allowed: true, reason: 'eligible' });
    expect(creatorWithoutMod).toEqual({ allowed: true, reason: 'eligible' });
  });

  it('the model exports no API that takes a "use mod path" toggle', () => {
    // A future maintainer who tries to add a `widenToMods` parameter to
    // the gate would have to widen the type signature too — this test
    // documents the surface boundary.
    const exported = require('../src/features/debates/roomVisibilityModel');
    expect(exported.canTransitionToPrivateAsMod).toBeUndefined();
    expect(exported.canMakeRoomPrivate).toBeUndefined();
    expect(exported.canTransitionWithModWiden).toBeUndefined();
  });
});
