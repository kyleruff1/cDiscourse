/**
 * OPS-MCP-SERVER-CAPACITY-INVESTIGATION — per-isolate bounded provider
 * concurrency cap.
 *
 * A counting semaphore that bounds concurrent provider (Anthropic) round-trips
 * to at most `cap` IN FLIGHT AT ONCE WITHIN A SINGLE ISOLATE. Excess callers
 * queue (FIFO) and are handed a slot on release.
 *
 * TOPOLOGY: this is a PER-ISOLATE cap. The hosted server may run multiple
 * isolates; this is NOT a true global cap. Do not describe it as global.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §5 — the gate logic is pure: no Deno.env / fetch /
 *     network / console / Date.now inside acquire/release/handoff. The cap
 *     VALUE is read from env in a separate reader (readEnvMaxProviderConcurrency)
 *     so the semaphore factory itself is injectable + unit-testable.
 *   - cdiscourse-doctrine §1/§3 — no scoring/heat/popularity/engagement signal;
 *     the only ordering input is FIFO arrival order. The cap cannot influence
 *     any standing band or label.
 *   - cdiscourse-doctrine §6 — touches no secret/prompt/response value; nothing
 *     here is ever logged or returned.
 */

export const DEFAULT_MAX_PROVIDER_CONCURRENCY = 5;

/** A release fn — calling it exactly once frees the held slot (idempotent). */
export type ReleaseFn = () => void;

export interface BoundedSemaphore {
  /**
   * Resolve with a ReleaseFn when a slot is free. If at capacity, the caller
   * is queued (FIFO) and the promise resolves once a prior holder releases.
   */
  acquire(): Promise<ReleaseFn>;
  /** In-flight count — test/observability only; not used by the gate. */
  readonly inFlight: number;
  /** Queue depth — test/observability only. */
  readonly waiting: number;
}

/**
 * Build a counting semaphore with `cap` permits. `cap` must be a finite
 * integer >= 1 (the caller passes the env-resolved cap; the env reader already
 * floors invalid values to the default). cap < 1 / non-finite throws RangeError
 * — NEVER silently unbounded (HALT-5 guard, mirrors the Edge runner's HALT-4).
 *
 * The acquire/release/handoff core is pure: no Deno.env, no fetch, no network,
 * no console, no Date.now. Given deterministic task timing the acquire/release
 * ordering is deterministic (strict FIFO).
 */
export function createBoundedSemaphore(cap: number): BoundedSemaphore {
  if (typeof cap !== 'number' || !Number.isInteger(cap) || cap < 1) {
    throw new RangeError('createBoundedSemaphore: cap must be an integer >= 1');
  }

  // PER-ISOLATE transient state — lives in this closure, never crosses a
  // request or network boundary.
  let inFlight = 0;
  // FIFO queue of pending acquire resolvers (head = next to be served).
  const queue: Array<(release: ReleaseFn) => void> = [];

  function makeRelease(): ReleaseFn {
    // `released` makes the returned fn single-use + idempotent: a second call
    // is a no-op so a double-release can never over-credit or starve the pool.
    // This is what makes the caller's `finally { release(); }` safe even if a
    // future refactor accidentally releases twice.
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const nextResolve = queue.shift();
      if (nextResolve !== undefined) {
        // Strict FIFO direct slot-handoff: transfer the permit straight to the
        // head waiter WITHOUT a decrement-then-reincrement gap, so `inFlight`
        // stays constant and there is no transient over-admission window.
        nextResolve(makeRelease());
        return;
      }
      // No waiter — free the permit.
      inFlight -= 1;
    };
  }

  return {
    acquire(): Promise<ReleaseFn> {
      if (inFlight < cap) {
        inFlight += 1;
        return Promise.resolve(makeRelease());
      }
      // At capacity — queue (tail) and block until a holder hands us the slot.
      // No setTimeout / microtask trickery: release resolves the queued promise
      // synchronously and the event loop schedules the woken caller naturally.
      return new Promise<ReleaseFn>((resolve) => {
        queue.push(resolve);
      });
    },
    get inFlight(): number {
      return inFlight;
    },
    get waiting(): number {
      return queue.length;
    },
  };
}

/**
 * Read MCP_SERVER_MAX_PROVIDER_CONCURRENCY from Deno.env. Default 5. Validated:
 * a finite integer >= 1, else fall back to the default. Mirrors the env-read →
 * validate → else-default SHAPE of anthropicCall.ts `readEnvTimeoutMs`; uses
 * `Number()` (not `parseInt`) so a non-integer string like '2.5' falls back to
 * the default rather than being silently truncated to 2 (a cap must be a whole
 * number of permits).
 *
 * This is the ONLY function in the module that touches Deno.env — the gate
 * factory above stays env-free + injectable.
 */
export function readEnvMaxProviderConcurrency(): number {
  const raw = Deno.env.get('MCP_SERVER_MAX_PROVIDER_CONCURRENCY');
  if (!raw) return DEFAULT_MAX_PROVIDER_CONCURRENCY;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_MAX_PROVIDER_CONCURRENCY;
  return parsed;
}

/**
 * The PER-ISOLATE module-singleton resolved cap. Sized from env at module init.
 * Exported so the gate-site test can assert the cap against the IMPORTED
 * resolved value rather than a literal 5 (Card-1B lesson).
 */
export const RESOLVED_MAX_PROVIDER_CONCURRENCY = readEnvMaxProviderConcurrency();

/**
 * The PER-ISOLATE module-singleton semaphore used by callAnthropic. Sized from
 * the resolved cap above at module init.
 */
export const providerConcurrencyGate: BoundedSemaphore = createBoundedSemaphore(
  RESOLVED_MAX_PROVIDER_CONCURRENCY,
);
