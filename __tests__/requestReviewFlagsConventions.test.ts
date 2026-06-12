/**
 * REF-005 — argument_flags conventions guard (design §2.6 / §8 / §11).
 *
 * Pins the persistence boundary chosen for v1 (Option (b): composer-local):
 *   - The new module + the three modified files introduce NO argument_flags
 *     delete path and NO new client write path of any kind.
 *   - The only client argument_flags access stays the SELECT in
 *     `argumentsApi.ts`.
 *   - The soft-dismiss convention used in scope is the REAL live-schema one
 *     (`status = 'dismissed'`, `resolved_by`, `resolved_at`) — NOT the
 *     drifted CLAUDE.md names (`dismissed = true`, `reviewed_by`,
 *     `reviewed_at`). The live schema does not have those drifted columns.
 *
 * Pure TS — source / schema scan only.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

const REQUEST_REVIEW_FILES = [
  'src/features/requestReview/requestReviewModel.ts',
  'src/features/requestReview/RequestReviewComposer.tsx',
  'src/features/requestReview/index.ts',
];

const MODIFIED_FILES = [
  'src/features/arguments/oneBox/actPopoutModel.ts',
  'src/features/arguments/ArgumentBubbleActions.tsx',
  'src/features/arguments/ArgumentGameSurface.tsx',
];

const WRITE_TOKENS = ['.insert(', '.upsert(', '.update(', '.delete('];

// ── No new persistence / write / delete path ───────────────────

describe('REF-005 — no new argument_flags write or delete path', () => {
  it('the requestReview module touches no Supabase / network / DB primitive', () => {
    for (const rel of REQUEST_REVIEW_FILES) {
      const src = read(rel);
      expect({ rel, supabase: /from\s+['"][^'"]*supabase/i.test(src) || src.includes("from '@supabase") }).toEqual({
        rel,
        supabase: false,
      });
      expect({ rel, fetch: /\bfetch\s*\(/.test(src) }).toEqual({ rel, fetch: false });
      for (const token of WRITE_TOKENS) {
        expect({ rel, token, hit: src.includes(token) }).toEqual({ rel, token, hit: false });
      }
      expect({ rel, flags: src.includes('argument_flags') }).toEqual({ rel, flags: false });
    }
  });

  it('the three modified files add no DB write and no new argument_flags client query', () => {
    for (const rel of MODIFIED_FILES) {
      const src = read(rel);
      for (const token of WRITE_TOKENS) {
        expect({ rel, token, hit: src.includes(token) }).toEqual({ rel, token, hit: false });
      }
      // No new `.from('argument_flags')` client query is introduced (the
      // sole pre-existing reference in ArgumentGameSurface is a code comment).
      expect({ rel, query: src.includes(".from('argument_flags')") }).toEqual({ rel, query: false });
    }
  });

  it('the only client argument_flags access remains the SELECT in argumentsApi.ts', () => {
    const api = read('src/features/arguments/argumentsApi.ts');
    expect(api).toContain(".from('argument_flags')");
    // The argument_flags chain is `.from().select().in()` — read-only. There
    // is no insert / upsert / update / delete chained on it.
    const flagsIdx = api.indexOf("from('argument_flags')");
    const window = api.slice(flagsIdx, flagsIdx + 400);
    expect(window).toContain('.select(');
    for (const token of WRITE_TOKENS) {
      expect({ token, hit: window.includes(token) }).toEqual({ token, hit: false });
    }
  });
});

// ── Soft-dismiss real names (precision finding §2.6) ───────────

describe('REF-005 — soft-dismiss uses the REAL live-schema names', () => {
  const schema = read('supabase/migrations/20260516000001_initial_schema.sql');
  const start = schema.indexOf('CREATE TABLE public.argument_flags');
  const block = schema.slice(start, schema.indexOf(');', start) + 2);

  it('the argument_flags table block exists', () => {
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('argument_flags');
  });

  it('uses status = dismissed + resolved_by + resolved_at (the live names)', () => {
    expect(block).toMatch(/CHECK \(status IN \([^)]*'dismissed'/);
    expect(block).toContain('resolved_by');
    expect(block).toContain('resolved_at');
  });

  it('does NOT use the drifted CLAUDE.md names (reviewed_by / reviewed_at)', () => {
    expect(block).not.toContain('reviewed_by');
    expect(block).not.toContain('reviewed_at');
  });

  it('the binding "never deleted" table comment is present', () => {
    expect(schema).toContain('Rows are never deleted; use status = dismissed');
  });

  it('the requestReview module never references the drifted names', () => {
    for (const rel of REQUEST_REVIEW_FILES) {
      const src = read(rel);
      expect(src.includes('reviewed_by')).toBe(false);
      expect(src.includes('reviewed_at')).toBe(false);
    }
  });
});
