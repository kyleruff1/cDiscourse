/**
 * MCP-012 — Semantic call router: in-memory LRU cache tests.
 *
 * Asserts get / set / has / delete / clear / size / capacity, LRU eviction +
 * recency semantics, key reuse via MCP-011's serializer / fixtures, no
 * time-based expiry, overwrite, and the capacity clamp.
 */

import {
  SemanticPacketCache,
  DEFAULT_CACHE_CAPACITY,
} from '../src/features/semanticReferee/semanticCache';
import {
  buildSemanticCacheKey,
} from '../src/features/semanticReferee/semanticRefereeCacheKey';
import type { SemanticCacheKey } from '../src/features/semanticReferee/semanticRefereeCacheKey';
import {
  mockFixtureProvider,
  CACHE_KEY_FIXTURES,
} from '../src/features/semanticReferee/semanticRefereeFixtures';
import type { SemanticRefereePacket } from '../src/features/semanticReferee/semanticRefereeTypes';

/** Build a distinct cache key parameterized by `n`. */
function keyN(n: number): SemanticCacheKey {
  return buildSemanticCacheKey({
    roomId: `room-${n}`,
    parentId: `parent-${n}`,
    contentHash: `content-${n}`,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    classifierIds: ['responds_to_parent'],
    roomMode: 'casual',
    selectedAction: 'reply',
  });
}

/** A valid packet from the mock provider — keyed loosely to `n` for identity checks. */
function packetN(n: number): SemanticRefereePacket {
  return mockFixtureProvider({
    roomId: `room-${n}`,
    classifierIds: ['responds_to_parent'],
    contentHash: `content-${n}`,
  });
}

describe('MCP-012 SemanticPacketCache — basic store operations', () => {
  it('get of an unset key returns undefined', () => {
    const cache = new SemanticPacketCache();
    expect(cache.get(keyN(1))).toBeUndefined();
  });

  it('has of an unset key returns false', () => {
    const cache = new SemanticPacketCache();
    expect(cache.has(keyN(1))).toBe(false);
  });

  it('set then get returns the same packet', () => {
    const cache = new SemanticPacketCache();
    const packet = packetN(1);
    cache.set(keyN(1), packet);
    expect(cache.get(keyN(1))).toBe(packet);
  });

  it('has returns true after set', () => {
    const cache = new SemanticPacketCache();
    cache.set(keyN(1), packetN(1));
    expect(cache.has(keyN(1))).toBe(true);
  });

  it('delete removes an entry and returns true; deleting an absent key returns false', () => {
    const cache = new SemanticPacketCache();
    cache.set(keyN(1), packetN(1));
    expect(cache.delete(keyN(1))).toBe(true);
    expect(cache.has(keyN(1))).toBe(false);
    expect(cache.delete(keyN(1))).toBe(false);
  });

  it('clear empties the cache', () => {
    const cache = new SemanticPacketCache();
    cache.set(keyN(1), packetN(1));
    cache.set(keyN(2), packetN(2));
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get(keyN(1))).toBeUndefined();
  });

  it('size reflects the number of distinct entries', () => {
    const cache = new SemanticPacketCache();
    expect(cache.size).toBe(0);
    cache.set(keyN(1), packetN(1));
    expect(cache.size).toBe(1);
    cache.set(keyN(2), packetN(2));
    expect(cache.size).toBe(2);
  });

  it('capacity defaults to DEFAULT_CACHE_CAPACITY (256)', () => {
    expect(DEFAULT_CACHE_CAPACITY).toBe(256);
    const cache = new SemanticPacketCache();
    expect(cache.capacity).toBe(256);
  });

  it('capacity is settable via options', () => {
    const cache = new SemanticPacketCache({ capacity: 8 });
    expect(cache.capacity).toBe(8);
  });
});

describe('MCP-012 SemanticPacketCache — overwrite', () => {
  it('set overwriting an existing key replaces the packet without growing size', () => {
    const cache = new SemanticPacketCache();
    const first = packetN(1);
    const second = packetN(2);
    cache.set(keyN(1), first);
    expect(cache.size).toBe(1);
    cache.set(keyN(1), second);
    expect(cache.size).toBe(1);
    expect(cache.get(keyN(1))).toBe(second);
  });
});

