/**
 * AUTH-FETCH-TIMEOUT-001 — makeTimeoutFetch unit tests.
 *
 * Pure: the base fetch is injected (a mock), so no real network. Verifies the
 * fast path passes through (timer cleared), a stalled request aborts after
 * timeoutMs, and a caller-supplied signal is respected verbatim.
 */
import { makeTimeoutFetch, DEFAULT_FETCH_TIMEOUT_MS } from '../src/lib/timeoutFetch';

const FAKE_RESPONSE = { ok: true, status: 200 } as unknown as Response;

describe('makeTimeoutFetch', () => {
  it('passes a fast response through and attaches a timeout signal', async () => {
    const base = jest.fn().mockResolvedValue(FAKE_RESPONSE);
    const f = makeTimeoutFetch(base as unknown as typeof fetch, 1000);
    await expect(f('https://example.test')).resolves.toBe(FAKE_RESPONSE);
    expect(base).toHaveBeenCalledTimes(1);
    const init = base.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeDefined();
    expect(init.signal && init.signal.aborted).toBe(false);
  });

  it('aborts a stalled request after timeoutMs (the request rejects)', async () => {
    // The base fetch honours the injected signal: it rejects on abort.
    const base = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const f = makeTimeoutFetch(base as unknown as typeof fetch, 20);
    await expect(f('https://example.test')).rejects.toThrow('aborted');
  });

  it('respects a caller-supplied signal and does NOT override it', async () => {
    const base = jest.fn().mockResolvedValue(FAKE_RESPONSE);
    const f = makeTimeoutFetch(base as unknown as typeof fetch, 1000);
    const controller = new AbortController();
    await f('https://example.test', { signal: controller.signal });
    const init = base.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(controller.signal); // exactly the caller's signal
  });

  it('exports a bounded default timeout', () => {
    expect(typeof DEFAULT_FETCH_TIMEOUT_MS).toBe('number');
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });
});
