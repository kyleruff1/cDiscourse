/**
 * UX-FLAGS-004 (#836) — room wiring for feedback-flag composer intents.
 *
 * Rendered at the RingsideFeed boundary (the ROOM-003 Exchange lens) — the same
 * altitude the FEEDBACK-001 ghost-bar tests use — because ArgumentRoom is not
 * render-tested in this suite. Covers: the actor gate (participant fires on
 * another author active move; own move + observer stay inert; flag off stays
 * inert), the reply-preset derivation parity (the handler ArgumentRoom builds
 * deep-equals the production quickActionToPreset), suppression (a capped flag
 * never renders), plus a source-scan pin of the ArgumentRoom gate predicate.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
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
import type { RailViewerRole } from '../src/features/arguments/railActionCategories';
import type {
  PrioritizedPointFeedbackFlags,
  PointFeedbackFlagViewModel,
} from '../src/features/feedbackFlags';
import { flagIntentForKey } from '../src/features/feedbackFlags';
import { quickActionToPreset } from '../src/features/arguments/quickActionPresets';

// ── Fixtures (mirrors ringsideFeed.test.tsx) ──────────────────

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

// An ACTIONABLE flag VM: id must be a real FriendlyFlagKey so flagIntentForKey
// resolves it. needs_a_receipt (Family D) => ask_for_source.
const RECEIPT_FLAG: PointFeedbackFlagViewModel = {
  id: 'needs_a_receipt',
  label: 'Needs a receipt',
  tone: 'prompt',
  neverGrantsStanding: true,
  accessibilityLabel: 'Prompt, Needs a receipt, receipt or source help',
  family: 'evidence_source_chain',
};

// A NON-actionable flag VM: nice_bridge (Family A) resolves to null.
const BRIDGE_FLAG: PointFeedbackFlagViewModel = {
  id: 'nice_bridge',
  label: 'Nice bridge',
  tone: 'positive',
  neverGrantsStanding: false,
  accessibilityLabel: 'Positive, Nice bridge',
  family: 'parent_relation',
};

function flags(visible: PointFeedbackFlagViewModel[], suppressedCount = 0): PrioritizedPointFeedbackFlags {
  return { visible, suppressedCount };
}

function renderFeed(
  input: RingsideFeedInput,
  over: Partial<React.ComponentProps<typeof RingsideFeed>> = {},
) {
  const onFlagIntent = jest.fn();
  const utils = render(
    <RingsideFeed
      feed={buildRingsideFeed(input)}
      viewerRole={input.viewerRole}
      onActivate={jest.fn()}
      onActivateAncestor={jest.fn()}
      onCardAction={jest.fn()}
      onRailAction={jest.fn()}
      onOpenMap={jest.fn()}
      pointFeedbackFlags={flags([])}
      reduceMotion
      onFlagIntent={onFlagIntent}
      {...over}
    />,
  );
  return { onFlagIntent, ...utils };
}

// m3 (actor 'other', active) is the opponent active move.
const OPPONENT_ACTIVE = [
  makeVm({ messageId: 'm1', ordinal: 1 }),
  makeVm({ messageId: 'm3', ordinal: 2, actor: 'other', isLatest: true, isActive: true }),
];

describe('UX-FLAGS-004 Ringside — actor gate (parity with the ghost bar)', () => {
  it('flag ON + participant + opponent active move => actionable pill fires onFlagIntent(flagKey)', () => {
    const { getByTestId, onFlagIntent } = renderFeed(
      makeInput(OPPONENT_ACTIVE, { viewerRole: 'participant', activeMessageId: 'm3' }),
      { pointFeedbackFlags: flags([RECEIPT_FLAG]) },
    );
    const pill = getByTestId('point-feedback-flag-needs_a_receipt');
    expect(pill.props.accessibilityRole).toBe('button');
    fireEvent.press(pill);
    expect(onFlagIntent).toHaveBeenCalledTimes(1);
    expect(onFlagIntent).toHaveBeenCalledWith('needs_a_receipt');
  });

  it('flag ON but the flag is non-actionable => pill stays inert with no press handler (firing negative control)', () => {
    const { getByTestId } = renderFeed(
      makeInput(OPPONENT_ACTIVE, { viewerRole: 'participant', activeMessageId: 'm3' }),
      { pointFeedbackFlags: flags([BRIDGE_FLAG]) },
    );
    const pill = getByTestId('point-feedback-flag-nice_bridge');
    expect(pill.props.accessibilityRole).toBe('text');
    expect(pill.props.onPress).toBeUndefined();
  });

  it('own active move => pill inert even with onFlagIntent wired (own-bubble rule)', () => {
    const own = [makeVm({ messageId: 'm1', actor: 'self', isActive: true, isLatest: true })];
    const { getByTestId, onFlagIntent } = renderFeed(
      makeInput(own, { viewerRole: 'participant', activeMessageId: 'm1' }),
      { pointFeedbackFlags: flags([RECEIPT_FLAG]) },
    );
    const pill = getByTestId('point-feedback-flag-needs_a_receipt');
    expect(pill.props.accessibilityRole).toBe('text');
    fireEvent.press(pill);
    expect(onFlagIntent).not.toHaveBeenCalled();
  });

  it('observer => pill inert even with onFlagIntent wired (strict observer posture)', () => {
    const { getByTestId, onFlagIntent } = renderFeed(
      makeInput(OPPONENT_ACTIVE, { viewerRole: 'observer' as RailViewerRole, activeMessageId: 'm3' }),
      { pointFeedbackFlags: flags([RECEIPT_FLAG]) },
    );
    const pill = getByTestId('point-feedback-flag-needs_a_receipt');
    expect(pill.props.accessibilityRole).toBe('text');
    fireEvent.press(pill);
    expect(onFlagIntent).not.toHaveBeenCalled();
  });

  it('flag OFF (onFlagIntent undefined) => pill inert (byte-identical to today)', () => {
    const { getByTestId } = renderFeed(
      makeInput(OPPONENT_ACTIVE, { viewerRole: 'participant', activeMessageId: 'm3' }),
      { pointFeedbackFlags: flags([RECEIPT_FLAG]), onFlagIntent: undefined },
    );
    expect(getByTestId('point-feedback-flag-needs_a_receipt').props.accessibilityRole).toBe('text');
  });

  it('a suppressed (capped) flag is not in visible => it never renders and cannot fire', () => {
    const { queryByTestId } = renderFeed(
      makeInput(OPPONENT_ACTIVE, { viewerRole: 'participant', activeMessageId: 'm3' }),
      // needs_a_receipt is counted as suppressed but NOT in visible.
      { pointFeedbackFlags: flags([BRIDGE_FLAG], 1) },
    );
    expect(queryByTestId('point-feedback-flag-needs_a_receipt')).toBeNull();
  });
});

describe('UX-FLAGS-004 — reply-preset derivation parity (real derivation)', () => {
  it('the handler resolves needs_a_receipt to the source preset = production quickActionToPreset', () => {
    const resolved = flagIntentForKey('needs_a_receipt');
    expect(resolved).not.toBeNull();
    const parentType = 'claim' as const;
    const preset = quickActionToPreset(resolved!.quickAction, parentType);
    // Deep-equals the shipped ask-source preset the rail Ask-source tap produces.
    expect(preset).toEqual(quickActionToPreset('source', parentType));
    expect(preset?.body).toBeTruthy();
  });
});

describe('UX-FLAGS-004 — ArgumentRoom gate predicate (source pin)', () => {
  const SRC = fs.readFileSync(
    path.join(process.cwd(), 'src/features/arguments/room/ArgumentRoom.tsx'),
    'utf8',
  );

  it('gates the flag-intent handler on the flag + seat + non-self-actor predicate', () => {
    expect(SRC).toContain('feedbackFlagIntentsEnabled === true');
    expect(SRC).toContain('seatCanPostFlagIntent(participantSide)');
    expect(SRC).toContain("activeViewModel?.actor !== 'self'");
  });

  it('routes the flag tap through the shipped handleAction reply-with-preset lane', () => {
    expect(SRC).toContain("handleAction('reply', messageId, preset)");
    expect(SRC).toContain('flagIntentForKey(flagKey)');
  });
});
