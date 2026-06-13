import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
// ARG-ROOM-004 — extract the raw token from the create-time inviteLink so the
// create-time notification can pass it to the gated transports. Pure parser;
// no React, no network.
import { parseInviteDeepLink } from '../invites/inviteDeepLink';
// ARG-ROOM-005 — classify a join write error into a seat outcome (room_full /
// already_* / unavailable / error) WITHOUT surfacing any count or DETAIL. Pure;
// no React, no network.
import {
  classifyJoinOutcome,
  type JoinOutcomeKind,
  type JoinSuccessOutcome,
} from './seatClaimModel';
import type {
  Debate,
  CreateDebateInput,
  CreatedRoom,
  ParticipantSide,
  JoinResult,
  DebateApiResult,
  RoomVisibility,
} from './types';

// ── Row types ─────────────────────────────────────────────────

interface DebateRow {
  id: string;
  created_by: string;
  title: string;
  resolution: string;
  description: string;
  status: string;
  constitution_id: string;
  created_at: string;
  updated_at: string;
  /** QOL-039 — column added by migration `20260524000015`. */
  visibility: string;
  /**
   * ADMIN-CONV-INACTIVE-VISIBILITY-001 — column added by migration
   * `20260606000001` (#514). `null` = active; non-null = inactive. The WHAT
   * only — `inactive_reason` is NEVER selected, mapped, or surfaced (§10a).
   */
  inactive_at: string | null;
}

