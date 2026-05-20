/**
 * RULE-005 — advisory-not-block + no-body-inspection guarantee.
 *
 * Doctrine §1 — a channel suggestion is ADVISORY. It never blocks a post.
 * Doctrine §2/§3 — the suggestion is structural: it never reads heat,
 * popularity, reply counts as popularity, or any engagement signal.
 *
 * Asserts:
 *   - ChannelSuggestion has no blocking / structuralBlock field.
 *   - A "keyword-only" mismatch yields isMismatch:true + a non-empty
 *     rationale and nothing that prevents posting.
 *   - The model's input type carries no body-text field — the model
 *     structurally cannot keyword-block.
 *   - Two structurally-identical parents with different (mock) heat /
 *     reply counts produce the SAME suggestion.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  suggestChannelFromDraft,
  type SuggestChannelDraftInput,
  type SuggestChannelParentInput,
  type ChannelSuggestion,
} from '../src/features/arguments/channelModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleState,
} from '../src/features/lifecycle';

function draft(over: Partial<SuggestChannelDraftInput> = {}): SuggestChannelDraftInput {
  return {
    argumentType: null,
    disagreementAxis: null,
    draftTagCodes: [],
    currentChannel: null,
    ...over,
  };
}

function cluster(
  state: PointLifecycleState,
  counts: { aff: number; neg: number; obs: number; members: number },
): PointLifecycleClusterSummary {
  return {
    clusterId: 'c1',
    rootMessageId: 'm1',
    state,
    plainLabel: state,
    messageIds: ['m1'],
    memberCount: counts.members,
    affirmativeMoveCount: counts.aff,
    negativeMoveCount: counts.neg,
    observerMoveCount: counts.obs,
    hasOpenSourceOrQuoteRequest: false,
    hasConcessionOrSynthesisMove: false,
    worstEvidenceStatus: 'no_source',
    primaryAxis: null,
    isAdvisory: false,
  };
}

const emptyParent: SuggestChannelParentInput = {
  parentSnapshot: null,
  parentClusterSummary: null,
  parentLinkage: null,
};

describe('RULE-005 channel — advisory, never a block', () => {
  it('ChannelSuggestion has no structuralBlock / blocking field', () => {
    const s: ChannelSuggestion = suggestChannelFromDraft(draft(), emptyParent, 'casual');
    const keys = Object.keys(s);
    expect(keys).toEqual(
      expect.arrayContaining(['suggested', 'reason', 'confidence', 'rationale', 'isMismatch']),
    );
    expect(keys).not.toContain('structuralBlock');
    expect(keys).not.toContain('blocked');
    expect(keys).not.toContain('blocking');
    expect(keys).not.toContain('canPost');
    expect(keys).not.toContain('preventPost');
  });

  it('a keyword-only mismatch flags isMismatch but does not block posting', () => {
    // Draft type says clarify; the user picked challenge → mismatch only.
    const s = suggestChannelFromDraft(
      draft({ argumentType: 'clarification_request', currentChannel: 'challenge' }),
      emptyParent,
      'casual',
    );
    expect(s.isMismatch).toBe(true);
    expect(s.rationale.trim().length).toBeGreaterThan(0);
    // There is no field on the suggestion that could prevent a post.
    expect('structuralBlock' in s).toBe(false);
  });
});

describe('RULE-005 channel — no body-text inspection', () => {
  it('the draft input shape carries no body field (structural guarantee)', () => {
    // The model never receives a body string — it cannot keyword-block.
    const d = draft({ argumentType: 'evidence' });
    expect('body' in d).toBe(false);
    expect('text' in d).toBe(false);
    expect('draftBody' in d).toBe(false);
    const s = suggestChannelFromDraft(d, emptyParent, 'casual');
    expect(s.suggested).toBe('add_evidence');
  });
});

describe('RULE-005 channel — heat / popularity never change the suggestion (doctrine §2/§3)', () => {
  it('two parents identical in structure but different in activity counts give the same suggestion', () => {
    // Same lifecycle state; wildly different move counts (a proxy for
    // "heat" / engagement). The suggestion must be identical.
    const quiet = cluster('rebutted', { aff: 1, neg: 1, obs: 0, members: 2 });
    const loud = cluster('rebutted', { aff: 40, neg: 38, obs: 120, members: 200 });

    const sQuiet = suggestChannelFromDraft(
      draft(),
      { parentSnapshot: null, parentClusterSummary: quiet, parentLinkage: null },
      'casual',
    );
    const sLoud = suggestChannelFromDraft(
      draft(),
      { parentSnapshot: null, parentClusterSummary: loud, parentLinkage: null },
      'casual',
    );

    expect(sLoud.suggested).toBe(sQuiet.suggested);
    expect(sLoud.reason).toBe(sQuiet.reason);
    expect(sLoud.confidence).toBe(sQuiet.confidence);
  });

  it('a branch_tangent suggestion fires from off-axis structure, not from low activity', () => {
    // branch_recommended is a structural lifecycle state; a near-dead
    // cluster and a busy cluster in that state both suggest branch_tangent.
    const quiet = cluster('branch_recommended', { aff: 1, neg: 0, obs: 0, members: 1 });
    const busy = cluster('branch_recommended', { aff: 30, neg: 30, obs: 90, members: 150 });
    expect(
      suggestChannelFromDraft(
        draft(),
        { parentSnapshot: null, parentClusterSummary: quiet, parentLinkage: null },
        'casual',
      ).suggested,
    ).toBe('branch_tangent');
    expect(
      suggestChannelFromDraft(
        draft(),
        { parentSnapshot: null, parentClusterSummary: busy, parentLinkage: null },
        'casual',
      ).suggested,
    ).toBe('branch_tangent');
  });
});
