/**
 * MCP-018 — semantic-referee MCP-adapter source scan.
 *
 * `mcpAdapter.ts` imports `schema.ts` (→ `npm:zod@4`) so Jest cannot load it.
 * This suite is its coverage wall — a source-text scan that proves the
 * doctrine-critical secret + single-file + no-log invariants, exactly the
 * standard the sibling `anthropicProvider.ts` is held to via
 * `semanticAnthropicSourceScan.test.ts` (MCP-018 design §8 "Source-scan tests").
 *
 * The hard rules a reviewer blocks on:
 *   - `Deno.env.get('SEMANTIC_REFEREE_MCP_URL')` and
 *     `Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN')` each appear in EXACTLY ONE
 *     file: `mcpAdapter.ts`.
 *   - `SEMANTIC_REFEREE_MCP_URL` / `SEMANTIC_REFEREE_MCP_TOKEN` appear NOWHERE
 *     in `src/` or `app/` (code OR comment — the names are brand-new).
 *   - the token / URL / Authorization header / Bearer value / raw response body
 *     is never console-logged.
 *   - `mcpAdapter.ts` imports BOTH validation walls — `schema.ts` and
 *     `contentSafetyScan.ts`.
 *   - `mcpAdapter.ts` hard-pins `authoritative: false` and hard-sets
 *     `provider: 'mcp'`.
 *   - no contiguous secret-shaped literal in `mcpAdapter.ts` / `mcpAdapterCore.ts`.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const SR_DIR = path.join(REPO, 'supabase/functions/_shared/semanticReferee');

/** The MCP-018 new + modified files in the semantic-referee tree. */
const SR_TREE_FILES = [
  'mcpAdapterCore.ts',
  'mcpAdapter.ts',
  'providerRoutingCore.ts',
  'providerRouting.ts',
];

function readSr(file: string): string {
  return fs.readFileSync(path.join(SR_DIR, file), 'utf8');
}

/**
 * Strip comments + string literals so an executable-code scan is clean. A
 * char-scanner — NOT a naive regex — so a nested template literal in
 * `mcpAdapter.ts` (`` `a-${fn(`b`)}` ``) cannot make a regex consume a runaway
 * span and silently drop real code. `${...}` interpolations are code, so they
 * are KEPT; only the literal text of a string / template is blanked. Copied
 * from `semanticAnthropicSourceScan.test.ts` — the established per-suite
 * convention (each source-scan suite carries its own copy).
 */
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

/** Recursively collect every `.ts` / `.tsx` file under a directory. */
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

