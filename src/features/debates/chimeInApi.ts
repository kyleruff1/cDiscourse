/**
 * CHIMEIN-P8 Round 2 (#761) — the narrow chime-in client-wrapper seam.
 *
 * The ONLY file that knows the chime-in wire shape at the room boundary. The room
 * surface imports attachChimeIn / retractChimeIn from here; whatever the Edge
 * finalises, only THIS file changes (the moveMarksApi R1 mandate). No featureFlags
 * (the ASP consumer-allowlist guard — the flag is read at App.tsx and threaded as
 * a prop), no service role, no direct chime_in_contributions write — the write
 * goes through the JWT-scoped edgeFunctions wrapper. A failed chime never throws
 * and never blocks anything.
 *
 * DOCTRINE (cdiscourse-doctrine sections 1 / 9): a chime-in is a bounded
 * contribution, never a third principal voice, never a node structural state,
 * never factual standing. Every user-facing string here is plain language and
 * ban-list clean — no internal code, no verdict, no amplification token.
 *
 * Comments are apostrophe-free (the uxOneOneTwoDoctrine quote-parity gotcha).
 */
import { chimeIn as invokeChimeIn } from '../../lib/edgeFunctions';

/** The canonical chime-in error codes surfaced to the room boundary. */
export type ChimeInErrorCode =
  | 'unauthorized'
  | 'invalid_input'
  | 'not_author'
  | 'not_point_scoped'
  | 'room_private'
  | 'seats_full'
  | 'not_found'
  | 'network_error';

/** Plain-language copy per error code. Ban-list clean; no internal code leaks. */
export const CHIME_IN_ERROR_COPY: Readonly<Record<ChimeInErrorCode, string>> = Object.freeze({
  unauthorized: 'Sign in to chime in.',
  invalid_input: 'Something was missing from that chime-in.',
  not_author: 'You can chime in with your own reply only.',
  not_point_scoped: 'That reply does not attach to that point.',
  room_private: 'Chime-ins are for public rooms only.',
  seats_full: 'The chime-in seats are all taken right now.',
  not_found: 'We could not find that reply.',
  network_error: 'We could not reach the room. Try again.',
});

const KNOWN_CODES = new Set<ChimeInErrorCode>([
  'unauthorized',
  'invalid_input',
  'not_author',
  'not_point_scoped',
  'room_private',
  'seats_full',
  'not_found',
  'network_error',
]);

/** Normalise any raw Edge error string to a known code (unknown -> network_error). */
export function toChimeInErrorCode(raw: string | undefined): ChimeInErrorCode {
  if (raw && KNOWN_CODES.has(raw as ChimeInErrorCode)) return raw as ChimeInErrorCode;
  // validation_failed / invalid_json map to invalid_input at the seam.
  if (raw === 'validation_failed' || raw === 'invalid_json') return 'invalid_input';
  return 'network_error';
}

export interface AttachChimeInInput {
  /** The caller OWN reply that becomes the chime-in. */
  argumentId: string;
  /** The point it attaches to (must equal the reply parent). */
  targetArgumentId: string;
}

export interface RetractChimeInInput {
  argumentId: string;
  contributionId?: string;
}

/** The chime marker echoed back on a successful attach (camelCase at the seam). */
export interface ChimeInMarker {
  id: string;
  seatIndex: number;
  targetArgumentId: string;
}

export interface ChimeInApiResult {
  ok: boolean;
  /** Present on a successful attach. */
  marker?: ChimeInMarker;
  /** Free chime seats remaining (0..3). Advisory to display only. */
  openChimeInSeatCount?: number;
  errorCode?: ChimeInErrorCode;
  /** Plain-language message (never the raw code). */
  errorMessage?: string;
}

/** Attach a chime-in marker to the caller OWN reply. Idempotent; never throws. */
export async function attachChimeIn(input: AttachChimeInInput): Promise<ChimeInApiResult> {
  const outcome = await invokeChimeIn({
    action: 'attach',
    argument_id: input.argumentId,
    target_argument_id: input.targetArgumentId,
  });
  if (!outcome.ok) {
    const errorCode = toChimeInErrorCode(outcome.error.error);
    return { ok: false, errorCode, errorMessage: CHIME_IN_ERROR_COPY[errorCode] };
  }
  const marker = outcome.data.chime_in;
  return {
    ok: true,
    marker: marker
      ? {
          id: marker.id,
          seatIndex: marker.seat_index,
          targetArgumentId: marker.target_argument_id,
        }
      : undefined,
    openChimeInSeatCount: outcome.data.open_chime_in_seat_count,
  };
}

/** Retract a chime-in marker the caller previously attached. Idempotent; never throws. */
export async function retractChimeIn(input: RetractChimeInInput): Promise<ChimeInApiResult> {
  const outcome = await invokeChimeIn({
    action: 'retract',
    argument_id: input.argumentId,
    contribution_id: input.contributionId,
  });
  if (!outcome.ok) {
    const errorCode = toChimeInErrorCode(outcome.error.error);
    return { ok: false, errorCode, errorMessage: CHIME_IN_ERROR_COPY[errorCode] };
  }
  return { ok: true, openChimeInSeatCount: outcome.data.open_chime_in_seat_count };
}
