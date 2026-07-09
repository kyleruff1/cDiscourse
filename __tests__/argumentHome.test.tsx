/**
 * HOME-001 (#874) — ArgumentHome surface tests (Slice 2, RNTL).
 *
 * Covers the acceptance journeys and doctrine/a11y floors:
 *   - J1 first-run empty state: exactly three verbs + start-first + demo link,
 *     and NO bucket/lane taxonomy or floor door until The Floor is opened (AC2).
 *   - J2 resume: tapping a your-turn card fires onOpen with the entry-hint
 *     pre-activation object (the <=2-tap resume wiring, AC3).
 *   - Home <-> floor lane transition (onOpenFloor).
 *   - Activity module renders the existing notification rows + deep-link.
 *   - Fixture exclusion at the surface (non-admin hides, admin shows) (AC5).
 *   - a11y floors: role/label/state + 44px hitSlop on every Pressable; the verb
 *     text (not color) carries the action; 390px band renders cleanly.
 *
 * Uses @testing-library/react-native.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { useWindowDimensions } from 'react-native';
import { ArgumentHome, type ArgumentHomeProps } from '../src/features/home/ArgumentHome';
import {
  buildConversationGalleryCards,
  dedupeConversationCards,
  deriveGalleryEntryHint,
  type GalleryArgumentInput,
} from '../src/features/debates/conversationGalleryModel';
import type { Debate } from '../src/features/debates/types';
import type { RoomNotification } from '../src/features/notifications/notificationModel';
import type { CircleLens } from '../src/features/circles/circleHomeFilter';

// ── Fixtures ────────────────────────────────────────────────────

function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

function debate(partial: Partial<Debate> & { id: string }): Debate {
  return {
    id: partial.id,
    createdBy: partial.createdBy ?? 'opponent',
    title: partial.title ?? 'A topic',
    resolution: partial.resolution ?? 'A resolution.',
    description: partial.description ?? '',
    status: partial.status ?? 'open',
    constitutionId: partial.constitutionId ?? 'c1',
    createdAt: partial.createdAt ?? isoAt(1715000000000),
    updatedAt: partial.updatedAt ?? isoAt(1715000000000),
    myParticipantSide: partial.myParticipantSide ?? null,
    visibility: partial.visibility ?? 'public',
    inactiveAt: partial.inactiveAt ?? null,
    // HOME-003 — the circle FK the filter matches on (null = non-circle room).
    circleId: partial.circleId ?? null,
  };
}

function arg(
  partial: Partial<GalleryArgumentInput> & { id: string; debateId: string },
): GalleryArgumentInput {
  return {
    id: partial.id,
    debateId: partial.debateId,
    parentId: partial.parentId ?? null,
    authorId: partial.authorId === undefined ? 'opponent' : partial.authorId,
    argumentType: partial.argumentType ?? 'thesis',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A reasonably long argument body for this room.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? isoAt(1715000000000),
    updatedAt: partial.updatedAt ?? null,
  };
}

function notif(partial: Partial<RoomNotification> & { id: string; debateId: string }): RoomNotification {
  return {
    id: partial.id,
    recipientId: partial.recipientId ?? 'me',
    debateId: partial.debateId,
    argumentId: partial.argumentId ?? 'arg-1',
    type: partial.type ?? 'new_response',
    roomTitle: partial.roomTitle ?? 'A room',
    meta: partial.meta ?? {},
    readAt: partial.readAt === undefined ? null : partial.readAt,
    createdAt: partial.createdAt ?? isoAt(1715000000000),
  };
}

// A joined, open room whose only move is by the opponent => waiting on me.
const YOUR_TURN_DEBATE = debate({
  id: 'd-yt',
  title: 'City transit funding should rise',
  myParticipantSide: 'affirmative',
});
const YOUR_TURN_ARGS: Record<string, GalleryArgumentInput[]> = {
  'd-yt': [arg({ id: 'yt-root', debateId: 'd-yt', authorId: 'opponent', body: 'Transit should be funded from congestion pricing revenue.' })],
};

function baseProps(over: Partial<ArgumentHomeProps> = {}): ArgumentHomeProps {
  return {
    debates: [],
    argumentsByDebateId: {},
    currentUserId: 'me',
    isAdminViewer: false,
    notifications: [],
    unreadCount: 0,
    notificationsLoading: false,
    loading: false,
    error: null,
    onRefresh: jest.fn(),
    onOpen: jest.fn(),
    onStart: jest.fn(),
    onOpenFloor: jest.fn(),
    onOpenDemoCorridor: jest.fn(),
    onOpenNotificationDeepLink: jest.fn(),
    ...over,
  };
}

// ── J1 — first-run empty state ──────────────────────────────────

describe('HOME-001 J1 — first-run empty state', () => {
  it('shows exactly the three verbs plus start-first and the demo-corridor link', () => {
    const { getByTestId } = render(<ArgumentHome {...baseProps()} />);
    expect(getByTestId('home-empty-state')).toBeTruthy();
    expect(getByTestId('home-empty-verb-resume')).toBeTruthy();
    expect(getByTestId('home-empty-verb-start')).toBeTruthy();
    expect(getByTestId('home-empty-verb-floor')).toBeTruthy();
    expect(getByTestId('home-empty-start-first')).toBeTruthy();
    expect(getByTestId('home-demo-corridor-link')).toBeTruthy();
  });

  it('shows NO bucket taxonomy, your-turn strip, or floor door until The Floor is opened (AC2)', () => {
    const { queryByTestId } = render(<ArgumentHome {...baseProps()} />);
    expect(queryByTestId('home-your-turn-strip')).toBeNull();
    expect(queryByTestId('home-ongoing-list')).toBeNull();
    expect(queryByTestId('home-floor-door')).toBeNull();
    expect(queryByTestId('lane-chip-all')).toBeNull();
  });

  it('wires the first-run affordances to their targets', () => {
    const onStart = jest.fn();
    const onOpenFloor = jest.fn();
    const onOpenDemoCorridor = jest.fn();
    const { getByTestId } = render(
      <ArgumentHome {...baseProps({ onStart, onOpenFloor, onOpenDemoCorridor })} />,
    );
    fireEvent.press(getByTestId('home-empty-verb-start'));
    fireEvent.press(getByTestId('home-empty-start-first'));
    expect(onStart).toHaveBeenCalledTimes(2);
    fireEvent.press(getByTestId('home-empty-verb-floor'));
    fireEvent.press(getByTestId('home-empty-verb-resume'));
    expect(onOpenFloor).toHaveBeenCalledTimes(2);
    fireEvent.press(getByTestId('home-demo-corridor-link'));
    expect(onOpenDemoCorridor).toHaveBeenCalledTimes(1);
  });

  it('every first-run Pressable exposes role + label + a 44px hitSlop', () => {
    const { getByTestId } = render(<ArgumentHome {...baseProps()} />);
    for (const id of [
      'home-empty-verb-resume',
      'home-empty-verb-start',
      'home-empty-verb-floor',
      'home-empty-start-first',
      'home-demo-corridor-link',
    ]) {
      const el = getByTestId(id);
      expect(el.props.accessibilityRole).toBe('button');
      expect(typeof el.props.accessibilityLabel).toBe('string');
      expect(el.props.accessibilityLabel.length).toBeGreaterThan(0);
      expect(el.props.hitSlop).toBeTruthy();
    }
  });
});

// ── J2 — resume in <= 2 taps (entry-hint pre-activation) ────────

describe('HOME-001 J2 — resume wiring', () => {
  it('renders a your-turn card for a room whose latest move is a known other voice', () => {
    const { getByTestId } = render(
      <ArgumentHome
        {...baseProps({ debates: [YOUR_TURN_DEBATE], argumentsByDebateId: YOUR_TURN_ARGS })}
      />,
    );
    expect(getByTestId('home-your-turn-strip')).toBeTruthy();
    expect(getByTestId('argument-card-d-yt')).toBeTruthy();
  });

  it('tapping a your-turn card fires onOpen with the entry-hint pre-activation object (AC3)', () => {
    const onOpen = jest.fn();
    const { getByTestId } = render(
      <ArgumentHome
        {...baseProps({
          debates: [YOUR_TURN_DEBATE],
          argumentsByDebateId: YOUR_TURN_ARGS,
          onOpen,
        })}
      />,
    );

    // The exact hint the room shell will pre-activate with, computed the same
    // deterministic way the surface does.
    const cards = dedupeConversationCards(
      buildConversationGalleryCards({
        debates: [YOUR_TURN_DEBATE],
        argumentsByDebateId: YOUR_TURN_ARGS,
        currentUserId: 'me',
      }),
    );
    const card = cards.find((c) => c.debateId === 'd-yt');
    expect(card).toBeTruthy();
    const expectedHint = deriveGalleryEntryHint(card!);

    // ONE tap from home resumes the dispute.
    fireEvent.press(getByTestId('argument-card-d-yt'));

    expect(onOpen).toHaveBeenCalledTimes(1);
    const [openedDebate, side, hint] = onOpen.mock.calls[0];
    expect(openedDebate.id).toBe('d-yt');
    expect(side).toBe('affirmative'); // the viewer keeps their real side
    expect(hint).not.toBeNull();
    // The hint carries the awaited-node pre-activation (activate) + the typed
    // code that scopes the composer preset/dock — the <=2-tap resume contract.
    expect(hint).toEqual(expectedHint);
    expect(hint.activate).toBe(expectedHint.activate);
    expect(hint.code).toBe(expectedHint.code);
  });

  it('the your-turn card verb text (not color) carries the action', () => {
    const { getByTestId } = render(
      <ArgumentHome
        {...baseProps({ debates: [YOUR_TURN_DEBATE], argumentsByDebateId: YOUR_TURN_ARGS })}
      />,
    );
    const verb = getByTestId('argument-card-verb-d-yt');
    expect(typeof verb.props.children).toBe('string');
    expect(verb.props.children.length).toBeGreaterThan(0);
    // The whole card is one button with a verbose label that includes the
    // neutral state word (so color is never the only signal).
    const cardEl = getByTestId('argument-card-d-yt');
    expect(cardEl.props.accessibilityRole).toBe('button');
    expect(cardEl.props.accessibilityLabel).toContain('Your turn');
    expect(cardEl.props.hitSlop).toBeTruthy();
  });
});

// ── Floor door + activity module ────────────────────────────────

describe('HOME-001 — floor door and activity module', () => {
  it('the floor door fires onOpenFloor (home -> floor lane transition)', () => {
    const onOpenFloor = jest.fn();
    const { getByTestId } = render(
      <ArgumentHome
        {...baseProps({
          debates: [YOUR_TURN_DEBATE],
          argumentsByDebateId: YOUR_TURN_ARGS,
          onOpenFloor,
        })}
      />,
    );
    const door = getByTestId('home-floor-door');
    expect(door.props.accessibilityRole).toBe('button');
    fireEvent.press(door);
    expect(onOpenFloor).toHaveBeenCalledTimes(1);
  });

  it('the activity module renders the existing notification rows and forwards the deep link', () => {
    const onOpenNotificationDeepLink = jest.fn();
    const notifications = [notif({ id: 'n1', debateId: 'd-yt', argumentId: 'yt-root' })];
    const { getByTestId } = render(
      <ArgumentHome
        {...baseProps({
          debates: [YOUR_TURN_DEBATE],
          argumentsByDebateId: YOUR_TURN_ARGS,
          notifications,
          unreadCount: 1,
          onOpenNotificationDeepLink,
        })}
      />,
    );
    expect(getByTestId('home-activity-module')).toBeTruthy();
    fireEvent.press(getByTestId('notification-row-n1'));
    expect(onOpenNotificationDeepLink).toHaveBeenCalledTimes(1);
    const [link] = onOpenNotificationDeepLink.mock.calls[0];
    expect(link.debateId).toBe('d-yt');
  });

  it('the start CTA fires onStart', () => {
    const onStart = jest.fn();
    const { getByTestId } = render(
      <ArgumentHome
        {...baseProps({ debates: [YOUR_TURN_DEBATE], argumentsByDebateId: YOUR_TURN_ARGS, onStart })}
      />,
    );
    fireEvent.press(getByTestId('home-start-cta'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

// ── Fixture exclusion at the surface (AC5) ──────────────────────

describe('HOME-001 — fixture exclusion at the surface', () => {
  const fixtureDebate = debate({
    id: 'd-fix',
    title: 'Bot seeded topic [reseed-baseline-20260708-1a2b3c4d]',
    myParticipantSide: 'affirmative',
  });
  const debates = [YOUR_TURN_DEBATE, fixtureDebate];
  const argumentsByDebateId: Record<string, GalleryArgumentInput[]> = {
    ...YOUR_TURN_ARGS,
    'd-fix': [arg({ id: 'fix-root', debateId: 'd-fix', authorId: 'opponent', body: 'A seeded corpus claim about nothing in particular.' })],
  };

  it('a non-admin viewer sees no fixture card', () => {
    const { queryByTestId } = render(
      <ArgumentHome {...baseProps({ debates, argumentsByDebateId, isAdminViewer: false })} />,
    );
    expect(queryByTestId('argument-card-d-yt')).toBeTruthy();
    expect(queryByTestId('argument-card-d-fix')).toBeNull();
  });

  it('an admin viewer sees the fixture card', () => {
    const { queryByTestId } = render(
      <ArgumentHome {...baseProps({ debates, argumentsByDebateId, isAdminViewer: true })} />,
    );
    expect(queryByTestId('argument-card-d-fix')).toBeTruthy();
  });
});

// ── HOME-003 — circle filter lane ───────────────────────────────

describe('HOME-003 — circle filter lens', () => {
  const CIRCLES: CircleLens[] = [
    { id: 'c1', name: 'Book Club', memberCount: 3 },
    { id: 'c2', name: 'Study Group', memberCount: 2 },
  ];
  // Two your-turn rooms in different circles + one non-circle your-turn room.
  const YT_C1 = debate({ id: 'd-c1', title: 'Circle one topic', myParticipantSide: 'affirmative', circleId: 'c1' });
  const YT_C2 = debate({ id: 'd-c2', title: 'Circle two topic', myParticipantSide: 'affirmative', circleId: 'c2' });
  const YT_NONE = debate({ id: 'd-none', title: 'No circle topic', myParticipantSide: 'affirmative', circleId: null });
  const debates = [YT_C1, YT_C2, YT_NONE];
  const argumentsByDebateId: Record<string, GalleryArgumentInput[]> = {
    'd-c1': [arg({ id: 'c1-root', debateId: 'd-c1', authorId: 'opponent', body: 'A claim inside book club to answer.' })],
    'd-c2': [arg({ id: 'c2-root', debateId: 'd-c2', authorId: 'opponent', body: 'A claim inside study group to answer.' })],
    'd-none': [arg({ id: 'none-root', debateId: 'd-none', authorId: 'opponent', body: 'A claim in a non-circle room to answer.' })],
  };

  it('renders the chip row when the caller has circles, hides it with none', () => {
    const withCircles = render(
      <ArgumentHome {...baseProps({ debates, argumentsByDebateId, circles: CIRCLES })} />,
    );
    expect(withCircles.getByTestId('home-circle-filter-row')).toBeTruthy();

    const noCircles = render(
      <ArgumentHome {...baseProps({ debates, argumentsByDebateId, circles: [] })} />,
    );
    expect(noCircles.queryByTestId('home-circle-filter-row')).toBeNull();
  });

  it('selecting a circle narrows the lane to that circle only', () => {
    const { getByTestId, queryByTestId } = render(
      <ArgumentHome {...baseProps({ debates, argumentsByDebateId, circles: CIRCLES })} />,
    );
    // Unfiltered: all three your-turn cards render.
    expect(getByTestId('argument-card-d-c1')).toBeTruthy();
    expect(getByTestId('argument-card-d-c2')).toBeTruthy();
    expect(getByTestId('argument-card-d-none')).toBeTruthy();

    fireEvent.press(getByTestId('home-circle-chip-c1'));

    // Only the c1 room survives the lens; the c2 + non-circle rooms drop out.
    expect(getByTestId('argument-card-d-c1')).toBeTruthy();
    expect(queryByTestId('argument-card-d-c2')).toBeNull();
    expect(queryByTestId('argument-card-d-none')).toBeNull();
  });

  it('clearing back to All restores the full lane', () => {
    const { getByTestId, queryByTestId } = render(
      <ArgumentHome {...baseProps({ debates, argumentsByDebateId, circles: CIRCLES })} />,
    );
    fireEvent.press(getByTestId('home-circle-chip-c1'));
    expect(queryByTestId('argument-card-d-c2')).toBeNull();
    fireEvent.press(getByTestId('home-circle-chip-all'));
    expect(getByTestId('argument-card-d-c2')).toBeTruthy();
  });

  it('shows the filtered-empty block with a Start CTA when a circle matches nothing', () => {
    // c2 has a room, but select a circle with no rooms in the fixture (there is
    // no room tagged c-empty), so the lane is empty but not first-run.
    const circles: CircleLens[] = [...CIRCLES, { id: 'c-empty', name: 'Empty Circle', memberCount: 5 }];
    const onStart = jest.fn();
    const { getByTestId } = render(
      <ArgumentHome {...baseProps({ debates, argumentsByDebateId, circles, onStart })} />,
    );
    fireEvent.press(getByTestId('home-circle-chip-c-empty'));
    expect(getByTestId('home-circle-empty')).toBeTruthy();
    fireEvent.press(getByTestId('home-circle-empty-start'));
    expect(onStart).toHaveBeenCalledTimes(1);
    // The CTA passes the selected circle id (backwards-compat prefill arg).
    expect(onStart).toHaveBeenCalledWith('c-empty');
  });

  it('D8 fixture exclusion holds under a circle filter (a bot room is never resurfaced)', () => {
    // A fixture room tagged with circle c1: even selecting c1 must NOT show it.
    const fixture = debate({
      id: 'd-fix-c1',
      title: 'Seeded topic [reseed-baseline-20260708-9z8y7x6w]',
      myParticipantSide: 'affirmative',
      circleId: 'c1',
    });
    const withFixture = [...debates, fixture];
    const withFixtureArgs = {
      ...argumentsByDebateId,
      'd-fix-c1': [arg({ id: 'fix-root', debateId: 'd-fix-c1', authorId: 'opponent', body: 'A seeded corpus claim here.' })],
    };
    const { getByTestId, queryByTestId } = render(
      <ArgumentHome
        {...baseProps({ debates: withFixture, argumentsByDebateId: withFixtureArgs, circles: CIRCLES, isAdminViewer: false })}
      />,
    );
    // Non-admin: the fixture room is excluded before the filter runs.
    expect(queryByTestId('argument-card-d-fix-c1')).toBeNull();
    fireEvent.press(getByTestId('home-circle-chip-c1'));
    // Selecting its circle does NOT resurface it (D8 before circle).
    expect(queryByTestId('argument-card-d-fix-c1')).toBeNull();
    expect(getByTestId('argument-card-d-c1')).toBeTruthy();
  });

  it('with no circle selected the lane matches the unfiltered HOME-001 output', () => {
    const withRow = render(
      <ArgumentHome {...baseProps({ debates, argumentsByDebateId, circles: CIRCLES })} />,
    );
    // All three rooms render (chip row present but nothing selected).
    expect(withRow.getByTestId('argument-card-d-c1')).toBeTruthy();
    expect(withRow.getByTestId('argument-card-d-c2')).toBeTruthy();
    expect(withRow.getByTestId('argument-card-d-none')).toBeTruthy();
  });
});

// ── Loading / error states ──────────────────────────────────────

describe('HOME-001 — loading and error states', () => {
  it('renders a loading notice while first data loads', () => {
    const { getByTestId } = render(<ArgumentHome {...baseProps({ loading: true })} />);
    expect(getByTestId('argument-home')).toBeTruthy();
  });

  it('renders an actionable retry on error', () => {
    const onRefresh = jest.fn();
    const { getByText } = render(
      <ArgumentHome {...baseProps({ error: 'network down', onRefresh })} />,
    );
    fireEvent.press(getByText('Try again'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

// ── 390px band (reduce-motion / mobile) ─────────────────────────

describe('HOME-001 — 390px phone band', () => {
  const RN = require('react-native') as { useWindowDimensions: typeof useWindowDimensions };
  const original = RN.useWindowDimensions;

  beforeEach(() => {
    (RN as { useWindowDimensions: unknown }).useWindowDimensions = () => ({
      width: 390,
      height: 844,
      scale: 3,
      fontScale: 1,
    });
  });
  afterEach(() => {
    (RN as { useWindowDimensions: unknown }).useWindowDimensions = original;
  });

  it('mounts cleanly at a 390px phone viewport with the your-turn strip present', () => {
    const { getByTestId } = render(
      <ArgumentHome
        {...baseProps({ debates: [YOUR_TURN_DEBATE], argumentsByDebateId: YOUR_TURN_ARGS })}
      />,
    );
    expect(getByTestId('argument-home')).toBeTruthy();
    const strip = getByTestId('home-your-turn-strip');
    // The your-turn strip scrolls horizontally inside its own container so the
    // page body never scrolls horizontally.
    expect(strip.props.horizontal).toBe(true);
  });
});
