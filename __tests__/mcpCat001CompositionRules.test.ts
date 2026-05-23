/**
 * MCP-CAT-001 — Composition-rule activation snapshot tests.
 *
 * Each MCP-CAT-001 composition rule activated post-catalog-extension emits
 * a typed mutation. These snapshot tests assert each rule fires exactly its
 * documented mutation on a minimal synthetic packet.
 *
 * The rules covered:
 *   - R-CAT-SubAxis (un-stubbed): `introduces_sub_axis=1` → `sub_axis_opened`.
 *   - R-EV-APP-01: `disputes_evidence_applicability=1` →
 *     `evidence_applicability_disputed` on parent; `references_prior_agreement=1`
 *     → `prior_agreement_cited` on current; `provides_temporal_constraint=1` →
 *     `temporal_constraint_provided` on current.
 *   - R-CAT-QualifiedConcession: `accepts_partial_with_caveat=1` →
 *     `qualified_concession_with_caveat`; `provides_alternate_interpretation=1`
 *     → `alternate_interpretation_offered`.
 *   - R-CAT-Corroborating: `supplies_corroborating_document=1` →
 *     `corroborating_document_attached`.
 *   - R-CAT-Settlement: `proposes_settlement_terms=1` → `settlement_proposed`;
 *     `accepts_settlement_terms=1` → `settlement_accepted`.
 *
 * Pure-TS — imports the composition layer only.
 */
import { composeVisualState } from '../src/features/semanticReferee/compositionLayer';
import {
  EMPTY_COMPOSITION_STATE,
  type ComposeVisualStateInput,
  type MoveMetadata,
} from '../src/features/semanticReferee/compositionTypes';
import {
  PACKET_VERSION,
  type SemanticBinarySample,
  type SemanticClassifierId,
  type SemanticRefereePacket,
} from '../src/features/semanticReferee/semanticRefereeTypes';

function makePacket(
  binaries: Array<{ classifierId: SemanticClassifierId; value: 0 | 1 }>,
): SemanticRefereePacket {
  return {
    packetVersion: PACKET_VERSION,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'mock-model-0',
    provider: 'mock',
    authoritative: false,
    inputHash: 'h',
    contentHash: 'h',
    roomId: 'r',
    binaries: binaries.map((b) => ({
      classifierId: b.classifierId,
      value: b.value,
      confidence: 'high',
      reasonCode: 'evidence_test',
    })) as readonly SemanticBinarySample[],
    routeSuggestion: 'no_route_change',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 0,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  };
}

const META: MoveMetadata = {
  moveId: 'm-current',
  parentId: 'm-parent',
  authorId: 'authorB',
  authorMovePosition: 'subsequent',
};

function run(
  binaries: Array<{ classifierId: SemanticClassifierId; value: 0 | 1 }>,
): ComposeVisualStateInput {
  return {
    packet: makePacket(binaries),
    threadState: EMPTY_COMPOSITION_STATE,
    moveMeta: META,
  };
}

describe('MCP-CAT-001 — R-CAT-SubAxis (un-stubbed)', () => {
  it('fires sub_axis_opened on the current move when introduces_sub_axis=1', () => {
    const input = run([{ classifierId: 'introduces_sub_axis', value: 1 }]);
    const result = composeVisualState(input);
    const m = result.mutations.find((mu) => mu.mutation === 'sub_axis_opened');
    expect(m).toBeDefined();
    expect(m?.targetMoveId).toBe('m-current');
    expect(m?.sourceClassifier).toBe('introduces_sub_axis');
  });

  it('records a SubAxisState on the next state', () => {
    const input = run([{ classifierId: 'introduces_sub_axis', value: 1 }]);
    const result = composeVisualState(input);
    expect(result.nextState.activeSubAxes.has('m-current')).toBe(true);
    const entry = result.nextState.activeSubAxes.get('m-current');
    expect(entry?.status).toBe('open');
    expect(entry?.openingMoveId).toBe('m-current');
  });

  it('does not fire when the signal is 0', () => {
    const input = run([{ classifierId: 'introduces_sub_axis', value: 0 }]);
    const result = composeVisualState(input);
    expect(result.mutations.find((mu) => mu.mutation === 'sub_axis_opened')).toBeUndefined();
  });
});

