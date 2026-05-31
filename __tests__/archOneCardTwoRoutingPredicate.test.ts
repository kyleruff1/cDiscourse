/**
 * ARCH-001 Card 2 — Queue routing predicate + enqueue (PURE behavioral).
 *
 * classifierQueueRouting.ts imports only pure modules (familyRegistry,
 * mcpBooleanObservationSchema) + a type, so it is Jest-importable and gets
 * REAL behavioral tests. Covers intent-brief tests (a) (smoke-route enqueues
 * per A–G), the DEFAULT-DISABLED contract, and (j) (H/I/J never enqueued).
 */
import {
  shouldRouteToQueue,
  enqueueClassifierJobs,
  CLASSIFIER_QUEUE_SMOKE_TAG,
  CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV,
  productionEnabledFamilies,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
} from './_helpers/classifierQueueCard2Deno';

const ARG = { id: 'arg-1', debate_id: 'deb-1' };
const SMOKE_DEBATE = { id: 'deb-1', title: `${CLASSIFIER_QUEUE_SMOKE_TAG} canary room` };
const ORDINARY_DEBATE = { id: 'deb-1', title: 'Should cars be banned downtown?' };

describe('ARCH-001 Card 2 — shouldRouteToQueue (DEFAULT DISABLED + smoke-tag)', () => {
  it('ROUTE-1 — enabled=false → false for a smoke-tagged debate (default-disabled wins)', () => {
    expect(shouldRouteToQueue(ARG, SMOKE_DEBATE, false)).toBe(false);
  });

  it('ROUTE-2 — enabled=false → false for an ordinary debate', () => {
    expect(shouldRouteToQueue(ARG, ORDINARY_DEBATE, false)).toBe(false);
  });

  it('ROUTE-3 — enabled=true + ordinary debate → false (only smoke rooms route)', () => {
    expect(shouldRouteToQueue(ARG, ORDINARY_DEBATE, true)).toBe(false);
  });

  it('ROUTE-4 — enabled=true + smoke-tagged debate → true (the ONLY true case)', () => {
    expect(shouldRouteToQueue(ARG, SMOKE_DEBATE, true)).toBe(true);
  });

  it('ROUTE-5 — smoke tag must be a PREFIX (mid-title occurrence does NOT route)', () => {
    const midTitle = { id: 'deb-1', title: `Re: ${CLASSIFIER_QUEUE_SMOKE_TAG} reply` };
    expect(shouldRouteToQueue(ARG, midTitle, true)).toBe(false);
  });

  it('ROUTE-6 — null argument / null debate → false (never throws)', () => {
    expect(shouldRouteToQueue(null, SMOKE_DEBATE, true)).toBe(false);
    expect(shouldRouteToQueue(ARG, null, true)).toBe(false);
    expect(shouldRouteToQueue(null, null, true)).toBe(false);
  });

  it('ROUTE-7 — argument.debate_id must match debate.id (defensive)', () => {
    const mismatched = { id: 'deb-OTHER', title: `${CLASSIFIER_QUEUE_SMOKE_TAG} x` };
    expect(shouldRouteToQueue(ARG, mismatched, true)).toBe(false);
  });

  it('ROUTE-8 — null/undefined title → false', () => {
    expect(shouldRouteToQueue(ARG, { id: 'deb-1', title: null }, true)).toBe(false);
  });

  it('ROUTE-9 — enabled must be the boolean true (truthy non-true does NOT enable)', () => {
    // The predicate uses a strict `enabled !== true` guard; the Edge function
    // only ever passes a real boolean, but assert the strict gate.
    expect(shouldRouteToQueue(ARG, SMOKE_DEBATE, 1 as unknown as boolean)).toBe(false);
    expect(shouldRouteToQueue(ARG, SMOKE_DEBATE, 'true' as unknown as boolean)).toBe(false);
  });

  it('ROUTE-10 — the smoke tag + env-name constants are stable', () => {
    expect(CLASSIFIER_QUEUE_SMOKE_TAG).toBe('[arch-001-queue-smoke]');
    expect(CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV).toBe('CLASSIFIER_QUEUE_ROUTING_ENABLED');
  });
});

