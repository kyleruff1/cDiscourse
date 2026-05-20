/**
 * Edge Function: apply-manual-tag (META-1A)
 *
 * The single write path for the persisted manual-tag ledger (`point_tags`).
 *
 * Workflow:
 *   1. CORS preflight / method gate.
 *   2. Require a valid user JWT.
 *   3. Validate body { action, debateId, argumentId, tagCode }.
 *   4. Identify the caller via the caller-scoped client.
 *   5. Load the target argument (caller-scoped — RLS gates visibility).
 *   6. Derive the caller's eligibility context (actor role + own-bubble).
 *   7. Enforce the META-001 eligibility matrix (mirrored in
 *      _shared/pointTagEligibility.ts). Ineligible → 403.
 *   8. action='apply'  → insert a point_tags row (caller-scoped; the
 *      partial unique index makes a duplicate apply idempotent).
 *      action='remove' → set removed_at (soft-delete) on the caller's
 *      matching active row (admins may also remove others' tags).
 *   9. Re-select the active tags for the argument and return them.
 *   10. Best-effort audit row in admin_audit_events (service-role).
 *
 * Hard rules:
 *   - A manual tag is a participant gameplay annotation, never a verdict.
 *   - The Edge Function is the ONLY write path into `point_tags`.
 *   - Soft-delete only — this function NEVER calls `.delete()` on
 *     `point_tags`.
 *   - The service-role client is used ONLY for the best-effort audit row.
 *   - Never logs the Authorization header or any key.
 *   - No AI call.
 */
import { corsHeaders, ok, badRequest, unauthorized, forbidden, methodNotAllowed, internalError } from '../_shared/http.ts';
import { createCallerClient, createServiceClient } from '../_shared/supabaseClients.ts';
import {
  ALL_MANUAL_TAG_CODES,
  isApplyAllowed,
  type EligibilityContext,
  type ManualTagActorRole,
  type ManualTagCode,
} from '../_shared/pointTagEligibility.ts';

type ApplyManualTagAction = 'apply' | 'remove';

