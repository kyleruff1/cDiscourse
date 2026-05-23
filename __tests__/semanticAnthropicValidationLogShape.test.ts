/**
 * SMOKE-FIX-001 §5.4 — anthropicProvider.ts validation_failed log shape source scan.
 *
 * `anthropicProvider.ts` imports `schema.ts` (→ `npm:zod@4`) so Jest cannot load it.
 * This suite is a SOURCE-SCAN — it reads the provider as text and asserts the two
 * `console.warn(JSON.stringify(...))` calls inserted by SMOKE-FIX-001 are present,
 * well-shaped, and never reference forbidden identifiers or substrings.
 *
 * The forbidden-substring list — `ANTHROPIC_API_KEY`, `Authorization`, `Bearer`, the
 * `sk-ant-` / `xai-` / `sb_secret_` key prefixes — is assembled from fragments at
 * runtime so the test file itself carries no contiguous banned literal.
 *
 * Mirrors the posture of __tests__/semanticAnthropicSourceScan.test.ts and is the
 * companion to __tests__/semanticAnthropicContentScanParity.test.ts.
 */
import * as fs from 'fs';
import * as path from 'path';

const PROVIDER_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/semanticReferee/anthropicProvider.ts',
);

/**
 * Extract the bodies of the two `console.warn(JSON.stringify({ ... }))` call sites
 * in the provider source. Returns the raw substrings between `JSON.stringify(` and
 * the matching closing `)` of each warn call — a brace-balanced scan, NOT a naive
 * regex.
 */
function extractConsoleWarnJsonStringifyBodies(src: string): string[] {
  const bodies: string[] = [];
  const marker = 'console.warn(JSON.stringify(';
  let cursor = 0;
  while (true) {
    const start = src.indexOf(marker, cursor);
    if (start < 0) break;
    let i = start + marker.length;
    // Scan to the matching ')' for JSON.stringify(...). Depth-track {} [] ()
    // ignoring chars inside string literals.
    let depth = 1;
    let inString: false | "'" | '"' | '`' = false;
    let escape = false;
    const argStart = i;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (escape) {
        escape = false;
        i += 1;
        continue;
      }
      if (inString) {
        if (c === '\\') {
          escape = true;
          i += 1;
          continue;
        }
        if (c === inString) inString = false;
        i += 1;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        inString = c;
        i += 1;
        continue;
      }
      if (c === '(' || c === '{' || c === '[') depth += 1;
      else if (c === ')' || c === '}' || c === ']') depth -= 1;
      if (depth === 0) break;
      i += 1;
    }
    if (depth === 0) {
      bodies.push(src.slice(argStart, i));
      cursor = i + 1;
    } else {
      // Malformed scan — bail out to avoid infinite loop.
      break;
    }
  }
  return bodies;
}

