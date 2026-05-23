/**
 * COMP-001 §7.1 — Per-rule snapshot tests for `composeVisualState`.
 *
 * One test per composition rule (22 active + 2 exemption patterns = 24). Each
 * test builds a minimal packet that fires exactly one rule (or asserts a
 * specific multi-rule interaction) and verifies the mutation set + state
 * delta. These are the regression baseline — a rule change changes a
 * snapshot; the diff is reviewable.
 */

import { composeVisualState } from '../src/features/semanticReferee/compositionLayer';
import {
  EMPTY_COMPOSITION_STATE,
  type AncestorMoveSummary,
  type ComposeVisualStateInput,
  type CompositionState,
  type MoveMetadata,
} from '../src/features/semanticReferee/compositionTypes';
import type {
  SemanticBinarySample,
  SemanticClassifierId,
  SemanticRefereePacket,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import { PACKET_VERSION } from '../src/features/semanticReferee/semanticRefereeTypes';

// ── Test fixtures ─────────────────────────────────────────────────

function makePacket(
  binaries: Array<Partial<SemanticBinarySample> & { classifierId: SemanticClassifierId; value: 0 | 1 }>,
  overrides?: Partial<SemanticRefereePacket>,
): SemanticRefereePacket {
  return {
    packetVersion: PACKET_VERSION,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'mock-model-0',
    provider: 'mock',
    authoritative: false,
    inputHash: 'inputhash-test',
    contentHash: 'contenthash-test',
    roomId: 'room-test',
    binaries: binaries.map((b) => ({
      classifierId: b.classifierId,
      value: b.value,
      confidence: b.confidence ?? 'high',
      reasonCode: b.reasonCode ?? `${b.classifierId}_test`,
    })),
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
    ...overrides,
  };
}

function makeMeta(
  overrides?: Partial<MoveMetadata>,
): MoveMetadata {
  return {
    moveId: 'm2',
    parentId: 'm1',
    authorId: 'authorB',
    argumentType: 'rebuttal',
    side: 'negative',
    depth: 1,
    authorMovePosition: 'subsequent',
    ...overrides,
  };
}

function makeAncestor(
  overrides?: Partial<AncestorMoveSummary>,
): AncestorMoveSummary {
  return {
    moveId: 'm1',
    parentId: null,
    authorId: 'authorA',
    argumentType: 'thesis',
    ...overrides,
  };
}

function compose(input: Partial<ComposeVisualStateInput> & { moveMeta: MoveMetadata }) {
  const fullInput: ComposeVisualStateInput = {
    packet: input.packet,
    threadState: input.threadState ?? EMPTY_COMPOSITION_STATE,
    moveMeta: input.moveMeta,
    ancestors: input.ancestors,
  };
  return composeVisualState(fullInput);
}

function getMutation(mutations: ReturnType<typeof compose>['mutations'], type: string) {
  return mutations.find((m) => m.mutation === type) ?? null;
}

// ── Exemption rules ─────────────────────────────────────────────────

describe('COMP-001 R-EX-01 — root proclamation', () => {
  it('emits opening_claim_marker on the root move, no other mutations', () => {
    const result = compose({
      moveMeta: makeMeta({ moveId: 'm1', parentId: null }),
    });
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0]).toMatchObject({
      targetMoveId: 'm1',
      mutation: 'opening_claim_marker',
      sourceClassifier: 'exemption',
      sourceMoveId: 'm1',
    });
  });

  it('root exemption preempts even when a packet is supplied', () => {
    const result = compose({
      moveMeta: makeMeta({ moveId: 'm1', parentId: null }),
      packet: makePacket([
        { classifierId: 'introduces_new_issue', value: 1 },
        { classifierId: 'responds_to_parent', value: 0 },
      ]),
    });
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].mutation).toBe('opening_claim_marker');
  });
});

describe('COMP-001 R-EX-02 — first move by this author', () => {
  it('emits no composition-layer mutations when authorMovePosition is "first"', () => {
    const result = compose({
      moveMeta: makeMeta({ authorMovePosition: 'first' }),
      packet: makePacket([
        { classifierId: 'responds_to_parent', value: 1 },
        { classifierId: 'asks_for_evidence', value: 1 },
      ]),
    });
    expect(result.mutations).toHaveLength(0);
  });
});

// ── Parent continuity ─────────────────────────────────────────────

