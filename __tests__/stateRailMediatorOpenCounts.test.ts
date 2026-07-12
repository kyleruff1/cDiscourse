/**
 * UX-PR-G (#920) P1-11 — the two "open" counts are labelled to self-explain.
 *
 * The state-rail "open points" chip is a SUPERSET (structured disagreement
 * points PLUS unaddressed did-not-address chains when move_marks is on); the
 * mediator rail lists only the structured points. Neither is wrong — they
 * measure different things. This card adds copy (no concept unification):
 *   - the state-rail screen-reader scope says "across this whole argument."
 *   - the mediator rail carries a scopeNote naming its structured subset.
 *
 * This pins the exact strings + asserts they are ban-list clean, and that the
 * compact visible chip word is unchanged ("open points").
 */
import { STATE_RAIL_COPY } from '../src/features/arguments/gameCopy';
import { DISAGREEMENT_POINTS_RAIL_COPY } from '../src/features/mediator/mediatorRailCopy';

const VERDICT_BAN = [
  'winner', 'loser', 'correct', 'incorrect', 'right', 'wrong', 'won', 'lost',
  'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist',
  'stupid', 'idiot', 'truth', 'true', 'false', 'score', 'verdict',
];

function isBanClean(text: string): boolean {
  const lower = text.toLowerCase();
  return VERDICT_BAN.every((t) => !new RegExp(`\\b${t}\\b`).test(lower));
}

describe('UX-PR-G P1-11 — state-rail open-points a11y scope', () => {
  it('the screen-reader suffix says "across this whole argument."', () => {
    expect(STATE_RAIL_COPY.open_points_a11y_suffix).toBe('across this whole argument.');
  });

  it('keeps the compact visible chip word "open points"', () => {
    expect(STATE_RAIL_COPY.open_point_word_one).toBe('open point');
    expect(STATE_RAIL_COPY.open_point_word_many).toBe('open points');
  });

  it('the suffix is ban-list clean', () => {
    expect(isBanClean(STATE_RAIL_COPY.open_points_a11y_suffix)).toBe(true);
  });
});

describe('UX-PR-G P1-11 — mediator rail scopeNote', () => {
  it('names the structured subset the mediator is actively tracking', () => {
    expect(DISAGREEMENT_POINTS_RAIL_COPY.scopeNote).toBe(
      'The disagreement points the mediator is actively tracking.',
    );
  });

  it('the scopeNote is ban-list clean', () => {
    expect(isBanClean(DISAGREEMENT_POINTS_RAIL_COPY.scopeNote)).toBe(true);
  });

  it('the scopeNote carries no raw internal code (no snake_case leak)', () => {
    expect(DISAGREEMENT_POINTS_RAIL_COPY.scopeNote).not.toMatch(/_/);
  });
});
