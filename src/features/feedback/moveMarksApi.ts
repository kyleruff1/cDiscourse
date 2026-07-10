/**
 * FEEDBACK-001 (#898) — the narrow mark-move client-wrapper seam.
 *
 * The ONLY file that knows the mark-move wire shape at the room boundary. The
 * useMoveMarks hook imports setMoveMark / retractMoveMark from here; whatever the
 * Edge finalises, only THIS file changes (the createMarkerApi R1 mandate). No
 * featureFlags, no service role, no direct move_marks write — the write goes
 * through the JWT-scoped edgeFunctions wrapper. A failed mark never throws and
 * never blocks anything.
 *
 * Comments are apostrophe-free (the uxOneOneTwoDoctrine quote-parity gotcha).
 */
import { markMove as invokeMarkMove } from '../../lib/edgeFunctions';
import type { MoveMarkCode, ViewerMoveMarkState } from './moveMarksModel';
import { MOVE_MARK_ERROR_COPY, toMoveMarkErrorCode, type MoveMarkErrorCode } from './moveMarksCopy';

export interface MoveMarkApiInput {
  debateId: string;
  argumentId: string;
  markCode: MoveMarkCode;
}

export interface MoveMarkApiResult {
  ok: boolean;
  /** The caller's own new state on the move (present on success). */
  viewerMarks?: ViewerMoveMarkState;
  errorCode?: MoveMarkErrorCode;
  /** Plain-language message (never the raw code). */
  errorMessage?: string;
}

async function run(
  action: 'mark' | 'retract',
  input: MoveMarkApiInput,
): Promise<MoveMarkApiResult> {
  const outcome = await invokeMarkMove({
    action,
    debateId: input.debateId,
    argumentId: input.argumentId,
    markCode: input.markCode,
  });
  if (!outcome.ok) {
    const errorCode = toMoveMarkErrorCode(outcome.error.error);
    return { ok: false, errorCode, errorMessage: MOVE_MARK_ERROR_COPY[errorCode] };
  }
  return { ok: true, viewerMarks: outcome.data.viewerMarks };
}

/** Mark a move with a code (idempotent; a paired flip clears the opposite). */
export async function setMoveMark(input: MoveMarkApiInput): Promise<MoveMarkApiResult> {
  return run('mark', input);
}

/** Retract a previously-set mark (idempotent; a no-op when none is active). */
export async function retractMoveMark(input: MoveMarkApiInput): Promise<MoveMarkApiResult> {
  return run('retract', input);
}
