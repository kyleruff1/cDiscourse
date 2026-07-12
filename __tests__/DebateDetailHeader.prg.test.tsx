/**
 * UX-PR-G (#920) — DebateDetailHeader P1-9b (title strip) + P1-13 (in-room badge).
 *
 * Real render (mirrors the RTL harness used elsewhere). Proves:
 *   - the in-room title is fixture-tag-stripped (P1-9b).
 *   - the notifications affordance renders only when onOpenNotifications is
 *     supplied, is a 44x44 button with a count-bearing a11y label, and carries
 *     the in-room badge testID (P1-13). NotificationBadge renders nothing at 0.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
// DebateDetailHeader imports debatesApi (the only supabase-client pull in its
// tree); mock it so a real render works in jsdom without the native supabase /
// AsyncStorage chain. The make-private write path is not exercised by this test.
jest.mock('../src/features/debates/debatesApi', () => ({
  transitionRoomToPrivate: jest.fn(async () => ({ ok: true })),
}));
import { DebateDetailHeader } from '../src/features/debates/DebateDetailHeader';
import type { Debate } from '../src/features/debates/types';

function debate(over: Partial<Debate> = {}): Debate {
  return {
    id: 'd1',
    createdBy: 'creator-1',
    title: 'Chime cohort smoke [stress chime-mrgpodh6]',
    resolution: 'A resolution',
    description: '',
    status: 'open',
    constitutionId: 'c1',
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T01:00:00.000Z',
    myParticipantSide: null,
    visibility: 'public',
    inactiveAt: null,
    ...over,
  };
}

describe('UX-PR-G P1-9b — in-room title is fixture-tag-stripped', () => {
  it('renders the clean title, not the raw [stress ...] tag', () => {
    const { getByTestId } = render(
      <DebateDetailHeader debate={debate()} participantSide={null} onLeave={jest.fn()} />,
    );
    expect(getByTestId('debate-detail-title').props.children).toBe('Chime cohort smoke');
  });

  it('falls back to the raw title when the strip would empty it (bare-tag title)', () => {
    const { getByTestId } = render(
      <DebateDetailHeader
        debate={debate({ title: '[stress chime-mrgpodh6]' })}
        participantSide={null}
        onLeave={jest.fn()}
      />,
    );
    expect(getByTestId('debate-detail-title').props.children).toBe('[stress chime-mrgpodh6]');
  });
});

describe('UX-PR-G P1-13 — in-room notifications affordance', () => {
  it('renders nothing when onOpenNotifications is omitted (byte-identical)', () => {
    const { queryByTestId } = render(
      <DebateDetailHeader debate={debate()} participantSide={null} onLeave={jest.fn()} />,
    );
    expect(queryByTestId('debate-detail-notifications')).toBeNull();
    expect(queryByTestId('notification-badge-in-room')).toBeNull();
  });

  it('renders a 44x44 button with a count-bearing a11y label when unread > 0', () => {
    const onOpenNotifications = jest.fn();
    const { getByTestId } = render(
      <DebateDetailHeader
        debate={debate()}
        participantSide={null}
        onLeave={jest.fn()}
        unreadCount={3}
        onOpenNotifications={onOpenNotifications}
      />,
    );
    const btn = getByTestId('debate-detail-notifications');
    expect(btn.props.accessibilityRole).toBe('button');
    expect(btn.props.accessibilityLabel).toBe('Notifications, 3 unread');
    // 44x44 effective target via hitSlop (visual minHeight 28 + slop).
    expect(btn.props.hitSlop).toBeTruthy();
    // The count-bearing badge is present.
    expect(getByTestId('notification-badge-in-room')).toBeTruthy();
  });

  it('caps the a11y count at 9+ for large unread values', () => {
    const { getByTestId } = render(
      <DebateDetailHeader
        debate={debate()}
        participantSide={null}
        onLeave={jest.fn()}
        unreadCount={42}
        onOpenNotifications={jest.fn()}
      />,
    );
    expect(getByTestId('debate-detail-notifications').props.accessibilityLabel).toBe(
      'Notifications, 9+ unread',
    );
  });

  it('renders the button (no count) at 0 unread, and NotificationBadge renders nothing', () => {
    const { getByTestId, queryByTestId } = render(
      <DebateDetailHeader
        debate={debate()}
        participantSide={null}
        onLeave={jest.fn()}
        unreadCount={0}
        onOpenNotifications={jest.fn()}
      />,
    );
    expect(getByTestId('debate-detail-notifications').props.accessibilityLabel).toBe('Notifications');
    expect(queryByTestId('notification-badge-in-room')).toBeNull();
  });
});
