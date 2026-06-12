/**
 * OPS-MCP-OBSERVABILITY — Source-scan: no service-role, no secrets.
 *
 * Scans every file under `scripts/ops/` (recursively) and asserts:
 *   - No literal SERVICE_ROLE / service_role / SUPABASE_SERVICE_ROLE_KEY.
 *   - No literal ANTHROPIC_API_KEY / anthropic / xai / X_BEARER_TOKEN.
 *   - No literal 'Bearer ' (with trailing space).
 *   - No literal Authorization header (case-insensitive).
 *   - No contiguous sk-ant- / xai- / sb_secret / JWT-shaped literal.
 *   - No process.env.SUPABASE_SERVICE_ROLE_KEY reference.
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §safety.
 * Doctrine: cdiscourse-doctrine §6 (secrets policy).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const OPS_DIR = path.join(REPO, 'scripts', 'ops');

function collectAllFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectAllFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip JS/TS line + block comments AND SQL line + block comments so
 * the scan checks executable code only. Comments may legitimately
 * reference the banned tokens (e.g., a doc-comment that says "no
 * service-role usage") without violating the rule.
 */
function stripCommentsForScan(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    // JS/TS line comment
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    // SQL line comment
    if (c === '-' && next === '-') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    // Block comment (JS/TS/SQL share `/* ... */`)
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

describe('OPS-MCP-OBSERVABILITY — scripts/ops source scan: no secrets', () => {
  const FILES = collectAllFiles(OPS_DIR);

  it('finds at least the entry script + lib + 19 SQL files', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(20);
    expect(FILES.some((f) => f.endsWith('mcp-observability-report.mjs'))).toBe(true);
    expect(
      FILES.some((f) => f.endsWith('mcp-observability-report-lib.cjs')),
    ).toBe(true);
    const sqlFiles = FILES.filter((f) => f.endsWith('.sql'));
    expect(sqlFiles.length).toBe(19);
  });

  it('no executable code contains SERVICE_ROLE literal', () => {
    for (const file of FILES) {
      const src = stripCommentsForScan(fs.readFileSync(file, 'utf8'));
      expect(src).not.toMatch(/SERVICE_ROLE/);
      expect(src).not.toMatch(/service_role/);
      expect(src).not.toMatch(/service-role/);
    }
  });

  it('no executable code contains SUPABASE_SERVICE_ROLE_KEY literal', () => {
    for (const file of FILES) {
      const src = stripCommentsForScan(fs.readFileSync(file, 'utf8'));
      expect(src).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
  });

  it('no executable code contains ANTHROPIC_API_KEY literal', () => {
    for (const file of FILES) {
      const src = stripCommentsForScan(fs.readFileSync(file, 'utf8'));
      expect(src).not.toContain('ANTHROPIC_API_KEY');
    }
  });

  it('no executable code contains X_BEARER_TOKEN or XAI_API_KEY literal', () => {
    for (const file of FILES) {
      const src = stripCommentsForScan(fs.readFileSync(file, 'utf8'));
      expect(src).not.toContain('X_BEARER_TOKEN');
      expect(src).not.toContain('XAI_API_KEY');
    }
  });

  it('no executable code contains a literal "Bearer " with trailing space', () => {
    for (const file of FILES) {
      const src = stripCommentsForScan(fs.readFileSync(file, 'utf8'));
      // The actual auth header literal is "Bearer ". The scan rejects
      // any contiguous occurrence regardless of position.
      expect(src).not.toMatch(/Bearer /);
    }
  });

  it('no executable code contains the Authorization header literal (case-insensitive)', () => {
    for (const file of FILES) {
      const src = stripCommentsForScan(fs.readFileSync(file, 'utf8'));
      // The Authorization header MUST NOT be referenced anywhere in
      // observability scripts (no JWT-bearing code paths here; the
      // supabase CLI handles auth).
      expect(src).not.toMatch(/Authorization/i);
    }
  });

  it('no file contains a contiguous secret-shaped literal (sk-ant- / xai- / sb_secret / JWT)', () => {
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      // Assemble the patterns from fragments so this test file itself
      // doesn't carry the contiguous banned literal. Scans the full
      // file (including comments) — secret-shaped literals are banned
      // anywhere.
      expect(new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{8}').test(src)).toBe(false);
      expect(new RegExp('xai' + '-' + '[A-Za-z0-9]{12}').test(src)).toBe(false);
      expect(new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{8}').test(src)).toBe(false);
      expect(
        /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(src),
      ).toBe(false);
    }
  });

  it('no executable code references process.env.SUPABASE_SERVICE_ROLE_KEY', () => {
    for (const file of FILES) {
      const src = stripCommentsForScan(fs.readFileSync(file, 'utf8'));
      expect(src).not.toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    }
  });

  it('entry script does not import @supabase/supabase-js (no client-side service-role path)', () => {
    const scriptPath = path.join(OPS_DIR, 'mcp-observability-report.mjs');
    const src = stripCommentsForScan(fs.readFileSync(scriptPath, 'utf8'));
    expect(src).not.toContain('@supabase/supabase-js');
    expect(src).not.toContain('createClient');
  });

  it('lib does not import @supabase/supabase-js (no client-side service-role path)', () => {
    const libPath = path.join(OPS_DIR, 'mcp-observability-report-lib.cjs');
    const src = stripCommentsForScan(fs.readFileSync(libPath, 'utf8'));
    expect(src).not.toContain('@supabase/supabase-js');
    expect(src).not.toContain('createClient');
  });

  it('lib auth path uses only `npx supabase db query --linked` (Management API)', () => {
    const libPath = path.join(OPS_DIR, 'mcp-observability-report-lib.cjs');
    const src = fs.readFileSync(libPath, 'utf8');
    // The lib's only DB access path is via the Supabase CLI which
    // uses the operator's authenticated Management API session.
    expect(src).toContain('supabase');
    expect(src).toContain('--linked');
    // Confirm no fetch/anthropic/xai client usage in executable code.
    const exe = stripCommentsForScan(src);
    expect(exe).not.toContain('fetch(');
    expect(exe.toLowerCase()).not.toContain('anthropic');
    expect(exe.toLowerCase()).not.toContain('xai');
  });
});
