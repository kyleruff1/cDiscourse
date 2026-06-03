/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: seedAssignment determinism + uniqueness.
 *
 * Asserts:
 *   - seedAssignment(runId, 30, pool) is byte-stable for identical inputs.
 *   - Always produces 30 unique seedIds when the eligible set is ≥30.
 *   - Throws SeedPoolUndersizedError (reason 'seed_pool_undersized') when
 *     the eligible set < threadCount.
 */
const planner = require('../scripts/bot-fixtures/corpusPoolDrivenPlanner');
const { BANK_FLOORS, ALL_BANK_NAMES } = require('../scripts/bot-fixtures/corpusPoolDrivenPlannerConstants');

type AnyObj = Record<string, unknown>;

function fakeSeed(i: number, overrides: AnyObj = {}): AnyObj {
  const banks: AnyObj = {};
  for (const name of ALL_BANK_NAMES) {
    const floor = (BANK_FLOORS as Record<string, number>)[name];
    banks[name] = Array.from({ length: floor }, (_, k) => ({
      optionId: `o-${name}-${i}-${k}`,
      bankName: name,
      skeleton: { summary: `summary-${name}-${i}-${k}`, spineHint: 'mechanism-led', axisHint: 'logic', targetExcerpt: null, evidenceDebt: [], antiAmplificationNote: null },
      provenance: 'synthetic_default',
    }));
  }
  return {
    seedId: `seed-${String(i).padStart(4, '0')}`,
    sourceHash: `src-${i}`,
    claimSummary: `claim ${i}`,
    issueFrame: 'civic_policy',
    banks,
    bankShortfall: false,
    ...overrides,
  };
}

describe('CORPUS-30 seedAssignment', () => {
  it('is byte-stable for same runId + same pool content', () => {
    const pool = Array.from({ length: 40 }, (_, i) => fakeSeed(i));
    const a = planner.seedAssignment('runA', 30, pool);
    const b = planner.seedAssignment('runA', 30, pool);
    expect(a.map((s: AnyObj) => s.seedId)).toEqual(b.map((s: AnyObj) => s.seedId));
  });

  it('produces 30 unique seedIds when 30+ eligible', () => {
    const pool = Array.from({ length: 35 }, (_, i) => fakeSeed(i));
    const assigned = planner.seedAssignment('runA', 30, pool);
    expect(assigned).toHaveLength(30);
    const ids = new Set(assigned.map((s: AnyObj) => s.seedId));
    expect(ids.size).toBe(30);
  });

  it('throws SeedPoolUndersizedError when fewer than threadCount eligible', () => {
    // 25 eligible + 5 ineligible
    const pool = [
      ...Array.from({ length: 25 }, (_, i) => fakeSeed(i)),
      ...Array.from({ length: 5 }, (_, i) => fakeSeed(100 + i, { bankShortfall: true })),
    ];
    expect(() => planner.seedAssignment('runX', 30, pool)).toThrow(/seed_pool_undersized/);
    try { planner.seedAssignment('runX', 30, pool); }
    catch (err: unknown) {
      const e = err as Error & { reason?: string; details?: AnyObj };
      expect(e.reason).toBe('seed_pool_undersized');
      expect(e.details).toBeTruthy();
      expect(e.details && (e.details as AnyObj).have).toBe(25);
      expect(e.details && (e.details as AnyObj).need).toBe(30);
    }
  });

  it('different runIds produce different orderings (with overwhelming probability)', () => {
    const pool = Array.from({ length: 30 }, (_, i) => fakeSeed(i));
    const a = planner.seedAssignment('runA', 30, pool);
    const b = planner.seedAssignment('runB', 30, pool);
    const sameOrder = a.every((s: AnyObj, i: number) => s.seedId === b[i].seedId);
    expect(sameOrder).toBe(false);
  });

  it('rejects non-integer threadCount + empty pool', () => {
    expect(() => planner.seedAssignment('runA', 0, [])).toThrow(/positive integer/);
    expect(() => planner.seedAssignment('runA', 1, [])).toThrow(/seed_pool_undersized/);
  });

  it('skips bank-shortfall seeds when filtering for eligible set', () => {
    const pool = [
      ...Array.from({ length: 30 }, (_, i) => fakeSeed(i)),
      fakeSeed(99, { bankShortfall: true }),
    ];
    const assigned = planner.seedAssignment('runA', 30, pool);
    expect(assigned).toHaveLength(30);
    expect(assigned.find((s: AnyObj) => s.seedId === 'seed-0099')).toBeUndefined();
  });
});
