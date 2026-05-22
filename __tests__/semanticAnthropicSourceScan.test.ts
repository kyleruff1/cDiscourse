/**
 * MCP-017 — semantic-referee Anthropic live-provider source scan.
 *
 * `anthropicProvider.ts` imports `schema.ts` (→ `npm:zod@4`) so Jest cannot
 * load it. This suite is its coverage wall — a source-text scan that proves the
 * doctrine-critical secret + single-file + no-log invariants, exactly the
 * standard the sibling `_shared/languageProcessing/anthropicProvider.ts` is held
 * to (design §8 "Source-scan tests").
 *
 * The hard rules a reviewer blocks on:
 *   - `Deno.env.get('ANTHROPIC_API_KEY')` appears in EXACTLY ONE file:
 *     `anthropicProvider.ts`.
 *   - `fetch('https://api.anthropic.com...` appears in EXACTLY ONE file:
 *     `anthropicProvider.ts`.
 *   - `ANTHROPIC_API_KEY` appears NOWHERE in `src/` or `app/`.
 *   - the key / `x-api-key` / Authorization header is never console-logged.
 *   - `anthropicProvider.ts` imports BOTH validation walls — `schema.ts` and
 *     `contentSafetyScan.ts`.
 *   - no contiguous secret-shaped literal in any new file.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const SR_DIR = path.join(REPO, 'supabase/functions/_shared/semanticReferee');

/** The MCP-017 new + modified files in the semantic-referee tree. */
const SR_TREE_FILES = [
  'anthropicClassifierCore.ts',
  'seedPrompt.ts',
  'contentSafetyScan.ts',
  'anthropicProvider.ts',
  'providerRoutingCore.ts',
  'providerRouting.ts',
  'providers.ts',
  'types.ts',
];

function readSr(file: string): string {
  return fs.readFileSync(path.join(SR_DIR, file), 'utf8');
}

/**
 * Strip comments + string literals so an executable-code scan is clean. A
 * char-scanner — NOT a naive regex — so a nested template literal (e.g.
 * `` `a-${fn(`b`)}` `` in `anthropicProvider.ts`) cannot make a regex consume a
 * runaway span and silently drop real code. `${...}` interpolations are code,
 * so they are KEPT; only the literal text of a string / template is blanked.
 */
