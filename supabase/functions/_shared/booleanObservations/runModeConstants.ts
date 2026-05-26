/**
 * MCP-021C-EDGE — Run mode constants mirror.
 *
 * Mirrors the values from
 * src/features/nodeLabels/machineObservationPersistenceTypes.ts on the
 * server-side. The values are intentionally identical because the
 * migration's CHECK constraint binds both sides.
 *
 * Pure TS. No Deno-specific call.
 */

export type MachineObservationRunMode = 'production' | 'admin_validation';

export const ALL_MACHINE_OBSERVATION_RUN_MODES:
  ReadonlyArray<MachineObservationRunMode> = Object.freeze([
    'production',
    'admin_validation',
  ]);

export function isMachineObservationRunMode(
  value: unknown,
): value is MachineObservationRunMode {
  return value === 'production' || value === 'admin_validation';
}
