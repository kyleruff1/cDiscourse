/**
 * Edge Function: annotate-evidence (EV-005)
 *
 * The single write path for evidence annotations. An annotation describes a
 * SOURCE / RECORD attached to an EV-001 EvidenceArtifact — never a person,
 * never a verdict. v1 persists the annotation array inside the EXISTING
 * `arguments.client_validation` jsonb under a new `evidenceAnnotations` key.
 * NO DB migration: the function writes only to a column that already exists.
 *
 * Workflow (mirrors apply-manual-tag):
 *   1. CORS preflight / POST-only gate.
 *   2. Require a valid user JWT.
 *   3. Validate body { debateId, argumentId, evidenceArtifactId, kind,
 *      note?, depth, parentAnnotationId? }.
 *   4. Identify the caller via the caller-scoped client.
 *   5. Load the target argument (caller-scoped — RLS gates visibility).
 *   6. Derive the caller's EvidenceAnnotationActorRole.
 *   7. Enforce isAnnotationAllowed (mirror of the EV-005 client rule).
 *   8. Verify the evidenceArtifactId resolves to an artifact on the argument.
 *   9. Run the depth cap on [...existing, candidate]; reject a candidate
 *      that would be suppressed.
 *   10. Mint the new annotation (deterministic id) and append it.
 *   11. Service-role read-modify-write: spread-merge the new
 *       `evidenceAnnotations` array into the existing client_validation jsonb.
 *   12. Best-effort audit row in admin_audit_events (service-role).
 *   13. Return { argumentId, evidenceArtifactId, annotations }.
 *
 * Hard rules:
 *   - An evidence annotation is a participant gameplay annotation; it adds
 *     descriptive context, it never rules on a person or asserts a fact.
 *   - The Edge Function is the ONLY write path for evidence annotations.
 *   - The append is a SPREAD-MERGE — the existing attachedEvidence / flags /
 *     valid keys in client_validation are never disturbed.
 *   - The service-role client is used ONLY for the privileged jsonb write +
 *     the best-effort audit row.
 *   - Never logs the Authorization header, any key, or the user's note text.
 *   - No AI call.
 *
 * Concurrency (v1): the function does a read-modify-write of the whole
 * client_validation blob. Two simultaneous annotations on the same argument
 * race; one append can be dropped. The deterministic-index id-mint means a
 * dropped write is SAFE (a missing annotation the user can re-add, never
 * corruption). The race-free fix is the V2 `evidence_annotations` table.
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
import {
  enforceAnnotationDepthCap,
  isAnnotationAllowed,
  isEvidenceAnnotationKind,
  type DepthCapAnnotation,
  type EvidenceAnnotationActorRole,
  type EvidenceAnnotationKind,
} from '../_shared/evidenceAnnotationEligibility.ts';

interface AnnotateEvidenceRequest {
  debateId: string;
  argumentId: string;
  evidenceArtifactId: string;
  kind: EvidenceAnnotationKind;
  note?: string | null;
  depth: 0 | 1;
  parentAnnotationId?: string | null;
}

/** One persisted annotation inside client_validation.evidenceAnnotations. */
interface PersistedAnnotation {
  id: string;
  evidenceArtifactId: string;
  kind: EvidenceAnnotationKind;
  note?: string;
  addedByUserId: string;
  createdAt: string;
  depth: 0 | 1;
  parentAnnotationId?: string | null;
}

function isUuid(s: unknown): s is string {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}

