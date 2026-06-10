/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — deployed production
 * rawKey set.
 *
 * Derives, from the live MCP-021A definition registry, the set of rawKeys
 * that belong to the PRODUCTION families (now A-I, after Family H /
 * `claim_clarity` was production-enabled via PR #559 and Family I /
 * `thread_topology` via PR #562) and are therefore GENUINELY returnable by
 * the deployed classifier. The mapping registry's reconciliation test asserts
 * every adopted rule's flags are members of this set, so no rule can reference
 * a non-existent / planned-only / frozen-J flag.
 *
 * Pure TS. No React, no Supabase, no network. Frozen.
 */

import {
  MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
  _INTERNAL_ALL_DEFINITIONS,
} from '../machineObservationDefinitions';
import type { MachineObservationFamily } from '../nodeLabelTypes';

/**
 * The production families. Originally the seven A-G families; extended to A-I
 * after the Family H (PR #559) and Family I (PR #562) Edge production enables
 * (both windows closed PASS). Family J (`sensitive_composer`) is deliberately
 * excluded — it remains frozen by ratified disposition. The exported NAME is
 * kept (`PRODUCTION_AG_FAMILIES`, historically A-G) to avoid a wide importer
 * ripple; the contents are the authoritative production roster.
 */
export const PRODUCTION_AG_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze([
    'parent_relation',
    'disagreement_axis',
    'misunderstanding_repair',
    'evidence_source_chain',
    'argument_scheme',
    'critical_question',
    'resolution_progress',
    'claim_clarity', // Family H — production-enabled via PR #559
    'thread_topology', // Family I — production-enabled via PR #562
  ]);

const AG_FAMILY_SET = new Set<MachineObservationFamily>(PRODUCTION_AG_FAMILIES);

/**
 * The frozen family set — NEVER adoptable by the mapping registry. After the
 * H/I production enables only Family J (`sensitive_composer`) remains frozen.
 * The exported NAME is kept (`FROZEN_HIJ_FAMILIES`, historically {H,I,J}) to
 * avoid a wide importer ripple; the contents are now J-only.
 */
export const FROZEN_HIJ_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze(['sensitive_composer']);

function buildDeployedAgRawKeySet(): ReadonlySet<string> {
  const out = new Set<string>();
  for (const def of _INTERNAL_ALL_DEFINITIONS) {
    if (AG_FAMILY_SET.has(def.family)) out.add(def.rawKey);
  }
  return out;
}

/**
 * Frozen set of every rawKey deployed in a production family (now A-I). Used
 * by the reconciliation test. Built from the live definition registry, so it
 * stays in sync if a future definition is added/removed (and it auto-adopted
 * the H + I keys when those families joined `PRODUCTION_AG_FAMILIES`). The
 * exported NAME is kept (`DEPLOYED_AG_RAW_KEYS`, historically A-G) to avoid a
 * wide importer ripple.
 */
export const DEPLOYED_AG_RAW_KEYS: ReadonlySet<string> =
  buildDeployedAgRawKeySet();

/** True iff `rawKey` is a deployed production (A-I) rawKey. */
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
