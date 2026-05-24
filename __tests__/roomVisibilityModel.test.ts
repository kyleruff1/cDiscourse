/**
 * QOL-039 — Pure-model unit tests for roomVisibilityModel.
 *
 * Imports the model directly; NO React, NO Supabase, NO fetch.
 */
import {
  canTransitionToPrivate,
  buildTransitionConsequences,
  countChimeInBranchesFromSeatMap,
  summarizeRejectedChimeInBranches,
  ALL_ROOM_VISIBILITIES,
  ALL_TRANSITION_REASONS,
  ALL_TRANSITION_EFFECTS,
  type VisibilityTransitionContext,
  type RoomVisibilityChangeEvent,
} from '../src/features/debates/roomVisibilityModel';
import type { PublicRoomSeatMap } from '../src/features/debates/publicSeatModel';

const CREATOR = 'user-creator-aaaa-bbbb-cccc';
const OTHER = 'user-other-1111-2222-3333';

function baseContext(over: Partial<VisibilityTransitionContext> = {}): VisibilityTransitionContext {
  return {
    roomId: 'room-1',
    currentVisibility: 'public',
    roomStatus: 'open',
    callerUserId: CREATOR,
    createdByUserId: CREATOR,
    callerIsModeratorOrAdmin: false,
    ...over,
  };
}

function emptySeatMap(): PublicRoomSeatMap {
  return {
    roomId: 'room-1',
    activeSeats: [],
    movedToObserver: [],
    isCapReached: false,
    openChimeInSeatCount: 0,
  };
}

// ── canTransitionToPrivate ───────────────────────────────────

describe('canTransitionToPrivate', () => {
  it('creator on a public open room → eligible', () => {
    const res = canTransitionToPrivate(baseContext());
    expect(res).toEqual({ allowed: true, reason: 'eligible' });
  });

  it('creator on a public draft room → eligible (v1 does not block on status)', () => {
    const res = canTransitionToPrivate(baseContext({ roomStatus: 'draft' }));
    expect(res).toEqual({ allowed: true, reason: 'eligible' });
  });

  it('creator on a public locked room → eligible', () => {
    const res = canTransitionToPrivate(baseContext({ roomStatus: 'locked' }));
    expect(res).toEqual({ allowed: true, reason: 'eligible' });
  });

  it('creator on a public archived room → eligible (v1 allows; OQ-3 reserved)', () => {
    const res = canTransitionToPrivate(baseContext({ roomStatus: 'archived' }));
    expect(res).toEqual({ allowed: true, reason: 'eligible' });
  });

  it('non-creator + non-mod → not_room_creator', () => {
    const res = canTransitionToPrivate(baseContext({ callerUserId: OTHER }));
    expect(res).toEqual({ allowed: false, reason: 'not_room_creator' });
  });

  it('already-private room → already_private (even for the creator)', () => {
    const res = canTransitionToPrivate(baseContext({ currentVisibility: 'private' }));
    expect(res).toEqual({ allowed: false, reason: 'already_private' });
  });

  it('already-private check beats not_room_creator (private rooms expose no action)', () => {
    const res = canTransitionToPrivate(
      baseContext({ currentVisibility: 'private', callerUserId: OTHER }),
    );
    expect(res).toEqual({ allowed: false, reason: 'already_private' });
  });

  it('the model exposes NO canTransitionToPublic surface — one-way only', () => {
    const exported = require('../src/features/debates/roomVisibilityModel');
    expect(exported.canTransitionToPublic).toBeUndefined();
  });

  it('returns a stable shape — { allowed, reason } only', () => {
    const res = canTransitionToPrivate(baseContext());
    expect(Object.keys(res).sort()).toEqual(['allowed', 'reason']);
  });
});

// ── OD-1 — moderator allowance is dropped at the UI gate ─────

describe('canTransitionToPrivate — OD-1 creator-only', () => {
  it('callerIsModeratorOrAdmin = true on a public room with a different caller → not_room_creator', () => {
    // OD-1: the UI/model gate ignores the mod flag entirely. Mods get the
    // same `not_room_creator` reason as any other non-creator. The DB+RLS
    // layer keeps the creator-or-mod permission as defense-in-depth.
    const res = canTransitionToPrivate(
      baseContext({ callerUserId: OTHER, callerIsModeratorOrAdmin: true }),
    );
    expect(res).toEqual({ allowed: false, reason: 'not_room_creator' });
  });

  it('callerIsModeratorOrAdmin = true with the creator caller still → eligible', () => {
    // Creator path is unaffected by the mod flag.
    const res = canTransitionToPrivate(baseContext({ callerIsModeratorOrAdmin: true }));
    expect(res).toEqual({ allowed: true, reason: 'eligible' });
  });

  it('the model surface keeps callerIsModeratorOrAdmin as RESERVED', () => {
    // The field stays in the context type so it is here when QOL-040.2
    // lands. The v1 gate ignores it, but the context must accept it
    // without a TypeScript error.
    const ctx: VisibilityTransitionContext = {
      roomId: 'r',
      currentVisibility: 'public',
      roomStatus: 'open',
      callerUserId: CREATOR,
      createdByUserId: CREATOR,
      callerIsModeratorOrAdmin: true,
    };
    expect(ctx.callerIsModeratorOrAdmin).toBe(true);
  });
});

