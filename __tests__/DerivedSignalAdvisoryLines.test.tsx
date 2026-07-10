/**
 * FEEDBACK-002 (#899) — DerivedSignalAdvisoryLines render + empty-state proof.
 *
 * Renders one calm <Text> per advisory line; renders NULL for an empty list (the
 * flag-off byte-identical path). Lines are non-interactive text with an
 * accessibilityLabel.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { DerivedSignalAdvisoryLines } from '../src/features/feedbackFlags/DerivedSignalAdvisoryLines';
import type { DerivedSignalLine } from '../src/features/feedbackFlags/derivedSignalConsumerModel';

const LINE_A: DerivedSignalLine = {
  code: 'proof_moment',
  text: 'A receipt would carry this point further.',
  accessibilityLabel: 'Advisory: a source on your own move would carry this point further.',
};
const LINE_B: DerivedSignalLine = {
  code: 'resolution_window',
  text: 'Synthesis may be on the table.',
  accessibilityLabel: 'Advisory: a synthesis or settlement may be on the table.',
};

describe('DerivedSignalAdvisoryLines', () => {
  it('renders nothing for an empty list (byte-identical flag-off path)', () => {
    const { toJSON } = render(<DerivedSignalAdvisoryLines lines={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders one line per advisory line, with the advisory text', () => {
    const { getByTestId } = render(<DerivedSignalAdvisoryLines lines={[LINE_A, LINE_B]} />);
    expect(getByTestId('derived-signal-advisory-proof_moment')).toBeTruthy();
    expect(getByTestId('derived-signal-advisory-resolution_window')).toBeTruthy();
  });

  it('the line exposes the advisory accessibility label (non-interactive text)', () => {
    const { getByTestId } = render(<DerivedSignalAdvisoryLines lines={[LINE_A]} />);
    const node = getByTestId('derived-signal-advisory-proof_moment');
    expect(node.props.accessibilityRole).toBe('text');
    expect(node.props.accessibilityLabel).toBe(LINE_A.accessibilityLabel);
  });
});
