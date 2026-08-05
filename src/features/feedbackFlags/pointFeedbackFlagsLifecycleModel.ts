/**
 * UX-FLAGS-005 (issue 837) — pure-TS lifecycle discriminant.
 *
 * Folds the 6-value ARCH-001 queue enum
 * (`argument_machine_observation_runs.state`) into the calm 3-state
 * discriminant the flag row consumes:
 *
 *   ready   : render pills as today, or `null` on an empty flag list
 *   pending : render the calm "Still reading this..." line on an empty
 *             flag list; never displaces content when flags are present
 *   failed  : render `null` (silent doctrine) on an empty flag list; the
 *             surface never apologises for the machines limits and never
 *             surfaces an internal state name
 *
 * All comments in this file are apostrophe-free so the uxOneOneTwoDoctrine
 * naive quote-parity scanner does not mis-parse the file.
 *
 * Pure TypeScript. No React, no Supabase, no network, no side effects.
 * Deterministic given the input. JSON-serializable input and output.
 *
 * Doctrine anchors (cdiscourse-doctrine):
 *   - Section 1 (advisory, never a verdict): pending copy is patient, not
 *     urgent; failed renders nothing.
 *   - Section 4 (AI moderator hard limits): the discriminant reads what
 *     the drainer already wrote; no client-side AI.
 *   - Section 9 (plain language): internal codes never appear in the
 *     UI-facing shape returned here (the discriminant is exactly one of
 *     three enum values; the copy layer maps 'pending' to a plain string).
 */

import type { MachineObservationRunLifecycleState } from '../nodeLabels/machineObservationPersistenceTypes';
import { isMachineObservationRunLifecycleState } from '../nodeLabels/machineObservationPersistenceTypes';

/**
 * The 3-state discriminant the flag row consumes. Never a raw queue enum
 * value; never a provider/error/dead-letter code. See file header.
 */
export type PointFeedbackFlagsLifecycleState = 'ready' | 'pending' | 'failed';

/**
 * Frozen array of every `PointFeedbackFlagsLifecycleState` value. Exported
 * for exhaustive test enumeration.
 */
export const ALL_POINT_FEEDBACK_FLAGS_LIFECYCLE_STATES:
  ReadonlyArray<PointFeedbackFlagsLifecycleState> = Object.freeze([
    'ready',
    'pending',
    'failed',
  ]);

/**
 * The MINIMAL per-argument roll-up the client reads. Never a raw row and
 * never a per-family echo. The Supabase fetcher aggregates rows into this
 * shape so nothing at the seam can render a leaked code.
 *
 *   hasAnyRun            : any row observed for this argument
 *   hasAnyNonTerminal    : any run in ('pending','leased','retry_scheduled')
 *   hasAnySucceeded      : any run in ('succeeded')
 *   hasAnyTerminalFailure: any run in ('failed_terminal','dead_letter')
 *
 * `hasAnyRun === false` (nothing enqueued yet) is treated as `'ready'` at
 * the discriminant layer under the silent-on-absence doctrine (cdiscourse
 * -doctrine section 1).
 */
export interface ArgumentClassifierLifecycleRollup {
  readonly argumentId: string;
  readonly hasAnyRun: boolean;
  readonly hasAnyNonTerminal: boolean;
  readonly hasAnySucceeded: boolean;
  readonly hasAnyTerminalFailure: boolean;
}

/**
 * Fold raw run rows into the minimal roll-up. Pure. Never throws. Order-
 * independent by construction (booleans OR together).
 *
 * Rows whose `state` fails the type guard are treated as "no observation"
 * for that row (does NOT flip `hasAnyRun`), matching the silent-on-
 * uncertainty default from cdiscourse-doctrine section 1 + section 9.
 * This is what enforces safe under-classification if the migration widens
 * the enum without a matching client update.
 */
export function foldRunRowsIntoRollup(
  argumentId: string,
  runs: ReadonlyArray<{ state: MachineObservationRunLifecycleState | string }>,
): ArgumentClassifierLifecycleRollup {
  let hasAnyRun = false;
  let hasAnyNonTerminal = false;
  let hasAnySucceeded = false;
  let hasAnyTerminalFailure = false;

  for (const row of runs) {
    if (!isMachineObservationRunLifecycleState(row?.state)) continue;
    hasAnyRun = true;
    const s: MachineObservationRunLifecycleState = row.state;
    if (s === 'pending' || s === 'leased' || s === 'retry_scheduled') {
      hasAnyNonTerminal = true;
    } else if (s === 'succeeded') {
      hasAnySucceeded = true;
    } else if (s === 'failed_terminal' || s === 'dead_letter') {
      hasAnyTerminalFailure = true;
    }
  }

  return Object.freeze({
    argumentId,
    hasAnyRun,
    hasAnyNonTerminal,
    hasAnySucceeded,
    hasAnyTerminalFailure,
  });
}

/**
 * Derive the calm 3-state discriminant from the per-argument roll-up +
 * whether the flag row is about to render any content. Total, deterministic.
 *
 * Order-of-precedence (enforced by tests):
 *
 *   1. hasVisibleFlags === true                             -> 'ready'
 *      Content wins over posture. Pending never obscures actual flags.
 *   2. rollup null / undefined / hasAnyRun === false        -> 'ready'
 *      Nothing enqueued (or fetch degraded to empty). Silent on absence.
 *   3. rollup.hasAnyNonTerminal === true                    -> 'pending'
 *      pending / leased / retry_scheduled = the drainer is still working.
 *   4. rollup.hasAnySucceeded === true                      -> 'ready'
 *      A succeeded family took precedence over a dead-lettered sibling; the
 *      succeeded run had nothing to say -> stay silent.
 *   5. rollup.hasAnyTerminalFailure === true &&
 *      !rollup.hasAnySucceeded                              -> 'failed'
 *      A pure-failure argument -> the row renders null downstream.
 *   6. Fallback                                             -> 'ready'
 *      Defensive; unreachable given the shape of the roll-up.
 *
 * Every non-terminal state (rule 3) surfaces the SAME "still reading" copy
 * -- pending, leased, and retry_scheduled are indistinguishable to the
 * user by doctrinal design. A retry has already implied the machine had
 * something to say and pulled back; surfacing the retry itself would be a
 * verdict about the machines competence (cdiscourse-doctrine section 4).
 */
export function derivePointFeedbackFlagsLifecycleState(input: {
  hasVisibleFlags: boolean;
  rollup: ArgumentClassifierLifecycleRollup | null | undefined;
}): PointFeedbackFlagsLifecycleState {
  if (input && input.hasVisibleFlags === true) return 'ready';
  const rollup = input ? input.rollup : null;
  if (!rollup || rollup.hasAnyRun !== true) return 'ready';
  if (rollup.hasAnyNonTerminal === true) return 'pending';
  if (rollup.hasAnySucceeded === true) return 'ready';
  if (rollup.hasAnyTerminalFailure === true) return 'failed';
  return 'ready';
}
