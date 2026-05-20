/**
 * META-1A — pointTagsApi client wrapper + adapter tests.
 *
 * The wrappers (`applyManualTag` / `removeManualTag`) route through the
 * Edge Function — `supabase.functions.invoke` is mocked. The pure adapter
 * (`persistedTagsToManualTagEntries`) is executed directly.
 */
import * as fs from 'fs';
import * as path from 'path';

const mockInvoke = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
  SUPABASE_CONFIGURED: true,
}));

import {
  applyManualTag,
  removeManualTag,
  persistedTagsToManualTagEntries,
  type PersistedPointTag,
} from '../src/features/metadata/pointTagsApi';
import { makeManualTagDedupeKey } from '../src/features/metadata/manualTagModel';

beforeEach(() => {
  mockInvoke.mockReset();
});

// ── Wrappers — call shape ─────────────────────────────────────

describe('applyManualTag / removeManualTag — Edge Function routing', () => {
  it('applyManualTag invokes apply-manual-tag with action: apply', async () => {
    mockInvoke.mockResolvedValue({
      data: { argumentId: 'a1', activeTags: [] },
      error: null,
    });
    const result = await applyManualTag({
      debateId: 'd1',
      argumentId: 'a1',
      tagCode: 'needs_source',
    });
    expect(mockInvoke).toHaveBeenCalledWith('apply-manual-tag', {
      body: { action: 'apply', debateId: 'd1', argumentId: 'a1', tagCode: 'needs_source' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.argumentId).toBe('a1');
  });

  it('removeManualTag invokes apply-manual-tag with action: remove', async () => {
    mockInvoke.mockResolvedValue({
      data: { argumentId: 'a1', activeTags: [] },
      error: null,
    });
    await removeManualTag({ debateId: 'd1', argumentId: 'a1', tagCode: 'tangent' });
    expect(mockInvoke).toHaveBeenCalledWith('apply-manual-tag', {
      body: { action: 'remove', debateId: 'd1', argumentId: 'a1', tagCode: 'tangent' },
    });
  });

  it('returns ok:true with the response data on success', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        argumentId: 'a1',
        activeTags: [{ id: 't1', tagCode: 'needs_source', taggedBy: 'u1', createdAt: '2026-05-19T00:00:00Z' }],
      },
      error: null,
    });
    const result = await applyManualTag({ debateId: 'd1', argumentId: 'a1', tagCode: 'needs_source' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.activeTags).toHaveLength(1);
  });

  it('unwraps a structured Edge Function error and returns ok:false with status', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        status: 403,
        context: { json: async () => ({ error: 'forbidden', reason: 'not_eligible' }) },
      },
    });
    const result = await applyManualTag({ debateId: 'd1', argumentId: 'a1', tagCode: 'needs_source' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error.reason).toBe('not_eligible');
    }
  });

  it('maps a FunctionsFetchError (function not deployed / offline) to status 503', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsFetchError' },
    });
    const result = await removeManualTag({ debateId: 'd1', argumentId: 'a1', tagCode: 'tangent' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it('returns ok:false empty_response when invoke yields no data and no error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const result = await applyManualTag({ debateId: 'd1', argumentId: 'a1', tagCode: 'scope_issue' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('empty_response');
      expect(result.status).toBe(500);
    }
  });
});

// ── persistedTagsToManualTagEntries — pure adapter ────────────

function row(overrides: Partial<PersistedPointTag>): PersistedPointTag {
  return {
    id: 'pt1',
    debateId: 'd1',
    argumentId: 'a1',
    tagCode: 'needs_source',
    taggedBy: 'u1',
    createdAt: '2026-05-19T00:00:00Z',
    removedAt: null,
    ...overrides,
  };
}

describe('persistedTagsToManualTagEntries', () => {
  it('groups rows by argumentId into ManualTagEntry lists', () => {
    const map = persistedTagsToManualTagEntries([
      row({ id: 'pt1', argumentId: 'a1', tagCode: 'needs_source' }),
      row({ id: 'pt2', argumentId: 'a1', tagCode: 'tangent' }),
      row({ id: 'pt3', argumentId: 'a2', tagCode: 'needs_quote' }),
    ]);
    expect(map.get('a1')).toHaveLength(2);
    expect(map.get('a2')).toHaveLength(1);
  });

  it('reconstructs dedupeKey via makeManualTagDedupeKey(code, taggedBy)', () => {
    const map = persistedTagsToManualTagEntries([
      row({ argumentId: 'a1', tagCode: 'scope_issue', taggedBy: 'user-9' }),
    ]);
    const entry = map.get('a1')![0];
    expect(entry.dedupeKey).toBe(makeManualTagDedupeKey('scope_issue', 'user-9'));
  });

  it('carries code, appliedByUserId, appliedAt from the row', () => {
    const map = persistedTagsToManualTagEntries([
      row({ argumentId: 'a1', tagCode: 'evidence_debt', taggedBy: 'u7', createdAt: '2026-05-18T12:00:00Z' }),
    ]);
    const entry = map.get('a1')![0];
    expect(entry.code).toBe('evidence_debt');
    expect(entry.appliedByUserId).toBe('u7');
    expect(entry.appliedAt).toBe('2026-05-18T12:00:00Z');
    expect(entry.note).toBeNull();
  });

  it('drops rows whose removedAt is set (soft-deleted)', () => {
    const map = persistedTagsToManualTagEntries([
      row({ id: 'pt1', argumentId: 'a1', removedAt: null }),
      row({ id: 'pt2', argumentId: 'a1', removedAt: '2026-05-19T01:00:00Z' }),
    ]);
    expect(map.get('a1')).toHaveLength(1);
  });

  it('returns an empty map for empty input', () => {
    expect(persistedTagsToManualTagEntries([]).size).toBe(0);
  });

  it('returns an empty map for a non-array input (defensive)', () => {
    expect(persistedTagsToManualTagEntries(null as unknown as PersistedPointTag[]).size).toBe(0);
  });

  it('keeps two entries when two taggers apply the same code on one move', () => {
    const map = persistedTagsToManualTagEntries([
      row({ id: 'pt1', argumentId: 'a1', tagCode: 'needs_source', taggedBy: 'u1' }),
      row({ id: 'pt2', argumentId: 'a1', tagCode: 'needs_source', taggedBy: 'u2' }),
    ]);
    const entries = map.get('a1')!;
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((e) => e.dedupeKey)).size).toBe(2);
  });
});

// ── File-level safety ─────────────────────────────────────────

describe('pointTagsApi — file-level safety', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/features/metadata/pointTagsApi.ts'),
    'utf8',
  );

  it('imports no service-role / Anthropic key', () => {
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(src).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(src).not.toMatch(/createServiceClient/);
  });

  it('never writes point_tags directly — only invokes the Edge Function', () => {
    expect(src).not.toMatch(/\.from\(['"]point_tags['"]\)/);
    expect(src).toMatch(/supabase\.functions\.invoke(<[^>]*>)?\(\s*['"]apply-manual-tag['"]/);
  });

  it('never calls .delete() (soft-delete only)', () => {
    expect(src).not.toMatch(/\.delete\(/);
  });
});
