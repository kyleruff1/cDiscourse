/**
 * QOL-036.1 — Composition-layer integration for payment-evidence pill state.
 *
 * Pure-model tests for `derivePaymentEvidencePillState`. No React, no
 * Supabase, no network. Mirrors the §9 test plan in
 * `docs/designs/QOL-036.1.md`.
 *
 * The four mappings, the conflict-resolution rule constant, layer-1-only
 * regression, layer-1 + layer-2 corroboration, within-axis last-wins,
 * cross-layer conflict, cross-axis orthogonal stack, observer-mode
 * degradation, every §8 edge case, doctrine ban-list scan, purity /
 * forbidden imports, and determinism — all in one file (~580 LOC).
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  MUTATION_TO_PILL_STATE,
  PILL_STATE_CONFLICT_RULE,
  derivePaymentEvidencePillState,
} from '../src/features/evidence/paymentEvidencePillState';
import type {
  PaymentEvidencePillState,
  PaymentEvidencePillProvenance,
  DerivePaymentEvidencePillStateInput,
} from '../src/features/evidence/paymentEvidencePillState';
import {
  ALL_APPLICABILITY_STATUSES,
  summarizeApplicabilityChip,
} from '../src/features/evidence/evidenceApplicabilityModel';
import type {
  ApplicabilityStatus,
  EvidenceResponseRecord,
} from '../src/features/evidence/evidenceApplicabilityModel';
import { ALL_EVIDENCE_DEBT_STATUSES } from '../src/features/evidence/evidenceDebtModel';
import type {
  EvidenceDebt,
  EvidenceDebtStatus,
} from '../src/features/evidence/evidenceDebtModel';
import type { EvidenceArtifact } from '../src/features/evidence/evidenceModel';
import type {
  NodeVisualMutation,
  NodeVisualMutationType,
} from '../src/features/semanticReferee/compositionTypes';

// ── Fixtures ───────────────────────────────────────────────────────

const ART_ID = 'arg-1:evidence:0';
const PARENT_MOVE_ID = 'arg-1';
const USER_AUTHOR = 'user-author';
const USER_DISPUTER = 'user-disputer';

function makeArtifact(overrides?: Partial<EvidenceArtifact>): EvidenceArtifact {
  return {
    id: ART_ID,
    argumentId: PARENT_MOVE_ID,
    kind: 'payment_screenshot',
    label: 'A payment record',
    sourceChainStatus: 'unverified',
    risk: 'unknown',
    addedByUserId: USER_AUTHOR,
    createdAt: '2026-05-21T09:00:00.000Z',
    ...overrides,
  };
}

function makeMutation(
  mutation: NodeVisualMutationType,
  sourceMoveId: string,
  targetMoveId: string,
  sourceClassifier: string = 'derived',
): NodeVisualMutation {
  return {
    targetMoveId,
    mutation,
    sourceClassifier: sourceClassifier as NodeVisualMutation['sourceClassifier'],
    sourceMoveId,
  };
}

function makeResponse(
  choice: EvidenceResponseRecord['choice'],
  argumentId: string,
  respondedByUserId: string,
  respondedAt: string,
  clarificationBody: string = '',
): EvidenceResponseRecord {
  return {
    evidenceArtifactId: ART_ID,
    argumentId,
    choice,
    clarificationBody:
      clarificationBody.length > 0
        ? clarificationBody
        : choice === 'accept'
          ? ''
          : 'A clarification body that is long enough.',
    respondedByUserId,
    respondedAt,
  };
}

function makeDebt(
  status: EvidenceDebtStatus,
  requestArgumentId: string = 'request-arg-1',
  requestedAt: string = '2026-05-21T10:00:00.000Z',
  nodeId: string = PARENT_MOVE_ID,
  resolvedAt?: string,
): EvidenceDebt {
  return {
    id: `${requestArgumentId}:debt`,
    debateId: 'debate-1',
    nodeId,
    requestArgumentId,
    debtKind: 'source',
    requestedByUserId: USER_DISPUTER,
    requestedAt,
    status,
    ageDays: 0,
    isStale: status === 'stale',
    ...(resolvedAt ? { resolvedAt, resolvedByNodeId: 'resolver-arg-1' } : {}),
  };
}

function baseInput(): DerivePaymentEvidencePillStateInput {
  return {
    artifact: makeArtifact(),
    mutationsTargetingArtifactParent: [],
    corroboratingMutations: [],
    responses: [],
    debts: [],
  };
}

// ══════════════════════════════════════════════════════════════════════
// §9.1 — Mapping-table coverage
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — MUTATION_TO_PILL_STATE shape', () => {
  test('contains exactly the four named mutations', () => {
    expect(MUTATION_TO_PILL_STATE).toHaveLength(4);
    const muts = MUTATION_TO_PILL_STATE.map((e) => e.mutation).sort();
    expect(muts).toEqual(
      [
        'corroborating_document_attached',
        'evidence_applicability_disputed',
        'evidence_debt_opened',
        'evidence_debt_resolved',
      ].sort(),
    );
  });

  test('every entry names a valid axis', () => {
    for (const entry of MUTATION_TO_PILL_STATE) {
      expect(['applicability', 'obligation']).toContain(entry.axis);
    }
  });

  test('applicability-axis entries map to a known ApplicabilityStatus', () => {
    const applicabilityValues = MUTATION_TO_PILL_STATE.filter(
      (e) => e.axis === 'applicability',
    ).map((e) => e.enumValue);
    for (const v of applicabilityValues) {
      expect(ALL_APPLICABILITY_STATUSES).toContain(v as ApplicabilityStatus);
    }
  });

  test('obligation-axis entries map to a known EvidenceDebtStatus', () => {
    const obligationValues = MUTATION_TO_PILL_STATE.filter(
      (e) => e.axis === 'obligation',
    ).map((e) => e.enumValue);
    for (const v of obligationValues) {
      expect(ALL_EVIDENCE_DEBT_STATUSES).toContain(v as EvidenceDebtStatus);
    }
  });

  test('no duplicate mutation values', () => {
    const muts = MUTATION_TO_PILL_STATE.map((e) => e.mutation);
    expect(new Set(muts).size).toBe(muts.length);
  });

  test('frozen — cannot push new entries', () => {
    expect(() => {
      (MUTATION_TO_PILL_STATE as unknown as unknown[]).push({});
    }).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.2 — Conflict-rule constant
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — PILL_STATE_CONFLICT_RULE shape', () => {
  test('withinAxis is last_wins_by_source_move_created_at', () => {
    expect(PILL_STATE_CONFLICT_RULE.withinAxis).toBe(
      'last_wins_by_source_move_created_at',
    );
  });

  test('crossAxis is orthogonal_stack', () => {
    expect(PILL_STATE_CONFLICT_RULE.crossAxis).toBe('orthogonal_stack');
  });

  test('layerConflict is last_wins_layer1_wins_ties', () => {
    expect(PILL_STATE_CONFLICT_RULE.layerConflict).toBe(
      'last_wins_layer1_wins_ties',
    );
  });

  test('frozen — cannot mutate', () => {
    expect(Object.isFrozen(PILL_STATE_CONFLICT_RULE)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.3 — Happy paths (the four mappings)
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — happy paths (the four mappings)', () => {
  test('evidence_applicability_disputed → applicability_disputed', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'mover-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_disputed');
    expect(out.applicabilityChip.isVisible).toBe(true);
    expect(out.applicabilityProvenance).toBe('layer2');
    expect(out.debtChipStatus).toBeNull();
    expect(out.debtProvenance).toBeNull();
    expect(out.artifactId).toBe(ART_ID);
    expect(out.parentMoveId).toBe(PARENT_MOVE_ID);
  });

  test('corroborating_document_attached → applicability_supported', () => {
    const input = {
      ...baseInput(),
      corroboratingMutations: [
        makeMutation(
          'corroborating_document_attached',
          'mover-2',
          'mover-2',
          'supplies_corroborating_document',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_supported');
    expect(out.applicabilityChip.isVisible).toBe(true);
    expect(out.applicabilityChip.tone).toBe('info');
    expect(out.applicabilityProvenance).toBe('layer2');
  });

  test('evidence_debt_opened → debtChipStatus = requested', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_opened',
          'mover-3',
          PARENT_MOVE_ID,
          'asks_for_evidence',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.debtChipStatus).toBe('requested');
    expect(out.debtProvenance).toBe('layer2');
    expect(out.applicabilityStatus).toBe('applicability_undisputed');
    expect(out.applicabilityChip.isVisible).toBe(false);
  });

  test('evidence_debt_resolved → debtChipStatus = supplied', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_resolved',
          'mover-4',
          PARENT_MOVE_ID,
          'evidence_supports_claim',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.debtChipStatus).toBe('supplied');
    expect(out.debtProvenance).toBe('layer2');
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.4 — Layer-1-only baseline (regression for QOL-037 / EV-003)
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — layer-1-only baseline (regression)', () => {
  test('empty mutations + dispute_applicability response → applicability_disputed via layer-1', () => {
    const input = {
      ...baseInput(),
      responses: [
        makeResponse(
          'dispute_applicability',
          'response-1',
          USER_DISPUTER,
          '2026-05-22T08:00:00.000Z',
          'It actually applies to something else.',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_disputed');
    expect(out.applicabilityProvenance).toBe('layer1');
  });

  test('empty mutations + EV-003 debt with requested → debtChipStatus = requested via layer-1', () => {
    const input = {
      ...baseInput(),
      debts: [makeDebt('requested')],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.debtChipStatus).toBe('requested');
    expect(out.debtProvenance).toBe('layer1');
  });

  test('byte-identical chip for layer-1-undisputed baseline (no mutations, no responses)', () => {
    const out = derivePaymentEvidencePillState(baseInput());
    const expected = summarizeApplicabilityChip('applicability_undisputed');
    expect(out.applicabilityChip).toEqual(expected);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.5 — Layer-1 + layer-2 corroboration
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — layer-1 + layer-2 corroboration', () => {
  test('dispute mutation + dispute_applicability response → layer1_with_layer2_corroboration', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'mover-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
      ],
      responses: [
        makeResponse(
          'dispute_applicability',
          'response-1',
          USER_DISPUTER,
          '2026-05-22T08:00:00.000Z',
          'It actually applies to something else.',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_disputed');
    expect(out.applicabilityProvenance).toBe('layer1_with_layer2_corroboration');
  });

  test('debt-opened mutation + debt requested → layer1_with_layer2_corroboration for obligation', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_opened',
          'mover-3',
          PARENT_MOVE_ID,
          'asks_for_evidence',
        ),
      ],
      debts: [makeDebt('requested')],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.debtChipStatus).toBe('requested');
    expect(out.debtProvenance).toBe('layer1_with_layer2_corroboration');
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.6 — Within-axis conflict (last-wins)
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — within-axis last-wins', () => {
  test('debt_opened + debt_resolved (resolved later) → supplied', () => {
    const moveCreatedAtById = new Map<string, string>([
      ['opener-1', '2026-05-22T08:00:00.000Z'],
      ['resolver-1', '2026-05-22T09:00:00.000Z'],
    ]);
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_opened',
          'opener-1',
          PARENT_MOVE_ID,
          'asks_for_evidence',
        ),
        makeMutation(
          'evidence_debt_resolved',
          'resolver-1',
          PARENT_MOVE_ID,
          'evidence_supports_claim',
        ),
      ],
      moveCreatedAtById,
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.debtChipStatus).toBe('supplied');
  });

  test('debt_opened + debt_resolved (resolved earlier) → requested', () => {
    const moveCreatedAtById = new Map<string, string>([
      ['resolver-1', '2026-05-22T08:00:00.000Z'],
      ['opener-1', '2026-05-22T09:00:00.000Z'],
    ]);
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_resolved',
          'resolver-1',
          PARENT_MOVE_ID,
          'evidence_supports_claim',
        ),
        makeMutation(
          'evidence_debt_opened',
          'opener-1',
          PARENT_MOVE_ID,
          'asks_for_evidence',
        ),
      ],
      moveCreatedAtById,
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.debtChipStatus).toBe('requested');
  });

  test('equal timestamps → deterministic tie-break (resolve wins over open)', () => {
    const moveCreatedAtById = new Map<string, string>([
      ['opener-1', '2026-05-22T08:00:00.000Z'],
      ['resolver-1', '2026-05-22T08:00:00.000Z'],
    ]);
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_opened',
          'opener-1',
          PARENT_MOVE_ID,
          'asks_for_evidence',
        ),
        makeMutation(
          'evidence_debt_resolved',
          'resolver-1',
          PARENT_MOVE_ID,
          'evidence_supports_claim',
        ),
      ],
      moveCreatedAtById,
    };
    const out = derivePaymentEvidencePillState(input);
    // CLASSIFIER_TIE_BREAK_ORDER puts evidence_supports_claim before
    // asks_for_evidence → the resolve wins on the tie.
    expect(out.debtChipStatus).toBe('supplied');
  });

  test('applicability within-axis last-wins: dispute later → disputed', () => {
    const moveCreatedAtById = new Map<string, string>([
      ['corroborator-1', '2026-05-22T08:00:00.000Z'],
      ['disputer-1', '2026-05-22T09:00:00.000Z'],
    ]);
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'disputer-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
      ],
      corroboratingMutations: [
        makeMutation(
          'corroborating_document_attached',
          'corroborator-1',
          'corroborator-1',
          'supplies_corroborating_document',
        ),
      ],
      moveCreatedAtById,
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_disputed');
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.7 — Cross-layer conflict
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — cross-layer conflict', () => {
  test('dispute mutation newer than layer-1 accept → layer2_overrides_layer1', () => {
    const moveCreatedAtById = new Map<string, string>([
      ['mover-1', '2026-05-22T09:00:00.000Z'],
    ]);
    // layer-1: dispute then accept by disputer → applicability_supported.
    const responses: EvidenceResponseRecord[] = [
      makeResponse(
        'dispute_applicability',
        'response-1',
        USER_DISPUTER,
        '2026-05-22T07:00:00.000Z',
        'It actually applies to something else.',
      ),
      makeResponse(
        'accept',
        'response-2',
        USER_DISPUTER,
        '2026-05-22T08:00:00.000Z',
      ),
    ];
    const input = {
      ...baseInput(),
      responses,
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'mover-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
      ],
      moveCreatedAtById,
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_disputed');
    expect(out.applicabilityProvenance).toBe('layer2_overrides_layer1');
  });

  test('no moveCreatedAtById → layer-1 wins by safe-default', () => {
    const responses: EvidenceResponseRecord[] = [
      makeResponse(
        'dispute_applicability',
        'response-1',
        USER_DISPUTER,
        '2026-05-22T07:00:00.000Z',
        'It actually applies to something else.',
      ),
      makeResponse(
        'accept',
        'response-2',
        USER_DISPUTER,
        '2026-05-22T08:00:00.000Z',
      ),
    ];
    const input = {
      ...baseInput(),
      responses,
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'mover-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_supported');
    expect(out.applicabilityProvenance).toBe('layer1');
  });

  test('exact timestamp tie → layer-1 wins', () => {
    const moveCreatedAtById = new Map<string, string>([
      ['mover-1', '2026-05-22T08:00:00.000Z'],
    ]);
    const responses: EvidenceResponseRecord[] = [
      makeResponse(
        'dispute_applicability',
        'response-1',
        USER_DISPUTER,
        '2026-05-22T07:00:00.000Z',
        'It actually applies to something else.',
      ),
      makeResponse(
        'accept',
        'response-2',
        USER_DISPUTER,
        '2026-05-22T08:00:00.000Z',
      ),
    ];
    const input = {
      ...baseInput(),
      responses,
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'mover-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
      ],
      moveCreatedAtById,
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_supported');
    expect(out.applicabilityProvenance).toBe('layer1');
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.8 — Cross-axis stack (orthogonality)
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — cross-axis orthogonality', () => {
  test('dispute + debt_opened → both chips fire independently', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'mover-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
        makeMutation(
          'evidence_debt_opened',
          'mover-2',
          PARENT_MOVE_ID,
          'asks_for_evidence',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_disputed');
    expect(out.applicabilityChip.isVisible).toBe(true);
    expect(out.debtChipStatus).toBe('requested');
  });

  test('corroboration + debt_resolved → both supported AND supplied', () => {
    const input = {
      ...baseInput(),
      corroboratingMutations: [
        makeMutation(
          'corroborating_document_attached',
          'mover-2',
          'mover-2',
          'supplies_corroborating_document',
        ),
      ],
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_resolved',
          'mover-3',
          PARENT_MOVE_ID,
          'evidence_supports_claim',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_supported');
    expect(out.debtChipStatus).toBe('supplied');
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.9 — Observer-mode degradation
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — observer-mode degradation', () => {
  test('both mutation arrays empty, no responses, no debts → undisputed, no debt', () => {
    const out = derivePaymentEvidencePillState(baseInput());
    expect(out.applicabilityStatus).toBe('applicability_undisputed');
    expect(out.applicabilityChip.isVisible).toBe(false);
    expect(out.debtChipStatus).toBeNull();
    expect(out.applicabilityProvenance).toBe('layer1');
    expect(out.debtProvenance).toBeNull();
  });

  test('observer-only path: responses present → layer-1 derivation only', () => {
    const input = {
      ...baseInput(),
      responses: [
        makeResponse(
          'dispute_applicability',
          'response-1',
          USER_DISPUTER,
          '2026-05-22T08:00:00.000Z',
          'It actually applies to something else.',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_disputed');
    expect(out.applicabilityProvenance).toBe('layer1');
  });

  test('observer-only path: debts present → layer-1 derivation only', () => {
    const input = {
      ...baseInput(),
      debts: [makeDebt('challenged')],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.debtChipStatus).toBe('challenged');
    expect(out.debtProvenance).toBe('layer1');
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.10 — Edge cases (mirrors §8 case list)
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — §8 edge cases', () => {
  test('§8.2 mutation on non-payment_screenshot kind → still works (data-in/data-out)', () => {
    const input = {
      ...baseInput(),
      artifact: makeArtifact({ kind: 'url', url: 'https://example.com' }),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'mover-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_disputed');
  });

  test('§8.5 mismatched corroborator (empty corroboratingMutations) → no applicability_supported', () => {
    const out = derivePaymentEvidencePillState(baseInput());
    expect(out.applicabilityStatus).toBe('applicability_undisputed');
  });

  test('§8.6 two debt_opened from same parent → idempotent requested', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_opened',
          'mover-1',
          PARENT_MOVE_ID,
          'asks_for_evidence',
        ),
        makeMutation(
          'evidence_debt_opened',
          'mover-2',
          PARENT_MOVE_ID,
          'asks_for_evidence',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.debtChipStatus).toBe('requested');
  });

  test('§8.8 wrong-target mutation → defensive non-crash, mutation has no effect', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'mover-1',
          'some-other-move-id', // NOT the artifact parent.
          'disputes_evidence_applicability',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_undisputed');
  });

  test('§8.9 moveCreatedAtById missing some entries → graceful degradation', () => {
    const moveCreatedAtById = new Map<string, string>([
      // Only the resolver is in the map.
      ['resolver-1', '2026-05-22T08:00:00.000Z'],
    ]);
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_opened',
          'opener-1',
          PARENT_MOVE_ID,
          'asks_for_evidence',
        ),
        makeMutation(
          'evidence_debt_resolved',
          'resolver-1',
          PARENT_MOVE_ID,
          'evidence_supports_claim',
        ),
      ],
      moveCreatedAtById,
    };
    const out = derivePaymentEvidencePillState(input);
    // The opener has '' createdAt; resolver has '2026-05-22T08:00:00.000Z' →
    // resolver wins last-wins.
    expect(out.debtChipStatus).toBe('supplied');
  });

  test('§8.14 accepted_by_both layer-1 NOT regressed by layer-2 evidence_debt_resolved', () => {
    const input = {
      ...baseInput(),
      debts: [makeDebt('accepted_by_both')],
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_resolved',
          'resolver-1',
          PARENT_MOVE_ID,
          'evidence_supports_claim',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.debtChipStatus).toBe('accepted_by_both');
    expect(out.debtProvenance).toBe('layer1');
  });

  test('§8.15 dispute + corroboration on the same axis from two moves → last-wins', () => {
    const moveCreatedAtById = new Map<string, string>([
      ['disputer-1', '2026-05-22T07:00:00.000Z'],
      ['corroborator-1', '2026-05-22T09:00:00.000Z'],
    ]);
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'disputer-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
      ],
      corroboratingMutations: [
        makeMutation(
          'corroborating_document_attached',
          'corroborator-1',
          'corroborator-1',
          'supplies_corroborating_document',
        ),
      ],
      moveCreatedAtById,
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_supported');
    expect(out.applicabilityProvenance).toBe('layer2');
  });

  test('§8.1 nothing → undisputed + null debt', () => {
    const out = derivePaymentEvidencePillState(baseInput());
    expect(out.applicabilityStatus).toBe('applicability_undisputed');
    expect(out.debtChipStatus).toBeNull();
  });

  test('§8.3 mutation + dispute response of same value → corroboration provenance', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'mover-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
      ],
      responses: [
        makeResponse(
          'dispute_applicability',
          'response-1',
          USER_DISPUTER,
          '2026-05-22T08:00:00.000Z',
          'A clarification body that is long enough.',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_disputed');
    expect(out.applicabilityProvenance).toBe('layer1_with_layer2_corroboration');
  });

  test('§8.7 evidence_debt_resolved alone with no opening → supplied (defensive)', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_debt_resolved',
          'resolver-1',
          PARENT_MOVE_ID,
          'evidence_supports_claim',
        ),
      ],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.debtChipStatus).toBe('supplied');
  });

  test('layer1CorroboratedByArgumentIds → resolves a layer-1 dispute to supported', () => {
    const input = {
      ...baseInput(),
      responses: [
        makeResponse(
          'dispute_applicability',
          'response-1',
          USER_DISPUTER,
          '2026-05-22T08:00:00.000Z',
          'It actually applies to something else.',
        ),
        // A corroborating response (a non-evidence-response move on the room
        // that QOL-037's deriveApplicabilityStatus is told about via the
        // optional pass-through). The clarificationBody is irrelevant — the
        // record is consulted by argumentId.
        makeResponse(
          'request_clarification',
          'corroborating-arg-1',
          USER_DISPUTER,
          '2026-05-22T09:00:00.000Z',
          'Some clarification body, long enough.',
        ),
      ],
      layer1CorroboratedByArgumentIds: ['corroborating-arg-1'],
    };
    const out = derivePaymentEvidencePillState(input);
    expect(out.applicabilityStatus).toBe('applicability_supported');
    expect(out.applicabilityProvenance).toBe('layer1');
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.11 — Doctrine ban-list
// ══════════════════════════════════════════════════════════════════════

const BANNED = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'troll',
  'bot',
  'astroturfer',
  'verdict',
  'proof',
  'proven',
  'disproven',
  'case closed',
];

const TRUTH_TOKENS = ['true', 'false'];

/**
 * Strip JSDoc + block + line comments so the source scan tests only
 * runtime / string-literal content. Comments legitimately use words like
 * "winner" (in "last-wins winner" algorithm-naming) and document the
 * doctrine ("no new verdict", "no service-role"); only runtime code can
 * actually leak a token to a user.
 *
 * Mirrors the pattern in `__tests__/paymentEvidenceMetadata.test.ts` (the
 * QOL-036 ban-list block).
 */
