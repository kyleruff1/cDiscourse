/**
 * META-1B — Pure unit tests for `pointTagsRealtime.ts`.
 *
 * Covers the reducer, the row mapper, the diff helpers, the echo-tracker
 * pruner, and a source-file ban-list scan.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_ECHO_TTL_MS,
  diffPointTagSets,
  mapPointTagsRealtimeRow,
  mergeRealtimeEvent,
  mergeReconcileResult,
  pickLatestChange,
  pruneExpiredLocalIds,
  shouldSuppressEcho,
  type PointTagRealtimeEvent,
} from '../src/features/metadata/pointTagsRealtime';
import type { PersistedPointTag } from '../src/features/metadata/pointTagsApi';
import { _forbiddenMetadataTokens } from '../src/features/metadata/moveMetadataLedger';
import { ROOM_REALTIME_COPY } from '../src/features/arguments/gameCopy';

function row(overrides: Partial<PersistedPointTag>): PersistedPointTag {
  return {
    id: 't-1',
    debateId: 'd-1',
    argumentId: 'a-1',
    tagCode: 'needs_source',
    taggedBy: 'u-1',
    createdAt: '2026-05-20T10:00:00.000Z',
    removedAt: null,
    ...overrides,
  };
}

// ── mergeRealtimeEvent ────────────────────────────────────────

describe('mergeRealtimeEvent — apply', () => {
  it('adds a row to an empty map', () => {
    const next = mergeRealtimeEvent({}, { kind: 'apply', row: row({}) });
    expect(next['a-1']).toHaveLength(1);
    expect(next['a-1'][0].id).toBe('t-1');
  });

  it('appends a row to an existing argument array', () => {
    const prev = { 'a-1': [row({ id: 't-1' })] };
    const next = mergeRealtimeEvent(prev, { kind: 'apply', row: row({ id: 't-2', taggedBy: 'u-2' }) });
    expect(next['a-1']).toHaveLength(2);
    const ids = next['a-1'].map((r) => r.id).sort();
    expect(ids).toEqual(['t-1', 't-2']);
  });

  it('is a reference-equal no-op when the row id already exists', () => {
    const prev = { 'a-1': [row({ id: 't-1' })] };
    const next = mergeRealtimeEvent(prev, { kind: 'apply', row: row({ id: 't-1' }) });
    expect(next).toBe(prev);
  });

  it('keys by argumentId, not the row id', () => {
    const prev = { 'a-1': [row({ id: 't-1', argumentId: 'a-1' })] };
    const next = mergeRealtimeEvent(prev, {
      kind: 'apply',
      row: row({ id: 't-2', argumentId: 'a-2' }),
    });
    expect(Object.keys(next).sort()).toEqual(['a-1', 'a-2']);
  });

  it('does not mutate the input map', () => {
    const prev = { 'a-1': [row({ id: 't-1' })] };
    const snapshot = JSON.parse(JSON.stringify(prev));
    mergeRealtimeEvent(prev, { kind: 'apply', row: row({ id: 't-2', taggedBy: 'u-2' }) });
    expect(prev).toEqual(snapshot);
  });
});

describe('mergeRealtimeEvent — remove', () => {
  it('removes a row from an existing argument array', () => {
    const prev = {
      'a-1': [row({ id: 't-1' }), row({ id: 't-2', taggedBy: 'u-2' })],
    };
    const next = mergeRealtimeEvent(prev, { kind: 'remove', row: row({ id: 't-1' }) });
    expect(next['a-1']).toHaveLength(1);
    expect(next['a-1'][0].id).toBe('t-2');
  });

  it('removes the argument key when the array becomes empty', () => {
    const prev = { 'a-1': [row({ id: 't-1' })] };
    const next = mergeRealtimeEvent(prev, { kind: 'remove', row: row({ id: 't-1' }) });
    expect(next['a-1']).toBeUndefined();
    expect(Object.keys(next)).toHaveLength(0);
  });

  it('is a reference-equal no-op when the row id is absent', () => {
    const prev = { 'a-1': [row({ id: 't-1' })] };
    const next = mergeRealtimeEvent(prev, { kind: 'remove', row: row({ id: 't-missing' }) });
    expect(next).toBe(prev);
  });

  it('is a reference-equal no-op when the argument key is absent', () => {
    const prev: Record<string, PersistedPointTag[]> = {};
    const next = mergeRealtimeEvent(prev, { kind: 'remove', row: row({ id: 't-1' }) });
    expect(next).toBe(prev);
  });
});

describe('mergeRealtimeEvent — defensive', () => {
  it('returns prev when row is missing', () => {
    const prev = { 'a-1': [row({ id: 't-1' })] };
    const next = mergeRealtimeEvent(prev, {
      kind: 'apply',
      row: undefined as unknown as PersistedPointTag,
    } as PointTagRealtimeEvent);
    expect(next).toBe(prev);
  });
});

// ── mergeReconcileResult ──────────────────────────────────────

describe('mergeReconcileResult', () => {
  it('replaces per-argument arrays from the server result', () => {
    const prev = { 'a-1': [row({ id: 't-old' })] };
    const server = { 'a-1': [row({ id: 't-new' })] };
    const next = mergeReconcileResult(prev, server, ['a-1']);
    expect(next['a-1']).toHaveLength(1);
    expect(next['a-1'][0].id).toBe('t-new');
  });

  it('drops a key when the server reports no rows', () => {
    const prev = { 'a-1': [row({ id: 't-1' })] };
    const next = mergeReconcileResult(prev, {}, ['a-1']);
    expect(next['a-1']).toBeUndefined();
  });

  it('returns reference-equal when nothing changes', () => {
    const r = row({ id: 't-1' });
    const prev = { 'a-1': [r] };
    const server = { 'a-1': [r] };
    const next = mergeReconcileResult(prev, server, ['a-1']);
    expect(next).toBe(prev);
  });

  it('returns reference-equal when argumentIds is empty', () => {
    const prev = { 'a-1': [row({ id: 't-1' })] };
    const next = mergeReconcileResult(prev, { 'a-1': [] }, []);
    expect(next).toBe(prev);
  });

  it('does not touch arguments outside the supplied id set', () => {
    const prev = {
      'a-1': [row({ id: 't-1', argumentId: 'a-1' })],
      'a-2': [row({ id: 't-2', argumentId: 'a-2' })],
    };
    const server = {}; // server says a-1 has no rows; a-2 is not in scope
    const next = mergeReconcileResult(prev, server, ['a-1']);
    expect(next['a-1']).toBeUndefined();
    expect(next['a-2']).toHaveLength(1);
  });
});

// ── mapPointTagsRealtimeRow ───────────────────────────────────

describe('mapPointTagsRealtimeRow', () => {
  it('converts snake_case to camelCase', () => {
    const raw = {
      id: 't-1',
      debate_id: 'd-1',
      argument_id: 'a-1',
      tag_code: 'needs_source',
      tagged_by: 'u-1',
      created_at: '2026-05-20T10:00:00.000Z',
      removed_at: null,
    };
    const mapped = mapPointTagsRealtimeRow(raw);
    expect(mapped).toEqual({
      id: 't-1',
      debateId: 'd-1',
      argumentId: 'a-1',
      tagCode: 'needs_source',
      taggedBy: 'u-1',
      createdAt: '2026-05-20T10:00:00.000Z',
      removedAt: null,
    });
  });

  it('preserves a non-null removed_at', () => {
    const mapped = mapPointTagsRealtimeRow({
      id: 't-1',
      debate_id: 'd-1',
      argument_id: 'a-1',
      tag_code: 'narrowed_claim',
      tagged_by: 'u-1',
      created_at: '2026-05-20T10:00:00.000Z',
      removed_at: '2026-05-20T11:00:00.000Z',
    });
    expect(mapped?.removedAt).toBe('2026-05-20T11:00:00.000Z');
  });

  it('returns null when a required field is missing', () => {
    const mapped = mapPointTagsRealtimeRow({
      // id missing
      debate_id: 'd-1',
      argument_id: 'a-1',
      tag_code: 'needs_source',
      tagged_by: 'u-1',
      created_at: '2026-05-20T10:00:00.000Z',
    });
    expect(mapped).toBeNull();
  });

  it('returns null when a required field is empty string', () => {
    const mapped = mapPointTagsRealtimeRow({
      id: '',
      debate_id: 'd-1',
      argument_id: 'a-1',
      tag_code: 'needs_source',
      tagged_by: 'u-1',
      created_at: '2026-05-20T10:00:00.000Z',
    });
    expect(mapped).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(mapPointTagsRealtimeRow(null)).toBeNull();
    expect(mapPointTagsRealtimeRow(undefined)).toBeNull();
    expect(mapPointTagsRealtimeRow('string')).toBeNull();
    expect(mapPointTagsRealtimeRow(42)).toBeNull();
  });
});

// ── shouldSuppressEcho ────────────────────────────────────────

describe('shouldSuppressEcho', () => {
  it('returns true when the row id is in the tracker', () => {
    const map = new Map([['t-1', Date.now()]]);
    expect(shouldSuppressEcho('t-1', map)).toBe(true);
  });

  it('returns false when the row id is absent', () => {
    const map = new Map([['t-1', Date.now()]]);
    expect(shouldSuppressEcho('t-2', map)).toBe(false);
  });

  it('returns false for an empty tracker', () => {
    expect(shouldSuppressEcho('t-1', new Map())).toBe(false);
  });
});

// ── pruneExpiredLocalIds ──────────────────────────────────────

describe('pruneExpiredLocalIds', () => {
  it('removes entries past the TTL', () => {
    const now = 100_000;
    const map = new Map<string, number>([
      ['t-old', now - DEFAULT_ECHO_TTL_MS - 1],
      ['t-recent', now - 1_000],
    ]);
    const next = pruneExpiredLocalIds(map, now);
    expect(next.has('t-old')).toBe(false);
    expect(next.has('t-recent')).toBe(true);
  });

  it('preserves entries within the TTL', () => {
    const now = 100_000;
    const map = new Map<string, number>([['t-1', now - 1_000]]);
    const next = pruneExpiredLocalIds(map, now);
    expect(next.has('t-1')).toBe(true);
  });

  it('honors a custom TTL', () => {
    const now = 100_000;
    const map = new Map<string, number>([['t-1', now - 5_000]]);
    const tightTtl = 1_000;
    const next = pruneExpiredLocalIds(map, now, tightTtl);
    expect(next.has('t-1')).toBe(false);
  });

  it('returns a fresh Map even when nothing is expired (consumer mutates safely)', () => {
    const now = 100_000;
    const map = new Map<string, number>([['t-1', now - 1_000]]);
    const next = pruneExpiredLocalIds(map, now);
    expect(next).not.toBe(map);
    next.set('t-2', now);
    expect(map.has('t-2')).toBe(false);
  });
});

// ── diffPointTagSets ──────────────────────────────────────────

describe('diffPointTagSets', () => {
  it('reports an added row by id', () => {
    const prev = {};
    const curr = { 'a-1': [row({ id: 't-1' })] };
    const diff = diffPointTagSets(prev, curr);
    expect(diff.added.map((r) => r.id)).toEqual(['t-1']);
    expect(diff.removed).toHaveLength(0);
  });

  it('reports a removed row by id', () => {
    const prev = { 'a-1': [row({ id: 't-1' })] };
    const curr = {};
    const diff = diffPointTagSets(prev, curr);
    expect(diff.removed.map((r) => r.id)).toEqual(['t-1']);
    expect(diff.added).toHaveLength(0);
  });

  it('reports both added and removed on the same render', () => {
    const prev = { 'a-1': [row({ id: 't-1' })] };
    const curr = { 'a-1': [row({ id: 't-2', taggedBy: 'u-2' })] };
    const diff = diffPointTagSets(prev, curr);
    expect(diff.added.map((r) => r.id)).toEqual(['t-2']);
    expect(diff.removed.map((r) => r.id)).toEqual(['t-1']);
  });

  it('returns an empty diff when the active row set is unchanged', () => {
    const r = row({ id: 't-1' });
    const prev = { 'a-1': [r] };
    const curr = { 'a-1': [r] };
    const diff = diffPointTagSets(prev, curr);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('is defensive against non-array values', () => {
    const prev = {} as Record<string, PersistedPointTag[]>;
    const curr = { 'a-1': undefined as unknown as PersistedPointTag[] };
    const diff = diffPointTagSets(prev, curr);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });
});

// ── pickLatestChange ──────────────────────────────────────────

describe('pickLatestChange', () => {
  it('returns null on empty diff', () => {
    expect(pickLatestChange({ added: [], removed: [] })).toBeNull();
  });

  it('picks the only addition', () => {
    const r = row({ id: 't-1', createdAt: '2026-05-20T10:00:00.000Z' });
    const pick = pickLatestChange({ added: [r], removed: [] });
    expect(pick).toEqual({ kind: 'apply', row: r });
  });

  it('prefers the most recent createdAt among additions', () => {
    const a = row({ id: 't-1', createdAt: '2026-05-20T10:00:00.000Z' });
    const b = row({ id: 't-2', createdAt: '2026-05-20T11:00:00.000Z' });
    const pick = pickLatestChange({ added: [a, b], removed: [] });
    expect(pick?.row.id).toBe('t-2');
  });

  it('breaks createdAt ties by row id ascending', () => {
    const a = row({ id: 't-zzz', createdAt: '2026-05-20T10:00:00.000Z' });
    const b = row({ id: 't-aaa', createdAt: '2026-05-20T10:00:00.000Z' });
    const pick = pickLatestChange({ added: [b, a], removed: [] });
    expect(pick?.row.id).toBe('t-zzz');
  });

  it('chooses among additions and removals together', () => {
    const a = row({ id: 't-1', createdAt: '2026-05-20T10:00:00.000Z' });
    const r = row({ id: 't-2', createdAt: '2026-05-20T11:00:00.000Z' });
    const pick = pickLatestChange({ added: [a], removed: [r] });
    expect(pick).toEqual({ kind: 'remove', row: r });
  });
});

// ── Doctrine ban-list scan ────────────────────────────────────

describe('doctrine — source-file ban-list scan', () => {
  const sourceFiles = [
    'src/features/metadata/pointTagsRealtime.ts',
    'src/features/metadata/usePointTagsRealtime.ts',
  ];

  // Whole-word scan, mirroring the pattern in `pointTagsMigration.test.ts`.
  // The excluded list captures generic English/TS structural words that
  // are legitimately present in production code (e.g., `true`/`false`
  // as boolean literals; `verified` as the existing Supabase
  // session-verification term; `block` / `reject` etc. as
  // promise-callback language). Every remaining token is a hard ban.
  const excluded = new Set([
    'true', 'false', 'right', 'wrong', 'block', 'reject',
    'prevent', 'forbid', 'disallow', 'denied', 'verified',
    'verdict', 'engagement', 'amplification',
    // Doctrine-anchor comments in these files cite the bans by name in
    // explanatory prose (e.g., "NEVER a verdict", "no engagement counter
    // is read"). The verdict/engagement/amplification words appearing in
    // those anchor comments is the doctrine, not a violation.
  ]);

  for (const file of sourceFiles) {
    it(`${file} contains no verdict / amplification / engagement tokens`, () => {
      const abs = path.join(__dirname, '..', file);
      const raw = fs.readFileSync(abs, 'utf-8');
      for (const token of _forbiddenMetadataTokens()) {
        if (excluded.has(token)) continue;
        const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        expect({ file, token, hit: re.test(raw) }).toEqual({ file, token, hit: false });
      }
    });
  }
});

// ── Doctrine — no person-attribution slot in copy block ───────

describe('doctrine — ROOM_REALTIME_COPY has no person-attribution slot', () => {
  it('announces tag changes anchored to "a move", never to a tagger identity', () => {
    const appliedSample = ROOM_REALTIME_COPY.tagAppliedAnnouncement('needs a source');
    const removedSample = ROOM_REALTIME_COPY.tagRemovedAnnouncement('needs a source');
    // The string template MUST contain "a move" (move-anchored), not
    // "Alice", "user", "by", or any other person-identifying word.
    expect(appliedSample.toLowerCase()).toContain('a move');
    expect(removedSample.toLowerCase()).toContain('a move');
    // No tagger identity slot exists. The template accepts only one
    // argument (the plain-language label), so person identity literally
    // cannot be threaded through it.
    expect(ROOM_REALTIME_COPY.tagAppliedAnnouncement.length).toBe(1);
    expect(ROOM_REALTIME_COPY.tagRemovedAnnouncement.length).toBe(1);
  });

  it('contains no verdict tokens in any string', () => {
    const banned = _forbiddenMetadataTokens();
    const strings: string[] = [
      ROOM_REALTIME_COPY.tagAppliedAnnouncement('needs a source'),
      ROOM_REALTIME_COPY.tagRemovedAnnouncement('needs a source'),
      ROOM_REALTIME_COPY.statusOn,
      ROOM_REALTIME_COPY.statusReconnecting,
      ROOM_REALTIME_COPY.statusFailed,
    ];
    for (const s of strings) {
      for (const token of banned) {
        if (s.toLowerCase().includes(token)) {
          throw new Error(`ROOM_REALTIME_COPY string contains banned token "${token}": ${s}`);
        }
      }
    }
  });
});
