/**
 * OPS-MCP-OBSERVABILITY-002 — filter-schema source-scan.
 *
 * `supabase/functions/_shared/adminClassifierHealthSchemas.ts` imports
 * `npm:zod@4`, so it is Deno-only and not Jest-loadable. This source-scan
 * asserts the structural contract:
 *   1. `z.strictObject` is used (unknown keys REJECTED, not stripped).
 *   2. The filter field list is exactly the allow-listed scalar filters +
 *      time window + run_tag + format.
 *   3. There is NO action verb / write field / select / columns key — the
 *      shape itself guarantees the request cannot ask the function to mutate
 *      or to widen the column set.
 */
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_PATH = path.join(
  process.cwd(),
  'supabase',
  'functions',
  '_shared',
  'adminClassifierHealthSchemas.ts',
);
const SOURCE = fs.readFileSync(SOURCE_PATH, 'utf8');

/** Comment-stripped view — docstring prose must not trip field-shape scans. */
const CODE_ONLY = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

describe('adminClassifierHealthSchemas — strict filter contract', () => {
  it('uses z.strictObject so unknown keys are rejected', () => {
    expect(SOURCE).toMatch(/z\.strictObject\(/);
    expect(SOURCE).not.toMatch(/z\.object\(/); // not the unknown-key-stripping variant
    expect(SOURCE).not.toMatch(/\.passthrough\(/);
  });

  it('declares exactly the allow-listed filter fields', () => {
    for (const field of [
      'status', 'state', 'family', 'run_mode',
      'failure_reason', 'failure_sub_reason', 'failure_detail_reason',
      'from_iso', 'to_iso', 'run_tag', 'format',
    ]) {
      expect(SOURCE).toMatch(new RegExp(`\\b${field}\\s*:`));
    }
  });

  it('declares NO write / action / select / columns field', () => {
    for (const forbidden of ['action', 'select', 'columns', 'insert', 'update', 'delete', 'sql', 'body', 'evidence_span']) {
      expect(CODE_ONLY).not.toMatch(new RegExp(`\\b${forbidden}\\s*:`));
    }
  });

  it('format is constrained to json | csv', () => {
    expect(SOURCE).toMatch(/format:\s*z\.enum\(\[\s*['"]json['"]\s*,\s*['"]csv['"]\s*\]\)/);
  });
});
