/**
 * MARK-002 (#894) — flag-off byte-identity.
 *
 * With timestamp_rebuttals OFF the marker surface is absent: no Respond to this
 * affordance, no reply reference chip, no source-span highlight (the plain body
 * renders), no phrase picker, no Map-sidecar marker row. The proof is structural:
 * the flag-off Ringside render tree is byte-identical whether the marker props
 * arrive empty/undefined (the flag-off shape), and it DIFFERS from the flag-on
 * render (the negative control that keeps the assertion honest). Source-scans pin
 * that App.tsx + ArgumentRoom gate every marker surface on the flag.
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
import type { MarkerRow } from '../src/features/arguments/markers/timestampMarkerModel';

const TARGET_ID = 'target-1';
const REPLY_ID = 'reply-1';

function makeVm(over: Partial<ArgumentBubbleViewModel>): ArgumentBubbleViewModel {
  const actor: ArgumentBubbleActor = over.actor ?? 'other';
  return {
    messageId: over.messageId ?? 'm',
    ordinal: over.ordinal ?? 1,
    createdAtLabel: '2026-07-11 10:00',
    relativeLabel: '1m ago',
    body: over.body ?? 'A plain body.',
    kindLabel: 'claim',
    actor,
    sideLabel: 'Aff',
    isLatest: over.isLatest ?? false,
    isActive: over.isActive ?? false,
    parentHint: null,
    qualifierBadges: [],
    pointStandingHint: null,
    allowedControls: getBubbleControlsForActor(actor),
    deletionRequested: false,
  };
}

function makeInput(vms: ArgumentBubbleViewModel[]): RingsideFeedInput {
  return {
    viewModels: vms,
    viewerRole: 'participant',
    activeMessageId: null,
    kindColorFamilyFor: () => 'claim',
    descendantCountFor: () => 0,
    parentMessageIdFor: () => null,
    proofChipCountFor: () => 0,
    owedReceiptFor: () => false,
    observerActionsFor: (actor) => getRailActions('observer', actor),
  };
}

const FEED = buildRingsideFeed(
  makeInput([
    makeVm({ messageId: TARGET_ID, ordinal: 1, actor: 'other', body: 'Cars are bad.' }),
    makeVm({ messageId: REPLY_ID, ordinal: 2, actor: 'self', body: 'I disagree.', isLatest: true }),
  ]),
);

const REPLY_MARKER: MarkerRow = {
  id: 'marker-1',
  debate_id: 'd1',
  target_argument_id: TARGET_ID,
  reply_argument_id: REPLY_ID,
  created_by: 'u1',
  kind: 'rebuttal_anchor',
  span_start: 0,
  span_end: 4,
  span_unit: 'chars',
  quoted_text: 'Cars',
  created_at: '2026-07-11T00:00:00.000Z',
  deleted_at: null,
};

function baseProps() {
  return {
    feed: FEED,
    viewerRole: 'participant' as const,
    onActivate: () => undefined,
    onActivateAncestor: () => undefined,
    onCardAction: () => undefined,
    onRailAction: () => undefined,
    onOpenMap: () => undefined,
    pointFeedbackFlags: null,
  };
}

describe('MARK-002 flag-off — no marker surface', () => {
  it('renders no marker affordance / chip / highlight when the marker props are absent', () => {
    const { queryByTestId, getByTestId } = render(<RingsideFeed {...baseProps()} />);
    expect(queryByTestId(`ringside-respond-to-this-${TARGET_ID}`)).toBeNull();
    expect(queryByTestId(`ringside-marker-replies-${REPLY_ID}`)).toBeNull();
    expect(queryByTestId('timestamp-marker-reply-marker-1')).toBeNull();
    expect(queryByTestId('timestamp-marker-source-span-marker-1')).toBeNull();
    // The plain body still renders for both cards.
    expect(getByTestId(`ringside-body-${TARGET_ID}`)).toBeTruthy();
    expect(getByTestId(`ringside-body-${REPLY_ID}`)).toBeTruthy();
  });

  it('the flag-off render is byte-identical whether marker props are undefined or empty', () => {
    const undefinedProps = render(<RingsideFeed {...baseProps()} />).toJSON();
    const emptyProps = render(
      <RingsideFeed
        {...baseProps()}
        markersByTargetId={{}}
        markersByReplyId={{}}
        isMarkerTargetLoaded={() => true}
        onRespondToThis={undefined}
        onOpenMarkerSource={undefined}
      />,
    ).toJSON();
    // JSON.stringify drops the (necessarily distinct) handler function identities
    // and compares the render STRUCTURE: the two flag-off shapes are byte-identical.
    expect(JSON.stringify(emptyProps)).toEqual(JSON.stringify(undefinedProps));
  });

  it('NEGATIVE CONTROL: flag-on (markers + onRespondToThis present) DIFFERS from flag-off', () => {
    const flagOff = render(<RingsideFeed {...baseProps()} />).toJSON();
    const flagOn = render(
      <RingsideFeed
        {...baseProps()}
        markersByReplyId={{ [REPLY_ID]: [REPLY_MARKER] }}
        markersByTargetId={{ [TARGET_ID]: [REPLY_MARKER] }}
        isMarkerTargetLoaded={() => true}
        onRespondToThis={() => undefined}
        onOpenMarkerSource={() => undefined}
      />,
    );
    // Flag-on surfaces the affordance + reply chip that flag-off never renders.
    expect(flagOn.queryByTestId(`ringside-respond-to-this-${TARGET_ID}`)).toBeTruthy();
    expect(flagOn.queryByTestId('timestamp-marker-reply-marker-1')).toBeTruthy();
    expect(flagOn.toJSON()).not.toEqual(flagOff);
  });
});

describe('MARK-002 flag-off — source-scan pins the flag gate', () => {
  const ROOT = process.cwd();
  const APP = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
  const ROOM = fs.readFileSync(
    path.join(ROOT, 'src', 'features', 'arguments', 'room', 'ArgumentRoom.tsx'),
    'utf8',
  );

  it('App.tsx gates the composer scope + the picked-scope callback on timestampRebuttalsEnabled', () => {
    expect(APP).toContain('const timestampRebuttalsEnabled = isTimestampRebuttalsEnabled();');
    expect(APP).toMatch(/scopedMarker=\{timestampRebuttalsEnabled \? pendingMarkerScope : null\}/);
    expect(APP).toMatch(/onMarkerScopePicked=\{timestampRebuttalsEnabled \? handleMarkerScopePicked : undefined\}/);
  });

  it('ArgumentRoom gates the Respond-to-this + deep-link callbacks on the flag', () => {
    expect(ROOM).toMatch(/onRespondToThis=\{timestampRebuttalsEnabled \? handleRespondToThis : undefined\}/);
    expect(ROOM).toMatch(/onOpenMarkerSource=\{timestampRebuttalsEnabled \? handleOpenMarkerSource : undefined\}/);
    // useMarkers is gated by the flag boolean (fetches nothing when off).
    expect(ROOM).toMatch(/useMarkers\([\s\S]*?timestampRebuttalsEnabled === true,/);
  });
});
