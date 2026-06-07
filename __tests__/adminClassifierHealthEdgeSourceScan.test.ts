/**
 * OPS-MCP-OBSERVABILITY-002 — Edge gate + query-shape source-scan.
 *
 * `supabase/functions/admin-classifier-health/index.ts` uses Deno-only APIs
 * (Deno.serve) and imports from Deno-only `_shared/*.ts` paths, so it cannot be
 * exercised through the Jest module loader. These tests read the source file
 * and assert structural leak-safety + gate properties:
 *   1. requireAdmin is the gate (401 no token / 403 non-admin).
 *   2. The SELECT is COLUMN-EXPLICIT — no `*`, no `body`, no `evidence_span`,
 *      no join to argument_machine_observation_results / results.
 *   3. The ONLY write op is the admin_audit_events insert (no data writes).
 *   4. containsForbiddenSubstring is called before any return.
 *   5. No provider / MCP / submit-argument / routing / familyRegistry import.
 *   6. failure_detail is read only through the RunRowFailureDetail allow-list.
 */
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_PATH = path.join(
  process.cwd(),
  'supabase',
  'functions',
  'admin-classifier-health',
  'index.ts',
);
const SOURCE = fs.readFileSync(SOURCE_PATH, 'utf8');

/** Comment-stripped view — docstring negations must not trip code scans. */
const CODE_ONLY = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

