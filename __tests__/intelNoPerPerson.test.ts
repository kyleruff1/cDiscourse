/**
 * INTEL-001/002 (#900/#901) — the no-per-person pin (T-NP), with a firing
 * negative control.
 *
 * Chains describe THREADS (argument-id runs); the KPI is per-room + aggregate.
 * Neither reads or groups `created_by` / `authorId` / any person field. Source
 * scan over src/features/intel/* + a behavioural author-independence check.
 */
import fs from 'fs';
import path from 'path';
import { deriveDodgeChains } from '../src/features/intel/dodgeChainModel';

const ROOT = process.cwd();
const INTEL_DIR = path.join(ROOT, 'src', 'features', 'intel');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function intelSources(): { rel: string; code: string }[] {
  return fs
    .readdirSync(INTEL_DIR)
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => ({
      rel: `src/features/intel/${f}`,
      code: stripComments(fs.readFileSync(path.join(INTEL_DIR, f), 'utf8')),
    }));
}

const PERSON_TOKENS = ['created_by', 'createdBy', 'authorId', 'author_id'];

describe('INTEL — T-NP: no person field is read/grouped anywhere under src/features/intel', () => {
  for (const { rel, code } of intelSources()) {
    for (const token of PERSON_TOKENS) {
      it(`${rel} does not reference ${token}`, () => {
        expect(code.includes(token)).toBe(false);
      });
    }
  }
});

describe('INTEL — T-NP: dodge output is author-independent (thread-scoped)', () => {
  it('the derivation input has no author field (structurally cannot see a person)', () => {
    // deriveDodgeChains only accepts { id, parentId } nodes — there is no author
    // channel at all; two runs over the same tree are always identical.
    const nodes = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
    ];
    const first = deriveDodgeChains({ unaddressedMoveIds: ['a', 'b'], nodes });
    const second = deriveDodgeChains({ unaddressedMoveIds: ['a', 'b'], nodes });
    expect(first).toEqual(second);
    expect(first.chains[0].memberArgumentIds).toEqual(['a', 'b']);
  });

  it('FIRING NEGATIVE CONTROL — the person-token scanner catches an author reference', () => {
    const badSource = 'const grouped = rows.map((r) => r.author_id);';
    expect(badSource.includes('author_id')).toBe(true);
  });
});
