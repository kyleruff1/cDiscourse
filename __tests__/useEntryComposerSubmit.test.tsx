/**
 * ROOM-003 (#829) — useEntryComposerSubmit hook.
 *
 * Proves the fast-path submit hook reuses the shipped dispatch order and the
 * shipped buildSubmitArgumentPayload: happy path (payload built + onSuccess),
 * failure path (server 422 -> serverErrors), and idempotent retry (the same
 * clientSubmissionId is reused when re-submitting an unchanged failed draft).
 */
import React from 'react';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/lib/edgeFunctions', () => ({
  ...jest.requireActual('../src/lib/edgeFunctions'),
  submitArgumentDraft: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { useEntryComposerSubmit } from '../src/features/arguments/composer/useEntryComposerSubmit';
import { submitArgumentDraft } from '../src/lib/edgeFunctions';
import type { ComposerDraft } from '../src/features/arguments/composerState';

const mockSubmit = submitArgumentDraft as jest.Mock;

function draft(overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    draftId: 'draft-1',
    debateId: 'debate-1',
    parentId: 'parent-1',
    argumentType: 'claim',
    side: 'affirmative',
    body: 'A body that is comfortably long enough to post.',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-07-08T00:00:00.000Z',
    dirty: true,
    ...overrides,
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppSessionProvider>{children}</AppSessionProvider>
);

describe('ROOM-003 useEntryComposerSubmit', () => {
  beforeEach(() => {
    mockSubmit.mockReset();
  });

  it('happy path — builds the payload via buildSubmitArgumentPayload and calls onSuccess', async () => {
    mockSubmit.mockResolvedValue({ ok: true, data: { argument: {}, tags: [], topic_satisfaction_check: null, flags: [], validation: {} } });
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useEntryComposerSubmit(onSuccess), { wrapper });

    await act(async () => {
      await result.current.submit(draft());
    });

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    const payload = mockSubmit.mock.calls[0][0];
    // The payload is the shipped wire shape (byte-shape contract keys).
    expect(payload).toMatchObject({
      debate_id: 'debate-1',
      parent_id: 'parent-1',
      argument_type: 'claim',
      side: 'affirmative',
      body: 'A body that is comfortably long enough to post.',
      selected_tag_codes: [],
    });
    expect(typeof payload.client_submission_id).toBe('string');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.serverErrors).toBeNull();
  });

  it('failure path — a server 422 with blocking errors surfaces serverErrors and does not call onSuccess', async () => {
    mockSubmit.mockResolvedValue({
      ok: false,
      status: 422,
      error: {
        error: 'validation_failed',
        blockingErrors: [
          { ruleCode: 'length_body', flagCode: 'excessive_length', severity: 'blocking', message: 'Too long.', payload: {} },
        ],
      },
    });
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useEntryComposerSubmit(onSuccess), { wrapper });

    await act(async () => {
      await result.current.submit(draft());
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.serverErrors).toEqual(['Too long.']);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('idempotent retry — re-submitting an unchanged failed draft reuses the same clientSubmissionId', async () => {
    mockSubmit.mockResolvedValue({
      ok: false,
      status: 500,
      error: { error: 'network_error' },
    });
    const { result } = renderHook(() => useEntryComposerSubmit(jest.fn()), { wrapper });
    const d = draft();

    await act(async () => {
      await result.current.submit(d);
    });
    await act(async () => {
      await result.current.submit(d);
    });

    expect(mockSubmit).toHaveBeenCalledTimes(2);
    const first = mockSubmit.mock.calls[0][0].client_submission_id;
    const second = mockSubmit.mock.calls[1][0].client_submission_id;
    expect(first).toBe(second);
  });
});