describe('MCP-CAT-001 — R-EV-APP-01 (evidence-applicability dispute)', () => {
  it('fires evidence_applicability_disputed on the parent', () => {
    const input = run([{ classifierId: 'disputes_evidence_applicability', value: 1 }]);
    const result = composeVisualState(input);
    const m = result.mutations.find(
      (mu) => mu.mutation === 'evidence_applicability_disputed',
    );
    expect(m).toBeDefined();
    expect(m?.targetMoveId).toBe('m-parent');
    expect(m?.sourceClassifier).toBe('disputes_evidence_applicability');
  });

  it('fires prior_agreement_cited on the current move when references_prior_agreement=1', () => {
    const input = run([{ classifierId: 'references_prior_agreement', value: 1 }]);
    const result = composeVisualState(input);
    const m = result.mutations.find((mu) => mu.mutation === 'prior_agreement_cited');
    expect(m).toBeDefined();
    expect(m?.targetMoveId).toBe('m-current');
  });

  it('fires temporal_constraint_provided on the current move when provides_temporal_constraint=1', () => {
    const input = run([{ classifierId: 'provides_temporal_constraint', value: 1 }]);
    const result = composeVisualState(input);
    const m = result.mutations.find(
      (mu) => mu.mutation === 'temporal_constraint_provided',
    );
    expect(m).toBeDefined();
    expect(m?.targetMoveId).toBe('m-current');
  });

  it('combined m3-shape input fires all three rule outputs', () => {
    const input = run([
      { classifierId: 'disputes_evidence_applicability', value: 1 },
      { classifierId: 'references_prior_agreement', value: 1 },
      { classifierId: 'provides_temporal_constraint', value: 1 },
    ]);
    const result = composeVisualState(input);
    expect(
      result.mutations.find((mu) => mu.mutation === 'evidence_applicability_disputed'),
    ).toBeDefined();
    expect(
      result.mutations.find((mu) => mu.mutation === 'prior_agreement_cited'),
    ).toBeDefined();
    expect(
      result.mutations.find((mu) => mu.mutation === 'temporal_constraint_provided'),
    ).toBeDefined();
  });
});

describe('MCP-CAT-001 — R-CAT-QualifiedConcession', () => {
  it('fires qualified_concession_with_caveat when accepts_partial_with_caveat=1', () => {
    const input = run([{ classifierId: 'accepts_partial_with_caveat', value: 1 }]);
    const result = composeVisualState(input);
    const m = result.mutations.find(
      (mu) => mu.mutation === 'qualified_concession_with_caveat',
    );
    expect(m).toBeDefined();
    expect(m?.targetMoveId).toBe('m-current');
  });

  it('fires alternate_interpretation_offered when provides_alternate_interpretation=1', () => {
    const input = run([
      { classifierId: 'provides_alternate_interpretation', value: 1 },
    ]);
    const result = composeVisualState(input);
    const m = result.mutations.find(
      (mu) => mu.mutation === 'alternate_interpretation_offered',
    );
    expect(m).toBeDefined();
    expect(m?.targetMoveId).toBe('m-current');
  });

  it('combined m4-shape input fires both rule outputs', () => {
    const input = run([
      { classifierId: 'accepts_partial_with_caveat', value: 1 },
      { classifierId: 'provides_alternate_interpretation', value: 1 },
    ]);
    const result = composeVisualState(input);
    expect(
      result.mutations.find((mu) => mu.mutation === 'qualified_concession_with_caveat'),
    ).toBeDefined();
    expect(
      result.mutations.find((mu) => mu.mutation === 'alternate_interpretation_offered'),
    ).toBeDefined();
  });
});

