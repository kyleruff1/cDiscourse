/**
 * UX-COMPOSER-005 (#831) — the composer-side callback insertion hook.
 *
 * Orchestrates the capture flow: open the room picker (reusing the shipped
 * candidate loader), pick a prior room, open the capture sheet, list that room
 * caller-readable moves, and write the picked verbatim line onto the active
 * draft as a `pendingCallback`. It also exposes the POST-submit-success link
 * create (ruling R6) so the room shell can attach the QOL-042 room link after
 * the move posts.
 *
 * All calls are caller-scoped under the user JWT (RLS + the QOL-042 trigger do
 * every enforcement); this hook never uses a service-role client and never
 * writes public.arguments — the move goes through the unchanged submit path.
 *
 * The draft write is delegated (`setPendingCallback`) so the caller owns the
 * single session activeDraft (no second useArgumentComposer mount). Comments
 * apostrophe-free.
 */
import { useCallback, useRef, useState } from 'react';
import {
  createArgumentRoomLink,
  listLinkTargetCandidates,
  loadCurrentRoomCircleId,
} from './argumentRoomLinksApi';
import {
  buildLinkTargetPickerModel,
  type LinkTargetCandidate,
  type LinkTargetPickerModel,
} from './linkTargetPickerModel';
import { listArgumentsForDebate } from '../argumentsApi';
import {
  captureToCallback,
  clampCallbackExcerpt,
  isCaptureUsable,
  type CallbackCaptureResult,
} from './callbackCaptureModel';
import type { CallbackCaptureMove } from './CallbackCaptureSheet';
import type { CrossRoomCallback } from './crossRoomCallbackRef';

/** The result of a post-success link create. */
export interface CallbackLinkOutcome {
  ok: boolean;
  error?: string;
  duplicate?: boolean;
}

/** Inputs to the callback insertion hook. */
export interface UseCallbackInsertionInput {
  /** The current (source) room the callback is woven into. */
  sourceDebateId: string;
  /** The signed-in user id — required to create the room link. */
  currentUserId: string | null;
  /** Writes the pending callback onto the active session draft (or clears it). */
  setPendingCallback: (callback: CrossRoomCallback | null) => void;
}

/** The public shape of the callback insertion hook. */
export interface UseCallbackInsertion {
  pickerOpen: boolean;
  pickerModel: LinkTargetPickerModel | null;
  pickerLoading: boolean;
  captureOpen: boolean;
  captureLoading: boolean;
  captureLocked: boolean;
  captureRoomTitle: string;
  captureMoves: ReadonlyArray<CallbackCaptureMove>;
  /** Open the room picker (loads candidates). */
  openInsertion: () => void;
  /** Pick a prior room -> open the capture sheet + load its readable moves. */
  pickRoom: (candidate: LinkTargetCandidate) => void;
  /** Capture the tapped line -> write pendingCallback + close the sheet. */
  captureLine: (move: CallbackCaptureMove) => void;
  /** Clear the pending callback on the draft. */
  clearCallback: () => void;
  closePicker: () => void;
  closeCapture: () => void;
  /** Create the QOL-042 room link AFTER the move posts (idempotent). */
  postCallbackLink: (callback: CrossRoomCallback) => Promise<CallbackLinkOutcome>;
}

