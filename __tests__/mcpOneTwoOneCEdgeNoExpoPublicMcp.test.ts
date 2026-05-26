/**
 * MCP-021C-EDGE — Test: no EXPO_PUBLIC_*MCP env var leakage.
 *
 * Doctrine guard: any `EXPO_PUBLIC_*` env var is BUNDLED INTO THE CLIENT
 * by Expo at build time. The MCP URL + token MUST NOT be EXPO_PUBLIC_*.
 *
 * This file scans BOTH client code AND build configuration (.env.example,
 * eas.json, app.json/app.config.*, package.json) for any
 * `EXPO_PUBLIC_*MCP` reference.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();

function collectFilesByPattern(dir: string, patternMatch: RegExp): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      if (entry.name === '.git') continue;
      if (entry.name === '.expo') continue;
      out.push(...collectFilesByPattern(full, patternMatch));
    } else if (patternMatch.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Assemble the EXPO_PUBLIC pattern from fragments so the regex literal in
// this file does not itself trigger an EXPO_PUBLIC_*MCP scan.
const EXPO_PUBLIC_MCP_RE = new RegExp('EXPO_PUBLIC_' + '[A-Z_]*MCP');

describe('MCP-021C-EDGE — no EXPO_PUBLIC_*MCP env var anywhere in source tree', () => {
  it('SEC-14 — src/ files have no EXPO_PUBLIC_*MCP reference', () => {
    const tsFiles = collectFilesByPattern(path.join(REPO, 'src'), /\.(ts|tsx)$/);
    const offenders = tsFiles.filter((f) =>
      EXPO_PUBLIC_MCP_RE.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('SEC-15 — app/ files have no EXPO_PUBLIC_*MCP reference', () => {
    const tsFiles = collectFilesByPattern(path.join(REPO, 'app'), /\.(ts|tsx)$/);
    const offenders = tsFiles.filter((f) =>
      EXPO_PUBLIC_MCP_RE.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('SEC-16 — supabase/functions/ files have no EXPO_PUBLIC_*MCP reference (server side does not need it either)', () => {
    const tsFiles = collectFilesByPattern(path.join(REPO, 'supabase/functions'), /\.ts$/);
    const offenders = tsFiles.filter((f) =>
      EXPO_PUBLIC_MCP_RE.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

describe('MCP-021C-EDGE — no EXPO_PUBLIC_*MCP in build/runtime config', () => {
  const CANDIDATE_CONFIG_FILES = [
    '.env.example',
    'app.json',
    'app.config.js',
    'app.config.ts',
    'eas.json',
    'package.json',
    'expo-env.d.ts',
  ];

  for (const filename of CANDIDATE_CONFIG_FILES) {
    it(`SEC-17:${filename} — has no EXPO_PUBLIC_*MCP reference`, () => {
      const filePath = path.join(REPO, filename);
      if (!fs.existsSync(filePath)) return; // skipped if file absent
      const content = fs.readFileSync(filePath, 'utf8');
      expect(EXPO_PUBLIC_MCP_RE.test(content)).toBe(false);
    });
  }
});

describe('MCP-021C-EDGE — Edge Function does not depend on EXPO_PUBLIC_*MCP', () => {
  it('SEC-18 — Edge Function reads SEMANTIC_REFEREE_MCP_URL/TOKEN only (no EXPO_PUBLIC_ prefix)', () => {
    const adapterPath = path.join(
      REPO,
      'supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts',
    );
    const content = fs.readFileSync(adapterPath, 'utf8');
    // The adapter reads SEMANTIC_REFEREE_MCP_URL + SEMANTIC_REFEREE_MCP_TOKEN.
    expect(content).toContain("Deno.env.get('SEMANTIC_REFEREE_MCP_URL')");
    expect(content).toContain("Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN')");
    // And NEVER an EXPO_PUBLIC_*MCP env var.
    expect(EXPO_PUBLIC_MCP_RE.test(content)).toBe(false);
  });
});
