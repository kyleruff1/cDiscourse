/**
 * RULE-004 — no-keyword-block + deterministic-no-AI + advisory-never-
 * blocks doctrine guarantees.
 *
 * Asserts (Stage 6.2 doctrine + RULE-004 acceptance criteria):
 *   - a charged-keyword body that is structurally valid yields ZERO
 *     structuralBlocks — the model never reads body text for keyword
 *     gating;
 *   - a charged body and a benign body of EQUAL length / shape produce
 *     IDENTICAL advisories — only length / `?`-shape / typed fields can
 *     change the output, never the words;
 *   - two structurally-identical drafts with different (hypothetical)
 *     heat / reply counts produce the SAME review — heat / popularity
 *     are never signals;
 *   - `AdvisorySeverity` has exactly two members (`info` / `soft`) — no
 *     blocking advisory severity exists;
 *   - an advisory-only review (no structural block) always keeps
 *     "Post anyway" available.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  ALL_ADVISORY_KINDS,
  ADVISORY_DEFINITIONS,
  BROAD_CLAIM_MIN_CHARS,
  DEFAULT_PRESEND_ROOM_CONTEXT,
  buildPreSendReview,
  type PreSendReviewInput,
} from '../src/features/arguments/preSendReviewModel';
import { isPostAnywayVisible } from '../src/features/arguments/PreSendReviewSheet';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import type { EvaluationResult } from '../src/domain/constitution/types';

function makeDraft(overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    draftId: 'd1',
    debateId: 'db1',
    parentId: 'p1',
    argumentType: 'claim',
    side: 'affirmative',
    body: 'A perfectly ordinary structurally valid reply body here.',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-05-20T00:00:00.000Z',
    dirty: true,
    ...overrides,
  };
}

function cleanEvaluation(): EvaluationResult {
  return {
    allowPost: true,
    blockingErrors: [],
    warnings: [],
    flagsToPersist: [],
    normalizedTags: [],
    clientValidationPayload: {
      checkedAt: 'n',
      constitutionVersion: 'v',
      ruleCodesChecked: [],
      flagCount: 0,
      blockingCount: 0,
    },
    serverValidationPayload: {
      checkedAt: 'n',
      constitutionVersion: 'v',
      ruleCodesChecked: [],
      flagCount: 0,
      blockingCount: 0,
    },
  };
}

function makeInput(overrides: Partial<PreSendReviewInput> = {}): PreSendReviewInput {
  return {
    draft: makeDraft(),
    mode: 'casual',
    parent: null,
    room: DEFAULT_PRESEND_ROOM_CONTEXT,
    lifecycle: {
      parentSnapshot: null,
      parentClusterSummary: null,
      parentLinkage: null,
    },
    evaluation: cleanEvaluation(),
    channelSuggestion: null,
    isFirstPostInSession: false,
    ...overrides,
  };
}

// ── 1. Charged keywords never produce a structural block ───────

describe('preSendReview — no keyword gating', () => {
  it('a charged-keyword but structurally-valid body yields zero structuralBlocks', () => {
    const chargedBody =
      'My opponent is a lying dishonest propagandist troll and this is ' +
      'total garbage and everyone knows it is fake fake fake.';
    const review = buildPreSendReview(
      makeInput({ draft: makeDraft({ body: chargedBody }) }),
    );
    expect(review.structuralBlocks).toHaveLength(0);
    expect(review.hasStructuralBlock).toBe(false);
  });

  it('a charged body and a benign body of equal length/shape give identical advisories', () => {
    // Both are below the broad-claim threshold and neither ends in `?`.
    const charged = 'liar '.repeat(10).trim();
    const benign = 'apple'.length === charged.length / 2 ? '' : '';
    // Build two bodies of identical length, one charged, one benign.
    const len = charged.length;
    const benignBody = 'a'.repeat(len);
    expect(benignBody.length).toBe(charged.length);
    expect(benign).toBe('');

    const chargedReview = buildPreSendReview(
      makeInput({ draft: makeDraft({ body: charged }) }),
    );
    const benignReview = buildPreSendReview(
      makeInput({ draft: makeDraft({ body: benignBody }) }),
    );
    expect(chargedReview.advisories.map((a) => a.kind)).toEqual(
      benignReview.advisories.map((a) => a.kind),
    );
    expect(chargedReview.structuralBlocks).toEqual(benignReview.structuralBlocks);
  });

  it('a charged body and a benign body BOTH long enough fire broad_claim identically', () => {
    const chargedLong = ('liar fake garbage ' .repeat(40)).slice(
      0,
      BROAD_CLAIM_MIN_CHARS + 20,
    );
    const benignLong = 'a'.repeat(chargedLong.length);
    const chargedReview = buildPreSendReview(
      makeInput({ draft: makeDraft({ body: chargedLong }) }),
    );
    const benignReview = buildPreSendReview(
      makeInput({ draft: makeDraft({ body: benignLong }) }),
    );
    expect(chargedReview.advisories.map((a) => a.kind)).toEqual(
      benignReview.advisories.map((a) => a.kind),
    );
    expect(chargedReview.advisories.map((a) => a.kind)).toContain('broad_claim');
  });
});

// ── 2. Heat / popularity are never signals ─────────────────────

describe('preSendReview — heat / popularity are not signals', () => {
  it('two structurally-identical drafts produce the same review regardless of (mock) heat', () => {
    // The model has no heat / reply-count input at all — these two
    // parents differ only in fields the model must NOT read.
    const baseInput = makeInput({
      parent: {
        id: 'p1',
        debateId: 'db1',
        parentId: null,
        authorId: 'u1',
        argumentType: 'thesis',
        side: 'affirmative',
        body: 'parent',
        depth: 1,
        status: 'posted',
        targetExcerpt: null,
        disagreementAxis: null,
        // railPayload could in principle carry heat-like data — the
        // model must ignore it entirely.
        railPayload: { heat: 0, replyCount: 0 },
        clientValidation: {},
        serverValidation: {},
        clientSubmissionId: null,
        createdAt: 'n',
        updatedAt: 'n',
      },
    });
    const hotInput = makeInput({
      parent: { ...baseInput.parent!, railPayload: { heat: 999, replyCount: 500 } },
    });
    expect(buildPreSendReview(baseInput)).toEqual(buildPreSendReview(hotInput));
  });
});

// ── 3. No blocking advisory severity ───────────────────────────

describe('preSendReview — advisory severity is exactly info | soft', () => {
  it('every ADVISORY_DEFINITIONS baseSeverity is info or soft', () => {
    for (const kind of ALL_ADVISORY_KINDS) {
      const severity = ADVISORY_DEFINITIONS[kind].baseSeverity;
      expect(['info', 'soft']).toContain(severity);
    }
  });

  it('every advisory produced by the model has severity info or soft', () => {
    // Build a review that surfaces several advisories.
    const review = buildPreSendReview(
      makeInput({
        draft: makeDraft({
          body: 'x'.repeat(BROAD_CLAIM_MIN_CHARS),
          selectedTagCodes: ['tangent'],
        }),
        isFirstPostInSession: true,
      }),
    );
    expect(review.advisories.length).toBeGreaterThan(0);
    for (const advisory of review.advisories) {
      expect(['info', 'soft']).toContain(advisory.severity);
    }
  });

  it('PreSendAdvisory carries no blocking field — only kind/severity/suggested/plainLanguage', () => {
    const review = buildPreSendReview(
      makeInput({ isFirstPostInSession: true }),
    );
    const advisory = review.advisories[0];
    expect(advisory).toBeDefined();
    expect(Object.keys(advisory).sort()).toEqual(
      ['kind', 'plainLanguage', 'severity', 'suggested'].sort(),
    );
  });
});

// ── 4. An advisory-only review never hides "Post anyway" ────────

describe('preSendReview — advisory never blocks a post', () => {
  it('an advisory-only review keeps Post anyway visible', () => {
    const review = buildPreSendReview(
      makeInput({ isFirstPostInSession: true }),
    );
    expect(review.advisories.length).toBeGreaterThan(0);
    expect(review.hasStructuralBlock).toBe(false);
    expect(isPostAnywayVisible(review)).toBe(true);
  });

  it('only a structural block hides Post anyway — never an advisory', () => {
    const blocked = buildPreSendReview(
      makeInput({
        evaluation: {
          ...cleanEvaluation(),
          allowPost: false,
          blockingErrors: [
            {
              ruleCode: 'r',
              flagCode: 'invalid_transition',
              severity: 'blocking',
              message: 'm',
              payload: {},
            },
          ],
        },
      }),
    );
    expect(blocked.hasStructuralBlock).toBe(true);
    expect(isPostAnywayVisible(blocked)).toBe(false);
  });
});
