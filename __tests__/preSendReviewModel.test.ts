/**
 * RULE-004 — preSendReviewModel pure-model derivation tests.
 *
 * A row-per-rule table: each of the 8 derivation rules fires for a
 * crafted input and produces the expected advisory `{ kind, severity,
 * suggested }`. Plus: ADVISORY_DEFINITIONS coverage, projectBlockKind,
 * transformationToQuickAction, the clean-draft / root-draft / null-
 * evaluation edge cases, determinism, and the casual/strict severity
 * split for `permanent_record_warning`.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  ADVISORY_DEFINITIONS,
  ALL_ADVISORY_KINDS,
  BROAD_CLAIM_MIN_CHARS,
  DEFAULT_PRESEND_ROOM_CONTEXT,
  advisoryDefinition,
  buildPreSendReview,
  channelMismatchPlainLanguage,
  projectBlockKind,
  transformationToQuickAction,
  type AdvisoryKind,
  type PreSendReviewInput,
} from '../src/features/arguments/preSendReviewModel';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import type { ArgumentRow } from '../src/features/arguments/types';
import type {
  EvaluationResult,
  EvaluationFlagDetail,
} from '../src/domain/constitution/types';
import { FLAG_CODES } from '../src/domain/constitution/types';
import type { ChannelSuggestion } from '../src/features/arguments/channelModel';
import type { MoveLinkageRecord } from '../src/features/metadata';
import type { AssessTangentRiskInput } from '../src/features/arguments/tangentRoutingModel';

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

function makeFlag(flagCode: string): EvaluationFlagDetail {
  return {
    ruleCode: 'some_rule',
    flagCode: flagCode as EvaluationFlagDetail['flagCode'],
    severity: 'warning',
    message: 'msg',
    payload: {},
  };
}

function makeEvaluation(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  const blockingErrors = overrides.blockingErrors ?? [];
  return {
    allowPost: blockingErrors.length === 0,
    blockingErrors,
    warnings: overrides.warnings ?? [],
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
    ...overrides,
  };
}

function makeChannelSuggestion(
  overrides: Partial<ChannelSuggestion> = {},
): ChannelSuggestion {
  return {
    suggested: 'branch_tangent',
    reason: 'deterministic_match',
    confidence: 'medium',
    rationale: 'This reads like a new issue — branching keeps the thread clear.',
    isMismatch: false,
    ...overrides,
  };
}

function makeLinkage(branchSuggested: boolean): MoveLinkageRecord {
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
    autoDerivedMetadata: branchSuggested
      ? [
          {
            code: 'branch_suggested',
            detectedAt: '2026-05-20T00:00:00.000Z',
            inputSignals: [],
          },
        ]
      : [],
    lifecycleEventsCausedByMove: [],
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

function kinds(review: { advisories: ReadonlyArray<{ kind: AdvisoryKind }> }) {
  return review.advisories.map((a) => a.kind);
}

// ── 1. Per-rule derivation table ───────────────────────────────

describe('buildPreSendReview — per-rule derivation', () => {
  it('rule 2 — no_source_attached: evidence type, no attached evidence', () => {
    const review = buildPreSendReview(
      makeInput({
        draft: makeDraft({ argumentType: 'evidence', attachedEvidence: [] }),
      }),
    );
    const advisory = review.advisories.find(
      (a) => a.kind === 'no_source_attached',
    );
    expect(advisory).toBeDefined();
    expect(advisory?.severity).toBe('soft');
    expect(advisory?.suggested).toContain('add_evidence');
  });

  it('rule 2 — no_source_attached does NOT fire when evidence is attached', () => {
    const review = buildPreSendReview(
      makeInput({
        draft: makeDraft({
          argumentType: 'evidence',
          attachedEvidence: [{ url: 'https://example.com' }],
        }),
      }),
    );
    expect(kinds(review)).not.toContain('no_source_attached');
  });

  it('rule 3 — topic_drift fires on a WEAK_TOPIC warning', () => {
    const review = buildPreSendReview(
      makeInput({
        evaluation: makeEvaluation({ warnings: [makeFlag(FLAG_CODES.WEAK_TOPIC)] }),
      }),
    );
    const advisory = review.advisories.find((a) => a.kind === 'topic_drift');
    expect(advisory).toBeDefined();
    expect(advisory?.severity).toBe('soft');
  });

  it('rule 3 — topic_drift fires on an OFF_TOPIC warning', () => {
    const review = buildPreSendReview(
      makeInput({
        evaluation: makeEvaluation({ warnings: [makeFlag(FLAG_CODES.OFF_TOPIC)] }),
      }),
    );
    expect(kinds(review)).toContain('topic_drift');
  });

  it('rule 4 — broad_claim fires on a long body with no scope tag', () => {
    const review = buildPreSendReview(
      makeInput({ draft: makeDraft({ body: 'x'.repeat(BROAD_CLAIM_MIN_CHARS) }) }),
    );
    const advisory = review.advisories.find((a) => a.kind === 'broad_claim');
    expect(advisory).toBeDefined();
    expect(advisory?.severity).toBe('soft');
    expect(advisory?.suggested[0]).toBe('narrow');
  });

  it('rule 4 — broad_claim does NOT fire when a scope-narrowing tag is set', () => {
    const review = buildPreSendReview(
      makeInput({
        draft: makeDraft({
          body: 'x'.repeat(BROAD_CLAIM_MIN_CHARS),
          selectedTagCodes: ['narrow_scope'],
        }),
      }),
    );
    expect(kinds(review)).not.toContain('broad_claim');
  });

  it('rule 4 — broad_claim does NOT fire for a short body', () => {
    const review = buildPreSendReview(
      makeInput({ draft: makeDraft({ body: 'short body' }) }),
    );
    expect(kinds(review)).not.toContain('broad_claim');
  });

  it('rule 5 — asks_new_question fires on META-001 branch_suggested', () => {
    const review = buildPreSendReview(
      makeInput({
        lifecycle: {
          parentSnapshot: null,
          parentClusterSummary: null,
          parentLinkage: makeLinkage(true),
        },
      }),
    );
    expect(kinds(review)).toContain('asks_new_question');
  });

  it('rule 5 — asks_new_question fires on a draft tangent tag', () => {
    const review = buildPreSendReview(
      makeInput({ draft: makeDraft({ selectedTagCodes: ['tangent'] }) }),
    );
    expect(kinds(review)).toContain('asks_new_question');
  });

  it('rule 5 — asks_new_question fires on a `?`-shaped non-clarification body', () => {
    const review = buildPreSendReview(
      makeInput({
        draft: makeDraft({ argumentType: 'claim', body: 'Is this really so?' }),
      }),
    );
    expect(kinds(review)).toContain('asks_new_question');
  });

  it('rule 5 — asks_new_question does NOT fire for a `?` clarification_request', () => {
    const review = buildPreSendReview(
      makeInput({
        draft: makeDraft({
          argumentType: 'clarification_request',
          body: 'What do you mean by that?',
        }),
      }),
    );
    expect(kinds(review)).not.toContain('asks_new_question');
  });

  it('rule 6 — depth_warning fires at or beyond the threshold', () => {
    const review = buildPreSendReview(
      makeInput({ parent: makeParent({ depth: 5 }) }),
    );
    const advisory = review.advisories.find((a) => a.kind === 'depth_warning');
    expect(advisory).toBeDefined();
    expect(advisory?.severity).toBe('info');
  });

  it('rule 6 — depth_warning does NOT fire for a shallow parent', () => {
    const review = buildPreSendReview(
      makeInput({ parent: makeParent({ depth: 1 }) }),
    );
    expect(kinds(review)).not.toContain('depth_warning');
  });

  it('rule 7 — channel_mismatch fires when isMismatch is true', () => {
    const review = buildPreSendReview(
      makeInput({
        channelSuggestion: makeChannelSuggestion({ isMismatch: true }),
      }),
    );
    const advisory = review.advisories.find((a) => a.kind === 'channel_mismatch');
    expect(advisory).toBeDefined();
    expect(advisory?.severity).toBe('info');
  });

  it('rule 7 — channel_mismatch does NOT fire when isMismatch is false', () => {
    const review = buildPreSendReview(
      makeInput({
        channelSuggestion: makeChannelSuggestion({ isMismatch: false }),
      }),
    );
    expect(kinds(review)).not.toContain('channel_mismatch');
  });

  it('rule 8 — permanent_record_warning fires on the first post in session', () => {
    const review = buildPreSendReview(
      makeInput({ isFirstPostInSession: true }),
    );
    expect(kinds(review)).toContain('permanent_record_warning');
  });

  it('rule 8 — permanent_record_warning does NOT fire after the first post', () => {
    const review = buildPreSendReview(
      makeInput({ isFirstPostInSession: false }),
    );
    expect(kinds(review)).not.toContain('permanent_record_warning');
  });
});

// ── 2. permanent_record_warning severity per mode ──────────────

describe('buildPreSendReview — permanent_record_warning severity per mode', () => {
  it('is info in casual mode', () => {
    const review = buildPreSendReview(
      makeInput({ mode: 'casual', isFirstPostInSession: true }),
    );
    const advisory = review.advisories.find(
      (a) => a.kind === 'permanent_record_warning',
    );
    expect(advisory?.severity).toBe('info');
  });

  it('is soft in strict mode', () => {
    const review = buildPreSendReview(
      makeInput({ mode: 'strict', isFirstPostInSession: true }),
    );
    const advisory = review.advisories.find(
      (a) => a.kind === 'permanent_record_warning',
    );
    expect(advisory?.severity).toBe('soft');
  });
});

// ── 3. structuralBlocks projection ─────────────────────────────

describe('buildPreSendReview — structuralBlocks projection', () => {
  it('projects an empty-body blocking error to empty_body', () => {
    const review = buildPreSendReview(
      makeInput({
        evaluation: makeEvaluation({
          blockingErrors: [makeFlag(FLAG_CODES.UNCLEAR_CLAIM)],
        }),
      }),
    );
    expect(review.structuralBlocks.map((b) => b.kind)).toContain('empty_body');
    expect(review.hasStructuralBlock).toBe(true);
  });

  it('projects an invalid transition to invalid_transition', () => {
    const review = buildPreSendReview(
      makeInput({
        evaluation: makeEvaluation({
          blockingErrors: [makeFlag(FLAG_CODES.INVALID_TRANSITION)],
        }),
      }),
    );
    expect(review.structuralBlocks.map((b) => b.kind)).toContain(
      'invalid_transition',
    );
  });

  it('projects an evidence-required block to evidence_without_source', () => {
    const review = buildPreSendReview(
      makeInput({
        evaluation: makeEvaluation({
          blockingErrors: [makeFlag(FLAG_CODES.EVIDENCE_REQUIRED)],
        }),
      }),
    );
    expect(review.structuralBlocks.map((b) => b.kind)).toContain(
      'evidence_without_source',
    );
  });

  it('has no structural block and hasStructuralBlock false for a clean draft', () => {
    const review = buildPreSendReview(makeInput());
    expect(review.structuralBlocks).toHaveLength(0);
    expect(review.hasStructuralBlock).toBe(false);
  });
});

// ── 4. projectBlockKind ────────────────────────────────────────

describe('projectBlockKind', () => {
  it('maps known flag codes to their display kinds', () => {
    expect(projectBlockKind(FLAG_CODES.UNCLEAR_CLAIM)).toBe('empty_body');
    expect(projectBlockKind(FLAG_CODES.EXCESSIVE_LENGTH)).toBe('over_length');
    expect(projectBlockKind(FLAG_CODES.EVIDENCE_REQUIRED)).toBe(
      'evidence_without_source',
    );
    expect(projectBlockKind(FLAG_CODES.INVALID_TRANSITION)).toBe(
      'invalid_transition',
    );
    expect(projectBlockKind(FLAG_CODES.MISSING_PARENT)).toBe(
      'invalid_transition',
    );
  });

  it('maps an unknown flag code to invalid_transition as the safe generic', () => {
    expect(projectBlockKind('some_unknown_future_code')).toBe(
      'invalid_transition',
    );
  });
});

// ── 5. transformationToQuickAction ─────────────────────────────

describe('transformationToQuickAction', () => {
  it('maps preset transformations to their QuickActionLabel', () => {
    expect(transformationToQuickAction('narrow')).toBe('narrow');
    expect(transformationToQuickAction('branch_tangent')).toBe('branch');
    expect(transformationToQuickAction('ask_source')).toBe('source');
    expect(transformationToQuickAction('add_quote')).toBe('quote');
    expect(transformationToQuickAction('add_evidence')).toBe('evidence');
  });

  it('maps the two sheet-only actions to null', () => {
    expect(transformationToQuickAction('save_draft')).toBeNull();
    expect(transformationToQuickAction('post_anyway')).toBeNull();
  });
});

// ── 6. ADVISORY_DEFINITIONS coverage ───────────────────────────

describe('ADVISORY_DEFINITIONS', () => {
  it('has an entry for every AdvisoryKind in ALL_ADVISORY_KINDS', () => {
    for (const kind of ALL_ADVISORY_KINDS) {
      expect(ADVISORY_DEFINITIONS[kind]).toBeDefined();
      expect(ADVISORY_DEFINITIONS[kind].kind).toBe(kind);
    }
  });

  it('every advisory has at least one non-post_anyway transformation', () => {
    for (const kind of ALL_ADVISORY_KINDS) {
      const def = ADVISORY_DEFINITIONS[kind];
      const actionable = def.suggested.filter((t) => t !== 'post_anyway');
      expect(actionable.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('post_anyway is always present and always last', () => {
    for (const kind of ALL_ADVISORY_KINDS) {
      const def = ADVISORY_DEFINITIONS[kind];
      expect(def.suggested).toContain('post_anyway');
      expect(def.suggested[def.suggested.length - 1]).toBe('post_anyway');
    }
  });

  it('advisoryDefinition returns the frozen definition for a known kind', () => {
    expect(advisoryDefinition('broad_claim').kind).toBe('broad_claim');
  });

  it('advisoryDefinition throws on an unknown kind', () => {
    expect(() =>
      advisoryDefinition('not_a_kind' as AdvisoryKind),
    ).toThrow(/unknown advisory kind/);
  });
});

// ── 7. Edge cases ──────────────────────────────────────────────

describe('buildPreSendReview — edge cases', () => {
  it('clean ordinary reply yields shouldShowSheet false and empty lists', () => {
    const review = buildPreSendReview(makeInput());
    expect(review.advisories).toHaveLength(0);
    expect(review.structuralBlocks).toHaveLength(0);
    expect(review.shouldShowSheet).toBe(false);
  });

  it('root draft (all parent / lifecycle inputs null) never throws', () => {
    expect(() =>
      buildPreSendReview(
        makeInput({
          draft: makeDraft({ parentId: null, argumentType: 'thesis' }),
          parent: null,
          lifecycle: {
            parentSnapshot: null,
            parentClusterSummary: null,
            parentLinkage: null,
          },
        }),
      ),
    ).not.toThrow();
  });

  it('root draft skips the depth_warning rule (no parent depth)', () => {
    const review = buildPreSendReview(
      makeInput({ parent: null, draft: makeDraft({ parentId: null }) }),
    );
    expect(kinds(review)).not.toContain('depth_warning');
  });

  it('evaluation null skips block projection but still derives draft-shape advisories', () => {
    const review = buildPreSendReview(
      makeInput({
        evaluation: null,
        draft: makeDraft({ body: 'x'.repeat(BROAD_CLAIM_MIN_CHARS) }),
      }),
    );
    expect(review.structuralBlocks).toHaveLength(0);
    expect(kinds(review)).toContain('broad_claim');
  });

  it('channelSuggestion null produces no channel_mismatch advisory', () => {
    const review = buildPreSendReview(makeInput({ channelSuggestion: null }));
    expect(kinds(review)).not.toContain('channel_mismatch');
  });

  it('is deterministic — same input twice yields equal output', () => {
    const input = makeInput({
      draft: makeDraft({ body: 'x'.repeat(BROAD_CLAIM_MIN_CHARS) }),
      isFirstPostInSession: true,
    });
    expect(buildPreSendReview(input)).toEqual(buildPreSendReview(input));
  });

  it('shouldShowSheet is true when only a structural block is present', () => {
    const review = buildPreSendReview(
      makeInput({
        evaluation: makeEvaluation({
          blockingErrors: [makeFlag(FLAG_CODES.INVALID_TRANSITION)],
        }),
      }),
    );
    expect(review.shouldShowSheet).toBe(true);
  });

  it('evidence-no-source surfaces BOTH the advisory and the structural block', () => {
    const review = buildPreSendReview(
      makeInput({
        draft: makeDraft({ argumentType: 'evidence', attachedEvidence: [] }),
        evaluation: makeEvaluation({
          blockingErrors: [makeFlag(FLAG_CODES.EVIDENCE_REQUIRED)],
        }),
      }),
    );
    expect(kinds(review)).toContain('no_source_attached');
    expect(review.structuralBlocks.map((b) => b.kind)).toContain(
      'evidence_without_source',
    );
    expect(review.hasStructuralBlock).toBe(true);
  });
});

// ── 8. channelMismatchPlainLanguage ────────────────────────────

describe('channelMismatchPlainLanguage', () => {
  it("prefers RULE-005's suggestion.rationale verbatim", () => {
    const suggestion = makeChannelSuggestion({
      isMismatch: true,
      rationale: 'A specific RULE-005 rationale line.',
    });
    expect(channelMismatchPlainLanguage(suggestion)).toBe(
      'A specific RULE-005 rationale line.',
    );
  });

  it('falls back to the frozen copy line when the suggestion is null', () => {
    const fallback = channelMismatchPlainLanguage(null);
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback).not.toBe('A specific RULE-005 rationale line.');
  });
});

// ── 9. BR-003 — tangent_redirect derivation step (step 9) ───────

describe('buildPreSendReview — BR-003 tangent_redirect (step 9)', () => {
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

  it('appends a tangent_redirect advisory when risk is strong', () => {
    const review = buildPreSendReview(
      makeInput({ tangentContext: strongTangentContext() }),
    );
    expect(kinds(review)).toContain('tangent_redirect');
    const advisory = review.advisories.find(
      (a) => a.kind === 'tangent_redirect',
    );
    expect(advisory?.severity).toBe('soft');
    expect(advisory?.plainLanguage.length).toBeGreaterThan(0);
  });

  it('appends a tangent_redirect advisory when risk is possible', () => {
    const review = buildPreSendReview(
      makeInput({
        tangentContext: {
          draft: makeDraft(),
          parent: makeParent(),
          lifecycle: {
            parentSnapshot: null,
            parentClusterSummary: null,
            parentLinkage: {
              ...makeLinkage(false),
              autoDerivedMetadata: [
                {
                  code: 'branch_suggested' as const,
                  detectedAt: '2026-05-20T00:00:00.000Z',
                  inputSignals: [],
                },
              ],
            },
          },
          manualTags: [] as string[],
          selectedChannel: 'meta_process' as const,
        },
      }),
    );
    expect(kinds(review)).toContain('tangent_redirect');
  });

  it('appends nothing when the assessment risk is none', () => {
    const review = buildPreSendReview(
      makeInput({
        tangentContext: {
          draft: makeDraft(),
          parent: makeParent(),
          lifecycle: {
            parentSnapshot: null,
            parentClusterSummary: null,
            parentLinkage: null,
          },
          manualTags: [] as string[],
          selectedChannel: 'reply' as const,
        },
      }),
    );
    expect(kinds(review)).not.toContain('tangent_redirect');
  });

  it('omitting tangentContext yields a byte-identical review (§3.3)', () => {
    const withoutContext = buildPreSendReview(makeInput());
    const withNullContext = buildPreSendReview(
      makeInput({ tangentContext: null }),
    );
    expect(JSON.stringify(withNullContext)).toBe(
      JSON.stringify(withoutContext),
    );
  });

  it('a tangent_redirect advisory never sets hasStructuralBlock', () => {
    const review = buildPreSendReview(
      makeInput({ tangentContext: strongTangentContext() }),
    );
    expect(review.hasStructuralBlock).toBe(false);
  });

  // De-dup (§7 #6): when assessTangentRisk fires purely because of a
  // tangent qualifier tag AND asks_new_question already fired for the same
  // tag, tangent_redirect is suppressed — one card, not two.
  it('suppresses tangent_redirect when asks_new_question fired for the same tangent tag', () => {
    const tangentDraft = makeDraft({ selectedTagCodes: ['tangent'] });
    const review = buildPreSendReview(
      makeInput({
        draft: tangentDraft,
        tangentContext: {
          draft: tangentDraft,
          parent: makeParent(),
          lifecycle: {
            parentSnapshot: null,
            parentClusterSummary: null,
            parentLinkage: null,
          },
          manualTags: ['tangent'] as string[],
        },
      }),
    );
    // asks_new_question fires (tangent tag); tangent_redirect is suppressed.
    expect(kinds(review)).toContain('asks_new_question');
    expect(kinds(review)).not.toContain('tangent_redirect');
  });

  it('still appends tangent_redirect when its reason is not the user tag', () => {
    // A `strong` introduces_new_axis assessment carries information
    // asks_new_question does not — it is NOT suppressed even when
    // asks_new_question also fired for an unrelated reason.
    const review = buildPreSendReview(
      makeInput({
        tangentContext: strongTangentContext(),
        lifecycle: {
          parentSnapshot: null,
          parentClusterSummary: null,
          parentLinkage: makeLinkage(true), // -> asks_new_question fires too
        },
      }),
    );
    expect(kinds(review)).toContain('asks_new_question');
    expect(kinds(review)).toContain('tangent_redirect');
  });
});
