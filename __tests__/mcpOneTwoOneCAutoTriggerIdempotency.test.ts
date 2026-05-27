/**
 * MCP-021C-AUTO-TRIGGER-FAMILY-A — Idempotency design (Option A) tests.
 *
 * Verifies the pre-INSERT existence check shape per design §3.2 and the
 * three branches (no-row / failed-row / success-row).
 *
 * The dispatcher is Deno-only; the tests source-scan the dispatcher
 * pre-check call shape and assert structural correctness. Branch
 * verification is via structural assertion (the source contains the
 * outcome enum values + the branch keywords for each path).
 *
 * Forecast: ~18 tests (IDEM-1 through IDEM-18).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);
const SUBMIT_PATH = path.join(REPO, 'supabase/functions/submit-argument/index.ts');

let dispatcherText = '';
let submitText = '';

beforeAll(() => {
  dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  submitText = fs.readFileSync(SUBMIT_PATH, 'utf8');
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — idempotency pre-check (Option A)', () => {
  it('IDEM-1 — pre-check SELECT targets argument_machine_observation_runs', () => {
    expect(dispatcherText).toMatch(
      /\.from\s*\(\s*['"]argument_machine_observation_runs['"]\s*\)/,
    );
  });

  it('IDEM-2 — pre-check filters by argument_id', () => {
    expect(dispatcherText).toMatch(/\.eq\s*\(\s*['"]argument_id['"]\s*,/);
  });

  it('IDEM-3 — pre-check filters by schema_version using the MCP-021A constant', () => {
    expect(dispatcherText).toMatch(
      /\.eq\s*\(\s*['"]schema_version['"]\s*,\s*MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION\s*\)/,
    );
  });

  it('IDEM-4 — pre-check filters by run_mode = \'production\'', () => {
    expect(dispatcherText).toMatch(/\.eq\s*\(\s*['"]run_mode['"]\s*,\s*['"]production['"]\s*\)/);
  });

  it('IDEM-5 — pre-check filters by provider_key (the canonical PROVIDER_KEY constant)', () => {
    expect(dispatcherText).toMatch(/\.eq\s*\(\s*['"]provider_key['"]\s*,\s*PROVIDER_KEY\s*\)/);
  });

  it('IDEM-6 — pre-check filters requested_families to contain the per-iteration [family] parameter (post Stage 2B)', () => {
    // Post Stage 2B (MCP-021C-EDGE-FAMILIES-B-C-ENABLE): findExistingRun
    // is parameterized by family; the .contains() argument is built
    // from the parameter (the loop variable), not a hard-coded
    // 'parent_relation' literal. Per-family idempotency scope is
    // enforced — a successful Family A run does NOT make Family B's
    // first run skip.
    expect(dispatcherText).toMatch(
      /\.contains\s*\(\s*['"]requested_families['"]\s*,\s*\[\s*family\s*\]\s*\)/,
    );
    // Old literal must NOT appear inside the .contains() argument.
    expect(dispatcherText).not.toMatch(
      /\.contains\s*\(\s*['"]requested_families['"]\s*,\s*\[\s*['"]parent_relation['"]\s*\]\s*\)/,
    );
  });

  it('IDEM-7 — pre-check orders by started_at DESC limited to 1 (most-recent run only)', () => {
    expect(dispatcherText).toMatch(/\.order\s*\(\s*['"]started_at['"]\s*,\s*\{\s*ascending:\s*false\s*\}\s*\)/);
    expect(dispatcherText).toMatch(/\.limit\s*\(\s*1\s*\)/);
  });

  it('IDEM-8 — dispatcher returns outcome \'already_classified\' when pre-check finds a success row', () => {
    expect(dispatcherText).toContain("outcome: 'already_classified'");
  });

  it('IDEM-9 — pre-check guard precedes classifyOneArgumentCore invocation', () => {
    // The pre-check call (`findExistingRun`) must run BEFORE the
    // classifier invocation. We compare the FIRST `await findExistingRun(`
    // call site against the `await classifyOneArgumentCore(` call site.
    const preCheckIdx = dispatcherText.indexOf('await findExistingRun(');
    const classifyIdx = dispatcherText.indexOf('await classifyOneArgumentCore(');
    expect(preCheckIdx).toBeGreaterThan(-1);
    expect(classifyIdx).toBeGreaterThan(preCheckIdx);
  });

  it('IDEM-10 — dispatcher proceeds when pre-check finds a failed row (retry path)', () => {
    // The dispatcher source explicitly comments that a failed pre-check
    // row does not count as classified.
    expect(dispatcherText).toMatch(/failed run does not count as classified/i);
  });

  it('IDEM-11 — dispatcher proceeds when pre-check returns no row (new run)', () => {
    // The "no row" path falls through the success-row branch directly
    // into the retry loop. The branch's return triggers on
    // `existing && existing.status === 'success'`.
    expect(dispatcherText).toMatch(
      /existing\s*&&\s*existing\.status\s*===\s*['"]success['"]/,
    );
  });

  it('IDEM-12 — pre-check uses the serviceClient + family parameters passed into the dispatcher (no new client; per-family scope)', () => {
    // Post Stage 2B: findExistingRun signature is (argumentId, family,
    // serviceClient). The dispatcher passes both the loop variable
    // `family` and the already-authenticated serviceClient.
    expect(dispatcherText).toMatch(
      /findExistingRun\s*\(\s*argumentId\s*,\s*family\s*,\s*serviceClient\s*\)/,
    );
  });

  it('IDEM-13 — dispatcher call in submit-argument is positioned AFTER the client_submission_id replay return', () => {
    const replayReturnIdx = submitText.indexOf('idempotent: true');
    const dispatchIdx = submitText.indexOf('dispatchAutoTriggerForArgument(');
    expect(replayReturnIdx).toBeGreaterThan(-1);
    expect(dispatchIdx).toBeGreaterThan(replayReturnIdx);
  });

  it('IDEM-14 — there is no second dispatchAutoTriggerForArgument call in the replay branch', () => {
    const matches = submitText.match(/dispatchAutoTriggerForArgument\s*\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('IDEM-15 — AutoTriggerOutcome discriminates triggered/already_classified/skipped/failed', () => {
    const outcomeBlock = dispatcherText.match(/interface\s+AutoTriggerOutcome\s*\{[\s\S]*?\n\}/);
    expect(outcomeBlock).not.toBeNull();
    const block = outcomeBlock![0];
    expect(block).toContain("'triggered'");
    expect(block).toContain("'already_classified'");
    expect(block).toContain("'skipped'");
    expect(block).toContain("'failed'");
  });

  it('IDEM-16 — dispatcher source documents the Option A race-tolerance rationale', () => {
    // The comment block at the top of the dispatcher explicitly notes
    // Option A's "two run rows" race window and Source 6 dedup.
    expect(dispatcherText).toMatch(/Option A/);
    expect(dispatcherText).toMatch(/Source 6/);
  });

  it('IDEM-17 — pre-check schema_version filter uses the single source-of-truth constant', () => {
    // Both the pre-check and the persisted dispatch payload reference
    // MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION (no second hard-coded
    // string literal).
    const matches = dispatcherText.match(/MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('IDEM-18 — pre-check does NOT filter by author_id / created_by / engagement-shape columns', () => {
    // Doctrine: idempotency is a content-identity check, not an
    // actor / popularity check. The pre-check uses SUPABASE-JS query
    // builder methods (`.eq`, `.contains`) — assert no `.eq(...)` or
    // `.contains(...)` call targets a forbidden column.
    expect(dispatcherText).not.toMatch(/\.eq\s*\(\s*['"]author_id['"]/);
    expect(dispatcherText).not.toMatch(/\.eq\s*\(\s*['"]created_by['"]/);
    expect(dispatcherText).not.toMatch(/\.eq\s*\(\s*['"]engagement[a-z_]*['"]/);
    expect(dispatcherText).not.toMatch(/\.eq\s*\(\s*['"]heat[a-z_]*['"]/);
    expect(dispatcherText).not.toMatch(/\.eq\s*\(\s*['"]view_count['"]/);
    expect(dispatcherText).not.toMatch(/\.eq\s*\(\s*['"]reply_count['"]/);
    expect(dispatcherText).not.toMatch(/\.contains\s*\(\s*['"]engagement[a-z_]*['"]/);
  });
});
