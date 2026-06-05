/**
 * OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — Phase 1 (TYPE).
 *
 * Threading + surface coverage for the typed sub-reason — the parts NOT
 * already covered by the adapter source-scan suite
 * (`mcpOneTwoOneCEdgeAdapterSourceScan.test.ts` SCAN-21..25, which proves
 * the adapter wiring + HALT-9 + no-parsed.details) or the failure-mode
 * suite (`mcpOneTwoOneCAutoTriggerFailureMode.test.ts` FAIL-23..25, which
 * proves the classifyArgumentCore unavailable-branch wiring).
 *
 * This suite adds the behavioral duration-discriminator (the contract's
 * headline) on the pure, Jest-loadable map, plus the
 * PerArgumentSummary / AutoTriggerLogFields / dispatcher SURFACE scans
 * that the other two suites do not assert.
 *
 * Why source-scan for the wiring: the Deno adapter reads `Deno.env.get` +
 * `fetch`, and `classifyArgumentCore.ts` transitively pulls
 * `npm:@supabase/supabase-js` through `supabaseClients.ts` — NEITHER is
 * Jest-loadable (the repo's established coverage wall; see the bridge note
 * in `_helpers/booleanObservationEdgeDeno.ts`). The behavioral proof rides
 * on the pure map; the wiring is source-scanned.
 */
import * as fs from 'fs';
import * as path from 'path';

import { edgeMapToFailureSubreason } from './_helpers/booleanObservationFailureSubreasonDeno';

const REPO = process.cwd();
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts',
);
const LOG_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerLog.ts',
);
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);

let coreText = '';
let logText = '';
let dispatcherText = '';

beforeAll(() => {
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  logText = fs.readFileSync(LOG_PATH, 'utf8');
  dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
});

