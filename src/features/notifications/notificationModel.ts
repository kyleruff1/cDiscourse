/**
 * QOL-040 — pure-TS notification model.
 *
 * No React. No Supabase. No network. No AI. No `Date.now()` in the
 * copy / classify / recipient functions — every output is a pure
 * deterministic function of its inputs. This mirrors the
 * doctrine that copy and decision models are deterministic and
 * testable.
 *
 * Doctrine (cdiscourse-doctrine §1/§3/§4/§9 + design §9):
 *   - No verdict / truth / popularity language in any string.
 *   - The copy builder NEVER receives or emits room body text.
 *     The only room content a notification carries is the room
 *     title (`roomTitle`), which is delivery-time snapshotted by
 *     the Edge Function while the recipient was authorised.
 *   - No raw `snake_case` reaches a user-facing string — every
 *     classification noun in `meta` is hand-mapped here, and
 *     unknown codes are suppressed rather than echoed.
 *   - The actor display name surfaces ONLY when
 *     `meta.actorNameVisible === true`. The Edge Function flips
 *     that bit when the recipient's room access already lets them
 *     see the actor; otherwise copy says "Someone".
 *   - The author of a move NEVER self-notifies (recipient resolver).
 *
 * NOTE on the eleventh trigger:
 *   Trigger 11 (`invite_expired_notice`) is intentionally NOT in
 *   the `RoomNotificationType` union. Per operator decision
 *   2026-05-24: invite expiration is a low-value notification;
 *   the inviter has the invite management UI from QOL-038.
 *   Adding this trigger requires pg_cron or lazy list-view
 *   derivation; deferred to a follow-up card.
 */

// ── Types ────────────────────────────────────────────────────

/**
 * The ten triggers QOL-040 ships. The eleventh
 * (`invite_expired_notice`) is intentionally absent — see the
 * file-level comment.
 */
export type RoomNotificationType =
  | 'invite'
  | 'new_response'
  | 'concession_challenged'
  | 'source_requested'
  | 'evidence_supplied'
  | 'chime_in_posted'
  | 'room_made_private'
  | 'chime_in_rejected'
  | 'argument_settled'
  | 'invite_accepted_by_invitee';

/** The ten trigger values as a frozen array, for defensive parsing. */
export const ALL_ROOM_NOTIFICATION_TYPES: ReadonlyArray<RoomNotificationType> =
  Object.freeze([
    'invite',
    'new_response',
    'concession_challenged',
    'source_requested',
    'evidence_supplied',
    'chime_in_posted',
    'room_made_private',
    'chime_in_rejected',
    'argument_settled',
    'invite_accepted_by_invitee',
  ]);

/** Neutral metadata. The copy builder reads ONLY the fields below. */
export interface NotificationMeta {
  /**
   * Optional neutral classification noun for `concession_challenged`.
   * A move-category label, not a verdict.
   */
  classification?: 'framing' | 'context' | 'fact';
  /** TRUE selects the private-room copy variant. */
  roomIsPrivate?: boolean;
  /**
   * TRUE when the actor's display name may be surfaced in copy.
   * Set FALSE to fall back to "Someone". See design §9 rule 3.
   */
  actorNameVisible?: boolean;
  /** Present ONLY when actorNameVisible === true. */
  actorDisplayName?: string;
}

/** A row out of `public.room_notifications`. */
export interface RoomNotification {
  id: string;
  recipientId: string;
  debateId: string;
  argumentId: string | null;
  type: RoomNotificationType;
  roomTitle: string;
  meta: NotificationMeta;
  readAt: string | null;
  createdAt: string;
}

/** The deep-link target a navigable notification resolves to. */
export interface NotificationDeepLink {
  debateId: string;
  /** Null = open the room root. */
  activeArgumentId: string | null;
}

/** The classifier's input from inside `submit-argument`. */
export interface ClassifyArgumentTriggerInput {
  argumentType: string;
  parentArgumentType: string | null;
  /** QOL-041 acceptance gradient on the just-inserted move, if any. */
  concessionAcceptanceGradient: string | null;
  /** EV-003 — TRUE when this insert closes an open evidence-debt marker. */
  resolvesEvidenceDebt: boolean;
  /** EV-002 — TRUE when this insert opens an evidence-debt marker. */
  opensEvidenceDebt: boolean;
}

/** Inputs to `resolveRecipients`. */
export interface ResolveRecipientsContext {
  authorId: string;
  primaryIds: string[];
  observerIds: string[];
  challengedConcessionAuthorId?: string;
  sourceRequestTargetId?: string;
  sourceRequesterId?: string;
  /** For room_made_private — every user who had read access before the transition. */
  priorReadAccessIds?: string[];
  /** For chime_in_rejected — the chime-in's author (an observer). */
  chimeInAuthorId?: string;
  /** For invite_accepted_by_invitee — the inviter. */
  inviterId?: string;
  /** For `invite` — the existing invitee account, when one exists. */
  inviteeUserId?: string;
}

