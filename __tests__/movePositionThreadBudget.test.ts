/**
 * MCP-MOD-008 — Token budget handling for the full-thread context.
 *
 * Exercises three regimes for the prior-moves payload trimmer:
 *
 *   1. UNDER budget → all prior moves included in chronological order.
 *   2. JUST OVER budget → drop the OLDEST prior moves first until under
 *      budget. The newest moves survive.
 *   3. WAY OVER budget → prior moves array is empty; the caller proceeds with
 *      the pre-MCP-MOD-008 payload shape (move + parent only). The hook does
 *      NOT skip the call; this card is about graceful degradation, not
 *      gating.
 *
 * Tests target the pure helpers (`assemblePriorMovesPayload` +
 * `isWithinBudget`). They never touch React, never call `classifyMove`, never
 * hit Supabase. The hook integration test is separate.
 */
import {
  isWithinBudget,
  estimatePacketTokens,
  SEMANTIC_PACKET_TOKEN_BUDGET,
  PER_PRIOR_MOVE_SCAFFOLD_CHARS,
} from '../src/features/semanticReferee/tokenBudget';
import {
  assemblePriorMovesPayload,
  buildAuthorAliasMap,
} from '../src/features/semanticReferee/threadContext';

function makeAliases(authorIds: string[]): ReadonlyMap<string, string> {
  return buildAuthorAliasMap(
    authorIds.map((authorId, i) => ({ authorId, id: `m-${i}` })),
    null,
  );
}

describe('MCP-MOD-008 isWithinBudget — accounts for prior-move bytes', () => {
  it('estimates more tokens when prior moves are present', () => {
    const without = estimatePacketTokens({
      moveBodyRedacted: 'A short move body.',
      parentBodyRedacted: 'A short parent body.',
      requestedClassifiers: ['responds_to_parent'],
    });
    const withPrior = estimatePacketTokens({
      moveBodyRedacted: 'A short move body.',
      parentBodyRedacted: 'A short parent body.',
      requestedClassifiers: ['responds_to_parent'],
      priorMoveBodies: ['One prior move body.', 'Another prior move body.'],
    });
    expect(withPrior).toBeGreaterThan(without);
  });

  it('the per-prior-move scaffold overhead is small but positive', () => {
    expect(PER_PRIOR_MOVE_SCAFFOLD_CHARS).toBeGreaterThan(0);
    expect(PER_PRIOR_MOVE_SCAFFOLD_CHARS).toBeLessThan(64);
  });

  it('accepts an empty priorMoveBodies array as equivalent to absent', () => {
    const absent = estimatePacketTokens({
      moveBodyRedacted: 'A short move body.',
      requestedClassifiers: ['responds_to_parent'],
    });
    const empty = estimatePacketTokens({
      moveBodyRedacted: 'A short move body.',
      requestedClassifiers: ['responds_to_parent'],
      priorMoveBodies: [],
    });
    expect(empty).toBe(absent);
  });
});

describe('MCP-MOD-008 assemblePriorMovesPayload — under budget', () => {
  it('includes every prior move in chronological order when well under budget', () => {
    const priorMoves = [
      { id: 'm-1', authorId: 'user-A', body: 'Move 1 body.' },
      { id: 'm-2', authorId: 'user-B', body: 'Move 2 body.' },
      { id: 'm-3', authorId: 'user-A', body: 'Move 3 body.' },
    ];
    const aliases = makeAliases(['user-A', 'user-B']);
    const out = assemblePriorMovesPayload({
      priorMoves,
      authorAliases: aliases,
      moveBodyRedacted: 'Current move.',
      parentBodyRedacted: 'Parent move.',
      requestedClassifiers: ['responds_to_parent'],
    });
    expect(out).toHaveLength(3);
    expect(out[0].bodyRedacted).toBe('Move 1 body.');
    expect(out[1].bodyRedacted).toBe('Move 2 body.');
    expect(out[2].bodyRedacted).toBe('Move 3 body.');
    expect(out[0].authorAlias).toBe('A');
    expect(out[1].authorAlias).toBe('B');
    expect(out[2].authorAlias).toBe('A');
  });

  it('preserves the chronological order of the input', () => {
    const priorMoves = [
      { id: 'm-1', authorId: 'user-A', body: 'oldest' },
      { id: 'm-2', authorId: 'user-A', body: 'middle' },
      { id: 'm-3', authorId: 'user-A', body: 'newest' },
    ];
    const aliases = makeAliases(['user-A']);
    const out = assemblePriorMovesPayload({
      priorMoves,
      authorAliases: aliases,
      moveBodyRedacted: 'Current.',
      parentBodyRedacted: undefined,
      requestedClassifiers: ['responds_to_parent'],
    });
    expect(out.map((m) => m.bodyRedacted)).toEqual(['oldest', 'middle', 'newest']);
  });
});