export function useCallbackInsertion(input: UseCallbackInsertionInput): UseCallbackInsertion {
  const { sourceDebateId, currentUserId, setPendingCallback } = input;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerModel, setPickerModel] = useState<LinkTargetPickerModel | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureLocked, setCaptureLocked] = useState(false);
  const [captureRoomTitle, setCaptureRoomTitle] = useState('');
  const [captureMoves, setCaptureMoves] = useState<ReadonlyArray<CallbackCaptureMove>>([]);

  // The picked room (target of the pending capture). Held in a ref so the
  // capture handler reads the current room without a stale closure.
  const pickedRoomRef = useRef<LinkTargetCandidate | null>(null);
  // Stale-load guards for the two async loads.
  const pickerTokenRef = useRef(0);
  const captureTokenRef = useRef(0);

  const openInsertion = useCallback(() => {
    if (!sourceDebateId) return;
    setPickerOpen(true);
    setPickerLoading(true);
    setPickerModel(null);
    const token = ++pickerTokenRef.current;
    void (async () => {
      const [candidatesRes, circleRes] = await Promise.all([
        listLinkTargetCandidates(sourceDebateId),
        loadCurrentRoomCircleId(sourceDebateId),
      ]);
      if (token !== pickerTokenRef.current) return;
      if (!candidatesRes.ok) {
        setPickerModel({ sameCircle: [], other: [], moreNotShown: false, isEmpty: true });
        setPickerLoading(false);
        return;
      }
      const currentCircleId = circleRes.ok ? circleRes.data : null;
      setPickerModel(
        buildLinkTargetPickerModel(candidatesRes.data, currentCircleId, sourceDebateId),
      );
      setPickerLoading(false);
    })();
  }, [sourceDebateId]);

  const pickRoom = useCallback((candidate: LinkTargetCandidate) => {
    if (!candidate || !candidate.debateId) return;
    pickedRoomRef.current = candidate;
    setPickerOpen(false);
    setCaptureRoomTitle(candidate.title ?? '');
    setCaptureMoves([]);
    setCaptureLocked(false);
    setCaptureOpen(true);
    setCaptureLoading(true);
    const token = ++captureTokenRef.current;
    void (async () => {
      const res = await listArgumentsForDebate(candidate.debateId);
      if (token !== captureTokenRef.current) return;
      if (!res.ok || res.data.length === 0) {
        // INV-1: no readable move => no excerpt attachable. The lock line
        // renders as context (never a denial); an offline / RLS-empty fetch
        // both resolve here.
        setCaptureMoves([]);
        setCaptureLocked(true);
        setCaptureLoading(false);
        return;
      }
      setCaptureMoves(res.data.map((r) => ({ id: r.id, body: r.body })));
      setCaptureLocked(false);
      setCaptureLoading(false);
    })();
  }, []);

  const captureLine = useCallback(
    (move: CallbackCaptureMove) => {
      const room = pickedRoomRef.current;
      if (!room) return;
      const result: CallbackCaptureResult = {
        targetDebateId: room.debateId,
        targetTitleSnapshot: room.title ?? '',
        excerpt: clampCallbackExcerpt(move.body),
        capturedFromArgumentId: move.id ?? null,
      };
      if (!isCaptureUsable(result, sourceDebateId)) return;
      setPendingCallback(captureToCallback(result));
      setCaptureOpen(false);
    },
    [setPendingCallback, sourceDebateId],
  );

  const clearCallback = useCallback(() => {
    setPendingCallback(null);
  }, [setPendingCallback]);

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const closeCapture = useCallback(() => setCaptureOpen(false), []);

  const postCallbackLink = useCallback(
    async (callback: CrossRoomCallback): Promise<CallbackLinkOutcome> => {
      if (!sourceDebateId) return { ok: false, error: 'No room is open.' };
      if (!currentUserId) return { ok: false, error: 'Sign in to reference a prior argument.' };
      if (!callback || !callback.targetDebateId) {
        return { ok: false, error: 'No callback to attach.' };
      }
      const res = await createArgumentRoomLink({
        sourceDebateId,
        targetDebateId: callback.targetDebateId,
        targetTitleSnapshot: callback.targetTitleSnapshot,
        createdBy: currentUserId,
      });
      if (!res.ok) return { ok: false, error: res.error };
      return { ok: true, duplicate: res.duplicate === true };
    },
    [sourceDebateId, currentUserId],
  );

  return {
    pickerOpen,
    pickerModel,
    pickerLoading,
    captureOpen,
    captureLoading,
    captureLocked,
    captureRoomTitle,
    captureMoves,
    openInsertion,
    pickRoom,
    captureLine,
    clearCallback,
    closePicker,
    closeCapture,
    postCallbackLink,
  };
}
