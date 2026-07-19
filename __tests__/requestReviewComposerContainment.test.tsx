/**
 * @jest-environment jsdom
 */
/**
 * A11Y-PR0 (#913) — RequestReviewComposer containment (additive path, P0-3d).
 *
 * Per the orchestrator ruling the composer stays a plain inline overlay (no RN
 * Modal). Containment is additive: a web-only dismissing backdrop plus a
 * topmost-gated Escape via useOverlayA11y. Run under a jsdom docblock with
 * Platform.OS='web'. The existing 3-step + visibility-readout behavior is
 * regression-checked, and the copy ban-list stays covered by
 * requestReviewCopyBanList.test.ts (unchanged).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BackHandler, Platform } from 'react-native';
import { RequestReviewComposer } from '../src/features/requestReview';
import { __resetOverlayLayerStack } from '../src/features/a11y/overlayLayerStack';

const TID = 'request-review-composer';

function noop() {}

function dispatchEscape(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
}

describe('A11Y-PR0 — RequestReviewComposer containment', () => {
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

  it('the web dismissing backdrop closes the composer on an outside press', () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={onCancel}
      />,
    );
    // The backdrop is hidden from assistive tech (scrim), so it must be
    // queried with includeHiddenElements.
    fireEvent.press(getByTestId(`${TID}-backdrop`, { includeHiddenElements: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('web Escape (topmost) closes the composer', () => {
    const onCancel = jest.fn();
    render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={onCancel}
      />,
    );
    dispatchEscape();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('the backdrop is hidden from assistive tech and out of the tab order', () => {
    const { getByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    const backdrop = getByTestId(`${TID}-backdrop`, { includeHiddenElements: true });
    expect(backdrop.props.accessibilityElementsHidden).toBe(true);
    expect(backdrop.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(backdrop.props.focusable).toBe(false);
  });

  // A11Y-PR0-FOLLOW (issue 915) — AVIM regression pin: the root overlay stays
  // the modal accessibility view (verify-only; no source change here).
  it('AVIM: the root overlay is a modal accessibility view', () => {
    const { getByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    expect(getByTestId(TID).props.accessibilityViewIsModal).toBe(true);
  });

  it('does NOT render the backdrop when not visible (no stray overlay)', () => {
    const { queryByTestId } = render(
      <RequestReviewComposer
        visible={false}
        targetNodeId="n1"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    expect(queryByTestId(`${TID}-backdrop`)).toBeNull();
  });

  it('regression: the 3-step flow still advances (quote -> concern type -> remedy)', () => {
    const { getByTestId, queryByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        initialQuote=""
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    // Step 2 locked until a quote is present.
    expect(getByTestId(`${TID}-step2-locked`)).toBeTruthy();
    fireEvent.changeText(getByTestId(`${TID}-quote-input`), 'A concrete passage to quote.');
    // With a quote present, the step-2 lock is gone and the concern radios show.
    expect(queryByTestId(`${TID}-step2-locked`)).toBeNull();
  });

  it('regression: the cancel affordance still fires onCancel', () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(getByTestId(`${TID}-cancel`));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// A11Y-PR0-FOLLOW (issue 915) — native hardware-back dismissal (useNativeBackClose).
describe('A11Y-PR0-FOLLOW — RequestReviewComposer native hardware-back', () => {
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
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={onCancel}
      />,
    );
    expect(addSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    const handler = addSpy.mock.calls[0][1] as () => boolean;
    expect(handler()).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('open=false (visible=false) never subscribes', () => {
    render(
      <RequestReviewComposer
        visible={false}
        targetNodeId="n1"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    expect(addSpy).not.toHaveBeenCalled();
  });
});
