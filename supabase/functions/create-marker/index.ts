/**
 * Edge Function: create-marker (MARK-002, #894)
 *
 * The SOLE server-authoritative write path for public.timestamp_markers.
 * MARK-001 shipped the table SELECT-only (no authenticated INSERT/UPDATE policy,
 * no trigger), so this function OWNS every guarantee a client INSERT could
 * forge:
 *   - participant + target-visibility scope gating (no-oracle caller reads),
 *   - the per-target caller cap + the span-length cap,
 *   - and the load-bearing one: quoted_text is a VERBATIM server snapshot of
 *     arguments.body (body.slice(spanStart, spanEnd)), never the client string.
 *     The client quote is used ONLY to reject a mismatch (a fabricated quote or
 *     stale offsets). This is the Output 13 Q5 misrepresentation mitigation and
 *     the fabricated-quote acceptance criterion.
 *
 * One action:
 *   mint — write one timestamp_markers row quoting a phrase of a room-visible
 *          target argument, optionally linked to the callers OWN reply
 *          (reply_argument_id, the J6 text-half). A reply already linked to a
 *          marker returns the existing marker (idempotent) so a dropped response
 *          is safe to retry.
 *
 * Doctrine: this function emits NO point-standing delta, never gates a post,
 * never touches submit-argument, never touches public.arguments. A marker
 * carries a span + a verbatim quote + a verdict-free kind; no verdict, no score,
 * no truth label. verify_jwt = true in config.toml; getUser adds
 * defense-in-depth. No Authorization / service-role / quoted_text logging.
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
  MARKER_KINDS,
  MARKER_QUOTE_MAX,
  MARKERS_PER_TARGET_PER_USER,
  verifyMarkerSpan,
  verifyQuoteMatch,
  sliceQuote,
} from '../_shared/markerCreate.ts';

// ── Request schema (.strict() — one action mint) ──
// .strict() turns any unknown key (a smuggled quotedText / spanUnit / createdBy
// / recordingId) into a 422 rather than silently stripping it. There is
// deliberately NO quotedText (derived server-side), NO spanUnit (always chars),
// NO createdBy (the caller), NO recordingId (deferred to P5).

const MintMarkerSchema = z
  .object({
    action: z.literal('mint'),
    debateId: z.string().uuid(),
    targetArgumentId: z.string().uuid(),
    spanStart: z.number().int().nonnegative(),
    spanEnd: z.number().int().positive(),
    quote: z.string().min(1).max(MARKER_QUOTE_MAX),
    kind: z.enum(MARKER_KINDS),
    replyArgumentId: z.string().uuid().optional(),
  })
  .strict();

type MintRequest = z.infer<typeof MintMarkerSchema>;

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
  debate_id: string;
  body: string;
  status: string;
}

interface ReplyArgumentRow {
  id: string;
  author_id: string;
  debate_id: string;
}

interface MarkerDbRow {
  id: string;
  debate_id: string;
  target_argument_id: string;
  reply_argument_id: string | null;
  created_by: string;
  kind: string;
  span_start: number;
  span_end: number;
  span_unit: string;
  quoted_text: string;
  created_at: string;
  deleted_at: string | null;
}

const MARKER_COLUMNS =
  'id, debate_id, target_argument_id, reply_argument_id, created_by, kind, span_start, span_end, span_unit, quoted_text, created_at, deleted_at';

function markerResponse(row: MarkerDbRow) {
  return {
    id: row.id,
    debateId: row.debate_id,
    targetArgumentId: row.target_argument_id,
    replyArgumentId: row.reply_argument_id,
    kind: row.kind,
    spanStart: row.span_start,
    spanEnd: row.span_end,
    spanUnit: row.span_unit,
    quotedText: row.quoted_text,
    createdAt: row.created_at,
  };
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

  // Guard 4 — schema (.strict single action).
  const parsed = MintMarkerSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationFailed({
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  try {
    return await handleMint(parsed.data, authHeader);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('create_marker_error', errorMessage(err));
    return internalError('create_marker_failed');
  }
});

// ── mint ────────────────────────────────────────────────────────
async function handleMint(body: MintRequest, authHeader: string): Promise<Response> {
  const callerClient = createCallerClient(authHeader);

  // Guard 5 — identity (defense-in-depth; verify_jwt is already true).
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;

  // Guard 6 — target visibility + debate consistency. The caller-scoped (RLS)
  // read gives the no-oracle property: an invisible row is null,
  // indistinguishable from a nonexistent one. The canonical arguments SELECT
  // policy surfaces the authors OWN move at ANY status, so a target soft-deleted
  // between pick and mint stays mintable for its author and 404s for others.
  const { data: targetRow, error: targetErr } = await callerClient
    .from('arguments')
    .select('id, debate_id, body, status')
    .eq('id', body.targetArgumentId)
    .maybeSingle<TargetArgumentRow>();
  if (targetErr) return internalError('target_lookup_failed');
  if (!targetRow) return fail(404, 'target_not_found', 'We could not find that move.');
  if (targetRow.debate_id !== body.debateId) {
    return fail(400, 'debate_argument_mismatch', 'That move is not in this room.');
  }

  // Guard 7 — participant (caller-scoped RPC; p_user_id defaults to auth.uid()).
  const { data: isParticipant, error: partErr } = await callerClient.rpc('is_debate_participant', {
    p_debate_id: body.debateId,
  });
  if (partErr) return internalError('participant_lookup_failed');
  if (isParticipant !== true) {
    return fail(403, 'not_a_participant', 'Join this room to quote a phrase.');
  }

  // Guard 8 — span bounds against the target body length.
  const spanCheck = verifyMarkerSpan(targetRow.body.length, body.spanStart, body.spanEnd);
  if (!spanCheck.ok) {
    if (spanCheck.issue === 'span_too_long') {
      return fail(400, 'span_too_long', 'That selection is too long to quote.');
    }
    return fail(400, 'span_out_of_bounds', 'That phrase is no longer in the move.');
  }

  const serviceClient = createServiceClient();

  // Guard 9 — quote verification (Q5 + fabricated-quote AC). Read the target
  // body server-side (authoritative snapshot source) and require the client
  // quote to match the server slice EXACTLY. The SERVER slice is what gets
  // stored; the client quote is never persisted.
  const { data: bodyRow, error: bodyErr } = await serviceClient
    .from('arguments')
    .select('body')
    .eq('id', body.targetArgumentId)
    .maybeSingle<{ body: string }>();
  if (bodyErr) return internalError('target_body_lookup_failed');
  if (!bodyRow) return fail(404, 'target_not_found', 'We could not find that move.');
  const quoteCheck = verifyQuoteMatch(bodyRow.body, body.spanStart, body.spanEnd, body.quote);
  if (!quoteCheck.ok) {
    return fail(422, 'quote_mismatch', 'That phrase does not match the move any more. Pick it again.');
  }
  const serverQuote = sliceQuote(bodyRow.body, body.spanStart, body.spanEnd);

  // Guard 10 — reply linkage (only when replyArgumentId is set). The reply must
  // be a caller-visible, caller-owned move in the SAME debate. A reply already
  // linked to a non-deleted marker returns that existing marker (idempotent), so
  // a dropped response is safe to retry.
  if (body.replyArgumentId) {
    const { data: replyRow, error: replyErr } = await callerClient
      .from('arguments')
      .select('id, author_id, debate_id')
      .eq('id', body.replyArgumentId)
      .maybeSingle<ReplyArgumentRow>();
    if (replyErr) return internalError('reply_lookup_failed');
    if (!replyRow) return fail(404, 'reply_not_found', 'We could not find your reply.');
    if (replyRow.author_id !== callerId) {
      return fail(403, 'not_your_reply', 'You can only add a quote to your own reply.');
    }
    if (replyRow.debate_id !== body.debateId) {
      return fail(400, 'debate_reply_mismatch', 'That reply is not in this room.');
    }

    const { data: existingMarker, error: existingErr } = await serviceClient
      .from('timestamp_markers')
      .select(MARKER_COLUMNS)
      .eq('reply_argument_id', body.replyArgumentId)
      .is('deleted_at', null)
      .maybeSingle<MarkerDbRow>();
    if (existingErr) return internalError('marker_lookup_failed');
    if (existingMarker) {
      return ok({ ok: true, idempotent: true, marker: markerResponse(existingMarker) });
    }
  }

  // Guard 11 — cap. Advisory UX cap; a small concurrent over-count is acceptable.
  const { count, error: countErr } = await serviceClient
    .from('timestamp_markers')
    .select('id', { count: 'exact', head: true })
    .eq('target_argument_id', body.targetArgumentId)
    .eq('created_by', callerId)
    .is('deleted_at', null);
  if (countErr) return internalError('marker_count_failed');
  if ((count ?? 0) >= MARKERS_PER_TARGET_PER_USER) {
    return fail(409, 'marker_cap_reached', 'You have marked the most phrases you can on this move.');
  }

  // Guard 12 — mint (service-role; SELECT-only table). quoted_text is the SERVER
  // slice, never body.quote from the client. span_unit is always chars this card.
  const insertPayload = {
    debate_id: body.debateId,
    target_argument_id: body.targetArgumentId,
    created_by: callerId,
    kind: body.kind,
    span_start: body.spanStart,
    span_end: body.spanEnd,
    span_unit: 'chars',
    quoted_text: serverQuote,
    reply_argument_id: body.replyArgumentId ?? null,
  };
  const { data: inserted, error: insertErr } = await serviceClient
    .from('timestamp_markers')
    .insert(insertPayload)
    .select(MARKER_COLUMNS)
    .single<MarkerDbRow>();
  if (insertErr || !inserted) return internalError('marker_insert_failed');

  // eslint-disable-next-line no-console
  console.error('create_marker_ok', {
    callerIdShort: shortId(callerId),
    targetArgumentIdShort: shortId(body.targetArgumentId),
    kind: body.kind,
    hasReply: body.replyArgumentId ? true : false,
  });

  return ok({ ok: true, idempotent: false, marker: markerResponse(inserted) });
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 160);
  return String(err).slice(0, 160);
}
