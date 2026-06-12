/**
 * OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING — queue-drainer threading (SOURCE SCAN).
 *
 * The three SUT files are Deno-only and cannot run under Jest:
 *   - classifierDrainerClassify.ts (loadArgumentContext → persistenceWriter →
 *     createServiceClient (Deno)).
 *   - classifierDrainerCore.ts (the Edge drainer orchestration core).
 *   - classifyArgumentCore.ts (the Edge classifier core; direct-dispatch path).
 * So their guarantees are locked by a source-text scan, mirroring
 * __tests__/classifierDrainerFailureDetailWrite.test.ts and
 * __tests__/keyLevelFailClosedPersistence.test.ts.
 *
 * What this proves (the WIDENING's production-bearing core):
 *   - classify carries the server-sourced unclean-span drop list (NAMES only)
 *     off the sanitized response, NULL on zero drops.
 *   - the drainer's SUCCESS finalize threads it to the finalizer RPC's
 *     p_dropped_unclean_span_keys; ONLY the success path does (terminal /
 *     argument_missing / defensive finalizes do NOT).
 *   - the direct-dispatch path (classifyArgumentCore) is FAMILY-AGNOSTIC — the
 *     drop threading gates on runStatus === 'success', never on a family
 *     literal — so a production A–I drop persists identically to J's.
 *
 * Doctrine: cdiscourse-doctrine §1/§6/§10a — names only; no verdict / span /
 * body; only a SUCCESS run records the drop names.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const CLASSIFY_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifierDrainerClassify.ts',
);
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts',
);
const DIRECT_PATH = path.join(
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

let classifyCode = '';
let coreCode = '';
let directCode = '';

beforeAll(() => {
  classifyCode = stripTsComments(fs.readFileSync(CLASSIFY_PATH, 'utf8'));
  coreCode = stripTsComments(fs.readFileSync(CORE_PATH, 'utf8'));
  directCode = stripTsComments(fs.readFileSync(DIRECT_PATH, 'utf8'));
});

describe('KLF-WIDEN-THREAD — classify carries the drop list (NAMES only, NULL on zero)', () => {
  it('DCT-1 — the classified result variant declares keysDroppedForUncleanSpan: string[] | null', () => {
    expect(classifyCode).toMatch(/keysDroppedForUncleanSpan:\s*string\[\]\s*\|\s*null/);
  });

  it('DCT-2 — reads sanitized.keysDroppedForUncleanSpan, gated on length > 0 (else NULL)', () => {
    expect(classifyCode).toMatch(/sanitized\.keysDroppedForUncleanSpan/);
    expect(classifyCode).toMatch(/keysDroppedForUncleanSpan\.length\s*>\s*0/);
    // The computed local is the names array or null (no span/body).
    expect(classifyCode).toMatch(
      /Array\.isArray\(\s*sanitized\.keysDroppedForUncleanSpan\s*\)[\s\S]*?\?\s*\[\s*\.\.\.sanitized\.keysDroppedForUncleanSpan\s*\]\s*:\s*null/,
    );
  });

  it('DCT-3 — the classified return includes keysDroppedForUncleanSpan', () => {
    expect(classifyCode).toMatch(
      /return\s*\{\s*kind:\s*'classified',\s*observations,\s*keysDroppedForUncleanSpan\s*\}/,
    );
  });

  it('DCT-4 — the drop value is NAMES only (no evidence_span / body adjacent)', () => {
    const idx = classifyCode.indexOf('keysDroppedForUncleanSpan: string[] | null =');
    const win = idx >= 0 ? classifyCode.slice(idx, idx + 300) : '';
    expect(win).not.toMatch(/evidence_span|\.body\b|currentText|parentText/);
  });
});

describe('KLF-WIDEN-THREAD — drainer core threads the field to the finalizer RPC (SUCCESS only)', () => {
  it('DCT-5 — FinalizeJobInput gains an optional droppedUncleanSpanKeys', () => {
    expect(coreCode).toMatch(/droppedUncleanSpanKeys\?:\s*string\[\]\s*\|\s*null/);
  });

  it('DCT-6 — the SUCCESS finalize call passes droppedUncleanSpanKeys: classify.keysDroppedForUncleanSpan', () => {
    expect(coreCode).toMatch(/droppedUncleanSpanKeys:\s*classify\.keysDroppedForUncleanSpan/);
  });

  it('DCT-7 — the finalizeJob RPC passes p_dropped_unclean_span_keys: input.droppedUncleanSpanKeys ?? null', () => {
    expect(coreCode).toMatch(
      /p_dropped_unclean_span_keys:\s*input\.droppedUncleanSpanKeys\s*\?\?\s*null/,
    );
  });

  it('DCT-8 — ONLY the success path threads it (exactly one classify.keysDroppedForUncleanSpan reference in core)', () => {
    const refs = coreCode.match(/classify\.keysDroppedForUncleanSpan/g) ?? [];
    expect(refs.length).toBe(1);
  });

  it('DCT-9 — the success finalize call (terminalState: succeeded) carries the field WITHOUT a failureDetail', () => {
    const succIdx = coreCode.indexOf("terminalState: 'succeeded'");
    expect(succIdx).toBeGreaterThan(-1);
    const close = coreCode.indexOf('});', succIdx);
    const win = coreCode.slice(succIdx, close);
    expect(win).toMatch(/droppedUncleanSpanKeys:\s*classify\.keysDroppedForUncleanSpan/);
    // A success row never carries a failure diagnostic.
    expect(win).not.toMatch(/failureDetail/);
  });

  it('DCT-10 — the RPC arg list keeps the existing p_failure_detail AND adds p_dropped_unclean_span_keys (additive)', () => {
    // Both trailing optional params are passed (older 8/9-arg tolerance is the
    // DEFAULT NULL job; the drainer always passes both explicitly).
    const rpcIdx = coreCode.indexOf("rpc('finalize_classifier_job'");
    expect(rpcIdx).toBeGreaterThan(-1);
    const close = coreCode.indexOf('});', rpcIdx);
    const win = coreCode.slice(rpcIdx, close);
    expect(win).toMatch(/p_failure_detail:/);
    expect(win).toMatch(/p_dropped_unclean_span_keys:/);
  });
});

describe('KLF-WIDEN-THREAD — direct-dispatch path is FAMILY-AGNOSTIC (production A–I persists like J)', () => {
  it('DCT-11 — the drop threading gates on runStatus === success + length, never on a family literal', () => {
    // The window from the drop-list local to the persistRun call must not
    // condition the audit write on a family identity — proving every production
    // family (A–I) drop persists identically to J's admin-validation drop.
    // Anchor on the `const droppedUncleanSpanKeys` declaration so the window
    // includes the full gate (runStatus + length) AND the persistRun threading.
    const idx = directCode.indexOf('const droppedUncleanSpanKeys');
    expect(idx).toBeGreaterThan(-1);
    const win = directCode.slice(idx, idx + 600);
    expect(win).toMatch(/runStatus\s*===\s*'success'/);
    expect(win).toMatch(/sanitized\.keysDroppedForUncleanSpan/);
    expect(win).not.toMatch(/sensitive_composer/);
    expect(win).not.toMatch(/resolvedFamily/);
    expect(win).not.toMatch(/KEY_LEVEL_FAIL_CLOSED_FAMILIES/);
  });

  it('DCT-12 — the direct path threads droppedUncleanSpanKeys to persistRun via a conditional spread', () => {
    expect(directCode).toMatch(
      /droppedUncleanSpanKeys\s*!==\s*null\s*\?\s*\{\s*droppedUncleanSpanKeys\s*\}\s*:\s*\{\s*\}/,
    );
  });
});

describe('KLF-WIDEN-THREAD — no secret / no console in the threaded paths', () => {
  it('DCT-13 — classify + core never console.log the drop list', () => {
    expect(classifyCode).not.toMatch(/console\./);
    expect(coreCode).not.toMatch(/console\./);
  });
});
