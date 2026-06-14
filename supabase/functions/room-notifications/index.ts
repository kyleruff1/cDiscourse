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
import { INVITE_TOKEN_MIN_LENGTH, INVITE_TOKEN_MAX_LENGTH } from '../_shared/inviteTokenShape.ts';
// EMAIL-TRANSPORT-001 — the shared, swappable product-email module. The Resend
// `fetch()` + Bearer header now live ONLY in `_shared/email/resendProvider.ts`;
// this function calls the single `sendTransactionalEmail` seam so the two
// cannot drift. Behavior-preserving: the existing-user branch, the gate
// posture, and the branch-independent response are unchanged.
import { sendTransactionalEmail } from '../_shared/email/sendTransactionalEmail.ts';
import { renderArgumentRoomInviteEmail } from '../_shared/email/emailTemplates.ts';

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
  /**
   * ARG-ROOM-004 — for the create-time `invite` trigger ONLY: the RAW invite
   * token (the reconciliation seam). The raw token is unrecoverable from the
   * stored hash, so the create surface — which already holds it in the
   * create-time `inviteLink` response — passes it here so the gated transports
   * can build a working link:
   *   - existing-user Resend email link `<origin>/invite/<token>`, and
   *   - new-user Auth-invite redirect `<origin>/auth/callback?invite=<token>`.
   * It is validated by shape, used ONLY to build those server-side links, and
   * NEVER logged or returned. Absent/invalid → the transports degrade to no
   * link (the inviter's copyable link still works).
   */
  inviteToken?: string | null;
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

// ── ARG-ROOM-004 — create-time invite transport gates + link builders ──
//
// Both transports are OFF by default. The create surface triggers this
// function after `create-argument-room` mints the room + invite (that function
// stays enumeration-safe + branch-free by contract — the new-vs-existing
// decision is made HERE, where the service-role + caller=inviter authorization
// already lives). Both gates default OFF so a merge lands DORMANT (no send).

/**
 * Existing-user product invite email gate.
 *
 * EMAIL-TRANSPORT-001 — the effective product-lane send predicate is now
 * `CDISCOURSE_EMAIL_TRANSPORT_ENABLED === 'true' && INVITE_EMAIL_ENABLED === 'true'`
 * (BOTH required). The new master gate (`CDISCOURSE_EMAIL_TRANSPORT_ENABLED`,
 * default OFF) is the lane-wide kill switch; `INVITE_EMAIL_ENABLED` (QOL-040,
 * default OFF) stays the per-feature switch. This is a deliberate, documented
 * gate-composition change (design §"Gating model"): to keep existing-user
 * invite email behaving as before, the operator sets BOTH. The actual send is
 * additionally guarded inside `sendTransactionalEmail` by the same master gate,
 * so this predicate and the orchestrator agree.
 */
function isInviteEmailEnabled(): boolean {
  const master = (Deno.env.get('CDISCOURSE_EMAIL_TRANSPORT_ENABLED') || '').trim().toLowerCase() === 'true';
  const perFeature = (Deno.env.get('INVITE_EMAIL_ENABLED') || '').trim().toLowerCase() === 'true';
  return master && perFeature;
}

/**
 * ARG-ROOM-004 — new-user Auth-invite bridge gate. Default OFF. The hosted
 * Supabase Auth email is demonstrably LIVE, so this in-function gate is what
 * keeps `inviteUserByEmail` from sending real invite emails on merge. The
 * operator flips it only after the bridge round-trip is smoke-verified.
 */
function isInviteAuthBridgeEnabled(): boolean {
  return (Deno.env.get('INVITE_AUTH_BRIDGE_ENABLED') || '').trim().toLowerCase() === 'true';
}

/**
 * The inviter-facing `notification` status for the `invite` trigger, derived
 * from a SINGLE branch-INDEPENDENT gate-posture predicate — never from which
 * branch ran nor a per-branch transport return. So existing-vs-new is
 * indistinguishable (no enumeration), including in any interim state where
 * only one gate is armed. Dormant (both gates OFF) → `not_configured`; any
 * gate armed → `queued` (the `sent`-vs-`queued` deliverability distinction is
 * deliberately collapsed so per-branch deliverability cannot leak).
 */
function resolveInviteNotificationStatus(): InviteEmailStatus {
  return isInviteEmailEnabled() || isInviteAuthBridgeEnabled() ? 'queued' : 'not_configured';
}

