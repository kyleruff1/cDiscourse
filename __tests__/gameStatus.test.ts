import {
  deriveGameStatus,
  getGameStatusDisplay,
  isRestingStatusPositive,
  isRestingStatusNeedsAttention,
  isRestingStatusPlayful,
  shouldRecommendBranch,
  shouldRequestReceipts,
  shouldRequestQuote,
  ALL_GAME_RESTING_STATUSES,
} from '../src/features/arguments/gameStatus';
import type { GameStatusInput } from '../src/features/arguments/gameStatus';

const base: GameStatusInput = {
  childCount: 0,
  hasRebuttalChild: false,
  hasConcessionChild: false,
  hasSynthesisChild: false,
  hasEvidenceChild: false,
  hasClarificationChild: false,
  hasQuoteAnchor: false,
  hasWeakTopicFlag: false,
  hasOffTrackFlag: false,
};

describe('gameStatus', () => {
  describe('deriveGameStatus', () => {
    it('returns open when no children', () => {
      const result = deriveGameStatus(base);
      expect(result.status).toBe('open');
      expect(result.isFinal).toBe(false);
    });

    it('returns responded_to with generic reply children', () => {
      const result = deriveGameStatus({ ...base, childCount: 1 });
      expect(result.status).toBe('responded_to');
    });

    it('returns point_conceded when concession child present', () => {
      const result = deriveGameStatus({ ...base, childCount: 1, hasConcessionChild: true });
      expect(result.status).toBe('point_conceded');
    });

    it('returns surrendered when concession + user mark', () => {
      const result = deriveGameStatus({
        ...base, childCount: 1, hasConcessionChild: true, userMarks: ['conceding_this'],
      });
      expect(result.status).toBe('surrendered');
    });

    it('returns peace_treaty_ish when concession + synthesis', () => {
      const result = deriveGameStatus({
        ...base, childCount: 2, hasConcessionChild: true, hasSynthesisChild: true,
      });
      expect(result.status).toBe('peace_treaty_ish');
      expect(result.isFinal).toBe(true);
    });

    it('returns mostly_settled when synthesis present (no concession)', () => {
      const result = deriveGameStatus({ ...base, childCount: 1, hasSynthesisChild: true });
      expect(result.status).toBe('mostly_settled');
    });

    it('returns receipts_requested when rebuttal but no evidence', () => {
      const result = deriveGameStatus({ ...base, childCount: 1, hasRebuttalChild: true });
      expect(result.status).toBe('receipts_requested');
    });

    it('returns receipts_dropped when evidence child present', () => {
      const result = deriveGameStatus({
        ...base, childCount: 1, hasEvidenceChild: true, hasRebuttalChild: false,
      });
      expect(result.status).toBe('receipts_dropped');
    });

    it('returns unresolved when rebuttal + evidence (no concession)', () => {
      // Both sides have rebuttals and evidence — no clear resolution yet
      const result = deriveGameStatus({
        ...base, childCount: 2, hasRebuttalChild: true, hasEvidenceChild: true,
      });
      expect(result.status).toBe('unresolved');
    });

    it('returns stalemate when many rebuttals each with evidence', () => {
      const result = deriveGameStatus({
        ...base, childCount: 3, hasRebuttalChild: true, hasEvidenceChild: true,
      });
      expect(result.status).toBe('stalemate');
    });

    it('returns both_might_be_wrong when weak topic flag + rebuttal + evidence', () => {
      const result = deriveGameStatus({
        ...base, childCount: 2, hasRebuttalChild: true, hasWeakTopicFlag: true, hasEvidenceChild: true,
      });
      expect(result.status).toBe('both_might_be_wrong');
    });

    it('returns off_track when off-track flag and few children', () => {
      const result = deriveGameStatus({ ...base, childCount: 1, hasOffTrackFlag: true });
      expect(result.status).toBe('off_track');
    });

    it('returns branch_recommended when off-track + multiple children', () => {
      const result = deriveGameStatus({ ...base, childCount: 2, hasOffTrackFlag: true });
      expect(result.status).toBe('branch_recommended');
    });

    it('returns needs_judge_human_review when moderator flags it', () => {
      const result = deriveGameStatus({ ...base, moderatorStatus: 'needs_review' });
      expect(result.status).toBe('needs_judge_human_review');
      expect(result.requiresHumanReview).toBe(true);
    });

    it('returns quote_requested when clarification child and no quote anchor', () => {
      const result = deriveGameStatus({
        ...base, childCount: 1, hasClarificationChild: true,
      });
      expect(result.status).toBe('quote_requested');
    });
  });

  describe('getGameStatusDisplay', () => {
    it('returns label and description for every status', () => {
      for (const status of ALL_GAME_RESTING_STATUSES) {
        const display = getGameStatusDisplay(status);
        expect(display.label).toBeTruthy();
        expect(display.description).toBeTruthy();
        expect(display.severity).toMatch(/neutral|attention|positive|playful/);
      }
    });

    it('returns playful labels for surrendered and peace_treaty_ish', () => {
      expect(getGameStatusDisplay('surrendered').playfulLabel).toBeTruthy();
      expect(getGameStatusDisplay('peace_treaty_ish').playfulLabel).toBeTruthy();
    });
  });

  describe('forbidden content checks', () => {
    it('no status label includes "winner"', () => {
      for (const status of ALL_GAME_RESTING_STATUSES) {
        const { label, playfulLabel, description } = getGameStatusDisplay(status);
        expect(label.toLowerCase()).not.toContain('winner');
        expect(description.toLowerCase()).not.toContain('winner');
        if (playfulLabel) expect(playfulLabel.toLowerCase()).not.toContain('winner');
      }
    });

    it('no status label includes "loser"', () => {
      for (const status of ALL_GAME_RESTING_STATUSES) {
        const { label, playfulLabel, description } = getGameStatusDisplay(status);
        expect(label.toLowerCase()).not.toContain('loser');
        expect(description.toLowerCase()).not.toContain('loser');
        if (playfulLabel) expect(playfulLabel.toLowerCase()).not.toContain('loser');
      }
    });

    it('no status label includes "liar" or "dishonest"', () => {
      for (const status of ALL_GAME_RESTING_STATUSES) {
        const { label, description } = getGameStatusDisplay(status);
        expect(label.toLowerCase()).not.toMatch(/\b(liar|dishonest)\b/);
        expect(description.toLowerCase()).not.toMatch(/\b(liar|dishonest)\b/);
      }
    });

    it('no status label includes "bad faith"', () => {
      for (const status of ALL_GAME_RESTING_STATUSES) {
        const { label, description } = getGameStatusDisplay(status);
        expect(label.toLowerCase()).not.toContain('bad faith');
        expect(description.toLowerCase()).not.toContain('bad faith');
      }
    });

    it('no status declares objective truth', () => {
      const TRUTH_WORDS = ['objectively', 'proven', 'factually correct', 'absolute truth'];
      for (const status of ALL_GAME_RESTING_STATUSES) {
        const { description } = getGameStatusDisplay(status);
        for (const word of TRUTH_WORDS) {
          expect(description.toLowerCase()).not.toContain(word);
        }
      }
    });
  });

  describe('classification helpers', () => {
    it('isRestingStatusPositive identifies positive statuses', () => {
      expect(isRestingStatusPositive('receipts_dropped')).toBe(true);
      expect(isRestingStatusPositive('dispute_narrowed')).toBe(true);
      expect(isRestingStatusPositive('open')).toBe(false);
    });

    it('isRestingStatusNeedsAttention identifies attention statuses', () => {
      expect(isRestingStatusNeedsAttention('awaiting_reply')).toBe(true);
      expect(isRestingStatusNeedsAttention('off_track')).toBe(true);
      expect(isRestingStatusNeedsAttention('open')).toBe(false);
    });

    it('isRestingStatusPlayful identifies playful statuses', () => {
      expect(isRestingStatusPlayful('surrendered')).toBe(true);
      expect(isRestingStatusPlayful('peace_treaty_ish')).toBe(true);
      expect(isRestingStatusPlayful('open')).toBe(false);
    });
  });

  describe('recommendation helpers', () => {
    it('shouldRecommendBranch triggers on off-track + multiple children', () => {
      expect(shouldRecommendBranch({ ...base, hasOffTrackFlag: true, childCount: 2 })).toBe(true);
      expect(shouldRecommendBranch({ ...base, hasOffTrackFlag: true, childCount: 1 })).toBe(false);
      expect(shouldRecommendBranch({ ...base, hasOffTrackFlag: false, childCount: 3 })).toBe(false);
    });

    it('shouldRequestReceipts triggers when rebuttal but no evidence', () => {
      expect(shouldRequestReceipts({ ...base, hasRebuttalChild: true, childCount: 1 })).toBe(true);
      expect(shouldRequestReceipts({ ...base, hasRebuttalChild: true, hasEvidenceChild: true, childCount: 1 })).toBe(false);
    });

    it('shouldRequestQuote triggers when clarification child but no quote anchor', () => {
      expect(shouldRequestQuote({ ...base, hasClarificationChild: true, childCount: 1 })).toBe(true);
      expect(shouldRequestQuote({ ...base, hasClarificationChild: true, hasQuoteAnchor: true, childCount: 1 })).toBe(false);
    });
  });
});
