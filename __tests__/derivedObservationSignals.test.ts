/**
 * FEEDBACK-002 (#899) — the derivation matrix.
 *
 * One describe per composition code 5.1-5.7. Each has the happy-path fixture
 * that fires the signal, plus one negative fixture per predicate atom removed
 * (proving the AND-gates). Scope / consumers / provenance are asserted on the
 * happy paths.
 */
import {
  deriveDerivedObservationSignals,
  type DerivedSignal,
  type DerivedSignalCode,
} from '../src/features/feedbackFlags/derivedObservationSignals';
import { baseInput, node, obs, debt, mark } from './derivedSignalsTestKit';

function codes(signals: readonly DerivedSignal[]): DerivedSignalCode[] {
  return signals.map((s) => s.code);
}
function firstOf(signals: readonly DerivedSignal[], code: DerivedSignalCode): DerivedSignal | undefined {
  return signals.find((s) => s.code === code);
}

describe('FEEDBACK-002 5.1 — proof_moment (B x D x F x marks; own move only)', () => {
  const M = node({ argumentId: 'M', actor: 'self', ordinal: 0, branchRootId: 'M' });
  const R = node({ argumentId: 'R', parentId: 'M', actor: 'other', ordinal: 1, branchRootId: 'M' });

  it('fires on the own move when a child disagrees on facts + a D-flag is present', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [M, R],
        observationsByArgumentId: { M: obs('needs_a_receipt'), R: obs('disagrees_on_facts') },
      }),
    );
    const sig = firstOf(out, 'proof_moment');
    expect(sig).toBeDefined();
    expect(sig!.scope).toEqual({ kind: 'node', argumentId: 'M' });
    expect(sig!.consumers).toContain('inspect_advisory_line');
    expect(sig!.consumers).toContain('proof_button_pulse');
    expect(sig!.provenance.contributingFlagKeys).toContain('disagrees_on_facts');
    expect(sig!.provenance.heatBand).toBeNull();
  });

  it('fires via an open source debt instead of a D-flag', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [M, R],
        observationsByArgumentId: { R: obs('disagrees_on_facts') },
        evidenceDebts: [debt({ nodeId: 'M', status: 'requested', debtKind: 'source' })],
      }),
    );
    expect(codes(out)).toContain('proof_moment');
  });

  it('fires via a receipts_requested mark instead of a D-flag', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [M, R],
        observationsByArgumentId: { R: obs('disagrees_on_facts') },
        moveMarks: [mark({ argumentId: 'M', markCode: 'receipts_requested' })],
      }),
    );
    const sig = firstOf(out, 'proof_moment');
    expect(sig).toBeDefined();
    expect(sig!.provenance.contributingMarkCodes).toContain('receipts_requested');
  });

  it('does NOT fire without a fact-disagreement child', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({ nodes: [M, R], observationsByArgumentId: { M: obs('needs_a_receipt') } }),
    );
    expect(codes(out)).not.toContain('proof_moment');
  });

  it('does NOT fire on a move that is not the viewer own (actor other)', () => {
    const other = node({ argumentId: 'M', actor: 'other', ordinal: 0, branchRootId: 'M' });
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [other, R],
        observationsByArgumentId: { M: obs('needs_a_receipt'), R: obs('disagrees_on_facts') },
      }),
    );
    expect(codes(out)).not.toContain('proof_moment');
  });

  it('does NOT fire with no D-flag, no open debt, and no receipts mark', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({ nodes: [M, R], observationsByArgumentId: { R: obs('disagrees_on_facts') } }),
    );
    expect(codes(out)).not.toContain('proof_moment');
  });
});

describe('FEEDBACK-002 5.2 — hot_but_proof_light (heat x D x debts; room)', () => {
  const N = node({ argumentId: 'N', ordinal: 0, branchRootId: 'N' });

  it('fires when the room is hot, no receipts brought, and >=1 open source debt', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [N],
        heatBand: 'hot',
        evidenceDebts: [debt({ nodeId: 'N', status: 'requested', debtKind: 'source' })],
      }),
    );
    const sig = firstOf(out, 'hot_but_proof_light');
    expect(sig).toBeDefined();
    expect(sig!.scope).toEqual({ kind: 'room', debateId: 'debate-1' });
    expect(sig!.consumers).toEqual(['gallery_bucket']);
    expect(sig!.provenance.heatBand).toBe('hot');
  });

  it('does NOT fire when heat is not hot', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [N],
        heatBand: 'active',
        evidenceDebts: [debt({ nodeId: 'N', status: 'requested', debtKind: 'source' })],
      }),
    );
    expect(codes(out)).not.toContain('hot_but_proof_light');
  });

  it('does NOT fire when receipts were brought in the window', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [N],
        heatBand: 'hot',
        observationsByArgumentId: { N: obs('brought_receipts') },
        evidenceDebts: [debt({ nodeId: 'N', status: 'requested', debtKind: 'source' })],
      }),
    );
    expect(codes(out)).not.toContain('hot_but_proof_light');
  });

  it('does NOT fire when there is no open debt', () => {
    const out = deriveDerivedObservationSignals(baseInput({ nodes: [N], heatBand: 'hot' }));
    expect(codes(out)).not.toContain('hot_but_proof_light');
  });
});

