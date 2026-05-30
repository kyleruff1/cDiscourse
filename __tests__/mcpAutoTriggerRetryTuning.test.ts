/**
 * OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — provider_server_error longer
 * jittered backoff.
 *
 * The #365 Phase 3 fix types the hosted MCP `{ isError }` overload envelope
 * as `provider_server_error` and routes it through the already-retryable
 * `mcp_api_error` carrier. Phase 4 (PARTIAL) proved the single retry FIRES
 * but its 2s backoff re-enters the still-hot server window under a sustained
 * burst (`retryHeals=0`). This card lengthens the retry DELAY — and ONLY for
 * `provider_server_error` — to a bounded ~7–10s jittered backoff. Everything
 * else (the shared `RETRY_BACKOFF_MS`, `MAX_ATTEMPTS`, the concurrency cap,
 * the retryable set, the submit fire-and-forget) is byte-equal.
 *
 * Coverage-wall split (established by mcpAutoTriggerBoundedConcurrency):
 *   - BEHAVIORAL cases load the pure helper `providerServerErrorBackoffMs`
 *     via the Jest bridge (the helper is pure + zero-import, so the bridge
 *     can require() it). The bound + determinism + clamp live here.
 *   - DISPATCHER invariants are SOURCE-SCANNED (the dispatcher transitively
 *     imports the Deno MCP adapter tree and is NOT Jest-loadable).
 *
 * D7 value-pin convention: the constants are pinned ONCE (the only literal
 * 7000 / 3000 in the suite); every other behavioral assertion uses the
 * imported constants, so a future tune changes only the pin line.
 *
 * NO live Anthropic / xAI / X / MCP network; NO Supabase write; NO Deno.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  edgeProviderServerErrorBackoffMs as providerServerErrorBackoffMs,
  EDGE_PROVIDER_SERVER_ERROR_RETRY_BASE_MS as BASE_MS,
  EDGE_PROVIDER_SERVER_ERROR_RETRY_JITTER_MS as JITTER_MS,
  edgeMaxAutoTriggerConcurrentFamilies as MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
} from './_helpers/booleanObservationEdgeDeno';

const REPO = process.cwd();
const HELPER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/providerServerErrorBackoff.ts',
);
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);
const SUBMIT_PATH = path.join(REPO, 'supabase/functions/submit-argument/index.ts');

/** Strip block + line comments so source-scans test CODE, not doc-comments. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

let helperText = '';
let helperCode = '';
let dispatcherText = '';
let dispatcherCode = '';
let submitText = '';
let submitCode = '';

beforeAll(() => {
  helperText = fs.readFileSync(HELPER_PATH, 'utf8');
  helperCode = stripComments(helperText);
  dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  dispatcherCode = stripComments(dispatcherText);
  submitText = fs.readFileSync(SUBMIT_PATH, 'utf8');
  submitCode = stripComments(submitText);
});

/* ================================================================== */
/* Value pin (D7) — the single literal 7000 / 3000 in the suite       */
/* ================================================================== */

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — constant value pin', () => {
  it('the helper + constants are importable via the bridge and equal 7000 / 3000 TODAY', () => {
    // The ONLY allowed literals 7000 / 3000 in this suite — the single
    // value-pin. Every other behavioral assertion uses the imported
    // constants, so a future tune changes only this line.
    expect(typeof providerServerErrorBackoffMs).toBe('function');
    expect(BASE_MS).toBe(7000);
    expect(JITTER_MS).toBe(3000);
  });
});

