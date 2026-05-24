/**
 * Edge Function: record-visibility-transition (QOL-039)
 *
 * Atomic-equivalent handling of a room visibility transition:
 *
 *   1. Verify caller JWT.
 *   2. Verify caller is the room creator (OD-1: creator-only gate).
 *   3. Re-derive current visibility; refuse 409 if already private.
 *   4. UPDATE `public.debates` SET visibility='private' WHERE id=$debateId.
 *      (The §4.2 BEFORE UPDATE trigger guarantees one-way at the DB.)
 *   5. Derive the in-flight `RoomVisibilityChangeEvent` payload:
 *        - `priorReadAccessIds` from debate_participants (+ optional
 *          observers; v1 ships participants as the primary signal).
 *        - `rejectedChimeInUserIds` + `rejected_chime_in_ids` from a
 *          best-effort scan of recent observer chime-ins on the debate.
 *   6. INSERT the audit row with the counts + rejected chime-in ARGUMENT
 *      IDs (per OD-2). Failure → partial_success: 200 with
 *      `auditWritten: false`; the operator reconciles via structured log.
 *   7. POST `room-notifications` with `type='room_made_private'` carrying
 *      `priorReadAccessIds`. Track the result; never roll back on failure.
 *   8. For each rejected chime-in argument, POST `room-notifications`
 *      with `type='chime_in_rejected'`. Track per-channel results.
 *   9. Return 200 with per-channel statuses.
 *
 * Security model (per cdiscourse-doctrine + supabase-edge-contract):
 *   - verify_jwt = true (set in config.toml).
 *   - The service-role client is used ONLY after the per-action
 *     authorization check passes, for the visibility UPDATE, the audit
 *     INSERT, and the cross-function notification dispatches.
 *   - The function NEVER reverses a private room — the §4.2 trigger
 *     would reject it anyway; the function never tries.
 *   - The function NEVER returns prior-read-access user IDs to the
 *     client (the response shape carries counts + per-channel statuses).
 *   - The function NEVER logs Authorization headers, JWTs, Bearer
 *     tokens, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, or recipient
 *     emails.
 *   - A notification dispatch failure on ANY channel is logged and
 *     surfaced in the response; the transition is NEVER rolled back
 *     (mirrors the submit-argument notification side-effect pattern).
 *
 * NEVER MODIFIES a `public.arguments` row (visibility is access only).
 */
import {
  corsHeaders,
  ok,
  badRequest,
  unauthorized,
  forbidden,
  methodNotAllowed,
  internalError,
} from '../_shared/http.ts';
import { createCallerClient, createServiceClient } from '../_shared/supabaseClients.ts';

interface RecordVisibilityTransitionRequestBody {
  debateId: string;
  triggerKind?: 'manual_creator_action';
}

interface DebateRow {
  id: string;
  created_by: string;
  status: string;
  title: string | null;
  visibility: string;
}

interface ParticipantRow {
  user_id: string;
  side: string;
}

interface ArgumentRow {
  id: string;
  author_id: string;
  parent_id: string | null;
  argument_type: string | null;
  status: string;
}

type NotificationStatus = 'sent' | 'queued' | 'not_configured' | 'skipped';

interface ChimeInRejectedStatus {
  argumentId: string;
  status: NotificationStatus;
}

interface RecordVisibilityTransitionResponse {
  transitionId: string;
  retainedParticipantCount: number;
  droppedParticipantCount: number;
  rejectedChimeInCount: number;
  auditWritten: boolean;
  notificationsDispatched: {
    roomMadePrivate: NotificationStatus;
    chimeInRejected: ChimeInRejectedStatus[];
  };
}

// ── Helpers ──────────────────────────────────────────────────

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function shortId(id: string | null | undefined): string {
  return typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Entry point ──────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return methodNotAllowed();

  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return unauthorized();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest('invalid_json');
  }
  const body = raw as Partial<RecordVisibilityTransitionRequestBody>;
  if (!isUuid(body.debateId)) return badRequest('debate_id_required');

  // ── 1. Verify caller. ──
  const callerClient = createCallerClient(auth);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;

  try {
    return await handleTransition(body.debateId as string, callerId, auth);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('record_visibility_transition_error', {
      debateIdShort: shortId(body.debateId as string),
      message: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    });
    return internalError('transition_failed');
  }
});

