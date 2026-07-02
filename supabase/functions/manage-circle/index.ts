/**
 * Edge Function: manage-circle (PRIVATE-GROUPS-002, #859)
 *
 * Six actions on public.circles / public.circle_members:
 *
 *   - create             — mint a circle + owner membership row (JWT required).
 *                          Calls the SECURITY DEFINER create_circle RPC via
 *                          service-role with p_owner_id = the caller id.
 *   - rename             — owner-gated rename / description update (JWT required).
 *   - soft_delete        — owner-gated soft-delete (is_deleted = true).
 *   - transfer_ownership — owner-gated demote-then-promote in one service-role
 *                          tx, respecting the circle_members_one_owner index.
 *   - remove_member      — owner-gated soft-remove of a member (is_removed).
 *   - list_mine          — RLS-filtered list of the caller's live circles.
 *
 * Security model (cdiscourse-doctrine + supabase-edge-contract):
 *   - verify_jwt = true in config.toml. Every action ADDITIONALLY validates
 *     the JWT via createCallerClient + getUser (defense-in-depth against a
 *     config drift) to resolve the caller id.
 *   - Owner-gated actions authorize the caller via an is_circle_owner read
 *     BEFORE any mutation. The service-role client is used ONLY after that
 *     check passes.
 *   - There is NO authenticated write policy on circles / circle_members —
 *     this function's service-role client is the only writer.
 *   - The function NEVER returns another member's email / PII. list_mine
 *     returns the caller's own circles + a member count only.
 *   - Logs carry the function name, short caller id, short circle id, and a
 *     stable action label only — never the Authorization header or the
 *     service-role key.
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
import { ManageCircleRequestSchema } from '../_shared/circleSchemas.ts';
import type { ManageCircleRequest } from '../_shared/circleSchemas.ts';

interface CircleRow {
  id: string;
  owner_id: string;
  name: string | null;
  description: string | null;
  is_deleted: boolean;
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

  const parsed = ManageCircleRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationFailed({
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const body: ManageCircleRequest = parsed.data;
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  try {
    switch (body.action) {
      case 'create':
        return await handleCreate(body, authHeader);
      case 'rename':
        return await handleRename(body, authHeader);
      case 'soft_delete':
        return await handleSoftDelete(body, authHeader);
      case 'transfer_ownership':
        return await handleTransferOwnership(body, authHeader);
      case 'remove_member':
        return await handleRemoveMember(body, authHeader);
      case 'list_mine':
        return await handleListMine(body, authHeader);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('manage_circle_error', body.action, errorMessage(err));
    return internalError('circle_action_failed');
  }
});

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 160);
  return String(err).slice(0, 160);
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

/** Resolve the caller id from the JWT, or null if unauthenticated. */
async function resolveCaller(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const callerClient = createCallerClient(authHeader);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return null;
  return userRes.user.id as string;
}

/**
 * Owner authorization — reads is_circle_owner via the service-role client
 * (the SECURITY DEFINER helper is authoritative). Returns the circle row on
 * success, or a Response error to return directly.
 */
async function authorizeOwner(
  svc: ReturnType<typeof createServiceClient>,
  circleId: string,
  callerId: string,
): Promise<{ circle: CircleRow } | { error: Response }> {
  const { data: circle, error: circleErr } = await svc
    .from('circles')
    .select('id, owner_id, name, description, is_deleted')
    .eq('id', circleId)
    .maybeSingle<CircleRow>();
  if (circleErr) return { error: internalError('circle_lookup_failed') };
  if (!circle) return { error: jsonError(404, 'circle_not_found', 'We could not find that circle.') };
  if (circle.is_deleted) {
    return { error: jsonError(409, 'circle_deleted', 'This circle is no longer active.') };
  }
  if (circle.owner_id !== callerId) {
    return { error: jsonError(403, 'not_circle_owner', 'Only the circle owner can do that.') };
  }
  return { circle };
}

// ── create ────────────────────────────────────────────────────

async function handleCreate(
  body: Extract<ManageCircleRequest, { action: 'create' }>,
  authHeader: string | null,
): Promise<Response> {
  const callerId = await resolveCaller(authHeader);
  if (!callerId) return unauthorized();

  // Service-role: the create_circle RPC inserts the circle + owner membership
  // atomically with p_owner_id = the CALLER (never a client-supplied owner).
  const svc = createServiceClient();
  const { data: circleId, error: rpcErr } = await svc.rpc('create_circle', {
    p_owner_id: callerId,
    p_name: body.name,
    p_description: body.description ?? null,
  });
  if (rpcErr || !circleId) {
    return internalError('circle_create_failed');
  }

  // eslint-disable-next-line no-console
  console.error('manage_circle_ok', {
    action: 'create',
    callerIdShort: shortId(callerId),
    circleIdShort: shortId(String(circleId)),
  });

  return ok({ circleId: String(circleId), role: 'owner' });
}

// ── rename ────────────────────────────────────────────────────

async function handleRename(
  body: Extract<ManageCircleRequest, { action: 'rename' }>,
  authHeader: string | null,
): Promise<Response> {
  const callerId = await resolveCaller(authHeader);
  if (!callerId) return unauthorized();

  const svc = createServiceClient();
  const authz = await authorizeOwner(svc, body.circleId, callerId);
  if ('error' in authz) return authz.error;

  const patch: Record<string, unknown> = {
    name: body.name,
    updated_at: new Date().toISOString(),
  };
  if (body.description !== undefined) patch.description = body.description;

  const { error: updateErr } = await svc
    .from('circles')
    .update(patch)
    .eq('id', body.circleId)
    .eq('is_deleted', false);
  if (updateErr) return internalError('circle_rename_failed');

  return ok({ circleId: body.circleId, name: body.name });
}