// ── Plain-language nouns for copy (no raw codes leak) ─────────

/**
 * The neutral noun for `meta.classification`. Plain words, not
 * the enum value. Unknown codes return null (the copy builder
 * suppresses them rather than echo a raw token).
 */
function classificationNoun(c: NotificationMeta['classification']): string | null {
  if (c === 'framing') return 'framing';
  if (c === 'context') return 'context';
  if (c === 'fact') return 'fact';
  return null;
}

/**
 * Pick the actor descriptor — display name when visibility allows,
 * "Someone" otherwise. See design §9 rule 3.
 */
function actorDescriptor(meta: NotificationMeta): string {
  const name = meta.actorDisplayName?.trim();
  if (meta.actorNameVisible === true && name && name.length > 0) {
    return name;
  }
  return 'Someone';
}

/**
 * Fall back to a generic noun when the title snapshot is empty.
 * Mirrors the storyboard's "blank title → root-claim excerpt"
 * rule, except a notification uses a generic noun, never the
 * root body (no body text in notifications).
 */
function roomLabel(roomTitle: string): string {
  const t = roomTitle?.trim() ?? '';
  return t.length > 0 ? t : 'an argument';
}

// ── Copy builder ─────────────────────────────────────────────

/**
 * The deterministic copy builder. Pure: (type, title, meta) →
 * string. The single home of every user-facing notification
 * string. NEVER receives or emits room body text.
 */
export function buildNotificationCopy(
  type: RoomNotificationType,
  roomTitle: string,
  meta: NotificationMeta,
): { title: string; body: string } {
  const room = roomLabel(roomTitle);
  switch (type) {
    case 'invite': {
      const isPrivate = meta.roomIsPrivate === true;
      if (isPrivate) {
        return {
          title: 'You were invited to a private argument',
          body: `${room}`,
        };
      }
      return {
        title: 'You were invited to respond to an argument',
        body: `${room}`,
      };
    }
    case 'new_response': {
      return {
        title: 'New response',
        body: `${room}`,
      };
    }
    case 'concession_challenged': {
      const noun = classificationNoun(meta.classification);
      return {
        title: 'Your concession was challenged',
        body: noun
          ? `${room} — on ${noun}.`
          : `${room}`,
      };
    }
    case 'source_requested': {
      return {
        title: 'A source was requested',
        body: `${room}`,
      };
    }
    case 'evidence_supplied': {
      return {
        title: 'Evidence was supplied',
        body: `${room}`,
      };
    }
    case 'chime_in_posted': {
      const who = actorDescriptor(meta);
      return {
        title: `${who} chimed in`,
        body: `${room}`,
      };
    }
    case 'room_made_private': {
      return {
        title: 'This argument was made private',
        body: `${room}`,
      };
    }
    case 'chime_in_rejected': {
      // Neutral framing per design §9 rule 5 + Scenario 1 Step 14:
      // describes the move's fit to the room, NEVER the person.
      // Never says "rejected you", never names a rejecter.
      return {
        title: 'Your chime-in was marked unwanted',
        body: `${room} — both primary participants asked to set it aside.`,
      };
    }
    case 'argument_settled': {
      return {
        title: 'This argument is settled',
        body: `${room}`,
      };
    }
    case 'invite_accepted_by_invitee': {
      const who = actorDescriptor(meta);
      return {
        title: `${who} joined`,
        body: `${room}`,
      };
    }
  }
}

// ── Deep-link resolution ─────────────────────────────────────

/**
 * Returns a deep-link target for navigable notifications. Returns
 * `null` for notifications whose recipient no longer has access to
 * the room — the list renders a read-only confirmation instead of
 * attempting a navigation the room screen would then deny.
 *
 * Per design §8: when the type is room_made_private OR the row is
 * a chime_in_rejected whose access has been revoked, the deep
 * link is null. For revoked chime_in_rejected, the caller
 * indicates revocation via `meta.roomIsPrivate === true` —
 * "private + non-author" already means no room access.
 */
export function resolveDeepLink(
  n: RoomNotification,
): NotificationDeepLink | null {
  if (n.type === 'room_made_private') return null;
  if (n.type === 'chime_in_rejected' && n.meta.roomIsPrivate === true) {
    // The chime-in author is by definition an observer, and the
    // room transitioned private — they no longer have access.
    return null;
  }
  return {
    debateId: n.debateId,
    activeArgumentId: n.argumentId ?? null,
  };
}

// ── Trigger classifier ───────────────────────────────────────

