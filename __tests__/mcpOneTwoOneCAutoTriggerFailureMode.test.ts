/**
 * MCP-021C-AUTO-TRIGGER-FAMILY-A — Failure-mode + retry-semantics tests.
 *
 * Verifies the bounded retry / failure semantics per design §4. The
 * dispatcher is Deno-only and source-scanned for:
 *   - The 7 unavailable adapter reasons map to stable `failure_reason`
 *     strings (lifted from classifyArgumentCore.ts).
 *   - Retry cap is 2 attempts for transient classes only
 *     (network_error / api_error / rate_limited).
 *   - Non-retryable classes (url_missing / token_missing /
 *     parse_failure / validation_failed) attempt exactly once.
 *   - Backoff schedule is 2s then 8s.
 *   - Skip-on-disabled returns 'skipped' with reason 'config_disabled'
 *     and writes NO run row (no persistRun call in the disabled path).
 *   - Skip-on-family-not-enabled returns 'skipped' with reason
 *     'family_not_enabled'; no run row.
 *   - Submit-not-blocked: dispatcher promise is in the
 *     fire-and-forget tail, not the response return.
 *   - Defensive: dispatcher NEVER throws; uncaught conditions surface
 *     as `outcome: 'failed', failureReason: 'unexpected_error'`.
 *
 * Forecast: ~22 tests (FAIL-1 through FAIL-22).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts',
);
const SUBMIT_PATH = path.join(REPO, 'supabase/functions/submit-argument/index.ts');

let dispatcherText = '';
let coreText = '';
let submitText = '';

beforeAll(() => {
  dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  submitText = fs.readFileSync(SUBMIT_PATH, 'utf8');
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — adapter unavailable → failure_reason mapping', () => {
  // Each adapter unavailable reason maps to a stable `mcp_<reason>`
  // failure_reason string. The mapping lives in classifyArgumentCore.ts;
  // the dispatcher does not re-map.
  it('FAIL-1 — url_missing maps to mcp_url_missing', () => {
    expect(coreText).toContain("'url_missing'");
    expect(coreText).toContain('mcp_url_missing');
  });

  it('FAIL-2 — token_missing maps to mcp_token_missing', () => {
    expect(coreText).toContain("'token_missing'");
    expect(coreText).toContain('mcp_token_missing');
  });

  it('FAIL-3 — network_error maps to mcp_network_error', () => {
    expect(coreText).toContain("'network_error'");
    expect(coreText).toContain('mcp_network_error');
  });

  it('FAIL-4 — api_error maps to mcp_api_error', () => {
    expect(coreText).toContain("'api_error'");
    expect(coreText).toContain('mcp_api_error');
  });

  it('FAIL-5 — rate_limited maps to mcp_rate_limited', () => {
    expect(coreText).toContain("'rate_limited'");
    expect(coreText).toContain('mcp_rate_limited');
  });

  it('FAIL-6 — parse_failure maps to mcp_parse_failure', () => {
    expect(coreText).toContain("'parse_failure'");
    expect(coreText).toContain('mcp_parse_failure');
  });

  it('FAIL-7 — validation_failed maps to mcp_validation_failed', () => {
    expect(coreText).toContain("'validation_failed'");
    expect(coreText).toContain('mcp_validation_failed');
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — retry policy', () => {
  it('FAIL-8 — retry cap is 2 attempts total (MAX_ATTEMPTS constant)', () => {
    expect(dispatcherText).toMatch(/MAX_ATTEMPTS\s*=\s*2/);
  });

  it('FAIL-9 — backoff schedule is 2s then 8s (RETRY_BACKOFF_MS)', () => {
    // The schedule is declared as a frozen array literal. Check both
    // numeric values appear in the correct order.
    const scheduleMatch = dispatcherText.match(/RETRY_BACKOFF_MS[\s\S]*?Object\.freeze\(\s*\[([^\]]+)\]/);
    expect(scheduleMatch).not.toBeNull();
    const arrayBody = scheduleMatch![1];
    const firstIdx = arrayBody.indexOf('2_000');
    const secondIdx = arrayBody.indexOf('8_000');
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it('FAIL-10 — retryable classes are network_error / api_error / rate_limited only', () => {
    const setBlock = dispatcherText.match(/RETRYABLE_FAILURE_REASONS[\s\S]*?Set\(\s*\[([^\]]+)\]/);
    expect(setBlock).not.toBeNull();
    const setBody = setBlock![1];
    expect(setBody).toContain('mcp_network_error');
    expect(setBody).toContain('mcp_api_error');
    expect(setBody).toContain('mcp_rate_limited');
    // Non-retryable classes must NOT be in the set.
    expect(setBody).not.toContain('mcp_url_missing');
    expect(setBody).not.toContain('mcp_token_missing');
    expect(setBody).not.toContain('mcp_parse_failure');
    expect(setBody).not.toContain('mcp_validation_failed');
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — skip-on-disabled', () => {
  it('FAIL-11 — disabled runtime config returns outcome \'skipped\' with reason \'config_disabled\'', () => {
    // The dispatcher emits `outcome: 'skipped'` and
    // `skipReason: 'config_disabled'` in the disabled branch.
    expect(dispatcherText).toContain("skipReason: 'config_disabled'");
    expect(dispatcherText).toContain("skip_reason: 'config_disabled'");
  });

  it('FAIL-12 — disabled path writes NO run row (persistRun is not called when skipped)', () => {
    // The dispatcher does not call persistRun in the disabled or
    // family-not-enabled branches — only classifyOneArgumentCore writes
    // run rows, and it is gated AFTER the skip checks.
    expect(dispatcherText).not.toContain('persistRun(');
    // Confirm the skip check fires BEFORE any classifier invocation.
    const enabledCheckIdx = dispatcherText.indexOf("'config_disabled'");
    const classifyIdx = dispatcherText.indexOf('classifyOneArgumentCore(');
    expect(enabledCheckIdx).toBeGreaterThan(-1);
    expect(classifyIdx).toBeGreaterThan(enabledCheckIdx);
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — skip-on-family-not-enabled', () => {
  it('FAIL-13 — empty productionEnabledFamilies() result returns \'skipped\' with reason \'family_not_enabled\' (registry-derived post Stage 2B)', () => {
    // Post Stage 2B (MCP-021C-EDGE-FAMILIES-B-C-ENABLE): the dispatcher
    // sources its production family list from productionEnabledFamilies()
    // directly (the registry helper returns an already-filtered list).
    // The defensive zero-length branch still fires the same skip outcome,
    // but the upstream helper is productionEnabledFamilies() not
    // filterFamiliesForMode (the registry IS the filter).
    expect(dispatcherText).toContain("skipReason: 'family_not_enabled'");
    expect(dispatcherText).toContain("skip_reason: 'family_not_enabled'");
    expect(dispatcherText).toMatch(/productionEnabledFamilies\s*\(\s*\)/);
    expect(dispatcherText).toMatch(/eligibleFamilies\.length\s*===\s*0/);
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — submit-not-blocked invariants', () => {
  it('FAIL-14 — dispatcher promise is NOT in the submit response return path', () => {
    // The response builder uses `return created(...)`. The dispatcher
    // call appears earlier in the function; there is no `await
    // dispatchAutoTriggerForArgument` in the call site.
    expect(submitText).not.toMatch(/await\s+dispatchAutoTriggerForArgument/);
  });

  it('FAIL-15 — submit-argument handler does NOT inspect dispatcher resolution before returning', () => {
    // The dispatcher's promise value is never bound to a local consumed
    // by the response builder. Source pattern: the promise is bound to
    // `autoTriggerPromise` but never `await`ed or `.then()`ed in
    // submit-argument.
    expect(submitText).not.toMatch(/autoTriggerPromise\.then/);
    expect(submitText).not.toMatch(/await\s+autoTriggerPromise/);
  });

  it('FAIL-16 — dispatcher promise is wrapped in .catch(() => undefined)', () => {
    expect(submitText).toMatch(
      /dispatchAutoTriggerForArgument\([^)]+\)\s*\.catch\s*\(\s*\(\s*\)\s*=>\s*undefined\s*\)/,
    );
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — persistence on adapter failure', () => {
  it('FAIL-17 — adapter unavailable persists run row with status=\'failed\' + failure_reason', () => {
    // The classifier core writes a run row on the unavailable branch.
    expect(coreText).toMatch(/status:\s*['"]failed['"]/);
    expect(coreText).toContain('failureReason');
    expect(coreText).toContain('unavailableReasonToFailureReason');
  });

  it('FAIL-18 — adapter unavailable writes zero result rows', () => {
    // In the unavailable branch, the classifier returns without
    // invoking persistResults. The success branch is the only path
    // that calls persistResults; the unavailable branch returns early.
    const unavailableBlock = coreText.match(
      /if\s*\(\s*adapterResult\.kind\s*===\s*['"]unavailable['"]\s*\)\s*\{[\s\S]*?return\s*\{[\s\S]*?\};\s*\}/,
    );
    expect(unavailableBlock).not.toBeNull();
    const unavailableBlockBody = unavailableBlock![0];
    expect(unavailableBlockBody).not.toContain('persistResults(');
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — argument-not-found skip', () => {
  it('FAIL-19 — argument_not_found returns \'skipped\' with skipReason argument_not_found', () => {
    expect(dispatcherText).toContain("skipReason: 'argument_not_found'");
    expect(dispatcherText).toContain("skip_reason: 'argument_not_found'");
    expect(dispatcherText).toContain("'argument_not_found'");
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — persistence failure surfacing', () => {
  it('FAIL-20 — persist_run_failed surfaces as outcome failed in the core summary', () => {
    expect(coreText).toContain('persist_run_failed');
  });

  it('FAIL-21 — persist_results_failed:<code> surfaces as failureReason in the core summary', () => {
    expect(coreText).toContain('persist_results_failed');
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — defensive try/catch', () => {
  it('FAIL-22 — dispatcher body wraps in try/catch returning unexpected_error on uncaught', () => {
    // The whole dispatcher body is wrapped in try/catch. The catch
    // surface returns a sanitized failed outcome.
    expect(dispatcherText).toMatch(/try\s*\{[\s\S]*?\}\s*catch\s*\{/);
    expect(dispatcherText).toContain("failureReason: 'unexpected_error'");
  });
});

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — typed sub-reason threading (Phase 1)', () => {
  // The FAIL-1..7 failure_reason mapping above is UNCHANGED — the typed
  // sub-reason is ADDITIVE. These assertions prove the new fields ride
  // alongside the byte-equal failure_reason mapping.
  it('FAIL-23 — the unavailable branch reads adapterResult.subReason / .detail', () => {
    expect(coreText).toContain('adapterResult.subReason');
    expect(coreText).toContain('adapterResult.detail');
  });

  it('FAIL-24 — the unavailable branch sets failureSubReason + failureDetail on the summary', () => {
    expect(coreText).toMatch(/failureSubReason:\s*adapterResult\.subReason/);
    expect(coreText).toMatch(/failureDetail:\s*adapterResult\.detail/);
  });

  it('FAIL-25 — failure_reason mapping is unchanged (validation_failed → mcp_validation_failed survives the additive change)', () => {
    // Regression proof: the additive sub-reason did NOT disturb the
    // existing failure_reason strings (the FAIL-1..7 contract).
    expect(coreText).toContain('mcp_validation_failed');
    expect(coreText).toContain('unavailableReasonToFailureReason');
    // The sub-reason field is NOT derived from the failure_reason string.
    expect(coreText).not.toMatch(/failureReason:\s*adapterResult\.subReason/);
  });
});

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — RETRYABLE_FAILURE_REASONS byte-equal after Phase 3 (HALT-1 guard)', () => {
  it('FAIL-26 — RETRYABLE_FAILURE_REASONS is STILL the 3-element set (mcp_api_error present, mcp_validation_failed absent)', () => {
    // Phase 3 carries the `{isError}` envelope on the EXISTING `api_error`
    // reason → `mcp_api_error`, which is ALREADY retryable. NO new entry
    // was added; no broad class became retryable. This is the HALT-1
    // regression guard: the set must be byte-equal to the pre-Phase-3
    // 3-element set.
    const setBlock = dispatcherText.match(/RETRYABLE_FAILURE_REASONS[\s\S]*?Set\(\s*\[([^\]]+)\]/);
    expect(setBlock).not.toBeNull();
    const setBody = setBlock![1];
    // Exactly the three transient classes — count the quoted entries.
    const entries = (setBody.match(/'[^']+'/g) ?? []).map((s) => s.replace(/'/g, ''));
    expect(entries).toEqual(['mcp_network_error', 'mcp_api_error', 'mcp_rate_limited']);
    // The envelope rides mcp_api_error (retryable); mcp_validation_failed
    // (the old mis-type) is NOT retryable.
    expect(entries).toContain('mcp_api_error');
    expect(entries).not.toContain('mcp_validation_failed');
    // MAX_ATTEMPTS = 2 (exactly one retry) byte-equal.
    expect(dispatcherText).toMatch(/MAX_ATTEMPTS\s*=\s*2/);
    // Concurrency cap referenced (bounded, unedited).
    expect(dispatcherText).toContain('MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES');
  });
});

describe('OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — provider_server_error longer backoff (regression guards)', () => {
  // This card lengthens the retry DELAY for `provider_server_error` ONLY.
  // These 3 source-scans complement FAIL-9 (RETRY_BACKOFF_MS order) and
  // FAIL-26 (RETRYABLE_FAILURE_REASONS byte-equal) as the HALT-1/2/3/6
  // regression guards. FAIL-1..26 above are UNCHANGED.
  it('FAIL-27 — shared RETRY_BACKOFF_MS is STILL frozen [2_000, 8_000] and MAX_ATTEMPTS = 2 (HALT-2/3)', () => {
    // The longer provider_server_error delay lives in the helper; the
    // shared schedule (genuine api_error / network / rate-limit first
    // retry) and the attempt cap MUST be byte-equal.
    const scheduleMatch = dispatcherText.match(
      /RETRY_BACKOFF_MS[\s\S]*?Object\.freeze\(\s*\[([^\]]+)\]/,
    );
    expect(scheduleMatch).not.toBeNull();
    const entries = (scheduleMatch![1].match(/\d[\d_]*/g) ?? []).map((s) => s.replace(/_/g, ''));
    expect(entries).toEqual(['2000', '8000']);
    expect(dispatcherText).toMatch(/MAX_ATTEMPTS\s*=\s*2/);
  });

  it('FAIL-28 — the longer delay is gated on failureSubReason === provider_server_error; else byte-equal RETRY_BACKOFF_MS (HALT-1)', () => {
    // The tuned delay is provider_server_error-only — NOT applied to any
    // other class — and the else arm is the character-for-character
    // current shared-schedule expression.
    expect(dispatcherText).toMatch(
      /lastSummary\.failureSubReason\s*===\s*'provider_server_error'/,
    );
    expect(dispatcherText).toContain(
      'RETRY_BACKOFF_MS[attemptNumber - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]',
    );
  });

  it('FAIL-29 — dispatcher calls providerServerErrorBackoffMs(...) with Math.random() at the call site, imports the helper (HALT-6)', () => {
    // Random is supplied in the dispatcher (the helper is pure + takes
    // rand01). The helper is imported from its own pure module.
    expect(dispatcherText).toMatch(
      /providerServerErrorBackoffMs\(\s*attemptNumber\s*,\s*Math\.random\(\)\s*\)/,
    );
    expect(dispatcherText).toMatch(
      /import\s*\{\s*providerServerErrorBackoffMs\s*\}\s*from\s*'\.\/providerServerErrorBackoff\.ts'/,
    );
  });
});
