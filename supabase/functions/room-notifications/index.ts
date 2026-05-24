/**
 * Edge Function: room-notifications (QOL-040)
 *
 * Inserts notification rows into `public.room_notifications` for
 * the NON-argument-derived triggers (invite, room_made_private,
 * chime_in_posted, chime_in_rejected, argument_settled,
 * invite_accepted_by_invitee). The four argument-derived triggers
 * (new_response, concession_challenged, source_requested,
 * evidence_supplied) are inserted as a side effect of the
 * `submit-argument` function — not here.
 *
 * For the `invite` trigger, this function also handles the
 * GATED, OPT-IN email scaffold (E1) by calling
 * `maybeSendInviteEmail`. The email path is OFF BY DEFAULT in
 * every environment; the operator flips it manually by setting
 * INVITE_EMAIL_ENABLED + RESEND_API_KEY + INVITE_EMAIL_FROM as
 * Edge Function secrets after the deliverability setup is
 * complete (SPF, DKIM, sender reputation, bounce handling).
 * Until those secrets are set, the function returns
 * notification: 'not_configured' and makes no network call.
 *
 * Security model (per cdiscourse-doctrine + supabase-edge-contract):
 *   - verify_jwt = true (set in config.toml).
 *   - Every action verifies the JWT + checks per-action
 *     authorisation (e.g. only the room creator may request
 *     `room_made_private`; only a primary may request
 *     `argument_settled`; only the invitee themselves may
 *     request `invite_accepted_by_invitee`).
 *   - The service-role client is used ONLY for the row insert
 *     after authorisation passes, AND to look up the existing
 *     auth.users id for the `invite` trigger (so the row is keyed
 *     to a real user, never a typo-ed email).
 *   - The function NEVER returns other users' data — the
 *     response is always { delivered: <count> } plus the
 *     invite-only `notification` field.
 *   - The function NEVER logs Authorization headers, JWTs,
 *     Bearer tokens, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *     or recipient emails.
 *   - A notification insert failure on a single recipient is
 *     swallowed — the in-app notification is best-effort. The
 *     primary user action (the invite create / accept / settle)
 *     already succeeded inside the caller.
 *
 * NOTE on the 11th trigger:
 *   Trigger 11 (`invite_expired_notice`) is intentionally absent.
 *   Per operator decision 2026-05-24: invite expiration is a
 *   low-value notification; the inviter has the invite management
 *   UI from QOL-038. Adding it later is a NEW migration + a new
 *   action here.
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

// ── Trigger discriminator ────────────────────────────────────

/**
 * The six non-argument-derived trigger types this function
 * handles. The four argument-derived triggers (new_response,
 * concession_challenged, source_requested, evidence_supplied)
 * are inserted by `submit-argument` as a side effect — they are
 * NOT accepted by this function.
 */
type RoomNotificationActionType =
  | 'invite'
  | 'room_made_private'
  | 'chime_in_posted'
  | 'chime_in_rejected'
  | 'argument_settled'
  | 'invite_accepted_by_invitee';

const ALLOWED_TRIGGER_TYPES: ReadonlyArray<RoomNotificationActionType> = Object.freeze([
  'invite',
  'room_made_private',
  'chime_in_posted',
  'chime_in_rejected',
  'argument_settled',
  'invite_accepted_by_invitee',
]);

interface NotificationMetaInput {
  classification?: 'framing' | 'context' | 'fact';
  roomIsPrivate?: boolean;
  actorNameVisible?: boolean;
  actorDisplayName?: string;
}

interface RoomNotificationRequestBody {
  type: RoomNotificationActionType;
  debateId: string;
  argumentId?: string | null;
  /** For invite: the invite row id (so the function can resolve invitee email + inviter display name). */
  inviteId?: string;
  /** For invite_accepted_by_invitee: the invite row id (so the function can resolve the inviter id). */
  meta?: NotificationMetaInput;
}

interface InviteRow {
  id: string;
  debate_id: string;
  invited_by: string;
  invitee_email_lower: string;
  invitee_profile_id: string | null;
  intended_seat: string;
  status: string;
  expires_at: string;
}

interface DebateRow {
  id: string;
  created_by: string;
  status: string;
  title: string | null;
  visibility?: string | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  role: string | null;
}

type InviteEmailStatus = 'sent' | 'not_configured' | 'queued';

