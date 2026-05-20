/**
 * GAME-005 — useChimeInGovernance.
 *
 * Thin React hook holding the in-session `GovernanceReaction[]` state plus
 * `apply` / `retract` callbacks. v1 has NO I/O — governance reactions are
 * ephemeral and live in React state for the lifetime of the room view only.
 *
 * - No insert, no update, no select, no service-role, no Edge Function.
 * - The reactions array feeds straight into `buildPublicRoomSeatMap` and
 *   `buildGovernanceControlViewModel` — the pure model does all the work.
 * - `retract` is scoped per-actor: a primary may retract only its OWN
 *   reaction. The model's both-parties + reversibility rules do the rest.
 * - A future migration card swaps the in-session array for persisted rows
 *   from `public.chime_in_governance_reactions` — the model is unchanged
 *   because it already takes `GovernanceReaction[]` as input.
 */
import { useCallback, useMemo, useState } from 'react';
import type {
  GovernanceReaction,
  GovernanceReactionKind,
} from './publicSeatModel';

/** The arguments to apply one governance reaction. */
export interface ApplyChimeInReactionInput {
  /** Which primary seat the actor holds. */
  byPrimarySeat: 'initiator' | 'primary_opponent';
  /** The acting primary party's userId. */
  byUserId: string;
  /** The BR-004 branchId (or message id) the reaction targets. */
  targetBranchOrMessageId: string;
  /** The chime-in user the target branch belongs to. */
  targetChimeInUserId: string;
  /** The reaction kind. */
  kind: GovernanceReactionKind;
  /** ISO timestamp the reaction was applied (caller passes new Date()). */
  at: string;
}

export interface UseChimeInGovernanceResult {
  /** The current in-session reactions — feed to buildPublicRoomSeatMap. */
  reactions: ReadonlyArray<GovernanceReaction>;
  /**
   * Apply a reaction. If the same actor already has a NON-retracted
   * reaction of the same kind on the same chime-in, this is a no-op
   * (idempotent — re-applying never double-counts). A previously retracted
   * reaction of the same actor+kind+chime-in is re-activated rather than
   * appended, so the audit list stays compact.
   */
  apply: (input: ApplyChimeInReactionInput) => void;
  /**
   * Retract the acting party's OWN reaction. Scoped per-actor — a primary
   * can never retract the other primary's reaction. The reaction is KEPT in
   * the list with `retracted: true` (audit trail), never hard-deleted.
   */
  retract: (input: {
    byUserId: string;
    targetChimeInUserId: string;
    kind: GovernanceReactionKind;
  }) => void;
  /**
   * Convenience toggle for the control: applies the reaction when the
   * actor has not applied it, retracts it when the actor already has.
   */
  toggle: (input: ApplyChimeInReactionInput) => void;
}

/** Does an actor already hold a non-retracted reaction of this exact shape? */
function hasActiveReaction(
  reactions: ReadonlyArray<GovernanceReaction>,
  byUserId: string,
  targetChimeInUserId: string,
  kind: GovernanceReactionKind,
): boolean {
  return reactions.some(
    (r) =>
      r.byUserId === byUserId &&
      r.targetChimeInUserId === targetChimeInUserId &&
      r.kind === kind &&
      !r.retracted,
  );
}

export function useChimeInGovernance(
  initialReactions: ReadonlyArray<GovernanceReaction> = [],
): UseChimeInGovernanceResult {
  const [reactions, setReactions] = useState<GovernanceReaction[]>(() => [
    ...initialReactions,
  ]);

  const apply = useCallback((input: ApplyChimeInReactionInput) => {
    setReactions((prev) => {
      // Idempotent — re-applying an already-active reaction is a no-op.
      if (
        hasActiveReaction(
          prev,
          input.byUserId,
          input.targetChimeInUserId,
          input.kind,
        )
      ) {
        return prev;
      }
      // Re-activate a previously retracted reaction of the same shape
      // rather than appending a duplicate.
      const retractedIndex = prev.findIndex(
        (r) =>
          r.byUserId === input.byUserId &&
          r.targetChimeInUserId === input.targetChimeInUserId &&
          r.kind === input.kind &&
          r.retracted,
      );
      if (retractedIndex !== -1) {
        const next = prev.slice();
        next[retractedIndex] = {
          ...next[retractedIndex],
          retracted: false,
          at: input.at,
        };
        return next;
      }
      const reaction: GovernanceReaction = {
        byPrimarySeat: input.byPrimarySeat,
        byUserId: input.byUserId,
        targetBranchOrMessageId: input.targetBranchOrMessageId,
        targetChimeInUserId: input.targetChimeInUserId,
        kind: input.kind,
        at: input.at,
        retracted: false,
      };
      return [...prev, reaction];
    });
  }, []);

  const retract = useCallback(
    (input: {
      byUserId: string;
      targetChimeInUserId: string;
      kind: GovernanceReactionKind;
    }) => {
      setReactions((prev) =>
        prev.map((r) =>
          r.byUserId === input.byUserId &&
          r.targetChimeInUserId === input.targetChimeInUserId &&
          r.kind === input.kind &&
          !r.retracted
            ? { ...r, retracted: true }
            : r,
        ),
      );
    },
    [],
  );

  const toggle = useCallback(
    (input: ApplyChimeInReactionInput) => {
      // Read current state inside the updater to avoid a stale closure.
      setReactions((prev) => {
        const active = hasActiveReaction(
          prev,
          input.byUserId,
          input.targetChimeInUserId,
          input.kind,
        );
        if (active) {
          return prev.map((r) =>
            r.byUserId === input.byUserId &&
            r.targetChimeInUserId === input.targetChimeInUserId &&
            r.kind === input.kind &&
            !r.retracted
              ? { ...r, retracted: true }
              : r,
          );
        }
        const retractedIndex = prev.findIndex(
          (r) =>
            r.byUserId === input.byUserId &&
            r.targetChimeInUserId === input.targetChimeInUserId &&
            r.kind === input.kind &&
            r.retracted,
        );
        if (retractedIndex !== -1) {
          const next = prev.slice();
          next[retractedIndex] = {
            ...next[retractedIndex],
            retracted: false,
            at: input.at,
          };
          return next;
        }
        const reaction: GovernanceReaction = {
          byPrimarySeat: input.byPrimarySeat,
          byUserId: input.byUserId,
          targetBranchOrMessageId: input.targetBranchOrMessageId,
          targetChimeInUserId: input.targetChimeInUserId,
          kind: input.kind,
          at: input.at,
          retracted: false,
        };
        return [...prev, reaction];
      });
    },
    [],
  );

  return useMemo(
    () => ({ reactions, apply, retract, toggle }),
    [reactions, apply, retract, toggle],
  );
}
