/**
 * META-1B — Pure-TS reducer + helpers for the realtime point-tags channel.
 *
 * Owns:
 *   - `PointTagRealtimeEvent` — internal envelope for one realtime payload.
 *   - `PointTagSubscriptionStatus` — diagnostic state surfaced by the hook.
 *   - `mergeRealtimeEvent(state, event)` — applies one event to a
 *     `Record<string, PersistedPointTag[]>` map. Idempotent. Preserves
 *     reference equality on a no-op.
 *   - `mapPointTagsRealtimeRow(raw)` — converts a Supabase realtime row
 *     (snake_case) to `PersistedPointTag` (camelCase). Returns null on
 *     missing required fields; callers drop the event.
 *   - `pruneExpiredLocalIds(map, nowMs, ttlMs)` — removes echo-tracker
 *     entries past their TTL.
 *   - `shouldSuppressEcho(rowId, recentLocalIds)` — pure predicate.
 *   - `diffPointTagSets(prev, curr)` — set-diff of active rows keyed by id;
 *     used by `ArgumentGameSurface` to drive the screen-reader announcement.
 *   - `pickLatestChange(diff)` — chooses the most recent change deterministic
 *     by `createdAt` desc, then by row id.
 *
 * Doctrine:
 *   - A manual tag is a participant gameplay annotation, NEVER a verdict.
 *   - No engagement / popularity / heat input.
 *   - No AI inference; no remote calls.
 *   - No tagger identity in any user-facing copy slot (the announcement
 *     consumer reads only the tag code's plain label).
 *
 * Pure TS. No React. No Supabase. No network. No async. No mutation of any
 * input. No new dependency.
 */
import type { PersistedPointTag } from './pointTagsApi';
import type { ManualTagCode } from './moveMetadataLedger';

// ── Public types ──────────────────────────────────────────────

/** META-1B — Internal envelope for an inbound point_tags realtime event. */
export interface PointTagRealtimeEvent {
  kind: 'apply' | 'remove';
  row: PersistedPointTag;
}

/** META-1B — Subscription status used by the room shell for diagnostics. */
export type PointTagSubscriptionStatus =
  | 'idle' // before the channel has been requested
  | 'subscribing' // join in flight
  | 'subscribed' // channel is live
  | 'reconnecting' // CHANNEL_ERROR / CLOSED — re-subscribe in flight
  | 'failed'; // permanent failure (RLS denies SELECT or backoff exhausted)

/** META-1B — Change set produced by `diffPointTagSets`. */
export interface PointTagSetDiff {
  added: ReadonlyArray<PersistedPointTag>;
  removed: ReadonlyArray<PersistedPointTag>;
}

// ── Constants ─────────────────────────────────────────────────

/** Default TTL for echo-tracker entries (60 s — wide enough for poor net,
 *  narrow enough that long sessions don't accumulate stale entries). */
export const DEFAULT_ECHO_TTL_MS = 60_000;

// ── Row mapper ────────────────────────────────────────────────

/** Required keys we accept from a Supabase realtime row before mapping. */
const REQUIRED_KEYS = ['id', 'debate_id', 'argument_id', 'tag_code', 'tagged_by', 'created_at'] as const;

/**
 * Convert a raw realtime row (snake_case) to `PersistedPointTag`
 * (camelCase). Defensive — returns null on missing required fields so the
 * caller can drop the event without throwing.
 *
 * Pure.
 */
export function mapPointTagsRealtimeRow(raw: unknown): PersistedPointTag | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  for (const key of REQUIRED_KEYS) {
    const value = obj[key];
    if (typeof value !== 'string' || value.length === 0) return null;
  }
  const removedAtRaw = obj['removed_at'];
  const removedAt =
    typeof removedAtRaw === 'string' && removedAtRaw.length > 0 ? removedAtRaw : null;
  return {
    id: obj['id'] as string,
    debateId: obj['debate_id'] as string,
    argumentId: obj['argument_id'] as string,
    tagCode: obj['tag_code'] as ManualTagCode,
    taggedBy: obj['tagged_by'] as string,
    createdAt: obj['created_at'] as string,
    removedAt,
  };
}

// ── Reducer ───────────────────────────────────────────────────

/**
 * Apply one realtime event to the per-argument point-tags map.
 *
 * Behavior:
 *   - `apply`: if no row with the same id is already present for the
 *     argument, the row is appended. If the id is already present, the
 *     state is returned reference-equal (idempotent no-op).
 *   - `remove`: if a row with the same id is present, it is removed. If
 *     removing the row empties the argument's array, the key is removed
 *     from the map (not left as `[]`). If the id is absent, the state is
 *     returned reference-equal (idempotent no-op).
 *
 * The input map is NEVER mutated. A no-op returns the same reference so
 * downstream `useMemo` chains don't invalidate needlessly.
 *
 * Pure.
 */
export function mergeRealtimeEvent(
  state: Readonly<Record<string, PersistedPointTag[]>>,
  event: PointTagRealtimeEvent,
): Record<string, PersistedPointTag[]> {
  if (!event || !event.row || typeof event.row.argumentId !== 'string') {
    return state as Record<string, PersistedPointTag[]>;
  }
  const argId = event.row.argumentId;
  const list = state[argId];
  if (event.kind === 'apply') {
    if (list && list.some((r) => r.id === event.row.id)) {
      return state as Record<string, PersistedPointTag[]>; // no-op
    }
    const next: Record<string, PersistedPointTag[]> = { ...state };
    next[argId] = list ? [...list, event.row] : [event.row];
    return next;
  }
  // remove
  if (!list || !list.some((r) => r.id === event.row.id)) {
    return state as Record<string, PersistedPointTag[]>; // no-op
  }
  const next: Record<string, PersistedPointTag[]> = { ...state };
  const filtered = list.filter((r) => r.id !== event.row.id);
  if (filtered.length === 0) {
    delete next[argId];
  } else {
    next[argId] = filtered;
  }
  return next;
}

