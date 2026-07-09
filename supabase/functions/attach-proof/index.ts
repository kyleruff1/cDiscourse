/**
 * Edge Function: attach-proof (PROOF-003, #890)
 *
 * The SOLE server-authoritative write path for public.proof_items and
 * public.proof_relations. PROOF-001 shipped both tables SELECT-only (no
 * authenticated INSERT/UPDATE policy, no immutability trigger), so this
 * function OWNS every guarantee the dropped machinery used to provide:
 *   - participant + own-move scope gating,
 *   - the attachable kind vocabulary + the 8-per-move cap,
 *   - tombstone / field immutability (attach = INSERT only; detach writes ONLY
 *     deleted_at; no action ever un-deletes),
 *   - the evidence-doctrine rule that a client can never mint a privileged
 *     source-chain status (status is derived server-side, restricted to the
 *     three client-derivable values).
 *
 * Two actions:
 *   attach — write one proof_items row for the callers OWN move/draft, plus an
 *            OPTIONAL proof_relations row. On the first attach to a move that
 *            carries a JSONB evidence snapshot but has zero proof rows, the
 *            pre-existing JSONB artifacts are captured into rows FIRST (R2) so
 *            the PROOF-002 rows-first read adapter can never see mixed state.
 *            On an answers_request relation the EXISTING evidence_supplied
 *            room_notifications path fires (no parallel mechanism).
 *   detach — soft-delete the callers OWN proof_items row (deleted_at only).
 *
 * Doctrine: this function emits NO point-standing delta, never gates a post,
 * never touches submit-argument, writes a source-chain STATUS (advisory) and
 * never a verdict. verify_jwt = true in config.toml; getUser adds
 * defense-in-depth. No Authorization / service-role logging.
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
  KNOWN_REQUEST_KINDS,
  PROOF_RELATION_KINDS,
  MAX_PROOFS_PER_MOVE,
  PROOF_LABEL_MAX,
  PROOF_URL_MAX,
  PROOF_QUOTE_MAX,
  PROOF_SOURCE_TEXT_MAX,
  isAttachableKind,
  validateKindFields,
  deriveProofSourceChainStatus,
  proofIdempotencyKey,
  type AttachableProofKind,
} from '../_shared/proofAttach.ts';
import { captureRowsFromJsonb } from '../_shared/proofCapture.ts';

// ── Request schema — discriminated union on `action`, .strict() ──
// .strict() turns any unknown key (a smuggled sourceChainStatus / risk, an
// invites[] array) into a 422 rather than silently stripping it. There is
// deliberately NO sourceChainStatus and NO risk field: status is derived
// (condition (ii)); risk is always written unknown.

const RelationSchema = z
  .object({
    claimArgumentId: z.string().uuid(),
    kind: z.enum(PROOF_RELATION_KINDS),
  })
  .strict();

const AttachSchema = z
  .object({
    action: z.literal('attach'),
    debateId: z.string().uuid(),
    argumentId: z.string().uuid(),
    kind: z.enum(KNOWN_REQUEST_KINDS),
    label: z.string().max(PROOF_LABEL_MAX).optional().default(''),
    url: z.string().max(PROOF_URL_MAX).optional(),
    sourceText: z.string().max(PROOF_SOURCE_TEXT_MAX).optional(),
    quote: z.string().max(PROOF_QUOTE_MAX).optional(),
    referencedArgumentId: z.string().uuid().optional(),
    relation: RelationSchema.optional(),
  })
  .strict();

const DetachSchema = z
  .object({
    action: z.literal('detach'),
    debateId: z.string().uuid(),
    proofItemId: z.string().uuid(),
  })
  .strict();

const RequestSchema = z.discriminatedUnion('action', [AttachSchema, DetachSchema]);

type AttachRequest = z.infer<typeof AttachSchema>;
type DetachRequest = z.infer<typeof DetachSchema>;

// ── Local error helper — distinct honest codes (create-argument-room idiom) ──
// Same house shape { error, message } + stable status; no stack trace, no
// service-role detail, no row the caller cannot already see.
function fail(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function shortId(id: string): string {
  return typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

interface ArgumentRow {
  id: string;
  author_id: string;
  debate_id: string;
  status: string;
}

interface ProofItemDbRow {
  id: string;
  debate_id: string;
  argument_id: string;
  added_by: string;
  kind: string;
  label: string;
  url: string | null;
  source_text: string | null;
  quote: string | null;
  referenced_argument_id: string | null;
  source_chain_status: string;
  risk: string;
  created_at: string;
  deleted_at: string | null;
}

function proofItemResponse(row: ProofItemDbRow) {
  return {
    id: row.id,
    debateId: row.debate_id,
    argumentId: row.argument_id,
    kind: row.kind,
    label: row.label,
    url: row.url,
    sourceText: row.source_text,
    quote: row.quote,
    referencedArgumentId: row.referenced_argument_id,
    sourceChainStatus: row.source_chain_status,
    risk: row.risk,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
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

  // Guard 4 — schema (.strict discriminated union).
  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationFailed({
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  try {
    if (parsed.data.action === 'attach') {
      return await handleAttach(parsed.data, authHeader);
    }
    return await handleDetach(parsed.data, authHeader);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('attach_proof_error', errorMessage(err));
    return internalError('attach_proof_failed');
  }
});

// ── attach ──────────────────────────────────────────────────────
async function handleAttach(body: AttachRequest, authHeader: string): Promise<Response> {
  const callerClient = createCallerClient(authHeader);

  // Guard 5 — identity (defense-in-depth; verify_jwt is already true).
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;

  // Guard 6 — target-move visibility + authorship + debate consistency. The
  // caller-scoped (RLS) read gives the no-oracle property: an invisible row is
  // null, indistinguishable from a nonexistent one. The canonical arguments
  // SELECT policy (COV-004 is_argument_visible) surfaces the authors OWN move
  // at ANY status (draft included), so no service-role probe is needed.
  const { data: argRow, error: argErr } = await callerClient
    .from('arguments')
    .select('id, author_id, debate_id, status')
    .eq('id', body.argumentId)
    .maybeSingle<ArgumentRow>();
  if (argErr) return internalError('argument_lookup_failed');
  if (!argRow) return fail(404, 'argument_not_found', 'We could not find that move.');
  if (argRow.author_id !== callerId) {
    return fail(403, 'not_your_move', 'You can only add a source to your own move.');
  }
  if (argRow.debate_id !== body.debateId) {
    return fail(400, 'debate_argument_mismatch', 'That move is not in this room.');
  }

  // Guard 6d — participant (caller-scoped RPC; p_user_id defaults to auth.uid()).
  const { data: isParticipant, error: partErr } = await callerClient.rpc('is_debate_participant', {
    p_debate_id: body.debateId,
  });
  if (partErr) return internalError('participant_lookup_failed');
  if (isParticipant !== true) {
    return fail(403, 'not_a_participant', 'Join this room to add a source.');
  }

  // Guard 7a — kind vocabulary. Storage / marker kinds parse (so we can give an
  // honest deferral code) but are not persistable this card.
  if (!isAttachableKind(body.kind)) {
    return fail(400, 'kind_not_supported', 'That kind of source is not available yet.');
  }
  const kind: AttachableProofKind = body.kind;

  // Guard 4 (per-kind) — required fields present + valid for the kind.
  const fields = {
    kind,
    label: body.label ?? '',
    url: body.url ?? null,
    sourceText: body.sourceText ?? null,
    quote: body.quote ?? null,
    referencedArgumentId: body.referencedArgumentId ?? null,
  };
  const kindCheck = validateKindFields(fields);
  if (!kindCheck.ok) {
    return validationFailed({
      error: 'validation_failed',
      issues: [{ path: ['kind'], message: kindCheck.issue }],
    });
  }

  // Guard 7c — prior_move referenced argument must be same-room + caller-visible.
  if (kind === 'prior_move') {
    const refId = body.referencedArgumentId as string;
    const { data: refRow, error: refErr } = await callerClient
      .from('arguments')
      .select('id, debate_id')
      .eq('id', refId)
      .maybeSingle<{ id: string; debate_id: string }>();
    if (refErr) return internalError('referenced_argument_lookup_failed');
    if (!refRow || refRow.debate_id !== body.debateId) {
      return fail(404, 'referenced_argument_not_found', 'We could not find that earlier point.');
    }
  }

  // Guard 7b — relation target (a same-room, caller-visible claim/request).
  if (body.relation) {
    const { data: claimRow, error: claimErr } = await callerClient
      .from('arguments')
      .select('id, debate_id')
      .eq('id', body.relation.claimArgumentId)
      .maybeSingle<{ id: string; debate_id: string }>();
    if (claimErr) return internalError('claim_lookup_failed');
    if (!claimRow || claimRow.debate_id !== body.debateId) {
      return fail(404, 'claim_not_found', 'We could not find the point that source answers.');
    }
  }

  const serviceClient = createServiceClient();

  // Read the moves non-deleted proofs ONCE (service-role): drives the cap, the
  // idempotency dedup, and the R2 first-attach capture decision.
  const { data: existingRowsRaw, error: existingErr } = await serviceClient
    .from('proof_items')
    .select(
      'id, debate_id, argument_id, added_by, kind, label, url, source_text, quote, referenced_argument_id, source_chain_status, risk, created_at, deleted_at',
    )
    .eq('argument_id', body.argumentId)
    .is('deleted_at', null);
  if (existingErr) return internalError('proof_lookup_failed');
  const existingRows: ProofItemDbRow[] = existingRowsRaw ?? [];

  // Idempotency dedup — an identical receipt already on this move is a duplicate;
  // return it, insert nothing, do not count it against the cap.
  const candidateKey = proofIdempotencyKey(body.argumentId, callerId, fields);
  const duplicate = existingRows.find(
    (r) =>
      proofIdempotencyKey(r.argument_id, r.added_by, {
        kind: r.kind as AttachableProofKind,
        label: r.label ?? '',
        url: r.url,
        sourceText: r.source_text,
        quote: r.quote,
        referencedArgumentId: r.referenced_argument_id,
      }) === candidateKey,
  );
  if (duplicate) {
    const relationResult = await maybeInsertRelation(serviceClient, body, duplicate, callerId);
    return ok({
      ok: true,
      proofItem: proofItemResponse(duplicate),
      relation: relationResult.relation,
      idempotent: true,
      relationIdempotent: relationResult.idempotent,
      debtSignalEmitted: relationResult.debtSignalEmitted,
    });
  }

  // R2 — first-attach capture. If this move has a JSONB snapshot AND zero proof
  // rows, fold the pre-existing JSONB artifacts into rows FIRST (idempotent:
  // once rows exist this never runs again). Best-effort: a capture failure must
  // not block the new attach.
  if (existingRows.length === 0) {
    await maybeCaptureJsonbSnapshot(serviceClient, callerClient, body, callerId);
  }

  // Guard 8 — cap. Advisory UX cap; a small concurrent over-count is acceptable.
  if (existingRows.length >= MAX_PROOFS_PER_MOVE) {
    return fail(409, 'proof_cap_reached', 'This move already has the most sources it can hold.');
  }

  // Insert the new proof_items row (service-role; SELECT-only RLS has no INSERT
  // policy). Status is DERIVED (condition (ii)); risk is always unknown.
  const insertPayload = {
    debate_id: body.debateId,
    argument_id: body.argumentId,
    added_by: callerId,
    kind,
    label: fields.label,
    url: kind === 'url' || kind === 'external_ref' ? body.url ?? null : null,
    source_text: kind === 'source_text' || kind === 'note' ? body.sourceText ?? null : null,
    quote: kind === 'quote' ? body.quote ?? null : null,
    referenced_argument_id: kind === 'prior_move' ? body.referencedArgumentId ?? null : null,
    source_chain_status: deriveProofSourceChainStatus(fields),
    risk: 'unknown',
  };
  const { data: inserted, error: insertErr } = await serviceClient
    .from('proof_items')
    .insert(insertPayload)
    .select(
      'id, debate_id, argument_id, added_by, kind, label, url, source_text, quote, referenced_argument_id, source_chain_status, risk, created_at, deleted_at',
    )
    .single<ProofItemDbRow>();
  if (insertErr || !inserted) return internalError('proof_insert_failed');

  const relationResult = await maybeInsertRelation(serviceClient, body, inserted, callerId);

  // eslint-disable-next-line no-console
  console.error('attach_proof_ok', {
    callerIdShort: shortId(callerId),
    argumentIdShort: shortId(body.argumentId),
    kind,
    relation: body.relation ? body.relation.kind : null,
  });

  return ok({
    ok: true,
    proofItem: proofItemResponse(inserted),
    relation: relationResult.relation,
    idempotent: false,
    relationIdempotent: relationResult.idempotent,
    debtSignalEmitted: relationResult.debtSignalEmitted,
  });
}

// ── R2 first-attach capture ─────────────────────────────────────
async function maybeCaptureJsonbSnapshot(
  serviceClient: ReturnType<typeof createServiceClient>,
  callerClient: ReturnType<typeof createCallerClient>,
  body: AttachRequest,
  callerId: string,
): Promise<void> {
  try {
    const { data: snapRow } = await callerClient
      .from('arguments')
      .select('client_validation')
      .eq('id', body.argumentId)
      .maybeSingle<{ client_validation: Record<string, unknown> | null }>();
    const clientValidation = snapRow?.client_validation ?? null;
    const attachedEvidence =
      clientValidation && typeof clientValidation === 'object'
        ? (clientValidation as Record<string, unknown>).attachedEvidence
        : undefined;
    const capturedRows = captureRowsFromJsonb(attachedEvidence, {
      argumentId: body.argumentId,
      debateId: body.debateId,
      authorId: callerId,
    });
    if (capturedRows.length === 0) return;
    await serviceClient.from('proof_items').insert(capturedRows);
  } catch (captureErr) {
    // Best-effort: a capture failure never blocks the new attach.
    // eslint-disable-next-line no-console
    console.error('attach_proof_capture_failed', {
      argumentIdShort: shortId(body.argumentId),
      message: captureErr instanceof Error ? captureErr.message.slice(0, 120) : 'unknown',
    });
  }
}

// ── relation + evidence_supplied ────────────────────────────────
interface RelationResult {
  relation:
    | null
    | {
        id: string;
        proofItemId: string;
        claimArgumentId: string;
        relation: string;
        createdAt: string;
      };
  idempotent: boolean;
  debtSignalEmitted: boolean;
}

async function maybeInsertRelation(
  serviceClient: ReturnType<typeof createServiceClient>,
  body: AttachRequest,
  proofRow: ProofItemDbRow,
  callerId: string,
): Promise<RelationResult> {
  if (!body.relation) return { relation: null, idempotent: false, debtSignalEmitted: false };

  const relKind = body.relation.kind;
  const { data: relRow, error: relErr } = await serviceClient
    .from('proof_relations')
    .insert({
      debate_id: body.debateId,
      proof_item_id: proofRow.id,
      claim_argument_id: body.relation.claimArgumentId,
      relation: relKind,
      created_by: callerId,
    })
    .select('id, proof_item_id, claim_argument_id, relation, created_at')
    .single<{
      id: string;
      proof_item_id: string;
      claim_argument_id: string;
      relation: string;
      created_at: string;
    }>();

  // Duplicate relation — the shipped UNIQUE(proof_item_id, claim_argument_id,
  // relation) raises 23505. Re-select the existing row; do NOT re-fire the
  // notification.
  if (relErr) {
    const code = (relErr as { code?: string }).code;
    if (code === '23505') {
      const { data: existingRel } = await serviceClient
        .from('proof_relations')
        .select('id, proof_item_id, claim_argument_id, relation, created_at')
        .eq('proof_item_id', proofRow.id)
        .eq('claim_argument_id', body.relation.claimArgumentId)
        .eq('relation', relKind)
        .maybeSingle<{
          id: string;
          proof_item_id: string;
          claim_argument_id: string;
          relation: string;
          created_at: string;
        }>();
      return {
        relation: existingRel
          ? {
              id: existingRel.id,
              proofItemId: existingRel.proof_item_id,
              claimArgumentId: existingRel.claim_argument_id,
              relation: existingRel.relation,
              createdAt: existingRel.created_at,
            }
          : null,
        idempotent: true,
        debtSignalEmitted: false,
      };
    }
    // Any other relation-insert failure is non-fatal to the proof attach.
    return { relation: null, idempotent: false, debtSignalEmitted: false };
  }

  // A NEW answers_request relation fires the EXISTING evidence_supplied path.
  let debtSignalEmitted = false;
  if (relKind === 'answers_request') {
    debtSignalEmitted = await fireEvidenceSuppliedNotification(serviceClient, body, callerId);
  }

  return {
    relation: relRow
      ? {
          id: relRow.id,
          proofItemId: relRow.proof_item_id,
          claimArgumentId: relRow.claim_argument_id,
          relation: relRow.relation,
          createdAt: relRow.created_at,
        }
      : null,
    idempotent: false,
    debtSignalEmitted,
  };
}

/**
 * Fire the EXISTING evidence_supplied room_notifications path (the SAME
 * service-role INSERT shape submit-argument QOL-040 uses). Recipients = room
 * primaries (affirmative / negative) except the caller. Best-effort; a failure
 * never blocks the attach. Returns true iff at least one notification was
 * inserted.
 */
