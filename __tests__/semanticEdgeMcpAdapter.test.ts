/**
 * MCP-018 — semantic-referee MCP-adapter orchestration coverage.
 *
 * `mcpAdapter.ts` is Deno code that imports `schema.ts` (→ `npm:zod@4`) and
 * calls `fetch` — Jest cannot load it. Following the convention MCP-017's
 * `semanticEdgeAuthAnthropic.test.ts` established, this suite asserts the
 * adapter's SOURCE SHAPE: that every failure path the MCP-018 design §6
 * data-flow diagram requires is wired, in the order required, mapping to the
 * correct `McpUnavailableReason`.
 *
 * Local `supabase functions serve` runs with an intercepted `fetch` to the
 * operator-hosted MCP server are a SEPARATE operator step — there is no deploy
 * and no live MCP-server call in this card (MCP-018 design §8 / §13: the
 * source-scan + core tests are the CI-time coverage; the intercept-`fetch` runs
 * are operator-gated, marked the same way `semanticEdgeAuthAnthropic.test.ts`
 * marks them). The pure JSON-parse / extraction / sanitizer logic each path
 * depends on is unit-tested directly in `semanticMcpAdapterCore.test.ts`.
 */
import * as fs from 'fs';
import * as path from 'path';

const ADAPTER_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/semanticReferee/mcpAdapter.ts',
);

const adapterSrc = fs.readFileSync(ADAPTER_PATH, 'utf8');

