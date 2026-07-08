/**
 * Edge Function: create-argument-room (ARG-ROOM-002, #613)
 *
 * Server-authoritative room creation. After this card's migration drops the
 * client `debates` INSERT policy, the SECURITY DEFINER `create_argument_room`
 * RPC (called here with the service-role client) is the ONLY way a room is
 * created — so the binding matrix is true at the database for every writer.
 *
 * Enforces, server-side, the operator-ratified creation matrix (mirrors
 * src/features/debates/argumentRoomCreationMatrix.ts):
 *   - private + no invite        -> 400 private_requires_invite
 *   - any + 2+ invites           -> 422 validation_failed (schema accepts <= 1)
 *   - invite addressed to caller -> 400 cannot_invite_self
 *   - public + 0/1 invite        -> 200 (creator auto-joined; 1 reserved if invite)
 *   - private + 1 invite         -> 200 (creator + reserved invite = the 1v1)
 *
 * Security model (cdiscourse-doctrine + supabase-edge-contract):
 *   - verify_jwt = true in config.toml. We ADDITIONALLY validate the JWT via
 *     createCallerClient + getUser (defense-in-depth against config drift) to
 *     resolve callerId + callerEmail.
 *   - The service-role client is used ONLY for the privileged RPC (and the
 *     non-sensitive active-constitution read), never for an unvalidated write.
 *   - The raw invite token is minted in Deno, hashed before it reaches Postgres
 *     (only token_hash is stored), and returned to the CREATOR exactly once at
 *     create time (same posture as manage-room-invite create). It is never
 *     logged, never stored, never returned by any list surface.
 *   - No account enumeration: the response shape + status are identical whether
 *     or not the invited email maps to an existing account.
 *   - Logs carry function name, short caller id, short room id, and the invitee
 *     email DOMAIN only — never the raw token, the full email, the Authorization
 *     header, or the service-role key.
 */
import { z } from 'npm:zod@4';
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
import { generateInviteToken, hashInviteToken } from '../_shared/inviteToken.ts';

// ── Request schema — at most ONE invite (a single optional object) ──
// `.strict()` so an `invites: [...]` array or a 2nd invite key fails as
// validation_failed (422) rather than being silently stripped. The one-invite-
// per-room unique index is the durable DB backstop.
const InviteObject = z
  .object({
    email: z.string().email().max(320),
    intendedSeat: z.enum(['respondent', 'co_primary']).default('respondent'),
  })
  .strict();

const CreateArgumentRoomSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    resolution: z.string().trim().min(1).max(5000),
    description: z.string().trim().max(10000).optional(),
    visibility: z.enum(['public', 'private']),
    invite: InviteObject.optional(),
    // START-002 (#839) — OPTIONAL, ADDITIVE. Present => the room is scoped to a
    // circle audience (a private room whose N-member audience arrives via the
    // shipped membership helper, NOT via minted invites). Absent => the request
    // parses + behaves byte-identically to the pre-START-002 contract. `.strict()`
    // is preserved so an unknown key still 422s and a non-uuid circle_id 422s at
    // the schema.
    circle_id: z.string().uuid().optional(),
  })
  .strict();

type CreateArgumentRoomRequest = z.infer<typeof CreateArgumentRoomSchema>;

interface CreateRpcRow {
  debate_id: string;
  invite_id: string | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return methodNotAllowed();

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader) return unauthorized();

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  const parsed = CreateArgumentRoomSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationFailed({
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const body: CreateArgumentRoomRequest = parsed.data;
  const requestOrigin = req.headers.get('origin') || req.headers.get('Origin') || '';

  try {
    return await handleCreateArgumentRoom(body, authHeader, requestOrigin);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('create_argument_room_error', errorMessage(err));
    return internalError('room_create_failed');
  }
});

