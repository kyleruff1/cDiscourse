/**
 * REF-005 — requestReviewModel pure-model tests.
 *
 * Covers the binding contracts (design §5 / §11):
 *   - `canSubmitConcern` — all four fields required; whitespace / null /
 *     partial / foreign values → false.
 *   - The full 6×6 (concern type × remedy) matrix through
 *     `buildSubmittableConcern` / `routeRemedy` / `deriveConcernVisibility`.
 *   - Visibility pins: NEVER `public_after_review` (zero of 36 combos);
 *     person-directed types ALWAYS `moderator_visible` (person-directed-
 *     never-public); claim-level type + claim-level remedy → `composer_only`.
 *   - `routeRemedy` totality against the §5.2 routing table.
 *
 * Pure TS — no React, no Supabase, no network.
 */
import {
  ALL_REVIEW_CONCERN_TYPES,
  ALL_REVIEW_REQUESTED_REMEDIES,
  PERSON_DIRECTED_CONCERN_TYPES,
  buildSubmittableConcern,
  canSubmitConcern,
  deriveConcernVisibility,
  routeRemedy,
  type ConcernRemedyRouting,
  type ReviewConcernType,
  type ReviewRequestedRemedy,
  type StructuredConcernDraft,
} from '../src/features/requestReview/requestReviewModel';

const VALID: StructuredConcernDraft = {
  targetNodeId: 'node-1',
  targetQuote: 'the exact passage',
  concernType: 'needs_source',
  requestedRemedy: 'ask_source',
  visibility: 'composer_only',
};

// The §5.2 binding routing table.
const EXPECTED_ROUTING: Record<ReviewRequestedRemedy, ConcernRemedyRouting> = {
  ask_source: { kind: 'act_entry', actEntryId: 'ask_source' },
  ask_quote: { kind: 'act_entry', actEntryId: 'ask_quote' },
  branch: { kind: 'act_entry', actEntryId: 'branch_tangent' },
  narrow: { kind: 'act_entry', actEntryId: 'narrow' },
  hide_pending_review: { kind: 'moderator_queue', queueAction: 'hide_pending_review' },
  moderator_review: { kind: 'moderator_queue', queueAction: 'moderator_review' },
};

const MODERATOR_QUEUE_REMEDIES: ReviewRequestedRemedy[] = ['hide_pending_review', 'moderator_review'];

// ── Frozen vocabularies ────────────────────────────────────────

describe('REF-005 frozen vocabularies', () => {
  it('exposes exactly the six concern types', () => {
    expect([...ALL_REVIEW_CONCERN_TYPES].sort()).toEqual(
      [
        'about_person_not_claim',
        'harassment_concern',
        'needs_quote',
        'needs_source',
        'side_issue',
        'unclear_term',
      ].sort(),
    );
  });

  it('exposes exactly the six requested remedies', () => {
    expect([...ALL_REVIEW_REQUESTED_REMEDIES].sort()).toEqual(
      ['ask_quote', 'ask_source', 'branch', 'hide_pending_review', 'moderator_review', 'narrow'].sort(),
    );
  });

  it('person-directed set is exactly the two sensitive types', () => {
    expect([...PERSON_DIRECTED_CONCERN_TYPES].sort()).toEqual(
      ['about_person_not_claim', 'harassment_concern'].sort(),
    );
  });
});

// ── canSubmitConcern ───────────────────────────────────────────

describe('canSubmitConcern', () => {
  it('returns true when all four fields are present', () => {
    expect(canSubmitConcern(VALID)).toBe(true);
  });

  it('returns true even without a visibility field (it is derived)', () => {
    const withoutVisibility: Partial<StructuredConcernDraft> = {
      targetNodeId: VALID.targetNodeId,
      targetQuote: VALID.targetQuote,
      concernType: VALID.concernType,
      requestedRemedy: VALID.requestedRemedy,
    };
    expect(canSubmitConcern(withoutVisibility)).toBe(true);
  });

  it('returns false for a missing target node id', () => {
    expect(canSubmitConcern({ ...VALID, targetNodeId: '' })).toBe(false);
  });

  it('returns false for an empty quote', () => {
    expect(canSubmitConcern({ ...VALID, targetQuote: '' })).toBe(false);
  });

  it('returns false for a whitespace-only quote', () => {
    expect(canSubmitConcern({ ...VALID, targetQuote: '   \n\t ' })).toBe(false);
  });

  it('returns false for a missing concern type', () => {
    expect(
      canSubmitConcern({
        targetNodeId: VALID.targetNodeId,
        targetQuote: VALID.targetQuote,
        requestedRemedy: VALID.requestedRemedy,
      }),
    ).toBe(false);
  });

  it('returns false for a missing remedy', () => {
    expect(
      canSubmitConcern({
        targetNodeId: VALID.targetNodeId,
        targetQuote: VALID.targetQuote,
        concernType: VALID.concernType,
      }),
    ).toBe(false);
  });

  it('returns false for a foreign concern type', () => {
    expect(canSubmitConcern({ ...VALID, concernType: 'liar' as ReviewConcernType })).toBe(false);
  });

  it('returns false for a foreign remedy', () => {
    expect(canSubmitConcern({ ...VALID, requestedRemedy: 'delete' as ReviewRequestedRemedy })).toBe(
      false,
    );
  });

  it('returns false for null / undefined / non-object', () => {
    expect(canSubmitConcern(null)).toBe(false);
    expect(canSubmitConcern(undefined)).toBe(false);
    expect(canSubmitConcern({} as Partial<StructuredConcernDraft>)).toBe(false);
    expect(canSubmitConcern(42 as unknown as Partial<StructuredConcernDraft>)).toBe(false);
  });
});

