/**
 * PROOF-002 (#889) — the narrow PROOF-003 client-wrapper seam.
 *
 * The ONLY file that knows PROOF-003 attach-proof wire shape. The drawer imports
 * AttachProofInput / AttachProofResult / attachProof from here; whatever the Edge
 * finalises, only THIS file changes (the design R1 mandate). No featureFlags, no
 * service role, no direct proof_items write — the write goes through the
 * JWT-scoped edgeFunctions wrapper.
 *
 * R1 RECONCILIATION of PROOF-002 numbered assumptions vs the SHIPPED
 * docs/designs/PROOF-003.md contract (each conflict absorbed HERE, never in the
 * drawer):
 *  1. Name + transport: attach-proof via supabase.functions.invoke. As assumed.
 *  2. Body is CAMELCASE (debateId / argumentId), NOT snake (debate_id) as
 *     assumption 2 guessed. Mapped below.
 *  3. Response proofItem is CAMELCASE (AttachedProofItem) and now carries addedBy
 *     (added to the Edge response for this seam). Mapped back to the snake
 *     ProofItemRow the drawer read-path renders.
 *  4. Error codes are the ACTUAL PROOF-003 codes (not_your_move / not_a_participant
 *     / kind_not_supported / debate_argument_mismatch / validation_failed / ...),
 *     not the assumption-4 names. Mapped to plain language; unknown -> fallback.
 *     There is no rate_limited code (PROOF-003 does no rate limiting).
 *  5. Caps: label <= 120, the 6 kinds, the 3 derivable statuses. As assumed.
 *  6. clientAttachId is NOT sent to the Edge: PROOF-003 chose natural-content-tuple
 *     idempotency and its schema is .strict(), so a smuggled clientAttachId would
 *     422. We still generate one for the input contract + retry tracking, but the
 *     body omits it. Retry is safe (an identical receipt returns idempotent).
 *  7. Debt flip is client-observed (deriveEvidenceDebts recomputes when the new
 *     artifact appears in artifactsByMessageId). When answersDebtKind is set we
 *     ALSO build the durable answers_request relation (claimArgumentId = the
 *     attached-to move, which is the challenged claim in J7) so the Edge fires the
 *     evidence_supplied notification.
 *  8. The evidence_supplied notification is Edge-owned; this wrapper only REQUESTS
 *     the relation.
 * 10. Detach is shipped by PROOF-003 in the same bundle, so detach is a real
 *     capability (no capability-hiding needed).
 */
import {
  attachProof as invokeAttachProof,
  detachProof as invokeDetachProof,
  type AttachProofPayload,
  type AttachedProofItem,
} from '../../lib/edgeFunctions';
import type { ProofDrawerKind, ProofItemRow } from './proofDrawerModel';
import type { EvidenceDebtKind } from '../evidence/evidenceDebtModel';
import type { SourceChainStatus, EvidenceRisk } from '../evidence';
import { ATTACH_ERROR_COPY, PROOF_DRAWER_COPY } from './proofDrawerCopy';

export interface AttachProofInput {
  debateId: string;
  /** The move the source attaches to (author own move-or-draft). */
  argumentId: string;
  kind: ProofDrawerKind;
  label: string;
  url?: string;
  sourceText?: string;
  quote?: string;
  referencedArgumentId?: string;
  /** Set when attaching against an owed debt (J7). */
  answersDebtKind?: EvidenceDebtKind | null;
  /** Idempotency carrier (UUID). NOT sent to the Edge (assumption 6). */
  clientAttachId: string;
}

/** The reconciled attach-proof error codes the drawer maps to plain language. */
export type AttachProofErrorCode =
  | 'unauthorized'
  | 'not_a_participant'
  | 'not_your_move'
  | 'kind_not_supported'
  | 'validation_failed'
  | 'debate_argument_mismatch'
  | 'argument_not_found'
  | 'claim_not_found'
  | 'referenced_argument_not_found'
  | 'proof_cap_reached'
  | 'proof_not_found'
  | 'not_your_proof'
  | 'network_error'
  | 'unknown';

