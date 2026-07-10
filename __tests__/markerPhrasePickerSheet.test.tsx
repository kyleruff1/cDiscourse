/**
 * MARK-002 (#894) — MarkerPhrasePickerSheet render + interaction (RNTL).
 *
 * Rows are >=44px Pressables with a11y labels; selecting a row emits
 * { spanStart, spanEnd, quote } computed from the EXACT body slice; the header +
 * cancel are present; an empty / boundary-free body offers a single Whole move
 * row spanning the full body.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MarkerPhrasePickerSheet } from '../src/features/arguments/markers/MarkerPhrasePickerSheet';

describe('MarkerPhrasePickerSheet', () => {
  it('renders one >=44px row per phrase with a Quote a11y label', () => {
    const { getByTestId } = render(
      <MarkerPhrasePickerSheet
        targetArgumentId="t1"
        targetBody="Cars are bad. Bikes are good."
        windowWidth={390}
        onPick={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    const row0 = getByTestId('marker-phrase-row-0');
    expect(row0.props.accessibilityRole).toBe('button');
    expect(row0.props.accessibilityLabel).toContain('Quote:');
    const style = Array.isArray(row0.props.style) ? Object.assign({}, ...row0.props.style) : row0.props.style;
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(getByTestId('marker-phrase-row-1')).toBeTruthy();
  });

  it('emits { spanStart, spanEnd, quote } from the exact body slice on pick', () => {
    const onPick = jest.fn();
    const body = 'Cars are bad. Bikes are good.';
    const { getByTestId } = render(
      <MarkerPhrasePickerSheet
        targetArgumentId="t1"
        targetBody={body}
        windowWidth={390}
        onPick={onPick}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId('marker-phrase-row-0'));
    expect(onPick).toHaveBeenCalledTimes(1);
    const scope = onPick.mock.calls[0][0];
    expect(scope.targetArgumentId).toBe('t1');
    expect(body.slice(scope.spanStart, scope.spanEnd)).toBe(scope.quote);
    expect(scope.quote).toBe('Cars are bad.');
  });

  it('offers a single Whole move row spanning the full body when there is no phrase boundary', () => {
    const onPick = jest.fn();
    const body = 'no punctuation at all';
    const { getByTestId, queryByTestId } = render(
      <MarkerPhrasePickerSheet
        targetArgumentId="t1"
        targetBody={body}
        windowWidth={390}
        onPick={onPick}
        onCancel={jest.fn()}
      />,
    );
    // One row (the whole content run) — segmentPhrases yields one phrase here.
    expect(getByTestId('marker-phrase-row-0')).toBeTruthy();
    expect(queryByTestId('marker-phrase-row-1')).toBeNull();
    fireEvent.press(getByTestId('marker-phrase-row-0'));
    const scope = onPick.mock.calls[0][0];
    expect(scope.spanStart).toBe(0);
    expect(scope.spanEnd).toBe(body.length);
  });

  it('fires onCancel from the cancel affordance', () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <MarkerPhrasePickerSheet
        targetArgumentId="t1"
        targetBody="Cars are bad."
        windowWidth={390}
        onPick={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(getByTestId('marker-phrase-picker-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
