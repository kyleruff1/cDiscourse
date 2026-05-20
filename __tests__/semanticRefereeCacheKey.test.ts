/**
 * MCP-011 — Semantic referee cache-key tests.
 *
 * Proves the cache key is order-normalized, total, stable, and invalidates on
 * a change to any component.
 */

import {
  buildSemanticCacheKey,
  serializeSemanticCacheKey,
  hashClassifierSet,
} from '../src/features/semanticReferee/semanticRefereeCacheKey';
import type { SemanticCacheKeyInput } from '../src/features/semanticReferee/semanticRefereeCacheKey';

function baseInput(): SemanticCacheKeyInput {
  return {
    roomId: 'room-1',
    parentId: 'parent-1',
    contentHash: 'content-1',
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    classifierIds: ['responds_to_parent', 'narrows_claim'],
    roomMode: 'casual',
    selectedAction: 'reply',
  };
}

function serialize(input: SemanticCacheKeyInput): string {
  return serializeSemanticCacheKey(buildSemanticCacheKey(input));
}

describe('MCP-011 hashClassifierSet', () => {
  it('is deterministic across calls', () => {
    expect(hashClassifierSet(['a', 'b', 'c'])).toBe(hashClassifierSet(['a', 'b', 'c']));
  });

  it('order-normalizes — [a,b] and [b,a] hash identically', () => {
    expect(hashClassifierSet(['a', 'b'])).toBe(hashClassifierSet(['b', 'a']));
  });

  it('dedupes — [a,a,b] and [a,b] hash identically', () => {
    expect(hashClassifierSet(['a', 'a', 'b'])).toBe(hashClassifierSet(['a', 'b']));
  });

  it("['ab'] and ['a','b'] do not collide", () => {
    expect(hashClassifierSet(['ab'])).not.toBe(hashClassifierSet(['a', 'b']));
  });

  it('the empty list hashes to a stable sentinel', () => {
    expect(hashClassifierSet([])).toBe(hashClassifierSet([]));
  });

  it('returns a fixed-width lowercase hex string', () => {
    expect(hashClassifierSet(['responds_to_parent'])).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('MCP-011 buildSemanticCacheKey', () => {
  it('order-normalizes the classifier set (fixture 17 case)', () => {
    const a = buildSemanticCacheKey({
      ...baseInput(),
      classifierIds: ['responds_to_parent', 'narrows_claim'],
    });
    const b = buildSemanticCacheKey({
      ...baseInput(),
      classifierIds: ['narrows_claim', 'responds_to_parent'],
    });
    expect(a.classifierSetHash).toBe(b.classifierSetHash);
  });

  it('dedupes the classifier set', () => {
    const a = buildSemanticCacheKey({
      ...baseInput(),
      classifierIds: ['narrows_claim', 'narrows_claim', 'responds_to_parent'],
    });
    const b = buildSemanticCacheKey({
      ...baseInput(),
      classifierIds: ['responds_to_parent', 'narrows_claim'],
    });
    expect(a.classifierSetHash).toBe(b.classifierSetHash);
  });

  it('applies the empty-string sentinel for an absent parentId (root move)', () => {
    const key = buildSemanticCacheKey({
      roomId: 'room-1',
      contentHash: 'content-1',
      promptVersion: 'v0',
      classifierIds: ['responds_to_parent'],
    });
    expect(key.parentId).toBe('');
    expect(key.roomMode).toBe('');
    expect(key.selectedAction).toBe('');
  });

  it('produces a total key — every field is a string', () => {
    const key = buildSemanticCacheKey({
      roomId: 'room-1',
      contentHash: 'content-1',
      promptVersion: 'v0',
      classifierIds: [],
    });
    for (const value of Object.values(key)) {
      expect(typeof value).toBe('string');
    }
  });
});

describe('MCP-011 serializeSemanticCacheKey — stability + invalidation', () => {
  it('is stable across runs for the same input', () => {
    expect(serialize(baseInput())).toBe(serialize(baseInput()));
  });

  it('is stable under classifier-id reorder (fixture 17)', () => {
    const a = serialize({ ...baseInput(), classifierIds: ['a', 'b'] });
    const b = serialize({ ...baseInput(), classifierIds: ['b', 'a'] });
    expect(a).toBe(b);
  });

  it('changes when promptVersion changes (fixture 18)', () => {
    const a = serialize({ ...baseInput(), promptVersion: 'v0' });
    const b = serialize({ ...baseInput(), promptVersion: 'v1' });
    expect(a).not.toBe(b);
  });

  it('changes when contentHash changes', () => {
    expect(serialize({ ...baseInput(), contentHash: 'x' })).not.toBe(
      serialize({ ...baseInput(), contentHash: 'y' }),
    );
  });

  it('changes when parentId changes', () => {
    expect(serialize({ ...baseInput(), parentId: 'p1' })).not.toBe(
      serialize({ ...baseInput(), parentId: 'p2' }),
    );
  });

  it('changes when roomId changes', () => {
    expect(serialize({ ...baseInput(), roomId: 'r1' })).not.toBe(
      serialize({ ...baseInput(), roomId: 'r2' }),
    );
  });

  it('changes when roomMode changes', () => {
    expect(serialize({ ...baseInput(), roomMode: 'casual' })).not.toBe(
      serialize({ ...baseInput(), roomMode: 'strict' }),
    );
  });

  it('changes when selectedAction changes', () => {
    expect(serialize({ ...baseInput(), selectedAction: 'reply' })).not.toBe(
      serialize({ ...baseInput(), selectedAction: 'branch' }),
    );
  });

  it('changes when the classifier set changes', () => {
    expect(serialize({ ...baseInput(), classifierIds: ['a'] })).not.toBe(
      serialize({ ...baseInput(), classifierIds: ['a', 'b'] }),
    );
  });

  it('a root move keys stably via the empty-string sentinel', () => {
    const rootInput: SemanticCacheKeyInput = {
      roomId: 'room-1',
      contentHash: 'content-1',
      promptVersion: 'v0',
      classifierIds: ['responds_to_parent'],
    };
    expect(serialize(rootInput)).toBe(serialize(rootInput));
  });

  it('an absent vs empty-string parentId produce the same key (no ambiguity)', () => {
    const absent: SemanticCacheKeyInput = {
      roomId: 'room-1',
      contentHash: 'content-1',
      promptVersion: 'v0',
      classifierIds: ['responds_to_parent'],
    };
    const empty: SemanticCacheKeyInput = { ...absent, parentId: '' };
    expect(serialize(absent)).toBe(serialize(empty));
  });

  it('the unit-separator join does not collide across field boundaries', () => {
    // roomId 'a' + parentId 'bc' must not collide with roomId 'ab' + parentId 'c'.
    const a = serialize({
      roomId: 'a',
      parentId: 'bc',
      contentHash: 'h',
      promptVersion: 'v0',
      classifierIds: ['x'],
    });
    const b = serialize({
      roomId: 'ab',
      parentId: 'c',
      contentHash: 'h',
      promptVersion: 'v0',
      classifierIds: ['x'],
    });
    expect(a).not.toBe(b);
  });
});
