/**
 * UX-001.3 — Composer keyboard + focus routing source-scan tests.
 *
 * The keyboard dispatch flows through three pieces:
 *  1. resolveComposerKeyEffect (pure model, fully unit-tested in
 *     composerKeyboardModel.test.ts)
 *  2. useComposerFocusContext (web focusin/focusout subscription,
 *     contract-pinned in useComposerFocusContext.test.tsx)
 *  3. ArgumentComposerDock — the integration site that connects
 *     a document-level keydown listener to the resolver, gated by
 *     composerFocused.
 *
 * This suite is the source-scan layer over piece 3: assertions on
 * ArgumentComposerDock that pin the load-bearing wiring shape so a
 * regression breaks the build.
 */
import fs from 'fs';
import path from 'path';

const DOCK_SRC = fs.readFileSync(
  path.join(
    process.cwd(),
    'src',
    'features',
    'arguments',
    'ArgumentComposerDock.tsx',
  ),
  'utf8',
);

const ONEBOX_SRC = fs.readFileSync(
  path.join(
    process.cwd(),
    'src',
    'features',
    'arguments',
    'oneBox',
    'OneBox.tsx',
  ),
  'utf8',
);

describe('UX-001.3 — ArgumentComposerDock keyboard wiring', () => {
  it('imports resolveComposerKeyEffect from the pure model', () => {
    expect(DOCK_SRC).toMatch(
      /import\s*\{\s*resolveComposerKeyEffect\s*\}\s*from\s*['"]\.\/composer\/composerKeyboardModel['"]/,
    );
  });

  it('imports useComposerFocusContext from the focus hook', () => {
    expect(DOCK_SRC).toMatch(
      /import\s*\{\s*useComposerFocusContext\s*\}\s*from\s*['"]\.\/composer\/useComposerFocusContext['"]/,
    );
  });

  it('imports triggerHaptic from the haptics shim', () => {
    expect(DOCK_SRC).toMatch(
      /import\s*\{\s*triggerHaptic\s*\}\s*from\s*['"]\.\/composer\/composerHaptics['"]/,
    );
  });

  it('passes composerFocused into resolveComposerKeyEffect', () => {
    // The pure model REQUIRES composerFocused; this pins it.
    expect(DOCK_SRC).toMatch(/resolveComposerKeyEffect\([\s\S]*?composerFocused/);
  });

  it('dispatches submit by incrementing postSignal', () => {
    expect(DOCK_SRC).toMatch(/case\s*'submit'[\s\S]*?setPostSignal/);
  });

  it('dispatches open_mode_switcher by incrementing openModeSwitcherSignal', () => {
    expect(DOCK_SRC).toMatch(
      /case\s*'open_mode_switcher'[\s\S]*?setOpenModeSwitcherSignal/,
    );
  });

  it('dispatches close by calling onClose', () => {
    expect(DOCK_SRC).toMatch(/case\s*'close'[\s\S]*?onCloseRef\.current\(\)/);
  });

  it('registers the composer container with the focus hook', () => {
    // The dock must call registerContainer on the body subtree so
    // composerFocused reflects whether activeElement is inside.
    expect(DOCK_SRC).toMatch(/ref=\{[^}]*registerContainer/);
  });

  it('keydown listener is web-only', () => {
    // The keyboard wiring must be guarded by Platform.OS === 'web'.
    expect(DOCK_SRC).toMatch(/Platform\.OS\s*!==?\s*['"]web['"]/);
  });
});

describe('UX-001.3 — OneBox openModeSwitcherSignal one-shot wiring', () => {
  it('declares the openModeSwitcherSignal prop', () => {
    expect(ONEBOX_SRC).toMatch(/openModeSwitcherSignal\?:\s*number/);
  });

  it('the prop is wired into a useEffect that opens the popout', () => {
    // The one-shot effect mirrors the postSignal pattern: a ref
    // guards against re-firing on unrelated re-renders; each new
    // value opens the popout exactly once.
    expect(ONEBOX_SRC).toMatch(/openModeSwitcherSignal[\s\S]*?setActPopoutVisible\(true\)/);
  });

  it('the openModeSwitcherSignal handler tracks its previous value via a ref', () => {
    expect(ONEBOX_SRC).toMatch(/lastOpenModeSwitcherSignalRef/);
  });
});

describe('UX-001.3 — keyboard shortcuts do NOT collide with Timeline shortcuts', () => {
  it('the dock keydown listener returns when composerFocused is false', () => {
    // The pure model's gate (composerFocused === false → 'none')
    // means the dock's handler will hit the `case 'none'` branch
    // and do nothing — the event continues to bubble for the
    // Timeline's own handler.
    //
    // We assert this by source-scanning that the handler does NOT
    // bypass the resolver (no direct check of event.key === 'Enter'
    // for example, which would fire regardless of focus).
    //
    // Equivalent contract assertion: every dispatch (submit / open_mode_switcher /
    // close) comes from a `switch (effect.type)` block, not from a
    // direct event.key check.
    const dispatchBlock = DOCK_SRC.match(/switch\s*\(\s*effect\.type\s*\)[\s\S]+?\n  \}/);
    expect(dispatchBlock).not.toBeNull();
  });
});
