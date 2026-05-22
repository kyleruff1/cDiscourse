/**
 * QOL-042 — argumentRoomLinksApi tests (mocked Supabase).
 *
 * Covers the call shape + access-state derivation of the four wrappers,
 * the idempotent-duplicate path, the soft-remove-only update, and the
 * source-file safety contracts (no service-role, no submit-argument, no
 * direct insert into public.arguments).
 *
 * The supabase module is mocked: a chainable query builder whose terminal
 * result per table is swapped via the module-scoped `mockState`.
 */
import * as fs from 'fs';
import * as path from 'path';

type QueryResult = { data: unknown; error: { message?: string; code?: string } | null };

interface PendingCall {
  table: string;
  op: 'select' | 'insert' | 'update';
  payload?: unknown;
  eqArgs: Array<[string, unknown]>;
}

interface MockState {
  /** Result keyed by `${table}:${op}` — falls back to `${table}`. */
  results: Record<string, QueryResult>;
  calls: PendingCall[];
}

const mockState: MockState = {
  results: {},
  calls: [],
};

jest.mock('../src/lib/supabase', () => {
  // `resolveResult` is declared INSIDE the factory so the factory
  // references no out-of-scope variable (jest only allows `mock`-prefixed
  // ones). `mockState` is `mock`-prefixed, so it is permitted.
  const resolveResult = (table: string, op: string): QueryResult =>
    mockState.results[`${table}:${op}`] ??
    mockState.results[table] ?? { data: null, error: null };
  return {
    supabase: {
      from: (table: string) => {
        const call: PendingCall = { table, op: 'select', eqArgs: [] };
        mockState.calls.push(call);
        const builder: Record<string, unknown> = {};
        const settle = () => Promise.resolve(resolveResult(call.table, call.op));
        builder.select = () => builder;
        builder.insert = (payload: unknown) => {
          call.op = 'insert';
          call.payload = payload;
          return builder;
        };
        builder.update = (payload: unknown) => {
          call.op = 'update';
          call.payload = payload;
          return builder;
        };
        builder.eq = (col: string, val: unknown) => {
          call.eqArgs.push([col, val]);
          return builder;
        };
        builder.order = () => builder;
        builder.single = () => settle();
        builder.maybeSingle = () => settle();
        // Thenable so a non-terminated chain (e.g. `.select().eq().eq()`)
        // can be awaited directly.
        (builder as { then?: unknown }).then = (resolve: (r: QueryResult) => unknown) =>
          resolve(resolveResult(call.table, call.op));
        return builder;
      },
    },
    SUPABASE_CONFIGURED: true,
  };
});

import {
  createArgumentRoomLink,
  isDuplicateLinkError,
  listLinksForRoom,
  loadPriorRoomContext,
  removeArgumentRoomLink,
  MAX_LINK_NOTE_CHARS,
  MAX_TARGET_TITLE_SNAPSHOT_CHARS,
} from '../src/features/arguments/crossRoom/argumentRoomLinksApi';

const repoRoot = process.cwd();
const apiSrc = fs.readFileSync(
  path.join(repoRoot, 'src/features/arguments/crossRoom/argumentRoomLinksApi.ts'),
  'utf8',
);

/**
 * `apiSrc` with comments stripped — for behaviour scans where the doc
 * comment legitimately states a negation ("submit-argument is never
 * called from this module").
 */
const apiCode = apiSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

beforeEach(() => {
  mockState.results = {};
  mockState.calls = [];
});

function linkRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'link-1',
    source_debate_id: 'room-new',
    target_debate_id: 'room-prior',
    created_by: 'user-a',
    target_title_snapshot: 'Prior room title',
    note: '',
    is_removed: false,
    created_at: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

// ── isDuplicateLinkError ───────────────────────────────────────

describe('isDuplicateLinkError', () => {
  it('is true for a 23505 unique-violation', () => {
    expect(isDuplicateLinkError({ code: '23505' })).toBe(true);
  });
  it('is false for other / missing codes', () => {
    expect(isDuplicateLinkError({ code: '23503' })).toBe(false);
    expect(isDuplicateLinkError(null)).toBe(false);
    expect(isDuplicateLinkError(undefined)).toBe(false);
  });
});

