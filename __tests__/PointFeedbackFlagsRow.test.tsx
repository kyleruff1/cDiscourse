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
