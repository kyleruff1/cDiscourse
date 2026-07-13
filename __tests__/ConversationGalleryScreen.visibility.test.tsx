/**
 * ARG-ROOM-006 (items a / e / f) — ConversationGalleryScreen renders the
 * public/private access badge + the plain-language access line from
 * deriveRoomAccessView, and reuses the shared action-label policy.
 *
 * Integration-mocked render. The deriver branches themselves are unit-tested in
 * roomAccessModel.test.ts; this proves the screen actually wires them.
 */
import React from 'react';
import { render, within } from '@testing-library/react-native';
import { ConversationGalleryScreen } from '../src/features/debates/ConversationGalleryScreen';
import type { Debate } from '../src/features/debates/types';
import { ROOM_ACCESS_COPY, ROOM_VISIBILITY_COPY } from '../src/features/arguments/gameCopy';

function debate(over: Partial<Debate> = {}): Debate {
  return {
    id: 'pub-1',
    createdBy: 'starter-1',
    title: 'Public room title',
    resolution: 'A public resolution',
    description: '',
    status: 'open',
    constitutionId: 'c-1',
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T01:00:00.000Z',
    myParticipantSide: null,
    visibility: 'public',
    ...over,
  };
}

function renderGallery(debates: Debate[], joinedDebateIds: string[] = []) {
  return render(
    <ConversationGalleryScreen
      debates={debates}
      joinedDebateIds={joinedDebateIds}
      currentUserId="viewer-1"
      loading={false}
      error={null}
      onRefresh={jest.fn()}
      onCreate={jest.fn(async () => null)}
      onJoin={jest.fn(async () => ({ ok: true }) as never)}
      onSelect={jest.fn()}
    />,
  );
}

describe('ConversationGalleryScreen — public card (items a / f)', () => {
  it('renders the "Public" badge + the public access line + Observe →', () => {
    const { getByTestId } = renderGallery([debate({ id: 'pub-1' })]);
    const badge = getByTestId('gallery-card-visibility-pub-1');
    expect(within(badge).getByText(ROOM_VISIBILITY_COPY.option_public_label)).toBeTruthy();

    const card = getByTestId('gallery-card-pub-1');
    expect(within(card).getByText(ROOM_ACCESS_COPY.public_open_line)).toBeTruthy();
    expect(within(card).getByText('Observe →')).toBeTruthy();
  });

  it('the badge carries a color-independent accessibility label', () => {
    const { getByTestId } = renderGallery([debate({ id: 'pub-1' })]);
    const badge = getByTestId('gallery-card-visibility-pub-1');
    expect(badge.props.accessibilityLabel).toBe(ROOM_VISIBILITY_COPY.option_public_helper);
  });
});

describe('ConversationGalleryScreen — private card the viewer is in (items b / f)', () => {
  it('renders the "Private" badge + the member line + Continue →', () => {
    const { getByTestId } = renderGallery(
      [debate({ id: 'priv-1', title: 'Private room title', visibility: 'private', myParticipantSide: 'affirmative' })],
      ['priv-1'],
    );
    const badge = getByTestId('gallery-card-visibility-priv-1');
    expect(within(badge).getByText(ROOM_VISIBILITY_COPY.option_private_label)).toBeTruthy();
    expect(badge.props.accessibilityLabel).toBe(ROOM_VISIBILITY_COPY.badge_private_a11y);

    const card = getByTestId('gallery-card-priv-1');
    expect(within(card).getByText(ROOM_ACCESS_COPY.private_member_line)).toBeTruthy();
    expect(within(card).getByText('Continue →')).toBeTruthy();
  });
});

describe('ConversationGalleryScreen — private card the viewer is NOT in (private_no_access; no enumeration)', () => {
  it('renders an EMPTY badge + never the "Private" label or a11y (a private room must not reveal it is private to a non-member)', () => {
    // A private card reaching a non-member's gallery — the RLS-bypass defense seam,
    // or a member whose join has not yet propagated into joinedDebateIds — must show
    // NO private chrome: empty badge text AND no "this argument is private" a11y.
    // (Pre-fix the pill fill + a11y came from raw visibility and re-leaked "private"
    // despite the empty badge text.)
    const { getByTestId } = renderGallery(
      [debate({ id: 'priv-x', title: 'Hidden private room', visibility: 'private', myParticipantSide: null })],
      [], // NOT joined → hasUserJoined false → private_no_access
    );
    const badge = getByTestId('gallery-card-visibility-priv-x');
    expect(within(badge).queryByText(ROOM_VISIBILITY_COPY.option_private_label)).toBeNull();
    expect(badge.props.accessibilityLabel).not.toBe(ROOM_VISIBILITY_COPY.badge_private_a11y);
    expect(badge.props.accessibilityLabel).toBe('');
  });

  it('renders NO access line (no false "may not work" hedge) for the openable-but-unjoined seam', () => {
    // UX-PR-G.2 (issue 922) — a private_no_access card that reaches the gallery
    // (admin/mod broad SELECT, or an unpropagated membership row) is openable by
    // construction; its access line is now empty, so it must render no hedge.
    const { queryByTestId } = renderGallery(
      [debate({ id: 'priv-x', title: 'Hidden private room', visibility: 'private', myParticipantSide: null })],
      [],
    );
    expect(queryByTestId('gallery-card-access-priv-x')).toBeNull();
  });

  it('a public card still renders its access line; no rendered line equals the deep-link hedge', () => {
    const { getByTestId, queryByTestId, queryByText } = renderGallery([
      debate({ id: 'pub-1', visibility: 'public' }),
      debate({ id: 'priv-x', visibility: 'private', myParticipantSide: null }),
    ]);
    // Public card keeps its honest line…
    expect(getByTestId('gallery-card-access-pub-1').props.children).toBe(
      ROOM_ACCESS_COPY.public_open_line,
    );
    // …the private-non-member card shows nothing…
    expect(queryByTestId('gallery-card-access-priv-x')).toBeNull();
    // …and the deep-link hedge string never appears as a gallery access line.
    expect(queryByText(ROOM_ACCESS_COPY.unavailable_body)).toBeNull();
  });
});

describe('ConversationGalleryScreen — card a11y label announces visibility', () => {
  it('the card Pressable accessibilityLabel begins with the visibility badge text', () => {
    const { getByTestId } = renderGallery([debate({ id: 'pub-1' })]);
    const card = getByTestId('gallery-card-pub-1');
    expect(String(card.props.accessibilityLabel).startsWith(ROOM_VISIBILITY_COPY.option_public_label)).toBe(
      true,
    );
  });
});
