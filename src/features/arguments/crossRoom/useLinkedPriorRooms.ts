/**
 * QUOTE-FORGE-001 — Linked-prior-rooms hook (room-scoped fetch + build).
 *
 * Owns the LOAD -> BUILD data flow that lights the QOL-042 cross-room-link
 * wire in a live room, plus the create-link picker query + create flow.
 * All calls are caller-scoped under the user's own JWT — RLS + the QOL-042
 * trigger do every enforcement; this hook never uses a service-role client
 * and never writes `public.arguments`.
 *
 * Flow (QUOTE-FORGE-001 design §Data flow):
 *   LOAD   — `listLinksForRoom(sourceDebateId)`; per link,
 *            `loadPriorRoomContext(link.targetDebateId)`.
 *   BUILD  — `buildLinkedPriorArgumentChip({ link, priorRoomSummary,
 *            viewerAccess })` -> `LinkedPriorArgumentChip[]`.
 *   PICKER — `loadLinkCandidates()` = `listLinkTargetCandidates` +
 *            `loadCurrentRoomCircleId` -> `buildLinkTargetPickerModel`.
 *   CREATE — `createLink(candidate, note)` = `createArgumentRoomLink` then
 *            `refresh()`; a duplicate (23505) is idempotent success.
 *
 * The hook holds the loaded links so a chip's `linkId` maps back to its
 * `targetDebateId` for the open-prior-room handler.
 *
 * No React Native import — a plain data hook. No new dependency.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createArgumentRoomLink,
  listLinkTargetCandidates,
  listLinksForRoom,
  loadCurrentRoomCircleId,
  loadPriorRoomContext,
} from './argumentRoomLinksApi';
import {
  buildLinkedPriorArgumentChip,
  type ArgumentRoomLink,
  type LinkedPriorArgumentChip,
} from './linkedPriorArgumentModel';
import {
  buildLinkTargetPickerModel,
  type LinkTargetCandidate,
  type LinkTargetPickerModel,
} from './linkTargetPickerModel';
import { LINKED_PRIOR_ARGUMENT_COPY } from './linkedPriorArgumentCopy';

/** The result of a `createLink` attempt. */
export interface CreateLinkOutcome {
  /** True when a link exists after the call (created OR already present). */
  ok: boolean;
  /** Plain-language error when `ok` is false. */
  error?: string;
  /** True when the link already existed (idempotent 23505 success). */
  duplicate?: boolean;
}

/** The public shape of the linked-prior-rooms hook. */
export interface UseLinkedPriorRooms {
  /** The chip view-models, in `created_at ASC` order. Empty renders nothing. */
  chips: ReadonlyArray<LinkedPriorArgumentChip>;
  /** True while the initial (or a refresh) load is in flight. */
  loading: boolean;
  /** A plain-language error from the last load, or null. */
  error: string | null;
  /** Re-run the load. */
  refresh: () => void;
  /** Map a chip's `linkId` to the prior room's `targetDebateId`. */
  targetDebateIdForLink: (linkId: string) => string | null;
  /** Fetch + segment the create-link candidate list (picker query). */
  loadLinkCandidates: () => Promise<LinkTargetPickerModel>;
  /** Create a link to a candidate, then refresh the chip row. */
  createLink: (candidate: LinkTargetCandidate, note: string) => Promise<CreateLinkOutcome>;
}

/**
 * The linked-prior-rooms hook. Load-on-mount + on `sourceDebateId` change;
 * keeps the last good chips if a refresh fails (never blanks the room).
 */