/**
 * Classifier used inside `submit-argument` to decide which
 * argument-derived trigger (if any) fires off a successful insert.
 * Returns at most one trigger, or null. See design §5.1 and §10
 * "Multi-meaning move": when an insert qualifies for multiple
 * argument-derived triggers, the MORE SPECIFIC one wins
 * (evidence_supplied / concession_challenged / source_requested
 * all outrank the bare new_response).
 *
 * Pure: no Date, no I/O. The full classification is deterministic
 * given the named input fields.
 */
export function classifyArgumentTrigger(
  input: ClassifyArgumentTriggerInput,
): RoomNotificationType | null {
  if (!input || typeof input.argumentType !== 'string') return null;

  // Most-specific first: evidence supplied closes a debt.
  if (input.resolvesEvidenceDebt === true) return 'evidence_supplied';

  // Next: concession-acceptance with a disagree gradient = a
  // challenge. The QOL-041 gradient values include 'agree',
  // 'partial', 'disagree', 'disagree_strong', etc.; any value
  // OTHER than 'agree' is a disagree-direction grade. An empty /
  // null gradient is not a concession challenge.
  const grad = (input.concessionAcceptanceGradient || '').toLowerCase();
  if (grad.length > 0 && grad !== 'agree') {
    return 'concession_challenged';
  }

  // Next: a move that OPENS an evidence debt is a source request.
  // This covers EV-002 "Ask for source" / "Ask quote" inserts.
  if (input.opensEvidenceDebt === true) return 'source_requested';

  // Otherwise: a plain response if the type is one of the
  // response argument types. Anything else (own-thesis on a brand
  // new room, an unknown type, a moderator note) produces no
  // notification.
  const t = input.argumentType.toLowerCase();
  if (
    t === 'rebuttal' ||
    t === 'counter_rebuttal' ||
    t === 'clarification' ||
    t === 'clarification_request' ||
    t === 'synthesis' ||
    t === 'respond' ||
    t === 'respond_to_concession'
  ) {
    return 'new_response';
  }

  return null;
}

// ── Recipient resolver ───────────────────────────────────────

/**
 * Given the trigger + participant lists + author, return the
 * recipient user-id set. The author never self-notifies (every
 * code path strips `authorId` before returning). Empty array
 * means "no notification rows are inserted for this trigger".
 *
 * Per design §9 rule 2: recipient sets are computed from ACCESS,
 * not convenience. Only users authorised to know the room exists
 * appear.
 */
export function resolveRecipients(
  type: RoomNotificationType,
  ctx: ResolveRecipientsContext,
): string[] {
  if (!ctx || typeof ctx.authorId !== 'string') return [];
  const author = ctx.authorId;
  const primaries = Array.isArray(ctx.primaryIds) ? ctx.primaryIds : [];
  const observers = Array.isArray(ctx.observerIds) ? ctx.observerIds : [];

  const dedupe = (ids: Array<string | undefined | null>): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      if (typeof id !== 'string' || id.length === 0) continue;
      if (id === author) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  };

  switch (type) {
    case 'invite': {
      // Only for an existing-account invitee. If the invitee has
      // no auth.users row at create time, the caller does not
      // pass `inviteeUserId` and no row is created — design §10
      // row 7 + E2.1.
      return dedupe([ctx.inviteeUserId]);
    }
    case 'new_response': {
      // Every primary EXCEPT the author.
      return dedupe(primaries);
    }
    case 'concession_challenged': {
      // The author of the challenged concession (never the
      // challenger themselves).
      return dedupe([ctx.challengedConcessionAuthorId]);
    }
    case 'source_requested': {
      // The participant the source was asked of.
      return dedupe([ctx.sourceRequestTargetId]);
    }
    case 'evidence_supplied': {
      // The user who requested the source.
      return dedupe([ctx.sourceRequesterId]);
    }
    case 'chime_in_posted': {
      // Both primaries. The chime-in author is an observer; the
      // dedupe step strips them if they happen to be a primary
      // too (defensive).
      return dedupe(primaries);
    }
    case 'room_made_private': {
      // Every user who had read access BEFORE the transition,
      // EXCEPT current participants (they still have access; the
      // notification is for those who lost it). The Edge Function
      // computes the prior-access set; this resolver trusts it.
      const lost = (ctx.priorReadAccessIds || []).filter(
        (id) => !primaries.includes(id) && !observers.includes(id),
      );
      return dedupe(lost);
    }
    case 'chime_in_rejected': {
      // The chime-in's author only.
      return dedupe([ctx.chimeInAuthorId]);
    }
    case 'argument_settled': {
      // Both primaries. Author (the room-settle initiator) is
      // stripped by dedupe.
      return dedupe(primaries);
    }
    case 'invite_accepted_by_invitee': {
      // The inviter. The author (the invitee who just accepted)
      // is stripped by dedupe — they don't notify themselves.
      return dedupe([ctx.inviterId]);
    }
  }
}