interface ParticipantRow {
  debate_id: string;
  side: string;
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Coerce the DB column to the typed union, defaulting to `'public'` so a
 * pre-migration row (extremely unlikely; the migration backfills) or a
 * future-unknown value never undefined-poisons downstream consumers.
 */
function coerceVisibility(value: unknown): RoomVisibility {
  return value === 'private' ? 'private' : 'public';
}

function mapDebateRow(row: DebateRow, myParticipantSide: ParticipantSide | null): Debate {
  return {
    id: row.id,
    createdBy: row.created_by,
    title: row.title,
    resolution: row.resolution,
    description: row.description ?? '',
    status: row.status as Debate['status'],
    constitutionId: row.constitution_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    myParticipantSide,
    visibility: coerceVisibility(row.visibility),
    // ADMIN-CONV-INACTIVE-VISIBILITY-001 — thread the debate-level inactive
    // timestamp (#514). Default to null (active) when absent. `inactive_reason`
    // is never read here (§10a).
    inactiveAt: row.inactive_at ?? null,
  };
}

/** Returns true when the Supabase error is a unique-key violation (duplicate join). */
export function isAlreadyJoinedError(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

// ── API ───────────────────────────────────────────────────────

export async function listDebates(userId: string): Promise<DebateApiResult<Debate[]>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  const [debatesRes, partRes] = await Promise.all([
    supabase
      .from('debates')
      .select('id, created_by, title, resolution, description, status, constitution_id, created_at, updated_at, visibility, inactive_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('debate_participants')
      .select('debate_id, side')
      .eq('user_id', userId),
  ]);

  if (debatesRes.error) return { ok: false, error: debatesRes.error.message };

  const sideMap = new Map<string, ParticipantSide>();
  for (const p of (partRes.data ?? []) as ParticipantRow[]) {
    sideMap.set(p.debate_id, p.side as ParticipantSide);
  }

  // QOL-039 — RLS at `debates: select public-open, own, or participant`
  // already withholds private rooms the caller cannot see. No belt-and-
  // suspenders WHERE clause here; the RLS boundary is authoritative.
  const debates = ((debatesRes.data ?? []) as DebateRow[]).map((row) =>
    mapDebateRow(row, sideMap.get(row.id) ?? null),
  );

  return { ok: true, data: debates };
}

// ── ARG-ROOM-002 — server-authoritative room creation ─────────

/** Column projection for a single `debates` row (shared by reads). */
const DEBATE_ROW_COLUMNS =
  'id, created_by, title, resolution, description, status, constitution_id, created_at, updated_at, visibility, inactive_at';

/**
 * ARG-ROOM-002 — input to the server-authoritative create path. The chosen
 * visibility plus an OPTIONAL single direct invite (max one per room). The
 * binding matrix (private => invite, <= 1 invite, no self-invite) is enforced
 * SERVER-SIDE by the `create-argument-room` Edge Function + its RPC; this is
 * the advisory client shape (mirrors `argumentRoomCreationMatrix`).
 */
export interface CreateArgumentRoomInput {
  title: string;
  resolution: string;
  description?: string;
  visibility: RoomVisibility;
  invite?: { email: string; intendedSeat?: 'respondent' | 'co_primary' };
}

/**
 * The `create-argument-room` Edge Function response. `inviteLink` carries the
 * raw token and is returned to the CREATOR exactly once at create time — never
 * stored, never logged, never re-fetchable. Null when there is no invite.
 */
export interface CreateArgumentRoomResult {
  debateId: string;
  visibility: RoomVisibility;
  inviteId: string | null;
  inviteLink: string | null;
}

/**
 * Create an argument room through the server-authoritative
 * `create-argument-room` Edge Function. After ARG-ROOM-002's migration drops
 * the client `debates` INSERT policy, this Edge path (its SECURITY DEFINER RPC)
 * is the ONLY room creator — a direct client `debates` insert is refused by
 * RLS. The function atomically inserts the room + the creator participant +
 * (optionally) the one invite, enforcing private => invite and <= 1 invite.
 * The client never holds a service-role key.
 */
export async function createArgumentRoom(
  input: CreateArgumentRoomInput,
): Promise<DebateApiResult<CreateArgumentRoomResult>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  const visibility: RoomVisibility = input.visibility === 'private' ? 'private' : 'public';
  const body: Record<string, unknown> = {
    title: input.title.trim(),
    resolution: input.resolution.trim(),
    description: (input.description ?? '').trim(),
    visibility,
  };
  if (input.invite) {
    body.invite = {
      email: input.invite.email.trim(),
      intendedSeat: input.invite.intendedSeat ?? 'respondent',
    };
  }

  const { data, error } = await supabase.functions.invoke<CreateArgumentRoomResult>(
    'create-argument-room',
    { body },
  );

  if (error || !data) {
    // Neutral, plain-language fallback — never echo a raw internal code
    // (doctrine §9). The denial codes (`private_requires_invite`,
    // `room_capacity_reached`) map through `gameCopy.toPlainLanguage` for the
    // create surface that wants tailored copy.
    return {
      ok: false,
      error: error?.message ?? 'Could not create the argument. Try again in a moment.',
    };
  }

  return { ok: true, data };
}

/**
 * ARG-ROOM-004 — fire the create-time invitee notification (best-effort).
 *
 * `create-argument-room` stays enumeration-safe + branch-free by contract (it
 * never decides new-vs-existing). So after it mints the room + invite, the
 * client triggers `room-notifications` — the seam that already holds the
 * new-vs-existing `listUsers` split + the gated existing-user Resend transport,
 * plus the gated new-user Auth-invite bridge. BOTH transports are OFF by
 * default, so this call is DORMANT (no email) until the operator flips a gate.
 *
 * BEST-EFFORT by design: it NEVER throws and its result is discarded, so a
 * slow / failed / dormant send never blocks room creation, never rolls back the
 * created room/invite, and never leaks existing-vs-new to the inviter (the
 * create response is already enumeration-safe; this response is not surfaced).
 * The raw token rides in the request body to a JWT-authed, caller=inviter-
 * authorized function and is never logged client-side.
 */
export async function notifyCreateTimeInvite(input: {
  debateId: string;
  inviteId: string;
  inviteToken: string;
  roomIsPrivate: boolean;
}): Promise<void> {
  if (!SUPABASE_CONFIGURED) return;
  try {
    await supabase.functions.invoke('room-notifications', {
      body: {
        type: 'invite',
        debateId: input.debateId,
        inviteId: input.inviteId,
        inviteToken: input.inviteToken,
        meta: { roomIsPrivate: input.roomIsPrivate },
      },
    });
  } catch {
    // Best-effort: never block create. The inviter's copyable link is the
    // fallback and the invite row stays retryable.
  }
}

/**
 * Back-compatible creation wrapper. Keeps the `(input, userId)` signature the
 * live surface (`useDebates().create` -> `StartArgumentPage`) already uses, but
 * routes through the server-authoritative `createArgumentRoom` Edge path
 * instead of the (now-removed) direct client `debates` insert + creator
 * auto-join. The creator's identity is taken from the JWT inside the Edge
 * Function, so the `userId` argument is retained ONLY for signature
 * compatibility and is intentionally unused here.
 *
 * ARG-ROOM-008 — the success result now carries the one-time create-time
 * `inviteLink` ALONGSIDE the loaded `Debate` (a `CreatedRoom`), instead of
 * discarding it. The raw link is the only client-side moment that token exists;
 * the create surface renders it once (inviter-only) so a private room created
 * with invite email OFF still has a reachable invitee. We never log or persist
 * it here — it rides through to the caller unchanged. The ARG-ROOM-004
 * fire-and-forget notify path below is untouched.
 */
export async function createDebate(
  input: CreateDebateInput,
  _userId: string,
): Promise<DebateApiResult<CreatedRoom>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  const created = await createArgumentRoom({
    title: input.title,
    resolution: input.resolution,
    description: input.description,
    visibility: input.visibility === 'private' ? 'private' : 'public',
    // ARG-ROOM-003 — thread the one optional direct invite from the create
    // surface into the SAME atomic Edge call. Omitted entirely when absent so
    // the public/no-invite body is unchanged. `createArgumentRoom` trims the
    // email and defaults `intendedSeat` to `'respondent'`.
    ...(input.invite ? { invite: input.invite } : {}),
  });
  if (!created.ok) return { ok: false, error: created.error };

