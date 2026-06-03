/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: selectOption determinism + no-reuse.
 */
const planner = require('../scripts/bot-fixtures/corpusPoolDrivenPlanner');

type Opt = { optionId: string; bankName: string; skeleton: { summary: string; spineHint: string; axisHint: string; targetExcerpt: null; evidenceDebt: string[]; antiAmplificationNote: null }; provenance: string };

function fakeBank(name: string, size: number): Opt[] {
  return Array.from({ length: size }, (_, k) => ({
    optionId: `${name}-opt-${k}`,
    bankName: name,
    skeleton: { summary: `summary ${name} ${k}`, spineHint: 'mechanism-led', axisHint: 'logic', targetExcerpt: null, evidenceDebt: [], antiAmplificationNote: null },
    provenance: 'synthetic_default',
  }));
}

describe('CORPUS-30 selectOption', () => {
  it('returns the same option for the same inputs (no usage)', () => {
    const bank = fakeBank('opening_claim_options', 6);
    const used1 = new Map<string, Set<number>>();
    const used2 = new Map<string, Set<number>>();
    const a = planner.selectOption({ runId: 'r', threadIndex: 0, role: 'provocateur', moveIndex: 1, bankName: 'opening_claim_options', bank, usedOptionsForThread: used1 });
    const b = planner.selectOption({ runId: 'r', threadIndex: 0, role: 'provocateur', moveIndex: 1, bankName: 'opening_claim_options', bank, usedOptionsForThread: used2 });
    expect(a.optionIndex).toBe(b.optionIndex);
    expect(a.option.optionId).toBe(b.option.optionId);
  });

  it('does not reuse a picked index until the bank exhausts', () => {
    const bank = fakeBank('evidence_pressure_options', 4);
    const used = new Map<string, Set<number>>();
    const picks: number[] = [];
    for (let m = 1; m <= 4; m++) {
      const r = planner.selectOption({ runId: 'r1', threadIndex: 2, role: 'provocateur', moveIndex: m, bankName: 'evidence_pressure_options', bank, usedOptionsForThread: used });
      picks.push(r.optionIndex);
    }
    expect(new Set(picks).size).toBe(4); // all distinct
  });

  it('emits bank_exhausted_reset and starts fresh after exhaustion', () => {
    const bank = fakeBank('evidence_pressure_options', 3);
    const used = new Map<string, Set<number>>();
    const resets: unknown[] = [];
    for (let m = 1; m <= 3; m++) {
      planner.selectOption({ runId: 'r', threadIndex: 0, role: 'provocateur', moveIndex: m, bankName: 'evidence_pressure_options', bank, usedOptionsForThread: used, onReset: (info: unknown) => resets.push(info) });
    }
    expect(resets).toHaveLength(0); // not yet exhausted
    // 4th pick: bank now exhausted (used.size === bank.length); reset fires.
    const fourth = planner.selectOption({ runId: 'r', threadIndex: 0, role: 'provocateur', moveIndex: 4, bankName: 'evidence_pressure_options', bank, usedOptionsForThread: used, onReset: (info: unknown) => resets.push(info) });
    expect(resets).toHaveLength(1);
    expect(fourth.optionIndex).toBeGreaterThanOrEqual(0);
    expect(fourth.optionIndex).toBeLessThan(3);
  });

  it('linear-probe runs in O(bank.length); never throws on a valid bank', () => {
    const bank = fakeBank('objection_options', 4);
    const used = new Map<string, Set<number>>();
    // Pre-mark 3 of 4 as used.
    used.set('objection_options', new Set([0, 1, 2]));
    const r = planner.selectOption({ runId: 'r', threadIndex: 0, role: 'revocateur', moveIndex: 2, bankName: 'objection_options', bank, usedOptionsForThread: used });
    expect(r.optionIndex).toBe(3); // only unused index left
  });

  it('throws for invalid role / unknown bank / empty bank', () => {
    const bank = fakeBank('objection_options', 4);
    const used = new Map<string, Set<number>>();
    expect(() => planner.selectOption({ runId: 'r', threadIndex: 0, role: 'spectator', moveIndex: 1, bankName: 'objection_options', bank, usedOptionsForThread: used })).toThrow();
    expect(() => planner.selectOption({ runId: 'r', threadIndex: 0, role: 'revocateur', moveIndex: 1, bankName: 'bogus_bank', bank, usedOptionsForThread: used })).toThrow();
    expect(() => planner.selectOption({ runId: 'r', threadIndex: 0, role: 'revocateur', moveIndex: 1, bankName: 'objection_options', bank: [], usedOptionsForThread: used })).toThrow();
  });
});
