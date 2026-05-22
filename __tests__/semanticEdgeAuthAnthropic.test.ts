/**
 * MCP-017 — semantic-referee Anthropic live-provider orchestration coverage.
 *
 * `anthropicProvider.ts` is Deno code that imports `schema.ts` (→ `npm:zod@4`)
 * and calls `fetch` — Jest cannot load it. Following the convention MCP-016's
 * `semanticEdgeAuth.test.ts` established (and `argumentDeletionRequest.test.ts`
 * before it), this suite asserts the live provider's SOURCE SHAPE: that every
 * failure path the design §5 data-flow diagram requires is wired, in the order
 * required, mapping to the correct `ProviderUnavailableReason`.
 *
 * Local `supabase functions serve` runs with an intercepted `fetch` to
 * `api.anthropic.com` are a SEPARATE operator step — there is no deploy and no
 * live Anthropic call in this card (design §8 "Edge Function integration
 * tests": the source-scan + core tests are the CI-time coverage; the
 * intercept-`fetch` runs are operator-gated, marked the same way MCP-016 marked
 * `semanticEdgeAuth.test.ts`). The pure JSON-parse / extraction / validation
 * logic each path depends on is unit-tested directly in
 * `semanticAnthropicCore.test.ts` and `semanticAnthropicContentScan.test.ts`.
 */
import * as fs from 'fs';
import * as path from 'path';

const PROVIDER_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/semanticReferee/anthropicProvider.ts',
);
const INDEX_PATH = path.join(
  process.cwd(),
  'supabase/functions/semantic-referee/index.ts',
);

const providerSrc = fs.readFileSync(PROVIDER_PATH, 'utf8');
const indexSrc = fs.readFileSync(INDEX_PATH, 'utf8');

