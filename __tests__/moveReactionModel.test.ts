/**
 * QOL-041 — Move-reactions (fist-bump) pure-model tests.
 *
 * Per QOL-041 design §10 test plan:
 *   - summarizeReactions counts only non-removed rows
 *   - viewerHasReacted is per-user
 *   - the model exposes NO score
 *   - the enum has EXACTLY ONE value (`fist_bump`) — structural ban
 *     on becoming a voting system
 *
 * Pure TS. No React. No Supabase.
 */
import {
  ALL_MOVE_REACTION_KINDS,
  summarizeReactions,
  type MoveReactionRow,
} from '../src/features/concessions/moveReactionModel';

// ── Vocabulary — the structural one-value enum ────────────────

describe('ALL_MOVE_REACTION_KINDS — the v1 vocabulary', () => {
  it('contains exactly ONE value (`fist_bump`)', () => {
    // This is the structural guard that prevents the table from
    // becoming a voting system in this card. Adding a value requires a
    // NEW migration AND a doctrine review.
    expect(ALL_MOVE_REACTION_KINDS).toHaveLength(1);
    expect(ALL_MOVE_REACTION_KINDS[0]).toBe('fist_bump');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ALL_MOVE_REACTION_KINDS)).toBe(true);
  });
});

// ── summarizeReactions ─────────────────────────────────────────

const ACTIVE = (reactorId: string): MoveReactionRow => ({
  kind: 'fist_bump',
  reactorId,
  removedAt: null,
});

const SOFT_DELETED = (reactorId: string, removedAt: string): MoveReactionRow => ({
  kind: 'fist_bump',
  reactorId,
  removedAt,
});

describe('summarizeReactions — render-only summary', () => {
  it('empty rows → zero count, viewer false', () => {
    const s = summarizeReactions([], 'viewer-1');
    expect(s).toEqual({ fistBumpCount: 0, viewerHasReacted: false });
  });

  it('counts active rows only — ignores soft-deleted', () => {
    const s = summarizeReactions(
      [
        ACTIVE('u1'),
        ACTIVE('u2'),
        SOFT_DELETED('u3', '2026-01-01T00:00:00Z'),
      ],
      'u4',
    );
    expect(s.fistBumpCount).toBe(2);
    expect(s.viewerHasReacted).toBe(false);
  });

  it('viewerHasReacted true when the viewer has an active row', () => {
    const s = summarizeReactions([ACTIVE('u1'), ACTIVE('viewer')], 'viewer');
    expect(s.fistBumpCount).toBe(2);
    expect(s.viewerHasReacted).toBe(true);
  });

  it('viewerHasReacted false when the viewer only has a soft-deleted row', () => {
    const s = summarizeReactions(
      [ACTIVE('u1'), SOFT_DELETED('viewer', '2026-01-01T00:00:00Z')],
      'viewer',
    );
    expect(s.viewerHasReacted).toBe(false);
    expect(s.fistBumpCount).toBe(1);
  });

  it('viewerId = null → viewerHasReacted always false', () => {
    const s = summarizeReactions([ACTIVE('u1')], null);
    expect(s.viewerHasReacted).toBe(false);
    expect(s.fistBumpCount).toBe(1);
  });

  it('ignores rows whose kind is not fist_bump (defensive)', () => {
    const rows: MoveReactionRow[] = [
      ACTIVE('u1'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { kind: 'thumbs_up' as any, reactorId: 'u2', removedAt: null },
    ];
    const s = summarizeReactions(rows, 'u1');
    expect(s.fistBumpCount).toBe(1);
  });

  it('the summary shape is EXACTLY { fistBumpCount, viewerHasReacted } — no score', () => {
    const s = summarizeReactions([ACTIVE('u1')], 'viewer');
    expect(Object.keys(s).sort()).toEqual(['fistBumpCount', 'viewerHasReacted']);
    // No score, no standing, no weight, no percentage. The shape itself
    // guarantees the reaction never crosses into scoring.
  });
});
