/**
 * FEEDBACK-001 (#898) — useMoveMarks hook.
 *
 * The room shell's single move-marks seam. Fetches the ACTIVE move_marks rows for
 * a room's arguments (RLS-scoped anon-key + JWT read; the SELECT-only policy) so
 * the ONE deriveMoveMarkAggregate in ArgumentRoom can feed both aggregate
 * surfaces, and holds the viewer's own per-move state so the BooleanFeedbackBar
 * renders the marked toggles. Exposes optimistic onMark / onUnmark handlers that
 * write through moveMarksApi (the mark-move Edge) and reconcile with the
 * authoritative viewerMarks the Edge returns; a failed tap reverts and surfaces a
 * quiet plain-language note. Returns empty data and performs NO fetch when
 * enabled === false (the flag-off path), so a flag-off room is byte-identical.
 *
 * No featureFlags import (App.tsx is the sole flag consumer; the mount decision
 * arrives as the enabled prop). No service role. Imports NO pointStanding — a mark
 * feeds the mediator projection + heat only, NEVER factual standing. Comments are
 * apostrophe-free for scanner safety.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import {
  emptyViewerMoveMarkState,
  oppositeOf,
  summarizeViewerMarks,
  type MoveMarkCode,
  type MoveMarkRow,
  type ViewerMoveMarkState,
} from './moveMarksModel';
import { retractMoveMark, setMoveMark } from './moveMarksApi';
import { ROOM_LOAD_ERROR_COPY } from '../arguments/gameCopy';

const MOVE_MARK_COLUMNS = 'argument_id, mark_code, marked_by, retracted_at';

// UX-PR-B (#918) — the fixed plain-language READ-error sentinel (never the raw
// supabase error). Distinct from the exemplary per-move WRITE note that
// moveMarkErrorFor already surfaces; this covers the room-wide fetch failing.
const READ_ERROR = ROOM_LOAD_ERROR_COPY.hookError;

interface MoveMarkDbRow {
  argument_id: string;
  mark_code: MoveMarkCode;
  marked_by: string;
  retracted_at: string | null;
}

export interface UseMoveMarksInput {
  debateId: string | null | undefined;
  argumentIds: ReadonlyArray<string>;
  viewerId: string | null;
  enabled: boolean;
}

export interface UseMoveMarksResult {
  /** Active rows for the room; the ONLY input to deriveMoveMarkAggregate. */
  activeRows: ReadonlyArray<MoveMarkRow>;
  /** This viewer's active marks on ONE move (optimistic override over fetched). */
  viewerMoveMarksFor: (argumentId: string) => ViewerMoveMarkState;
  /** The quiet inline failure note for a move, if any (never a raw code). */
  moveMarkErrorFor: (argumentId: string) => string | undefined;
  onMark: (argumentId: string, code: MoveMarkCode) => void;
  onUnmark: (argumentId: string, code: MoveMarkCode) => void;
  loading: boolean;
  /**
   * UX-PR-B (#918) — the room-wide READ-error sentinel (never the raw supabase
   * error), or null when the fetch succeeded / was skipped. This is SEPARATE
   * from moveMarkErrorFor (the per-move write note): a failed room fetch feeds
   * the shared room-load strip, a failed tap stays a quiet inline note.
   */
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY_ROWS: ReadonlyArray<MoveMarkRow> = Object.freeze([]);

