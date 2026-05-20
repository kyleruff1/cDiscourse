/**
 * MCP-011 — Semantic referee cache-key helper.
 *
 * A stable, order-normalized, total cache-key for the semantic-referee layer.
 * MCP-012's future `semanticCache.ts` store imports `serializeSemanticCacheKey`
 * from here rather than re-deriving a divergent key.
 *
 * This file is PURE TYPESCRIPT — no `crypto` import (so the helper is
 * isomorphic and matches the engine-purity rule), no network, no env.
 *
 * Reconciliation with MCP-004 (MCP-011 §11): the `SemanticCacheKey` shape is a
 * strict SUPERSET of MCP-004's five-tuple `{roomId, parentId, contentHash,
 * promptVersion, classifierSet}` — it keeps all five and adds `roomMode` +
 * `selectedAction`, both prompt inputs MCP-004's tuple omitted. The operator
 * accepted the superset (MCP-011 §18 decision 2).
 *
 * MCP-011 does NOT compute `contentHash` — it is supplied (the upstream MCP-009
 * boundary hashes the redacted body). MCP-011 only hashes the classifier-id list.
 */

/** Caller-supplied cache-key inputs. Absent optionals collapse to `''`. */
export interface SemanticCacheKeyInput {
  roomId: string;
  /** Omitted / '' for a root move. */
  parentId?: string;
  /** Supplied — hash of the redacted move body (MCP-009). */
  contentHash: string;
  promptVersion: string;
  /** The requested classifier set; order-normalized + deduped before hashing. */
  classifierIds: readonly string[];
  /** GAME-003 debate mode — a prompt input. */
  roomMode?: string;
  /** Quick-action preset — a prompt input. */
  selectedAction?: string;
}

/** The normalized, total cache key. Every field is a non-undefined string. */
export interface SemanticCacheKey {
  roomId: string;
  /** '' sentinel for a root move. */
  parentId: string;
  contentHash: string;
  promptVersion: string;
  /** Order-normalized hash of `classifierIds`. */
  classifierSetHash: string;
  /** '' sentinel when absent. */
  roomMode: string;
  /** '' sentinel when absent. */
  selectedAction: string;
}

/**
 * Unit-separator (U+001F) — cannot legitimately appear in a roomId, hash,
 * version, mode, or action, so it is a collision-safe join character.
 */
const UNIT_SEPARATOR = '';

/** Coerce a possibly-undefined string input to a trimmed total string. */
function totalString(value: string | undefined): string {
  if (value == null) return '';
  return String(value);
}

/**
 * A small pure-TS deterministic string hash (FNV-1a, 32-bit). No `crypto`
 * import — keeps the helper isomorphic (client + Edge Function). Returned as a
 * fixed-width lowercase hex string.
 */
function fnv1a32(input: string): string {
  // FNV-1a 32-bit offset basis.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i) & 0xff;
    // Higher bytes of a JS char code also matter for non-ASCII input.
    const hi = input.charCodeAt(i) >>> 8;
    if (hi !== 0) hash ^= hi;
    // hash *= 16777619, kept in 32-bit unsigned range via Math.imul.
    hash = Math.imul(hash, 0x01000193);
  }
  // Force unsigned 32-bit and pad to 8 hex digits.
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Order-normalize a classifier-id list (sort lexically, dedupe) and hash it.
 * `['a','b']`, `['b','a']`, and `['a','a','b']` all hash identically.
 * An empty list hashes to a stable sentinel.
 */
export function hashClassifierSet(ids: readonly string[]): string {
  const normalized = Array.from(new Set(ids.map((id) => String(id))))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  // Join with the unit separator so ['ab'] and ['a','b'] cannot collide.
  return fnv1a32(normalized.join(UNIT_SEPARATOR));
}

/**
 * Build a normalized, total cache key. Absent `parentId` / `roomMode` /
 * `selectedAction` collapse to `''` so there is no `undefined`-vs-`''`
 * ambiguity. `classifierIds` are order-normalized + deduped before hashing.
 */
export function buildSemanticCacheKey(input: SemanticCacheKeyInput): SemanticCacheKey {
  return {
    roomId: totalString(input.roomId),
    parentId: totalString(input.parentId),
    contentHash: totalString(input.contentHash),
    promptVersion: totalString(input.promptVersion),
    classifierSetHash: hashClassifierSet(input.classifierIds ?? []),
    roomMode: totalString(input.roomMode),
    selectedAction: totalString(input.selectedAction),
  };
}

/**
 * Join the seven key components with the unit separator into a stable, total,
 * collision-safe string. Two different keys never serialize to the same string.
 */
export function serializeSemanticCacheKey(key: SemanticCacheKey): string {
  return [
    key.roomId,
    key.parentId,
    key.contentHash,
    key.promptVersion,
    key.classifierSetHash,
    key.roomMode,
    key.selectedAction,
  ].join(UNIT_SEPARATOR);
}
