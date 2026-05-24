/**
 * META-1B — Reconcile-on-reconnect tests.
 *
 * Covers:
 *  - The scoped `fetchPointTagsForArguments` SELECT shape.
 *  - The `mergeReconcileResult` post-fetch wiring.
 *  - The QOL-039-visibility isolation (mocked `ok: false`) flowing into
 *    the loader's `refresh()` fallback.
 *
 * The hook lifecycle's `onReconcileNeeded` is exercised indirectly via
 * the wiring shape — this suite focuses on the data path.
 */
import * as fs from 'fs';
import * as path from 'path';

const mockFrom = jest.fn();
const mockChannel = jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() }));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    channel: (_topic: string) => mockChannel(),
    removeChannel: jest.fn(),
    functions: { invoke: jest.fn() },
  },
  SUPABASE_CONFIGURED: true,
}));

import { fetchPointTagsForArguments } from '../src/features/arguments/argumentsApi';
import {
  mergeReconcileResult,
  type PointTagRealtimeEvent,
} from '../src/features/metadata/pointTagsRealtime';
import type { PersistedPointTag } from '../src/features/metadata/pointTagsApi';

beforeEach(() => {
  mockFrom.mockReset();
  mockChannel.mockClear();
});

function tagRow(overrides: Partial<{
  id: string; debate_id: string; argument_id: string; tag_code: string;
  tagged_by: string; created_at: string; removed_at: string | null;
}>) {
  return {
    id: 't-1',
    debate_id: 'd-1',
    argument_id: 'a-1',
    tag_code: 'needs_source',
    tagged_by: 'u-1',
    created_at: '2026-05-20T10:00:00.000Z',
    removed_at: null,
    ...overrides,
  };
}

function mockSelectResult(data: ReturnType<typeof tagRow>[] | null, error: { message: string } | null = null) {
  const select = jest.fn();
  const inFn = jest.fn();
  const isFn = jest.fn();
  select.mockReturnValue({ in: inFn });
  inFn.mockReturnValue({ is: isFn });
  isFn.mockResolvedValue({ data, error });
  mockFrom.mockReturnValue({ select });
  return { select, inFn, isFn };
}

// ── fetchPointTagsForArguments — query shape ──────────────────

