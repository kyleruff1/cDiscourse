/**
 * SETTLE-001 (#911) — settleRoomModel actor + status matrix.
 *
 * Pure-model coverage of canSettleRoom / canReopenRoom / buildSettleConsequences.
 * Settling is a ROOM LIFECYCLE transition, never a verdict — the creator gate
 * keys on createdByUserId (the RLS UPDATE column), never a participant side.
 */
import {
  canSettleRoom,
  canReopenRoom,
  buildSettleConsequences,
  ROOM_SETTLE_COPY,
  ALL_SETTLE_MODES,
  ALL_SETTLE_REASONS,
  ALL_SETTLE_CONSEQUENCES,
  type SettleContext,
} from '../src/features/debates/settleRoomModel';
import type { DebateStatus } from '../src/features/debates/types';

const CREATOR = 'creator-1';
const OTHER = 'someone-else';

function ctx(overrides: Partial<SettleContext> = {}): SettleContext {
  return {
    roomId: 'room-1',
    roomStatus: 'open',
    callerUserId: CREATOR,
    createdByUserId: CREATOR,
    ...overrides,
  };
}

const ALL_STATUSES: ReadonlyArray<DebateStatus> = ['draft', 'open', 'locked', 'archived'];

describe('canSettleRoom — actor + status matrix', () => {
  it('creator on an open room is allowed (eligible)', () => {
    expect(canSettleRoom(ctx({ roomStatus: 'open' }))).toEqual({
      allowed: true,
      reason: 'eligible',
    });
  });

  it.each(['draft', 'locked', 'archived'] as DebateStatus[])(
    'creator on a %s room is not_open (settle requires open)',
    (roomStatus) => {
      expect(canSettleRoom(ctx({ roomStatus }))).toEqual({
        allowed: false,
        reason: 'not_open',
      });
    },
  );

  it.each(ALL_STATUSES)(
    'a non-creator is never allowed to settle (status=%s) — not_room_creator',
    (roomStatus) => {
      const result = canSettleRoom(ctx({ roomStatus, callerUserId: OTHER }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('not_room_creator');
    },
  );

  it('non-creator gate wins even on an open room (never leaks not_open)', () => {
    expect(canSettleRoom(ctx({ roomStatus: 'open', callerUserId: OTHER }))).toEqual({
      allowed: false,
      reason: 'not_room_creator',
    });
  });
});

describe('canReopenRoom — actor + status matrix', () => {
  it('creator on a locked room is allowed (eligible)', () => {
    expect(canReopenRoom(ctx({ roomStatus: 'locked' }))).toEqual({
      allowed: true,
      reason: 'eligible',
    });
  });

  it.each(['draft', 'open', 'archived'] as DebateStatus[])(
    'creator on a %s room is not_locked (reopen requires locked)',
    (roomStatus) => {
      expect(canReopenRoom(ctx({ roomStatus }))).toEqual({
        allowed: false,
        reason: 'not_locked',
      });
    },
  );

  it.each(ALL_STATUSES)(
    'a non-creator is never allowed to reopen (status=%s) — not_room_creator',
    (roomStatus) => {
      const result = canReopenRoom(ctx({ roomStatus, callerUserId: OTHER }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('not_room_creator');
    },
  );
});

describe('canSettleRoom / canReopenRoom — mutually exclusive by status', () => {
  it('an open room is settle-eligible but not reopen-eligible', () => {
    expect(canSettleRoom(ctx({ roomStatus: 'open' })).allowed).toBe(true);
    expect(canReopenRoom(ctx({ roomStatus: 'open' })).allowed).toBe(false);
  });

  it('a locked room is reopen-eligible but not settle-eligible', () => {
    expect(canReopenRoom(ctx({ roomStatus: 'locked' })).allowed).toBe(true);
    expect(canSettleRoom(ctx({ roomStatus: 'locked' })).allowed).toBe(false);
  });
});

describe('buildSettleConsequences', () => {
  it('settle mode returns the exact fixed effect list (incl. no_new_joiners per R3)', () => {
    const result = buildSettleConsequences('settle');
    expect(result.mode).toBe('settle');
    expect(result.effects).toEqual([
      'no_new_moves',
      'no_new_joiners',
      'stays_readable',
      'becomes_linkable',
      'reversible',
    ]);
  });

  it('reopen mode returns the exact fixed effect list (incl. existing_links_kept)', () => {
    const result = buildSettleConsequences('reopen');
    expect(result.mode).toBe('reopen');
    expect(result.effects).toEqual([
      'new_moves_allowed',
      'content_unchanged',
      'existing_links_kept',
    ]);
  });

  it('every produced effect code is a known SettleConsequence', () => {
    for (const mode of ALL_SETTLE_MODES) {
      for (const effect of buildSettleConsequences(mode).effects) {
        expect(ALL_SETTLE_CONSEQUENCES).toContain(effect);
      }
    }
  });

  it('settle and reopen effect lists are disjoint (no shared code)', () => {
    const settle = new Set(buildSettleConsequences('settle').effects);
    const reopen = buildSettleConsequences('reopen').effects;
    for (const code of reopen) {
      expect(settle.has(code)).toBe(false);
    }
  });
});

describe('SETTLE-001 — constant surfaces', () => {
  it('ALL_SETTLE_MODES is exactly settle + reopen', () => {
    expect([...ALL_SETTLE_MODES]).toEqual(['settle', 'reopen']);
  });

  it('ALL_SETTLE_REASONS enumerates every reason code', () => {
    expect([...ALL_SETTLE_REASONS]).toEqual([
      'eligible',
      'not_room_creator',
      'not_open',
      'not_locked',
    ]);
  });

  it('ROOM_SETTLE_COPY is re-exported from the model (model-scoped convenience)', () => {
    expect(typeof ROOM_SETTLE_COPY.action_settle_label).toBe('string');
    expect(ROOM_SETTLE_COPY.action_settle_label.length).toBeGreaterThan(0);
  });

  it('every settle-mode effect code has a non-empty ROOM_SETTLE_COPY bullet', () => {
    const copyByCode: Record<string, string> = {
      no_new_moves: ROOM_SETTLE_COPY.effect_no_new_moves,
      no_new_joiners: ROOM_SETTLE_COPY.effect_no_new_joiners,
      stays_readable: ROOM_SETTLE_COPY.effect_stays_readable,
      becomes_linkable: ROOM_SETTLE_COPY.effect_becomes_linkable,
      reversible: ROOM_SETTLE_COPY.effect_reversible,
      new_moves_allowed: ROOM_SETTLE_COPY.effect_new_moves_allowed,
      content_unchanged: ROOM_SETTLE_COPY.effect_content_unchanged,
      existing_links_kept: ROOM_SETTLE_COPY.effect_existing_links_kept,
    };
    for (const code of ALL_SETTLE_CONSEQUENCES) {
      expect(typeof copyByCode[code]).toBe('string');
      expect(copyByCode[code].length).toBeGreaterThan(0);
    }
  });
});
