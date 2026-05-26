/**
 * MCP-021A — Machine Observation Definitions (parallel registry).
 *
 * Per design §4 implementer choice (a/b): option (b) PARALLEL registry
 * — `NodeLabelMark` consumers continue to read the byte-equal
 * `MACHINE_OBSERVATION_REGISTRY` from `machineObservationRegistry.ts`;
 * this file carries the EXTENDED `MachineObservationDefinition` shape
 * (8 new MCP-021A fields layered on the same compound-key surface).
 *
 * Layout (171 entries after all family commits land):
 *   - Family A — parent_relation (16 entries)
 *   - Family B — disagreement_axis (14 entries)
 *   - Family C — misunderstanding_repair (17 entries)
 *   - Family D — evidence_source_chain (27 entries)
 *   - Family E — argument_scheme (16 entries)
 *   - Family F — critical_question (14 entries)
 *   - Family G — resolution_progress (29 entries)
 *   - Family H — claim_clarity (12 entries)
 *   - Family I — thread_topology (21 entries)
 *   - Family J — sensitive_composer (5 entries; UNCHANGED per Trigger 10)
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — Observations vs Allegations boundary.
 *   - cdiscourse-doctrine §1 — score is gameplay analysis, never truth.
 *   - Every entry's plain-language label / shortLabel / description
 *     passes the verdict-token ban-list scan (test category 7).
 *
 * Pure TS. No React. No Supabase. No network. JSON-serializable.
 * Frozen.
 */

import { makeMachineObservationKey } from './machineObservationRegistry';
import { FAMILY_A_DEFINITIONS } from './machineObservationDefinitions/familyA';
import { FAMILY_B_DEFINITIONS } from './machineObservationDefinitions/familyB';
import { FAMILY_C_DEFINITIONS } from './machineObservationDefinitions/familyC';
import { FAMILY_D_DEFINITIONS } from './machineObservationDefinitions/familyD';
import { FAMILY_E_DEFINITIONS } from './machineObservationDefinitions/familyE';
import { FAMILY_F_DEFINITIONS } from './machineObservationDefinitions/familyF';
import { FAMILY_G_DEFINITIONS } from './machineObservationDefinitions/familyG';
import { FAMILY_H_DEFINITIONS } from './machineObservationDefinitions/familyH';
import { FAMILY_I_DEFINITIONS } from './machineObservationDefinitions/familyI';
import { FAMILY_J_DEFINITIONS } from './machineObservationDefinitions/familyJ';
import type {
  MachineObservationDefinition,
  MachineObservationFamily,
} from './nodeLabelTypes';

// ── Compose all definitions ────────────────────────────────────────

function buildAllDefinitions(): ReadonlyArray<MachineObservationDefinition> {
  const all: MachineObservationDefinition[] = [];
  for (const def of FAMILY_A_DEFINITIONS) all.push(def);
  for (const def of FAMILY_B_DEFINITIONS) all.push(def);
  for (const def of FAMILY_C_DEFINITIONS) all.push(def);
  for (const def of FAMILY_D_DEFINITIONS) all.push(def);
  for (const def of FAMILY_E_DEFINITIONS) all.push(def);
  for (const def of FAMILY_F_DEFINITIONS) all.push(def);
  for (const def of FAMILY_G_DEFINITIONS) all.push(def);
  for (const def of FAMILY_H_DEFINITIONS) all.push(def);
  for (const def of FAMILY_I_DEFINITIONS) all.push(def);
  for (const def of FAMILY_J_DEFINITIONS) all.push(def);
  return Object.freeze(all);
}

const ALL_DEFINITIONS = buildAllDefinitions();

/**
 * MCP-021A — Parallel registry keyed by COMPOUND key
 * `${source}:${rawKey}`. Mirrors the structure of
 * `MACHINE_OBSERVATION_REGISTRY` (which keeps `NodeLabelMark` byte-equal
 * for UX-001.5A consumers).
 *
 * Pure TS. Frozen.
 */
function buildCompoundRegistry(): Readonly<
  Record<string, MachineObservationDefinition>