async function handleCreateArgumentRoom(
  body: CreateArgumentRoomRequest,
  authHeader: string,
  requestOrigin: string,
): Promise<Response> {
  // 1) Identify caller (defense-in-depth even though verify_jwt = true).
  const callerClient = createCallerClient(authHeader);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;
  const callerEmail = (userRes.user.email || '').toLowerCase();

  // START-002 (#839) — circle-audience path. A single early branch keeps the
  // NON-circle path structurally UNTOUCHED (AC1 provable by diff): requests
  // without `circle_id` fall straight through to the existing logic below. All
  // circle guards run BEFORE any DB write.
  if (body.circle_id !== undefined) {
    return await handleCircleRoomCreate(body, callerId, callerClient);
  }
  // ── existing non-circle path continues unchanged below ──

  const hasInvite = body.invite !== undefined;
  const inviteeEmailLower = hasInvite ? body.invite!.email.trim().toLowerCase() : null;
  const intendedSeat = hasInvite ? body.invite!.intendedSeat : null;

  // 2) private => invite (matrix rule; the RPC re-asserts it as the DB backstop).
  if (body.visibility === 'private' && !hasInvite) {
    return jsonError(400, 'private_requires_invite', 'A private argument needs one person invited to start it.');
  }

  // 3) Self-invite guard — done BEFORE any DB write.
  if (hasInvite && callerEmail && callerEmail === inviteeEmailLower) {
    return jsonError(400, 'cannot_invite_self', 'You cannot invite yourself.');
  }

  // 4) Active constitution id (caller-scoped read — non-sensitive, RLS-readable).
  const { data: constitutionRow, error: constErr } = await callerClient
    .from('constitution_versions')
    .select('id')
    .eq('active', true)
    .maybeSingle<{ id: string }>();
  if (constErr) return internalError('constitution_lookup_failed');
  if (!constitutionRow?.id) {
    return jsonError(409, 'no_active_constitution', 'No active constitution found. Ask an admin to publish one.');
  }

  // 5) Mint a token + hash ONLY when an invite is requested. The raw token
  //    never reaches Postgres — only the hash is stored.
  let rawToken: string | null = null;
  let tokenHash: string | null = null;
  let expiresAt: string | null = null;
  if (hasInvite) {
    rawToken = generateInviteToken();
    tokenHash = await hashInviteToken(rawToken);
    expiresAt = defaultExpiresAt();
  }

  // 6) Service-role RPC — the SOLE authoritative room creator. Atomic:
  //    debate + creator participant + optional invite in one transaction.
  const svc = createServiceClient();
  const { data: rpcData, error: rpcErr } = await svc.rpc('create_argument_room', {
    p_created_by: callerId,
    p_title: body.title,
    p_resolution: body.resolution,
    p_description: body.description ?? null,
    p_constitution_id: constitutionRow.id,
    p_visibility: body.visibility,
    p_invitee_email_lower: inviteeEmailLower,
    p_intended_seat: intendedSeat,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  });

  if (rpcErr) {
    const msg = (rpcErr as { message?: string }).message || '';
    // The RPC re-asserts the matrix rules; surface them as stable codes.
    if (msg.includes('private_requires_invite')) {
      return jsonError(400, 'private_requires_invite', 'A private argument needs one person invited to start it.');
    }
    if (msg.includes('room_capacity_reached')) {
      return jsonError(409, 'room_capacity_reached', 'This argument already has the most people it can hold.');
    }
    if (msg.includes('invalid_visibility')) {
      return jsonError(400, 'invalid_visibility', 'Choose whether this argument is public or private.');
    }
    return internalError('room_create_failed');
  }

  const row = Array.isArray(rpcData) ? (rpcData[0] as CreateRpcRow | undefined) : (rpcData as CreateRpcRow | null);
  if (!row?.debate_id) return internalError('room_create_failed');

  // 7) Build the invite link from the request origin (never read from .env).
  //    Returned ONLY to the creator, ONLY at create time. The only place the
  //    raw token exists; never logged, never stored, never in any list surface.
  const inviteLink =
    hasInvite && rawToken ? buildInviteLink(requestOrigin, rawToken) : null;

  // 8) Structured log — short ids + email DOMAIN only. No token, no full email,
  //    no Authorization header, no service-role key.
  // eslint-disable-next-line no-console
  console.error('create_argument_room_ok', {
    callerIdShort: shortId(callerId),
    debateIdShort: shortId(row.debate_id),
    visibility: body.visibility,
    inviteIssued: hasInvite,
    emailDomain: inviteeEmailLower ? emailDomain(inviteeEmailLower) : null,
  });

  return ok({
    debateId: row.debate_id,
    visibility: body.visibility,
    inviteId: row.invite_id ?? null,
    inviteLink, // omitted (null) when there is no invite or origin sanitisation failed
  });
}

// ── START-002 (#839) — circle-audience room creation ────────────

/**
 * Create a circle-scoped room. Additive path; the non-circle handler above is
 * untouched. Doctrine:
 *   - Forced private by REJECT, not coerce (never silently override an explicit
 *     `public`); the debates_circle_requires_private CHECK is the DB backstop.
 *   - One audience per room: a circle IS the audience, so an invite is refused.
 *   - No enumeration oracle: non-member, nonexistent, and soft-deleted circle
 *     all return the identical `circle_not_found` (is_circle_member returns
 *     false for all three).
 *   - Write lane needs NO migration: the atomic RPC hard-rejects private+no-invite,
 *     so the room is created PUBLIC + no invite, then flipped to private +
 *     stamped with the circle in one UPDATE. The QOL-039 one-way visibility
 *     trigger permits public->private. The service-role client touches ONLY the
 *     RPC + that one `debates` UPDATE (never a direct `debates` INSERT).
 *   - Zero `argument_room_invites` rows are minted on this path (membership,
 *     not invite fan-out).
 */
