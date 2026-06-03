/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: role-bank gating + fixed-slot plan.
 */
const planner = require('../scripts/bot-fixtures/corpusPoolDrivenPlanner');
const { PROVOCATEUR_BANKS, REVOCATEUR_BANKS } = require('../scripts/bot-fixtures/corpusPoolDrivenPlannerConstants');

describe('CORPUS-30 role-bank gating', () => {
  it('M1 is always provocateur + opening_claim_options', () => {
    for (let t = 0; t < 30; t++) {
      const { role, bankName } = planner.resolveMoveBank('runA', t, 1);
      expect(role).toBe('provocateur');
      expect(bankName).toBe('opening_claim_options');
    }
  });

  it('M2 is always revocateur + objection_options', () => {
    for (let t = 0; t < 30; t++) {
      const { role, bankName } = planner.resolveMoveBank('runA', t, 2);
      expect(role).toBe('revocateur');
      expect(bankName).toBe('objection_options');
    }
  });

  it('M9 is always provocateur + concession_or_narrowing_options', () => {
    for (let t = 0; t < 30; t++) {
      const { role, bankName } = planner.resolveMoveBank('runA', t, 9);
      expect(role).toBe('provocateur');
      expect(bankName).toBe('concession_or_narrowing_options');
    }
  });

  it('M10 is always revocateur + resolution_pressure_options', () => {
    for (let t = 0; t < 30; t++) {
      const { role, bankName } = planner.resolveMoveBank('runA', t, 10);
      expect(role).toBe('revocateur');
      expect(bankName).toBe('resolution_pressure_options');
    }
  });

  it('provocateur rotations only draw from PROVOCATEUR_BANKS', () => {
    for (let t = 0; t < 30; t++) {
      for (const m of [3, 5, 7]) {
        const { role, bankName } = planner.resolveMoveBank('runA', t, m);
        expect(role).toBe('provocateur');
        expect(PROVOCATEUR_BANKS).toContain(bankName);
      }
    }
  });

  it('revocateur rotations only draw from REVOCATEUR_BANKS', () => {
    for (let t = 0; t < 30; t++) {
      for (const m of [4, 6, 8]) {
        const { role, bankName } = planner.resolveMoveBank('runA', t, m);
        expect(role).toBe('revocateur');
        expect(REVOCATEUR_BANKS).toContain(bankName);
      }
    }
  });

  it('throws on moveIndex outside 1..10', () => {
    expect(() => planner.resolveMoveBank('runA', 0, 0)).toThrow();
    expect(() => planner.resolveMoveBank('runA', 0, 11)).toThrow();
  });
});
