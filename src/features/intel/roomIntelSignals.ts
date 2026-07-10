/**
 * INTEL-001 (#900) — the room intel bundle + the engagement-lane envelope
 * adapter (pure TypeScript).
 *
 * FEEDBACK-002 (#899) envelope reconciliation (R5, assumptions 1-6):
 * FEEDBACK-002 shipped the `DerivedSignal` envelope for DISCRETE, scope-anchored,
 * predicate-driven advisory signals (proof_moment ... dodge_chain). INTEL-001s
 * dodge-chain + debt-answer outputs are CONTINUOUS METRICS (a count and a rate),
 * which FEEDBACK-002s own reconciliation rule explicitly excludes from the
 * DerivedSignal envelope (no scope-anchored predicate, no discrete firing). So:
 *  - Assumption 1 (wraps, never replaces): the plain types below are the
 *    load-bearing shapes; the adapter carries `data: <plain type>`.
 *  - Assumption 2 (lane): INTEL declares the ENGAGEMENT lane, never standing.
 *  - Assumption 3 (advisory marker): `advisory: true`.
 *  - Assumption 4 (no standing-bound numeric): the bundle carries only
 *    descriptive counts / rates; nothing the standing pipeline reads.
 *  - Assumption 5 (envelope module location): INTEL does NOT value-import the
 *    DerivedSignal type (its metrics are continuous, not discrete signals) and
 *    adds NO new DerivedSignalCode; it keeps a local lossless passthrough.
 *  - Assumption 6 (input hash): not needed here (no clock, no hash in scope).
 *
 * Doctrine: imports NOTHING from pointStanding; no score / delta / standing field.
 */
import type { DodgeChainDerivation, DodgeChainNodeInput } from './dodgeChainModel';
import { deriveDodgeChains } from './dodgeChainModel';
import type { RoomDebtAnswerRate } from './debtAnswerRateModel';
import { deriveRoomDebtAnswerRate } from './debtAnswerRateModel';
import type { EvidenceDebt } from '../evidence/evidenceDebtModel';

export interface RoomIntelSignals {
  debateId: string;
  dodge: DodgeChainDerivation;
  debtAnswer: RoomDebtAnswerRate;
}

export function deriveRoomIntelSignals(input: {
  debateId: string;
  unaddressedMoveIds: readonly string[];
  nodes: readonly DodgeChainNodeInput[];
  debts: readonly EvidenceDebt[];
}): RoomIntelSignals {
  return {
    debateId: input.debateId,
    dodge: deriveDodgeChains({ unaddressedMoveIds: input.unaddressedMoveIds, nodes: input.nodes }),
    debtAnswer: deriveRoomDebtAnswerRate({ debateId: input.debateId, debts: input.debts }),
  };
}

/**
 * The engagement-lane advisory envelope. A local, lossless passthrough wrapper
 * (assumption 1) that carries the plain bundle as `data`. `lane` is always
 * `engagement` (assumption 2), never `standing`; there is NO score/weight field
 * that could route into standing (assumption 4).
 */
export interface RoomIntelEnvelope {
  readonly source: 'derived';
  readonly advisory: true;
  readonly lane: 'engagement';
  readonly data: RoomIntelSignals;
}

export function toRoomIntelEnvelope(bundle: RoomIntelSignals): RoomIntelEnvelope {
  return Object.freeze({
    source: 'derived',
    advisory: true,
    lane: 'engagement',
    data: bundle,
  });
}
