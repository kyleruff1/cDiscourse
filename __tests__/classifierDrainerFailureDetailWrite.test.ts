/**
 * OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE — drainer write-path (SOURCE SCAN).
 *
 * classifierDrainerCore.ts transitively imports Deno deps (createServiceClient),
 * so it is NOT require()-loadable into Jest — its guarantees are locked by a
 * source scan, matching __tests__/archOneCardTwoDrainerCore.test.ts.
 *
 * Locks: the two write-input types gain failure_detail; finalizeJob + scheduleRetry
 * persist it; the failure branch builds it from the allow-list helper with the
 * expected inputs (correlation_id = job.id, the safe run-row id); and the SUCCESS
 * path is byte-equal (no failureDetail → NULL). The leak-safety of the value
 * itself is proven by classifierRunRowFailureDetail.test.ts.
 */
import * as fs from 'fs';
import * as path from 'path';

const CORE_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts',
);

let coreText = '';

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

let coreCode = '';

beforeAll(() => {
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  coreCode = stripTsComments(coreText);
});

describe('OPS-FDP-WRITE — imports + types', () => {
  it('WR-1 — imports buildRunRowFailureDetail + RunRowFailureDetail from the helper', () => {
    expect(coreCode).toMatch(
      /import\s*\{[\s\S]*?buildRunRowFailureDetail[\s\S]*?RunRowFailureDetail[\s\S]*?\}\s*from\s*['"]\.\/classifierRunRowFailureDetail\.ts['"]/,
    );
  });

  it('WR-2 — imports the schema-version constant for the build', () => {
    expect(coreCode).toMatch(
      /import\s*\{\s*MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION\s*\}\s*from\s*['"]\.\/mcpBooleanObservationSchema\.ts['"]/,
    );
  });

  it('WR-3 — FinalizeJobInput + ScheduleRetryInput gain an optional failureDetail field', () => {
    expect(coreCode).toMatch(/failureDetail\?\s*:\s*RunRowFailureDetail\s*\|\s*null/);
    // Two declarations (one per input interface).
    expect((coreCode.match(/failureDetail\?\s*:\s*RunRowFailureDetail\s*\|\s*null/g) ?? []).length).toBe(2);
  });
});

describe('OPS-FDP-WRITE — persistence (RPC + retry UPDATE)', () => {
  it('WR-4 — finalizeJob RPC passes p_failure_detail: input.failureDetail ?? null', () => {
    expect(coreCode).toMatch(/p_failure_detail:\s*input\.failureDetail\s*\?\?\s*null/);
  });

  it('WR-5 — scheduleRetry UPDATE includes failure_detail: input.failureDetail ?? null', () => {
    expect(coreCode).toMatch(/failure_detail:\s*input\.failureDetail\s*\?\?\s*null/);
  });
});

describe('OPS-FDP-WRITE — the failure branch builds the detail from allow-listed inputs', () => {
  it('WR-6 — builds buildRunRowFailureDetail with validatorPath = adapter detail path', () => {
    expect(coreCode).toMatch(/validatorPath:\s*classify\.adapterResult\.detail\?\.path/);
  });

  it('WR-7 — uses decision.failureReason as reason, job.family, job.run_mode, attemptCount, schema version', () => {
    // Anchor on the FAILURE-BRANCH build (the one with validatorPath), not the
    // earlier minimal argument_missing build.
    const buildIdx = coreCode.indexOf('validatorPath: classify.adapterResult.detail?.path');
    expect(buildIdx).toBeGreaterThan(-1);
    const win = coreCode.slice(buildIdx, buildIdx + 400);
    expect(win).toMatch(/reason:\s*decision\.failureReason/);
    expect(win).toMatch(/family:\s*job\.family/);
    expect(win).toMatch(/runMode:\s*job\.run_mode/);
    expect(win).toMatch(/attemptCount/);
    expect(win).toMatch(/schemaVersion:\s*MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION/);
  });

  it('WR-8 — correlation_id is the SAFE run-row id (job.id), never a token/owner-secret', () => {
    expect(coreCode).toMatch(/correlationId:\s*job\.id/);
    // It must NOT use a secret-shaped source.
    expect(coreCode).not.toMatch(/correlationId:\s*[^,\n]*(token|secret|bearer|authorization)/i);
  });

  it('WR-9 — the built detail is threaded into BOTH the retry and the terminal calls', () => {
    // `failureDetail,` (shorthand) appears in the scheduleRetry call and the
    // terminal finalizeJob call (the variable built once after `decision`).
    expect((coreCode.match(/\bfailureDetail,/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('OPS-FDP-WRITE — SUCCESS path is byte-equal (no failureDetail → NULL)', () => {
  it('WR-10 — the success finalizeJob call (terminalState: succeeded) does NOT pass failureDetail', () => {
    const succIdx = coreCode.indexOf("terminalState: 'succeeded'");
    expect(succIdx).toBeGreaterThan(-1);
    // Window from the success terminalState to the close of that finalizeJob call.
    const close = coreCode.indexOf('});', succIdx);
    const win = coreCode.slice(succIdx, close);
    expect(win).not.toMatch(/failureDetail/);
    // and it still carries the original success fields.
    expect(win).toMatch(/status:\s*'success'/);
    expect(win).toMatch(/observations:\s*classify\.observations/);
  });
});

describe('OPS-FDP-WRITE — minimal detail on argument_missing + defensive-catch terminals', () => {
  it('WR-11 — argument_not_found terminal builds a minimal detail with correlationId job.id', () => {
    const idx = coreCode.indexOf("reason: 'argument_not_found'");
    expect(idx).toBeGreaterThan(-1);
    const win = coreCode.slice(idx, idx + 200);
    expect(win).toMatch(/family:\s*job\.family/);
    expect(win).toMatch(/correlationId:\s*job\.id/);
  });

  it('WR-12 — drainer_unexpected_error terminal builds a minimal detail', () => {
    const idx = coreCode.indexOf("reason: 'drainer_unexpected_error'");
    expect(idx).toBeGreaterThan(-1);
    const win = coreCode.slice(idx, idx + 200);
    expect(win).toMatch(/family:\s*job\.family/);
    expect(win).toMatch(/correlationId:\s*job\.id/);
  });
});

describe('OPS-FDP-WRITE — no-behavior-change guard (decision + constants untouched)', () => {
  it('WR-13 — the retry/terminal DECISION still comes from classifyDrainerFailure(reason, attemptCount, subReason)', () => {
    expect(coreCode).toMatch(
      /classifyDrainerFailure\(\s*classify\.adapterResult\.reason,\s*attemptCount,\s*classify\.adapterResult\.subReason,\s*\)/,
    );
  });

  it('WR-14 — drainer operating constants are unchanged (C=3, T=90s, lease TTL 130s, MAX jobs)', () => {
    expect(coreText).toMatch(/DRAINER_PROVIDER_CONCURRENCY\s*=\s*3\b/);
    expect(coreText).toMatch(/DRAINER_WALL_CLOCK_BUDGET_MS\s*=\s*90_000\b/);
    expect(coreText).toMatch(/DRAINER_LEASE_TTL_SECONDS\s*=\s*130\b/);
    expect(coreText).toMatch(/DRAINER_JOB_LEASE_SECONDS\s*=\s*120\b/);
  });

  it('WR-15 — the failure-detail build inputs reference NO body / prompt / evidenceSpan value / payload', () => {
    // The only adapter-sourced input is the structural `.detail?.path` (a path
    // string, allow-listed upstream). No body/prompt/evidenceSpan value/payload
    // is read into the build.
    const buildIdx = coreCode.indexOf('buildRunRowFailureDetail({');
    const win = coreCode.slice(buildIdx, buildIdx + 400);
    expect(win).not.toMatch(/\.body\b/);
    expect(win).not.toMatch(/currentText|parentText|threadContextExcerpt/);
    expect(win).not.toMatch(/\.evidence_?[sS]pan\b/);
    expect(win).not.toMatch(/payload|rawResponse|prompt/i);
  });
});
