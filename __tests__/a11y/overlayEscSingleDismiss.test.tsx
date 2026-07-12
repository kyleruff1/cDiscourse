/**
 * @jest-environment jsdom
 */
/**
 * A11Y-PR0 (#913) — single-Escape arbitration (P0-3b).
 *
 * Before this card two document-level Escape listeners (dock + popout) both
 * fired on one keypress, collapsing two layers at once. The fix is one shared
 * overlay layer stack: every trapping surface registers, and each Escape
 * owner reads `isTopmost()` so exactly one layer dismisses.
 *
 * The real Popout / ArgumentComposerDock / PreSendReviewSheet cannot be
 * rendered here (RTL react-native yields no DOM node for the ref-callback, and
 * the dock needs the full room provider tree). So the arbitration is proven
 * with faithful lightweight harnesses that use the REAL useOverlayA11y hook +
 * REAL layer stack and reproduce each surface's exact Escape guard, and
 * SOURCE-SCANS confirm the real components wire those same primitives.
 */
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { Platform } from 'react-native';
import { useOverlayA11y } from '../../src/features/a11y/useOverlayA11y';
import { __resetOverlayLayerStack } from '../../src/features/a11y/overlayLayerStack';

interface Root {
  render(node: React.ReactNode): void;
  unmount(): void;
}
const { createRoot } = require('react-dom/client') as {
  createRoot: (container: Element | DocumentFragment) => Root;
};
const act = (React as unknown as {
  act: (callback: () => void | Promise<void>) => void;
}).act;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// ── Harnesses: exact reproductions of each surface's Escape wiring ──

/** Mirrors ArgumentComposerDock: manageEsc:false + a bubble-phase keydown
 *  handler guarded by `if (!isTopmost()) return;` at the top. */
function MockDock({ onClose }: { onClose: () => void }) {
  const { registerContainer, isTopmost } = useOverlayA11y({
    visible: true,
    manageEsc: false,
    layerId: 'dock',
  });
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isTopmost, onClose]);
  return (
    <div ref={(el) => registerContainer(el as unknown as HTMLElement | null)}>
      <button>dock</button>
    </div>
  );
}

/** Mirrors Popout: manageEsc:false + an inline Escape effect gated on isTopmost. */
function MockPopout({ onClose }: { onClose: () => void }) {
  const { registerContainer, isTopmost } = useOverlayA11y({
    visible: true,
    manageEsc: false,
    layerId: 'popout',
  });
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isTopmost()) return;
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isTopmost]);
  return (
    <div ref={(el) => registerContainer(el as unknown as HTMLElement | null)}>
      <button>popout</button>
    </div>
  );
}

/** Mirrors PreSendReviewSheet: the hook OWNS Escape (manageEsc default true). */
function MockPresend({ onBackToEditing }: { onBackToEditing: () => void }) {
  const { registerContainer } = useOverlayA11y({
    visible: true,
    onDismiss: onBackToEditing,
    layerId: 'presend',
  });
  return (
    <div ref={(el) => registerContainer(el as unknown as HTMLElement | null)}>
      <button>presend</button>
    </div>
  );
}

function dispatchEscape(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
}

describe('A11Y-PR0 — single-Escape arbitration (harness, jsdom)', () => {
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

  it('popout over the dock: Escape closes ONLY the popout', () => {
    const dockClose = jest.fn();
    const popoutClose = jest.fn();
    act(() => {
      root = createRoot(container);
      root.render(
        <>
          <MockDock onClose={dockClose} />
          <MockPopout onClose={popoutClose} />
        </>,
      );
    });
    dispatchEscape();
    expect(popoutClose).toHaveBeenCalledTimes(1);
    expect(dockClose).not.toHaveBeenCalled();
  });

  it('pre-send sheet over the dock: Escape returns to editing; the dock stays', () => {
    const dockClose = jest.fn();
    const backToEditing = jest.fn();
    act(() => {
      root = createRoot(container);
      root.render(
        <>
          <MockDock onClose={dockClose} />
          <MockPresend onBackToEditing={backToEditing} />
        </>,
      );
    });
    dispatchEscape();
    expect(backToEditing).toHaveBeenCalledTimes(1);
    expect(dockClose).not.toHaveBeenCalled();
  });

  it('bare dock (no overlay): Escape closes the dock (regression preserved)', () => {
    const dockClose = jest.fn();
    act(() => {
      root = createRoot(container);
      root.render(<MockDock onClose={dockClose} />);
    });
    dispatchEscape();
    expect(dockClose).toHaveBeenCalledTimes(1);
  });
});