describe('COMP-001 R-PC-01 — parent engaged with anchored quote', () => {
  it('emits parent_engaged_quoted on the parent', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([
        { classifierId: 'responds_to_parent', value: 1 },
        { classifierId: 'quote_anchors_parent', value: 1 },
      ]),
    });
    const m = getMutation(result.mutations, 'parent_engaged_quoted');
    expect(m).toMatchObject({ targetMoveId: 'm1', sourceClassifier: 'quote_anchors_parent', sourceMoveId: 'm2' });
  });

  it('does NOT fire when quote_anchors_parent=0', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([
        { classifierId: 'responds_to_parent', value: 1 },
        { classifierId: 'quote_anchors_parent', value: 0 },
      ]),
    });
    expect(getMutation(result.mutations, 'parent_engaged_quoted')).toBeNull();
  });
});

describe('COMP-001 R-PC-02 — off-parent new issue introduced', () => {
  it('emits new_issue_introduced on current AND branch_suggested on parent', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([
        { classifierId: 'responds_to_parent', value: 0 },
        { classifierId: 'introduces_new_issue', value: 1 },
      ]),
    });
    expect(getMutation(result.mutations, 'new_issue_introduced')).toMatchObject({ targetMoveId: 'm2' });
    expect(getMutation(result.mutations, 'branch_suggested')).toMatchObject({ targetMoveId: 'm1' });
  });
});

describe('COMP-001 R-PC-03 — clarification requested', () => {
  it('emits clarification_requested on parent + opens a clarification debt', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([
        { classifierId: 'requests_clarification', value: 1 },
      ]),
    });
    expect(getMutation(result.mutations, 'clarification_requested')).toMatchObject({ targetMoveId: 'm1' });
    expect(result.nextState.clarificationDebts.size).toBe(1);
    const debt = result.nextState.clarificationDebts.get('m2');
    expect(debt).toMatchObject({ openingMoveId: 'm2', targetMoveId: 'm1', status: 'open' });
  });
});

describe('COMP-001 R-PC-04 — clarification answered', () => {
  it('resolves the matching clarification debt and emits clarification_resolved + clarification_answered', () => {
    // Seed prior state: a clarification request was filed at m2 targeting m1.
    const seeded: CompositionState = {
      ...EMPTY_COMPOSITION_STATE,
      clarificationDebts: new Map([
        ['m2', { openingMoveId: 'm2', targetMoveId: 'm1', status: 'open' }],
      ]),
    };
    const result = compose({
      threadState: seeded,
      moveMeta: makeMeta({ moveId: 'm3', parentId: 'm2', authorId: 'authorA' }),
      ancestors: [makeAncestor({ moveId: 'm1' }), makeAncestor({ moveId: 'm2', parentId: 'm1', authorId: 'authorB' })],
      packet: makePacket([
        { classifierId: 'answers_clarification', value: 1 },
      ]),
    });
    expect(getMutation(result.mutations, 'clarification_resolved')).toMatchObject({ targetMoveId: 'm2' });
    expect(getMutation(result.mutations, 'clarification_answered')).toMatchObject({ targetMoveId: 'm3' });
    expect(result.nextState.clarificationDebts.get('m2')?.status).toBe('resolved');
  });
});

// ── Evidence + source-chain ───────────────────────────────────────

describe('COMP-001 R-EV-01 — evidence requested (debt opened)', () => {
  it('emits evidence_debt_opened on parent + opens a debt', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'asks_for_evidence', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'evidence_debt_opened')).toMatchObject({
      targetMoveId: 'm1',
      sourceClassifier: 'asks_for_evidence',
    });
    expect(result.nextState.evidenceDebts.get('m2')).toMatchObject({
      openingMoveId: 'm2',
      targetMoveId: 'm1',
      openingAuthorId: 'authorB',
      status: 'open',
    });
  });
});

describe('COMP-001 R-EV-02 — evidence supplied (debt resolved)', () => {
  it('resolves the matching open debt + emits evidence_debt_resolved on the debt target', () => {
    const seeded: CompositionState = {
      ...EMPTY_COMPOSITION_STATE,
      evidenceDebts: new Map([
        ['m2', {
          openingMoveId: 'm2',
          targetMoveId: 'm1',
          openingAuthorId: 'authorB',
          status: 'open',
        }],
      ]),
    };
    const result = compose({
      threadState: seeded,
      moveMeta: makeMeta({ moveId: 'm3', parentId: 'm2', authorId: 'authorA' }),
      ancestors: [
        makeAncestor({ moveId: 'm1' }),
        makeAncestor({ moveId: 'm2', parentId: 'm1', authorId: 'authorB' }),
      ],
      packet: makePacket([
        { classifierId: 'provides_evidence', value: 1 },
        { classifierId: 'evidence_supports_claim', value: 1 },
      ]),
    });
    expect(getMutation(result.mutations, 'evidence_debt_resolved')).toMatchObject({ targetMoveId: 'm1' });
    expect(getMutation(result.mutations, 'evidence_attached_supporting')).toMatchObject({ targetMoveId: 'm3' });
    expect(result.nextState.evidenceDebts.get('m2')?.status).toBe('resolved');
  });
});