/* ================================================================== */
/* (e) bounded delay + longer than 2s + determinism + clamp           */
/*     — the behavioral core                                          */
/* ================================================================== */

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — (e) bounded delay, longer than 2s, deterministic', () => {
  it('hits the exact band endpoints: BASE at rand01=0, BASE+half at 0.5, < BASE+JITTER near 1', () => {
    // Lower endpoint.
    expect(providerServerErrorBackoffMs(1, 0)).toBe(BASE_MS);
    expect(providerServerErrorBackoffMs(1, 0)).toBe(7000);
    // Midpoint: 7000 + floor(0.5 * 3000) = 8500.
    expect(providerServerErrorBackoffMs(1, 0.5)).toBe(BASE_MS + JITTER_MS / 2);
    expect(providerServerErrorBackoffMs(1, 0.5)).toBe(8500);
    // Open upper endpoint: strictly below BASE+JITTER (< 10000), near the top.
    const near1 = providerServerErrorBackoffMs(1, 0.999_999);
    expect(near1).toBeLessThan(BASE_MS + JITTER_MS);
    expect(near1).toBeLessThan(10000);
    expect(near1).toBeGreaterThanOrEqual(BASE_MS + JITTER_MS - 1);
  });

  it('is BOUNDED [BASE, BASE+JITTER) AND > 2000 for every in-range rand01', () => {
    for (const rand01 of [0, 0.25, 0.5, 0.75, 0.999]) {
      const result = providerServerErrorBackoffMs(1, rand01);
      expect(result).toBeGreaterThanOrEqual(BASE_MS);
      expect(result).toBeLessThan(BASE_MS + JITTER_MS);
      // Longer than the standard first-retry backoff (RETRY_BACKOFF_MS[0]).
      expect(result).toBeGreaterThan(2000);
    }
  });

  it('clamps out-of-range / degenerate rand01 so the bound still holds', () => {
    for (const rand01 of [-1, -0.0001, 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = providerServerErrorBackoffMs(1, rand01);
      expect(result).toBeGreaterThanOrEqual(BASE_MS);
      expect(result).toBeLessThan(BASE_MS + JITTER_MS);
      expect(result).toBeGreaterThan(2000);
    }
    // Negative / NaN clamp to 0 → exactly BASE_MS.
    expect(providerServerErrorBackoffMs(1, -1)).toBe(BASE_MS);
    expect(providerServerErrorBackoffMs(1, Number.NaN)).toBe(BASE_MS);
  });

  it('is deterministic and does not branch on attemptNumber (no Math.random inside; constant schedule)', () => {
    // Same rand01 → same result (proves no internal Math.random).
    expect(providerServerErrorBackoffMs(1, 0.42)).toBe(providerServerErrorBackoffMs(1, 0.42));
    expect(providerServerErrorBackoffMs(1, 0.137)).toBe(providerServerErrorBackoffMs(1, 0.137));
    // Forward-compat attemptNumber param does not change the value today.
    expect(providerServerErrorBackoffMs(1, 0.5)).toBe(providerServerErrorBackoffMs(2, 0.5));
    expect(providerServerErrorBackoffMs(1, 0)).toBe(providerServerErrorBackoffMs(99, 0));
  });
});

/* ================================================================== */
/* (a) recovery composition — helper bounded + dispatcher breaks on   */
/*     success after the gated backoff exists                         */
/* ================================================================== */

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — (a) delayed retry then SUCCESS', () => {
  it('behavioral: the helper returns a bounded retry-before-attempt-2 delay', () => {
    // The retry slot (after attempt 1) gets a finite, bounded delay.
    const delay = providerServerErrorBackoffMs(1, 0.5);
    expect(Number.isFinite(delay)).toBe(true);
    expect(delay).toBeGreaterThanOrEqual(BASE_MS);
    expect(delay).toBeLessThan(BASE_MS + JITTER_MS);
  });

  it('dispatcher source-scan: the loop returns triggered on status === success', () => {
    // A healed retry surfaces SUCCESS: the success-break sets
    // outcome: 'triggered' and returns BEFORE the failed/backoff branch.
    expect(dispatcherText).toMatch(/lastSummary\.status\s*===\s*'success'/);
    expect(dispatcherText).toMatch(/outcome:\s*'triggered'/);
    // The success branch precedes the gated backoff line (so the tuned
    // waitMs does not short-circuit a successful retry).
    const successIdx = dispatcherText.indexOf("lastSummary.status === 'success'");
    const backoffIdx = dispatcherText.indexOf('providerServerErrorBackoffMs(');
    expect(successIdx).toBeGreaterThan(-1);
    expect(backoffIdx).toBeGreaterThan(successIdx);
  });
});

/* ================================================================== */
/* (b) repeated provider_server_error → fails after MAX_ATTEMPTS,     */
/*     still typed                                                    */
/* ================================================================== */

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — (b) repeated provider_server_error → terminal failed, typed', () => {
  it('MAX_ATTEMPTS is 2 (exactly one retry) — byte-equal, no extra attempt added', () => {
    expect(dispatcherText).toMatch(/MAX_ATTEMPTS\s*=\s*2/);
  });

  it('the terminal log preserves failureSubReason + failureReason (no re-typing)', () => {
    // Two {isError} failures end `failed`, carrying failure_sub_reason from
    // the terminal summary (so provider_server_error survives) and the
    // returned failureReason is terminal?.failureReason (mcp_api_error).
    expect(dispatcherText).toMatch(/failure_sub_reason:\s*terminal\?\.failureSubReason/);
    expect(dispatcherText).toMatch(/failureReason:\s*terminal\?\.failureReason/);
  });
});