interface RoomNotificationResponse {
  delivered: number;
  /** Only present for the `invite` trigger. */
  notification?: InviteEmailStatus;
}

// ── Helpers ──────────────────────────────────────────────────

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function shortId(id: string): string {
  return id && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

function isAllowedTrigger(t: unknown): t is RoomNotificationActionType {
  return typeof t === 'string' && (ALLOWED_TRIGGER_TYPES as ReadonlyArray<string>).includes(t);
}

function parseMeta(input: unknown): NotificationMetaInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const m = input as Record<string, unknown>;
  const out: NotificationMetaInput = {};
  if (m.classification === 'framing' || m.classification === 'context' || m.classification === 'fact') {
    out.classification = m.classification;
  }
  if (typeof m.roomIsPrivate === 'boolean') out.roomIsPrivate = m.roomIsPrivate;
  if (typeof m.actorNameVisible === 'boolean') out.actorNameVisible = m.actorNameVisible;
  if (typeof m.actorDisplayName === 'string') out.actorDisplayName = m.actorDisplayName.slice(0, 80);
  return out;
}

/**
 * Insert one row per recipient. The unique partial index on
 * (recipient_id, type, argument_id) makes a retry a no-op for
 * argument-keyed rows; non-argument rows are naturally one-shot.
 * Returns the count of rows that landed (treats unique-violation
 * as success).
 */
async function insertRows(
  recipients: string[],
  baseRow: {
    debate_id: string;
    argument_id: string | null;
    type: RoomNotificationActionType;
    room_title: string;
    meta: Record<string, unknown>;
  },
): Promise<number> {
  if (recipients.length === 0) return 0;
  const svc = createServiceClient();
  const rows = recipients.map((rid) => ({
    recipient_id: rid,
    debate_id: baseRow.debate_id,
    argument_id: baseRow.argument_id,
    type: baseRow.type,
    room_title: baseRow.room_title,
    meta: baseRow.meta,
  }));
  const { error, data } = await svc
    .from('room_notifications')
    .insert(rows)
    .select('id');
  if (error) {
    // 23505 = unique-violation; treat as success (idempotent retry).
    const code = (error as { code?: string }).code || '';
    if (code === '23505') return rows.length;
    // Single-row insert failures must not block the user action.
    // We return the count of attempts; the caller sees a "best
    // effort" result.
    return 0;
  }
  return Array.isArray(data) ? data.length : rows.length;
}

// ── Email scaffold (gated, off by default) ───────────────────

/**
 * Send the invite email via Resend, mirroring
 * `request-argument-deletion`'s `maybeSendAdminNotification`
 * pattern. Off by default — the operator flips
 * INVITE_EMAIL_ENABLED + RESEND_API_KEY + INVITE_EMAIL_FROM per
 * environment after deliverability setup.
 *
 * Returns:
 *   - 'not_configured' when any gate fails (flag off, missing key,
 *     missing from). NO network call.
 *   - 'sent' on Resend 2xx.
 *   - 'queued' on Resend non-2xx OR exception. The in-app row
 *     already landed; this status simply tells the caller the
 *     email-channel attempt failed so the operator can later
 *     reconcile.
 *
 * NEVER logs: Authorization header, API key, response body, raw
 * recipient email.
 */
