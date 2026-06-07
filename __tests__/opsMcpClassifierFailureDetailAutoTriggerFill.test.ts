/**
 * OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001 — direct-dispatch
 * failure_detail / failure_sub_reason fill (SOURCE SCAN + builder reuse).
 *
 * Populate `failure_detail` (jsonb) + `failure_sub_reason` (text) on the
 * direct-dispatch (auto-trigger) terminal-failure persist path, reusing the
 * existing leak-safe builder `buildRunRowFailureDetail`.
 *
 * The two edited SUT files are Deno-only and cannot run under Jest:
 *   - persistenceWriter.ts imports `createServiceClient` (reads `Deno.env`).
 *   - classifyArgumentCore.ts is the Edge classifier core.
 * So their guarantees are locked by a source-text scan, mirroring
 * __tests__/classifierDrainerFailureDetailWrite.test.ts and
 * __tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts.
 *
 * The builder itself (classifierRunRowFailureDetail.ts) IS pure TS, so the
 * BUILDER-REUSE block below imports it directly and proves: (a) the controlled
 * inputs the core feeds yield the expected RunRowFailureDetail shape; (b) a
 * secret-shaped string in `reason` is dropped (defense-in-depth). Synthetic
 * placeholder secrets only — never a real credential.
 *
 * Doctrine: cdiscourse-doctrine §1/§6/§10a — structural strings only, no
 * verdict / truth / participant attribution; the column is a structurally
 * closed secret surface (the deny-list is the builder's named allow-list).
 * supabase-edge-contract — INSERT-only / append-only preserved; never logs
 * Authorization. The acceptance gate (engine.ts) is untouched; this writes
 * diagnostic columns AFTER submit-argument returned 201 and AFTER the run
 * already terminally failed — no read, no branch, no gate, no latency added
 * to the user submit path.
 */
import * as fs from 'fs';
import * as path from 'path';

import { buildRunRowFailureDetail } from '../supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail';

const REPO = process.cwd();
const WRITER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/persistenceWriter.ts',
);
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts',
);

let writerText = '';
let coreText = '';
let writerCode = '';
let coreCode = '';

/** Strip TS line + block comments so scans hit executable code only. */
function stripTsComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

beforeAll(() => {
  writerText = fs.readFileSync(WRITER_PATH, 'utf8');
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  writerCode = stripTsComments(writerText);
  coreCode = stripTsComments(coreText);
});

