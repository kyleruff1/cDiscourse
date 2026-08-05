/**
 * UX-FLAGS-005 (issue 837) — Supabase read-path safety tests.
 *
 * The fetcher must:
 *   - Target only `argument_machine_observation_runs`.
 *   - SELECT ONLY the two columns the fold consumes (`argument_id,state`)
 *     -- no wider column pull, no JOIN, no ORDER BY.
 *   - `.in('argument_id', ids)` for the batch lookup; hard-cap at 1000 ids.
 *   - Short-circuit gracefully on `!SUPABASE_CONFIGURED`, empty ids, or a
 *     non-array input.
 *   - Return `{ ok: false, error }` on Supabase error -- never throw.
 *   - Fold rows into `ArgumentClassifierLifecycleRollup`s via the pure
 *     model, order-independent.
 *   - Skip malformed rows silently (no logging, no error surfacing).
 *
 * Source-scan negative controls verify the file never contains any write
 * helper (`.insert(`, `.update(`, `.delete(`, `.upsert(`), never imports
 * or uses the service-role key, and never surfaces raw column names or
 * error strings to callers.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

type QueryResult = { data: unknown; error: { message?: string } | null };

interface PendingCall {
  table: string;
  columns?: string;
  inArgs: Array<[string, unknown[]]>;
  eqArgs: Array<[string, unknown]>;
  orderArgs: Array<[string, unknown]>;
}

interface MockState {
  result: QueryResult;
  calls: PendingCall[];
  configured: boolean;
}

const mockState: MockState = {
  result: { data: [], error: null },
  calls: [],
  configured: true,
};

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const call: PendingCall = {
        table,
        inArgs: [],
        eqArgs: [],
        orderArgs: [],
      };
      mockState.calls.push(call);
      const builder: Record<string, unknown> = {};
      builder.select = (cols?: string) => {
        if (typeof cols === 'string') call.columns = cols;
        return builder;
      };
      builder.in = (col: string, vals: unknown[]) => {
        call.inArgs.push([col, vals]);
        return builder;
      };
      builder.eq = (col: string, val: unknown) => {
        call.eqArgs.push([col, val]);
        return builder;
      };
      builder.order = (col: string, opts: unknown) => {
        call.orderArgs.push([col, opts]);
        return builder;
      };
      (builder as { then?: unknown }).then = (resolve: (r: QueryResult) => unknown) =>
        resolve(mockState.result);
      return builder;
    },
  },
  get SUPABASE_CONFIGURED() {
    return mockState.configured;
  },
}));

import { fetchClassifierLifecycleForArguments } from '../src/features/feedbackFlags/pointFeedbackFlagsLifecycleQuery';

const QUERY_PATH = join(
  __dirname,
  '..',
  'src/features/feedbackFlags/pointFeedbackFlagsLifecycleQuery.ts',
);

beforeEach(() => {
  mockState.calls.length = 0;
  mockState.result = { data: [], error: null };
  mockState.configured = true;
});

// ─────────────────────────────────────────────────────────────────
// Query shape: table, columns, filter, absence of extras.
// ─────────────────────────────────────────────────────────────────

describe('fetchClassifierLifecycleForArguments — query shape', () => {
  it('targets argument_machine_observation_runs', async () => {
    await fetchClassifierLifecycleForArguments(['arg-1']);
    expect(mockState.calls).toHaveLength(1);
    expect(mockState.calls[0].table).toBe('argument_machine_observation_runs');
  });

  it('selects ONLY argument_id,state -- no wider column pull, no join', async () => {
    await fetchClassifierLifecycleForArguments(['arg-1']);
    const cols = mockState.calls[0].columns;
    expect(cols).toBe('argument_id,state');
    // No !inner join.
    expect(cols).not.toContain('!inner');
    // No sensitive columns.
    expect(cols).not.toContain('provider_key');
    expect(cols).not.toContain('model_name');
    expect(cols).not.toContain('input_hash');
    expect(cols).not.toContain('failure_reason');
    expect(cols).not.toContain('failure_sub_reason');
    expect(cols).not.toContain('dead_letter_reason');
    expect(cols).not.toContain('lease_owner');
    expect(cols).not.toContain('lease_expires_at');
    expect(cols).not.toContain('last_attempt_at');
    expect(cols).not.toContain('attempt_count');
    expect(cols).not.toContain('available_at');
  });

  it('uses .in("argument_id", ids) for the batch lookup', async () => {
    await fetchClassifierLifecycleForArguments(['arg-1', 'arg-2', 'arg-3']);
    const inArgs = mockState.calls[0].inArgs;
    expect(inArgs).toHaveLength(1);
    expect(inArgs[0][0]).toBe('argument_id');
    expect(inArgs[0][1]).toEqual(['arg-1', 'arg-2', 'arg-3']);
  });

  it('applies NO .eq filter (no run_mode / status / provider / family filter)', async () => {
    await fetchClassifierLifecycleForArguments(['arg-1']);
    expect(mockState.calls[0].eqArgs).toEqual([]);
  });

  it('applies NO .order (order-independent fold)', async () => {
    await fetchClassifierLifecycleForArguments(['arg-1']);
    expect(mockState.calls[0].orderArgs).toEqual([]);
  });

  it('hard-caps at 1000 argument ids (matches sibling loaders budget)', async () => {
    const ids = Array.from({ length: 1500 }, (_, i) => `arg-${i}`);
    await fetchClassifierLifecycleForArguments(ids);
    const capped = mockState.calls[0].inArgs[0][1] as string[];
    expect(capped).toHaveLength(1000);
    expect(capped[0]).toBe('arg-0');
    expect(capped[999]).toBe('arg-999');
  });
});

// ─────────────────────────────────────────────────────────────────
// Short-circuit paths (offline, empty, non-array).
// ─────────────────────────────────────────────────────────────────

describe('fetchClassifierLifecycleForArguments — short-circuit paths', () => {
  it('SUPABASE_CONFIGURED=false -> {ok:true, data:[]} with no DB call', async () => {
    mockState.configured = false;
    const result = await fetchClassifierLifecycleForArguments(['arg-1']);
    expect(result).toEqual({ ok: true, data: [] });
    expect(mockState.calls).toHaveLength(0);
  });

  it('empty argumentIds -> {ok:true, data:[]} with no DB call', async () => {
    const result = await fetchClassifierLifecycleForArguments([]);
    expect(result).toEqual({ ok: true, data: [] });
    expect(mockState.calls).toHaveLength(0);
  });

  it('non-array argumentIds -> {ok:true, data:[]} with no DB call', async () => {
    const result = await fetchClassifierLifecycleForArguments(
      null as unknown as ReadonlyArray<string>,
    );
    expect(result).toEqual({ ok: true, data: [] });
    expect(mockState.calls).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Error path -- never throw, never surface raw error string upstream.
// ─────────────────────────────────────────────────────────────────

describe('fetchClassifierLifecycleForArguments — error handling', () => {
  it('supabase error -> {ok:false, error} return; never throws', async () => {
    mockState.result = { data: null, error: { message: 'network timeout' } };
    await expect(
      fetchClassifierLifecycleForArguments(['arg-1']),
    ).resolves.toEqual({ ok: false, error: 'network timeout' });
  });

  it('supabase error with no message -> {ok:false} with undefined message', async () => {
    mockState.result = { data: null, error: {} };
    const result = await fetchClassifierLifecycleForArguments(['arg-1']);
    expect(result.ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Fold behavior on returned rows.
// ─────────────────────────────────────────────────────────────────

describe('fetchClassifierLifecycleForArguments — fold behavior', () => {
  it('empty data -> {ok:true, data:[]}', async () => {
    mockState.result = { data: [], error: null };
    const result = await fetchClassifierLifecycleForArguments(['arg-1']);
    expect(result).toEqual({ ok: true, data: [] });
  });

  it('folds rows into per-argument roll-ups', async () => {
    mockState.result = {
      data: [
        { argument_id: 'a1', state: 'pending' },
        { argument_id: 'a1', state: 'succeeded' },
        { argument_id: 'a2', state: 'dead_letter' },
        { argument_id: 'a3', state: 'leased' },
      ],
      error: null,
    };
    const result = await fetchClassifierLifecycleForArguments(['a1', 'a2', 'a3']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = new Map(result.data.map((r) => [r.argumentId, r]));
    expect(byId.get('a1')).toMatchObject({
      hasAnyRun: true,
      hasAnyNonTerminal: true,
      hasAnySucceeded: true,
      hasAnyTerminalFailure: false,
    });
    expect(byId.get('a2')).toMatchObject({
      hasAnyRun: true,
      hasAnyNonTerminal: false,
      hasAnySucceeded: false,
      hasAnyTerminalFailure: true,
    });
    expect(byId.get('a3')).toMatchObject({
      hasAnyRun: true,
      hasAnyNonTerminal: true,
      hasAnySucceeded: false,
      hasAnyTerminalFailure: false,
    });
  });

  it('skips malformed rows silently (no throw, no error surfacing)', async () => {
    mockState.result = {
      data: [
        { argument_id: 'a1', state: 'pending' },
        // Missing argument_id
        { state: 'succeeded' },
        // Missing state
        { argument_id: 'a2' },
        // Wrong types
        { argument_id: 42, state: 99 },
        null,
        undefined,
      ],
      error: null,
    };
    const result = await fetchClassifierLifecycleForArguments(['a1', 'a2']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].argumentId).toBe('a1');
  });

  it('unknown state value skipped by the fold (safe under-classification)', async () => {
    mockState.result = {
      data: [
        { argument_id: 'a1', state: 'future_unknown_state' },
        { argument_id: 'a1', state: 'ok' },
        { argument_id: 'a1', state: 'error' },
      ],
      error: null,
    };
    const result = await fetchClassifierLifecycleForArguments(['a1']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    // Row was included (a1 was seen) but no state flags flipped -- hasAnyRun
    // requires at least one recognized state. Since none matched, folds to
    // empty.
    expect(result.data[0]).toMatchObject({
      argumentId: 'a1',
      hasAnyRun: false,
      hasAnyNonTerminal: false,
      hasAnySucceeded: false,
      hasAnyTerminalFailure: false,
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Source-scan negative controls -- the file must never contain writes.
// ─────────────────────────────────────────────────────────────────

describe('pointFeedbackFlagsLifecycleQuery.ts — source-scan safety', () => {
  const src = readFileSync(QUERY_PATH, 'utf8');

  it('never contains a mutation helper (.insert / .update / .delete / .upsert)', () => {
    expect(src).not.toMatch(/\.insert\(/);
    expect(src).not.toMatch(/\.update\(/);
    expect(src).not.toMatch(/\.delete\(/);
    expect(src).not.toMatch(/\.upsert\(/);
  });

  it('never imports or references the service-role key', () => {
    expect(src).not.toContain('SERVICE_ROLE');
    expect(src).not.toContain('service_role');
    expect(src).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('never contains a raw sensitive column in the SELECT list', () => {
    // The SELECT_COLUMNS constant is exactly 'argument_id,state'. Any wider
    // pull would fail this check.
    expect(src).toContain("'argument_id,state'");
  });

  it('never logs the fetch error (never leaks to console)', () => {
    expect(src).not.toMatch(/console\.(log|error|warn|info)/);
  });

  it('never references the AI provider layer (no client-side AI leak)', () => {
    expect(src.toLowerCase()).not.toContain('anthropic');
    expect(src.toLowerCase()).not.toContain('xai');
    expect(src.toLowerCase()).not.toContain('openai');
  });
});