async function maybeSendInviteEmail(input: {
  inviteId: string;
  recipientEmail: string;
  inviterDisplayName: string | null;
  roomTitle: string;
  inviteLink: string | null;
  roomIsPrivate: boolean;
}): Promise<InviteEmailStatus> {
  const enabled = (Deno.env.get('INVITE_EMAIL_ENABLED') || '').trim().toLowerCase();
  if (enabled !== 'true') return 'not_configured';

  const apiKey = (Deno.env.get('RESEND_API_KEY') || '').trim();
  const from = (Deno.env.get('INVITE_EMAIL_FROM') || '').trim();
  if (!apiKey || !from) {
    // Structured log entry — note the key value is NOT in the line.
    // eslint-disable-next-line no-console
    console.error('invite_email_missing_configuration', {
      inviteIdShort: shortId(input.inviteId),
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
    });
    return 'not_configured';
  }

  const recipient = (input.recipientEmail || '').trim();
  if (!recipient) return 'not_configured';

  const subject = 'You were invited to respond to an argument.';
  const room = (input.roomTitle || '').trim() || 'an argument';
  const inviter = (input.inviterDisplayName || '').trim();
  const safeLine = (s: string) => s.replace(/<[^>]*>/g, '').replace(/[\x00-\x1F\x7F]/g, '').slice(0, 200);
  const introLine = inviter
    ? `${safeLine(inviter)} invited you to respond to an argument on CDiscourse.`
    : 'Someone invited you to respond to an argument on CDiscourse.';
  const privacyLine = input.roomIsPrivate
    ? 'This is a private argument — only invited participants can see it.'
    : '';
  const linkLine = input.inviteLink ? `Open the argument: ${input.inviteLink}` : '';

  const bodyText = [
    introLine,
    '',
    `Room: ${safeLine(room)}`,
    privacyLine,
    linkLine,
    '',
    'You can ignore this email if you were not expecting it. The link expires after 14 days.',
  ]
    .filter((s) => s.length > 0 || s === '')
    .join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Authorization header is built in-place; the key is
        // never logged or assigned to a variable that lands in
        // a log line.
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        text: bodyText,
      }),
    });
    if (!res.ok) {
      // Drain body without echoing it.
      try { await res.text(); } catch { /* swallow */ }
      // eslint-disable-next-line no-console
      console.error('invite_email_send_failed', {
        inviteIdShort: shortId(input.inviteId),
        status: res.status,
      });
      return 'queued';
    }
    return 'sent';
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('invite_email_send_exception', {
      inviteIdShort: shortId(input.inviteId),
      message: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    });
    return 'queued';
  }
}

// ── Trigger handlers ─────────────────────────────────────────

async function handleInvite(
  body: RoomNotificationRequestBody,
  callerId: string,
): Promise<Response> {
  if (!body.inviteId || !isUuid(body.inviteId)) return badRequest('invite_id_required');

  const svc = createServiceClient();
  // Look up the invite row (service role — the invitee may not yet
  // have an auth.users id, and even if they do, we don't want to
  // depend on RLS visibility against an arbitrary caller).
  const { data: invite, error: inviteErr } = await svc
    .from('argument_room_invites')
    .select('id, debate_id, invited_by, invitee_email_lower, invitee_profile_id, intended_seat, status, expires_at')
    .eq('id', body.inviteId)
    .maybeSingle<InviteRow>();
  if (inviteErr || !invite) return badRequest('invite_not_found');

  // Authorisation: the caller must be the inviter (they own the
  // invite-create action that fires this notification). We don't
  // trust the caller's claim of being the inviter — we re-derive
  // it from the row.
  if (invite.invited_by !== callerId) return forbidden('not_inviter');

  // The notification must reference the correct debate id —
  // mismatch is a malformed call.
  if (invite.debate_id !== body.debateId) return badRequest('debate_id_mismatch');

  // Room title + visibility for copy.
  const { data: debate } = await svc
    .from('debates')
    .select('id, created_by, status, title')
    .eq('id', invite.debate_id)
    .maybeSingle<DebateRow>();
  if (!debate) return badRequest('debate_not_found');

  const roomTitle = (debate.title || '').slice(0, 200);
  const inputMeta = parseMeta(body.meta);
  // The room visibility column is QOL-039's; until it lands, the
  // caller may pass `meta.roomIsPrivate` explicitly. We do NOT
  // invent a private/public default here.
  const roomIsPrivate = inputMeta.roomIsPrivate === true;

  // Existing-account invitee lookup (E2.1). If
  // `invitee_profile_id` is already set, the invitee has an
  // account. Otherwise we look up by email; if we find an
  // existing user, we treat it as the existing-account case.
  let inviteeUserId: string | null = invite.invitee_profile_id;
  let inviteeEmail = invite.invitee_email_lower;
  if (!inviteeUserId) {
    try {
      // Look up the existing user by email. The lookup uses the
      // service-role admin.listUsers pattern (same as
      // `request-argument-deletion`). We page through at most
      // 200 users per page — operator can revisit if the user
      // base grows beyond that single page for this lookup.
      const { data: usersRaw } = await svc.auth.admin.listUsers({ perPage: 200, page: 1 });
      if (usersRaw?.users) {
        const match = usersRaw.users.find(
          (u) => typeof u.email === 'string' && u.email.toLowerCase().trim() === inviteeEmail,
        );
        if (match) inviteeUserId = match.id;
      }
    } catch {
      // Best-effort lookup. A failure here just means we fall
      // through to the brand-new-user path (no in-app
      // notification, email-only if configured).
    }
  }

  let delivered = 0;
  if (inviteeUserId) {
    // Existing-account case: create the in-app notification keyed
    // to that user. Author = the inviter; the dedupe step inside
    // resolveRecipients strips the inviter from recipients.
    delivered = await insertRows([inviteeUserId], {
      debate_id: invite.debate_id,
      argument_id: null,
      type: 'invite',
      room_title: roomTitle,
      meta: {
        ...(roomIsPrivate ? { roomIsPrivate: true } : {}),
      },
    });
  }

  // Email channel (gated). Send regardless of in-app delivery —
  // the email is the primary path for a brand-new-user invitee.
  // For existing-account invitees, the email is a nice-to-have
  // notification that lands in their inbox; the in-app row is
  // the canonical surface.
  const { data: inviterProfile } = await svc
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', invite.invited_by)
    .maybeSingle<ProfileRow>();
  const inviteLink: string | null = null; // The invite link is not exposed via this function — it lives in inviter's create-time response.
  const emailStatus = await maybeSendInviteEmail({
    inviteId: invite.id,
    recipientEmail: inviteeEmail,
    inviterDisplayName: inviterProfile?.display_name || null,
    roomTitle,
    inviteLink,
    roomIsPrivate,
  });

  return ok<RoomNotificationResponse>({ delivered, notification: emailStatus });
}