async function fireEvidenceSuppliedNotification(
  serviceClient: ReturnType<typeof createServiceClient>,
  body: AttachRequest,
  callerId: string,
): Promise<boolean> {
  try {
    const { data: parts } = await serviceClient
      .from('debate_participants')
      .select('user_id, side')
      .eq('debate_id', body.debateId);
    const recipients: string[] = [];
    for (const p of parts || []) {
      const uid = (p as { user_id?: string; side?: string }).user_id;
      const side = (p as { user_id?: string; side?: string }).side;
      if (uid && uid !== callerId && (side === 'affirmative' || side === 'negative')) {
        recipients.push(uid);
      }
    }
    if (recipients.length === 0) return false;

    const { data: debateRow } = await serviceClient
      .from('debates')
      .select('title')
      .eq('id', body.debateId)
      .maybeSingle<{ title: string | null }>();
    const roomTitle = (debateRow?.title || '').slice(0, 200);

    const rows = recipients.map((rid) => ({
      recipient_id: rid,
      debate_id: body.debateId,
      argument_id: body.argumentId,
      type: 'evidence_supplied',
      room_title: roomTitle,
      meta: { via: 'attach_proof' },
    }));
    await serviceClient.from('room_notifications').insert(rows);
    return true;
  } catch (notifyErr) {
    // eslint-disable-next-line no-console
    console.error('attach_proof_notify_failed', {
      argumentIdShort: shortId(body.argumentId),
      message: notifyErr instanceof Error ? notifyErr.message.slice(0, 120) : 'unknown',
    });
    return false;
  }
}

