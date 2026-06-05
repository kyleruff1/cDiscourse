/**
 * OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001 — Edge "no cross-tree import" guard.
 *
 * THE STRUCTURAL FIX, ENFORCED. Every working Edge function in this repo is
 * self-contained: it imports ONLY from within `supabase/functions/` (its own
 * dir or `../_shared/`) and from Deno-resolvable URL / `npm:` / `jsr:` / bare
 * std specifiers. A relative import that escapes the `supabase/functions/` tree
 * (e.g. `../../../src/features/...`) is the boot-failure smell behind the
 * `admin-classifier-health` `network_error` incident (#509): the Supabase
 * deploy bundler boots a function from its own dir; a cross-tree `src/` import
 * — and its transitive EXTENSIONLESS relative imports + RN-only deps via
 * `gameCopy` — fails to resolve at boot → `FunctionsFetchError` →
 * `network_error`.
 *
 * This guard reads every `.ts` file under `supabase/functions/`, extracts every
 * relative import/export specifier, resolves it against the file's directory,
 * and asserts the resolved path stays INSIDE `supabase/functions/`. It is a
 * lint-style assertion that catches the next occurrence at test time rather
 * than at deploy time (roadmap-reviewer suggestion #2 on the #509 review).
 *
 * It complements (does not replace) the per-function source scans.
 *
 * Pure node:fs scan — no Deno, no network, no module load.
 */
import fs from 'node:fs';
import path from 'node:path';

const FUNCTIONS_ROOT = path.join(process.cwd(), 'supabase', 'functions');

/** Recursively collect every `.ts` file under a directory. */
function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip block + line comments so an import-path string written inside a
 * docstring (e.g. the headers that document the OLD `../../../src/...` path
 * we removed) does not register as a real import.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Extract every relative module specifier (starts with `.`) from `import ...
 * from '...'`, `export ... from '...'`, and dynamic `import('...')` forms.
 */
function extractRelativeSpecifiers(code: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const spec = m[1];
      if (spec.startsWith('.')) specifiers.push(spec);
    }
  }
  return specifiers;
}

const ALL_FILES = collectTsFiles(FUNCTIONS_ROOT);

describe('Edge functions — no cross-tree import (boot-failure guard, #509)', () => {
  it('finds Edge function source files to scan', () => {
    expect(ALL_FILES.length).toBeGreaterThan(0);
    // Sanity: the two functions repaired by this card are present.
    expect(
      ALL_FILES.some((f) => f.includes(path.join('admin-classifier-health', 'index.ts'))),
    ).toBe(true);
    expect(
      ALL_FILES.some((f) => f.includes(path.join('cutover-health-monitor', 'index.ts'))),
    ).toBe(true);
  });

  it('no relative import escapes the supabase/functions/ tree', () => {
    const violations: Array<{ file: string; specifier: string; resolved: string }> = [];
    for (const file of ALL_FILES) {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      const dir = path.dirname(file);
      for (const spec of extractRelativeSpecifiers(code)) {
        const resolved = path.resolve(dir, spec);
        const rel = path.relative(FUNCTIONS_ROOT, resolved);
        // A specifier resolving outside FUNCTIONS_ROOT yields a `rel` that
        // starts with `..` (or is an absolute path on a different drive).
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          violations.push({
            file: path.relative(process.cwd(), file),
            specifier: spec,
            resolved: path.relative(process.cwd(), resolved),
          });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('no Edge file imports from a `src/` path (explicit smell check)', () => {
    const offenders: Array<{ file: string; specifier: string }> = [];
    for (const file of ALL_FILES) {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      for (const spec of extractRelativeSpecifiers(code)) {
        // Any relative specifier that walks up into a `src/` segment.
        if (/(^|\/)src\//.test(spec)) {
          offenders.push({ file: path.relative(process.cwd(), file), specifier: spec });
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the admin-classifier-health + cutover-health-monitor functions import only from _shared / own dir', () => {
    const targets = [
      path.join(FUNCTIONS_ROOT, 'admin-classifier-health', 'index.ts'),
      path.join(FUNCTIONS_ROOT, 'cutover-health-monitor', 'index.ts'),
    ];
    for (const file of targets) {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      const dir = path.dirname(file);
      for (const spec of extractRelativeSpecifiers(code)) {
        const resolved = path.resolve(dir, spec);
        const rel = path.relative(FUNCTIONS_ROOT, resolved);
        expect(rel.startsWith('..')).toBe(false);
        expect(path.isAbsolute(rel)).toBe(false);
      }
    }
  });
});
