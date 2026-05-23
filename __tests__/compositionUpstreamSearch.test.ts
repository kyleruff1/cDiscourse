/**
 * COMP-001 §11 R-1 — `findUpstreamMove` helper tests.
 *
 * Covers the design's named edge cases for the upstream-search helper:
 *   - empty / undefined chains
 *   - deleted ancestors
 *   - missing parentIds
 *   - very-deep chains
 *   - same-author / different-author / axis-filtered convenience wrappers
 */

import {
  findUpstreamBySameAuthor,
  findUpstreamByDifferentAuthor,
  findUpstreamMove,
} from '../src/features/semanticReferee/compositionUpstreamSearch';
import type { AncestorMoveSummary } from '../src/features/semanticReferee/compositionTypes';

function a(moveId: string, authorId: string, axis?: string): AncestorMoveSummary {
  return {
    moveId,
    parentId: null,
    authorId,
    disagreementAxis: axis ?? null,
  };
}

describe('COMP-001 findUpstreamMove — edge cases', () => {
  it('returns null on an undefined chain', () => {
    expect(findUpstreamMove(undefined, () => true)).toBeNull();
  });

  it('returns null on an empty chain', () => {
    expect(findUpstreamMove([], () => true)).toBeNull();
  });

  it('returns the most-recent match (immediate parent first)', () => {
    const chain = [a('m1', 'A'), a('m2', 'B'), a('m3', 'A'), a('m4', 'B')];
    const match = findUpstreamMove(chain, (anc) => anc.authorId === 'A');
    expect(match?.moveId).toBe('m3');
  });

  it('returns null when no match exists', () => {
    const chain = [a('m1', 'A'), a('m2', 'A')];
    expect(findUpstreamMove(chain, (anc) => anc.authorId === 'Z')).toBeNull();
  });

  it('passes a 0-based indexFromImmediateParent to the predicate', () => {
    const chain = [a('m1', 'A'), a('m2', 'B'), a('m3', 'A')];
    const seen: number[] = [];
    findUpstreamMove(chain, (_anc, idx) => {
      seen.push(idx);
      return false;
    });
    expect(seen).toEqual([0, 1, 2]);
  });

  it('handles very-deep chains without recursion-related issues', () => {
    const chain: AncestorMoveSummary[] = [];
    for (let i = 0; i < 1000; i += 1) {
      chain.push(a(`m${i}`, i % 2 === 0 ? 'A' : 'B'));
    }
    const match = findUpstreamMove(chain, (anc) => anc.moveId === 'm0');
    expect(match?.moveId).toBe('m0');
    expect(match?.matchedAtIndex).toBe(0);
  });
});

describe('COMP-001 findUpstreamBySameAuthor', () => {
  it('finds the most-recent ancestor with matching authorId', () => {
    const chain = [a('m1', 'A'), a('m2', 'B'), a('m3', 'A'), a('m4', 'B')];
    expect(findUpstreamBySameAuthor(chain, 'A')?.moveId).toBe('m3');
  });

  it('returns null when no same-author ancestor exists', () => {
    const chain = [a('m1', 'A'), a('m2', 'A')];
    expect(findUpstreamBySameAuthor(chain, 'Z')).toBeNull();
  });
});

describe('COMP-001 findUpstreamByDifferentAuthor', () => {
  it('finds the most-recent ancestor authored by someone else', () => {
    const chain = [a('m1', 'A'), a('m2', 'B'), a('m3', 'A')];
    expect(findUpstreamByDifferentAuthor(chain, 'A')?.moveId).toBe('m2');
  });

  it('applies an axis filter when supplied — picks the most-recent author!=current with matching axis', () => {
    const chain = [
      a('m1', 'A', 'evidence'),
      a('m2', 'B', 'definition'),
      a('m3', 'A', 'evidence'),
    ];
    // current author = B, axis = evidence → m3 (most-recent A, axis matches).
    expect(findUpstreamByDifferentAuthor(chain, 'B', 'evidence')?.moveId).toBe('m3');
  });

  it('axis filter excludes ancestors whose axis does not match even when author differs', () => {
    const chain = [
      a('m1', 'A', 'evidence'),
      a('m2', 'A', 'definition'),
    ];
    // current = B, axis = evidence → m1 matches; m2's axis is wrong.
    expect(findUpstreamByDifferentAuthor(chain, 'B', 'evidence')?.moveId).toBe('m1');
  });

  it('returns null when no different-author ancestor matches', () => {
    const chain = [a('m1', 'A')];
    expect(findUpstreamByDifferentAuthor(chain, 'A')).toBeNull();
  });
});
