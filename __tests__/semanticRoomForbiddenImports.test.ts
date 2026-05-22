/**
 * MCP-019 — forbidden-import source-scan.
 *
 * Scans every new MCP-019 file and asserts the doctrine boundaries
 * structurally: no provider SDK, no `fetch` to a model host, no `Deno`, no
 * secret literal; `useSemanticReferee.ts` is the ONLY new file that imports
 * `classifyMove`; the pure-model files import no React / react-native /
 * Supabase.
 */
import * as fs from 'fs';
import * as path from 'path';

const NEW_FILES = [
  'src/features/semanticReferee/clientRedaction.ts',
  'src/features/semanticReferee/semanticTriggerInput.ts',
  'src/features/arguments/useSemanticReferee.ts',
  'src/features/refereeBanners/bannerSelectionInputFromPacket.ts',
  'src/features/refereeBanners/RefereeBannerView.tsx',
  'src/features/arguments/SemanticOverrideChoiceSheet.tsx',
];

const PURE_MODEL_FILES = [
  'src/features/semanticReferee/clientRedaction.ts',
  'src/features/semanticReferee/semanticTriggerInput.ts',
  'src/features/refereeBanners/bannerSelectionInputFromPacket.ts',
];

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

/**
 * Strip block + line comments so a token scan targets EXECUTABLE code only.
 * A doc comment that accurately says "no Deno" / explains the server-only
 * `SEMANTIC_REFEREE_ENABLED` secret is documentation, not a violation —
 * the doctrine concern is what the code actually does.
 */
function codeOnly(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 '); // line comments (keep `://` in URLs)
}

describe('MCP-019 — no AI provider SDK in any new file', () => {
  it.each(NEW_FILES)('%s imports no provider SDK', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/@anthropic-ai\/sdk/);
    expect(src).not.toMatch(/from ['"]openai['"]/);
    expect(src).not.toMatch(/@google\/generative-ai/);
  });

  it.each(NEW_FILES)('%s makes no fetch to a model host', (rel) => {
    const src = read(rel);
    // No raw fetch to an AI host. (The only outbound path is classifyMove ->
    // supabase.functions.invoke, which lives in edgeFunctions.ts.)
    expect(src).not.toMatch(/fetch\(['"]https?:\/\/api\.(anthropic|openai|x)\./);
    expect(src).not.toMatch(/api\.anthropic\.com/);
    expect(src).not.toMatch(/api\.x\.ai/);
  });

  it.each(NEW_FILES)('%s references no Deno global in executable code', (rel) => {
    // Scan code only — a doc comment that says "no Deno" is documentation.
    expect(codeOnly(rel)).not.toMatch(/\bDeno\b/);
  });
});

describe('MCP-019 — no secret literal in any new file', () => {
  it.each(NEW_FILES)('%s reads no secret env var / role in executable code', (rel) => {
    // Code-only scan — a doc comment may NAME the server-only
    // `SEMANTIC_REFEREE_ENABLED` secret to explain the client/server
    // boundary; the doctrine concern is that the client never READS it.
    const code = codeOnly(rel);
    expect(code).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(code).not.toMatch(/SERVICE_ROLE/);
    expect(code).not.toMatch(/SEMANTIC_REFEREE_ENABLED/);
    expect(code).not.toMatch(/SEMANTIC_REFEREE_PROVIDER/);
  });

  it.each(NEW_FILES)('%s contains no contiguous provider-key literal', (rel) => {
    // A real key literal would be a SHAPE: prefix immediately followed by an
    // alphanumeric body. This holds for code AND comments — neither should
    // carry a contiguous key shape.
    const src = read(rel);
    expect(src).not.toMatch(/sk-ant-[A-Za-z0-9]/);
    expect(src).not.toMatch(/\bxai-[A-Za-z0-9]/);
  });
});

describe('MCP-019 — classifyMove is imported only by the hook', () => {
  it('useSemanticReferee.ts imports classifyMove', () => {
    const src = read('src/features/arguments/useSemanticReferee.ts');
    expect(src).toMatch(/import \{[^}]*classifyMove/);
  });

  it.each(NEW_FILES.filter((f) => !f.endsWith('useSemanticReferee.ts')))(
    '%s does NOT reference classifyMove in executable code',
    (rel) => {
      // Code-only scan — a doc comment may mention `classifyMove` to explain
      // the data flow; the doctrine concern is that only the hook CALLS it.
      const code = codeOnly(rel);
      expect(code).not.toMatch(/\bclassifyMove\b/);
    },
  );
});

describe('MCP-019 — pure-model files have no UI / network imports', () => {
  it.each(PURE_MODEL_FILES)('%s imports no React', (rel) => {
    expect(read(rel)).not.toMatch(/from ['"]react['"]/);
  });

  it.each(PURE_MODEL_FILES)('%s imports no react-native', (rel) => {
    expect(read(rel)).not.toMatch(/from ['"]react-native['"]/);
  });

  it.each(PURE_MODEL_FILES)('%s imports nothing from a supabase module', (rel) => {
    expect(read(rel)).not.toMatch(/from ['"][^'"]*supabase[^'"]*['"]/i);
  });

  it.each(PURE_MODEL_FILES)('%s has no async function (pure + synchronous)', (rel) => {
    expect(read(rel)).not.toMatch(/async /);
  });
});

describe('MCP-019 — the hook never console-logs a degraded result', () => {
  it('useSemanticReferee.ts has no console.log / console.error in executable code', () => {
    // Code-only — the doctrine note in the file's doc comment may say
    // "no console.log"; the concern is that the code never calls it.
    const code = codeOnly('src/features/arguments/useSemanticReferee.ts');
    expect(code).not.toMatch(/console\.log/);
    expect(code).not.toMatch(/console\.error/);
    expect(code).not.toMatch(/console\.warn/);
  });

  it('the hook exposes no error field in its public result type', () => {
    const src = read('src/features/arguments/useSemanticReferee.ts');
    const resultBlock = src.slice(
      src.indexOf('interface UseSemanticRefereeResult'),
      src.indexOf('// ── Internal'),
    );
    expect(resultBlock).not.toMatch(/\berror\b/i);
  });
});