async function handleCircleRoomCreate(
  body: CreateArgumentRoomRequest,
  callerId: string,
  callerClient: ReturnType<typeof createCallerClient>,
): Promise<Response> {
  const circleId = body.circle_id as string;

  // Guard 1 — forced-private (reject, not coerce). Client never sends this; the
  // picker disables the public toggle for circles. Defense-in-depth.
  if (body.visibility === 'public') {
    return jsonError(400, 'circle_requires_private', 'A circle argument is always private.');
  }

  // Guard 2 — one audience per room (the circle is the audience).
  if (body.invite !== undefined) {
    return validationFailed({
      error: 'validation_failed',
      issues: [
        {
          path: ['invite'],
          message: 'A circle argument reaches its whole circle — do not add an invite.',
        },
      ],
    });
  }

  // Guard 3 — membership (NO oracle). Caller-scoped is_circle_member RPC:
  // p_user_id defaults to auth.uid() under the caller JWT = caller. A transport
  // error is distinct (circle_lookup_failed) from a clean not-member; a false
  // result (non-member / nonexistent / soft-deleted) is the identical 404.
  const { data: isMember, error: memberErr } = await callerClient.rpc('is_circle_member', {
    p_circle_id: circleId,
  });
  if (memberErr) {
    return jsonError(500, 'circle_lookup_failed', 'Could not check that circle. Try again in a moment.');
  }
  if (isMember !== true) {
    return jsonError(404, 'circle_not_found', 'We could not find that circle.');
  }

  // Guard 4 — active constitution id (caller-scoped read; same as the non-circle
  // path). Runs before any write.
  const { data: constitutionRow, error: constErr } = await callerClient
    .from('constitution_versions')
    .select('id')
    .eq('active', true)
    .maybeSingle<{ id: string }>();
  if (constErr) return internalError('constitution_lookup_failed');
  if (!constitutionRow?.id) {
    return jsonError(409, 'no_active_constitution', 'No active constitution found. Ask an admin to publish one.');
  }

  // Write lane (no migration): 1) atomic room + creator participant, created
  // PUBLIC + no invite so the RPC's private_requires_invite rule does not fire.
  const svc = createServiceClient();
  const { data: rpcData, error: rpcErr } = await svc.rpc('create_argument_room', {
    p_created_by: callerId,
    p_title: body.title,
    p_resolution: body.resolution,
    p_description: body.description ?? null,
    p_constitution_id: constitutionRow.id,
    p_visibility: 'public', // internal mechanism only; flipped to private below
    p_invitee_email_lower: null,
    p_intended_seat: null,
    p_token_hash: null,
    p_expires_at: null,
  });
  if (rpcErr) return internalError('room_create_failed');

  const row = Array.isArray(rpcData)
    ? (rpcData[0] as CreateRpcRow | undefined)
    : (rpcData as CreateRpcRow | null);
  const debateId = row?.debate_id;
  if (!debateId) return internalError('room_create_failed');

  // 2) Flip PUBLIC -> PRIVATE + stamp the circle in ONE statement. QOL-039's
  //    one-way trigger permits public->private; the debates_circle_requires_private
  //    CHECK backstops circle_id NOT NULL => private.
  const { data: updRows, error: updErr } = await svc
    .from('debates')
    .update({ visibility: 'private', circle_id: circleId })
    .eq('id', debateId)
    .select('id');
  if (updErr || !updRows || updRows.length !== 1) {
    // Never leave a stranded public room SILENTLY: log the orphan short id for
    // operator cleanup (the orphan is a valid public empty room the creator
    // joined — no arguments, no circle data can leak in the window), then fail
    // loudly. We do NOT return the room id to the client (no id leak in the
    // error body); the operator reconciles from this structured log.
    // eslint-disable-next-line no-console
    console.error('create_argument_room_circle_flip_failed', {
      debateIdShort: shortId(debateId),
    });
    return internalError('room_create_failed');
  }

  // Structured log — short ids only. No full circle_id value, no Authorization,
  // no service-role key.
  // eslint-disable-next-line no-console
  console.error('create_argument_room_circle_ok', {
    callerIdShort: shortId(callerId),
    debateIdShort: shortId(debateId),
    circleIdShort: shortId(circleId),
    visibility: 'private',
  });

  return ok({
    debateId,
    visibility: 'private',
    inviteId: null,
    inviteLink: null,
    circleId, // present ONLY on circle-path 200s (a testable round-trip signal)
  });
}

// ── helpers (mirror manage-room-invite) ─────────────────────────

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 160);
  return String(err).slice(0, 160);
}

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1) || null : null;
}

/** ISO timestamp 14 days from now (matches the argument_room_invites DB default). */
function defaultExpiresAt(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

function buildInviteLink(requestOrigin: string, rawToken: string): string | null {
  const safeOrigin = sanitiseOriginForLink(requestOrigin);
  return safeOrigin ? `${safeOrigin}/invite/${rawToken}` : null;
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
