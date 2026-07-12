/**
 * UX-PR-G (#920) P1-9a — ConversationGalleryScreen fixture-room exclusion.
 *
 * Non-admin viewers get fixture / bot / corpus / reseed rooms EXCLUDED from the
 * gallery (they were leaking into discovery). Admins keep them visible. The raw
 * fixture tag never renders in a card title (stripped by cleanTitleForDedupe).
 * Mirrors the shipped homeModel fixture-exclusion contract.
 */
import React from 'react';
import { render, within } from '@testing-library/react-native';
import { ConversationGalleryScreen } from '../src/features/debates/ConversationGalleryScreen';
import type { Debate } from '../src/features/debates/types';

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
    inactiveAt: null,
    ...over,
  };
}

const NORMAL = debate({ id: 'pub-1', title: 'Should cities expand bike lanes?' });
const FIXTURE = debate({ id: 'fix-1', title: 'Chime cohort smoke [stress chime-mrgpodh6]' });

function renderGallery(isAdminViewer?: boolean) {
  return render(
    <ConversationGalleryScreen
      debates={[NORMAL, FIXTURE]}
      isAdminViewer={isAdminViewer}
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

describe('UX-PR-G P1-9a — gallery excludes fixtures for non-admins', () => {
  it('a non-admin does NOT see the fixture room, but sees the normal room', () => {
    const { queryByTestId } = renderGallery(false);
    expect(queryByTestId('gallery-card-pub-1')).not.toBeNull();
    expect(queryByTestId('gallery-card-fix-1')).toBeNull();
  });

  it('a viewer with no admin flag (default) also excludes the fixture room', () => {
    const { queryByTestId } = renderGallery(undefined);
    expect(queryByTestId('gallery-card-pub-1')).not.toBeNull();
    expect(queryByTestId('gallery-card-fix-1')).toBeNull();
  });

  it('an admin KEEPS the fixture room visible', () => {
    const { queryByTestId } = renderGallery(true);
    expect(queryByTestId('gallery-card-pub-1')).not.toBeNull();
    expect(queryByTestId('gallery-card-fix-1')).not.toBeNull();
  });

  it('the fixture card title is tag-stripped (no raw [stress ...]) even for admins', () => {
    const { getByTestId } = renderGallery(true);
    const card = getByTestId('gallery-card-fix-1');
    // The stripped title renders exactly; the raw-tagged form would fail this
    // exact-match query, so its presence proves the tag was stripped.
    expect(within(card).getByText('Chime cohort smoke')).toBeTruthy();
  });
});
