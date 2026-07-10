/**
 * UX-MEDIATOR-005 — Room → mediator board adapter (pure TypeScript).
 *
 * A THIN adapter that narrows the data the room already builds in-scope
 * (the timeline map, the LIFE-001 lifecycle map, the EV-003 evidence-debt
 * list, and the persisted machine-observation rows) into a `MediatorGraphInput`
 * and calls the already-merged `deriveMediatorBoardState` (UX-MEDIATOR-001).
 *
 * It does NOT duplicate any derivation logic — it assembles inputs and
 * delegates. Pure TS: no React, no Supabase, no fetch, no clock, no
 * randomness, no input mutation. All inputs come from data already loaded
 * in-room (no new fetch).
 */
import type { ArgumentTimelineMapModel } from '../arguments/argumentGameSurfaceModel';
import type { EvidenceDebt } from '../evidence/evidenceDebtModel';
import type { PointLifecycleMap } from '../lifecycle/pointLifecycleModel';
import type { MachineObservationResultRow } from '../nodeLabels/machineObservationPersistenceTypes';
import { deriveMediatorBoardState } from './deriveMediatorBoardState';
import type {
  MediatorBoardOptions,
  MediatorBoardState,
  MediatorGraphNode,
  MediatorObservationInput,
} from './mediatorBoardTypes';

export interface RoomMediatorAdapterInput {
  debateId: string;
  /** The room's already-built timeline map (buildArgumentTimelineMap). */
  timelineMap: ArgumentTimelineMapModel;
  /** The room's already-built lifecycle map (buildPointLifecycleMap). */
  lifecycle: PointLifecycleMap;
  /** The room's already-derived evidence debts (deriveEvidenceDebts). */
  evidenceDebts: ReadonlyArray<EvidenceDebt>;
  /**
   * Persisted machine-observation rows keyed by argumentId
   * (`useArgumentRoomMessages().persistedObservationsByArgumentId`). PRODUCTION
   * rows only — run_mode filtering happens upstream. Optional: when absent the
   * board ships on lifecycle + evidence-debt signals alone (observation-only
   * states fall back to `confidence: 'unknown'`, never invented).
   */
  persistedObservationsByArgumentId?: Record<string, ReadonlyArray<MachineObservationResultRow>> | null;
  /**
   * Optional per-message target excerpt (the parent excerpt a move addresses).
   * Used for the point anchor; absent → null.
   */
  targetExcerptByMessageId?: ReadonlyMap<string, string | null>;
  /** The currently-active timeline node — biases `nextAction`. */
  activeNodeId?: string | null;
  /**
   * INTEL-001 (#900) — OPTIONAL engagement-lane weighting for the `nextAction`
   * tie-break only. Absent/empty => byte-identical board (incl. `inputHash`).
   * Forwarded verbatim into the SINGLE `deriveMediatorBoardState` options seam.
   */
  weightingSignals?: MediatorBoardOptions['weightingSignals'];
}

/**
 * Build a `MediatorBoardState` from the room's already-derived data.
 * Pure + deterministic for the same inputs.
 */
export function deriveRoomMediatorBoardState(input: RoomMediatorAdapterInput): MediatorBoardState {
  const nodes: MediatorGraphNode[] = (input.timelineMap?.nodes ?? []).map((n) => ({
    messageId: n.messageId,
    parentId: n.parentId,
    ordinal: n.ordinal,
    branchRootMessageId: n.branchRootMessageId,
    kindLabel: n.kindLabel,
    sideLabel: n.sideLabel,
    isRoot: n.isRoot,
    replyCount: n.replyCount,
    descendantCount: n.descendantCount,
    targetExcerpt: input.targetExcerptByMessageId?.get(n.messageId) ?? null,
  }));

  const observations: MediatorObservationInput[] = [];
  const obsByArg = input.persistedObservationsByArgumentId;
  if (obsByArg) {
    for (const argumentId of Object.keys(obsByArg)) {
      const rows = obsByArg[argumentId];
      if (!rows) continue;
      for (const row of rows) {
        if (!row || typeof row.rawKey !== 'string') continue;
        observations.push({
          argumentId: row.argumentId,
          family: row.family,
          rawKey: row.rawKey,
          confidence: row.confidence,
        });
      }
    }
  }

  return deriveMediatorBoardState(
    {
      debateId: input.debateId,
      nodes,
      lifecycle: input.lifecycle,
      evidenceDebts: input.evidenceDebts,
    },
    observations,
    { activeNodeId: input.activeNodeId ?? null, weightingSignals: input.weightingSignals },
  );
}
