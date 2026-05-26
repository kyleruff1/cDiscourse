/**
 * MCP-021B — Map persisted Machine Observation rows into NodeLabelMark[].
 *
 * Pure TS. The adapter is the bridge between the persistence layer and
 * UX-001.5A's existing presentation pipeline. It applies four filters in
 * order:
 *
 *   1. `schemaVersion === MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION`
 *   2. `rawKey ∈ MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY`
 *   3. `confidence ≥ confidenceEligibility[<surface>MinConfidence]`
 *   4. `evidenceSpan` truncated to ≤240 chars (defensive)
 *
 * Every dropped row is dropped SILENTLY — never echoed, never logged.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §9 — no raw internal codes in user-facing copy
 *     (the adapter never returns a rawKey as a label; only as a
 *     `NodeLabelMark` whose `label`/`shortLabel`/`description` are sourced
 *     from the MCP-021A definition registry's plain-language fields).
 *   - cdiscourse-doctrine §10a — Observations remain Observations
 *     (`kind: 'machine_observation'`; never `user_allegation`).
 *   - cdiscourse-doctrine §1 — no verdict, no winner / loser / truth /
 *     correctness assertions in any field.
 *
 * Pure JSON-serializable. No React / Supabase / network imports.
 */

import {
  MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
} from './index';
import type {
  MachineObservationDefinition,
  NodeLabelMark,
} from './nodeLabelTypes';
import {
  isMachineObservationConfidence,
  isWellFormedResultRow,
  type MachineObservationConfidence,
} from './machineObservationPersistenceTypes';

const MAX_EVIDENCE_SPAN_CHARS = 240;

const CONFIDENCE_RANK: Record<MachineObservationConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export type MachineObservationPersistenceSurface =
  | 'timeline_node'
  | 'selected_context'
  | 'inspect';

function meetsConfidenceFloor(
  confidence: MachineObservationConfidence,
  eligibility: MachineObservationDefinition['confidenceEligibility'],
  surface: MachineObservationPersistenceSurface,
): boolean {
  const required =
    surface === 'timeline_node'
      ? eligibility.timelineMinConfidence
      : surface === 'selected_context'
        ? eligibility.selectedContextMinConfidence
        : eligibility.inspectMinConfidence;
  return CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK[required];
}

function truncate(span: string): string {
  if (span.length <= MAX_EVIDENCE_SPAN_CHARS) return span;
  // 239 chars + ellipsis = 240 char total.
  return `${span.slice(0, MAX_EVIDENCE_SPAN_CHARS - 1)}…`;
}

export interface MapPersistedObservationOptions {
  /** Target argument id; rows whose `argumentId` differs are discarded
   *  silently (defensive — caller passed wrong scope). */
  argumentId: string;
  /** Target surface for confidence-floor gating. */
  surface: MachineObservationPersistenceSurface;
}

/**
 * Map persisted Machine Observation rows into `NodeLabelMark[]` for the
 * requested surface. Pure.
 *
 * Returns `[]` when:
 *   - `rows` is `null` / `undefined` / not an array / empty
 *   - `options.argumentId` is missing or empty
 *   - no row passes the four-filter chain
 *
 * Each row is dropped SILENTLY when:
 *   - row shape malformed (`isWellFormedResultRow` returns `false`)
 *   - `row.argumentId !== options.argumentId` (defensive — caller passed
 *     wrong scope)
 *   - `row.schemaVersion !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION`
 *   - `row.rawKey` not in `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY`
 *   - `row.confidence` below per-surface threshold for the registry entry
 *   - `row.confidence` not in `('low' | 'medium' | 'high')`
 *
 * `evidenceSpan` is truncated to 240 chars when present (defensive — even
 * if MCP-021C truncates at write time, the adapter re-applies the bound
 * at read time).
 *
 * The returned `NodeLabelMark[]` has every mark's:
 *   - `kind: 'machine_observation'`
 *   - `source: definition.source` (preserves the registry's auto /
 *     lifecycle / ai_classifier / semantic_referee /
 *     composition_mutation provenance)
 *   - `confidence: row.confidence` (carried on the mark for downstream
 *     chrome)
 *   - `label`/`shortLabel`/`description`/`disposition`/`defaultSurface`/`priority`:
 *     spread from the MCP-021A definition (NEVER from the raw row)
 *   - `id: machine_observation:persisted:${row.id}:${argumentId}` (stable
 *     React diffing key, parallels Source 2 / Source 3 id shape)
 */
export function mapPersistedObservationRowsToNodeLabelMarks(
  rows: ReadonlyArray<unknown> | null | undefined,
  options: MapPersistedObservationOptions,
): NodeLabelMark[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (
    !options ||
    typeof options.argumentId !== 'string' ||
    options.argumentId.length === 0
  ) {
    return [];
  }
  const targetSurface = options.surface;
  if (
    targetSurface !== 'timeline_node' &&
    targetSurface !== 'selected_context' &&
    targetSurface !== 'inspect'
  ) {
    return [];
  }
  const out: NodeLabelMark[] = [];
  for (const candidate of rows) {
    if (!isWellFormedResultRow(candidate)) continue;
    const row = candidate;
    if (row.argumentId !== options.argumentId) continue;
    if (row.schemaVersion !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) continue;
    if (!isMachineObservationConfidence(row.confidence)) continue;
    const definition = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[row.rawKey];
    if (!definition) continue;
    if (
      !meetsConfidenceFloor(row.confidence, definition.confidenceEligibility, targetSurface)
    ) {
      continue;
    }
    // The definition carries kind: 'machine_observation' and the full
    // plain-language label/shortLabel/description/disposition fields.
    // Spread it verbatim and override only id + confidence (+ optional
    // evidenceSpan when present).
    const mark: NodeLabelMark = {
      ...definition,
      id: `machine_observation:persisted:${row.id}:${options.argumentId}`,
      confidence: row.confidence,
    };
    if (row.evidenceSpan != null && row.evidenceSpan.length > 0) {
      // evidenceSpan is not on the canonical NodeLabelMark interface
      // today; spread additively for forward consumers that read it.
      // Truncation is defensive in case a future chrome consumer reads
      // it directly.
      (mark as NodeLabelMark & { evidenceSpan?: string }).evidenceSpan = truncate(
        row.evidenceSpan,
      );
    }
    out.push(mark);
  }
  return out;
}
