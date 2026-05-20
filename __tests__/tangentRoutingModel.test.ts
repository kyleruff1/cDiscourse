/**
 * BR-003 — tangentRoutingModel pure-model derivation tests.
 *
 * Covers each of `assessTangentRisk`'s 7 derivation steps (§5.1), every
 * (risk, reason) -> suggestedAction mapping, the root-draft + direct-move
 * fast paths, null-tolerance, determinism, `countRecentTangentMoves`,
 * `buildMainlineDemotionAdvisory`, `suggestedActionToQuickAction`, and the
 * exhaustiveness of the frozen `ALL_*` arrays.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  ALL_REDIRECT_REASONS,
  ALL_REDIRECT_RISKS,
  REPEATED_OFF_PATH_THRESHOLD,
  assessTangentRisk,
  buildMainlineDemotionAdvisory,
  countRecentTangentMoves,
  suggestedActionToQuickAction,
  tangentAdvisoryPlainLanguage,
  tangentReasonPlainLanguage,
  type AssessTangentRiskInput,
  type RedirectReason,
  type RedirectRisk,
  type RedirectSuggestedAction,
  type TangentLifecycleContext,
  type TangentThreadContext,
  type TangentThreadMove,
} from '../src/features/arguments/tangentRoutingModel';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import type { ArgumentRow } from '../src/features/arguments/types';
import type {
  PointLifecycleSnapshot,
  PointLifecycleAxis,
} from '../src/features/lifecycle';
import type { MoveLinkageRecord } from '../src/features/metadata';
import type { RailBranchKind } from '../src/features/arguments/railSegmentModel';

// ── Fixtures ───────────────────────────────────────────────────

function makeDraft(overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    draftId: 'draft-1',
    debateId: 'debate-1',
    parentId: 'parent-1',
    argumentType: 'claim',
    side: 'affirmative',
    body: 'A short clean reply about the resolution.',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-05-20T00:00:00.000Z',
    dirty: true,
    ...overrides,
  };
}

function makeParent(overrides: Partial<ArgumentRow> = {}): ArgumentRow {
  return {
    id: 'parent-1',
    debateId: 'debate-1',
    parentId: null,
    authorId: 'user-1',
    argumentType: 'thesis',
    side: 'affirmative',
    body: 'Parent claim body.',
    depth: 0,
    status: 'posted',
    targetExcerpt: null,
    disagreementAxis: null,
    railPayload: {},
    clientValidation: {},
    serverValidation: {},
    clientSubmissionId: null,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
    ...overrides,
  };
}

function makeSnapshot(
  axis: PointLifecycleAxis | null,
): PointLifecycleSnapshot {
  return {
    messageId: 'parent-1',
    clusterId: 'parent-1',
    clusterState: 'open',
    messageContribution: 'open',
    axis,
    opensRequest: false,
    resolvesRequest: false,
    isConcessionShape: false,
    isSynthesisShape: false,
    plainLabel: 'Open for response',
  };
}

function makeLinkage(codes: ReadonlyArray<string>): MoveLinkageRecord {
  return {
    messageId: 'parent-1',
    parentMessageId: null,
    rootPointId: 'parent-1',
    pointClusterId: 'parent-1',
    branchId: 'branch-1',
    targetExcerpt: null,
    disagreementAxis: null,
    semanticFlags: [],
    userAppliedTags: [],
    autoDerivedMetadata: codes.map((code) => ({
      code: code as MoveLinkageRecord['autoDerivedMetadata'][number]['code'],
      detectedAt: '2026-05-20T00:00:00.000Z',
      inputSignals: [],
    })),
    lifecycleEventsCausedByMove: [],
  };
}

function makeLifecycle(
  overrides: Partial<TangentLifecycleContext> = {},
): TangentLifecycleContext {
  return {
    parentSnapshot: null,
    parentClusterSummary: null,
    parentLinkage: null,
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<AssessTangentRiskInput> = {},
): AssessTangentRiskInput {
  return {
    draft: makeDraft(),
    parent: makeParent(),
    lifecycle: makeLifecycle(),
    manualTags: [],
    ...overrides,
  };
}

function makeMove(
  side: 'affirmative' | 'negative' | null,
  inboundBranchKind: RailBranchKind,
): TangentThreadMove {
  return { messageId: `m-${Math.random()}`, side, inboundBranchKind };
}

// ── 1. risk: 'none' fast paths ─────────────────────────────────

describe('assessTangentRisk — risk: none fast paths (§5.1 step 1)', () => {
  it('returns none for a root draft (parent === null)', () => {
    const result = assessTangentRisk(makeInput({ parent: null }));
    expect(result).toEqual({
      risk: 'none',
      reason: null,
      suggestedAction: 'continue',
    });
  });

  it('returns none for a clarification_request draft', () => {
    const result = assessTangentRisk(
      makeInput({ draft: makeDraft({ argumentType: 'clarification_request' }) }),
    );
    expect(result.risk).toBe('none');
    expect(result.reason).toBeNull();
  });

  it('returns none for a confirm channel (direct/resolving move)', () => {
    const result = assessTangentRisk(makeInput({ selectedChannel: 'confirm' }));
    expect(result.risk).toBe('none');
  });

  it('returns none for a narrow channel (direct/resolving move)', () => {
    const result = assessTangentRisk(makeInput({ selectedChannel: 'narrow' }));
    expect(result.risk).toBe('none');
  });

  it('returns none for a synthesize channel (direct/resolving move)', () => {
    const result = assessTangentRisk(
      makeInput({ selectedChannel: 'synthesize' }),
    );
    expect(result.risk).toBe('none');
  });

  it('returns none for a structurally clean reply with no signals', () => {
    const result = assessTangentRisk(makeInput());
    expect(result).toEqual({
      risk: 'none',
      reason: null,
      suggestedAction: 'continue',
    });
  });
});

// ── 2. user_marked_tangent ─────────────────────────────────────

describe('assessTangentRisk — user_marked_tangent (§5.1 step 2)', () => {
  it('fires possible when manualTags contains tangent', () => {
    const result = assessTangentRisk(makeInput({ manualTags: ['tangent'] }));
    expect(result).toEqual({
      risk: 'possible',
      reason: 'user_marked_tangent',
      suggestedAction: 'send_to_side_branch',
    });
  });

  it('fires when manualTags contains branch_this_off', () => {
    const result = assessTangentRisk(
      makeInput({ manualTags: ['branch_this_off'] }),
    );
    expect(result.reason).toBe('user_marked_tangent');
  });

  it('fires when the draft selectedTagCodes contains tangent_or_joke', () => {
    const result = assessTangentRisk(
      makeInput({ draft: makeDraft({ selectedTagCodes: ['tangent_or_joke'] }) }),
    );
    expect(result.reason).toBe('user_marked_tangent');
  });

  it('fires when selectedChannel is branch_tangent', () => {
    const result = assessTangentRisk(
      makeInput({ selectedChannel: 'branch_tangent' }),
    );
    expect(result.reason).toBe('user_marked_tangent');
  });
});

// ── 3. introduces_new_axis ─────────────────────────────────────

describe('assessTangentRisk — introduces_new_axis (§5.1 step 3)', () => {
  it('fires strong when the draft axis differs from the parent axis', () => {
    const result = assessTangentRisk(
      makeInput({
        draft: makeDraft({ disagreementAxis: 'value' }),
        lifecycle: makeLifecycle({ parentSnapshot: makeSnapshot('fact') }),
      }),
    );
    expect(result).toEqual({
      risk: 'strong',
      reason: 'introduces_new_axis',
      suggestedAction: 'branch_this',
    });
  });

  it('does not fire when the draft axis matches the parent axis', () => {
    const result = assessTangentRisk(
      makeInput({
        draft: makeDraft({ disagreementAxis: 'fact' }),
        lifecycle: makeLifecycle({ parentSnapshot: makeSnapshot('fact') }),
      }),
    );
    expect(result.reason).not.toBe('introduces_new_axis');
  });

  it('cannot fire when the parent has no axis (axis === null)', () => {
    const result = assessTangentRisk(
      makeInput({
        draft: makeDraft({ disagreementAxis: 'value' }),
        lifecycle: makeLifecycle({ parentSnapshot: makeSnapshot(null) }),
      }),
    );
    expect(result.reason).not.toBe('introduces_new_axis');
    expect(result.risk).toBe('none');
  });

  it('cannot fire when the draft declares no axis', () => {
    const result = assessTangentRisk(
      makeInput({
        draft: makeDraft({ disagreementAxis: null }),
        lifecycle: makeLifecycle({ parentSnapshot: makeSnapshot('fact') }),
      }),
    );
    expect(result.reason).not.toBe('introduces_new_axis');
  });
});

// ── 4. mode_demands_response ───────────────────────────────────

describe('assessTangentRisk — mode_demands_response (§5.1 step 4)', () => {
  it('fires strong when parent is a skipped node and draft is not a direct reply', () => {
    const result = assessTangentRisk(
      makeInput({
        lifecycle: makeLifecycle({
          parentLinkage: makeLinkage(['participant_skipped_node']),
        }),
        selectedChannel: 'add_evidence',
      }),
    );
    expect(result).toEqual({
      risk: 'strong',
      reason: 'mode_demands_response',
      suggestedAction: 'ask_clarifying_question',
    });
  });

  it('does not fire when the draft is a direct reply channel', () => {
    const result = assessTangentRisk(
      makeInput({
        lifecycle: makeLifecycle({
          parentLinkage: makeLinkage(['participant_skipped_node']),
        }),
        selectedChannel: 'reply',
      }),
    );
    expect(result.reason).not.toBe('mode_demands_response');
  });

  it('does not fire when the parent linkage has no skipped-node code', () => {
    const result = assessTangentRisk(
      makeInput({
        lifecycle: makeLifecycle({ parentLinkage: makeLinkage([]) }),
        selectedChannel: 'add_evidence',
      }),
    );
    expect(result.reason).not.toBe('mode_demands_response');
  });
});

// ── 5. no_signal_about_parent ──────────────────────────────────

describe('assessTangentRisk — no_signal_about_parent (§5.1 step 5)', () => {
  it('fires possible when parent recommends a branch and draft does not engage it', () => {
    const result = assessTangentRisk(
      makeInput({
        lifecycle: makeLifecycle({
          parentLinkage: makeLinkage(['branch_suggested']),
        }),
        selectedChannel: 'meta_process',
      }),
    );
    expect(result).toEqual({
      risk: 'possible',
      reason: 'no_signal_about_parent',
      suggestedAction: 'send_to_side_branch',
    });
  });

  it('does not fire when the draft carries a parent-engaging channel', () => {
    const result = assessTangentRisk(
      makeInput({
        lifecycle: makeLifecycle({
          parentLinkage: makeLinkage(['branch_suggested']),
        }),
        selectedChannel: 'challenge',
      }),
    );
    expect(result.reason).not.toBe('no_signal_about_parent');
  });

  it('does not fire when the parent linkage has no branch_suggested code', () => {
    const result = assessTangentRisk(
      makeInput({
        lifecycle: makeLifecycle({ parentLinkage: makeLinkage([]) }),
        selectedChannel: 'meta_process',
      }),
    );
    expect(result.reason).not.toBe('no_signal_about_parent');
  });
});

// ── 6. repeated_off_path ───────────────────────────────────────

describe('assessTangentRisk — repeated_off_path (§5.1 step 6)', () => {
  it('fires possible when the side has gone off-path >= threshold times', () => {
    const context: TangentThreadContext = {
      authorSide: 'affirmative',
      recentMoves: [
        makeMove('affirmative', 'kink_start'),
        makeMove('affirmative', 'tangent'),
        makeMove('affirmative', 'kink_end'),
      ],
    };
    const result = assessTangentRisk(makeInput({ tangentContext: context }));
    expect(result).toEqual({
      risk: 'possible',
      reason: 'repeated_off_path',
      suggestedAction: 'send_to_side_branch',
    });
  });

  it('does not fire below the threshold', () => {
    const context: TangentThreadContext = {
      authorSide: 'affirmative',
      recentMoves: [
        makeMove('affirmative', 'kink_start'),
        makeMove('affirmative', 'tangent'),
      ],
    };
    const result = assessTangentRisk(makeInput({ tangentContext: context }));
    expect(result.reason).not.toBe('repeated_off_path');
    expect(result.risk).toBe('none');
  });

  it('never fires when tangentContext is omitted', () => {
    const result = assessTangentRisk(makeInput());
    expect(result.reason).not.toBe('repeated_off_path');
  });
});

// ── 7. default ─────────────────────────────────────────────────

describe('assessTangentRisk — default (§5.1 step 7)', () => {
  it('returns none when no reason fires', () => {
    const result = assessTangentRisk(
      makeInput({
        selectedChannel: 'reply',
        lifecycle: makeLifecycle({
          parentSnapshot: makeSnapshot('fact'),
          parentLinkage: makeLinkage([]),
        }),
      }),
    );
    expect(result).toEqual({
      risk: 'none',
      reason: null,
      suggestedAction: 'continue',
    });
  });
});

// ── Priority order ─────────────────────────────────────────────

describe('assessTangentRisk — priority order', () => {
  it('user_marked_tangent wins over introduces_new_axis', () => {
    const result = assessTangentRisk(
      makeInput({
        manualTags: ['tangent'],
        draft: makeDraft({ disagreementAxis: 'value', selectedTagCodes: [] }),
        lifecycle: makeLifecycle({ parentSnapshot: makeSnapshot('fact') }),
      }),
    );
    expect(result.reason).toBe('user_marked_tangent');
  });

  it('introduces_new_axis wins over mode_demands_response', () => {
    const result = assessTangentRisk(
      makeInput({
        draft: makeDraft({ disagreementAxis: 'value' }),
        lifecycle: makeLifecycle({
          parentSnapshot: makeSnapshot('fact'),
          parentLinkage: makeLinkage(['participant_skipped_node']),
        }),
        selectedChannel: 'add_evidence',
      }),
    );
    expect(result.reason).toBe('introduces_new_axis');
  });

  it('mode_demands_response wins over no_signal_about_parent', () => {
    const result = assessTangentRisk(
      makeInput({
        lifecycle: makeLifecycle({
          parentLinkage: makeLinkage([
            'participant_skipped_node',
            'branch_suggested',
          ]),
        }),
        selectedChannel: 'meta_process',
      }),
    );
    expect(result.reason).toBe('mode_demands_response');
  });
});

// ── (risk, reason) -> suggestedAction mapping ──────────────────

describe('assessTangentRisk — (risk, reason) -> suggestedAction mapping', () => {
  const cases: ReadonlyArray<{
    reason: RedirectReason;
    risk: RedirectRisk;
    action: RedirectSuggestedAction;
  }> = [
    {
      reason: 'user_marked_tangent',
      risk: 'possible',
      action: 'send_to_side_branch',
    },
    {
      reason: 'introduces_new_axis',
      risk: 'strong',
      action: 'branch_this',
    },
    {
      reason: 'mode_demands_response',
      risk: 'strong',
      action: 'ask_clarifying_question',
    },
    {
      reason: 'no_signal_about_parent',
      risk: 'possible',
      action: 'send_to_side_branch',
    },
    {
      reason: 'repeated_off_path',
      risk: 'possible',
      action: 'send_to_side_branch',
    },
  ];

  function inputForReason(reason: RedirectReason): AssessTangentRiskInput {
    switch (reason) {
      case 'user_marked_tangent':
        return makeInput({ manualTags: ['tangent'] });
      case 'introduces_new_axis':
        return makeInput({
          draft: makeDraft({ disagreementAxis: 'value' }),
          lifecycle: makeLifecycle({ parentSnapshot: makeSnapshot('fact') }),
        });
      case 'mode_demands_response':
        return makeInput({
          lifecycle: makeLifecycle({
            parentLinkage: makeLinkage(['participant_skipped_node']),
          }),
          selectedChannel: 'add_evidence',
        });
      case 'no_signal_about_parent':
        return makeInput({
          lifecycle: makeLifecycle({
            parentLinkage: makeLinkage(['branch_suggested']),
          }),
          selectedChannel: 'meta_process',
        });
      case 'repeated_off_path':
        return makeInput({
          tangentContext: {
            authorSide: 'affirmative',
            recentMoves: [
              makeMove('affirmative', 'kink_start'),
              makeMove('affirmative', 'tangent'),
              makeMove('affirmative', 'kink_end'),
            ],
          },
        });
      default:
        return makeInput();
    }
  }

  for (const c of cases) {
    it(`${c.reason} -> risk ${c.risk}, action ${c.action}`, () => {
      const result = assessTangentRisk(inputForReason(c.reason));
      expect(result.reason).toBe(c.reason);
      expect(result.risk).toBe(c.risk);
      expect(result.suggestedAction).toBe(c.action);
    });
  }
});

// ── Null tolerance ─────────────────────────────────────────────

describe('assessTangentRisk — null tolerance (§7 #3, #4)', () => {
  it('does not throw when parentSnapshot is null', () => {
    expect(() =>
      assessTangentRisk(
        makeInput({ lifecycle: makeLifecycle({ parentSnapshot: null }) }),
      ),
    ).not.toThrow();
  });

  it('does not throw when parentLinkage is null', () => {
    expect(() =>
      assessTangentRisk(
        makeInput({ lifecycle: makeLifecycle({ parentLinkage: null }) }),
      ),
    ).not.toThrow();
  });

  it('skips softer reasons when both lifecycle structures are null', () => {
    const result = assessTangentRisk(
      makeInput({
        lifecycle: makeLifecycle({
          parentSnapshot: null,
          parentLinkage: null,
        }),
      }),
    );
    expect(result.risk).toBe('none');
  });
});

// ── Determinism ────────────────────────────────────────────────

describe('assessTangentRisk — determinism', () => {
  it('returns equal output for the same input twice', () => {
    const input = makeInput({
      draft: makeDraft({ disagreementAxis: 'value' }),
      lifecycle: makeLifecycle({ parentSnapshot: makeSnapshot('fact') }),
    });
    expect(assessTangentRisk(input)).toEqual(assessTangentRisk(input));
  });
});

// ── countRecentTangentMoves ────────────────────────────────────

describe('countRecentTangentMoves', () => {
  it('counts only the author side off-path moves', () => {
    const context: TangentThreadContext = {
      authorSide: 'affirmative',
      recentMoves: [
        makeMove('affirmative', 'tangent'),
        makeMove('negative', 'tangent'),
        makeMove('affirmative', 'kink_start'),
      ],
    };
    expect(countRecentTangentMoves(context)).toBe(2);
  });

  it('counts only kink_start / tangent / kink_end inbound kinds', () => {
    const context: TangentThreadContext = {
      authorSide: 'affirmative',
      recentMoves: [
        makeMove('affirmative', 'main'),
        makeMove('affirmative', 'detached'),
        makeMove('affirmative', 'tangent'),
      ],
    };
    expect(countRecentTangentMoves(context)).toBe(1);
  });

  it('returns 0 for an empty recentMoves list', () => {
    expect(
      countRecentTangentMoves({ authorSide: 'affirmative', recentMoves: [] }),
    ).toBe(0);
  });
});

// ── buildMainlineDemotionAdvisory ──────────────────────────────

describe('buildMainlineDemotionAdvisory', () => {
  it('is inactive below the threshold', () => {
    const advisory = buildMainlineDemotionAdvisory({
      authorSide: 'affirmative',
      recentMoves: [makeMove('affirmative', 'tangent')],
    });
    expect(advisory.active).toBe(false);
    expect(advisory.offPathCount).toBe(1);
  });

  it('is active at the threshold', () => {
    const advisory = buildMainlineDemotionAdvisory({
      authorSide: 'affirmative',
      recentMoves: [
        makeMove('affirmative', 'tangent'),
        makeMove('affirmative', 'kink_start'),
        makeMove('affirmative', 'kink_end'),
      ],
    });
    expect(advisory.active).toBe(true);
    expect(advisory.offPathCount).toBe(REPEATED_OFF_PATH_THRESHOLD);
  });

  it('always offers a direct-reply reversal action', () => {
    const advisory = buildMainlineDemotionAdvisory({
      authorSide: 'affirmative',
      recentMoves: [],
    });
    expect(advisory.reversalActions).toContain('ask_clarifying_question');
  });
});

// ── suggestedActionToQuickAction ───────────────────────────────

describe('suggestedActionToQuickAction', () => {
  it('maps continue to null', () => {
    expect(suggestedActionToQuickAction('continue')).toBeNull();
  });

  it('maps send_to_side_branch to branch', () => {
    expect(suggestedActionToQuickAction('send_to_side_branch')).toBe('branch');
  });

  it('maps branch_this to branch', () => {
    expect(suggestedActionToQuickAction('branch_this')).toBe('branch');
  });

  it('maps ask_clarifying_question to clarify', () => {
    expect(suggestedActionToQuickAction('ask_clarifying_question')).toBe(
      'clarify',
    );
  });
});

// ── Copy resolvers ─────────────────────────────────────────────

describe('tangentAdvisoryPlainLanguage / tangentReasonPlainLanguage', () => {
  it('returns the strong headline for risk strong', () => {
    const line = tangentAdvisoryPlainLanguage({
      risk: 'strong',
      reason: 'introduces_new_axis',
      suggestedAction: 'branch_this',
    });
    expect(line.length).toBeGreaterThan(0);
  });

  it('returns the possible headline for risk possible', () => {
    const line = tangentAdvisoryPlainLanguage({
      risk: 'possible',
      reason: 'user_marked_tangent',
      suggestedAction: 'send_to_side_branch',
    });
    expect(line.length).toBeGreaterThan(0);
  });

  it('returns the empty string for risk none', () => {
    expect(
      tangentAdvisoryPlainLanguage({
        risk: 'none',
        reason: null,
        suggestedAction: 'continue',
      }),
    ).toBe('');
  });

  it('returns a detail line for every reason', () => {
    for (const reason of ALL_REDIRECT_REASONS) {
      expect(tangentReasonPlainLanguage(reason).length).toBeGreaterThan(0);
    }
  });

  it('returns the empty string for a null reason', () => {
    expect(tangentReasonPlainLanguage(null)).toBe('');
  });
});

// ── Frozen array exhaustiveness ────────────────────────────────

describe('ALL_REDIRECT_RISKS / ALL_REDIRECT_REASONS', () => {
  it('ALL_REDIRECT_RISKS has exactly three members', () => {
    expect([...ALL_REDIRECT_RISKS].sort()).toEqual(
      ['none', 'possible', 'strong'].sort(),
    );
  });

  it('ALL_REDIRECT_REASONS has exactly five members', () => {
    expect(ALL_REDIRECT_REASONS).toHaveLength(5);
  });

  it('REPEATED_OFF_PATH_THRESHOLD is the frozen card constant 3', () => {
    expect(REPEATED_OFF_PATH_THRESHOLD).toBe(3);
  });
});
