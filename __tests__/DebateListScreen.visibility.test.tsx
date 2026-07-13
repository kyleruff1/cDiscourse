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
import { deriveGalleryActionLabel } from '../src/features/debates/roomAccessModel';

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

  it('a private row the viewer is NOT in renders NO access line (no false "may not work" hedge)', () => {
    // UX-PR-G.2 (issue 922) — private_no_access accessLine is now empty; the row
    // guards on it, so the hedge never renders for an openable-but-unjoined seam
    // (admin/mod broad SELECT or an unpropagated membership row). Public/member
    // rows are unchanged (their lines are non-empty — asserted above).
    const { queryByTestId, queryByText } = renderList([
      debate({ id: 'd-priv-x', visibility: 'private', myParticipantSide: null }),
      debate({ id: 'd-pub', visibility: 'public', myParticipantSide: null }),
    ]);
    expect(queryByTestId('debates-cell-access-d-priv-x')).toBeNull();
    // The public row still shows its honest line.
    expect(queryByTestId('debates-cell-access-d-pub')?.props.children).toBe(
      ROOM_ACCESS_COPY.public_open_line,
    );
    // The deep-link hedge string never appears as a list access line.
    expect(queryByText(ROOM_ACCESS_COPY.unavailable_body)).toBeNull();
  });
});

describe('route action-label consistency (#759)', () => {
  // The list row now routes its action label through the SHARED
  // deriveGalleryActionLabel policy (via accessView.actionLabel) so it can never
  // drift from the Conversation Gallery for the same access concept.

  it('PUBLIC + member → "Continue →" (was "Open →" before the fix)', () => {
    const { getByText } = renderList([
      debate({ id: 'd-m', visibility: 'public', status: 'open', myParticipantSide: 'affirmative' }),
    ]);
    expect(getByText('Continue →')).toBeTruthy();
    expect('Continue →').toBe(
      deriveGalleryActionLabel({ hasUserJoined: true, openStatus: 'open' }),
    );
  });

  it('PUBLIC + non-member + open → "Observe →" (unchanged; non-member equivalence)', () => {
    const { getByText } = renderList([
      debate({ id: 'd-o', visibility: 'public', status: 'open', myParticipantSide: null }),
    ]);
    expect(getByText('Observe →')).toBeTruthy();
    expect('Observe →').toBe(
      deriveGalleryActionLabel({ hasUserJoined: false, openStatus: 'open' }),
    );
  });

  it('PUBLIC + non-member + non-open → "Open →" (was "Observe →" before; corrected by the shared policy)', () => {
    const { getByText } = renderList([
      debate({ id: 'd-x', visibility: 'public', status: 'locked', myParticipantSide: null }),
    ]);
    expect(getByText('Open →')).toBeTruthy();
    expect('Open →').toBe(
      deriveGalleryActionLabel({ hasUserJoined: false, openStatus: 'locked' }),
    );
  });
});
