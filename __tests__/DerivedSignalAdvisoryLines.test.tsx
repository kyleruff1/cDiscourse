/**
 * FEEDBACK-002 (#899) — DerivedSignalAdvisoryLines render + empty-state proof.
 *
 * Renders one calm <Text> per advisory line; renders NULL for an empty list (the
 * flag-off byte-identical path). Lines are non-interactive text with an
 * accessibilityLabel.
 *
 * UX-PR-C (issue 923) — visible provenance affix. Each line leads with a fixed,
 * visible "Advisory" affix (an accessibility-hidden sibling Text) so sighted
 * users see the provenance the screen reader already announces, with NO double
 * announcement. The sentence Text keeps its testID, role, and accessibilityLabel
 * byte-unchanged.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import {
  DerivedSignalAdvisoryLines,
  DERIVED_SIGNAL_PROVENANCE_AFFIX,
} from '../src/features/feedbackFlags/DerivedSignalAdvisoryLines';
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

  // ── UX-PR-C (issue 923) — visible provenance affix ──────────────

  it('renders the visible "Advisory" provenance affix leading every line', () => {
    const { getByTestId } = render(<DerivedSignalAdvisoryLines lines={[LINE_A, LINE_B]} />);
    expect(DERIVED_SIGNAL_PROVENANCE_AFFIX).toBe('Advisory');
    // The affix is accessibility-hidden, so query with includeHiddenElements.
    expect(
      getByTestId('derived-signal-advisory-affix-proof_moment', { includeHiddenElements: true }).props
        .children,
    ).toBe(DERIVED_SIGNAL_PROVENANCE_AFFIX);
    expect(
      getByTestId('derived-signal-advisory-affix-resolution_window', { includeHiddenElements: true })
        .props.children,
    ).toBe(DERIVED_SIGNAL_PROVENANCE_AFFIX);
  });

  it('the affix is accessibility-hidden with no label (no "Advisory. Advisory:" double)', () => {
    const { getByTestId } = render(<DerivedSignalAdvisoryLines lines={[LINE_A]} />);
    const affix = getByTestId('derived-signal-advisory-affix-proof_moment', {
      includeHiddenElements: true,
    });
    expect(affix.props.accessibilityElementsHidden).toBe(true);
    expect(affix.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(affix.props.accessibilityLabel).toBeUndefined();
  });

  it('the sentence label is byte-unchanged and carries the sole announcement', () => {
    const { getByTestId } = render(<DerivedSignalAdvisoryLines lines={[LINE_A]} />);
    const sentence = getByTestId('derived-signal-advisory-proof_moment');
    expect(sentence.props.accessibilityRole).toBe('text');
    expect(sentence.props.accessibilityLabel).toBe(LINE_A.accessibilityLabel);
    // The sentence already starts "Advisory:" — the visible affix must NOT be
    // concatenated into it (chrome stays a separate sibling).
    expect(sentence.props.children).toBe(LINE_A.text);
    expect(sentence.props.accessibilityLabel).not.toContain('Advisory: Advisory');
  });

  it('renders no affix when the list is empty (byte-identical flag-off path)', () => {
    const { queryByTestId, toJSON } = render(<DerivedSignalAdvisoryLines lines={[]} />);
    expect(toJSON()).toBeNull();
    expect(
      queryByTestId('derived-signal-advisory-affix-proof_moment', { includeHiddenElements: true }),
    ).toBeNull();
  });
});