// ── routeRemedy totality (§5.2) ────────────────────────────────

describe('routeRemedy', () => {
  for (const remedy of ALL_REVIEW_REQUESTED_REMEDIES) {
    it(`maps ${remedy} to the §5.2 routing`, () => {
      expect(routeRemedy(remedy)).toEqual(EXPECTED_ROUTING[remedy]);
    });
  }

  it('claim-level remedies route to act_entry; queue remedies route to moderator_queue', () => {
    expect(routeRemedy('ask_source').kind).toBe('act_entry');
    expect(routeRemedy('ask_quote').kind).toBe('act_entry');
    expect(routeRemedy('branch').kind).toBe('act_entry');
    expect(routeRemedy('narrow').kind).toBe('act_entry');
    expect(routeRemedy('hide_pending_review').kind).toBe('moderator_queue');
    expect(routeRemedy('moderator_review').kind).toBe('moderator_queue');
  });
});

// ── The full 6×6 matrix ────────────────────────────────────────

describe('REF-005 concern-type × remedy matrix (36 combos)', () => {
  const combos: Array<{ type: ReviewConcernType; remedy: ReviewRequestedRemedy }> = [];
  for (const type of ALL_REVIEW_CONCERN_TYPES) {
    for (const remedy of ALL_REVIEW_REQUESTED_REMEDIES) {
      combos.push({ type, remedy });
    }
  }

  it('enumerates exactly 36 combinations', () => {
    expect(combos.length).toBe(36);
  });

  it('NEVER derives public_after_review for any of the 36 combos', () => {
    for (const { type, remedy } of combos) {
      expect(deriveConcernVisibility(type, remedy)).not.toBe('public_after_review');
    }
  });

  it('person-directed types are ALWAYS moderator_visible (person-directed-never-public)', () => {
    for (const { type, remedy } of combos) {
      if (PERSON_DIRECTED_CONCERN_TYPES.has(type)) {
        expect(deriveConcernVisibility(type, remedy)).toBe('moderator_visible');
      }
    }
  });

  it('claim-level type + claim-level remedy → composer_only', () => {
    for (const { type, remedy } of combos) {
      const personDirected = PERSON_DIRECTED_CONCERN_TYPES.has(type);
      const queueRemedy = MODERATOR_QUEUE_REMEDIES.includes(remedy);
      if (!personDirected && !queueRemedy) {
        expect(deriveConcernVisibility(type, remedy)).toBe('composer_only');
      }
    }
  });

  it('non-person type + moderator-queue remedy → moderator_visible', () => {
    for (const { type, remedy } of combos) {
      const personDirected = PERSON_DIRECTED_CONCERN_TYPES.has(type);
      const queueRemedy = MODERATOR_QUEUE_REMEDIES.includes(remedy);
      if (!personDirected && queueRemedy) {
        expect(deriveConcernVisibility(type, remedy)).toBe('moderator_visible');
      }
    }
  });

  it('the matrix has exactly 16 composer_only, 20 moderator_visible, 0 public_after_review', () => {
    const counts = { composer_only: 0, moderator_visible: 0, public_after_review: 0 };
    for (const { type, remedy } of combos) {
      counts[deriveConcernVisibility(type, remedy)] += 1;
    }
    expect(counts).toEqual({ composer_only: 16, moderator_visible: 20, public_after_review: 0 });
  });

  it('buildSubmittableConcern stamps the derived visibility + routing for every combo', () => {
    for (const { type, remedy } of combos) {
      const draft = buildSubmittableConcern({
        targetNodeId: 'node-x',
        targetQuote: '  a passage  ',
        concernType: type,
        requestedRemedy: remedy,
      });
      expect(draft).not.toBeNull();
      expect(draft!.visibility).toBe(deriveConcernVisibility(type, remedy));
      expect(draft!.targetQuote).toBe('a passage'); // trimmed
      expect(routeRemedy(draft!.requestedRemedy)).toEqual(EXPECTED_ROUTING[remedy]);
    }
  });
});

// ── buildSubmittableConcern guards ─────────────────────────────

describe('buildSubmittableConcern', () => {
  it('returns null when the draft is not submittable', () => {
    expect(buildSubmittableConcern(null)).toBeNull();
    expect(buildSubmittableConcern({ targetNodeId: 'n', targetQuote: '   ' })).toBeNull();
    expect(buildSubmittableConcern({ ...VALID, concernType: 'troll' as ReviewConcernType })).toBeNull();
  });

  it('returns a frozen draft', () => {
    const draft = buildSubmittableConcern(VALID)!;
    expect(Object.isFrozen(draft)).toBe(true);
  });

  it('a person-directed concern is never public_after_review even with a claim-level remedy', () => {
    const draft = buildSubmittableConcern({
      targetNodeId: 'n',
      targetQuote: 'q',
      concernType: 'harassment_concern',
      requestedRemedy: 'ask_source',
    })!;
    expect(draft.visibility).toBe('moderator_visible');
  });
});
