/**
 * MCP-021C-EDGE — Narrow mirror of
 * src/features/nodeLabels/machineObservationRegistry.ts.
 *
 * Re-exports only the helper functions / types the
 * MCP-021A parser + definitions aggregator transitively need:
 *   - makeMachineObservationKey(source, rawKey)
 *
 * Pure TS. No Deno-specific import. No registry data — the full
 * `MACHINE_OBSERVATION_REGISTRY` (the byte-equal NodeLabelMark map) is
 * NOT mirrored because the Edge Function works exclusively from the
 * EXTENDED `MachineObservationDefinition` shape via the parallel
 * registry in `./machineObservationDefinitions.ts`.
 *
 * Follows the established repo mirror convention (explicit .ts
 * extension imports for Deno compatibility; otherwise byte-equal type
 * shape to the production source).
 */

import type { NodeLabelSource } from './nodeLabelTypes.ts';

/** Compose the compound registry key. Stable for adapter + presentation. */
export function makeMachineObservationKey(source: NodeLabelSource, rawKey: string): string {
  return `${source}:${rawKey}`;
}
