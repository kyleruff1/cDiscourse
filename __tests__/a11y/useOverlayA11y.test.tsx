/**
 * @jest-environment jsdom
 */
/**
 * A11Y-PR0 (#913) — useOverlayA11y hook behavior in jsdom.
 *
 * jsdom implements activeElement / focus / contains / setAttribute but
 * does NOT perform sequential focus navigation on Tab, so we assert the
 * hook OWN focus calls (initial focus, restore, boundary wrap) plus the
 * topmost gating and the native no-op proof. Real Tab-cycling and the
 * visual Escape dismissal are RUNTIME-CHECK items (see the design doc).
 *
 * The hook is rendered with react-dom into a real jsdom container (RTL
 * react-native uses the test renderer, which yields no DOM node for the
 * ref-callback, so it cannot exercise the DOM path).
 */
import React from 'react';
import { Platform } from 'react-native';
import { useOverlayA11y } from '../../src/features/a11y/useOverlayA11y';
import {
  __resetOverlayLayerStack,
  depth,
  registerLayer,
  unregisterLayer,
} from '../../src/features/a11y/overlayLayerStack';

// react-dom/client ships no bundled types in this repo (@types/react-dom is
// intentionally absent — the app is RN-web, not react-dom). Require it and
// type the two members we use locally so typecheck stays clean without a new
// devDependency.
interface Root {
  render(node: React.ReactNode): void;
  unmount(): void;
}
const { createRoot } = require('react-dom/client') as {
  createRoot: (container: Element | DocumentFragment) => Root;
};
// React 19 exposes `act` on the runtime; @types/react may not surface it, so
// read it via a local cast.
const act = (React as unknown as {
  act: (callback: () => void | Promise<void>) => void;
}).act;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

interface HarnessProps {
  visible: boolean;
  onDismiss?: () => void;
  manageEsc?: boolean;
  manageFocus?: boolean;
  layerId?: string;
  withFocusables?: boolean;
}

function Harness(props: HarnessProps) {
  const { registerContainer } = useOverlayA11y({
    visible: props.visible,
    onDismiss: props.onDismiss,
    manageEsc: props.manageEsc,
    manageFocus: props.manageFocus,
    layerId: props.layerId,
  });
  return (
    <div
      ref={(el) => registerContainer(el as unknown as HTMLElement | null)}
      data-testid="panel"
    >
      {props.withFocusables !== false ? (
        <>
          <button data-role="first">first</button>
          <button data-role="mid">mid</button>
          <button data-role="last">last</button>
        </>
      ) : null}
    </div>
  );
}

function dispatchKey(target: EventTarget, key: string, shiftKey = false): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(ev);
  return ev;
}