describe('MCP-018 source scan — the MCP URL is read in exactly one file', () => {
  it('Deno.env.get("SEMANTIC_REFEREE_MCP_URL") appears in exactly mcpAdapter.ts', () => {
    const filesWithRead: string[] = [];
    for (const file of SR_TREE_FILES) {
      if (/Deno\.env\.get\(\s*['"]SEMANTIC_REFEREE_MCP_URL['"]\s*\)/.test(readSr(file))) {
        filesWithRead.push(file);
      }
    }
    expect(filesWithRead).toEqual(['mcpAdapter.ts']);
  });

  it('mcpAdapter.ts reads SEMANTIC_REFEREE_MCP_URL via Deno.env.get', () => {
    expect(
      /Deno\.env\.get\(\s*['"]SEMANTIC_REFEREE_MCP_URL['"]\s*\)/.test(readSr('mcpAdapter.ts')),
    ).toBe(true);
  });
});

describe('MCP-018 source scan — the MCP token is read in exactly one file', () => {
  it('Deno.env.get("SEMANTIC_REFEREE_MCP_TOKEN") appears in exactly mcpAdapter.ts', () => {
    const filesWithRead: string[] = [];
    for (const file of SR_TREE_FILES) {
      if (/Deno\.env\.get\(\s*['"]SEMANTIC_REFEREE_MCP_TOKEN['"]\s*\)/.test(readSr(file))) {
        filesWithRead.push(file);
      }
    }
    expect(filesWithRead).toEqual(['mcpAdapter.ts']);
  });

  it('mcpAdapter.ts reads SEMANTIC_REFEREE_MCP_TOKEN via Deno.env.get', () => {
    expect(
      /Deno\.env\.get\(\s*['"]SEMANTIC_REFEREE_MCP_TOKEN['"]\s*\)/.test(readSr('mcpAdapter.ts')),
    ).toBe(true);
  });

  it('no other semantic-referee file references the MCP token in executable code', () => {
    // A docblock mention elsewhere is allowed; the comment-stripped scan proves
    // no other file READS the token.
    for (const file of SR_TREE_FILES) {
      if (file === 'mcpAdapter.ts') continue;
      const code = stripCommentsAndStrings(readSr(file));
      expect(code.includes('SEMANTIC_REFEREE_MCP_TOKEN')).toBe(false);
    }
  });
});

describe('MCP-018 source scan — the MCP secrets appear nowhere in src/ or app/', () => {
  it('SEMANTIC_REFEREE_MCP_TOKEN appears in no src/ file (code or comment)', () => {
    const offenders = collectSourceFiles(path.join(REPO, 'src')).filter((f) =>
      fs.readFileSync(f, 'utf8').includes('SEMANTIC_REFEREE_MCP_TOKEN'),
    );
    expect(offenders).toEqual([]);
  });

  it('SEMANTIC_REFEREE_MCP_TOKEN appears in no app/ file (code or comment)', () => {
    const offenders = collectSourceFiles(path.join(REPO, 'app')).filter((f) =>
      fs.readFileSync(f, 'utf8').includes('SEMANTIC_REFEREE_MCP_TOKEN'),
    );
    expect(offenders).toEqual([]);
  });

  it('SEMANTIC_REFEREE_MCP_URL appears in no src/ or app/ file (code or comment)', () => {
    const all = [
      ...collectSourceFiles(path.join(REPO, 'src')),
      ...collectSourceFiles(path.join(REPO, 'app')),
    ];
    const offenders = all.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('SEMANTIC_REFEREE_MCP_URL'),
    );
    expect(offenders).toEqual([]);
  });
});

describe('MCP-018 source scan — the token / URL / headers are never logged', () => {
  it('mcpAdapter.ts never console.logs the token, URL, Authorization, or Bearer value', () => {
    const src = readSr('mcpAdapter.ts');
    expect(/console\.\w+\([^)]*[Aa]uthorization/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*Bearer/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*mcpToken/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*mcpUrl/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*SEMANTIC_REFEREE_MCP_TOKEN/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*SEMANTIC_REFEREE_MCP_URL/.test(src)).toBe(false);
  });

  it('mcpAdapter.ts contains no console.log call (executable code)', () => {
    const code = stripCommentsAndStrings(readSr('mcpAdapter.ts'));
    expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
  });

  it('mcpAdapter.ts never logs or returns a raw response body', () => {
    const code = stripCommentsAndStrings(readSr('mcpAdapter.ts'));
    expect(/console\.\w+\([^)]*responseJson/.test(code)).toBe(false);
    expect(/console\.\w+\([^)]*rawResponse/.test(code)).toBe(false);
  });
});

describe('MCP-018 source scan — both validation walls are wired', () => {
  it('mcpAdapter.ts imports schema.ts (the structural wall)', () => {
    const src = readSr('mcpAdapter.ts');
    expect(/from\s+['"]\.\/schema\.ts['"]/.test(src)).toBe(true);
    expect(src).toContain('SemanticRefereePacketSchema');
  });

  it('mcpAdapter.ts imports contentSafetyScan.ts (the content wall)', () => {
    const src = readSr('mcpAdapter.ts');
    expect(/from\s+['"]\.\/contentSafetyScan\.ts['"]/.test(src)).toBe(true);
    expect(src).toContain('scanPacketContent');
  });

  it('mcpAdapter.ts hard-pins authoritative to false and hard-sets provider to mcp', () => {
    const code = stripCommentsAndStrings(readSr('mcpAdapter.ts'));
    expect(/authoritative\s*:\s*false/.test(code)).toBe(true);
    expect(/authoritative\s*:\s*true/.test(code)).toBe(false);
    // `provider: 'mcp'` is a string literal — scan the raw source for it.
    expect(/provider\s*:\s*['"]mcp['"]/.test(readSr('mcpAdapter.ts'))).toBe(true);
  });
});

describe('MCP-018 source scan — no contiguous secret-shaped literal in any new file', () => {
  for (const file of ['mcpAdapterCore.ts', 'mcpAdapter.ts']) {
    it(`${file} carries no sk-ant / xai- / sb_secret / Bearer-token / JWT literal`, () => {
      const src = readSr(file);
      // Assemble the patterns from fragments so this test file itself carries
      // no contiguous banned literal.
      expect(new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{8}').test(src)).toBe(false);
      expect(new RegExp('xai' + '-' + '[A-Za-z0-9]{12}').test(src)).toBe(false);
      expect(new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{8}').test(src)).toBe(false);
      expect(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(src)).toBe(false);
      expect(/\bBearer\s+[A-Za-z0-9._-]{16,}/.test(src)).toBe(false);
    });
  }

  it('mcpAdapter.ts assembles the auth-scheme prefix from a fragment (no contiguous literal in code)', () => {
    const src = readSr('mcpAdapter.ts');
    // Executable code must carry NO contiguous quoted scheme literal — the scan
    // strips comments first (a docblock may reference the scheme by name).
    const code = stripCommentsAndStrings(src);
    expect(/['"]Bearer ['"]/.test(code)).toBe(false);
    // The runtime value is built from two fragments concatenated.
    expect(/['"]Bea['"]\s*\+\s*['"]rer ['"]/.test(src)).toBe(true);
  });
});