describe('COMP-001 R-EV-03 — evidence attached but unverified', () => {
  it('emits evidence_attached_unverified on current; does NOT close any debt', () => {
    const seeded: CompositionState = {
      ...EMPTY_COMPOSITION_STATE,
      evidenceDebts: new Map([
        ['m1', {
          openingMoveId: 'm1',
          targetMoveId: 'parent-of-m1',
          openingAuthorId: 'authorA',
          status: 'open',
        }],
      ]),
    };
    const result = compose({
      threadState: seeded,
      moveMeta: makeMeta(),
      packet: makePacket([
        { classifierId: 'provides_evidence', value: 1 },
        { classifierId: 'evidence_supports_claim', value: 0 },
      ]),
    });
    expect(getMutation(result.mutations, 'evidence_attached_unverified')).toMatchObject({ targetMoveId: 'm2' });
    expect(result.nextState.evidenceDebts.get('m1')?.status).toBe('open');
  });
});

describe('COMP-001 R-EV-04 — popularity used as evidence (amplification warning)', () => {
  it('emits popularity_amplification_warning on CURRENT only — never attaches a verdict to an ancestor', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'uses_popularity_as_evidence', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'popularity_amplification_warning')).toMatchObject({
      targetMoveId: 'm2',
      sourceClassifier: 'uses_popularity_as_evidence',
    });
    // Doctrine assertion — only the current move is targeted.
    for (const m of result.mutations) {
      expect(m.targetMoveId).toBe('m2');
    }
  });
});

describe('COMP-001 R-EV-05 — satire used as evidence', () => {
  it('emits satire_as_evidence_warning on current', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'uses_satire_as_evidence', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'satire_as_evidence_warning')).toMatchObject({ targetMoveId: 'm2' });
  });
});

describe('COMP-001 R-EV-06 — retraction cited', () => {
  it('emits retraction_cited on current; emits evidence_retracted on the upstream evidence ancestor', () => {
    const upstreamPacket = makePacket([
      { classifierId: 'provides_evidence', value: 1 },
      { classifierId: 'evidence_supports_claim', value: 1 },
    ]);
    const result = compose({
      moveMeta: makeMeta({ moveId: 'm3', parentId: 'm2', authorId: 'authorA' }),
      ancestors: [
        makeAncestor({ moveId: 'm1' }),
        makeAncestor({ moveId: 'm2', parentId: 'm1', authorId: 'authorB', packet: upstreamPacket }),
      ],
      packet: makePacket([{ classifierId: 'cites_retraction', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'retraction_cited')).toMatchObject({ targetMoveId: 'm3' });
    expect(getMutation(result.mutations, 'evidence_retracted')).toMatchObject({ targetMoveId: 'm2' });
  });

  it('emits retraction_cited only when no upstream evidence claim exists', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'cites_retraction', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'retraction_cited')).toMatchObject({ targetMoveId: 'm2' });
    expect(getMutation(result.mutations, 'evidence_retracted')).toBeNull();
  });
});

describe('COMP-001 R-EV-07 — source-chain gap flagged', () => {
  it('emits source_chain_gap_flagged on current + opens the gap', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'creates_source_chain_gap', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'source_chain_gap_flagged')).toMatchObject({ targetMoveId: 'm2' });
    expect(result.nextState.sourceChainGaps.get('m2')).toMatchObject({ openingMoveId: 'm2', status: 'open' });
  });
});

// ── Constructive movement ─────────────────────────────────────────