  // Load the created room to return the full `Debate` shape. The creator was
  // auto-joined as `moderator` by the RPC, so myParticipantSide is 'moderator'.
  // RLS lets the creator read their own room.
  const { data: debate, error: debateError } = await supabase
    .from('debates')
    .select(DEBATE_ROW_COLUMNS)
    .eq('id', created.data.debateId)
    .single();

  if (debateError || !debate) {
    return {
      ok: false,
      error:
        debateError?.message ??
        'The argument was created, but could not be loaded. Refresh to see it.',
    };
  }

  // ARG-ROOM-004 — fire the create-time invitee notification (best-effort,
  // fire-and-forget). The room + invite are already durably committed above,
  // so this never blocks the create return and a failed send never rolls back
  // the room. The raw token rides in the create-time `inviteLink` (the only
  // place it exists client-side); we extract it for the gated transports.
  // Both transports default OFF → dormant on merge.
  if (created.data.inviteId && created.data.inviteLink) {
    const parsedToken = parseInviteDeepLink(created.data.inviteLink);
    if (parsedToken) {
      void notifyCreateTimeInvite({
        debateId: created.data.debateId,
        inviteId: created.data.inviteId,
        inviteToken: parsedToken.token,
        roomIsPrivate: input.visibility === 'private',
      });
    }
  }

  // ARG-ROOM-008 — return the raw create-time `inviteLink` alongside the
  // loaded room. `null` when there was no invite (public, no email). The link
  // is NOT logged or persisted here; the create surface renders it once,
  // inviter-only, then discards it.
  return {
    ok: true,
    data: {
      debate: mapDebateRow(debate as DebateRow, 'moderator'),
      inviteLink: created.data.inviteLink,
    },
  };
}

/**
 * ARG-ROOM-005 — `joinDebate` result, widened (client-only) to carry the
 * classified seat outcome alongside the existing `JoinResult`. A failed CLAIM
 * is not always an error: a full room (`room_full`) degrades gracefully to the
 * observe affordance rather than the generic error banner. The shared
 * `DebateApiResult<T>` is left untouched; this is a local discriminant.
 */