describe('MCP-012 SemanticPacketCache — LRU eviction', () => {
  it('inserting the (capacity + 1)-th key evicts the least-recently-used entry', () => {
    const cache = new SemanticPacketCache({ capacity: 3 });
    cache.set(keyN(1), packetN(1));
    cache.set(keyN(2), packetN(2));
    cache.set(keyN(3), packetN(3));
    expect(cache.size).toBe(3);
    cache.set(keyN(4), packetN(4)); // evicts keyN(1) — the LRU.
    expect(cache.size).toBe(3);
    expect(cache.get(keyN(1))).toBeUndefined();
    expect(cache.get(keyN(2))).toBeDefined();
    expect(cache.get(keyN(3))).toBeDefined();
    expect(cache.get(keyN(4))).toBeDefined();
  });

  it('get refreshes recency — a refreshed key survives a later eviction', () => {
    const cache = new SemanticPacketCache({ capacity: 3 });
    cache.set(keyN(1), packetN(1));
    cache.set(keyN(2), packetN(2));
    cache.set(keyN(3), packetN(3));
    // Refresh keyN(1) so it is now most-recently-used.
    expect(cache.get(keyN(1))).toBeDefined();
    // Inserting a 4th key now evicts keyN(2) — the new LRU.
    cache.set(keyN(4), packetN(4));
    expect(cache.get(keyN(1))).toBeDefined(); // survived.
    expect(cache.get(keyN(2))).toBeUndefined(); // evicted.
  });

  it('has does NOT refresh recency — a has-probed key can still be evicted', () => {
    const cache = new SemanticPacketCache({ capacity: 3 });
    cache.set(keyN(1), packetN(1));
    cache.set(keyN(2), packetN(2));
    cache.set(keyN(3), packetN(3));
    // Probe keyN(1) with has — must NOT refresh recency.
    expect(cache.has(keyN(1))).toBe(true);
    // keyN(1) is still the LRU, so a 4th insert evicts it.
    cache.set(keyN(4), packetN(4));
    expect(cache.has(keyN(1))).toBe(false);
  });

  it('overwriting a key refreshes its recency', () => {
    const cache = new SemanticPacketCache({ capacity: 3 });
    cache.set(keyN(1), packetN(1));
    cache.set(keyN(2), packetN(2));
    cache.set(keyN(3), packetN(3));
    // Overwrite keyN(1) — moves it to most-recent.
    cache.set(keyN(1), packetN(11));
    cache.set(keyN(4), packetN(4)); // evicts keyN(2) — the new LRU.
    expect(cache.has(keyN(1))).toBe(true);
    expect(cache.has(keyN(2))).toBe(false);
  });

  it('size stays at capacity through many distinct inserts', () => {
    const cache = new SemanticPacketCache({ capacity: 5 });
    for (let n = 0; n < 50; n += 1) {
      cache.set(keyN(n), packetN(n));
    }
    expect(cache.size).toBe(5);
  });
});

describe('MCP-012 SemanticPacketCache — capacity clamp', () => {
  it('clamps a capacity of 0 to 1', () => {
    const cache = new SemanticPacketCache({ capacity: 0 });
    expect(cache.capacity).toBe(1);
  });

  it('clamps a negative capacity to 1', () => {
    const cache = new SemanticPacketCache({ capacity: -10 });
    expect(cache.capacity).toBe(1);
  });

  it('a clamped capacity-1 cache holds exactly one entry', () => {
    const cache = new SemanticPacketCache({ capacity: 0 });
    cache.set(keyN(1), packetN(1));
    cache.set(keyN(2), packetN(2));
    expect(cache.size).toBe(1);
    expect(cache.get(keyN(1))).toBeUndefined();
    expect(cache.get(keyN(2))).toBeDefined();
  });
});

describe('MCP-012 SemanticPacketCache — key reuse via MCP-011 serializer', () => {
  it('two inputs identical up to classifier-id order map to the same entry', () => {
    const fixture = CACHE_KEY_FIXTURES.find((f) => f.id === 'cachekey_stable_reorder');
    expect(fixture).toBeDefined();
    const keyA = buildSemanticCacheKey(fixture!.inputA);
    const keyB = buildSemanticCacheKey(fixture!.inputB);
    const cache = new SemanticPacketCache();
    const packet = packetN(1);
    cache.set(keyA, packet);
    // keyB differs only in classifier-id ORDER — it is the same cache entry.
    expect(cache.get(keyB)).toBe(packet);
    expect(cache.size).toBe(1);
  });

  it('a promptVersion change produces a different entry / a miss', () => {
    const fixture = CACHE_KEY_FIXTURES.find(
      (f) => f.id === 'cachekey_promptversion_invalidates',
    );
    expect(fixture).toBeDefined();
    const keyA = buildSemanticCacheKey(fixture!.inputA);
    const keyB = buildSemanticCacheKey(fixture!.inputB);
    const cache = new SemanticPacketCache();
    cache.set(keyA, packetN(1));
    // keyB differs only in promptVersion — a different key, hence a miss.
    expect(cache.get(keyB)).toBeUndefined();
    cache.set(keyB, packetN(2));
    expect(cache.size).toBe(2);
  });
});

describe('MCP-012 SemanticPacketCache — no time-based expiry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('an entry set before a fake-clock advance is still retrievable after', () => {
    const cache = new SemanticPacketCache();
    const packet = packetN(1);
    cache.set(keyN(1), packet);
    // Advance a fake clock far into the future — there is no TTL to trip.
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(cache.get(keyN(1))).toBe(packet);
    expect(cache.has(keyN(1))).toBe(true);
  });
});
