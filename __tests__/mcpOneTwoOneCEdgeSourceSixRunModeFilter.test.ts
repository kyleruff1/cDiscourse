/**
 * MCP-021C-EDGE — Test: persistence query filters run_mode = 'production'.
 *
 * Pure-TS test of the bounded edit to
 * `src/features/nodeLabels/machineObservationPersistenceQuery.ts`. The
 * query now uses a PostgREST `!inner` join on
 * `argument_machine_observation_runs` and filters
 * `runs.run_mode = 'production'`.
 *
 * Doctrine:
 *   - Admin-validation rows are real persisted rows that NEVER reach
 *     Source 6 in the production UI (per design §8).
 *   - The MCP-021A Source 6 byte-equal-on-empty-input invariance is
 *     preserved — this query returns rows BEFORE they reach the adapter;
 *     the adapter's contract on empty input is unchanged.
 *   - The query layer is the documented preferred location for the filter
 *     (per Decision 9), not the adapter layer.
 */

type QueryResult = { data: unknown; error: { message?: string } | null };

interface PendingCall {
  table: string;
  columns?: string;
  inArgs: Array<[string, unknown[]]>;
  eqArgs: Array<[string, unknown]>;
}

interface MockState {
  result: QueryResult;
  calls: PendingCall[];
}

const mockState: MockState = {
  result: { data: [], error: null },
  calls: [],
};

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const call: PendingCall = { table, inArgs: [], eqArgs: [] };
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
      (builder as { then?: unknown }).then = (resolve: (r: QueryResult) => unknown) =>
        resolve(mockState.result);
      return builder;
    },
  },
  SUPABASE_CONFIGURED: true,
}));

import { fetchPersistedObservationsForArguments } from '../src/features/nodeLabels/machineObservationPersistenceQuery';

beforeEach(() => {
  mockState.calls.length = 0;
  mockState.result = { data: [], error: null };
});

describe('MCP-021C-EDGE — query filters run_mode = production', () => {
  it('S6F-1 — query targets argument_machine_observation_results table', async () => {
    await fetchPersistedObservationsForArguments(['arg-1']);
    expect(mockState.calls).toHaveLength(1);
    expect(mockState.calls[0].table).toBe('argument_machine_observation_results');
  });

  it('S6F-2 — SELECT columns include argument_machine_observation_runs!inner(run_mode)', async () => {
    await fetchPersistedObservationsForArguments(['arg-1']);
    const cols = mockState.calls[0].columns;
    expect(cols).toBeDefined();
    expect(cols).toContain('argument_machine_observation_runs!inner(run_mode)');
  });

  it('S6F-3 — SELECT columns still include the existing result row columns', async () => {
    await fetchPersistedObservationsForArguments(['arg-1']);
    const cols = mockState.calls[0].columns;
    expect(cols).toBeDefined();
    // The result-row interface columns must remain in the select; only
    // the join was added, not a column replacement.
    expect(cols).toContain('id');
    expect(cols).toContain('run_id');
    expect(cols).toContain('debate_id');
    expect(cols).toContain('argument_id');
    expect(cols).toContain('schema_version');
    expect(cols).toContain('raw_key');
    expect(cols).toContain('family');
    expect(cols).toContain('confidence');
    expect(cols).toContain('evidence_span');
    expect(cols).toContain('created_at');
  });

  it('S6F-4 — query applies .eq("argument_machine_observation_runs.run_mode", "production")', async () => {
    await fetchPersistedObservationsForArguments(['arg-1', 'arg-2']);
    const eqArgs = mockState.calls[0].eqArgs;
    const filter = eqArgs.find(([col]) => col === 'argument_machine_observation_runs.run_mode');
    expect(filter).toBeDefined();
    expect(filter![1]).toBe('production');
  });

  it('S6F-5 — query NEVER filters by admin_validation', async () => {
    await fetchPersistedObservationsForArguments(['arg-1']);
    const eqArgs = mockState.calls[0].eqArgs;
    for (const [, val] of eqArgs) {
      expect(val).not.toBe('admin_validation');
    }
  });

  it('S6F-6 — query uses .in("argument_id", ids) for the batch lookup', async () => {
    await fetchPersistedObservationsForArguments(['arg-1', 'arg-2']);
    const inArgs = mockState.calls[0].inArgs;
    expect(inArgs).toHaveLength(1);
    expect(inArgs[0][0]).toBe('argument_id');
    expect(inArgs[0][1]).toEqual(['arg-1', 'arg-2']);
  });
});

describe('MCP-021C-EDGE — query mapping drops the joined runs object', () => {
  it('S6F-7 — production-mode rows are mapped to MachineObservationResultRow shape', async () => {
    mockState.result = {
      data: [
        {
          id: 'res-1',
          run_id: 'run-1',
          debate_id: 'deb-1',
          argument_id: 'arg-1',
          schema_version: 'mcp-021.machine-observations.boolean.v1',
          raw_key: 'has_rebuttal',
          family: 'parent_relation',
          confidence: 'high',
          evidence_span: null,
          created_at: '2026-05-26T00:00:00.000Z',
          // PostgREST joined row attached under the relationship key.
          argument_machine_observation_runs: { run_mode: 'production' },
        },
      ],
      error: null,
    };
    const result = await fetchPersistedObservationsForArguments(['arg-1']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    const row = result.data[0];
    // The joined runs object is dropped — the result row shape is byte-equal
    // to MCP-021B's MachineObservationResultRow.
    expect((row as unknown as Record<string, unknown>).argument_machine_observation_runs).toBeUndefined();
    expect(row.runId).toBe('run-1');
    expect(row.rawKey).toBe('has_rebuttal');
    expect(row.family).toBe('parent_relation');
    expect(row.confidence).toBe('high');
  });
});

describe('MCP-021C-EDGE — query short-circuits unchanged', () => {
  it('S6F-8 — empty argumentIds short-circuits with no DB call (no calls recorded)', async () => {
    const result = await fetchPersistedObservationsForArguments([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
    // No supabase.from() call should have happened.
    expect(mockState.calls).toHaveLength(0);
  });

  it('S6F-9 — non-array argumentIds short-circuits gracefully', async () => {
    const result = await fetchPersistedObservationsForArguments(null as unknown as string[]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
    expect(mockState.calls).toHaveLength(0);
  });
});

describe('MCP-021C-EDGE — error path unchanged', () => {
  it('S6F-10 — Supabase error surfaces as { ok: false, error }', async () => {
    mockState.result = { data: null, error: { message: 'rls_denied' } };
    const result = await fetchPersistedObservationsForArguments(['arg-1']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('rls_denied');
  });
});

describe('MCP-021C-EDGE — caps preserved (1000 id budget)', () => {
  it('S6F-11 — caps the .in() argument list at 1000 ids', async () => {
    const ids = Array.from({ length: 1500 }, (_, i) => `arg-${i}`);
    await fetchPersistedObservationsForArguments(ids);
    expect(mockState.calls).toHaveLength(1);
    const inEntry = mockState.calls[0].inArgs[0];
    expect((inEntry[1] as unknown[]).length).toBe(1000);
  });
});