async function handleInviteAcceptedByInvitee(
  body: RoomNotificationRequestBody,
  callerId: string,
): Promise<Response> {
  if (!body.inviteId || !isUuid(body.inviteId)) return badRequest('invite_id_required');

  const svc = createServiceClient();
  const { data: invite, error: inviteErr } = await svc
    .from('argument_room_invites')
    .select('id, debate_id, invited_by, invitee_email_lower, invitee_profile_id, intended_seat, status, expires_at')
    .eq('id', body.inviteId)
    .maybeSingle<InviteRow>();
  if (inviteErr || !invite) return badRequest('invite_not_found');

  // Re-derive: the caller must be the invitee themselves. Trust no
  // claim from the request body.
  if (invite.invitee_profile_id !== callerId) return forbidden('not_invitee');
  if (invite.debate_id !== body.debateId) return badRequest('debate_id_mismatch');

  const { data: debate } = await svc
    .from('debates')
    .select('id, created_by, status, title')
    .eq('id', invite.debate_id)
    .maybeSingle<DebateRow>();
  if (!debate) return badRequest('debate_not_found');

  const roomTitle = (debate.title || '').slice(0, 200);
  const inputMeta = parseMeta(body.meta);
  // The invitee's display name (the actor) — gated by
  // actorNameVisible. Caller may pass it; we resolve from
  // profiles defensively.
  let actorDisplayName: string | undefined = inputMeta.actorDisplayName;
  if (!actorDisplayName) {
    const { data: invitee } = await svc
      .from('profiles')
      .select('display_name')
      .eq('id', callerId)
      .maybeSingle<{ display_name: string | null }>();
    actorDisplayName = invitee?.display_name?.trim() || undefined;
  }
  const actorNameVisible = inputMeta.actorNameVisible === true && Boolean(actorDisplayName);

  const delivered = await insertRows([invite.invited_by], {
    debate_id: invite.debate_id,
    argument_id: null,
    type: 'invite_accepted_by_invitee',
    room_title: roomTitle,
    meta: {
      ...(actorNameVisible ? { actorNameVisible: true, actorDisplayName } : {}),
    },
  });

  return ok<RoomNotificationResponse>({ delivered });
}