describe('MCP-MOD-008 assemblePriorMovesPayload — just over budget', () => {
  it('drops the OLDEST prior moves first until the payload fits', () => {
    // Each prior-move body is ~1500 chars; the per-call budget is 1500 tokens.
    // Two prior moves of 1500 chars each will overflow; the newest one
    // survives, the oldest one is dropped.
    const longBody = 'x'.repeat(1500);
    const priorMoves = [
      { id: 'm-1', authorId: 'user-A', body: `${longBody}_oldest` },
      { id: 'm-2', authorId: 'user-A', body: `${longBody}_middle` },
      { id: 'm-3', authorId: 'user-A', body: `${longBody}_newest` },
    ];
    const aliases = makeAliases(['user-A']);
    const out = assemblePriorMovesPayload({
      priorMoves,
      authorAliases: aliases,
      moveBodyRedacted: 'A short move body.',
      parentBodyRedacted: 'A short parent body.',
      requestedClassifiers: ['responds_to_parent'],
    });
    // Some entries must have been dropped (we tightly designed inputs to
    // exceed the budget).
    expect(out.length).toBeLessThan(priorMoves.length);
    // The surviving entries are the NEWEST ones — the trimmer dropped from
    // the FRONT (oldest first).
    if (out.length > 0) {
      expect(out[out.length - 1].bodyRedacted.endsWith('_newest')).toBe(true);
      // The oldest is never first in the surviving set.
      for (const entry of out) {
        expect(entry.bodyRedacted.endsWith('_oldest')).toBe(false);
      }
    }
    // The surviving payload + move + parent must fit the budget.
    const verdict = isWithinBudget({
      moveBodyRedacted: 'A short move body.',
      parentBodyRedacted: 'A short parent body.',
      requestedClassifiers: ['responds_to_parent'],
      priorMoveBodies: out.map((m) => m.bodyRedacted),
    });
    expect(verdict.ok).toBe(true);
  });

  it('drops only as many entries as needed (preserves as much context as possible)', () => {
    // One huge oldest + one short newest. With a budget of 1500 tokens, the
    // huge body alone overflows; the short one survives. We size the huge
    // body so it is unambiguously too large.
    const longBody = 'x'.repeat(6000);
    const shortBody = 'short prior';
    const priorMoves = [
      { id: 'm-1', authorId: 'user-A', body: longBody },
      { id: 'm-2', authorId: 'user-A', body: shortBody },
    ];
    const aliases = makeAliases(['user-A']);
    const out = assemblePriorMovesPayload({
      priorMoves,
      authorAliases: aliases,
      moveBodyRedacted: 'A short move body.',
      parentBodyRedacted: 'A short parent body.',
      requestedClassifiers: ['responds_to_parent'],
    });
    // The huge oldest entry should have been dropped; the short newest one survives.
    expect(out.length).toBe(1);
    expect(out[0].bodyRedacted).toBe(shortBody);
  });
});

describe('MCP-MOD-008 assemblePriorMovesPayload — way over budget', () => {
  it('returns an empty array when even the move + parent alone overflow', () => {
    // A single, gigantic move body alone overflows the budget. The trimmer
    // returns []; the caller proceeds with the pre-MCP-MOD-008 payload shape.
    const giganticBody = 'x'.repeat(20_000);
    const priorMoves = [
      { id: 'm-1', authorId: 'user-A', body: giganticBody },
    ];
    const aliases = makeAliases(['user-A']);
    const out = assemblePriorMovesPayload({
      priorMoves,
      authorAliases: aliases,
      // The move alone is already way over budget — there is no room for any
      // prior-move bytes.
      moveBodyRedacted: 'x'.repeat(SEMANTIC_PACKET_TOKEN_BUDGET * 4),
      parentBodyRedacted: undefined,
      requestedClassifiers: ['responds_to_parent'],
    });
    expect(out).toEqual([]);
  });

  it('payload identical to pre-refactor shape when the array is fully trimmed', () => {
    // When the trimmer returns [], the hook simply omits priorMovesRedacted —
    // the request shape collapses to the pre-MCP-MOD-008 shape. This test
    // confirms the helper returns the empty array (the hook applies the
    // omission decision).
    const out = assemblePriorMovesPayload({
      priorMoves: [
        { id: 'm-1', authorId: 'user-A', body: 'x'.repeat(20_000) },
      ],
      authorAliases: makeAliases(['user-A']),
      moveBodyRedacted: 'x'.repeat(SEMANTIC_PACKET_TOKEN_BUDGET * 4),
      parentBodyRedacted: undefined,
      requestedClassifiers: ['responds_to_parent'],
    });
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(0);
  });
});

describe('MCP-MOD-008 assemblePriorMovesPayload — defensive paths', () => {
  it('drops entries whose author has no alias in the map', () => {
    const priorMoves = [
      { id: 'm-1', authorId: 'user-A', body: 'A body' },
      { id: 'm-2', authorId: 'user-Z', body: 'Z body' }, // not in alias map
    ];
    const aliases = makeAliases(['user-A']);
    const out = assemblePriorMovesPayload({
      priorMoves,
      authorAliases: aliases,
      moveBodyRedacted: 'Current.',
      parentBodyRedacted: undefined,
      requestedClassifiers: ['responds_to_parent'],
    });
    expect(out).toHaveLength(1);
    expect(out[0].authorAlias).toBe('A');
  });

  it('returns [] when input is empty', () => {
    const out = assemblePriorMovesPayload({
      priorMoves: [],
      authorAliases: new Map(),
      moveBodyRedacted: 'Current.',
      parentBodyRedacted: undefined,
      requestedClassifiers: ['responds_to_parent'],
    });
    expect(out).toEqual([]);
  });
});
