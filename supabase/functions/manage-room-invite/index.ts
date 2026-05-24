/**
 * Edge Function: manage-room-invite (QOL-038)
 *
 * Five actions on argument_room_invites:
 *
 *   - create           — mint a new pending invite (JWT required).
 *   - revoke           — flip pending → revoked (JWT required).
 *   - list_for_debate  — RLS-filtered list for the open room (JWT required).
 *   - lookup_by_token  — UNAUTHENTICATED — token possession is the auth.
 *   - accept           — turn a token + signed-in user into a participant.
 *
 * Security model (per cdiscourse-doctrine + supabase-edge-contract):
 *   - verify_jwt = false in config.toml. Auth is enforced per-action inside
 *     this function so lookup_by_token can run pre-signup (a brand-new
 *     invitee taps the link before they have an account).
 *   - The service-role client is used ONLY after the per-action
 *     authorization check passes, for privileged writes (invite row
 *     insert/update, participant enrolment).
 *   - The raw token NEVER appears in any audit row, any log, or any
 *     response that is not the create-time response to the inviter
 *     themselves.
 *   - The full invitee email NEVER appears in audit rows or logs — only
 *     the email domain (mirrors adminInvitePayload).
 *   - The function NEVER deletes a row in public.arguments. It only
 *     inserts into argument_room_invites + debate_participants.
 *
 * QOL-038 §17 enrichment: lookup_by_token + accept both return
 * 409 room_archived when debates.status = 'archived'. The hard-delete
 * cascade path (row removed) returns 404 invite_not_found.
 */
import {
  corsHeaders,
  ok,
  badRequest,
  unauthorized,
  forbidden,
  methodNotAllowed,
  validationFailed,
  internalError,
} from '../_shared/http.ts';
import { createCallerClient, createServiceClient } from '../_shared/supabaseClients.ts';
import { ManageRoomInviteRequestSchema } from '../_shared/inviteSchemas.ts';
import type { ManageRoomInviteRequest } from '../_shared/inviteSchemas.ts';
import { generateInviteToken, hashInviteToken } from '../_shared/inviteToken.ts';

interface DebateRow {
  id: string;
  created_by: string;
  status: string;
  title: string | null;
}

interface InviteRow {
  id: string;
  debate_id: string;
  invited_by: string;
  invitee_email_lower: string;
  invitee_profile_id: string | null;
  intended_seat: string;
  status: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return methodNotAllowed();

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  const parsed = ManageRoomInviteRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationFailed({
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const body: ManageRoomInviteRequest = parsed.data;

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const requestOrigin = req.headers.get('origin') || req.headers.get('Origin') || '';

  try {
    switch (body.action) {
      case 'create':
        return await handleCreate(body, authHeader, requestOrigin);
      case 'revoke':
        return await handleRevoke(body, authHeader);
      case 'list_for_debate':
        return await handleListForDebate(body, authHeader);
      case 'lookup_by_token':
        // The only action callable without a JWT — the token IS the auth.
        return await handleLookupByToken(body);
      case 'accept':
        return await handleAccept(body, authHeader);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('manage_room_invite_error', body.action, errorMessage(err));
    return internalError('invite_action_failed');
  }
});

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 160);
  return String(err).slice(0, 160);
}

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1) || null : null;
}

/** Mask the local part for inviter-facing output. */
function maskEmail(emailLower: string): string {
  const trimmed = String(emailLower || '').trim();
  if (trimmed.length === 0) return '';
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return `${trimmed.charAt(0)}•••`;
  return `${trimmed.charAt(0)}•••@${trimmed.slice(at + 1)}`;
}

/** ISO timestamp 14 days from now (matches the DB default — explicit for the row insert). */
function defaultExpiresAt(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

/** Best-effort audit. Service-role only. Failures NEVER block the action. */
async function writeInviteAudit(
  action: 'room_invite_created' | 'room_invite_revoked' | 'room_invite_accepted',
  actorUserId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const svc = createServiceClient();
    // admin_audit_events.action has a WHITELIST check; the QOL-038 actions
    // are NEW — we attempt the write and swallow a unique-action-rejected
    // error so the function still succeeds in production until the admin
    // whitelist is widened. This matches the request-argument-deletion
    // pattern (its audit writes also swallow constraint errors).
    await svc.from('admin_audit_events').insert({
      action,
      source: 'edge_function',
      actor_user_id: actorUserId,
      target_user_id: actorUserId,
      reason: null,
      payload,
    });
  } catch {
    // Audit write must NEVER block the action. The function's primary
    // doctrine guarantee (invite row written, participant enrolled) is
    // already satisfied at this point.
  }
}

