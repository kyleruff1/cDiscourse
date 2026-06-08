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

  it('THR-4 — only the failure branches set the sub-reason fields (all-success persistRun stays clean)', () => {
    // MCP-BOOLEAN-BATCHING-INFRA-001 — the adapter-unavailable handling moved
    // into the batched orchestration. The typed sub-reason / detail are now
    // confined to:
    //   (a) the FULLY-FAILED branch (`if (!anySuccess)`) — sets each TWICE:
    //       once on the failed-branch persistRun INSERT, once on the RETURN'd
    //       PerArgumentSummary (the pre-existing #485 threading, now off the
    //       preserved `unavailable` adapter result); AND
    //   (b) the partial-failure path adds ONE more `failureDetail:` — the
    //       leak-safe {batchIndex,batchTotal,reason} projection conditionally
    //       spread into the SHARED success/partial persistRun (design §4).
    // So: failureSubReason[,:] count == 2 (both in the fully-failed branch);
    //     failureDetail[,:]   count == 3 (2 in the fully-failed branch + 1 in
    //     the partial-failure conditional spread). The all-success persistRun
    //     writes NEITHER (success row byte-equal to today). The invariant — NOT
    //     the incidental count — is what this asserts; the counts are documented
    //     so a future drift is caught.
    expect((coreText.match(/failureSubReason[,:]/g) ?? []).length).toBe(2);
    expect((coreText.match(/failureDetail[,:]/g) ?? []).length).toBe(3);

    // Both failureSubReason occurrences + 2 of the 3 failureDetail occurrences
    // are inside the FULLY-FAILED branch block (from `if (!anySuccess)` to the
    // next branch marker). Anchored on literal markers (robust to CRLF / LF).
    const fullyFailedBlock = coreText.match(
      /if \(!anySuccess\)[\s\S]*?At least one batch succeeded/,
    );
    expect(fullyFailedBlock).not.toBeNull();
    expect((fullyFailedBlock![0].match(/failureSubReason[,:]/g) ?? []).length).toBe(2);
    expect((fullyFailedBlock![0].match(/failureDetail[,:]/g) ?? []).length).toBe(2);

    // The SHARED success/partial persistRun never passes failureSubReason, so
    // an ALL-SUCCESS run keeps failure_sub_reason NULL (byte-equal to today).
    // The single failureDetail there is gated behind the partial-failure guard
    // (absent on the all-success path).
    const sharedPersist = coreText.match(
      /At least one batch succeeded[\s\S]*?await persistRun\(\{[\s\S]*?status: runStatus,[\s\S]*?\}\);/,
    );
    expect(sharedPersist).not.toBeNull();
    expect(sharedPersist![0]).not.toMatch(/failureSubReason[,:]/);
    expect(sharedPersist![0]).toMatch(/partialFailureDetail !== null \? \{ failureDetail:/);
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
