/**
 * OPS-MCP-KEY-LEVEL-FAIL-CLOSED — Edge persistence threading (SOURCE SCAN).
 *
 * The two edited SUT files are Deno-only and cannot run under Jest:
 *   - persistenceWriter.ts imports `createServiceClient` (reads `Deno.env`).
 *   - classifyArgumentCore.ts is the Edge classifier core (Deno-only deps).
 * So their guarantees are locked by a source-text scan, mirroring
 * __tests__/opsMcpClassifierFailureDetailAutoTriggerFill.test.ts and
 * __tests__/classifierDrainerFailureDetailWrite.test.ts.
 *
 * What this proves:
 *   - persistenceWriter.PersistRunInput gains an OPTIONAL
 *     `droppedUncleanSpanKeys`, written to `dropped_unclean_span_keys` via a
 *     CONDITIONAL spread (so a caller that omits it → byte-equal INSERT → NULL).
 *   - classifyArgumentCore reads `sanitized.keysDroppedForUncleanSpan`, gates the
 *     write on `runStatus === 'success'` + length > 0, and threads it via a
 *     conditional spread on the SUCCESS persistRun call.
 *   - The audit column carries rawKey NAMES only (the field is the names array;
 *     no body / evidence_span / span content is threaded).
 *
 * Doctrine: cdiscourse-doctrine §1/§6/§10a — names only; no verdict / span /
 * body; supabase-edge-contract INSERT-only / append-only preserved.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const WRITER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/persistenceWriter.ts',
);
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts',
);

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

const writerText = fs.readFileSync(WRITER_PATH, 'utf8');
const coreText = fs.readFileSync(CORE_PATH, 'utf8');
const writerCode = stripTsComments(writerText);
const coreCode = stripTsComments(coreText);

describe('OPS-MCP-KEY-LEVEL-FAIL-CLOSED — persistenceWriter threading', () => {
  it('PersistRunInput declares an optional droppedUncleanSpanKeys', () => {
    expect(writerCode).toMatch(/droppedUncleanSpanKeys\?:\s*string\[\]\s*\|\s*null/);
  });

  it('writes dropped_unclean_span_keys via a CONDITIONAL spread (omitted → byte-equal INSERT)', () => {
    expect(writerCode).toMatch(
      /input\.droppedUncleanSpanKeys\s*!==\s*undefined[\s\S]*?dropped_unclean_span_keys:\s*input\.droppedUncleanSpanKeys/,
    );
  });

  it('does NOT write the column unconditionally (no bare assignment outside the spread)', () => {
    const bare = writerCode.match(/dropped_unclean_span_keys:\s*input\.droppedUncleanSpanKeys/g) || [];
    // Exactly one occurrence, inside the conditional-spread ternary above.
    expect(bare.length).toBe(1);
  });
});

describe('OPS-MCP-KEY-LEVEL-FAIL-CLOSED — classifyArgumentCore threading', () => {
  it('reads the drop list off the sanitized (post-merge) response', () => {
    expect(coreCode).toMatch(/sanitized\.keysDroppedForUncleanSpan/);
  });

  it('gates the audit write on a SUCCESS run with >= 1 dropped key', () => {
    expect(coreCode).toMatch(/runStatus\s*===\s*'success'/);
    expect(coreCode).toMatch(/keysDroppedForUncleanSpan\.length\s*>\s*0/);
  });

  it('threads droppedUncleanSpanKeys to persistRun via a conditional spread', () => {
    expect(coreCode).toMatch(
      /droppedUncleanSpanKeys\s*!==\s*null\s*\?\s*\{\s*droppedUncleanSpanKeys\s*\}\s*:\s*\{\s*\}/,
    );
  });

  it('only the success path threads the field (the all-failed branch does NOT)', () => {
    // The all-failed branch (no batch succeeded) returns BEFORE the success
    // persistRun call. There must be exactly one droppedUncleanSpanKeys spread.
    const spreads = coreCode.match(/droppedUncleanSpanKeys\s*\}\s*:\s*\{\s*\}/g) || [];
    expect(spreads.length).toBe(1);
  });

  it('threads NAMES only — never an evidence_span / body into the audit column', () => {
    // The computed value is sliced from the names array; no span/body token is
    // adjacent to the droppedUncleanSpanKeys assignment.
    const block = coreCode.split('droppedUncleanSpanKeys')[1]?.slice(0, 400) ?? '';
    expect(block).not.toMatch(/evidence_span|evidenceSpan|\.body\b/);
  });
});