describe('COMP-001 R-CM-01 — claim narrowed', () => {
  it('emits point_narrowed on the broader-scoped same-author ancestor + narrowing_landed on current', () => {
    const result = compose({
      moveMeta: makeMeta({ moveId: 'm5', parentId: 'm4', authorId: 'authorA' }),
      ancestors: [
        makeAncestor({ moveId: 'm1', authorId: 'authorA' }),
        makeAncestor({ moveId: 'm2', parentId: 'm1', authorId: 'authorB' }),
        makeAncestor({ moveId: 'm3', parentId: 'm2', authorId: 'authorA' }),
        makeAncestor({ moveId: 'm4', parentId: 'm3', authorId: 'authorB' }),
      ],
      packet: makePacket([{ classifierId: 'narrows_claim', value: 1 }]),
    });
    // Most-recent same-author ancestor = m3.
    expect(getMutation(result.mutations, 'point_narrowed')).toMatchObject({ targetMoveId: 'm3' });
    expect(getMutation(result.mutations, 'narrowing_landed')).toMatchObject({ targetMoveId: 'm5' });
    expect(result.nextState.narrowingLinks.get('m5')).toMatchObject({
      narrowingMoveId: 'm5',
      broaderAncestorMoveId: 'm3',
    });
  });

  it('falls back to parent when no same-author ancestor exists', () => {
    const result = compose({
      moveMeta: makeMeta({ moveId: 'm2', parentId: 'm1', authorId: 'authorB' }),
      ancestors: [makeAncestor({ moveId: 'm1', authorId: 'authorA' })],
      packet: makePacket([{ classifierId: 'narrows_claim', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'point_narrowed')).toMatchObject({ targetMoveId: 'm1' });
    expect(result.nextState.narrowingLinks.get('m2')?.broaderAncestorMoveId).toBeNull();
  });
});

describe('COMP-001 R-CM-02 — point conceded', () => {
  it('emits point_conceded on the upstream different-author challenge with matching axis', () => {
    const result = compose({
      moveMeta: makeMeta({
        moveId: 'm4',
        parentId: 'm3',
        authorId: 'authorB',
        disagreementAxis: 'evidence',
      }),
      ancestors: [
        makeAncestor({ moveId: 'm1', authorId: 'authorA' }),
        makeAncestor({ moveId: 'm2', parentId: 'm1', authorId: 'authorB' }),
        makeAncestor({
          moveId: 'm3',
          parentId: 'm2',
          authorId: 'authorA',
          disagreementAxis: 'evidence',
        }),
      ],
      packet: makePacket([{ classifierId: 'concedes_narrow_point', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'point_conceded')).toMatchObject({ targetMoveId: 'm3' });
    expect(getMutation(result.mutations, 'concession_landed')).toMatchObject({ targetMoveId: 'm4' });
    expect(result.nextState.concessionChains.get('m4')).toMatchObject({
      concedingMoveId: 'm4',
      conceededOnAxis: 'evidence',
      originatingChallengeMoveId: 'm3',
    });
  });

  it('falls back to parent when no different-author ancestor exists', () => {
    const result = compose({
      moveMeta: makeMeta(),
      ancestors: [makeAncestor({ moveId: 'm1', authorId: 'authorB' })],
      packet: makePacket([{ classifierId: 'concedes_narrow_point', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'point_conceded')).toMatchObject({ targetMoveId: 'm1' });
  });
});

describe('COMP-001 R-CM-03 — synthesis ready', () => {
  it('falls back to the room root when no open sub-axis exists', () => {
    const result = compose({
      moveMeta: makeMeta({ moveId: 'm5', parentId: 'm4' }),
      ancestors: [
        makeAncestor({ moveId: 'm1' }),
        makeAncestor({ moveId: 'm2', parentId: 'm1' }),
        makeAncestor({ moveId: 'm3', parentId: 'm2' }),
        makeAncestor({ moveId: 'm4', parentId: 'm3' }),
      ],
      packet: makePacket([{ classifierId: 'ready_for_synthesis', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'synthesis_ready')).toMatchObject({ targetMoveId: 'm1' });
    expect(getMutation(result.mutations, 'synthesis_offered')).toMatchObject({ targetMoveId: 'm5' });
    expect(result.nextState.synthesisReadiness.ready).toBe(true);
    expect(result.nextState.synthesisReadiness.subThreadRootMoveId).toBe('m1');
  });
});

describe('COMP-001 R-CM-04 — pre-send pause advised', () => {
  it('emits pre_send_pause_advised on current', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'needs_pre_send_pause', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'pre_send_pause_advised')).toMatchObject({ targetMoveId: 'm2' });
  });
});

// ── Debate-mode fit ─────────────────────────────────────────────────

describe('COMP-001 R-DM-01 — mode mismatch', () => {
  it('emits mode_mismatch_warning on current when fits_selected_debate_mode=0', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'fits_selected_debate_mode', value: 0 }]),
    });
    expect(getMutation(result.mutations, 'mode_mismatch_warning')).toMatchObject({ targetMoveId: 'm2' });
  });

  it('does NOT fire when fits_selected_debate_mode=1', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'fits_selected_debate_mode', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'mode_mismatch_warning')).toBeNull();
  });
});

