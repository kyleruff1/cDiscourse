/**
 * INTEL-002 (#901) — the specificity KPI (pure TypeScript).
 *
 * "% of replies that target a moment" — the specificity KPI for the redesign.
 * marker-linked replies / total reply moves, per-room and POOLED aggregate. An
 * admin-only advisory readout; NEVER user-facing, NEVER per-person, NEVER a
 * leaderboard.
 *
 * Doctrine (evidence-doctrine / anti-amplification): this is a room + program
 * metric only. `created_by` on markers and `authorId` on replies are NEVER read
 * or grouped (pinned by T-NP). No standing coupling; imports no pointStanding.
 *
 * PURE + total: no Date.now, no async, no network, no mutation. Graceful on empty
 * (null rate on a zero denominator — never a fabricated 0%/100%).
 */

/** Minimal reply-move input (root/reply discriminator + type for the breakdown). */
export interface SpecificityReplyInput {
  id: string;
  /** null => room root (excluded from the denominator). */
  parentId: string | null;
  /** for the secondary rebuttal-typed breakdown. */
  argumentType: string | null;
  /** 'deleted' / inactive rows are excluded. */
  status: string | null;
  inactiveAt?: string | null;
}

/** Minimal active-marker input (reply linkage only — never a person field). */
export interface SpecificityMarkerInput {
  replyArgumentId: string | null;
  deletedAt: string | null;
}

export interface RoomSpecificityKpi {
  debateId: string;
  /** Reply moves = non-root, non-deleted, non-inactive arguments. The denominator. */
  totalReplies: number;
  /** Distinct reply ids that appear as reply_argument_id on >= 1 active marker. */
  markerLinkedReplies: number;
  /** markerLinkedReplies / totalReplies. NULL when totalReplies === 0. */
  rate: number | null;
  // Secondary: fidelity to the Design-Pass phrasing "% of rebuttals".
  totalRebuttals: number;
  markerLinkedRebuttals: number;
  rebuttalRate: number | null;
}

export interface AggregateSpecificityKpi {
  roomCount: number;
  totalReplies: number;
  markerLinkedReplies: number;
  /** POOLED: sum(markerLinkedReplies) / sum(totalReplies). NULL when sum is 0. */
  rate: number | null;
  totalRebuttals: number;
  markerLinkedRebuttals: number;
  rebuttalRate: number | null;
}

/** True for a reply move that belongs in the denominator (non-root, active). */
function isActiveReply(r: SpecificityReplyInput): boolean {
  if (!r || r.parentId === null || r.parentId === undefined) return false;
  if (r.status === 'deleted') return false;
  if (r.inactiveAt !== null && r.inactiveAt !== undefined) return false;
  return true;
}

export function deriveRoomSpecificityKpi(input: {
  debateId: string;
  replies: readonly SpecificityReplyInput[];
  markers: readonly SpecificityMarkerInput[];
}): RoomSpecificityKpi {
  // The denominator: active reply moves (deduped by id).
  const replyById = new Map<string, SpecificityReplyInput>();
  for (const r of input.replies ?? []) {
    if (isActiveReply(r)) replyById.set(r.id, r);
  }

  // The numerator: distinct reply ids that a live marker targets AND that are in
  // the denominator (a marker pointing at a deleted/inactive reply is excluded).
  const linkedIds = new Set<string>();
  for (const m of input.markers ?? []) {
    if (!m || m.deletedAt !== null || m.replyArgumentId === null) continue;
    if (replyById.has(m.replyArgumentId)) linkedIds.add(m.replyArgumentId);
  }

  const totalReplies = replyById.size;
  const markerLinkedReplies = linkedIds.size;
  const rate = totalReplies > 0 ? markerLinkedReplies / totalReplies : null;

  let totalRebuttals = 0;
  let markerLinkedRebuttals = 0;
  for (const [id, r] of replyById) {
    if (r.argumentType === 'rebuttal') {
      totalRebuttals += 1;
      if (linkedIds.has(id)) markerLinkedRebuttals += 1;
    }
  }
  const rebuttalRate = totalRebuttals > 0 ? markerLinkedRebuttals / totalRebuttals : null;

  return {
    debateId: input.debateId,
    totalReplies,
    markerLinkedReplies,
    rate,
    totalRebuttals,
    markerLinkedRebuttals,
    rebuttalRate,
  };
}

/** Pooled (sum/sum) aggregate — a 1-reply room cannot swing the program KPI. */
export function deriveAggregateSpecificityKpi(
  rooms: readonly RoomSpecificityKpi[],
): AggregateSpecificityKpi {
  let totalReplies = 0;
  let markerLinkedReplies = 0;
  let totalRebuttals = 0;
  let markerLinkedRebuttals = 0;
  for (const room of rooms ?? []) {
    totalReplies += room.totalReplies;
    markerLinkedReplies += room.markerLinkedReplies;
    totalRebuttals += room.totalRebuttals;
    markerLinkedRebuttals += room.markerLinkedRebuttals;
  }
  return {
    roomCount: (rooms ?? []).length,
    totalReplies,
    markerLinkedReplies,
    rate: totalReplies > 0 ? markerLinkedReplies / totalReplies : null,
    totalRebuttals,
    markerLinkedRebuttals,
    rebuttalRate: totalRebuttals > 0 ? markerLinkedRebuttals / totalRebuttals : null,
  };
}
