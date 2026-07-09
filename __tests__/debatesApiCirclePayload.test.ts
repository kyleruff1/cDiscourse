/**
 * START-002 (#839) — debatesApi circle payload threading (mocked Supabase).
 *
 * Proves `createArgumentRoom` threads `circle_id` into the Edge invoke body
 * ONLY when a circleId is supplied — a non-circle create body is byte-identical
 * to today (no `circle_id` key). Also proves `createDebate` forwards the circle
 * audience through the same atomic call.
 */

type QueryResult = { data: unknown; error: { message?: string; code?: string } | null };

interface MockState {
  results: Record<string, QueryResult>;
  invokeResult: { data: unknown; error: { message?: string } | null };
  invokes: Array<{ fn: string; body: unknown }>;
}

const mockState: MockState = {
  results: {},
  invokeResult: { data: null, error: null },
  invokes: [],
};

jest.mock('../src/lib/supabase', () => {
  const resolve = (table: string): QueryResult => mockState.results[table] ?? { data: null, error: null };
  return {
    supabase: {
      from: (table: string) => {
        const builder: Record<string, unknown> = {};
        const settle = () => Promise.resolve(resolve(table));
        builder.select = () => builder;
        builder.eq = () => builder;
        builder.single = () => settle();
        builder.maybeSingle = () => settle();
        (builder as { then?: unknown }).then = (r: (v: QueryResult) => unknown) => r(resolve(table));
        return builder;
      },
      functions: {
        invoke: (fn: string, opts: { body?: unknown }) => {
          mockState.invokes.push({ fn, body: opts?.body });
          return Promise.resolve(mockState.invokeResult);
        },
      },
    },
    SUPABASE_CONFIGURED: true,
  };
});

import { createArgumentRoom, createDebate } from '../src/features/debates/debatesApi';
import type { CreateDebateInput } from '../src/features/debates/types';

beforeEach(() => {
  mockState.results = {};
  mockState.invokeResult = { data: null, error: null };
  mockState.invokes = [];
});

function lastCreateBody(): Record<string, unknown> {
  const call = mockState.invokes.find((i) => i.fn === 'create-argument-room');
  return (call?.body ?? {}) as Record<string, unknown>;
}

describe('createArgumentRoom — circle_id threading', () => {
  it('adds circle_id to the invoke body when circleId is supplied', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd1', visibility: 'private', inviteId: null, inviteLink: null, circleId: 'c1' },
      error: null,
    };
    await createArgumentRoom({
      title: 'T',
      resolution: 'R',
      visibility: 'private',
      circleId: 'c1',
    });
    const body = lastCreateBody();
    expect(body.circle_id).toBe('c1');
    // A circle create carries no invite key.
    expect(body).not.toHaveProperty('invite');
  });

  it('omits circle_id entirely for a non-circle create (byte-shape preserved)', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd2', visibility: 'public', inviteId: null, inviteLink: null },
      error: null,
    };
    await createArgumentRoom({ title: 'T', resolution: 'R', visibility: 'public' });
    const body = lastCreateBody();
    expect(body).not.toHaveProperty('circle_id');
    expect(Object.keys(body).sort()).toEqual(['description', 'resolution', 'title', 'visibility']);
  });

  it('round-trips circleId out of a circle-path 200', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd1', visibility: 'private', inviteId: null, inviteLink: null, circleId: 'c1' },
      error: null,
    };
    const res = await createArgumentRoom({ title: 'T', resolution: 'R', visibility: 'private', circleId: 'c1' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.circleId).toBe('c1');
  });
});

describe('createDebate — forwards the circle audience', () => {
  it('threads circleId into the create-argument-room invoke and loads the room', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd1', visibility: 'private', inviteId: null, inviteLink: null, circleId: 'c1' },
      error: null,
    };
    mockState.results['debates'] = {
      data: {
        id: 'd1',
        created_by: 'me',
        title: 'T',
        resolution: 'R',
        description: '',
        status: 'open',
        constitution_id: 'k1',
        created_at: '2026-07-08T00:00:00Z',
        updated_at: '2026-07-08T00:00:00Z',
        visibility: 'private',
        inactive_at: null,
      },
      error: null,
    };
    const input: CreateDebateInput = {
      title: 'T',
      resolution: 'R',
      description: '',
      visibility: 'private',
      circleId: 'c1',
    };
    const res = await createDebate(input, 'me');
    expect(res.ok).toBe(true);
    expect(lastCreateBody().circle_id).toBe('c1');
    // No invite fan-out on the circle path.
    expect(lastCreateBody()).not.toHaveProperty('invite');
  });

  it('a non-circle createDebate never threads circle_id', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd2', visibility: 'public', inviteId: null, inviteLink: null },
      error: null,
    };
    mockState.results['debates'] = {
      data: {
        id: 'd2',
        created_by: 'me',
        title: 'T',
        resolution: 'R',
        description: '',
        status: 'open',
        constitution_id: 'k1',
        created_at: '2026-07-08T00:00:00Z',
        updated_at: '2026-07-08T00:00:00Z',
        visibility: 'public',
        inactive_at: null,
      },
      error: null,
    };
    await createDebate({ title: 'T', resolution: 'R', description: '', visibility: 'public' }, 'me');
    expect(lastCreateBody()).not.toHaveProperty('circle_id');
  });
});