/* ================================================================== */
/* (c) ordinary response-schema failures NOT swept into the longer    */
/*     delay; not retryable anyway                                    */
/* ================================================================== */

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — (c) response-schema failures NOT swept in', () => {
  it('the longer delay is gated STRICTLY on failureSubReason === provider_server_error', () => {
    // The ternary condition is the exact literal equality — not a prefix
    // match, not the broad failure_reason. Other sub-reasons take the else.
    expect(dispatcherCode).toMatch(
      /lastSummary\.failureSubReason\s*===\s*'provider_server_error'/,
    );
    // The longer delay is invoked ONLY in the truthy arm of that gate.
    const gateIdx = dispatcherCode.indexOf("lastSummary.failureSubReason === 'provider_server_error'");
    const helperCallIdx = dispatcherCode.indexOf('providerServerErrorBackoffMs(');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(helperCallIdx).toBeGreaterThan(gateIdx);
  });

  it('response-schema sub-reasons are not named in the backoff gate (not swept in)', () => {
    // No response_* sub-reason appears in the gate; they fall to the else
    // (shared RETRY_BACKOFF_MS) — and ride non-retryable carriers anyway.
    expect(dispatcherCode).not.toContain('response_wrong_schema_version');
    expect(dispatcherCode).not.toContain('response_not_json');
  });

  it('mcp_validation_failed is NOT in RETRYABLE_FAILURE_REASONS (response-schema rides non-retryable)', () => {
    const setBlock = dispatcherText.match(/RETRYABLE_FAILURE_REASONS[\s\S]*?Set\(\s*\[([^\]]+)\]/);
    expect(setBlock).not.toBeNull();
    const setBody = setBlock![1];
    expect(setBody).not.toContain('mcp_validation_failed');
    expect(setBody).not.toContain('mcp_parse_failure');
  });
});

/* ================================================================== */
/* (d) doctrine / ban-list failures NOT retried (unchanged)           */
/* ================================================================== */

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — (d) doctrine / ban-list NOT retried', () => {
  it('RETRYABLE_FAILURE_REASONS is the byte-equal 3-element transient set', () => {
    const setBlock = dispatcherText.match(/RETRYABLE_FAILURE_REASONS[\s\S]*?Set\(\s*\[([^\]]+)\]/);
    expect(setBlock).not.toBeNull();
    const entries = (setBlock![1].match(/'[^']+'/g) ?? []).map((s) => s.replace(/'/g, ''));
    expect(entries).toEqual(['mcp_network_error', 'mcp_api_error', 'mcp_rate_limited']);
    // No doctrine / ban-list / validation carrier is retryable.
    expect(entries).not.toContain('mcp_validation_failed');
  });

  it('the gate literal is exactly provider_server_error — no broadening prefix match', () => {
    // A prefix match (startsWith('provider_')) would sweep
    // provider_rate_limited / provider_api_error / provider_network_error.
    // The gate must be the exact-equality literal only.
    expect(dispatcherCode).not.toMatch(/startsWith\(\s*'provider_'\s*\)/);
    expect(dispatcherCode).not.toMatch(/failureSubReason\.startsWith/);
    expect(dispatcherCode).toMatch(/===\s*'provider_server_error'/);
  });
});

/* ================================================================== */
/* (f) concurrency stays 2                                            */
/* ================================================================== */

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — (f) concurrency stays 2', () => {
  it('the imported concurrency cap equals 2 (value pin reused)', () => {
    expect(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES).toBe(2);
  });

  it('the dispatcher still passes MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES to the runner (no literal added)', () => {
    expect(dispatcherText).toMatch(
      /runWithBoundedConcurrency\([\s\S]*?MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES/,
    );
    // This card added no concurrency literal to the dispatcher.
    expect(dispatcherCode).not.toMatch(/runWithBoundedConcurrency\(\s*\w+\s*,\s*3\b/);
  });
});