describe('FEEDBACK-002 5.3 — talking_past (C x B x H, both sides; thread)', () => {
  const A = node({ argumentId: 'A', branchRootId: 'P', side: 'affirmative', ordinal: 0 });
  const B = node({ argumentId: 'B', parentId: 'A', branchRootId: 'P', side: 'negative', ordinal: 1 });

  it('fires when C + B + H are present across both sides of one thread', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [A, B],
        observationsByArgumentId: {
          A: obs('asks_for_clarification'),
          B: obs('disagrees_on_scope', 'could_be_more_specific'),
        },
      }),
    );
    const sig = firstOf(out, 'talking_past');
    expect(sig).toBeDefined();
    expect(sig!.scope.kind).toBe('thread');
    if (sig!.scope.kind === 'thread') {
      expect(sig!.scope.pointId).toBe('P');
      expect(sig!.scope.memberArgumentIds).toEqual(['A', 'B']);
    }
    expect(sig!.consumers).toContain('mediator_rail_line');
  });

  it('does NOT fire without the clarification (C) atom', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [A, B],
        observationsByArgumentId: { B: obs('disagrees_on_scope', 'could_be_more_specific') },
      }),
    );
    expect(codes(out)).not.toContain('talking_past');
  });

  it('does NOT fire without the scope-disagreement (B) atom', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [A, B],
        observationsByArgumentId: { A: obs('asks_for_clarification'), B: obs('could_be_more_specific') },
      }),
    );
    expect(codes(out)).not.toContain('talking_past');
  });

  it('does NOT fire without the specificity/hedge (H) atom', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [A, B],
        observationsByArgumentId: { A: obs('asks_for_clarification'), B: obs('disagrees_on_scope') },
      }),
    );
    expect(codes(out)).not.toContain('talking_past');
  });

  it('does NOT fire when the signals come from only one side', () => {
    const bSameSide = node({ argumentId: 'B', parentId: 'A', branchRootId: 'P', side: 'affirmative', ordinal: 1 });
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [A, bSameSide],
        observationsByArgumentId: {
          A: obs('asks_for_clarification'),
          B: obs('disagrees_on_scope', 'could_be_more_specific'),
        },
      }),
    );
    expect(codes(out)).not.toContain('talking_past');
  });
});

describe('FEEDBACK-002 5.4 — resolution_window (G x F x debts; node)', () => {
  const N = node({ argumentId: 'N', ordinal: 0, branchRootId: 'N' });

  it('fires on the G-flagged node with no open question and <=1 open debt', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({ nodes: [N], observationsByArgumentId: { N: obs('synthesis_on_the_table') } }),
    );
    const sig = firstOf(out, 'resolution_window');
    expect(sig).toBeDefined();
    expect(sig!.scope).toEqual({ kind: 'node', argumentId: 'N' });
    expect(sig!.consumers).toContain('state_rail_line');
  });

  it('does NOT fire when an unanswered question is open in the room', () => {
    const q = node({ argumentId: 'Q', ordinal: 1, branchRootId: 'Q' });
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [N, q],
        observationsByArgumentId: { N: obs('synthesis_on_the_table'), Q: obs('unanswered_question') },
      }),
    );
    expect(codes(out)).not.toContain('resolution_window');
  });

  it('does NOT fire when more than one debt is open', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [N],
        observationsByArgumentId: { N: obs('synthesis_on_the_table') },
        evidenceDebts: [
          debt({ id: 'd1', nodeId: 'N', status: 'requested', debtKind: 'source' }),
          debt({ id: 'd2', nodeId: 'N', status: 'challenged', debtKind: 'quote' }),
        ],
      }),
    );
    expect(codes(out)).not.toContain('resolution_window');
  });

  it('does NOT fire without any G flag', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({ nodes: [N], observationsByArgumentId: {} }),
    );
    expect(codes(out)).not.toContain('resolution_window');
  });
});

describe('FEEDBACK-002 5.5 — callback_worthy (E x G x A; node)', () => {
  const X = node({ argumentId: 'X', ordinal: 0, branchRootId: 'X' });
  const Y = node({ argumentId: 'Y', ordinal: 1, branchRootId: 'X' });

  it('fires when a callback+pattern move precedes a later concession', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [X, Y],
        observationsByArgumentId: {
          X: obs('callback_material', 'names_the_pattern'),
          Y: obs('clean_concession'),
        },
      }),
    );
    const sig = firstOf(out, 'callback_worthy');
    expect(sig).toBeDefined();
    expect(sig!.scope).toEqual({ kind: 'node', argumentId: 'X' });
    expect(sig!.consumers).toContain('linked_prior_ordering');
  });

  it('does NOT fire without a later concession/common-ground move', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [X, Y],
        observationsByArgumentId: { X: obs('callback_material', 'names_the_pattern') },
      }),
    );
    expect(codes(out)).not.toContain('callback_worthy');
  });

  it('does NOT fire without callback_material on the anchor', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [X, Y],
        observationsByArgumentId: { X: obs('names_the_pattern'), Y: obs('clean_concession') },
      }),
    );
    expect(codes(out)).not.toContain('callback_worthy');
  });

  it('does NOT fire without an E pattern/comparison on the anchor', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [X, Y],
        observationsByArgumentId: { X: obs('callback_material'), Y: obs('clean_concession') },
      }),
    );
    expect(codes(out)).not.toContain('callback_worthy');
  });
});