describe('SMOKE-FIX-001 — anthropicProvider validation_failed log shape', () => {
  const providerSrc = fs.readFileSync(PROVIDER_PATH, 'utf8');
  const bodies = extractConsoleWarnJsonStringifyBodies(providerSrc);

  it('has exactly two console.warn(JSON.stringify(...)) call sites', () => {
    expect(bodies).toHaveLength(2);
  });

  it('one call site is the schema-failure log (layer: "schema", path key present)', () => {
    const schemaSite = bodies.find((b) => /layer:\s*'schema'/.test(b));
    expect(schemaSite).toBeDefined();
    expect(schemaSite!).toMatch(/semanticReferee:\s*'validation_failed'/);
    expect(schemaSite!).toMatch(/\bpath:/);
    expect(schemaSite!).toMatch(/inputHash:/);
    // Schema site does NOT carry the content-scan `detail` key.
    expect(schemaSite!).not.toMatch(/\bdetail:/);
  });

  it('one call site is the content-scan-failure log (layer: "content_scan", detail key present)', () => {
    const contentSite = bodies.find((b) => /layer:\s*'content_scan'/.test(b));
    expect(contentSite).toBeDefined();
    expect(contentSite!).toMatch(/semanticReferee:\s*'validation_failed'/);
    expect(contentSite!).toMatch(/\bdetail:/);
    expect(contentSite!).toMatch(/inputHash:/);
    // Content-scan site does NOT carry the schema `path` key.
    expect(contentSite!).not.toMatch(/\bpath:/);
  });

  it('each call site carries ONLY the allowed keys (semanticReferee, layer, path|detail, inputHash)', () => {
    const ALLOWED = new Set([
      'semanticReferee',
      'layer',
      'path',
      'detail',
      'inputHash',
    ]);
    for (const body of bodies) {
      // Extract every top-level key from the JSON-stringify-arg object literal.
      // A key is a bare identifier followed by `:` at depth 1 inside the outer
      // `{...}` — found via a depth-tracking scan.
      const keys = extractObjectLiteralTopLevelKeys(body);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(ALLOWED.has(key)).toBe(true);
      }
    }
  });

  it('no call site interpolates stamped (except stamped.inputHash)', () => {
    for (const body of bodies) {
      // Any occurrence of `stamped.` MUST be `stamped.inputHash`. No other
      // property is allowed (no stamped.body / .binaries / .roomId / etc.).
      const stampedRefs = Array.from(body.matchAll(/stamped\.([A-Za-z0-9_]+)/g));
      for (const m of stampedRefs) {
        expect(m[1]).toBe('inputHash');
      }
    }
  });

  it('no call site references responseJson, contentText, parsed, apiKey, requestBody, or request.* ids', () => {
    const FORBIDDEN_IDENTIFIERS = [
      'responseJson',
      'rawResponse',
      'contentText',
      'parsed',
      'apiKey',
      'requestBody',
      'request.roomId',
      'request.moveId',
      'request.parentId',
    ];
    for (const body of bodies) {
      for (const ident of FORBIDDEN_IDENTIFIERS) {
        expect(body).not.toContain(ident);
      }
    }
  });

  it('no call site references the schema issue VALUE (only path) or content offending VALUE', () => {
    for (const body of bodies) {
      // The first issue's .message / .input / .received / .expected are values
      // a model could echo — they must not be logged.
      expect(body).not.toMatch(/\.message\b/);
      expect(body).not.toMatch(/\.input\b/);
      expect(body).not.toMatch(/\.received\b/);
      expect(body).not.toMatch(/\.expected\b/);
      // The full issues array also stays out.
      expect(body).not.toMatch(/\.issues\b(?!\[0\]\?\.path)/);
    }
  });

  it('no call site contains the forbidden substrings (API key / Authorization / Bearer / key prefixes)', () => {
    // Assemble forbidden substrings from fragments so the test source itself
    // does not commit a key-shaped literal.
    const FORBIDDEN_SUBSTRINGS = [
      'ANTHROPIC' + '_API_KEY',
      'Authorization',
      'Bearer',
      'sk-' + 'ant-',
      'xai' + '-',
      'sb_' + 'secret_',
    ];
    for (const body of bodies) {
      const lower = body.toLowerCase();
      for (const sub of FORBIDDEN_SUBSTRINGS) {
        expect(lower).not.toContain(sub.toLowerCase());
      }
    }
  });

  it('both call sites are immediately followed (within 5 lines) by a `return { kind: "unavailable", reason: "validation_failed" }`', () => {
    // For each warn site, find the file offset and assert a validation_failed
    // return appears in the next 5 lines.
    let cursor = 0;
    let hits = 0;
    while (true) {
      const idx = providerSrc.indexOf('console.warn(JSON.stringify(', cursor);
      if (idx < 0) break;
      const tail = providerSrc.slice(idx);
      const lines = tail.split('\n').slice(0, 12).join('\n');
      expect(lines).toMatch(
        /return\s*\{\s*kind:\s*'unavailable',\s*reason:\s*'validation_failed'\s*\}/,
      );
      hits += 1;
      cursor = idx + 1;
    }
    expect(hits).toBe(2);
  });
});

/**
 * Extract bare-identifier top-level keys from an object-literal source body
 * (e.g. the inside of `{ semanticReferee: '...', layer: '...', path: x }`).
 * A "top-level key" is an identifier immediately followed by `:` at depth 1
 * relative to the outermost `{...}` in the body. Skips string literals so a
 * key inside a value-string is not counted.
 */
function extractObjectLiteralTopLevelKeys(body: string): string[] {
  const keys: string[] = [];
  // Find the outermost { ... }.
  const start = body.indexOf('{');
  if (start < 0) return keys;
  let depth = 0;
  let inString: false | "'" | '"' | '`' = false;
  let escape = false;
  let i = start;
  // Walk forward and pick up identifiers at depth 1 followed by `:`.
  for (; i < body.length; i += 1) {
    const c = body[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inString) inString = false;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = c;
      continue;
    }
    if (c === '{' || c === '[' || c === '(') {
      depth += 1;
      continue;
    }
    if (c === '}' || c === ']' || c === ')') {
      depth -= 1;
      if (depth === 0) break;
      continue;
    }
    if (depth === 1 && /[A-Za-z_]/.test(c)) {
      // Read identifier.
      let j = i;
      while (j < body.length && /[A-Za-z0-9_]/.test(body[j])) j += 1;
      // Skip whitespace.
      let k = j;
      while (k < body.length && /\s/.test(body[k])) k += 1;
      if (body[k] === ':') {
        keys.push(body.slice(i, j));
      }
      i = j - 1;
    }
  }
  return keys;
}