// ── soft_delete ───────────────────────────────────────────────

async function handleSoftDelete(
  body: Extract<ManageCircleRequest, { action: 'soft_delete' }>,
  authHeader: string | null,
): Promise<Response> {
  const callerId = await resolveCaller(authHeader);
  if (!callerId) return unauthorized();

  const svc = createServiceClient();
  const authz = await authorizeOwner(svc, body.circleId, callerId);
  if ('error' in authz) return authz.error;

  const { error: updateErr } = await svc
    .from('circles')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', body.circleId)
    .eq('is_deleted', false);
  if (updateErr) return internalError('circle_soft_delete_failed');

  return ok({ circleId: body.circleId, status: 'deleted' });
}

// ── transfer_ownership ────────────────────────────────────────

async function handleTransferOwnership(
  body: Extract<ManageCircleRequest, { action: 'transfer_ownership' }>,
  authHeader: string | null,
): Promise<Response> {
  const callerId = await resolveCaller(authHeader);
  if (!callerId) return unauthorized();

  const svc = createServiceClient();
  const authz = await authorizeOwner(svc, body.circleId, callerId);
  if ('error' in authz) return authz.error;

  if (body.newOwnerUserId === callerId) {
    return jsonError(400, 'already_owner', 'That member already owns this circle.');
  }

  // The new owner must be a live member of the circle.
  const { data: newOwnerRow } = await svc
    .from('circle_members')
    .select('id, is_removed')
    .eq('circle_id', body.circleId)
    .eq('user_id', body.newOwnerUserId)
    .eq('is_removed', false)
    .maybeSingle<{ id: string; is_removed: boolean }>();
  if (!newOwnerRow) {
    return jsonError(404, 'member_not_found', 'That person is not a member of this circle.');
  }

  // Demote the current owner to 'member' FIRST, then promote the new owner, so
  // the circle_members_one_owner partial unique index never sees two owners.
  const { error: demoteErr } = await svc
    .from('circle_members')
    .update({ role: 'member' })
    .eq('circle_id', body.circleId)
    .eq('user_id', callerId)
    .eq('role', 'owner');
  if (demoteErr) return internalError('circle_transfer_failed');

  const { error: promoteErr } = await svc
    .from('circle_members')
    .update({ role: 'owner' })
    .eq('circle_id', body.circleId)
    .eq('user_id', body.newOwnerUserId)
    .eq('is_removed', false);
  if (promoteErr) return internalError('circle_transfer_failed');

  // Keep the circles.owner_id column in sync with the membership role.
  const { error: ownerColErr } = await svc
    .from('circles')
    .update({ owner_id: body.newOwnerUserId, updated_at: new Date().toISOString() })
    .eq('id', body.circleId);
  if (ownerColErr) return internalError('circle_transfer_failed');

  return ok({ circleId: body.circleId, newOwnerUserId: body.newOwnerUserId, status: 'transferred' });
}

// ── remove_member ─────────────────────────────────────────────

async function handleRemoveMember(
  body: Extract<ManageCircleRequest, { action: 'remove_member' }>,
  authHeader: string | null,
): Promise<Response> {
  const callerId = await resolveCaller(authHeader);
  if (!callerId) return unauthorized();

  const svc = createServiceClient();
  const authz = await authorizeOwner(svc, body.circleId, callerId);
  if ('error' in authz) return authz.error;

  if (body.memberUserId === callerId) {
    // The owner cannot remove themselves — they must transfer first.
    return jsonError(400, 'cannot_remove_owner', 'Transfer ownership before you leave the circle.');
  }

  const { error: removeErr } = await svc
    .from('circle_members')
    .update({ is_removed: true, removed_at: new Date().toISOString() })
    .eq('circle_id', body.circleId)
    .eq('user_id', body.memberUserId)
    .eq('role', 'member')
    .eq('is_removed', false);
  if (removeErr) return internalError('circle_remove_member_failed');

  return ok({ circleId: body.circleId, status: 'removed' });
}

// ── list_mine ─────────────────────────────────────────────────

async function handleListMine(
  _body: Extract<ManageCircleRequest, { action: 'list_mine' }>,
  authHeader: string | null,
): Promise<Response> {
  const callerId = await resolveCaller(authHeader);
  if (!callerId) return unauthorized();
  const callerClient = createCallerClient(authHeader as string);

  // Caller-scoped read — RLS returns only circles the caller can see (their
  // own memberships + owned circles). We NEVER return another member's PII.
  const { data: memberships, error: listErr } = await callerClient
    .from('circle_members')
    .select('circle_id, role, circles(id, name, description, is_deleted)')
    .eq('user_id', callerId)
    .eq('is_removed', false);
  if (listErr) return internalError('circle_list_failed');

  const circles = (memberships || [])
    .map((row: Record<string, unknown>) => {
      const c = row.circles as
        | { id: string; name: string | null; description: string | null; is_deleted: boolean }
        | null;
      if (!c || c.is_deleted) return null;
      return {
        circleId: c.id,
        name: c.name || '',
        description: c.description || '',
        role: row.role as string,
      };
    })
    .filter((x): x is { circleId: string; name: string; description: string; role: string } => x !== null);

  return ok({ circles });
}
