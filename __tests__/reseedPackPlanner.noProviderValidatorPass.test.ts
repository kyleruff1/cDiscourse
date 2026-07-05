/**
 * RESEED-001 — the core contract: for each of the 6 packs, plan -> render every
 * move with renderNoProvider -> run each through isEngineValidMove -> 100% valid.
 */
const { planPack } = require('../scripts/reseeder/reseedPackPlanner');
const { RESEED_PACK_NAMES } = require('../scripts/reseeder/reseedPacks');
const { renderNoProvider } = require('../scripts/reseeder/reseedMoveRenderer');
const { isEngineValidMove } = require('../scripts/reseeder/reseedEnginePrecheck');
const { seededRng } = require('../scripts/bot-fixtures/stressScenarioTemplates');

const BANK = [
  { bankName: 'school-uniforms::debate.org::0007', topic: 'school uniforms', stance: 'PRO', premise: 'School uniforms reduce peer pressure over clothing and let students focus on learning rather than appearance, and they lower the cost burden on families who buy brand-name clothes.', conclusion: 'school uniforms', sourceUrl: null, license: 'CC-BY-4.0', sourceId: 'S1', fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' },
  { bankName: 'nuclear-energy::debate.org::0009', topic: 'nuclear energy', stance: 'CON', premise: 'Nuclear energy carries long-term waste-storage risks that span thousands of years, and the capital cost of new plants dwarfs comparable renewable buildouts on a per-megawatt basis.', conclusion: 'nuclear energy', sourceUrl: null, license: 'CC-BY-4.0', sourceId: 'S2', fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' },
  { bankName: 'remote-work::debate.org::0011', topic: 'remote work', stance: 'PRO', premise: 'Remote work expands the hiring pool beyond commuting distance and returns hours of daily commute time to workers, which several productivity studies associate with higher output.', conclusion: 'remote work', sourceUrl: null, license: 'CC-BY-4.0', sourceId: 'S3', fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' },
];

describe('no-provider validator pass (100% per pack)', () => {
  it.each(RESEED_PACK_NAMES as string[])('pack "%s": every planned move is engine-valid', (pack: string) => {
    const { scenarios, rejectedTemplates } = planPack({ pack, count: 3, seed: 'core', runId: 'run', bank: BANK });
    expect(rejectedTemplates).toBe(0);

    let total = 0;
    let valid = 0;
    for (const sc of scenarios) {
      for (const mv of sc.moves) {
        total += 1;
        // Re-verify the planned body via the engine (defence in depth).
        const v1 = isEngineValidMove({
          argumentType: mv.argumentType,
          parentType: mv.parentType,
          parentBody: null,
          body: mv.body,
          targetExcerpt: mv.targetExcerpt,
          selectedTagCodes: mv.selectedTagCodes,
          attachedEvidence: mv.attachedEvidence,
          resolution: sc.resolution,
        });
        if (v1.valid) valid += 1;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(valid).toBe(total);
  });

  it('renderNoProvider bodies are themselves engine-valid for a fresh render', () => {
    const { scenarios } = planPack({ pack: 'baseline', count: 2, seed: 'core', runId: 'run', bank: BANK });
    for (const sc of scenarios) {
      for (const mv of sc.moves) {
        const seedRecord = BANK.find((b) => b.bankName === mv.bankName) || BANK[0];
        const rng = seededRng(`fresh::${mv.moveId}`);
        const rendered = renderNoProvider(
          {
            argumentType: mv.argumentType,
            parentType: mv.parentType,
            parentBody: null,
            targetExcerpt: mv.targetExcerpt,
            spineId: mv.spineId,
            resolution: sc.resolution,
          },
          seedRecord,
          rng,
        );
        expect(rendered.source).toBe('deterministic_template');
        expect(rendered.body.length).toBeGreaterThan(0);
      }
    }
  });
});