async function handleArgumentSettled(
  body: RoomNotificationRequestBody,
  callerId: string,
): Promise<Response> {
  if (!isUuid(body.debateId)) return badRequest('debate_id_required');
  const svc = createServiceClient();
  const { data: debate } = await svc
    .from('debates')
    .select('id, created_by, status, title')
    .eq('id', body.debateId)
    .maybeSingle<DebateRow>();
  if (!debate) return badRequest('debate_not_found');

  // Re-derive: the caller must be a primary (affirmative /
  // negative). The room-settle action is owned by a primary.
  const { data: caller } = await svc
    .from('debate_participants')
    .select('side')
    .eq('debate_id', body.debateId)
    .eq('user_id', callerId)
    .maybeSingle<{ side: string }>();
  if (!caller || (caller.side !== 'affirmative' && caller.side !== 'negative')) {
    return forbidden('not_primary');
  }

  // Re-derive: the room must actually be settled. If the caller
  // claims to settle but the DB still shows 'open', refuse.
  if (debate.status !== 'locked' && debate.status !== 'settled') {
    return forbidden('room_not_settled');
  }

  // Recipients: both primaries. The author (the settler) is
  // stripped by resolveRecipients's dedupe.
  const { data: parts } = await svc
    .from('debate_participants')
    .select('user_id, side')
    .eq('debate_id', body.debateId);
  const primaries = (parts || [])
    .filter((p) => p.side === 'affirmative' || p.side === 'negative')
    .map((p) => p.user_id as string)
    .filter((id) => id !== callerId);

  const roomTitle = (debate.title || '').slice(0, 200);
  const delivered = await insertRows(primaries, {
    debate_id: body.debateId,
    argument_id: null,
    type: 'argument_settled',
    room_title: roomTitle,
    meta: {},
  });

  return ok<RoomNotificationResponse>({ delivered });
}

async function handleChimeInPosted(
  body: RoomNotificationRequestBody,
  callerId: string,
): Promise<Response> {
  if (!isUuid(body.debateId)) return badRequest('debate_id_required');
  if (body.argumentId && !isUuid(body.argumentId)) return badRequest('argument_id_invalid');

  const svc = createServiceClient();
  const { data: debate } = await svc
    .from('debates')
    .select('id, created_by, status, title')
    .eq('id', body.debateId)
    .maybeSingle<DebateRow>();
  if (!debate) return badRequest('debate_not_found');

  // Re-derive: the caller must be an observer/chime-in author for
  // this room. The chime-in seat is "observer" today (GAME-005
  // adds the explicit chime_in seat type later); accept either.
  const { data: callerPart } = await svc
    .from('debate_participants')
    .select('side')
    .eq('debate_id', body.debateId)
    .eq('user_id', callerId)
    .maybeSingle<{ side: string }>();
  if (!callerPart || (callerPart.side !== 'observer' && callerPart.side !== 'moderator')) {
    return forbidden('not_observer');
  }

  // Recipients: both primaries.
  const { data: parts } = await svc
    .from('debate_participants')
    .select('user_id, side')
    .eq('debate_id', body.debateId);
  const primaries = (parts || [])
    .filter((p) => p.side === 'affirmative' || p.side === 'negative')
    .map((p) => p.user_id as string);

  const roomTitle = (debate.title || '').slice(0, 200);
  const inputMeta = parseMeta(body.meta);
  // Actor-name visibility (design §9 rule 3). In a public room,
  // primaries can already see the observer; the caller passes
  // `actorNameVisible: true`. The function never overrides the
  // caller's privacy decision upward.
  const actorNameVisible = inputMeta.actorNameVisible === true && Boolean(inputMeta.actorDisplayName);

  const delivered = await insertRows(primaries.filter((id) => id !== callerId), {
    debate_id: body.debateId,
    argument_id: body.argumentId || null,
    type: 'chime_in_posted',
    room_title: roomTitle,
    meta: actorNameVisible
      ? { actorNameVisible: true, actorDisplayName: inputMeta.actorDisplayName }
      : {},
  });

  return ok<RoomNotificationResponse>({ delivered });
}

async function handleChimeInRejected(
  body: RoomNotificationRequestBody,
  callerId: string,
): Promise<Response> {
  if (!isUuid(body.debateId)) return badRequest('debate_id_required');
  if (!body.argumentId || !isUuid(body.argumentId)) return badRequest('argument_id_required');

  const svc = createServiceClient();
  const { data: debate } = await svc
    .from('debates')
    .select('id, created_by, status, title')
    .eq('id', body.debateId)
    .maybeSingle<DebateRow>();
  if (!debate) return badRequest('debate_not_found');

  // Re-derive: the caller must be a primary (they marked it).
  const { data: callerPart } = await svc
    .from('debate_participants')
    .select('side')
    .eq('debate_id', body.debateId)
    .eq('user_id', callerId)
    .maybeSingle<{ side: string }>();
  if (!callerPart || (callerPart.side !== 'affirmative' && callerPart.side !== 'negative')) {
    return forbidden('not_primary');
  }

  // Re-derive: the chime-in argument must exist and belong to
  // this debate. We don't trust the caller's claim that the
  // argument exists.
  const { data: chimeArg } = await svc
    .from('arguments')
    .select('id, debate_id, author_id, status')
    .eq('id', body.argumentId)
    .maybeSingle<{ id: string; debate_id: string; author_id: string; status: string }>();
  if (!chimeArg) return badRequest('argument_not_found');
  if (chimeArg.debate_id !== body.debateId) return badRequest('debate_id_mismatch');

  const roomTitle = (debate.title || '').slice(0, 200);
  const inputMeta = parseMeta(body.meta);
  const meta: Record<string, unknown> = {};
  if (inputMeta.roomIsPrivate === true) meta.roomIsPrivate = true;

  // Recipient: the chime-in author only.
  const delivered = await insertRows([chimeArg.author_id], {
    debate_id: body.debateId,
    argument_id: body.argumentId,
    type: 'chime_in_rejected',
    room_title: roomTitle,
    meta,
  });

  return ok<RoomNotificationResponse>({ delivered });
}

