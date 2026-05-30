/**
 * OPS-MCP-SERVER-CAPACITY-INVESTIGATION — gate-site behavioral tests for the
 * per-isolate provider-concurrency cap wired into callAnthropic.
 *
 * The gate is the PROCESS-GLOBAL singleton `providerConcurrencyGate`, sized from
 * env at module init (so it is the default cap=5 in this test process — setting
 * MCP_SERVER_MAX_PROVIDER_CONCURRENCY inside a test body does NOT resize an
 * already-constructed singleton; the cap=1 *primitive* deadlock + idempotent
 * release semantics are proven directly in providerConcurrency.test.ts). Here we
 * prove the gate wraps the ACTUAL fetch and releases the slot on every path by
 * observing `providerConcurrencyGate.inFlight` and by exceeding the cap with
 * failing calls before a healthy one (the deadlock guard).
 *
 * Covers (the operator's 10, gate-site portion):
 *   - T2  the cap bounds the actual provider fetch (maxLive <= imported cap).
 *   - T3  queued calls drain + return the normal { ok:true, packet } shape.
 *   - T4  no response-shape change; every failure path returns the exact existing reason.
 *   - release on EVERY failure path (timeout / generic-throw / 429 / 500 / json-throw /
 *         parse-null): inFlight returns to 0 + a later healthy call still resolves (deadlock guard).
 *   - key_missing consumes no slot.
 *   - T6/T7 provider failure envelopes + logs carry no key / header / raw body.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { _resetLogSinkForTesting, _setLogSinkForTesting } from '../lib/logging.ts';
import { callAnthropic } from '../lib/anthropicCall.ts';
import type { CallAnthropicOpts } from '../lib/anthropicCall.ts';
import { extractAnthropicContentText, parseJsonFromContent } from '../lib/anthropicCall.ts';
import {
  providerConcurrencyGate,
  RESOLVED_MAX_PROVIDER_CONCURRENCY,
} from '../lib/providerConcurrency.ts';

const FAKE_ANTHROPIC_KEY = 'sk-ant-fake-test-key-do-not-use-elsewhere-1234567890abcdefxyz';
const RAW_PROMPT = 'fixture user prompt that must never reach a log line';
const RAW_RESPONSE_TEXT = JSON.stringify({
  nodeId: 'node-1',
  observations: { supports_parent: true },
});

/** The minimal valid Anthropic Messages response body the mock returns. */
function mockMessagesBody(): string {
  return JSON.stringify({
    model: 'claude-haiku-4-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: RAW_RESPONSE_TEXT }],
  });
}

function baseOpts(overrides: Partial<CallAnthropicOpts> = {}): CallAnthropicOpts {
  return {
    system: 'fixture system',
    userPrompt: RAW_PROMPT,
    maxTokens: 256,
    temperature: 0,
    toolNameForLogging: 'classify_argument_boolean_observations',
    requestId: 'req-cap-1',
    ...overrides,
  };
}

