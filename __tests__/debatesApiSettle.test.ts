/**
 * SETTLE-001 (#911) — settleDebate / reopenDebate direct RLS UPDATE contract.
 *
 * The write lane is a plain client UPDATE gated by the existing
 * "debates: creator or mod can update" RLS policy (the joinDebate precedent,
 * NOT the QOL-039 Edge precedent). Mocks the supabase query builder and
 * asserts the exact call shape + status-only payload + error path. No Edge,
 * no service-role, no second table.
 */
import * as fs from 'fs';
import * as path from 'path';

const mockEq = jest.fn();
const mockUpdate = jest.fn((_payload: Record<string, unknown>) => ({ eq: mockEq }));
const mockFrom = jest.fn((_table: string) => ({ update: mockUpdate }));

jest.mock('../src/lib/supabase', () => ({
  // Lazy wrapper — jest hoists jest.mock above the const, so reference mockFrom
  // at call time (not capture it undefined at factory-eval time).
  supabase: { from: (table: string) => mockFrom(table) },
  SUPABASE_CONFIGURED: true,
}));

import { settleDebate, reopenDebate } from '../src/features/debates/debatesApi';

beforeEach(() => {
  mockFrom.mockClear();
  mockUpdate.mockClear();
  mockEq.mockReset();
});

describe('settleDebate — direct RLS UPDATE call shape', () => {
  it('updates debates.status to locked scoped by id and returns ok', async () => {
    mockEq.mockResolvedValue({ error: null });
    const result = await settleDebate('room-1');
    expect(mockFrom).toHaveBeenCalledWith('debates');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'locked' });
    expect(mockEq).toHaveBeenCalledWith('id', 'room-1');
    expect(result).toEqual({ ok: true, data: { status: 'locked' } });
  });

  it('writes ONLY status (never visibility) — the trigger never fires', async () => {
    mockEq.mockResolvedValue({ error: null });
    await settleDebate('room-1');
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({ status: 'locked' });
    expect(Object.keys(payload)).not.toContain('visibility');
  });

  it('surfaces the raw error message on RLS/network failure (hook maps to neutral)', async () => {
    mockEq.mockResolvedValue({ error: { message: 'permission denied' } });
    const result = await settleDebate('room-1');
    expect(result).toEqual({ ok: false, error: 'permission denied' });
  });

  it('chains no .select() after update — the mocked builder exposes only eq', async () => {
    // The mock update() returns a builder with ONLY `eq`; a happy return here
    // proves settleDebate never chains `.select()` (which would be undefined
    // on the builder and throw). The code returns the known status directly.
    mockEq.mockResolvedValue({ error: null });
    await expect(settleDebate('room-1')).resolves.toEqual({ ok: true, data: { status: 'locked' } });
    expect(Object.keys(mockUpdate.mock.results[0].value as object)).toEqual(['eq']);
  });
});

describe('reopenDebate — direct RLS UPDATE call shape', () => {
  it('updates debates.status to open scoped by id and returns ok', async () => {
    mockEq.mockResolvedValue({ error: null });
    const result = await reopenDebate('room-2');
    expect(mockFrom).toHaveBeenCalledWith('debates');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'open' });
    expect(mockEq).toHaveBeenCalledWith('id', 'room-2');
    expect(result).toEqual({ ok: true, data: { status: 'open' } });
  });

  it('surfaces the raw error message on failure', async () => {
    mockEq.mockResolvedValue({ error: { message: 'nope' } });
    const result = await reopenDebate('room-2');
    expect(result).toEqual({ ok: false, error: 'nope' });
  });
});

describe('settle/reopen lane — file-level safety (no Edge, no service-role)', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/features/debates/debatesApi.ts'),
    'utf8',
  );

  it('the settle path is a direct debates UPDATE, not an Edge invoke', () => {
    expect(src).toMatch(/\.update\(\{ status: 'locked' \}\)/);
    expect(src).toMatch(/\.update\(\{ status: 'open' \}\)/);
  });

  it('imports no service-role client', () => {
    expect(src).not.toMatch(/SERVICE_ROLE/);
    expect(src).not.toMatch(/createServiceClient/);
  });
});
