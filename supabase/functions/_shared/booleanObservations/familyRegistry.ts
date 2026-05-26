/**
 * MCP-021C-EDGE — Per-family enablement gate.
 *
 * The single source of truth for "which families are eligible to run in
 * production mode" vs "which families are eligible to run in admin
 * validation mode". Per design §3.2 + Decision 4:
 *
 *   - Production mode: ONLY `parent_relation` (Family A — 16 keys) is
 *     enabled at MCP-021C-EDGE ship. Other families ship as mirrors but
 *     do NOT receive production traffic until a per-family enablement
 *     card flips the flag.
 *   - Admin validation mode: ALL 10 families are enabled. Admin
 *     validation rows are persisted with `run_mode = 'admin_validation'`
 *     and filtered out of production Source 6 rendering at the
 *     persistence query layer (see machineObservationPersistenceQuery.ts).
 *
 * Future family enablement is a small surgical card: flip the
 * `productionEnabled` flag for the target family + add a test asserting
 * the flip + ship. No Edge Function code change required.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1, §10a — Machine Observations are structural;
 *     production enablement is gameplay-routing, never a verdict on the
 *     family's quality.
 *   - cdiscourse-doctrine §4 — AI moderator is advisory; admin
 *     validation is the operator audit posture, never a moderation gate.
 *
 * Pure TS. No Deno-specific runtime call. Tests can import this module
 * directly via the Jest bridge.
 */

import type { MachineObservationFamily } from './nodeLabelTypes.ts';

/**
 * Per-family enablement entry. Holds the production/admin discriminators
 * + the raw_keys covered by the family (derived from the mirror family
 * files — see {@link FAMILY_REGISTRY}).
 */
export interface FamilyRegistryEntry {
  family: MachineObservationFamily;
  /**
   * True when the family is eligible for production-mode classifier
   * traffic at the Edge Function. At MCP-021C-EDGE ship, ONLY
   * `parent_relation` is `true`; all others are `false`.
   */
  productionEnabled: boolean;
  /**
   * True when the family is eligible for admin-validation-mode
   * classifier traffic at the Edge Function. All 10 families are `true`
   * — admin validation is the audit surface where operators verify a
   * family's output before flipping production on.
   */
  adminValidationEnabled: boolean;
}

/**
 * MCP-021C-EDGE — Frozen registry of every family's enablement posture.
 *
 * Iteration order is intentionally the Decision 3 + Decision 4 brief
 * order (Family A first; Family J last).
 */
export const FAMILY_REGISTRY: ReadonlyArray<FamilyRegistryEntry> = Object.freeze([
  {
    family: 'parent_relation',
    productionEnabled: true,
    adminValidationEnabled: true,
  },
  {
    family: 'disagreement_axis',
    productionEnabled: false,
    adminValidationEnabled: true,
  },
  {
    family: 'misunderstanding_repair',
    productionEnabled: false,
    adminValidationEnabled: true,
  },
  {
    family: 'evidence_source_chain',
    productionEnabled: false,
    adminValidationEnabled: true,
  },
  {
    family: 'argument_scheme',
    productionEnabled: false,
    adminValidationEnabled: true,
  },
  {
    family: 'critical_question',
    productionEnabled: false,
    adminValidationEnabled: true,
  },
  {
    family: 'resolution_progress',
    productionEnabled: false,
    adminValidationEnabled: true,
  },
  {
    family: 'claim_clarity',
    productionEnabled: false,
    adminValidationEnabled: true,
  },
  {
    family: 'thread_topology',
    productionEnabled: false,
    adminValidationEnabled: true,
  },
  {
    family: 'sensitive_composer',
    productionEnabled: false,
    adminValidationEnabled: true,
  },
]);

/**
 * Lookup a family registry entry. Returns null when absent. Pure.
 */
export function lookupFamilyRegistryEntry(
  family: MachineObservationFamily | string,
): FamilyRegistryEntry | null {
  for (const entry of FAMILY_REGISTRY) {
    if (entry.family === family) return entry;
  }
  return null;
}

/**
 * Filter a requested-families list to those eligible for the given mode.
 * Returns a NEW frozen array (never mutates the input). Pure.
 *
 *   - Mode 'production': keeps only families with `productionEnabled: true`.
 *   - Mode 'admin_validation': keeps only families with
 *     `adminValidationEnabled: true` (currently all 10).
 */
export function filterFamiliesForMode(
  requestedFamilies: ReadonlyArray<MachineObservationFamily>,
  mode: 'production' | 'admin_validation',
): ReadonlyArray<MachineObservationFamily> {
  const kept: MachineObservationFamily[] = [];
  for (const family of requestedFamilies) {
    const entry = lookupFamilyRegistryEntry(family);
    if (!entry) continue;
    if (mode === 'production' && entry.productionEnabled) {
      kept.push(family);
    } else if (mode === 'admin_validation' && entry.adminValidationEnabled) {
      kept.push(family);
    }
  }
  return Object.freeze(kept);
}

/**
 * The list of families eligible for production right now. Convenience
 * helper for tests + the Edge Function handler.
 */
export function productionEnabledFamilies(): ReadonlyArray<MachineObservationFamily> {
  return Object.freeze(
    FAMILY_REGISTRY.filter((e) => e.productionEnabled).map((e) => e.family),
  );
}

/**
 * The list of families eligible for admin validation right now.
 */
export function adminValidationEnabledFamilies(): ReadonlyArray<MachineObservationFamily> {
  return Object.freeze(
    FAMILY_REGISTRY.filter((e) => e.adminValidationEnabled).map((e) => e.family),
  );
}
