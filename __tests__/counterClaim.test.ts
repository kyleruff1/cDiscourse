import {
  validateCounterClaimDraft,
  buildInitialArgumentMoves,
  createRoomWithOptionalCounterDraft,
  getCounterClaimPromptCopy,
  COUNTER_CLAIM_COPY,
} from '../src/features/arguments/counterClaim';
import type { CounterClaimDraft } from '../src/features/arguments/counterClaim';

describe('counterClaim', () => {
  const validDraft: CounterClaimDraft = {
    mainClaim: 'The play-in tournament improves competitive balance.',
    counterClaim: 'The play-in tournament rewards mediocrity.',
    basis: 'See standings data for 2021-2024.',
    side: 'affirmative',
  };

  describe('validateCounterClaimDraft', () => {
    it('validates a complete draft as valid', () => {
      const r = validateCounterClaimDraft(validDraft);
      expect(r.valid).toBe(true);
      expect(r.errors).toHaveLength(0);
    });

    it('rejects empty main claim', () => {
      const r = validateCounterClaimDraft({ ...validDraft, mainClaim: '' });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => /main claim/i.test(e))).toBe(true);
    });

    it('rejects too-short main claim', () => {
      const r = validateCounterClaimDraft({ ...validDraft, mainClaim: 'Short' });
      expect(r.valid).toBe(false);
    });

    it('rejects too-long main claim', () => {
      const r = validateCounterClaimDraft({ ...validDraft, mainClaim: 'A'.repeat(2001) });
      expect(r.valid).toBe(false);
    });

    it('warns on short counter claim', () => {
      const r = validateCounterClaimDraft({ ...validDraft, counterClaim: 'Nope' });
      expect(r.warnings.length).toBeGreaterThan(0);
    });

    it('accepts null counter claim', () => {
      const r = validateCounterClaimDraft({ ...validDraft, counterClaim: null });
      expect(r.valid).toBe(true);
    });

    it('accepts null basis', () => {
      const r = validateCounterClaimDraft({ ...validDraft, basis: null });
      expect(r.valid).toBe(true);
    });
  });

  describe('buildInitialArgumentMoves', () => {
    it('builds root_claim move from main claim', () => {
      const moves = buildInitialArgumentMoves(validDraft);
      expect(moves[0].kind).toBe('root_claim');
      expect(moves[0].body).toBe(validDraft.mainClaim);
      expect(moves[0].side).toBe('affirmative');
    });

    it('builds opening_counter move from counter claim', () => {
      const moves = buildInitialArgumentMoves(validDraft);
      expect(moves).toHaveLength(2);
      expect(moves[1].kind).toBe('opening_counter');
      expect(moves[1].body).toBe(validDraft.counterClaim);
      expect(moves[1].side).toBe('negative');
    });

    it('does not build counter move when counter claim is null', () => {
      const moves = buildInitialArgumentMoves({ ...validDraft, counterClaim: null });
      expect(moves).toHaveLength(1);
    });

    it('does not build counter when counter claim is too short', () => {
      const moves = buildInitialArgumentMoves({ ...validDraft, counterClaim: 'No' });
      expect(moves).toHaveLength(1);
    });

    it('flips side to affirmative when main is negative', () => {
      const moves = buildInitialArgumentMoves({ ...validDraft, side: 'negative' });
      expect(moves[1].side).toBe('affirmative');
    });

    it('keeps neutral side for both when main is neutral', () => {
      const moves = buildInitialArgumentMoves({ ...validDraft, side: 'neutral' });
      expect(moves[1].side).toBe('neutral');
    });
  });

  describe('createRoomWithOptionalCounterDraft', () => {
    it('returns draft, validation, and moves for valid input', () => {
      const result = createRoomWithOptionalCounterDraft({
        title: 'NBA Play-In',
        resolution: 'The play-in format is good.',
        mainClaim: 'The play-in improves competitive balance significantly.',
        counterClaim: 'The play-in rewards lower-seeded mediocrity over sustained excellence.',
      });
      expect(result.validation.valid).toBe(true);
      expect(result.moves).toHaveLength(2);
      expect(result.draft.side).toBe('affirmative');
    });

    it('returns no moves for invalid input', () => {
      const result = createRoomWithOptionalCounterDraft({
        title: 'X',
        resolution: 'Y',
        mainClaim: '',
      });
      expect(result.validation.valid).toBe(false);
      expect(result.moves).toHaveLength(0);
    });
  });

  describe('getCounterClaimPromptCopy', () => {
    it('returns the COUNTER_CLAIM_COPY object', () => {
      expect(getCounterClaimPromptCopy()).toBe(COUNTER_CLAIM_COPY);
    });

    it('has self-directed concession language if present', () => {
      // No opponent-mocking copy in the counterclaim module
      const values = Object.values(COUNTER_CLAIM_COPY);
      for (const v of values) {
        if (typeof v === 'string') {
          expect(v.toLowerCase()).not.toContain('you are wrong');
          expect(v.toLowerCase()).not.toContain('liar');
        }
      }
    });
  });
});
