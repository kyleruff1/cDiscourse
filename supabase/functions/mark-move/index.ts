/**
 * Edge Function: mark-move (FEEDBACK-001, #898)
 *
 * The SOLE server-authoritative write path for public.move_marks. The migration
 * shipped the table SELECT-only (no authenticated INSERT/UPDATE/DELETE policy, no
 * trigger), so this function OWNS every guarantee a client write could forge:
 *   - target visibility scope gating (no-oracle caller reads),
 *   - the not-own-move guard (a viewer cannot mark their own move),
 *   - the participant-only gate (observers cannot mark — the gap react-to-move
 *     leaves open is closed here),
 *   - the paired-code mutual-exclusivity (marking addressed_my_point atomically
 *     retracts an active did_not_address by the same viewer on the same move, and
 *     vice versa), so the aggregate can never count a viewer in both arms.
 *
 * Two actions:
 *   mark    — upsert (re-activate) one move_marks row for the caller on a
 *             room-visible non-own move. A double-mark on an already-active row is
 *             a no-op success (200), satisfying J10 one-tap marks.
 *   retract — set retracted_at on the caller active row. No active row is a no-op
 *             success (200), idempotent.
 *
 * Doctrine: a mark is a structural observation about a MOVE, never a verdict, never
 * a score, and never feeds point standing. This function emits NO point-standing
 * delta, imports nothing from any point-standing path, never gates a post, never
 * touches submit-argument, never writes public.arguments. The per-move response
 * returns ONLY the caller own new state (no counts of others) — the deliberate
 * un-game-like posture, stronger than the fist-bump. verify_jwt = true in
 * config.toml; getUser adds defense-in-depth. No Authorization / service-role
 * logging.
 *
 * Comments are apostrophe-free for scanner safety.
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
import {
  MOVE_MARK_CODES,
  isMoveMarkCode,
  oppositeMarkCode,
  type MoveMarkCode,
} from '../_shared/moveMarkCodes.ts';

// ── Request schema (.strict() — action + ids + markCode) ──
// .strict() turns any unknown key (a smuggled markedBy / createdAt / retractedAt
// / count) into a 422 rather than silently stripping it. markCode is validated as
// a plain string here and against the allow-list below so an unknown code returns
// the distinct honest 422 invalid_mark_code (the CHECK is the DB backstop).

const MarkMoveSchema = z
  .object({
    action: z.enum(['mark', 'retract']),
    debateId: z.string().uuid(),
    argumentId: z.string().uuid(),
    markCode: z.string().min(1),
  })
  .strict();

type MarkMoveRequest = z.infer<typeof MarkMoveSchema>;

// ── Local error helper — distinct honest codes (attach-proof idiom) ──
function fail(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function shortId(id: string): string {
  return typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

interface TargetArgumentRow {
  id: string;
  author_id: string;
  debate_id: string;
  status: string;
}

interface ActiveMarkRow {
  mark_code: string;
}

/**
 * Build the viewer own-state map from the caller active rows. Every code is
 * present; each is a boolean. NO count of others, NO score, NO who-marked list —
 * the deliberate un-game-like response.
 */
function buildViewerMarks(rows: ReadonlyArray<ActiveMarkRow>): Record<MoveMarkCode, boolean> {
  const active = new Set(rows.map((r) => r.mark_code));
  const out = {} as Record<MoveMarkCode, boolean>;
  for (const code of MOVE_MARK_CODES) {
    out[code] = active.has(code);
  }
  return out;
}

// ── Entry ───────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  // Guard 1 — CORS + method.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return methodNotAllowed();

  // Guard 2 — Authorization header.
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader) return unauthorized();

  // Guard 3 — JSON body.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  // Guard 4 — schema (.strict()).
  const parsed = MarkMoveSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationFailed({
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  // Guard 4b — mark_code allow-list (distinct honest code; the CHECK is the DB
  // backstop). A smuggled or unknown code returns 422 invalid_mark_code.
  if (!isMoveMarkCode(parsed.data.markCode)) {
    return fail(422, 'invalid_mark_code', 'That mark is not available.');
  }

  try {
    return await handleMarkMove(parsed.data, parsed.data.markCode, authHeader);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('mark_move_error', errorMessage(err));
    return internalError('mark_move_failed');
  }
});

