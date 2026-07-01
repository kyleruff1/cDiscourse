/**
 * CARD-VIEW-REFINE-001 — containment (ask 1) + nav wiring (ask 2).
 *
 * (1) Containment:
 *   - the Stack stage is TOP-ANCHORED (justifyContent: 'flex-start') with
 *     overflow hidden — a tall active card can only grow DOWN, never up into
 *     the masthead.
 *   - the ACTIVE card, when bounded, applies maxHeight + overflow hidden and
 *     wraps the panel in a ScrollView (containment, NOT a tap-to-reveal
 *     disclosure — every section still renders without a tap → #14 holds).
 *   - the 3-col layout still resolves at width ≥ 1024.
 *
 * (2) Nav (source-scan of the wired effect + Stack):
 *   - the Surface wires a Stack-mode document keydown that calls handlePrev /
 *     handleNext via resolveStackKeyEffect, gated on mode === 'stack'.
 *   - the Stack wires a horizontal PanResponder → swipe nav.
 *   - no router import is introduced (composerDockNoRoute / inRoomNoRoute hold).
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import { ArgumentBubbleStack } from '../src/features/arguments/ArgumentBubbleStack';
import { ArgumentBubbleCard } from '../src/features/arguments/ArgumentBubbleCard';
import { hubColumnLayout } from '../src/features/arguments/detail/argumentDetailModel';
import type { ArgumentBubbleViewModel } from '../src/features/arguments/argumentGameSurfaceModel';
import type { CardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import { buildCardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';

const REPO = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

function vm(id: string, isActive: boolean): ArgumentBubbleViewModel {
  return {
    messageId: id,
    ordinal: isActive ? 2 : 1,
    createdAtLabel: '2026-05-26 12:00',
    relativeLabel: '2h ago',
    body: `body-${id}`,
    kindLabel: 'rebuttal',
    actor: 'other',
    sideLabel: 'Neg',
    isLatest: isActive,
    isActive,
    parentHint: null,
    qualifierBadges: [],
    pointStandingHint: null,
    allowedControls: [],
    deletionRequested: false,
  };
}

function detail(): CardDetailViewModel {
  return buildCardDetailViewModel({
    activeMessageId: 'm2',
    chronologicalIds: ['m1', 'm2'],
    ordinalOf: (id) => (id === 'm2' ? 2 : 1),
    kindLabelOf: () => 'rebuttal',
    parentIdOf: (id) => (id === 'm2' ? 'm1' : null),
    categoryLabel: 'Rebuttal',
    qualifierLabels: [],
    persistedClassifierRows: [],
    manualTagEntries: [],
    autoMetadataCodes: [],
    clusterState: 'open',
    messageContribution: null,
    evidenceSources: [],
    evidenceDebtSummary: null,
    standingHint: null,
    lifecycleState: null,
    flagLabels: [],
  });
}

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean).map(flatten));
  return (style as Record<string, unknown>) ?? {};
}

// ── (1) Containment ──────────────────────────────────────────────────────

describe('CARD-VIEW-REFINE-001 — stage is top-anchored + overflow hidden', () => {
  it('the stage uses justifyContent flex-start (overflow grows DOWN, not into the header)', () => {
    const { getByTestId } = render(
      <ArgumentBubbleStack
        viewModels={[vm('m1', false), vm('m2', true)]}
        activeMessageId="m2"
        onActivate={jest.fn()}
        onPrevious={jest.fn()}
        onNext={jest.fn()}
      />,
    );
    const stage = getByTestId('argument-stack-stage');
    const style = flatten(stage.props.style);
    expect(style.justifyContent).toBe('flex-start');
    expect(style.overflow).toBe('hidden');
    // Horizontal centering is preserved.
    expect(style.alignItems).toBe('center');
  });
});

describe('CARD-VIEW-REFINE-001 — the active card is bounded + scrolls its detail in place', () => {
  it('applies maxHeight + overflow hidden on the active card and wraps the panel in a ScrollView', () => {
    const { getByTestId } = render(
      <ArgumentBubbleCard
        viewModel={vm('m2', true)}
        cardDetail={detail()}
        maxHeight={400}
      />,
    );
    const card = getByTestId('argument-bubble-m2');
    const style = flatten(card.props.style);
    expect(style.maxHeight).toBe(400);
    expect(style.overflow).toBe('hidden');
    // The panel is inside a ScrollView (containment, not a disclosure).
    expect(getByTestId('card-detail-scroll-m2')).toBeTruthy();
    // VISUAL-SIMPLIFY-001 — the panel renders in the collapsed default; the
    // detail sections move behind the ONE opt-in toggle (containment is
    // orthogonal to the collapse: both hold).
    expect(getByTestId('card-detail-panel-m2')).toBeTruthy();
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    expect(getByTestId('card-detail-evidence-zone')).toBeTruthy();
    expect(getByTestId('card-detail-classifier-zone')).toBeTruthy();
  });

  it('does NOT bound the card when no maxHeight is supplied (legacy unbounded path)', () => {
    const { getByTestId } = render(
      <ArgumentBubbleCard viewModel={vm('m2', true)} cardDetail={detail()} />,
    );
    const card = getByTestId('argument-bubble-m2');
    const style = flatten(card.props.style);
    expect(style.maxHeight).toBeUndefined();
    // The panel still renders (it just isn't scroll-bounded).
    expect(getByTestId('card-detail-panel-m2')).toBeTruthy();
  });
});

describe('CARD-VIEW-REFINE-001 — the 3-col layout still resolves at ≥1024', () => {
  it('width 1024 on web → three_column; narrow → stacked', () => {
    expect(hubColumnLayout(1024, 'web').mode).toBe('three_column');
    expect(hubColumnLayout(1366, 'web').mode).toBe('three_column');
    expect(hubColumnLayout(800, 'web').mode).toBe('stacked');
    expect(hubColumnLayout(1024, 'ios').mode).toBe('stacked');
  });
});

// ── (2) Nav wiring (source-scan) ─────────────────────────────────────────

describe('CARD-VIEW-REFINE-001 — Stack-mode keyboard nav is wired', () => {
  const surface = read('src/features/arguments/ArgumentGameSurface.tsx');

  it('wires a document keydown that routes through resolveStackKeyEffect', () => {
    expect(surface).toMatch(/resolveStackKeyEffect/);
    expect(surface).toMatch(/document\.addEventListener\('keydown', handleStackKeyDown\)/);
    expect(surface).toMatch(/document\.removeEventListener\('keydown', handleStackKeyDown\)/);
  });

  it('the Stack-mode keydown is gated on mode === stack (no Timeline double-fire)', () => {
    const idx = surface.indexOf('handleStackKeyDown');
    expect(idx).toBeGreaterThan(-1);
    // The effect body bails when mode !== 'stack'.
    const before = surface.slice(Math.max(0, idx - 600), idx);
    expect(before).toMatch(/if \(mode !== 'stack'\) return;/);
  });

  it('ArrowLeft → handlePrev, ArrowRight → handleNext inside the effect', () => {
    const idx = surface.indexOf('const handleStackKeyDown');
    const block = surface.slice(idx, idx + 1200);
    expect(block).toMatch(/case 'prev':[\s\S]*handlePrev\(\)/);
    expect(block).toMatch(/case 'next':[\s\S]*handleNext\(\)/);
    // It reads composerFocused + open-menu guards into the resolver.
    expect(block).toMatch(/composerFocused/);
    expect(block).toMatch(/hasOpenMenu/);
  });

  it('uses Platform.OS === web guard (web-only keyboard) and no router import', () => {
    const idx = surface.indexOf('const handleStackKeyDown');
    const before = surface.slice(Math.max(0, idx - 400), idx);
    expect(before).toMatch(/Platform\.OS !== 'web'/);
    // No routing primitive in the whole surface (defense-in-depth here too).
    expect(surface).not.toMatch(/from\s+['"]expo-router['"]/);
    expect(surface).not.toMatch(/\bnavigation\.navigate\s*\(/);
    expect(surface).not.toMatch(/\brouter\.push\s*\(/);
  });
});

describe('CARD-VIEW-REFINE-001 — Stack swipe is wired via PanResponder (no new dep)', () => {
  const stack = read('src/features/arguments/ArgumentBubbleStack.tsx');

  it('imports PanResponder from react-native (RN primitive, not a new dep)', () => {
    expect(stack).toMatch(/import \{[^}]*PanResponder[^}]*\} from 'react-native'/);
  });

  it('claims only horizontal pans + dispatches Prev/Next on release via the pure resolver', () => {
    expect(stack).toMatch(/onMoveShouldSetPanResponder:.*shouldClaimStackHorizontalPan/s);
    expect(stack).toMatch(/resolveStackSwipeEffect/);
    expect(stack).toMatch(/onStartShouldSetPanResponder: \(\) => false/); // tap still activates
  });

  it('attaches the panHandlers to the stage', () => {
    expect(stack).toMatch(/\{\.\.\.panResponder\.panHandlers\}/);
  });
});