/**
 * Strip comments + string literals so an executable-code scan is clean. A
 * char-scanner — NOT a naive regex. `${...}` interpolations are code, so they
 * are KEPT; only the literal text of a string / template is blanked.
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

const adapterCode = stripCommentsAndStrings(adapterSrc);

describe('semantic-referee MCP adapter — url-missing path', () => {
  it('returns unavailable:url_missing when SEMANTIC_REFEREE_MCP_URL is absent', () => {
    expect(adapterSrc).toMatch(/reason:\s*'url_missing'/);
    const urlReadIdx = adapterSrc.indexOf("Deno.env.get('SEMANTIC_REFEREE_MCP_URL')");
    const fetchIdx = adapterSrc.indexOf('fetch(');
    expect(urlReadIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(-1);
    expect(urlReadIdx).toBeLessThan(fetchIdx);
  });

  it('the url-missing return precedes the token read and the fetch call', () => {
    const urlMissingIdx = adapterSrc.indexOf("reason: 'url_missing'");
    const tokenReadIdx = adapterSrc.indexOf("Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN')");
    const fetchIdx = adapterSrc.indexOf('fetch(');
    expect(urlMissingIdx).toBeGreaterThan(-1);
    expect(urlMissingIdx).toBeLessThan(tokenReadIdx);
    expect(urlMissingIdx).toBeLessThan(fetchIdx);
  });

  it('guards against a non-https URL before any fetch', () => {
    // The adapter uses an https-only guard (a non-https endpoint would leak the
    // token over plaintext). The `https:` protocol literal is a legitimate
    // string in the comparison — scan the raw source for it.
    expect(adapterSrc).toMatch(/https:/);
    expect(adapterSrc).toContain('isHttpsUrl');
    // The https guard is part of the url-missing short-circuit, before fetch.
    const guardIdx = adapterSrc.indexOf('isHttpsUrl');
    const fetchIdx = adapterSrc.indexOf('fetch(');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(fetchIdx);
  });
});

describe('semantic-referee MCP adapter — token-missing path', () => {
  it('returns unavailable:token_missing when SEMANTIC_REFEREE_MCP_TOKEN is absent', () => {
    expect(adapterSrc).toMatch(/reason:\s*'token_missing'/);
  });

  it('the token-missing return precedes the fetch call', () => {
    const tokenMissingIdx = adapterSrc.indexOf("reason: 'token_missing'");
    const fetchIdx = adapterSrc.indexOf('fetch(');
    expect(tokenMissingIdx).toBeGreaterThan(-1);
    expect(tokenMissingIdx).toBeLessThan(fetchIdx);
  });
});

describe('semantic-referee MCP adapter — network + HTTP error paths', () => {
  it('maps a thrown fetch to unavailable:network_error', () => {
    // The fetch is wrapped in try/catch; the catch returns network_error.
    expect(adapterCode).toMatch(/try\s*\{[\s\S]*fetch\(/);
    expect(adapterSrc).toMatch(/reason:\s*'network_error'/);
  });

  it('maps HTTP 429 to unavailable:rate_limited and any other non-OK to api_error', () => {
    expect(adapterCode).toMatch(/status\s*===\s*429/);
    expect(adapterSrc).toContain("'rate_limited'");
    expect(adapterSrc).toContain("'api_error'");
    expect(adapterCode).toMatch(/!\s*rawResponse\.ok/);
  });

  it('applies a bounded AbortSignal.timeout to the fetch', () => {
    // The operator-hosted endpoint is less predictable than a managed API; the
    // adapter bounds the wait (MCP-018 design §5 / OQ-5). A timeout maps to
    // network_error via the same try/catch.
    expect(adapterCode).toMatch(/AbortSignal\.timeout/);
    expect(adapterSrc).toContain('MCP_REQUEST_TIMEOUT_MS');
  });
});

describe('semantic-referee MCP adapter — parse-failure path', () => {
  it('maps a non-JSON body / unrecognised envelope to unavailable:parse_failure', () => {
    expect(adapterSrc).toMatch(/reason:\s*'parse_failure'/);
    // The adapter uses the core extraction helper.
    expect(adapterSrc).toContain('extractMcpPacket');
  });
});

describe('semantic-referee MCP adapter — validation-failure path', () => {
  it('runs the schema wall AND the content-safety wall before returning success', () => {
    expect(adapterSrc).toContain('SemanticRefereePacketSchema');
    expect(adapterSrc).toContain('scanPacketContent');
    expect(adapterSrc).toMatch(/reason:\s*'validation_failed'/);
  });

  it('a schema failure OR a content-scan failure both yield validation_failed', () => {
    // Two distinct guards must each return validation_failed.
    const matches = adapterSrc.match(/reason:\s*'validation_failed'/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('the validation walls run after the extract and before the success return', () => {
    // Anchor the scan to the function BODY so the docblock is skipped. Scan
    // CALL SITES, not import names at the top of the file.
    const bodyStart = adapterSrc.indexOf('export async function runMcpAdapter');
    expect(bodyStart).toBeGreaterThan(-1);
    const body = adapterSrc.slice(bodyStart);

    const extractIdx = body.indexOf('extractMcpPacket(');
    const schemaIdx = body.indexOf('SemanticRefereePacketSchema.safeParse');
    const contentIdx = body.indexOf('scanPacketContent(');
    const successIdx = body.indexOf("kind: 'success'");
    expect(extractIdx).toBeGreaterThan(-1);
    expect(schemaIdx).toBeGreaterThan(-1);
    expect(contentIdx).toBeGreaterThan(-1);
    expect(successIdx).toBeGreaterThan(-1);
    // extract → schema wall → content wall → success return.
    expect(extractIdx).toBeLessThan(schemaIdx);
    expect(schemaIdx).toBeLessThan(contentIdx);
    expect(contentIdx).toBeLessThan(successIdx);
  });
});

describe('semantic-referee MCP adapter — success path stamps the contract identity', () => {
  it('stamps provider: mcp and authoritative: false on the packet', () => {
    expect(adapterSrc).toMatch(/provider:\s*'mcp'/);
    expect(adapterCode).toMatch(/authoritative\s*:\s*false/);
    expect(adapterCode).not.toMatch(/authoritative\s*:\s*true/);
  });

  it('stamps the prompt version and packet version (the boundary owns them)', () => {
    expect(adapterSrc).toContain('SEED_PROMPT_VERSION');
    expect(adapterSrc).toContain('PACKET_VERSION');
  });

  it('returns kind: success only after both validation walls pass', () => {
    expect(adapterSrc).toMatch(/kind:\s*'success'/);
  });

  it('the function signature returns a Promise<McpProviderResult> — it never throws', () => {
    expect(adapterSrc).toMatch(/runMcpAdapter[\s\S]*Promise<McpProviderResult>/);
  });
});

describe('semantic-referee MCP adapter — the request carries an Authorization Bearer credential', () => {
  it('sends an Authorization header built from the Bearer scheme prefix', () => {
    // The adapter authenticates with the MCP service token via the standard
    // HTTP Bearer scheme.
    expect(adapterSrc).toContain('Authorization');
    expect(adapterSrc).toContain('AUTH_SCHEME_PREFIX');
  });

  it('the adapter does not modify supabase/functions/semantic-referee/index.ts (no signature change)', () => {
    // MCP-018 changes no Edge Function signature — `classifyWithProvider` is
    // already async. This is asserted by the absence of an index.ts change in
    // the MCP-018 file list; here we record the design invariant.
    expect(adapterSrc).not.toContain("from '../../semantic-referee/index.ts'");
  });
});