// ── 1. Writer: optional fields + conditional spread + still INSERT-only ──
describe('OPS-FDAF-WRITER — additive optional diagnostic fields', () => {
  it('FILL-1 — PersistRunInput declares optional failureSubReason (string | null)', () => {
    expect(writerCode).toMatch(/failureSubReason\?\s*:\s*string\s*\|\s*null/);
  });

  it('FILL-2 — PersistRunInput declares optional failureDetail (Record | null)', () => {
    expect(writerCode).toMatch(
      /failureDetail\?\s*:\s*Record<string,\s*unknown>\s*\|\s*null/,
    );
  });

  it('FILL-3 — insertPayload conditionally spreads failure_sub_reason only when present', () => {
    expect(writerCode).toMatch(
      /\.\.\.\(\s*input\.failureSubReason\s*!==\s*undefined[\s\S]*?failure_sub_reason:\s*input\.failureSubReason[\s\S]*?:\s*\{\s*\}\s*\)/,
    );
  });

  it('FILL-4 — insertPayload conditionally spreads failure_detail only when present', () => {
    expect(writerCode).toMatch(
      /\.\.\.\(\s*input\.failureDetail\s*!==\s*undefined[\s\S]*?failure_detail:\s*input\.failureDetail[\s\S]*?:\s*\{\s*\}\s*\)/,
    );
  });

  it('FILL-5 — writer is STILL INSERT-only (no .update( / .delete( / .upsert( token)', () => {
    expect(/\.update\s*\(/.test(writerCode)).toBe(false);
    expect(/\.delete\s*\(/.test(writerCode)).toBe(false);
    expect(/\.upsert\s*\(/.test(writerCode)).toBe(false);
    expect(/\.insert\(/.test(writerCode)).toBe(true);
  });

  it('FILL-6 — writer still imports createServiceClient (no new env read added)', () => {
    expect(writerText).toMatch(
      /import\s+\{[\s\S]*?createServiceClient[\s\S]*?\}\s+from\s+['"]\.\.\/supabaseClients\.ts['"]/,
    );
    expect(/Deno\.env\.get\(\s*['"]SUPABASE_SERVICE_ROLE_KEY['"]\s*\)/.test(writerCode)).toBe(
      false,
    );
  });

  it('FILL-7 — writer adds NO sanitization of its own (sanitization lives in the builder)', () => {
    // The writer must not re-implement secret-shape scrubbing — it trusts the
    // already-sanitized builder output. No secret-shape matcher / slice cap
    // tokens appear in the writer.
    expect(writerCode).not.toMatch(/looksSecret|SECRET_SHAPE|safeString|MAX_FIELD_CHARS/);
  });
});

// ── 2. Core failed branch: import + build + thread both fields ──
describe('OPS-FDAF-CORE — failed-branch threading', () => {
  it('FILL-8 — core imports buildRunRowFailureDetail from the existing builder', () => {
    expect(coreCode).toMatch(
      /import\s*\{\s*buildRunRowFailureDetail\s*\}\s*from\s*['"]\.\/classifierRunRowFailureDetail\.ts['"]/,
    );
  });

  it('FILL-9 — the unavailable failed branch builds the detail via buildRunRowFailureDetail', () => {
    // MCP-BOOLEAN-BATCHING-INFRA-001 — the fully-failed branch is now guarded
    // by `if (!anySuccess)` (no batch succeeded) instead of a single-call
    // `adapterResult.kind === 'unavailable'`. The leak-safe builder reuse is
    // unchanged — it still constructs the failed run row's failure_detail.
    const branchIdx = coreCode.indexOf('if (!anySuccess)');
    expect(branchIdx).toBeGreaterThan(-1);
    const win = coreCode.slice(branchIdx, branchIdx + 1400);
    expect(win).toMatch(/buildRunRowFailureDetail\(\{/);
  });

  it('FILL-10 — the builder is fed validatorPath = unavailable.detail?.path (structural PATH)', () => {
    // The first failed batch's preserved adapter result is aliased `unavailable`
    // (= `firstUnavailable`); the structural validator PATH it carries is the
    // SAME allow-listed `detail?.path` (never the span text). Rename only.
    expect(coreCode).toMatch(/validatorPath:\s*unavailable\.detail\?\.path/);
  });

  it('FILL-11 — the builder is fed reason / family / runMode / schemaVersion from controlled sources', () => {
    const buildIdx = coreCode.indexOf('buildRunRowFailureDetail({');
    expect(buildIdx).toBeGreaterThan(-1);
    const win = coreCode.slice(buildIdx, buildIdx + 400);
    expect(win).toMatch(/reason:\s*failureReason/);
    expect(win).toMatch(/family:\s*eligibleFamilies\[0\]/);
    expect(win).toMatch(/runMode:\s*mode/);
    expect(win).toMatch(/schemaVersion:\s*MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION/);
  });

  it('FILL-12 — failed-branch persistRun passes failureSubReason (typed enum, null when unset)', () => {
    // MCP-BOOLEAN-BATCHING-INFRA-001 — `adapterResult` → `unavailable` (the
    // preserved first-failed-batch result). The `?? null` write-no-synthetic
    // semantics are unchanged.
    expect(coreCode).toMatch(/failureSubReason:\s*unavailable\.subReason\s*\?\?\s*null/);
  });

  it('FILL-13 — failed-branch persistRun passes the builder output as failureDetail (?? null)', () => {
    // The built variable is `?? null` and threaded by shorthand into the call.
    expect(coreCode).toMatch(/buildRunRowFailureDetail\(\{[\s\S]*?\}\)\s*\?\?\s*null/);
    // The persistRun call in the fully-failed branch carries `failureDetail,`
    // shorthand. MCP-BOOLEAN-BATCHING-INFRA-001 — the branch is now guarded by
    // `if (!anySuccess)`; the threaded fields are otherwise unchanged.
    const branchIdx = coreCode.indexOf('if (!anySuccess)');
    const persistIdx = coreCode.indexOf('persistRun({', branchIdx);
    const close = coreCode.indexOf('});', persistIdx);
    const win = coreCode.slice(persistIdx, close);
    expect(win).toMatch(/\bfailureDetail,/);
    expect(win).toMatch(/failureSubReason:\s*unavailable\.subReason\s*\?\?\s*null/);
  });

  it('FILL-14 — Q1: correlationId is NOT passed (and is never argumentId) on the direct path', () => {
    const buildIdx = coreCode.indexOf('buildRunRowFailureDetail({');
    const win = coreCode.slice(buildIdx, buildIdx + 400);
    expect(win).not.toMatch(/correlationId/);
    expect(win).not.toMatch(/correlationId:\s*argumentId/);
  });
});

// ── 3. Success path byte-equal (the new fields are NOT passed there) ──
describe('OPS-FDAF-CORE — success-path persistRun is byte-equal', () => {
  it('FILL-15 — the all-success persistRun does NOT pass diagnostic fields (columns stay NULL)', () => {
    // MCP-BOOLEAN-BATCHING-INFRA-001 — there are now exactly two `persistRun({`
    // call sites: [0] = fully-failed branch (`if (!anySuccess)`), [1] = the
    // shared success/partial branch. The [1] call writes `status: runStatus`
    // (which is 'success' ONLY when EVERY batch succeeded) and conditionally
    // spreads `failureDetail` ONLY on a partial failure
    // (`...(partialFailureDetail !== null ? { failureDetail: ... } : {})`).
    //
    // The invariant this test locks: on the ALL-SUCCESS path
    // (partialFailureDetail === null, partialFailureReason === null) NEITHER
    // diagnostic column is written, so a fully-successful run row's INSERT is
    // byte-equal to today (failure_detail / failure_sub_reason stay NULL). The
    // [1] call NEVER passes failureSubReason at all (preserving today's success
    // byte-equality) and gates failureDetail behind the partial-failure guard.
    const callIdxs: number[] = [];
    let from = coreCode.indexOf('persistRun({');
    while (from !== -1) {
      callIdxs.push(from);
      from = coreCode.indexOf('persistRun({', from + 1);
    }
    expect(callIdxs.length).toBe(2);
    const sharedStart = callIdxs[1];
    const sharedEnd = coreCode.indexOf('});', sharedStart);
    expect(sharedEnd).toBeGreaterThan(sharedStart);
    const win = coreCode.slice(sharedStart, sharedEnd);
    // The shared success/partial call writes status: runStatus + the
    // partialFailureReason (null on all-success → byte-equal success row).
    expect(win).toMatch(/status:\s*runStatus/);
    expect(win).toMatch(/failureReason:\s*partialFailureReason/);
    // It NEVER passes failureSubReason (success byte-equality preserved).
    expect(win).not.toMatch(/failureSubReason/);
    // failureDetail is gated behind the partial-failure conditional spread, so
    // it is absent from the INSERT on the all-success path (partialFailureDetail
    // === null → the spread contributes {}). Assert the guard is present.
    expect(win).toMatch(/partialFailureDetail\s*!==\s*null\s*\?\s*\{\s*failureDetail/);
  });
});

// ── 4. Leak-safety (structural): only allow-listed inputs reach the builder ──
describe('OPS-FDAF-LEAK — builder-call argument carries no body/prompt/payload', () => {
  it('FILL-16 — the builder-call argument references NO body / prompt / payload / response value', () => {
    const buildIdx = coreCode.indexOf('buildRunRowFailureDetail({');
    const win = coreCode.slice(buildIdx, buildIdx + 400);
    expect(win).not.toMatch(/\.body\b/);
    expect(win).not.toMatch(/currentText|parentText|threadContextExcerpt/);
    expect(win).not.toMatch(/\bprompt\b/i);
    expect(win).not.toMatch(/payload|rawResponse|\.response\b/i);
    expect(win).not.toMatch(/\.message\b/);
    expect(win).not.toMatch(/evidence_?[sS]pan|evidenceSpan/);
    expect(win).not.toMatch(/\.extra\b/);
  });

  it('FILL-17 — the two edited SUT files carry no banned verdict token (doctrine §1)', () => {
    // Tokens assembled from fragments so this test's own array does not trip
    // the scan. The scan targets the SUT executable code (comment-stripped),
    // not this scaffold.
    const banned = [
      'win' + 'ner',
      'lo' + 'ser',
      'li' + 'ar',
      'dis' + 'honest',
      'bad ' + 'faith',
      'manipul' + 'ative',
      'extrem' + 'ist',
      'propagand' + 'ist',
    ];
    const sut = (writerCode + '\n' + coreCode).toLowerCase();
    for (const token of banned) {
      expect(sut.includes(token)).toBe(false);
    }
  });
});

// ── 5. Builder reuse (RUNNABLE): the controlled inputs → expected shape ──
describe('OPS-FDAF-BUILDER — runnable reuse coverage', () => {
  it('FILL-18 — controlled core inputs yield the expected RunRowFailureDetail shape', () => {
    // Mirror exactly what classifyArgumentCore feeds on the failed branch.
    const out = buildRunRowFailureDetail({
      validatorPath: 'modelInfo.provider',
      reason: 'mcp_api_error',
      family: 'topic_relevance',
      runMode: 'production',
      schemaVersion: 'mcp-bool-obs.v1',
    });
    expect(out).toEqual({
      validator_path: 'modelInfo.provider',
      reason: 'mcp_api_error',
      family: 'topic_relevance',
      run_mode: 'production',
      schema_version: 'mcp-bool-obs.v1',
    });
    // Q1: no correlation_id is produced when none is fed.
    expect(out).not.toHaveProperty('correlation_id');
  });

  it('FILL-19 — undefined validatorPath (url_missing/token_missing) is gracefully dropped', () => {
    const out = buildRunRowFailureDetail({
      validatorPath: undefined,
      reason: 'mcp_url_missing',
      family: 'topic_relevance',
      runMode: 'production',
      schemaVersion: 'mcp-bool-obs.v1',
    });
    expect(out).not.toHaveProperty('validator_path');
    expect(out).toMatchObject({ reason: 'mcp_url_missing', family: 'topic_relevance' });
  });

  it('FILL-20 — defense-in-depth: a secret-shaped reason is dropped, not stored', () => {
    // SYNTHETIC placeholder secret — assembled from fragments so this source
    // carries no contiguous secret-shaped literal and never a real credential.
    const syntheticSecret = 'sk-' + 'ant-' + 'EXAMPLENOTAREAL000000';
    const out = buildRunRowFailureDetail({
      reason: syntheticSecret,
      family: 'topic_relevance',
      runMode: 'production',
    });
    // The secret-shaped `reason` is dropped; the safe fields survive.
    expect(out).not.toHaveProperty('reason');
    expect(out).toMatchObject({ family: 'topic_relevance', run_mode: 'production' });
  });

  it('FILL-21 — builder returns undefined when nothing safe survives (→ NULL column)', () => {
    const out = buildRunRowFailureDetail({});
    expect(out).toBeUndefined();
  });
});