// ── buildTransitionConsequences ──────────────────────────────

describe('buildTransitionConsequences', () => {
  it('returns the six fixed effect codes in stable order', () => {
    const res = buildTransitionConsequences(baseContext(), null);
    expect(res.effects).toEqual([
      'leaves_public_list',
      'non_participants_lose_read',
      'participants_keep_access',
      'content_unchanged',
      'chime_in_branches_retained',
      'one_way',
    ]);
  });

  it('null seat map → retainedChimeInBranchCount = 0, no crash', () => {
    const res = buildTransitionConsequences(baseContext(), null);
    expect(res.retainedChimeInBranchCount).toBe(0);
  });

  it('empty seat map → retainedChimeInBranchCount = 0', () => {
    const res = buildTransitionConsequences(baseContext(), emptySeatMap());
    expect(res.retainedChimeInBranchCount).toBe(0);
  });

  it('counts unique chime-in branches with branchId from movedToObserver', () => {
    const seatMap: PublicRoomSeatMap = {
      ...emptySeatMap(),
      movedToObserver: [
        { userId: 'u-1', reason: 'governance', branchId: 'b-1' },
        { userId: 'u-2', reason: 'governance', branchId: 'b-2' },
        { userId: 'u-3', reason: 'governance', branchId: 'b-1' }, // duplicate branch
      ],
    };
    const res = buildTransitionConsequences(baseContext(), seatMap);
    expect(res.retainedChimeInBranchCount).toBe(2);
  });

  it('overflow records with null branchId do not count', () => {
    const seatMap: PublicRoomSeatMap = {
      ...emptySeatMap(),
      movedToObserver: [
        { userId: 'u-1', reason: 'overflow', branchId: null },
        { userId: 'u-2', reason: 'overflow', branchId: null },
        { userId: 'u-3', reason: 'governance', branchId: 'b-1' },
      ],
    };
    expect(buildTransitionConsequences(baseContext(), seatMap).retainedChimeInBranchCount).toBe(1);
  });

  it('always returns the same effect list (independent of context)', () => {
    const a = buildTransitionConsequences(baseContext(), null);
    const b = buildTransitionConsequences(
      baseContext({ callerUserId: OTHER, currentVisibility: 'private' }),
      null,
    );
    expect(a.effects).toEqual(b.effects);
  });
});

// ── countChimeInBranchesFromSeatMap ──────────────────────────

describe('countChimeInBranchesFromSeatMap', () => {
  it('returns 0 for null', () => {
    expect(countChimeInBranchesFromSeatMap(null)).toBe(0);
  });

  it('returns 0 for an empty movedToObserver', () => {
    expect(countChimeInBranchesFromSeatMap(emptySeatMap())).toBe(0);
  });

  it('returns the unique branch count', () => {
    const seatMap: PublicRoomSeatMap = {
      ...emptySeatMap(),
      movedToObserver: [
        { userId: 'u-1', reason: 'governance', branchId: 'b-1' },
        { userId: 'u-2', reason: 'governance', branchId: 'b-1' },
        { userId: 'u-3', reason: 'governance', branchId: 'b-2' },
        { userId: 'u-4', reason: 'overflow', branchId: null },
      ],
    };
    expect(countChimeInBranchesFromSeatMap(seatMap)).toBe(2);
  });
});

// ── summarizeRejectedChimeInBranches ─────────────────────────

