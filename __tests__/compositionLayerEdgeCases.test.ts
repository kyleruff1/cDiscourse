/**
 * COMP-001 §7.3 — Edge case tests for `composeVisualState`.
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
  SemanticClassifierId,
  SemanticRefereePacket,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import {
  ALL_SEMANTIC_CLASSIFIER_IDS,
  PACKET_VERSION,
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
      reasonCode: `${b.classifierId}_test`,
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
  };
}

const META: MoveMetadata = {
  moveId: 'm2',
  parentId: 'm1',
  authorId: 'authorB',
  authorMovePosition: 'subsequent',
};

describe('COMP-001 §7.3 — edge cases', () => {
  it('empty signal vector (all-0 binaries except fits_selected_debate_mode=1) emits zero state-changing mutations', () => {
    // R-DM-01 fires on fits_selected_debate_mode=0 (the "fails to fit" case).
    // For a true zero-mutation packet we set fits_selected_debate_mode=1 so
    // every active rule's "fire on 1" predicate sees a 0 and the "fire on 0"
    // mode-mismatch predicate sees the 1 it needs to NOT fire.
    const zeroLike = ALL_SEMANTIC_CLASSIFIER_IDS.map((id) => ({
      classifierId: id,
      value: (id === 'fits_selected_debate_mode' ? 1 : 0) as 0 | 1,
    }));
    const input: ComposeVisualStateInput = {
      packet: makePacket(zeroLike),
      threadState: EMPTY_COMPOSITION_STATE,
      moveMeta: META,
    };
    const r = composeVisualState(input);
    expect(r.mutations).toHaveLength(0);
    expect(r.nextState.evidenceDebts.size).toBe(0);
    expect(r.nextState.clarificationDebts.size).toBe(0);
    expect(r.nextState.concessionChains.size).toBe(0);
  });

  it('explicit fits_selected_debate_mode=0 fires mode_mismatch_warning by itself', () => {
    // Documents the R-DM-01 rule shape: the warning is only suppressed when
    // the classifier explicitly returns "fits=1". A packet that omits the
    // id altogether (the binary defaults to 0) is treated as "fails to fit"
    // — this is intentional and visible to the rule via signalLookup.has.
    const r = composeVisualState({
      moveMeta: META,
      threadState: EMPTY_COMPOSITION_STATE,
      packet: makePacket([{ classifierId: 'fits_selected_debate_mode', value: 0 }]),
    });
    expect(r.mutations.some((m) => m.mutation === 'mode_mismatch_warning')).toBe(true);
  });

  it('all-1s signal vector — every active rule fires; mutations accumulate sanely', () => {
    const allOnes = ALL_SEMANTIC_CLASSIFIER_IDS.map(
      (id) => ({ classifierId: id, value: 1 as const }),
    );
    const ancestors: AncestorMoveSummary[] = [
      { moveId: 'm1', parentId: null, authorId: 'authorA' },
    ];
    const input: ComposeVisualStateInput = {
      packet: makePacket(allOnes),
      threadState: EMPTY_COMPOSITION_STATE,
      moveMeta: META,
      ancestors,
    };
    const r = composeVisualState(input);
    // Many rules fire; the mutation count is positive but bounded.
    expect(r.mutations.length).toBeGreaterThan(10);
    // The resulting state is consistent — no rule produced an undefined target.
    for (const m of r.mutations) {
      expect(typeof m.targetMoveId).toBe('string');
      expect(m.targetMoveId.length).toBeGreaterThan(0);
    }
  });

  it('root move (parentId === null): R-EX-01 fires; no cross-node mutations', () => {
    const r = composeVisualState({
      moveMeta: { ...META, moveId: 'm1', parentId: null },
      threadState: EMPTY_COMPOSITION_STATE,
    });
    expect(r.mutations).toHaveLength(1);
    expect(r.mutations[0].mutation).toBe('opening_claim_marker');
    expect(r.mutations[0].targetMoveId).toBe('m1');
  });

  it('first-move-by-author: R-EX-02 fires; no composition-layer mutations even with a packet', () => {
    const r = composeVisualState({
      moveMeta: { ...META, authorMovePosition: 'first' },
      threadState: EMPTY_COMPOSITION_STATE,
      packet: makePacket([
        { classifierId: 'asks_for_evidence', value: 1 },
        { classifierId: 'narrows_claim', value: 1 },
      ]),
    });
    expect(r.mutations).toHaveLength(0);
  });

  it('parent soft-deleted (composition layer indifferent): mutations target the deleted parent', () => {
    // The composition layer does not know about deletion state. The render
    // layer is responsible for suppression. We exercise the layer with a
    // packet that targets a parent the caller has not flagged.
    const r = composeVisualState({
      moveMeta: META,
      threadState: EMPTY_COMPOSITION_STATE,
      packet: makePacket([{ classifierId: 'asks_for_evidence', value: 1 }]),
    });
    expect(r.mutations.find((m) => m.targetMoveId === 'm1' && m.mutation === 'evidence_debt_opened')).toBeTruthy();
  });

  it('no packet (classification disabled or fallback): the layer returns empty mutations + unchanged state', () => {
    const r = composeVisualState({
      moveMeta: META,
      threadState: EMPTY_COMPOSITION_STATE,
    });
    expect(r.mutations).toHaveLength(0);
  });

  it('multiple open evidence debts in a chain — R-EV-02 resolves the most-recent matching debt', () => {
    const seeded: CompositionState = {
      ...EMPTY_COMPOSITION_STATE,
      evidenceDebts: new Map([
        ['old', { openingMoveId: 'old', targetMoveId: 'm1', openingAuthorId: 'authorA', status: 'open' }],
        ['new', { openingMoveId: 'new', targetMoveId: 'm1', openingAuthorId: 'authorB', status: 'open' }],
      ]),
    };
    const r = composeVisualState({
      moveMeta: { ...META, moveId: 'm5' },
      threadState: seeded,
      ancestors: [{ moveId: 'm1', parentId: null, authorId: 'authorA' }],
      packet: makePacket([
        { classifierId: 'provides_evidence', value: 1 },
        { classifierId: 'evidence_supports_claim', value: 1 },
      ]),
    });
    // Most-recent debt is the one inserted last ('new') — it should be resolved.
    expect(r.nextState.evidenceDebts.get('new')?.status).toBe('resolved');
    expect(r.nextState.evidenceDebts.get('old')?.status).toBe('open');
  });

  it('retraction citation against a move with no preceding evidence: only retraction_cited fires', () => {
    const r = composeVisualState({
      moveMeta: META,
      threadState: EMPTY_COMPOSITION_STATE,
      ancestors: [{ moveId: 'm1', parentId: null, authorId: 'authorA' }],
      packet: makePacket([{ classifierId: 'cites_retraction', value: 1 }]),
    });
    expect(r.mutations.find((m) => m.mutation === 'retraction_cited')).toBeTruthy();
    expect(r.mutations.find((m) => m.mutation === 'evidence_retracted')).toBeFalsy();
  });
});
