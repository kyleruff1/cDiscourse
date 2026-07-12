/**
 * UX-PR-B (#918) — ConversationGalleryScreen empty-state guard (P1-8).
 *
 * During the initial load an empty page is not yet "empty": the LoadingNotice
 * already shows. The `!loading` guard makes exactly ONE of LoadingNotice /
 * EmptyState render, never both.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ConversationGalleryScreen } from '../src/features/debates/ConversationGalleryScreen';
import type { Debate } from '../src/features/debates/types';

function renderGallery(loading: boolean) {
  return render(
    <ConversationGalleryScreen
      debates={[] as Debate[]}
      joinedDebateIds={[]}
      currentUserId="viewer-1"
      loading={loading}
      error={null}
      onRefresh={jest.fn()}
      onCreate={jest.fn(async () => null)}
      onJoin={jest.fn(async () => ({ ok: true }) as never)}
      onSelect={jest.fn()}
    />,
  );
}

const LOADING_TEXT = 'Loading rooms…';
const EMPTY_TITLE = 'No rooms found';

describe('ConversationGalleryScreen — UX-PR-B (#918) empty guard', () => {
  it('shows ONLY the LoadingNotice (not the EmptyState) during an empty initial load', () => {
    const { queryByText } = renderGallery(true);
    expect(queryByText(LOADING_TEXT)).toBeTruthy();
    expect(queryByText(EMPTY_TITLE)).toBeNull();
  });

  it('shows ONLY the EmptyState (not the LoadingNotice) once loading resolves empty', () => {
    const { queryByText } = renderGallery(false);
    expect(queryByText(EMPTY_TITLE)).toBeTruthy();
    expect(queryByText(LOADING_TEXT)).toBeNull();
  });
});