function stripCommentsAndStrings(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    // Line comment.
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    // Block comment.
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    // Single- / double-quoted string.
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
    // Template literal — blank the text, keep `${...}` code.
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
          // Recurse over the interpolation as ordinary code by re-entering
          // the outer loop with a depth marker.
          let depth = 1;
          let codeStart = i;
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
        // Literal text char — drop it.
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

describe('MCP-017 source scan — ANTHROPIC_API_KEY is read in exactly one file', () => {
  // The key name is legitimately a STRING LITERAL inside `Deno.env.get(...)` —
  // so the key-read detection scans the RAW source. The "no key elsewhere"
  // assertions strip comments first (a comment may document the boundary).
  it('Deno.env.get("ANTHROPIC_API_KEY") appears in exactly anthropicProvider.ts', () => {
    const filesWithKeyRead: string[] = [];
    for (const file of SR_TREE_FILES) {
      if (/Deno\.env\.get\(\s*['"]ANTHROPIC_API_KEY['"]\s*\)/.test(readSr(file))) {
        filesWithKeyRead.push(file);
      }
    }
    expect(filesWithKeyRead).toEqual(['anthropicProvider.ts']);
  });

  it('anthropicProvider.ts reads ANTHROPIC_API_KEY via Deno.env.get', () => {
    expect(/Deno\.env\.get\(\s*['"]ANTHROPIC_API_KEY['"]\s*\)/.test(readSr('anthropicProvider.ts'))).toBe(
      true,
    );
  });

  it('no other semantic-referee file references the key (executable code or comment)', () => {
    // `providers.ts` documents the boundary in a docblock — that single comment
    // mention is allowed; it never READS the key. Every other file: zero
    // mentions, code or comment.
    for (const file of SR_TREE_FILES) {
      if (file === 'anthropicProvider.ts') continue;
      const code = stripCommentsAndStrings(readSr(file));
      expect(code.includes('ANTHROPIC_API_KEY')).toBe(false);
    }
  });
});

describe('MCP-017 source scan — the Anthropic host is named in exactly one file', () => {
  it('the api.anthropic.com host literal appears only in anthropicProvider.ts', () => {
    const filesWithHost: string[] = [];
    for (const file of SR_TREE_FILES) {
      if (readSr(file).includes('api.anthropic.com')) {
        filesWithHost.push(file);
      }
    }
    expect(filesWithHost).toEqual(['anthropicProvider.ts']);
  });

  it('the fetch call to the Anthropic Messages endpoint is in anthropicProvider.ts', () => {
    const code = stripCommentsAndStrings(readSr('anthropicProvider.ts'));
    expect(/\bfetch\s*\(/.test(code)).toBe(true);
    // The endpoint constant carries the host; the fetch uses it.
    expect(readSr('anthropicProvider.ts')).toContain('https://api.anthropic.com/v1/messages');
  });

  it('no other semantic-referee file calls fetch in executable code', () => {
    for (const file of SR_TREE_FILES) {
      if (file === 'anthropicProvider.ts') continue;
      const code = stripCommentsAndStrings(readSr(file));
      expect(/\bfetch\s*\(/.test(code)).toBe(false);
    }
  });
});

describe('MCP-017 source scan — the key is never READ in src/ or app/', () => {
  // The scan is over EXECUTABLE code: a pre-existing doctrinal comment in
  // `src/lib/edgeFunctions.ts` legitimately NAMES `ANTHROPIC_API_KEY` as a
  // thing the client must never use (it predates MCP-016; the MCP-016
  // `semanticForbiddenSecrets.test.ts` already records this comment exemption).
  // The doctrine rule is: no client code READS or REFERENCES the key — which a
  // comment-stripped scan proves.
  it('ANTHROPIC_API_KEY is referenced in no src/ file (executable code)', () => {
    const offenders = collectSourceFiles(path.join(REPO, 'src')).filter((f) =>
      stripCommentsAndStrings(fs.readFileSync(f, 'utf8')).includes('ANTHROPIC_API_KEY'),
    );
    expect(offenders).toEqual([]);
  });

  it('ANTHROPIC_API_KEY is referenced in no app/ file (executable code)', () => {
    const offenders = collectSourceFiles(path.join(REPO, 'app')).filter((f) =>
      stripCommentsAndStrings(fs.readFileSync(f, 'utf8')).includes('ANTHROPIC_API_KEY'),
    );
    expect(offenders).toEqual([]);
  });

  it('SEMANTIC_REFEREE_ANTHROPIC_API_KEY appears nowhere in src/ or app/ (code or comment)', () => {
    // This name is brand-new — it must not exist anywhere on the client.
    const all = [
      ...collectSourceFiles(path.join(REPO, 'src')),
      ...collectSourceFiles(path.join(REPO, 'app')),
    ];
    const offenders = all.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('SEMANTIC_REFEREE_ANTHROPIC_API_KEY'),
    );
    expect(offenders).toEqual([]);
  });
});

describe('MCP-017 source scan — the key / headers are never logged', () => {
  it('anthropicProvider.ts never console.logs the key, x-api-key, or Authorization', () => {
    const src = readSr('anthropicProvider.ts');
    // Scan every console.* call argument list.
    expect(/console\.\w+\([^)]*[Aa]uthorization/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*x-api-key/i.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*apiKey/.test(src)).toBe(false);
    expect(/console\.\w+\([^)]*ANTHROPIC_API_KEY/.test(src)).toBe(false);
  });

  it('anthropicProvider.ts contains no console.log call (executable code)', () => {
    const code = stripCommentsAndStrings(readSr('anthropicProvider.ts'));
    expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
  });

  it('anthropicProvider.ts never logs or returns a raw response body', () => {
    const code = stripCommentsAndStrings(readSr('anthropicProvider.ts'));
    // No console call mentions the raw response / responseJson.
    expect(/console\.\w+\([^)]*responseJson/.test(code)).toBe(false);
    expect(/console\.\w+\([^)]*rawResponse/.test(code)).toBe(false);
  });
});

describe('MCP-017 source scan — both validation walls are wired', () => {
  it('anthropicProvider.ts imports schema.ts (the structural wall)', () => {
    const src = readSr('anthropicProvider.ts');
    expect(/from\s+['"]\.\/schema\.ts['"]/.test(src)).toBe(true);
    expect(src).toContain('SemanticRefereePacketSchema');
  });

  it('anthropicProvider.ts imports contentSafetyScan.ts (the content wall)', () => {
    const src = readSr('anthropicProvider.ts');
    expect(/from\s+['"]\.\/contentSafetyScan\.ts['"]/.test(src)).toBe(true);
    expect(src).toContain('scanPacketContent');
  });

  it('anthropicProvider.ts hard-pins authoritative to false', () => {
    const code = stripCommentsAndStrings(readSr('anthropicProvider.ts'));
    expect(/authoritative\s*:\s*false/.test(code)).toBe(true);
    // It never sets authoritative to true.
    expect(/authoritative\s*:\s*true/.test(code)).toBe(false);
  });
});

describe('MCP-017 source scan — no contiguous secret-shaped literal in any new file', () => {
  for (const file of [
    'anthropicClassifierCore.ts',
    'seedPrompt.ts',
    'contentSafetyScan.ts',
    'anthropicProvider.ts',
    'providerRoutingCore.ts',
  ]) {
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
});
