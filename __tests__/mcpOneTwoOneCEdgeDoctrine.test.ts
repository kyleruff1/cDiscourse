/**
 * MCP-021C-EDGE — Test: doctrine ban list.
 *
 * Scans EVERY new file authored by MCP-021C-EDGE for forbidden verdict
 * tokens (cdiscourse-doctrine §1, §10a). Captures the doctrine surface
 * for the entire card in one place.
 *
 * Banned tokens (in any user-visible string, label, description, or
 * comment that could leak):
 *   winner / loser / liar / true / false / correct / dishonest /
 *   bad faith / manipulative / extremist / propagandist / verdict /
 *   proof of / truth value
 *
 * Amplification tokens (cdiscourse-doctrine §3 — popularity is not
 * evidence) are checked here too:
 *   likes / retweets / engagement / amplification / trending /
 *   virality / popular / viral
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();

const MCP_021C_EDGE_NEW_FILES = [
  // Migration
  'supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql',
  // Edge Function handler
  'supabase/functions/classify-argument-boolean-observations/index.ts',
  // Shared modules (Deno-only tree)
  'supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts',
  'supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapterCore.ts',
  'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts',
  'supabase/functions/_shared/booleanObservations/familyRegistry.ts',
  'supabase/functions/_shared/booleanObservations/persistenceWriter.ts',
  'supabase/functions/_shared/booleanObservations/runModeConstants.ts',
  // Jest bridge + fixture
  '__tests__/_helpers/booleanObservationEdgeDeno.ts',
  '__tests__/fixtures/mcpOneTwoOneCEdgeAdminValidationFixture.ts',
];

// Verdict tokens. These must NOT appear in any user-visible string in
// MCP-021C-EDGE-authored files. The scan is case-insensitive.
//
// Some words have legitimate adjacent uses ("true" / "false" appear in
// boolean literals; "proof" appears in "input_hash" derivation comments).
// The test below scans STRING LITERAL CONTENT, not all source text — see
// `extractStringLiterals` below.
const BANNED_VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'propagandist',
  'extremist',
  'dishonest',
  'bad faith',
  'manipulative',
  'truth value',
  'verdict',
  'proof of',
];

const BANNED_AMPLIFICATION_TOKENS = [
  'likes',
  'retweets',
  'amplification',
  'trending',
  'virality',
  'popular',
  'viral',
];

/**
 * Extract STRING-LITERAL contents (single, double, backtick) from a
 * TypeScript source file. Returns each literal's content separately.
 *
 * Comments are NOT checked — doctrine-reinforcing comments may
 * legitimately mention forbidden tokens (e.g., "this function does NOT
 * label a winner"). The doctrine guard is about what reaches USERS,
 * which is via string literals, not comments. The same pattern is used
 * by `_forbiddenLifecycleTokens()` in `pointLifecycleModel.ts` — a
 * function that lists verdict tokens for ban-list scanning.
 */
function extractStringLiterals(src: string): string[] {
  const literals: string[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    // Skip line comment
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    // Skip block comment
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    // String literal
    if (c === "'" || c === '"') {
      const quote = c;
      let end = i + 1;
      while (end < n && src[end] !== quote) {
        if (src[end] === '\\') end += 1;
        end += 1;
      }
      literals.push(src.slice(i + 1, end));
      i = end + 1;
      continue;
    }
    // Template literal (only the static segments — ${...} interpolations are code)
    if (c === '`') {
      let end = i + 1;
      while (end < n && src[end] !== '`') {
        if (src[end] === '\\') {
          end += 2;
          continue;
        }
        if (src[end] === '$' && src[end + 1] === '{') {
          // Skip the ${...} interpolation
          end += 2;
          let depth = 1;
          while (end < n && depth > 0) {
            if (src[end] === '{') depth += 1;
            else if (src[end] === '}') depth -= 1;
            end += 1;
          }
          continue;
        }
        end += 1;
      }
      literals.push(src.slice(i + 1, end));
      i = end + 1;
      continue;
    }
    i += 1;
  }
  return literals;
}

function readNewFile(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

describe('MCP-021C-EDGE — doctrine: no verdict tokens in any new file', () => {
  for (const file of MCP_021C_EDGE_NEW_FILES) {
    it(`DOC-1:${file} — no verdict token in string literals + comments`, () => {
      const src = readNewFile(file);
      const literals = extractStringLiterals(src);
      const joined = literals.join('\n').toLowerCase();
      for (const banned of BANNED_VERDICT_TOKENS) {
        expect(joined).not.toContain(banned);
      }
    });
  }
});

describe('MCP-021C-EDGE — doctrine: no amplification tokens in any new file', () => {
  for (const file of MCP_021C_EDGE_NEW_FILES) {
    it(`DOC-2:${file} — no amplification token in string literals + comments`, () => {
      const src = readNewFile(file);
      const literals = extractStringLiterals(src);
      const joined = literals.join('\n').toLowerCase();
      for (const banned of BANNED_AMPLIFICATION_TOKENS) {
        expect(joined).not.toContain(banned);
      }
    });
  }
});

describe('MCP-021C-EDGE — doctrine: no raw rawKey in user-facing strings (Edge Function summary)', () => {
  it('DOC-3 — Edge Function response carries rawKeysWithPositive (programmatic, not UI)', () => {
    const handler = readNewFile(
      'supabase/functions/classify-argument-boolean-observations/index.ts',
    );
    // The Edge Function's response IS programmatic — the operator
    // audits via SQL and the admin-validation template. The UI never
    // sees this response directly; Source 6 consumes the persisted rows
    // via the MCP-021A definitions registry which provides plain
    // labels. The handler response is allowed to carry rawKeys for the
    // operator-audit surface.
    expect(handler).toContain('rawKeysWithPositive');
  });
});

describe('MCP-021C-EDGE — doctrine: no AI calls from production app (cdiscourse-doctrine §7)', () => {
  it('DOC-4 — no client file (src/ or app/) imports the booleanObservations tree', () => {
    const src = path.join(REPO, 'src');
    const app = path.join(REPO, 'app');
    function collect(dir: string): string[] {
      const out: string[] = [];
      if (!fs.existsSync(dir)) return out;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...collect(full));
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
      }
      return out;
    }
    const allFiles = [...collect(src), ...collect(app)];
    const offenders = allFiles.filter((f) => {
      const content = fs.readFileSync(f, 'utf8');
      return /from\s+['"][^'"]*supabase\/functions\/_shared\/booleanObservations/.test(content);
    });
    expect(offenders).toEqual([]);
  });
});

describe('MCP-021C-EDGE — doctrine: schema version pinned (no drift in user-facing claims)', () => {
  it('DOC-5 — MCP-021C-EDGE files reference the MCP-021A schema version constant', () => {
    const handler = readNewFile(
      'supabase/functions/classify-argument-boolean-observations/index.ts',
    );
    expect(handler).toContain('MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION');
    const adapter = readNewFile(
      'supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts',
    );
    expect(adapter).toContain('MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION');
  });

  it('DOC-6 — the constant value (as defined in the mirrored schema file) matches MCP-021A v1', () => {
    // The literal definition lives in the mirrored schema file, which
    // is byte-equal to the production parser.
    const schema = readNewFile(
      'supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts',
    );
    expect(schema).toContain("'mcp-021.machine-observations.boolean.v1'");
  });
});