/**
 * Replace per-argument tag arrays for a known set of argument ids with the
 * scoped reconcile result. Argument ids NOT in `argumentIds` are left
 * untouched.
 *
 * Used after the channel subscribes (initial join + reconnect) to converge
 * state with the server. Reference-equal return when the diff is empty.
 *
 * Pure.
 */
export function mergeReconcileResult(
  prev: Readonly<Record<string, PersistedPointTag[]>>,
  serverByArgumentId: Readonly<Record<string, PersistedPointTag[]>>,
  argumentIds: ReadonlyArray<string>,
): Record<string, PersistedPointTag[]> {
  if (argumentIds.length === 0) return prev as Record<string, PersistedPointTag[]>;
  let changed = false;
  const next: Record<string, PersistedPointTag[]> = { ...prev };
  for (const id of argumentIds) {
    const server = serverByArgumentId[id] || [];
    const local = prev[id] || [];
    if (sameActiveRowSet(local, server)) continue;
    changed = true;
    if (server.length === 0) {
      delete next[id];
    } else {
      next[id] = server;
    }
  }
  return changed ? next : (prev as Record<string, PersistedPointTag[]>);
}

function sameActiveRowSet(a: ReadonlyArray<PersistedPointTag>, b: ReadonlyArray<PersistedPointTag>): boolean {
  if (a.length !== b.length) return false;
  const aIds = new Set(a.map((r) => r.id));
  for (const r of b) {
    if (!aIds.has(r.id)) return false;
  }
  return true;
}

// ── Echo-suppression helpers ──────────────────────────────────

/** Pure predicate: row id is currently tracked as a local write. */
export function shouldSuppressEcho(
  rowId: string,
  recentLocalIds: ReadonlyMap<string, number>,
): boolean {
  return recentLocalIds.has(rowId);
}

/**
 * Build a new Map with TTL-expired entries removed. Reference-equal when no
 * entries are expired (avoids unnecessary state churn).
 *
 * Pure.
 */
export function pruneExpiredLocalIds(
  map: ReadonlyMap<string, number>,
  nowMs: number,
  ttlMs: number = DEFAULT_ECHO_TTL_MS,
): Map<string, number> {
  let anyExpired = false;
  for (const [, expiry] of map) {
    if (expiry <= nowMs - ttlMs) {
      anyExpired = true;
      break;
    }
  }
  if (!anyExpired) return new Map(map);
  const next = new Map<string, number>();
  for (const [id, expiry] of map) {
    if (expiry > nowMs - ttlMs) next.set(id, expiry);
  }
  return next;
}

// ── Set diff for the announcement effect ──────────────────────

/**
 * Compute the active-row diff (by row id) between two per-argument maps.
 *
 * `added` — rows present in `curr` but not in `prev`.
 * `removed` — rows present in `prev` but not in `curr`.
 *
 * The order of returned arrays mirrors the iteration order of the source
 * objects. Pure.
 */
export function diffPointTagSets(
  prev: Readonly<Record<string, PersistedPointTag[]>>,
  curr: Readonly<Record<string, PersistedPointTag[]>>,
): PointTagSetDiff {
  const prevIds = new Set<string>();
  const prevById = new Map<string, PersistedPointTag>();
  for (const argId of Object.keys(prev)) {
    const list = prev[argId];
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || typeof row.id !== 'string') continue;
      prevIds.add(row.id);
      prevById.set(row.id, row);
    }
  }
  const currIds = new Set<string>();
  const added: PersistedPointTag[] = [];
  for (const argId of Object.keys(curr)) {
    const list = curr[argId];
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || typeof row.id !== 'string') continue;
      currIds.add(row.id);
      if (!prevIds.has(row.id)) added.push(row);
    }
  }
  const removed: PersistedPointTag[] = [];
  for (const id of prevIds) {
    if (!currIds.has(id)) {
      const row = prevById.get(id);
      if (row) removed.push(row);
    }
  }
  return { added, removed };
}

/** A single change selected from a diff for screen-reader announcement. */
export interface PointTagChange {
  kind: 'apply' | 'remove';
  row: PersistedPointTag;
}

/**
 * Pick the latest single change from a diff for the screen-reader
 * announcement (one announcement per render to avoid stuttering).
 *
 * Tiebreaker order: most recent `createdAt` (ISO-8601 string compare is
 * lexicographic-safe), then row id ascending for determinism. Returns null
 * when the diff is empty.
 *
 * Pure.
 */
export function pickLatestChange(diff: PointTagSetDiff): PointTagChange | null {
  let best: PointTagChange | null = null;
  for (const row of diff.added) {
    if (!best) {
      best = { kind: 'apply', row };
      continue;
    }
    if (row.createdAt > best.row.createdAt) best = { kind: 'apply', row };
    else if (row.createdAt === best.row.createdAt && row.id > best.row.id) {
      best = { kind: 'apply', row };
    }
  }
  for (const row of diff.removed) {
    if (!best) {
      best = { kind: 'remove', row };
      continue;
    }
    if (row.createdAt > best.row.createdAt) best = { kind: 'remove', row };
    else if (row.createdAt === best.row.createdAt && row.id > best.row.id) {
      best = { kind: 'remove', row };
    }
  }
  return best;
}