interface ApplyManualTagRequest {
  action: ApplyManualTagAction;
  debateId: string;
  argumentId: string;
  tagCode: ManualTagCode;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isTagCode(s: unknown): s is ManualTagCode {
  return typeof s === 'string' && (ALL_MANUAL_TAG_CODES as ReadonlyArray<string>).includes(s);
}

function shortId(id: string): string {
  return id && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

interface ActiveTagRow {
  id: string;
  tag_code: string;
  tagged_by: string;
  created_at: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return methodNotAllowed();

  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return unauthorized();

  let raw: unknown;
  try { raw = await req.json(); } catch { return badRequest('invalid_json'); }
  const body = raw as Partial<ApplyManualTagRequest>;

  if (body.action !== 'apply' && body.action !== 'remove') return badRequest('invalid_action');
  if (!isUuid(body.debateId) || !isUuid(body.argumentId)) return badRequest('debateId_and_argumentId_required');
  if (!isTagCode(body.tagCode)) return badRequest('invalid_tag_code');

  const action: ApplyManualTagAction = body.action;
  const debateId: string = body.debateId;
  const argumentId: string = body.argumentId;
  const tagCode: ManualTagCode = body.tagCode;

  const callerClient = createCallerClient(auth);

  // ── Identify caller. ──
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id;

  // ── Load the target argument (caller-scoped — RLS gates visibility). ──
  // An invisible / missing row is treated as forbidden (no existence leak).
  const { data: argRow, error: argErr } = await callerClient
    .from('arguments')
    .select('id, author_id, debate_id, status')
    .eq('id', argumentId)
    .maybeSingle();
  if (argErr) return internalError(`argument_lookup_failed:${String(argErr.message || '').slice(0, 120)}`);
  if (!argRow) return forbidden('argument_not_visible');
  if (argRow.debate_id !== debateId) return badRequest('debate_argument_mismatch');
  if (argRow.status === 'deleted') return badRequest('argument_deleted');

  // ── Eligibility derivation. ──
  const { data: participantRow } = await callerClient
    .from('debate_participants')
    .select('side')
    .eq('debate_id', debateId)
    .eq('user_id', callerId)
    .maybeSingle();
  const { data: profileRow } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .maybeSingle();

  const isAdmin = profileRow?.role === 'admin';
  const side = participantRow?.side ?? null;

  let applierActorRole: ManualTagActorRole;
  if (isAdmin) {
    applierActorRole = 'admin';
  } else if (side === 'affirmative') {
    applierActorRole = 'participant_affirmative';
  } else if (side === 'negative') {
    applierActorRole = 'participant_negative';
  } else if (side === 'moderator') {
    // A moderator who is also a moderator/admin profile is treated as admin;
    // otherwise as a participant (the eligibility outcome does not depend on
    // which participant side).
    applierActorRole = profileRow?.role === 'moderator' || profileRow?.role === 'admin'
      ? 'admin'
      : 'participant_affirmative';
  } else {
    // observer side, or no participant row at all → observer.
    applierActorRole = 'observer';
  }

  const isOwnBubble = argRow.author_id === callerId;
  const eligibilityContext: EligibilityContext = {
    applierUserId: callerId,
    applierActorRole,
    isOwnBubble,
  };

  if (!isApplyAllowed(tagCode, eligibilityContext)) {
    return forbidden('not_eligible');
  }

  // ── Mutate. ──
  if (action === 'apply') {
    const { error: insertErr } = await callerClient
      .from('point_tags')
      .insert({
        debate_id: debateId,
        argument_id: argumentId,
        tag_code: tagCode,
        tagged_by: callerId,
      });
    // 23505 = unique_violation: the same tagger already applied this code on
    // this argument. Treat as idempotent success (the tag already exists).
    if (insertErr && insertErr.code !== '23505') {
      return internalError(`insert_failed:${String(insertErr.message || 'unknown').slice(0, 120)}`);
    }
  } else {
    // action === 'remove' — soft-delete the caller's matching ACTIVE row.
    // Admins may also remove others' tags (RLS permits); for an admin we
    // drop the tagged_by filter.
    let updateQuery = callerClient
      .from('point_tags')
      .update({ removed_at: new Date().toISOString(), removed_by: callerId })
      .eq('argument_id', argumentId)
      .eq('tag_code', tagCode)
      .is('removed_at', null);
    if (!isAdmin) {
      updateQuery = updateQuery.eq('tagged_by', callerId);
    }
    const { error: updateErr } = await updateQuery;
    // No matching active row → idempotent success (already removed / absent).
    if (updateErr) {
      return internalError(`remove_failed:${String(updateErr.message || 'unknown').slice(0, 120)}`);
    }
  }

  // ── Re-select active tags for the argument (caller-scoped). ──
  const { data: activeRows, error: selectErr } = await callerClient
    .from('point_tags')
    .select('id, tag_code, tagged_by, created_at')
    .eq('argument_id', argumentId)
    .is('removed_at', null)
    .order('created_at', { ascending: true });
  if (selectErr) return internalError('active_tags_lookup_failed');

  const activeTags = ((activeRows ?? []) as ActiveTagRow[]).map((r) => ({
    id: r.id,
    tagCode: r.tag_code as ManualTagCode,
    taggedBy: r.tagged_by,
    createdAt: r.created_at,
  }));

  // ── Audit (best-effort; service-role only used here, never logged). ──
  try {
    const svc = createServiceClient();
    await svc.from('admin_audit_events').insert({
      action: action === 'apply' ? 'point_tag_applied' : 'point_tag_removed',
      source: 'edge_function',
      actor_user_id: callerId,
      target_user_id: argRow.author_id,
      reason: null,
      payload: {
        debateIdShort: shortId(debateId),
        argumentIdShort: shortId(argumentId),
        tagCode,
      },
    });
  } catch { /* audit failure must not block the user */ }

  return ok({ argumentId, activeTags });
});
