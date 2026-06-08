/**
 * MCP-BOOLEAN-BATCHING-INFRA-001 — Orchestration wiring source scans.
 *
 * `classifyArgumentCore.ts` (direct-dispatch path) and
 * `classifierDrainerClassify.ts` (queue/drainer path) transitively import the
 * Deno service-role client + the real MCP adapter, so they are NOT directly
 * require()-loadable into Jest. Their batching wiring is locked by a SOURCE
 * SCAN, matching the repo's established convention for these Deno-only
 * orchestration files (see archOneCardTwoDrainerCore.test.ts /
 * mcpOneTwoOneCAutoTriggerFamilyA.test.ts).
 *
 * The pure chunk/merge BEHAVIOR is fully unit-tested in
 * booleanObservationBatching.test.ts; these scans verify the orchestrators
 * actually invoke that core in the right shape (loop-per-batch, merge, one
 * run row, ALL-OR-NOTHING failure (no partial-persist), family-granularity
 * retry, engine.ts untouched).
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const BO = 'supabase/functions/_shared/booleanObservations';
const CORE_PATH = path.join(REPO, `${BO}/classifyArgumentCore.ts`);
const DRAINER_CLASSIFY_PATH = path.join(REPO, `${BO}/classifierDrainerClassify.ts`);
const BATCHING_PATH = path.join(REPO, `${BO}/booleanObservationBatching.ts`);
const ENGINE_PATH = path.join(REPO, 'src/domain/constitution/engine.ts');

let coreText = '';
let drainerText = '';
let batchingText = '';

beforeAll(() => {
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  drainerText = fs.readFileSync(DRAINER_CLASSIFY_PATH, 'utf8');
  batchingText = fs.readFileSync(BATCHING_PATH, 'utf8');
});

// ── Batching core module ───────────────────────────────────────────

describe('MCP-BATCHING — pure core module exports', () => {
  it('ORC-1 — booleanObservationBatching.ts exports BATCH_SIZE = 16', () => {
    expect(batchingText).toMatch(/export const BATCH_SIZE\s*=\s*16\b/);
  });

  it('ORC-2 — split threshold mirrors the per-response cap (20)', () => {
    expect(batchingText).toMatch(/export const BATCH_SPLIT_THRESHOLD\s*=\s*20\b/);
  });

  it('ORC-3 — chunkRawKeys / buildBatchRequestFromFull / mergeBatchResponses exported', () => {
    expect(batchingText).toMatch(/export function chunkRawKeys/);
    expect(batchingText).toMatch(/export function buildBatchRequestFromFull/);
    expect(batchingText).toMatch(/export function mergeBatchResponses/);
  });

  it('ORC-4 — pure: no Deno / fetch / createServiceClient / network import', () => {
    expect(batchingText).not.toMatch(/Deno\./);
    expect(batchingText).not.toMatch(/\bfetch\(/);
    expect(batchingText).not.toMatch(/createServiceClient/);
  });

  it('ORC-5 — no Date / Math.random (deterministic, idempotent re-runs)', () => {
    expect(batchingText).not.toMatch(/new Date\(/);
    expect(batchingText).not.toMatch(/Math\.random/);
  });

  it('ORC-6 — does NOT redefine MAX_FLAGS_PER_RESPONSE (the cap stays per-response, unchanged)', () => {
    // The cap stays per-response and is NOT redeclared here. (A doc comment may
    // MENTION the constant; what is forbidden is a re-DECLARATION.)
    expect(batchingText).not.toMatch(/(?:const|let|var)\s+MAX_FLAGS_PER_RESPONSE\s*=/);
  });
});

// ── Direct path: classifyArgumentCore.ts ───────────────────────────

describe('MCP-BATCHING — direct path (classifyArgumentCore.ts) wiring', () => {
  it('ORC-7 — imports chunkRawKeys + buildBatchRequestFromFull + mergeBatchResponses', () => {
    expect(coreText).toMatch(/chunkRawKeys/);
    expect(coreText).toMatch(/buildBatchRequestFromFull/);
    expect(coreText).toMatch(/mergeBatchResponses/);
  });

  it('ORC-8 — chunks the full requestedRawKeys before the adapter loop', () => {
    expect(coreText).toMatch(/chunkRawKeys\(\s*mcpRequest\.requestedRawKeys\s*\)/);
  });

  it('ORC-9 — invokes the adapter ONCE PER BATCH (loop), not once total', () => {
    // The adapter is called inside a for-of over batches.
    expect(coreText).toMatch(/for\s*\(\s*const batch of batches\s*\)/);
    expect(coreText).toMatch(/adapter\(\s*batchRequest\s*\)/);
  });

  it('ORC-10 — exactly ONE persistRun call path per family (one run row, all batches share it)', () => {
    // persistRun appears in the fully-failed branch and the success/partial
    // branch — both are mutually-exclusive branches of a SINGLE logical run.
    // No persistRun inside the per-batch loop.
    const loopStart = coreText.indexOf('for (const batch of batches)');
    const loopEnd = coreText.indexOf('const completedAt = new Date().toISOString();', loopStart);
    const loopBody = coreText.slice(loopStart, loopEnd);
    expect(loopBody).not.toMatch(/persistRun\(/);
    expect(loopBody).not.toMatch(/persistResults\(/);
  });

  it('ORC-11 — partial failure marks the run status:failed with a leak-safe failure_detail', () => {
    expect(coreText).toMatch(/mcp_batch_partial_failure/);
    expect(coreText).toMatch(/batchIndex/);
    expect(coreText).toMatch(/batchTotal/);
  });

  it('ORC-12 — ALL-OR-NOTHING: any batch failure persists NO positive rows, aligned to the drainer (reconcile/545 CONCERN)', () => {
    // The all-SUCCESS path still merges the per-batch outcomes and collects
    // positives from the MERGED response (built via sanitize-over-merged).
    expect(coreText).toMatch(/mergeBatchResponses\(\s*batchOutcomes/);
    expect(coreText).toMatch(/sanitizeMcpBooleanObservationResponse\(\s*\n?\s*merged/);
    // On a partial failure (runStatus === 'failed') the direct path returns
    // BEFORE any result-row INSERT: the failed-run guard yields ZERO positives
    // and PRECEDES the persistResults(...) call. This matches the drainer's
    // atomic-finalize semantics — a failed run never partial-persists positives
    // that the status-blind Source-6 consumer would surface / double-count.
    const guardIdx = coreText.indexOf("if (runStatus === 'failed')");
    const persistResultsCallIdx = coreText.indexOf('persistResults(');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(persistResultsCallIdx).toBeGreaterThan(guardIdx);
    const guardBlock = coreText.slice(guardIdx, persistResultsCallIdx);
    expect(guardBlock).toMatch(/positiveObservationCount:\s*0/);
    expect(guardBlock).toMatch(/rawKeysWithPositive:\s*\[\]/);
  });

  it('ORC-13 — does NOT add batchIndex/batchTotal to the on-the-wire request', () => {
    // buildBatchRequestFromFull (the only request builder used in the loop) is
    // the pure helper; the core never spreads batchIndex/batchTotal into a
    // request object. (The literals appear only in failure_detail.)
    // No assignment of batchIndex/batchTotal as a request field.
    expect(coreText).not.toMatch(/batchRequest\s*\.\s*batchIndex/);
    expect(coreText).not.toMatch(/requestedRawKeys:[^\n]*batchIndex/);
  });

  it('ORC-14 — does NOT bump the schema version (constant referenced, not redefined)', () => {
    expect(coreText).not.toMatch(/MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION\s*=\s*['"]/);
  });
});

// ── Drainer path: classifierDrainerClassify.ts ─────────────────────

describe('MCP-BATCHING — drainer path (classifierDrainerClassify.ts) wiring', () => {
  it('ORC-15 — imports the batching core', () => {
    expect(drainerText).toMatch(/chunkRawKeys/);
    expect(drainerText).toMatch(/buildBatchRequestFromFull/);
    expect(drainerText).toMatch(/mergeBatchResponses/);
  });

  it('ORC-16 — chunks then loops the adapter per batch with the >=30s drainer timeout', () => {
    expect(drainerText).toMatch(/chunkRawKeys\(\s*mcpRequest\.requestedRawKeys\s*\)/);
    expect(drainerText).toMatch(/for\s*\(\s*const batch of batches\s*\)/);
    expect(drainerText).toMatch(/DRAINER_MCP_REQUEST_TIMEOUT_MS/);
  });

  it('ORC-17 — a failed batch returns the typed unavailable result (whole-family failure, atomic finalize)', () => {
    // The drainer has no partial-persist; a batch failure short-circuits the
    // whole-family classify so the existing retry policy re-runs it.
    expect(drainerText).toMatch(/return\s*\{\s*kind:\s*'unavailable',\s*adapterResult\s*\}/);
  });

  it('ORC-18 — success path merges then extracts positives from the MERGED response', () => {
    expect(drainerText).toMatch(/mergeBatchResponses\(\s*batchOutcomes/);
    expect(drainerText).toMatch(/sanitizeMcpBooleanObservationResponse\(\s*merged/);
  });

  it('ORC-19 — retry granularity stays at FAMILY level (the job IS the run row)', () => {
    // The drainer never re-chunks on retry within one call; a retry is a fresh
    // claim of the whole (argument, family) job. The doc-comment states this.
    expect(drainerText).toMatch(/family level|family granularity|WHOLE \(argument, family\)/);
  });
});

// ── engine.ts untouched (submission gate) ──────────────────────────

describe('MCP-BATCHING — engine.ts (submission gate) untouched', () => {
  it('ORC-20 — constitution engine.ts has no batching reference', () => {
    const engineText = fs.readFileSync(ENGINE_PATH, 'utf8');
    expect(engineText).not.toMatch(/chunkRawKeys|booleanObservationBatching|BATCH_SIZE/);
  });
});
