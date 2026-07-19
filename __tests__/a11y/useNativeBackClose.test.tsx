/**
 * @jest-environment jsdom
 */
/**
 * A11Y-PR0-FOLLOW (issue 915) — useNativeBackClose hook contract.
 *
 * The shared native-only hardware-back hook for the two inline (non-Modal)
 * sheets. It subscribes to BackHandler `hardwareBackPress` ONLY while open and
 * ONLY on native, consumes the press (returns true), reads onClose through a
 * ref (no resubscribe churn), and removes the subscription on cleanup. Web is a
 * hard no-op. Platform.OS is toggled per block; BackHandler.addEventListener is
 * spied so the native subscription can be inspected without a device.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { BackHandler, Platform } from 'react-native';
import { useNativeBackClose } from '../../src/features/a11y/useNativeBackClose';

function Harness(props: { open: boolean; onClose: () => void }): null {
  useNativeBackClose(props.open, props.onClose);
  return null;
}

function setOS(os: string): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

describe('useNativeBackClose — native (ios)', () => {
  const originalOS = Platform.OS;
  let removeSpy: jest.Mock;
  let addSpy: jest.SpyInstance;

  beforeEach(() => {
    setOS('ios');
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
  });

  it('open=true subscribes once to hardwareBackPress', () => {
    render(<Harness open onClose={jest.fn()} />);
    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
  });

  it('the captured handler calls onClose once AND returns true (consumes back)', () => {
    const onClose = jest.fn();
    render(<Harness open onClose={onClose} />);
    const handler = addSpy.mock.calls[0][1] as () => boolean;
    const result = handler();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('unmount removes the subscription', () => {
    const { unmount } = render(<Harness open onClose={jest.fn()} />);
    expect(removeSpy).not.toHaveBeenCalled();
    unmount();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('open=false never subscribes', () => {
    render(<Harness open={false} onClose={jest.fn()} />);
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('changing onClose between renders does NOT resubscribe but invokes the latest onClose', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = render(<Harness open onClose={first} />);
    rerender(<Harness open onClose={second} />);
    // Still a single subscription — the callback is read via a ref.
    expect(addSpy).toHaveBeenCalledTimes(1);
    const handler = addSpy.mock.calls[0][1] as () => boolean;
    handler();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('useNativeBackClose — web is a hard no-op', () => {
  const originalOS = Platform.OS;
  let addSpy: jest.SpyInstance;

  beforeEach(() => {
    setOS('web');
    addSpy = jest.spyOn(BackHandler, 'addEventListener');
  });
  afterEach(() => {
    addSpy.mockRestore();
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  it('open=true does NOT subscribe on web', () => {
    render(<Harness open onClose={jest.fn()} />);
    expect(addSpy).not.toHaveBeenCalled();
  });
});
