/**
 * MCP-021C-EDGE — Test: no MCP secrets anywhere in client code.
 *
 * Critical boundary check from the spawn-card prompt:
 *   - MCP_URL / MCP_TOKEN / SEMANTIC_REFEREE_MCP / EXPO_PUBLIC_.*MCP
 *     appear in NO src/ or app/ file (code or comment).
 *   - The MCP server is operator-hosted; client code MUST NOT know its
 *     URL or carry its token.
 *
 * If this test fires, the implementer must STOP and surface the failure.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const ALL_CLIENT_FILES = [
  ...collectSourceFiles(path.join(REPO, 'src')),
  ...collectSourceFiles(path.join(REPO, 'app')),
];

describe('MCP-021C-EDGE — boundary scan: MCP secrets absent from client', () => {
  it('SEC-1 — SEMANTIC_REFEREE_MCP_URL appears nowhere in src/ or app/', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('SEMANTIC_REFEREE_MCP_URL'),
    );
    expect(offenders).toEqual([]);
  });

  it('SEC-2 — SEMANTIC_REFEREE_MCP_TOKEN appears nowhere in src/ or app/', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('SEMANTIC_REFEREE_MCP_TOKEN'),
    );
    expect(offenders).toEqual([]);
  });

  it('SEC-3 — no EXPO_PUBLIC_*MCP env var appears in client (regex from fragments)', () => {
    // Assemble the regex from fragments so this test file itself does
    // not carry the literal banned name.
    const expoMcp = new RegExp('EXPO_PUBLIC_' + '[A-Z_]*MCP');
    const offenders = ALL_CLIENT_FILES.filter((f) =>
      expoMcp.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('SEC-4 — bare MCP_URL / MCP_TOKEN env names absent from client', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) => {
      const content = fs.readFileSync(f, 'utf8');
      // Test the bare environment-variable form, not the substring
      // "MCP" generally (the codebase has legitimate uses of "MCP" in
      // doc strings for MCP-021A taxonomy etc.).
      return /\bMCP_URL\b/.test(content) || /\bMCP_TOKEN\b/.test(content);
    });
    expect(offenders).toEqual([]);
  });
});

describe('MCP-021C-EDGE — boundary scan: no MCP-related Deno.env reads in client', () => {
  it('SEC-5 — no client file reads SEMANTIC_REFEREE_MCP_* via Deno.env.get', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) => {
      const content = fs.readFileSync(f, 'utf8');
      return /Deno\.env\.get\(\s*['"]SEMANTIC_REFEREE_MCP_/.test(content);
    });
    expect(offenders).toEqual([]);
  });
});

describe('MCP-021C-EDGE — boundary scan: no Authorization / Bearer literal in client', () => {
  it('SEC-6 — no client file contains a contiguous "Bearer <token>" literal', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) =>
      /\bBearer\s+[A-Za-z0-9._-]{16,}/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
