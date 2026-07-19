/**
 * @jest-environment jsdom
 */
/**
 * A11Y-PR0 (#913) — MarkerPhrasePickerSheet containment (additive path, P0-3d).
 *
 * Per the orchestrator ruling the sheet stays a plain inline overlay (no RN
 * Modal). Containment is additive: a web-only dismissing backdrop plus a
 * topmost-gated Escape via useOverlayA11y. These run under a jsdom docblock
 * with Platform.OS='web' so the backdrop renders and the hook Escape listener
 * is live. Existing pick / whole-move / cancel behavior is regression-checked.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BackHandler, Platform } from 'react-native';
import { MarkerPhrasePickerSheet } from '../src/features/arguments/markers/MarkerPhrasePickerSheet';
import { __resetOverlayLayerStack } from '../src/features/a11y/overlayLayerStack';

function dispatchEscape(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
}

describe('A11Y-PR0 — MarkerPhrasePickerSheet containment', () => {
  const originalOS = Platform.OS;
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });
  afterEach(() => {
    __resetOverlayLayerStack();
  });

  it('the web dismissing backdrop closes the sheet on an outside press', () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <MarkerPhrasePickerSheet
        targetArgumentId="t1"
        targetBody="Cars are bad. Bikes are good."
        windowWidth={390}
        onPick={jest.fn()}
        onCancel={onCancel}
      />,
    );
    // The backdrop is hidden from assistive tech (scrim), so it must be
    // queried with includeHiddenElements.
    fireEvent.press(
      getByTestId('marker-phrase-picker-backdrop', { includeHiddenElements: true }),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('web Escape (topmost) closes the sheet', () => {
    const onCancel = jest.fn();
    render(
      <MarkerPhrasePickerSheet
        targetArgumentId="t1"
        targetBody="Cars are bad. Bikes are good."
        windowWidth={390}
        onPick={jest.fn()}
        onCancel={onCancel}
      />,
    );
    dispatchEscape();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('the backdrop is hidden from assistive tech and out of the tab order', () => {
    const { getByTestId } = render(
      <MarkerPhrasePickerSheet
        targetArgumentId="t1"
        targetBody="Cars are bad."
        windowWidth={390}
        onPick={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    const backdrop = getByTestId('marker-phrase-picker-backdrop', {
      includeHiddenElements: true,
    });
    expect(backdrop.props.accessibilityElementsHidden).toBe(true);
    expect(backdrop.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(backdrop.props.focusable).toBe(false);
  });

  // A11Y-PR0-FOLLOW (issue 915) — accessibilityViewIsModal now on the root
  // overlay AND the inner sheet panel (matching Request root + PreSend double).
  it('AVIM: the root overlay is a modal accessibility view', () => {
    const { getByTestId } = render(
      <MarkerPhrasePickerSheet
        targetArgumentId="t1"
        targetBody="Cars are bad."
        windowWidth={390}
        onPick={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByTestId('marker-phrase-picker-sheet').props.accessibilityViewIsModal).toBe(true);
  });

  it('AVIM: the inner sheet panel is also a modal accessibility view', () => {
    const { getByTestId } = render(
      <MarkerPhrasePickerSheet
        targetArgumentId="t1"
        targetBody="Cars are bad."
        windowWidth={390}
        onPick={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByTestId('marker-phrase-picker-panel').props.accessibilityViewIsModal).toBe(true);
  });

  it('regression: picking a phrase still emits the exact-slice scope', () => {
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
    const scope = onPick.mock.calls[0][0];
    expect(scope.targetArgumentId).toBe('t1');
    expect(body.slice(scope.spanStart, scope.spanEnd)).toBe(scope.quote);
    expect(scope.quote).toBe('Cars are bad.');
  });

  it('regression: the cancel affordance still fires onCancel', () => {
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

// A11Y-PR0-FOLLOW (issue 915) — native hardware-back dismissal (useNativeBackClose).
describe('A11Y-PR0-FOLLOW — MarkerPhrasePickerSheet native hardware-back', () => {
  const originalOS = Platform.OS;
  let removeSpy: jest.Mock;
  let addSpy: jest.SpyInstance;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    removeSpy = jest.fn();
    addSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove: removeSpy } as unknown as ReturnType<
        typeof BackHandler.addEventListener
      >);
  });
  afterEach(() => {
    addSpy.mockRestore();
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    __resetOverlayLayerStack();
  });

  it('subscribes to hardwareBackPress; back fires onCancel once and consumes', () => {
    const onCancel = jest.fn();
    render(
      <MarkerPhrasePickerSheet
        targetArgumentId="t1"
        targetBody="Cars are bad."
        windowWidth={390}
        onPick={jest.fn()}
        onCancel={onCancel}
      />,
    );
    expect(addSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    const handler = addSpy.mock.calls[0][1] as () => boolean;
    expect(handler()).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
