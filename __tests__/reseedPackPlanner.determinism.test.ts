/**
 * RESEED-001 — planner determinism + no-clock-source guard.
 */
const fs = require('node:fs');
const path = require('node:path');
const { planPack } = require('../scripts/reseeder/reseedPackPlanner');
const { RESEED_PACK_NAMES } = require('../scripts/reseeder/reseedPacks');

const BANK = [
  { bankName: 'school-uniforms::debate.org::0007', topic: 'school uniforms', stance: 'PRO', premise: 'School uniforms reduce peer pressure over clothing and let students focus on learning rather than appearance, and they lower the cost burden on families who buy brand-name clothes.', conclusion: 'school uniforms', sourceUrl: null, license: 'CC-BY-4.0', sourceId: 'S1', fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' },
  { bankName: 'nuclear-energy::debate.org::0009', topic: 'nuclear energy', stance: 'CON', premise: 'Nuclear energy carries long-term waste-storage risks that span thousands of years, and the capital cost of new plants dwarfs comparable renewable buildouts on a per-megawatt basis.', conclusion: 'nuclear energy', sourceUrl: null, license: 'CC-BY-4.0', sourceId: 'S2', fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' },
  { bankName: 'remote-work::debate.org::0011', topic: 'remote work', stance: 'PRO', premise: 'Remote work expands the hiring pool beyond commuting distance and returns hours of daily commute time to workers, which several productivity studies associate with higher output.', conclusion: 'remote work', sourceUrl: null, license: 'CC-BY-4.0', sourceId: 'S3', fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' },
];

describe('planPack determinism', () => {
  it('produces a deep-equal plan for the same {pack,count,seed,runId,bank}', () => {
    const a = planPack({ pack: 'baseline', count: 4, seed: 'sX', runId: 'rr', bank: BANK });
    const b = planPack({ pack: 'baseline', count: 4, seed: 'sX', runId: 'rr', bank: BANK });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces a different plan for a different seed (not accidentally constant)', () => {
    const a = JSON.stringify(planPack({ pack: 'baseline', count: 4, seed: 'sX', runId: 'rr', bank: BANK }));
    const c = JSON.stringify(planPack({ pack: 'baseline', count: 4, seed: 'sY', runId: 'rr', bank: BANK }));
    expect(a).not.toBe(c);
  });

  it('rejectedTemplates === 0 for every pack (engine-valid by construction)', () => {
    for (const pack of RESEED_PACK_NAMES) {
      const { rejectedTemplates } = planPack({ pack, count: 3, seed: 'sZ', runId: 'rr', bank: BANK });
      expect(rejectedTemplates).toBe(0);
    }
  });

  it('stamps all six attribution fields non-empty on every emitted move', () => {
    for (const pack of RESEED_PACK_NAMES) {
      const { scenarios } = planPack({ pack, count: 2, seed: 'sZ', runId: 'rr', bank: BANK });
      for (const sc of scenarios) {
        expect(sc.moves.length).toBeGreaterThan(0);
        for (const mv of sc.moves) {
          expect(typeof mv.seedId).toBe('string');
          expect(mv.seedId.length).toBeGreaterThan(0);
          expect(typeof mv.threadIndex).toBe('number');
          expect(typeof mv.spineId).toBe('string');
          expect(mv.spineId.length).toBeGreaterThan(0);
          expect(typeof mv.voiceId).toBe('string');
          expect(mv.voiceId.length).toBeGreaterThan(0);
          expect(typeof mv.bankName).toBe('string');
          expect(mv.bankName.length).toBeGreaterThan(0);
          expect(typeof mv.optionIndex).toBe('number');
        }
      }
    }
  });

  it('does NOT use Date.now / Math.random in the planner or renderer source (source-scan)', () => {
    // Node fs, not shell rg (rg is unreliable in this Git Bash env).
    const files = [
      path.resolve(__dirname, '..', 'scripts', 'reseeder', 'reseedPackPlanner.js'),
      path.resolve(__dirname, '..', 'scripts', 'reseeder', 'reseedMoveRenderer.js'),
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src.includes('Date.now')).toBe(false);
      expect(src.includes('Math.random')).toBe(false);
    }
  });
});
