/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — deployed A-G rawKey set.
 *
 * Derives, from the live MCP-021A definition registry, the set of rawKeys
 * that belong to the seven PRODUCTION families (A-G) and are therefore
 * GENUINELY returnable by the deployed classifier. The mapping registry's
 * reconciliation test asserts every adopted rule's flags are members of this
 * set, so no rule can reference a non-existent / planned-only / H-I-J flag.
 *
 * Pure TS. No React, no Supabase, no network. Frozen.
 */

import {
  MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
  _INTERNAL_ALL_DEFINITIONS,
} from '../machineObservationDefinitions';
import type { MachineObservationFamily } from '../nodeLabelTypes';

/** The seven production families (A-G). H/I/J are deliberately excluded. */
export const PRODUCTION_AG_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze([
    'parent_relation',
    'disagreement_axis',
    'misunderstanding_repair',
    'evidence_source_chain',
    'argument_scheme',
    'critical_question',
    'resolution_progress',
  ]);

const AG_FAMILY_SET = new Set<MachineObservationFamily>(PRODUCTION_AG_FAMILIES);

/** The frozen H/I/J families — NEVER adoptable by the mapping registry. */
export const FROZEN_HIJ_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze(['claim_clarity', 'thread_topology', 'sensitive_composer']);

function buildDeployedAgRawKeySet(): ReadonlySet<string> {
  const out = new Set<string>();
  for (const def of _INTERNAL_ALL_DEFINITIONS) {
    if (AG_FAMILY_SET.has(def.family)) out.add(def.rawKey);
  }
  return out;
}

/**
 * Frozen set of every rawKey deployed in an A-G family. Used by the
 * reconciliation test. Built from the live definition registry, so it stays
 * in sync if a future definition is added/removed.
 */
export const DEPLOYED_AG_RAW_KEYS: ReadonlySet<string> =
  buildDeployedAgRawKeySet();

/** True iff `rawKey` is a deployed A-G rawKey. */
export function isDeployedAgRawKey(rawKey: string): boolean {
  return DEPLOYED_AG_RAW_KEYS.has(rawKey);
}

/** The family a deployed rawKey belongs to, or null. */
export function familyForDeployedRawKey(
  rawKey: string,
): MachineObservationFamily | null {
  const def = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey];
  return def ? def.family : null;
}
