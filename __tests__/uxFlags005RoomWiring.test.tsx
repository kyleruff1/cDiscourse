/**
 * UX-FLAGS-005 (issue 837) — mount-site wiring tests.
 *
 * Verifies the calm 3-state lifecycle discriminant reaches ALL THREE
 * mount sites of PointFeedbackFlagsRow:
 *
 *   1. Timeline mount site           — <PointFeedbackFlagsRow /> direct in ArgumentRoom
 *   2. Ringside active-card mount    — RingsideFeed -> RingsideCard -> row
 *   3. Stack CardDetailPanel mount   — ArgumentBubbleStack -> ArgumentBubbleCard -> CardDetailPanel -> row
 *
 * Each path renders the pending line on `flags=[] + pending`, and null on
 * `flags=[] + failed`. Non-empty flags always render the pill row
 * regardless of lifecycle input (content wins over posture).
 *
 * Also verifies the source ArgumentRoom.tsx wires
 * `classifierLifecycleByArgumentId` into the memo AND passes
 * `activePointLifecycleState` down to both Ringside and Stack lenses (a
 * source-scan asserts the wiring in the file exists).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';
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
import { CardDetailPanel } from '../src/features/arguments/cardView/CardDetailPanel';
import { buildCardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import type { PrioritizedPointFeedbackFlags } from '../src/features/feedbackFlags';
import { POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY } from '../src/features/arguments/gameCopy';

const NO_FLAGS: PrioritizedPointFeedbackFlags = { visible: [], suppressedCount: 0 };

// ─────────────────────────────────────────────────────────────────
// Ringside path — RingsideFeed -> RingsideCard -> PointFeedbackFlagsRow
// ─────────────────────────────────────────────────────────────────

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

function makeInput(viewModels: ArgumentBubbleViewModel[]): RingsideFeedInput {
  return {
    viewModels,
    viewerRole: 'participant',
    activeMessageId: viewModels[0]?.messageId ?? null,
    kindColorFamilyFor: () => 'claim',
    descendantCountFor: () => 0,
    parentMessageIdFor: () => null,
    proofChipCountFor: () => 0,
    owedReceiptFor: () => false,
    observerActionsFor: (actor) => getRailActions('observer', actor),
  };
}

function renderRingside(
  lifecycle: 'ready' | 'pending' | 'failed' | undefined,
  flags: PrioritizedPointFeedbackFlags = NO_FLAGS,
) {
  const vm = makeVm({ messageId: 'm-active', isActive: true });
  const input = makeInput([vm]);
  return render(
    <RingsideFeed
      feed={buildRingsideFeed(input)}
      viewerRole="participant"
      onActivate={() => {}}
      onActivateAncestor={() => {}}
      onCardAction={() => {}}
      onRailAction={() => {}}
      onOpenMap={() => {}}
      pointFeedbackFlags={flags}
      activePointLifecycleState={lifecycle}
      reduceMotion
    />,
  );
}

describe('UX-FLAGS-005 Ringside path — RingsideFeed -> RingsideCard -> row', () => {
  it('flags=[] + lifecycleState="pending" -> the pending line renders on the active card', () => {
    const { getByTestId } = renderRingside('pending', NO_FLAGS);
    const pending = getByTestId('point-feedback-flags-pending');
    expect(pending.props.children).toBe(POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY.pending);
  });

  it('flags=[] + lifecycleState="failed" -> the pending line does NOT render (silent)', () => {
    const { queryByTestId } = renderRingside('failed', NO_FLAGS);
    expect(queryByTestId('point-feedback-flags-pending')).toBeNull();
  });

  it('flags=[] + lifecycleState="ready" -> the pending line does NOT render', () => {
    const { queryByTestId } = renderRingside('ready', NO_FLAGS);
    expect(queryByTestId('point-feedback-flags-pending')).toBeNull();
  });

  it('flags=[] + lifecycleState omitted -> the pending line does NOT render (byte-identical)', () => {
    const { queryByTestId } = renderRingside(undefined, NO_FLAGS);
    expect(queryByTestId('point-feedback-flags-pending')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
// Stack (CardDetailPanel) path — the panel mounts the row on the
// active card. We render CardDetailPanel directly with a MINIMAL
// CardDetailViewModel to exercise the guard + prop forwarding.
// ─────────────────────────────────────────────────────────────────

const ACTIVE_ID = 'msg-active';

function makeStubCardDetailModel() {
  return buildCardDetailViewModel({
    activeMessageId: ACTIVE_ID,
    chronologicalIds: [ACTIVE_ID],
    ordinalOf: (id) => (id === ACTIVE_ID ? 1 : null),
    kindLabelOf: () => 'claim',
    parentIdOf: () => null,
    categoryLabel: null,
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

describe('UX-FLAGS-005 Stack path — CardDetailPanel mount guard', () => {
  it('flags=[] + lifecycleState="pending" -> the row mounts and shows the pending line', () => {
    const { getByTestId } = render(
      <CardDetailPanel
        model={makeStubCardDetailModel()}
        currentMessageBody="body"
        viewerRole="participant"
        pointFeedbackFlags={NO_FLAGS}
        lifecycleState="pending"
      />,
    );
    const pending = getByTestId('point-feedback-flags-pending');
    expect(pending.props.children).toBe(POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY.pending);
  });

  it('flags=[] + lifecycleState="failed" -> the row does NOT mount (guard closed; silent)', () => {
    const { queryByTestId } = render(
      <CardDetailPanel
        model={makeStubCardDetailModel()}
        currentMessageBody="body"
        viewerRole="participant"
        pointFeedbackFlags={NO_FLAGS}
        lifecycleState="failed"
      />,
    );
    expect(queryByTestId('point-feedback-flags-pending')).toBeNull();
    expect(queryByTestId('card-detail-feedback-flags')).toBeNull();
  });

  it('flags=[] + lifecycleState="ready" -> the row does NOT mount (byte-identical to shipped)', () => {
    const { queryByTestId } = render(
      <CardDetailPanel
        model={makeStubCardDetailModel()}
        currentMessageBody="body"
        viewerRole="participant"
        pointFeedbackFlags={NO_FLAGS}
        lifecycleState="ready"
      />,
    );
    expect(queryByTestId('point-feedback-flags-pending')).toBeNull();
    expect(queryByTestId('card-detail-feedback-flags')).toBeNull();
  });

  it('flags=[] + lifecycleState omitted -> the row does NOT mount (byte-identical)', () => {
    const { queryByTestId } = render(
      <CardDetailPanel
        model={makeStubCardDetailModel()}
        currentMessageBody="body"
        viewerRole="participant"
        pointFeedbackFlags={NO_FLAGS}
      />,
    );
    expect(queryByTestId('point-feedback-flags-pending')).toBeNull();
    expect(queryByTestId('card-detail-feedback-flags')).toBeNull();
  });

  it('non-empty flags + lifecycleState="pending" -> the row mounts with pills (pending suppressed by content-wins)', () => {
    const oneFlag: PrioritizedPointFeedbackFlags = {
      visible: [
        {
          id: 'nice_bridge',
          label: 'Nice bridge',
          helper: undefined,
          tone: 'positive',
          neverGrantsStanding: false,
          accessibilityLabel: 'Note, Nice bridge',
          family: 'parent_relation',
        },
      ],
      suppressedCount: 0,
    };
    const { getByTestId, queryByTestId } = render(
      <CardDetailPanel
        model={makeStubCardDetailModel()}
        currentMessageBody="body"
        viewerRole="participant"
        pointFeedbackFlags={oneFlag}
        lifecycleState="pending"
      />,
    );
    expect(getByTestId('card-detail-feedback-flags')).toBeTruthy();
    expect(queryByTestId('point-feedback-flags-pending')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
// Source-scan wiring — the ArgumentRoom.tsx orchestrator must:
//   1. import derivePointFeedbackFlagsLifecycleState
//   2. compute activePointLifecycleState from classifierLifecycleByArgumentId
//   3. pass lifecycleState to the Timeline PointFeedbackFlagsRow
//   4. pass activePointLifecycleState to ExchangeView
// The hook must include classifierLifecycleByArgumentId in its return.
// ─────────────────────────────────────────────────────────────────

const ROOT = path.join(__dirname, '..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('UX-FLAGS-005 source-scan wiring', () => {
  it('ArgumentRoom.tsx imports the pure discriminant', () => {
    const src = readSrc('src/features/arguments/room/ArgumentRoom.tsx');
    expect(src).toContain('derivePointFeedbackFlagsLifecycleState');
    expect(src).toContain('PointFeedbackFlagsLifecycleState');
  });

  it('ArgumentRoom.tsx computes activePointLifecycleState from classifierLifecycleByArgumentId', () => {
    const src = readSrc('src/features/arguments/room/ArgumentRoom.tsx');
    expect(src).toContain('const activePointLifecycleState');
    expect(src).toContain('classifierLifecycleByArgumentId');
    expect(src).toContain('hasVisibleFlags:');
  });

  it('ArgumentRoom.tsx passes lifecycleState to the Timeline PointFeedbackFlagsRow', () => {
    const src = readSrc('src/features/arguments/room/ArgumentRoom.tsx');
    expect(src).toContain('lifecycleState={activePointLifecycleState}');
  });

  it('ArgumentRoom.tsx passes activePointLifecycleState to ExchangeView (Ringside + Stack)', () => {
    const src = readSrc('src/features/arguments/room/ArgumentRoom.tsx');
    expect(src).toContain('activePointLifecycleState={activePointLifecycleState}');
  });

  it('useArgumentRoomMessages returns classifierLifecycleByArgumentId', () => {
    const src = readSrc('src/features/arguments/useArgumentRoomMessages.ts');
    expect(src).toContain('classifierLifecycleByArgumentId');
    expect(src).toContain('fetchClassifierLifecycleForArguments');
  });

  it('ArgumentTreeScreen hops classifierLifecycleByArgumentId from hook to room', () => {
    const src = readSrc('src/features/arguments/ArgumentTreeScreen.tsx');
    expect(src).toContain('classifierLifecycleByArgumentId');
  });

  it('ExchangeView forwards activePointLifecycleState to both lenses', () => {
    const src = readSrc('src/features/arguments/room/ExchangeView.tsx');
    // Prop declared.
    expect(src).toContain('activePointLifecycleState');
    // Forwarded to RingsideFeed (matches the JSX prop attribute we wrote).
    expect(src).toMatch(/activePointLifecycleState=\{props\.activePointLifecycleState\}/);
  });

  it('ArgumentBubbleStack forwards lifecycleState to the active card only', () => {
    const src = readSrc('src/features/arguments/ArgumentBubbleStack.tsx');
    expect(src).toContain('activePointLifecycleState');
    // Same gating as pointFeedbackFlags: only when t.isActive.
    expect(src).toContain('t.isActive ? activePointLifecycleState : undefined');
  });

  it('RingsideFeed forwards lifecycleState to the active card only', () => {
    const src = readSrc('src/features/arguments/room/RingsideFeed.tsx');
    expect(src).toContain('activePointLifecycleState');
    expect(src).toContain('card.isActive ? props.activePointLifecycleState : undefined');
  });

  it('RingsideCard passes lifecycleState prop to PointFeedbackFlagsRow', () => {
    const src = readSrc('src/features/arguments/room/RingsideCard.tsx');
    expect(src).toContain('lifecycleState={props.lifecycleState}');
  });

  it('CardDetailPanel relaxes the mount guard so pending can surface on empty flags', () => {
    const src = readSrc('src/features/arguments/cardView/CardDetailPanel.tsx');
    expect(src).toContain("lifecycleState === 'pending'");
  });

  it('No SERVER file is edited by UX-FLAGS-005 (supabase/functions untouched)', () => {
    // Symbol scan: the model + query files must NOT be imported from any
    // Edge Function. A grep for the new module names should find zero hits
    // under supabase/functions/**.
    const fnRoot = path.join(ROOT, 'supabase/functions');
    if (!fs.existsSync(fnRoot)) return; // no server tree in this checkout
    function scan(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(p);
          continue;
        }
        if (!entry.isFile()) continue;
        if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
        const src = fs.readFileSync(p, 'utf8');
        expect(src).not.toContain('pointFeedbackFlagsLifecycleModel');
        expect(src).not.toContain('pointFeedbackFlagsLifecycleQuery');
        expect(src).not.toContain('POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY');
      }
    }
    scan(fnRoot);
  });
});