// ─────────────────────────────────────────────────────────────────────
// Duration discriminator — behavioral (pure map). The contract headline.
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — duration discriminator (behavioral)', () => {
  it('THR-1 — a slow response-side validator failure types as response_*; a provider failure types as provider_*', () => {
    expect(edgeMapToFailureSubreason('validation_failed', 'wrong_shape')).toBe('response_wrong_shape');
    expect(edgeMapToFailureSubreason('validation_failed', 'missing_required_field')).toBe(
      'response_missing_required_field',
    );
    expect(edgeMapToFailureSubreason('network_error')!.startsWith('provider_')).toBe(true);
    expect(edgeMapToFailureSubreason('rate_limited')!.startsWith('provider_')).toBe(true);
  });

  it('THR-2 — the response_ vs provider_ prefix is the durable Phase-2 discriminator (different fixes)', () => {
    // The whole point: a result-side (slow) failure and a provider-side
    // (transport) failure carry DIFFERENT prefixes even though both
    // legacy-collapse to a single unavailable result.
    const responseSide = edgeMapToFailureSubreason('validation_failed', 'wrong_shape');
    const providerSide = edgeMapToFailureSubreason('network_error');
    expect(responseSide!.split('_')[0]).not.toBe(providerSide!.split('_')[0]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// PerArgumentSummary — the RETURN surface (the load-bearing Phase-2 read)
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — PerArgumentSummary surface', () => {
  it('THR-3 — PerArgumentSummary declares optional failureSubReason + failureDetail; six load-bearing fields preserved', () => {
    const summaryBlock = coreText.match(/interface\s+PerArgumentSummary\s*\{[\s\S]*?\n\}/);
    expect(summaryBlock).not.toBeNull();
    const block = summaryBlock![0];
    expect(block).toMatch(/failureSubReason\?\s*:/);
    expect(block).toMatch(/failureDetail\?\s*:/);
    expect(block).toContain('argumentId');
    expect(block).toContain('runId');
    expect(block).toContain('status');
    expect(block).toContain('failureReason');
    expect(block).toContain('positiveObservationCount');
    expect(block).toContain('rawKeysWithPositive');
  });

  it('THR-4 — only the unavailable branch sets the sub-reason fields (success / persist / not-found do not)', () => {
    // The adapter-unavailable branch is the ONLY place that sets these
    // fields. As of OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001
    // (#485) it sets each TWICE — once on the failed-branch persistRun INSERT
    // (so the run row's failure_detail / failure_sub_reason columns are
    // populated, not NULL) and once on the RETURN'd PerArgumentSummary (the
    // pre-existing Phase-1 threading). Both sites live inside the single
    // `if (adapterResult.kind === 'unavailable')` block; the success /
    // persist-run-failed / persist-results-failed / argument_not_found
    // summaries must STILL leave them absent. The count moved 1 → 2 by design;
    // the invariant (confined to the unavailable branch; success path clean)
    // is what this test now asserts directly, not the incidental count.
    // Match the property key in either object form: explicit `name:` OR ES6
    // shorthand `name,` (the failed-branch persistRun passes `failureDetail,`
    // off a local const of the same name).
    expect((coreText.match(/failureSubReason[,:]/g) ?? []).length).toBe(2);
    expect((coreText.match(/failureDetail[,:]/g) ?? []).length).toBe(2);

    // Both occurrences of each field are inside the unavailable branch block
    // (from the branch guard to the `// Success path` marker that follows it).
    // Anchored on the literal markers (not exact whitespace) so it is robust
    // to CRLF / LF line endings.
    const unavailableBlock = coreText.match(
      /adapterResult\.kind === 'unavailable'[\s\S]*?\/\/ Success path/,
    );
    expect(unavailableBlock).not.toBeNull();
    expect((unavailableBlock![0].match(/failureSubReason[,:]/g) ?? []).length).toBe(2);
    expect((unavailableBlock![0].match(/failureDetail[,:]/g) ?? []).length).toBe(2);

    // The success-path persistRun (status: 'success') sets NEITHER field, so
    // success rows keep failure_detail / failure_sub_reason NULL (byte-equal
    // to pre-#485). Extract the success persistRun call and assert it is clean.
    const successPersist = coreText.match(
      /\/\/ Success path[\s\S]*?await persistRun\(\{[\s\S]*?status: 'success',[\s\S]*?\}\);/,
    );
    expect(successPersist).not.toBeNull();
    expect(successPersist![0]).not.toMatch(/failureSubReason[,:]/);
    expect(successPersist![0]).not.toMatch(/failureDetail[,:]/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Log + dispatcher surface — additive optional, single emit site
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — log + dispatcher surface', () => {
  it('THR-5 — AutoTriggerLogFields declares optional failure_sub_reason + failure_detail (failure_reason preserved)', () => {
    const block = logText.match(/interface\s+AutoTriggerLogFields\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/failure_sub_reason\?\s*:/);
    expect(block![0]).toMatch(/failure_detail\?\s*:/);
    expect(block![0]).toMatch(/failure_reason\?\s*:/);
  });

  it('THR-6 — dispatcher passes the new fields at ONLY the terminal-failure emit (read off the summary)', () => {
    expect(dispatcherText).toMatch(/failure_sub_reason:\s*terminal\?\.failureSubReason/);
    expect(dispatcherText).toMatch(/failure_detail:\s*terminal\?\.failureDetail/);
    expect((dispatcherText.match(/failure_sub_reason:/g) ?? []).length).toBe(1);
    expect((dispatcherText.match(/failure_detail:/g) ?? []).length).toBe(1);
  });

  it('THR-7 — dispatcher retry / concurrency constants are byte-equal (no HALT-1 / HALT-5 change)', () => {
    expect(dispatcherText).toMatch(/MAX_ATTEMPTS\s*=\s*2/);
    expect(dispatcherText).toMatch(/MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES/);
    const setBlock = dispatcherText.match(/RETRYABLE_FAILURE_REASONS[\s\S]*?Set\(\s*\[([^\]]+)\]/);
    expect(setBlock).not.toBeNull();
    expect(setBlock![1]).toContain('mcp_network_error');
    expect(setBlock![1]).not.toContain('mcp_validation_failed');
  });
});