/** base64url token shape (mirrors src/features/invites/inviteDeepLink.ts). */
function isValidBridgeToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  if (token.length < INVITE_TOKEN_MIN_LENGTH || token.length > INVITE_TOKEN_MAX_LENGTH) return false;
  return /^[A-Za-z0-9_-]+$/.test(token);
}

/** Sanitise a request origin to a bare `proto//host` (mirrors create-argument-room). */
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

/** Existing-user email link `<origin>/invite/<token>`. Null when either input is unusable. */
function buildInviteLinkFromOrigin(requestOrigin: string, token: string | null | undefined): string | null {
  const safeOrigin = sanitiseOriginForLink(requestOrigin);
  if (!safeOrigin || !isValidBridgeToken(token)) return null;
  return `${safeOrigin}/invite/${token}`;
}

/**
 * New-user Auth-invite redirect `<origin>/auth/callback?invite=<token>`. The
 * `?invite=` query is the bridge the client's `extractBridgedInviteToken`
 * reads at cold start. Null when either input is unusable.
 */
function buildBridgeRedirect(requestOrigin: string, token: string | null | undefined): string | null {
  const safeOrigin = sanitiseOriginForLink(requestOrigin);
  if (!safeOrigin || !isValidBridgeToken(token)) return null;
  return `${safeOrigin}/auth/callback?invite=${token}`;
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
 * Send the existing-user product invite email.
 *
 * EMAIL-TRANSPORT-001 — BEHAVIOR-PRESERVING refactor: the inline Resend
 * `fetch()` body was lifted into the shared, swappable `_shared/email/` module.
 * This wrapper now renders via `renderArgumentRoomInviteEmail` and dispatches
 * through the single `sendTransactionalEmail` seam, then maps the audit-safe
 * `EmailSendResult.status` back to the QOL-038 `InviteEmailStatus` union so the
 * caller surface (`resolveInviteNotificationStatus` + the branch-independent
 * response) is unchanged. The product-lane gate is now
 * `CDISCOURSE_EMAIL_TRANSPORT_ENABLED && INVITE_EMAIL_ENABLED` (see
 * `isInviteEmailEnabled`); the orchestrator enforces the same master gate so
 * an OFF master always short-circuits with no network.
 *
 * Status mapping (audit-safe → caller union):
 *   - 'sent'                                       -> 'sent'
 *   - 'skipped_gate_off' | 'not_configured'        -> 'not_configured' (NO network)
 *   - 'failed_sanitized' | 'blocked_banned_copy'   -> 'queued'  (in-app row already
 *                                                     landed; operator reconciles)
 *
 * NEVER logs: Authorization header, API key, response body, raw recipient
 * email. The shared provider drains the body without echoing it; the key + the
 * `Bearer` header live ONLY in `_shared/email/resendProvider.ts`.
 */
async function maybeSendInviteEmail(input: {
  inviteId: string;
  recipientEmail: string;
  inviterDisplayName: string | null;
  roomTitle: string;
  inviteLink: string | null;
  roomIsPrivate: boolean;
}): Promise<InviteEmailStatus> {
  // Per-feature gate (composed with the master gate inside isInviteEmailEnabled).
  if (!isInviteEmailEnabled()) return 'not_configured';

  const recipient = (input.recipientEmail || '').trim();
  if (!recipient) return 'not_configured';

  // The redemption URL the email CTA points at is the app-controlled
  // `<origin>/invite/<token>` route (already built by buildInviteLinkFromOrigin
  // upstream). Absent => an empty URL; the orchestrator still renders neutral
  // copy and the inviter's copyable link is the fallback.
  const rendered = renderArgumentRoomInviteEmail({
    roomTitle: input.roomTitle,
    roomVisibility: input.roomIsPrivate ? 'private' : 'public',
    inviterDisplayName: input.inviterDisplayName,
    redemptionUrl: input.inviteLink || '',
  });

  const result = await sendTransactionalEmail({ to: recipient, rendered });

  switch (result.status) {
    case 'sent':
      return 'sent';
    case 'skipped_gate_off':
    case 'not_configured':
      return 'not_configured';
    case 'failed_sanitized':
    case 'blocked_banned_copy':
    default:
      // The in-app bell already landed; report 'queued' so the operator can
      // reconcile. The provider class is intentionally not surfaced here (the
      // result is audit-safe; nothing recipient/body/key-bearing is logged).
      // eslint-disable-next-line no-console
      console.error('invite_email_send_failed', {
        inviteIdShort: shortId(input.inviteId),
        outcome: result.status,
      });
      return 'queued';
  }
}

// ── Trigger handlers ─────────────────────────────────────────

async function handleInvite(
  body: RoomNotificationRequestBody,
  callerId: string,
  requestOrigin: string,
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

  if (inviteeUserId) {
    // EXISTING-account invitee. Create the in-app notification keyed to
    // that user (the canonical surface). Author = the inviter; the dedupe
    // step inside resolveRecipients strips the inviter from recipients.
    // The insert count is intentionally NOT captured/surfaced — see the
    // branch-independent return below (no existing-vs-new enumeration).
    await insertRows([inviteeUserId], {
      debate_id: invite.debate_id,
      argument_id: null,
      type: 'invite',
      room_title: roomTitle,
      meta: {
        ...(roomIsPrivate ? { roomIsPrivate: true } : {}),
      },
    });

    // Gated Resend email (INVITE_EMAIL_ENABLED, off by default → no
    // network). ARG-ROOM-004 reconciliation: the email now carries a
    // WORKING link built from the (validated) raw token + request origin —
    // closing the QOL-040 inviteLink-null gap. The per-branch transport
    // return is intentionally NOT used for the response status (see
    // resolveInviteNotificationStatus) so existing-vs-new cannot leak.
    const { data: inviterProfile } = await svc
      .from('profiles')
      .select('id, display_name, role')
      .eq('id', invite.invited_by)
      .maybeSingle<ProfileRow>();
    await maybeSendInviteEmail({
      inviteId: invite.id,
      recipientEmail: inviteeEmail,
      inviterDisplayName: inviterProfile?.display_name || null,
      roomTitle,
      inviteLink: buildInviteLinkFromOrigin(requestOrigin, body.inviteToken),
      roomIsPrivate,
    });
  } else if (isInviteAuthBridgeEnabled()) {
    // BRAND-NEW invitee (no account). Gated behind INVITE_AUTH_BRIDGE_ENABLED
    // (default OFF → DORMANT: no Auth invite is sent on merge). The hosted
    // Supabase Auth email is LIVE, so this in-function gate is what holds the
    // live send for the operator's explicit flip. When armed, send the
    // Supabase Auth "Invite user" email, whose CTA returns to
    // `<origin>/auth/callback?invite=<token>` so the shipped #607/#608 chain
    // auto-accepts the reserved seat after set-password. inviteUserByEmail
    // creates the auth.users row — the sanctioned seam because this function
    // already holds a service-role client AND re-derived caller=inviter
    // authorization above. Best-effort: a failed/rate-limited send never
    // blocks; the inviter's copyable link is the fallback. Token + email are
    // NEVER logged.
    const redirectTo = buildBridgeRedirect(requestOrigin, body.inviteToken);
    if (redirectTo) {
      try {
        await svc.auth.admin.inviteUserByEmail(inviteeEmail, { redirectTo });
      } catch {
        // Benign causes: hosted Auth rate limit, or a race where the account
        // was created between the lookup and here. Seat + link are unaffected.
      }
    }
  }

  // Branch-INDEPENDENT response (no enumeration): BOTH `delivered` and the
  // notification status are constant across existing-vs-new, so the inviter
  // cannot infer whether the invitee already has an account. The in-app bell
  // above is still delivered to an existing invitee; its count is simply not
  // surfaced. notification: dormant → not_configured, any armed → queued.
  return ok<RoomNotificationResponse>({ delivered: 0, notification: resolveInviteNotificationStatus() });
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
  // ARG-ROOM-004 — the deployed SPA origin (used to build the create-time
  // invite links server-side; never read from .env). Same posture as
  // create-argument-room / manage-room-invite.
  const requestOrigin = req.headers.get('origin') || req.headers.get('Origin') || '';

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
    // ARG-ROOM-004 — pass the raw token through ONLY when its shape is valid;
    // it is used solely to build server-side links + redirect, never logged.
    inviteToken: isValidBridgeToken(body.inviteToken) ? body.inviteToken : null,
    meta: body.meta,
  };

  try {
    switch (safeBody.type) {
      case 'invite':
        return await handleInvite(safeBody, callerId, requestOrigin);
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