export function useLinkedPriorRooms(
  sourceDebateId: string,
  currentUserId: string | null,
): UseLinkedPriorRooms {
  const [chips, setChips] = useState<ReadonlyArray<LinkedPriorArgumentChip>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // The loaded links, kept so a chip's linkId maps to its targetDebateId.
  const linksRef = useRef<ReadonlyArray<ArgumentRoomLink>>([]);
  // Guard against a setState after unmount / after a newer load superseded.
  const loadTokenRef = useRef<number>(0);

  const load = useCallback(async () => {
    if (!sourceDebateId) {
      linksRef.current = [];
      setChips([]);
      return;
    }
    const token = ++loadTokenRef.current;
    setLoading(true);
    setError(null);

    const linksRes = await listLinksForRoom(sourceDebateId);
    if (token !== loadTokenRef.current) return; // superseded
    if (!linksRes.ok) {
      setLoading(false);
      setError(linksRes.error);
      // Keep the last good chips — never blank the room on a refresh failure.
      return;
    }

    const links = linksRes.data;
    linksRef.current = links;

    const builtChips: LinkedPriorArgumentChip[] = [];
    for (const link of links) {
      const contextRes = await loadPriorRoomContext(link.targetDebateId);
      if (token !== loadTokenRef.current) return; // superseded mid-loop
      if (!contextRes.ok) {
        // A single unresolved prior room degrades to an `unavailable` chip
        // rather than dropping the whole row — the QOL-042 model already
        // renders a neutral unavailable line for it.
        builtChips.push(
          buildLinkedPriorArgumentChip({
            link,
            priorRoomSummary: {},
            viewerAccess: 'unavailable',
          }),
        );
        continue;
      }
      builtChips.push(
        buildLinkedPriorArgumentChip({
          link,
          priorRoomSummary: contextRes.data.summary,
          viewerAccess: contextRes.data.accessState,
        }),
      );
    }

    if (token !== loadTokenRef.current) return;
    setChips(builtChips);
    setLoading(false);
  }, [sourceDebateId]);

  useEffect(() => {
    void load();
    // Invalidate any in-flight load when the room changes / on unmount by
    // bumping the shared load token; a stale load then early-returns before
    // it setState. Reading the ref here is intentional (it is not a DOM
    // node) — the token guard is the whole point.
    const ref = loadTokenRef;
    return () => {
      ref.current++;
    };
  }, [load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  const targetDebateIdForLink = useCallback((linkId: string): string | null => {
    const link = linksRef.current.find((l) => l.id === linkId);
    return link ? link.targetDebateId : null;
  }, []);

  const loadLinkCandidates = useCallback(async (): Promise<LinkTargetPickerModel> => {
    if (!sourceDebateId) {
      return { sameCircle: [], other: [], moreNotShown: false, isEmpty: true };
    }
    const [candidatesRes, circleRes] = await Promise.all([
      listLinkTargetCandidates(sourceDebateId),
      loadCurrentRoomCircleId(sourceDebateId),
    ]);
    if (!candidatesRes.ok) {
      // A failed candidate query yields an empty (isEmpty) model; the sheet
      // shows the pickerEmpty copy rather than an internal error.
      return { sameCircle: [], other: [], moreNotShown: false, isEmpty: true };
    }
    const currentCircleId = circleRes.ok ? circleRes.data : null;
    return buildLinkTargetPickerModel(candidatesRes.data, currentCircleId, sourceDebateId);
  }, [sourceDebateId]);

  const createLink = useCallback(
    async (candidate: LinkTargetCandidate, note: string): Promise<CreateLinkOutcome> => {
      if (!sourceDebateId) return { ok: false, error: 'No room is open.' };
      if (!currentUserId) return { ok: false, error: 'Sign in to reference a prior argument.' };
      if (!candidate || !candidate.debateId) {
        return { ok: false, error: 'Pick a prior argument to reference.' };
      }

      const res = await createArgumentRoomLink({
        sourceDebateId,
        targetDebateId: candidate.debateId,
        targetTitleSnapshot: candidate.title,
        note,
        createdBy: currentUserId,
      });
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      // A pre-existing (source, target) pair returns the existing row as
      // idempotent success with `duplicate: true` — surface it so the sheet
      // closes calmly rather than showing an error toast.
      const duplicate = res.duplicate === true;
      await load();
      return { ok: true, duplicate };
    },
    [sourceDebateId, currentUserId, load],
  );

  return {
    chips,
    loading,
    error,
    refresh,
    targetDebateIdForLink,
    loadLinkCandidates,
    createLink,
  };
}

/** The couldNotRefresh copy, re-exported for the room shell's error strip. */
export const LINKED_PRIOR_COULD_NOT_REFRESH = LINKED_PRIOR_ARGUMENT_COPY.couldNotRefresh;
