/**
 * UX-FLAGS-002 — PointFeedbackFlagsRow + PointFeedbackFlagPill component tests.
 *
 * Verifies the calm row renders one pill per flag with its label, renders null
 * for an empty list, exposes an accessibility label on each pill, gates the
 * per-flag helper behind a 44×44 "why?" disclosure toggle (role=button,
 * accessibilityState.expanded flips), and that the three tones render three
 * DISTINCT glyph prefixes so a grayscale snapshot stays legible.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PointFeedbackFlagsRow } from '../src/features/feedbackFlags/PointFeedbackFlagsRow';
import type { PointFeedbackFlagViewModel } from '../src/features/feedbackFlags/pointFeedbackFlagsModel';
import { _forbiddenVerdictTokens } from '../src/features/feedbackFlags/friendlyFlagMap';

function vm(p: Partial<PointFeedbackFlagViewModel> & { id: string; label: string }): PointFeedbackFlagViewModel {
  return {
    id: p.id,
    label: p.label,
    helper: p.helper,
    tone: p.tone ?? 'descriptive',
    neverGrantsStanding: p.neverGrantsStanding ?? false,
    accessibilityLabel: p.accessibilityLabel ?? `Note, ${p.label}`,
    family: p.family ?? 'parent_relation',
  };
}

const THREE_TONES: PointFeedbackFlagViewModel[] = [
  vm({ id: 'nice_bridge', label: 'Nice bridge', tone: 'positive', helper: 'Ties to the point above.' }),
  vm({ id: 'needs_a_receipt', label: 'Needs a receipt', tone: 'prompt', helper: 'A source would help.', neverGrantsStanding: true }),
  vm({ id: 'new_issue', label: 'New issue', tone: 'descriptive' }),
];

describe('UX-FLAGS-002 PointFeedbackFlagsRow', () => {
  it('renders one pill per flag with its label', () => {
    const { getByText } = render(<PointFeedbackFlagsRow flags={THREE_TONES} />);
    expect(getByText(/Nice bridge/)).toBeTruthy();
    expect(getByText(/Needs a receipt/)).toBeTruthy();
    expect(getByText(/New issue/)).toBeTruthy();
  });

  it('renders null for an empty flag list', () => {
    expect(render(<PointFeedbackFlagsRow flags={[]} />).toJSON()).toBeNull();
  });

  it('exposes an accessibility label on each pill', () => {
    const { getByTestId } = render(<PointFeedbackFlagsRow flags={THREE_TONES} />);
    expect(getByTestId('point-feedback-flag-nice_bridge').props.accessibilityLabel).toBe(
      'Note, Nice bridge',
    );
    expect(getByTestId('point-feedback-flag-needs_a_receipt').props.accessibilityLabel).toBe(
      'Note, Needs a receipt',
    );
  });

  it('hides helpers by default and reveals them when "why?" is pressed; expanded state flips', () => {
    const { queryByTestId, getByTestId } = render(<PointFeedbackFlagsRow flags={THREE_TONES} />);
    // Helpers hidden by default.
    expect(queryByTestId('point-feedback-flags-helpers')).toBeNull();

    const toggle = getByTestId('point-feedback-flags-why-toggle');
    expect(toggle.props.accessibilityRole).toBe('button');
    expect(toggle.props.accessibilityState.expanded).toBe(false);

    fireEvent.press(toggle);

    expect(getByTestId('point-feedback-flags-helpers')).toBeTruthy();
    expect(getByTestId('point-feedback-flag-helper-nice_bridge')).toBeTruthy();
    expect(getByTestId('point-feedback-flags-why-toggle').props.accessibilityState.expanded).toBe(true);

    // Toggling back hides the helpers again.
    fireEvent.press(getByTestId('point-feedback-flags-why-toggle'));
    expect(queryByTestId('point-feedback-flags-helpers')).toBeNull();
  });

  it('gives the "why?" toggle a 44×44-clearing hitSlop and button role', () => {
    const { getByTestId } = render(<PointFeedbackFlagsRow flags={THREE_TONES} />);
    const toggle = getByTestId('point-feedback-flags-why-toggle');
    expect(toggle.props.accessibilityRole).toBe('button');
    const slop = toggle.props.hitSlop;
    // 12 on each side over a visual >= 20 tall/wide clears 44 (accessibility-targets).
    expect(slop.top).toBeGreaterThanOrEqual(12);
    expect(slop.bottom).toBeGreaterThanOrEqual(12);
    expect(slop.left).toBeGreaterThanOrEqual(12);
    expect(slop.right).toBeGreaterThanOrEqual(12);
  });

  it('does not render a "why?" toggle when no flag carries a helper', () => {
    const noHelpers = [vm({ id: 'clear_claim', label: 'Clear claim', tone: 'positive' })];
    const { queryByTestId } = render(<PointFeedbackFlagsRow flags={noHelpers} />);
    expect(queryByTestId('point-feedback-flags-why-toggle')).toBeNull();
  });

  it('renders three DISTINCT glyph prefixes across the three tones (grayscale legibility)', () => {
    const { getByTestId } = render(<PointFeedbackFlagsRow flags={THREE_TONES} />);

    function glyphOf(testID: string): string {
      const node = getByTestId(testID);
      // Collect all string leaves under the pill; the glyph is the first
      // non-space token ('+' / '?' / '·').
      const strings: string[] = [];
      const walk = (n: unknown): void => {
        if (n == null) return;
        if (typeof n === 'string') {
          strings.push(n);
          return;
        }
        if (Array.isArray(n)) {
          n.forEach(walk);
          return;
        }
        if (typeof n === 'object') walk((n as { props?: { children?: unknown } }).props?.children);
      };
      walk(node.props.children);
      const joined = strings.join('');
      return joined.trim().charAt(0);
    }

    const positive = glyphOf('point-feedback-flag-nice_bridge');
    const prompt = glyphOf('point-feedback-flag-needs_a_receipt');
    const descriptive = glyphOf('point-feedback-flag-new_issue');

    expect(positive).toBe('+');
    expect(prompt).toBe('?');
    expect(descriptive).toBe('·');
    expect(new Set([positive, prompt, descriptive]).size).toBe(3);
  });
});

describe('UX-FLAGS-003 PointFeedbackFlagsRow "+N more"', () => {
  it('renders a quiet "+2 more" count when suppressedCount=2 and flags are non-empty', () => {
    const { getByTestId } = render(
      <PointFeedbackFlagsRow flags={THREE_TONES} suppressedCount={2} />,
    );
    const more = getByTestId('point-feedback-flags-more');
    expect(more.props.children).toEqual(['+', 2, ' more']);
    expect(more.props.accessibilityLabel).toBe('2 more on this point');
  });

  it('the "+N more" element is non-interactive (role=text, no onPress)', () => {
    const { getByTestId } = render(
      <PointFeedbackFlagsRow flags={THREE_TONES} suppressedCount={1} />,
    );
    const more = getByTestId('point-feedback-flags-more');
    expect(more.props.accessibilityRole).toBe('text');
    expect(more.props.onPress).toBeUndefined();
  });

  it('does not render "+N more" when suppressedCount is 0 or omitted', () => {
    const zero = render(
      <PointFeedbackFlagsRow flags={THREE_TONES} suppressedCount={0} />,
    );
    expect(zero.queryByTestId('point-feedback-flags-more')).toBeNull();
    const omitted = render(<PointFeedbackFlagsRow flags={THREE_TONES} />);
    expect(omitted.queryByTestId('point-feedback-flags-more')).toBeNull();
  });

  it('returns null on an empty flag list even when suppressedCount > 0', () => {
    const { toJSON } = render(
      <PointFeedbackFlagsRow flags={[]} suppressedCount={5} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('the "+N more" copy carries no verdict or severity/importance token', () => {
    const { getByTestId } = render(
      <PointFeedbackFlagsRow flags={THREE_TONES} suppressedCount={2} />,
    );
    const text = (getByTestId('point-feedback-flags-more').props.children as unknown[])
      .join('')
      .toLowerCase();
    const a11y = (
      getByTestId('point-feedback-flags-more').props.accessibilityLabel as string
    ).toLowerCase();
    const banned = [
      ..._forbiddenVerdictTokens(),
      'importance',
      'severity',
      'score',
      'priority',
    ];
    for (const token of banned) {
      expect(text).not.toContain(token);
      expect(a11y).not.toContain(token);
    }
  });
});

describe('UX-FLAGS-004 PointFeedbackFlagsRow — actionable pills', () => {
  // THREE_TONES: needs_a_receipt is actionable (Family D -> ask_for_source);
  // nice_bridge + new_issue are non-actionable => must stay inert.
  it('onFlagIntent absent => every pill is inert (role text), byte-identical to today', () => {
    const { getByTestId } = render(<PointFeedbackFlagsRow flags={THREE_TONES} />);
    expect(getByTestId('point-feedback-flag-nice_bridge').props.accessibilityRole).toBe('text');
    expect(getByTestId('point-feedback-flag-needs_a_receipt').props.accessibilityRole).toBe('text');
    expect(getByTestId('point-feedback-flag-new_issue').props.accessibilityRole).toBe('text');
  });

  it('onFlagIntent present => actionable pills become buttons; non-actionable stay text', () => {
    const onFlagIntent = jest.fn();
    const { getByTestId } = render(
      <PointFeedbackFlagsRow flags={THREE_TONES} onFlagIntent={onFlagIntent} />,
    );
    expect(getByTestId('point-feedback-flag-needs_a_receipt').props.accessibilityRole).toBe('button');
    expect(getByTestId('point-feedback-flag-nice_bridge').props.accessibilityRole).toBe('text');
    expect(getByTestId('point-feedback-flag-new_issue').props.accessibilityRole).toBe('text');
  });

  it('tapping an actionable pill fires onFlagIntent with the flag id', () => {
    const onFlagIntent = jest.fn();
    const { getByTestId } = render(
      <PointFeedbackFlagsRow flags={THREE_TONES} onFlagIntent={onFlagIntent} />,
    );
    fireEvent.press(getByTestId('point-feedback-flag-needs_a_receipt'));
    expect(onFlagIntent).toHaveBeenCalledTimes(1);
    expect(onFlagIntent).toHaveBeenCalledWith('needs_a_receipt');
  });

  it('a non-actionable pill renders inert with no press handler (even while a sibling is actionable)', () => {
    const { getByTestId } = render(
      <PointFeedbackFlagsRow flags={THREE_TONES} onFlagIntent={jest.fn()} />,
    );
    const bridge = getByTestId('point-feedback-flag-nice_bridge');
    expect(bridge.props.accessibilityRole).toBe('text');
    expect(bridge.props.onPress).toBeUndefined();
  });

  it('the "why?" toggle path is unchanged when onFlagIntent is present', () => {
    const { getByTestId, queryByTestId } = render(
      <PointFeedbackFlagsRow flags={THREE_TONES} onFlagIntent={jest.fn()} />,
    );
    expect(queryByTestId('point-feedback-flags-helpers')).toBeNull();
    fireEvent.press(getByTestId('point-feedback-flags-why-toggle'));
    expect(getByTestId('point-feedback-flags-helpers')).toBeTruthy();
  });
});
