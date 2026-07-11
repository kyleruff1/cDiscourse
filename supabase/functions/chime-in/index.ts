/**
 * Edge Function: chime-in (CHIMEIN-P8 Round 2, #761)
 *
 * The SOLE server-authoritative write path for public.chime_in_contributions. The
 * migration shipped the table SELECT-only (no authenticated INSERT/UPDATE/DELETE
 * policy, no trigger), so this function OWNS every guarantee a client write could
 * forge:
 *   - public-only: a private-room attach is rejected (409 room_private); no chime
 *     row can exist for a private debate,
 *   - author-scope: only the author of the chime argument may attach or retract it
 *     (403 not_author),
 *   - point-scope: the chime argument parent must equal target_argument_id
 *     (409 not_point_scoped),
 *   - the cap: the lowest free seat in 1..3 is chosen and the partial UNIQUE on
 *     active (debate_id, seat_index) is the atomic race guard (409 seats_full).
 *
 * TWO-STEP by design: the chime CONTENT is an ordinary argument posted through the
 * BYTE-IDENTICAL submit-argument deterministic gate FIRST; this function then
 * records the marker that says "this reply is a bounded chime-in on point X". The
 * deterministic engine stays the sole submission gate -- the marker is
 * post-storage and advisory to display only. It never blocks, re-gates, or delays
 * a post.
 *
 * Doctrine: a chime-in is a bounded contribution ROLE + attached treatment, NEVER
 * a third principal voice and NEVER a node structural state (CIVILDISCOURSE-V4
 * L849/L855). This function emits NO point-standing delta, imports nothing from
 * any point-standing path, never writes debate_participants, never inserts into
 * public.arguments, never returns another user PII. verify_jwt = true in
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
import { lowestFreeChimeSeatIndex, openChimeSeatCount } from '../_shared/chimeInSeats.ts';

// ── Request schema (.strict() -- action + ids) ──
// .strict() turns any unknown key (a smuggled seat_index / author_id / created_at
// / retracted_at) into a 422 rather than silently stripping it. debate_id is NOT
// accepted on the wire -- it is derived from the argument row so it can never be
// spoofed. target_argument_id is required for attach and validated against the
// argument parent below.

const ChimeInSchema = z
  .object({
    action: z.enum(['attach', 'retract']),
    argument_id: z.string().uuid(),
    target_argument_id: z.string().uuid().optional(),
    contribution_id: z.string().uuid().optional(),
  })
  .strict();

type ChimeInRequest = z.infer<typeof ChimeInSchema>;

// ── Local error helper -- distinct honest codes (mark-move idiom) ──
function fail(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function shortId(id: string): string {
  return typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

interface ChimeArgumentRow {
  id: string;
  debate_id: string;
  parent_id: string | null;
  author_id: string;
  status: string;
}

interface DebateVisibilityRow {
  visibility: string;
}

interface ActiveSeatRow {
  seat_index: number;
}

interface InsertedChimeRow {
  id: string;
  seat_index: number;
  target_argument_id: string;
}

const POSTGRES_UNIQUE_VIOLATION = '23505';

// ── Entry ───────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  // Guard 1 -- CORS + method.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return methodNotAllowed();

  // Guard 2 -- Authorization header.
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader) return unauthorized();

  // Guard 3 -- JSON body.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  // Guard 4 -- schema (.strict()).
  const parsed = ChimeInSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationFailed({
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  try {
    return await handleChimeIn(parsed.data, authHeader);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('chime_in_error', errorMessage(err));
    return internalError('chime_in_failed');
  }
});

async function handleChimeIn(body: ChimeInRequest, authHeader: string): Promise<Response> {
  const callerClient = createCallerClient(authHeader);

  // Guard 5 -- identity (defense-in-depth; verify_jwt is already true).
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;

  // Guard 6 -- target chime argument visibility + shape. The caller-scoped (RLS)
  // read gives the no-oracle property: an invisible row is null, indistinguishable
  // from a nonexistent one. A deleted target is rejected here.
  const { data: argRow, error: argErr } = await callerClient
    .from('arguments')
    .select('id, debate_id, parent_id, author_id, status')
    .eq('id', body.argument_id)
    .maybeSingle<ChimeArgumentRow>();
  if (argErr) return internalError('argument_lookup_failed');
  if (!argRow) return fail(404, 'not_found', 'We could not find that reply.');
  if (argRow.status === 'deleted') {
    return fail(404, 'not_found', 'That reply is no longer here.');
  }

  // Guard 7 -- author-scope. Only the author of the chime reply may attach or
  // retract its chime marker. RLS lacks cheap access to author_id without a join,
  // so the function is the authoritative gate.
  if (argRow.author_id !== callerId) {
    return fail(403, 'not_author', 'You can only chime in with your own reply.');
  }

  if (body.action === 'retract') {
    return await handleRetract(body, argRow, callerId);
  }
  return await handleAttach(body, argRow, callerId, callerClient);
}

async function handleAttach(
  body: ChimeInRequest,
  argRow: ChimeArgumentRow,
  callerId: string,
  callerClient: ReturnType<typeof createCallerClient>,
): Promise<Response> {
  // Guard 8 -- point-scope. The chime reply must attach to the point it replies
  // to: arguments.parent_id(argument_id) must equal target_argument_id. A root
  // reply (null parent) cannot be point-scoped.
  if (!body.target_argument_id) {
    return fail(400, 'invalid_input', 'A chime-in must name the point it attaches to.');
  }
  if (argRow.parent_id === null || argRow.parent_id !== body.target_argument_id) {
    return fail(409, 'not_point_scoped', 'That reply does not attach to that point.');
  }

  // Guard 9 -- public-only. Read visibility caller-scoped (RLS already confirmed
  // the argument is visible). A private room has no chime-ins.
  const { data: debRow, error: debErr } = await callerClient
    .from('debates')
    .select('visibility')
    .eq('id', argRow.debate_id)
    .maybeSingle<DebateVisibilityRow>();
  if (debErr) return internalError('debate_lookup_failed');
  if (!debRow) return fail(404, 'not_found', 'We could not find that room.');
  if (debRow.visibility !== 'public') {
    return fail(409, 'room_private', 'Chime-ins are for public rooms only.');
  }

  const serviceClient = createServiceClient();

  // Idempotency -- if this reply is already an active chime-in, return it. A
  // dropped response is safe to retry; the marker is not duplicated.
  const { data: existingRow, error: existingErr } = await serviceClient
    .from('chime_in_contributions')
    .select('id, seat_index, target_argument_id')
    .eq('argument_id', body.argument_id)
    .is('retracted_at', null)
    .maybeSingle<InsertedChimeRow>();
  if (existingErr) return internalError('chime_lookup_failed');
  if (existingRow) {
    const open = await computeOpenSeatCount(serviceClient, argRow.debate_id);
    return ok({
      ok: true,
      chime_in: {
        id: existingRow.id,
        seat_index: existingRow.seat_index,
        target_argument_id: existingRow.target_argument_id,
      },
      open_chime_in_seat_count: open,
    });
  }

  // Guard 10 -- cap. Compute the lowest free seat and insert; the partial UNIQUE
  // is the atomic authority. On a UNIQUE violation (a concurrent attach took the
  // same seat) re-read and retry once against the recomputed free seat, else
  // seats_full.
  const firstAttempt = await attemptSeatInsert(serviceClient, {
    debateId: argRow.debate_id,
    argumentId: body.argument_id,
    targetArgumentId: body.target_argument_id,
    authorId: callerId,
  });
  let inserted = firstAttempt.row;
  if (!inserted && firstAttempt.conflict) {
    const retry = await attemptSeatInsert(serviceClient, {
      debateId: argRow.debate_id,
      argumentId: body.argument_id,
      targetArgumentId: body.target_argument_id,
      authorId: callerId,
    });
    inserted = retry.row;
    if (!inserted && !retry.conflict && retry.errored) return internalError('chime_insert_failed');
  } else if (!inserted && firstAttempt.errored) {
    return internalError('chime_insert_failed');
  }
  if (!inserted) {
    return fail(409, 'seats_full', 'All chime-in seats are taken right now.');
  }

  // Best-effort audit (service-role; never logged).
  await writeAudit(serviceClient, 'chime_in_attached', callerId, argRow, inserted.seat_index);

  const open = await computeOpenSeatCount(serviceClient, argRow.debate_id);
  // eslint-disable-next-line no-console
  console.error('chime_in_ok', {
    callerIdShort: shortId(callerId),
    argumentIdShort: shortId(body.argument_id),
    action: 'attach',
    seatIndex: inserted.seat_index,
  });
  return ok({
    ok: true,
    chime_in: {
      id: inserted.id,
      seat_index: inserted.seat_index,
      target_argument_id: inserted.target_argument_id,
    },
    open_chime_in_seat_count: open,
  });
}

async function handleRetract(
  body: ChimeInRequest,
  argRow: ChimeArgumentRow,
  callerId: string,
): Promise<Response> {
  const serviceClient = createServiceClient();
  const nowIso = new Date().toISOString();

  // Author-scoped soft-retract. No matching active row is an idempotent success
  // (retract is a timestamp, never a delete). contribution_id narrows the target
  // when the caller supplies it.
  let query = serviceClient
    .from('chime_in_contributions')
    .update({ retracted_at: nowIso })
    .eq('argument_id', body.argument_id)
    .eq('author_id', callerId)
    .is('retracted_at', null);
  if (body.contribution_id) {
    query = query.eq('id', body.contribution_id);
  }
  const { error: retractErr } = await query;
  if (retractErr) return internalError('chime_retract_failed');

  await writeAudit(serviceClient, 'chime_in_retracted', callerId, argRow, null);

  const open = await computeOpenSeatCount(serviceClient, argRow.debate_id);
  // eslint-disable-next-line no-console
  console.error('chime_in_ok', {
    callerIdShort: shortId(callerId),
    argumentIdShort: shortId(body.argument_id),
    action: 'retract',
  });
  return ok({ ok: true, open_chime_in_seat_count: open });
}

// ── seat insert (service-role; the partial UNIQUE is the atomic guard) ──

interface SeatInsertInput {
  debateId: string;
  argumentId: string;
  targetArgumentId: string;
  authorId: string;
}

interface SeatInsertResult {
  row: InsertedChimeRow | null;
  conflict: boolean;
  errored: boolean;
}

async function attemptSeatInsert(
  serviceClient: ReturnType<typeof createServiceClient>,
  input: SeatInsertInput,
): Promise<SeatInsertResult> {
  const used = await readActiveSeatIndices(serviceClient, input.debateId);
  const seat = lowestFreeChimeSeatIndex(used);
  if (seat === null) return { row: null, conflict: false, errored: false };

  const { data, error } = await serviceClient
    .from('chime_in_contributions')
    .insert({
      debate_id: input.debateId,
      argument_id: input.argumentId,
      target_argument_id: input.targetArgumentId,
      author_id: input.authorId,
      seat_index: seat,
    })
    .select('id, seat_index, target_argument_id')
    .maybeSingle<InsertedChimeRow>();

  if (error) {
    const conflict = (error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION;
    return { row: null, conflict, errored: !conflict };
  }
  return { row: data ?? null, conflict: false, errored: data === null };
}

async function readActiveSeatIndices(
  serviceClient: ReturnType<typeof createServiceClient>,
  debateId: string,
): Promise<number[]> {
  const { data } = await serviceClient
    .from('chime_in_contributions')
    .select('seat_index')
    .eq('debate_id', debateId)
    .is('retracted_at', null);
  return ((data ?? []) as ActiveSeatRow[]).map((r) => r.seat_index);
}

async function computeOpenSeatCount(
  serviceClient: ReturnType<typeof createServiceClient>,
  debateId: string,
): Promise<number> {
  const used = await readActiveSeatIndices(serviceClient, debateId);
  return openChimeSeatCount(used.length);
}

async function writeAudit(
  serviceClient: ReturnType<typeof createServiceClient>,
  action: string,
  callerId: string,
  argRow: ChimeArgumentRow,
  seatIndex: number | null,
): Promise<void> {
  try {
    await serviceClient.from('admin_audit_events').insert({
      action,
      source: 'edge_function',
      actor_user_id: callerId,
      target_user_id: callerId,
      reason: null,
      payload: {
        debateIdShort: shortId(argRow.debate_id),
        argumentIdShort: shortId(argRow.id),
        seatIndex,
      },
    });
  } catch {
    /* audit failure must not block the user */
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 160);
  return String(err).slice(0, 160);
}