/**
 * Strip comments + string literals so an executable-code scan is clean. A
 * char-scanner — NOT a naive regex — so a nested template literal in
 * `anthropicProvider.ts` (`` `a-${fn(`b`)}` ``) cannot make a regex consume a
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

const providerCode = stripCommentsAndStrings(providerSrc);

describe('semantic-referee Anthropic provider — key-missing path', () => {
  it('returns unavailable:key_missing when ANTHROPIC_API_KEY is absent', () => {
    // The key read is first; an absent key short-circuits before any fetch.
    expect(providerSrc).toMatch(/reason:\s*'key_missing'/);
    const keyReadIdx = providerSrc.indexOf("Deno.env.get('ANTHROPIC_API_KEY')");
    const fetchIdx = providerSrc.indexOf('fetch(');
    expect(keyReadIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(-1);
    expect(keyReadIdx).toBeLessThan(fetchIdx);
  });

  it('the key-missing return precedes the fetch call', () => {
    const keyMissingIdx = providerSrc.indexOf("reason: 'key_missing'");
    const fetchIdx = providerSrc.indexOf('fetch(');
    expect(keyMissingIdx).toBeGreaterThan(-1);
    expect(keyMissingIdx).toBeLessThan(fetchIdx);
  });
});

describe('semantic-referee Anthropic provider — network + HTTP error paths', () => {
  it('maps a thrown fetch to unavailable:network_error', () => {
    // The fetch is wrapped in try/catch; the catch returns network_error.
    expect(providerCode).toMatch(/try\s*\{[\s\S]*fetch\(/);
    expect(providerSrc).toMatch(/reason:\s*'network_error'/);
  });

  it('maps HTTP 429 to unavailable:rate_limited and any other non-OK to api_error', () => {
    // The provider uses a ternary: `status === 429 ? 'rate_limited' : 'api_error'`.
    expect(providerCode).toMatch(/status\s*===\s*429/);
    // The reason literals appear in the raw source (the ternary branches).
    expect(providerSrc).toContain("'rate_limited'");
    expect(providerSrc).toContain("'api_error'");
    // The non-OK branch is gated on !rawResponse.ok.
    expect(providerCode).toMatch(/!\s*rawResponse\.ok/);
  });
});

describe('semantic-referee Anthropic provider — parse-failure path', () => {
  it('maps a non-JSON body / missing text / unparseable object to unavailable:parse_failure', () => {
    expect(providerSrc).toMatch(/reason:\s*'parse_failure'/);
    // The provider uses the core extraction + parse helpers.
    expect(providerSrc).toContain('extractAnthropicContentText');
    expect(providerSrc).toContain('parseJsonFromContent');
  });
});

describe('semantic-referee Anthropic provider — validation-failure path', () => {
  it('runs the schema wall AND the content-safety wall before returning success', () => {
    expect(providerSrc).toContain('SemanticRefereePacketSchema');
    expect(providerSrc).toContain('scanPacketContent');
    expect(providerSrc).toMatch(/reason:\s*'validation_failed'/);
  });

  it('a schema failure OR a content-scan failure both yield validation_failed', () => {
    // Two distinct guards must each return validation_failed.
    const matches = providerSrc.match(/reason:\s*'validation_failed'/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('the validation walls run after the JSON parse and before the success return', () => {
    // Anchor the scan to the function BODY so the docblock (which also names
    // `kind: 'success'` / `SemanticRefereePacketSchema`) is skipped. Scan CALL
    // SITES — not import names, which sit at the top of the file.
    const bodyStart = providerSrc.indexOf('export async function runAnthropicClassifier');
    expect(bodyStart).toBeGreaterThan(-1);
    const body = providerSrc.slice(bodyStart);

    const parseIdx = body.indexOf('parseJsonFromContent(');
    const schemaIdx = body.indexOf('SemanticRefereePacketSchema.safeParse');
    const contentIdx = body.indexOf('scanPacketContent(');
    const successIdx = body.indexOf("kind: 'success'");
    expect(parseIdx).toBeGreaterThan(-1);
    expect(schemaIdx).toBeGreaterThan(-1);
    expect(contentIdx).toBeGreaterThan(-1);
    expect(successIdx).toBeGreaterThan(-1);
    // parse → schema wall → content wall → success return.
    expect(parseIdx).toBeLessThan(schemaIdx);
    expect(schemaIdx).toBeLessThan(contentIdx);
    expect(contentIdx).toBeLessThan(successIdx);
  });
});

describe('semantic-referee Anthropic provider — success path stamps the contract identity', () => {
  it('stamps provider: anthropic and authoritative: false on the packet', () => {
    expect(providerSrc).toMatch(/provider:\s*'anthropic'/);
    // `authoritative` is a keyword value — the comment-stripped scan proves it
    // is set to the literal `false` and never to `true`.
    expect(providerCode).toMatch(/authoritative\s*:\s*false/);
    expect(providerCode).not.toMatch(/authoritative\s*:\s*true/);
  });

  it('stamps the prompt version and packet version (the boundary owns them)', () => {
    expect(providerSrc).toContain('SEED_PROMPT_VERSION');
    expect(providerSrc).toContain('PACKET_VERSION');
  });

  it('returns kind: success only after both validation walls pass', () => {
    expect(providerSrc).toMatch(/kind:\s*'success'/);
  });

  it('the function signature returns a Promise<ProviderResult> — it never throws', () => {
    expect(providerSrc).toMatch(/runAnthropicClassifier[\s\S]*Promise<ProviderResult>/);
  });
});

describe('semantic-referee Edge Function — awaits the async registry (MCP-017)', () => {
  it('the index awaits classifyWithConfiguredProvider', () => {
    expect(indexSrc).toMatch(/await\s+classifyWithConfiguredProvider\(/);
  });

  it('the function still returns HTTP 200 via ok() for the disabled outcome', () => {
    // Every provider failure path is a normal { enabled: false } outcome the
    // function returns with ok() — HTTP 200, never a 5xx to the client.
    expect(indexSrc).toMatch(/return ok\(outcome\)/);
  });

  it('the try/catch around the registry is retained as belt-and-suspenders', () => {
    expect(indexSrc).toMatch(/try\s*\{[\s\S]*classifyWithConfiguredProvider[\s\S]*\}\s*catch/);
  });
});