// ── detach ──────────────────────────────────────────────────────
async function handleDetach(body: DetachRequest, authHeader: string): Promise<Response> {
  const callerClient = createCallerClient(authHeader);

  // Guard 5 — identity.
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id as string;

  // Guard D1 — proof visibility (caller-scoped read; no-oracle). A row the caller
  // cannot see is null, indistinguishable from a nonexistent one.
  const { data: proofRow, error: proofErr } = await callerClient
    .from('proof_items')
    .select('id, added_by, debate_id, deleted_at')
    .eq('id', body.proofItemId)
    .maybeSingle<{ id: string; added_by: string; debate_id: string; deleted_at: string | null }>();
  if (proofErr) return internalError('proof_lookup_failed');
  if (!proofRow) return fail(404, 'proof_not_found', 'We could not find that source.');

  // Guard D2 — ownership (authz on a visible row).
  if (proofRow.added_by !== callerId) {
    return fail(403, 'not_your_proof', 'You can only remove a source you added.');
  }

  // Idempotent — an already-soft-deleted row is a no-op success. No resurrection
  // (no action ever clears the tombstone).
  if (proofRow.deleted_at !== null) {
    return ok({ ok: true, proofItemId: proofRow.id, deletedAt: proofRow.deleted_at, idempotent: true });
  }

  // Condition (i) — the detach UPDATE payload is EXACTLY { deleted_at }. Nothing
  // else. This is the code-level replacement for the dropped soft-delete trigger.
  const deletedAt = new Date().toISOString();
  const serviceClient = createServiceClient();
  const { data: updated, error: updErr } = await serviceClient
    .from('proof_items')
    .update({ deleted_at: deletedAt })
    .eq('id', body.proofItemId)
    .is('deleted_at', null)
    .select('id, deleted_at')
    .maybeSingle<{ id: string; deleted_at: string | null }>();
  if (updErr) return internalError('proof_detach_failed');
  if (!updated) {
    // A concurrent detach won the race — treat as idempotent success.
    return ok({ ok: true, proofItemId: body.proofItemId, deletedAt, idempotent: true });
  }

  // eslint-disable-next-line no-console
  console.error('attach_proof_detach_ok', {
    callerIdShort: shortId(callerId),
    proofItemIdShort: shortId(body.proofItemId),
  });

  return ok({ ok: true, proofItemId: updated.id, deletedAt: updated.deleted_at, idempotent: false });
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 160);
  return String(err).slice(0, 160);
}
