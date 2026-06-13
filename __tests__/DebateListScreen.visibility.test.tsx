/**
 * ARG-ROOM-006 (items a / e / f) — DebateListScreen row parity with the gallery:
 * each row shows the public/private access badge + the plain-language access
 * line from deriveRoomAccessView.
 */
import React from 'react';
import { render, within } from '@testing-library/react-native';
import { DebateListScreen } from '../src/features/debates/DebateListScreen';
import type { Debate } from '../src/features/debates/types';
import { ROOM_ACCESS_COPY, ROOM_VISIBILITY_COPY } from '../src/features/arguments/gameCopy';

function debate(over: Partial<Debate> = {}): Debate {
  return {
    id: 'd-pub',
    createdBy: 'starter-1',
    title: 'A room',
    resolution: 'A resolution',
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

function renderList(debates: Debate[]) {
  return render(
    <DebateListScreen
      debates={debates}
      loading={false}
      error={null}
      onRefresh={jest.fn()}
      onCreate={jest.fn(async () => null)}
      onJoin={jest.fn(async () => ({ ok: true }) as never)}
      onSelect={jest.fn()}
    />,
  );
}

describe('DebateListScreen — visibility badge + access line', () => {
  it('a public row shows the Public badge + public access line', () => {
    const { getByTestId } = renderList([debate({ id: 'd-pub', visibility: 'public' })]);
    const badge = getByTestId('debates-cell-visibility-d-pub');
    expect(within(badge).getByText(ROOM_VISIBILITY_COPY.option_public_label)).toBeTruthy();
    expect(badge.props.accessibilityLabel).toBe(ROOM_VISIBILITY_COPY.option_public_helper);
    expect(getByTestId('debates-cell-access-d-pub').props.children).toBe(ROOM_ACCESS_COPY.public_open_line);
  });

  it('a private row the viewer is in shows the Private badge + member line', () => {
    const { getByTestId } = renderList([
      debate({ id: 'd-priv', visibility: 'private', myParticipantSide: 'affirmative' }),
    ]);
    const badge = getByTestId('debates-cell-visibility-d-priv');
    expect(within(badge).getByText(ROOM_VISIBILITY_COPY.option_private_label)).toBeTruthy();
    expect(badge.props.accessibilityLabel).toBe(ROOM_VISIBILITY_COPY.badge_private_a11y);
    expect(getByTestId('debates-cell-access-d-priv').props.children).toBe(
      ROOM_ACCESS_COPY.private_member_line,
    );
  });

  it('a private row the viewer is NOT in renders an EMPTY badge + never the Private a11y (no enumeration)', () => {
    // private_no_access (non-member) must not paint the private pill or announce
    // "this argument is private" — it sources chrome from the access view, not raw
    // visibility (matches the empty badge).
    const { getByTestId } = renderList([
      debate({ id: 'd-priv-x', visibility: 'private', myParticipantSide: null }),
    ]);
    const badge = getByTestId('debates-cell-visibility-d-priv-x');
    expect(within(badge).queryByText(ROOM_VISIBILITY_COPY.option_private_label)).toBeNull();
    expect(badge.props.accessibilityLabel).not.toBe(ROOM_VISIBILITY_COPY.badge_private_a11y);
    expect(badge.props.accessibilityLabel).toBe('');
  });
});
