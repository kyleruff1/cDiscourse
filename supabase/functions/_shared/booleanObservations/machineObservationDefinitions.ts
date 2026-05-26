/**
 * MCP-021C-EDGE — Mirror of
 * src/features/nodeLabels/machineObservationDefinitions.ts.
 *
 * Aggregates 10 family files into the parallel registry. Mirror differs
 * from the production source ONLY by explicit `.ts` extension imports for
 * Deno compatibility. The registry building logic is byte-equal.
 *
 * Parity drift test (__tests__/mcpOneTwoOneCEdgeParserParity.test.ts)
 * feeds the same inputs to both the production parser and this mirror's
 * parser to ensure no silent drift.
 */

import { makeMachineObservationKey } from './machineObservationRegistry.ts';
import { FAMILY_A_DEFINITIONS } from './machineObservationDefinitions/familyA.ts';
import { FAMILY_B_DEFINITIONS } from './machineObservationDefinitions/familyB.ts';
import { FAMILY_C_DEFINITIONS } from './machineObservationDefinitions/familyC.ts';
import { FAMILY_D_DEFINITIONS } from './machineObservationDefinitions/familyD.ts';
import { FAMILY_E_DEFINITIONS } from './machineObservationDefinitions/familyE.ts';
import { FAMILY_F_DEFINITIONS } from './machineObservationDefinitions/familyF.ts';
import { FAMILY_G_DEFINITIONS } from './machineObservationDefinitions/familyG.ts';
import { FAMILY_H_DEFINITIONS } from './machineObservationDefinitions/familyH.ts';
import { FAMILY_I_DEFINITIONS } from './machineObservationDefinitions/familyI.ts';
import { FAMILY_J_DEFINITIONS } from './machineObservationDefinitions/familyJ.ts';
import type {
  MachineObservationDefinition,
  MachineObservationFamily,
} from './nodeLabelTypes.ts';

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
 * MCP-021A — Parallel registry keyed by COMPOUND key `${source}:${rawKey}`.
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
 * MCP-021A — Definition registry by rawKey (collapses shared rawKeys
 * with the same priority order as MACHINE_OBSERVATION_BY_RAW_KEY:
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
 * Frozen parallel registry of all 171 Machine Observation definitions
 * keyed by COMPOUND key `${source}:${rawKey}`.
 */
export const MACHINE_OBSERVATION_DEFINITIONS_REGISTRY: Readonly<
  Record<string, MachineObservationDefinition>
> = buildCompoundRegistry();

/**
 * Frozen parallel registry by rawKey (highest-priority entry per rawKey).
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