async function handleTransition(
  debateId: string,
  callerId: string,
  authHeader: string,
): Promise<Response> {
  const svc = createServiceClient();

  // ── 2. Load the debate via service-role (we need created_by for the
  //      OD-1 creator-only check; RLS visibility for the caller is
  //      irrelevant here — only authorisation is). ──
  const { data: debate, error: debateErr } = await svc
    .from('debates')
    .select('id, created_by, status, title, visibility')
    .eq('id', debateId)
    .maybeSingle<DebateRow>();
  if (debateErr) return internalError('debate_lookup_failed');
  if (!debate) return jsonError(404, 'debate_not_found', 'We could not find that argument.');

  // OD-1: creator-only gate. The DB+RLS layer keeps the existing
  // creator-or-mod permission as defense-in-depth, but this Edge Function
  // enforces creator-only at the server layer because QOL-040's
  // `room-notifications` `handleRoomMadePrivate` likewise requires the
  // creator. Allowing mods here would produce a partial-success state
  // where the room becomes private but no `room_made_private` notification
  // fires for retained participants.
  if (debate.created_by !== callerId) return forbidden('not_creator');

  // ── 3. Re-derive current visibility. ──
  if (debate.visibility === 'private') {
    return jsonError(409, 'already_private', 'This argument is already private.');
  }

  // ── 4. UPDATE — flip to private. The §4.2 BEFORE UPDATE trigger
  //      guarantees this is one-way; no need for the caller to specify
  //      a direction. ──
  const { error: updateErr } = await svc
    .from('debates')
    .update({ visibility: 'private' })
    .eq('id', debateId)
    .eq('visibility', 'public'); // optimistic-concurrency guard
  if (updateErr) {
    // eslint-disable-next-line no-console
    console.error('debate_visibility_update_failed', {
      debateIdShort: shortId(debateId),
      message: String(updateErr.message || '').slice(0, 120),
    });
    return internalError('update_failed');
  }

  const occurredAt = new Date().toISOString();

  // ── 5. Derive the in-flight event payload. ──
  // 5a. participants — both retained primaries and dropped observers.
  const { data: participants } = await svc
    .from('debate_participants')
    .select('user_id, side')
    .eq('debate_id', debateId);
  const partList = (participants || []) as ParticipantRow[];

  const retainedUserIds = new Set<string>();
  const droppedUserIds = new Set<string>();
  for (const p of partList) {
    if (p.side === 'affirmative' || p.side === 'negative' || p.side === 'moderator') {
      retainedUserIds.add(p.user_id);
    } else if (p.side === 'observer') {
      droppedUserIds.add(p.user_id);
    }
  }
  // The caller (creator) is retained but defensively never the recipient
  // of their own `room_made_private` notification — the QOL-040 Edge
  // Function strips them server-side. We keep them in `priorReadAccessIds`
  // for full fidelity.
  const priorReadAccessIds = Array.from(new Set<string>([
    ...retainedUserIds,
    ...droppedUserIds,
  ]));

  // 5b. Rejected chime-in branches — best-effort scan of recent observer
  // chime-ins on this debate. Per design §6.3, the chime-in branches are
  // ALREADY visually muted by GAME-005's `observer_only` rendering; the
  // transition just changes who can read them. The notification is fired
  // per chime-in ARGUMENT (not per branch). We surface chime-in arguments
  // by joining `arguments` to participants that are `observer`-side.
  const { data: candidateChimeInArgs } = await svc
    .from('arguments')
    .select('id, author_id, parent_id, argument_type, status')
    .eq('debate_id', debateId)
    .eq('status', 'posted')
    .in('author_id', Array.from(droppedUserIds));
  const candidateArgs = (candidateChimeInArgs || []) as ArgumentRow[];

  // Deduplicate by argument id; keep them in insertion order. A given
  // observer may have posted multiple chime-in arguments; we treat each
  // as its own rejection-target (QOL-040's `chime_in_rejected` is
  // argument-scoped, not user-scoped).
  const seenArgIds = new Set<string>();
  const rejectedChimeInArgs: ArgumentRow[] = [];
  for (const a of candidateArgs) {
    if (!seenArgIds.has(a.id)) {
      seenArgIds.add(a.id);
      rejectedChimeInArgs.push(a);
    }
  }
  const rejectedChimeInArgumentIds = rejectedChimeInArgs.map((a) => a.id);
  // The user-id projection is intentionally NOT used in the dispatch
  // payload — QOL-040's `chime_in_rejected` notification is
  // argument-scoped (the recipient is derived server-side from
  // `arguments.author_id`). The user-id set is documented in the design's
  // `RoomVisibilityChangeEvent` shape for completeness; the Edge Function
  // derives recipients from `argumentId` and never trusts a caller-supplied
  // recipient list for that trigger.

  // ── 6. INSERT the audit row. Failures are logged but never roll back
  //      the UPDATE; the operator reconciles via the structured log. ──
  let auditWritten = false;
  let transitionId = '';
  try {
    const { data: auditInserted, error: auditErr } = await svc
      .from('room_visibility_changes')
      .insert({
        debate_id: debateId,
        trigger_kind: 'manual_creator_action',
        triggered_by_user_id: callerId,
        transitioned_at: occurredAt,
        retained_participant_count: retainedUserIds.size,
        dropped_participant_count: droppedUserIds.size,
        rejected_chime_in_count: rejectedChimeInArgumentIds.length,
        rejected_chime_in_ids: rejectedChimeInArgumentIds,
      })
      .select('transition_id')
      .single();
    if (auditErr || !auditInserted) {
      // eslint-disable-next-line no-console
      console.error('audit_insert_failed', {
        debateIdShort: shortId(debateId),
        message: String(auditErr?.message || 'unknown').slice(0, 120),
      });
    } else {
      auditWritten = true;
      transitionId = (auditInserted as { transition_id: string }).transition_id;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('audit_insert_exception', {
      debateIdShort: shortId(debateId),
      message: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    });
  }

  // ── 7. Dispatch `room_made_private`. Best-effort; never rolls back. ──
  let roomMadePrivateStatus: NotificationStatus = 'skipped';
  try {
    const roomMadePrivateRes = await invokeRoomNotifications(authHeader, {
      type: 'room_made_private',
      debateId,
      priorReadAccessIds,
    });
    roomMadePrivateStatus = roomMadePrivateRes;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('notification_failed', {
      trigger: 'room_made_private',
      debateIdShort: shortId(debateId),
      message: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    });
    roomMadePrivateStatus = 'queued';
  }

  // ── 8. Dispatch `chime_in_rejected` per chime-in argument. ──
  const chimeInRejectedResults: ChimeInRejectedStatus[] = [];
  for (const arg of rejectedChimeInArgs) {
    let status: NotificationStatus = 'skipped';
    try {
      status = await invokeRoomNotifications(authHeader, {
        type: 'chime_in_rejected',
        debateId,
        argumentId: arg.id,
        meta: { roomIsPrivate: true },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('notification_failed', {
        trigger: 'chime_in_rejected',
        debateIdShort: shortId(debateId),
        argumentIdShort: shortId(arg.id),
        message: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
      });
      status = 'queued';
    }
    chimeInRejectedResults.push({ argumentId: arg.id, status });
  }

  // ── 9. Respond. ──
  // Structured log for the success path. Note: we log COUNTS only — never
  // priorReadAccessIds, never rejected user IDs, never argument bodies.
  // eslint-disable-next-line no-console
  console.info('record_visibility_transition_succeeded', {
    debateIdShort: shortId(debateId),
    triggeredByShort: shortId(callerId),
    retainedParticipantCount: retainedUserIds.size,
    droppedParticipantCount: droppedUserIds.size,
    rejectedChimeInCount: rejectedChimeInArgumentIds.length,
    auditWritten,
    roomMadePrivateStatus,
    chimeInRejectedDispatched: chimeInRejectedResults.length,
  });

  const response: RecordVisibilityTransitionResponse = {
    transitionId,
    retainedParticipantCount: retainedUserIds.size,
    droppedParticipantCount: droppedUserIds.size,
    rejectedChimeInCount: rejectedChimeInArgumentIds.length,
    auditWritten,
    notificationsDispatched: {
      roomMadePrivate: roomMadePrivateStatus,
      chimeInRejected: chimeInRejectedResults,
    },
  };
  return ok(response);
}

// ── Cross-function call to room-notifications ────────────────

interface RoomNotificationsBody {
  type: 'room_made_private' | 'chime_in_rejected';
  debateId: string;
  argumentId?: string;
  priorReadAccessIds?: string[];
  meta?: { roomIsPrivate?: boolean };
}

/**
 * Call the QOL-040 `room-notifications` Edge Function. The function
 * already enforces creator-only for `room_made_private` and primary-only
 * for `chime_in_rejected`. We pass the caller's JWT through; the receiving
 * function re-derives authorisation from the DB and rejects mismatches.
 *
 * We never read the response body except to derive the status — the
 * function returns `{ delivered: <count> }` plus optionally `{ notification }`
 * for the invite trigger; the count value is not part of QOL-039's
 * response shape (we surface only sent/queued/skipped/not_configured).
 */
async function invokeRoomNotifications(
  authHeader: string,
  body: RoomNotificationsBody,
): Promise<NotificationStatus> {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/room-notifications`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Pass the caller's JWT through. The receiving function re-derives
      // auth from the DB, so this is correct.
      authorization: authHeader,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Drain body without echoing it.
    try { await res.text(); } catch { /* swallow */ }
    return 'queued';
  }
  // Drain and discard the body; the count value is not surfaced in
  // QOL-039's response shape.
  try { await res.text(); } catch { /* swallow */ }
  return 'sent';
}