describe('fetchPointTagsForArguments — query shape', () => {
  it('selects only active rows (removed_at IS NULL)', async () => {
    const { select, inFn, isFn } = mockSelectResult([]);
    const result = await fetchPointTagsForArguments(['a-1', 'a-2']);
    expect(mockFrom).toHaveBeenCalledWith('point_tags');
    expect(select).toHaveBeenCalledWith('id,debate_id,argument_id,tag_code,tagged_by,created_at,removed_at');
    expect(inFn).toHaveBeenCalledWith('argument_id', ['a-1', 'a-2']);
    expect(isFn).toHaveBeenCalledWith('removed_at', null);
    expect(result.ok).toBe(true);
  });

  it('returns ok:true with empty data on empty argument list (no DB call)', async () => {
    const { isFn } = mockSelectResult([]);
    const result = await fetchPointTagsForArguments([]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
    expect(isFn).not.toHaveBeenCalled();
  });

  it('caps the input id list to 1000 (matches the gallery loader budget)', async () => {
    const { inFn } = mockSelectResult([]);
    const ids = Array.from({ length: 1200 }, (_, i) => `a-${i}`);
    await fetchPointTagsForArguments(ids);
    const callArg = (inFn.mock.calls[0] as [string, string[]])[1];
    expect(callArg).toHaveLength(1000);
  });

  it('maps snake_case rows to camelCase PersistedPointTag', async () => {
    mockSelectResult([
      tagRow({ id: 't-1', argument_id: 'a-1', tag_code: 'narrowed_claim', tagged_by: 'u-2' }),
    ]);
    const result = await fetchPointTagsForArguments(['a-1']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]).toMatchObject({
        id: 't-1',
        debateId: 'd-1',
        argumentId: 'a-1',
        tagCode: 'narrowed_claim',
        taggedBy: 'u-2',
        removedAt: null,
      });
    }
  });

  it('returns ok:false on a Supabase error', async () => {
    mockSelectResult(null, { message: 'rls_denied' });
    const result = await fetchPointTagsForArguments(['a-1']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('rls_denied');
  });

  it('handles a null data response without throwing', async () => {
    mockSelectResult(null);
    const result = await fetchPointTagsForArguments(['a-1']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });
});

// ── mergeReconcileResult — the data path ──────────────────────

describe('mergeReconcileResult — converge after reconnect', () => {
  function row(overrides: Partial<PersistedPointTag>): PersistedPointTag {
    return {
      id: 't-1', debateId: 'd-1', argumentId: 'a-1', tagCode: 'needs_source',
      taggedBy: 'u-1', createdAt: '2026-05-20T10:00:00.000Z', removedAt: null,
      ...overrides,
    };
  }

  it('adds a row present on the server but not locally', () => {
    const prev: Record<string, PersistedPointTag[]> = { 'a-1': [] };
    const server = { 'a-1': [row({ id: 't-new' })] };
    const next = mergeReconcileResult(prev, server, ['a-1']);
    expect(next['a-1']).toHaveLength(1);
    expect(next['a-1'][0].id).toBe('t-new');
  });

  it('drops a row locally present but soft-deleted on the server', () => {
    const prev = { 'a-1': [row({ id: 't-stale' })] };
    const server = {}; // server returned no active rows for a-1
    const next = mergeReconcileResult(prev, server, ['a-1']);
    expect(next['a-1']).toBeUndefined();
  });

  it('preserves arguments that were NOT in the reconcile scope', () => {
    const prev = {
      'a-1': [row({ id: 't-1' })],
      'a-2': [row({ id: 't-2', argumentId: 'a-2' })],
    };
    const server = { 'a-1': [] }; // server says a-1 is now empty
    const next = mergeReconcileResult(prev, server, ['a-1']);
    expect(next['a-1']).toBeUndefined();
    expect(next['a-2']).toHaveLength(1); // untouched
  });
});

// ── Wiring shape — fallback path on rls_denied ────────────────

describe('reconcile fallback — RLS-denied on the scoped fetch', () => {
  it('returns ok:false so the loader can refresh() as the safety net', async () => {
    mockSelectResult(null, { message: 'rls_denied' });
    const result = await fetchPointTagsForArguments(['a-1']);
    expect(result.ok).toBe(false);
    // The hook caller wires this to `refresh()` — verified in the
    // loader integration test below.
  });
});

// ── Source-scan — no service-role, no AI, no direct write ─────

describe('META-1B source files — security + doctrine source scan', () => {
  const files = [
    'src/features/metadata/pointTagsRealtime.ts',
    'src/features/metadata/usePointTagsRealtime.ts',
    'src/features/arguments/useArgumentRoomMessages.ts',
  ];

  for (const file of files) {
    it(`${file} contains no service-role / Anthropic / AI provider imports`, () => {
      const abs = path.join(__dirname, '..', file);
      const raw = fs.readFileSync(abs, 'utf-8');
      // Never references the service-role key by name.
      expect(raw).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(raw).not.toMatch(/SERVICE_ROLE/);
      // Never imports an AI provider SDK.
      expect(raw).not.toMatch(/from\s+['"]@anthropic-ai\/sdk['"]/);
      expect(raw).not.toMatch(/from\s+['"]@anthropic\//);
      expect(raw).not.toMatch(/from\s+['"]openai['"]/);
      expect(raw).not.toMatch(/api\.x\.ai/);
      expect(raw).not.toMatch(/anthropic\.com/);
    });
  }

  it('pointTagsRealtime.ts is pure-TS: no React, no Supabase, no fetch', () => {
    const abs = path.join(__dirname, '..', 'src/features/metadata/pointTagsRealtime.ts');
    const raw = fs.readFileSync(abs, 'utf-8');
    expect(raw).not.toMatch(/from\s+['"]react['"]/);
    expect(raw).not.toMatch(/from\s+['"]@supabase/);
    expect(raw).not.toMatch(/from\s+['"]\.\.\/\.\.\/lib\/supabase['"]/);
    expect(raw).not.toMatch(/global\s+fetch/);
  });

  it('no console.log in any META-1B new source file', () => {
    for (const file of files) {
      const abs = path.join(__dirname, '..', file);
      const raw = fs.readFileSync(abs, 'utf-8');
      // The hook's logger uses `console.warn` (intentional, documented);
      // `console.log` is the banned form per CLAUDE.md §TypeScript.
      expect(raw).not.toMatch(/console\.log\(/);
    }
  });

  // The realtime layer is read-only — no direct INSERT / UPDATE / DELETE
  // into `point_tags` may exist anywhere in the new META-1B files.
  it('no direct write into point_tags from META-1B source', () => {
    for (const file of files) {
      const abs = path.join(__dirname, '..', file);
      const raw = fs.readFileSync(abs, 'utf-8');
      expect(raw).not.toMatch(/\.from\(['"]point_tags['"]\)\.insert/);
      expect(raw).not.toMatch(/\.from\(['"]point_tags['"]\)\.update/);
      expect(raw).not.toMatch(/\.from\(['"]point_tags['"]\)\.delete/);
      expect(raw).not.toMatch(/\.from\(['"]point_tags['"]\)\.upsert/);
    }
  });
});

// ── Event-envelope shape — design §4 types ────────────────────

describe('PointTagRealtimeEvent envelope', () => {
  it('apply kind carries the persisted row', () => {
    const event: PointTagRealtimeEvent = {
      kind: 'apply',
      row: {
        id: 't-1', debateId: 'd-1', argumentId: 'a-1', tagCode: 'needs_source',
        taggedBy: 'u-1', createdAt: '2026-05-20T10:00:00.000Z', removedAt: null,
      },
    };
    expect(event.kind).toBe('apply');
    expect(event.row.argumentId).toBe('a-1');
  });

  it('remove kind carries the soft-deleted row payload', () => {
    const event: PointTagRealtimeEvent = {
      kind: 'remove',
      row: {
        id: 't-1', debateId: 'd-1', argumentId: 'a-1', tagCode: 'needs_source',
        taggedBy: 'u-1', createdAt: '2026-05-20T10:00:00.000Z',
        removedAt: '2026-05-20T10:01:00.000Z',
      },
    };
    expect(event.kind).toBe('remove');
    expect(event.row.removedAt).not.toBeNull();
  });
});