export interface AttachProofResult {
  ok: boolean;
  /** The created row echoed back, mapped to the snake ProofItemRow the drawer renders. */
  proofItem?: ProofItemRow;
  errorCode?: AttachProofErrorCode;
  /** Plain-language message (never the raw code). */
  errorMessage?: string;
}

/** Map the camelCase AttachedProofItem echoed by the Edge to the snake ProofItemRow. */
function toProofItemRow(item: AttachedProofItem): ProofItemRow {
  return {
    id: item.id,
    debate_id: item.debateId,
    argument_id: item.argumentId,
    added_by: item.addedBy,
    kind: item.kind as ProofDrawerKind,
    label: item.label,
    url: item.url,
    source_text: item.sourceText,
    quote: item.quote,
    referenced_argument_id: item.referencedArgumentId,
    source_chain_status: item.sourceChainStatus as SourceChainStatus,
    risk: item.risk as EvidenceRisk,
    created_at: item.createdAt,
    deleted_at: item.deletedAt,
  };
}

/** Normalise a raw error code to the reconciled union + a plain-language message. */
function toPlainError(rawCode: string | undefined): { errorCode: AttachProofErrorCode; errorMessage: string } {
  const known: ReadonlyArray<AttachProofErrorCode> = [
    'unauthorized',
    'not_a_participant',
    'not_your_move',
    'kind_not_supported',
    'validation_failed',
    'debate_argument_mismatch',
    'argument_not_found',
    'claim_not_found',
    'referenced_argument_not_found',
    'proof_cap_reached',
    'proof_not_found',
    'not_your_proof',
    'network_error',
  ];
  const code = (known as ReadonlyArray<string>).includes(rawCode ?? '')
    ? (rawCode as AttachProofErrorCode)
    : 'unknown';
  const errorMessage = ATTACH_ERROR_COPY[code] ?? PROOF_DRAWER_COPY.errorFallback;
  return { errorCode: code, errorMessage };
}

/** Build the Edge payload from the drawer input. clientAttachId is intentionally omitted (assumption 6). */
function toPayload(input: AttachProofInput): AttachProofPayload {
  const payload: AttachProofPayload = {
    action: 'attach',
    debateId: input.debateId,
    argumentId: input.argumentId,
    kind: input.kind,
    label: input.label,
  };
  if (input.url !== undefined) payload.url = input.url;
  if (input.sourceText !== undefined) payload.sourceText = input.sourceText;
  if (input.quote !== undefined) payload.quote = input.quote;
  if (input.referencedArgumentId !== undefined) payload.referencedArgumentId = input.referencedArgumentId;
  // Assumption 7 — an owed-debt attach also records the durable answers_request
  // relation so the Edge fires the evidence_supplied notification. The claim is
  // the attached-to move (the challenged claim in J7).
  if (input.answersDebtKind) {
    payload.relation = { claimArgumentId: input.argumentId, kind: 'answers_request' };
  }
  return payload;
}

/** Attach a source to the callers own move. Never throws; a retry is idempotent. */
export async function attachProof(input: AttachProofInput): Promise<AttachProofResult> {
  const outcome = await invokeAttachProof(toPayload(input));
  if (!outcome.ok) {
    const { errorCode, errorMessage } = toPlainError(outcome.error.error);
    return { ok: false, errorCode, errorMessage };
  }
  return { ok: true, proofItem: toProofItemRow(outcome.data.proofItem) };
}

export interface DetachProofInput {
  debateId: string;
  proofItemId: string;
}

/** Soft-delete a source the caller added. Never throws. */
export async function detachProof(input: DetachProofInput): Promise<AttachProofResult> {
  const outcome = await invokeDetachProof({
    action: 'detach',
    debateId: input.debateId,
    proofItemId: input.proofItemId,
  });
  if (!outcome.ok) {
    const { errorCode, errorMessage } = toPlainError(outcome.error.error);
    return { ok: false, errorCode, errorMessage };
  }
  return { ok: true };
}
