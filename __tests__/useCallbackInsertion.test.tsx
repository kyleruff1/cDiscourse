/**
 * UX-COMPOSER-005 (#831) — useCallbackInsertion orchestration.
 *
 * Drives the capture flow with mocked caller-scoped APIs: open the picker,
 * pick a room (loads readable moves), capture a line (writes pendingCallback),
 * and the empty/locked branch (INV-1: no readable move => no excerpt), plus the
 * post-success link create.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../src/features/arguments/crossRoom/argumentRoomLinksApi', () => ({
  listLinkTargetCandidates: jest.fn(),
  loadCurrentRoomCircleId: jest.fn(),
  createArgumentRoomLink: jest.fn(),
}));
jest.mock('../src/features/arguments/argumentsApi', () => ({
  listArgumentsForDebate: jest.fn(),
}));
jest.mock('../src/features/arguments/crossRoom/linkTargetPickerModel', () => ({
  ...jest.requireActual('../src/features/arguments/crossRoom/linkTargetPickerModel'),
  buildLinkTargetPickerModel: jest.fn(() => ({
    sameCircle: [{ debateId: 'debate-prior-1', title: 'Bike-lane baseline' }],
    other: [],
    moreNotShown: false,
    isEmpty: false,
  })),
}));

import { useCallbackInsertion } from '../src/features/arguments/crossRoom/useCallbackInsertion';
import {
  listLinkTargetCandidates,
  loadCurrentRoomCircleId,
  createArgumentRoomLink,
} from '../src/features/arguments/crossRoom/argumentRoomLinksApi';
import { listArgumentsForDebate } from '../src/features/arguments/argumentsApi';

const mockListCandidates = listLinkTargetCandidates as jest.Mock;
const mockLoadCircle = loadCurrentRoomCircleId as jest.Mock;
const mockCreateLink = createArgumentRoomLink as jest.Mock;
const mockListArgs = listArgumentsForDebate as jest.Mock;

const CANDIDATE = { debateId: 'debate-prior-1', title: 'Bike-lane baseline' };

function setup() {
  const setPendingCallback = jest.fn();
  const hook = renderHook(() =>
    useCallbackInsertion({
      sourceDebateId: 'current-room',
      currentUserId: 'user-1',
      setPendingCallback,
    }),
  );
  return { hook, setPendingCallback };
}

beforeEach(() => {
  mockListCandidates.mockReset();
  mockLoadCircle.mockReset();
  mockCreateLink.mockReset();
  mockListArgs.mockReset();
  mockListCandidates.mockResolvedValue({ ok: true, data: [CANDIDATE] });
  mockLoadCircle.mockResolvedValue({ ok: true, data: null });
});

describe('useCallbackInsertion', () => {
  it('openInsertion loads the picker candidate model', async () => {
    const { hook } = setup();
    await act(async () => {
      hook.result.current.openInsertion();
    });
    await waitFor(() => expect(hook.result.current.pickerLoading).toBe(false));
    expect(hook.result.current.pickerOpen).toBe(true);
    expect(hook.result.current.pickerModel?.sameCircle).toHaveLength(1);
  });

  it('pickRoom opens the capture sheet and lists the readable moves', async () => {
    mockListArgs.mockResolvedValue({
      ok: true,
      data: [
        { id: 'arg-1', body: 'Protected lanes reduce collisions on arterials.' },
        { id: 'arg-2', body: 'A second readable line.' },
      ],
    });
    const { hook } = setup();
    await act(async () => {
      hook.result.current.pickRoom(CANDIDATE as never);
    });
    await waitFor(() => expect(hook.result.current.captureLoading).toBe(false));
    expect(hook.result.current.captureOpen).toBe(true);
    expect(hook.result.current.captureLocked).toBe(false);
    expect(hook.result.current.captureMoves).toHaveLength(2);
    expect(hook.result.current.captureRoomTitle).toBe('Bike-lane baseline');
  });

  it('locks the capture when the prior room returns no readable moves (INV-1)', async () => {
    mockListArgs.mockResolvedValue({ ok: true, data: [] });
    const { hook } = setup();
    await act(async () => {
      hook.result.current.pickRoom(CANDIDATE as never);
    });
    await waitFor(() => expect(hook.result.current.captureLoading).toBe(false));
    expect(hook.result.current.captureLocked).toBe(true);
    expect(hook.result.current.captureMoves).toHaveLength(0);
  });

  it('locks the capture when the fetch errors (offline)', async () => {
    mockListArgs.mockResolvedValue({ ok: false, error: 'offline' });
    const { hook } = setup();
    await act(async () => {
      hook.result.current.pickRoom(CANDIDATE as never);
    });
    await waitFor(() => expect(hook.result.current.captureLoading).toBe(false));
    expect(hook.result.current.captureLocked).toBe(true);
  });

  it('captureLine writes a usable pendingCallback and closes the sheet', async () => {
    mockListArgs.mockResolvedValue({
      ok: true,
      data: [{ id: 'arg-1', body: 'Protected lanes reduce collisions on arterials.' }],
    });
    const { hook, setPendingCallback } = setup();
    await act(async () => {
      hook.result.current.pickRoom(CANDIDATE as never);
    });
    await waitFor(() => expect(hook.result.current.captureLoading).toBe(false));
    await act(async () => {
      hook.result.current.captureLine({ id: 'arg-1', body: 'Protected lanes reduce collisions on arterials.' });
    });
    expect(setPendingCallback).toHaveBeenCalledWith({
      targetDebateId: 'debate-prior-1',
      targetTitleSnapshot: 'Bike-lane baseline',
      excerpt: 'Protected lanes reduce collisions on arterials.',
      capturedFromArgumentId: 'arg-1',
    });
    expect(hook.result.current.captureOpen).toBe(false);
  });

  it('clearCallback delegates to setPendingCallback(null)', () => {
    const { hook, setPendingCallback } = setup();
    act(() => {
      hook.result.current.clearCallback();
    });
    expect(setPendingCallback).toHaveBeenCalledWith(null);
  });

  it('postCallbackLink creates the room link via the shipped caller-scoped API', async () => {
    mockCreateLink.mockResolvedValue({ ok: true, data: {}, duplicate: false });
    const { hook } = setup();
    let outcome: { ok: boolean; duplicate?: boolean } = { ok: false };
    await act(async () => {
      outcome = await hook.result.current.postCallbackLink({
        targetDebateId: 'debate-prior-1',
        targetTitleSnapshot: 'Bike-lane baseline',
        excerpt: 'x',
        capturedFromArgumentId: null,
      });
    });
    expect(mockCreateLink).toHaveBeenCalledWith({
      sourceDebateId: 'current-room',
      targetDebateId: 'debate-prior-1',
      targetTitleSnapshot: 'Bike-lane baseline',
      createdBy: 'user-1',
    });
    expect(outcome.ok).toBe(true);
  });

  it('postCallbackLink surfaces a failure without throwing', async () => {
    mockCreateLink.mockResolvedValue({ ok: false, error: 'network' });
    const { hook } = setup();
    let outcome: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      outcome = await hook.result.current.postCallbackLink({
        targetDebateId: 'debate-prior-1',
        targetTitleSnapshot: 't',
        excerpt: 'x',
        capturedFromArgumentId: null,
      });
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe('network');
  });
});
