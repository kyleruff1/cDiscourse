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
} from '../supabase/functions/_shared/booleanObservations/classifierQueueRouting';
import { productionEnabledFamilies } from '../supabase/functions/_shared/booleanObservations/familyRegistry';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema';

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

describe('ARCH-001 Card 2 — enqueueClassifierJobs (per production family A–G)', () => {
  /** A stub service client that records every rpc('enqueue_classifier_job') call. */
  function makeStubClient(opts?: { failOn?: string }) {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc(fn: string, args: Record<string, unknown>) {
        calls.push({ fn, args });
        if (opts?.failOn && args.p_family === opts.failOn) {
          return Promise.resolve({ data: null, error: { message: 'boom', code: 'XX000' } });
        }
        return Promise.resolve({ data: 'new-run-id', error: null });
      },
    };
    return { client: client as never, calls };
  }

  it('ENQ-1 — calls enqueue_classifier_job once per production family (A–G), no more', async () => {
    const { client, calls } = makeStubClient();
    const result = await enqueueClassifierJobs('arg-1', 'deb-1', client);
    const families = productionEnabledFamilies();
    expect(calls.length).toBe(families.length);
    expect(result.attemptedFamilies).toEqual([...families]);
    expect(result.ok).toBe(true);
  });

  it('ENQ-2 — exactly the 7 A–G families are enqueued (no H/I/J)', async () => {
    const { client, calls } = makeStubClient();
    await enqueueClassifierJobs('arg-1', 'deb-1', client);
    const enqueuedFamilies = calls.map((c) => c.args.p_family);
    expect(enqueuedFamilies.sort()).toEqual(
      [
        'argument_scheme',
        'critical_question',
        'disagreement_axis',
        'evidence_source_chain',
        'misunderstanding_repair',
        'parent_relation',
        'resolution_progress',
      ].sort(),
    );
    // intent-brief (j): the three non-production families are NEVER enqueued.
    for (const banned of ['claim_clarity', 'thread_topology', 'sensitive_composer']) {
      expect(enqueuedFamilies).not.toContain(banned);
    }
  });

  it('ENQ-3 — every enqueue carries run_mode=production + the schema-version constant', async () => {
    const { client, calls } = makeStubClient();
    await enqueueClassifierJobs('arg-1', 'deb-1', client);
    for (const c of calls) {
      expect(c.fn).toBe('enqueue_classifier_job');
      expect(c.args.p_run_mode).toBe('production');
      expect(c.args.p_schema_version).toBe(MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
      expect(c.args.p_argument_id).toBe('arg-1');
      expect(c.args.p_debate_id).toBe('deb-1');
    }
  });

  it('ENQ-4 — a per-family RPC error is swallowed (ok=false) and never throws', async () => {
    const { client, calls } = makeStubClient({ failOn: 'parent_relation' });
    const result = await enqueueClassifierJobs('arg-1', 'deb-1', client);
    expect(result.ok).toBe(false);
    // Still attempts every family despite the one error (no early abort).
    expect(calls.length).toBe(productionEnabledFamilies().length);
  });

  it('ENQ-5 — calls the SQL function (rpc), never a .from().insert() chain', async () => {
    // Defensive: enqueue MUST go through the Card-1 SQL function (idempotent
    // ON CONFLICT), not a raw PostgREST insert. The stub only implements rpc;
    // if the code tried .from(...), it would throw — assert it does not.
    const { client } = makeStubClient();
    await expect(enqueueClassifierJobs('arg-1', 'deb-1', client)).resolves.toBeDefined();
  });
});
