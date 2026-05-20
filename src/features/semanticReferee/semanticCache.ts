/**
 * MCP-012 — Semantic call router: in-memory LRU packet cache.
 *
 * STORE ONLY. This file owns the in-memory cache *store*; MCP-011 owns the
 * cache *key* (`semanticRefereeCacheKey.ts`, with `serializeSemanticCacheKey`).
 * This file `import`s `serializeSemanticCacheKey` from MCP-011 and NEVER
 * re-derives it — no second key serializer, no second hash function, no second
 * `SemanticCacheKey` type lives here (MCP-012 design §"data model"
 * reconciliation; roadmap §6.2).
 *
 * Doctrine (MCP-012 design §"API contracts" #3):
 *   - LRU is a MEMORY bound, not a correctness mechanism and not invalidation.
 *     An evicted entry simply causes a future re-classification (a cost, not a
 *     wrong answer).
 *   - There is NO time-based TTL. `lruTick` orders accesses; it is never
 *     compared against a clock. Invalidation happens only by a `promptVersion`
 *     bump changing the key — the store has no `expire` method by design.
 *   - The cache stores SUCCESSFUL packets only. A deterministic fallback packet
 *     (an exhausted-retry or over-budget result) must NOT be cached — caching
 *     it would pin a degraded result past a provider recovery. The store does
 *     not enforce this (it stores whatever `set` receives); the caller (MCP-016)
 *     must only `set` on a verified-successful classification.
 *
 * Pure TypeScript — no network, no Supabase, no React, no `Deno`, no env,
 * no `async`.
 */

import { serializeSemanticCacheKey } from './semanticRefereeCacheKey';
import type { SemanticCacheKey } from './semanticRefereeCacheKey';
import type { SemanticRefereePacket } from './semanticRefereeTypes';

/**
 * A cache entry. `value` is MCP-011's packet, unchanged — the store adds,
 * removes, renames no field and runs no validation (validation already happened
 * at MCP-011's `parseSemanticPacket` before a packet is ever cached).
 */
export interface SemanticCacheEntry {
  key: SemanticCacheKey;
  packet: SemanticRefereePacket;
  /** Insertion / last-access tick — for LRU ordering ONLY, not time-based expiry. */
  lruTick: number;
}

/** Construction options. `capacity` defaults to `DEFAULT_CACHE_CAPACITY`. */
export interface SemanticPacketCacheOptions {
  capacity?: number;
}

/**
 * Default warm-instance cache size (MCP-004 §"caching": 256 entries per warm
 * instance — a sane default, not an operator decision).
 */
export const DEFAULT_CACHE_CAPACITY = 256;

/**
 * In-memory LRU store for `SemanticRefereePacket` values.
 *
 * Internally a `Map<string, SemanticCacheEntry>` keyed by
 * `serializeSemanticCacheKey(key)` (imported from MCP-011 — never re-derived).
 * A `Map` preserves insertion order; the store exploits that for O(1) LRU:
 *   - `get` on a hit deletes + re-inserts the entry so it moves to the
 *     most-recent (last) position.
 *   - `has` does NOT re-order — it is a pure membership test.
 *   - `set` evicts the least-recently-used entry (the FIRST key in `Map`
 *     iteration order) until `size <= capacity`.
 */
export class SemanticPacketCache {
  private readonly store: Map<string, SemanticCacheEntry>;

  private readonly cacheCapacity: number;

  /** Monotonic counter — orders accesses for `SemanticCacheEntry.lruTick`. */
  private tick: number;

  constructor(options?: SemanticPacketCacheOptions) {
    const requested = options?.capacity ?? DEFAULT_CACHE_CAPACITY;
    // A capacity < 1 is clamped to 1 — a zero / negative cache is meaningless.
    this.cacheCapacity = requested < 1 ? 1 : Math.floor(requested);
    this.store = new Map<string, SemanticCacheEntry>();
    this.tick = 0;
  }

  /**
   * Return the cached packet for `key`, or `undefined` if not present.
   * On a hit, marks the entry most-recently-used (delete + re-insert).
   */
  get(key: SemanticCacheKey): SemanticRefereePacket | undefined {
    const serialized = serializeSemanticCacheKey(key);
    const entry = this.store.get(serialized);
    if (entry === undefined) {
      return undefined;
    }
    // Move the entry to the most-recent (last) position.
    this.store.delete(serialized);
    this.tick += 1;
    entry.lruTick = this.tick;
    this.store.set(serialized, entry);
    return entry.packet;
  }

  /**
   * Insert or overwrite the packet for `key`. If the serialized key already
   * exists, it is deleted first so the re-insert moves it to most-recent and
   * the new packet overwrites. Evicts the least-recently-used entry when the
   * store exceeds `capacity`.
   */
  set(key: SemanticCacheKey, packet: SemanticRefereePacket): void {
    const serialized = serializeSemanticCacheKey(key);
    if (this.store.has(serialized)) {
      this.store.delete(serialized);
    }
    this.tick += 1;
    this.store.set(serialized, { key, packet, lruTick: this.tick });
    // Evict the least-recently-used entry until within capacity. The first
    // key in `Map` iteration order is the least-recently-used.
    while (this.store.size > this.cacheCapacity) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.store.delete(oldestKey);
    }
  }

  /**
   * Membership test. Does NOT mark the entry recently-used — a `has` followed
   * by a `set` at capacity may still evict the `has`-probed key.
   */
  has(key: SemanticCacheKey): boolean {
    return this.store.has(serializeSemanticCacheKey(key));
  }

  /** Remove the entry for `key`. Returns `true` if an entry was removed. */
  delete(key: SemanticCacheKey): boolean {
    return this.store.delete(serializeSemanticCacheKey(key));
  }

  /** Remove every entry. */
  clear(): void {
    this.store.clear();
  }

  /** The current number of cached entries. */
  get size(): number {
    return this.store.size;
  }

  /** The maximum number of entries before LRU eviction (≥ 1). */
  get capacity(): number {
    return this.cacheCapacity;
  }
}
