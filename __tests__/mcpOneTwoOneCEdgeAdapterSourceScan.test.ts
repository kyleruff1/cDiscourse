/**
 * MCP-021C-EDGE — Boolean Observation MCP adapter source scan.
 *
 * `booleanObservationMcpAdapter.ts` reads `Deno.env.get` + calls `fetch`,
 * so Jest cannot load it. This suite is its coverage wall — a
 * source-text scan that proves the doctrine-critical secret + single-file
 * + no-log invariants, exactly the standard the MCP-018 sibling is held
 * to via `semanticMcpSourceScan.test.ts`.
 *
 * Hard rules a reviewer blocks on:
 *   - `Deno.env.get('SEMANTIC_REFEREE_MCP_URL')` and
 *     `Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN')` each appear in
 *     EXACTLY ONE file in the booleanObservations tree:
 *     `booleanObservationMcpAdapter.ts`.
 *   - The token / URL / Authorization header / Bearer value / raw
 *     response body is never console-logged.
 *   - `booleanObservationMcpAdapter.ts` imports both validation surfaces
 *     (the parser + adapter core).
 *   - No contiguous secret-shaped literal in any new file.
 *   - The token is sent ONLY over TLS (https guard).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const BO_DIR = path.join(REPO, 'supabase/functions/_shared/booleanObservations');

const BO_TREE_FILES = [
  'booleanObservationMcpAdapterCore.ts',
  'booleanObservationMcpAdapter.ts',
  'booleanObservationRequestBuilder.ts',
  'familyRegistry.ts',
  'persistenceWriter.ts',
  'runModeConstants.ts',
  'mcpBooleanObservationSchema.ts',
  'machineObservationDefinitions.ts',
  'machineObservationRegistry.ts',
  'nodeLabelTypes.ts',
  // OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 1): the new pure
  // sub-reason module is in the fenced tree — SCAN-17 must cover it for
  // the no-secret-literal guarantee.
  'booleanObservationFailureSubreason.ts',
];

function readBo(file: string): string {
  return fs.readFileSync(path.join(BO_DIR, file), 'utf8');
}

/**
 * Strip comments + string literals so an executable-code scan is clean.
 * Copied from semanticMcpSourceScan.test.ts (same convention).
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

describe('MCP-021C-EDGE source scan — Deno.env reads happen in exactly one file', () => {
  it('SCAN-1 — Deno.env.get("SEMANTIC_REFEREE_MCP_URL") appears in exactly booleanObservationMcpAdapter.ts', () => {
    const filesWithRead: string[] = [];
    for (const file of BO_TREE_FILES) {
      if (/Deno\.env\.get\(\s*['"]SEMANTIC_REFEREE_MCP_URL['"]\s*\)/.test(readBo(file))) {
        filesWithRead.push(file);
      }
    }
    expect(filesWithRead).toEqual(['booleanObservationMcpAdapter.ts']);
  });

  it('SCAN-2 — Deno.env.get("SEMANTIC_REFEREE_MCP_TOKEN") appears in exactly booleanObservationMcpAdapter.ts', () => {
    const filesWithRead: string[] = [];
    for (const file of BO_TREE_FILES) {
      if (/Deno\.env\.get\(\s*['"]SEMANTIC_REFEREE_MCP_TOKEN['"]\s*\)/.test(readBo(file))) {
        filesWithRead.push(file);
      }
    }
    expect(filesWithRead).toEqual(['booleanObservationMcpAdapter.ts']);
  });

  it('SCAN-3 — booleanObservationMcpAdapter.ts reads both env vars', () => {
    const src = readBo('booleanObservationMcpAdapter.ts');
    expect(
      /Deno\.env\.get\(\s*['"]SEMANTIC_REFEREE_MCP_URL['"]\s*\)/.test(src),
    ).toBe(true);
    expect(
      /Deno\.env\.get\(\s*['"]SEMANTIC_REFEREE_MCP_TOKEN['"]\s*\)/.test(src),
    ).toBe(true);
  });

  it('SCAN-4 — no other booleanObservations file references the MCP token in executable code', () => {
    for (const file of BO_TREE_FILES) {
      if (file === 'booleanObservationMcpAdapter.ts') continue;
      const code = stripCommentsAndStrings(readBo(file));
      expect(code.includes('SEMANTIC_REFEREE_MCP_TOKEN')).toBe(false);
    }
  });
});

describe('MCP-021C-EDGE source scan — secrets appear nowhere in src/ or app/', () => {
  it('SCAN-5 — SEMANTIC_REFEREE_MCP_TOKEN appears in no src/ file (code or comment)', () => {
    const offenders = collectSourceFiles(path.join(REPO, 'src')).filter((f) =>
      fs.readFileSync(f, 'utf8').includes('SEMANTIC_REFEREE_MCP_TOKEN'),
    );
    expect(offenders).toEqual([]);
  });

  it('SCAN-6 — SEMANTIC_REFEREE_MCP_TOKEN appears in no app/ file (code or comment)', () => {
    const offenders = collectSourceFiles(path.join(REPO, 'app')).filter((f) =>
      fs.readFileSync(f, 'utf8').includes('SEMANTIC_REFEREE_MCP_TOKEN'),
    );
    expect(offenders).toEqual([]);
  });

  it('SCAN-7 — SEMANTIC_REFEREE_MCP_URL appears in no src/ or app/ file (code or comment)', () => {
    const all = [
      ...collectSourceFiles(path.join(REPO, 'src')),
      ...collectSourceFiles(path.join(REPO, 'app')),
    ];
    const offenders = all.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('SEMANTIC_REFEREE_MCP_URL'),
    );
    expect(offenders).toEqual([]);
  });

  it('SCAN-8 — MCP_URL / MCP_TOKEN / EXPO_PUBLIC_*MCP appear nowhere in src/ or app/', () => {
    const all = [
      ...collectSourceFiles(path.join(REPO, 'src')),
      ...collectSourceFiles(path.join(REPO, 'app')),
    ];
    // Build the EXPO_PUBLIC regex from fragments so this test file itself
    // doesn't carry the contiguous banned token.
    const expoPublicMcp = new RegExp('EXPO_PUBLIC_' + '.*MCP');
    for (const file of all) {
      const content = fs.readFileSync(file, 'utf8');
      expect(expoPublicMcp.test(content)).toBe(false);
    }
  });
});

describe('MCP-021C-EDGE source scan — no log of token, URL, headers, or response body', () => {
  it('SCAN-9 — booleanObservationMcpAdapter.ts never console.logs the token, URL, Authorization, or Bearer value', () => {
    const src = readBo('booleanObservationMcpAdapter.ts');
    expect(/console\.\w+\([^)]*[Aa]uthorization/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*Bearer/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*mcpToken/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*mcpUrl/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*SEMANTIC_REFEREE_MCP_TOKEN/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*SEMANTIC_REFEREE_MCP_URL/.test(src)).toBe(false);
  });

  it('SCAN-10 — booleanObservationMcpAdapter.ts contains no console.log call in executable code', () => {
    const code = stripCommentsAndStrings(readBo('booleanObservationMcpAdapter.ts'));
    expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
  });

  it('SCAN-11 — booleanObservationMcpAdapter.ts never logs or returns a raw response body', () => {
    const code = stripCommentsAndStrings(readBo('booleanObservationMcpAdapter.ts'));
    expect(/console\.\w+\([^)]*responseJson/.test(code)).toBe(false);
    expect(/console\.\w+\([^)]*rawResponse/.test(code)).toBe(false);
  });

  it('SCAN-12 — booleanObservationMcpAdapterCore.ts has no console.log in executable code', () => {
    const code = stripCommentsAndStrings(readBo('booleanObservationMcpAdapterCore.ts'));
    expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
  });
});

describe('MCP-021C-EDGE source scan — validation surfaces are wired', () => {
  it('SCAN-13 — booleanObservationMcpAdapter.ts imports mcpBooleanObservationSchema.ts (the parser)', () => {
    const src = readBo('booleanObservationMcpAdapter.ts');
    expect(/from\s+['"]\.\/mcpBooleanObservationSchema\.ts['"]/.test(src)).toBe(true);
    expect(src).toContain('parseMcpBooleanObservationResponse');
  });

  it('SCAN-14 — booleanObservationMcpAdapter.ts imports adapter-core helpers', () => {
    const src = readBo('booleanObservationMcpAdapter.ts');
    expect(/from\s+['"]\.\/booleanObservationMcpAdapterCore\.ts['"]/.test(src)).toBe(true);
    expect(src).toContain('buildBooleanObservationToolRequestBody');
    expect(src).toContain('extractBooleanObservationResponse');
    expect(src).toContain('sanitizeBooleanObservationRawPayload');
  });

  it('SCAN-15 — booleanObservationMcpAdapter.ts enforces https only', () => {
    const src = readBo('booleanObservationMcpAdapter.ts');
    expect(src).toContain('isHttpsUrl');
    // The function should guard at runtime
    expect(/isHttpsUrl\s*\(/.test(src)).toBe(true);
  });

  it('SCAN-16 — booleanObservationMcpAdapter.ts uses AbortSignal.timeout', () => {
    const src = readBo('booleanObservationMcpAdapter.ts');
    expect(/AbortSignal\.timeout\(/.test(src)).toBe(true);
  });
});

describe('MCP-021C-EDGE source scan — no contiguous secret-shaped literal', () => {
  for (const file of BO_TREE_FILES) {
    it(`SCAN-17:${file} — carries no sk-ant / xai- / sb_secret / Bearer-token / JWT literal`, () => {
      const src = readBo(file);
      // Assemble the patterns from fragments so this test file itself carries
      // no contiguous banned literal.
      expect(new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{8}').test(src)).toBe(false);
      expect(new RegExp('xai' + '-' + '[A-Za-z0-9]{12}').test(src)).toBe(false);
      expect(new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{8}').test(src)).toBe(false);
      expect(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(src)).toBe(false);
      expect(/\bBearer\s+[A-Za-z0-9._-]{16,}/.test(src)).toBe(false);
    });
  }

  it('SCAN-18 — booleanObservationMcpAdapter.ts assembles auth-scheme prefix from fragments', () => {
    const src = readBo('booleanObservationMcpAdapter.ts');
    // Executable code must carry NO contiguous quoted scheme literal — the
    // scan strips comments first (a docblock may reference the scheme by
    // name).
    const code = stripCommentsAndStrings(src);
    expect(/['"]Bearer ['"]/.test(code)).toBe(false);
    // The runtime value is built from two fragments concatenated.
    expect(/['"]Bea['"]\s*\+\s*['"]rer ['"]/.test(src)).toBe(true);
  });
});

describe('MCP-021C-EDGE source scan — no client AI calls (cdiscourse-doctrine §7)', () => {
  it('SCAN-19 — no booleanObservationMcpAdapter import from src/ or app/', () => {
    const all = [
      ...collectSourceFiles(path.join(REPO, 'src')),
      ...collectSourceFiles(path.join(REPO, 'app')),
    ];
    for (const file of all) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content.includes('booleanObservationMcpAdapter')).toBe(false);
      expect(content.includes('booleanObservationMcpAdapterCore')).toBe(false);
      // OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 1): the new pure
      // sub-reason module stays inside the Edge fence — no client import.
      expect(content.includes('booleanObservationFailureSubreason')).toBe(false);
    }
  });

  it('SCAN-20 — no booleanObservations import from src/ or app/ (entire tree fenced)', () => {
    const all = [
      ...collectSourceFiles(path.join(REPO, 'src')),
      ...collectSourceFiles(path.join(REPO, 'app')),
    ];
    for (const file of all) {
      const content = fs.readFileSync(file, 'utf8');
      expect(
        /from\s+['"][^'"]*supabase\/functions\/_shared\/booleanObservations/.test(content),
      ).toBe(false);
    }
  });
});

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — adapter threads the typed sub-reason (Phase 1)', () => {
  it('SCAN-21 — adapter imports mapToFailureSubreason + buildFailureDetail from the new module', () => {
    const src = readBo('booleanObservationMcpAdapter.ts');
    expect(/from\s+['"]\.\/booleanObservationFailureSubreason\.ts['"]/.test(src)).toBe(true);
    expect(src).toContain('mapToFailureSubreason');
    expect(src).toContain('buildFailureDetail');
  });

  it('SCAN-22 — adapter still carries reason:\'validation_failed\' at the collapse sites (HALT-9)', () => {
    const src = readBo('booleanObservationMcpAdapter.ts');
    const occurrences = (src.match(/reason:\s*'validation_failed'/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('SCAN-23 — adapter NEVER reads parsed.details in executable code (re-derive decision)', () => {
    const code = stripCommentsAndStrings(readBo('booleanObservationMcpAdapter.ts'));
    expect(code.includes('parsed.details')).toBe(false);
    expect(code.includes('.details')).toBe(false);
  });

  it('SCAN-24 — the new sub-reason module has no console.log in executable code', () => {
    const code = stripCommentsAndStrings(readBo('booleanObservationFailureSubreason.ts'));
    expect(/\bconsole\.\w+\s*\(/.test(code)).toBe(false);
  });

  it('SCAN-25 — the new sub-reason module reads no Deno.env / fetch (pure)', () => {
    const code = stripCommentsAndStrings(readBo('booleanObservationFailureSubreason.ts'));
    expect(/Deno\.env/.test(code)).toBe(false);
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
  });
});
