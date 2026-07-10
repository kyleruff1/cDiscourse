/**
 * INTEL-001 (#900) — per-room debt-answer-rate (pure TypeScript).
 *
 * A REPAIR metric from the EV-003 evidence-debt ledger: of the debts that could
 * be answered, how many were? It feeds the mediator "what to address next"
 * weighting (engagement lane). It is room-level; NEVER a per-claim standing and
 * NEVER a per-person rate.
 *
 * Doctrine (evidence-doctrine / anti-amplification): imports NOTHING from
 * pointStanding, emits NO score / delta / standing field. Clock-free — staleness
 * was already resolved upstream by deriveEvidenceDebts(nowMs); the rate is a pure
 * function of the debt statuses.
 *
 * PURE + total: no Date.now, no async, no network, no mutation.
 */
import type { EvidenceDebt, EvidenceDebtStatus } from '../evidence/evidenceDebtModel';

/** answered = a supplying / resolving move landed and was not re-challenged. */
const ANSWERED_STATUSES: ReadonlySet<EvidenceDebtStatus> = new Set<EvidenceDebtStatus>([
  'supplied',
  'accepted_by_participant',
  'accepted_by_both',
]);
/** open = still owed (mirrors OPEN_EVIDENCE_DEBT_STATUSES; challenged => still owed). */
const OPEN_STATUSES: ReadonlySet<EvidenceDebtStatus> = new Set<EvidenceDebtStatus>([
  'requested',
  'challenged',
  'unresolved',
  'stale',
]);

export interface RoomDebtAnswerRate {
  debateId: string;
  totalDebts: number;
  /** Debts a supplying/resolving move landed on. */
  answeredDebts: number;
  /** Still owed. */
  openDebts: number;
  /** Discharged (accepted_by_both). Subset of answeredDebts. */
  settledDebts: number;
  /** Relocated to a side-branch. Excluded from the rate denominator. */
  branchedDebts: number;
  /**
   * answeredDebts / (totalDebts - branchedDebts). NULL when the denominator is 0
   * (no answerable debts) — never a fabricated 0%/100%. A REPAIR metric,
   * room-level; NEVER a per-claim standing and NEVER a per-person rate.
   */
  answerRate: number | null;
}

export function deriveRoomDebtAnswerRate(input: {
  debateId: string;
  debts: readonly EvidenceDebt[];
}): RoomDebtAnswerRate {
  let answered = 0;
  let open = 0;
  let settled = 0;
  let branched = 0;
  for (const debt of input.debts ?? []) {
    if (!debt) continue;
    if (debt.status === 'branched') {
      branched += 1;
      continue;
    }
    if (ANSWERED_STATUSES.has(debt.status)) {
      answered += 1;
      if (debt.status === 'accepted_by_both') settled += 1;
    } else if (OPEN_STATUSES.has(debt.status)) {
      open += 1;
    }
  }
  const total = answered + open + branched;
  const denominator = total - branched;
  const answerRate = denominator > 0 ? answered / denominator : null;

  return {
    debateId: input.debateId,
    totalDebts: total,
    answeredDebts: answered,
    openDebts: open,
    settledDebts: settled,
    branchedDebts: branched,
    answerRate,
  };
}
