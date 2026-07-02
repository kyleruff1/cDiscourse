/**
 * Edge Function: manage-circle-invite (PRIVATE-GROUPS-002, #859)
 *
 * Six actions on public.circle_invites / public.circle_members (clone of
 * manage-room-invite in spirit, keyed to a circle):
 *
 *   - create               — mint a new pending circle invite (JWT required;
 *                            owner-gated via is_circle_owner).
 *   - revoke               — flip pending -> revoked (JWT required).
 *   - list_for_circle      — RLS-filtered list for the circle (JWT required).
 *   - lookup_by_token      — UNAUTHENTICATED — token possession is the auth.
 *                            Returns ONLY the redeem UI needs (circle name +
 *                            masked state), NEVER the member list.
 *   - accept               — turn a token + signed-in user into a circle
 *                            member (role 'member').
 *   - provision_and_accept — UNAUTHENTICATED: the token + typed email + typed
 *                            password ARE the auth. Enforces email-binding
 *                            BEFORE provisioning, mints a confirmed user via
 *                            service-role auth.admin, enrolls the member, and
 *                            returns NO session / JWT / token.
 *
 * Security model (cdiscourse-doctrine + supabase-edge-contract):
 *   - verify_jwt = false in config.toml so lookup_by_token can run pre-signup.
 *     Every mutating/JWT action re-checks the JWT explicitly inside the
 *     function via createCallerClient + getUser.
 *   - The service-role client is used ONLY after the per-action authorization
 *     check passes (owner check for create; token for lookup/accept; email-
 *     binding for provision).
 *   - The raw token NEVER appears in any log or any response that is not the
 *     create-time response to the inviter. Only token_hash is stored.
 *   - The function NEVER returns another member's email / the member list to a
 *     token holder. It NEVER returns a JWT / session / admin email.
 */
import {
  corsHeaders,
  ok,
  badRequest,
  unauthorized,
  methodNotAllowed,
  validationFailed,
  internalError,
} from '../_shared/http.ts';
import { createCallerClient, createServiceClient } from '../_shared/supabaseClients.ts';
import { ManageCircleInviteRequestSchema } from '../_shared/circleSchemas.ts';
import type { ManageCircleInviteRequest } from '../_shared/circleSchemas.ts';
import { generateInviteToken, hashInviteToken } from '../_shared/inviteToken.ts';

interface CircleRow {
  id: string;
  name: string | null;
  is_deleted: boolean;
}

interface CircleInviteRow {
  id: string;
  circle_id: string;
  invited_by: string;
  invitee_email_lower: string;
  invitee_profile_id: string | null;
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

