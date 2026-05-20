/**
 * RULE-005 — suggestChannelFromDraft + deriveChannelForPostedMove tests.
 *
 * A row-per-rule table for the 6-rule deterministic derivation order plus
 * the render-time reverse map. Asserts each rule fires for a crafted input
 * and produces the expected { suggested, reason, confidence }; covers root
 * draft, parent-demands-evidence, lifecycle-state, isMismatch behaviour,
 * determinism, and forward/reverse parity.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  suggestChannelFromDraft,
  deriveChannelForPostedMove,
  type SuggestChannelDraftInput,
  type SuggestChannelParentInput,
  type MoveChannel,
} from '../src/features/arguments/channelModel';
import type {
  PointLifecycleSnapshot,
  PointLifecycleClusterSummary,
  PointLifecycleState,
} from '../src/features/lifecycle';

// ── Fixtures ───────────────────────────────────────────────────

function emptyParent(): SuggestChannelParentInput {
  return { parentSnapshot: null, parentClusterSummary: null, parentLinkage: null };
}

function draft(over: Partial<SuggestChannelDraftInput> = {}): SuggestChannelDraftInput {
  return {
    argumentType: null,
    disagreementAxis: null,
    draftTagCodes: [],
    currentChannel: null,
    ...over,
  };
}

function snapshot(contribution: PointLifecycleState): PointLifecycleSnapshot {
  return {
    messageId: 'm1',
    clusterId: 'c1',
    clusterState: contribution,
    messageContribution: contribution,
    axis: null,
    opensRequest: contribution === 'source_requested' || contribution === 'quote_requested',
    resolvesRequest: false,
    isConcessionShape: contribution === 'conceded' || contribution === 'narrowed',
    isSynthesisShape: contribution === 'synthesis_ready',
    plainLabel: contribution,
  };
}

function cluster(
  state: PointLifecycleState,
  hasOpenSourceOrQuoteRequest = false,
): PointLifecycleClusterSummary {
  return {
    clusterId: 'c1',
    rootMessageId: 'm1',
    state,
    plainLabel: state,
    messageIds: ['m1'],
    memberCount: 1,
    affirmativeMoveCount: 1,
    negativeMoveCount: 0,
    observerMoveCount: 0,
    hasOpenSourceOrQuoteRequest,
    hasConcessionOrSynthesisMove: false,
    worstEvidenceStatus: 'no_source',
    primaryAxis: null,
    isAdvisory: false,
  };
}

// ── Rule 1 — deterministic_match / high ────────────────────────

describe('RULE-005 suggestChannelFromDraft — rule 1 deterministic_match', () => {
  const rows: Array<{
    type: SuggestChannelDraftInput['argumentType'];
    tags: string[];
    expected: MoveChannel;
  }> = [
    { type: 'evidence', tags: [], expected: 'add_evidence' },
    { type: 'synthesis', tags: [], expected: 'synthesize' },
    { type: 'concession', tags: ['concede_broad_point'], expected: 'concede' },
    { type: 'concession', tags: ['narrow_scope'], expected: 'narrow' },
    { type: 'concession', tags: ['concede_small_point'], expected: 'narrow' },
    { type: 'concession', tags: [], expected: 'concede' },
    { type: 'clarification_request', tags: ['ask_receipts'], expected: 'ask_source' },
    { type: 'clarification_request', tags: ['source_request'], expected: 'ask_source' },
    { type: 'clarification_request', tags: ['quote_exact_bit'], expected: 'ask_quote' },
    { type: 'clarification_request', tags: ['quote_request'], expected: 'ask_quote' },
    { type: 'clarification_request', tags: [], expected: 'clarify' },
    { type: 'rebuttal', tags: [], expected: 'challenge' },
    { type: 'counter_rebuttal', tags: [], expected: 'challenge' },
    { type: 'claim', tags: ['pure_accept'], expected: 'confirm' },
    { type: 'claim', tags: [], expected: 'reply' },
  ];

  for (const row of rows) {
    it(`type=${row.type} tags=[${row.tags.join(',')}] → ${row.expected}`, () => {
      const s = suggestChannelFromDraft(
        draft({ argumentType: row.type, draftTagCodes: row.tags }),
        emptyParent(),
        'casual',
      );
      expect(s.suggested).toBe(row.expected);
      expect(s.reason).toBe('deterministic_match');
      expect(s.confidence).toBe('high');
    });
  }
});

// ── Rule 2 — deterministic_match / medium (tangent) ────────────

describe('RULE-005 suggestChannelFromDraft — rule 2 tangent qualifier', () => {
  for (const tag of ['branch_this_off', 'tangent_or_joke', 'tangent']) {
    it(`tag ${tag} (no type) → branch_tangent / medium`, () => {
      const s = suggestChannelFromDraft(
        draft({ argumentType: null, draftTagCodes: [tag] }),
        emptyParent(),
        'casual',
      );
      expect(s.suggested).toBe('branch_tangent');
      expect(s.reason).toBe('deterministic_match');
      expect(s.confidence).toBe('medium');
    });
  }
});

// ── Rule 3 — parent_demands_evidence / high ────────────────────

describe('RULE-005 suggestChannelFromDraft — rule 3 parent demands evidence', () => {
  it('parent snapshot source_requested → add_evidence / high', () => {
    const s = suggestChannelFromDraft(
      draft(),
      { parentSnapshot: snapshot('source_requested'), parentClusterSummary: null, parentLinkage: null },
      'casual',
    );
    expect(s.suggested).toBe('add_evidence');
    expect(s.reason).toBe('parent_demands_evidence');
    expect(s.confidence).toBe('high');
  });

  it('parent snapshot quote_requested → add_evidence / high', () => {
    const s = suggestChannelFromDraft(
      draft(),
      { parentSnapshot: snapshot('quote_requested'), parentClusterSummary: null, parentLinkage: null },
      'casual',
    );
    expect(s.suggested).toBe('add_evidence');
    expect(s.reason).toBe('parent_demands_evidence');
  });

  it('cluster hasOpenSourceOrQuoteRequest → add_evidence / high', () => {
    const s = suggestChannelFromDraft(
      draft(),
      { parentSnapshot: null, parentClusterSummary: cluster('rebutted', true), parentLinkage: null },
      'casual',
    );
    expect(s.suggested).toBe('add_evidence');
    expect(s.reason).toBe('parent_demands_evidence');
  });

  it('rule 1 wins over rule 3 when both point at add_evidence (no contradiction)', () => {
    // Draft typed as evidence + parent asking for a source → both suggest
    // add_evidence; rule 1 fires first so reason is deterministic_match.
    const s = suggestChannelFromDraft(
      draft({ argumentType: 'evidence' }),
      { parentSnapshot: snapshot('source_requested'), parentClusterSummary: null, parentLinkage: null },
      'casual',
    );
    expect(s.suggested).toBe('add_evidence');
    expect(s.reason).toBe('deterministic_match');
    expect(s.isMismatch).toBe(false);
  });
});

// ── Rule 4 — lifecycle_state / medium ──────────────────────────

describe('RULE-005 suggestChannelFromDraft — rule 4 lifecycle state', () => {
  const rows: Array<{ state: PointLifecycleState; expected: MoveChannel }> = [
    { state: 'branch_recommended', expected: 'branch_tangent' },
    { state: 'synthesis_ready', expected: 'synthesize' },
    { state: 'rebutted', expected: 'challenge' },
    { state: 'narrowed', expected: 'synthesize' },
    { state: 'conceded', expected: 'confirm' },
    { state: 'confirmed', expected: 'synthesize' },
  ];
  for (const row of rows) {
    it(`cluster state ${row.state} → ${row.expected} / lifecycle_state / medium`, () => {
      const s = suggestChannelFromDraft(
        draft(),
        { parentSnapshot: null, parentClusterSummary: cluster(row.state), parentLinkage: null },
        'casual',
      );
      expect(s.suggested).toBe(row.expected);
      expect(s.reason).toBe('lifecycle_state');
      expect(s.confidence).toBe('medium');
    });
  }
});

// ── Rule 5 — lifecycle_state / low ─────────────────────────────

describe('RULE-005 suggestChannelFromDraft — rule 5 plain reply', () => {
  for (const state of ['open', 'answered', 'clarified'] as PointLifecycleState[]) {
    it(`cluster state ${state} (no directed move) → reply / lifecycle_state / low`, () => {
      const s = suggestChannelFromDraft(
        draft(),
        { parentSnapshot: null, parentClusterSummary: cluster(state), parentLinkage: null },
        'casual',
      );
      expect(s.suggested).toBe('reply');
      expect(s.reason).toBe('lifecycle_state');
      expect(s.confidence).toBe('low');
    });
  }
});

// ── Rule 6 — no_signal / low (root draft) ──────────────────────

describe('RULE-005 suggestChannelFromDraft — rule 6 no signal', () => {
  it('root draft, no type, no parent → reply / no_signal / low', () => {
    const s = suggestChannelFromDraft(draft(), emptyParent(), 'casual');
    expect(s.suggested).toBe('reply');
    expect(s.reason).toBe('no_signal');
    expect(s.confidence).toBe('low');
  });

  it('a root thesis draft still resolves via rule 1 (thesis → reply)', () => {
    const s = suggestChannelFromDraft(draft({ argumentType: 'thesis' }), emptyParent(), 'casual');
    expect(s.suggested).toBe('reply');
    expect(s.reason).toBe('deterministic_match');
  });
});

// ── isMismatch ─────────────────────────────────────────────────

describe('RULE-005 suggestChannelFromDraft — isMismatch', () => {
  it('isMismatch is false when currentChannel is null', () => {
    const s = suggestChannelFromDraft(draft({ currentChannel: null }), emptyParent(), 'casual');
    expect(s.isMismatch).toBe(false);
  });

  it('isMismatch is false when currentChannel equals the suggestion', () => {
    const s = suggestChannelFromDraft(
      draft({ argumentType: 'evidence', currentChannel: 'add_evidence' }),
      emptyParent(),
      'casual',
    );
    expect(s.isMismatch).toBe(false);
  });

  it('isMismatch is true when currentChannel differs from the suggestion', () => {
    // Draft typed clarify, user picked challenge → mismatch.
    const s = suggestChannelFromDraft(
      draft({ argumentType: 'clarification_request', currentChannel: 'challenge' }),
      emptyParent(),
      'casual',
    );
    expect(s.suggested).toBe('clarify');
    expect(s.isMismatch).toBe(true);
  });
});

// ── Rationale ──────────────────────────────────────────────────

describe('RULE-005 suggestChannelFromDraft — rationale', () => {
  it('every suggestion carries a non-empty rationale string', () => {
    const cases: ChannelCase[] = [
      { d: draft({ argumentType: 'evidence' }), p: emptyParent() },
      { d: draft(), p: emptyParent() },
      {
        d: draft(),
        p: { parentSnapshot: snapshot('source_requested'), parentClusterSummary: null, parentLinkage: null },
      },
      {
        d: draft(),
        p: { parentSnapshot: null, parentClusterSummary: cluster('branch_recommended'), parentLinkage: null },
      },
    ];
    for (const c of cases) {
      const s = suggestChannelFromDraft(c.d, c.p, 'casual');
      expect(typeof s.rationale).toBe('string');
      expect(s.rationale.trim().length).toBeGreaterThan(0);
    }
  });

  it('a branch_tangent suggestion gets its own non-punitive rationale', () => {
    const s = suggestChannelFromDraft(
      draft({ draftTagCodes: ['tangent'] }),
      emptyParent(),
      'casual',
    );
    expect(s.suggested).toBe('branch_tangent');
    expect(s.rationale.toLowerCase()).not.toContain('dodge');
    expect(s.rationale.toLowerCase()).not.toContain('evad');
  });
});

interface ChannelCase {
  d: SuggestChannelDraftInput;
  p: SuggestChannelParentInput;
}

// ── Determinism ────────────────────────────────────────────────

describe('RULE-005 suggestChannelFromDraft — determinism', () => {
  it('the same input produces a structurally-equal output twice', () => {
    const d = draft({ argumentType: 'rebuttal' });
    const p = { parentSnapshot: null, parentClusterSummary: cluster('rebutted', true), parentLinkage: null };
    const a = suggestChannelFromDraft(d, p, 'casual');
    const b = suggestChannelFromDraft(d, p, 'casual');
    expect(a).toEqual(b);
  });

  it('the v1 mode parameter never changes the suggestion', () => {
    const d = draft({ argumentType: 'evidence' });
    const casual = suggestChannelFromDraft(d, emptyParent(), 'casual');
    const strict = suggestChannelFromDraft(d, emptyParent(), 'strict');
    expect(strict.suggested).toBe(casual.suggested);
    expect(strict.reason).toBe(casual.reason);
    expect(strict.confidence).toBe(casual.confidence);
  });
});

// ── deriveChannelForPostedMove — reverse map ───────────────────

describe('RULE-005 deriveChannelForPostedMove — reverse map', () => {
  it('maps an evidence-type posted move to add_evidence', () => {
    expect(
      deriveChannelForPostedMove({
        messageContribution: 'sourced',
        qualifierCodes: [],
        argumentTypeLabel: 'evidence',
      }),
    ).toBe('add_evidence');
  });

  it('maps a rebuttal-type posted move to challenge', () => {
    expect(
      deriveChannelForPostedMove({
        messageContribution: 'rebutted',
        qualifierCodes: [],
        argumentTypeLabel: 'rebuttal',
      }),
    ).toBe('challenge');
  });

  it('reverse-map parity with rule 1 for the core type → channel mappings', () => {
    const pairs: Array<{ label: string; expected: MoveChannel }> = [
      { label: 'evidence', expected: 'add_evidence' },
      { label: 'synthesis', expected: 'synthesize' },
      { label: 'concession', expected: 'concede' },
      { label: 'rebuttal', expected: 'challenge' },
      { label: 'counter_rebuttal', expected: 'challenge' },
      { label: 'clarification_request', expected: 'clarify' },
      { label: 'claim', expected: 'reply' },
    ];
    for (const pair of pairs) {
      const forward = suggestChannelFromDraft(
        draft({ argumentType: pair.label as SuggestChannelDraftInput['argumentType'] }),
        emptyParent(),
        'casual',
      ).suggested;
      const reverse = deriveChannelForPostedMove({
        messageContribution: 'answered',
        qualifierCodes: [],
        argumentTypeLabel: pair.label,
      });
      expect(reverse).toBe(forward);
      expect(reverse).toBe(pair.expected);
    }
  });

  it('uses the lifecycle contribution when the type label is unknown', () => {
    expect(
      deriveChannelForPostedMove({
        messageContribution: 'source_requested',
        qualifierCodes: [],
        argumentTypeLabel: 'something_unknown',
      }),
    ).toBe('ask_source');
  });

  it('falls back to reply for an unknown type and a neutral contribution', () => {
    expect(
      deriveChannelForPostedMove({
        messageContribution: 'open',
        qualifierCodes: [],
        argumentTypeLabel: '',
      }),
    ).toBe('reply');
  });

  it('disambiguates a clarification_request posted move by qualifier code', () => {
    expect(
      deriveChannelForPostedMove({
        messageContribution: 'answered',
        qualifierCodes: ['quote_request'],
        argumentTypeLabel: 'clarification_request',
      }),
    ).toBe('ask_quote');
  });
});
