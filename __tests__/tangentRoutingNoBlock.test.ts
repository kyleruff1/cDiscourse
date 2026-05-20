/**
 * BR-003 — advisory-never-blocks doctrine test.
 *
 * Tangent routing is ADVISORY ONLY. A `risk: 'possible'` or
 * `risk: 'strong'` tangent assessment must NEVER produce a
 * `PreSendStructuralBlock`; "Post anyway" must always stay available
 * (the only thing that hides it is a real Constitution structural block,
 * which is RULE-004's pre-existing engine block, not BR-003's). This
 * suite asserts that through `buildPreSendReview` and also asserts the
 * regression guard from §3.3: with `tangentContext` omitted, the review
 * is byte-identical to the pre-BR-003 RULE-004 output.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  DEFAULT_PRESEND_ROOM_CONTEXT,
  buildPreSendReview,
  type PreSendReviewInput,
} from '../src/features/arguments/preSendReviewModel';
import {
  ALL_REDIRECT_RISKS,
  type AssessTangentRiskInput,
} from '../src/features/arguments/tangentRoutingModel';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import type { ArgumentRow } from '../src/features/arguments/types';
import type { EvaluationResult } from '../src/domain/constitution/types';
import type { MoveLinkageRecord } from '../src/features/metadata';

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

function makeEvaluation(): EvaluationResult {
  return {
    allowPost: true,
    blockingErrors: [],
    warnings: [],
    flagsToPersist: [],
    normalizedTags: [],
    clientValidationPayload: {
      checkedAt: 'now',
      constitutionVersion: 'v1',
      ruleCodesChecked: [],
      flagCount: 0,
      blockingCount: 0,
    },
    serverValidationPayload: {
      checkedAt: 'now',
      constitutionVersion: 'v1',
      ruleCodesChecked: [],
      flagCount: 0,
      blockingCount: 0,
    },
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

/** A tangentContext that yields `risk: 'strong'` (introduces_new_axis). */
function strongTangentContext(): AssessTangentRiskInput {
  return {
    draft: makeDraft({ disagreementAxis: 'value' }),
    parent: makeParent(),
    lifecycle: {
      parentSnapshot: {
        messageId: 'parent-1',
        clusterId: 'parent-1',
        clusterState: 'open',
        messageContribution: 'open',
        axis: 'fact',
        opensRequest: false,
        resolvesRequest: false,
        isConcessionShape: false,
        isSynthesisShape: false,
        plainLabel: 'Open for response',
      },
      parentClusterSummary: null,
      parentLinkage: null,
    },
    manualTags: [],
  };
}

/** A tangentContext that yields `risk: 'possible'` (no_signal_about_parent). */
function possibleTangentContext(): AssessTangentRiskInput {
  return {
    draft: makeDraft(),
    parent: makeParent(),
    lifecycle: {
      parentSnapshot: null,
      parentClusterSummary: null,
      parentLinkage: makeLinkage(['branch_suggested']),
    },
    manualTags: [],
    selectedChannel: 'meta_process',
  };
}

function makeInput(
  overrides: Partial<PreSendReviewInput> = {},
): PreSendReviewInput {
  return {
    draft: makeDraft(),
    mode: 'casual',
    parent: makeParent(),
    room: DEFAULT_PRESEND_ROOM_CONTEXT,
    lifecycle: {
      parentSnapshot: null,
      parentClusterSummary: null,
      parentLinkage: null,
    },
    evaluation: makeEvaluation(),
    channelSuggestion: null,
    isFirstPostInSession: false,
    ...overrides,
  };
}

// ── risk: possible / strong never block ────────────────────────

describe('BR-003 — tangent risk never produces a structural block', () => {
  it('risk: strong leaves hasStructuralBlock false and offers post_anyway', () => {
    const review = buildPreSendReview(
      makeInput({ tangentContext: strongTangentContext() }),
    );
    expect(review.hasStructuralBlock).toBe(false);
    expect(review.structuralBlocks).toHaveLength(0);
    const advisory = review.advisories.find((a) => a.kind === 'tangent_redirect');
    expect(advisory).toBeDefined();
    expect(advisory?.severity).toBe('soft');
    expect(advisory?.suggested).toContain('post_anyway');
  });

  it('risk: possible leaves hasStructuralBlock false and offers post_anyway', () => {
    const review = buildPreSendReview(
      makeInput({ tangentContext: possibleTangentContext() }),
    );
    expect(review.hasStructuralBlock).toBe(false);
    const advisory = review.advisories.find((a) => a.kind === 'tangent_redirect');
    expect(advisory).toBeDefined();
    expect(advisory?.severity).toBe('soft');
    expect(advisory?.suggested).toContain('post_anyway');
  });

  it('the tangent_redirect advisory severity is never blocking', () => {
    const review = buildPreSendReview(
      makeInput({ tangentContext: strongTangentContext() }),
    );
    for (const advisory of review.advisories) {
      // AdvisorySeverity is exactly 'info' | 'soft' — neither blocks.
      expect(['info', 'soft']).toContain(advisory.severity);
    }
  });

  it('RedirectRisk has exactly three members; none is a block', () => {
    expect([...ALL_REDIRECT_RISKS].sort()).toEqual(
      ['none', 'possible', 'strong'].sort(),
    );
  });
});

// ── Byte-identical regression guard (§3.3) ─────────────────────

describe('BR-003 — omitted tangentContext is byte-identical to RULE-004', () => {
  it('a clean draft with no tangentContext produces no tangent_redirect advisory', () => {
    const review = buildPreSendReview(makeInput());
    expect(
      review.advisories.some((a) => a.kind === 'tangent_redirect'),
    ).toBe(false);
  });

  it('explicit-null tangentContext yields the same review as omitting it', () => {
    const omitted = buildPreSendReview(makeInput());
    const explicitNull = buildPreSendReview(
      makeInput({ tangentContext: null }),
    );
    expect(JSON.stringify(explicitNull)).toBe(JSON.stringify(omitted));
  });

  it('a review with a tangentContext that yields none is identical to omitting it', () => {
    const cleanContext: AssessTangentRiskInput = {
      draft: makeDraft(),
      parent: makeParent(),
      lifecycle: {
        parentSnapshot: null,
        parentClusterSummary: null,
        parentLinkage: null,
      },
      manualTags: [],
      selectedChannel: 'reply',
    };
    const omitted = buildPreSendReview(makeInput());
    const withCleanContext = buildPreSendReview(
      makeInput({ tangentContext: cleanContext }),
    );
    expect(JSON.stringify(withCleanContext)).toBe(JSON.stringify(omitted));
  });

  it('omitting tangentContext on an otherwise advisory-laden draft leaves the rest intact', () => {
    // A first-post draft raises permanent_record_warning regardless.
    const review = buildPreSendReview(
      makeInput({ isFirstPostInSession: true }),
    );
    expect(
      review.advisories.some((a) => a.kind === 'permanent_record_warning'),
    ).toBe(true);
    expect(
      review.advisories.some((a) => a.kind === 'tangent_redirect'),
    ).toBe(false);
  });
});