// ── Source-scans: the real surfaces wire the same primitives ───────

const ROOT = path.join(__dirname, '..', '..');
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const POPOUT_SRC = readSrc('src/features/arguments/oneBox/Popout.tsx');
const DOCK_SRC = readSrc('src/features/arguments/ArgumentComposerDock.tsx');
const PRESEND_SRC = readSrc('src/features/arguments/PreSendReviewSheet.tsx');
const MARKER_SRC = readSrc('src/features/arguments/markers/MarkerPhrasePickerSheet.tsx');
const REQUEST_SRC = readSrc('src/features/requestReview/RequestReviewComposer.tsx');

describe('A11Y-PR0 — real surfaces adopt the arbitration primitives', () => {
  it('Popout calls useOverlayA11y with manageEsc:false and guards its inline Escape', () => {
    expect(POPOUT_SRC).toMatch(/useOverlayA11y\(\{/);
    expect(POPOUT_SRC).toMatch(/manageEsc:\s*false/);
    // The QOL-030 inline Escape effect is preserved AND now topmost-gated.
    expect(POPOUT_SRC).toMatch(/event\.key === 'Escape'/);
    expect(POPOUT_SRC).toMatch(/if \(!isTopmost\(\)\) return;/);
    expect(POPOUT_SRC).toMatch(/onCloseRef\.current\(\)/);
  });

  it('ArgumentComposerDock calls useOverlayA11y with manageEsc:false and guards its keydown handler', () => {
    expect(DOCK_SRC).toMatch(/useOverlayA11y\(\{/);
    expect(DOCK_SRC).toMatch(/manageEsc:\s*false/);
    expect(DOCK_SRC).toMatch(/if \(!isTopmost\(\)\) return;/);
    // The pure composer keyboard model is NOT threaded an overlay boolean (R2).
    expect(DOCK_SRC).not.toMatch(/overlayOpen/);
  });

  it('PreSendReviewSheet owns Escape via the hook (onDismiss: onBackToEditing) and keeps the inert scrim', () => {
    expect(PRESEND_SRC).toMatch(/useOverlayA11y\(\{/);
    expect(PRESEND_SRC).toMatch(/onDismiss:\s*onBackToEditing/);
    // The inert scrim is preserved (no dismissing onPress on the scrim).
    expect(PRESEND_SRC).toMatch(/onPress=\{\(\) => undefined\}/);
  });

  it('MarkerPhrasePickerSheet stays inline (no RN Modal) with a web-only dismissing backdrop', () => {
    expect(MARKER_SRC).toMatch(/useOverlayA11y\(\{/);
    expect(MARKER_SRC).toMatch(/onDismiss:\s*props\.onCancel/);
    expect(MARKER_SRC).toMatch(/Platform\.OS === 'web'/);
    expect(MARKER_SRC).toMatch(/marker-phrase-picker-backdrop/);
    // Additive path: no RN Modal wrap.
    expect(MARKER_SRC).not.toMatch(/<Modal/);
  });

  it('RequestReviewComposer stays inline (no RN Modal) with a web-only dismissing backdrop', () => {
    expect(REQUEST_SRC).toMatch(/useOverlayA11y\(\{/);
    expect(REQUEST_SRC).toMatch(/onDismiss:\s*onCancel/);
    expect(REQUEST_SRC).toMatch(/Platform\.OS === 'web'/);
    expect(REQUEST_SRC).toMatch(/-backdrop/);
    expect(REQUEST_SRC).not.toMatch(/<Modal/);
  });
});
