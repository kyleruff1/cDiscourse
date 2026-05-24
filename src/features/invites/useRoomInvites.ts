/**
 * QOL-038 — React hook for the inviter side of the invite lifecycle.
 *
 * Owns the load + create + revoke flow for a single open room. The hook
 * mirrors useDebates: state held in useState; refresh runs on mount and
 * on debateId change; create / revoke optimistically update the local
 * list. Errors are kept as plain-language strings (via inviteCopy).
 *
 * Doctrine: this hook is the only consumer of the create-response
 * `inviteLink` value (the inviter's own capability). The link is held in
 * React state, not persisted, not logged, not echoed to analytics.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  createRoomInvite,
  listInvitesForDebate,
  revokeRoomInvite,
  type CreateRoomInviteInput,
  type CreateRoomInviteResponse,
} from './inviteApi';
import type { InviteSummaryForInviter } from './inviteModel';
import { plainLanguageForInviteError } from './inviteCopy';

export interface UseRoomInvitesResult {
  invites: InviteSummaryForInviter[];
  loading: boolean;
  error: string | null;
  /** The link from the most-recent create call. Null when no fresh link is in flight. */
  lastInviteLink: string | null;
  refresh: () => Promise<void>;
  create: (
    input: Omit<CreateRoomInviteInput, 'debateId'>,
  ) => Promise<CreateRoomInviteResponse | null>;
  revoke: (inviteId: string) => Promise<boolean>;
  clearLink: () => void;
}

export function useRoomInvites(debateId: string | null): UseRoomInvitesResult {
  const [invites, setInvites] = useState<InviteSummaryForInviter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!debateId) {
      setInvites([]);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listInvitesForDebate({ debateId });
    setLoading(false);
    if (result.ok) {
      setInvites(result.data.invites);
    } else {
      setError(plainLanguageForInviteError(result.error.error));
    }
  }, [debateId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (
      input: Omit<CreateRoomInviteInput, 'debateId'>,
    ): Promise<CreateRoomInviteResponse | null> => {
      if (!debateId) return null;
      setError(null);
      const result = await createRoomInvite({ ...input, debateId });
      if (!result.ok) {
        setError(plainLanguageForInviteError(result.error.error));
        return null;
      }
      // Stash the link only when present (omitted on the reuse path).
      if (result.data.inviteLink) {
        setLastInviteLink(result.data.inviteLink);
      }
      // Optimistically prepend the new row to the list. Worst case: a
      // refresh() corrects it.
      const optimistic: InviteSummaryForInviter = {
        inviteId: result.data.inviteId,
        inviteeEmailMasked: maskOptimistic(input.inviteeEmail),
        intendedSeat: input.intendedSeat ?? 'respondent',
        status: result.data.status,
        createdAt: new Date().toISOString(),
        expiresAt: result.data.expiresAt,
        acceptedAt: null,
      };
      setInvites((prev) => {
        if (prev.some((p) => p.inviteId === optimistic.inviteId)) return prev;
        return [optimistic, ...prev];
      });
      return result.data;
    },
    [debateId],
  );

  const revoke = useCallback(async (inviteId: string): Promise<boolean> => {
    setError(null);
    const result = await revokeRoomInvite({ inviteId });
    if (!result.ok) {
      setError(plainLanguageForInviteError(result.error.error));
      return false;
    }
    setInvites((prev) =>
      prev.map((p) => (p.inviteId === inviteId ? { ...p, status: 'revoked' as const } : p)),
    );
    return true;
  }, []);

  const clearLink = useCallback(() => setLastInviteLink(null), []);

  return { invites, loading, error, lastInviteLink, refresh, create, revoke, clearLink };
}

/**
 * Local-only mask helper for the optimistic-update path. The
 * authoritative mask is server-side (`list_for_debate` returns the
 * already-masked form); this is only used for the brief window between
 * the create call returning and the next refresh.
 */
function maskOptimistic(email: string): string {
  const trimmed = String(email || '').trim().toLowerCase();
  if (trimmed.length === 0) return '';
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return `${trimmed.charAt(0)}•••`;
  return `${trimmed.charAt(0)}•••@${trimmed.slice(at + 1)}`;
}