describe('COMP-001 R-DM-02 — playable hot take', () => {
  it('emits playable_hot_take on current', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'contains_playable_hot_take', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'playable_hot_take')).toMatchObject({ targetMoveId: 'm2' });
  });
});

describe('COMP-001 R-DM-03 — satire / parody marker', () => {
  it('emits satire_marker on current', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'is_satire_or_parody', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'satire_marker')).toMatchObject({ targetMoveId: 'm2' });
  });
});

// ── Branch routing + friction ─────────────────────────────────────

describe('COMP-001 R-BR-01 — side branch suggested', () => {
  it('emits side_branch_suggested + branch_route_hint with the edge endpoint', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'suggests_side_branch', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'side_branch_suggested')).toMatchObject({ targetMoveId: 'm2' });
    const edge = getMutation(result.mutations, 'branch_route_hint');
    expect(edge).toMatchObject({ targetMoveId: 'm2', edgeOtherEndpointMoveId: 'm1' });
  });
});

describe('COMP-001 R-BR-02 — diagonal tangent suggested', () => {
  it('emits diagonal_tangent_suggested + tangent_route_hint; abandons an open sub-axis', () => {
    const seeded: CompositionState = {
      ...EMPTY_COMPOSITION_STATE,
      activeSubAxes: new Map([
        ['m1', { openingMoveId: 'm1', parentAxisRootMoveId: 'm1', status: 'open' }],
      ]),
    };
    const result = compose({
      threadState: seeded,
      moveMeta: makeMeta(),
      ancestors: [makeAncestor({ moveId: 'm1' })],
      packet: makePacket([{ classifierId: 'suggests_diagonal_tangent', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'diagonal_tangent_suggested')).toMatchObject({ targetMoveId: 'm2' });
    expect(getMutation(result.mutations, 'tangent_route_hint')).toMatchObject({
      targetMoveId: 'm2',
      edgeOtherEndpointMoveId: 'm1',
    });
    expect(result.nextState.activeSubAxes.get('m1')?.status).toBe('abandoned');
    expect(getMutation(result.mutations, 'sub_axis_abandoned')).toMatchObject({ targetMoveId: 'm1' });
  });
});

describe('COMP-001 R-BR-03 — person shift warning', () => {
  it('emits person_shift_warning + records in personShiftMoves', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'shifts_to_person_or_intent', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'person_shift_warning')).toMatchObject({ targetMoveId: 'm2' });
    expect(result.nextState.personShiftMoves.has('m2')).toBe(true);
  });
});

describe('COMP-001 R-BR-04 — unplayable move', () => {
  it('emits unplayable_move + records in unplayableMoves', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([{ classifierId: 'contains_unplayable_insult_only', value: 1 }]),
    });
    expect(getMutation(result.mutations, 'unplayable_move')).toMatchObject({ targetMoveId: 'm2' });
    expect(result.nextState.unplayableMoves.has('m2')).toBe(true);
  });
});

// ── Multi-rule interaction (rule execution order) ─────────────────

describe('COMP-001 §13 Q3 — rule execution order', () => {
  it('multiple rules accumulate: R-PC-01 + R-EV-01 fire on the same packet', () => {
    const result = compose({
      moveMeta: makeMeta(),
      packet: makePacket([
        { classifierId: 'responds_to_parent', value: 1 },
        { classifierId: 'quote_anchors_parent', value: 1 },
        { classifierId: 'asks_for_evidence', value: 1 },
      ]),
    });
    expect(getMutation(result.mutations, 'parent_engaged_quoted')).not.toBeNull();
    expect(getMutation(result.mutations, 'evidence_debt_opened')).not.toBeNull();
    // The parent-continuity rule fires before the evidence rule (the test
    // verifies stable ordering of the mutation array for snapshot stability).
    const idxPC = result.mutations.findIndex((m) => m.mutation === 'parent_engaged_quoted');
    const idxEV = result.mutations.findIndex((m) => m.mutation === 'evidence_debt_opened');
    expect(idxPC).toBeLessThan(idxEV);
  });
});