describe('admin-classifier-health — admin gate', () => {
  it('uses requireAdmin as the gate', () => {
    expect(SOURCE).toMatch(/from\s+['"][^'"]*_shared\/adminAuth\.ts['"]/);
    expect(CODE_ONLY).toMatch(/requireAdmin\(req\)/);
  });

  it('returns 401 on no/invalid token and 403 on non-admin', () => {
    expect(CODE_ONLY).toMatch(/auth\.status\s*===\s*401[\s\S]{0,80}return\s+unauthorized\(\)/);
    expect(CODE_ONLY).toMatch(/return\s+forbidden\(/);
  });

  it('uses the service-role client ONLY after the admin check (auth.serviceClient)', () => {
    // serviceClient is destructured from the requireAdmin success result, not
    // built independently before the gate.
    expect(CODE_ONLY).toMatch(/const\s*\{\s*caller,\s*serviceClient\s*\}\s*=\s*auth/);
    expect(CODE_ONLY).not.toMatch(/createServiceClient\(\)/);
  });
});

describe('admin-classifier-health — column-explicit read (leak boundary)', () => {
  it('never selects with a wildcard', () => {
    const selectCalls = CODE_ONLY.match(/\.select\(([^)]*)\)/g) || [];
    expect(selectCalls.length).toBeGreaterThan(0);
    for (const call of selectCalls) {
      expect(call).not.toMatch(/\*/);
    }
  });

  it('never selects body or evidence_span in any SELECT column list', () => {
    // `body` as a request-payload variable name is fine; the leak risk is a
    // `body` column inside a `.select(...)` argument or the column constants.
    const selectCalls = CODE_ONLY.match(/\.select\(([^)]*)\)/g) || [];
    for (const call of selectCalls) {
      expect(call).not.toMatch(/\bbody\b/);
      expect(call).not.toMatch(/evidence_span/);
    }
    // The column constants must not name body / evidence_span.
    const columnConstants = SOURCE.match(/const\s+RUN_COLUMNS[\w]*\s*=\s*`?['"`][^'"`]*['"`]/g) || [];
    expect(columnConstants.length).toBeGreaterThan(0);
    for (const c of columnConstants) {
      expect(c).not.toMatch(/\bbody\b/);
      expect(c).not.toMatch(/evidence_span/);
    }
    // evidence_span never appears as a CODE token anywhere (only in docstrings).
    expect(CODE_ONLY).not.toMatch(/evidence_span/);
  });

  it('never joins the results table', () => {
    expect(CODE_ONLY).not.toMatch(/argument_machine_observation_results/);
    expect(CODE_ONLY).not.toMatch(/\bresults\s*\(/);
  });

  it('reads from the runs table only', () => {
    const fromCalls = CODE_ONLY.match(/\.from\(\s*['"][^'"]+['"]\s*\)/g) || [];
    expect(fromCalls.length).toBeGreaterThan(0);
    for (const call of fromCalls) {
      const table = call.replace(/.*\.from\(\s*['"]/, '').replace(/['"].*/, '');
      expect(['argument_machine_observation_runs', 'admin_audit_events']).toContain(table);
    }
  });

  it('the column allow-list contains the expected names (and only those)', () => {
    expect(SOURCE).toContain('status, state, failure_reason, failure_sub_reason, dead_letter_reason, run_mode, requested_families, family, started_at, completed_at, failure_detail');
  });

  it('the conditional runTag join is exactly debates(title, run_tag) (DEVEX-RUNTAG-COLUMN-SWAP-001)', () => {
    // The ONLY join is the title + durable run_tag on debates — no body, no
    // span, no results table. The durable run_tag is the canonical runTag.
    expect(SOURCE).toContain('debates(title, run_tag)');
    // No bare `debates(title)` (the pre-swap shape) survives.
    expect(CODE_ONLY).not.toMatch(/debates\(title\)/);
    // The join names ONLY title + run_tag (no other column smuggled in).
    const debateJoins = CODE_ONLY.match(/debates\(([^)]*)\)/g) || [];
    expect(debateJoins.length).toBeGreaterThan(0);
    for (const j of debateJoins) {
      const inner = j.replace(/^debates\(/, '').replace(/\)$/, '');
      const cols = inner.split(',').map((c) => c.trim()).sort();
      expect(cols).toEqual(['run_tag', 'title']);
    }
  });

  it('reads the durable run_tag from the debates join into debate_run_tag', () => {
    expect(CODE_ONLY).toMatch(/debate_run_tag/);
    expect(CODE_ONLY).toMatch(/\.run_tag/);
  });

  it('reads failure_detail strictly through the RunRowFailureDetail allow-list keys', () => {
    // The reader function whitelists exactly the 7 allow-list keys.
    for (const key of [
      'validator_path', 'reason', 'family', 'correlation_id',
      'attempt_count', 'run_mode', 'schema_version',
    ]) {
      expect(SOURCE).toContain(`src.${key}`);
    }
  });
});

describe('admin-classifier-health — write discipline', () => {
  it('the only write op is the admin_audit_events insert', () => {
    const inserts = CODE_ONLY.match(/\.insert\(/g) || [];
    expect(inserts.length).toBe(1);
    // It targets admin_audit_events.
    expect(CODE_ONLY).toMatch(/from\(\s*['"]admin_audit_events['"]\s*\)[\s\S]{0,120}\.insert\(/);
    // No other mutating verbs.
    expect(CODE_ONLY).not.toMatch(/\.update\(/);
    expect(CODE_ONLY).not.toMatch(/\.delete\(/);
    expect(CODE_ONLY).not.toMatch(/\.upsert\(/);
  });

  it('the audit payload carries the filter params + a count only (no row contents)', () => {
    expect(CODE_ONLY).toMatch(/payload:\s*\{\s*filter:/);
    expect(CODE_ONLY).toMatch(/resultRowCount/);
  });
});

describe('admin-classifier-health — leak scrub before return', () => {
  it('calls containsForbiddenSubstring on the serialized output before returning', () => {
    expect(SOURCE).toMatch(/from\s+['"][^'"]*cutoverHealthAlertModel\.ts['"]/);
    expect(CODE_ONLY).toMatch(/containsForbiddenSubstring\(/);
    // The scrub guards both json + csv and short-circuits to an error.
    expect(CODE_ONLY).toMatch(/containsForbiddenSubstring\([\s\S]{0,80}return\s+internalError/);
  });
});

describe('admin-classifier-health — no control / no provider path', () => {
  it('imports no provider / MCP / drainer / routing / familyRegistry module', () => {
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*classifyArgumentCore/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*classifierDrainer/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*classifierQueueRouting/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*autoTriggerDispatcher/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*familyRegistry/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*booleanObservationMcpAdapter/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*anthropic/i);
  });

  it('makes no outbound provider HTTP call', () => {
    const httpsCalls = CODE_ONLY.match(/https:\/\/[a-z0-9.-]+/gi) || [];
    expect(httpsCalls.length).toBe(0);
  });

  it('does not read or write any routing knob', () => {
    expect(CODE_ONLY).not.toMatch(/CLASSIFIER_QUEUE_ROUTING_ENABLED/);
    expect(CODE_ONLY).not.toMatch(/CLASSIFIER_QUEUE_ROUTING_PERCENTAGE/);
    expect(CODE_ONLY).not.toMatch(/productionEnabled/);
  });

  it('never logs the Authorization header or service-role key', () => {
    expect(CODE_ONLY).not.toMatch(/console\.[a-z]+\([^)]*[Aa]uthorization/);
    expect(CODE_ONLY).not.toMatch(/console\.[a-z]+\([^)]*SERVICE_ROLE/);
    expect(CODE_ONLY).not.toMatch(/Deno\.env\.get\(\s*['"]SUPABASE_SERVICE_ROLE_KEY['"]/);
  });

  it('validates the body with the strict zod schema (unknown keys rejected)', () => {
    expect(SOURCE).toMatch(/from\s+['"][^'"]*adminClassifierHealthSchemas\.ts['"]/);
    expect(CODE_ONLY).toMatch(/AdminClassifierHealthRequestSchema\.safeParse/);
  });
});