function stripCommentsFromSource(src: string): string {
  // Strip /** ... */ block comments (incl. JSDoc) first, then line comments.
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('QOL-036.1 — doctrine ban-list', () => {
  test('paymentEvidencePillState.ts source has no banned verdict / person tokens in non-comment code', () => {
    const file = path.join(
      __dirname,
      '..',
      'src',
      'features',
      'evidence',
      'paymentEvidencePillState.ts',
    );
    const src = stripCommentsFromSource(fs.readFileSync(file, 'utf8')).toLowerCase();
    // Word-boundary match: avoids false positives where a banned token is a
    // substring of a legitimate word (e.g. "bot" inside the EV-003 enum value
    // `accepted_by_both`, or "proven" inside `PaymentEvidencePillProvenance`).
    for (const banned of BANNED) {
      const re = new RegExp(`\\b${banned.replace(/\s/g, '\\s')}\\b`);
      expect(src).not.toMatch(re);
    }
  });

  test('paymentEvidencePillState.ts source has no naked truth tokens (true / false) in user-facing strings', () => {
    // 'true' / 'false' appear naturally in TypeScript code (e.g. `return true`).
    // We assert they do not appear inside any string literal that could leak
    // to a user. The deriver authors NO user-facing strings, so we sample
    // every double-quoted / single-quoted / backtick-quoted literal in
    // non-comment code.
    const file = path.join(
      __dirname,
      '..',
      'src',
      'features',
      'evidence',
      'paymentEvidencePillState.ts',
    );
    const src = stripCommentsFromSource(fs.readFileSync(file, 'utf8'));
    const stringLiterals = src.match(/(['"`])((?:\\.|(?!\1).)*)\1/g) ?? [];
    for (const lit of stringLiterals) {
      const lower = lit.toLowerCase();
      for (const t of TRUTH_TOKENS) {
        // The literal `'true'` / `'false'` IS allowed as an enum-style value
        // in our model surface (none in this module today). We assert
        // pathological combinations (`"is true"`, `"that is false"`,
        // `"proven true"`) do not appear.
        if (
          lower.includes(`is ${t}`) ||
          lower.includes(`that ${t}`) ||
          lower.includes(`${t} verdict`)
        ) {
          throw new Error(`Banned phrase containing "${t}" in literal: ${lit}`);
        }
      }
    }
  });

  test('MUTATION_TO_PILL_STATE enumValues never contain a banned token', () => {
    for (const entry of MUTATION_TO_PILL_STATE) {
      const v = String(entry.enumValue).toLowerCase();
      for (const banned of BANNED) {
        expect(v).not.toContain(banned);
      }
      // Cross-check: each enumValue is a known status from QOL-037 or EV-003.
      if (entry.axis === 'applicability') {
        expect(ALL_APPLICABILITY_STATUSES).toContain(
          entry.enumValue as ApplicabilityStatus,
        );
      } else {
        expect(ALL_EVIDENCE_DEBT_STATUSES).toContain(
          entry.enumValue as EvidenceDebtStatus,
        );
      }
    }
  });

  test('PILL_STATE_CONFLICT_RULE values never contain a banned token', () => {
    for (const v of Object.values(PILL_STATE_CONFLICT_RULE)) {
      const lower = String(v).toLowerCase();
      for (const banned of BANNED) {
        expect(lower).not.toContain(banned);
      }
    }
  });

  test('every PaymentEvidencePillProvenance value is structural, never a verdict', () => {
    const provenances: PaymentEvidencePillProvenance[] = [
      'layer1',
      'layer2',
      'layer1_with_layer2_corroboration',
      'layer2_overrides_layer1',
    ];
    for (const p of provenances) {
      for (const banned of BANNED) {
        expect(p.toLowerCase()).not.toContain(banned);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.12 — Purity / forbidden imports
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — purity / forbidden imports', () => {
  const file = path.join(
    __dirname,
    '..',
    'src',
    'features',
    'evidence',
    'paymentEvidencePillState.ts',
  );
  const src = fs.readFileSync(file, 'utf8');

  test('no import from react', () => {
    expect(src).not.toMatch(/from\s+['"]react['"]/);
    expect(src).not.toMatch(/from\s+['"]react-native['"]/);
  });

  test('no import from @supabase', () => {
    expect(src).not.toMatch(/from\s+['"]@supabase\//);
  });

  test('no import from src/lib/edgeFunctions or supabase/functions', () => {
    expect(src).not.toMatch(/from\s+['"][^'"]*edgeFunctions['"]/);
    expect(src).not.toMatch(/from\s+['"][^'"]*supabase\/functions/);
  });

  test('no import from src/features/pointStanding (anti-amplification boundary)', () => {
    expect(src).not.toMatch(/from\s+['"][^'"]*pointStanding/);
  });

  test('no AI SDK / network import', () => {
    expect(src).not.toMatch(/from\s+['"][^'"]*anthropic/i);
    expect(src).not.toMatch(/from\s+['"][^'"]*openai/i);
    expect(src).not.toMatch(/from\s+['"][^'"]*xai/i);
    expect(src).not.toMatch(/from\s+['"][^'"]*node-fetch/);
  });

  test('no Date.now or new Date — deriver is deterministic', () => {
    expect(src).not.toMatch(/Date\.now\s*\(/);
    expect(src).not.toMatch(/new\s+Date\s*\(/);
  });

  test('no console.log / console.error / console.warn', () => {
    expect(src).not.toMatch(/console\.(log|error|warn|info|debug)/);
  });

  test('no service-role / Authorization literal in non-comment code', () => {
    const codeOnly = stripCommentsFromSource(src);
    expect(codeOnly).not.toMatch(/service[_-]?role/i);
    expect(codeOnly).not.toMatch(/Authorization/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §9.13 — Determinism
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — determinism', () => {
  test('same input → deeply-equal output across two calls', () => {
    const input = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [
        makeMutation(
          'evidence_applicability_disputed',
          'mover-1',
          PARENT_MOVE_ID,
          'disputes_evidence_applicability',
        ),
      ],
      responses: [
        makeResponse(
          'dispute_applicability',
          'response-1',
          USER_DISPUTER,
          '2026-05-22T08:00:00.000Z',
          'It actually applies to something else.',
        ),
      ],
      debts: [makeDebt('requested')],
    };
    const a = derivePaymentEvidencePillState(input);
    const b = derivePaymentEvidencePillState(input);
    expect(a).toEqual(b);
  });

  test('argument-order independence: shuffled mutations produce the same chronological resolution', () => {
    const moveCreatedAtById = new Map<string, string>([
      ['opener-1', '2026-05-22T08:00:00.000Z'],
      ['resolver-1', '2026-05-22T09:00:00.000Z'],
    ]);
    const openMut = makeMutation(
      'evidence_debt_opened',
      'opener-1',
      PARENT_MOVE_ID,
      'asks_for_evidence',
    );
    const resolveMut = makeMutation(
      'evidence_debt_resolved',
      'resolver-1',
      PARENT_MOVE_ID,
      'evidence_supports_claim',
    );
    const orderA = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [openMut, resolveMut],
      moveCreatedAtById,
    };
    const orderB = {
      ...baseInput(),
      mutationsTargetingArtifactParent: [resolveMut, openMut],
      moveCreatedAtById,
    };
    const a = derivePaymentEvidencePillState(orderA);
    const b = derivePaymentEvidencePillState(orderB);
    expect(a.debtChipStatus).toBe('supplied');
    expect(b.debtChipStatus).toBe('supplied');
    expect(a).toEqual(b);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §11 — Backward compatibility (regression guard)
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — backward-compat with observer mode (layer-1-only)', () => {
  test('applicabilityChip is byte-identical to summarizeApplicabilityChip for every status', () => {
    for (const status of ALL_APPLICABILITY_STATUSES) {
      // Reach each status via layer-1 only.
      let responses: EvidenceResponseRecord[] = [];
      let layer1Corroborated: string[] | undefined = undefined;
      if (status === 'applicability_disputed') {
        responses = [
          makeResponse(
            'dispute_applicability',
            'r-1',
            USER_DISPUTER,
            '2026-05-22T08:00:00.000Z',
            'It actually applies to something else.',
          ),
        ];
      } else if (status === 'applicability_supported') {
        responses = [
          makeResponse(
            'dispute_applicability',
            'r-1',
            USER_DISPUTER,
            '2026-05-22T08:00:00.000Z',
            'It actually applies to something else.',
          ),
          makeResponse(
            'request_clarification',
            'corr-1',
            USER_DISPUTER,
            '2026-05-22T09:00:00.000Z',
            'Some clarification body, long enough.',
          ),
        ];
        layer1Corroborated = ['corr-1'];
      }
      const input: DerivePaymentEvidencePillStateInput = {
        ...baseInput(),
        responses,
        ...(layer1Corroborated ? { layer1CorroboratedByArgumentIds: layer1Corroborated } : {}),
      };
      const out = derivePaymentEvidencePillState(input);
      const expectedChip = summarizeApplicabilityChip(status);
      expect(out.applicabilityChip).toEqual(expectedChip);
      expect(out.applicabilityStatus).toBe(status);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// Type-shape sanity
// ══════════════════════════════════════════════════════════════════════

describe('QOL-036.1 — type-shape sanity', () => {
  test('returns the documented PaymentEvidencePillState shape', () => {
    const out: PaymentEvidencePillState = derivePaymentEvidencePillState(baseInput());
    expect(out).toHaveProperty('artifactId');
    expect(out).toHaveProperty('parentMoveId');
    expect(out).toHaveProperty('applicabilityStatus');
    expect(out).toHaveProperty('applicabilityChip');
    expect(out).toHaveProperty('debtChipStatus');
    expect(out).toHaveProperty('applicabilityProvenance');
    expect(out).toHaveProperty('debtProvenance');
  });
});
