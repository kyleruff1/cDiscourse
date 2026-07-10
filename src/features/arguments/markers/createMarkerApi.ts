/**
 * MARK-002 (#894) — the narrow create-marker client-wrapper seam.
 *
 * The ONLY file that knows the create-marker wire shape at the room boundary.
 * The room shell imports createMarkerScoped from here; whatever the Edge
 * finalises, only THIS file changes (the attachProofApi R1 mandate). No
 * featureFlags, no service role, no direct timestamp_markers write — the write
 * goes through the JWT-scoped edgeFunctions wrapper.
 *
 * Comments are apostrophe-free (the uxOneOneTwoDoctrine quote-parity gotcha).
 */
import {
  createMarker as invokeCreateMarker,
  type CreateMarkerPayload,
  type CreatedMarker,
  type MarkerKind,
} from '../../../lib/edgeFunctions';
import type { PendingMarkerScope } from './timestampMarkerModel';
import { MARKER_ERROR_COPY, toMarkerErrorCode, type MarkerErrorCode } from './markerCopy';

export interface CreateMarkerScopedInput {
  debateId: string;
  /** The picked phrase scope (target + offsets + verification quote). */
  scope: PendingMarkerScope;
  /** Defaults to rebuttal_anchor (the only kind v1 authors). */
  kind?: MarkerKind;
  /** The callers OWN reply that consumes this marker (the J6 text-half). */
  replyArgumentId?: string;
}

export interface CreateMarkerScopedResult {
  ok: boolean;
  marker?: CreatedMarker;
  idempotent?: boolean;
  errorCode?: MarkerErrorCode;
  /** Plain-language message (never the raw code). */
  errorMessage?: string;
}

/** Build the Edge payload from the scoped input. */
function toPayload(input: CreateMarkerScopedInput): CreateMarkerPayload {
  const payload: CreateMarkerPayload = {
    action: 'mint',
    debateId: input.debateId,
    targetArgumentId: input.scope.targetArgumentId,
    spanStart: input.scope.spanStart,
    spanEnd: input.scope.spanEnd,
    quote: input.scope.quote,
    kind: input.kind ?? 'rebuttal_anchor',
  };
  if (input.replyArgumentId !== undefined) payload.replyArgumentId = input.replyArgumentId;
  return payload;
}

/**
 * Mint a marker for a picked phrase, optionally linked to the callers reply.
 * Never throws; a retry is idempotent (the Edge returns the existing marker when
 * the reply is already linked). A mint failure never blocks the reply.
 */
export async function createMarkerScoped(
  input: CreateMarkerScopedInput,
): Promise<CreateMarkerScopedResult> {
  const outcome = await invokeCreateMarker(toPayload(input));
  if (!outcome.ok) {
    const errorCode = toMarkerErrorCode(outcome.error.error);
    const errorMessage = MARKER_ERROR_COPY[errorCode];
    return { ok: false, errorCode, errorMessage };
  }
  return { ok: true, marker: outcome.data.marker, idempotent: outcome.data.idempotent };
}