describe('MCP-CAT-001 — R-CAT-Corroborating', () => {
  it('fires corroborating_document_attached when supplies_corroborating_document=1', () => {
    const input = run([{ classifierId: 'supplies_corroborating_document', value: 1 }]);
    const result = composeVisualState(input);
    const m = result.mutations.find(
      (mu) => mu.mutation === 'corroborating_document_attached',
    );
    expect(m).toBeDefined();
    expect(m?.targetMoveId).toBe('m-current');
  });
});

describe('MCP-CAT-001 — R-CAT-Settlement', () => {
  it('fires settlement_proposed when proposes_settlement_terms=1', () => {
    const input = run([{ classifierId: 'proposes_settlement_terms', value: 1 }]);
    const result = composeVisualState(input);
    const m = result.mutations.find((mu) => mu.mutation === 'settlement_proposed');
    expect(m).toBeDefined();
    expect(m?.targetMoveId).toBe('m-current');
    expect(m?.sourceClassifier).toBe('proposes_settlement_terms');
  });

  it('fires settlement_accepted when accepts_settlement_terms=1', () => {
    const input = run([{ classifierId: 'accepts_settlement_terms', value: 1 }]);
    const result = composeVisualState(input);
    const m = result.mutations.find((mu) => mu.mutation === 'settlement_accepted');
    expect(m).toBeDefined();
    expect(m?.targetMoveId).toBe('m-current');
    expect(m?.sourceClassifier).toBe('accepts_settlement_terms');
  });

  it('does not fire settlement mutations when the binaries are 0', () => {
    const input = run([
      { classifierId: 'proposes_settlement_terms', value: 0 },
      { classifierId: 'accepts_settlement_terms', value: 0 },
    ]);
    const result = composeVisualState(input);
    expect(
      result.mutations.find((mu) => mu.mutation === 'settlement_proposed'),
    ).toBeUndefined();
    expect(
      result.mutations.find((mu) => mu.mutation === 'settlement_accepted'),
    ).toBeUndefined();
  });
});

describe('MCP-CAT-001 — composition rule outputs are doctrine-clean', () => {
  // Belt-and-suspenders: emit every new mutation and assert none contains a
  // verdict / person token. The `compositionLayerDoctrineScan.test.ts` already
  // covers the value-list scan and the all-ones packet; this test adds a
  // targeted MCP-CAT-001 packet to widen the doctrine-scan coverage.
  const BANNED: readonly string[] = [
    'winner',
    'loser',
    'truth',
    'true',
    'false',
    'correct',
    'wrong',
    'right',
    'proven',
    'defeated',
    'liar',
    'lying',
    'dishonest',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
  ];

  it('every MCP-CAT-001 mutation value carries no banned token', () => {
    const allCat001Binaries: Array<{
      classifierId: SemanticClassifierId;
      value: 1;
    }> = [
      { classifierId: 'disputes_evidence_applicability', value: 1 },
      { classifierId: 'references_prior_agreement', value: 1 },
      { classifierId: 'provides_temporal_constraint', value: 1 },
      { classifierId: 'accepts_partial_with_caveat', value: 1 },
      { classifierId: 'provides_alternate_interpretation', value: 1 },
      { classifierId: 'opens_evidence_debt_marker', value: 1 },
      { classifierId: 'closes_evidence_debt_marker', value: 1 },
      { classifierId: 'supplies_corroborating_document', value: 1 },
      { classifierId: 'introduces_sub_axis', value: 1 },
      { classifierId: 'concedes_with_new_dispute', value: 1 },
      { classifierId: 'proposes_settlement_terms', value: 1 },
      { classifierId: 'accepts_settlement_terms', value: 1 },
    ];
    const result = composeVisualState(run(allCat001Binaries));
    for (const m of result.mutations) {
      const lower = String(m.mutation).toLowerCase();
      for (const token of BANNED) {
        // substring match is intentionally aggressive (snake_case enum values).
        expect({ mutation: m.mutation, banned: token, includes: lower.includes(token) }).toEqual({
          mutation: m.mutation,
          banned: token,
          includes: false,
        });
      }
    }
  });
});
