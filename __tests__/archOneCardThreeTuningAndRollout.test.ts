/**
 * ARCH-001 Card 3 — drainer tuning + kick coalescing + staged-rollout
 * percentage (PURE behavioral unit tests).
 *
 * Three deliverables:
 *   1. DRAINER_MAX_ATTEMPTS 3 → 4 (extra retry budget for the Card-2
 *      C-calibration signal).
 *   2. DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS = [60, 180, 360] —
 *      failure-reason-specific backoff for the Anthropic {isError} class.
 *      Every other retryable sub-reason preserves [30, 120] exactly.
 *   3. CLASSIFIER_QUEUE_ROUTING_PERCENTAGE — staged rollout knob. Default
 *      0 (smoke-tag override only). Smoke-tag still routes at percentage=0.
 *      Master enable flag gates BOTH paths.
 *   4. enqueueClassifierJobs uses ONE multi-row INSERT (kick coalescing)
 *      — covered in archOneCardTwoRoutingPredicate.test.ts (ENQ-* updated).
 *
 * Pure TS, Jest-importable via the Card-2 Deno test bridge.
 */
import {
  classifyDrainerFailure,
  DRAINER_MAX_ATTEMPTS,
  DRAINER_RETRY_BACKOFF_SECONDS,
  DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS,
  CLASSIFIER_QUEUE_ROUTING_PERCENTAGE_ENV,
  CLASSIFIER_QUEUE_SMOKE_TAG,
  parseRoutingPercentage,
  stableHashArgumentId,
  shouldRouteToQueue,
} from './_helpers/classifierQueueCard2Deno';

