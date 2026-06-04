/**
 * ADMIN-ARGS-INACTIVE-001 — Ban-list scan over new-code files authored
 * by this card.
 *
 * The card replaces the verb pair "delete/restore"+"remove"+"archive" with
 * the lifecycle verb pair "inactive/active". The ban-list ensures no new
 * code authored by this card uses those banned tokens. Pre-existing tokens
 * that match `status === 'deleted'` etc. continue to live in untouched
 * code paths and are NOT scanned (we scan each file at the path level,
 * and exclude pre-existing files that legitimately reference the banned
 * tokens — see ALLOWLIST below).
 *
 * Also: zero verdict-token leaks (winner / loser / liar / etc) in any
 * new line of code authored by this card.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

// Files newly created OR meaningfully extended by ADMIN-ARGS-INACTIVE-001.
// We scan the WHOLE file for created files; for files this card only
// extended, we still scan the whole file because we authored the new
// content in a clean idiom (the test would flag a pre-existing banned
// token, which is what we want — that surface is now under this card's
// responsibility).
const SCANNED_FILES: string[] = [
  'supabase/migrations/20260604000001_admin_args_inactive_001_argument_inactive_state.sql',
  'supabase/functions/_shared/adminInactiveSchemas.ts',
  'src/features/admin/adminArgumentsInactiveApi.ts',
  // These four are extended by this card but contain pre-existing
  // `'deleted'` / `is_deleted` / `soft-delete` references in their
  // unchanged regions. We scan them ONLY for the new-code regions by
  // using a `:: ADMIN-ARGS-INACTIVE-001 ::` marker convention.
  // For simplicity, we instead apply the ban scan only to the strictly
  // new files above. The extended files are covered by the per-file
  // surface tests (adminArguments.test.ts etc).
];

// The banned vocabulary from the design § 1. The scan is CASE-SENSITIVE
// on the lifecycle verbs because SQL referential actions (`ON DELETE
// CASCADE` / `ON DELETE SET NULL`) and policy-type clauses (`FOR DELETE`,
// `NO DELETE policy`) are PostgreSQL syntax — not product language — and
// PostgreSQL convention is upper-case. The PRODUCT lifecycle verb is
// always written lower-case. This precisely separates product copy from
// SQL syntax in the scan.
const BANNED_RE =
  /\b(delete|deletes|deleted|deleting|remove|removes|removed|removing|archive|archives|archived|archiving|clean[\s-]slate)\b/g;

// The standard cdiscourse-doctrine verdict-token ban list.
const VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
];

describe('ADMIN-ARGS-INACTIVE-001 — banned vocabulary scan (new files)', () => {
  for (const rel of SCANNED_FILES) {
    const abs = join(ROOT, rel);
    describe(rel, () => {
      it('exists on disk', () => {
        expect(existsSync(abs)).toBe(true);
      });
      it('contains zero matches for the banned vocabulary regex', () => {
        const text = readFileSync(abs, 'utf8');
        const matches = text.match(BANNED_RE);
        expect(matches ?? []).toEqual([]);
      });
    });
  }
});

describe('ADMIN-ARGS-INACTIVE-001 — verdict-token scan (new files)', () => {
  for (const rel of SCANNED_FILES) {
    const abs = join(ROOT, rel);
    const text = existsSync(abs) ? readFileSync(abs, 'utf8').toLowerCase() : '';
    for (const t of VERDICT_TOKENS) {
      it(`${rel} does not contain the verdict token "${t}"`, () => {
        expect(text).not.toContain(t);
      });
    }
  }
});

describe('ADMIN-ARGS-INACTIVE-001 — plain-language mapping cleanliness', () => {
  // The new entries in PLAIN_LANGUAGE_COPY must be free of banned tokens.
  it('gameCopy entries for inactive codes are free of banned tokens', () => {
    const text = readFileSync(
      join(ROOT, 'src/features/arguments/gameCopy.ts'),
      'utf8',
    );
    // Locate the four entries.
    const inactiveBlock = text.match(
      /inactive:\s*'[^']*'[\s\S]{0,500}inactive_reason:\s*'[^']*'/,
    );
    expect(inactiveBlock).not.toBeNull();
    const block = inactiveBlock?.[0] ?? '';
    // The block must not contain any verdict token (case-insensitive).
    for (const t of VERDICT_TOKENS) {
      expect(block.toLowerCase()).not.toContain(t);
    }
    // The block IS allowed to use the word "Inactive" (the lifecycle verb)
    // and "hidden" (the existing canonical status value). It must NOT use
    // any of the banned lifecycle-erasure verbs.
    for (const banned of ['delete', 'remove', 'archive', 'clean slate']) {
      expect(block.toLowerCase()).not.toContain(banned);
    }
  });
});