function isNonEmptyString(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

function shortId(id: string): string {
  return id && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

/** Trim a note to <= 140 chars; whitespace-only → undefined. */
function normaliseNote(note: string | null | undefined): string | undefined {
  if (typeof note !== 'string') return undefined;
  const trimmed = note.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length <= 140 ? trimmed : trimmed.slice(0, 140);
}

/** A persisted client_validation.attachedEvidence entry — only the fields the
 *  artifact-id check needs. */
interface StoredAttachment {
  url?: string | null;
  sourceText?: string | null;
  source_text?: string | null;
  quote?: string | null;
}

function attachmentIsPresent(a: StoredAttachment | null | undefined): boolean {
  if (!a) return false;
  return (
    isNonEmptyString(a.url) ||
    isNonEmptyString(a.sourceText) ||
    isNonEmptyString(a.source_text) ||
    isNonEmptyString(a.quote)
  );
}

/**
 * Verify the evidenceArtifactId resolves to an artifact on this argument.
 * EV-001 mints ids as `<argumentId>:evidence:<index>` where index is the
 * position of a NON-EMPTY attachment in the stored array. We re-derive that
 * id set from the stored attachedEvidence and check membership.
 */
function evidenceArtifactExists(
  argumentId: string,
  evidenceArtifactId: string,
  clientValidation: Record<string, unknown> | null,
): boolean {
  if (!isNonEmptyString(evidenceArtifactId)) return false;
  const prefix = `${argumentId}:evidence:`;
  if (!evidenceArtifactId.startsWith(prefix)) return false;
  const stored = clientValidation?.attachedEvidence;
  if (!Array.isArray(stored)) return false;
  const validIds = new Set<string>();
  for (let i = 0; i < stored.length; i += 1) {
    if (attachmentIsPresent(stored[i] as StoredAttachment)) {
      validIds.add(`${argumentId}:evidence:${i}`);
    }
  }
  return validIds.has(evidenceArtifactId);
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
  const body = raw as Partial<AnnotateEvidenceRequest>;

  if (!isUuid(body.debateId) || !isUuid(body.argumentId)) {
    return badRequest('debateId_and_argumentId_required');
  }
  if (!isNonEmptyString(body.evidenceArtifactId)) {
    return badRequest('evidence_artifact_id_required');
  }
  if (!isEvidenceAnnotationKind(body.kind)) return badRequest('invalid_kind');
  if (body.depth !== 0 && body.depth !== 1) return badRequest('invalid_depth');
  if (body.depth === 1 && !isNonEmptyString(body.parentAnnotationId)) {
    return badRequest('depthId_required');
  }

  const debateId: string = body.debateId;
  const argumentId: string = body.argumentId;
  const evidenceArtifactId: string = body.evidenceArtifactId;
  const kind: EvidenceAnnotationKind = body.kind;
  const depth: 0 | 1 = body.depth;
  const parentAnnotationId: string | null =
    depth === 1 ? (body.parentAnnotationId as string) : null;
  const note = normaliseNote(body.note);

  const callerClient = createCallerClient(auth);

  // ── Identify caller. ──
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerId = userRes.user.id;

  // ── Load the target argument (caller-scoped — RLS gates visibility). ──
  // An invisible / missing row is treated as forbidden (no existence leak).
  const { data: argRow, error: argErr } = await callerClient
    .from('arguments')
    .select('id, author_id, debate_id, status, client_validation')
    .eq('id', argumentId)
    .maybeSingle();
  if (argErr) {
    return internalError(`argument_lookup_failed:${String(argErr.message || '').slice(0, 120)}`);
  }
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

  const isAdmin = profileRow?.role === 'admin' || profileRow?.role === 'moderator';
  const side = participantRow?.side ?? null;
  const isOwnBubble = argRow.author_id === callerId;

  let actorRole: EvidenceAnnotationActorRole;
  if (isAdmin) {
    actorRole = 'admin';
  } else if (side === 'affirmative' || side === 'negative') {
    actorRole = isOwnBubble ? 'participant_own_bubble' : 'participant_other_bubble';
  } else {
    // observer side, neutral, moderator-as-participant, or no participant row.
    actorRole = 'observer';
  }

  if (!isAnnotationAllowed(kind, { actorRole, targetDepth: depth })) {
    return forbidden('not_eligible');
  }

  // ── Verify the evidence artifact resolves to this argument. ──
  const clientValidation: Record<string, unknown> =
    argRow.client_validation && typeof argRow.client_validation === 'object'
      ? (argRow.client_validation as Record<string, unknown>)
      : {};
  if (!evidenceArtifactExists(argumentId, evidenceArtifactId, clientValidation)) {
    return badRequest('evidence_artifact_not_found');
  }

  // ── Read the existing annotation array for this artifact. ──
  const storedAll: PersistedAnnotation[] = Array.isArray(clientValidation.evidenceAnnotations)
    ? (clientValidation.evidenceAnnotations as PersistedAnnotation[]).filter(
        (a) => a && typeof a === 'object',
      )
    : [];
  const existingForArtifact = storedAll.filter(
    (a) => a.evidenceArtifactId === evidenceArtifactId,
  );

  // ── Depth cap on [...existing, candidate]. ──
  const candidateId = `${evidenceArtifactId}:annotation:${existingForArtifact.length}`;
  const candidate: PersistedAnnotation = {
    id: candidateId,
    evidenceArtifactId,
    kind,
    addedByUserId: callerId,
    createdAt: new Date().toISOString(),
    depth,
    ...(note !== undefined ? { note } : {}),
    ...(depth === 1 ? { parentAnnotationId } : {}),
  };
  const depthCapInput: DepthCapAnnotation[] = [...existingForArtifact, candidate].map((a) => ({
    id: a.id,
    depth: a.depth,
    parentAnnotationId: a.parentAnnotationId ?? null,
  }));
  const capped = enforceAnnotationDepthCap(depthCapInput);
  if (!capped.accepted.some((a) => a.id === candidateId)) {
    return badRequest('depth_cap_exceeded');
  }

  // ── Service-role read-modify-write: spread-merge the new array in. ──
  // Writes ONLY the client_validation column — an existing column, no
  // migration. The merge is a SPREAD so attachedEvidence / flags / valid
  // are untouched.
  const mergedAnnotations: PersistedAnnotation[] = [...storedAll, candidate];
  const mergedClientValidation: Record<string, unknown> = {
    ...clientValidation,
    evidenceAnnotations: mergedAnnotations,
  };

  const svc = createServiceClient();
  const { error: writeErr } = await svc
    .from('arguments')
    .update({ client_validation: mergedClientValidation })
    .eq('id', argumentId);
  if (writeErr) {
    return internalError(`persist_failed:${String(writeErr.message || 'unknown').slice(0, 120)}`);
  }

  // ── Audit (best-effort; never carries the note text or an email). ──
  try {
    await svc.from('admin_audit_events').insert({
      action: 'evidence_annotation_added',
      source: 'edge_function',
      actor_user_id: callerId,
      target_user_id: argRow.author_id,
      reason: null,
      payload: {
        debateIdShort: shortId(debateId),
        argumentIdShort: shortId(argumentId),
        evidenceArtifactIdShort: shortId(evidenceArtifactId),
        kind,
        depth,
      },
    });
  } catch {
    /* audit failure must not block the user */
  }

  // The full annotation set on the annotated artifact after the append.
  const annotationsForArtifact = mergedAnnotations.filter(
    (a) => a.evidenceArtifactId === evidenceArtifactId,
  );
  return ok({ argumentId, evidenceArtifactId, annotations: annotationsForArtifact });
});
