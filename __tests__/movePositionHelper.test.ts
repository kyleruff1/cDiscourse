/**
 * MCP-MOD-007 — Move-position tracking helper tests.
 *
 * Pins the contract of `getMovePositionForAuthor`: pure counting of how many
 * entries in `priorMoves` share the input's `authorId`. The helper is not yet
 * wired into any caller (MCP-MOD-008 will consume it), so these tests are the
 * sole behaviour pin in this card.
 *
 * The helper must NEVER produce a verdict, a winner / loser label, or any
 * truth value — it only counts. These tests do not exercise any UI surface,
 * so a ban-list test is not in scope here.
 */

import {
  getMovePositionForAuthor,
  type MovePositionInput,
} from '../src/features/semanticReferee/movePosition';

describe('MCP-MOD-007 getMovePositionForAuthor — core counting contract', () => {
  it('returns first when no prior move is by the author', () => {
    const input: MovePositionInput = {
      moveId: 'm-5',
      authorId: 'A',
      priorMoves: [
        { id: 'm-1', authorId: 'B' },
        { id: 'm-2', authorId: 'C' },
      ],
    };
    expect(getMovePositionForAuthor(input)).toBe('first');
  });

  it('returns second when the author has exactly one prior move', () => {
    const input: MovePositionInput = {
      moveId: 'm-5',
      authorId: 'A',
      priorMoves: [
        { id: 'm-1', authorId: 'A' },
        { id: 'm-2', authorId: 'B' },
      ],
    };
    expect(getMovePositionForAuthor(input)).toBe('second');
  });

  it('returns later when the author has two prior moves', () => {
    const input: MovePositionInput = {
      moveId: 'm-5',
      authorId: 'A',
      priorMoves: [
        { id: 'm-1', authorId: 'A' },
        { id: 'm-2', authorId: 'B' },
        { id: 'm-3', authorId: 'A' },
      ],
    };
    expect(getMovePositionForAuthor(input)).toBe('later');
  });

  it('returns later when the author has many prior moves', () => {
    const input: MovePositionInput = {
      moveId: 'm-100',
      authorId: 'A',
      priorMoves: [
        { id: 'm-1', authorId: 'A' },
        { id: 'm-2', authorId: 'A' },
        { id: 'm-3', authorId: 'A' },
        { id: 'm-4', authorId: 'A' },
        { id: 'm-5', authorId: 'A' },
        { id: 'm-6', authorId: 'A' },
        { id: 'm-7', authorId: 'A' },
      ],
    };
    expect(getMovePositionForAuthor(input)).toBe('later');
  });

  it('ignores moves by other authors when counting', () => {
    const input: MovePositionInput = {
      moveId: 'm-10',
      authorId: 'A',
      priorMoves: [
        { id: 'm-1', authorId: 'B' },
        { id: 'm-2', authorId: 'B' },
        { id: 'm-3', authorId: 'C' },
        { id: 'm-4', authorId: 'B' },
        { id: 'm-5', authorId: 'A' },
        { id: 'm-6', authorId: 'C' },
        { id: 'm-7', authorId: 'B' },
      ],
    };
    // Only one prior move by A despite many other moves by B and C → 'second'.
    expect(getMovePositionForAuthor(input)).toBe('second');
  });

  it('returns first for an empty priorMoves array', () => {
    const input: MovePositionInput = {
      moveId: 'm-1',
      authorId: 'A',
      priorMoves: [],
    };
    expect(getMovePositionForAuthor(input)).toBe('first');
  });

  it('counts authors not ids — a moveId accidentally present in priorMoves still classifies by authorship', () => {
    // The caller is responsible for not including the move under classification in priorMoves;
    // the helper only counts authors. Here, the moveId 'm-3' is (accidentally) in priorMoves and
    // also names the move under classification — the helper sees ONE prior move by author 'A',
    // which is the truthful answer to "how many moves in priorMoves are by 'A'?".
    const input: MovePositionInput = {
      moveId: 'm-3',
      authorId: 'A',
      priorMoves: [
        { id: 'm-1', authorId: 'B' },
        { id: 'm-2', authorId: 'C' },
        { id: 'm-3', authorId: 'A' },
      ],
    };
    expect(getMovePositionForAuthor(input)).toBe('second');
  });
});

describe('MCP-MOD-007 getMovePositionForAuthor — scenario cases', () => {
  it('first move by initiator (root): empty priorMoves → first', () => {
    const input: MovePositionInput = {
      moveId: 'root',
      authorId: 'A',
      priorMoves: [],
    };
    expect(getMovePositionForAuthor(input)).toBe('first');
  });

  it('first move by opponent: priorMoves has one move by A, opponent B is first → first', () => {
    const input: MovePositionInput = {
      moveId: 'm-2',
      authorId: 'B',
      priorMoves: [{ id: 'root', authorId: 'A' }],
    };
    expect(getMovePositionForAuthor(input)).toBe('first');
  });

  it('second move by initiator: priorMoves has root by A and reply by B, A posts again → second', () => {
    const input: MovePositionInput = {
      moveId: 'm-3',
      authorId: 'A',
      priorMoves: [
        { id: 'root', authorId: 'A' },
        { id: 'm-2', authorId: 'B' },
      ],
    };
    expect(getMovePositionForAuthor(input)).toBe('second');
  });

  it('first move by a chime-in who joins after 5 moves by primary participants → first', () => {
    const input: MovePositionInput = {
      moveId: 'm-6',
      authorId: 'C',
      priorMoves: [
        { id: 'root', authorId: 'A' },
        { id: 'm-2', authorId: 'B' },
        { id: 'm-3', authorId: 'A' },
        { id: 'm-4', authorId: 'B' },
        { id: 'm-5', authorId: 'A' },
      ],
    };
    expect(getMovePositionForAuthor(input)).toBe('first');
  });

  it('author with zero prior moves in a thread of 20 moves by others → first', () => {
    const priorMoves: ReadonlyArray<{ id: string; authorId: string }> = Array.from(
      { length: 20 },
      (_, i) => ({ id: `m-${i + 1}`, authorId: i % 2 === 0 ? 'A' : 'B' }),
    );
    const input: MovePositionInput = {
      moveId: 'm-21',
      authorId: 'C',
      priorMoves,
    };
    expect(getMovePositionForAuthor(input)).toBe('first');
  });
});
