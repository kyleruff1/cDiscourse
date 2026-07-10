/**
 * INTEL-001/002 (#900/#901) — the anti-amplification pin (T-AA), with a firing
 * negative control.
 *
 * The load-bearing boundary: no src/features/intel/* file value-imports
 * pointStanding / antiAmplification / any standing helper, and no INTEL output
 * carries a score / delta / weight-into-standing field. A pile of
 * `did_not_address` produces a heat/mediator signal but NEVER a standing field.
 */
import fs from 'fs';
import path from 'path';
import { deriveDodgeChains } from '../src/features/intel/dodgeChainModel';
import { deriveRoomDebtAnswerRate } from '../src/features/intel/debtAnswerRateModel';

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

describe('INTEL — T-AA: no standing imports anywhere under src/features/intel', () => {
  const sources = intelSources();

  it('at least the INTEL-001 modules are present', () => {
    const names = sources.map((s) => s.rel);
    expect(names).toContain('src/features/intel/dodgeChainModel.ts');
    expect(names).toContain('src/features/intel/debtAnswerRateModel.ts');
  });

  for (const { rel, code } of intelSources()) {
    it(`${rel} value-imports nothing from pointStanding`, () => {
      expect(/from\s+['"][^'"]*pointStanding[^'"]*['"]/.test(code)).toBe(false);
    });
    it(`${rel} imports no antiAmplification helper`, () => {
      expect(/from\s+['"][^'"]*antiAmplification[^'"]*['"]/.test(code)).toBe(false);
    });
  }
});

describe('INTEL — T-AA: no output carries a standing field', () => {
  it('a wall of did_not_address produces a dodge derivation with no standing field', () => {
    const out = deriveDodgeChains({
      unaddressedMoveIds: ['a', 'b', 'c'],
      nodes: [
        { id: 'a', parentId: null },
        { id: 'b', parentId: 'a' },
        { id: 'c', parentId: 'b' },
      ],
    });
    // The friction signal exists...
    expect(out.longestChainLength).toBe(3);
    // ...but NO standing field is present.
    const keys = Object.keys(out);
    for (const banned of ['score', 'weight', 'standing', 'broadStandingDelta', 'narrowStandingDelta']) {
      expect(keys).not.toContain(banned);
    }
  });

  it('debt-answer output carries no standing field', () => {
    const out = deriveRoomDebtAnswerRate({
      debateId: 'd',
      debts: [
        {
          id: 'x',
          debateId: 'd',
          nodeId: 'n',
          requestArgumentId: 'r',
          debtKind: 'source',
          requestedByUserId: null,
          requestedAt: '2026-07-01T00:00:00.000Z',
          status: 'supplied',
          ageDays: 0,
          isStale: false,
        },
      ],
    });
    const keys = Object.keys(out);
    for (const banned of ['score', 'weight', 'standing', 'broadStandingDelta']) {
      expect(keys).not.toContain(banned);
    }
  });

  it('FIRING NEGATIVE CONTROL — the field scanner would catch a standing field', () => {
    const withStanding = { chainCount: 1, broadStandingDelta: 0.25 };
    expect(Object.keys(withStanding)).toContain('broadStandingDelta');
  });
});
