/**
 * MCP-021B — Persistence row types and pure-TS type guards.
 *
 * Mirrors the SQL schema in
 * supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql.
 * Adapter functions in `machineObservationPersistenceAdapter.ts` validate
 * runtime row shapes against these types; query helpers in
 * `machineObservationPersistenceQuery.ts` map raw Supabase rows into these
 * shapes.
 *
 * Doctrine anchor (cdiscourse-doctrine §10a + §1):
 *   - Pure types only. The type guards never resolve who is right and
 *     never label a participant. They only validate row shape.
 *   - Persisted Machine Observations are structural facts about moves;
 *     never gameplay-resolving judgments, never engagement signals.
 *
 * Pure TS. No React. No Supabase. No network. JSON-serializable.
 */

import { ALL_MACHINE_OBSERVATION_FAMILIES } from './nodeLabelTypes';
import type { MachineObservationFamily } from './nodeLabelTypes';

export type MachineObservationRunStatus = 'success' | 'failed' | 'fallback';
export type MachineObservationConfidence = 'low' | 'medium' | 'high';

/**
 * MCP-021B — One row in `public.argument_machine_observation_runs`.
 *
 * Camel-case shape; the persistence query helper maps the snake_case
 * Supabase row into this shape.
 */
export interface MachineObservationRunRow {
  id: string;
  debateId: string;
  argumentId: string;
  schemaVersion: string;
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;
  providerKey: string | null;
  modelName: string | null;
  inputHash: string | null;
  status: MachineObservationRunStatus;
  failureReason: string | null;
  /** ISO-8601 timestamp. */
  startedAt: string;
  /** ISO-8601 timestamp; nullable while a run is in-flight. */
  completedAt: string | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/**
 * MCP-021B — One row in `public.argument_machine_observation_results`.
 *
 * One row PER POSITIVE OBSERVATION. Absence of a result row means "not
 * present" or "not evaluated"; run status disambiguates.
 */
export interface MachineObservationResultRow {
  id: string;
  runId: string;
  debateId: string;
  argumentId: string;
  schemaVersion: string;
  rawKey: string;
  /**
   * Family code. Adapter validates against
   * `ALL_MACHINE_OBSERVATION_FAMILIES` membership; widened to `string`
   * here because Supabase returns `text` and we want the adapter to be the
   * authoritative gate.
   */
  family: MachineObservationFamily | string;
  confidence: MachineObservationConfidence;
  evidenceSpan: string | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/**
 * Pure type guard for the confidence enum.
 */
export function isMachineObservationConfidence(
  value: unknown,
): value is MachineObservationConfidence {
  return value === 'low' || value === 'medium' || value === 'high';
}

/**
 * Pure type guard for the run status enum.
 */
export function isMachineObservationRunStatus(
  value: unknown,
): value is MachineObservationRunStatus {
  return value === 'success' || value === 'failed' || value === 'fallback';
}

/**
 * Pure type guard for the family enum (member of the MCP-021A 10-family
 * set). The adapter does NOT require this to pass — `family` is stored
 * for operator-audit + future filtering; the rawKey-to-family mapping is
 * the authoritative source. This guard is exported for tests.
 */
export function isMachineObservationFamily(
  value: unknown,
): value is MachineObservationFamily {
  if (typeof value !== 'string') return false;
  return (ALL_MACHINE_OBSERVATION_FAMILIES as ReadonlyArray<string>).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNullableNonEmptyString(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === 'string';
}

/**
 * Validate a candidate result row shape. Pure. Returns true only if every
 * required field is present and well-typed; returns false otherwise.
 * Never throws.
 *
 * Doctrine: dropped rows are dropped SILENTLY — no log, no echo of the
 * malformed row's raw_key (which is internal and never user-facing).
 */
export function isWellFormedResultRow(
  candidate: unknown,
): candidate is MachineObservationResultRow {
  if (candidate === null || typeof candidate !== 'object') return false;
  const row = candidate as Record<string, unknown>;
  if (!isNonEmptyString(row.id)) return false;
  if (!isNonEmptyString(row.runId)) return false;
  if (!isNonEmptyString(row.debateId)) return false;
  if (!isNonEmptyString(row.argumentId)) return false;
  if (!isNonEmptyString(row.schemaVersion)) return false;
  if (!isNonEmptyString(row.rawKey)) return false;
  if (typeof row.family !== 'string') return false;
  if (!isMachineObservationConfidence(row.confidence)) return false;
  // evidenceSpan: nullable string. Empty string is allowed; the adapter
  // chooses not to emit it on the mark when length === 0.
  if (!isNullableNonEmptyString(row.evidenceSpan)) return false;
  if (!isNonEmptyString(row.createdAt)) return false;
  return true;
}

/**
 * Validate a candidate run row shape. Sibling guard for tests + future
 * consumers (the MCP-021B adapter only consumes result rows directly).
 */
export function isWellFormedRunRow(
  candidate: unknown,
): candidate is MachineObservationRunRow {
  if (candidate === null || typeof candidate !== 'object') return false;
  const row = candidate as Record<string, unknown>;
  if (!isNonEmptyString(row.id)) return false;
  if (!isNonEmptyString(row.debateId)) return false;
  if (!isNonEmptyString(row.argumentId)) return false;
  if (!isNonEmptyString(row.schemaVersion)) return false;
  if (!Array.isArray(row.requestedFamilies)) return false;
  // Every requestedFamilies entry must be a string (family-membership
  // check is informational here; the adapter does not require it).
  for (const f of row.requestedFamilies) {
    if (typeof f !== 'string') return false;
  }
  if (!isNullableNonEmptyString(row.providerKey)) return false;
  if (!isNullableNonEmptyString(row.modelName)) return false;
  if (!isNullableNonEmptyString(row.inputHash)) return false;
  if (!isMachineObservationRunStatus(row.status)) return false;
  if (!isNullableNonEmptyString(row.failureReason)) return false;
  if (!isNonEmptyString(row.startedAt)) return false;
  if (row.completedAt !== null && typeof row.completedAt !== 'string') return false;
  if (!isNonEmptyString(row.createdAt)) return false;
  return true;
}
