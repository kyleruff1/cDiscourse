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
    const branchIdx = coreCode.indexOf("adapterResult.kind === 'unavailable'");
    expect(branchIdx).toBeGreaterThan(-1);
    const win = coreCode.slice(branchIdx, branchIdx + 900);
    expect(win).toMatch(/buildRunRowFailureDetail\(\{/);
  });

  it('FILL-10 — the builder is fed validatorPath = adapterResult.detail?.path (structural PATH)', () => {
    expect(coreCode).toMatch(/validatorPath:\s*adapterResult\.detail\?\.path/);
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
    expect(coreCode).toMatch(/failureSubReason:\s*adapterResult\.subReason\s*\?\?\s*null/);
  });

  it('FILL-13 — failed-branch persistRun passes the builder output as failureDetail (?? null)', () => {
    // The built variable is `?? null` and threaded by shorthand into the call.
    expect(coreCode).toMatch(/buildRunRowFailureDetail\(\{[\s\S]*?\}\)\s*\?\?\s*null/);
    // The persistRun call in the failed branch carries `failureDetail,` shorthand.
    const branchIdx = coreCode.indexOf("adapterResult.kind === 'unavailable'");
    const persistIdx = coreCode.indexOf('persistRun({', branchIdx);
    const close = coreCode.indexOf('});', persistIdx);
    const win = coreCode.slice(persistIdx, close);
    expect(win).toMatch(/\bfailureDetail,/);
    expect(win).toMatch(/failureSubReason:\s*adapterResult\.subReason\s*\?\?\s*null/);
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
  it('FILL-15 — the success persistRun call (status:success) does NOT pass the new fields', () => {
    // There are exactly two `persistRun({` call sites: [0] = failed branch,
    // [1] = success branch. Anchor on the call sites directly so the union
    // type `status: 'success' | 'failed'` in PerArgumentSummary is not
    // mistaken for the success call.
    const callIdxs: number[] = [];
    let from = coreCode.indexOf('persistRun({');
    while (from !== -1) {
      callIdxs.push(from);
      from = coreCode.indexOf('persistRun({', from + 1);
    }
    expect(callIdxs.length).toBe(2);
    const successStart = callIdxs[1];
    const successEnd = coreCode.indexOf('});', successStart);
    expect(successEnd).toBeGreaterThan(successStart);
    const win = coreCode.slice(successStart, successEnd);
    // This IS the success call (the byte-equal one).
    expect(win).toMatch(/status:\s*'success'/);
    expect(win).toMatch(/failureReason:\s*null/);
    // and it does NOT pass either new diagnostic field (→ columns stay NULL).
    expect(win).not.toMatch(/failureSubReason/);
    expect(win).not.toMatch(/failureDetail/);
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