  const parsed = ManageCircleInviteRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationFailed({
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const body: ManageCircleInviteRequest = parsed.data;

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const requestOrigin = req.headers.get('origin') || req.headers.get('Origin') || '';

  try {
    switch (body.action) {
      case 'create':
        return await handleCreate(body, authHeader, requestOrigin);
      case 'revoke':
        return await handleRevoke(body, authHeader);
      case 'list_for_circle':
        return await handleListForCircle(body, authHeader);
      case 'lookup_by_token':
        // The only action callable without a JWT — the token IS the auth.
        return await handleLookupByToken(body);
      case 'accept':
        return await handleAccept(body, authHeader);
      case 'provision_and_accept':
        // The token + typed email + typed password ARE the auth. Email-binding
        // is enforced BEFORE any account is provisioned.
        return await handleProvisionAndAccept(body);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('manage_circle_invite_error', body.action, errorMessage(err));
    return internalError('circle_invite_action_failed');
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

/** ISO timestamp 14 days from now (matches the circle_invites DB default). */
function defaultExpiresAt(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
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

// ── create (owner-gated) ──────────────────────────────────────

async function handleCreate(
  body: Extract<ManageCircleInviteRequest, { action: 'create' }>,
  authHeader: string | null,
  requestOrigin: string,
): Promise<Response> {
  if (!authHeader) return unauthorized();
  const callerClient = createCallerClient(authHeader);

  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;
  const callerEmail = (userRes.user.email || '').toLowerCase();

  const inviteeEmailLower = body.inviteeEmail.trim().toLowerCase();

  // Self-invite guard — done BEFORE any DB write.
  if (callerEmail && callerEmail === inviteeEmailLower) {
    return jsonError(400, 'cannot_invite_self', 'You cannot invite yourself.');
  }

  const svc = createServiceClient();

  // Owner authorization via the SECURITY DEFINER helper (authoritative).
  const { data: isOwner, error: ownerErr } = await svc.rpc('is_circle_owner', {
    p_circle_id: body.circleId,
    p_user_id: callerId,
  });
  if (ownerErr) return internalError('circle_lookup_failed');
  if (!isOwner) {
    return jsonError(403, 'not_circle_owner', 'Only the circle owner can invite people.');
  }

  // Circle must still be live.
  const { data: circle } = await svc
    .from('circles')
    .select('id, name, is_deleted')
    .eq('id', body.circleId)
    .maybeSingle<CircleRow>();
  if (!circle) return jsonError(404, 'circle_not_found', 'We could not find that circle.');
  if (circle.is_deleted) {
    return jsonError(409, 'circle_deleted', 'This circle is no longer active.');
  }

  // Idempotent reuse if a live pending invite to this address exists.
  const { data: existing } = await svc
    .from('circle_invites')
    .select('id, status, expires_at')
    .eq('circle_id', body.circleId)
    .eq('invitee_email_lower', inviteeEmailLower)
    .eq('status', 'pending')
    .maybeSingle<{ id: string; status: string; expires_at: string }>();
  if (existing) {
    return ok({
      inviteId: existing.id,
      status: existing.status,
      expiresAt: existing.expires_at,
      reused: true,
    });
  }

  const rawToken = generateInviteToken();
  const tokenHash = await hashInviteToken(rawToken);
  const expiresAt = defaultExpiresAt();

  const { data: inserted, error: insertErr } = await svc
    .from('circle_invites')
    .insert({
      circle_id: body.circleId,
      invited_by: callerId,
      invitee_email_lower: inviteeEmailLower,
      status: 'pending',
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select('id, expires_at, status')
    .single();

  if (insertErr || !inserted) {
    // A unique-violation means the per-address one-live index fired (a race
    // against the idempotent read above). Re-read + return idempotently.
    const { data: raced } = await svc
      .from('circle_invites')
      .select('id, status, expires_at')
      .eq('circle_id', body.circleId)
      .eq('invitee_email_lower', inviteeEmailLower)
      .eq('status', 'pending')
      .maybeSingle<{ id: string; status: string; expires_at: string }>();
    if (raced) {
      return ok({ inviteId: raced.id, status: raced.status, expiresAt: raced.expires_at, reused: true });
    }
    return internalError('circle_invite_insert_failed');
  }

  // Build the link from the request origin. The raw token appears ONLY here,
  // ONLY to the inviter, ONLY at create time — never logged, never stored,
  // never returned by list_for_circle.
  const safeOrigin = sanitiseOriginForLink(requestOrigin);
  const inviteLink = safeOrigin ? `${safeOrigin}/circle-invite/${rawToken}` : null;

  // eslint-disable-next-line no-console
  console.error('manage_circle_invite_ok', {
    action: 'create',
    callerIdShort: shortId(callerId),
    circleIdShort: shortId(body.circleId),
    emailDomain: emailDomain(inviteeEmailLower),
  });

  return ok({
    inviteId: inserted.id,
    status: inserted.status,
    expiresAt: inserted.expires_at,
    reused: false,
    inviteLink,
  });
}

// ── revoke ────────────────────────────────────────────────────

async function handleRevoke(
  body: Extract<ManageCircleInviteRequest, { action: 'revoke' }>,
  authHeader: string | null,
): Promise<Response> {
  if (!authHeader) return unauthorized();
  const callerClient = createCallerClient(authHeader);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();

  // Caller-scoped read — RLS enforces who may see the row (inviter / owner /
  // invitee / admin).
  const { data: invite, error: inviteErr } = await callerClient
    .from('circle_invites')
    .select('id, status, circle_id')
    .eq('id', body.inviteId)
    .maybeSingle<{ id: string; status: string; circle_id: string }>();
  if (inviteErr) return internalError('circle_invite_lookup_failed');
  if (!invite) return jsonError(403, 'invite_not_visible', 'You cannot revoke this invite.');

  if (invite.status !== 'pending') {
    return jsonError(409, 'not_pending', 'Only pending invites can be revoked.');
  }

  const svc = createServiceClient();
  const { error: updateErr } = await svc
    .from('circle_invites')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', body.inviteId)
    .eq('status', 'pending');
  if (updateErr) return internalError('circle_invite_revoke_failed');

  return ok({ inviteId: body.inviteId, status: 'revoked' });
}

// ── list_for_circle ───────────────────────────────────────────

async function handleListForCircle(
  body: Extract<ManageCircleInviteRequest, { action: 'list_for_circle' }>,
  authHeader: string | null,
): Promise<Response> {
  if (!authHeader) return unauthorized();
  const callerClient = createCallerClient(authHeader);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();

  // RLS does the visibility work (owner / inviter / invitee / admin arms). We
  // deliberately do NOT select token_hash. Emails are masked before return.
  const { data: rows, error: listErr } = await callerClient
    .from('circle_invites')
    .select('id, invitee_email_lower, status, created_at, expires_at, accepted_at')
    .eq('circle_id', body.circleId)
    .order('created_at', { ascending: false });
  if (listErr) return internalError('circle_invite_list_failed');

  const invites = (rows || []).map((r: Record<string, unknown>) => ({
    inviteId: r.id as string,
    inviteeEmailMasked: maskEmail(String(r.invitee_email_lower || '')),
    status: r.status as string,
    createdAt: r.created_at as string,
    expiresAt: r.expires_at as string,
    acceptedAt: (r.accepted_at as string | null) ?? null,
  }));

  return ok({ invites });
}

// ── lookup_by_token (UNAUTHENTICATED) ─────────────────────────

async function handleLookupByToken(
  body: Extract<ManageCircleInviteRequest, { action: 'lookup_by_token' }>,
): Promise<Response> {
  const tokenHash = await hashInviteToken(body.token);

  // Service-role read — caller has no JWT. The token IS the auth. We return
  // ONLY what the redeem UI needs (circle name + masked state) — NEVER the
  // member list, never another member's email.
  const svc = createServiceClient();
  const { data: invite, error: inviteErr } = await svc
    .from('circle_invites')
    .select('id, circle_id, invited_by, status, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle<{
      id: string;
      circle_id: string;
      invited_by: string;
      status: string;
      expires_at: string;
    }>();
  if (inviteErr) return internalError('circle_invite_lookup_failed');
  if (!invite) return jsonError(404, 'invite_not_found', 'We could not open that invite link.');

  const nowMs = Date.now();
  const expiresMs = Date.parse(invite.expires_at);
  let liveStatus = invite.status;
  if (liveStatus === 'pending' && (!Number.isFinite(expiresMs) || expiresMs < nowMs)) {
    liveStatus = 'expired';
  }

  if (liveStatus !== 'pending') {
    return ok({ status: liveStatus, tokenEcho: body.token, circle: null });
  }

  const { data: circle } = await svc
    .from('circles')
    .select('id, name, is_deleted')
    .eq('id', invite.circle_id)
    .maybeSingle<CircleRow>();
  if (!circle) {
    return jsonError(404, 'invite_not_found', 'We could not open that invite link.');
  }
  if (circle.is_deleted) {
    return ok({ status: 'circle_deleted', tokenEcho: body.token, circle: null });
  }

  const { data: profile } = await svc
    .from('profiles')
    .select('display_name')
    .eq('id', invite.invited_by)
    .maybeSingle<{ display_name: string | null }>();

  return ok({
    status: 'pending',
    tokenEcho: body.token,
    circle: {
      name: circle.name || '',
      invitedByDisplayName: (profile?.display_name || '').toString() || null,
    },
  });
}

// ── accept ────────────────────────────────────────────────────

async function handleAccept(
  body: Extract<ManageCircleInviteRequest, { action: 'accept' }>,
  authHeader: string | null,
): Promise<Response> {
  if (!authHeader) return unauthorized();
  const callerClient = createCallerClient(authHeader);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;
  const callerEmail = (userRes.user.email || '').toLowerCase();

  const tokenHash = await hashInviteToken(body.token);

  // Service-role read — accept must see the invite even if the invitee does
  // not yet have an RLS match against the invitee_email_lower row.
  const svc = createServiceClient();
  const { data: invite, error: inviteErr } = await svc
    .from('circle_invites')
    .select('id, circle_id, invited_by, invitee_email_lower, invitee_profile_id, status, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle<CircleInviteRow>();
  if (inviteErr) return internalError('circle_invite_lookup_failed');
  if (!invite) return jsonError(404, 'invite_not_found', 'We could not open that invite link.');

  const refusal = liveStatusRefusal(invite, callerId);
  if (refusal) return refusal;

  // Email-binding — the security spine.
  if (!callerEmail || callerEmail !== invite.invitee_email_lower) {
    return jsonError(403, 'invite_email_mismatch', 'This invite was sent to a different email address.');
  }

  // Circle must still be live.
  const { data: circle } = await svc
    .from('circles')
    .select('id, name, is_deleted')
    .eq('id', invite.circle_id)
    .maybeSingle<CircleRow>();
  if (!circle) return jsonError(404, 'invite_not_found', 'We could not open that invite link.');
  if (circle.is_deleted) {
    return jsonError(409, 'circle_deleted', 'This circle is no longer active.');
  }

  const enrolFail = await enrolAndFlipInvite(svc, invite, callerId);
  if (enrolFail) return enrolFail;

  return ok({ circleId: invite.circle_id, status: 'accepted', enteredAsMember: true });
}

/**
 * Shared live-status refusal for accept / provision_and_accept. Returns a
 * Response to return directly on a non-live status, or null if the invite is
 * live-pending. On an already-accepted invite by the SAME redeemer, returns an
 * idempotent success Response.
 */
function liveStatusRefusal(invite: CircleInviteRow, callerId: string): Response | null {
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
      return ok({ circleId: invite.circle_id, status: 'accepted', enteredAsMember: true });
    }
    return jsonError(409, 'invite_already_accepted', 'This invite has already been used.');
  }
  return null;
}

/**
 * Shared enrolment + invite-flip, used by BOTH handleAccept and
 * handleProvisionAndAccept. Enrolls the redeemer into circle_members with role
 * 'member' via service role (the row may pre-date the invitee's RLS match) and
 * flips the invite to accepted. Idempotent: a duplicate (circle_id, user_id)
 * insert is a 23505 no-op; re-accept re-flips nothing.
 *
 * Returns a Response ONLY on a hard enrolment failure; null on success.
 */
async function enrolAndFlipInvite(
  svc: ReturnType<typeof createServiceClient>,
  invite: CircleInviteRow,
  memberUserId: string,
): Promise<Response | null> {
  // Re-add-after-removal reuses the row via a status flip (the one-live
  // membership idiom): if a removed row exists, un-remove it; else insert.
  const { data: existingMember } = await svc
    .from('circle_members')
    .select('id, is_removed')
    .eq('circle_id', invite.circle_id)
    .eq('user_id', memberUserId)
    .maybeSingle<{ id: string; is_removed: boolean }>();

  if (existingMember) {
    if (existingMember.is_removed) {
      const { error: reAddErr } = await svc
        .from('circle_members')
        .update({ is_removed: false, removed_at: null, role: 'member', joined_at: new Date().toISOString() })
        .eq('id', existingMember.id);
      if (reAddErr) return internalError('circle_enrolment_failed');
    }
    // Already a live member — idempotent no-op.
  } else {
    const { error: enrolErr } = await svc
      .from('circle_members')
      .insert({ circle_id: invite.circle_id, user_id: memberUserId, role: 'member' });
    if (enrolErr) {
      const code = (enrolErr as { code?: string }).code || '';
      if (code !== '23505') return internalError('circle_enrolment_failed');
      // 23505 = already a member (race) — idempotent.
    }
  }

  const { error: updateErr } = await svc
    .from('circle_invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      invitee_profile_id: memberUserId,
    })
    .eq('id', invite.id)
    .eq('status', 'pending');
  if (updateErr) {
    // The membership row is the load-bearing artifact; the invite flip is
    // best-effort. Log a stable label (never the token / email) and succeed.
    // eslint-disable-next-line no-console
    console.error('circle_invite_accept_status_flip_failed', shortId(invite.id));
  }

  return null;
}

// ── provision_and_accept (UNAUTHENTICATED) ────────────────────

async function handleProvisionAndAccept(
  body: Extract<ManageCircleInviteRequest, { action: 'provision_and_accept' }>,
): Promise<Response> {
  const typedEmailLower = body.email.trim().toLowerCase();
  const tokenHash = await hashInviteToken(body.token);

  const svc = createServiceClient();
  const { data: invite, error: inviteErr } = await svc
    .from('circle_invites')
    .select('id, circle_id, invited_by, invitee_email_lower, invitee_profile_id, status, token_hash, created_at, expires_at, accepted_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle<CircleInviteRow>();
  if (inviteErr) return internalError('circle_invite_lookup_failed');
  if (!invite) return jsonError(404, 'invite_not_found', 'We could not open that invite link.');

  // Live-status checks (accepted-by-another is a hard refusal here — a
  // brand-new provisioning is not the right path).
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
    return jsonError(409, 'invite_already_accepted', 'This invite has already been used.');
  }

  // EMAIL-BINDING — enforced BEFORE provisioning. A wrong email never creates
  // an account. This is the security spine and is never weakened.
  if (!typedEmailLower || typedEmailLower !== invite.invitee_email_lower) {
    return jsonError(403, 'invite_email_mismatch', 'This invite was sent to a different email address.');
  }

  // Circle must still be live — checked BEFORE provisioning.
  const { data: circle } = await svc
    .from('circles')
    .select('id, name, is_deleted')
    .eq('id', invite.circle_id)
    .maybeSingle<CircleRow>();
  if (!circle) return jsonError(404, 'invite_not_found', 'We could not open that invite link.');
  if (circle.is_deleted) {
    return jsonError(409, 'circle_deleted', 'This circle is no longer active.');
  }

  // Provision the brand-new confirmed user. The password is passed ONLY into
  // createUser — never logged, persisted elsewhere, or echoed.
  const { data: createdRes, error: createErr } = await svc.auth.admin.createUser({
    email: invite.invitee_email_lower,
    password: body.password,
    email_confirm: true,
  });

  if (createErr) {
    const msg = (createErr.message || '').toLowerCase();
    const status = (createErr as { status?: number }).status;
    if (
      msg.includes('already') ||
      msg.includes('registered') ||
      msg.includes('exists') ||
      status === 422
    ) {
      return jsonError(409, 'account_exists', 'You already have an account — sign in instead.');
    }
    return jsonError(500, 'provision_failed', 'We could not finish setting up your account. Try again.');
  }

  const newUserId = createdRes?.user?.id;
  if (!newUserId) {
    return jsonError(500, 'provision_failed', 'We could not finish setting up your account. Try again.');
  }

  const enrolFail = await enrolAndFlipInvite(svc, invite, newUserId);
  if (enrolFail) return enrolFail;

  // Return NO session / JWT / token. The client signs in normally afterward.
  return ok({ circleId: invite.circle_id, status: 'accepted', enteredAsMember: true });
}
