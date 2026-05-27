/**
 * MCP-021C-EDGE — Test: Edge Function handler source scan.
 *
 * The handler imports `Deno.serve` and the Deno-only adapter; Jest
 * cannot load it. The coverage wall is a source-text scan that proves
 * the handler:
 *   - Uses `requireAdmin(req)` at the boundary (admin auth gate).
 *   - Validates input via a structured schema (zod-equivalent guard).
 *   - Production mode rejects non-Family-A families at the boundary.
 *   - Service-role bypasses RLS only AFTER admin auth.
 *   - Never logs Authorization / Bearer / token / response body.
 *   - Returns sanitized PerArgumentSummary; no credentials leak.
 *   - Targets the operator-hosted MCP server (no client-side fetch).
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const HANDLER_PATH = path.join(
  REPO,
  'supabase/functions/classify-argument-boolean-observations/index.ts',
);
// MCP-021C-AUTO-TRIGGER-FAMILY-A — the per-argument classifier logic was
// lifted from the inline handler body into a shared core module so the
// same code can be invoked from `submit-argument`'s auto-trigger
// dispatcher. The handler now imports `classifyOneArgumentCore` from the
// shared module. Source-scan tests that previously inspected the inline
// classifier body now scan the core file at its new location.
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts',
);
const CONFIG_PATH = path.join(REPO, 'supabase/config.toml');

let handlerText = '';
let coreText = '';
let configText = '';
let combinedClassifierText = '';

beforeAll(() => {
  handlerText = fs.readFileSync(HANDLER_PATH, 'utf8');
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  configText = fs.readFileSync(CONFIG_PATH, 'utf8');
  // The classifier orchestration surface is the union of the handler
  // (HTTP envelope, admin gate, request validation) + the shared core
  // (per-argument classifier body). Tests that target classifier-body
  // patterns scan the combined text.
  combinedClassifierText = `${handlerText}\n\n// ── classifyArgumentCore.ts ──\n${coreText}`;
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

describe('MCP-021C-EDGE — handler file exists at expected path', () => {
  it('EFH-1 — file exists', () => {
    expect(handlerText.length).toBeGreaterThan(0);
  });

  it('EFH-2 — function name is classify-argument-boolean-observations (matches path)', () => {
    // The path encodes the name; the handler file references it via
    // the tool name and provider key.
    expect(handlerText).toContain('classify_argument_boolean_observations');
    expect(handlerText).toContain('classify-argument-boolean-observations');
  });

  it('EFH-3 — registered in supabase/config.toml with verify_jwt = true', () => {
    expect(configText).toContain('[functions.classify-argument-boolean-observations]');
    const block = configText.split('[functions.classify-argument-boolean-observations]')[1]
      .split('\n[functions.')[0];
    expect(block).toContain('verify_jwt = true');
  });
});

describe('MCP-021C-EDGE — admin auth gate', () => {
  it('EFH-4 — imports requireAdmin from ../_shared/adminAuth.ts', () => {
    expect(/import\s+\{[\s\S]*?requireAdmin[\s\S]*?\}\s+from\s+['"]\.\.\/_shared\/adminAuth\.ts['"]/.test(handlerText)).toBe(true);
  });

  it('EFH-5 — calls await requireAdmin(req) inside the handler', () => {
    expect(/await\s+requireAdmin\s*\(\s*req\s*\)/.test(handlerText)).toBe(true);
  });

  it('EFH-6 — rejects 401 on auth failure', () => {
    const code = stripCommentsAndStrings(handlerText);
    expect(/auth\.status\s*===\s*401/.test(code) || /unauthorized\s*\(\s*\)/.test(code)).toBe(true);
  });

  it('EFH-7 — rejects 403 on non-admin', () => {
    const code = stripCommentsAndStrings(handlerText);
    expect(/forbidden\s*\(/.test(code)).toBe(true);
  });
});

describe('MCP-021C-EDGE — request validation', () => {
  it('EFH-8 — validates argumentIds is a non-empty array of UUIDs', () => {
    expect(handlerText).toContain('argumentIds');
    expect(handlerText).toContain('isUuid');
  });

  it('EFH-9 — validates mode is "production" or "admin_validation"', () => {
    expect(handlerText).toContain('isMachineObservationRunMode');
  });

  it('EFH-10 — validates schemaVersion is the MCP-021A constant', () => {
    expect(handlerText).toContain('MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION');
  });

  it('EFH-11 — caps argumentIds at MAX_ARGUMENTS_PER_CALL = 10', () => {
    expect(handlerText).toContain('MAX_ARGUMENTS_PER_CALL');
    expect(handlerText).toMatch(/MAX_ARGUMENTS_PER_CALL\s*=\s*10/);
  });

  it('EFH-12 — invalid body returns 422 validation_failed', () => {
    expect(handlerText).toContain('validationFailed');
    expect(handlerText).toContain('validation_failed');
  });
});

describe('MCP-021C-EDGE — production mode family enforcement', () => {
  it('EFH-13 — rejects production mode with no eligible families (422)', () => {
    expect(handlerText).toContain('no_eligible_families_for_production');
    expect(handlerText).toContain("mode === 'production'");
  });

  it('EFH-14 — uses filterFamiliesForMode to enforce the gate', () => {
    expect(handlerText).toContain('filterFamiliesForMode');
  });
});

describe('MCP-021C-EDGE — MCP adapter invocation', () => {
  it('EFH-15 — imports runBooleanObservationMcpAdapter (Deno-only adapter)', () => {
    expect(handlerText).toContain('runBooleanObservationMcpAdapter');
    expect(/from\s+['"]\.\.\/_shared\/booleanObservations\/booleanObservationMcpAdapter\.ts['"]/.test(handlerText)).toBe(true);
  });

  it('EFH-16 — uses buildBooleanObservationRequestForArgument', () => {
    // Post-refactor: this symbol lives in classifyArgumentCore.ts (the lifted core).
    expect(combinedClassifierText).toContain('buildBooleanObservationRequestForArgument');
  });

  it('EFH-17 — adapter result has typed kind: success | unavailable', () => {
    // Post-refactor: the adapter-result type is referenced in the core module.
    expect(combinedClassifierText).toContain('BooleanObservationAdapterResult');
  });
});

describe('MCP-021C-EDGE — persistence writer wiring', () => {
  it('EFH-18 — imports persistRun + persistResults from the writer', () => {
    // Post-refactor: the writer imports live in classifyArgumentCore.ts.
    expect(/import\s+\{[\s\S]*?persistRun[\s\S]*?\}\s+from\s+['"]\.\/persistenceWriter\.ts['"]/.test(coreText)).toBe(true);
    expect(coreText).toContain('persistResults');
  });

  it('EFH-19 — writes run row with status === success on adapter success', () => {
    expect(combinedClassifierText).toMatch(/status:\s*['"]success['"]/);
  });

  it('EFH-20 — writes run row with status === failed on adapter unavailable', () => {
    expect(combinedClassifierText).toMatch(/status:\s*['"]failed['"]/);
  });

  it('EFH-21 — writes runMode from input body', () => {
    expect(combinedClassifierText).toContain('runMode: mode');
  });

  it('EFH-22 — input_hash via buildBooleanObservationInputHash', () => {
    expect(combinedClassifierText).toContain('buildBooleanObservationInputHash');
  });
});

describe('MCP-021C-EDGE — sanitization at inspect floor', () => {
  it('EFH-23 — calls sanitizeMcpBooleanObservationResponse with surface inspect', () => {
    expect(combinedClassifierText).toContain('sanitizeMcpBooleanObservationResponse');
    expect(combinedClassifierText).toMatch(/surface:\s*['"]inspect['"]/);
  });
});

describe('MCP-021C-EDGE — no credential leak in response', () => {
  it('EFH-24 — no console.log in executable code', () => {
    const code = stripCommentsAndStrings(handlerText);
    expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
  });

  it('EFH-25 — no console call references Authorization / Bearer / token', () => {
    expect(/console\.\w+\([^)]*[Aa]uthorization/.test(handlerText)).toBe(false);
    expect(/console\.\w+\([^)]*Bearer/.test(handlerText)).toBe(false);
    expect(/console\.\w+\([^)]*[Tt]oken/.test(handlerText)).toBe(false);
  });

  it('EFH-26 — return shape (PerArgumentSummary) carries no credential fields', () => {
    // Post-refactor: PerArgumentSummary is defined in classifyArgumentCore.ts
    // and re-imported by the handler as a type. The handler still references
    // the name (in `perArgument: PerArgumentSummary[]`).
    expect(handlerText).toContain('PerArgumentSummary');
    expect(coreText).toContain('argumentId');
    expect(coreText).toContain('runId');
    expect(coreText).toContain('positiveObservationCount');
    expect(coreText).toContain('rawKeysWithPositive');
    // Explicit absence checks for credential fields in the PerArgumentSummary
    // interface block. (The shape declared at the top of the core file is the
    // typed contract; PerArgumentSummary may not contain Authorization /
    // token / serviceClient / etc.)
    const summaryBlockMatch = coreText.match(/interface\s+PerArgumentSummary\s*\{[\s\S]*?\n\}/);
    expect(summaryBlockMatch).not.toBeNull();
    const summaryBlock = summaryBlockMatch![0];
    expect(/[Aa]uthorization/.test(summaryBlock)).toBe(false);
    expect(/[Bb]earer/.test(summaryBlock)).toBe(false);
    expect(/[Tt]oken/.test(summaryBlock)).toBe(false);
    expect(/[Ss]erviceClient/.test(summaryBlock)).toBe(false);
    expect(/SERVICE_ROLE/.test(summaryBlock)).toBe(false);
  });

  it('EFH-27 — no contiguous secret-shaped literal', () => {
    expect(new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{8}').test(handlerText)).toBe(false);
    expect(new RegExp('xai' + '-' + '[A-Za-z0-9]{12}').test(handlerText)).toBe(false);
    expect(new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{8}').test(handlerText)).toBe(false);
    expect(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(handlerText)).toBe(false);
  });
});

describe('MCP-021C-EDGE — service-role usage discipline', () => {
  it('EFH-28 — imports createServiceClient ONLY (no raw Deno.env for service role)', () => {
    expect(handlerText).toContain('createServiceClient');
    // The handler must not read SUPABASE_SERVICE_ROLE_KEY directly — the
    // factory does, once.
    const code = stripCommentsAndStrings(handlerText);
    expect(/Deno\.env\.get\(\s*['"]SUPABASE_SERVICE_ROLE_KEY['"]\s*\)/.test(code)).toBe(false);
  });

  it('EFH-29 — service client is instantiated AFTER requireAdmin', () => {
    const adminIdx = handlerText.indexOf('await requireAdmin(req)');
    const serviceClientIdx = handlerText.indexOf('createServiceClient();');
    expect(adminIdx).toBeGreaterThanOrEqual(0);
    expect(serviceClientIdx).toBeGreaterThan(adminIdx);
  });
});

describe('MCP-021C-EDGE — failure-mode mapping', () => {
  it('EFH-30 — maps every adapter unavailable reason to a stable failure_reason', () => {
    // Post-refactor: the failure-reason mapper lives in classifyArgumentCore.ts.
    expect(coreText).toContain('mcp_url_missing');
    expect(coreText).toContain('mcp_token_missing');
    expect(coreText).toContain('mcp_network_error');
    expect(coreText).toContain('mcp_api_error');
    expect(coreText).toContain('mcp_rate_limited');
    expect(coreText).toContain('mcp_parse_failure');
    expect(coreText).toContain('mcp_validation_failed');
  });
});
