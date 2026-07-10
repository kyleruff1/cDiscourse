/**
 * INTEL-001 (#900) — dodge-chain chain-rule matrix.
 *
 * A dodge-chain is a maximal run of >= 2 CONSECUTIVE unaddressed moves on one
 * thread. The feed uses deduped node count + longest length (never a sum, never
 * a person).
 */
import {
  deriveDodgeChains,
  MIN_DODGE_CHAIN_LENGTH,
  type DodgeChainNodeInput,
} from '../src/features/intel/dodgeChainModel';

function n(id: string, parentId: string | null): DodgeChainNodeInput {
  return { id, parentId };
}

describe('INTEL-001 — deriveDodgeChains', () => {
  it('MIN_DODGE_CHAIN_LENGTH is 2 (a single dodge is not a chain)', () => {
    expect(MIN_DODGE_CHAIN_LENGTH).toBe(2);
  });

  it('empty unaddressed set => total zero', () => {
    const out = deriveDodgeChains({ unaddressedMoveIds: [], nodes: [n('a', null)] });
    expect(out).toEqual({
      chains: [],
      unaddressedChainNodeCount: 0,
      longestChainLength: 0,
      chainCount: 0,
    });
  });

  it('one isolated unaddressed move (no unaddressed parent/child) => no chain', () => {
    const out = deriveDodgeChains({
      unaddressedMoveIds: ['b'],
      nodes: [n('a', null), n('b', 'a'), n('c', 'b')],
    });
    expect(out.chainCount).toBe(0);
    expect(out.unaddressedChainNodeCount).toBe(0);
  });

  it('two consecutive unaddressed => one chain of length 2', () => {
    const out = deriveDodgeChains({
      unaddressedMoveIds: ['a', 'b'],
      nodes: [n('a', null), n('b', 'a')],
    });
    expect(out.chainCount).toBe(1);
    expect(out.chains[0].memberArgumentIds).toEqual(['a', 'b']);
    expect(out.chains[0].anchorArgumentId).toBe('a');
    expect(out.chains[0].length).toBe(2);
    expect(out.longestChainLength).toBe(2);
    expect(out.unaddressedChainNodeCount).toBe(2);
  });

  it('three consecutive unaddressed => one chain of length 3', () => {
    const out = deriveDodgeChains({
      unaddressedMoveIds: ['a', 'b', 'c'],
      nodes: [n('a', null), n('b', 'a'), n('c', 'b')],
    });
    expect(out.chainCount).toBe(1);
    expect(out.chains[0].memberArgumentIds).toEqual(['a', 'b', 'c']);
    expect(out.longestChainLength).toBe(3);
  });

  it('branch fan-out => two chains sharing the head; node count deduped', () => {
    const out = deriveDodgeChains({
      unaddressedMoveIds: ['a', 'b', 'c'],
      nodes: [n('a', null), n('b', 'a'), n('c', 'a')],
    });
    expect(out.chainCount).toBe(2);
    expect(out.chains.map((c) => c.memberArgumentIds)).toEqual([
      ['a', 'b'],
      ['a', 'c'],
    ]);
    // head 'a' counted once (deduped): {a, b, c} => 3, NOT 4.
    expect(out.unaddressedChainNodeCount).toBe(3);
    expect(out.longestChainLength).toBe(2);
  });

  it('an unaddressed id absent from the tree is ignored', () => {
    const out = deriveDodgeChains({
      unaddressedMoveIds: ['a', 'b', 'ghost'],
      nodes: [n('a', null), n('b', 'a')],
    });
    expect(out.chains[0].memberArgumentIds).toEqual(['a', 'b']);
    expect(out.unaddressedChainNodeCount).toBe(2);
  });

  it('a parentId pointing outside the node set is treated as a head', () => {
    const out = deriveDodgeChains({
      unaddressedMoveIds: ['b', 'c'],
      nodes: [n('b', 'outside'), n('c', 'b')],
    });
    expect(out.chainCount).toBe(1);
    expect(out.chains[0].anchorArgumentId).toBe('b');
  });

  it('a malformed parent cycle does not loop (guard caps traversal)', () => {
    const out = deriveDodgeChains({
      unaddressedMoveIds: ['a', 'b'],
      nodes: [n('a', 'b'), n('b', 'a')],
    });
    // Both point at each other; neither has a parent OUTSIDE U, so no head is
    // emitted and the walk terminates without looping.
    expect(Array.isArray(out.chains)).toBe(true);
    expect(out.chainCount).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic under shuffled input', () => {
    const nodes = [n('a', null), n('b', 'a'), n('c', 'b'), n('d', 'a')];
    const ids = ['a', 'b', 'c', 'd'];
    const base = deriveDodgeChains({ unaddressedMoveIds: ids, nodes });
    const shuffled = deriveDodgeChains({
      unaddressedMoveIds: [...ids].reverse(),
      nodes: [...nodes].reverse(),
    });
    expect(shuffled).toEqual(base);
  });

  it('output carries no score / delta / weight field', () => {
    const out = deriveDodgeChains({
      unaddressedMoveIds: ['a', 'b'],
      nodes: [n('a', null), n('b', 'a')],
    });
    const keys = Object.keys(out);
    expect(keys).not.toContain('score');
    expect(keys).not.toContain('delta');
    expect(keys).not.toContain('weight');
    expect(keys).not.toContain('standing');
    for (const c of out.chains) {
      expect(Object.keys(c)).not.toContain('score');
    }
  });
});