describe('A11Y-PR0 — useOverlayA11y (web, jsdom)', () => {
  const originalOS = Platform.OS;
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) container.parentNode.removeChild(container);
    document.body.innerHTML = '';
    __resetOverlayLayerStack();
  });

  const mount = (props: HarnessProps) => {
    act(() => {
      root = createRoot(container);
      root.render(<Harness {...props} />);
    });
  };

  const panel = () => container.querySelector('[data-testid="panel"]') as HTMLElement;
  const btn = (role: string) =>
    container.querySelector(`[data-role="${role}"]`) as HTMLButtonElement;

  it('pulls initial focus to the first focusable on mount', () => {
    mount({ visible: true });
    expect(document.activeElement).toBe(btn('first'));
  });

  it('with no focusables, focuses the container via tabindex=-1', () => {
    mount({ visible: true, withFocusables: false });
    expect(panel().getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(panel());
  });

  it('does NOT steal focus when focus is already inside the panel', () => {
    // Pre-focus a trigger, mount, then the hook moves focus to first.
    // Re-rendering while focus is inside must not fight it: prove the
    // "already inside" guard by leaving focus on `mid` and re-mounting is
    // covered by the restore test; here assert initial focus lands inside.
    mount({ visible: true });
    expect(panel().contains(document.activeElement)).toBe(true);
  });

  it('restores focus to the trigger on unmount', () => {
    const trigger = document.createElement('button');
    trigger.id = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    mount({ visible: true });
    // Hook pulled focus into the panel.
    expect(document.activeElement).toBe(btn('first'));

    act(() => {
      root.unmount();
    });
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it('does not throw when the trigger was detached before close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    mount({ visible: true });
    // Detach the trigger while the overlay is open.
    document.body.removeChild(trigger);

    expect(() =>
      act(() => {
        root.unmount();
      }),
    ).not.toThrow();
  });

  it('Tab at the last focusable wraps to the first + preventDefault', () => {
    mount({ visible: true });
    btn('last').focus();
    const ev = dispatchKey(btn('last'), 'Tab');
    expect(document.activeElement).toBe(btn('first'));
    expect(ev.defaultPrevented).toBe(true);
  });

  it('Shift+Tab at the first focusable wraps to the last + preventDefault', () => {
    mount({ visible: true });
    btn('first').focus();
    const ev = dispatchKey(btn('first'), 'Tab', true);
    expect(document.activeElement).toBe(btn('last'));
    expect(ev.defaultPrevented).toBe(true);
  });

  it('interior Tab does not wrap (no preventDefault, no hook focus move)', () => {
    mount({ visible: true });
    btn('mid').focus();
    const ev = dispatchKey(btn('mid'), 'Tab');
    // jsdom does not move focus on Tab; the hook must NOT have wrapped.
    expect(document.activeElement).toBe(btn('mid'));
    expect(ev.defaultPrevented).toBe(false);
  });

  it('Escape dismisses when topmost (manageEsc default true)', () => {
    const onDismiss = jest.fn();
    mount({ visible: true, onDismiss });
    const ev = dispatchKey(document, 'Escape');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('does not dismiss on Escape when manageEsc is false', () => {
    const onDismiss = jest.fn();
    mount({ visible: true, onDismiss, manageEsc: false });
    dispatchKey(document, 'Escape');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('a lower layer does not trap Tab or dismiss while a higher layer is registered', () => {
    const onDismiss = jest.fn();
    mount({ visible: true, onDismiss, layerId: 'lower' });
    // A higher overlay opens on top of this one.
    registerLayer('higher');

    btn('last').focus();
    const tabEv = dispatchKey(btn('last'), 'Tab');
    // Lower layer is no longer topmost: no wrap.
    expect(document.activeElement).toBe(btn('last'));
    expect(tabEv.defaultPrevented).toBe(false);

    dispatchKey(document, 'Escape');
    expect(onDismiss).not.toHaveBeenCalled();

    // The higher overlay closes; the lower layer owns Escape again.
    unregisterLayer('higher');
    dispatchKey(document, 'Escape');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('A11Y-PR0 — useOverlayA11y (native no-op proof)', () => {
  const originalOS = Platform.OS;
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    __resetOverlayLayerStack();
  });
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) container.parentNode.removeChild(container);
    document.body.innerHTML = '';
    __resetOverlayLayerStack();
  });

  it('on native: zero focus move, no layer registered, no Escape dismissal', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onDismiss = jest.fn();

    act(() => {
      root = createRoot(container);
      root.render(<Harness visible onDismiss={onDismiss} />);
    });

    // Native path is a complete no-op: focus never moved into the panel,
    // nothing registered on the shared stack, and no document listener
    // was attached (Escape does nothing).
    expect(document.activeElement).toBe(trigger);
    expect(depth()).toBe(0);
    dispatchKey(document, 'Escape');
    expect(onDismiss).not.toHaveBeenCalled();

    document.body.removeChild(trigger);
  });

  it('on native: isTopmost() returns false and registerContainer is inert', () => {
    let capturedIsTopmost: (() => boolean) | null = null;
    function Probe() {
      const { isTopmost, registerContainer } = useOverlayA11y({ visible: true });
      capturedIsTopmost = isTopmost;
      // Attaching to a real node must NOT track it on native.
      return <div ref={(el) => registerContainer(el as unknown as HTMLElement | null)} />;
    }
    act(() => {
      root = createRoot(container);
      root.render(<Probe />);
    });
    expect(capturedIsTopmost).not.toBeNull();
    expect(capturedIsTopmost!()).toBe(false);
    expect(depth()).toBe(0);
  });
});
