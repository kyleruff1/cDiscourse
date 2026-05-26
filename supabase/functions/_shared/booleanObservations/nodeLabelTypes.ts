/**
 * MCP-021C-EDGE — Mirror of src/features/nodeLabels/nodeLabelTypes.ts.
 *
 * Per design §1.3 + §2.1 (Outcome 3 / Parser-import resolution):
 * server-side mirror with parity-style drift test
 * (__tests__/mcpOneTwoOneCEdgeParserParity.test.ts). This file follows the
 * established repo mirror convention from
 * supabase/functions/_shared/constitution/allowedTransitions.ts — explicit
 * .ts extension imports for Deno compatibility, otherwise byte-equal type
 * shape to the production source.
 *
 * Doctrine anchors are byte-equal to the production source:
 *   - cdiscourse-doctrine §10a — Observations vs Allegations boundary
 *   - cdiscourse-doctrine §1 — no truth labels in any field
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

/**
 * Top-level taxonomy. Two values only. Machine-created labels are
 * Observations; user-created labels are Allegations.
 */
export type NodeLabelKind = 'machine_observation' | 'user_allegation';

/**
 * Source provenance. 7-value set.
 */
export type NodeLabelSource =
  | 'manual_tag'
  | 'auto_metadata'
  | 'lifecycle'
  | 'semantic_referee'
  | 'composition_mutation'
  | 'ai_classifier'
  | 'future_source';

/** Display surface routing. */
export type NodeLabelSurface =
  | 'timeline_node'
  | 'selected_context'
  | 'inspect'
  | 'composer'
  | 'hidden';

/** Per-registry-entry disposition gate. */
export type NodeLabelDisposition =
  | 'rendered_now'
  | 'inspect_only'
  | 'composer_only'
  | 'hidden_sensitive'
  | 'future_source'
  | 'intentionally_silent';

/**
 * Canonical per-source-per-node mark. Pure JSON-serializable.
 */
export interface NodeLabelMark {
  id: string;
  rawKey: string;
  kind: NodeLabelKind;
  source: NodeLabelSource;
  label: string;
  shortLabel: string;
  description: string;
  defaultSurface: NodeLabelSurface;
  disposition: NodeLabelDisposition;
  priority: number;
  visibleByDefault: boolean;
  confidence?: 'low' | 'medium' | 'high';
}

export const ALL_NODE_LABEL_KINDS: ReadonlyArray<NodeLabelKind> = Object.freeze([
  'machine_observation',
  'user_allegation',
]);

export const ALL_NODE_LABEL_SOURCES: ReadonlyArray<NodeLabelSource> = Object.freeze([
  'manual_tag',
  'auto_metadata',
  'lifecycle',
  'semantic_referee',
  'composition_mutation',
  'ai_classifier',
  'future_source',
]);

export const ALL_NODE_LABEL_SURFACES: ReadonlyArray<NodeLabelSurface> = Object.freeze([
  'timeline_node',
  'selected_context',
  'inspect',
  'composer',
  'hidden',
]);

export const ALL_NODE_LABEL_DISPOSITIONS: ReadonlyArray<NodeLabelDisposition> = Object.freeze([
  'rendered_now',
  'inspect_only',
  'composer_only',
  'hidden_sensitive',
  'future_source',
  'intentionally_silent',
]);

// ── MCP-021A — Machine Observation taxonomy ───────────────────────

/**
 * Family taxonomy for Machine Observations. 10 families partition the 171
 * entries by phenomenon being observed.
 */
export type MachineObservationFamily =
  | 'parent_relation'
  | 'disagreement_axis'
  | 'misunderstanding_repair'
  | 'evidence_source_chain'
  | 'argument_scheme'
  | 'critical_question'
  | 'resolution_progress'
  | 'claim_clarity'
  | 'thread_topology'
  | 'sensitive_composer';

export const ALL_MACHINE_OBSERVATION_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze([
    'parent_relation',
    'disagreement_axis',
    'misunderstanding_repair',
    'evidence_source_chain',
    'argument_scheme',
    'critical_question',
    'resolution_progress',
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ]);

/**
 * Per-surface confidence threshold map.
 */
export interface MachineObservationConfidenceEligibility {
  timelineMinConfidence: 'low' | 'medium' | 'high';
  selectedContextMinConfidence: 'low' | 'medium' | 'high';
  inspectMinConfidence: 'low' | 'medium' | 'high';
}

/**
 * Verbose internal definition shape for a Machine Observation.
 */
export interface MachineObservationDefinition {
  id: string;
  rawKey: string;
  kind: 'machine_observation';
  source: NodeLabelSource;
  label: string;
  shortLabel: string;
  description: string;
  defaultSurface: NodeLabelSurface;
  disposition: NodeLabelDisposition;
  priority: number;
  visibleByDefault: boolean;
  confidence?: 'low' | 'medium' | 'high';
  family: MachineObservationFamily;
  booleanQuestion: string;
  positiveDefinition: string;
  negativeDefinition: string;
  positiveExamples: ReadonlyArray<string>;
  negativeExamples: ReadonlyArray<string>;
  falsePositiveGuards: ReadonlyArray<string>;
  doctrineNotes: ReadonlyArray<string>;
  confidenceEligibility: MachineObservationConfidenceEligibility;
}
