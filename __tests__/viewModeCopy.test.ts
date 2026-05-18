import { VIEW_MODE_COPY } from '../src/features/arguments/viewModeCopy';

describe('VIEW_MODE_COPY', () => {
  it('uses Cards (not Stack) as the user-facing label for the deeper card-inspection mode', () => {
    expect(VIEW_MODE_COPY.cards.label).toBe('Cards');
    expect(VIEW_MODE_COPY.cards.accessibilityLabel).toBe('Cards view');
    // Internal mode id is "stack" — that's intentional, separate from copy.
    // The label MUST not be "Stack".
    expect(VIEW_MODE_COPY.cards.label).not.toBe('Stack');
    expect(VIEW_MODE_COPY.cards.accessibilityLabel).not.toBe('Stack view');
  });

  it('keeps Timeline as the user-facing primary view label', () => {
    expect(VIEW_MODE_COPY.timeline.label).toBe('Timeline');
    expect(VIEW_MODE_COPY.timeline.accessibilityLabel).toBe('Timeline map');
  });

  it('frames Timeline as the primary view in the accessibility hint', () => {
    expect(VIEW_MODE_COPY.timeline.accessibilityHint).toMatch(/primary/i);
    // Cards hint should NOT describe itself as primary.
    expect(VIEW_MODE_COPY.cards.accessibilityHint).not.toMatch(/primary/i);
  });

  it('hints make clear Cards is the deeper / per-message inspection mode', () => {
    expect(VIEW_MODE_COPY.cards.accessibilityHint).toMatch(/deeper|inspection|one move|card/i);
  });

  it('copy contains no verdict tokens or snake_case internal codes', () => {
    const forbiddenWords = /\b(winner|loser|truth|liar|dishonest|bad faith|manipulative|extremist|propagandist|stupid|idiot)\b/i;
    const snakeCase = /[a-z]_[a-z]/;
    const allCopy = [
      VIEW_MODE_COPY.cards.label,
      VIEW_MODE_COPY.cards.accessibilityLabel,
      VIEW_MODE_COPY.cards.accessibilityHint,
      VIEW_MODE_COPY.timeline.label,
      VIEW_MODE_COPY.timeline.accessibilityLabel,
      VIEW_MODE_COPY.timeline.accessibilityHint,
    ];
    for (const c of allCopy) {
      expect(c).not.toMatch(forbiddenWords);
      expect(c).not.toMatch(snakeCase);
    }
  });

  it('labels are short enough for a chip', () => {
    expect(VIEW_MODE_COPY.cards.label.length).toBeLessThanOrEqual(10);
    expect(VIEW_MODE_COPY.timeline.label.length).toBeLessThanOrEqual(10);
  });
});
