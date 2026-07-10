/**
 * FEEDBACK-001 (#898) — BooleanFeedbackBar RNTL matrix + a11y + doctrine.
 *
 * The ghost bar: the pair always renders (+ a contextual third when enabled); a
 * tap on an unmarked button marks (onMark), a tap on a marked button retracts
 * (onUnmark); accessibilityState.selected carries the marked flag (not color);
 * every button meets 44x44 via a 32px visual + hitSlop; disabled renders the
 * buttons inert; below the tiny-width breakpoint the pair collapses behind a
 * single overflow control; the tones are neutral (no red/green) and no Animated
 * is imported (reduce-motion by construction).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BooleanFeedbackBar, BOOLEAN_FEEDBACK_BAR_TINY_WIDTH } from '../src/features/feedback/BooleanFeedbackBar';
import { emptyViewerMoveMarkState, type ViewerMoveMarkState } from '../src/features/feedback/moveMarksModel';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/features/feedback/BooleanFeedbackBar.tsx'),
  'utf8',
);

function stateWith(overrides: Partial<ViewerMoveMarkState>): ViewerMoveMarkState {
  return { ...emptyViewerMoveMarkState(), ...overrides };
}

function renderBar(props: Partial<React.ComponentProps<typeof BooleanFeedbackBar>> = {}) {
  const onMark = jest.fn();
  const onUnmark = jest.fn();
  const utils = render(
    <BooleanFeedbackBar
      argumentId="m1"
      viewerState={props.viewerState ?? emptyViewerMoveMarkState()}
      onMark={onMark}
      onUnmark={onUnmark}
      windowWidth={800}
      {...props}
    />,
  );
  return { onMark, onUnmark, ...utils };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s) }), {});
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

describe('BooleanFeedbackBar — the ghost pair', () => {
  it('renders exactly the two pair buttons by default', () => {
    const { getByTestId, queryByTestId } = renderBar();
    expect(getByTestId('boolean-feedback-bar-m1-addressed_my_point')).toBeTruthy();
    expect(getByTestId('boolean-feedback-bar-m1-did_not_address')).toBeTruthy();
    // The contextual third is absent unless enabled.
    expect(queryByTestId('boolean-feedback-bar-m1-receipts_requested')).toBeNull();
  });

  it('renders the contextual third "Receipts?" only when showReceiptsRequested', () => {
    const { getByTestId } = renderBar({ showReceiptsRequested: true });
    expect(getByTestId('boolean-feedback-bar-m1-receipts_requested')).toBeTruthy();
  });
});

describe('BooleanFeedbackBar — one tap marks, second tap retracts', () => {
  it('a tap on an unmarked button calls onMark(argumentId, code)', () => {
    const { getByTestId, onMark, onUnmark } = renderBar();
    fireEvent.press(getByTestId('boolean-feedback-bar-m1-addressed_my_point'));
    expect(onMark).toHaveBeenCalledWith('m1', 'addressed_my_point');
    expect(onUnmark).not.toHaveBeenCalled();
  });

  it('a tap on an already-marked button calls onUnmark(argumentId, code)', () => {
    const { getByTestId, onMark, onUnmark } = renderBar({
      viewerState: stateWith({ did_not_address: true }),
    });
    fireEvent.press(getByTestId('boolean-feedback-bar-m1-did_not_address'));
    expect(onUnmark).toHaveBeenCalledWith('m1', 'did_not_address');
    expect(onMark).not.toHaveBeenCalled();
  });
});

describe('BooleanFeedbackBar — accessibility', () => {
  it('accessibilityState.selected reflects the marked state (not color)', () => {
    const { getByTestId } = renderBar({ viewerState: stateWith({ addressed_my_point: true }) });
    const marked = getByTestId('boolean-feedback-bar-m1-addressed_my_point');
    const unmarked = getByTestId('boolean-feedback-bar-m1-did_not_address');
    expect(marked.props.accessibilityState.selected).toBe(true);
    expect(unmarked.props.accessibilityState.selected).toBe(false);
    expect(marked.props.accessibilityRole).toBe('button');
  });

  it('each button carries an action-name accessibilityLabel (never a raw code)', () => {
    const { getByTestId } = renderBar();
    const btn = getByTestId('boolean-feedback-bar-m1-addressed_my_point');
    expect(btn.props.accessibilityLabel).toBe('Mark this move as: answered my point');
    expect(btn.props.accessibilityLabel).not.toMatch(/[a-z]_[a-z]/);
  });

  it('meets 44x44 via a 32px visual + hitSlop', () => {
    const { getByTestId } = renderBar();
    const btn = getByTestId('boolean-feedback-bar-m1-addressed_my_point');
    const style = flattenStyle(btn.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(32);
    expect(btn.props.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });
  });

  it('marked state is carried by a check affix + weight (grayscale-legible, not color-only)', () => {
    const { getByText } = renderBar({ viewerState: stateWith({ addressed_my_point: true }) });
    // The marked label carries the check affix; the unmarked one does not.
    expect(getByText('✓ Answered my point')).toBeTruthy();
    expect(getByText('Didn’t answer it')).toBeTruthy();
  });
});

describe('BooleanFeedbackBar — disabled (belt-and-braces observer)', () => {
  it('renders the buttons inert and fires no handler when disabled', () => {
    const { getByTestId, onMark, onUnmark } = renderBar({ disabled: true });
    const btn = getByTestId('boolean-feedback-bar-m1-addressed_my_point');
    expect(btn.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(btn);
    expect(onMark).not.toHaveBeenCalled();
    expect(onUnmark).not.toHaveBeenCalled();
  });
});

describe('BooleanFeedbackBar — inline failure note', () => {
  it('shows the plain-language error note (never a raw code)', () => {
    const { getByTestId } = renderBar({ errorMessage: 'We could not reach the server — nothing else changed.' });
    const note = getByTestId('boolean-feedback-bar-m1-error');
    expect(note.props.children).toBe('We could not reach the server — nothing else changed.');
    expect(note.props.accessibilityLiveRegion).toBe('polite');
  });
});

describe('BooleanFeedbackBar — tiny-width collapse', () => {
  it('below the tiny-width breakpoint it collapses to a single overflow control', () => {
    const { getByTestId, queryByTestId } = renderBar({
      windowWidth: BOOLEAN_FEEDBACK_BAR_TINY_WIDTH - 1,
    });
    expect(getByTestId('boolean-feedback-bar-m1-overflow')).toBeTruthy();
    expect(queryByTestId('boolean-feedback-bar-m1-addressed_my_point')).toBeNull();
  });

  it('tapping the overflow control expands the two options inline', () => {
    const { getByTestId, queryByTestId } = renderBar({
      windowWidth: BOOLEAN_FEEDBACK_BAR_TINY_WIDTH - 1,
    });
    fireEvent.press(getByTestId('boolean-feedback-bar-m1-overflow'));
    expect(getByTestId('boolean-feedback-bar-m1-addressed_my_point')).toBeTruthy();
    expect(getByTestId('boolean-feedback-bar-m1-did_not_address')).toBeTruthy();
    expect(queryByTestId('boolean-feedback-bar-m1-overflow')).toBeNull();
  });

  it('at a normal width the pair renders directly (no overflow control)', () => {
    const { queryByTestId } = renderBar({ windowWidth: 800 });
    expect(queryByTestId('boolean-feedback-bar-m1-overflow')).toBeNull();
  });
});

describe('BooleanFeedbackBar — neutral tones + reduce-motion by construction', () => {
  it('the source uses NO red / green verdict color (neutral STATUS tones only)', () => {
    // No red/green color names, and no obviously-red (#e/#f00/#dc) or
    // obviously-green (#0.a0 / #16a34a / #22c55e) hex verdict tokens.
    expect(SRC).not.toMatch(/['"](red|green|crimson|forestgreen|lime)['"]/i);
    expect(SRC).not.toMatch(/#(dc2626|ef4444|f87171|b91c1c|16a34a|22c55e|15803d|4ade80)/i);
  });

  it('imports no Animated (the bar is transform-free; reduce-motion by construction)', () => {
    expect(SRC).not.toMatch(/\bAnimated\b/);
  });

  it('imports no pointStanding / antiAmplification (anti-amplification boundary)', () => {
    const importLines = (SRC.match(/^import[\s\S]*?from '[^']+';/gm) ?? []).join('\n');
    expect(importLines).not.toMatch(/pointStanding/i);
    expect(importLines).not.toMatch(/antiAmplification/i);
  });
});
