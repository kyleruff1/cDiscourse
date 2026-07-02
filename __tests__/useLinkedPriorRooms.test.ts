/**
 * QUOTE-FORGE-001 — useLinkedPriorRooms hook tests (mocked api).
 *
 * The argumentRoomLinksApi module is mocked so the hook is exercised in
 * isolation: LOAD + BUILD (chips for the three access states), the picker
 * candidate query, and the create flow (happy / duplicate / trigger
 * rejection). PRIVACY: a title_only chip carries only the snapshot title —
 * no move count, no content; an unavailable chip has no title and no
 * actions.
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import type { ArgumentRoomLinkResult } from '../src/features/arguments/crossRoom/argumentRoomLinksApi';
import type {
  ArgumentRoomLink,
} from '../src/features/arguments/crossRoom/linkedPriorArgumentModel';
import type { PriorRoomContext } from '../src/features/arguments/crossRoom/argumentRoomLinksApi';
import type { LinkTargetCandidate } from '../src/features/arguments/crossRoom/linkTargetPickerModel';

// ── Mock the api layer ─────────────────────────────────────────
const mockApi = {
  listLinksForRoom: jest.fn(),
  loadPriorRoomContext: jest.fn(),
  listLinkTargetCandidates: jest.fn(),
  loadCurrentRoomCircleId: jest.fn(),
  createArgumentRoomLink: jest.fn(),
};

jest.mock('../src/features/arguments/crossRoom/argumentRoomLinksApi', () => ({
  __esModule: true,
  listLinksForRoom: (...a: unknown[]) => mockApi.listLinksForRoom(...a),
  loadPriorRoomContext: (...a: unknown[]) => mockApi.loadPriorRoomContext(...a),
  listLinkTargetCandidates: (...a: unknown[]) => mockApi.listLinkTargetCandidates(...a),
  loadCurrentRoomCircleId: (...a: unknown[]) => mockApi.loadCurrentRoomCircleId(...a),
  createArgumentRoomLink: (...a: unknown[]) => mockApi.createArgumentRoomLink(...a),
}));

import {
  useLinkedPriorRooms,
  type CreateLinkOutcome,
} from '../src/features/arguments/crossRoom/useLinkedPriorRooms';

function link(over: Partial<ArgumentRoomLink> = {}): ArgumentRoomLink {
  return {
    id: over.id ?? 'link-1',
    sourceDebateId: over.sourceDebateId ?? 'room-new',
    targetDebateId: over.targetDebateId ?? 'room-prior',
    createdBy: over.createdBy ?? 'user-a',
    targetTitleSnapshot: over.targetTitleSnapshot ?? 'Prior room title',
    note: over.note ?? '',
    isRemoved: false,
    createdAt: over.createdAt ?? '2026-05-01T00:00:00.000Z',
  };
}

function ok<T>(data: T, extra: Record<string, unknown> = {}): ArgumentRoomLinkResult<T> {
  return { ok: true, data, ...extra } as ArgumentRoomLinkResult<T>;
}
function fail(error: string): ArgumentRoomLinkResult<never> {
  return { ok: false, error };
}

function contextResult(
  accessState: 'authorized' | 'title_only' | 'unavailable',
  summary: PriorRoomContext['summary'],
): ArgumentRoomLinkResult<PriorRoomContext> {
  return ok<PriorRoomContext>({ accessState, summary });
}

beforeEach(() => {
  for (const fn of Object.values(mockApi)) fn.mockReset();
  mockApi.loadCurrentRoomCircleId.mockResolvedValue(ok<string | null>(null));
});

// ── LOAD + BUILD ───────────────────────────────────────────────

describe('useLinkedPriorRooms — load + build', () => {
  it('loads links, resolves context, and builds one authorized chip', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(ok<ArgumentRoomLink[]>([link()]));
    mockApi.loadPriorRoomContext.mockResolvedValue(
      contextResult('authorized', { liveTitle: 'Live prior title', moveCount: 4, resolvedTangentCount: 0 }),
    );

    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));

    await waitFor(() => expect(result.current.chips).toHaveLength(1));
    const chip = result.current.chips[0];
    expect(chip.accessState).toBe('authorized');
    expect(chip.title).toBe('Live prior title');
    expect(chip.actions.some((a) => a.id === 'open_prior' && !a.isDisabled)).toBe(true);
  });

  it('maps a chip linkId back to its targetDebateId', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(
      ok<ArgumentRoomLink[]>([link({ id: 'L9', targetDebateId: 'prior-9' })]),
    );
    mockApi.loadPriorRoomContext.mockResolvedValue(
      contextResult('authorized', { liveTitle: 'T', moveCount: 1, resolvedTangentCount: 0 }),
    );

    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.chips).toHaveLength(1));
    expect(result.current.targetDebateIdForLink('L9')).toBe('prior-9');
    expect(result.current.targetDebateIdForLink('nope')).toBeNull();
  });

  it('renders nothing (empty chips) when there are no links', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(ok<ArgumentRoomLink[]>([]));
    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.chips).toHaveLength(0);
  });

  it('keeps the last good chips and surfaces an error when a refresh load fails', async () => {
    mockApi.listLinksForRoom.mockResolvedValueOnce(ok<ArgumentRoomLink[]>([link()]));
    mockApi.loadPriorRoomContext.mockResolvedValue(
      contextResult('authorized', { liveTitle: 'T', moveCount: 1, resolvedTangentCount: 0 }),
    );
    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.chips).toHaveLength(1));

    mockApi.listLinksForRoom.mockResolvedValueOnce(fail('boom'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toBe('boom'));
    // Last good chip is preserved.
    expect(result.current.chips).toHaveLength(1);
  });
});

// ── PRIVACY — three access states ──────────────────────────────

describe('useLinkedPriorRooms — access-state privacy', () => {
  it('title_only chip carries ONLY the snapshot title, no move count, no content', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(
      ok<ArgumentRoomLink[]>([link({ targetTitleSnapshot: 'Snapshot only title' })]),
    );
    mockApi.loadPriorRoomContext.mockResolvedValue(
      contextResult('title_only', { liveTitle: null, moveCount: null, resolvedTangentCount: null }),
    );
    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.chips).toHaveLength(1));
    const chip = result.current.chips[0];
    expect(chip.accessState).toBe('title_only');
    expect(chip.title).toBe('Snapshot only title');
    // No move-count leak in the sub-line, and Open is disabled with a reason.
    expect(chip.subLine).not.toMatch(/\d+\s+move/);
    const open = chip.actions.find((a) => a.id === 'open_prior');
    expect(open?.isDisabled).toBe(true);
    expect(open?.disabledReason).toBeTruthy();
    // No View context on a title_only chip.
    expect(chip.actions.some((a) => a.id === 'view_context')).toBe(false);
  });

  it('unavailable chip has no title and no actions', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(ok<ArgumentRoomLink[]>([link()]));
    mockApi.loadPriorRoomContext.mockResolvedValue(
      contextResult('unavailable', { liveTitle: null, moveCount: null, resolvedTangentCount: null }),
    );
    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.chips).toHaveLength(1));
    const chip = result.current.chips[0];
    expect(chip.accessState).toBe('unavailable');
    expect(chip.title).toBe('');
    expect(chip.actions).toHaveLength(0);
  });

  it('degrades a per-link context failure to an unavailable chip (row not dropped)', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(ok<ArgumentRoomLink[]>([link()]));
    mockApi.loadPriorRoomContext.mockResolvedValue(fail('rls denied'));
    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.chips).toHaveLength(1));
    expect(result.current.chips[0].accessState).toBe('unavailable');
  });
});

// ── PICKER candidate query ─────────────────────────────────────

describe('useLinkedPriorRooms — loadLinkCandidates', () => {
  it('fetches candidates + circle id and returns a segmented model', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(ok<ArgumentRoomLink[]>([]));
    const candidates: LinkTargetCandidate[] = [
      { debateId: 'a', title: 'A', circleId: 'c1', sameCircle: false },
      { debateId: 'b', title: 'B', circleId: null, sameCircle: false },
    ];
    mockApi.listLinkTargetCandidates.mockResolvedValue(ok<LinkTargetCandidate[]>(candidates));
    mockApi.loadCurrentRoomCircleId.mockResolvedValue(ok<string | null>('c1'));

    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let model = await result.current.loadLinkCandidates();
    await act(async () => {
      model = await result.current.loadLinkCandidates();
    });
    expect(model.isEmpty).toBe(false);
    expect(model.sameCircle).toHaveLength(1);
    expect(model.other).toHaveLength(1);
  });

  it('returns an empty model when the candidate query fails (no internal error)', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(ok<ArgumentRoomLink[]>([]));
    mockApi.listLinkTargetCandidates.mockResolvedValue(fail('boom'));
    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let model = await result.current.loadLinkCandidates();
    await act(async () => {
      model = await result.current.loadLinkCandidates();
    });
    expect(model.isEmpty).toBe(true);
  });
});

// ── CREATE flow ────────────────────────────────────────────────

describe('useLinkedPriorRooms — createLink', () => {
  const candidate: LinkTargetCandidate = {
    debateId: 'room-prior',
    title: 'Prior room title',
    circleId: null,
    sameCircle: false,
  };

  it('calls createArgumentRoomLink with the caller-scoped input then refreshes', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(ok<ArgumentRoomLink[]>([]));
    mockApi.createArgumentRoomLink.mockResolvedValue(ok<ArgumentRoomLink>(link()));
    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: CreateLinkOutcome = { ok: false };
    await act(async () => {
      outcome = await result.current.createLink(candidate, 'a note');
    });
    expect(outcome.ok).toBe(true);
    expect(mockApi.createArgumentRoomLink).toHaveBeenCalledWith({
      sourceDebateId: 'room-new',
      targetDebateId: 'room-prior',
      targetTitleSnapshot: 'Prior room title',
      note: 'a note',
      createdBy: 'user-a',
    });
    // A refresh (second listLinksForRoom call) followed the create.
    expect(mockApi.listLinksForRoom.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces duplicate: true for an idempotent existing link, no error', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(ok<ArgumentRoomLink[]>([]));
    mockApi.createArgumentRoomLink.mockResolvedValue(ok<ArgumentRoomLink>(link(), { duplicate: true }));
    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let outcome: CreateLinkOutcome = { ok: false };
    await act(async () => {
      outcome = await result.current.createLink(candidate, '');
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.duplicate).toBe(true);
    expect(outcome.error).toBeUndefined();
  });

  it('surfaces a trigger rejection as a plain-language error (ok:false)', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(ok<ArgumentRoomLink[]>([]));
    mockApi.createArgumentRoomLink.mockResolvedValue(
      fail('createArgumentRoomLink failed: a prior argument can only be linked once it is settled'),
    );
    const { result } = renderHook(() => useLinkedPriorRooms('room-new', 'user-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let outcome: CreateLinkOutcome = { ok: true };
    await act(async () => {
      outcome = await result.current.createLink(candidate, '');
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain('settled');
  });

  it('refuses to create without a signed-in user', async () => {
    mockApi.listLinksForRoom.mockResolvedValue(ok<ArgumentRoomLink[]>([]));
    const { result } = renderHook(() => useLinkedPriorRooms('room-new', null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let outcome: CreateLinkOutcome = { ok: true };
    await act(async () => {
      outcome = await result.current.createLink(candidate, '');
    });
    expect(outcome.ok).toBe(false);
    expect(mockApi.createArgumentRoomLink).not.toHaveBeenCalled();
  });
});
