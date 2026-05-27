/**
 * MCP-021C-EDGE-RESPONSE-SUMMARY-FIX — Test: per-arg response summary
 * reflects actual persisted result row counts (not silent in-memory state).
 *
 * Motivating evidence: `docs/audits/MCP-021C-EDGE-SMOKE-2026-05-26.md`
 * Phase 3 found the Edge Function reported `positiveObservationCount: 0`
 * across 3 admin_validation runs despite persistence holding 6 positive
 * result rows. The chain (edge → MCP → Anthropic → parser → sanitizer →
 * persistence) worked correctly; only the response summary was wrong.
 *
 * The fix:
 *   1. Capture `persistResults`'s return value (no longer fire-and-forget).
 *   2. After persisting (or skipping persist when zero positives), run a
 *      post-persist SELECT against `argument_machine_observation_results`
 *      filtered by `run_id`. That SELECT is the source of truth for the
 *      response summary.
 *   3. Persist failures are surfaced explicitly via
 *      `failureReason: 'persist_results_failed:...'`.
 *
 * This test file follows the established MCP-021C-EDGE source-scan pattern
 * (`mcpOneTwoOneCEdgeFunctionHandler.test.ts`): the handler imports Deno
 * APIs and the Deno-only MCP adapter, so Jest cannot execute it. Coverage
 * is via source-text assertions against the binding patterns.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const HANDLER_PATH = path.join(
  REPO,
  'supabase/functions/classify-argument-boolean-observations/index.ts',
);

let handlerText = '';

beforeAll(() => {
  handlerText = fs.readFileSync(HANDLER_PATH, 'utf8');
});

// ─────────────────────────────────────────────────────────────────────
// New behavior: per-arg summary backed by post-persist SELECT
// ─────────────────────────────────────────────────────────────────────

describe('MCP-021C-EDGE-RESPONSE-SUMMARY-FIX — capture persistResults outcome', () => {
  it('SUM-1 — handler captures persistResults return value (no fire-and-forget)', () => {
    // Pre-fix: `await persistResults(resultsToWrite);` (return ignored)
    // Post-fix: result is bound to a local + branched on `.ok`
    expect(handlerText).toMatch(
      /const\s+writeResult\s*=\s*await\s+persistResults\s*\(\s*resultsToWrite\s*\)/,
    );
  });

  it('SUM-2 — persist failure surfaces via persist_results_failed failureReason', () => {
    // The previous code silently dropped persist failures. The fix makes
    // them visible via a stable failure_reason prefix.
    expect(handlerText).toContain('persist_results_failed');
  });

  it('SUM-3 — persistFailureReason variable carries the failure forward', () => {
    expect(handlerText).toMatch(/let\s+persistFailureReason\s*:\s*string\s*\|\s*null/);
  });

  it('SUM-4 — handler branches on writeResult.ok to detect failure', () => {
    expect(handlerText).toMatch(/!\s*writeResult\.ok/);
  });
});

describe('MCP-021C-EDGE-RESPONSE-SUMMARY-FIX — post-persist SELECT is the source of truth', () => {
  it('SUM-5 — handler performs a SELECT against argument_machine_observation_results filtered by run_id', () => {
    expect(handlerText).toContain('argument_machine_observation_results');
    expect(handlerText).toMatch(
      /\.from\s*\(\s*['"]argument_machine_observation_results['"]\s*\)/,
    );
    expect(handlerText).toMatch(/\.eq\s*\(\s*['"]run_id['"]\s*,\s*runWrite\.runId\s*\)/);
  });

  it('SUM-6 — SELECT returns the raw_key column needed for rawKeysWithPositive', () => {
    expect(handlerText).toMatch(/\.select\s*\(\s*['"]raw_key['"]\s*\)/);
  });

  it('SUM-7 — actualPositiveCount derived from the post-persist SELECT rows', () => {
    expect(handlerText).toMatch(/actualPositiveCount/);
    expect(handlerText).toMatch(/persistedRows\?\.length/);
  });

  it('SUM-8 — actualRawKeys derived from the post-persist SELECT rows', () => {
    expect(handlerText).toMatch(/actualRawKeys/);
    expect(handlerText).toMatch(
      /persistedRows\s*\?\?\s*\[\]\s*\)\.map\s*\(\s*\(\s*r\s*:\s*\{\s*raw_key\s*:\s*string\s*\}/,
    );
  });

  it('SUM-9 — countError falls back to in-memory count (defensive; never blocks the response)', () => {
    // If the post-persist SELECT errors, we don't want the response to
    // 500. Fall back to the in-memory tracker so the response still
    // tells the caller something.
    expect(handlerText).toMatch(/countError/);
    expect(handlerText).toMatch(/countError\s*\?\s*resultsToWrite\.length/);
    expect(handlerText).toMatch(/countError\s*\?\s*inMemoryRawKeys/);
  });

  it('SUM-10 — in-memory aggregation renamed to inMemoryRawKeys to signal it is not the source of truth', () => {
    // The pre-fix name `rawKeysWithPositive` was confusing: it implied
    // those keys WERE in the response, when in fact they were only
    // proposed. The rename clarifies the distinction between proposed
    // (in-memory) and actual (post-persist).
    expect(handlerText).toMatch(/const\s+inMemoryRawKeys\s*:\s*string\[\]\s*=/);
  });
});

describe('MCP-021C-EDGE-RESPONSE-SUMMARY-FIX — response summary fields use actual values', () => {
  it('SUM-11 — success + persist-failed returns both use actualPositiveCount', () => {
    // Pre-fix: `positiveObservationCount: resultsToWrite.length` (in-memory only).
    // Post-fix: `positiveObservationCount: actualPositiveCount` (post-persist SELECT).
    // Appears in BOTH return paths (success + persist-failed) — count both occurrences.
    const matches = handlerText.match(/positiveObservationCount\s*:\s*actualPositiveCount/g);
    expect(matches).not.toBeNull();
    expect((matches ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('SUM-12 — success + persist-failed returns both use actualRawKeys', () => {
    const matches = handlerText.match(/rawKeysWithPositive\s*:\s*actualRawKeys/g);
    expect(matches).not.toBeNull();
    expect((matches ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('SUM-13 — pre-fix in-memory count is no longer the source of truth in returns', () => {
    // The pre-fix code had `positiveObservationCount: resultsToWrite.length`
    // in the success return. After the fix, no return statement uses
    // `resultsToWrite.length` directly. The variable is still constructed
    // (input to persistResults) but no longer surfaces in the response.
    expect(handlerText).not.toMatch(/positiveObservationCount\s*:\s*resultsToWrite\.length/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Regression: existing behavior preserved
// ─────────────────────────────────────────────────────────────────────

describe('MCP-021C-EDGE-RESPONSE-SUMMARY-FIX — production mode behavior unchanged (regression)', () => {
  it('REG-1 — production-mode family gate is preserved', () => {
    // The fix is scoped to the success-path response builder. The
    // production-mode family gate at the boundary must remain.
    expect(handlerText).toContain("mode === 'production'");
    expect(handlerText).toContain('no_eligible_families_for_production');
    expect(handlerText).toContain('filterFamiliesForMode');
  });

  it('REG-2 — production-mode validates that at least one family is production-eligible', () => {
    // The pre-fix logic: if production mode and zero eligible families,
    // return 422 with structured error. The fix must not regress.
    const productionGate = handlerText.split("body.mode === 'production'")[1] ?? '';
    expect(productionGate).toContain('filterFamiliesForMode');
    expect(productionGate).toContain('no_eligible_families_for_production');
  });

  it('REG-3 — admin auth gate still requires admin for BOTH modes (Decision 7)', () => {
    // The pre-fix requireAdmin check before per-arg classification must
    // remain. The fix touches only the response-building tail.
    expect(handlerText).toMatch(/await\s+requireAdmin\s*\(\s*req\s*\)/);
  });

  it('REG-4 — both modes still go through the same classifyOneArgument code path', () => {
    // The fix is in classifyOneArgument's response builder. Both modes
    // must continue to invoke it identically (with mode passed through).
    const inLoop = /classifyOneArgument\s*\(\s*argumentId\s*,\s*body\.requestedFamilies\s*,\s*body\.mode/;
    expect(inLoop.test(handlerText)).toBe(true);
  });

  it('REG-5 — sanitization at inspect floor is preserved', () => {
    expect(handlerText).toContain('sanitizeMcpBooleanObservationResponse');
    expect(handlerText).toMatch(/surface\s*:\s*['"]inspect['"]/);
  });

  it('REG-6 — adapter-unavailable failureReason mapping is preserved', () => {
    // The 7 failure_reason strings from MCP-021A-EDGE Decision 4.2 must
    // remain reachable for unavailable adapter outcomes.
    expect(handlerText).toContain('mcp_url_missing');
    expect(handlerText).toContain('mcp_token_missing');
    expect(handlerText).toContain('mcp_network_error');
    expect(handlerText).toContain('mcp_api_error');
    expect(handlerText).toContain('mcp_rate_limited');
    expect(handlerText).toContain('mcp_parse_failure');
    expect(handlerText).toContain('mcp_validation_failed');
  });

  it('REG-7 — persistRun is still called before persistResults (run row must exist for FK)', () => {
    const runIdx = handlerText.indexOf('persistRun(');
    const resultsIdx = handlerText.indexOf('persistResults(');
    expect(runIdx).toBeGreaterThan(-1);
    expect(resultsIdx).toBeGreaterThan(-1);
    expect(runIdx).toBeLessThan(resultsIdx);
  });

  it('REG-8 — PerArgumentSummary contract is preserved (no new fields; no removed fields)', () => {
    // The fix changes how the fields are populated, not the typed
    // contract. Any client (admin tooling, etc.) consuming the
    // response should not see a shape change.
    const summaryBlockMatch = handlerText.match(/interface\s+PerArgumentSummary\s*\{[\s\S]*?\n\}/);
    expect(summaryBlockMatch).not.toBeNull();
    const summaryBlock = summaryBlockMatch![0];
    expect(summaryBlock).toContain('argumentId');
    expect(summaryBlock).toContain('runId');
    expect(summaryBlock).toContain('status');
    expect(summaryBlock).toContain('failureReason');
    expect(summaryBlock).toContain('positiveObservationCount');
    expect(summaryBlock).toContain('rawKeysWithPositive');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Doctrine / boundary guards
// ─────────────────────────────────────────────────────────────────────

describe('MCP-021C-EDGE-RESPONSE-SUMMARY-FIX — doctrine and security guards', () => {
  it('DOC-1 — no console.log added in the fix (audit-trail must stay clean)', () => {
    const codeWithoutComments = stripBlockComments(handlerText);
    expect(/\bconsole\.log\s*\(/.test(codeWithoutComments)).toBe(false);
  });

  it('DOC-2 — fix does NOT log raw response body or evidenceSpan strings', () => {
    // The SELECT returns raw_key only (line scanned in SUM-6).
    // Evidence spans, model prompts, token values, etc. must not be
    // surfaced through any logging added by this fix.
    expect(handlerText).not.toMatch(/console\.\w+\([^)]*evidenceSpan/);
    expect(handlerText).not.toMatch(/console\.\w+\([^)]*evidence_span/);
  });

  it('DOC-3 — no service-role key surface in the fix', () => {
    // The createServiceClient pattern is preserved; the fix uses the
    // existing serviceClient without re-instantiating or exporting.
    expect(handlerText).not.toMatch(/Deno\.env\.get\(\s*['"]SUPABASE_SERVICE_ROLE_KEY['"]/);
  });

  it('DOC-4 — fix references the source audit motivating the change', () => {
    // The comment block above the new code names the audit that
    // surfaced the bug so future maintainers can trace why the
    // post-persist SELECT exists.
    expect(handlerText).toContain('MCP-021C-EDGE-RESPONSE-SUMMARY-FIX');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Strip /* ... *\/ block comments so a code scan doesn't trip over
 * commentary that references token / log / etc.
 */
function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}