describe('ARCH-001 Card 3 — enqueueClassifierJobs (single multi-row INSERT for A–G)', () => {
  /**
   * Stub service client that records `.from(table).insert(rows)` calls. Card 3
   * replaced 7 sequential `enqueue_classifier_job` RPC calls with a single
   * multi-row INSERT against `argument_machine_observation_runs` (one
   * STATEMENT-level trigger fire per submit instead of seven). The stub
   * deliberately omits `.rpc(...)` so a regression to the per-family RPC
   * path would throw.
   */
  function makeStubClient(opts?: { failOnInsert?: boolean }) {
    const inserts: Array<{ table: string; rows: ReadonlyArray<Record<string, unknown>> }> = [];
    const client = {
      from(table: string) {
        return {
          insert(rows: ReadonlyArray<Record<string, unknown>>) {
            inserts.push({ table, rows });
            if (opts?.failOnInsert) {
              return Promise.resolve({ data: null, error: { message: 'boom', code: 'XX000' } });
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };
    return { client: client as never, inserts };
  }

  it('ENQ-1 — calls .from().insert() EXACTLY ONCE (kick coalescing — one statement-level trigger fire)', async () => {
    const { client, inserts } = makeStubClient();
    const result = await enqueueClassifierJobs('arg-1', 'deb-1', client);
    expect(inserts.length).toBe(1);
    expect(inserts[0].table).toBe('argument_machine_observation_runs');
    const families = productionEnabledFamilies();
    expect(inserts[0].rows.length).toBe(families.length);
    expect(result.attemptedFamilies).toEqual([...families]);
    expect(result.ok).toBe(true);
  });

  it('ENQ-2 — exactly the 8 A–H families are enqueued (no I/J) post MCP-021C-EDGE-FAMILY-H-ENABLE flip', async () => {
    const { client, inserts } = makeStubClient();
    await enqueueClassifierJobs('arg-1', 'deb-1', client);
    const enqueuedFamilies = inserts[0].rows.map((r) => r.family);
    expect([...enqueuedFamilies].sort()).toEqual(
      [
        'argument_scheme',
        'claim_clarity',
        'critical_question',
        'disagreement_axis',
        'evidence_source_chain',
        'misunderstanding_repair',
        'parent_relation',
        'resolution_progress',
      ].sort(),
    );
    // intent-brief (j): the two non-production families are NEVER enqueued.
    for (const banned of ['thread_topology', 'sensitive_composer']) {
      expect(enqueuedFamilies).not.toContain(banned);
    }
  });

  it('ENQ-3 — every inserted row carries argument_id, debate_id, run_mode=production, state=pending, schema_version, and requested_families=[family]', async () => {
    const { client, inserts } = makeStubClient();
    await enqueueClassifierJobs('arg-1', 'deb-1', client);
    for (const r of inserts[0].rows) {
      expect(r.argument_id).toBe('arg-1');
      expect(r.debate_id).toBe('deb-1');
      expect(r.run_mode).toBe('production');
      expect(r.state).toBe('pending');
      expect(r.schema_version).toBe(MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
      expect(Array.isArray(r.requested_families)).toBe(true);
      expect((r.requested_families as string[]).length).toBe(1);
      expect((r.requested_families as string[])[0]).toBe(r.family);
    }
  });

  it('ENQ-4 — a multi-row INSERT error is swallowed (ok=false) and never throws', async () => {
    const { client, inserts } = makeStubClient({ failOnInsert: true });
    const result = await enqueueClassifierJobs('arg-1', 'deb-1', client);
    expect(result.ok).toBe(false);
    // Still issues exactly one insert call (no per-family fallback retries).
    expect(inserts.length).toBe(1);
    // The diagnostic still reports the families we attempted.
    expect(result.attemptedFamilies.length).toBe(productionEnabledFamilies().length);
  });

  it('ENQ-5 — Card 3 INVERTS the prior contract: must use .from().insert(), never per-family .rpc()', async () => {
    // Defensive: a regression back to 7-call .rpc('enqueue_classifier_job') would
    // re-introduce the 7-kick fanout the multi-row INSERT is meant to coalesce.
    // The stub deliberately has NO rpc method — if the code tried .rpc(...), it
    // would throw and the test would fail with TypeError. Resolve verifies the
    // code stays on the .from().insert() path.
    const { client } = makeStubClient();
    await expect(enqueueClassifierJobs('arg-1', 'deb-1', client)).resolves.toBeDefined();
  });
});