export type JoinDebateResult =
  | { ok: true; data: JoinResult; outcome: JoinSuccessOutcome }
  | { ok: false; error: string; outcome: JoinOutcomeKind };

export async function joinDebate(
  debateId: string,
  side: ParticipantSide,
  userId: string,
): Promise<JoinDebateResult> {
  if (!SUPABASE_CONFIGURED) {
    return { ok: false, error: 'Supabase is not configured.', outcome: 'unavailable' };
  }

  // ARG-ROOM-005 — STILL the single `debate_participants` INSERT. The claim
  // path never writes `argument_room_invites`, so a public join can never steal
  // the reserved invite seat (proof 7). The cap is enforced by the deployed
  // ARG-ROOM-002 BEFORE INSERT trigger; we surface + classify its refusal, we
  // never re-enforce it.
  const { error } = await supabase
    .from('debate_participants')
    .insert({ debate_id: debateId, user_id: userId, side });

  if (error) {
    if (isAlreadyJoinedError(error)) {
      const { data: existing } = await supabase
        .from('debate_participants')
        .select('side')
        .eq('debate_id', debateId)
        .eq('user_id', userId)
        .single();
      const existingSide = ((existing as { side?: string } | null)?.side ?? side) as ParticipantSide;
      // 23505 ⇒ already seated; the existing row's side decides active vs observer.
      const classified = classifyJoinOutcome(error, existingSide);
      const outcome: JoinSuccessOutcome =
        classified === 'already_observer' ? 'already_observer' : 'already_active';
      return { ok: true, data: { side: existingSide, alreadyJoined: true }, outcome };
    }
    // Classify WITHOUT reading error.details (the trigger DETAIL is discarded).
    return { ok: false, error: error.message, outcome: classifyJoinOutcome(error) };
  }

  return { ok: true, data: { side, alreadyJoined: false }, outcome: 'claimed' };
}

// ── QOL-039 — Room visibility transition ──────────────────────

/**
 * Result shape returned by the `record-visibility-transition` Edge Function
 * per E1.3 of the design. The Edge Function does the UPDATE, the audit row
 * INSERT, and the QOL-040 cross-function notification dispatches; the
 * client receives the per-channel statuses for any UI hook that needs them.
 */
export interface RoomVisibilityTransitionResult {
  transitionId: string;
  retainedParticipantCount: number;
  droppedParticipantCount: number;
  rejectedChimeInCount: number;
  notificationsDispatched: {
    roomMadePrivate: 'sent' | 'queued' | 'not_configured' | 'skipped';
    chimeInRejected: ReadonlyArray<{
      argumentId: string;
      status: 'sent' | 'queued' | 'not_configured' | 'skipped';
    }>;
  };
  /**
   * True when the visibility UPDATE landed but the audit-row INSERT
   * failed. The transition is still complete; the operator reconciles via
   * the Edge Function's structured log.
   */
  auditWritten: boolean;
}

/**
 * Client wrapper for the visibility transition. Per OD-3, this calls the
 * `record-visibility-transition` Edge Function rather than issuing a
 * direct `UPDATE`. The Edge Function:
 *
 *   1. Verifies the caller is the room creator (OD-1 enforcement).
 *   2. Re-derives current visibility — refuses on already-private (409).
 *   3. Performs the visibility UPDATE.
 *   4. Inserts the audit row with the counts + chime-in argument IDs (OD-2).
 *   5. Dispatches the QOL-040 `room_made_private` notification.
 *   6. Dispatches the QOL-040 `chime_in_rejected` notifications per chime-in.
 *
 * Notification dispatch failures never roll back the transition (mirrors
 * the `submit-argument` notification side-effect pattern).
 */
export async function transitionRoomToPrivate(
  debateId: string,
): Promise<DebateApiResult<RoomVisibilityTransitionResult>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  const { data, error } = await supabase.functions.invoke<RoomVisibilityTransitionResult>(
    'record-visibility-transition',
    {
      body: {
        debateId,
        triggerKind: 'manual_creator_action',
      },
    },
  );

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? 'Could not save the change. Try again in a moment.',
    };
  }

  return { ok: true, data };
}
