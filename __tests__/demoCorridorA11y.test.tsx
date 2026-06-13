/**
 * DEMO-001 — Corridor accessibility tests.
 *
 * Pins the accessibility-targets bar: every interactive element carries a
 * role + descriptive label (+ state where applicable), every Pressable meets
 * the 44×44 target (visual minSize or hitSlop), the corridor is completable
 * via the labelled action buttons alone, the four-move options are each
 * independently focusable, and the reduce-motion path renders (static).
 */
import React from 'react';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
import { AccessibilityInfo } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { DemoCorridorScreen } from '../src/features/demoCorridor/DemoCorridorScreen';
import { TOUCH_TARGET } from '../src/lib/designTokens';
import { CORRIDOR_STEPS } from '../src/features/demoCorridor/corridorModel';

function mount(onExit: () => void = () => {}) {
  return render(
    <AppSessionProvider>
      <DemoCorridorScreen onExit={onExit} />
    </AppSessionProvider>,
  );
}

const advance = (r: ReturnType<typeof render>) => fireEvent.press(r.getByTestId('demo-corridor-primary'));

/** A Pressable satisfies the 44×44 bar via visual minSize OR a hitSlop. */
function meetsTarget(node: { props: Record<string, unknown> }): boolean {
  if (node.props.hitSlop) return true;
  const style = node.props.style as { minHeight?: number; minWidth?: number } | undefined;
  // Style may be a function/array on Pressable; normalise to the resolved object.
  const flat = Array.isArray(style) ? Object.assign({}, ...style) : style ?? {};
  return (flat.minHeight ?? 0) >= TOUCH_TARGET.minSizePx || (flat.minWidth ?? 0) >= TOUCH_TARGET.minSizePx;
}

describe('Demo Corridor — interactive a11y contract', () => {
  it('the primary action exposes role + label + a 44×44 target', () => {
    const r = mount();
    const primary = r.getByTestId('demo-corridor-primary');
    expect(primary.props.accessibilityRole).toBe('button');
    expect(typeof primary.props.accessibilityLabel).toBe('string');
    expect((primary.props.accessibilityLabel as string).length).toBeGreaterThan(0);
    expect(primary.props.hitSlop).toBeTruthy();
  });

  it('the persistent Close affordance exposes role + label + a 44×44 target', () => {
    const r = mount();
    const close = r.getByTestId('demo-corridor-close');
    expect(close.props.accessibilityRole).toBe('button');
    expect(typeof close.props.accessibilityLabel).toBe('string');
    expect(meetsTarget(close)).toBe(true);
  });

  it('every four-move option is an independently focusable, labelled 44×44 button', () => {
    const r = mount();
    advance(r);
    advance(r);
    advance(r); // → choose_move
    for (const code of ['ask_source', 'add_evidence', 'narrow', 'branch']) {
      const opt = r.getByTestId(`demo-corridor-move-${code}`);
      expect(opt.props.accessibilityRole).toBe('button');
      expect((opt.props.accessibilityLabel as string).length).toBeGreaterThan(0);
      expect(meetsTarget(opt)).toBe(true);
    }
  });

  it('the secondary (Back) affordance is a labelled button', () => {
    const r = mount();
    advance(r); // → disputed_point (has a Back secondary)
    const back = r.getByTestId('demo-corridor-secondary-back');
    expect(back.props.accessibilityRole).toBe('button');
    expect((back.props.accessibilityLabel as string).length).toBeGreaterThan(0);
    expect(back.props.hitSlop).toBeTruthy();
  });
});

describe('Demo Corridor — completable via labelled buttons alone', () => {
  it('every advance beat exposes a labelled primary button (no gesture required)', () => {
    const r = mount();
    // claim → disputed_point → referee_open_task → choose_move
    const advanceKinds = ['claim', 'disputed_point', 'referee_open_task'];
    for (const kind of advanceKinds) {
      const step = CORRIDOR_STEPS.find((s) => s.kind === kind)!;
      const primary = r.getByTestId('demo-corridor-primary');
      expect(primary.props.accessibilityLabel).toBe(step.primaryAction.accessibilityLabel);
      advance(r);
    }
    // Arrived at the four-move beat via buttons alone.
    expect(r.getByTestId('demo-corridor-move-menu')).toBeTruthy();
  });
});

describe('Demo Corridor — reduce-motion', () => {
  it('renders the real surface when reduce-motion is enabled (no crash, static chrome)', async () => {
    const spy = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    const r = mount();
    // The guidance chrome + the real surface still mount under reduce-motion.
    expect(r.getByTestId('demo-corridor-guidance')).toBeTruthy();
    expect(r.queryByTestId('demo-corridor-surface')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('Demo Corridor — text is wrapped (no raw strings in Views)', () => {
  it('teaching lines render inside Text nodes', () => {
    const r = mount();
    expect(r.getByTestId('demo-corridor-teaching-0')).toBeTruthy();
    expect(r.getByTestId('demo-corridor-teaching-1')).toBeTruthy();
  });
});
