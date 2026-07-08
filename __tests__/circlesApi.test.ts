/**
 * START-002 (#839) — shared circles-read module tests (mocked Supabase).
 *
 * Asserts the frozen return contract (name + count + own-role; NO member
 * identities), the count/role client-side roll-up, the RLS-scoped read
 * strategy, and the doctrine posture (anon-key only; no service-role; no
 * member identity in the returned shape; SUPABASE_CONFIGURED guard).
 */
import fs from 'fs';
import path from 'path';

type QueryResult = { data: unknown; error: { message?: string } | null };

interface MockState {
  results: Record<string, QueryResult>;
  user: { id: string | null; error: { message?: string } | null };
  calls: Array<{ table: string; columns?: string; eqArgs: Array<[string, unknown]> }>;
}

const mockState: MockState = { results: {}, user: { id: 'me', error: null }, calls: [] };

jest.mock('../src/lib/supabase', () => {
  const settle = (table: string): QueryResult =>
    mockState.results[table] ?? { data: [], error: null };
  return {
    supabase: {
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: mockState.user.id ? { id: mockState.user.id } : null },
            error: mockState.user.error,
          }),
      },
      from: (table: string) => {
        const call: { table: string; columns?: string; eqArgs: Array<[string, unknown]> } = {
          table,
          eqArgs: [],
        };
        mockState.calls.push(call);
        const builder: Record<string, unknown> = {};
        builder.select = (cols?: string) => {
          if (typeof cols === 'string') call.columns = cols;
          return builder;
        };
        builder.eq = (col: string, val: unknown) => {
          call.eqArgs.push([col, val]);
          return builder;
        };
        builder.in = () => builder;
        builder.order = () => builder;
        builder.limit = () => settle(table);
        (builder as { then?: unknown }).then = (resolve: (r: QueryResult) => unknown) =>
          resolve(settle(table));
        return builder;
      },
    },
    SUPABASE_CONFIGURED: true,
  };
});

import { listMyCircles, type MyCircleSummary } from '../src/features/circles/circlesApi';

beforeEach(() => {
  mockState.results = {};
  mockState.user = { id: 'me', error: null };
  mockState.calls = [];
});

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'circles', 'circlesApi.ts'),
  'utf8',
);

describe('listMyCircles — return contract', () => {
  it('projects id + name + memberCount + caller-role, and NOTHING else', async () => {
    mockState.results['circles'] = {
      data: [{ id: 'c1', name: 'Book Club', created_at: '2026-07-01T00:00:00Z' }],
      error: null,
    };
    mockState.results['circle_members'] = {
      data: [
        { circle_id: 'c1', user_id: 'me', role: 'owner' },
        { circle_id: 'c1', user_id: 'other', role: 'member' },
      ],
      error: null,
    };

    const res = await listMyCircles();
    expect(res.ok).toBe(true);
    expect(res.data).toHaveLength(1);
    const summary = res.data![0];
    // The frozen identity-free contract: exactly these keys, no member ids.
    expect(Object.keys(summary).sort()).toEqual(['id', 'memberCount', 'name', 'role']);
    expect(summary).toEqual<MyCircleSummary>({
      id: 'c1',
      name: 'Book Club',
      memberCount: 2,
      role: 'owner',
    });
  });

  it('derives the caller role as member when the caller is not the owner', async () => {
    mockState.results['circles'] = {
      data: [{ id: 'c2', name: 'Study Group', created_at: '2026-07-02T00:00:00Z' }],
      error: null,
    };
    mockState.results['circle_members'] = {
      data: [
        { circle_id: 'c2', user_id: 'boss', role: 'owner' },
        { circle_id: 'c2', user_id: 'me', role: 'member' },
        { circle_id: 'c2', user_id: 'other', role: 'member' },
      ],
      error: null,
    };
    const res = await listMyCircles();
    expect(res.ok).toBe(true);
    expect(res.data![0]).toEqual({ id: 'c2', name: 'Study Group', memberCount: 3, role: 'member' });
  });

  it('returns an empty list (not an error) when the caller has no circles', async () => {
    mockState.results['circles'] = { data: [], error: null };
    const res = await listMyCircles();
    expect(res).toEqual({ ok: true, data: [] });
  });

  it('reads is_removed=false members and is_deleted=false circles (live only)', async () => {
    mockState.results['circles'] = {
      data: [{ id: 'c1', name: 'A', created_at: '2026-07-01T00:00:00Z' }],
      error: null,
    };
    mockState.results['circle_members'] = { data: [], error: null };
    await listMyCircles();
    const circlesCall = mockState.calls.find((c) => c.table === 'circles');
    const membersCall = mockState.calls.find((c) => c.table === 'circle_members');
    expect(circlesCall?.eqArgs).toContainEqual(['is_deleted', false]);
    expect(membersCall?.eqArgs).toContainEqual(['is_removed', false]);
  });

  it('surfaces a failed circles read as { ok: false }', async () => {
    mockState.results['circles'] = { data: null, error: { message: 'boom' } };
    const res = await listMyCircles();
    expect(res.ok).toBe(false);
    expect(res.error).toBe('boom');
  });

  it('returns { ok: false } when there is no signed-in caller', async () => {
    mockState.user = { id: null, error: null };
    const res = await listMyCircles();
    expect(res.ok).toBe(false);
  });
});

describe('listMyCircles — doctrine source scan', () => {
  it('never uses a service-role client or a SERVICE_ROLE key (anon-key only)', () => {
    expect(SRC).not.toMatch(/createServiceClient/);
    expect(SRC).not.toContain('SERVICE_ROLE');
    expect(SRC).toContain("from '../../lib/supabase'");
  });

  it('guards on SUPABASE_CONFIGURED before any read', () => {
    expect(SRC).toMatch(/if \(!SUPABASE_CONFIGURED\)/);
  });

  it('the MyCircleSummary interface exposes no member identity field', () => {
    const m = SRC.match(/export interface MyCircleSummary \{[\s\S]*?\}/);
    expect(m).not.toBeNull();
    const block = (m as RegExpMatchArray)[0].toLowerCase();
    // Scan FIELD declarations only (a `name:`-style line), so comment prose
    // ("live members …") never false-trips. Name + count + own-role only —
    // never a member id / email / roster field.
    expect(block).not.toMatch(/(memberids|member_ids|members|userid|user_id|email)\s*[?:]/);
  });

  it('never invokes an Edge Function or a write (SELECT-only reader)', () => {
    expect(SRC).not.toMatch(/functions\.invoke/);
    expect(SRC).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  });
});
