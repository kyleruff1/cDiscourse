/**
 * GAME-004 — useRoomContract.
 *
 * Thin, READ-ONLY React hook that derives the 1v1 room contract for a debate
 * room. It loads `debate_participants` (one RLS-bound select) and the room's
 * posted `arguments` (reusing `listArgumentsForDebate`), then builds the pure
 * `RoomContract` + `RoomContractViewModel`.
 *
 * - No insert, no update, no service-role, no Edge Function.
 * - On any read failure the hook returns `viewModel: null`; the caller then
 *   omits the strip prop and the header renders exactly as it does today
 *   (graceful degradation — no crash, no contract-specific error banner).
 * - `roomType` / `invitedOpponentUserId` are caller-supplied (v1 has no
 *   persisted source — see docs/designs/GAME-004.md § RoomType provenance).
 *   A future migration card threads the real values through `options`.
 */
import { useEffect, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import { listArgumentsForDebate } from '../arguments/argumentsApi';
import type { ArgumentRow } from '../arguments/types';
import {
  buildRoomContract,
  buildRoomContractViewModel,
  type RoomArgumentInput,
  type RoomContractViewModel,
  type RoomParticipantInput,
  type RoomType,
} from './roomContractModel';

interface ParticipantRow {
  user_id: string;
  side: string;
  joined_at: string;
}

export interface UseRoomContractOptions {
  /** Room type. v1 has no persisted source — defaults to 'public' downstream. */
  roomType?: RoomType;
  /** Private-room invited opponent. v1 has no persisted invite. */
  invitedOpponentUserId?: string | null;
}

export interface UseRoomContractInput {
  /** `debates.id`. */
  roomId: string;
  /** `debates.created_by` — the Initiator. */
  initiatorUserId: string;
  /** `debates.created_at`. */
  openedAt: string;
  /** The signed-in viewer, or null for an unauthenticated observer. */
  viewerUserId: string | null;
  options?: UseRoomContractOptions;
}

export interface UseRoomContractResult {
  /** The derived projection, or null when the read failed / is incomplete. */
  viewModel: RoomContractViewModel | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Maps an app `ArgumentRow` into the model's narrowed input shape. */
function toRoomArgumentInput(row: ArgumentRow): RoomArgumentInput {
  return {
    id: row.id,
    parentId: row.parentId,
    authorId: row.authorId,
    argumentType: row.argumentType,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function useRoomContract(input: UseRoomContractInput): UseRoomContractResult {
  const { roomId, initiatorUserId, openedAt, viewerUserId, options } = input;
  const [viewModel, setViewModel] = useState<RoomContractViewModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const roomType = options?.roomType;
  const invitedOpponentUserId = options?.invitedOpponentUserId ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!SUPABASE_CONFIGURED || !roomId || !initiatorUserId) {
      setViewModel(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      // Participants — read-only select. If RLS blocks co-participant reads
      // the resolver still works from `arguments` alone (the public rule
      // needs only arguments + initiatorUserId), so a participants failure
      // degrades to an empty list rather than failing the whole contract.
      const [participantsRes, argumentsRes] = await Promise.all([
        supabase
          .from('debate_participants')
          .select('user_id, side, joined_at')
          .eq('debate_id', roomId),
        listArgumentsForDebate(roomId),
      ]);
      if (cancelled) return;

      if (!argumentsRes.ok) {
        setViewModel(null);
        setLoading(false);
        setError(argumentsRes.error);
        return;
      }

      const participants: RoomParticipantInput[] = (
        (participantsRes.data ?? []) as ParticipantRow[]
      ).map((p) => ({
        userId: p.user_id,
        side: p.side,
        joinedAt: p.joined_at,
      }));

      const roomArguments = argumentsRes.data.map(toRoomArgumentInput);

      const contract = buildRoomContract({
        roomId,
        initiatorUserId,
        openedAt,
        roomType,
        invitedOpponentUserId,
        participants,
        arguments: roomArguments,
      });
      const projected = buildRoomContractViewModel(
        contract,
        viewerUserId,
        roomArguments,
      );

      setViewModel(projected);
      setLoading(false);
      setError(null);
    })().catch((e: unknown) => {
      if (cancelled) return;
      setViewModel(null);
      setLoading(false);
      setError(e instanceof Error ? e.message : 'Failed to load the room contract.');
    });
    return () => {
      cancelled = true;
    };
  }, [
    roomId,
    initiatorUserId,
    openedAt,
    viewerUserId,
    roomType,
    invitedOpponentUserId,
    reloadToken,
  ]);

  return {
    viewModel,
    loading,
    error,
    refresh: () => setReloadToken((n) => n + 1),
  };
}