// ── listLinksForRoom ───────────────────────────────────────────

describe('listLinksForRoom', () => {
  it('selects active links for the source room and maps the rows', async () => {
    mockState.results['argument_room_links'] = {
      data: [linkRow(), linkRow({ id: 'link-2' })],
      error: null,
    };
    const res = await listLinksForRoom('room-new');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(2);
      expect(res.data[0].sourceDebateId).toBe('room-new');
    }
    const call = mockState.calls.find((c) => c.table === 'argument_room_links');
    expect(call?.eqArgs).toEqual(
      expect.arrayContaining([
        ['source_debate_id', 'room-new'],
        ['is_removed', false],
      ]),
    );
  });

  it('returns an error envelope when the query fails', async () => {
    mockState.results['argument_room_links'] = {
      data: null,
      error: { message: 'boom' },
    };
    const res = await listLinksForRoom('room-new');
    expect(res.ok).toBe(false);
  });

  it('requires a sourceDebateId', async () => {
    const res = await listLinksForRoom('');
    expect(res.ok).toBe(false);
  });
});

// ── createArgumentRoomLink ─────────────────────────────────────

describe('createArgumentRoomLink', () => {
  it('inserts with created_by set to the caller', async () => {
    mockState.results['argument_room_links:insert'] = { data: linkRow(), error: null };
    const res = await createArgumentRoomLink({
      sourceDebateId: 'room-new',
      targetDebateId: 'room-prior',
      targetTitleSnapshot: 'Prior room title',
      createdBy: 'user-a',
    });
    expect(res.ok).toBe(true);
    const call = mockState.calls.find((c) => c.op === 'insert');
    expect(call?.payload).toMatchObject({
      source_debate_id: 'room-new',
      target_debate_id: 'room-prior',
      created_by: 'user-a',
    });
  });

  it('refuses a self-link before any network call', async () => {
    const res = await createArgumentRoomLink({
      sourceDebateId: 'room-x',
      targetDebateId: 'room-x',
      targetTitleSnapshot: 't',
      createdBy: 'user-a',
    });
    expect(res.ok).toBe(false);
    expect(mockState.calls).toHaveLength(0);
  });

  it('trims + clamps the snapshot title and note to their max lengths', async () => {
    mockState.results['argument_room_links:insert'] = { data: linkRow(), error: null };
    await createArgumentRoomLink({
      sourceDebateId: 'room-new',
      targetDebateId: 'room-prior',
      targetTitleSnapshot: 'x'.repeat(MAX_TARGET_TITLE_SNAPSHOT_CHARS + 50),
      note: 'y'.repeat(MAX_LINK_NOTE_CHARS + 50),
      createdBy: 'user-a',
    });
    const call = mockState.calls.find((c) => c.op === 'insert');
    const payload = call?.payload as { target_title_snapshot: string; note: string };
    expect(payload.target_title_snapshot.length).toBe(MAX_TARGET_TITLE_SNAPSHOT_CHARS);
    expect(payload.note.length).toBe(MAX_LINK_NOTE_CHARS);
  });

  it('treats a duplicate-link conflict as idempotent success', async () => {
    mockState.results['argument_room_links:insert'] = {
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    };
    // The follow-up fetch of the existing row resolves via `.select()`.
    mockState.results['argument_room_links:select'] = {
      data: linkRow({ id: 'existing-link' }),
      error: null,
    };
    const res = await createArgumentRoomLink({
      sourceDebateId: 'room-new',
      targetDebateId: 'room-prior',
      targetTitleSnapshot: 't',
      createdBy: 'user-a',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.id).toBe('existing-link');
  });

  it('surfaces a trigger rejection (target not settled) as an error', async () => {
    mockState.results['argument_room_links:insert'] = {
      data: null,
      error: { message: 'a prior argument can only be linked once it is settled' },
    };
    const res = await createArgumentRoomLink({
      sourceDebateId: 'room-new',
      targetDebateId: 'room-prior',
      targetTitleSnapshot: 't',
      createdBy: 'user-a',
    });
    expect(res.ok).toBe(false);
  });
});

// ── removeArgumentRoomLink ─────────────────────────────────────

describe('removeArgumentRoomLink', () => {
  it('updates ONLY is_removed = true (soft-remove)', async () => {
    mockState.results['argument_room_links:update'] = { data: { id: 'link-1' }, error: null };
    const res = await removeArgumentRoomLink('link-1');
    expect(res.ok).toBe(true);
    const call = mockState.calls.find((c) => c.op === 'update');
    expect(call?.payload).toEqual({ is_removed: true });
  });

  it('returns an error when no row was updated (not the author)', async () => {
    mockState.results['argument_room_links:update'] = { data: null, error: null };
    const res = await removeArgumentRoomLink('link-1');
    expect(res.ok).toBe(false);
  });

  it('requires a linkId', async () => {
    const res = await removeArgumentRoomLink('');
    expect(res.ok).toBe(false);
  });
});

// ── loadPriorRoomContext ───────────────────────────────────────

describe('loadPriorRoomContext', () => {
  it('sets accessState = authorized when argument rows return', async () => {
    mockState.results['debates'] = {
      data: { id: 'room-prior', title: 'Prior title', status: 'locked' },
      error: null,
    };
    mockState.results['arguments'] = {
      data: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
      error: null,
    };
    const res = await loadPriorRoomContext('room-prior');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.accessState).toBe('authorized');
      expect(res.data.summary.liveTitle).toBe('Prior title');
      expect(res.data.summary.moveCount).toBe(3);
    }
  });

  it('sets accessState = title_only when zero argument rows but the debates row resolved', async () => {
    mockState.results['debates'] = {
      data: { id: 'room-prior', title: 'Private title', status: 'locked' },
      error: null,
    };
    mockState.results['arguments'] = { data: [], error: null };
    const res = await loadPriorRoomContext('room-prior');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.accessState).toBe('title_only');
      expect(res.data.summary.moveCount).toBeNull();
    }
  });

  it('sets accessState = unavailable when neither the debates row nor arguments resolve', async () => {
    mockState.results['debates'] = { data: null, error: null };
    mockState.results['arguments'] = { data: [], error: null };
    const res = await loadPriorRoomContext('room-prior');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.accessState).toBe('unavailable');
  });

  it('returns an error envelope when the debates read fails', async () => {
    mockState.results['debates'] = { data: null, error: { message: 'rls denied' } };
    const res = await loadPriorRoomContext('room-prior');
    expect(res.ok).toBe(false);
  });
});