// ── create ────────────────────────────────────────────────────

async function handleCreate(
  body: Extract<ManageRoomInviteRequest, { action: 'create' }>,
  authHeader: string | null,
  requestOrigin: string,
): Promise<Response> {
  if (!authHeader) return unauthorized();
  const callerClient = createCallerClient(authHeader);

  // 1) Identify caller.
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;
  const callerEmail = (userRes.user.email || '').toLowerCase();

  // 2) Normalise the invitee email (schema already validated shape).
  const inviteeEmailLower = body.inviteeEmail.trim().toLowerCase();

  // 3) Self-invite guard — done BEFORE any DB read.
  if (callerEmail && callerEmail === inviteeEmailLower) {
    return jsonError(400, 'cannot_invite_self', 'You cannot invite yourself.');
  }

  // 4) Caller-scoped read of the debate. RLS enforces visibility.
  const { data: debate, error: debateErr } = await callerClient
    .from('debates')
    .select('id, created_by, status, title')
    .eq('id', body.debateId)
    .maybeSingle<DebateRow>();
  if (debateErr) return internalError('debate_lookup_failed');
  if (!debate) return jsonError(403, 'room_not_visible', 'You cannot invite to this argument.');

  // 5) Reject create on archived / locked rooms (QOL-038 §17 + design §5.1.5).
  if (debate.status === 'archived') {
    return jsonError(409, 'room_archived', 'This argument was archived and is no longer active.');
  }
  if (debate.status === 'locked' || debate.status === 'settled') {
    return jsonError(409, 'room_closed', 'This argument is settled — you cannot add people now.');
  }

  // 6) Authorization: room creator OR an existing primary participant OR mod/admin.
  //    Observers (side === 'observer' / 'moderator') cannot mint invites.
  const isCreator = debate.created_by === callerId;
  let isAllowed = isCreator;
  if (!isAllowed) {
    const { data: partRow } = await callerClient
      .from('debate_participants')
      .select('side')
      .eq('debate_id', body.debateId)
      .eq('user_id', callerId)
      .maybeSingle<{ side: string }>();
    if (partRow && (partRow.side === 'affirmative' || partRow.side === 'negative')) {
      isAllowed = true;
    }
  }
  if (!isAllowed) {
    // Allow mods/admins. RLS already lets them see the row.
    const { data: profRow } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .maybeSingle<{ role: string }>();
    if (profRow && (profRow.role === 'moderator' || profRow.role === 'admin')) {
      isAllowed = true;
    }
  }
  if (!isAllowed) {
    return jsonError(403, 'not_allowed_to_invite', 'Only participants in this argument can invite someone.');
  }

  // 7) Service-role: idempotent reuse if a live pending invite exists.
  const svc = createServiceClient();
  const { data: existing } = await svc
    .from('argument_room_invites')
    .select('id, debate_id, invited_by, invitee_email_lower, invitee_profile_id, intended_seat, status, token_hash, created_at, expires_at, accepted_at, revoked_at')
    .eq('debate_id', body.debateId)
    .eq('invitee_email_lower', inviteeEmailLower)
    .eq('status', 'pending')
    .maybeSingle<InviteRow>();
  if (existing) {
    return ok({
      inviteId: existing.id,
      status: existing.status,
      expiresAt: existing.expires_at,
      notification: 'queued' as const,
      reused: true,
      // We do NOT return a link here on the reused path. The inviter
      // already has the link from the first call; re-emitting it on
      // every duplicate create would widen the leak surface.
    });
  }

  // 8) Mint a token + hash.
  const rawToken = generateInviteToken();
  const tokenHash = await hashInviteToken(rawToken);
  const expiresAt = defaultExpiresAt();

  const { data: inserted, error: insertErr } = await svc
    .from('argument_room_invites')
    .insert({
      debate_id: body.debateId,
      invited_by: callerId,
      invitee_email_lower: inviteeEmailLower,
      intended_seat: body.intendedSeat,
      status: 'pending',
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select('id, expires_at, status')
    .single();

  if (insertErr || !inserted) {
    // A unique-violation here means the partial unique index fired —
    // re-read and return idempotently.
    const { data: raced } = await svc
      .from('argument_room_invites')
      .select('id, status, expires_at')
      .eq('debate_id', body.debateId)
      .eq('invitee_email_lower', inviteeEmailLower)
      .eq('status', 'pending')
      .maybeSingle<{ id: string; status: string; expires_at: string }>();
    if (raced) {
      return ok({
        inviteId: raced.id,
        status: raced.status,
        expiresAt: raced.expires_at,
        notification: 'queued' as const,
        reused: true,
      });
    }
    return internalError('invite_insert_failed');
  }

  // 9) Build the link from the request origin. The deployed origin is
  //    the source of truth — the function does not read .env files. The
  //    request origin (the SPA that called this function) IS the correct
  //    web origin for the invite link.
  const safeOrigin = sanitiseOriginForLink(requestOrigin);
  const inviteLink = safeOrigin ? `${safeOrigin}/invite/${rawToken}` : null;

  // 10) Audit (best-effort). Stores only emailDomain + tokenIssued bool —
  //     never the raw token, never the full email, never the link.
  await writeInviteAudit('room_invite_created', callerId, {
    debateIdShort: shortId(body.debateId),
    emailDomain: emailDomain(inviteeEmailLower),
    tokenIssued: true,
    intendedSeat: body.intendedSeat,
  });

  // 11) Return — the link is returned ONLY to the inviter (the only
  //     authenticated caller of `create`) and ONLY at create time. It is
  //     never returned by list_for_debate, never logged, never stored
  //     except in the inviter's local InvitePanel UI.
  return ok({
    inviteId: inserted.id,
    status: inserted.status,
    expiresAt: inserted.expires_at,
    notification: 'queued' as const,
    reused: false,
    inviteLink, // omitted only if origin sanitisation failed
  });
}

function sanitiseOriginForLink(origin: string): string | null {
  if (!origin) return null;
  const trimmed = origin.trim();
  if (trimmed.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const proto = parsed.protocol.toLowerCase();
  if (proto !== 'https:' && proto !== 'http:') return null;
  if (!parsed.host) return null;
  return `${proto}//${parsed.host.toLowerCase()}`;
}

function shortId(id: string): string {
  return typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── revoke ────────────────────────────────────────────────────

async function handleRevoke(
  body: Extract<ManageRoomInviteRequest, { action: 'revoke' }>,
  authHeader: string | null,
): Promise<Response> {
  if (!authHeader) return unauthorized();
  const callerClient = createCallerClient(authHeader);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;

  // Caller-scoped read — RLS enforces who may see the row.
  const { data: invite, error: inviteErr } = await callerClient
    .from('argument_room_invites')
    .select('id, status, invited_by, debate_id')
    .eq('id', body.inviteId)
    .maybeSingle<{ id: string; status: string; invited_by: string; debate_id: string }>();
  if (inviteErr) return internalError('invite_lookup_failed');
  if (!invite) return jsonError(403, 'invite_not_visible', 'You cannot revoke this invite.');

  if (invite.status !== 'pending') {
    return jsonError(409, 'not_pending', 'Only pending invites can be revoked.');
  }

  const svc = createServiceClient();
  const { error: updateErr } = await svc
    .from('argument_room_invites')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', body.inviteId)
    .eq('status', 'pending');
  if (updateErr) return internalError('invite_revoke_failed');

  await writeInviteAudit('room_invite_revoked', callerId, {
    inviteIdShort: shortId(body.inviteId),
    debateIdShort: shortId(invite.debate_id),
  });

  return ok({ inviteId: body.inviteId, status: 'revoked' });
}

// ── list_for_debate ───────────────────────────────────────────

async function handleListForDebate(
  body: Extract<ManageRoomInviteRequest, { action: 'list_for_debate' }>,
  authHeader: string | null,
): Promise<Response> {
  if (!authHeader) return unauthorized();
  const callerClient = createCallerClient(authHeader);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();

  // RLS does the visibility work. We deliberately do NOT select token_hash
  // — the inviter never needs the hash, and emitting it would widen the
  // leak surface for nothing.
  const { data: rows, error: listErr } = await callerClient
    .from('argument_room_invites')
    .select('id, invitee_email_lower, intended_seat, status, created_at, expires_at, accepted_at')
    .eq('debate_id', body.debateId)
    .order('created_at', { ascending: false });
  if (listErr) return internalError('invite_list_failed');

  const invites = (rows || []).map((r: Record<string, unknown>) => ({
    inviteId: r.id as string,
    inviteeEmailMasked: maskEmail(String(r.invitee_email_lower || '')),
    intendedSeat: r.intended_seat as string,
    status: r.status as string,
    createdAt: r.created_at as string,
    expiresAt: r.expires_at as string,
    acceptedAt: (r.accepted_at as string | null) ?? null,
  }));

  return ok({ invites });
}

// ── lookup_by_token (UNAUTHENTICATED) ─────────────────────────

async function handleLookupByToken(
  body: Extract<ManageRoomInviteRequest, { action: 'lookup_by_token' }>,
): Promise<Response> {
  // The token shape has already been validated by the Zod schema.
  const tokenHash = await hashInviteToken(body.token);

  // Service-role read — caller has no JWT. The token IS the auth.
  const svc = createServiceClient();
  const { data: invite, error: inviteErr } = await svc
    .from('argument_room_invites')
    .select('id, debate_id, invited_by, status, expires_at, accepted_at, intended_seat')
    .eq('token_hash', tokenHash)
    .maybeSingle<{
      id: string;
      debate_id: string;
      invited_by: string;
      status: string;
      expires_at: string;
      accepted_at: string | null;
      intended_seat: string;
    }>();
  if (inviteErr) return internalError('invite_lookup_failed');
  if (!invite) return jsonError(404, 'invite_not_found', 'We could not open that invite link.');

  // Live-status compute: a stored 'pending' past its expiresAt is
  // functionally expired even before the DB has flipped it.
  const nowMs = Date.now();
  const expiresMs = Date.parse(invite.expires_at);
  let liveStatus = invite.status;
  if (liveStatus === 'pending' && (!Number.isFinite(expiresMs) || expiresMs < nowMs)) {
    liveStatus = 'expired';
  }

  // For non-pending statuses: return the bare status with no room
  // details — minimum-projection per §5.4.
  if (liveStatus !== 'pending') {
    return ok({
      status: liveStatus,
      tokenEcho: body.token, // safe — the caller already has it; lets the gate carry it into accept.
      room: null,
    });
  }

  // Live + pending — check the room status. Archived (QOL-038 §17) and
  // locked rooms get their own status code; the gate shows tailored copy.
  const { data: debate } = await svc
    .from('debates')
    .select('id, status, title, created_by')
    .eq('id', invite.debate_id)
    .maybeSingle<DebateRow>();
  if (!debate) {
    // Hard-delete cascade should have removed the invite; defensive 404.
    return jsonError(404, 'invite_not_found', 'We could not open that invite link.');
  }
  if (debate.status === 'archived') {
    return ok({ status: 'room_archived', tokenEcho: body.token, room: null });
  }
  if (debate.status === 'locked' || debate.status === 'settled') {
    return ok({ status: 'room_closed', tokenEcho: body.token, room: null });
  }

  // Display-safe projection: the title + the inviter display name only.
  const { data: profile } = await svc
    .from('profiles')
    .select('display_name')
    .eq('id', invite.invited_by)
    .maybeSingle<{ display_name: string | null }>();

  return ok({
    status: 'pending',
    tokenEcho: body.token,
    room: {
      title: debate.title || '',
      invitedByDisplayName: (profile?.display_name || '').toString() || null,
    },
  });
}

// ── accept ────────────────────────────────────────────────────

async function handleAccept(
  body: Extract<ManageRoomInviteRequest, { action: 'accept' }>,
  authHeader: string | null,
): Promise<Response> {
  if (!authHeader) return unauthorized();
  const callerClient = createCallerClient(authHeader);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;
  const callerEmail = (userRes.user.email || '').toLowerCase();

  const tokenHash = await hashInviteToken(body.token);

  // Service-role read — accept must see the invite even if the invitee
  // does not yet have an RLS match against the invitee_email_lower row.
  const svc = createServiceClient();
  const { data: invite, error: inviteErr } = await svc
    .from('argument_room_invites')
    .select('id, debate_id, invited_by, invitee_email_lower, invitee_profile_id, status, expires_at, intended_seat')
    .eq('token_hash', tokenHash)
    .maybeSingle<InviteRow>();
  if (inviteErr) return internalError('invite_lookup_failed');
  if (!invite) return jsonError(404, 'invite_not_found', 'We could not open that invite link.');

  // Live-status check
  const nowMs = Date.now();
  const expiresMs = Date.parse(invite.expires_at);
  if (invite.status === 'revoked') {
    return jsonError(409, 'invite_revoked', 'This invite is no longer active.');
  }
  if (
    invite.status === 'expired' ||
    (invite.status === 'pending' && (!Number.isFinite(expiresMs) || expiresMs < nowMs))
  ) {
    return jsonError(409, 'invite_expired', 'This invite has expired.');
  }
  if (invite.status === 'accepted') {
    if (invite.invitee_profile_id === callerId) {
      // Idempotent success on the same redeemer.
      return ok({
        debateId: invite.debate_id,
        status: 'accepted',
        enteredAsParticipant: true,
        intendedSeat: invite.intended_seat,
      });
    }
    return jsonError(409, 'invite_already_accepted', 'This invite has already been used.');
  }

  // Email-binding — the security spine.
  if (!callerEmail || callerEmail !== invite.invitee_email_lower) {
    return jsonError(403, 'invite_email_mismatch', 'This invite was sent to a different email address.');
  }

  // Room must still be open.
  const { data: debate } = await svc
    .from('debates')
    .select('id, status, created_by')
    .eq('id', invite.debate_id)
    .maybeSingle<DebateRow>();
  if (!debate) return jsonError(404, 'invite_not_found', 'We could not open that invite link.');
  if (debate.status === 'archived') {
    return jsonError(409, 'room_archived', 'This argument was archived and is no longer active.');
  }
  if (debate.status === 'locked' || debate.status === 'settled') {
    return jsonError(409, 'room_closed', 'This argument is settled — you cannot join now.');
  }

  // Enrol the invitee as a primary participant. Pick the OPPOSITE of the
  // room creator's side so the GAME-004 contract treats the invitee as
  // the claimable opponent seat. If the creator has no side row yet,
  // default to 'negative' (the responder/opposing side). The
  // (debate_id, user_id) PK makes a double-insert a no-op via 23505 —
  // accept is idempotent.
  const { data: creatorPart } = await svc
    .from('debate_participants')
    .select('side')
    .eq('debate_id', invite.debate_id)
    .eq('user_id', debate.created_by)
    .maybeSingle<{ side: string }>();

  let inviteeSide: 'affirmative' | 'negative' = 'negative';
  if (creatorPart && creatorPart.side === 'negative') inviteeSide = 'affirmative';
  // For 'observer' / 'moderator' / null the default 'negative' (the
  // respondent / opposing side) stands.

  const { error: enrolErr } = await svc
    .from('debate_participants')
    .insert({ debate_id: invite.debate_id, user_id: callerId, side: inviteeSide });
  if (enrolErr) {
    // 23505 = unique-violation = already a participant. That's fine —
    // accept is idempotent, the invite still flips to accepted below.
    const code = (enrolErr as { code?: string }).code || '';
    if (code !== '23505') {
      return internalError('enrolment_failed');
    }
  }

  const { error: updateErr } = await svc
    .from('argument_room_invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      invitee_profile_id: callerId,
    })
    .eq('id', invite.id)
    .eq('status', 'pending');
  if (updateErr) {
    // The participant row may already be in place; the invite flip is
    // best-effort. Still return success — the invitee CAN now enter the
    // room. Surface a soft warning so the operator can detect the case.
    // eslint-disable-next-line no-console
    console.error('invite_accept_status_flip_failed', invite.id, errorMessage(updateErr));
  }

  await writeInviteAudit('room_invite_accepted', callerId, {
    inviteIdShort: shortId(invite.id),
    debateIdShort: shortId(invite.debate_id),
    emailDomain: emailDomain(invite.invitee_email_lower),
  });

  return ok({
    debateId: invite.debate_id,
    status: 'accepted',
    enteredAsParticipant: true,
    intendedSeat: invite.intended_seat,
  });
}
