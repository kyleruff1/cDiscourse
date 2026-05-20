/**
 * QOL-026 — Admin All Arguments tag-join contract tests.
 *
 * The Admin → All Arguments loader requested two columns that never existed
 * on `public.arguments`: `selected_tag_codes` and `attached_evidence`. The fix
 * replaces `selected_tag_codes` with a correct PostgREST nested embed of
 * `argument_tags(tag_code)` (mapped by `asTagCodes`) and drops
 * `attached_evidence` / `hasEvidence` entirely.
 *
 * These tests cover:
 *  - the `asTagCodes` mapper helper (happy / empty / malformed cases),
 *  - the `AdminArgumentRow` type contract (`selectedTagCodes` shape preserved,
 *    `hasEvidence` removed).
 *
 * No native renderer and no live Supabase — the embed shape is exercised by
 * unit-testing the pure mapper; the query shape is asserted in
 * `adminArguments.test.ts`.
 */
import * as fs from 'fs';
import * as path from 'path';

// `asTagCodes` is a pure helper, but it is exported from `adminArgumentsApi.ts`
// which imports the shared supabase client (and transitively async-storage).
// Mock the supabase module so the pure helper can be unit-tested without a
// native module. `asTagCodes` itself touches nothing in this mock.
jest.mock('../src/lib/supabase', () => ({
  supabase: {},
  SUPABASE_CONFIGURED: false,
}));

import { asTagCodes } from '../src/features/admin/adminArgumentsApi';

const repoRoot = process.cwd();

describe('asTagCodes — argument_tags embed mapper', () => {
  it('flattens a populated embed into a plain tag-code array', () => {
    expect(asTagCodes([{ tag_code: 'a' }, { tag_code: 'b' }])).toEqual(['a', 'b']);
  });

  it('returns null for an empty embed array (no tag data)', () => {
    expect(asTagCodes([])).toBeNull();
  });

  it('returns null when the embed relation is null', () => {
    expect(asTagCodes(null)).toBeNull();
  });

  it('filters out malformed rows whose tag_code is not a string', () => {
    expect(
      asTagCodes([
        { tag_code: 123 as unknown as string },
        { tag_code: 'ok' },
      ]),
    ).toEqual(['ok']);
  });

  it('returns an empty array when every row is malformed (still string[] | null contract)', () => {
    const out = asTagCodes([{ tag_code: 456 as unknown as string }]);
    expect(out).toEqual([]);
  });
});

describe('AdminArgumentRow — tag/evidence type contract (QOL-026)', () => {
  const typesSrc = fs.readFileSync(
    path.join(repoRoot, 'src/features/admin/types.ts'),
    'utf8',
  );

  it('still declares selectedTagCodes as string[] | null', () => {
    expect(typesSrc).toMatch(/selectedTagCodes:\s*string\[\]\s*\|\s*null/);
  });

  it('no longer declares a hasEvidence field', () => {
    expect(typesSrc).not.toContain('hasEvidence');
  });
});