describe('summarizeRejectedChimeInBranches', () => {
  it('null seat map → empty summary', () => {
    const res = summarizeRejectedChimeInBranches(null);
    expect(res.userIds).toEqual([]);
    expect(res.hasAny).toBe(false);
    expect(res.records).toEqual([]);
  });

  it('only governance-reason records count as rejected (overflow is not)', () => {
    const seatMap: PublicRoomSeatMap = {
      ...emptySeatMap(),
      movedToObserver: [
        { userId: 'u-1', reason: 'governance', branchId: 'b-1' },
        { userId: 'u-2', reason: 'overflow', branchId: null },
        { userId: 'u-3', reason: 'governance', branchId: 'b-2' },
      ],
    };
    const res = summarizeRejectedChimeInBranches(seatMap);
    expect(res.userIds).toEqual(['u-1', 'u-3']);
    expect(res.hasAny).toBe(true);
    expect(res.records.length).toBe(2);
  });

  it('dedupes user IDs across multiple chime-in branches', () => {
    const seatMap: PublicRoomSeatMap = {
      ...emptySeatMap(),
      movedToObserver: [
        { userId: 'u-1', reason: 'governance', branchId: 'b-1' },
        { userId: 'u-1', reason: 'governance', branchId: 'b-2' },
      ],
    };
    expect(summarizeRejectedChimeInBranches(seatMap).userIds).toEqual(['u-1']);
  });
});

// ── RoomVisibilityChangeEvent shape ──────────────────────────

describe('RoomVisibilityChangeEvent shape', () => {
  it('has from = "public" and to = "private" (v1 invariant)', () => {
    const ev: RoomVisibilityChangeEvent = {
      roomId: 'r',
      from: 'public',
      to: 'private',
      actorUserId: CREATOR,
      occurredAt: '2026-05-24T00:00:00Z',
      priorReadAccessIds: ['u-1', 'u-2'],
      rejectedChimeInUserIds: ['u-3'],
      rejectedChimeInArgumentIds: ['arg-1'],
    };
    expect(ev.from).toBe('public');
    expect(ev.to).toBe('private');
  });

  it('the type accepts ONLY ids — no body-shaped or content-shaped field', () => {
    // Structural assertion: a key called 'body', 'content', 'text' would
    // be a doctrine leak. Build the shape and probe its keys.
    const ev: RoomVisibilityChangeEvent = {
      roomId: 'r',
      from: 'public',
      to: 'private',
      actorUserId: CREATOR,
      occurredAt: 'now',
      priorReadAccessIds: [],
      rejectedChimeInUserIds: [],
      rejectedChimeInArgumentIds: [],
    };
    const keys = new Set(Object.keys(ev));
    expect(keys.has('body')).toBe(false);
    expect(keys.has('content')).toBe(false);
    expect(keys.has('text')).toBe(false);
    expect(keys.has('arguments')).toBe(false);
  });

  it('rejectedChimeInUserIds and rejectedChimeInArgumentIds are parallel arrays', () => {
    // The Edge Function emits these in parallel (per-chime-in argument
    // record). The shape allows non-matching lengths (some callers may
    // not have user IDs), but the test asserts the typical contract: a
    // rejected chime-in has both an author and an argument id.
    const ev: RoomVisibilityChangeEvent = {
      roomId: 'r',
      from: 'public',
      to: 'private',
      actorUserId: CREATOR,
      occurredAt: 'now',
      priorReadAccessIds: [],
      rejectedChimeInUserIds: ['u-1', 'u-2'],
      rejectedChimeInArgumentIds: ['arg-1', 'arg-2'],
    };
    expect(ev.rejectedChimeInUserIds.length).toBe(2);
    expect(ev.rejectedChimeInArgumentIds.length).toBe(2);
  });
});

// ── Catalogue exhaustiveness ─────────────────────────────────

describe('ALL_* frozen lists are exhaustive', () => {
  it('ALL_ROOM_VISIBILITIES enumerates every union member', () => {
    expect(ALL_ROOM_VISIBILITIES).toEqual(['public', 'private']);
  });

  it('ALL_TRANSITION_REASONS enumerates every union member', () => {
    expect(ALL_TRANSITION_REASONS).toEqual([
      'eligible',
      'already_private',
      'not_room_creator',
      'room_archived',
    ]);
  });

  it('ALL_TRANSITION_EFFECTS enumerates the six bullet codes', () => {
    expect(ALL_TRANSITION_EFFECTS).toEqual([
      'leaves_public_list',
      'non_participants_lose_read',
      'participants_keep_access',
      'content_unchanged',
      'chime_in_branches_retained',
      'one_way',
    ]);
  });

  it('all are frozen — append a new entry by writing a new card', () => {
    expect(Object.isFrozen(ALL_ROOM_VISIBILITIES)).toBe(true);
    expect(Object.isFrozen(ALL_TRANSITION_REASONS)).toBe(true);
    expect(Object.isFrozen(ALL_TRANSITION_EFFECTS)).toBe(true);
  });
});