// ── Source-file safety ─────────────────────────────────────────

describe('argumentRoomLinksApi — source-file safety', () => {
  it('uses the shared supabase client (no service-role construction)', () => {
    expect(apiSrc).toContain("from '../../../lib/supabase'");
    expect(apiSrc).not.toMatch(/createClient\(/);
  });

  it('references no service-role / secret-shape strings', () => {
    expect(apiSrc).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(apiSrc).not.toMatch(/serviceRoleKey/);
    expect(apiSrc).not.toMatch(/sb_secret_[A-Za-z0-9]/);
    expect(apiSrc).not.toMatch(/ANTHROPIC_API_KEY/);
  });

  it('never calls submit-argument and never inserts into public.arguments', () => {
    // Behaviour scan over comment-stripped code — the doc comment
    // legitimately says "submit-argument is never called from this module".
    expect(apiCode).not.toContain('submit-argument');
    expect(apiCode).not.toMatch(/functions\.invoke\(/);
    expect(apiCode).not.toMatch(/\.from\(['"]arguments['"]\)\s*[\s\S]{0,40}\.insert\(/);
  });

  it('soft-removes only — no .delete() call', () => {
    expect(apiCode).not.toMatch(/\.delete\(/);
  });

  it('reads arguments only with a posted-status filter (RLS-friendly)', () => {
    expect(apiSrc).toContain(".from('arguments')");
    expect(apiSrc).toMatch(/\.eq\('status', 'posted'\)/);
  });

  it('imports no AI / network provider', () => {
    expect(apiCode).not.toMatch(/anthropic/i);
    expect(apiCode).not.toMatch(/openai/i);
    expect(apiCode).not.toMatch(/\bfetch\(/);
  });
});
