/**
 * CHIMEIN-P8 Round 2 (#761) — useChimeInContributions.
 *
 * A thin READ-ONLY hook that loads the ACTIVE chime_in_contributions rows for a
 * room (caller-scoped SELECT, RLS-gated). It does NO write — attach / retract go
 * through chimeInApi. When `enabled` is false (the chime_in flag OFF, the default)
 * it performs NO query and returns an empty list, so a flag-off room is
 * byte-identical to the pre-Round-2 room (the useMoveMarks precedent).
 *
 * No featureFlags import (the ASP consumer-allowlist guard — the flag arrives as
 * the `enabled` prop). No service role. Imports nothing from any pointStanding /
 * anti-amplification path — a chime marker feeds display subordination + the seat
 * count, never factual standing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type { ChimeInContributionRow } from './chimeInContributionModel';
import { ROOM_LOAD_ERROR_COPY } from '../arguments/gameCopy';

// UX-PR-B (#918) — the fixed plain-language read-error sentinel (never the raw
// supabase error object / message; no code leak, ban-list clean).
const READ_ERROR = ROOM_LOAD_ERROR_COPY.hookError;

const CHIME_IN_COLUMNS =
  'id, debate_id, argument_id, target_argument_id, author_id, seat_index, retracted_at';

interface ChimeInDbRow {
  id: string;
  debate_id: string;
  argument_id: string;
  target_argument_id: string;
  author_id: string;
  seat_index: number;
  retracted_at: string | null;
}

export interface UseChimeInContributionsInput {
  debateId: string | null | undefined;
  /** The chime_in flag, threaded from App.tsx. false => no query, empty result. */
  enabled: boolean;
}

export interface UseChimeInContributionsResult {
  /** The loaded ACTIVE chime rows (empty when disabled / unconfigured). */
  rows: ReadonlyArray<ChimeInContributionRow>;
  loading: boolean;
  /**
   * UX-PR-B (#918) — a fixed plain-language read-error sentinel (never the raw
   * supabase error), or null when the load succeeded / was skipped. Additive:
   * the success payload (the rows list) is byte-identical to before.
   */
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY_ROWS: ReadonlyArray<ChimeInContributionRow> = Object.freeze([]);

export function useChimeInContributions(
  input: UseChimeInContributionsInput,
): UseChimeInContributionsResult {
  const { debateId, enabled } = input;

  const [rows, setRows] = useState<ReadonlyArray<ChimeInContributionRow>>(EMPTY_ROWS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (!enabled || !SUPABASE_CONFIGURED || !debateId) {
      // Disabled / unconfigured is legitimate ABSENCE, never a failure.
      if (mountedRef.current) {
        setRows(EMPTY_ROWS);
        setError(null);
      }
      return;
    }
    if (mountedRef.current) setLoading(true);
    try {
      const { data, error: readError } = await supabase
        .from('chime_in_contributions')
        .select(CHIME_IN_COLUMNS)
        .eq('debate_id', debateId)
        .is('retracted_at', null);
      if (readError) {
        // Honest failure: empty rows + the fixed sentinel (never the raw error).
        if (mountedRef.current) {
          setRows(EMPTY_ROWS);
          setError(READ_ERROR);
        }
        return;
      }
      const mapped = ((data ?? []) as ChimeInDbRow[]).map((r) => ({
        id: r.id,
        debateId: r.debate_id,
        argumentId: r.argument_id,
        targetArgumentId: r.target_argument_id,
        authorId: r.author_id,
        seatIndex: r.seat_index,
        retractedAt: r.retracted_at,
      }));
      if (mountedRef.current) {
        setRows(mapped);
        setError(null);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, debateId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const activeRows = enabled ? rows : EMPTY_ROWS;

  return useMemo(
    () => ({
      rows: activeRows,
      loading: enabled ? loading : false,
      error: enabled ? error : null,
      refetch,
    }),
    [activeRows, enabled, loading, error, refetch],
  );
}