> {
  const map: Record<string, MachineObservationDefinition> = {};
  for (const def of ALL_DEFINITIONS) {
    map[makeMachineObservationKey(def.source, def.rawKey)] = def;
  }
  return Object.freeze(map);
}

/**
 * MCP-021A — Definition registry by rawKey (collapses sharedrawKeys
 * with the same priority order as `MACHINE_OBSERVATION_BY_RAW_KEY`:
 * lifecycle > auto_metadata > semantic_referee > ai_classifier).
 */
function buildByRawKeyRegistry(): Readonly<
  Record<string, MachineObservationDefinition>
> {
  const map: Record<string, MachineObservationDefinition> = {};

  // Pass 1: AI classifier (lowest priority among included).
  for (const def of ALL_DEFINITIONS) {
    if (def.source === 'ai_classifier') map[def.rawKey] = def;
  }
  // Pass 2: composition_mutation (none in v1 — kept for parallelism).
  for (const def of ALL_DEFINITIONS) {
    if (def.source === 'composition_mutation') map[def.rawKey] = def;
  }
  // Pass 3: semantic_referee.
  for (const def of ALL_DEFINITIONS) {
    if (def.source === 'semantic_referee') map[def.rawKey] = def;
  }
  // Pass 4: auto_metadata.
  for (const def of ALL_DEFINITIONS) {
    if (def.source === 'auto_metadata') map[def.rawKey] = def;
  }
  // Pass 5: lifecycle wins for any shared rawKey.
  for (const def of ALL_DEFINITIONS) {
    if (def.source === 'lifecycle') map[def.rawKey] = def;
  }
  return Object.freeze(map);
}

/**
 * MCP-021A — Frozen parallel registry of all 171 Machine Observation
 * definitions keyed by COMPOUND key `${source}:${rawKey}`.
 *
 * Pure TS. JSON-serializable. Frozen.
 */
export const MACHINE_OBSERVATION_DEFINITIONS_REGISTRY: Readonly<
  Record<string, MachineObservationDefinition>
> = buildCompoundRegistry();

/**
 * MCP-021A — Frozen parallel registry by rawKey (highest-priority entry
 * per rawKey).
 */
export const MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY: Readonly<
  Record<string, MachineObservationDefinition>
> = buildByRawKeyRegistry();

/**
 * Lookup a definition by rawKey. Returns null when absent.
 */
export function lookupMachineObservationDefinition(
  rawKey: string,
): MachineObservationDefinition | null {
  if (typeof rawKey !== 'string' || rawKey.length === 0) return null;
  return MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey] ?? null;
}

/**
 * Lookup a definition by compound key. Returns null when absent.
 */
export function lookupMachineObservationDefinitionByCompoundKey(
  source: MachineObservationDefinition['source'],
  rawKey: string,
): MachineObservationDefinition | null {
  if (typeof rawKey !== 'string' || rawKey.length === 0) return null;
  return MACHINE_OBSERVATION_DEFINITIONS_REGISTRY[makeMachineObservationKey(source, rawKey)] ?? null;
}

/**
 * Frozen list of all compound keys in the parallel registry.
 */
export const ALL_MACHINE_OBSERVATION_DEFINITION_KEYS: ReadonlyArray<string> =
  Object.freeze(Object.keys(MACHINE_OBSERVATION_DEFINITIONS_REGISTRY));

/**
 * Frozen list of every distinct rawKey in the parallel registry.
 */
export const ALL_MACHINE_OBSERVATION_DEFINITION_RAW_KEYS: ReadonlyArray<string> =
  Object.freeze(Object.keys(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY));

/**
 * Return all definitions in a given family.
 */
export function getDefinitionsForFamily(
  family: MachineObservationFamily,
): ReadonlyArray<MachineObservationDefinition> {
  return Object.freeze(ALL_DEFINITIONS.filter((d) => d.family === family));
}

/**
 * Test-only: iterate every definition.
 */
export const _INTERNAL_ALL_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> =
  ALL_DEFINITIONS;
