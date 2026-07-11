/**
 * A11Y-693 — the four ASP gap fixes (RNTL render).
 *
 * Per `docs/designs/A11Y-693-ASP.md` (needs-fix cells):
 *   1. RingsideCard root Pressable is accessible=false (nested controls stay
 *      individually focusable on iOS VoiceOver; the root still activates on tap).
 *   2. RingsideCard quote chip exposes accessibilityState.disabled when there is
 *      no parent to jump to.
 *   3. ArgumentStateRail informational chip + overflow badge Views announce as
 *      static text (accessibilityRole="text").
 *   4. ProofDrawer selected prior-move carries a non-color signal (a check affix
 *      + a thicker border); the affix stays out of the accessibilityLabel.
 *
 * Comments are apostrophe-free for the naive quote-parity doctrine scanner.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { RingsideFeed } from '../src/features/arguments/room/RingsideFeed';
import {
  buildRingsideFeed,
  type RingsideFeedInput,
} from '../src/features/arguments/room/ringsideFeedModel';
import {
  getBubbleControlsForActor,
  type ArgumentBubbleActor,
  type ArgumentBubbleViewModel,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { getRailActions } from '../src/features/arguments/ArgumentSideActionRail';
import type { PrioritizedPointFeedbackFlags } from '../src/features/feedbackFlags';
import { ArgumentStateRail } from '../src/features/arguments/room/ArgumentStateRail';
import {
  deriveArgumentStateRail,
  type ArgumentStateRailInput,
} from '../src/features/arguments/room/argumentStateRailModel';
import { ProofDrawer } from '../src/features/proof/ProofDrawer';
import type { ProofDrawerScope } from '../src/features/proof/proofDrawerModel';

// ── RingsideCard fixtures (via RingsideFeed) ──────────────────

function makeVm(over: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
  const actor: ArgumentBubbleActor = over.actor ?? 'other';
  return {
    messageId: over.messageId ?? 'm1',
    ordinal: over.ordinal ?? 1,
    createdAtLabel: '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? '2m ago',
    body: over.body ?? 'A plain move body.',
    kindLabel: over.kindLabel ?? 'claim',
    actor,
    sideLabel: over.sideLabel ?? 'Aff',
    isLatest: over.isLatest ?? false,
    isActive: over.isActive ?? false,
    parentHint: over.parentHint ?? null,
    qualifierBadges: [],
    pointStandingHint: null,
    allowedControls: over.allowedControls ?? getBubbleControlsForActor(actor),
    deletionRequested: over.deletionRequested ?? false,
  };
}

function makeInput(
  viewModels: ArgumentBubbleViewModel[],
  over: Partial<RingsideFeedInput> = {},
): RingsideFeedInput {
  return {
    viewModels,
    viewerRole: over.viewerRole ?? 'participant',
    activeMessageId: over.activeMessageId ?? null,
    kindColorFamilyFor: over.kindColorFamilyFor ?? (() => 'claim'),
    descendantCountFor: over.descendantCountFor ?? (() => 0),
    parentMessageIdFor: over.parentMessageIdFor ?? (() => null),
    proofChipCountFor: over.proofChipCountFor ?? (() => 0),
    owedReceiptFor: over.owedReceiptFor ?? (() => false),
    observerActionsFor: over.observerActionsFor ?? ((actor) => getRailActions('observer', actor)),
    friendlyFlagCountFor: over.friendlyFlagCountFor,
  };
}

const NO_FLAGS: PrioritizedPointFeedbackFlags = { visible: [], suppressedCount: 0 };

function renderFeed(input: RingsideFeedInput) {
  const onActivate = jest.fn();
  const onActivateAncestor = jest.fn();
  const utils = render(
    <RingsideFeed
      feed={buildRingsideFeed(input)}
      viewerRole={input.viewerRole}
      onActivate={onActivate}
      onActivateAncestor={onActivateAncestor}
      onCardAction={jest.fn()}
      onRailAction={jest.fn()}
      onOpenMap={jest.fn()}
      pointFeedbackFlags={NO_FLAGS}
      reduceMotion
    />,
  );
  return { onActivate, onActivateAncestor, ...utils };
}

const THREE = [
  makeVm({ messageId: 'm1', ordinal: 1, kindLabel: 'claim' }),
  makeVm({ messageId: 'm2', ordinal: 2, kindLabel: 'rebuttal' }),
  makeVm({ messageId: 'm3', ordinal: 3, kindLabel: 'evidence', isLatest: true, isActive: true }),
];

describe('A11Y-693 gap fix 1 — RingsideCard root is accessible=false', () => {
  it('the active card root Pressable is accessible=false', () => {
    const { getByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    expect(getByTestId('ringside-card-active-m3').props.accessible).toBe(false);
  });

  it('the nested controls remain individually queryable (not collapsed into the root)', () => {
    const { getByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    expect(getByTestId('ringside-action-reply-m3')).toBeTruthy();
    expect(getByTestId('ringside-action-disagree-m3')).toBeTruthy();
  });

  it('tapping the card root still fires onActivate (accessible=false leaves touch intact)', () => {
    const { getByTestId, onActivate } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    fireEvent.press(getByTestId('ringside-card-active-m3'));
    expect(onActivate).toHaveBeenCalledWith('m3');
  });

  it('the non-active card root Pressable is also accessible=false', () => {
    const { getByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    expect(getByTestId('ringside-card-m1').props.accessible).toBe(false);
  });
});

describe('A11Y-693 gap fix 2 — RingsideCard quote chip disabled state', () => {
  it('the quote chip exposes accessibilityState.disabled when there is no parent to jump to', () => {
    const vms = [makeVm({ messageId: 'm2', ordinal: 2, kindLabel: 'rebuttal', parentHint: 'answering the root' })];
    // The default parentMessageIdFor returns null, so the chip has no target.
    const { getByTestId } = renderFeed(makeInput(vms, { activeMessageId: null }));
    const chip = getByTestId('ringside-quote-chip-m2');
    expect(chip.props.accessibilityState).toEqual({ disabled: true });
  });

  it('the quote chip is enabled when a parent message exists', () => {
    const vms = [makeVm({ messageId: 'm2', ordinal: 2, kindLabel: 'rebuttal', parentHint: 'answering the root' })];
    const { getByTestId } = renderFeed(
      makeInput(vms, { activeMessageId: null, parentMessageIdFor: () => 'm1' }),
    );
    const chip = getByTestId('ringside-quote-chip-m2');
    expect(chip.props.accessibilityState).toEqual({ disabled: false });
  });
});

// ── ArgumentStateRail fixtures ────────────────────────────────

function baseRailInput(overrides: Partial<ArgumentStateRailInput> = {}): ArgumentStateRailInput {
  return {
    viewerRole: 'participant',
    participantSide: 'affirmative',
    turnLabel: 'Your move',
    visibility: 'public',
    opponentSeatIsOpen: false,
    openPointCount: 2,
    receiptsOwedCount: 1,
    ...overrides,
  };
}

describe('A11Y-693 gap fix 3 — ArgumentStateRail static-text roles', () => {
  it('the informational (non-pressable) chip View announces as static text', () => {
    const model = deriveArgumentStateRail(baseRailInput({ openPointCount: 3 }));
    // No onOpenMap supplied so the open_points chip is informational.
    const { getByTestId } = render(<ArgumentStateRail model={model} />);
    expect(getByTestId('argument-state-rail-chip-open_points').props.accessibilityRole).toBe('text');
  });

  it('the overflow badge View announces as static text', () => {
    const model = deriveArgumentStateRail(
      baseRailInput({ openPointCount: 3, receiptsOwedCount: 2, opponentSeatIsOpen: true, visibility: 'private' }),
    );
    expect(model.overflowCount).toBeGreaterThan(0);
    const { getByTestId } = render(<ArgumentStateRail model={model} />);
    expect(getByTestId('argument-state-rail-overflow').props.accessibilityRole).toBe('text');
  });

  it('the interactive chip stays a button (the fix does not blur the roles)', () => {
    const model = deriveArgumentStateRail(baseRailInput({ openPointCount: 3 }));
    const { getByTestId } = render(<ArgumentStateRail model={model} onOpenMap={() => {}} />);
    expect(getByTestId('argument-state-rail-chip-open_points').props.accessibilityRole).toBe('button');
  });
});

// ── ProofDrawer fixtures ──────────────────────────────────────

const PROOF_SCOPE: ProofDrawerScope = {
  kind: 'argument',
  debateId: 'debate-1',
  argumentId: 'arg-1',
  owedDebtKind: null,
};

function renderDrawerWithPrior() {
  return render(
    <ProofDrawer
      scope={PROOF_SCOPE}
      windowWidth={400}
      windowHeight={800}
      priorMoves={[{ id: 'pm1', label: 'Earlier move' }]}
      onAttach={jest.fn().mockResolvedValue({ ok: true })}
      onClose={jest.fn()}
    />,
  );
}

describe('A11Y-693 gap fix 4 — ProofDrawer selected prior-move is not color-alone', () => {
  it('the selected prior-move renders a check affix and a borderWidth-2 border', () => {
    const { getByTestId, getByText } = renderDrawerWithPrior();
    fireEvent.press(getByTestId('proof-drawer-kind-prior_move'));
    fireEvent.press(getByTestId('proof-drawer-prior-pm1'));
    const item = getByTestId('proof-drawer-prior-pm1');
    const flat = StyleSheet.flatten(item.props.style as never) as { borderWidth?: number };
    expect(flat.borderWidth).toBe(2);
    // The visible label carries a grayscale-legible check affix.
    expect(getByText('✓ Earlier move')).toBeTruthy();
  });

  it('the check affix stays visual-only — the accessibilityLabel omits it', () => {
    const { getByTestId } = renderDrawerWithPrior();
    fireEvent.press(getByTestId('proof-drawer-kind-prior_move'));
    fireEvent.press(getByTestId('proof-drawer-prior-pm1'));
    const item = getByTestId('proof-drawer-prior-pm1');
    expect(item.props.accessibilityState).toEqual({ selected: true });
    expect(item.props.accessibilityLabel).toBe('Earlier move');
    expect(item.props.accessibilityLabel).not.toContain('✓');
  });

  it('an unselected prior-move has no check affix and the thinner border', () => {
    const { getByTestId, getByText } = renderDrawerWithPrior();
    fireEvent.press(getByTestId('proof-drawer-kind-prior_move'));
    // Before selection the row shows the plain label and borderWidth 1.
    const item = getByTestId('proof-drawer-prior-pm1');
    const flat = StyleSheet.flatten(item.props.style as never) as { borderWidth?: number };
    expect(flat.borderWidth).toBe(1);
    expect(getByText('Earlier move')).toBeTruthy();
  });
});