async function handleMarkMove(
  body: MarkMoveRequest,
  markCode: MoveMarkCode,
  authHeader: string,
): Promise<Response> {
  const callerClient = createCallerClient(authHeader);

  // Guard 5 — identity (defense-in-depth; verify_jwt is already true).
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;

  // Guard 6 — target visibility + debate consistency. The caller-scoped (RLS)
  // read gives the no-oracle property: an invisible row is null, indistinguishable
  // from a nonexistent one. A cross-room or deleted target is rejected here.
  const { data: argRow, error: argErr } = await callerClient
    .from('arguments')
    .select('id, author_id, debate_id, status')
    .eq('id', body.argumentId)
    .maybeSingle<TargetArgumentRow>();
  if (argErr) return internalError('argument_lookup_failed');
  if (!argRow) return fail(404, 'argument_not_found', 'We could not find that move.');
  if (argRow.debate_id !== body.debateId) {
    return fail(400, 'debate_argument_mismatch', 'That move is not in this room.');
  }
  if (argRow.status === 'deleted') {
    return fail(400, 'argument_deleted', 'That move is no longer here.');
  }

  // Guard 7 — own-move guard. A viewer cannot mark their own move. RLS lacks cheap
  // access to author_id without a join (the react-to-move note), so the function
  // is the authoritative gate.
  if (argRow.author_id === callerId) {
    return fail(403, 'cannot_mark_own_move', 'You cannot mark your own move.');
  }

  // Guard 8 — participant (caller-scoped RPC; p_user_id defaults to auth.uid()).
  // This is what disables observers server-side (the fist-bump lacks it).
  const { data: isParticipant, error: partErr } = await callerClient.rpc('is_debate_participant', {
    p_debate_id: body.debateId,
  });
  if (partErr) return internalError('participant_lookup_failed');
  if (isParticipant !== true) {
    return fail(403, 'not_a_participant', 'Join this room to mark a move.');
  }

  // Guard 9 — mutate (service-role; the table is SELECT-only). The nowIso stamp is
  // the retract timestamp; retract is never a delete.
  const serviceClient = createServiceClient();
  const nowIso = new Date().toISOString();

  if (body.action === 'mark') {
    // Paired mutual-exclusivity: marking one arm of the pair first retracts the
    // opposite active row for this viewer on this move, so the aggregate can never
    // count a viewer in both arms.
    const opposite = oppositeMarkCode(markCode);
    if (opposite) {
      const { error: pairErr } = await serviceClient
        .from('move_marks')
        .update({ retracted_at: nowIso })
        .eq('argument_id', body.argumentId)
        .eq('marked_by', callerId)
        .eq('mark_code', opposite)
        .is('retracted_at', null);
      if (pairErr) return internalError('mark_pair_retract_failed');
    }

    // Upsert the target code (idempotent re-activate). A double-mark on an
    // already-active row resolves to the same single active row (no-op success).
    const { error: upsertErr } = await serviceClient
      .from('move_marks')
      .upsert(
        {
          debate_id: body.debateId,
          argument_id: body.argumentId,
          marked_by: callerId,
          mark_code: markCode,
          retracted_at: null,
        },
        { onConflict: 'argument_id,marked_by,mark_code' },
      );
    if (upsertErr) return internalError('mark_upsert_failed');
  } else {
    // retract — soft-retract the caller matching active row, if any. No matching
    // active row is an idempotent success.
    const { error: retractErr } = await serviceClient
      .from('move_marks')
      .update({ retracted_at: nowIso })
      .eq('argument_id', body.argumentId)
      .eq('marked_by', callerId)
      .eq('mark_code', markCode)
      .is('retracted_at', null);
    if (retractErr) return internalError('mark_retract_failed');
  }

  // Guard 10 — re-select the caller active marks on this move (caller-scoped). The
  // response carries ONLY the caller own state for optimistic reconciliation; the
  // two aggregate surfaces read the room-shell bulk SELECT, never this response.
  const { data: activeRows, error: selectErr } = await callerClient
    .from('move_marks')
    .select('mark_code')
    .eq('argument_id', body.argumentId)
    .eq('marked_by', callerId)
    .is('retracted_at', null);
  if (selectErr) return internalError('viewer_marks_lookup_failed');
  const viewerMarks = buildViewerMarks((activeRows ?? []) as ActiveMarkRow[]);

  // Guard 11 — audit (best-effort; service-role only used here, never logged).
  try {
    await serviceClient.from('admin_audit_events').insert({
      action: body.action === 'mark' ? 'move_mark_set' : 'move_mark_retracted',
      source: 'edge_function',
      actor_user_id: callerId,
      target_user_id: argRow.author_id,
      reason: null,
      payload: {
        debateIdShort: shortId(body.debateId),
        argumentIdShort: shortId(body.argumentId),
        markCode,
      },
    });
  } catch {
    /* audit failure must not block the user */
  }

  // eslint-disable-next-line no-console
  console.error('mark_move_ok', {
    callerIdShort: shortId(callerId),
    argumentIdShort: shortId(body.argumentId),
    action: body.action,
    markCode,
  });

  return ok({ ok: true, argumentId: body.argumentId, viewerMarks });
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 160);
  return String(err).slice(0, 160);
}