/* ================================================================== */
/* (g) submit fire-and-forget unchanged                              */
/* ================================================================== */

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — (g) submit fire-and-forget unchanged', () => {
  it('submit dispatches with .catch(() => undefined) and never awaits the dispatcher', () => {
    expect(submitText).toMatch(
      /dispatchAutoTriggerForArgument\([^)]*\)\s*\.catch\s*\(\s*\(\s*\)\s*=>\s*undefined\s*\)/,
    );
    expect(submitText).not.toMatch(/await\s+dispatchAutoTriggerForArgument/);
  });

  it('submit returns created(...) after the dispatch (response not gated on dispatcher)', () => {
    // Scan CODE only — the file's header doc-comment legitimately names
    // `return created(...)` when documenting the dispatch-before-return
    // ordering, which would otherwise appear before the dispatch call.
    const dispatchIdx = submitCode.indexOf('dispatchAutoTriggerForArgument(');
    const returnIdx = submitCode.indexOf('return created(');
    expect(dispatchIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(dispatchIdx);
  });
});

/* ================================================================== */
/* (h) no secrets in the new helper / dispatcher edit                 */
/* ================================================================== */

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — (h) helper purity + no secrets', () => {
  it('the helper imports nothing (fully standalone, Jest-loadable)', () => {
    expect(helperText).not.toMatch(/^\s*import\s/m);
  });

  it('the helper has NO Math.random inside (HALT-6 — random is at the call site)', () => {
    // Scan CODE only — the doc-comment legitimately documents that
    // `Math.random()` is supplied at the dispatcher call site, NOT here.
    expect(helperCode).not.toMatch(/Math\.random/);
  });

  it('the helper code has no Deno / fetch / console / network surface', () => {
    expect(helperCode).not.toContain('Deno.');
    expect(helperCode).not.toMatch(/\bfetch\s*\(/);
    expect(helperCode).not.toMatch(/console\.\w+\s*\(/);
  });

  it('the helper + dispatcher edit carry NO secret-shaped literal', () => {
    const secretPatterns = [
      /Authorization/i,
      /Bearer\s/,
      /SERVICE_ROLE/,
      /sk-ant-/,
      /xai-/,
      /sb_secret_/,
      /eyJ[A-Za-z0-9_-]{10,}/, // JWT-shape
    ];
    // The helper is fully clean.
    for (const re of secretPatterns) {
      expect(helperText).not.toMatch(re);
    }
    // The Math.random()-bearing gated line introduces no secret literal.
    expect(dispatcherCode).not.toMatch(/sk-ant-/);
    expect(dispatcherCode).not.toMatch(/sb_secret_/);
    expect(dispatcherCode).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });

  it('the helper returns a number — it adds no new field to any log/return surface', () => {
    expect(typeof providerServerErrorBackoffMs(1, 0.5)).toBe('number');
  });

  it('the new helper + the edited dispatcher carry ZERO verdict tokens (doctrine ban-list)', () => {
    const banned = [
      'winner',
      'loser',
      'liar',
      'dishonest',
      'bad faith',
      'manipulative',
      'extremist',
      'propagandist',
      'truth value',
    ];
    for (const src of [helperText, dispatcherText]) {
      const lower = src.toLowerCase();
      for (const term of banned) {
        expect(lower.includes(term)).toBe(false);
      }
    }
  });
});

/* ================================================================== */
/* Math.random location — random is at the dispatcher call site,      */
/* never in the pure helper                                          */
/* ================================================================== */

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — Math.random is at the call site', () => {
  it('the dispatcher supplies Math.random() to the helper on the gated line', () => {
    expect(dispatcherCode).toMatch(/providerServerErrorBackoffMs\(\s*attemptNumber\s*,\s*Math\.random\(\)\s*\)/);
  });

  it('the dispatcher imports the helper from ./providerServerErrorBackoff.ts', () => {
    expect(dispatcherText).toMatch(
      /import\s*\{\s*providerServerErrorBackoffMs\s*\}\s*from\s*'\.\/providerServerErrorBackoff\.ts'/,
    );
  });

  it('the else arm is byte-equal the shared RETRY_BACKOFF_MS expression', () => {
    expect(dispatcherText).toContain(
      'RETRY_BACKOFF_MS[attemptNumber - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]',
    );
  });
});
