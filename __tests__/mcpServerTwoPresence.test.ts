/**
 * MCP-SERVER-002 — CDiscourse-side presence test.
 *
 * Lightweight presence + structure assertions for the MCP-SERVER-002
 * deliverables. Asserts:
 *   - The updated smoke script's Check 5 + Check 9 validate the REAL
 *     Family A response shape, not the scaffolded not_implemented envelope
 *   - The new MCP-SERVER-002 audit template exists with the 3-phase
 *     header structure
 *   - The MCP-018 runbook contains the provider-precedence note added
 *     in this card
 *   - The MCP-SERVER-001 smoke template's Phase 5 contains the corrected
 *     SQL block added in this card
 *
 * No server invocation — the server-side Deno tests cover behavior. This
 * file is purely about WIRING + DOCS PRESENCE.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const SMOKE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'mcp-server-001-smoke.sh');
const MCP_SERVER_002_TEMPLATE = path.join(
  REPO_ROOT,
  'docs',
  'audits',
  'MCP-SERVER-002-smoke-template.md',
);
const MCP_018_RUNBOOK = path.join(
  REPO_ROOT,
  'docs',
  'deployment',
  'mcp-018-mcp-adapter-runbook.md',
);
const MCP_SERVER_001_TEMPLATE = path.join(
  REPO_ROOT,
  'docs',
  'audits',
  'MCP-SERVER-001-smoke-template.md',
);

describe('MCP-SERVER-002 smoke script extensions', () => {
  let smoke: string;
  beforeAll(() => {
    smoke = fs.readFileSync(SMOKE_SCRIPT, 'utf8');
  });

  it('Check 5 asserts real Family A response shape (NOT the scaffolded not_implemented envelope)', () => {
    expect(smoke).toContain('5-compat-boolean-family-a');
    expect(smoke).toContain('"schemaVersion":"mcp-021.machine-observations.boolean.v1"');
    expect(smoke).toContain('"family-a-v1"');
  });

  it('Check 5 request body uses parent_relation family (not family_evidence)', () => {
    const checkBlockStart = smoke.indexOf('Check 5: POST /mcp/adapter-compat with VALID bearer + boolean');
    expect(checkBlockStart).toBeGreaterThan(0);
    const checkBlockEnd = smoke.indexOf('Check 6:', checkBlockStart);
    const checkBlock = smoke.slice(checkBlockStart, checkBlockEnd);
    expect(checkBlock).toContain('"requestedFamilies":["parent_relation"]');
    expect(checkBlock).toContain('"supports_parent"');
    expect(checkBlock).not.toContain('"family_evidence"');
  });

  it('Check 5 NO LONGER asserts not_implemented or scaffoldedFor envelope', () => {
    const checkBlockStart = smoke.indexOf('Check 5: POST /mcp/adapter-compat with VALID bearer + boolean');
    expect(checkBlockStart).toBeGreaterThan(0);
    const checkBlockEnd = smoke.indexOf('Check 6:', checkBlockStart);
    const checkBlock = smoke.slice(checkBlockStart, checkBlockEnd);
    expect(checkBlock).not.toContain('"reason":"not_implemented"');
    expect(checkBlock).not.toContain('"scaffoldedFor"');
  });

  it('Check 9 asserts real Family A response shape via /mcp endpoint', () => {
    expect(smoke).toContain('9-mcp-tools-call-boolean-family-a');
    const checkBlockStart = smoke.indexOf('Check 9: POST /mcp tools/call classify_argument_boolean_observations');
    expect(checkBlockStart).toBeGreaterThan(0);
    const checkBlockEnd = smoke.indexOf('MCP-SERVER-001 smoke:', checkBlockStart);
    const checkBlock = smoke.slice(checkBlockStart, checkBlockEnd);
    expect(checkBlock).toContain('"schemaVersion":"mcp-021.machine-observations.boolean.v1"');
    expect(checkBlock).toContain('"family-a-v1"');
    expect(checkBlock).toContain('"isError":false');
  });

  it('Check 9 NO LONGER asserts not_implemented envelope', () => {
    const checkBlockStart = smoke.indexOf('Check 9: POST /mcp tools/call classify_argument_boolean_observations');
    expect(checkBlockStart).toBeGreaterThan(0);
    const checkBlockEnd = smoke.indexOf('MCP-SERVER-001 smoke:', checkBlockStart);
    const checkBlock = smoke.slice(checkBlockStart, checkBlockEnd);
    expect(checkBlock).not.toContain('"reason":"not_implemented"');
    expect(checkBlock).not.toContain('"scaffoldedFor"');
  });

  it('script still NEVER prints the bearer token literal', () => {
    expect(smoke).toContain('[REDACTED]');
    expect(smoke).toContain('Token: [REDACTED]');
  });

  it('header comment notes MCP-SERVER-002 extension', () => {
    expect(smoke).toContain('extended by MCP-SERVER-002');
  });
});

describe('MCP-SERVER-002 smoke template', () => {
  let template: string;
  beforeAll(() => {
    template = fs.readFileSync(MCP_SERVER_002_TEMPLATE, 'utf8');
  });

  it('exists and is non-empty', () => {
    expect(template.length).toBeGreaterThan(500);
  });

  it('declares 3-phase structure (Local / Hosted / Parser validation)', () => {
    expect(template).toMatch(/Phase 1/);
    expect(template).toMatch(/Phase 2/);
    expect(template).toMatch(/Phase 3/);
    expect(template).toMatch(/Local/i);
    expect(template).toMatch(/Hosted/i);
    expect(template).toMatch(/parser validation/i);
  });

  it('references the validator script path', () => {
    expect(template).toContain('validate-family-a-response');
  });

  it('declares verdict rules (PASS / PARTIAL / FAIL)', () => {
    expect(template).toMatch(/PASS/);
    expect(template).toMatch(/PARTIAL/);
    expect(template).toMatch(/FAIL/);
  });
});

describe('MCP-018 runbook precedence note (added in MCP-SERVER-002)', () => {
  let runbook: string;
  beforeAll(() => {
    runbook = fs.readFileSync(MCP_018_RUNBOOK, 'utf8');
  });

  it('contains the provider-precedence note', () => {
    expect(runbook).toMatch(/Provider precedence/i);
    expect(runbook).toMatch(/semantic_referee_runtime_config/);
    expect(runbook).toMatch(/SEMANTIC_REFEREE_PROVIDER/);
  });

  it('notes that the DB row wins over the env var', () => {
    expect(runbook).toMatch(/DB row.*higher precedence|DB.*win|DB-config.*higher/i);
  });
});

describe('MCP-SERVER-001 smoke template SQL addition (added in MCP-SERVER-002)', () => {
  let template: string;
  beforeAll(() => {
    template = fs.readFileSync(MCP_SERVER_001_TEMPLATE, 'utf8');
  });

  it('contains the Phase 5 prerequisite SQL block', () => {
    expect(template).toMatch(/DB-config provider override|Phase 5 prerequisite/i);
    expect(template).toContain('semantic_referee_runtime_config');
    expect(template).toContain('id = true');
    expect(template).toContain("provider_mode = 'mcp'");
  });

  it('does NOT contain the incorrect SQL forms (id = uuid; semantic_referee_enabled)', () => {
    expect(template).not.toMatch(/id = '<id-from-select>'/);
    expect(template).not.toMatch(/semantic_referee_enabled =/);
  });
});