describe('FEEDBACK-002 5.6 — own_tension_hint (A x B, self, composer-only)', () => {
  const X = node({ argumentId: 'X', ordinal: 0, branchRootId: 'X', actor: 'self' });
  const T = node({ argumentId: 'T', ordinal: 1, branchRootId: 'T' });
  const draftContext = {
    draftAuthorId: 'viewer-1',
    targetArgumentId: 'T',
    relationToTarget: 'builds_on' as const,
    priorOwnNodeIds: ['X'],
  };

  it('fires (composer-only) when a builds-on draft cuts against an earlier disagreement', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [X, T],
        observationsByArgumentId: { X: obs('disagrees_on_scope') },
        draftContext,
      }),
    );
    const sig = firstOf(out, 'own_tension_hint');
    expect(sig).toBeDefined();
    expect(sig!.composerOnly).toBe(true);
    expect(sig!.consumers).toEqual(['composer_whisper']);
    expect(sig!.scope).toEqual({ kind: 'node', argumentId: 'T' });
  });

  it('does NOT fire without a draft context', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({ nodes: [X, T], observationsByArgumentId: { X: obs('disagrees_on_scope') } }),
    );
    expect(codes(out)).not.toContain('own_tension_hint');
  });

  it('does NOT fire when the draft is not a builds-on', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [X, T],
        observationsByArgumentId: { X: obs('disagrees_on_scope') },
        draftContext: { ...draftContext, relationToTarget: 'disagrees' },
      }),
    );
    expect(codes(out)).not.toContain('own_tension_hint');
  });

  it('does NOT fire when no prior own node carries a disagreement', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({ nodes: [X, T], draftContext }),
    );
    expect(codes(out)).not.toContain('own_tension_hint');
  });
});

describe('FEEDBACK-002 5.7 — dodge_chain (marks x A; thread)', () => {
  const A = node({ argumentId: 'A', branchRootId: 'P', ordinal: 0 });
  const B = node({ argumentId: 'B', parentId: 'A', branchRootId: 'P', ordinal: 1 });

  it('fires when >=2 unaddressed moves on one thread while replies attach elsewhere', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [A, B],
        observationsByArgumentId: { A: obs('direct_challenge') },
        moveMarks: [
          mark({ argumentId: 'A', markCode: 'did_not_address' }),
          mark({ argumentId: 'B', markCode: 'did_not_address' }),
        ],
      }),
    );
    const sig = firstOf(out, 'dodge_chain');
    expect(sig).toBeDefined();
    expect(sig!.scope.kind).toBe('thread');
    if (sig!.scope.kind === 'thread') {
      expect(sig!.scope.pointId).toBe('P');
      expect(sig!.scope.memberArgumentIds).toEqual(['A', 'B']);
    }
    expect(sig!.provenance.contributingMarkCodes).toEqual(['did_not_address']);
  });

  it('does NOT fire with only one unaddressed move', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [A, B],
        observationsByArgumentId: { A: obs('direct_challenge') },
        moveMarks: [mark({ argumentId: 'A', markCode: 'did_not_address' })],
      }),
    );
    expect(codes(out)).not.toContain('dodge_chain');
  });

  it('does NOT fire when no A-family reply attaches elsewhere', () => {
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [A, B],
        moveMarks: [
          mark({ argumentId: 'A', markCode: 'did_not_address' }),
          mark({ argumentId: 'B', markCode: 'did_not_address' }),
        ],
      }),
    );
    expect(codes(out)).not.toContain('dodge_chain');
  });

  it('does NOT fire when the two unaddressed moves are on different threads', () => {
    const b2 = node({ argumentId: 'B', parentId: null, branchRootId: 'Q', ordinal: 1 });
    const out = deriveDerivedObservationSignals(
      baseInput({
        nodes: [A, b2],
        observationsByArgumentId: { A: obs('direct_challenge'), B: obs('direct_challenge') },
        moveMarks: [
          mark({ argumentId: 'A', markCode: 'did_not_address' }),
          mark({ argumentId: 'B', markCode: 'did_not_address' }),
        ],
      }),
    );
    expect(codes(out)).not.toContain('dodge_chain');
  });
});

describe('FEEDBACK-002 — empty room', () => {
  it('returns a frozen empty array with no nodes', () => {
    const out = deriveDerivedObservationSignals(baseInput());
    expect(out).toEqual([]);
    expect(Object.isFrozen(out)).toBe(true);
  });
});
