/**
 * Edge Function: react-to-move (QOL-041)
 *
 * The sole write path for `move_reactions`. The fist-bump is the ONE
 * allowed reaction in v1 because it carries NO SCORE, NO VERDICT, NO
 * STANDING CHANGE (QOL-041 design §1, §5.4, §5.6, §7.3).
 *
 * Workflow:
 *   1. CORS preflight / method gate.
 *   2. Require a valid user JWT.
 *   3. Validate body { action, debateId, argumentId, kind? } — kind
 *      defaults to 'fist_bump' (the only allowed value in v1).
 *   4. Identify the caller via the caller-scoped client.
 *   5. Load the target argument (caller-scoped — RLS gates visibility).
 *   6. Reject self-fist-bump (own-bubble guard — QOL-041 §8).
 *   7. action='add'    → insert or re-activate a soft-deleted row
 *                        (idempotent: re-add on an already-active row is
 *                        a no-op `ok`).
 *      action='remove' → set removed_at (toggle off).
 *   8. Re-select active reactions for the move and return the summary.
 *
 * Hard rules (QOL-041 §5.6 / §8 / §11):
 *   - The function NEVER touches public.arguments.
 *   - The function NEVER touches any standing / point-standing path. It
 *     imports nothing from `_shared/pointStanding/` (no such import
 *     exists) and never reads or writes any score column. A doctrine
 *     test asserts no such import.
 *   - The function NEVER makes an AI / external-provider call.
 *   - The function NEVER logs the Authorization header or any key.
 *   - Service-role is used ONLY for the best-effort audit row.
 *   - kind is restricted to the single CHECK-allowed value 'fist_bump'.
 *     Adding any other value here would mismatch the migration CHECK and
 *     fail at insert time; the validation here makes the failure
 *     deterministic at the request boundary.
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

type ReactToMoveAction = 'add' | 'remove';

// The v1 vocabulary — a SINGLE value. Mirrors
// `src/features/concessions/moveReactionModel.ts` `MoveReactionKind` and
// the `move_reactions.kind` CHECK constraint. Adding a value would
// require a NEW migration AND a doctrine review (v1 scope bans voting).
const ALLOWED_KINDS = new Set<string>(['fist_bump']);
const DEFAULT_KIND = 'fist_bump';

interface ReactToMoveRequest {
  action: ReactToMoveAction;
  debateId: string;
  argumentId: string;
  kind?: string;
}

function isUuid(s: unknown): s is string {
  return (
    typeof s === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}

function shortId(id: string): string {
  return id && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

interface ActiveReactionRow {
  id: string;
  reactor_id: string;
  kind: string;
  created_at: string;
}

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
  const body = raw as Partial<ReactToMoveRequest>;

  if (body.action !== 'add' && body.action !== 'remove') {
    return badRequest('invalid_action');
  }
  if (!isUuid(body.debateId) || !isUuid(body.argumentId)) {
    return badRequest('debateId_and_argumentId_required');
  }
  const kind = body.kind ?? DEFAULT_KIND;
  if (typeof kind !== 'string' || !ALLOWED_KINDS.has(kind)) {
    return badRequest('invalid_kind');
  }

  const action: ReactToMoveAction = body.action;
  const debateId: string = body.debateId;
  const argumentId: string = body.argumentId;

  const callerClient = createCallerClient(auth);

  // ── Identify caller. ──
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const reactorId = userRes.user.id;

  // ── Load the target argument (caller-scoped — RLS gates visibility).
  //    An invisible / missing row is treated as forbidden (no existence
  //    leak). ──
  const { data: argRow, error: argErr } = await callerClient
    .from('arguments')
    .select('id, author_id, debate_id, status')
    .eq('id', argumentId)
    .maybeSingle();
  if (argErr) {
    return internalError(
      `argument_lookup_failed:${String(argErr.message || '').slice(0, 120)}`,
    );
  }
  if (!argRow) return forbidden('argument_not_visible');
  if (argRow.debate_id !== debateId) return badRequest('debate_argument_mismatch');
  if (argRow.status === 'deleted') return badRequest('argument_deleted');

  // ── Own-bubble guard (QOL-041 §8). The reactor may not fist-bump
  //    their own move; consistent with QOL-030 own-bubble doctrine. ──
  if (argRow.author_id === reactorId) {
    return forbidden('cannot_react_to_own_move');
  }

  // ── Mutate. ──
  if (action === 'add') {
    // First, check if a soft-deleted row exists for (argument, reactor,
    // kind). If so, re-activate it (toggle back on). Otherwise insert a
    // fresh row. The partial unique index allows at most one ACTIVE row
    // per (argument, reactor, kind); a soft-deleted row does not block
    // a re-add, so re-activation OR insert is always safe.
    const { data: soft, error: softErr } = await callerClient
      .from('move_reactions')
      .select('id')
      .eq('argument_id', argumentId)
      .eq('reactor_id', reactorId)
      .eq('kind', kind)
      .not('removed_at', 'is', null)
      .maybeSingle();
    if (softErr) {
      return internalError(
        `lookup_failed:${String(softErr.message || 'unknown').slice(0, 120)}`,
      );
    }

    if (soft && soft.id) {
      // Re-activate.
      const { error: reactivateErr } = await callerClient
        .from('move_reactions')
        .update({ removed_at: null, removed_by: null })
        .eq('id', soft.id);
      if (reactivateErr) {
        return internalError(
          `reactivate_failed:${String(reactivateErr.message || 'unknown').slice(0, 120)}`,
        );
      }
    } else {
      // Insert fresh. 23505 (unique_violation) = an ACTIVE row already
      // exists; treat as idempotent success.
      const { error: insertErr } = await callerClient
        .from('move_reactions')
        .insert({
          debate_id: debateId,
          argument_id: argumentId,
          reactor_id: reactorId,
          kind,
        });
      if (insertErr && insertErr.code !== '23505') {
        return internalError(
          `insert_failed:${String(insertErr.message || 'unknown').slice(0, 120)}`,
        );
      }
    }
  } else {
    // action === 'remove' — soft-delete the caller's matching ACTIVE
    // row, if any. No matching active row → idempotent success.
    const { error: updateErr } = await callerClient
      .from('move_reactions')
      .update({ removed_at: new Date().toISOString(), removed_by: reactorId })
      .eq('argument_id', argumentId)
      .eq('reactor_id', reactorId)
      .eq('kind', kind)
      .is('removed_at', null);
    if (updateErr) {
      return internalError(
        `remove_failed:${String(updateErr.message || 'unknown').slice(0, 120)}`,
      );
    }
  }

  // ── Re-select active reactions for the argument (caller-scoped). ──
  const { data: activeRows, error: selectErr } = await callerClient
    .from('move_reactions')
    .select('id, reactor_id, kind, created_at')
    .eq('argument_id', argumentId)
    .is('removed_at', null)
    .order('created_at', { ascending: true });
  if (selectErr) return internalError('active_reactions_lookup_failed');

  const active = ((activeRows ?? []) as ActiveReactionRow[]).map((r) => ({
    id: r.id,
    reactorId: r.reactor_id,
    kind: r.kind,
    createdAt: r.created_at,
  }));

  // The render-only summary the client uses (mirrors
  // `summarizeReactions` in src/features/concessions/moveReactionModel.ts).
  // NEVER a score; this is render-time-derived row count + viewer flag.
  const fistBumpCount = active.filter((r) => r.kind === 'fist_bump').length;
  const viewerHasReacted = active.some(
    (r) => r.kind === 'fist_bump' && r.reactorId === reactorId,
  );

  // ── Audit (best-effort; service-role only used here, never logged). ──
  try {
    const svc = createServiceClient();
    await svc.from('admin_audit_events').insert({
      action: action === 'add' ? 'move_reaction_added' : 'move_reaction_removed',
      source: 'edge_function',
      actor_user_id: reactorId,
      target_user_id: argRow.author_id,
      reason: null,
      payload: {
        debateIdShort: shortId(debateId),
        argumentIdShort: shortId(argumentId),
        kind,
      },
    });
  } catch {
    /* audit failure must not block the user */
  }

  return ok({
    argumentId,
    summary: { fistBumpCount, viewerHasReacted },
    activeReactions: active,
  });
});