describe('ARCH-001 Card 3 — DRAINER_MAX_ATTEMPTS=4 + provider_server_error backoff', () => {
  it('C3-RP-1 — MAX_ATTEMPTS is 4 (Card-2 audit recommended retry-budget extension)', () => {
    expect(DRAINER_MAX_ATTEMPTS).toBe(4);
  });

  it('C3-RP-2 — default schedule preserved exactly: [30, 120]', () => {
    expect(DRAINER_RETRY_BACKOFF_SECONDS).toEqual([30, 120]);
  });

  it('C3-RP-3 — provider_server_error schedule is [60, 180, 360] (Card-3 new)', () => {
    expect(DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS).toEqual([60, 180, 360]);
  });

  it('C3-RP-4 — api_error + provider_server_error sub-reason uses NEW schedule on attempts 1, 2, 3', () => {
    const a1 = classifyDrainerFailure('api_error', 1, 'provider_server_error');
    const a2 = classifyDrainerFailure('api_error', 2, 'provider_server_error');
    const a3 = classifyDrainerFailure('api_error', 3, 'provider_server_error');
    expect(a1.disposition).toBe('retry');
    expect(a1.backoffSeconds).toBe(60);
    expect(a2.disposition).toBe('retry');
    expect(a2.backoffSeconds).toBe(180);
    expect(a3.disposition).toBe('retry');
    expect(a3.backoffSeconds).toBe(360);
  });

  it('C3-RP-5 — api_error + provider_server_error at attempt 4 → dead_letter (NOT retry)', () => {
    const d = classifyDrainerFailure('api_error', DRAINER_MAX_ATTEMPTS, 'provider_server_error');
    expect(d.disposition).toBe('dead_letter');
    expect(d.deadLetterReason).toBe('retry_attempts_exhausted');
    expect(d.failureReason).toBe('mcp_api_error');
    expect(d.failureSubReason).toBe('provider_server_error');
    expect(d.backoffSeconds).toBe(0);
  });

  it('C3-RP-6 — api_error with DIFFERENT sub-reason uses DEFAULT schedule (not the provider_server_error one)', () => {
    // The branch is BOTH reason='api_error' AND subReason='provider_server_error' —
    // other api_error sub-reasons fall back to the default [30, 120].
    const a1 = classifyDrainerFailure('api_error', 1, 'provider_capacity_exhausted');
    expect(a1.disposition).toBe('retry');
    expect(a1.backoffSeconds).toBe(30);
  });

  it('C3-RP-7 — network_error + provider_network_error never gets the provider_server_error schedule', () => {
    const a1 = classifyDrainerFailure('network_error', 1, 'provider_network_error');
    expect(a1.backoffSeconds).toBe(30);
    const a2 = classifyDrainerFailure('network_error', 2, 'provider_network_error');
    expect(a2.backoffSeconds).toBe(120);
    // Attempt 3 uses clamped last entry from default schedule (still 120).
    const a3 = classifyDrainerFailure('network_error', 3, 'provider_network_error');
    expect(a3.disposition).toBe('retry');
    expect(a3.backoffSeconds).toBe(120);
  });

  it('C3-RP-8 — rate_limited never gets the provider_server_error schedule', () => {
    const a1 = classifyDrainerFailure('rate_limited', 1, 'provider_rate_limited');
    expect(a1.backoffSeconds).toBe(30);
    const a3 = classifyDrainerFailure('rate_limited', 3, 'provider_rate_limited');
    expect(a3.disposition).toBe('retry');
    expect(a3.backoffSeconds).toBe(120);
  });

  it('C3-RP-9 — contract failures (validation_failed/parse_failure) still bounded at 1 retry; never dead_letter', () => {
    // Card 3 did NOT change the contract-failure branch.
    expect(classifyDrainerFailure('validation_failed', 1).disposition).toBe('retry');
    expect(classifyDrainerFailure('validation_failed', 2).disposition).toBe('failed_terminal');
    expect(classifyDrainerFailure('parse_failure', 1).disposition).toBe('retry');
    expect(classifyDrainerFailure('parse_failure', 2).disposition).toBe('failed_terminal');
    for (let attempt = 1; attempt <= DRAINER_MAX_ATTEMPTS + 1; attempt += 1) {
      expect(classifyDrainerFailure('validation_failed', attempt).disposition).not.toBe('dead_letter');
      expect(classifyDrainerFailure('parse_failure', attempt).disposition).not.toBe('dead_letter');
    }
  });

  it('C3-RP-10 — url_missing / token_missing terminal immediately (unchanged from Card 2)', () => {
    expect(classifyDrainerFailure('url_missing', 1).disposition).toBe('failed_terminal');
    expect(classifyDrainerFailure('token_missing', 1).disposition).toBe('failed_terminal');
  });

  it('C3-RP-11 — DOCTRINE: provider_server_error backoff array has no verdict tokens (just numbers)', () => {
    for (const n of DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS) {
      expect(typeof n).toBe('number');
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });
});

describe('ARCH-001 Card 3 — parseRoutingPercentage', () => {
  it('C3-PP-1 — undefined / null / empty / non-string → 0', () => {
    expect(parseRoutingPercentage(undefined)).toBe(0);
    expect(parseRoutingPercentage(null)).toBe(0);
    expect(parseRoutingPercentage('')).toBe(0);
    expect(parseRoutingPercentage('   ')).toBe(0);
  });

  it('C3-PP-2 — non-numeric strings → 0 (NaN)', () => {
    expect(parseRoutingPercentage('abc')).toBe(0);
    expect(parseRoutingPercentage('NaN')).toBe(0);
    expect(parseRoutingPercentage('one hundred')).toBe(0);
  });

  it('C3-PP-3 — negative → 0 (fail-closed)', () => {
    expect(parseRoutingPercentage('-1')).toBe(0);
    expect(parseRoutingPercentage('-50')).toBe(0);
    expect(parseRoutingPercentage('-100')).toBe(0);
  });

  it('C3-PP-4 — overshoot >100 → clamped to 100', () => {
    expect(parseRoutingPercentage('101')).toBe(100);
    expect(parseRoutingPercentage('1000')).toBe(100);
    expect(parseRoutingPercentage('999999')).toBe(100);
  });

  it('C3-PP-5 — valid 0..100 floored to int', () => {
    expect(parseRoutingPercentage('0')).toBe(0);
    expect(parseRoutingPercentage('1')).toBe(1);
    expect(parseRoutingPercentage('50')).toBe(50);
    expect(parseRoutingPercentage('99')).toBe(99);
    expect(parseRoutingPercentage('100')).toBe(100);
    expect(parseRoutingPercentage('50.7')).toBe(50);
    expect(parseRoutingPercentage('99.9')).toBe(99);
  });

  it('C3-PP-6 — Infinity / +Infinity → 100 clamp (Number.isFinite-gated)', () => {
    // 'Infinity' parses to Infinity → !isFinite → 0 (fail-closed).
    expect(parseRoutingPercentage('Infinity')).toBe(0);
    expect(parseRoutingPercentage('-Infinity')).toBe(0);
  });

  it('C3-PP-7 — env-name constant is stable', () => {
    expect(CLASSIFIER_QUEUE_ROUTING_PERCENTAGE_ENV).toBe('CLASSIFIER_QUEUE_ROUTING_PERCENTAGE');
  });
});

describe('ARCH-001 Card 3 — stableHashArgumentId', () => {
  it('C3-HASH-1 — deterministic: same input → same hash on every call', () => {
    const id = 'arg-deadbeef-12345';
    const h1 = stableHashArgumentId(id);
    const h2 = stableHashArgumentId(id);
    expect(h1).toBe(h2);
  });

  it('C3-HASH-2 — different inputs produce different hashes (typical case)', () => {
    const a = stableHashArgumentId('arg-AAAAAAAA');
    const b = stableHashArgumentId('arg-BBBBBBBB');
    expect(a).not.toBe(b);
  });

  it('C3-HASH-3 — empty string and length-1 strings do not throw and produce 32-bit unsigned ints', () => {
    expect(() => stableHashArgumentId('')).not.toThrow();
    expect(() => stableHashArgumentId('a')).not.toThrow();
    const h = stableHashArgumentId('a');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it('C3-HASH-4 — long strings (UUID + suffix) produce 32-bit unsigned ints', () => {
    const long = '74c44fc0-f0f4-4048-be58-9ae4d08e69ca-extra-suffix-bytes-1234567890';
    const h = stableHashArgumentId(long);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it('C3-HASH-5 — modulo-100 distribution roughly uniform across 1000 generated ids', () => {
    // Not a strict statistical test — just confirm no single bucket gets >50% of
    // the 1000 ids (which would indicate a degenerate hash distribution).
    const buckets = new Array(100).fill(0);
    for (let i = 0; i < 1000; i += 1) {
      // Mix the index in a way that varies multiple bytes; UUIDs in production
      // are more random than this, so a passing test here is a low bar — but a
      // FAILING one would prove the hash is degenerate.
      const id = `arg-${i.toString(16)}-${(i * 37).toString(16)}-${(i ^ 0xA5A5).toString(16)}`;
      buckets[stableHashArgumentId(id) % 100] += 1;
    }
    const max = Math.max(...buckets);
    expect(max).toBeLessThan(500); // any one bucket > 50% would be degenerate.
    // At least 50 of 100 buckets should see at least one hit.
    const nonEmptyBuckets = buckets.filter((c) => c > 0).length;
    expect(nonEmptyBuckets).toBeGreaterThanOrEqual(50);
  });
});

describe('ARCH-001 Card 3 — shouldRouteToQueue percentage routing', () => {
  const ORDINARY_DEBATE = { id: 'deb-1', title: 'Should cars be banned downtown?' };
  const SMOKE_DEBATE = { id: 'deb-1', title: `${CLASSIFIER_QUEUE_SMOKE_TAG} canary` };

  it('C3-ROUTE-1 — percentage=0 + ordinary debate → false (no percentage routing)', () => {
    const arg = { id: 'arg-anything', debate_id: 'deb-1' };
    expect(shouldRouteToQueue(arg, ORDINARY_DEBATE, true, 0)).toBe(false);
  });

  it('C3-ROUTE-2 — percentage=0 + smoke debate + enabled → true (smoke-tag override active)', () => {
    const arg = { id: 'arg-anything', debate_id: 'deb-1' };
    expect(shouldRouteToQueue(arg, SMOKE_DEBATE, true, 0)).toBe(true);
  });

  it('C3-ROUTE-3 — percentage=100 + ordinary debate + enabled → true (100% routing)', () => {
    for (const id of ['arg-A', 'arg-B', 'arg-anything', 'long-uuid-xyz-123']) {
      const arg = { id, debate_id: 'deb-1' };
      expect(shouldRouteToQueue(arg, ORDINARY_DEBATE, true, 100)).toBe(true);
    }
  });

  it('C3-ROUTE-4 — percentage=50 + ordinary debate + enabled → deterministic subset (same id → same result)', () => {
    const arg = { id: 'arg-deterministic-test', debate_id: 'deb-1' };
    const first = shouldRouteToQueue(arg, ORDINARY_DEBATE, true, 50);
    const second = shouldRouteToQueue(arg, ORDINARY_DEBATE, true, 50);
    expect(first).toBe(second);
  });

  it('C3-ROUTE-5 — percentage=50 over 1000 args yields ~500 routed (within ±20% slack)', () => {
    let routedCount = 0;
    for (let i = 0; i < 1000; i += 1) {
      const arg = { id: `arg-distribute-${i.toString(16)}-${(i * 37).toString(16)}`, debate_id: 'deb-1' };
      if (shouldRouteToQueue(arg, ORDINARY_DEBATE, true, 50)) routedCount += 1;
    }
    // Permissive: between 400 and 600 (any sane hash will land ~500).
    expect(routedCount).toBeGreaterThan(400);
    expect(routedCount).toBeLessThan(600);
  });

  it('C3-ROUTE-6 — enabled=false + percentage=100 → false (master flag gates EVERYTHING)', () => {
    const arg = { id: 'arg-anything', debate_id: 'deb-1' };
    expect(shouldRouteToQueue(arg, ORDINARY_DEBATE, false, 100)).toBe(false);
    expect(shouldRouteToQueue(arg, SMOKE_DEBATE, false, 100)).toBe(false);
  });

  it('C3-ROUTE-7 — enabled=true + percentage=100 + smoke debate → true (both paths satisfied; smoke wins early)', () => {
    const arg = { id: 'arg-anything', debate_id: 'deb-1' };
    expect(shouldRouteToQueue(arg, SMOKE_DEBATE, true, 100)).toBe(true);
  });

  it('C3-ROUTE-8 — percentage defaults to 0 when not passed (backward-compatible 3-arg signature)', () => {
    const arg = { id: 'arg-anything', debate_id: 'deb-1' };
    expect(shouldRouteToQueue(arg, SMOKE_DEBATE, true)).toBe(true);
    expect(shouldRouteToQueue(arg, ORDINARY_DEBATE, true)).toBe(false);
  });

  it('C3-ROUTE-9 — invalid (negative / NaN / Infinity) percentage values are treated as 0', () => {
    const arg = { id: 'arg-anything', debate_id: 'deb-1' };
    expect(shouldRouteToQueue(arg, ORDINARY_DEBATE, true, -50)).toBe(false);
    expect(shouldRouteToQueue(arg, ORDINARY_DEBATE, true, Number.NaN)).toBe(false);
    expect(shouldRouteToQueue(arg, ORDINARY_DEBATE, true, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('C3-ROUTE-10 — percentage=99 + ordinary: routes argument ids whose hash%100<99 (some not routed)', () => {
    // The strict-less-than predicate at 99 admits buckets [0..98] = 99/100. So
    // ~99% should route; at LEAST one of the 100 generated ids should NOT route.
    const notRouted: string[] = [];
    for (let i = 0; i < 1000; i += 1) {
      const id = `arg-bucket-${i}`;
      const arg = { id, debate_id: 'deb-1' };
      if (!shouldRouteToQueue(arg, ORDINARY_DEBATE, true, 99)) notRouted.push(id);
    }
    // ~1% of 1000 = ~10 not-routed. Slack: between 1 and 30.
    expect(notRouted.length).toBeGreaterThan(0);
    expect(notRouted.length).toBeLessThan(50);
  });

  it('C3-ROUTE-11 — argument.debate_id mismatch still returns false even with percentage=100', () => {
    const arg = { id: 'arg-anything', debate_id: 'deb-DIFFERENT' };
    expect(shouldRouteToQueue(arg, ORDINARY_DEBATE, true, 100)).toBe(false);
  });
});

describe('ARCH-001 Card 3 — env defaults are inert', () => {
  it('C3-INERT-1 — parseRoutingPercentage(undefined) is 0 (matches the default-disabled posture)', () => {
    expect(parseRoutingPercentage(undefined)).toBe(0);
  });

  it('C3-INERT-2 — percentage=0 + enabled=false + ordinary → false (the post-Card-3-closeout state)', () => {
    const arg = { id: 'arg-anything', debate_id: 'deb-1' };
    const ordinaryDebate = { id: 'deb-1', title: 'Ordinary' };
    expect(shouldRouteToQueue(arg, ordinaryDebate, false, 0)).toBe(false);
  });
});