/** A manually-resolvable deferred used as a controllable fetch barrier. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function withFakeKey<T>(fn: () => Promise<T>): Promise<T> {
  const prev = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.set('ANTHROPIC_API_KEY', FAKE_ANTHROPIC_KEY);
  return fn().finally(() => {
    if (prev === undefined) Deno.env.delete('ANTHROPIC_API_KEY');
    else Deno.env.set('ANTHROPIC_API_KEY', prev);
  });
}

Deno.test('T2: the cap bounds the ACTUAL provider fetch (maxLive <= imported resolved cap)', async () => {
  await withFakeKey(async () => {
    const barrier = deferred();
    let live = 0;
    let maxLive = 0;
    // A fetchImpl that piles up to the cap behind a barrier, proving the gate is
    // around the fetch itself (not merely request parsing).
    const trackingFetch: typeof fetch = async () => {
      live += 1;
      if (live > maxLive) maxLive = live;
      await barrier.promise;
      live -= 1;
      return new Response(mockMessagesBody(), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const n = RESOLVED_MAX_PROVIDER_CONCURRENCY * 3;
    const calls = Array.from(
      { length: n },
      (_unused, i) =>
        callAnthropic(baseOpts({ requestId: `req-t2-${i}`, fetchImpl: trackingFetch })),
    );

    // Let the first wave reach the fetch barrier, then release so the rest drain.
    await Promise.resolve();
    await Promise.resolve();
    barrier.resolve();
    const results = await Promise.all(calls);

    if (maxLive > RESOLVED_MAX_PROVIDER_CONCURRENCY) {
      throw new Error(
        `maxLive ${maxLive} exceeded RESOLVED_MAX_PROVIDER_CONCURRENCY ${RESOLVED_MAX_PROVIDER_CONCURRENCY} at the fetch boundary`,
      );
    }
    // Every queued call still ran and returned the normal success shape (T3).
    assertEquals(results.length, n);
    for (const r of results) {
      assertEquals(r.ok, true);
    }
    // Drain proof: the singleton is fully released after all calls settle.
    assertEquals(providerConcurrencyGate.inFlight, 0);
    assertEquals(providerConcurrencyGate.waiting, 0);
  });
});

Deno.test('T4: a single uncontended call returns { ok:true, packet } byte-equal to a direct parse of the mock body', async () => {
  await withFakeKey(async () => {
    const body = mockMessagesBody();
    const okFetch: typeof fetch = async () =>
      await Promise.resolve(
        new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    const result = await callAnthropic(baseOpts({ requestId: 'req-t4', fetchImpl: okFetch }));
    assertEquals(result.ok, true);

    // Byte-equal to what the same body parses to via the module's own helpers.
    const expectedText = extractAnthropicContentText(JSON.parse(body));
    const expectedPacket = parseJsonFromContent(expectedText);
    if (result.ok) {
      assertEquals(result.packet, expectedPacket);
    }
    assertEquals(providerConcurrencyGate.inFlight, 0);
  });
});

Deno.test('T4: failure injections return the exact existing reason values (shape unchanged)', async () => {
  await withFakeKey(async () => {
    // 429 -> rate_limited
    const r429 = await callAnthropic(
      baseOpts({
        requestId: 'req-429',
        fetchImpl: async () => await Promise.resolve(new Response('rl-body', { status: 429 })),
      }),
    );
    assertEquals(r429.ok, false);
    if (!r429.ok) assertEquals(r429.reason, 'rate_limited');

    // 500 -> api_error
    const r500 = await callAnthropic(
      baseOpts({
        requestId: 'req-500',
        fetchImpl: async () => await Promise.resolve(new Response('boom', { status: 500 })),
      }),
    );
    assertEquals(r500.ok, false);
    if (!r500.ok) assertEquals(r500.reason, 'api_error');

    // TimeoutError-named throw -> model_timeout
    const rTimeout = await callAnthropic(
      baseOpts({
        requestId: 'req-timeout',
        fetchImpl: async () => {
          const err = new Error('aborted');
          err.name = 'TimeoutError';
          await Promise.resolve();
          throw err;
        },
      }),
    );
    assertEquals(rTimeout.ok, false);
    if (!rTimeout.ok) assertEquals(rTimeout.reason, 'model_timeout');

    // Generic throw -> network_error
    const rNet = await callAnthropic(
      baseOpts({
        requestId: 'req-net',
        fetchImpl: async () => {
          await Promise.resolve();
          throw new Error('connection reset');
        },
      }),
    );
    assertEquals(rNet.ok, false);
    if (!rNet.ok) assertEquals(rNet.reason, 'network_error');

    // Non-JSON body -> parse_failure (response.json throws)
    const rJson = await callAnthropic(
      baseOpts({
        requestId: 'req-json',
        fetchImpl: async () =>
          await Promise.resolve(
            new Response('not json at all', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          ),
      }),
    );
    assertEquals(rJson.ok, false);
    if (!rJson.ok) assertEquals(rJson.reason, 'parse_failure');

    // Valid JSON but no extractable object -> parse_failure (parse-null)
    const rNull = await callAnthropic(
      baseOpts({
        requestId: 'req-null',
        fetchImpl: async () =>
          await Promise.resolve(
            new Response(
              JSON.stringify({ model: 'm', content: [{ type: 'text', text: 'no braces here' }] }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          ),
      }),
    );
    assertEquals(rNull.ok, false);
    if (!rNull.ok) assertEquals(rNull.reason, 'parse_failure');

    assertEquals(providerConcurrencyGate.inFlight, 0);
  });
});

// The six failure paths and the fetchImpl that triggers each.
const FAILURE_PATHS: ReadonlyArray<{ name: string; fetchImpl: typeof fetch }> = [
  {
    name: 'timeout-throw',
    fetchImpl: async () => {
      const err = new Error('aborted');
      err.name = 'TimeoutError';
      await Promise.resolve();
      throw err;
    },
  },
  {
    name: 'generic-throw',
    fetchImpl: async () => {
      await Promise.resolve();
      throw new Error('connection reset');
    },
  },
  {
    name: '429',
    fetchImpl: async () => await Promise.resolve(new Response('rl', { status: 429 })),
  },
  {
    name: '500',
    fetchImpl: async () => await Promise.resolve(new Response('boom', { status: 500 })),
  },
  {
    name: 'json-throw',
    fetchImpl: async () =>
      await Promise.resolve(
        new Response('not json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
  },
  {
    name: 'parse-null',
    fetchImpl: async () =>
      await Promise.resolve(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'no object' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
  },
];

Deno.test('deadlock guard: every failure path releases its slot (inFlight->0; a later healthy call still resolves)', async () => {
  await withFakeKey(async () => {
    const okFetch: typeof fetch = async () =>
      await Promise.resolve(
        new Response(mockMessagesBody(), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    for (const path of FAILURE_PATHS) {
      // Fire MORE failing calls than the cap, concurrently, so the queue + the
      // release-to-waiter handoff are exercised on the failure path. If release
      // were missing, the cap slots would be permanently consumed and the later
      // healthy call would hang (test timeout) — this is the deadlock guard.
      const failing = Array.from(
        { length: RESOLVED_MAX_PROVIDER_CONCURRENCY + 2 },
        (_unused, i) =>
          callAnthropic(
            baseOpts({ requestId: `req-fail-${path.name}-${i}`, fetchImpl: path.fetchImpl }),
          ),
      );
      const failResults = await Promise.all(failing);
      for (const r of failResults) {
        assertEquals(r.ok, false, `${path.name}: expected a failure result`);
      }
      // Slot leak check: after the failing wave settles, the pool is fully free.
      assertEquals(
        providerConcurrencyGate.inFlight,
        0,
        `${path.name}: a slot was leaked (inFlight != 0)`,
      );

      // A subsequent healthy call must still complete (no deadlock).
      const healthy = await callAnthropic(
        baseOpts({ requestId: `req-healthy-after-${path.name}`, fetchImpl: okFetch }),
      );
      assertEquals(healthy.ok, true, `${path.name}: healthy call did not resolve after failures`);
      assertEquals(providerConcurrencyGate.inFlight, 0);
    }
  });
});

Deno.test('key_missing consumes no slot (returns immediately; inFlight stays 0; a healthy call is unaffected)', async () => {
  const prev = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.delete('ANTHROPIC_API_KEY');
  try {
    assertEquals(providerConcurrencyGate.inFlight, 0);
    const missing = await callAnthropic(baseOpts({ requestId: 'req-key-missing' }));
    assertEquals(missing.ok, false);
    if (!missing.ok) assertEquals(missing.reason, 'key_missing');
    // The missing-key path returned BEFORE acquire — no permit was held.
    assertEquals(providerConcurrencyGate.inFlight, 0);
    assertEquals(providerConcurrencyGate.waiting, 0);
  } finally {
    if (prev === undefined) Deno.env.delete('ANTHROPIC_API_KEY');
    else Deno.env.set('ANTHROPIC_API_KEY', prev);
  }

  // With the key restored, a healthy call still works (the missing-key call did
  // not corrupt the pool).
  await withFakeKey(async () => {
    const okFetch: typeof fetch = async () =>
      await Promise.resolve(
        new Response(mockMessagesBody(), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const healthy = await callAnthropic(
      baseOpts({ requestId: 'req-after-missing', fetchImpl: okFetch }),
    );
    assertEquals(healthy.ok, true);
    assertEquals(providerConcurrencyGate.inFlight, 0);
  });
});

Deno.test('T6/T7: failure envelopes + logs never carry the key, x-api-key header value, raw prompt, or raw body', async () => {
  await withFakeKey(async () => {
    const lines: string[] = [];
    _setLogSinkForTesting((line) => lines.push(line));
    try {
      // Run the cap-wrapped success path + every failure path, capturing logs.
      const okFetch: typeof fetch = async () =>
        await Promise.resolve(
          new Response(mockMessagesBody(), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      const success = await callAnthropic(
        baseOpts({ requestId: 'req-sanitize-ok', fetchImpl: okFetch }),
      );
      assertEquals(success.ok, true);

      const failureResults = [];
      for (const path of FAILURE_PATHS) {
        const r = await callAnthropic(
          baseOpts({ requestId: `req-sanitize-${path.name}`, fetchImpl: path.fetchImpl }),
        );
        failureResults.push({ path: path.name, r });
      }

      // The returned failure envelopes carry only { ok:false, reason } (no detail
      // is set on these paths) — assert no secret/raw value appears in the result.
      for (const { path, r } of failureResults) {
        assertEquals(r.ok, false);
        const serialized = JSON.stringify(r);
        for (const secret of [FAKE_ANTHROPIC_KEY, RAW_PROMPT, RAW_RESPONSE_TEXT]) {
          if (serialized.includes(secret)) {
            throw new Error(`${path}: failure envelope leaked a sensitive value`);
          }
        }
      }

      // No captured log line may contain the key, the raw prompt, or the raw body.
      for (const line of lines) {
        for (const secret of [FAKE_ANTHROPIC_KEY, RAW_PROMPT, RAW_RESPONSE_TEXT]) {
          if (line.includes(secret)) {
            throw new Error(`a log line leaked a sensitive value: ${line}`);
          }
        }
      }
    } finally {
      _resetLogSinkForTesting();
    }
    assertEquals(providerConcurrencyGate.inFlight, 0);
  });
});
