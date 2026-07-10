/**
 * INTEL-001 (#900) — the room intel bundle + engagement-lane envelope adapter.
 *
 * The bundle composes dodge-chain + debt-answer; the adapter is a lossless
 * passthrough declaring the ENGAGEMENT lane + advisory, and the plain data
 * survives the wrapper (envelope reconciliation, assumptions 1-4).
 */
import {
  deriveRoomIntelSignals,
  toRoomIntelEnvelope,
} from '../src/features/intel/roomIntelSignals';
import type { EvidenceDebt } from '../src/features/evidence/evidenceDebtModel';

function debt(status: EvidenceDebt['status']): EvidenceDebt {
  return {
    id: `d-${status}`,
    debateId: 'debate-1',
    nodeId: 'n1',
    requestArgumentId: 'r1',
    debtKind: 'source',
    requestedByUserId: null,
    requestedAt: '2026-07-01T00:00:00.000Z',
    status,
    ageDays: 0,
    isStale: status === 'stale',
  };
}

describe('INTEL-001 — deriveRoomIntelSignals', () => {
  it('composes the dodge derivation + the debt-answer rate under one bundle', () => {
    const bundle = deriveRoomIntelSignals({
      debateId: 'debate-1',
      unaddressedMoveIds: ['a', 'b'],
      nodes: [
        { id: 'a', parentId: null },
        { id: 'b', parentId: 'a' },
      ],
      debts: [debt('supplied')],
    });
    expect(bundle.debateId).toBe('debate-1');
    expect(bundle.dodge.chainCount).toBe(1);
    expect(bundle.debtAnswer.answerRate).toBe(1);
  });

  it('is total on empty input', () => {
    const bundle = deriveRoomIntelSignals({
      debateId: 'debate-1',
      unaddressedMoveIds: [],
      nodes: [],
      debts: [],
    });
    expect(bundle.dodge.chainCount).toBe(0);
    expect(bundle.debtAnswer.answerRate).toBeNull();
  });
});

describe('INTEL-001 — toRoomIntelEnvelope', () => {
  const bundle = deriveRoomIntelSignals({
    debateId: 'debate-1',
    unaddressedMoveIds: ['a', 'b'],
    nodes: [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
    ],
    debts: [debt('requested')],
  });

  it('declares the engagement lane + advisory (never standing)', () => {
    const env = toRoomIntelEnvelope(bundle);
    expect(env.lane).toBe('engagement');
    expect(env.advisory).toBe(true);
    expect(env.source).toBe('derived');
    expect(env.lane).not.toBe('standing');
  });

  it('is a lossless passthrough (the plain data survives the wrapper)', () => {
    const env = toRoomIntelEnvelope(bundle);
    expect(env.data).toEqual(bundle);
  });

  it('carries no score/weight/standing field on the envelope', () => {
    const env = toRoomIntelEnvelope(bundle);
    const keys = Object.keys(env);
    expect(keys).not.toContain('score');
    expect(keys).not.toContain('weight');
    expect(keys).not.toContain('standing');
  });
});
