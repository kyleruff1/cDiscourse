/**
 * MCP-021C-EDGE — Test: persistence writer source scan.
 *
 * The writer imports `createServiceClient` from `../supabaseClients.ts`
 * which reads `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` — Jest can't
 * load it. The coverage wall is a source-text scan:
 *   - Imports `createServiceClient` (the existing factory; not a new
 *     env read inside this writer).
 *   - NEVER returns the service-role client to the caller.
 *   - NEVER logs the service-role key, the Authorization header, or any
 *     credential.
 *   - Writes only to argument_machine_observation_runs and
 *     argument_machine_observation_results (the MCP-021B tables).
 *   - INSERTs only — no UPDATE, no DELETE.
 *   - The run_mode field is written verbatim from input.
 *
 * Doctrine encoded (supabase-edge-contract):
 *   - Service-role bypasses RLS; only Edge Functions may use it.
 *   - The handler MUST verify admin auth before invoking the writer.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const WRITER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/persistenceWriter.ts',
);

let writerText = '';

beforeAll(() => {
  writerText = fs.readFileSync(WRITER_PATH, 'utf8');
});

function stripCommentsAndStrings(src: string): string {
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
    if (c === "'" || c === '"') {
      const quote = c;
      out += quote + quote;
      i += 1;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (c === '`') {
      out += '`';
      i += 1;
      while (i < n) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === '`') {
          out += '`';
          i += 1;
          break;
        }
        if (src[i] === '$' && src[i + 1] === '{') {
          out += '${';
          i += 2;
          let depth = 1;
          const codeStart = i;
          while (i < n && depth > 0) {
            if (src[i] === '{') depth += 1;
            else if (src[i] === '}') depth -= 1;
            if (depth === 0) break;
            i += 1;
          }
          out += stripCommentsAndStrings(src.slice(codeStart, i));
          out += '}';
          i += 1;
          continue;
        }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

describe('MCP-021C-EDGE — persistence writer exports + imports', () => {
  it('PW-1 — exports persistRun', () => {
    expect(/export\s+async\s+function\s+persistRun\b/.test(writerText)).toBe(true);
  });

  it('PW-2 — exports persistResults', () => {
    expect(/export\s+async\s+function\s+persistResults\b/.test(writerText)).toBe(true);
  });

  it('PW-3 — exports PersistRunInput / PersistResultInput interfaces', () => {
    expect(writerText).toContain('PersistRunInput');
    expect(writerText).toContain('PersistResultInput');
  });

  it('PW-4 — imports createServiceClient from ../supabaseClients.ts', () => {
    expect(/import\s+\{[\s\S]*?createServiceClient[\s\S]*?\}\s+from\s+['"]\.\.\/supabaseClients\.ts['"]/.test(writerText)).toBe(
      true,
    );
  });

  it('PW-5 — does NOT directly read SUPABASE_SERVICE_ROLE_KEY (delegated to factory)', () => {
    const code = stripCommentsAndStrings(writerText);
    expect(/Deno\.env\.get\(\s*['"]SUPABASE_SERVICE_ROLE_KEY['"]\s*\)/.test(code)).toBe(false);
  });
});

describe('MCP-021C-EDGE — writer NEVER returns service-role client', () => {
  it('PW-6 — return shape does NOT include client / serviceClient / supabase field', () => {
    const code = stripCommentsAndStrings(writerText);
    // The writer's return shape uses `runId` + `error` + `written` only.
    expect(/return\s+\{[^}]*\bclient\s*:/.test(code)).toBe(false);
    expect(/return\s+\{[^}]*\bserviceClient\s*:/.test(code)).toBe(false);
    expect(/return\s+\{[^}]*\bsupabase\s*:/.test(code)).toBe(false);
  });

  it('PW-7 — declared return types are typed PersistRunResult / PersistResultsResult', () => {
    expect(writerText).toContain('PersistRunResult');
    expect(writerText).toContain('PersistResultsResult');
  });
});

describe('MCP-021C-EDGE — writer NEVER logs credentials', () => {
  it('PW-8 — no console.log in executable code', () => {
    const code = stripCommentsAndStrings(writerText);
    expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
  });

  it('PW-9 — no console call references Authorization / Bearer / SERVICE_ROLE', () => {
    expect(/console\.\w+\([^)]*[Aa]uthorization/.test(writerText)).toBe(false);
    expect(/console\.\w+\([^)]*Bearer/.test(writerText)).toBe(false);
    expect(/console\.\w+\([^)]*SERVICE_ROLE/.test(writerText)).toBe(false);
    expect(/console\.\w+\([^)]*serviceClient/.test(writerText)).toBe(false);
  });

  it('PW-10 — no contiguous secret-shaped literal', () => {
    expect(new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{8}').test(writerText)).toBe(false);
    expect(new RegExp('xai' + '-' + '[A-Za-z0-9]{12}').test(writerText)).toBe(false);
    expect(new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{8}').test(writerText)).toBe(false);
    expect(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(writerText)).toBe(false);
  });
});

describe('MCP-021C-EDGE — writer targets correct tables', () => {
  it('PW-11 — persistRun targets argument_machine_observation_runs', () => {
    expect(writerText).toMatch(/['"]argument_machine_observation_runs['"]/);
  });

  it('PW-12 — persistResults targets argument_machine_observation_results', () => {
    expect(writerText).toMatch(/['"]argument_machine_observation_results['"]/);
  });

  it('PW-13 — writer NEVER targets public.arguments / debates / profiles tables', () => {
    const code = stripCommentsAndStrings(writerText);
    expect(/\.from\s*\(\s*['"]arguments['"]/.test(code)).toBe(false);
    expect(/\.from\s*\(\s*['"]debates['"]/.test(code)).toBe(false);
    expect(/\.from\s*\(\s*['"]profiles['"]/.test(code)).toBe(false);
  });
});

describe('MCP-021C-EDGE — writer is INSERT-only', () => {
  it('PW-14 — writer uses .insert(...)', () => {
    const code = stripCommentsAndStrings(writerText);
    expect(/\.insert\(/.test(code)).toBe(true);
  });

  it('PW-15 — writer NEVER calls .update(', () => {
    const code = stripCommentsAndStrings(writerText);
    expect(/\.update\s*\(/.test(code)).toBe(false);
  });

  it('PW-16 — writer NEVER calls .delete(', () => {
    const code = stripCommentsAndStrings(writerText);
    expect(/\.delete\s*\(/.test(code)).toBe(false);
  });

  it('PW-17 — writer NEVER calls .upsert(', () => {
    const code = stripCommentsAndStrings(writerText);
    expect(/\.upsert\s*\(/.test(code)).toBe(false);
  });
});

describe('MCP-021C-EDGE — writer writes run_mode column', () => {
  it('PW-18 — persistRun INSERT payload includes run_mode field', () => {
    expect(writerText).toContain('run_mode');
    // The input shape should have the runMode key that maps to run_mode
    // column. The mapping happens explicitly in the payload object.
    expect(writerText).toContain('input.runMode');
  });

  it('PW-19 — input shape carries runMode of type MachineObservationRunMode', () => {
    expect(writerText).toContain('runMode: MachineObservationRunMode');
  });
});

describe('MCP-021C-EDGE — writer column mapping (snake_case payload)', () => {
  it('PW-20 — persistRun maps camel → snake correctly', () => {
    // The payload must map every camelCase input field to the matching
    // snake_case column name from the migration.
    const requiredMappings = [
      'debate_id',
      'argument_id',
      'schema_version',
      'requested_families',
      'provider_key',
      'model_name',
      'input_hash',
      'run_mode',
      'status',
      'failure_reason',
      'started_at',
      'completed_at',
    ];
    for (const col of requiredMappings) {
      expect(writerText).toContain(col);
    }
  });

  it('PW-21 — persistResults maps camel → snake correctly', () => {
    const requiredMappings = [
      'run_id',
      'debate_id',
      'argument_id',
      'schema_version',
      'raw_key',
      'family',
      'confidence',
      'evidence_span',
    ];
    for (const col of requiredMappings) {
      expect(writerText).toContain(col);
    }
  });
});
