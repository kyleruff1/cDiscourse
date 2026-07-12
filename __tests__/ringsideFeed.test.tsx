/**
 * ROOM-002 (#885) — RingsideFeed / RingsideCard render + interaction (S2).
 *
 * RNTL coverage: one card per message, transform-free, active-card action row
 * + friendly-flag row, actor matrix in the DOM, reply / observer / branch
 * dispatch, disabled request_deletion, a11y floors (44x44 + role/label/state),
 * color-independence (spine paired with text kind), copy ban-list, and the
 * KPI path (active-by-default latest, Reply dispatches in <= 2 taps).
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
import type { PrioritizedPointFeedbackFlags } from '../src/features/feedbackFlags';

// ── Fixtures ──────────────────────────────────────────────────

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

function renderFeed(
  input: RingsideFeedInput,
  over: Partial<React.ComponentProps<typeof RingsideFeed>> = {},
) {
  const onActivate = jest.fn();
  const onActivateAncestor = jest.fn();
  const onCardAction = jest.fn();
  const onRailAction = jest.fn();
  const onOpenMap = jest.fn();
  const utils = render(
    <RingsideFeed
      feed={buildRingsideFeed(input)}
      viewerRole={input.viewerRole}
      onActivate={onActivate}
      onActivateAncestor={onActivateAncestor}
      onCardAction={onCardAction}
      onRailAction={onRailAction}
      onOpenMap={onOpenMap}
      pointFeedbackFlags={NO_FLAGS}
      reduceMotion
      {...over}
    />,
  );
  return { onActivate, onActivateAncestor, onCardAction, onRailAction, onOpenMap, ...utils };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s) }), {});
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

const THREE = [
  makeVm({ messageId: 'm1', ordinal: 1, kindLabel: 'claim' }),
  makeVm({ messageId: 'm2', ordinal: 2, kindLabel: 'rebuttal', parentHint: "answering: 'the root'" }),
  makeVm({ messageId: 'm3', ordinal: 3, kindLabel: 'evidence', isLatest: true, isActive: true }),
];

// ── Structure ─────────────────────────────────────────────────

describe('RingsideFeed — structure', () => {
  it('renders one card per message', () => {
    const { getByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    expect(getByTestId('ringside-feed')).toBeTruthy();
    expect(getByTestId('ringside-card-m1')).toBeTruthy();
    expect(getByTestId('ringside-card-m2')).toBeTruthy();
    // The active card uses the active testID variant.
    expect(getByTestId('ringside-card-active-m3')).toBeTruthy();
  });

  it('is transform-free (no Animated / transform in RingsideCard source)', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/arguments/room/RingsideCard.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/\bAnimated\b/);
    expect(src).not.toMatch(/transform:/);
    expect(src).not.toMatch(/rotate|scaleX|scaleY|translateX|translateY/);
  });

  it('the kind label text renders alongside the spine (color is not the only signal)', () => {
    const { getByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    expect(getByTestId('ringside-kind-m1').props.children).toBe('claim');
    expect(getByTestId('ringside-kind-m3').props.children).toBe('evidence');
  });
});

// ── Active-card chrome ────────────────────────────────────────

describe('RingsideFeed — active card only shows the action + flag rows', () => {
  it('inactive cards render no action row', () => {
    const { queryByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    expect(queryByTestId('ringside-action-row-m1')).toBeNull();
    expect(queryByTestId('ringside-action-row-m2')).toBeNull();
    expect(queryByTestId('ringside-action-row-m3')).toBeTruthy();
  });

  it('renders the friendly-flag row on the active card when flags are present', () => {
    const flags: PrioritizedPointFeedbackFlags = {
      visible: [
        {
          id: 'source_help',
          label: 'Could use a source',
          tone: 'prompt',
          neverGrantsStanding: true,
          accessibilityLabel: 'Note: could use a source',
          family: 'evidence_source_chain',
        } as PrioritizedPointFeedbackFlags['visible'][number],
      ],
      suppressedCount: 0,
    };
    const { getByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }), {
      pointFeedbackFlags: flags,
    });
    // The calm friendly-flag row mounts on the active card (m3 is active).
    expect(getByTestId('point-feedback-flags-row')).toBeTruthy();
  });

  it('the friendly-flag row does NOT mount when the active card has no flags', () => {
    const { queryByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }), {
      pointFeedbackFlags: NO_FLAGS,
    });
    expect(queryByTestId('point-feedback-flags-row')).toBeNull();
  });
});

// ── Actor matrix ──────────────────────────────────────────────

describe('RingsideFeed — actor matrix in the DOM', () => {
  it('own active card renders only View qualifiers + Request deletion', () => {
    const vms = [makeVm({ messageId: 'm1', ordinal: 1, actor: 'self', isActive: true, isLatest: true })];
    const { getByTestId, queryByTestId } = renderFeed(
      makeInput(vms, { viewerRole: 'participant', activeMessageId: 'm1' }),
    );
    expect(getByTestId('ringside-action-view_qualifiers-m1')).toBeTruthy();
    expect(getByTestId('ringside-action-request_deletion-m1')).toBeTruthy();
    expect(queryByTestId('ringside-action-reply-m1')).toBeNull();
    expect(queryByTestId('ringside-action-disagree-m1')).toBeNull();
    expect(queryByTestId('ringside-action-flag-m1')).toBeNull();
  });

  it('opponent active card renders the full 7-control set', () => {
    const { getByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    for (const code of [
      'reply',
      'disagree',
      'flag',
      'ask_for_source',
      'ask_for_quote',
      'branch',
      'view_qualifiers',
    ]) {
      expect(getByTestId(`ringside-action-${code}-m3`)).toBeTruthy();
    }
  });

  it('observer active card renders watch / join (UX-PR-G #920 removed share)', () => {
    const { getByTestId, queryByTestId } = renderFeed(
      makeInput(THREE, { viewerRole: 'observer' as RailViewerRole, activeMessageId: 'm3' }),
    );
    for (const code of ['watch', 'join_aff', 'join_neg']) {
      expect(getByTestId(`ringside-action-${code}-m3`)).toBeTruthy();
    }
    // UX-PR-G (#920) P1-12 — share removed (guaranteed no-op, no room URLs).
    expect(queryByTestId('ringside-action-share-m3')).toBeNull();
    expect(queryByTestId('ringside-action-reply-m3')).toBeNull();
  });
});

// ── Dispatch ──────────────────────────────────────────────────

describe('RingsideFeed — dispatch', () => {
  it('Reply on the active opponent card calls onCardAction(reply, id) — KPI path', () => {
    const { getByTestId, onCardAction } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    fireEvent.press(getByTestId('ringside-action-reply-m3'));
    expect(onCardAction).toHaveBeenCalledWith('reply', 'm3');
  });

  it('an observer action dispatches onRailAction with the active message id', () => {
    const { getByTestId, onRailAction } = renderFeed(
      makeInput(THREE, { viewerRole: 'observer' as RailViewerRole, activeMessageId: 'm3' }),
    );
    fireEvent.press(getByTestId('ringside-action-join_aff-m3'));
    expect(onRailAction).toHaveBeenCalledWith('join_aff', { activeMessageId: 'm3' });
  });

  it('tapping a card activates it', () => {
    const { getByTestId, onActivate } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    fireEvent.press(getByTestId('ringside-card-m1'));
    expect(onActivate).toHaveBeenCalledWith('m1');
  });

  it('the quote chip activates the ancestor', () => {
    const { getByTestId, onActivateAncestor } = renderFeed(
      makeInput(THREE, { activeMessageId: 'm3', parentMessageIdFor: (id) => (id === 'm2' ? 'm1' : null) }),
    );
    fireEvent.press(getByTestId('ringside-quote-chip-m2'));
    expect(onActivateAncestor).toHaveBeenCalledWith('m1');
  });

  it('the branch pill opens the Map', () => {
    const { getByTestId, onOpenMap } = renderFeed(
      makeInput(THREE, { activeMessageId: 'm3', descendantCountFor: () => 2 }),
    );
    fireEvent.press(getByTestId('ringside-branch-pill-m1'));
    expect(onOpenMap).toHaveBeenCalledTimes(1);
  });

  it('request_deletion is disabled when deletionRequested', () => {
    const vms = [
      makeVm({
        messageId: 'm1',
        actor: 'self',
        isActive: true,
        isLatest: true,
        deletionRequested: true,
        allowedControls: getBubbleControlsForActor('self', { hasOpenDeletionRequest: true }),
      }),
    ];
    const { queryByTestId, getByTestId, onCardAction } = renderFeed(
      makeInput(vms, { viewerRole: 'participant', activeMessageId: 'm1' }),
    );
    // request_deletion is dropped from the set once requested.
    expect(queryByTestId('ringside-action-request_deletion-m1')).toBeNull();
    const qual = getByTestId('ringside-action-view_qualifiers-m1');
    fireEvent.press(qual);
    expect(onCardAction).toHaveBeenCalledWith('view_qualifiers', 'm1');
  });
});

// ── Accessibility floors ──────────────────────────────────────

describe('RingsideFeed — a11y floors', () => {
  it('every action chip meets 44x44 and carries role + label', () => {
    const { getByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    for (const code of ['reply', 'disagree', 'flag', 'branch']) {
      const chip = getByTestId(`ringside-action-${code}-m3`);
      const style = flattenStyle(chip.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
      expect(chip.props.accessibilityRole).toBe('button');
      expect(typeof chip.props.accessibilityLabel).toBe('string');
      expect((chip.props.accessibilityLabel as string).length).toBeGreaterThan(0);
    }
  });

  it('the card exposes a verbose selected-aware accessibility label', () => {
    const { getByTestId } = renderFeed(makeInput(THREE, { activeMessageId: 'm3' }));
    const active = getByTestId('ringside-card-active-m3');
    expect(active.props.accessibilityState).toMatchObject({ selected: true });
    expect(active.props.accessibilityLabel).toContain('evidence by Other voice on side Aff');
    expect(active.props.accessibilityLabel).toContain('position 3 of 3');
    expect(active.props.accessibilityLabel).toContain('active');
  });
});

// ── Copy ban-list ─────────────────────────────────────────────

describe('RingsideFeed — copy ban-list', () => {
  const BANNED = [
    'winner',
    'loser',
    'correct',
    'incorrect',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
    'truth',
  ];
  it('neither UI file contains a banned verdict token in a string literal', () => {
    for (const rel of [
      'src/features/arguments/room/RingsideFeed.tsx',
      'src/features/arguments/room/RingsideCard.tsx',
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      const strings = src.match(/(['"`])(?:(?!\1|\\)[\s\S]|\\[\s\S])*?\1/g) ?? [];
      for (const lit of strings) {
        for (const tok of BANNED) {
          expect(lit.toLowerCase()).not.toContain(tok);
        }
      }
    }
  });
});
