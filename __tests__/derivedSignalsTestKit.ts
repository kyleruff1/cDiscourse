/**
 * FEEDBACK-002 (#899) — shared fixture kit for the derived-signal suites.
 *
 * NOT a test file (no `.test.` in the name, so jest testMatch never runs it as a
 * suite). Provides small builders so each matrix / determinism / envelope suite
 * reads cleanly. Pure data only.
 */
import type {
  DeriveDerivedSignalsInput,
  DerivedSignalNodeInput,
} from '../src/features/feedbackFlags/derivedObservationSignals';
import type { EvidenceDebt, EvidenceDebtKind, EvidenceDebtStatus } from '../src/features/evidence/evidenceDebtModel';
import type { MoveMarkCode, MoveMarkRow } from '../src/features/feedback/moveMarksModel';
import type { FriendlyFlagKey } from '../src/features/feedbackFlags/friendlyFlagMap';

/**
 * A representative (family, rawKey) observation per FriendlyFlagKey used in the
 * suites — each rawKey routes to its key via friendlyFlagMap RAWKEY_ROUTING.
 */
export const FRIENDLY_KEY_TO_OBS: Partial<Record<FriendlyFlagKey, { family: string; rawKey: string }>> = {
  disagrees_on_facts: { family: 'disagreement_axis', rawKey: 'disputes_fact' },
  disagrees_on_scope: { family: 'disagreement_axis', rawKey: 'disputes_scope' },
  needs_a_receipt: { family: 'evidence_source_chain', rawKey: 'asks_for_evidence' },
  open_receipt: { family: 'evidence_source_chain', rawKey: 'source_requested' },
  brought_receipts: { family: 'evidence_source_chain', rawKey: 'provides_evidence' },
  unanswered_question: { family: 'critical_question', rawKey: 'missing_warrant' },
  asks_for_clarification: { family: 'misunderstanding_repair', rawKey: 'requests_clarification' },
  could_be_more_specific: { family: 'claim_clarity', rawKey: 'claim_specificity_low' },
  reads_as_hedged: { family: 'claim_clarity', rawKey: 'hedging_present' },
  narrowed_the_claim: { family: 'resolution_progress', rawKey: 'narrowed' },
  found_common_ground: { family: 'resolution_progress', rawKey: 'common_ground_identified' },
  synthesis_on_the_table: { family: 'resolution_progress', rawKey: 'synthesis_proposed' },
  names_the_pattern: { family: 'argument_scheme', rawKey: 'example_reasoning_present' },
  strong_comparison: { family: 'argument_scheme', rawKey: 'analogy_reasoning_present' },
  clean_concession: { family: 'resolution_progress', rawKey: 'conceded' },
  callback_material: { family: 'parent_relation', rawKey: 'quote_anchors_parent' },
  direct_challenge: { family: 'parent_relation', rawKey: 'challenges_parent' },
  builds_on_point: { family: 'parent_relation', rawKey: 'refines_parent' },
};

/** Build the observation rows for a node from a list of friendly keys. */
export function obs(...keys: FriendlyFlagKey[]): { family: string; rawKey: string }[] {
  return keys.map((k) => {
    const o = FRIENDLY_KEY_TO_OBS[k];
    if (!o) throw new Error(`no fixture observation for friendly key ${k}`);
    return o;
  });
}

let seq = 0;

export function node(partial: Partial<DerivedSignalNodeInput> & { argumentId: string }): DerivedSignalNodeInput {
  return {
    parentId: null,
    branchRootId: partial.argumentId,
    authorId: 'author-a',
    side: 'affirmative',
    ordinal: seq++,
    actor: 'other',
    ...partial,
  };
}

export function debt(
  partial: Partial<EvidenceDebt> & { nodeId: string; status: EvidenceDebtStatus; debtKind: EvidenceDebtKind },
): EvidenceDebt {
  return {
    id: partial.id ?? `${partial.nodeId}:debt`,
    debateId: partial.debateId ?? 'debate-1',
    nodeId: partial.nodeId,
    requestArgumentId: partial.requestArgumentId ?? `${partial.nodeId}:req`,
    debtKind: partial.debtKind,
    requestedByUserId: partial.requestedByUserId ?? null,
    requestedAt: partial.requestedAt ?? '2026-07-01T00:00:00.000Z',
    status: partial.status,
    resolvedByNodeId: partial.resolvedByNodeId,
    resolvedAt: partial.resolvedAt,
    ageDays: partial.ageDays ?? 0,
    isStale: partial.isStale ?? partial.status === 'stale',
  };
}

export function mark(
  partial: Partial<MoveMarkRow> & { argumentId: string; markCode: MoveMarkCode },
): MoveMarkRow {
  return {
    markedBy: 'viewer-1',
    retractedAt: null,
    ...partial,
  };
}

export function baseInput(overrides: Partial<DeriveDerivedSignalsInput> = {}): DeriveDerivedSignalsInput {
  return {
    debateId: 'debate-1',
    nodes: [],
    observationsByArgumentId: {},
    evidenceDebts: [],
    moveMarks: [],
    heatBand: null,
    draftContext: null,
    ...overrides,
  };
}

/**
 * A "kitchen-sink" input designed to fire ALL SEVEN codes at once, for the
 * determinism / envelope / ban-list suites. Deterministic ordinals.
 */
export function richInput(): DeriveDerivedSignalsInput {
  const nodes: DerivedSignalNodeInput[] = [
    node({ argumentId: 'M1', actor: 'self', branchRootId: 'P1', ordinal: 0 }),
    node({ argumentId: 'R1', parentId: 'M1', actor: 'other', branchRootId: 'P1', ordinal: 1 }),
    node({ argumentId: 'A2', side: 'affirmative', branchRootId: 'P2', ordinal: 2 }),
    node({ argumentId: 'B2', parentId: 'A2', side: 'negative', branchRootId: 'P2', ordinal: 3 }),
    node({ argumentId: 'A3', branchRootId: 'P3', ordinal: 4 }),
    node({ argumentId: 'B3', parentId: 'A3', branchRootId: 'P3', ordinal: 5 }),
    node({ argumentId: 'X4', branchRootId: 'P4', ordinal: 6 }),
    node({ argumentId: 'Y4', parentId: 'X4', branchRootId: 'P4', ordinal: 7 }),
  ];
  return baseInput({
    nodes,
    heatBand: 'hot',
    observationsByArgumentId: {
      M1: obs('needs_a_receipt'),
      R1: obs('disagrees_on_facts'),
      A2: obs('asks_for_clarification'),
      B2: obs('disagrees_on_scope', 'could_be_more_specific'),
      A3: obs('direct_challenge'),
      X4: obs('callback_material', 'names_the_pattern'),
      Y4: obs('clean_concession', 'synthesis_on_the_table'),
    },
    evidenceDebts: [debt({ nodeId: 'M1', status: 'requested', debtKind: 'source' })],
    moveMarks: [
      mark({ argumentId: 'A3', markCode: 'did_not_address' }),
      mark({ argumentId: 'B3', markCode: 'did_not_address' }),
    ],
    draftContext: {
      draftAuthorId: 'viewer-1',
      targetArgumentId: 'X4',
      relationToTarget: 'builds_on',
      priorOwnNodeIds: ['B2'],
    },
  });
}