async function handleRoomMadePrivate(
  body: RoomNotificationRequestBody,
  callerId: string,
): Promise<Response> {
  if (!isUuid(body.debateId)) return badRequest('debate_id_required');

  const svc = createServiceClient();
  const { data: debate } = await svc
    .from('debates')
    .select('id, created_by, status, title')
    .eq('id', body.debateId)
    .maybeSingle<DebateRow>();
  if (!debate) return badRequest('debate_not_found');

  // Re-derive: only the room creator may request this trigger
  // (the visibility transition is owned by the creator per
  // QOL-039 design — the caller cannot fabricate this for any
  // other room).
  if (debate.created_by !== callerId) return forbidden('not_creator');

  // The recipient set is the prior-read-access set MINUS current
  // primaries (they kept their access). The caller passes the
  // prior set on the body so this function does not need to read
  // QOL-039's transition log. The function does, however, strip
  // current primaries defensively.
  const { data: parts } = await svc
    .from('debate_participants')
    .select('user_id, side')
    .eq('debate_id', body.debateId);
  const currentPrimaries = new Set(
    (parts || [])
      .filter((p) => p.side === 'affirmative' || p.side === 'negative')
      .map((p) => p.user_id as string),
  );
  const priorAccess: string[] = Array.isArray((body as unknown as { priorReadAccessIds?: unknown }).priorReadAccessIds)
    ? ((body as unknown as { priorReadAccessIds: unknown[] }).priorReadAccessIds as unknown[])
        .filter((x): x is string => typeof x === 'string')
    : [];
  const recipients = priorAccess.filter((id) => !currentPrimaries.has(id) && id !== callerId);

  const roomTitle = (debate.title || '').slice(0, 200);
  const delivered = await insertRows(recipients, {
    debate_id: body.debateId,
    argument_id: null,
    type: 'room_made_private',
    room_title: roomTitle,
    meta: { roomIsPrivate: true },
  });

  return ok<RoomNotificationResponse>({ delivered });
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
  const body = raw as Partial<RoomNotificationRequestBody>;
  if (!isAllowedTrigger(body.type)) {
    return validationFailed({ error: 'invalid_type', message: 'Unknown notification trigger type.' });
  }
  if (!isUuid(body.debateId)) return badRequest('debate_id_required');

  const callerClient = createCallerClient(auth);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id;

  const safeBody: RoomNotificationRequestBody = {
    type: body.type,
    debateId: body.debateId,
    argumentId: typeof body.argumentId === 'string' ? body.argumentId : null,
    inviteId: typeof body.inviteId === 'string' ? body.inviteId : undefined,
    meta: body.meta,
  };

  try {
    switch (safeBody.type) {
      case 'invite':
        return await handleInvite(safeBody, callerId);
      case 'invite_accepted_by_invitee':
        return await handleInviteAcceptedByInvitee(safeBody, callerId);
      case 'argument_settled':
        return await handleArgumentSettled(safeBody, callerId);
      case 'chime_in_posted':
        return await handleChimeInPosted(safeBody, callerId);
      case 'chime_in_rejected':
        return await handleChimeInRejected(safeBody, callerId);
      case 'room_made_private':
        return await handleRoomMadePrivate(safeBody, callerId);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('room_notifications_error', safeBody.type, err instanceof Error ? err.message.slice(0, 120) : 'unknown');
    return internalError('notification_action_failed');
  }
});
