import {
  deriveClaimStanding,
  getClaimStandingDisplay,
  getAllowedNextMovesForStanding,
  getRecommendedMoveForStanding,
  ALL_CLAIM_STANDINGS,
} from '../src/features/arguments/claimStanding';
import type { ClaimStandingInput } from '../src/features/arguments/claimStanding';

const base: ClaimStandingInput = {
  hasParent: false,
  hasRebuttal: false,
  hasEvidence: false,
  hasConcession: false,
  hasSynthesis: false,
  hasClarification: false,
  childCount: 0,
  hasWeakTopicFlag: false,
  hasOffTrackFlag: false,
  depth: 0,
};

describe('claimStanding', () => {
  describe('deriveClaimStanding', () => {
    it('returns not_started when no parent and no children', () => {
      const r = deriveClaimStanding(base);
      expect(r.standing).toBe('not_started');
    });

    it('returns under_challenge when has parent but no children', () => {
      const r = deriveClaimStanding({ ...base, hasParent: true });
      expect(r.standing).toBe('under_challenge');
    });

    it('returns conceded when concession present', () => {
      const r = deriveClaimStanding({ ...base, hasParent: true, hasConcession: true, childCount: 1 });
      expect(r.standing).toBe('conceded');
    });

    it('returns settled_for_now when concession + synthesis', () => {
      const r = deriveClaimStanding({
        ...base, hasParent: true, hasConcession: true, hasSynthesis: true, childCount: 2,
      });
      expect(r.standing).toBe('settled_for_now');
      expect(r.canDeclareRestingStatus).toBe(true);
    });

    it('returns narrowed when synthesis (no concession)', () => {
      const r = deriveClaimStanding({ ...base, hasParent: true, hasSynthesis: true, childCount: 1 });
      expect(r.standing).toBe('narrowed');
    });

    it('returns stronger_than_counter when rebuttal + evidence', () => {
      const r = deriveClaimStanding({ ...base, hasRebuttal: true, hasEvidence: true, childCount: 2 });
      expect(r.standing).toBe('stronger_than_counter');
    });

    it('returns counter_currently_stronger when rebuttal but no evidence', () => {
      const r = deriveClaimStanding({ ...base, hasRebuttal: true, childCount: 1 });
      expect(r.standing).toBe('counter_currently_stronger');
    });

    it('returns receipts_added when evidence but no rebuttal', () => {
      const r = deriveClaimStanding({ ...base, hasEvidence: true, childCount: 1 });
      expect(r.standing).toBe('receipts_added');
    });

    it('returns both_wrong_possible when weak topic + rebuttal', () => {
      const r = deriveClaimStanding({ ...base, hasRebuttal: true, hasWeakTopicFlag: true, childCount: 1 });
      expect(r.standing).toBe('both_wrong_possible');
      expect(r.canRequestJudgeReview).toBe(true);
    });

    it('returns branch_needed when off-track + multiple children', () => {
      const r = deriveClaimStanding({ ...base, hasOffTrackFlag: true, childCount: 2 });
      expect(r.standing).toBe('branch_needed');
    });

    it('returns needs_receipts when clarification but no evidence', () => {
      const r = deriveClaimStanding({ ...base, hasClarification: true, childCount: 1 });
      expect(r.standing).toBe('needs_receipts');
    });
  });

  describe('display', () => {
    it('returns label and description for every standing', () => {
      for (const s of ALL_CLAIM_STANDINGS) {
        const { label, description } = getClaimStandingDisplay(s);
        expect(label).toBeTruthy();
        expect(description).toBeTruthy();
      }
    });
  });

  describe('forbidden wording', () => {
    it('no standing label uses "winner" or "loser" as objective fact', () => {
      for (const s of ALL_CLAIM_STANDINGS) {
        const { label, description } = getClaimStandingDisplay(s);
        expect(label.toLowerCase()).not.toContain('winner');
        expect(label.toLowerCase()).not.toContain('loser');
        expect(description.toLowerCase()).not.toContain('objective truth');
        expect(description.toLowerCase()).not.toContain('proven fact');
      }
    });

    it('does not claim "winner" or "proven" in any description', () => {
      for (const s of ALL_CLAIM_STANDINGS) {
        const { description } = getClaimStandingDisplay(s);
        expect(description.toLowerCase()).not.toMatch(/\bwinner\b/);
      }
    });
  });

  describe('allowed moves', () => {
    it('not_started allows start_thesis and make_claim', () => {
      const moves = getAllowedNextMovesForStanding('not_started');
      expect(moves).toContain('start_thesis');
      expect(moves).toContain('make_claim');
    });

    it('conceded only allows synthesize_thread', () => {
      const moves = getAllowedNextMovesForStanding('conceded');
      expect(moves).toEqual(['synthesize_thread']);
    });

    it('recommended move for conceded is synthesize_thread', () => {
      expect(getRecommendedMoveForStanding('conceded')).toBe('synthesize_thread');
    });

    it('recommended move for settled_for_now is null', () => {
      expect(getRecommendedMoveForStanding('settled_for_now')).toBeNull();
    });
  });
});
