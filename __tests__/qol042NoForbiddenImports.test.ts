/**
 * QOL-042 — source-scan safety tests.
 *
 * The QOL-042 source files import no AI / network provider, construct no
 * service-role client, reference no secret-shape string, and never call
 * `submit-argument` for the link (the link is not an argument). The two
 * pure model files import no React / Supabase / network primitive.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();

/** Every QOL-042 source file (relative to repo root). */
const QOL042_FILES = [
  'src/features/arguments/crossRoom/linkedPriorArgumentModel.ts',
  'src/features/arguments/crossRoom/linkedPriorArgumentCopy.ts',
  'src/features/arguments/crossRoom/argumentRoomLinksApi.ts',
  'src/features/arguments/crossRoom/LinkedPriorArgumentChipRow.tsx',
  'src/lib/types.ts',
];

/** The two PURE model files — these must import nothing impure. */
const QOL042_PURE_MODEL_FILES = [
  'src/features/arguments/crossRoom/linkedPriorArgumentModel.ts',
  'src/features/arguments/crossRoom/linkedPriorArgumentCopy.ts',
];

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

/**
 * Strips `//` line comments and block comments from TS/TSX source so a
 * behaviour scan checks the CODE only. A doc comment that legitimately
 * says "this never calls submit-argument" / "no Date.now() here" is
 * doctrine being stated, not a violation — it must not fail the scan.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

describe('QOL-042 source files — no service-role / secret leakage', () => {
  it.each(QOL042_FILES)('%s references no service-role / secret-shape string', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(src).not.toMatch(/SERVICE_ROLE_KEY/);
    expect(src).not.toMatch(/serviceRoleKey/);
    expect(src).not.toMatch(/sb_secret_[A-Za-z0-9]/);
    expect(src).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(src).not.toMatch(/XAI_API_KEY/);
  });

  it.each(QOL042_FILES)('%s constructs no Supabase client directly', (rel) => {
    const src = read(rel);
    // Only the shared `supabase` client may be used; no createClient().
    expect(src).not.toMatch(/createClient\(/);
  });
});

describe('QOL-042 source files — no AI / network provider import', () => {
  it.each(QOL042_FILES)('%s imports no AI provider', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/@anthropic-ai/);
    expect(src).not.toMatch(/from ['"]openai['"]/);
    expect(src).not.toMatch(/api\.x\.ai/);
    expect(src).not.toMatch(/api\.anthropic\.com/);
  });
});

describe('QOL-042 — the link never goes through submit-argument', () => {
  it.each(QOL042_FILES)('%s never invokes the submit-argument Edge Function', (rel) => {
    // Scan code only — the API file's doc comment legitimately states
    // "submit-argument is never called from this module".
    const code = stripComments(read(rel));
    expect(code).not.toContain('submit-argument');
    expect(code).not.toMatch(/functions\.invoke\(/);
  });

  it('the API client never inserts into public.arguments', () => {
    const src = read('src/features/arguments/crossRoom/argumentRoomLinksApi.ts');
    // A read of `arguments` is allowed (the access check); an insert is not.
    expect(src).not.toMatch(/\.from\(['"]arguments['"]\)[\s\S]{0,60}\.insert\(/);
  });
});

describe('QOL-042 pure model files — no impure imports', () => {
  it.each(QOL042_PURE_MODEL_FILES)('%s imports no React', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/from ['"]react['"]/);
    expect(src).not.toMatch(/from ['"]react-native['"]/);
  });

  it.each(QOL042_PURE_MODEL_FILES)('%s imports no Supabase / network primitive', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/lib\/supabase/);
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
  });

  it.each(QOL042_PURE_MODEL_FILES)('%s has no Date.now / new Date time-dependence', (rel) => {
    // Scan code only — the model files' doc comments legitimately say
    // "no Date.now()" as a doctrine statement.
    const code = stripComments(read(rel));
    expect(code).not.toMatch(/Date\.now\(/);
    expect(code).not.toMatch(/new Date\(/);
  });
});

describe('QOL-042 — the link writes only its own row', () => {
  it('the API client never UPDATEs debates or arguments', () => {
    const src = read('src/features/arguments/crossRoom/argumentRoomLinksApi.ts');
    expect(src).not.toMatch(/\.from\(['"]debates['"]\)[\s\S]{0,60}\.update\(/);
    expect(src).not.toMatch(/\.from\(['"]arguments['"]\)[\s\S]{0,60}\.update\(/);
  });

  it('the API client soft-removes — it never calls .delete()', () => {
    const src = read('src/features/arguments/crossRoom/argumentRoomLinksApi.ts');
    expect(src).not.toMatch(/\.delete\(/);
  });
});
