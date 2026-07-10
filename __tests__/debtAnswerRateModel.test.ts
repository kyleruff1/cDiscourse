/**
 * INTEL-001 (#900) — debt-answer-rate matrix.
 *
 * answered = supplied | accepted_by_participant | accepted_by_both;
 * open = requested | challenged | unresolved | stale; branched excluded from the
 * denominator; rate null on a zero denominator; settled subset of answered.
 */
import { deriveRoomDebtAnswerRate } from '../src/features/intel/debtAnswerRateModel';
import {
  ALL_EVIDENCE_DEBT_STATUSES,
  type EvidenceDebt,
  type EvidenceDebtStatus,
} from '../src/features/evidence/evidenceDebtModel';

let seq = 0;
function debt(status: EvidenceDebtStatus): EvidenceDebt {
  const id = `d${seq++}`;
  return {
    id,
    debateId: 'debate-1',
    nodeId: `${id}:node`,
    requestArgumentId: `${id}:req`,
    debtKind: 'source',
    requestedByUserId: null,
    requestedAt: '2026-07-01T00:00:00.000Z',
    status,
    ageDays: 0,
    isStale: status === 'stale',
  };
}

describe('INTEL-001 — deriveRoomDebtAnswerRate', () => {
  it('no debts => total 0, answerRate null (never a fabricated 0%)', () => {
    const out = deriveRoomDebtAnswerRate({ debateId: 'debate-1', debts: [] });
    expect(out.totalDebts).toBe(0);
    expect(out.answerRate).toBeNull();
  });

  it('all statuses partition exactly: answered + open + branched === total', () => {
    const debts = ALL_EVIDENCE_DEBT_STATUSES.map((s) => debt(s));
    const out = deriveRoomDebtAnswerRate({ debateId: 'debate-1', debts });
    expect(out.answeredDebts + out.openDebts + out.branchedDebts).toBe(out.totalDebts);
    // supplied + accepted_by_participant + accepted_by_both = 3 answered.
    expect(out.answeredDebts).toBe(3);
    // requested + challenged + unresolved + stale = 4 open.
    expect(out.openDebts).toBe(4);
    // branched = 1, excluded from the denominator.
    expect(out.branchedDebts).toBe(1);
  });

  it('branched is excluded from the denominator', () => {
    const out = deriveRoomDebtAnswerRate({
      debateId: 'debate-1',
      debts: [debt('supplied'), debt('branched')],
    });
    // denominator = total - branched = 2 - 1 = 1; answered = 1 => rate 1.
    expect(out.answerRate).toBe(1);
  });

  it('all branched => denominator 0 => answerRate null (not 0%)', () => {
    const out = deriveRoomDebtAnswerRate({
      debateId: 'debate-1',
      debts: [debt('branched'), debt('branched')],
    });
    expect(out.answerRate).toBeNull();
  });

  it('challenged counts as open (still owed), not answered', () => {
    const out = deriveRoomDebtAnswerRate({
      debateId: 'debate-1',
      debts: [debt('challenged'), debt('supplied')],
    });
    expect(out.openDebts).toBe(1);
    expect(out.answeredDebts).toBe(1);
    expect(out.answerRate).toBe(0.5);
  });

  it('settled is a subset of answered (accepted_by_both)', () => {
    const out = deriveRoomDebtAnswerRate({
      debateId: 'debate-1',
      debts: [debt('accepted_by_both'), debt('supplied')],
    });
    expect(out.settledDebts).toBe(1);
    expect(out.answeredDebts).toBe(2);
    expect(out.settledDebts).toBeLessThanOrEqual(out.answeredDebts);
  });

  it('is deterministic and clock-free (no per-run drift)', () => {
    const debts = [debt('supplied'), debt('requested'), debt('accepted_by_both')];
    const a = deriveRoomDebtAnswerRate({ debateId: 'debate-1', debts });
    const b = deriveRoomDebtAnswerRate({ debateId: 'debate-1', debts });
    expect(a).toEqual(b);
  });

  it('output carries no standing / delta field', () => {
    const out = deriveRoomDebtAnswerRate({ debateId: 'debate-1', debts: [debt('supplied')] });
    const keys = Object.keys(out);
    expect(keys).not.toContain('standing');
    expect(keys).not.toContain('broadStandingDelta');
    expect(keys).not.toContain('weight');
  });
});