export function useMoveMarks(input: UseMoveMarksInput): UseMoveMarksResult {
  const { debateId, argumentIds, viewerId, enabled } = input;

  const [rows, setRows] = useState<ReadonlyArray<MoveMarkRow>>([]);
  const [loading, setLoading] = useState(false);
  // Optimistic per-move viewer state; wins over the fetched base until the next
  // fetch converges. Set on tap, replaced with the Edge authoritative state on
  // success, cleared on failure.
  const [overrides, setOverrides] = useState<Record<string, ViewerMoveMarkState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // UX-PR-B (#918) — the room-wide READ error (the fetch failing), distinct from
  // the per-move write `errors` map above.
  const [readError, setReadError] = useState<string | null>(null);

  const idsKey = useMemo(() => [...argumentIds].sort().join(','), [argumentIds]);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (!enabled || !SUPABASE_CONFIGURED || !debateId || argumentIds.length === 0) {
      // Disabled / unconfigured / no-ids is legitimate ABSENCE, never a failure.
      if (mountedRef.current) {
        setRows([]);
        setReadError(null);
      }
      return;
    }
    if (mountedRef.current) setLoading(true);
    try {
      const { data, error: readErr } = await supabase
        .from('move_marks')
        .select(MOVE_MARK_COLUMNS)
        .eq('debate_id', debateId)
        .in('argument_id', [...argumentIds])
        .is('retracted_at', null);
      if (readErr) {
        // Honest failure: empty rows + the fixed sentinel (never the raw error).
        if (mountedRef.current) {
          setRows([]);
          setReadError(READ_ERROR);
        }
        return;
      }
      const mapped = ((data ?? []) as MoveMarkDbRow[]).map((r) => ({
        argumentId: r.argument_id,
        markCode: r.mark_code,
        markedBy: r.marked_by,
        retractedAt: r.retracted_at,
      }));
      if (mountedRef.current) {
        setRows(mapped);
        setReadError(null);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // idsKey stands in for argumentIds; debateId + enabled complete the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debateId, idsKey]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const activeRows = enabled ? rows : EMPTY_ROWS;

  const viewerMoveMarksFor = useCallback(
    (argumentId: string): ViewerMoveMarkState => {
      if (!enabled) return emptyViewerMoveMarkState();
      const override = overrides[argumentId];
      if (override) return override;
      return summarizeViewerMarks(rows, argumentId, viewerId);
    },
    [enabled, overrides, rows, viewerId],
  );

  const moveMarkErrorFor = useCallback(
    (argumentId: string): string | undefined => (enabled ? errors[argumentId] : undefined),
    [enabled, errors],
  );

  const baseViewerState = useCallback(
    (argumentId: string): ViewerMoveMarkState => {
      const override = overrides[argumentId];
      if (override) return override;
      return summarizeViewerMarks(rows, argumentId, viewerId);
    },
    [overrides, rows, viewerId],
  );

  const applyTap = useCallback(
    async (argumentId: string, code: MoveMarkCode, action: 'mark' | 'retract') => {
      if (!enabled || !debateId) return;
      // Optimistic next state: set/clear the tapped code, clear the paired opposite
      // on a mark (the Edge enforces the same server-side).
      const current = baseViewerState(argumentId);
      const optimistic: ViewerMoveMarkState = { ...current };
      if (action === 'mark') {
        optimistic[code] = true;
        const opp = oppositeOf(code);
        if (opp) optimistic[opp] = false;
      } else {
        optimistic[code] = false;
      }
      setOverrides((prev) => ({ ...prev, [argumentId]: optimistic }));
      setErrors((prev) => {
        if (!prev[argumentId]) return prev;
        const next = { ...prev };
        delete next[argumentId];
        return next;
      });

      const result =
        action === 'mark'
          ? await setMoveMark({ debateId, argumentId, markCode: code })
          : await retractMoveMark({ debateId, argumentId, markCode: code });
      if (!mountedRef.current) return;

      if (result.ok && result.viewerMarks) {
        // Replace the optimistic override with the Edge authoritative state, then
        // converge the room-wide rows (feeds the aggregate).
        const authoritative = result.viewerMarks;
        setOverrides((prev) => ({ ...prev, [argumentId]: authoritative }));
        void refetch();
      } else {
        // Revert to the fetched base and surface a quiet plain-language note.
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[argumentId];
          return next;
        });
        setErrors((prev) => ({
          ...prev,
          [argumentId]: result.errorMessage ?? 'That mark could not be saved.',
        }));
      }
    },
    [enabled, debateId, baseViewerState, refetch],
  );

  const onMark = useCallback(
    (argumentId: string, code: MoveMarkCode) => {
      void applyTap(argumentId, code, 'mark');
    },
    [applyTap],
  );
  const onUnmark = useCallback(
    (argumentId: string, code: MoveMarkCode) => {
      void applyTap(argumentId, code, 'retract');
    },
    [applyTap],
  );

  return {
    activeRows,
    viewerMoveMarksFor,
    moveMarkErrorFor,
    onMark,
    onUnmark,
    loading,
    error: enabled ? readError : null,
    refetch,
  };
}
